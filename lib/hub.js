var $ = require('./utility'),
    Deferred = require('Deferred');

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

        this.processState = function(state) {
            $.extend(this.state, state);
        };
    }

    Hub.prototype.join = function(callback) {
        return this.serverCall("Join", $.makeArray(arguments));
    };

    // executes a call to the signalR server
    // returns a deferred
    Hub.prototype.serverCall = function(methodName, args) {
        var callback = args[args.length - 1],
            methodArgs = $.type(callback) === "function" ? args.slice(0, -1) : args,
            argValues = methodArgs.map(getArgValue),
            data = { hub: this.hubName, action: methodName, data: argValues, state: this.state, id: this.callbackId },
            d = new Deferred(),
            self = this,
            cb = function(result) {
                self.processState(result.State); 
                if (result.Error) {
                    if (result.StackTrace) {
                        console.log(result.StackTrace);
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
        
    };

    Hub.prototype.checkStatus = function(callback) {
        return this.serverCall("CheckStatus", $.makeArray(arguments));
    };



}());
