var jnode = require('../lib/jabbrnode').JabbrNode;
var jclient = new jnode("http://jabbr-bots.apphb.com/");

jclient.on('messageReceived', function(msg, room) {
    console.log("[" + msg.When + "] " + msg.User.Name + ": " + msg.Content);
});

jclient.connect("njabbr", "testing", function(task) {
    console.log("Logged on successfully");

    jclient.setNote("Test");

    jclient.joinRoom("TheTestRoom", function() {
        console.log("Joined room!");

/*        jclient.getRoomInfo("TheTestRoom", function(roomInfo) {
            console.log("Room Info:");
            console.log("Users in room:");
            for (var key in roomInfo.Users) {
                var user = roomInfo.Users[key];
                console.log(user.Name);
            }
        });*/

    });

});
