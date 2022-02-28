title: 【ZooKeeper源码】客户端通信
author: haifun
tags:
  - ZooKeeper
categories:
  - 分布式
date: 2022-02-28 19:35:00

---

本篇用来分析客户端与服务端底层连接建立的过程，首先回忆一下ZKServer启动过程中已经开始监听客户端请求的server socket，然后分析一下客户端启动过程中client socket创建过程。

# 服务端

在前几篇分析中，我们已经看过了server socket启动的部分代码，QuorumPeer初始化过程创建了一个网络连接工厂ServerCnxnFactory，默认情况下是基于NIO的NIOServerCnxnFactory，在QuorumPeer start过程中cnxnFactory也伴随着start，也就是此时server socket开始监听处理客户端请求。相关代码如下：

```java
// QuorumPeerMain.java
public void runFromConfig(QuorumPeerConfig config) throws IOException {

  // ...
  try {
    // 网络连接工厂, 默认使用NIO, NIOServerCnxnFactory
    ServerCnxnFactory cnxnFactory = ServerCnxnFactory.createFactory();
    cnxnFactory.configure(config.getClientPortAddress(),
                          config.getMaxClientCnxns());

    // quorumPeer代表一个zk节点
    quorumPeer = new QuorumPeer();
    quorumPeer.setClientPortAddress(config.getClientPortAddress());
    // ...
    quorumPeer.setCnxnFactory(cnxnFactory);
    // ...

    quorumPeer.start();
    quorumPeer.join();
  } catch (InterruptedException e) {
    // warn, but generally this is ok
    LOG.warn("Quorum Peer interrupted", e);
  }
}

// QuorumPeer.java
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

public class NIOServerCnxnFactory extends ServerCnxnFactory implements Runnable {

  ServerSocketChannel ss;

  final Selector selector = Selector.open(); // 多路复用组件

  // ...

  Thread thread;

  @Override
  public void configure(InetSocketAddress addr, int maxcc) throws IOException {
    configureSaslLogin();

    thread = new Thread(this, "NIOServerCxn.Factory:" + addr);
    thread.setDaemon(true);
    maxClientCnxns = maxcc;
    this.ss = ServerSocketChannel.open();
    ss.socket().setReuseAddress(true);
    LOG.info("binding to port " + addr);
    ss.socket().bind(addr);
    ss.configureBlocking(false);
    ss.register(selector, SelectionKey.OP_ACCEPT);
  }

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
            SocketChannel sc = ((ServerSocketChannel) k
                                .channel()).accept();
            InetAddress ia = sc.socket().getInetAddress();
            int cnxncount = getClientCnxnCount(ia);
            if (maxClientCnxns > 0 && cnxncount >= maxClientCnxns) {
              LOG.warn("Too many connections from " + ia
                       + " - max is " + maxClientCnxns );
              sc.close();
            } else {
              LOG.info("Accepted socket connection from "
                       + sc.socket().getRemoteSocketAddress());
              sc.configureBlocking(false);
              SelectionKey sk = sc.register(selector,
                                            SelectionKey.OP_READ);
              NIOServerCnxn cnxn = createConnection(sc, sk);
              sk.attach(cnxn);
              addCnxn(cnxn);
            }
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
}
```

# 客户端

ZooKeeper类是客户端库的主类，是客户端的入口，这里从其常用的构造方法入手进行分析。

```java
// ZooKeeper.java
public ZooKeeper(String connectString, int sessionTimeout, Watcher watcher) throws IOException {
    this(connectString, sessionTimeout, watcher, false);
}

public ZooKeeper(String connectString, int sessionTimeout, Watcher watcher,
                 boolean canBeReadOnly) throws IOException {
    LOG.info("Initiating client connection, connectString=" + connectString
             + " sessionTimeout=" + sessionTimeout + " watcher=" + watcher);

    watchManager.defaultWatcher = watcher;

    // 解析zk机器列表
    ConnectStringParser connectStringParser = new ConnectStringParser(
        connectString);
    // 可以循环随机选择一个zk机器返回
    HostProvider hostProvider = new StaticHostProvider(
        connectStringParser.getServerAddresses());

    // 核心组件ClientCnxn, 与服务端通信
    cnxn = new ClientCnxn(connectStringParser.getChrootPath(),
                          hostProvider, sessionTimeout, this, watchManager,
                          getClientCnxnSocket(), canBeReadOnly);
    cnxn.start();
}


// ClientCnxn.java
public void start() {
    sendThread.start();
    eventThread.start();
}

// SendThread.java
class SendThread extends Thread {
    private final ClientCnxnSocket clientCnxnSocket;

    // ...
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

                // ...
                // 后续操作暂时不看
            } catch (Throwable e) {
                // ...
            }
        }
        // ...
    }

    private void startConnect() throws IOException {
        state = States.CONNECTING;

        InetSocketAddress addr;
        if (rwServerAddress != null) {
            addr = rwServerAddress;
            rwServerAddress = null;
        } else {
            addr = hostProvider.next(1000);
        }

        setName(getName().replaceAll("\\(.*\\)",
                                     "(" + addr.getHostName() + ":" + addr.getPort() + ")"));
        try {
            zooKeeperSaslClient = new ZooKeeperSaslClient("zookeeper/" + addr.getHostName());
        } catch (LoginException e) {
            // An authentication error occurred when the SASL client tried to initialize:
            // for Kerberos this means that the client failed to authenticate with the KDC.
            // This is different from an authentication error that occurs during communication
            // with the Zookeeper server, which is handled below.
            LOG.warn("SASL configuration failed: " + e + " Will continue connection to Zookeeper server without "
                     + "SASL authentication, if Zookeeper server allows it.");
            eventThread.queueEvent(new WatchedEvent(
                                       Watcher.Event.EventType.None,
                                       Watcher.Event.KeeperState.AuthFailed, null));
            saslLoginFailed = true;
        }
        logStartConnect(addr);

        clientCnxnSocket.connect(addr);
    }

    void primeConnection() throws IOException {
        LOG.info("Socket connection established to "
                 + clientCnxnSocket.getRemoteSocketAddress()
                 + ", initiating session");
        isFirstConnect = false;
        long sessId = (seenRwServerBefore) ? sessionId : 0;
        ConnectRequest conReq = new ConnectRequest(0, lastZxid,
                sessionTimeout, sessId, sessionPasswd);
        synchronized (outgoingQueue) {
            // We add backwards since we are pushing into the front
            // Only send if there's a pending watch
            // TODO: here we have the only remaining use of zooKeeper in
            // this class. It's to be eliminated!
            if (!disableAutoWatchReset) {
                // 监听znode数据变化
                List<String> dataWatches = zooKeeper.getDataWatches();
                // 监听znode是否存在
                List<String> existWatches = zooKeeper.getExistWatches();
                // 监听znode下子节点的变化
                List<String> childWatches = zooKeeper.getChildWatches();
                if (!dataWatches.isEmpty()
                        || !existWatches.isEmpty() || !childWatches.isEmpty()) {
                    SetWatches sw = new SetWatches(lastZxid,
                                                   prependChroot(dataWatches),
                                                   prependChroot(existWatches),
                                                   prependChroot(childWatches));
                    RequestHeader h = new RequestHeader();
                    h.setType(ZooDefs.OpCode.setWatches);
                    h.setXid(-8);
                    Packet packet = new Packet(h, new ReplyHeader(), sw, null, null);
                    outgoingQueue.addFirst(packet);
                }
            }

            for (AuthData id : authInfo) {
                outgoingQueue.addFirst(new Packet(new RequestHeader(-4,
                                                  OpCode.auth), null, new AuthPacket(0, id.scheme,
                                                          id.data), null, null));
            }

            // 发送ConnectRequest
            outgoingQueue.addFirst(new Packet(null, null, conReq,
                                              null, null, readOnly));
        }

        // 后续对这个连接仅关注读写请求
        clientCnxnSocket.enableReadWriteOnly();
        if (LOG.isDebugEnabled()) {
            LOG.debug("Session establishment request sent on "
                      + clientCnxnSocket.getRemoteSocketAddress());
        }
    }
}

// ClientCnxnSocketNIO.java
void connect(InetSocketAddress addr) throws IOException {
    SocketChannel sock = createSock();
    try {
        registerAndConnect(sock, addr);
    } catch (IOException e) {
        LOG.error("Unable to open socket to " + addr);
        sock.close();
        throw e;
    }
    initialized = false;

    /*
     * Reset incomingBuffer
     */
    lenBuffer.clear();
    incomingBuffer = lenBuffer;
}

SocketChannel createSock() throws IOException {
    SocketChannel sock;
    sock = SocketChannel.open();
    sock.configureBlocking(false);
    sock.socket().setSoLinger(false, -1);
    sock.socket().setTcpNoDelay(true);
    return sock;
}

void registerAndConnect(SocketChannel sock, InetSocketAddress addr)
throws IOException {
    sockKey = sock.register(selector, SelectionKey.OP_CONNECT);
    // 建立底层物理连接
    boolean immediateConnect = sock.connect(addr);
    if (immediateConnect) {
        sendThread.primeConnection();
    }
}
```

从以上代码就可以看到，客户端启动过程会启动一个核心组件ClientCnxn，其中包含一个SendThread线程，线程启动时如果连接还没有建立会向随机一个服务端节点发起建立长连接，然后发送一个ConnectRequest消息注册会话。

# 小结

- 在服务端启动过程中会初始化好网络连接工厂（默认基于NIO）并启动，此时服务端会启动一个socket server服务监听客户端请求。需要注意的是这时候还不能处理客户端消息直到服务端完成初始化数据同步时，节点完成ZooKeeperServer启动。
- 在客户端启动过程中会启动客户端通信组件ClientCnxn，ClientCnxn中包含一个消息发送线程，如果此时连接还没有建立，就会立即向一个随机服务端节点发起建立底层长连接，然后发送一个ConnectRequest请求注册会话。