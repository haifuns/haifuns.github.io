title: 【ZooKeeper源码】ZKServer启动流程
author: haifun
tags:
  - ZooKeeper
categories:
  - 分布式
date: 2022-02-15 22:30:00

---

从zkServer.sh启动脚本中我们可以看到zk启动入口类为QuorumPeerMain，接下来从其main方法入手开始分析zk启动流程。

# QuorumPeerMain#main

```java
public static void main(String[] args) {
    QuorumPeerMain main = new QuorumPeerMain();
    try {
        main.initializeAndRun(args);
    } catch (Exception e) {
        // ...
    }
}

protected void initializeAndRun(String[] args)
throws ConfigException, IOException {
    // 用来解析配置文件
    QuorumPeerConfig config = new QuorumPeerConfig();
    if (args.length == 1) {
        // 如果只传了一个参数, 就认为是zoo.cfg文件地址
        config.parse(args[0]);
    }

    // Start and schedule the the purge task
    // 启动后台线程，定期清理日志文件和快照文件
    DatadirCleanupManager purgeMgr = new DatadirCleanupManager(config
            .getDataDir(), config.getDataLogDir(), config
            .getSnapRetainCount(), config.getPurgeInterval());
    purgeMgr.start();

    if (args.length == 1 && config.servers.size() > 0) {
        // 集群启动
        runFromConfig(config);
    } else {
        LOG.warn("Either no config or no quorum defined in config, running "
                 + " in standalone mode");
        // there is only server in the quorum -- run as standalone
        // 单机启动
        ZooKeeperServerMain.main(args);
    }
}
```

从以上代码可以看到，启动过程先对配置文件进行解析，然后启动后台线程定期清理日志和快照文件，接着判断是集群启动还是单机启动，这里我们直接分析集群启动过程。

```java
public void runFromConfig(QuorumPeerConfig config) throws IOException {
    try {
        // 注册jmx bean
        ManagedUtil.registerLog4jMBeans();
    } catch (JMException e) {
        LOG.warn("Unable to register log4j JMX control", e);
    }

    LOG.info("Starting quorum peer");
    try {
        // 网络连接工厂
        ServerCnxnFactory cnxnFactory = ServerCnxnFactory.createFactory();
        cnxnFactory.configure(config.getClientPortAddress(),
                              config.getMaxClientCnxns());

        // quorumPeer代表一个zk节点
        quorumPeer = new QuorumPeer();
        quorumPeer.setClientPortAddress(config.getClientPortAddress());
        // 磁盘数据管理组件 FileTxnSnapLog
        quorumPeer.setTxnFactory(new FileTxnSnapLog(
                                     new File(config.getDataLogDir()),
                                     new File(config.getDataDir())));
        quorumPeer.setQuorumPeers(config.getServers());
        quorumPeer.setElectionType(config.getElectionAlg());
        quorumPeer.setMyid(config.getServerId());
        quorumPeer.setTickTime(config.getTickTime());
        quorumPeer.setMinSessionTimeout(config.getMinSessionTimeout());
        quorumPeer.setMaxSessionTimeout(config.getMaxSessionTimeout());
        quorumPeer.setInitLimit(config.getInitLimit());
        quorumPeer.setSyncLimit(config.getSyncLimit());
        quorumPeer.setQuorumVerifier(config.getQuorumVerifier());
        quorumPeer.setCnxnFactory(cnxnFactory);
        // 内存数据库 ZKDatabase
        quorumPeer.setZKDatabase(new ZKDatabase(quorumPeer.getTxnFactory()));
        quorumPeer.setLearnerType(config.getPeerType());

        quorumPeer.start();
        quorumPeer.join();
    } catch (InterruptedException e) {
        // warn, but generally this is ok
        LOG.warn("Quorum Peer interrupted", e);
    }
}
```

以上代码可以看到，集群启动过程先注册了jmx用于监控，然后配置网络连接工厂，最后创建了一个zk节点线程 QuorumPeer，配置完成后就启动它完成服务启动。

# QuorumPeer#start

QuorumPeer 详细启动过程如下：

```java
// QuorumPeer
public synchronized void start() {
    // 从磁盘加载快照和事务日志, 恢复数据到内存数据库
    loadDataBase();
    // 建立网络通信
    cnxnFactory.start();
    // 开始leader选举, 初始化相应组件(其实是在initLeaderElection)
    startLeaderElection();
    // 启动当前线程
    super.start();
}

private void loadDataBase() {

    // 从磁盘加载数据到内存数据库
    zkDb.loadDataBase();

    // ...
}

// QuorumPeer
synchronized public void startLeaderElection() {

    // 初始化选票
    currentVote = new Vote(myid, getLastLoggedZxid(), getCurrentEpoch());

    // ...

    // 初始化选举算法
    this.electionAlg = createElectionAlgorithm(electionType);
}

protected Election createElectionAlgorithm(int electionAlgorithm) {
    Election le = null;

    qcm = new QuorumCnxManager(this);
    QuorumCnxManager.Listener listener = qcm.listener;
    if (listener != null) {
        listener.start();
        le = new FastLeaderElection(this, qcm);
    } else {
        LOG.error("Null listener when initializing cnx manager");
    }

    return le;
}

// ZKDatabase
public long loadDataBase() throws IOException {
    PlayBackListener listener = new PlayBackListener() {
        public void onTxnLoaded(TxnHeader hdr, Record txn) {
            Request r = new Request(null, 0, hdr.getCxid(), hdr.getType(),
                                    null, null);
            r.txn = txn;
            r.hdr = hdr;
            r.zxid = hdr.getZxid();
            addCommittedProposal(r);
        }
    };

    // 读取快照和事务日志后恢复服务器数据库
    long zxid = snapLog.restore(dataTree, sessionsWithTimeouts, listener);
    initialized = true;
    return zxid;
}

// FileTxnSnapLog
public long restore(DataTree dt, Map<Long, Integer> sessions,
                    PlayBackListener listener) throws IOException {
    // 从最后一个有效快照反序列化DataTree, 获得最后的zxid lastProcessedZxid
    snapLog.deserialize(dt, sessions);
    FileTxnLog txnLog = new FileTxnLog(dataDir);
    // 获取大于有效快照zxid的所有事务
    TxnIterator itr = txnLog.read(dt.lastProcessedZxid + 1);
    long highestZxid = dt.lastProcessedZxid;
    TxnHeader hdr;
    // 循环处理快照之后的事务
    while (true) {
        // iterator points to
        // the first valid txn when initialized
        hdr = itr.getHeader();
        if (hdr == null) {
            //empty logs
            return dt.lastProcessedZxid;
        }
        if (hdr.getZxid() < highestZxid && highestZxid != 0) {
            LOG.error(highestZxid + "(higestZxid) > "
                      + hdr.getZxid() + "(next log) for type "
                      + hdr.getType());
        } else {
            highestZxid = hdr.getZxid();
        }
        try {
            // 处理这条事务
            processTransaction(hdr, dt, sessions, itr.getTxn());
        } catch (KeeperException.NoNodeException e) {
            throw new IOException("Failed to process transaction type: " +
                                  hdr.getType() + " error: " + e.getMessage(), e);
        }
        // 增加一条事务提交日志
        listener.onTxnLoaded(hdr, itr.getTxn());
        if (!itr.next())
            break;
    }
    return highestZxid;
}
```

从以上代码可以看到，QuorumPeer的启动主要分为数据恢复、建立网络通信以及leader选举三个部分。

- 数据恢复过程是利用快照和事务日志文件把数据恢复到内存DateTree中，zk会以最新的有效快照为基础，然后把之后的事务也恢复到内存中。
- 建立网络通信过程实际上就是创建了一个NIOServerSocket服务监听客户端请求。
- leader选举这里只对准备工作分析，包含选票和选举算法两部分的初始化。具体选举过程将在下一篇详细分析。

# 小结

ZooKeeper（集群）启动过程如下：

1. 解析zoo.cfg配置文件
2. 启动后台线程定期清理快照和事务日志文件
3. 根据快照和事务日志恢复数据到内存
4. 建立网络通信
5. 选举前的准备工作
6. leader选举（下篇分析）
