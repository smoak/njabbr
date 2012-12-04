(function(exports) {
  var transportLogic = require('./common').TransportLogic,
      EventSource = require('eventsource'),
      SignalREvents = require('../signalr.events'),
      ConnectionState = require('../connectionstate').ConnectionState,
      changeState = require('../connectionstate').changeState;


  exports.ServerSentEvents = {
    name: "serverSentEvents",
    supportsKeepAlive: true,
    reconnectTimeout: false,
    currentEventSourceID: 0,
    timeOut: 3000,
    start: function(connection, onSuccess, onFailed) {
      var that = this,
          opened = false,
          reconnecting = !onSuccess,
          url,
          connectTimeOut;

      if (connection.eventSource) {
        connection.log("The connection already has an event source. Stopping it.");
        connection.stop();
      }

      url = transportLogic.getUrl(connection, this.name, reconnecting);

      try {
        connection.log("Attempting to connect to SSE endpoint '" + url + "'");
        connection.eventSource = new EventSource(url);
        connection.eventSource.ID = ++that.currentEventSourceID;
      } catch (e) {
        connection.log("EventSource failed trying to connect with error " + e.Message);
        if (onFailed) {
          onFailed();
        } else {
          connection.emit(events.onError, e);
          if (reconnecting) {
            that.reconnect(connection);
          }
        }
        return;
      }

      connectTimeOut = setTimeout(function() {
        if (opened === false) {
          connection.log("EventSource timed out trying to connect");
          connection.log("EventSource readyState: " + connection.eventSource.readyState);
          if (!reconnecting) {
            that.stop(connection);
          }
          if (reconnecting) {
            if (connection.eventSource.readyState !== EventSource.CONNECTING &&
                connection.eventSource.readyState !== EventSource.OPEN) {
                  that.reconnect(connection);
            }
          } else if (onFailed) {
            onFailed();
          }
        }
      },
      that.timeOut);

      connection.eventSource.onopen = function(e) {
        connection.log("EventSource connected");

        if (connectTimeOut) {
          clearTimeout(connectTimeOut);
        }

        if (that.reconnectTimeout) {
          clearTimeout(that.reconnectTimeout);
        }

        if (opened === false) {
          opened = true;

          if (onSuccess) {
            onSuccess();
          }
        }
      }

      connection.eventSource.onmessage = function(e) {
        if (e.data === "initialized") {
          return;
        }
        transportLogic.processMessages(connection, JSON.parse(e.data));
      }

      connection.eventSource.onerror = function(e) {
        if (this.ID === that.currenEventSourceID) {
          if (!opened) {
            if (onFailed) {
              onFailed();
            }
            return;
          }
          connection.log("EventSource readyState: " + connection.eventSource.readyState);
          if (e.eventPhase === EventSource.CLOSED) {
            connection.log("EventSource reconnecting due to the server connection ending");
            that.reconnect(connection);
          } else {
            connection.log("EventSource error");
            connection.emit(SignalREvents.onError);
          }
        }
      }
    },
    reconnect: function(connection) {
      var that = this;
      that.reconnectTimeout = setTimeout(function() {
        that.stop(connection);
        if (connection.state === ConnectionState.reconnecting ||
          changeState(connection, ConnectionState.connected,
                      ConnectionState.reconnecting) === true) {
                        connection.log("EventSource reconnecting");
                        that.start(connection);
                      }
      }, connection.reconnectDelay);
    },
    lostConnection: function(connection) {
      this.reconnect(connection);
    },
    send: function(connection, data) {
      connection.log("Sending " + data);
      transportLogic.send(connection, data); 
    },
    stop: function(connection) {
      if (connection && connection.eventSource) {
        connection.log("EventSource calling close()");
        connection.eventSource.close();
        connection.eventSource = null;
        delete connection.eventSource;
      }
    },
    abort: function(connection, async) {
      transportLogic.abort(connection, async);
    }
  };
})(module.exports)
