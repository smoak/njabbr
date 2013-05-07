var JabbrClient = require('../lib/jabbrclient').JabbrClient;
var JabbrClientEvents = require('../lib/jabbrclient').JabbrClientEvents;
var jclient = new JabbrClient("https://jabbr.net", { transport: "longPolling" });
var util = require('util');

jclient.on(JabbrClientEvents.onMessageReceived, function(msg, room) {
  console.log("[" + msg.date + "] " + msg.name + ": " + msg.message);
});

jclient.connect("njabbr", "testing", function(task) {
    console.log("Logged on successfully");
    jclient.joinRoom("Hubot", function() {
      console.log("Joined room!");
    });

    jclient.setNote("Test");
    jclient.setFlag("US");
});
