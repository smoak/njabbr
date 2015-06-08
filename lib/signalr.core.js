var $ = require('./utility'),
    util = require('util'),
    urlUtil = require('url'),
    httpUtils = require('./httpUtil'),
    EventEmitter = require('events').EventEmitter,
    Transports = require('./transports'),
    transportLogic = require('./transports/common').TransportLogic,
    events = require('./signalr.events'),
    ConnectionState = require('./connectionstate').ConnectionState,
    changeState = require('./connectionstate').changeState,
    Deferred = require("Deferred");

(function(exports) {

  /**
   * Validates the requested transport by cross checking it with the pre-defined signalR.transports
   *
   * @param requestedTransport The designated transports that the user has specified.
   * @param connection The connection that will be using the requested transports.  Used for logging purposes.
   */
  var validateTransport = function(requestedTransport, connection) {
    if ($.isArray(requestedTransport)) {
      for (var i = requestedTransport.length - 1; i >= 0; i--) {
        var transport = requestedTransport[i];
        if ($.type(requestedTransport) !== "object" && ($.type(transport) !== "string" || !Transports[transport])) {
          connection.log("Invalid transport: " + transport + ", removing it from the transports list.");
          requestedTransport.splice(i, 1);
        }
      }
      if (requestedTransport.length === 0) {
        connection.log("No transports remain within the specified transport array.");
        requestedTransport = null;
      }
    } else if ($.type(requestedTransport) !== "object" && !Transports[requestedTransport] && requestedTransport !== "auto") {
      connection.log("Invalid transport: " + requestedTransport.toString());
      requestedTransport = null;
    }

    return requestedTransport;

  };

  exports.isDisconnecting = function(connection) {
    return connection.state == ConnectionState.disconnected;
  };

  exports.SignalR = function(url, qs, logging) {
    EventEmitter.call(this);
    this.url = url;
    this.qs = qs;
    this._ = {};
    this.keepAliveData = {};
    if (typeof(logging) === "boolean") {
      this.logging = logging;
    }
    this.state = ConnectionState.disconnected;
    this.reconnectDelay = 2000;
    this.keepAliveTimeoutCount = 2;
    this.keepAliveWarnAt = 2 / 3;
    this.diconnectTimeout = 30000;
  };

  util.inherits(exports.SignalR, EventEmitter);

  exports.SignalR.prototype.log = function(msg, logging) {
    if (logging === false) {
      return;
    }

    var m = "[" + new Date().toTimeString() + "] SignalR: " + msg;
    console.log(m);
  };

  exports.SignalR.prototype.isDisconnecting = exports.isDisconnecting;

  exports.SignalR.prototype.configureStopReconnectingTimeout = function(connection) {
    var stopReconnectingTimeout
      , onReconnectTimeout;

    if (connection._.configuredStopReconnectingTimeout) {
      onReconnectTimeout = function(connection) {
        connection.log("Couldn't reconnect within the configured timeout (" + connection.disconnectTimeout + "ms), disconnecting.");
        connection.stop(/* async */ false, /* notifyServer */ false);
      };

      connection.reconnecting(function() {
        var connection = this;
        if (connection.state === ConnectionState.reconnecting) {
          stopReconnectingTimeout = setTimeout(function() {
            onReconnectTimeout(connection);
          }, connection.disconnectTimeout);
        }
      });

      connection.stateChanged(function(data) {
        if (data.oldState === ConnectionState.reconnecting) {
          clearTimeout(stopReconnectingTimeout);
        }
      });

      connection._.configuredStopReconnectingTimeout = true;
    }
  };

  exports.SignalR.prototype.start = function(options, callback) {
    var connection = this,
        config = {
          transport: options.transport || Transports.longPolling // default to long polling transport
        },
        initialize,
        deferred =  connection._deferral || new Deferred();

    if ($.type(options) === "function") {
      callback = options;
    } else if ($.type(options) === "object") {
      $.extend(config, options);
      if ($.type(config.callback) === "function") {
        callback = config.callback;
      }
    }

    config.transport = validateTransport(config.transport, connection);

    if (!config.transport) {
      throw new Error("SignalR: Invalid transport(s) specified, aborting start.");
    }

    this.configureStopReconnectingTimeout(connection);

    if (changeState(connection, ConnectionState.disconnected, ConnectionState.connecting) === false) {
      deferred.resolve(connection);
      return deferred.promise();
    }
    var parsedUrl = urlUtil.parse(connection.url);
    connection.protocol = parsedUrl.protocol;
    connection.host = parsedUrl.host;
    connection.baseUrl = parsedUrl.protocol + "//" + parsedUrl.host;

    connection.on(events.onStart, function(e, data) {
      if ($.type(callback) === "function") {
        callback.call(connection);
      }
      deferred.resolve(connection);
    });

    var url = connection.url + "/negotiate";
    connection.log("Negotiating with '" + url + "'.");
    httpUtils.get(url,
      function(res) {
        var keepAliveData = connection.keepAliveData;
        connection.appRelativeUrl = res.Url;
        connection.id = res.ConnectionId;
        connection.token = res.ConnectionToken;
        connection.webSocketServerUrl = res.WebSocketServerUrl;

        connection.disconnectTimeout = res.DisconnectTimeout * 1000;

        if (res.KeepAliveTimeout) {
          keepAliveData.activated = true;
          keepAliveData.timeout = res.KeepAliveTimeout * 1000;
          keepAliveData.timeoutWarning = keepAliveData.timeout * connection.keepAliveWarnAt;
          keepAliveData.checkInterval = (keepAliveData.timeout - keepAliveData.timeoutWarning) / 3;
        } else {
          keepAliveData.activated = false;
        }

        if (!res.ProtocolVersion || res.ProtocolVersion !== "1.2") {
          connection.log("SignalR: Incompatible protocol version.");
          connection.log("Got " + res.ProtocolVersion);
          connection.emit(events.onError, "SignalR: Incompatible protocol version.");
          deferred.reject("SignalR: Incompatible protocol version.");
          return;
        }

        connection.emit(events.onStarting);

        var transport = config.transport;
        transport.start(connection, function() {
          if (transport.supportsKeepAlive && connection.keepAliveData.activated) {
            transportLogic.monitorKeepAlive(connection);
          }
          connection.transport = transport;
          changeState(connection, ConnectionState.connecting, ConnectionState.connected);
          connection.emit(events.onStart);
        });
    }, function(error) {
        connection.log("Failed to negotiate: " + error);
        connection.emit(events.onError, error.responseText);
        deferred.reject("SignalR: Error during negotiation request: " + error.responseText);
        connection.stop();
      });

    return deferred.promise();
  };

  exports.SignalR.prototype.starting = function(callback) {
    var connection = this;
    connection.on(events.onStarting, function(e, data) {
      callback.call(connection);
    });
    return connection;
  };

  exports.SignalR.prototype.stop = function(async, notifyServer) {
    var connection = this;
    if (connection.state === ConnectionState.disconnected) {
      return;
    }
    try {
      if (connection.transport) {
        if (notifyServer !== false) {
          connection.transport.abort(connection, async);
        }
        if (connection.transport.supportsKeepAlive && connection.keepAliveData.activated) {
          transportLogic.stopMonitoringKeepAlive(connection);
        }
        connection.transport.stop(connection);
        connection.transport = null;
      }
      connection.emit(events.onDisconnect);
      delete connection.messageId;
      delete connection.groupsToken;
      delete connection.id;
      delete connection._deferral;
    } finally {
      changeState(connection, connection.state, ConnectionState.disconnected);
    }
    return connection;
  };

  exports.SignalR.prototype.send = function(data) {
    var connection = this;
    if (connection.state === ConnectionState.disconnected) {
      throw new Error("SignalR: Connection must be started before data can be sent. Call .start() before .send()");
    }
    if (connection.state === ConnectionState.connecting) {
      throw new Error("SignalR: Connection has not been fully initialized. Use .start().done() or .start().fail() to run logic after the connection has started.");
    }
    connection.transport.send(connection, data);
    return connection;
  };

  exports.SignalR.prototype.received = function(callback) {
    var connection = this;
    connection.on(events.onReceived, function(data) {
      callback.call(connection, data);
    });
    return connection;
  };

  exports.SignalR.prototype.disconnected = function(callback) {
    var connection = this;
    connection.on(events.onDisconnect, function(data) {
      callback.call(connection);
    });
    return connection;
  };

  exports.SignalR.prototype.stateChanged = function(callback) {
    var conneciton = this;
    connection.on(events.onStateChanged, function(data) {
      callback.call(connection, data);
    });
    return connection;
  };

  exports.SignalR.prototype.error = function(callback) {
    var connection = this;
    connection.on(events.onError, function(data) {
      callback.call(connection, data);
    });
    return connection;
  };

  exports.SignalR.prototype.connectionSlow = function(callback) {
    var connection = this;
    connection.on(events.onConnectionSlow, function(data) {
      callback.call(connection);
    });
    return connection;
  };

  exports.SignalR.prototype.reconnecting = function(callback) {
    var connection = this;
    connection.on(events.onReconnecting, function(data) {
      callback.call(connection);
    });
    return connection;
  };

  exports.SignalR.prototype.reconnected = function(callback) {
    var connection = this;
    connection.on(events.onReconnect, function(data) {
      callback.call(connection);
    });
    return connection;
  };
})(module.exports)
