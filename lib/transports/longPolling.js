(function(exports) {
  var transportLogic = require('./common').TransportLogic
    , httpUtils = require('../httpUtil')
    , events = require('../signalr.events')
    , ConnectionState = require('../connectionstate').ConnectionState
    , changeState = require('../connectionstate').changeState
    , $ = require('../utility')
    , signalr = require('../signalr.core');

  exports.LongPolling = {
    name: "longPolling",
    supportsKeepAlive: false,
    reconnectDelay: 3000,
    init: function(connection, onComplete) {
      var that = this
        , pingLoop
        , pingFail = function(reason) {
            if (signalr.isDisconnecting(connection) === false) {
              connection.log("SignalR: Server ping failed because '" + reason + "', re-trying ping.");
              setTimeout(pingLoop, that.reconnectDelay);
            }
        };
      connection.log("SignalR: Initializing long polling connection with server.");
      pingLoop = function() {
        transportLogic.pingServer(connection, that.name).done(onComplete).fail(pingFail);
      };
      pingLoop();
    },
    start: function(connection, onSuccess, onFailed) {
      var that = this
        , initialConnectedFired = false
        , fireConnect = function() {
            if (initialConnectedFired) {
              return;
            }
            initialConnectedFired = true;
            onSuccess();
            connection.log("Longpolling connected");
        };
      if (connection.pollXhr) {
        connection.log("Polling xhr requests already exists, aborting.");
        connection.stop();
      }

      that.init(connection, function() {
        connection.messageId = null;
        setTimeout(function() {
          (function poll(instance, raiseReconnect) {
            var messageId = instance.messageId
              , connect = (messageId === null)
              , reconnecting = !connect
              , url = transportLogic.getUrl(instance, that.name, reconnecting, raiseReconnect);

            if (signalr.isDisconnecting(instance) === true) {
              return;
            }
            instance.pollXhr = httpUtils.get(url, function(minData) {
              var delay = 0
                , delta;

              fireConnect();

              if (minData) {
                data = transportLogic.maximizePersistentResponse(minData);
              }

              transportLogic.processMessages(instance, minData);

              if (data && $.type(data.LongPollDelay) === "number") {
                delay = data.LongPollDelay;
              }

              if (data && data.Disconnect) {
                return;
              }

              if (signalr.isDisconnecting(instance) === true) {
                return;
              }

              // We never want to pass a raiseReconnect flag after a successful poll.
              // This is handled via the error function
              if (delay > 0) {
                setTimeout(function() {
                  poll(instance, false);
                }, delay);
              } else {
                poll(instance, false);
              }
            }, function(data, textStatus) {
              if (connection.state !== ConnectionState.reconnecting) {
                connection.log("An error occurred using longPolling.");
                instance.emit(events.onError, data);
              }
              // Transition into the reconnecting state
              transportLogic.ensureReconnectingState(instance);
              // If we've errored out we need to verify that the server is still there, so re-start initialization process
              // This will ping the server until it successfully gets a response.
              that.init(instance, function() {
                // Call poll with the raiseReconnect flag as true
                poll(instance, true);
              });
            });

            if (reconnecting && raiseReconnect === true) {
              if (changeState(connection, ConnectionState.reconnecting, ConnectionState.connected) === true) {
                connection.log("Raising the reconnect event");
                instance.emit(events.onReconnect);
              }
            }
          }(connection));
          setTimeout(function() {
            fireConnect();
          }, 250);
        }, 250);

      });
    },
    lostConnection: function(connection) {
      throw new Error("Lost Connection not handled for LongPolling");
    },
    send: function(connection, data) {
      transportLogic.send(connection, data);
    },
    stop: function(connection) {
      if (connection.pollXhr) {
        connection.pollXhr = null;
        delete connection.pollXhr;
      }
    },
    abort: function(connection, async) {
      transportLogic.abort(connection, async);
    }
  };
})(module.exports)
