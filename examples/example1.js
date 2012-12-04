var JabbrClient = require('../lib/jabbrclient').JabbrClient;
var jclient = new JabbrClient("http://jabbr.net");
var util = require('util');

jclient.on('messageReceived', function(msg, room) {
    console.log("[" + msg.When + "] " + msg.User.Name + ": " + msg.Content);
});

jclient.connect("njabbr", "testing", function(task) {
    console.log("Logged on successfully");
    jclient.joinRoom("Hubot", function() {
      console.log("Joined room!");
    });
/*    console.log("You are currently in the following rooms:");
    for (var i in task.Result.Rooms) {
        var room = task.Result.Rooms[i];
        console.log(room.Name);
        console.log(room.Private);
    }

//    jclient.setNote("Test");
//    jclient.setFlag("US");

 //   jclient.joinRoom("Hubot", function() {
 //       console.log("Joined room!");
   /*     setTimeout(function() {
            jclient.say("See ya!", "Hubot");

            setTimeout(function() {
                jclient.leaveRoom("Hubot", function() {
                    jclient.disconnect();                
                });
            }, 5000);

        }, 2000);
/*        jclient.getRoomInfo("TheTestRoom", function(roomInfo) {
            console.log("Room Info:");
            console.log("Users in room:");
            for (var key in roomInfo.Users) {
                var user = roomInfo.Users[key];
                console.log(user.Name);
            }
        });*/

  //  });

});
