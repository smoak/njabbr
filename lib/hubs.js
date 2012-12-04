var SignalR = require('./signalr.core').SignalR,
    $ = require('./utility'),
    util = require('util'),
    Deferred = require("Deferred");

(function(exports) {

  var callbackId = 0,
      callbacks = {},
      eventNamespace = ".hubProxy";

  var makeEventName = function(e) {
    return e + eventNamespace;
  }

  if (!Array.prototype.hasOwnProperty("map")) {
    Array.prototype.map = function(fun, thisp) {
      var arr = this,
          i,
          length = arr.length,
          result = [];
      for (i = 0; i < length; i += 1) {
        if (arr.hasOwnProperty(i)) {
          result[i] = fun.call(thisp, arr[i], i, arr);
        }
      }
      return result;
    };
  }

  var hasMembers = function(obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        return true;
      }
    }
    return false;
  };

  var getArgValue = function(a) {
    return $.isFunction(a) ? null : ($.type(a) === "undefined" ? null : a);
  };

  var _maximizeClientHubInvocation = function(minClientHubInvocation) {
    return {
      Hub: minClientHubInvocation.H,
      Method: minClientHubInvocation.M,
      Args: minClientHubInvocation.A,
      State: minClientHubInvocation.S
    };
  };

  var maximizeHubResponse = function(minHubResponse) {
    return {
      State: minHubResponse.S,
      Result: minHubResponse.R,
      Id: minHubResponse.I,
      Error: minHubResponse.E,
      StackTrace: minHubResponse.T
    };
  };

  exports.HubConnection = function(url, options) {
    var settings = {
      qs: null,
      logging: false,
      useDefaultPath: true
    },
    connection = this;

    $.extend(settings, options);

    if (!url || settings.useDefaultPath) {
      url = (url || "") + "/signalr";
    }
    exports.HubConnection.super_.call(connection, url, settings.qs, settings.logging);
    connection.proxies = {};
    connection.received(function(minData) {
      connection.log("Received " + util.inspect(minData) + " from server");
      var data, proxy, dataCallbackId, callback, hubName, eventName;
      if (!minData) {
        return;
      }
      if (typeof(minData.I) !== "undefined") {
        dataCallbackId = minData.I.toString();
        callback = callbacks[dataCallbackId];
        if (callback) {
          callbacks[dataCallbackId] = null;
          delete callbacks[dataCallbackId];
          callback.method.call(callback.scope, minData);
        }
      } else {
        data = _maximizeClientHubInvocation(minData);
        connection.log("Triggering client hub event '" + data.Method + "' on hub '" + data.Hub + "'.");
        hubName = data.Hub.toLowerCase();
        eventName = data.Method.toLowerCase();
        proxy = connection.proxies[hubName];
        $.extend(proxy.state, data.State);
        proxy.emit(makeEventName(eventName), data.Args);
      }
    });
  };

  util.inherits(exports.HubConnection, SignalR);

  exports.HubConnection.prototype.createProxy = function(name) {
    hubName = name.toLowerCase();
    var proxy = this.proxies[hubName];
    if (!proxy) {
      proxy = new HubProxy(this, hubName);
      this.proxies[hubName] = proxy;
    }
    this._registerSubscribedHubs();
    return proxy;
  };

  exports.HubConnection.prototype._registerSubscribedHubs = function() {
    var self = this;
    if (!this._subscribedToHubs) {
      this._subscribedToHubs = true;
      this.starting(function() {
        var subscribedHubs = [];
        $.each(this.proxies, function(key) {
          if (this.hasSubscriptions()) {
            subscribedHubs.push({ name: key });
          }
        });

        this.data = JSON.stringify(subscribedHubs);
      });
    }
  };

  var HubProxy = function(connection, hubName) {
    this.state = {};
    this.connection = connection;
    this.hubName = hubName;
    this._ = {
      callbackMap: {}
    };
  };

  HubProxy.prototype.hasSubscriptions = function() {
    return hasMembers(this._.callbackMap);
  };

  /**
   * Invoke a server method
   */
  HubProxy.prototype.invoke = function(methodName) {
    var self = this,
        args = $.makeArray(arguments).slice(1),
        argValues = args.map(getArgValue),
        data = { H: self.hubName, M: methodName, A: argValues, I: callbackId },
        d = new Deferred(),
        callback = function(minResult) {
          self.connection.log("Received result in callback: " + util.inspect(minResult));
          var result = maximizeHubResponse(minResult);
          $.extend(self.state, result.State);
          if (result.Error) {
            if (result.StackTrace) {
              self.connection.log(result.Error + "\n" + result.StackTrace);
            }
            d.reject(result.Error, false);
          } else {
            d.resolve(result.Result);
          }
        };
    callbacks[callbackId.toString()] = { scope: self, method: callback };
    callbackId += 1;
    if (!$.isEmptyObject(self.state)) {
      data.S = self.state;
    }
    self.connection.send(JSON.stringify(data));
    return d.promise();
  };

  HubProxy.prototype.join = function() {
    return this.invoke("Join");
  };

  HubProxy.prototype.setNick = function(username, password) {
    var self = this, 
        args = {
          id: self.connection.id,
          content: "/nick " + username + " " + password
        };

    return this.invoke("Send", args);
  };

  HubProxy.prototype.joinRoom = function(room) {
    var self = this,
        args = {
          id: self.connection.id,
          content: "/join " + room
        };
    return this.invoke("Send", args);
  };

})(module.exports);
