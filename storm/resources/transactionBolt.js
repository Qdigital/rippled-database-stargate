'use strict'

var config = require('./config')
var Promise = require('bluebird')
var Storm = require('./storm')
var Parser = require('./lib/ledgerParser')
var hbase = require('./lib/hbase')
var BasicBolt = Storm.BasicBolt
var bolt

var saveToHDFS = Boolean(config.get('hdfs'))
var Logger = require('./lib/logger')
var log = new Logger({
  scope: 'transaction-bolt',
  file: config.get('logFile'),
  level: config.get('logLevel')
})

// handle uncaught exceptions
require('./exception')(log)


function TransactionBolt() {
  BasicBolt.call(this)
}

TransactionBolt.prototype = Object.create(BasicBolt.prototype)
TransactionBolt.prototype.constructor = TransactionBolt

TransactionBolt.prototype.process = function(tup, done) {
  var self = this
  var tx = tup.values[0]
  var parsed

  // set 'client' string
  tx.client = Parser.fromClient(tx)

  if (saveToHDFS) {
    self.emit({
      tuple: [tx],
      anchorTupleId: tup.id,
      stream: 'HDFS_txStream'
    })
  }

  // parse transaction
  parsed = {
    data: Parser.parseTransaction(tx),
    ledgerIndex: tx.ledger_index,
    txIndex: tx.tx_index,
    tx: tx
  }

  Promise.all([

    // save parsed data
    self.saveParsedData(parsed),

    // emit to aggregations
    self.processStreams(parsed, tup.id),

    // save transaction
    self.saveTransaction(tx)

  ]).nodeify(function(err) {
    done(err)
  })
}

/**
 * saveTransaction
 */

TransactionBolt.prototype.saveTransaction = function(tx) {
  var self = this
  var id = tx.ledger_index + '.' + tx.tx_index

  return new Promise(function(resolve, reject) {
    hbase.saveTransaction(tx, function(err) {

      if (err) {
        self.log('unable to save transaction: ' + id + ' ' + tx.hash)
        reject(err)

      } else {
        resolve()
      }
    })
  })
}


/**
 * saveParsedData
 */

TransactionBolt.prototype.saveParsedData = function(parsed) {
  var self = this
  var id = parsed.ledgerIndex + '.' + parsed.txIndex

  return new Promise(function(resolve, reject) {
    hbase.saveParsedData(parsed, function(err) {
      if (err) {
        self.log('unable to save parsedData: ' + id)
        reject(err)

      } else {
        resolve()
      }
    })
  })
}

/**
 * processStreams
 */

TransactionBolt.prototype.processStreams = function(parsed, id) {
  var self = this
  var stat

  return new Promise(function(resolve) {

    // aggregate exchanges
    parsed.data.exchanges.forEach(function(exchange) {
      var pair = exchange.base.currency +
          (exchange.base.issuer ? '.' + exchange.base.issuer : '') +
          '/' + exchange.counter.currency +
          (exchange.counter.issuer ? '.' + exchange.counter.issuer : '')

      self.emit({
        tuple: [exchange, pair],
        anchorTupleId: id,
        stream: 'exchangeAggregation'
      },
      function(taskIds) {
        self.log(pair + ' sent to task ids - ' + taskIds)
      })
    })

    // increment transactions count
    stat = {
      count: 1,
      time: parsed.tx.executed_time
    }
    self.emit({
      tuple: [stat, 'transaction_count'],
      anchorTupleId: id,
      stream: 'statsAggregation'
    })

    // aggregate by transaction type
    stat = {
      type: parsed.tx.TransactionType,
      time: parsed.tx.executed_time
    }
    self.emit({
      tuple: [stat, 'transaction_type'],
      anchorTupleId: id,
      stream: 'statsAggregation'
    })

    // aggregate by transaction result
    stat = {
      result: parsed.tx.tx_result,
      time: parsed.tx.executed_time
    }
    self.emit({
      tuple: [stat, 'transaction_result'],
      anchorTupleId: id,
      stream: 'statsAggregation'
    })

    // new account created
    if (parsed.data.accountsCreated.length) {
      stat = {
        count: parsed.data.accountsCreated.length,
        time: parsed.tx.executed_time
      }

      self.emit({
        tuple: [stat, 'accounts_created'],
        anchorTupleId: id,
        stream: 'statsAggregation'
      })
    }

    // aggregate payments count
    if (parsed.data.payments.length) {
      stat = {
        count: 1,
        time: parsed.tx.executed_time
      }

      self.emit({
        tuple: [stat, 'payments_count'],
        anchorTupleId: id,
        stream: 'statsAggregation'
      })
    }

    // aggregate exchanges count
    if (parsed.data.exchanges.length) {
      stat = {
        count: parsed.data.exchanges.length,
        time: parsed.tx.executed_time
      }

      self.emit({
        tuple: [stat, 'exchanges_count'],
        anchorTupleId: id,
        stream: 'statsAggregation'
      })
    }

    // payments aggregation
    if (parsed.data.payments.length) {
      parsed.data.payments.forEach(function(payment) {
        var key = payment.currency +
          (payment.issuer ? '|' + payment.issuer : '')

        // self.log('PAYMENT: ' + key)

        // aggregation by currency+issuer
        self.emit({
          tuple: [payment, key],
          anchorTupleId: id,
          stream: 'paymentsAggregation'
        })

        // account payments aggregation
        // emit 1 for source
        // and 1 for destination
        self.emit({
          tuple: [payment, payment.source],
          anchorTupleId: id,
          stream: 'accountPaymentsAggregation'
        })

        self.emit({
          tuple: [payment, payment.destination],
          anchorTupleId: id,
          stream: 'accountPaymentsAggregation'
        })
      })
    }

    resolve()
  })
}

bolt = new TransactionBolt()
bolt.run()
