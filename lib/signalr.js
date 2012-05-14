var url = require('url'),
    EventSource = require('eventsource'),
    qs = require('querystring'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    Deferred = require('Deferred'),
    signalrHttp = require('./signalrHttp').SignalRHttp,
    $ = require('./utility');

var SignalR;
var NEGOTIATE_PATH = "/negotiate";

var SignalrEvents = {
    onStart: 'start',
    onStarting: 'starting',
    onSending: 'sending',
    onReconnect: 'reconnect',
    onError: 'onError',
    onReceived: 'received'
};

var transportLogic = {
    // TODO Clean this all up 
    // it should probably use the built in querystring module
    addQs: function(url, connection) {
        if (!connection.qs) {
            return url;
        }

        if (typeof connection.qs === "object") {
            return url + "&" + $.param(connection.qs);
        }

        if (typeof connection.qs === "string") {
            return url + "&" + connection.qs;
        }

        return url + "&" + escape(connection.qs.toString());
    },
    getUrl: function(connection, transport, reconnecting) {
        var url = connection.uri.href,
            qs = "transport=" + transport + "&connectionId=" + escape(connection.id);
        if (connection.data) {
            qs += "&connectionData=" + escape(connection.data);
        }

        if (!reconnecting) {
            url = url + "/connect";
        } else {
            if (connection.messageId) {
                qs += "&messageId=" + connection.messageId;
            }
            if (connection.groups) {
                qs += "&groups=" + escape(JSON.stringify(connection.groups));
            }
        }
        url += "?" + qs;
        url = this.addQs(url, connection);
        return url;
    },
    processMessages: function(connection, data) {
        if (data) {
            if (data.Disconnect) {
                util.log("Disconnect command received from server");
                connection.stop();
                connection.emit(SignalrEvents.onDisconnect);
                return;
            }

            if (data.TimedOut) {
                // Attempt to reconnect?
                if (connection.transport) {
                    connection.transport.reconnect(connection);
                }
            }

            if (data.Messages) {
                $.each(data.Messages, function() {
                    try {
                        connection.emit(SignalrEvents.onReceived, this);
                    } catch (e) {
                        util.log("Error raising received " + e);
                        connection.emit(SignalrEvents.onError, [e]);
                    }
                });
            }
            connection.messageId = data.MessageId;
            connection.groups = data.TransportData.Groups;
        } else {
            util.log("processMessages called without data");
        }
    },
    send: function(connection, data) {
        var url = connection.uri.href + "/send" + "?transport=" + connection.transport.name + "&connectionId=" + escape(connection.id);
        url = this.addQs(url, connection);
        data = qs.stringify({
            data: data
        });
        signalrHttp.post(url, data, function(result) {
            result = JSON.parse(result);
            if (result) {
                connection.emit(SignalrEvents.onReceived, result);
            }
        },
        function (err) {
            util.log("Error sending " + util.inspect(data, true, null) + " to " + url + " Error Details: " + err);
            connection.emit(SignalrEvents.onError [err]);
        });
    }
};


module.exports.SignalR = (function() {

    // full url to signalr
    // e.g. http://jabbr.net/signalr
    function SignalR(signalrUrl) {
        EventEmitter.call(this);
        this.uri = url.parse(signalrUrl);
        this.reconnectDelay = 2000;
    };

    util.inherits(SignalR, EventEmitter);

    // Adds a callback thats invoked before the connection
    // is started
    SignalR.prototype.starting = function(callback) {
        var connection = this;
        // we only want to call the callback once
        connection.once(SignalrEvents.onStarting, function(e, data) {
            callback.call(connection);
        });
        return this;
    };

    // Starts the connection
    SignalR.prototype.start = function(options, callback) {
        var connection = this,
            config = {
                transport: "auto"
            },
            promise = new Deferred();
        util.log("Starting");
        if (this.transport) {
            // Already started
            util.log("Already started");
            promise.resolve(connection);
            return;
        }
        if ($.type(options) === "function") {
            callback = options;
        } else if ($.type(options) === "object") {
            $.extend(config, options);
            if ($.type(config.callback) === "function") {
                callback = config.callback;
            }
        }
        this.on(SignalrEvents.onStart, function (e, data) {
            if ($.type(callback) === "function") {
                callback.call(connection);
            }
            promise.resolve(connection);
        });
        // we need to negotiate
        // with the server
        negotiate(this, promise, config);
        return promise;
    };

    // Adds a callback that will be invoked after anything is received over the connection
    SignalR.prototype.received = function(callback) {
        var connection = this;
        connection.on(SignalrEvents.onReceived, function (data) {
            callback.call(connection, data);
        });
        return connection;
    };

    SignalR.prototype.error = function(callback) {
        var connection = this;
        connection.on(SignalrEvents.onError, function(e, data) {
            callback.call(connection, data);
        });
        return connection;
    };

    var negotiate = function(signalR, promise, config) {
        util.log("negotiating");
        // POST to the negotiate path
        signalrHttp.post(
            signalR.uri.href + NEGOTIATE_PATH, 
            null,
            function(body) {
                parseNegotiateBody(signalR, body, promise, config);
            },
            function(e) {
                util.log("Error during negotiation " + util.inspect(e, true, null));
                promise.reject("SignalR: Error during negotiation request: " + e);
            });
                
    };

    var parseNegotiateBody = function(signalR, body, promise, config) {
        body = JSON.parse(body);
        signalR.appRelativeUrl = body.Url;
        signalR.id = body.ConnectionId;
        signalR.webSocketServerUrl = body.WebSocketServerUrl;
        if (!body.ProtocolVersion || body.ProtocolVersion !== "1.0") {
            signalR.emit(SignalrEvents.onError, "SignalR: Incompatible protocol version.");
            promise.reject("SignalR: Incompatible protocol version.");
            return;
        }
        util.log("negotiated");
        util.log("Server version: " + body.ProtocolVersion);
        signalR.emit(SignalrEvents.onStarting);
        var transports = [],
            supportedTransports = [];

        $.each(SignalR.transports, function(key) {
            if (key === "webSockets" && !body.TryWebSockets) {
                return true;
            }
            supportedTransports.push(key);
        });

        if (Array.isArray(signalR.transport)) {
            $.each(config.transport, function() {
                var transport = this;
                if ($.type(transport) === "object" || ($.type(transport) === "string" && $.inArray("" + transport, supportedTransports) >= 0)) {
                    transports.push($.type(transport) === "string" ? "" + transport : transport);
                }
            });
        } else if ($.type(config.transport) === "object" ||
                $.inArray(config.transport, supportedTransports) >= 0) {
                    transports.push(config.transport);
        } else {
            // default to "auto"
            transports = supportedTransports;
        }
        initialize(signalR, transports, promise);
    };

    var initialize = function(signalR, transports, promise, index) {
        index = index || 0;
        if (index >= transports.length) {
            if (!signalR.transport) {
                promise.reject("SignalR: No transport could be initialized successfully. Try specifying a different transport or none at all for auto initialization.");
            }
            return;
        }

        var transportName = transports[index],
            transport = $.type(transportName) === "object" ? transportName : SignalR.transports[transportName];

        transport.start(signalR, function() {
            signalR.transport = transport;
            signalR.emit(SignalrEvents.onStart);
        }, function() {
            initialize(signalR, transports, index + 1, promise);
        });
    };

    SignalR.prototype.send = function(data) {
        var connection = this;
        if (!connection.transport) {
            throw "SignalR: Connection must be started before data can be sent. Call .start() before .send()";
        }
        connection.transport.send(connection, data);

        return connection;
    };

    SignalR.prototype.reconnected = function(callback) {
        var connection = this;
        connection.on(SignalrEvents.onReconnect, function(e, data) {
            callback.call(connection);
        });
        return connection;
    };

    SignalR.prototype.stop = function() {
        var connection = this;
        if (!connection.transport) {
            return;
        }
        connection.transport.stop(this);
    };

    // Adds a callback that will be invoked before anything is sent over the connection
    SignalR.prototype.sending = function(callback) {
        var connection = this;
        connection.on(SignalrEvents.onSending, function(e, data) {
            callback.call(connection);
        });
        return connection;
    };

    SignalR.transports = {
        serverSentEvents: {
            name: "serverSentEvents",
            timeOut: 3000,
            start: function(connection, onSuccess, onFailed) {
                var that = this,
                    opened = false,
                    reconnecting = !onSuccess,
                    url,
                    connectionTimeout;

                connection.emit(SignalrEvents.onSending);

                url = transportLogic.getUrl(connection, this.name, reconnecting);

                try {
                    connection.eventSource = new EventSource(url);
                } catch (e) {
                    util.log("EventSource failed trying to connect with error " + e.Message);
                    if (onFailed) {
                        onFailed();
                    } else {
                        connection.emit(SignalrEvents.onError, [e]);
                        if (reconnecting) {
                            util.log("EventSource reconnecting");
                            that.reconnect(connection);
                        }
                    }
                    return;
                }

                connectTimeout = setTimeout(function() {
                    if (opened === false) {
                        util.log("EventSource timed out trying to connect");
                        if (onFailed) {
                            onFailed();
                        }

                        if (reconnecting) {
                            util.log("EventSource reconnecting");
                            that.reconnect(connection);
                        } else {
                            that.stop(connection);
                        }
                    }
                }, that.timeOut);

                connection.eventSource.onopen = function(e) {

                    if (connectTimeout) {
                        clearTimeout(connectTimeout);
                    }

                    if (opened === false) {
                        opened = true;

                        if (onSuccess) {
                            onSuccess();
                        }

                        if (reconnecting) {
                            connection.emit(SignalrEvents.onReconnect);
                        }
                    }
                };

                connection.eventSource.onmessage = function(e) {

                    if (e.data === "initialized") {
                        return;
                    }

                    transportLogic.processMessages(connection, JSON.parse(e.data));

                };

                connection.eventSource.onerror = function(e) {
                    if (!opened) {
                        if (onFailed) {
                            onFailed();
                        }
                        return;
                    }

                    connection.emit(SignalrEvents.onError);
                };
            },
            reconnect: function(connection) {
                var that = this;
                setTimeout(function() {
                    that.stop(connection);
                    that.start(connection);
                }, connection.reconnectDelay);
            },
            send: function(connection, data) {
                transportLogic.send(connection, data);
            },
            stop: function(connection) {
                if (connection && connection.eventSource) {
                    connection.eventSource.close();
                    connection.eventSource = null;
                    delete connection.eventSource;
                }
            }
        }
    };
    return SignalR;
}());
