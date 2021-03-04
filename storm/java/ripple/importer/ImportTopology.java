package ripple.importer;

import backtype.storm.Config;
import backtype.storm.topology.TopologyBuilder;
import backtype.storm.LocalCluster;
import backtype.storm.StormSubmitter;
import backtype.storm.tuple.Fields;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

public class ImportTopology {
  public static void main(String[] args) throws Exception {

    Properties prop   = new Properties();
    InputStream input = null;
    input             = new FileInputStream("config.properties");
    prop.load(input);

    int hl_count = Integer.parseInt(prop.getProperty("hdfs_ledger"));
    int ht_count = Integer.parseInt(prop.getProperty("hdfs_tx"));
    int t_count = Integer.parseInt(prop.getProperty("transactions"));
    int e_count = Integer.parseInt(prop.getProperty("exchanges"));
    int p_count = Integer.parseInt(prop.getProperty("accountPayments"));
    int s_count = Integer.parseInt(prop.getProperty("stats"));
    int f_count = Integer.parseInt(prop.getProperty("fees"));
    int w_count = Integer.parseInt(prop.getProperty("workers"));
    int timeout = Integer.parseInt(prop.getProperty("timeout"));

    TopologyBuilder builder = new TopologyBuilder();
    builder.setSpout("ledgerStream", new LedgerStreamSpout());

    builder.setBolt("transactions", new TransactionBolt(), t_count)
      .shuffleGrouping("ledgerStream", "txStream");

    builder.setBolt("hdfs_ledger", new HDFSledgerBolt(), hl_count)
      .shuffleGrouping("ledgerStream", "HDFS_ledgerStream");

    builder.setBolt("hdfs_transactions", new HDFStransactionBolt(), ht_count)
      .fieldsGrouping("transactions", "HDFS_txStream", new Fields("hdfs_tx"));

    builder.setBolt("exchanges", new ExchangesBolt(), e_count)
      .fieldsGrouping("transactions", "exchangeAggregation", new Fields("pair"));

    builder.setBolt("payments", new PaymentsBolt(), p_count)
      .fieldsGrouping("transactions", "paymentsAggregation", new Fields("key"));

    builder.setBolt("stats", new StatsBolt(), s_count)
      .fieldsGrouping("transactions", "statsAggregation", new Fields("label"))
      .fieldsGrouping("ledgerStream", "statsAggregation", new Fields("label"));

    builder.setBolt("accountPayments", new AccountPaymentsBolt(), p_count)
      .fieldsGrouping("transactions", "accountPaymentsAggregation", new Fields("account"));

    builder.setBolt("feeSummary", new FeesBolt(), f_count)
      .fieldsGrouping("ledgerStream", "feeSummaryStream", new Fields("feeSummary"));

    Config conf = new Config();

    if (args != null && args.length > 0) {
      conf.setNumWorkers(w_count);
      conf.setMessageTimeoutSecs(timeout);
      StormSubmitter.submitTopologyWithProgressBar(args[0], conf, builder.createTopology());

    } else {

      conf.setDebug(false);
      LocalCluster cluster = new LocalCluster();
      cluster.submitTopology("ledger-import", conf, builder.createTopology());
    }
  }
}
