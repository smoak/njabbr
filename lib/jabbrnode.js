var signalr = require('./signalr').SignalR,
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    $ = require('./utility'),
    Deferred = require('Deferred');

var JabbrNode,
    callbackId = 0,
    callbacks = {};

var JabbrNodeEvents = {
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
        processHubState(hubName, hub.obj, state);
        if (hub[fn]) {
            hubMethod = hub.obj[fn];
            if (hubMethod) {
                hubMethod.apply(hub.obj, args);
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
            signalr: null
        },
        join: function(callback) {
            return serverCall(this, "Join", $.makeArray(arguments));
        },
        send: function (message, callback) {
            return serverCall(this, "Send", $.makeArray(arguments));
        }
    }
};

// The hubs we support. Only chat for now
var hubs = {
    "JabbR.Chat": hub.chat
};

module.exports.JabbrNode = (function() {

    function JabbrNode(server) {
        EventEmitter.call(this);
        this.client = new signalr(server + "/signalr");
        this.hub = hub.chat;
        this.hub._.signalr = this.client;
    };

    util.inherits(JabbrNode, EventEmitter);

    JabbrNode.prototype.connect = function(username, password, onSuccess) {
        var self = this;
        this.client
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
                            var id = $.newId(),
                                clientMessage = {
                                    id: id,
                                    content: "/nick " + username + " " + password,
                                    room: self.hub.activeRoom
                                };
                            self.hub.send(clientMessage).fail(function(e) {
                                util.log("failed to login");
                                util.log(e);
                            }).done(function(success) {
                                onSuccess.call(self);
                            });
                        }
                            
                    });
        });
    };

    JabbrNode.prototype.joinRoom = function(roomName, onSuccess) {
        var id = $.newId(),
            clientMessage = {
                id: id,
                content: "/join " + roomName
            };
        this.hub.send(clientMessage).fail(function(e) {
            util.log("Failed to join " + roomName);
            util.log(e);
        }).done(function(success) {
            onSuccess();
        });
    };

    return JabbrNode;
}());
