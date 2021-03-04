var config = require('../../config/import.config');
var HistoricalImport = require('./history');
var h = new HistoricalImport();
var start = config.get('startIndex');
var stop  = config.get('stopIndex') || 'validated';

setTimeout(function() {
  h.start(start, stop, function(){
    process.exit();
  });
}, 500);
