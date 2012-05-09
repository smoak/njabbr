var signalr = require('./signalr').SignalR,
    Deferred = require('Deferred');

var JabbrNode,
    callbackId = 0,
    callbacks = {};

var JabbrNodeEvents = {
    onMessageReceived: 'messageReceived',
    onUserJoined: 'userJoined'
};

function arrayFromArgs() {
    return Array.prototype.slice.call(arguments);
}

function getArgValue(a) {
    return typeof a === "function" ? null : (typeof a === "undefined" ? null : a);
}

// Creates a new shallow copy of an object
// while excluding certain keys
function copy(obj, exclude) {
    var newObj = {};
    for (var key in obj) {
        var value = obj[key];
        // only add the key, value pair to the
        // new object if its NOT in the exclude
        // array
        if (exclude.indexOf(key) === -1) {
            // exclude array doesnt contain key so
            // we need to add it to our newObj
            newObj[key] = value;
        }
    }
    return newObj;
}

function serverCall(hub, methodName, args) {
    var callback = args[args.length - 1],
        methodArgs = typeof callback === "function" ? args.slice(0, -1) : args,
        argValues = methodArgs.map(getArgValue),
        data = { hub: hub._.hubName, action: methodName, data: argValues, state: copy(hub, ["_"]), id: callbackId },
        d = new Deferred(),
        cb = function(result) {
            if (result.Error) {
                if (result.StackTrace) {
                    console.log(result.StackTrace);
                }
                d.rejectWith(hub, [result.Error]);
            } else {
                if (typeof callback === "function") {
                    callback.call(hub, result.Result);
                }
                d.resolveWith(hub, [result.Result]);
            }
        };
    console.log(data);
    callbacks[callbackId.toString()] = { scope: hub, callback: cb };
    callbackId += 1;
    hub._.connection().send(JSON.stringify(data));
    return d;
}



// Our Jabbr chat hub
var hub = {
    chat: {
        _: {
            hubName: "JabbR.Chat",
            connection: function() {
                return this.signalr;
            },
            signalr: null
        },
        join: function(callback) {
            return serverCall(this, "Join", arrayFromArgs(arguments));
        }
    }
};

module.exports.JabbrNode = (function() {

    function JabbrNode(server) {
        this.client = new signalr(server + "/signalr");
        this.hub = hub.chat;
        this.hub._.signalr = this.client;
    };

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
                        console.log("joined hub!");
                        onSuccess(success);
                    });
        });
    };

    return JabbrNode;
}());
