var Deferred = require('Deferred')
  , httpUtils = require('./httpUtil')
  , util = require('util')
  , request = require('request');

(function(exports) {

  var AUTH_ENDPOINT_URL = "/account/login";

  var requestLoginPage = function(authUrl) {
    var d = new Deferred()
      , options = {
          uri: authUrl,
          method: "GET"
      };
    
    httpUtils.makeHttpRequest(options, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        d.resolve();
      } else {
        d.reject(error);
      }
    });

    return d.promise();
  };

  var performLogin = function(authUrl, username, password) {
    var d = new Deferred()
      , options = {
          uri: authUrl,
          method: "POST",
          form: { username: username, password: password }
      };

    httpUtils.makeHttpRequest(options, function(error, response, body) {
      // ugh, jabbr makes use of 303 to indicate it was successful and
      // we should "redirect" to a success path. In our case, we just take
      // the jabbr.id cookie that gets set and store that as our "authToken"
      if (!error && response.statusCode == 303) {
        d.resolve();
      } else {
        d.reject(error);
      }
    });
    return d.promise();
  };

  var makeAuthRequest = function(d, jabbrclient, username, password) {
    var authUrl = getAuthUrl(jabbrclient);

    requestLoginPage(authUrl).done(function() {
      performLogin(authUrl, username, password).done(function() {
        d.resolve();
      }).fail(function(e) {
        d.reject(e);
      });

    }).fail(function(e) {
      d.reject(e);
    });
  };

  /**
   * Gets the auth url endpoint based on the url this client was configured with
   *
   */
  var getAuthUrl = function(jabbrclient) {
    return jabbrclient.url + AUTH_ENDPOINT_URL;
  };

  exports.authenticate = function(jabbrclient, username, password) {
    var d = new Deferred();
    makeAuthRequest(d, jabbrclient, username, password);
    return d.promise();
  };

})(module.exports)
