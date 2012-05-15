var signalr = require('./signalr').SignalR,
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    $ = require('./utility'),
    Deferred = require('Deferred');

var JabbrClient,
    JabbrClientEvents = {
        onMessageReceived: 'messageReceived',
        onUserJoined: 'userJoined'
    };

module.exports.JabbrClient = (function() {

    function JabbrClient(options) {
        EventEmitter.call(this);

        var server;
        this.logging = false;

        // support the ability to pass in an options object
        // or just a url
        if ($.type(options) === "object") {
            server = options.url;
            this.logging = options.logging || false;
        } else {
            // they just passed in a url
            server = options;
        }


        // create connection to signalr
        this.connection = new signalr(server + "/signalr");
        this.hub = this.connection.createHub("chat");

        var self = this;
        this.hub.addMessage = function(message, room) {
            // parse the date into a javascript date
            message.When = new Date(parseInt(message.When.substr(6)));
            self.emit(JabbrClientEvents.onMessageReceived, message, room);
        };

        this.executeCallback = function(hubName, fn, args, state) {
            var hubMethod;
            self.hub.processState(state);
            if (self.hub[fn]) {
                hubMethod = self.hub[fn];
                if (hubMethod) {
                    hubMethod.apply(self.hub, args);
                }
            }
        };

        this.log = function(msg) {
            if (self.logging === true) {
                util.log("[JabbrClient] " + msg);
            }
        }
    };

    util.inherits(JabbrClient, EventEmitter);

    JabbrClient.prototype.connect = function(username, password, onSuccess) {
        var self = this;

        this.connection.on('disconnect', function() {
            // TODO
        });

        this.connection.sending(function() {
            var methods = [];
            $.each(self.hub, function(key) {
                if (key === "obj") {
                    return true;
                }
                methods.push(key);
            });
            this.data = JSON.stringify([{name: self.hub.hubName, methods: methods}]);
            util.log(this.data);
        })
        .received(function(result) {
            var callbackId, cb;
            if (result) {
                if (!result.Id) {
                    self.executeCallback(result.Hub, result.Method, result.Args, result.State);
                } else {
                    callbackId = result.Id.toString();
                    cb = self.hub.callbacks[callbackId];
                    if (cb) {
                        self.hub.callbacks[callbackId] = null;
                        delete self.hub.callbacks[callbackId];
                        cb.callback.call(cb.scope, result);
                    }
                }
            }
        })
        .start(function() {
            self.hub.join().fail(function(e) {
                self.log("Failed to Join");
                self.log(e);
            }).done(function(success) {
                self.log("Joined hub!");
                if (!success) {
                    self.hub.sendCommand("/nick " + username + " " + password, onSuccess);
                }
            });
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
        this.connection.stop();
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
