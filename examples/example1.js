var jnode = require('../lib/jabbrnode').JabbrNode;
var jclient = new jnode("http://jabbr-bots.apphb.com/");
jclient.connect("test", "test", function(task) {
    console.log("Logged on successfully");
});
