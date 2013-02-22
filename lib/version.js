(function(exports) {

  var util = require('util');

  exports.Version = {
    Major: 1,
    Minor: 2,
    Patch: 2,
    to_s: function() {
      return util.format('%d.%d.%d', this.Major, this.Minor, this.Patch);
    }
  };

})(module.exports);
