(function(exports) {

  var httpUtils = require('../httpUtil'),
      ConnectionState = require('../connectionstate').ConnectionState,
      events = require('../signalr.events'),
      $ = require('../utility'),
      util = require('util'),
      changeState = require('../connectionstate').changeState,
      Deferred = require("Deferred")
    , qs = require('querystring');

  var checkIfAlive = function(connection) {
    var keepAliveData = connection.keepAliveData,
        diff,
        timeElapsed;

    if (connection.state === ConnectionState.connected) {
      diff = new Date();
      diff.setTime(diff - keepAliveData.lastKeepAlive);
      timeElapsed = diff.getTime();
      if (timeElapsed >= keepAliveData.timeout) {
        connection.log("Keep alive timed out.  Notifying transport that connection has been lost.");
        connection.transport.lostConnection(connection);
      } else if (timeElapsed >= keepAliveData.timeoutWarning) {
        if (!keepAliveData.userNotified) {
          connection.log("Keep alive has been missed, connection may be dead/slow.");
          connection.emit(events.onConnectionSlow);
          keepAliveData.userNotified = true;
        }
      } else {
        keepAliveData.userNotified = false;
      }
    }

    if (keepAliveData.monitoring) {
      setTimeout(function() {
        checkIfAlive(connection);
      }, keepAliveData.checkInterval);
    }
  };

  exports.TransportLogic = {
    /**
     * Pings the server
     *
     * @param connection Connection associated with the server ping
     */
    pingServer: function(connection, transport) {
      var baseUrl = transport === "webSockets" ? "" : connection.baseUrl
        , url = baseUrl + connection.appRelativeUrl + "/ping"
        , deferral = new Deferred();

      httpUtils.get(url, function(data) {
        if (data.Response === "pong") {
          deferral.resolve();
        } else {
          deferral.reject("SignalR: Invalid ping response when pinging server: " + (data.responseText || data.statusText));
        }
      }, function(data) {
        deferral.reject("SignalR: Error pinging server: " + (data.responseText || data.statusText));
      });

      return deferral.promise();
    },
    addQs: function(url, connection) {
      if (!connection.qs) {
        return url;
      }
      if (typeof(connection.qs) === "object") {
        return url + "&" + $.param(connection.qs);
      }
      if (typeof(connection.qs) === "string") {
        return url + "&" + connection.qs;
      }
      return url + "&" + encodeURIComponent(connection.qs.toString());
    },
    updateGroups: function(connection, groupsToken) {
      if (groupsToken) {
        connection.groupsToken = groupsToken;
      }
    },
    processMessages: function(connection, minData) {
      var data;
      if (connection.transport) {
        if (connection.transport.supportsKeepAlive && connection.keepAliveData.activated) {
          this.updateKeepAlive(connection);
        }

        if (!minData) {
          return;
        }

        data = this.maximizePersistentResponse(minData);
        if (data.Disconnect) {
          connection.log("Disconnect command received from server");
          connection.stop(false, false);
          return;
        }

        this.updateGroups(connection, data.GroupsToken);

        if (data.Messages) {
          $.each(data.Messages, function(_, msg) {
            try {
              connection.emit(events.onReceived, this);
            } catch (e) {
              connection.log("Error raising received " + e);
              connection.emit(events.onError, e);
            }
          });
        }

        if (data.MessageId) {
          connection.messageId = data.MessageId;
        }
      }
    },
    maximizePersistentResponse: function(minPersistentResponse) {
      return {
        MessageId: minPersistentResponse.C,
        Messages: minPersistentResponse.M,
        Disconnect: typeof(minPersistentResponse.D) !== "undefined" ? true : false,
        TimedOut: typeof(minPersistentResponse.T) !== "undefined" ? true : false,
        LongPollDelay: minPersistentResponse.L,
        GroupsToken: minPersistentResponse.G
      }
    },
    monitorKeepAlive: function(connection) {
      return;
      var keepAliveData = connection.keepAliveData,
          that = this;
      if (!keepAliveData.monitoring) {
        keepAliveData.monitoring = true;
        that.updateKeepAlive(connection);

        connection.keepAliveData.reconnectKeepAliveUpdate = function () {
          that.updateKeepAlive(connection);
        };

        connection.on(events.onReconnect, connection.keepAliveData.reconnectKeepAliveUpdate);

        connection.log("Now monitoring keep alive with a warning timeout of " + keepAliveData.timeoutWarning +
                        " and a connection lost timeout of " + keepAliveData.timeout);
        checkIfAlive(connection);
      } else {
        connection.log("Tried to monitor keep alive but it's already being monitored");
      }
    },
    stopMonitoringKeepAlive: function(connection) {
      var keepAliveData = connection.keepAliveData;
      if (keepAliveData.monitoring) {
        keepAliveData.monitoring = false;
        // Remove the updateKeepAlive function from the reconnect event
        connection.removeListener(events.onReconnect, connection.keepAliveData.reconnectKeepAliveUpdate);
        keepAliveData = {};
        connection.log("Stopping the monitoring of the keep alive");
      }
    },
    updateKeepAlive: function(connection) {
      connection.keepAliveData.lastKeepAlive = new Date();
    },
    ensureReconnectingState: function(connection) {
      if (changeState(connection, ConnectionState.connected, ConnectionState.reconnecting) === true) {
        connection.emit(events.onReconnecting);
      }
      return connection.state === ConnectionState.reconnecting;
    },
    getUrl: function(connection, transport, reconnecting, appendReconnectUrl) {
      var baseUrl = transport == "webSockets" ? "" : connection.baseUrl,
          url = baseUrl + connection.appRelativeUrl,
          qs = "transport=" + transport + "&connectionToken=" + encodeURIComponent(connection.token);

      if (connection.data) {
        qs += "&connectionData=" + encodeURIComponent(connection.data);
      }

      if (connection.groupsToken) {
        qs += "&groupsToken=" + encodeURIComponent(connection.groupsToken);
      }

      if (!reconnecting) {
        url = url + "/connect";
      } else {
        if (appendReconnectUrl) {
          url = url + "/reconnect";
        }
        if (connection.messageId) {
          qs += "&messageId=" + connection.messageId;
        }
      }
      url += "?" + qs;
      url = this.addQs(url, connection);
      url += "&tid=" + Math.floor(Math.random() * 11);
      return url;
    },
    send: function(connection, data) {
      connection.log("transport sending: " + data);
      var url = connection.url + "/send" + "?transport=" + connection.transport.name + "&connectionToken=" + encodeURIComponent(connection.token);
      url = this.addQs(url, connection);
      httpUtils.post(url, { data: data }, function(result) {
        if (result) {
          connection.log("Got result. Emitting event");
          connection.emit(events.onReceived, result);
        }
      }, function(e, body, response) {
          connection.log("Error: " + e);
          connection.emit(events.onError, e);
      });
    },
    abort: function(connection, async) {
      if (typeof(connection.transport) === "undefined") {
        return;
      }

      async = typeof(async) === "undefined" ? true : async;
      var url = connection.url + "/abort" + "?transport=" + connection.transport.name + "&connectionToken=" + encodeURIComponent(connection.token),
          data = {};
      url = this.addQs(url, connection);
      httpUtils.post(url, { data: data });
      connection.log("Fired ajax abort async = " + async);
    },
    foreverFrame: {
      count: 0,
      connections: {}
    }

  };
})(module.exports)
