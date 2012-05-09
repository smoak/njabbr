var jnode = require('../lib/jabbrnode').JabbrNode;
var jclient = new jnode("http://jabbr-bots.apphb.com/");
jclient.connect("njabbr", "testing", function(task) {
    console.log("Logged on successfully");
    jclient.joinRoom("TheTestRoom", function() {
        console.log("Joined room!");
    });
});
