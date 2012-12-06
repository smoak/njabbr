var util = require('util'),
    EventEmitter = require('events').EventEmitter,
    $ = require('./utility'),
    HubConnection = require('./hubs').HubConnection,
    serverSentEvents = require('./transports/serverSentEvents').ServerSentEvents,
    Deferred = require('Deferred');

(function(exports) {

  var generateClientMessage = function(message) {
    return {
      id: $.newId(),
      content: message
    };
  }
  
  exports.JabbrClient = function(url) {
    var self = this;
    this.url = url;
    this.connection = new HubConnection(url);
    this.clientTransport = serverSentEvents;
    this.chat = this.connection.createProxy("chat");
    this.chat.client = {};
    // server commands we can execute
    this.chat.server = {
      checkStatus: function() {
        return self.chat.invoke.apply(self.chat, $.merge(["CheckStatus"], $.makeArray(arguments)));
      },
      join: function() {
        return self.chat.invoke.apply(self.chat, $.merge(["Join"], $.makeArray(arguments)))
      },
      send: function() {
        return self.chat.invoke.apply(self.chat, $.merge(["Send"], $.makeArray(arguments)));
      }
    };
  };

  util.inherits(exports.JabbrClient, EventEmitter);

  exports.JabbrClient.prototype.connect = function(username, password, onSuccess) {
    var self = this,
        options = {
          transport: self.clientTransport
        };
    
    this.connection.start(options, function() {
      self.chat.server.join()
          .fail(function(e) {
            console.log("Failed to join hub: " + e);
          })
          .done(function(success) {
            console.log("Joined hub!");
            if (success === false) {
              self.setNick(username, password)
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

  /**
   * Joins a room. This room has to exist first
   *
   * @param room The room to join
   * @param onSuccess Optional callback to execute if successful
   */
  exports.JabbrClient.prototype.joinRoom = function(roomName, onSuccess) {
    var self = this,
        clientMessage = {
          id: $.newId(),
          content: "/join " + roomName,
          room: self.chat.state.activeRoom
        };
    this.chat.server.send(clientMessage)
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

  /**
   * Set the nick. If a nick exists and the password is correct,
   * the nick of the client will be changed. If the nick doesn't
   * exist then it will automatically be associated with the password
   * by the server.
   *
   * @param username The username to set
   * @param password The password to use
   */
  exports.JabbrClient.prototype.setNick = function(username, password) {
    var clientMessage = generateClientMessage("/nick " + username + " " + password);
    return this.chat.server.send(clientMessage);
  };

  /**
   * Show a small flag which represents your nationality.
   *
   * @param isoCountry Iso 3366-2 Code (ISO Reference Chart: http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)
   */
  exports.JabbrClient.prototype.setFlag = function(isoCountry) {
    var clientMessage = generateClientMessage("/flag " + isoCountry);
    return this.chat.server.send(clientMessage);
  };


})(module.exports)
