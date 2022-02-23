title: 【ZooKeeper源码】初始化数据同步
author: haifun
tags:
  - ZooKeeper
categories:
  - 分布式
date: 2022-02-23 20:15:00

---

在leader选举完成后，集群中的所有节点都确定好自己的角色，此时节点间数据有可能并未达到一致，接下来follower节点将从leader同步数据完成初始化。

# 建立网络通信

首先确定好各自角色的节点会执行对应的功能逻辑，leader节点会启动socket server监听所有learner的连接请求，而follower节点会向leader节点发起socket连接请求。

## leader

```java
// QuorumPeer.java
public void run() {


    try {
        /*
         * 主要逻辑
         * Main loop
         */
        while (running) {
            // 根据当前节点的状态执行相应的处理
            switch (getPeerState()) {
            case LOOKING:
                // ...
                break;
            case OBSERVING:
                // ...
                break;
            case FOLLOWING:
                // ...
                break;
            case LEADING:
                LOG.info("LEADING");
                try {
                    setLeader(makeLeader(logFactory));
                    leader.lead();
                    setLeader(null);
                } catch (Exception e) {
                    LOG.warn("Unexpected exception", e);
                } finally {
                    if (leader != null) {
                        leader.shutdown("Forcing shutdown");
                        setLeader(null);
                    }
                    setPeerState(ServerState.LOOKING);
                }
                break;
            }
        }
    } finally {
        // ...
    }
}

protected Leader makeLeader(FileTxnSnapLog logFactory) throws IOException {
    return new Leader(this, new LeaderZooKeeperServer(logFactory,
        this,new ZooKeeperServer.BasicDataTreeBuilder(), this.zkDb));
}
    
// Leader.java
void lead() throws IOException, InterruptedException {
    self.end_fle = System.currentTimeMillis();
    LOG.info("LEADING - LEADER ELECTION TOOK - " +
             (self.end_fle - self.start_fle));
    self.start_fle = 0;
    self.end_fle = 0;

    zk.registerJMX(new LeaderBean(this, zk), self.jmxLocalPeerBean);

    try {
        self.tick = 0;
        zk.loadData();

        leaderStateSummary = new StateSummary(self.getCurrentEpoch(), zk.getLastProcessedZxid());

        // Start thread that waits for connection requests from
        // new followers.
        // 监听follower连接请求
        cnxAcceptor = new LearnerCnxAcceptor();
        cnxAcceptor.start();

        // ...
    } finally {
        zk.unregisterJMX(this);
    }
}

class LearnerCnxAcceptor extends Thread {
    private volatile boolean stop = false;

    @Override
    public void run() {
        try {
            while (!stop) {
                try {
                    Socket s = ss.accept();
                    // start with the initLimit, once the ack is processed
                    // in LearnerHandler switch to the syncLimit
                    s.setSoTimeout(self.tickTime * self.initLimit);
                    s.setTcpNoDelay(nodelay);
                    // learner处理器
                    LearnerHandler fh = new LearnerHandler(s, Leader.this);
                    fh.start();
                } catch (SocketException e) {
                    if (stop) {
                        LOG.info("exception while shutting down acceptor: "
                                 + e);

                        // When Leader.shutdown() calls ss.close(),
                        // the call to accept throws an exception.
                        // We catch and set stop to true.
                        stop = true;
                    } else {
                        throw e;
                    }
                }
            }
        } catch (Exception e) {
            LOG.warn("Exception while accepting follower", e);
        }
    }

    public void halt() {
        stop = true;
    }
}
```

从以上代码中可以看到，当节点状态为为LEADING时，会初始化一个Leader，并执行lead逻辑。Leader中包含一个LearnerCnxAcceptor接受处理所有从leader学习的请求，LearnerCnxAcceptor里会启动一个SocketServer然后监听客户端连接请求，当有连接时，为其创建一个LearnerHandler处理器并启动。

## follower

```java
// QuorumPeer.java
public void run() {


    try {
        /*
         * 主要逻辑
         * Main loop
         */
        while (running) {
            // 根据当前节点的状态执行相应的处理
            switch (getPeerState()) {
            case LOOKING:
                // ...
                break;
            case OBSERVING:
                // ...
                break;
            case FOLLOWING:
                try {
                    LOG.info("FOLLOWING");
                    setFollower(makeFollower(logFactory));
                    follower.followLeader();
                } catch (Exception e) {
                    LOG.warn("Unexpected exception", e);
                } finally {
                    follower.shutdown();
                    setFollower(null);
                    setPeerState(ServerState.LOOKING);
                }
                break;
            case LEADING:
                // ...
                break;
            }
        }
    } finally {
        // ...
    }
}

protected Follower makeFollower(FileTxnSnapLog logFactory) throws IOException {
    return new Follower(this, new FollowerZooKeeperServer(logFactory, 
        this,new ZooKeeperServer.BasicDataTreeBuilder(), this.zkDb));
}
    
// Follower.java
void followLeader() throws InterruptedException {
    self.end_fle = System.currentTimeMillis();
    LOG.info("FOLLOWING - LEADER ELECTION TOOK - " +
             (self.end_fle - self.start_fle));
    self.start_fle = 0;
    self.end_fle = 0;
    fzk.registerJMX(new FollowerBean(this, zk), self.jmxLocalPeerBean);
    try {
        // 寻找leader地址
        InetSocketAddress addr = findLeader();
        try {
            // 向leader发起连接
            connectToLeader(addr);
            // ...
        } catch (IOException e) {
            LOG.warn("Exception when following the leader", e);
            try {
                sock.close();
            } catch (IOException e1) {
                e1.printStackTrace();
            }

            // clear pending revalidations
            pendingRevalidations.clear();
        }
    } finally {
        zk.unregisterJMX((Learner)this);
    }
}

// Learner
protected void connectToLeader(InetSocketAddress addr)
throws IOException, ConnectException, InterruptedException {
    sock = new Socket();
    sock.setSoTimeout(self.tickTime * self.initLimit);
    // 尝试连接, 最多尝试5次
    for (int tries = 0; tries < 5; tries++) {
        try {
            sock.connect(addr, self.tickTime * self.syncLimit);
            sock.setTcpNoDelay(nodelay);
            break;
        } catch (IOException e) {
            if (tries == 4) {
                LOG.error("Unexpected exception", e);
                throw e;
            } else {
                LOG.warn("Unexpected exception, tries=" + tries +
                         ", connecting to " + addr, e);
                sock = new Socket();
                sock.setSoTimeout(self.tickTime * self.initLimit);
            }
        }
        Thread.sleep(1000);
    }
    // jute协议, archive缓冲输入流
    leaderIs = BinaryInputArchive.getArchive(new BufferedInputStream(
                   sock.getInputStream()));
    bufferedOutput = new BufferedOutputStream(sock.getOutputStream());
    // jute协议, archive缓冲输出流
    leaderOs = BinaryOutputArchive.getArchive(bufferedOutput);
}
```

当节点状态为为FOLLOWING时，会初始化一个Follwer，并执行followLeader逻辑。follwer找到leader地址后会发起建立一个socket连接。

# 注册&同步数据

> 在以后的通信过程中，ZooKeeper消息交换使用的序列化协议为Jute，Jute是ZK中自己实现的序列化协议。

当follower向leader发起的连接成功建立后，立即会向leader发起注册，之后开始从leader同步数据。

## follower

```java
// Follower.java
void followLeader() throws InterruptedException {
    self.end_fle = System.currentTimeMillis();
    LOG.info("FOLLOWING - LEADER ELECTION TOOK - " +
             (self.end_fle - self.start_fle));
    self.start_fle = 0;
    self.end_fle = 0;
    fzk.registerJMX(new FollowerBean(this, zk), self.jmxLocalPeerBean);
    try {
        // 寻找leader地址
        InetSocketAddress addr = findLeader();
        try {
            // 向leader发起连接
            connectToLeader(addr);
            // 注册到leader
            long newEpochZxid = registerWithLeader(Leader.FOLLOWERINFO);

            //check to see if the leader zxid is lower than ours
            //this should never happen but is just a safety check
            long newEpoch = ZxidUtils.getEpochFromZxid(newEpochZxid);
            if (newEpoch < self.getAcceptedEpoch()) {
                LOG.error("Proposed leader epoch " + ZxidUtils.zxidToString(newEpochZxid)
                          + " is less than our accepted epoch " + ZxidUtils.zxidToString(self.getAcceptedEpoch()));
                throw new IOException("Error: Epoch of leader is lower");
            }
            // 从leader同步数据
            syncWithLeader(newEpochZxid);
            QuorumPacket qp = new QuorumPacket();
            while (self.isRunning()) {
                // 读取从leader同步过来的数据
                readPacket(qp);
                // 数据处理
                processPacket(qp);
            }
        } catch (IOException e) {
            LOG.warn("Exception when following the leader", e);
            try {
                sock.close();
            } catch (IOException e1) {
                e1.printStackTrace();
            }

            // clear pending revalidations
            pendingRevalidations.clear();
        }
    } finally {
        zk.unregisterJMX((Learner)this);
    }
}

// Learner.java
protected long registerWithLeader(int pktType) throws IOException {
    /*
     * Send follower info, including last zxid and sid
     */
    long lastLoggedZxid = self.getLastLoggedZxid();
    QuorumPacket qp = new QuorumPacket();
    qp.setType(pktType);
    qp.setZxid(ZxidUtils.makeZxid(self.getAcceptedEpoch(), 0));

    /*
     * Add sid to payload
     */
    LearnerInfo li = new LearnerInfo(self.getId(), 0x10000);
    ByteArrayOutputStream bsid = new ByteArrayOutputStream();
    BinaryOutputArchive boa = BinaryOutputArchive.getArchive(bsid);
    // 使用Jute协议序列化
    boa.writeRecord(li, "LearnerInfo");
    qp.setData(bsid.toByteArray());

    writePacket(qp, true);
    readPacket(qp);
    final long newEpoch = ZxidUtils.getEpochFromZxid(qp.getZxid());
    if (qp.getType() == Leader.LEADERINFO) { // leader收到请求后会返回一个LEADERINFO信息
        // we are connected to a 1.0 server so accept the new epoch and read the next packet
        leaderProtocolVersion = ByteBuffer.wrap(qp.getData()).getInt();
        byte epochBytes[] = new byte[4];
        final ByteBuffer wrappedEpochBytes = ByteBuffer.wrap(epochBytes);
        if (newEpoch > self.getAcceptedEpoch()) {
            wrappedEpochBytes.putInt((int)self.getCurrentEpoch());
            self.setAcceptedEpoch(newEpoch);
        } else if (newEpoch == self.getAcceptedEpoch()) {
            // since we have already acked an epoch equal to the leaders, we cannot ack
            // again, but we still need to send our lastZxid to the leader so that we can
            // sync with it if it does assume leadership of the epoch.
            // the -1 indicates that this reply should not count as an ack for the new epoch
            wrappedEpochBytes.putInt(-1);
        } else {
            throw new IOException("Leaders epoch, " + newEpoch + " is less than accepted epoch, " + self.getAcceptedEpoch());
        }
        QuorumPacket ackNewEpoch = new QuorumPacket(Leader.ACKEPOCH, lastLoggedZxid, epochBytes, null);
        writePacket(ackNewEpoch, true);
        return ZxidUtils.makeZxid(newEpoch, 0);
    } else {
        if (newEpoch > self.getAcceptedEpoch()) {
            self.setAcceptedEpoch(newEpoch);
        }
        if (qp.getType() != Leader.NEWLEADER) {
            LOG.error("First packet should have been NEWLEADER");
            throw new IOException("First packet should have been NEWLEADER");
        }
        return qp.getZxid();
    }
}

// Learner.java
protected void syncWithLeader(long newLeaderZxid) throws IOException, InterruptedException {
    QuorumPacket ack = new QuorumPacket(Leader.ACK, 0, null, null);
    QuorumPacket qp = new QuorumPacket();
    long newEpoch = ZxidUtils.getEpochFromZxid(newLeaderZxid);

    readPacket(qp);
    LinkedList<Long> packetsCommitted = new LinkedList<Long>();
    LinkedList<PacketInFlight> packetsNotCommitted = new LinkedList<PacketInFlight>();
    synchronized (zk) {
        if (qp.getType() == Leader.DIFF) { // 合并
            LOG.info("Getting a diff from the leader 0x" + Long.toHexString(qp.getZxid()));
        } else if (qp.getType() == Leader.SNAP) { // 同步快照
            LOG.info("Getting a snapshot from leader");
            // The leader is going to dump the database
            // clear our own database and read
            zk.getZKDatabase().clear();
            zk.getZKDatabase().deserializeSnapshot(leaderIs);
            String signature = leaderIs.readString("signature");
            if (!signature.equals("BenWasHere")) {
                LOG.error("Missing signature. Got " + signature);
                throw new IOException("Missing signature");
            }
        } else if (qp.getType() == Leader.TRUNC) { // 回滚, 截断日志
            //we need to truncate the log to the lastzxid of the leader
            LOG.warn("Truncating log to get in sync with the leader 0x"
                     + Long.toHexString(qp.getZxid()));
            boolean truncated = zk.getZKDatabase().truncateLog(qp.getZxid());
            if (!truncated) {
                // not able to truncate the log
                LOG.error("Not able to truncate the log "
                          + Long.toHexString(qp.getZxid()));
                System.exit(13);
            }

        } else {
            LOG.error("Got unexpected packet from leader "
                      + qp.getType() + " exiting ... " );
            System.exit(13);

        }
        zk.getZKDatabase().setlastProcessedZxid(qp.getZxid());
        zk.createSessionTracker();

        long lastQueued = 0;

        // in V1.0 we take a snapshot when we get the NEWLEADER message, but in pre V1.0
        // we take the snapshot at the UPDATE, since V1.0 also gets the UPDATE (after the NEWLEADER)
        // we need to make sure that we don't take the snapshot twice.
        boolean snapshotTaken = false;
        // we are now going to start getting transactions to apply followed by an UPTODATE
        outerLoop:
        while (self.isRunning()) {
            readPacket(qp);
            switch (qp.getType()) {
            case Leader.PROPOSAL:
                PacketInFlight pif = new PacketInFlight();
                pif.hdr = new TxnHeader();
                pif.rec = SerializeUtils.deserializeTxn(qp.getData(), pif.hdr);
                if (pif.hdr.getZxid() != lastQueued + 1) {
                    LOG.warn("Got zxid 0x"
                             + Long.toHexString(pif.hdr.getZxid())
                             + " expected 0x"
                             + Long.toHexString(lastQueued + 1));
                }
                lastQueued = pif.hdr.getZxid();
                packetsNotCommitted.add(pif);
                break;
            case Leader.COMMIT:
                if (!snapshotTaken) {
                    pif = packetsNotCommitted.peekFirst();
                    if (pif.hdr.getZxid() != qp.getZxid()) {
                        LOG.warn("Committing " + qp.getZxid() + ", but next proposal is " + pif.hdr.getZxid());
                    } else {
                        zk.processTxn(pif.hdr, pif.rec);
                        packetsNotCommitted.remove();
                    }
                } else {
                    packetsCommitted.add(qp.getZxid());
                }
                break;
            case Leader.INFORM:
                TxnHeader hdr = new TxnHeader();
                Record txn = SerializeUtils.deserializeTxn(qp.getData(), hdr);
                zk.processTxn(hdr, txn);
                break;
            case Leader.UPTODATE: // 同步完成标识
                if (!snapshotTaken) { // true for the pre v1.0 case
                    zk.takeSnapshot();
                    self.setCurrentEpoch(newEpoch);
                }
                self.cnxnFactory.setZooKeeperServer(zk);
                break outerLoop;
            case Leader.NEWLEADER: // it will be NEWLEADER in v1.0
                zk.takeSnapshot();
                self.setCurrentEpoch(newEpoch);
                snapshotTaken = true;
                writePacket(new QuorumPacket(Leader.ACK, newLeaderZxid, null, null), true);
                break;
            }
        }
    }
    ack.setZxid(ZxidUtils.makeZxid(newEpoch, 0));
    writePacket(ack, true);
    sock.setSoTimeout(self.tickTime * self.syncLimit);
    zk.startup();
    // We need to log the stuff that came in between the snapshot and the uptodate
    if (zk instanceof FollowerZooKeeperServer) {
        FollowerZooKeeperServer fzk = (FollowerZooKeeperServer)zk;
        for (PacketInFlight p : packetsNotCommitted) {
            fzk.logRequest(p.hdr, p.rec);
        }
        for (Long zxid : packetsCommitted) {
            fzk.commit(zxid);
        }
    }
}
```

从如上代码可以看到，当follower与leader连接建立后，follower会立即向leader发送注册请求，leader会响应一个LEADERINFO类型的消息，然后follower回复一个ACKEPOCH类型的消息，至此注册就完成了。

注册完成后follower开始同步leader数据，follower开始接收并处理leader发送过来的各种类型的消息。

消息类型和处理：

- FOLLOWERINFO：follower发送给leader协议版本
- LEADERINFO：follower收到leader发送的第一条消息，包含协议版本和leader epoch
- ACKEPOCH：follower回复leader LEADERINFO的消息，用来确认leader epoch
- NEWLEADER：leader发送给follower zxid
- DIFF：leader通知follower开始合并差异
- TRUNC：leader通知follower截断日志
- SNAP：leader通知follower开始传输快照
- PROPOSAL：leader发送给follower的提案
- ACK：follower响应leader PROPOSAL
- COMMIT：leader通知follower提交proposal
- UPTODATE：leader通知follower完成同步，可以开始响应客户端

## leader

```java
// LearnerHandler.java
public void run() {
    try {
        ia = BinaryInputArchive.getArchive(new BufferedInputStream(sock
                                           .getInputStream()));
        bufferedOutput = new BufferedOutputStream(sock.getOutputStream());
        oa = BinaryOutputArchive.getArchive(bufferedOutput);

        QuorumPacket qp = new QuorumPacket();
        // Jute反序列化消息
        ia.readRecord(qp, "packet");
        if (qp.getType() != Leader.FOLLOWERINFO && qp.getType() != Leader.OBSERVERINFO) {
            LOG.error("First packet " + qp.toString()
                      + " is not FOLLOWERINFO or OBSERVERINFO!");
            return;
        }
        byte learnerInfoData[] = qp.getData();
        if (learnerInfoData != null) {
            if (learnerInfoData.length == 8) {
                ByteBuffer bbsid = ByteBuffer.wrap(learnerInfoData);
                this.sid = bbsid.getLong();
            } else {
                LearnerInfo li = new LearnerInfo();
                ByteBufferInputStream.byteBuffer2Record(ByteBuffer.wrap(learnerInfoData), li);
                this.sid = li.getServerid();
                this.version = li.getProtocolVersion();
            }
        } else {
            this.sid = leader.followerCounter.getAndDecrement();
        }

        LOG.info("Follower sid: " + sid + " : info : "
                 + leader.self.quorumPeers.get(sid));

        if (qp.getType() == Leader.OBSERVERINFO) {
            learnerType = LearnerType.OBSERVER;
        }

        long lastAcceptedEpoch = ZxidUtils.getEpochFromZxid(qp.getZxid());

        long peerLastZxid;
        StateSummary ss = null;
        long zxid = qp.getZxid();
        long newEpoch = leader.getEpochToPropose(this.getSid(), lastAcceptedEpoch);

        if (this.getVersion() < 0x10000) { // peer未注册
            // we are going to have to extrapolate the epoch information
            long epoch = ZxidUtils.getEpochFromZxid(zxid);
            ss = new StateSummary(epoch, zxid);
            // fake the message
            leader.waitForEpochAck(this.getSid(), ss);
        } else {
            byte ver[] = new byte[4];
            ByteBuffer.wrap(ver).putInt(0x10000);
            QuorumPacket newEpochPacket = new QuorumPacket(Leader.LEADERINFO, ZxidUtils.makeZxid(newEpoch, 0), ver, null);
            // 发送leader info消息
            oa.writeRecord(newEpochPacket, "packet");
            bufferedOutput.flush();
            QuorumPacket ackEpochPacket = new QuorumPacket();
            // 读取响应消息
            ia.readRecord(ackEpochPacket, "packet");
            if (ackEpochPacket.getType() != Leader.ACKEPOCH) {
                LOG.error(ackEpochPacket.toString()
                          + " is not ACKEPOCH");
                return;
            }
            ByteBuffer bbepoch = ByteBuffer.wrap(ackEpochPacket.getData());
            ss = new StateSummary(bbepoch.getInt(), ackEpochPacket.getZxid());
            // 等待多数节点ack消息
            leader.waitForEpochAck(this.getSid(), ss);
        }
        // peer最大的zxid
        peerLastZxid = ss.getLastZxid();

        /* the default to send to the follower */
        // 默认情况下同步快照
        int packetToSend = Leader.SNAP;
        long zxidToSend = 0;
        long leaderLastZxid = 0;
        /** the packets that the follower needs to get updates from **/
        long updates = peerLastZxid;

        /* we are sending the diff check if we have proposals in memory to be able to
         * send a diff to the
         */
        ReentrantReadWriteLock lock = leader.zk.getZKDatabase().getLogLock();
        ReadLock rl = lock.readLock();
        try {
            // 获取zk commit日志读锁
            rl.lock();
            // 最大commit日志
            final long maxCommittedLog = leader.zk.getZKDatabase().getmaxCommittedLog();
            // 最小commit日志
            final long minCommittedLog = leader.zk.getZKDatabase().getminCommittedLog();
            LOG.info("Synchronizing with Follower sid: " + sid
                     + " maxCommittedLog=0x" + Long.toHexString(maxCommittedLog)
                     + " minCommittedLog=0x" + Long.toHexString(minCommittedLog)
                     + " peerLastZxid=0x" + Long.toHexString(peerLastZxid));

            // commit日志列表
            LinkedList<Proposal> proposals = leader.zk.getZKDatabase().getCommittedLog();

            if (proposals.size() != 0) {
                LOG.debug("proposal size is {}", proposals.size());
                // 如果peer最大的zxid在leader最小commit日志和最大commit日志之间
                if ((maxCommittedLog >= peerLastZxid)
                        && (minCommittedLog <= peerLastZxid)) {
                    LOG.debug("Sending proposals to follower");

                    // as we look through proposals, this variable keeps track of previous
                    // proposal Id.
                    long prevProposalZxid = minCommittedLog;

                    // Keep track of whether we are about to send the first packet.
                    // Before sending the first packet, we have to tell the learner
                    // whether to expect a trunc or a diff
                    boolean firstPacket = true;

                    // If we are here, we can use committedLog to sync with
                    // follower. Then we only need to decide whether to
                    // send trunc or not
                    packetToSend = Leader.DIFF;
                    zxidToSend = maxCommittedLog;

                    for (Proposal propose : proposals) {
                        // skip the proposals the peer already has
                        if (propose.packet.getZxid() <= peerLastZxid) {
                            prevProposalZxid = propose.packet.getZxid();
                            continue;
                        } else {
                            // 要求follower从minCommittedLog截断, 之后的日志重新同步, 防止peer中有leader没有的事务日志
                            // If we are sending the first packet, figure out whether to trunc
                            // in case the follower has some proposals that the leader doesn't
                            if (firstPacket) {
                                firstPacket = false;
                                // Does the peer have some proposals that the leader hasn't seen yet
                                if (prevProposalZxid < peerLastZxid) {
                                    // send a trunc message before sending the diff
                                    packetToSend = Leader.TRUNC;
                                    zxidToSend = prevProposalZxid;
                                    updates = zxidToSend;
                                }
                            }
                            // 把事务提交到发送队列中, 每条事务消息跟随一个commit消息
                            queuePacket(propose.packet);
                            QuorumPacket qcommit = new QuorumPacket(Leader.COMMIT, propose.packet.getZxid(),
                                                                    null, null);
                            queuePacket(qcommit);
                        }
                    }
                } else if (peerLastZxid > maxCommittedLog) {
                    LOG.debug("Sending TRUNC to follower zxidToSend=0x{} updates=0x{}",
                              Long.toHexString(maxCommittedLog),
                              Long.toHexString(updates));

                    packetToSend = Leader.TRUNC;
                    zxidToSend = maxCommittedLog;
                    updates = zxidToSend;
                } else {
                    LOG.warn("Unhandled proposal scenario");
                }
            } else if (peerLastZxid == leader.zk.getZKDatabase().getDataTreeLastProcessedZxid()) {
                // The leader may recently take a snapshot, so the committedLog
                // is empty. We don't need to send snapshot if the follow
                // is already sync with in-memory db.
                LOG.debug("committedLog is empty but leader and follower "
                          + "are in sync, zxid=0x{}",
                          Long.toHexString(peerLastZxid));
                packetToSend = Leader.DIFF;
                zxidToSend = peerLastZxid;
            } else {
                // just let the state transfer happen
                LOG.debug("proposals is empty");
            }

            LOG.info("Sending " + Leader.getPacketType(packetToSend));
            // 添加follower到leader forwarding follower列表
            leaderLastZxid = leader.startForwarding(this, updates);

        } finally {
            // commit日志读锁解锁
            rl.unlock();
        }

        QuorumPacket newLeaderQP = new QuorumPacket(Leader.NEWLEADER,
                ZxidUtils.makeZxid(newEpoch, 0), null, null);
        if (getVersion() < 0x10000) {
            oa.writeRecord(newLeaderQP, "packet");
        } else {
            // 最后添加一条NEWLEADER消息
            queuedPackets.add(newLeaderQP);
        }
        bufferedOutput.flush();
        //Need to set the zxidToSend to the latest zxid
        if (packetToSend == Leader.SNAP) {
            zxidToSend = leader.zk.getZKDatabase().getDataTreeLastProcessedZxid();
        }
        // 发送一条消息通知learner开始同步数据
        oa.writeRecord(new QuorumPacket(packetToSend, zxidToSend, null, null), "packet");
        bufferedOutput.flush();

        /* if we are not truncating or sending a diff just send a snapshot */
        if (packetToSend == Leader.SNAP) {
            LOG.info("Sending snapshot last zxid of peer is 0x"
                     + Long.toHexString(peerLastZxid) + " "
                     + " zxid of leader is 0x"
                     + Long.toHexString(leaderLastZxid)
                     + "sent zxid of db as 0x"
                     + Long.toHexString(zxidToSend));
            // Dump data to peer
            // 如果需要同步快照就把整个db序列化
            leader.zk.getZKDatabase().serializeSnapshot(oa);
            oa.writeString("BenWasHere", "signature");
        }
        bufferedOutput.flush();

        // Start sending packets
        new Thread() {
            public void run() {
                Thread.currentThread().setName(
                    "Sender-" + sock.getRemoteSocketAddress());
                try {
                    sendPackets();
                } catch (InterruptedException e) {
                    LOG.warn("Unexpected interruption", e);
                }
            }
        } .start();

        /*
         * Have to wait for the first ACK, wait until
         * the leader is ready, and only then we can
         * start processing messages.
         */
        // 等待同步之后peer响应的ACK消息
        qp = new QuorumPacket();
        ia.readRecord(qp, "packet");
        if (qp.getType() != Leader.ACK) {
            LOG.error("Next packet was supposed to be an ACK");
            return;
        }
        // 处理ACK消息
        leader.processAck(this.sid, qp.getZxid(), sock.getLocalSocketAddress());

        // now that the ack has been processed expect the syncLimit
        sock.setSoTimeout(leader.self.tickTime * leader.self.syncLimit);

        /*
         * Wait until leader starts up
         */
        // 等待leader启动
        synchronized (leader.zk) {
            while (!leader.zk.isRunning() && !this.isInterrupted()) {
                leader.zk.wait(20);
            }
        }
        // Mutation packets will be queued during the serialize,
        // so we need to mark when the peer can actually start
        // using the data
        //
        // 发送一条UPTODATE消息, 表明follower目前消息时最新的, 可以开始处理客户端请求
        queuedPackets.add(new QuorumPacket(Leader.UPTODATE, -1, null, null));

        // 接下来循环处理正常消息
        // ...
    } catch (IOException e) {
        if (sock != null && !sock.isClosed()) {
            LOG.error("Unexpected exception causing shutdown while sock "
                      + "still open", e);
            //close the socket to make sure the
            //other side can see it being close
            try {
                sock.close();
            } catch (IOException ie) {
                // do nothing
            }
        }
    } catch (InterruptedException e) {
        LOG.error("Unexpected exception causing shutdown", e);
    } finally {
        LOG.warn("******* GOODBYE "
                 + (sock != null ? sock.getRemoteSocketAddress() : "<null>")
                 + " ********");
        shutdown();
    }
}

// Leader.java
public void waitForEpochAck(long id, StateSummary ss) throws IOException, InterruptedException {
    synchronized (electingFollowers) {
        if (electionFinished) {
            return;
        }
        if (ss.getCurrentEpoch() != -1) {
            if (ss.isMoreRecentThan(leaderStateSummary)) {
                throw new IOException("Follower is ahead of the leader, leader summary: "
                                      + leaderStateSummary.getCurrentEpoch()
                                      + " (current epoch), "
                                      + leaderStateSummary.getLastZxid()
                                      + " (last zxid)");
            }
            electingFollowers.add(id);
        }
        QuorumVerifier verifier = self.getQuorumVerifier();
        if (electingFollowers.contains(self.getId()) && verifier.containsQuorum(electingFollowers)) {
            electionFinished = true;
            electingFollowers.notifyAll();
        } else {
            long start = System.currentTimeMillis();
            long cur = start;
            long end = start + self.getInitLimit() * self.getTickTime();
            while (!electionFinished && cur < end) {
                electingFollowers.wait(end - cur);
                cur = System.currentTimeMillis();
            }
            if (!electionFinished) {
                throw new InterruptedException("Timeout while waiting for epoch to be acked by quorum");
            }
        }
    }
}

// Leader.java
synchronized public void processAck(long sid, long zxid, SocketAddress followerAddr) {
    if (LOG.isTraceEnabled()) {
        LOG.trace("Ack zxid: 0x{}", Long.toHexString(zxid));
        for (Proposal p : outstandingProposals.values()) {
            long packetZxid = p.packet.getZxid();
            LOG.trace("outstanding proposal: 0x{}",
                      Long.toHexString(packetZxid));
        }
        LOG.trace("outstanding proposals all");
    }

    // 没有处理中的事务
    if (outstandingProposals.size() == 0) {
        if (LOG.isDebugEnabled()) {
            LOG.debug("outstanding is 0");
        }
        return;
    }
    // 判断当前zxid是否已经被commit
    if (lastCommitted >= zxid) {
        if (LOG.isDebugEnabled()) {
            LOG.debug("proposal has already been committed, pzxid: 0x{} zxid: 0x{}",
                      Long.toHexString(lastCommitted), Long.toHexString(zxid));
        }
        // The proposal has already been committed
        return;
    }
    Proposal p = outstandingProposals.get(zxid);
    if (p == null) {
        LOG.warn("Trying to commit future proposal: zxid 0x{} from {}",
                 Long.toHexString(zxid), followerAddr);
        return;
    }

    // 记录peer proposal ack
    p.ackSet.add(sid);
    if (LOG.isDebugEnabled()) {
        LOG.debug("Count for zxid: 0x{} is {}",
                  Long.toHexString(zxid), p.ackSet.size());
    }
    // 是否满足大多数节点ACK
    if (self.getQuorumVerifier().containsQuorum(p.ackSet)) {
        if (zxid != lastCommitted + 1) {
            LOG.warn("Commiting zxid 0x{} from {} not first!",
                     Long.toHexString(zxid), followerAddr);
            LOG.warn("First is 0x{}", Long.toHexString(lastCommitted + 1));
        }
        outstandingProposals.remove(zxid);
        if (p.request != null) {
            // 保存已经完成投票被commit的proposal
            toBeApplied.add(p);
        }
        // We don't commit the new leader proposal
        if ((zxid & 0xffffffffL) != 0) {
            if (p.request == null) {
                LOG.warn("Going to commmit null request for proposal: {}", p);
            }
            // 发送给所有follower commit消息
            commit(zxid);
            // 同步给所有observer
            inform(p);
            // commit proposal
            zk.commitProcessor.commit(p.request);
            if (pendingSyncs.containsKey(zxid)) {
                for (LearnerSyncRequest r : pendingSyncs.remove(zxid)) {
                    sendSync(r);
                }
            }
            return;
        } else {
            // NEWLEADER消息
            lastCommitted = zxid;
            LOG.info("Have quorum of supporters; starting up and setting last processed zxid: 0x{}",
                     Long.toHexString(zk.getZxid()));
            // 启动leader zk服务
            zk.startup();
            zk.getZKDatabase().setlastProcessedZxid(zk.getZxid());
        }
    }
}
```

从以上代码可以看到，leader侧在与follower建立连接后，首先会读取follower发送过来的FOLLOWERINFO消息，然后回复给follower一条LEADERINFO消息，等待follower响应ACKPOCH其中包含peerLastZxid。所有LeaderHandler都会阻塞等待ACKPOCH，直到集群中大多数follower都响应ACKPOCH后就开始初始数据同步。

接下来在开始同步数据之前，首先需要获取commit日志的读锁，读取完成后释放，数据同步分为三种情况：

1. 如果peerLastZxid大于leader的最小zxid并且小于最大zxid，那么就发送一条TRUNC消息通知follower在leader最小zxid处截断防止follower中有leader没有的事务日志，然后再发送一条DIFF消息通知follower开始合并，之后开始从最小zxid到最大zxid发送PROPOSAL消息，每条PROPOSAL伴随一条COMMIT消息。
2. 如果peerLastZxid大于leader的最大zxid，那么就发送一条TRUNC消息通知follower在leader最大zxid处截断。
3. 其他情况直接发送一条SNAP消息通知follower接收快照，然后leader序列化db数据发送到follower。

在数据同步消息的最后，leader会发送一条NEWLEADER消息，当收到follower响应NEWLEADER的ACK消息，表明当前节点数据同步已经完成了。此时如果大多数节点都响应了这条消息，leader会启动自身服务开始接收客户端请求，并且发送给follower一条UPTODATE消息通知follwer数据已经是最新的可以开始响应客户端。

# 小结

初始化数据同步过程：

1. follower发起与leader建立socket通信。
2. follower向leader发送FOLLOWERINFO消息，包含节点的epoch和协议版本消息，向leader发起注册。
3. leader收到FOLLOWERINFO消息后，响应一个LEADERINFO消息，等待满足大多数follwer ACKPOCH。
4. follower收到leader 发送过来的LEADERINFO消息后，响应ACKPOCH其中包含peerLastZxid。
5. 当满足大多数follwer ACKPOCH，leader开始向所有已经ACKPOCH的follower同步初始化数据。
    - 如果peerLastZxid大于leader的最小zxid并且小于最大zxid，那么就发送一条TRUNC消息通知follower在leader最小zxid处截断防止follower中有leader没有的事务日志，然后再发送一条DIFF消息通知follower开始合并，之后开始从最小zxid到最大zxid发送PROPOSAL消息，每条PROPOSAL伴随一条COMMIT消息。
    - 如果peerLastZxid大于leader的最大zxid，那么就发送一条TRUNC消息通知follower在leader最大zxid处截断。
    - 其他情况直接发送一条SNAP消息通知follower接收快照，然后leader序列化db数据发送到follower。
6. 在数据同步消息的最后，leader会发送一条NEWLEADER消息。
7. follower收到leader 发送的NEWLEADER消息，响应一条ACK消息。
8. 当满足大多数节点响应响应了ACK消息，leader会启动自身服务开始接收客户端请求，并且发送给follower一条UPTODATE消息通知follwer数据已经是最新的可以开始响应客户端。