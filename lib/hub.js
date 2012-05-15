var $ = require('./utility'),
    Deferred = require('Deferred'),
    util = require('util');

var Hub;

function getArgValue(a) {
    return $.isFunction(a) ? null : ($.type(a) === "undefined" ? null : a);
}

module.exports.Hub = (function() {

    function Hub(hubName, signalRConnection) {
        this.hubName = hubName;
        this.connection = signalRConnection;
        this.callbackId = 0;
        this.callbacks = {};
        this.state = {};
    }

    // process state that came back from the server
    Hub.prototype.processState = function(state) {
        $.extend(this.state, state);
    };

    Hub.prototype.join = function(callback) {
        return this.serverCall("Join", $.makeArray(arguments));
    };

    // executes a call to the signalR server
    // returns a deferred
    Hub.prototype.serverCall = function(methodName, args) {
        var callback = args[args.length - 1],
            methodArgs = $.type(callback) === "function" ? args.slice(0, -1) : args,
            argValues = methodArgs.map(getArgValue),
            data = { hub: this.hubName, method: methodName, args: argValues, state: this.state, id: this.callbackId },
            d = new Deferred(),
            self = this,
            cb = function(result) {
                self.processState(result.State); 
                if (result.Error) {
                    if (result.StackTrace) {
                        util.log(result.StackTrace);
                    }
                    d.rejectWith(self, [result.Error]);
                } else {
                    if ($.type(callback) === "function") {
                        callback.call(self, result.Result);
                    }
                    d.resolveWith(self, [result.Result]);
                }
            };

        this.callbacks[this.callbackId.toString()] = { scope: this, callback: cb };
        this.callbackId += 1;
        this.connection.send(JSON.stringify(data));
        return d;
    };

    Hub.prototype.sendCommand = function(command, onSuccess) {
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
    };

    Hub.prototype.checkStatus = function(callback) {
        return this.serverCall("CheckStatus", $.makeArray(arguments));
    };

    Hub.prototype.send = function(message, callback) {
        return this.serverCall("Send", $.makeArray(arguments));
    };

    Hub.prototype.getRoomInfo = function(roomName, callback) {
        return this.serverCall("GetRoomInfo", $.makeArray(arguments));
    };

    Hub.prototype.typing = function(callback) {
        return this.serverCall("Typing", $.makeArray(arguments));
    };

    Hub.prototype.checkStatus = function(callback) {
        return this.serverCall("CheckStatus", $.makeArray(arguments));
    };

    return Hub;

}());
