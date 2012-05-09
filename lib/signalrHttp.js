var request = require('request'),
    qs = require('querystring'),
    url = require('url');

var UserAgent = "jabbrn";

var SignalRHttp = {
    // performs a POST to a specific uri
    // onSuccess is called if the POST succeeds
    // onFailure is called if the POST fails
    post: function(uri, data, onSuccess, onFailure) {
        console.log(data);
        data = data || "";
        request({
            method: "POST",
            uri: uri,
            body: data,
            headers: {
                'Content-Length': data.length,
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': UserAgent
            }
        },
        function(e, r, body) {
            if (!e && r.statusCode == 200) {
                onSuccess(body);
            } else {
                onFailure(e || body);
            }
        });
    }
};

module.exports.SignalRHttp = (function() {
    return SignalRHttp;
}());
