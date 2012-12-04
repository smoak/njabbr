var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    $ = require('./utility'),
    HubConnection = require('./hubs').HubConnection,
    serverSentEvents = require('./transports/serverSentEvents').ServerSentEvents,
    Deferred = require('Deferred');

(function(exports) {
  
  exports.JabbrClient = function(url) {
    this.url = url;
    this.connection = new HubConnection(url);
    this.chat = this.connection.createProxy("chat");
    this.clientTransport = serverSentEvents;
  };

  util.inherits(exports.JabbrClient, EventEmitter);

  exports.JabbrClient.prototype.connect = function(username, password, onSuccess) {
    var self = this,
        options = {
          transport: self.clientTransport
        };
    
    this.connection.start(options, function() {
      self.chat.join()
          .fail(function(e) {
            console.log("Failed to join hub: " + e);
          })
          .done(function(success) {
            console.log("Joined hub!");
            if (success === false) {

//              self.chat.invoke("nick", username, password).fail(function(e) {
              self.chat.setNick(username, password)
                .fail(function(e) {
                  console.log("Failed to set nick " + e);
                })
                .done(function(success) {
                  if (onSuccess) {
                    onSuccess(success);
                  }
                });
            }
          });
    });
  };

  exports.JabbrClient.prototype.joinRoom = function(roomName, onSuccess) {
    var self = this;
    this.chat.joinRoom(roomName)
      .fail(function(e) {
        self.connection.log("Failed to join room: " + e);
      })
      .done(function(success) {
        self.connection.log("Joined " + roomName);
        if (onSuccess) {
          onSuccess();
        }
      });
  };

})(module.exports)
