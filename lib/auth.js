var Deferred = require('Deferred')
  , httpUtils = require('./httpUtil')
  , util = require('util')
  , request = require('request');

(function(exports) {

  var AUTH_ENDPOINT_URL = "/account/login"
    , AUTH_COOKIE_NAME = "jabbr.id"
    , NCSRF_COOKIE_NAME = "NCSRF";

  var parseCookiesFromResponse = function(response) {
    var cookies = [];
    if (Array.isArray(response.headers['set-cookie'])) {
      response.headers['set-cookie'].forEach(function(cookie) {
        cookies.push(request.cookie(cookie));
      });
    } else {
      cookies.push(request.cookie(response.headers['set-cookie']))
    }
    return cookies;
  };

  var getNcsrfCookie = function(authUrl) {
    var d = new Deferred()
      , options = {
          uri: authUrl,
          method: "GET"
      };
    
    httpUtils.makeHttpRequest(options, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var ncsrfCookie = 
          parseCookiesFromResponse(response)
            .filter(function(el, i, arr) {
              return el.name == NCSRF_COOKIE_NAME;
            });
        d.resolve(ncsrfCookie);
      } else {
        d.reject(error);
      }
    });

    return d.promise();
  };

  var performLogin = function(authUrl, ncsrfCookie, username, password) {
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
        var authCookie =
          parseCookiesFromResponse(response)
            .filter(function(el, i, arr) {
              return el.name == AUTH_COOKIE_NAME
            });
        d.resolve(authCookie[0].value); 
      } else {
        d.reject(error);
      }
    });
    return d.promise();
  };

  var makeAuthRequest = function(d, jabbrclient, username, password) {
    var authUrl = getAuthUrl(jabbrclient);
    // first we must get the proper cookie
    // then we must actually perform the login
    getNcsrfCookie(authUrl).fail(function(e) {
      d.reject(e);
    }).done(function(ncsrfCookie) {
      performLogin(authUrl, ncsrfCookie, username, password)
        .fail(function(e) {
          d.reject(e);
        })
        .done(function(authCookie) {
          d.resolve(authCookie);
        });
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
