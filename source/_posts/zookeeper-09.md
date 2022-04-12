title: 【ZooKeeper源码】故障感知与恢复
author: haifun
tags:
  - ZooKeeper
categories:
  - 分布式
date: 2022-04-12 12:30:00

---

本篇着重关注zk中对各种故障的感知与恢复，下面将针对不同的故障情况进行分析。

# 消息通信故障

## 客户端故障

```java
// NIOServerCnxn.java
void doIO(SelectionKey k) throws InterruptedException {
    try {
        if (sock == null) {
            LOG.warn("trying to do i/o on a null socket for session:0x"
                     + Long.toHexString(sessionId));

            return;
        }
        if (k.isReadable()) {
            // ...
        }
        if (k.isWritable()) {
            // ...
        }
    } catch (CancelledKeyException e) {
        LOG.warn("Exception causing close of session 0x"
                 + Long.toHexString(sessionId)
                 + " due to " + e);
        if (LOG.isDebugEnabled()) {
            LOG.debug("CancelledKeyException stack trace", e);
        }
        close();
    } catch (CloseRequestException e) {
        // expecting close to log session closure
        close();
    } catch (EndOfStreamException e) {
        LOG.warn("caught end of stream exception", e); // tell user why

        // expecting close to log session closure
        close();
    } catch (IOException e) {
        LOG.warn("Exception causing close of session 0x"
                 + Long.toHexString(sessionId)
                 + " due to " + e);
        if (LOG.isDebugEnabled()) {
            LOG.debug("IOException stack trace", e);
        }
        close();
    }
}

public void close() {
    synchronized (factory.cnxns) {
        // if this is not in cnxns then it's already closed
        if (!factory.cnxns.remove(this)) {
            return;
        }

        synchronized (factory.ipMap) {
            Set<NIOServerCnxn> s =
                factory.ipMap.get(sock.socket().getInetAddress());
            s.remove(this);
        }

        factory.unregisterConnection(this);

        if (zkServer != null) {
            // 移除watcher
            zkServer.removeCnxn(this);
        }

        closeSock();

        if (sk != null) {
            try {
                // need to cancel this selection key from the selector
                sk.cancel();
            } catch (Exception e) {
                if (LOG.isDebugEnabled()) {
                    LOG.debug("ignoring exception during selectionkey cancel", e);
                }
            }
        }
    }
}
```

当客户端故障时，服务端会捕获相应的异常，接着移除连接实例，移除当前客户端注册的watcher，最后关闭底层连接。

## 服务端故障

```java
// ClientCnxn.SendThread.java
@Override
public void run() {
    clientCnxnSocket.introduce(this, sessionId);
    clientCnxnSocket.updateNow();
    clientCnxnSocket.updateLastSendAndHeard();
    int to;
    long lastPingRwServer = System.currentTimeMillis();
    while (state.isAlive()) {
        try {
            if (!clientCnxnSocket.isConnected()) {
                // 当前不是第一次连接
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

        } catch (Throwable e) {
            if (closing) {
                if (LOG.isDebugEnabled()) {
                    // closing so this is expected
                    LOG.debug("An exception was thrown while closing send thread for session 0x"
                              + Long.toHexString(getSessionId())
                              + " : " + e.getMessage());
                }
                break;
            } else {
                // this is ugly, you have a better way speak up
                if (e instanceof SessionExpiredException) {
                    LOG.info(e.getMessage() + ", closing socket connection");
                } else if (e instanceof SessionTimeoutException) {
                    LOG.info(e.getMessage() + RETRY_CONN_MSG);
                } else if (e instanceof EndOfStreamException) {
                    LOG.info(e.getMessage() + RETRY_CONN_MSG);
                } else if (e instanceof RWServerFoundException) {
                    LOG.info(e.getMessage());
                } else {
                    LOG.warn(
                        "Session 0x"
                        + Long.toHexString(getSessionId())
                        + " for server "
                        + clientCnxnSocket.getRemoteSocketAddress()
                        + ", unexpected error"
                        + RETRY_CONN_MSG, e);
                }
                // 关闭连接、标记所有请求失败
                cleanup();
                if (state.isAlive()) {
                    // 发布一个disconnected事件
                    // 创建ZooKeeper时加的默认监听器
                    eventThread.queueEvent(new WatchedEvent(
                                               Event.EventType.None,
                                               Event.KeeperState.Disconnected,
                                               null));
                }
                // 重新更新底层网络连接初始化时间
                clientCnxnSocket.updateNow();
                // 重新初始化底层网络连接最近一次发送和接收请求响应的时间
                clientCnxnSocket.updateLastSendAndHeard();
            }
        }
    }
    // 客户端状态异常处理
    cleanup();
    clientCnxnSocket.close();
    if (state.isAlive()) {
        eventThread.queueEvent(new WatchedEvent(Event.EventType.None,
                                                Event.KeeperState.Disconnected, null));
    }
    ZooTrace.logTraceMessage(LOG, ZooTrace.getTextTraceLevel(),
                             "SendThread exitedloop.");
}
```

当与客户端已经建立好连接的服务端节点故障，客户端会在消息发送时捕获到异常，接着关闭连接、标记所有请求失败，重新选择一个服务端节点建立连接。

# 集群间故障

## follower故障

```java
// LearnerHandler.java
@Override
public void run() {
    try {
        ia = BinaryInputArchive.getArchive(new BufferedInputStream(sock
                                           .getInputStream()));
        bufferedOutput = new BufferedOutputStream(sock.getOutputStream());
        oa = BinaryOutputArchive.getArchive(bufferedOutput);

        // ...

        // 接下来循环处理正常消息
        while (true) {
            qp = new QuorumPacket();
            ia.readRecord(qp, "packet");

            // ...
        }
    } catch (IOException e) {
        if (sock != null && !sock.isClosed()) {
            LOG.error("Unexpected exception causing shutdown while sock "
                      + "still open", e);
            //close the socket to make sure the
            //other side can see it being close
            try {
                // io异常关闭socket
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

public void shutdown() {
    // Send the packet of death
    try {
        queuedPackets.put(proposalOfDeath);
    } catch (InterruptedException e) {
        LOG.warn("Ignoring unexpected exception", e);
    }
    try {
        if (sock != null && !sock.isClosed()) {
            sock.close();
        }
    } catch (IOException e) {
        LOG.warn("Ignoring unexpected exception during socket close", e);
    }
    this.interrupt();
    leader.removeLearnerHandler(this);
}

// Leader.java
void removeLearnerHandler(LearnerHandler peer) {
    synchronized (forwardingFollowers) {
        forwardingFollowers.remove(peer);
    }
    synchronized (learners) {
        learners.remove(peer);
    }
    synchronized (observingLearners) {
        observingLearners.remove(peer);
    }
}
```

当follower故障时，leader LearnerHandler会感知到异常，接着关闭连接、从follower列表中移除。此时，只要集群可以满足过半ACK则仍然可以正常提供服务。

## leader故障

```java
// QourumPeer.java
@Override
public void run() {
    setName("QuorumPeer" + "[myid=" + getId() + "]" +
            cnxnFactory.getLocalAddress());

    // ...

    try {
        /*
         * 主要逻辑
         * Main loop
         */
        while (running) {
            // 根据当前节点的状态执行相应的处理
            switch (getPeerState()) {
            case LOOKING:
                // 选举中状态
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
                    // followLeader异常, 关闭follower, 节点重新进入LOOKING状态
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
        LOG.warn("QuorumPeer main thread exited");
        try {
            MBeanRegistry.getInstance().unregisterAll();
        } catch (Exception e) {
            LOG.warn("Failed to unregister with JMX", e);
        }
        jmxQuorumBean = null;
        jmxLocalPeerBean = null;
    }
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
```

当leader故障时，follower followLeader会发生异常被捕获，接着关闭follower，设置节点状态为LOOKING状态，集群会进行一轮新的选举。

# 小结

- 客户端故障服务端处理：关闭session，删除watcher，关闭底层连接
- 服务端故障客户端处理：切换服务端节点，重新建立长连接，建立会话，重新把内存中注册的监听器在新的服务端节点上注册。
- follower故障leader处理：关闭连接，从follower列表中移除，当可以满足过半节点ACK时集群可以正常对外提供服务。
- leader故障follower处理：关闭连接，关闭follwer，进入LOOKING状态开始新一轮选举。