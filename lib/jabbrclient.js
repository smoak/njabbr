var signalr = require('./signalr').SignalR,
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    $ = require('./utility'),
    Deferred = require('Deferred');

var JabbrClient,
    callbackId = 0,
    callbacks = {},
    checkingStatus = false;

var JabbrClientEvents = {
    onMessageReceived: 'messageReceived',
    onUserJoined: 'userJoined'
};

function getArgValue(a) {
    return $.isFunction(a) ? null : ($.type(a) === "undefined" ? null : a);
}

// Creates a new shallow copy of an object
// while excluding certain keys
function copy(obj, exclude) {
    var newObj = {};
    $.each(obj, function(key, value) {
        if ($.inArray(key, exclude) === -1) {
            // exclude array doesnt contain key so
            // we need to add it to our newObj
            newObj[key] = value;
        }
    });
    return newObj;
}

function processHubState(hubName, left, right) {
    $.extend(left, right);
}

// executes a call to the signalR server
function serverCall(hub, methodName, args) {
    var callback = args[args.length - 1],
        methodArgs = $.type(callback) === "function" ? args.slice(0, -1) : args,
        argValues = methodArgs.map(getArgValue),
        data = { hub: hub._.hubName, action: methodName, data: argValues, state: copy(hub, ["_"]), id: callbackId },
        d = new Deferred(),
        cb = function(result) {
            processHubState(hub._.hubName, hub, result.State); 
            if (result.Error) {
                if (result.StackTrace) {
                    console.log(result.StackTrace);
                }
                d.rejectWith(hub, [result.Error]);
            } else {
                if ($.type(callback) === "function") {
                    callback.call(hub, result.Result);
                }
                d.resolveWith(hub, [result.Result]);
            }
        };
    callbacks[callbackId.toString()] = { scope: hub, callback: cb };
    callbackId += 1;
    hub._.connection().send(JSON.stringify(data));
    return d;
}

function executeCallback(hubName, fn, args, state) {
    var hub = hubs[hubName],
        hubMethod;
    if (hub) {
        processHubState(hubName, hub, state);
        if (hub[fn]) {
            hubMethod = hub[fn];
            if (hubMethod) {
                hubMethod.apply(hub, args);
            }
        }
    }
}

// Our Jabbr chat hub
var hub = {
    chat: {
        _: {
            hubName: "JabbR.Chat",
            ignoreMembers: ['join', 'checkStatus', 'send', 'getUserInfo', 'getCommands', 'getRooms', 'getPreviousMessages', 'getRoomInfo', 'typing', 'namespace', 'ignoreMembers', 'callbacks'],
            connection: function() {
                return this.signalr;
            },
            signalr: null,
            jabbrClient: null
        },
        join: function(callback) {
            return serverCall(this, "Join", $.makeArray(arguments));
        },
        send: function (message, callback) {
            return serverCall(this, "Send", $.makeArray(arguments));
        },
        getRoomInfo: function(roomName, callback) {
            return serverCall(this, "GetRoomInfo", $.makeArray(arguments));
        },
        typing: function(callback) {
            return serverCall(this, "Typing", $.makeArray(arguments));
        },
        checkStatus: function(callback) {
            return serverCall(this, "CheckStatus", $.makeArray(arguments));
        },
        sendCommand: function(command, onSuccess) {
            var id = $.newId(),
                clientMessage = {
                    id: id,
                    content: command ,
                    room: this.activeRoom
                };
                this.send(clientMessage).fail(function(e) {
                    util.log("failed to send command");
                    util.log(e);
                }).done(function(success) {
                    if (onSuccess) {
                        onSuccess();
                    }
                });
        }
    }
};

// The hubs we support. Only chat for now
var hubs = {
    "JabbR.Chat": hub.chat
};

module.exports.JabbrClient = (function() {

    function JabbrClient(server) {
        EventEmitter.call(this);
        this.client = new signalr(server + "/signalr");
        this.hub = hub.chat;
        this.hub._.signalr = this.client;

        var self = this;
        this.hub.addMessage = function(message, room) {
            // parse the date into a javascript date
            message.When = new Date(parseInt(message.When.substr(6)));
            self.emit(JabbrClientEvents.onMessageReceived, message, room);
        };
    };

    util.inherits(JabbrClient, EventEmitter);

    JabbrClient.prototype.connect = function(username, password, onSuccess) {
        var self = this;
        this.client.on('disconnect', function() {
            console.log("disconnected");
        });
        this.client
            .sending(function() {
                var localHubs = [];
                $.each(hubs, function(key) {
                    var methods = [];
                    $.each(this, function(key) {
                        if (key === "obj") {
                            return true;
                        }
                        methods.push(key);
                    });
                    localHubs.push({name: key, methods: methods});
                }); 
                this.data = JSON.stringify(localHubs);   
            })
            .received(function(result) {
                var callbackId, cb;
                if (result) {
                    if (!result.Id) {
                        executeCallback(result.Hub, result.Method, result.Args, result.State);
                    } else {
                        callbackId = result.Id.toString();
                        cb = callbacks[callbackId];
                        if (cb) {
                            callbacks[callbackId] = null;
                            delete callbacks[callbackId];
                            cb.callback.call(cb.scope, result);
                        }
                    }
                }
            })
            .start(function() {
                self.hub.join()
                    .fail(function(e) {
                        console.log(e);
                    })
                    .done(function(success) {
                        if (!success) {
                            self.hub.sendCommand("/nick " + username + " " + password, onSuccess);
                        }
                    });
        });

        this.client.reconnected(function() {
            if (checkingStatus === true) {
                return;
            }

            checkingStatus = true;

            self.hub.checkStatus().done(function(requiresUpdate) {
                if (requiresUpdate) {
                    // TODO
                }
            }).always(function() { 
                checkingStatus = false;
            })
        });

    };

    JabbrClient.prototype.joinRoom = function(roomName, onSuccess) {
        this.hub.sendCommand("/join " + roomName, onSuccess);
    };

    JabbrClient.prototype.getRoomInfo = function(roomName, onSuccess) {
        this.hub.getRoomInfo(roomName).done(function(roomInfo) {
            if (onSuccess) {
                onSuccess(roomInfo);
            }
        });
    };

    JabbrClient.prototype.setNote = function(note, onSuccess) {
        this.hub.sendCommand("/note " + note, onSuccess);    
    };

    JabbrClient.prototype.setFlag = function(countryCode, onSuccess) {
        this.hub.sendCommand("/flag " + countryCode, onSuccess);
    };

    JabbrClient.prototype.leaveRoom = function(roomName, onSuccess) {
        this.hub.sendCommand("/leave " + roomName, onSuccess);
    };

    JabbrClient.prototype.sendPrivateMessage = function(username, msg, onSuccess) {
        this.hub.sendCommand("/msg " + username + " " + message, onSuccess);
    };

    JabbrClient.prototype.changeName = function(newName, onSuccess) {
        this.hub.sendCommand("/nick " + newName, onSuccess);
    };

    JabbrClient.prototype.setTyping = function(onSuccess) {
        this.hub.typing().done(function() {
            if (onSuccess) {
                onSuccess();
            }
        });
    };

    JabbrClient.prototype.disconnect = function() {
        this.client.stop();
    };

    JabbrClient.prototype.say = function(msg, roomName, onSuccess) {
        this.hub.send(msg, roomName).done(function() {
            if (onSuccess) {
              onSuccess();
            }  
        });
    };

    return JabbrClient;
}());
