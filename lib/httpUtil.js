(function(exports) {
  var request = require('request'),
      version = require('./version').Version,
      $ = require('./utility');

  var defaultHeaders = {
    "User-Agent": "njabbr-" + version.to_s(),
  };

  var makeRequest = function(options, onSuccess, onFailure) {
    $.extend(options.headers, defaultHeaders);

    request(options, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        if (onSuccess) {
          onSuccess(JSON.parse(body));
        }
      } else if (onFailure) {
          onFailure(error || body);
      }
    });
  };

  exports.get = function(uri, onSuccess, onFailure) {
    var options = {
      uri: uri,
      method: "GET"
    };
    makeRequest(options, onSuccess, onFailure);
  };

  exports.post = function(uri, data, onSuccess, onFailure) {
    // when we POST data, it needs to be sent as form data
    // i.e. application/x-www-form-urlencoded
    var options = {
      uri: uri,
      method: "POST",
      body: data,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    };
    makeRequest(options, onSuccess, onFailure);
  };

})(module.exports)
