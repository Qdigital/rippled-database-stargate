var Rest    = require('../lib/hbase/hbase-rest');
var config  = require('../config/import.config');
var rest    = new Rest(config.get('hbase-rest'));


rest.initTables('ledgers', function(err, resp) {
  console.log(err, resp);
});
