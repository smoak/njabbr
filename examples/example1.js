var JabbrClient = require('../lib/jabbrclient').JabbrClient;
var JabbrClientEvents = require('../lib/jabbrclient').JabbrClientEvents;
var jclient = new JabbrClient("https://jabbr.net");
var util = require('util');

jclient.on(JabbrClientEvents.onMessageReceived, function(msg, room) {
    console.log("[" + msg.When + "] " + msg.User.Name + ": " + msg.Content);
});

jclient.connect("njabbr", "testing", function(task) {
    console.log("Logged on successfully");
    jclient.joinRoom("Hubot", function() {
      console.log("Joined room!");
/*      setTimeout(function() {
        jclient.say("See ya!", "Hubot");

        setTimeout(function() {
          jclient.leaveRoom("Hubot", function() {
            jclient.disconnect();
          });

        }, 5000);
      }, 2000);*/
    });
    jclient.on(JabbrClient.onMessageReceived, function(message, room) {
      console.log("Received message: " + message + " in room " + room);
    });

    jclient.setNote("Test");
    jclient.setFlag("US");
});
