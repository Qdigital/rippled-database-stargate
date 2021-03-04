var Parser   = require('../lib/ledgerParser');
var Importer = require('../lib/ripple-importer');
var Hbase    = require('../lib/hbase/hbase-client');

var fs       = require('fs');
var live     = new Importer({
  ripple : {
    "trace"                 : false,
    "allow_partial_history" : false,
    "servers" : [
      { "host" : "s2.ripple.com", "port" : 443, "secure" : true },
      { "host" : "s2.ripple.com", "port" : 443, "secure" : true }
    ]
  }});

var path         = __dirname + '/transactions/';
var EPOCH_OFFSET = 946684800;
var hbase = new Hbase({});

/*
var tx = JSON.parse(fs.readFileSync(path + 'demmurage-IOU.json', "utf8"));
var parsed;

tx.metaData = tx.meta;
tx.executed_time = tx.date + EPOCH_OFFSET;
parsed = Parser.parseTransaction(tx);

console.log(parsed.exchanges);

tx = JSON.parse(fs.readFileSync(path + 'demmurage-XRP.json', "utf8"));
tx.metaData = tx.meta;
tx.executed_time = tx.date + EPOCH_OFFSET;
parsed = Parser.parseTransaction(tx);

console.log(parsed.exchanges);
*/

tx = JSON.parse(fs.readFileSync(path + 'autobridged.json', "utf8"));

tx.metaData = tx.meta;
tx.executed_time = tx.date + EPOCH_OFFSET;
parsed = Parser.parseTransaction(tx);
tables = hbase.prepareParsedData(parsed);
//console.log(parsed.balanceChanges);
console.log(tables.balance_changes);
process.exit();
return;



//start import stream
live.backFill(10000000, 10001000);
live.on('ledger', function(ledger) {
  console.log(ledger.ledger_index);

  var parsed = Parser.parseLedger(ledger);
  var tables = hbase.prepareParsedData(parsed);
  console.log(tables.balance_changes);
  return;

  //ledger.transactions.forEach(function(tx) {
  //  parsed = Parser.parseTransaction(tx);
  //  console.log(parsed.offers);
  //});
});
