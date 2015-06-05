# njabbr

A nodejs [Jabbr](https://github.com/davidfowl/JabbR) client

## Install

    npm install njabbr

## Configuration

    The Jabbr version must be specified either through the jabbrVersion setting
    on JabbrClient options or the environment variable JABBR_VERSION
    If the version is not set, the client will be spammed with outOfSync
    messages from Jabbr.


## Usage

```javascript
var JabbrClient = require('njabbr').JabbrClient;
var JabbrClientEvents = require('njabbr').JabbrClientEvents;

var client = new JabbrClient("http://jabbr.url/", {jabbrVersion: "1.0.5420.15349"});

client.on(JabbrClientEvents.onMessageReceived, function(msg, room) {
});

client.connect("username", "password", function(task) {
    console.log("You are now logged in");

    client.joinRoom("SomeTestRoom", function() {

        console.log("You have joined SomeTestRoom");        

        // speak robot speak!
        client.say("Hey everyone!", "SomeTestRoom");

    });

    // logoff after 10 seconds
    setTimeout(function() {
        client.disconnect();
    }, 10000);

});
```
