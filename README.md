# njabbr

A nodejs [Jabbr](https://github.com/davidfowl/JabbR) client

## Install

    npm install njabbr

## Usage

```javascript
var JabbrClient = require('njabbr').JabbrClient;

var client = new JabbrClient("http://jabbr-staging.apphb.com/");

client.on('messageReceived', function(msg, room) {
    console.log("[" + msg.When + "] " + msg.User.Name + ": " + msg.Content);
});

client.connect("username", "password", function(task) {
    console.log("You are now logged in");

    client.joinRoom("SomeTestRoom", function() {

        console.log("You have joined SomeTestRoom");        

        client.getRoomInfo("SomeTestRoom", function(roomInfo) {
            console.log("Users");
            for (var key in roomInfo.Users) {
                var user = roomInfo.Users[key];
                console.log(user.Name);
            }
        });

    });

});
```
