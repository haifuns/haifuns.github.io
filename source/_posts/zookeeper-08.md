title: 【ZooKeeper源码】Watcher机制
author: haifun
tags:
  - ZooKeeper
categories:
  - 分布式
date: 2022-04-07 19:35:00

---

本篇将继续上一篇消息处理器链对create消息的处理，分析在最后FinalRequestProcessor中对内存数据库进行数据操作，以及如何实现的watcher回调机制。

# 注册watcher

以客户端执行getData时注册Watcher为例：

## 客户端注册

```java
// ZooKeeper.java
public byte[] getData(final String path, Watcher watcher, Stat stat)
throws KeeperException, InterruptedException {
    final String clientPath = path;
    PathUtils.validatePath(clientPath);

    // the watch contains the un-chroot path
    WatchRegistration wcb = null;
    if (watcher != null) {
        wcb = new DataWatchRegistration(watcher, clientPath);
    }

    final String serverPath = prependChroot(clientPath);

    RequestHeader h = new RequestHeader();
    h.setType(ZooDefs.OpCode.getData);
    GetDataRequest request = new GetDataRequest();
    request.setPath(serverPath);
    request.setWatch(watcher != null);
    GetDataResponse response = new GetDataResponse();
    ReplyHeader r = cnxn.submitRequest(h, request, response, wcb);
    if (r.getErr() != 0) {
        throw KeeperException.create(KeeperException.Code.get(r.getErr()),
                                     clientPath);
    }
    if (stat != null) {
        DataTree.copyStat(response.getStat(), stat);
    }
    return response.getData();
}

// ClientCnxn.SendThread.java
void readResponse(ByteBuffer incomingBuffer) throws IOException {
    ByteBufferInputStream bbis = new ByteBufferInputStream(
        incomingBuffer);
    BinaryInputArchive bbia = BinaryInputArchive.getArchive(bbis);
    ReplyHeader replyHdr = new ReplyHeader();

    // ...

    Packet packet;
    synchronized (pendingQueue) {
        if (pendingQueue.size() == 0) {
            throw new IOException("Nothing in the queue, but got "
                                  + replyHdr.getXid());
        }
        packet = pendingQueue.remove();
    }
    /*
     * Since requests are processed in order, we better get a response
     * to the first request!
     */
    try {
        if (packet.requestHeader.getXid() != replyHdr.getXid()) {
            packet.replyHeader.setErr(
                KeeperException.Code.CONNECTIONLOSS.intValue());
            throw new IOException("Xid out of order. Got Xid "
                                  + replyHdr.getXid() + " with err " +
                                  + replyHdr.getErr() +
                                  " expected Xid "
                                  + packet.requestHeader.getXid()
                                  + " for a packet with details: "
                                  + packet );
        }

        packet.replyHeader.setXid(replyHdr.getXid());
        packet.replyHeader.setErr(replyHdr.getErr());
        packet.replyHeader.setZxid(replyHdr.getZxid());
        if (replyHdr.getZxid() > 0) {
            lastZxid = replyHdr.getZxid();
        }
        if (packet.response != null && replyHdr.getErr() == 0) {
            packet.response.deserialize(bbia, "response");
        }

        if (LOG.isDebugEnabled()) {
            LOG.debug("Reading reply sessionid:0x"
                      + Long.toHexString(sessionId) + ", packet:: " + packet);
        }
    } finally {
        finishPacket(packet);
    }
}

// ClientCnxn.java
private void finishPacket(Packet p) {
    if (p.watchRegistration != null) {
        // 客户端注册监听器
        p.watchRegistration.register(p.replyHeader.getErr());
    }

    if (p.cb == null) {
        synchronized (p) {
            p.finished = true;
            p.notifyAll();
        }
    } else {
        p.finished = true;
        eventThread.queuePacket(p);
    }
}

// ZooKeeper.WatchReginstration.java
public void register(int rc) {
    if (shouldAddWatch(rc)) {
        Map<String, Set<Watcher>> watches = getWatches(rc);
        synchronized (watches) {
            Set<Watcher> watchers = watches.get(clientPath);
            if (watchers == null) {
                watchers = new HashSet<Watcher>();
                watches.put(clientPath, watchers);
            }
            watchers.add(watcher);
        }
    }
}

class DataWatchRegistration extends WatchRegistration {
    public DataWatchRegistration(Watcher watcher, String clientPath) {
        super(watcher, clientPath);
    }

    @Override
    protected Map<String, Set<Watcher>> getWatches(int rc) {
        return watchManager.dataWatches;
    }
}

private static class ZKWatchManager implements ClientWatchManager {
    private final Map<String, Set<Watcher>> dataWatches =
        new HashMap<String, Set<Watcher>>();
    private final Map<String, Set<Watcher>> existWatches =
        new HashMap<String, Set<Watcher>>();
    private final Map<String, Set<Watcher>> childWatches =
        new HashMap<String, Set<Watcher>>();

    private volatile Watcher defaultWatcher;
}
```

从以上代码可知，当客户端在getData的同时注册Watcher时，在收到成功的响应后会把Watcher保存在本地内存Map中。

## 服务端注册

```java
// FinalRequestProcessor.java
public void processRequest(Request request) {
    // ...

    try {
        // ...
        switch (request.type) {
        // ...
        case OpCode.getData: {
            lastOp = "GETD";
            GetDataRequest getDataRequest = new GetDataRequest();
            ByteBufferInputStream.byteBuffer2Record(request.request,
                                                    getDataRequest);
            // 从内存中查询指定路径node
            DataNode n = zks.getZKDatabase().getNode(getDataRequest.getPath());
            if (n == null) {
                throw new KeeperException.NoNodeException();
            }
            Long aclL;
            synchronized (n) {
                aclL = n.acl;
            }
            PrepRequestProcessor.checkACL(zks, zks.getZKDatabase().convertLong(aclL),
                                          ZooDefs.Perms.READ,
                                          request.authInfo);
            Stat stat = new Stat();
            // 获得数据、处理watcher
            byte b[] = zks.getZKDatabase().getData(getDataRequest.getPath(), stat,
                                                   getDataRequest.getWatch() ? cnxn : null);
            rsp = new GetDataResponse(b, stat);
            break;
        }
            // ...
        }
    } catch (Exception e) {
        // ...
    }

    // ...
}

// ZKDatabase.java
public byte[] getData(String path, Stat stat, Watcher watcher)
throws KeeperException.NoNodeException {
    return dataTree.getData(path, stat, watcher);
}

// DataTree.java
public byte[] getData(String path, Stat stat, Watcher watcher)
throws KeeperException.NoNodeException {
    DataNode n = nodes.get(path);
    if (n == null) {
        throw new KeeperException.NoNodeException();
    }
    synchronized (n) {
        n.copyStat(stat);
        if (watcher != null) {
            // 服务端添加watcher
            dataWatches.addWatch(path, watcher);
        }
        return n.data;
    }
}

// WatcherManager.java
private final HashMap<String, HashSet<Watcher>> watchTable = new HashMap<String, HashSet<Watcher>>();
private final HashMap<Watcher, HashSet<String>> watch2Paths = new HashMap<Watcher, HashSet<String>>();
public synchronized void addWatch(String path, Watcher watcher) {
    HashSet<Watcher> list = watchTable.get(path);
    if (list == null) {
        // don't waste memory if there are few watches on a node
        // rehash when the 4th entry is added, doubling size thereafter
        // seems like a good compromise
        list = new HashSet<Watcher>(4);
        watchTable.put(path, list);
    }
    list.add(watcher);

    HashSet<String> paths = watch2Paths.get(watcher);
    if (paths == null) {
        // cnxns typically have many watches, so use default cap here
        paths = new HashSet<String>();
        watch2Paths.put(watcher, paths);
    }
    paths.add(path);
}
```

从以上代码可以看到，当客户端请求创建watcher时，服务端会创建watcher保存在Map结构中，其中key为path。

# 回调watcher

接下来查看Watcher被触发回调的过程，以Create为例，继续分析FinalRequestProcessor对内存数据的处理：

## 服务端回调

```java
// ZooKeeperServer.java
public ProcessTxnResult processTxn(TxnHeader hdr, Record txn) {
    ProcessTxnResult rc;
    int opCode = hdr.getType();
    long sessionId = hdr.getClientId();
    rc = getZKDatabase().processTxn(hdr, txn);
    if (opCode == OpCode.createSession) {
        if (txn instanceof CreateSessionTxn) {
            CreateSessionTxn cst = (CreateSessionTxn) txn;
            sessionTracker.addSession(sessionId, cst
                                      .getTimeOut());
        } else {
            LOG.warn("*****>>>>> Got "
                     + txn.getClass() + " "
                     + txn.toString());
        }
    } else if (opCode == OpCode.closeSession) {
        sessionTracker.removeSession(sessionId);
    }
    return rc;
}

// ZKDatabase.java
public ProcessTxnResult processTxn(TxnHeader hdr, Record txn) {
    return dataTree.processTxn(hdr, txn);
}

// DataTree.java
public ProcessTxnResult processTxn(TxnHeader header, Record txn) {
    ProcessTxnResult rc = new ProcessTxnResult();

    try {
        rc.clientId = header.getClientId();
        rc.cxid = header.getCxid();
        rc.zxid = header.getZxid();
        rc.type = header.getType();
        rc.err = 0;
        rc.multiResult = null;
        switch (header.getType()) {
        case OpCode.create:
            CreateTxn createTxn = (CreateTxn) txn;
            rc.path = createTxn.getPath();
            createNode(
                createTxn.getPath(),
                createTxn.getData(),
                createTxn.getAcl(),
                createTxn.getEphemeral() ? header.getClientId() : 0,
                createTxn.getParentCVersion(),
                header.getZxid(), header.getTime());
            break;
            // ...
        }
    } catch (KeeperException e) {
        if (LOG.isDebugEnabled()) {
            LOG.debug("Failed: " + header + ":" + txn, e);
        }
        rc.err = e.code().intValue();
    } catch (IOException e) {
        if (LOG.isDebugEnabled()) {
            LOG.debug("Failed: " + header + ":" + txn, e);
        }
    }

    // ...
    return rc;
}

public String createNode(String path, byte data[], List<ACL> acl,
                         long ephemeralOwner, int parentCVersion, long zxid, long time)
throws KeeperException.NoNodeException,
    KeeperException.NodeExistsException {
    int lastSlash = path.lastIndexOf('/');
    String parentName = path.substring(0, lastSlash);
    String childName = path.substring(lastSlash + 1);
    StatPersisted stat = new StatPersisted();
    stat.setCtime(time);
    stat.setMtime(time);
    stat.setCzxid(zxid);
    stat.setMzxid(zxid);
    stat.setPzxid(zxid);
    stat.setVersion(0);
    stat.setAversion(0);
    stat.setEphemeralOwner(ephemeralOwner);
    DataNode parent = nodes.get(parentName);
    if (parent == null) {
        throw new KeeperException.NoNodeException();
    }
    synchronized (parent) {
        Set<String> children = parent.getChildren();
        if (children != null) {
            if (children.contains(childName)) {
                throw new KeeperException.NodeExistsException();
            }
        }

        if (parentCVersion == -1) {
            parentCVersion = parent.stat.getCversion();
            parentCVersion++;
        }
        parent.stat.setCversion(parentCVersion);
        parent.stat.setPzxid(zxid);
        Long longval = convertAcls(acl);
        DataNode child = new DataNode(parent, data, longval, stat);
        // 添加到父节点下
        parent.addChild(childName);
        nodes.put(path, child);
        if (ephemeralOwner != 0) {
            HashSet<String> list = ephemerals.get(ephemeralOwner);
            if (list == null) {
                list = new HashSet<String>();
                ephemerals.put(ephemeralOwner, list);
            }
            synchronized (list) {
                list.add(path);
            }
        }
    }
    // now check if its one of the zookeeper node child
    if (parentName.startsWith(quotaZookeeper)) {
        // now check if its the limit node
        if (Quotas.limitNode.equals(childName)) {
            // this is the limit node
            // get the parent and add it to the trie
            pTrie.addPath(parentName.substring(quotaZookeeper.length()));
        }
        if (Quotas.statNode.equals(childName)) {
            updateQuotaForPath(parentName
                               .substring(quotaZookeeper.length()));
        }
    }
    // also check to update the quotas for this node
    String lastPrefix;
    if ((lastPrefix = getMaxPrefixWithQuota(path)) != null) {
        // ok we have some match and need to update
        updateCount(lastPrefix, 1);
        updateBytes(lastPrefix, data == null ? 0 : data.length);
    }

    // znode发生变化后, 触发当前节点以及父节点上的watcher监听器
    dataWatches.triggerWatch(path, Event.EventType.NodeCreated);
    childWatches.triggerWatch(parentName.equals("") ? "/" : parentName,
                              Event.EventType.NodeChildrenChanged);
    return path;
}

// WatcherManager.java
public Set<Watcher> triggerWatch(String path, EventType type) {
    return triggerWatch(path, type, null);
}

public Set<Watcher> triggerWatch(String path, EventType type, Set<Watcher> supress) {
    WatchedEvent e = new WatchedEvent(type,
                                      KeeperState.SyncConnected, path);
    HashSet<Watcher> watchers;
    synchronized (this) {
        // 触发watcher后, 服务端直接删除此节点上的所有watcher
        watchers = watchTable.remove(path);
        if (watchers == null || watchers.isEmpty()) {
            if (LOG.isTraceEnabled()) {
                ZooTrace.logTraceMessage(LOG,
                                         ZooTrace.EVENT_DELIVERY_TRACE_MASK,
                                         "No watchers for " + path);
            }
            return null;
        }
        for (Watcher w : watchers) {
            HashSet<String> paths = watch2Paths.get(w);
            if (paths != null) {
                paths.remove(path);
            }
        }
    }
    for (Watcher w : watchers) {
        if (supress != null && supress.contains(w)) {
            continue;
        }
        w.process(e);
    }
    return watchers;
}

// NIOServerCnxn.java
@Override
synchronized public void process(WatchedEvent event) {
    ReplyHeader h = new ReplyHeader(-1, -1L, 0);
    if (LOG.isTraceEnabled()) {
        ZooTrace.logTraceMessage(LOG, ZooTrace.EVENT_DELIVERY_TRACE_MASK,
                                 "Deliver event " + event + " to 0x"
                                 + Long.toHexString(this.sessionId)
                                 + " through " + this);
    }

    // Convert WatchedEvent to a type that can be sent over the wire
    WatcherEvent e = event.getWrapper();

    // 发送监听器事件到客户端
    sendResponse(h, e, "notification");
}

@Override
synchronized public void sendResponse(ReplyHeader h, Record r, String tag) {
    try {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        // Make space for length
        BinaryOutputArchive bos = BinaryOutputArchive.getArchive(baos);
        try {
            baos.write(fourBytes);
            bos.writeRecord(h, "header");
            if (r != null) {
                bos.writeRecord(r, tag);
            }
            baos.close();
        } catch (IOException e) {
            LOG.error("Error serializing response");
        }
        byte b[] = baos.toByteArray();
        ByteBuffer bb = ByteBuffer.wrap(b);
        bb.putInt(b.length - 4).rewind();
        sendBuffer(bb);
        if (h.getXid() > 0) {
            synchronized (this) {
                outstandingRequests--;
            }
            // check throttling
            synchronized (this.factory) {
                if (zkServer.getInProcess() < outstandingLimit
                        || outstandingRequests < 1) {
                    sk.selector().wakeup();
                    enableRecv();
                }
            }
        }
    } catch (Exception e) {
        LOG.warn("Unexpected exception. Destruction averted.", e);
    }
}
```

可以看到，在create时，构建了一个DataNode节点放到父节点下，然后删除并触发父节点和当前节点的Watcher事件，发送监听器事件到客户端。

## 客户端处理

```java
// ClientCnxn.SendThread.java
void readResponse(ByteBuffer incomingBuffer) throws IOException {
    // ...
    if (replyHdr.getXid() == -1) {
        // -1 means notification
        if (LOG.isDebugEnabled()) {
            LOG.debug("Got notification sessionid:0x"
                      + Long.toHexString(sessionId));
        }

        // 收到事件通知
        WatcherEvent event = new WatcherEvent();
        event.deserialize(bbia, "response");

        // convert from a server path to a client path
        if (chrootPath != null) {
            String serverPath = event.getPath();
            if (serverPath.compareTo(chrootPath) == 0)
                event.setPath("/");
            else if (serverPath.length() > chrootPath.length())
                event.setPath(serverPath.substring(chrootPath.length()));
            else {
                LOG.warn("Got server path " + event.getPath()
                         + " which is too short for chroot path "
                         + chrootPath);
            }
        }

        WatchedEvent we = new WatchedEvent(event);
        if (LOG.isDebugEnabled()) {
            LOG.debug("Got " + we + " for sessionid 0x"
                      + Long.toHexString(sessionId));
        }

        eventThread.queueEvent( we );
        return;
    }

    // ...
}

// ClientCnxn.EventThread.java
private final LinkedBlockingQueue<Object> waitingEvents = new LinkedBlockingQueue<Object>();
public void queueEvent(WatchedEvent event) {
    if (event.getType() == EventType.None
            && sessionState == event.getState()) {
        return;
    }
    sessionState = event.getState();

    // materialize the watchers based on the event
    WatcherSetEventPair pair = new WatcherSetEventPair(
        watcher.materialize(event.getState(), event.getType(),
                            event.getPath()),
        event);
    // queue the pair (watch set & event) for later processing
    waitingEvents.add(pair);
}

@Override
public void run() {
    try {
        isRunning = true;
        while (true) {
            Object event = waitingEvents.take();
            if (event == eventOfDeath) {
                wasKilled = true;
            } else {
                // 处理watcher事件
                processEvent(event);
            }
            if (wasKilled)
                synchronized (waitingEvents) {
                    if (waitingEvents.isEmpty()) {
                        isRunning = false;
                        break;
                    }
                }
        }
    } catch (InterruptedException e) {
        LOG.error("Event thread exiting due to interruption", e);
    }

    LOG.info("EventThread shut down");
}

private void processEvent(Object event) {
    try {
        if (event instanceof WatcherSetEventPair) {
            // each watcher will process the event
            WatcherSetEventPair pair = (WatcherSetEventPair) event;
            for (Watcher watcher : pair.watchers) {
                try {
                    // 回调客户端注册的监听器
                    watcher.process(pair.event);
                } catch (Throwable t) {
                    LOG.error("Error while calling watcher ", t);
                }
            }
        } else {
            // ...
        }
    } catch (Throwable t) {
        LOG.error("Caught unexpected throwable", t);
    }
}

// ZooKeeper.ZKWatchManager.java
@Override
public Set<Watcher> materialize(Watcher.Event.KeeperState state,
                                Watcher.Event.EventType type,
                                String clientPath) {
    Set<Watcher> result = new HashSet<Watcher>();

    switch (type) {
    case None:
        result.add(defaultWatcher);
        boolean clear = ClientCnxn.getDisableAutoResetWatch() &&
                        state != Watcher.Event.KeeperState.SyncConnected;

        synchronized (dataWatches) {
            for (Set<Watcher> ws : dataWatches.values()) {
                result.addAll(ws);
            }
            if (clear) {
                dataWatches.clear();
            }
        }

        synchronized (existWatches) {
            for (Set<Watcher> ws : existWatches.values()) {
                result.addAll(ws);
            }
            if (clear) {
                existWatches.clear();
            }
        }

        synchronized (childWatches) {
            for (Set<Watcher> ws : childWatches.values()) {
                result.addAll(ws);
            }
            if (clear) {
                childWatches.clear();
            }
        }

        return result;
    case NodeDataChanged:
    case NodeCreated:
        synchronized (dataWatches) {
            addTo(dataWatches.remove(clientPath), result);
        }
        synchronized (existWatches) {
            addTo(existWatches.remove(clientPath), result);
        }
        break;
    case NodeChildrenChanged:
        synchronized (childWatches) {
            addTo(childWatches.remove(clientPath), result);
        }
        break;
    case NodeDeleted:
        synchronized (dataWatches) {
            addTo(dataWatches.remove(clientPath), result);
        }
        // XXX This shouldn't be needed, but just in case
        synchronized (existWatches) {
            Set<Watcher> list = existWatches.remove(clientPath);
            if (list != null) {
                addTo(existWatches.remove(clientPath), result);
                LOG.warn("We are triggering an exists watch for delete! Shouldn't happen!");
            }
        }
        synchronized (childWatches) {
            addTo(childWatches.remove(clientPath), result);
        }
        break;
    default:
        String msg = "Unhandled watch event type " + type
                     + " with state " + state + " on path " + clientPath;
        LOG.error(msg);
        throw new RuntimeException(msg);
    }

    return result;
}
```

从以上代码可以看到，当watcher回调消息到达客户端时，首先会从内存中找到对应的watcher，然后把消息写入内存队列中，由单独的线程依次从队列中获取消息，回调watcher处理逻辑。

# 小结

- watcher注册过程：当客户端发起请求注册watcher时，服务端会将watcher保存到内存Map中，key为path，value为watcher集合，客户端收到处理成功响应后也会将watcher放到本地内存中等待回调。
- watcher触发回调：当服务端数据变化时，会触发所有path对应的watcher，向客户端发送回调消息。客户端收到回调消息后，首先会找到path对应的watcher，然后执行watcher回调处理。