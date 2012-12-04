(function(exports) {

  var events = require('./signalr.events');

  exports.ConnectionState = {
    connecting: 0,
    connected: 1,
    reconnected: 2,
    disconnected: 3
  };

  exports.changeState = function(connection, expectedState, newState) {
    if (expectedState === connection.state) {
      connection.state =  newState;
      connection.emit(events.onStateChanged, { oldState: expectedState, newState: newState });
      return true;
    }
    return false;
  };

})(module.exports);
