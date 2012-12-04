var $ = require('./utility'),
    util = require('util'),
    urlUtil = require('url'),
    httpUtils = require('./httpUtil'),
    EventEmitter = require('events').EventEmitter,
    serverSentEvents = require('./transports/serverSentEvents').ServerSentEvents,
    transportLogic = require('./transports/common').TransportLogic,
    events = require('./signalr.events'),
    ConnectionState = require('./connectionstate').ConnectionState,
    changeState = require('./connectionstate').changeState,
    Deferred = require("Deferred");

(function(exports) {

  exports.SignalR = function(url, qs, logging) {
    this.url = url;
    this.qs = qs;
    this.keepAliveData = {};
    if (typeof(logging) === "boolean") {
      this.logging = logging;
    }
    this.state = ConnectionState.disconnected;
    this.reconnectDelay = 2000;
    this.keepAliveTimeoutCount = 2;
    this.keepAliveWarnAt = 2 / 3;

  };

  util.inherits(exports.SignalR, EventEmitter);

  exports.SignalR.prototype.log = function(msg, logging) {
    if (logging === false) {
      return;
    }

    var m = "[" + new Date().toTimeString() + "] SignalR: " + msg;
    console.log(m);
  };

  exports.SignalR.prototype.start = function(options, callback) {
    var connection = this,
        config = {
          transport: serverSentEvents
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
    connection.log("Negotiating with '" + url + "'. Current state: " + util.inspect(connection.state));

    httpUtils.get(url,
      function(res) {
        connection.log("Successfully negotiated");
        connection.log("Response: " + util.inspect(res));
        var keepAliveData = connection.keepAliveData;
        connection.appRelativeUrl = res.Url;
        connection.id = res.ConnectionId;
        connection.webSocketServerUrl = res.WebSocketServerUrl;

        if (!isNaN(res.DisconnectTimeout)) {
          connection.disconnectTimeout = res.DisconnectTimeout * 1000;
        }

        if (res.KeepAlive) {
          res.KeepAlive *= 1000;
          keepAliveData.activated = true;
          keepAliveData.timeout = res.KeepAlive * connection.keepAliveTimeoutCount;
          keepAliveData.timeoutWarning = keepAliveData.timeout * connection.keepAliveWarnAt;
          keepAliveData.checkInterval = (keepAliveData.timeout - keepAliveData.timeoutWarning) / 3;
        } else {
          keepAliveData.activated = false;
        }

        if (!res.ProtocolVersion || res.ProtocolVersion !== "1.1") {
          connection.log("SignalR: Incompatible protocol version.");
          connection.log("Got " + res.ProtocolVersion);
          connection.emit(events.onError, "SignalR: Incompatible protocol version.");
          deferred.reject("SignalR: Incompatible protocol version.");
          return;
        }

        connection.emit(events.onStarting);

        var transport = config.transport;
        connection.log("Starting transport: " + transport.name);
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
      }
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
    connection.on(events.onReceived, function( data) {
      callback.call(connection, data);
    });
    return connection;
  };

})(module.exports)
