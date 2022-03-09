title: 【ZooKeeper源码】Session管理机制
author: haifun
tags:
  - ZooKeeper
categories:
  - 分布式
date: 2022-03-09 20:05:00

---

从前篇中我们已经了解了客户端与ZK服务端底层socket连接的建立过程，此时服务端还不能直接处理客户端发送过来的业务操作消息，因为会话还没有建立。在连接建立完成时客户端立即发送一条ConnectRequest请求，服务端收到消息后首先会建立会话，接下来我们将深入分析ZK中的session管理机制。

# Session建立

```java
// NIOServerCnxnFactory.java
public void run() {
    while (!ss.socket().isClosed()) {
        try {
            // 阻塞等待, 监听客户端网络连接
            selector.select(1000);
            Set<SelectionKey> selected;
            synchronized (this) {
                selected = selector.selectedKeys();
            }
            ArrayList<SelectionKey> selectedList = new ArrayList<SelectionKey>(
                selected);
            // 保证不同客户端请求是随机处理的
            Collections.shuffle(selectedList);
            for (SelectionKey k : selectedList) {
                if ((k.readyOps() & SelectionKey.OP_ACCEPT) != 0) {
                    // 处理客户端连接请求
                    // ...
                } else if ((k.readyOps() & (SelectionKey.OP_READ | SelectionKey.OP_WRITE)) != 0) {
                    // 处理客户端读写请求
                    NIOServerCnxn c = (NIOServerCnxn) k.attachment();
                    c.doIO(k);
                } else {
                    if (LOG.isDebugEnabled()) {
                        LOG.debug("Unexpected ops in select "
                                  + k.readyOps());
                    }
                }
            }
            selected.clear();
        } catch (RuntimeException e) {
            LOG.warn("Ignoring unexpected runtime exception", e);
        } catch (Exception e) {
            LOG.warn("Ignoring exception", e);
        }
    }
    closeAll();
    LOG.info("NIOServerCnxn factory exited run method");
}

// NIOServerCnxn.java
void doIO(SelectionKey k) throws InterruptedException {
    try {
        if (sock == null) {
            LOG.warn("trying to do i/o on a null socket for session:0x"
                     + Long.toHexString(sessionId));

            return;
        }
        if (k.isReadable()) {
            // 首先读取4个字节
            int rc = sock.read(incomingBuffer);
            if (rc < 0) {
                throw new EndOfStreamException(
                    "Unable to read additional data from client sessionid 0x"
                    + Long.toHexString(sessionId)
                    + ", likely client has closed socket");
            }
            // 如果读取到4个字节, 当前请求长度
            if (incomingBuffer.remaining() == 0) {
                boolean isPayload;
                if (incomingBuffer == lenBuffer) { // start of next request
                    incomingBuffer.flip();
                    isPayload = readLength(k); // 根据请求长度创建Buffer
                    incomingBuffer.clear();
                } else {
                    // continuation
                    isPayload = true;
                }
                if (isPayload) { // not the case for 4letterword
                    // 开始正式从socket中读取数据
                    readPayload();
                } else {
                    // four letter words take care
                    // need not do anything else
                    return;
                }
            }
        }
        if (k.isWritable()) {
            // ...
        }
    } catch (Exception e) {
        // ...
        close();
    }
}

private void readPayload() throws IOException, InterruptedException {
    // 每个连接都对应一个incomingBuffer, 如果一个请求出现拆包, 在下次OP_READ事件时继续读取到incomingBuffer中
    if (incomingBuffer.remaining() != 0) { // have we read length bytes?
        int rc = sock.read(incomingBuffer); // sock is non-blocking, so ok
        if (rc < 0) {
            throw new EndOfStreamException(
                "Unable to read additional data from client sessionid 0x"
                + Long.toHexString(sessionId)
                + ", likely client has closed socket");
        }
    }

    // 如果读取完毕
    if (incomingBuffer.remaining() == 0) { // have we read length bytes?
        packetReceived();
        incomingBuffer.flip();
        if (!initialized) {
            // 如果没有完成session初始化, 此时读取到的第一个请求一定是ConnectRequest
            readConnectRequest();
        } else {
            readRequest();
        }
        lenBuffer.clear();
        incomingBuffer = lenBuffer;
    }
}

private void readConnectRequest() throws IOException, InterruptedException {
    if (zkServer == null) {
        throw new IOException("ZooKeeperServer not running");
    }
    zkServer.processConnectRequest(this, incomingBuffer);
    initialized = true;
}

// ZooKeeperServer.java
public void processConnectRequest(ServerCnxn cnxn, ByteBuffer incomingBuffer) throws IOException {
    BinaryInputArchive bia = BinaryInputArchive.getArchive(new ByteBufferInputStream(incomingBuffer));
    // Jute协议反序列化连接请求
    ConnectRequest connReq = new ConnectRequest();
    connReq.deserialize(bia, "connect");
    if (LOG.isDebugEnabled()) {
        LOG.debug("Session establishment request from client "
                  + cnxn.getRemoteSocketAddress()
                  + " client's lastZxid is 0x"
                  + Long.toHexString(connReq.getLastZxidSeen()));
    }
    boolean readOnly = false;
    try {
        readOnly = bia.readBool("readOnly");
        cnxn.isOldClient = false;
    } catch (IOException e) {
        // this is ok -- just a packet from an old client which
        // doesn't contain readOnly field
        LOG.warn("Connection request from old client "
                 + cnxn.getRemoteSocketAddress()
                 + "; will be dropped if server is in r-o mode");
    }
    if (readOnly == false && this instanceof ReadOnlyZooKeeperServer) {
        String msg = "Refusing session request for not-read-only client "
                     + cnxn.getRemoteSocketAddress();
        LOG.info(msg);
        throw new CloseRequestException(msg);
    }
    if (connReq.getLastZxidSeen() > zkDb.dataTree.lastProcessedZxid) {
        String msg = "Refusing session request for client "
                     + cnxn.getRemoteSocketAddress()
                     + " as it has seen zxid 0x"
                     + Long.toHexString(connReq.getLastZxidSeen())
                     + " our last zxid is 0x"
                     + Long.toHexString(getZKDatabase().getDataTreeLastProcessedZxid())
                     + " client must try another server";

        LOG.info(msg);
        throw new CloseRequestException(msg);
    }
    int sessionTimeout = connReq.getTimeOut();
    byte passwd[] = connReq.getPasswd();
    int minSessionTimeout = getMinSessionTimeout();
    if (sessionTimeout < minSessionTimeout) {
        sessionTimeout = minSessionTimeout;
    }
    int maxSessionTimeout = getMaxSessionTimeout();
    if (sessionTimeout > maxSessionTimeout) {
        sessionTimeout = maxSessionTimeout;
    }
    cnxn.setSessionTimeout(sessionTimeout);
    // We don't want to receive any packets until we are sure that the
    // session is setup
    cnxn.disableRecv();
    long sessionId = connReq.getSessionId();
    if (sessionId != 0) {
        long clientSessionId = connReq.getSessionId();
        LOG.info("Client attempting to renew session 0x"
                 + Long.toHexString(clientSessionId)
                 + " at " + cnxn.getRemoteSocketAddress());
        serverCnxnFactory.closeSession(sessionId);
        cnxn.setSessionId(sessionId);
        reopenSession(cnxn, sessionId, passwd, sessionTimeout);
    } else {
        LOG.info("Client attempting to establish new session at "
                 + cnxn.getRemoteSocketAddress());

        // 第一次创建请求时sessionId为空, 开始创建session
        createSession(cnxn, passwd, sessionTimeout);
    }
}

long createSession(ServerCnxn cnxn, byte passwd[], int timeout) {
    // 生成sessionId
    long sessionId = sessionTracker.createSession(timeout);
    // 生成密码
    Random r = new Random(sessionId ^ superSecret);
    r.nextBytes(passwd);
    ByteBuffer to = ByteBuffer.allocate(4);
    to.putInt(timeout);
    cnxn.setSessionId(sessionId);
    submitRequest(cnxn, sessionId, OpCode.createSession, 0, to, null);
    return sessionId;
}

private void submitRequest(ServerCnxn cnxn, long sessionId, int type,
                           int xid, ByteBuffer bb, List<Id> authInfo) {
    Request si = new Request(cnxn, sessionId, xid, type, bb, authInfo);
    submitRequest(si);
}

public void submitRequest(Request si) {
    if (firstProcessor == null) {
        synchronized (this) {
            try {
                while (!running) {
                    wait(1000);
                }
            } catch (InterruptedException e) {
                LOG.warn("Unexpected interruption", e);
            }
            if (firstProcessor == null) {
                throw new RuntimeException("Not started");
            }
        }
    }
    try {
        // 更新session过期时间, 重新分桶
        touch(si.cnxn);
        boolean validpacket = Request.isValid(si.type);
        if (validpacket) {
            firstProcessor.processRequest(si);
            if (si.cnxn != null) {
                incInProcess();
            }
        } else {
            LOG.warn("Dropping packet at server of type " + si.type);
            // if invalid packet drop the packet.
        }
    } catch (MissingSessionException e) {
        if (LOG.isDebugEnabled()) {
            LOG.debug("Dropping request: " + e.getMessage());
        }
    } catch (RequestProcessorException e) {
        LOG.error("Unable to process request:" + e.getMessage(), e);
    }
}

void touch(ServerCnxn cnxn) throws MissingSessionException {
    if (cnxn == null) {
        return;
    }
    long id = cnxn.getSessionId();
    int to = cnxn.getSessionTimeout();
    if (!sessionTracker.touchSession(id, to)) {
        throw new MissingSessionException(
            "No session with sessionid 0x" + Long.toHexString(id)
            + " exists, probably expired and removed");
    }
}

// SessionTrackerImpl.java
synchronized public long createSession(int sessionTimeout) {
    addSession(nextSessionId, sessionTimeout);
    return nextSessionId++;
}

synchronized public void addSession(long id, int sessionTimeout) {
    sessionsWithTimeout.put(id, sessionTimeout);
    if (sessionsById.get(id) == null) {
        SessionImpl s = new SessionImpl(id, sessionTimeout, 0);
        sessionsById.put(id, s);
        if (LOG.isTraceEnabled()) {
            ZooTrace.logTraceMessage(LOG, ZooTrace.SESSION_TRACE_MASK,
                                     "SessionTrackerImpl --- Adding session 0x"
                                     + Long.toHexString(id) + " " + sessionTimeout);
        }
    } else {
        if (LOG.isTraceEnabled()) {
            ZooTrace.logTraceMessage(LOG, ZooTrace.SESSION_TRACE_MASK,
                                     "SessionTrackerImpl --- Existing session 0x"
                                     + Long.toHexString(id) + " " + sessionTimeout);
        }
    }
    touchSession(id, sessionTimeout);
}
```

从以上代码可以看到，服务端在接收到读事件时，首先会从消息中读取前4个字节，前4个字节表示消息长度，然后读取相应长度的字节。读取完字节消息后，判断当前连接是否已经完成初始化，如果没有完成初始化，那么当前消息是客户端发送过来的第一条请求ConnecReauest。接着把消息反序列化为ConnecRequest对象，从中取出sessionId，如果为空或者是0，就新建一个session，然后保存。

这里session的创建可以看到是为sessionId创建了一个对应的SessionImpl结构存放在map中，把sessionId返回了。另外可以看到在后续消息处理时，都会进行touchSession操作，然后把消息交给处理器链。

对于sessionId是如何生成的以及touchSession操作是在干什么本篇下文将继续分析，对于处理器链处理消息本篇暂时不涉及。

# SessionId生成

```java
// ZooKeeperServer.java
public void startup() {
    if (sessionTracker == null) {
        createSessionTracker();
    }
    // 启动session管理组件
    startSessionTracker();
    setupRequestProcessors();

    // ...
}

protected void createSessionTracker() {
    sessionTracker = new SessionTrackerImpl(this, zkDb.getSessionWithTimeOuts(),
                                            tickTime, 1);
}

// SessionTrackerImpl.java
public SessionTrackerImpl(SessionExpirer expirer,
                          ConcurrentHashMap<Long, Integer> sessionsWithTimeout, int tickTime,
                          long sid) {
    super("SessionTracker");
    this.expirer = expirer;
    this.expirationInterval = tickTime;
    this.sessionsWithTimeout = sessionsWithTimeout;
    nextExpirationTime = roundToInterval(System.currentTimeMillis());
    this.nextSessionId = initializeNextSession(sid);
    for (Entry<Long, Integer> e : sessionsWithTimeout.entrySet()) {
        addSession(e.getKey(), e.getValue());
    }
}

public static long initializeNextSession(long id) {
    long nextSid = 0;
    // 时间戳41位, 左移24位后, **由于long最大63位**, 所以低24位是0, 高39位表示时间戳, 前两位丢失
    // 右移8位后, 高8位是0, 中间39位是时间戳, 低16位是0
    nextSid = (System.currentTimeMillis() << 24) >> 8;
    // 高7位表示serverId, 低56是0
    // 或操作之后, 高7位表示serverId, 固定1位0, 中间39位是时间戳, 低16位是0
    nextSid =  nextSid | (id << 56);
    return nextSid;
}
```

从以上代码可以看到，当ZooKeeperServer启动时会创建一个会话跟踪器sessionTracker，初始化好nextSessionId（高7位表示serverId, 固定1位0, 中间39位是时间戳, 低16位是0），在需要创建session时直接使用nextSessionId，然后让其加1，下次需要创建session时就可以直接使用。

# Session分桶

接下来分析一下touchSession操作，相关代码如下：

```java
// SessionTrackerImpl.java
HashMap<Long, SessionImpl> sessionsById = new HashMap<Long, SessionImpl>();

HashMap<Long, SessionSet> sessionSets = new HashMap<Long, SessionSet>();

static class SessionSet {
    HashSet<SessionImpl> sessions = new HashSet<SessionImpl>();
}

private long roundToInterval(long time) {
    // We give a one interval grace period
    // 过期时间是expirationInterval的倍数
    return (time / expirationInterval + 1) * expirationInterval;
}

synchronized public boolean touchSession(long sessionId, int timeout) {
    if (LOG.isTraceEnabled()) {
        ZooTrace.logTraceMessage(LOG,
                                 ZooTrace.CLIENT_PING_TRACE_MASK,
                                 "SessionTrackerImpl --- Touch session: 0x"
                                 + Long.toHexString(sessionId) + " with timeout " + timeout);
    }
    SessionImpl s = sessionsById.get(sessionId);
    // Return false, if the session doesn't exists or marked as closing
    if (s == null || s.isClosing()) {
        return false;
    }
    // session下一次的过期时间
    long expireTime = roundToInterval(System.currentTimeMillis() + timeout);
    if (s.tickTime >= expireTime) {
        // Nothing needs to be done
        return true;
    }

    // session分桶处理, expireTime -> SessionSet
    SessionSet set = sessionSets.get(s.tickTime);
    if (set != null) {
        set.sessions.remove(s);
    }
    s.tickTime = expireTime;
    set = sessionSets.get(s.tickTime);
    if (set == null) {
        set = new SessionSet();
        sessionSets.put(expireTime, set);
    }
    set.sessions.add(s);
    return true;
}
```

从以上代码可以看到，在服务端session是分桶存储的，每个轮次的过期时间对应着这个时间过期的session集合，当每次接收到客户端消息时，都会更新一下session在桶中的位置。

# 心跳

在连接正常建立之后，客户端会每隔一段时间向服务端发送Ping消息，相关代码如下：

```java
// ClientCnnx.SendThread.java
public void run() {
    clientCnxnSocket.introduce(this, sessionId);
    clientCnxnSocket.updateNow();
    clientCnxnSocket.updateLastSendAndHeard();
    int to;
    long lastPingRwServer = System.currentTimeMillis();
    while (state.isAlive()) {
        try {
            if (!clientCnxnSocket.isConnected()) {
                if (!isFirstConnect) {
                    try {
                        Thread.sleep(r.nextInt(1000));
                    } catch (InterruptedException e) {
                        LOG.warn("Unexpected exception", e);
                    }
                }
                // don't re-establish connection if we are closing
                if (closing || !state.isAlive()) {
                    break;
                }
                // 与zk服务端建立长连接
                startConnect();
                clientCnxnSocket.updateLastSendAndHeard();
            }

            //...

            if (state.isConnected()) {
                // readTimeout - (当前时间 - 上次发送消息时间)
                int timeToNextPing = readTimeout / 2
                                     - clientCnxnSocket.getIdleSend();
                if (timeToNextPing <= 0) {
                    // 发送ping消息
                    sendPing();
                    clientCnxnSocket.updateLastSend();
                } else {
                    if (timeToNextPing < to) {
                        to = timeToNextPing;
                    }
                }
            }

            // 发送数据
            clientCnxnSocket.doTransport(to, pendingQueue, outgoingQueue, ClientCnxn.this);
        } catch (Throwable e) {
            // ...
        }
    }
    cleanup();
    clientCnxnSocket.close();
    if (state.isAlive()) {
        eventThread.queueEvent(new WatchedEvent(Event.EventType.None,
                                                Event.KeeperState.Disconnected, null));
    }
    ZooTrace.logTraceMessage(LOG, ZooTrace.getTextTraceLevel(),
                             "SendThread exitedloop.");
}

private void sendPing() {
    lastPingSentNs = System.nanoTime();
    RequestHeader h = new RequestHeader(-2, OpCode.ping);
    queuePacket(h, null, null, null, null, null, null, null, null);
}
```

从以上代码可知，客户端每隔固定时间都会向服务端发送一条Ping消息，而从前面分析可知，服务端在收到Ping消息会进行touchSession操作刷新session过期时间。

# 定时清理

当客户端超过过期时间没有过心跳，服务端会删除session断开连接，代码如下：

```java
// SessionTrackerImpl.java
synchronized public void run() {
    try {
        while (running) {
            currentTime = System.currentTimeMillis();
            if (nextExpirationTime > currentTime) {
                this.wait(nextExpirationTime - currentTime);
                continue;
            }
            SessionSet set;
            // 移除已经过期的session分桶
            set = sessionSets.remove(nextExpirationTime);
            if (set != null) {
                for (SessionImpl s : set.sessions) {
                    setSessionClosing(s.sessionId);
                    expirer.expire(s);
                }
            }
            // 更新下次过期时间
            nextExpirationTime += expirationInterval;
        }
    } catch (InterruptedException e) {
        LOG.error("Unexpected interruption", e);
    }
    LOG.info("SessionTrackerImpl exited loop!");
}

public void expire(Session session) {
    long sessionId = session.getSessionId();
    LOG.info("Expiring session 0x" + Long.toHexString(sessionId)
             + ", timeout of " + session.getTimeout() + "ms exceeded");
    close(sessionId);
}
```

# 小结

在客户端与服务端的底层socket连接建立成功后，客户端会立即发送一条ConnectRequest消息，服务端收到这条消息后会为其创建session，其中sessionId包含serverId、时间戳、计数器三部分保证唯一性。session在服务端按照过期时间分桶存储，每当客户端发送过来消息，服务端都会判断session过期时间是否进入下一轮，如果已经进入下一轮就更新session在桶中的位置，即更新session过期时间。客户端会定期向服务端发送Ping消息，同时服务端会定期清理达到过期时间的session桶。