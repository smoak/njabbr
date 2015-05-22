(function(exports) {
  var request = require('request'),
      version = require('./version').Version,
      util = require('util'),
      $ = require('./utility');

  var defaultHeaders = {
    "User-Agent": "njabbr-" + version.to_s(),
    "sec-jabbr-client": "true"
  };

  request = request.defaults({
    jar:true,
    headers: defaultHeaders
  });

  var makeRequest = function(options, onSuccess, onFailure) {

    exports.makeHttpRequest(options, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        if (onSuccess) {
          onSuccess(JSON.parse(body));
        }
      } else if (onFailure) {
        onFailure(body, body, response);
      }
    });
  };

  exports.makeHttpRequest = function(options, callback) {
    var request_headers = options.headers || {};
    $.extend(options, { headers: request_headers });
    request(options, callback);
  };

  exports.get = function(uri, onSuccess, onFailure) {
    var options = {
      uri: uri,
      method: "GET"
    };
    makeRequest(options, onSuccess, onFailure);
  };

  exports.post = function(uri, options, onSuccess, onFailure) {
    var post_options = {
      uri: uri,
      method: "POST",
      form: { data: options.data }
    };
    makeRequest(post_options, onSuccess, onFailure);
  };

  exports.postJson = function(uri, data, onSuccess, onFailure) {
    var options = {
      uri: uri,
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    };

    makeRequest(options, onSuccess, onFailure);
  };
})(module.exports)
