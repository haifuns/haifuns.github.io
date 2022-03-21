title: 【ZooKeeper源码】消息处理器链
author: haifun
tags:
  - ZooKeeper
categories:
  - 分布式
date: 2022-03-21 19:30:00

---

在上一篇session处理过程中我们略过了touchSession之后的消息处理过程，本篇将继续分析消息处理器链对消息的处理过程。

# Leader处理器链

leader节点过滤器链在LeaderZooKeeperServer启动过程中完成初始化，相关代码如下：

```java
// ZooKeeper.java
public void startup() {
    if (sessionTracker == null) {
        createSessionTracker();
    }
    // 启动session管理组件
    startSessionTracker();
    // 启动过滤器链
    setupRequestProcessors();

    registerJMX();

    synchronized (this) {
        running = true;
        notifyAll();
    }
}

// LeaderZooKeeperServer.java
@Override
protected void setupRequestProcessors() {
    // leader处理器链
    RequestProcessor finalProcessor = new FinalRequestProcessor(this);
    RequestProcessor toBeAppliedProcessor = new Leader.ToBeAppliedRequestProcessor(
        finalProcessor, getLeader().toBeApplied);
    // commit到内存, 发送commit请求到follower
    commitProcessor = new CommitProcessor(toBeAppliedProcessor,
                                          Long.toString(getServerId()), false);
    commitProcessor.start();
    // 写入本地事务日志, 2PC同步, follower写入本地事务日志后ACK, 等待过半ACK
    ProposalRequestProcessor proposalProcessor = new ProposalRequestProcessor(this,
            commitProcessor);
    proposalProcessor.initialize();
    firstProcessor = new PrepRequestProcessor(this, proposalProcessor);
    ((PrepRequestProcessor)firstProcessor).start();
}
```

从以上代码中可以看到leader消息处理器链为`PrepRequestProcessor -> ProposalRequestProcessor -> CommitProcessor -> Leader.ToBeAppliedRequestProcessor -> FinalRequestProcessor`。

接下来以一条create类型的事务消息为例，分析leader消息处理流程：

## PreRequestProcessor

```java
public void submitRequest(Request si) {
    // ...

    // 更新session过期时间, 重新分桶
    touch(si.cnxn);
    boolean validpacket = Request.isValid(si.type);
    if (validpacket) {
        // preRequestProcessor处理器链开始正式处理消息
        firstProcessor.processRequest(si);
        if (si.cnxn != null) {
            incInProcess();
        }
    }

    // ...
}

// PrepRequestProcessor
LinkedBlockingQueue<Request> submittedRequests = new LinkedBlockingQueue<Request>();

public void processRequest(Request request) {
    // request.addRQRec(">prep="+zks.outstandingChanges.size());
    submittedRequests.add(request);
}

@Override
public void run() {
    try {
        while (true) {
            Request request = submittedRequests.take();
            long traceMask = ZooTrace.CLIENT_REQUEST_TRACE_MASK;
            if (request.type == OpCode.ping) {
                traceMask = ZooTrace.CLIENT_PING_TRACE_MASK;
            }
            if (LOG.isTraceEnabled()) {
                ZooTrace.logRequest(LOG, traceMask, 'P', request, "");
            }
            if (Request.requestOfDeath == request) {
                break;
            }
            pRequest(request);
        }
    } catch (InterruptedException e) {
        LOG.error("Unexpected interruption", e);
    }
    // ...
}

protected void pRequest(Request request) throws RequestProcessorException {
    // LOG.info("Prep>>> cxid = " + request.cxid + " type = " +
    // request.type + " id = 0x" + Long.toHexString(request.sessionId));
    request.hdr = null;
    request.txn = null;

    try {
        switch (request.type) {
        case OpCode.create:
            CreateRequest createRequest = new CreateRequest();
            pRequest2Txn(request.type, zks.getNextZxid(), request, createRequest, true);
            break;
        case OpCode.delete:
            // ...
            break;
            // ...
        }
    } catch (KeeperException e) {
        // ...
    } catch (Exception e) {
        // ...
    }
    request.zxid = zks.getZxid();
    nextProcessor.processRequest(request);
}

protected void pRequest2Txn(int type, long zxid, Request request, Record record, boolean deserialize)
throws KeeperException, IOException, RequestProcessorException {
    request.hdr = new TxnHeader(request.sessionId, request.cxid, zxid,
                                zks.getTime(), type);

    switch (type) {
    case OpCode.create:
        // 检查session是否过期
        zks.sessionTracker.checkSession(request.sessionId, request.getOwner());
        CreateRequest createRequest = (CreateRequest)record;
        if (deserialize)
            ByteBufferInputStream.byteBuffer2Record(request.request, createRequest);
        String path = createRequest.getPath();
        int lastSlash = path.lastIndexOf('/');
        if (lastSlash == -1 || path.indexOf('\0') != -1 || failCreate) {
            LOG.info("Invalid path " + path + " with session 0x" +
                     Long.toHexString(request.sessionId));
            throw new KeeperException.BadArgumentsException(path);
        }
        List<ACL> listACL = removeDuplicates(createRequest.getAcl());
        if (!fixupACL(request.authInfo, listACL)) {
            throw new KeeperException.InvalidACLException(path);
        }
        String parentPath = path.substring(0, lastSlash);
        ChangeRecord parentRecord = getRecordForPath(parentPath);

        // 检查当前路径权限
        checkACL(zks, parentRecord.acl, ZooDefs.Perms.CREATE,
                 request.authInfo);
        int parentCVersion = parentRecord.stat.getCversion();
        CreateMode createMode =
            CreateMode.fromFlag(createRequest.getFlags());
        // 是否是顺序节点
        if (createMode.isSequential()) {
            // 拼接序号
            path = path + String.format(Locale.ENGLISH, "%010d", parentCVersion);
        }
        try {
            PathUtils.validatePath(path);
        } catch (IllegalArgumentException ie) {
            LOG.info("Invalid path " + path + " with session 0x" +
                     Long.toHexString(request.sessionId));
            throw new KeeperException.BadArgumentsException(path);
        }
        try {
            if (getRecordForPath(path) != null) {
                throw new KeeperException.NodeExistsException(path);
            }
        } catch (KeeperException.NoNodeException e) {
            // ignore this one
        }
        boolean ephemeralParent = parentRecord.stat.getEphemeralOwner() != 0;
        if (ephemeralParent) {
            throw new KeeperException.NoChildrenForEphemeralsException(path);
        }
        int newCversion = parentRecord.stat.getCversion() + 1;
        request.txn = new CreateTxn(path, createRequest.getData(),
                                    listACL,
                                    createMode.isEphemeral(), newCversion);
        StatPersisted s = new StatPersisted();
        if (createMode.isEphemeral()) {
            s.setEphemeralOwner(request.sessionId);
        }
        parentRecord = parentRecord.duplicate(request.hdr.getZxid());
        parentRecord.childCount++;
        parentRecord.stat.setCversion(newCversion);
        // 修改父目录
        addChangeRecord(parentRecord);
        // 添加当前节点
        addChangeRecord(new ChangeRecord(request.hdr.getZxid(), path, s,
                                         0, listACL));
        break;
        //...
    }
}

// final List<ChangeRecord> outstandingChanges = new ArrayList<ChangeRecord>();
// final HashMap<String, ChangeRecord> outstandingChangesForPath = new HashMap<String, ChangeRecord>();
void addChangeRecord(ChangeRecord c) {
    synchronized (zks.outstandingChanges) {
        zks.outstandingChanges.add(c); // 即将要处理的changeRecord
        zks.outstandingChangesForPath.put(c.path, c);
    }
}
```

从以上代码可以看到，PrepRequestProcessor处理器将请求封装成ChangeRecord，暂存在outstandingChanges中，然后就交由下一个处理器ProposalRequestProcessor。

## ProposalRequestProcessor

```java
// PrepRequestProcessor.java
public ProposalRequestProcessor(LeaderZooKeeperServer zks,
                                RequestProcessor nextProcessor) {
    this.zks = zks;
    this.nextProcessor = nextProcessor;
    AckRequestProcessor ackProcessor = new AckRequestProcessor(zks.getLeader());
    syncProcessor = new SyncRequestProcessor(zks, ackProcessor);
}

// PrepRequestProcessor.java
public void processRequest(Request request) throws RequestProcessorException {

    if (request instanceof LearnerSyncRequest) {
        zks.getLeader().processSync((LearnerSyncRequest)request);
    } else {
        // commitProcessor
        nextProcessor.processRequest(request);
        if (request.hdr != null) {
            // We need to sync and get consensus on any transactions
            try {
                // 创建Propose, 发送到follower
                zks.getLeader().propose(request);
            } catch (XidRolloverException e) {
                throw new RequestProcessorException(e.getMessage(), e);
            }
            // 写入事务日志
            syncProcessor.processRequest(request);
        }
    }
}

// Leader.java
public Proposal propose(Request request) throws XidRolloverException {
    /**
     * Address the rollover issue. All lower 32bits set indicate a new leader
     * election. Force a re-election instead. See ZOOKEEPER-1277
     */
    if ((request.zxid & 0xffffffffL) == 0xffffffffL) {
        String msg =
            "zxid lower 32 bits have rolled over, forcing re-election, and therefore new epoch start";
        shutdown(msg);
        throw new XidRolloverException(msg);
    }

    ByteArrayOutputStream baos = new ByteArrayOutputStream();
    BinaryOutputArchive boa = BinaryOutputArchive.getArchive(baos);
    try {
        request.hdr.serialize(boa, "hdr");
        if (request.txn != null) {
            request.txn.serialize(boa, "txn");
        }
        baos.close();
    } catch (IOException e) {
        LOG.warn("This really should be impossible", e);
    }
    QuorumPacket pp = new QuorumPacket(Leader.PROPOSAL, request.zxid,
                                       baos.toByteArray(), null);

    Proposal p = new Proposal();
    p.packet = pp;
    p.request = request;
    synchronized (this) {
        if (LOG.isDebugEnabled()) {
            LOG.debug("Proposing:: " + request);
        }

        lastProposed = p.packet.getZxid();
        outstandingProposals.put(lastProposed, p);
        // 发送Proposal到follower
        sendPacket(pp);
    }
    return p;
}
```

从ProposalRequestProcessor处理器构造函数中可以看到其内包含了另一个处理器链`SyncRequestProcessor -> AckRequestProcessor`。消息在此处理器中首先会继续发给下一个处理器CommitProcessor处理，接着把propose消息发送给所有follower，然后交给SyncRequestProcessor处理。

### SyncRequestProcessor

```java
// SyncRequestProcessor.java
public void processRequest(Request request) {
    // request.addRQRec(">sync");
    queuedRequests.add(request);
}

// SyncRequestProcessor.java
@Override
public void run() {
    try {
        int logCount = 0;

        // we do this in an attempt to ensure that not all of the servers
        // in the ensemble take a snapshot at the same time
        int randRoll = r.nextInt(snapCount / 2);
        while (true) {
            Request si = null;
            if (toFlush.isEmpty()) {
                si = queuedRequests.take();
            } else {
                si = queuedRequests.poll();
                if (si == null) {
                    // 队列里的propose都写入事务日志, 执行flush到磁盘
                    flush(toFlush);
                    continue;
                }
            }
            if (si == requestOfDeath) {
                break;
            }
            if (si != null) {
                // track the number of records written to the log
                // 追加日志
                if (zks.getZKDatabase().append(si)) {
                    logCount++;
                    if (logCount > (snapCount / 2 + randRoll)) {
                        randRoll = r.nextInt(snapCount / 2);
                        // roll the log
                        zks.getZKDatabase().rollLog();
                        // take a snapshot
                        if (snapInProcess != null && snapInProcess.isAlive()) {
                            LOG.warn("Too busy to snap, skipping");
                        } else {
                            // 每隔一定次数保存快照
                            snapInProcess = new Thread("Snapshot Thread") {
                                public void run() {
                                    try {
                                        zks.takeSnapshot();
                                    } catch (Exception e) {
                                        LOG.warn("Unexpected exception", e);
                                    }
                                }
                            };
                            snapInProcess.start();
                        }
                        logCount = 0;
                    }
                } else if (toFlush.isEmpty()) {
                    // optimization for read heavy workloads
                    // iff this is a read, and there are no pending
                    // flushes (writes), then just pass this to the next
                    // processor
                    nextProcessor.processRequest(si);
                    if (nextProcessor instanceof Flushable) {
                        ((Flushable)nextProcessor).flush();
                    }
                    continue;
                }
                toFlush.add(si);
                // 事务日志大于1000条flush到磁盘
                if (toFlush.size() > 1000) {
                    flush(toFlush);
                }
            }
        }
    } catch (Throwable t) {
        LOG.error("Severe unrecoverable error, exiting", t);
        running = false;
        System.exit(11);
    }
    LOG.info("SyncRequestProcessor exited!");
}
```

SyncRequestProcessor处理器将事务追加到内存数据库中，当日志数量大于1000条会flush到磁盘。并且每当累计到一定次数会切换日志文件并将内存数据库保存快照。

在flush到磁盘时会调用下一个处理器AckRequestProcessor。

### AckRequestProcessor

```java
public void processRequest(Request request) {
    QuorumPeer self = leader.self;
    if (self != null)
        leader.processAck(self.getId(), request.zxid, null);
    else
        LOG.error("Null QuorumPeer");
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

AckRequestProcessor处理逻辑比较简单，Leader#processAck方法是用来处理针对proposal的ACK消息，这里相当于leader给自己投了一票。

如果已经满足大多数节点ACK，就发送commit消息给所有follower以及observer，接着调用CommitProcessor执行commit。

## CommitProcessor

```java
public void run() {
    try {
        Request nextPending = null;
        while (!finished) {
            int len = toProcess.size();
            for (int i = 0; i < len; i++) {
                // leader Leader.ToBeAppliedRequestProcessor
                // follower FinalRequestProcessor 结束处理
                nextProcessor.processRequest(toProcess.get(i));
            }
            toProcess.clear();
            synchronized (this) {
                if ((queuedRequests.size() == 0 || nextPending != null)
                        && committedRequests.size() == 0) {
                    // 在多数节点ack之前会阻塞
                    wait();
                    continue;
                }
                // First check and see if the commit came in for the pending
                // request
                if ((queuedRequests.size() == 0 || nextPending != null)
                        && committedRequests.size() > 0) {
                    Request r = committedRequests.remove();
                    /*
                     * We match with nextPending so that we can move to the
                     * next request when it is committed. We also want to
                     * use nextPending because it has the cnxn member set
                     * properly.
                     */
                    // 只有当已经可以commit消息保存到toProcess
                    if (nextPending != null
                            && nextPending.sessionId == r.sessionId
                            && nextPending.cxid == r.cxid) {
                        // we want to send our version of the request.
                        // the pointer to the connection in the request
                        nextPending.hdr = r.hdr;
                        nextPending.txn = r.txn;
                        nextPending.zxid = r.zxid;
                        toProcess.add(nextPending);
                        nextPending = null;
                    } else {
                        // this request came from someone else so just
                        // send the commit packet
                        toProcess.add(r);
                    }
                }
            }

            // We haven't matched the pending requests, so go back to
            // waiting
            // 等待处理第一个请求, 保证顺序性
            if (nextPending != null) {
                continue;
            }

            synchronized (this) {
                // Process the next requests in the queuedRequests
                while (nextPending == null && queuedRequests.size() > 0) {
                    Request request = queuedRequests.remove();
                    switch (request.type) {
                    case OpCode.create:
                    case OpCode.delete:
                    case OpCode.setData:
                    case OpCode.multi:
                    case OpCode.setACL:
                    case OpCode.createSession:
                    case OpCode.closeSession:
                        nextPending = request;
                        break;
                    case OpCode.sync:
                        if (matchSyncs) {
                            nextPending = request;
                        } else {
                            toProcess.add(request);
                        }
                        break;
                    default:
                        toProcess.add(request);
                    }
                }
            }
        }
    } catch (InterruptedException e) {
        LOG.warn("Interrupted exception while waiting", e);
    } catch (Throwable e) {
        LOG.error("Unexpected exception causing CommitProcessor to exit", e);
    }
    LOG.info("CommitProcessor exited loop!");
}

synchronized public void commit(Request request) {
    if (!finished) {
        if (request == null) {
            LOG.warn("Committed a null!",
                     new Exception("committing a null! "));
            return;
        }
        if (LOG.isDebugEnabled()) {
            LOG.debug("Committing request:: " + request);
        }
        // 增加commitRequest, 唤醒线程
        committedRequests.add(request);
        notifyAll();
    }
}

synchronized public void processRequest(Request request) {
    // request.addRQRec(">commit");
    if (LOG.isDebugEnabled()) {
        LOG.debug("Processing request:: " + request);
    }

    if (!finished) {
        queuedRequests.add(request);
        notifyAll();
    }
}

// LearnerHandler.java
@Override
public void run() {
    try {
        // ...

        // 接下来循环处理正常消息
        while (true) {
            qp = new QuorumPacket();
            ia.readRecord(qp, "packet");

            long traceMask = ZooTrace.SERVER_PACKET_TRACE_MASK;
            if (qp.getType() == Leader.PING) {
                traceMask = ZooTrace.SERVER_PING_TRACE_MASK;
            }
            if (LOG.isTraceEnabled()) {
                ZooTrace.logQuorumPacket(LOG, traceMask, 'i', qp);
            }
            tickOfLastAck = leader.self.tick;


            ByteBuffer bb;
            long sessionId;
            int cxid;
            int type;

            switch (qp.getType()) {
            case Leader.ACK:
                if (this.learnerType == LearnerType.OBSERVER) {
                    if (LOG.isDebugEnabled()) {
                        LOG.debug("Received ACK from Observer  " + this.sid);
                    }
                }
                leader.processAck(this.sid, qp.getZxid(), sock.getLocalSocketAddress());
                break;
            // ...
            }
        }
    } catch (IOException e) {
        // ...
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
synchronized public void processAck(long sid, long zxid, SocketAddress followerAddr) {
    // ...
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
            // ...
        }
    }
}
```

结合ProposalRequestProcessor，在接收到请求时会将proposal发送给所有follower，然后将proposal写入事务日志并且定期提交。而请求会保存到CommitProcessor queuedRequests数组中，在LearnerHandler#run中收到follower ACK回复后会进行过半判断，如果达到过半节点ACK就调用提交到CommitProcessor committedRequests中。

CommitProcessor线程本身会按照请求顺序处理提交的事务消息，接着将消息发送给下一个处理器ToBeAppliedRequestProcessor。

## Leader.ToBeAppliedRequestProcessor

```java
// Leader.java
ConcurrentLinkedQueue<Proposal> toBeApplied = new ConcurrentLinkedQueue<Proposal>();

synchronized public void processAck(long sid, long zxid, SocketAddress followerAddr) {
    // ...
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

// Leader.ToBeAppliedRequestProcessor.java
public void processRequest(Request request) throws RequestProcessorException {
    // request.addRQRec(">tobe");
    // FinalRequestProcessor 结束处理
    next.processRequest(request);
    Proposal p = toBeApplied.peek();
    if (p != null && p.request != null
            && p.request.zxid == request.zxid) {
        // 移除已经完成投票被commit的proposal
        toBeApplied.remove();
    }
}
```

此处理器逻辑比较简单，在CommitProcessor处理完成后，移除Leader队列中暂存的可以commit的proposal。然后交给下一个处理FinalRequestProcessor处理。

## FinalRequestProcessor

```java
public void processRequest(Request request) {
    // ...
    // request.addRQRec(">final");
    long traceMask = ZooTrace.CLIENT_REQUEST_TRACE_MASK;
    if (request.type == OpCode.ping) {
        traceMask = ZooTrace.SERVER_PING_TRACE_MASK;
    }
    if (LOG.isTraceEnabled()) {
        ZooTrace.logRequest(LOG, traceMask, 'E', request, "");
    }
    ProcessTxnResult rc = null;
    synchronized (zks.outstandingChanges) {
        while (!zks.outstandingChanges.isEmpty()
                && zks.outstandingChanges.get(0).zxid <= request.zxid) {
            ChangeRecord cr = zks.outstandingChanges.remove(0);
            if (cr.zxid < request.zxid) {
                LOG.warn("Zxid outstanding "
                         + cr.zxid
                         + " is less than current " + request.zxid);
            }
            if (zks.outstandingChangesForPath.get(cr.path) == cr) {
                zks.outstandingChangesForPath.remove(cr.path);
            }
        }
        if (request.hdr != null) {
            TxnHeader hdr = request.hdr;
            Record txn = request.txn;

            // 修改内存数据库
            rc = zks.processTxn(hdr, txn);
        }
        // do not add non quorum packets to the queue.
        if (Request.isQuorum(request.type)) {
            zks.getZKDatabase().addCommittedProposal(request);
        }
    }

    // 关闭session
    if (request.hdr != null && request.hdr.getType() == OpCode.closeSession) {
        ServerCnxnFactory scxn = zks.getServerCnxnFactory();
        // this might be possible since
        // we might just be playing diffs from the leader
        if (scxn != null && request.cnxn == null) {
            // calling this if we have the cnxn results in the client's
            // close session response being lost - we've already closed
            // the session/socket here before we can send the closeSession
            // in the switch block below
            // 关闭连接, 移除watcher
            scxn.closeSession(request.sessionId);
            return;
        }
    }

    if (request.cnxn == null) {
        return;
    }
    ServerCnxn cnxn = request.cnxn;

    String lastOp = "NA";
    zks.decInProcess();
    Code err = Code.OK;
    Record rsp = null;
    boolean closeSession = false;
    try {
        if (request.hdr != null && request.hdr.getType() == OpCode.error) {
            throw KeeperException.create(KeeperException.Code.get((
                                             (ErrorTxn) request.txn).getErr()));
        }

        KeeperException ke = request.getException();
        if (ke != null && request.type != OpCode.multi) {
            throw ke;
        }

        if (LOG.isDebugEnabled()) {
            LOG.debug("{}", request);
        }
        switch (request.type) {
        // ...
        case OpCode.create: {
            lastOp = "CREA";
            rsp = new CreateResponse(rc.path);
            err = Code.get(rc.err);
            break;
        }
            // ...
        }
    } catch (SessionMovedException e) {
        cnxn.sendCloseSession();
        return;
    } catch (KeeperException e) {
        err = e.code();
    } catch (Exception e) {
        // ...
    }

    long lastZxid = zks.getZKDatabase().getDataTreeLastProcessedZxid();
    ReplyHeader hdr =
        new ReplyHeader(request.cxid, lastZxid, err.intValue());

    zks.serverStats().updateLatency(request.createTime);
    cnxn.updateStatsForResponse(request.cxid, lastZxid, lastOp,
                                request.createTime, System.currentTimeMillis());

    try {
        cnxn.sendResponse(hdr, rsp, "response");
        if (closeSession) {
            cnxn.sendCloseSession();
        }
    } catch (IOException e) {
        LOG.error("FIXMSG", e);
    }
}
```

FinalRequestProcessor是整个处理器链的最后一环，消息到达此处理器后，对于事务消息会按照请求修改内存数据库，修改过后所有客户端可读，接着发送响应到客户端。

# Follower处理器链

```java
// FollowerZooKeeperServer.java
@Override
protected void setupRequestProcessors() {

    // FollowerRequestProcessor -> CommitProcessor -> FinalRequestProcessor
    RequestProcessor finalProcessor = new FinalRequestProcessor(this);
    commitProcessor = new CommitProcessor(finalProcessor,
                                          Long.toString(getServerId()), true);
    commitProcessor.start();
    firstProcessor = new FollowerRequestProcessor(this, commitProcessor);
    ((FollowerRequestProcessor) firstProcessor).start();

    // SyncRequestProcessor -> SendAckRequestProcessor
    syncProcessor = new SyncRequestProcessor(this,
            new SendAckRequestProcessor((Learner)getFollower()));
    syncProcessor.start();
}
```

从Follower启动处理器链代码中可以看到，follwer处理器链分为两条，`FollowerRequestProcessor -> CommitProcessor -> FinalRequestProcessor`，`SyncRequestProcessor -> SendAckRequestProcessor`。

由于其他处理器已经看过了，接下来只对FollowerRequestProcessor和SendAckRequestProcessor进行分析。

## FollowerRequestProcessor

```java
@Override
public void run() {
    try {
        while (!finished) {
            Request request = queuedRequests.take();
            if (LOG.isTraceEnabled()) {
                ZooTrace.logRequest(LOG, ZooTrace.CLIENT_REQUEST_TRACE_MASK,
                                    'F', request, "");
            }
            if (request == Request.requestOfDeath) {
                break;
            }
            // We want to queue the request to be processed before we submit
            // the request to the leader so that we are ready to receive
            // the response
            nextProcessor.processRequest(request);

            // We now ship the request to the leader. As with all
            // other quorum operations, sync also follows this code
            // path, but different from others, we need to keep track
            // of the sync operations this follower has pending, so we
            // add it to pendingSyncs.
            switch (request.type) {
            case OpCode.sync:
                zks.pendingSyncs.add(request);
                zks.getFollower().request(request);
                break;
            case OpCode.create:
            case OpCode.delete:
            case OpCode.setData:
            case OpCode.setACL:
            case OpCode.createSession:
            case OpCode.closeSession:
            case OpCode.multi:
                // 转发请求到leader
                zks.getFollower().request(request);
                break;
            }
        }
    } catch (Exception e) {
        LOG.error("Unexpected exception causing exit", e);
    }
    LOG.info("FollowerRequestProcessor exited loop!");
}

public void processRequest(Request request) {
    if (!finished) {
        queuedRequests.add(request);
    }
}
```

FollowerRequestProcessor处理器位于`FollowerRequestProcessor -> CommitProcessor -> FinalRequestProcessor`处理器链的头部，用来处理客户端发送过来的消息。

对于事务请求，follower会转发给leader，其他类型，比如读请求会直接处理响应。

## SendAckRequestProcessor

```java
// SendAckRequestProcessor.java
public void processRequest(Request si) {
    if (si.type != OpCode.sync) {
        QuorumPacket qp = new QuorumPacket(Leader.ACK, si.hdr.getZxid(), null,
                                           null);
        try {
            learner.writePacket(qp, false);
        } catch (IOException e) {
            LOG.warn("Closing connection to leader, exception during packet send", e);
            try {
                if (!learner.sock.isClosed()) {
                    learner.sock.close();
                }
            } catch (IOException e1) {
                // Nothing to do, we are shutting things down, so an exception here is irrelevant
                LOG.debug("Ignoring error closing the connection", e1);
            }
        }
    }
}
```

`SyncRequestProcessor -> SendAckRequestProcessor`处理器链用来处理leader发送过来的proposal请求，由SyncRequestProcessor写入日志文件，然后SendAckRequestProcessor回复一个ACK响应。

# Observer处理器链

```java
// ObserverZooKeeperServer.java
@Override
protected void setupRequestProcessors() {
    // We might consider changing the processor behaviour of
    // Observers to, for example, remove the disk sync requirements.
    // Currently, they behave almost exactly the same as followers.
    RequestProcessor finalProcessor = new FinalRequestProcessor(this);
    commitProcessor = new CommitProcessor(finalProcessor,
                                          Long.toString(getServerId()), true);
    commitProcessor.start();
    firstProcessor = new ObserverRequestProcessor(this, commitProcessor);
    ((ObserverRequestProcessor) firstProcessor).start();
    syncProcessor = new SyncRequestProcessor(this,
            new SendAckRequestProcessor(getObserver()));
    syncProcessor.start();
}
```

从observer处理器链建立过程可以看到，observer处理器链和follower相似，也是分为两条，`ObserverRequestProcessor -> CommitProcessor -> FinalRequestProcessor`，`SyncRequestProcessor -> SendAckRequestProcessor`。

## ObserverRequestProcessor

```java
@Override
public void run() {
    try {
        while (!finished) {
            Request request = queuedRequests.take();
            if (LOG.isTraceEnabled()) {
                ZooTrace.logRequest(LOG, ZooTrace.CLIENT_REQUEST_TRACE_MASK,
                                    'F', request, "");
            }
            if (request == Request.requestOfDeath) {
                break;
            }
            // We want to queue the request to be processed before we submit
            // the request to the leader so that we are ready to receive
            // the response
            nextProcessor.processRequest(request);

            // We now ship the request to the leader. As with all
            // other quorum operations, sync also follows this code
            // path, but different from others, we need to keep track
            // of the sync operations this Observer has pending, so we
            // add it to pendingSyncs.
            switch (request.type) {
            case OpCode.sync:
                zks.pendingSyncs.add(request);
                zks.getObserver().request(request);
                break;
            case OpCode.create:
            case OpCode.delete:
            case OpCode.setData:
            case OpCode.setACL:
            case OpCode.createSession:
            case OpCode.closeSession:
            case OpCode.multi:
                zks.getObserver().request(request);
                break;
            }
        }
    } catch (Exception e) {
        LOG.error("Unexpected exception causing exit", e);
    }
    LOG.info("ObserverRequestProcessor exited loop!");
}
```

此处理器功能也是将事务请求转发给leader，只处理非事务请求。

# 小结

非事务消息处理流程：leader/follower/observer直接处理返回。
事务消息处理流程：

- (follower/observer将请求转发到leader)
- leader记录请求，写proposal日志，发送proposal到所有follower，给自己投一票
- leader收到过半follower ACK，发送COMMIT消息到follower
- leader处理commit请求，检查是否是按照请求顺序commit
- leader+收到COMMIT消息的follwer提交操作到内存数据库
- 发送响应给客户端