# njabbr

A nodejs [Jabbr](https://github.com/davidfowl/JabbR) client

## Install

    npm install njabbr

## Usage

```javascript
var JabbrClient = require('njabbr').JabbrClient;
var JabbrClientEvents = require('njabbr').JabbrClientEvents;

var client = new JabbrClient("http://jabbr.url/");

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
