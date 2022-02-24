title: 【ZooKeeper源码】选举期间网络通信
author: haifun
tags:
  - ZooKeeper
categories:
  - 分布式
date: 2022-02-20 17:15:00

---

上一篇我们分析了leader选举过程，但是对于期间节点间的连接是何时建立的、消息如何交换并不了解，本篇中我们将对leader选举过程中集群节点间的网络通信细节进行分析。

# 连接建立

节点间的网络连接建立分为主动建立和被动建立两个部分。

## 主动建立

在leader选举过程中，发送给自己投票的通知后，会循环交换通知直到选举出leader，过程中会收取消息，如果拉取不到消息并且还是通知没有发送出去就跟所有其他节点建立连接，代码如下：

```java
// FastLeaderElection.java
public Vote lookForLeader() throws InterruptedException {
    // ...

    try {
        // ...

        synchronized (this) {
            logicalclock++;
            // 更新提案
            updateProposal(getInitId(), getInitLastLoggedZxid(), getPeerEpoch());
        }

        LOG.info("New election. My id =  " + self.getId() +
                 ", proposed zxid=0x" + Long.toHexString(proposedZxid));
        // 向所有其他节点发送提案通知
        sendNotifications();

        /*
         * Loop in which we exchange notifications until we find a leader
         */
        // 循环交换通知直到投票出leader
        while ((self.getPeerState() == ServerState.LOOKING) &&
                (!stop)) {
            /*
             * Remove next notification from queue, times out after 2 times
             * the termination time
             */
            // 拉取其他节点发送来的消息
            Notification n = recvqueue.poll(notTimeout,
                                            TimeUnit.MILLISECONDS);

            /*
             * Sends more notifications if haven't received enough.
             * Otherwise processes new notification.
             */
            if (n == null) {
                // 如果所有通知已经发出去了, 但是没有回复就重新通知
                if (manager.haveDelivered()) {
                    sendNotifications();
                } else {
                    // 主动与其他节点建立连接
                    manager.connectAll();
                }

                // ...
            }

            // ...
        }
        return null;
    } finally {
        // ...
    }
}

// QuorumCnxManager.java
public void connectAll() {
    long sid;
    for (Enumeration<Long> en = queueSendMap.keys();
            en.hasMoreElements();) {
        sid = en.nextElement();
        connectOne(sid);
    }
}

synchronized void connectOne(long sid) {
    if (senderWorkerMap.get(sid) == null) {
        InetSocketAddress electionAddr;
        if (self.quorumPeers.containsKey(sid)) {
            electionAddr = self.quorumPeers.get(sid).electionAddr;
        } else {
            LOG.warn("Invalid server id: " + sid);
            return;
        }
        try {

            if (LOG.isDebugEnabled()) {
                LOG.debug("Opening channel to server " + sid);
            }
            Socket sock = new Socket();
            setSockOpts(sock);
            // 建立socket连接
            sock.connect(self.getView().get(sid).electionAddr, cnxTO);
            if (LOG.isDebugEnabled()) {
                LOG.debug("Connected to server " + sid);
            }
            // 初始化连接
            initiateConnection(sock, sid);
        } catch (UnresolvedAddressException e) {
            // Sun doesn't include the address that causes this
            // exception to be thrown, also UAE cannot be wrapped cleanly
            // so we log the exception in order to capture this critical
            // detail.
            LOG.warn("Cannot open channel to " + sid
                     + " at election address " + electionAddr, e);
            throw e;
        } catch (IOException e) {
            LOG.warn("Cannot open channel to " + sid
                     + " at election address " + electionAddr,
                     e);
        }
    } else {
        LOG.debug("There is a connection already for server " + sid);
    }
}

public boolean initiateConnection(Socket sock, Long sid) {
    DataOutputStream dout = null;
    try {
        // Sending id and challenge
        // 连接建立后发送当前节点serverId
        dout = new DataOutputStream(sock.getOutputStream());
        dout.writeLong(self.getId());
        dout.flush();
    } catch (IOException e) {
        LOG.warn("Ignoring exception reading or writing challenge: ", e);
        closeSocket(sock);
        return false;
    }

    // 如果对方的serverId比当前节点serverId大就关闭连接
    // 只能serverId大的节点向serverId小的节点发起连接建立
    // If lost the challenge, then drop the new connection
    if (sid > self.getId()) {
        LOG.info("Have smaller server identifier, so dropping the " +
                 "connection: (" + sid + ", " + self.getId() + ")");
        closeSocket(sock);
        // Otherwise proceed with the connection
    } else {
        // 启动消息发送线程和接收线程
        SendWorker sw = new SendWorker(sock, sid);
        RecvWorker rw = new RecvWorker(sock, sid, sw);
        sw.setRecv(rw);

        SendWorker vsw = senderWorkerMap.get(sid);

        if (vsw != null)
            vsw.finish();

        senderWorkerMap.put(sid, sw);
        if (!queueSendMap.containsKey(sid)) {
            queueSendMap.put(sid, new ArrayBlockingQueue<ByteBuffer>(
                                 SEND_CAPACITY));
        }

        sw.start();
        rw.start();

        return true;

    }
    return false;
}
```

从如上代码可以看到，首次主动建立连接时，当前节点会循环与所有其他节点尝试建立socket连接，连接建立之后立即向对方发送自己的serverId，如果对方serverId比自己的serverId大就关闭连接，否则连接建立成功，启动消息发送线程和消息接收线程。

## 被动建立

主动发起连接建立只有在当前serverId比对方节点serverId时才会建立，否则需要等待对方发起连接建立。

当前节点socket连接监听在ZKServer启动流程过程中就已经准备好了，在初始化leader选举算法时也初始化了集群网络通信组件，开始监听socket连接。

```java
protected Election createElectionAlgorithm(int electionAlgorithm) {
    Election le = null;

    //TODO: use a factory rather than a switch
    switch (electionAlgorithm) {
    case 0:
        le = new LeaderElection(this);
        break;
    case 1:
        le = new AuthFastLeaderElection(this);
        break;
    case 2:
        le = new AuthFastLeaderElection(this, true);
        break;
    case 3:
        // 集群间通信组件
        qcm = new QuorumCnxManager(this);
        QuorumCnxManager.Listener listener = qcm.listener;
        if (listener != null) {
            // 监听socket连接
            listener.start();
            // 默认选举算法
            le = new FastLeaderElection(this, qcm);
        } else {
            LOG.error("Null listener when initializing cnx manager");
        }
        break;
    default:
        assert false;
    }
    return le;
}

// QuorumCnxManager.java
public class Listener extends Thread {

    volatile ServerSocket ss = null;

    /**
     * Sleeps on accept().
     */
    @Override
    public void run() {
        int numRetries = 0;
        while ((!shutdown) && (numRetries < 3)) {
            try {
                ss = new ServerSocket();
                ss.setReuseAddress(true);
                int port = self.quorumPeers.get(self.getId()).electionAddr
                           .getPort();
                InetSocketAddress addr = new InetSocketAddress(port);
                LOG.info("My election bind port: " + addr.toString());
                setName(self.quorumPeers.get(self.getId()).electionAddr
                        .toString());
                ss.bind(addr);
                while (!shutdown) {
                    Socket client = ss.accept();
                    setSockOpts(client);
                    LOG.info("Received connection request "
                             + client.getRemoteSocketAddress());
                    // 收到其他节点连接请求
                    receiveConnection(client);
                    numRetries = 0;
                }
            } catch (IOException e) {
                LOG.error("Exception while listening", e);
                numRetries++;
                try {
                    ss.close();
                    Thread.sleep(1000);
                } catch (IOException ie) {
                    LOG.error("Error closing server socket", ie);
                } catch (InterruptedException ie) {
                    LOG.error("Interrupted while sleeping. " +
                              "Ignoring exception", ie);
                }
            }
        }
        LOG.info("Leaving listener");
        if (!shutdown) {
            LOG.error("As I'm leaving the listener thread, "
                      + "I won't be able to participate in leader "
                      + "election any longer: "
                      + self.quorumPeers.get(self.getId()).electionAddr);
        }
    }

    // ...
}

public boolean receiveConnection(Socket sock) {
        Long sid = null;
        
        try {
            // Read server id
            DataInputStream din = new DataInputStream(sock.getInputStream());
            // 连接建立后client会发送自己的serverId
            sid = din.readLong();
            if (sid == QuorumPeer.OBSERVER_ID) {
                /*
                 * Choose identifier at random. We need a value to identify
                 * the connection.
                 */
                
                sid = observerCounter--;
                LOG.info("Setting arbitrary identifier to observer: " + sid);
            }
        } catch (IOException e) {
            closeSocket(sock);
            LOG.warn("Exception reading or writing challenge: " + e.toString());
            return false;
        }
        
        //If wins the challenge, then close the new connection.
        // 只允许serverId更大的节点发起建立连接
        if (sid < self.getId()) {
            /*
             * This replica might still believe that the connection to sid is
             * up, so we have to shut down the workers before trying to open a
             * new connection.
             */
            SendWorker sw = senderWorkerMap.get(sid);
            if (sw != null) {
                sw.finish();
            }

            /*
             * Now we start a new connection
             */
            LOG.debug("Create new connection to server: " + sid);
            closeSocket(sock);
            connectOne(sid);

            // Otherwise start worker threads to receive data.
        } else {
            SendWorker sw = new SendWorker(sock, sid);
            RecvWorker rw = new RecvWorker(sock, sid, sw);
            sw.setRecv(rw);

            SendWorker vsw = senderWorkerMap.get(sid);
            
            if(vsw != null)
                vsw.finish();
            
            senderWorkerMap.put(sid, sw);
            
            if (!queueSendMap.containsKey(sid)) {
                queueSendMap.put(sid, new ArrayBlockingQueue<ByteBuffer>(
                        SEND_CAPACITY));
            }
            
            sw.start();
            rw.start();
            
            return true;    
        }
        return false;
    }
```

被动建立连接也是对方节点主动建立的过程，当收到连接建立请求，首先会接受对方发过来的serverId，然后进行比较，确保只有serverId大的一方才能主动建立请求。

# 消息交换

每个连接都对应着一个消息发送工作线程SendWorker和一个消息接收工作线程RecvWorker，另外每个SendWorker对应着一个消息发送队列，所有的RecvWorker对应着同一个消息接收队列。

接下来分别分析一下消息发送和一个消息接收过程。

## 消息发送

```java
public class FastLeaderElection implements Election {

    LinkedBlockingQueue<ToSend> sendqueue;

    private void sendNotifications() {
        for (QuorumServer server : self.getVotingView().values()) {
            long sid = server.id;

            ToSend notmsg = new ToSend(ToSend.mType.notification,
                                       proposedLeader,// serverId
                                       proposedZxid, // 最大zxid
                                       logicalclock, // 计数器
                                       QuorumPeer.ServerState.LOOKING, // 选举中
                                       sid, // 要发送到的节点serverId
                                       proposedEpoch); // 节点epoch值
            if (LOG.isDebugEnabled()) {
                LOG.debug("Sending Notification: " + proposedLeader + " (n.leader), 0x"  +
                          Long.toHexString(proposedZxid) + " (n.zxid), 0x" + Long.toHexString(logicalclock)  +
                          " (n.round), " + sid + " (recipient), " + self.getId() +
                          " (myid), 0x" + Long.toHexString(proposedEpoch) + " (n.peerEpoch)");
            }
            // 添加到消息发送队列
            sendqueue.offer(notmsg);
        }
    }

    class WorkerSender implements Runnable {
        volatile boolean stop;
        QuorumCnxManager manager;

        WorkerSender(QuorumCnxManager manager) {
            this.stop = false;
            this.manager = manager;
        }

        public void run() {
            while (!stop) {
                try {
                    ToSend m = sendqueue.poll(3000, TimeUnit.MILLISECONDS);
                    if (m == null) continue;

                    process(m);
                } catch (InterruptedException e) {
                    break;
                }
            }
            LOG.info("WorkerSender is down");
        }

        /**
         * Called by run() once there is a new message to send.
         *
         * @param m     message to send
         */
        private void process(ToSend m) {
            byte requestBytes[] = new byte[36];
            ByteBuffer requestBuffer = ByteBuffer.wrap(requestBytes);

            /*
             * Building notification packet to send
             */

            requestBuffer.clear();
            requestBuffer.putInt(m.state.ordinal());
            requestBuffer.putLong(m.leader);
            requestBuffer.putLong(m.zxid);
            requestBuffer.putLong(m.electionEpoch);
            requestBuffer.putLong(m.peerEpoch);

            manager.toSend(m.sid, requestBuffer);

        }
    }
}

// QuorumCnxManager.java
public void toSend(Long sid, ByteBuffer b) {
    /*
     * If sending message to myself, then simply enqueue it (loopback).
     */
    if (self.getId() == sid) {
        b.position(0);
        addToRecvQueue(new Message(b.duplicate(), sid));
        /*
         * Otherwise send to the corresponding thread to send.
         */
    } else {
        /*
         * Start a new connection if doesn't have one already.
         */
        // 把消息放到serverId对应的发送队列里
        if (!queueSendMap.containsKey(sid)) {
            ArrayBlockingQueue<ByteBuffer> bq = new ArrayBlockingQueue<ByteBuffer>(
                SEND_CAPACITY);
            queueSendMap.put(sid, bq);
            addToSendQueue(bq, b);

        } else {
            ArrayBlockingQueue<ByteBuffer> bq = queueSendMap.get(sid);
            if (bq != null) {
                addToSendQueue(bq, b);
            } else {
                LOG.error("No queue for server " + sid);
            }
        }
        connectOne(sid);

    }
}

private void addToSendQueue(ArrayBlockingQueue<ByteBuffer> queue,
                            ByteBuffer buffer) {
    if (queue.remainingCapacity() == 0) {
        try {
            queue.remove();
        } catch (NoSuchElementException ne) {
            // element could be removed by poll()
            LOG.debug("Trying to remove from an empty " +
                      "Queue. Ignoring exception " + ne);
        }
    }
    try {
        queue.add(buffer);
    } catch (IllegalStateException ie) {
        // This should never happen
        LOG.error("Unable to insert an element in the queue " + ie);
    }
}

class SendWorker extends Thread {

    // ...

    synchronized void send(ByteBuffer b) throws IOException {
        byte[] msgBytes = new byte[b.capacity()];
        try {
            b.position(0);
            b.get(msgBytes);
        } catch (BufferUnderflowException be) {
            LOG.error("BufferUnderflowException ", be);
            return;
        }
        dout.writeInt(b.capacity());
        dout.write(b.array());
        dout.flush();
    }

    @Override
    public void run() {
        threadCnt.incrementAndGet();
        try {
            /**
             * If there is nothing in the queue to send, then we
             * send the lastMessage to ensure that the last message
             * was received by the peer. The message could be dropped
             * in case self or the peer shutdown their connection
             * (and exit the thread) prior to reading/processing
             * the last message. Duplicate messages are handled correctly
             * by the peer.
             *
             * If the send queue is non-empty, then we have a recent
             * message than that stored in lastMessage. To avoid sending
             * stale message, we should send the message in the send queue.
             */
            ArrayBlockingQueue<ByteBuffer> bq = queueSendMap.get(sid);
            if (bq == null || isSendQueueEmpty(bq)) {
                ByteBuffer b = lastMessageSent.get(sid);
                if (b != null) {
                    LOG.debug("Attempting to send lastMessage to sid=" + sid);
                    send(b);
                }
            }
        } catch (IOException e) {
            LOG.error("Failed to send last message. Shutting down thread.", e);
            this.finish();
        }

        try {
            while (running && !shutdown && sock != null) {

                ByteBuffer b = null;
                try {
                    ArrayBlockingQueue<ByteBuffer> bq = queueSendMap
                                                        .get(sid);
                    if (bq != null) {
                        // 从发送队列里取一条消息
                        b = pollSendQueue(bq, 1000, TimeUnit.MILLISECONDS);
                    } else {
                        LOG.error("No queue of incoming messages for " +
                                  "server " + sid);
                        break;
                    }

                    if (b != null) {
                        // 记录最后一条发送的消息
                        lastMessageSent.put(sid, b);
                        // 发送消息
                        send(b);
                    }
                } catch (InterruptedException e) {
                    LOG.warn("Interrupted while waiting for message on queue",
                             e);
                }
            }
        } catch (Exception e) {
            LOG.warn("Exception when using channel: for id " + sid + " my id = " +
                     self.getId() + " error = " + e);
        }
        this.finish();
        LOG.warn("Send worker leaving thread");
    }
}
```


## 消息接收

```java
public class FastLeaderElection implements Election {

    LinkedBlockingQueue<Notification> recvqueue;

    public Vote lookForLeader() throws InterruptedException {

        // ...

        // 循环交换通知直到投票出leader
        while ((self.getPeerState() == ServerState.LOOKING) &&
                (!stop)) {

            // 拉取其他节点发送来的消息
            Notification n = recvqueue.poll(notTimeout,
                                            TimeUnit.MILLISECONDS);

            // ...
        }
    }

    class WorkerReceiver implements Runnable {

        // ...

        public void run() {

            Message response;
            while (!stop) {
                // Sleeps on receive
                try {
                    // 拉取消息
                    response = manager.pollRecvQueue(3000, TimeUnit.MILLISECONDS);
                    if (response == null) continue;

                    /*
                     * If it is from an observer, respond right away.
                     * Note that the following predicate assumes that
                     * if a server is not a follower, then it must be
                     * an observer. If we ever have any other type of
                     * learner in the future, we'll have to change the
                     * way we check for observers.
                     */
                    if (!self.getVotingView().containsKey(response.sid)) {
                        Vote current = self.getCurrentVote();
                        ToSend notmsg = new ToSend(ToSend.mType.notification,
                                                   current.getId(),
                                                   current.getZxid(),
                                                   logicalclock,
                                                   self.getPeerState(),
                                                   response.sid,
                                                   current.getPeerEpoch());

                        sendqueue.offer(notmsg);
                    } else {
                        // ...

                        /*
                         * If this server is looking, then send proposed leader
                         */

                        if (self.getPeerState() == QuorumPeer.ServerState.LOOKING) {
                            recvqueue.offer(n);

                            /*
                             * Send a notification back if the peer that sent this
                             * message is also looking and its logical clock is
                             * lagging behind.
                             */
                            if ((ackstate == QuorumPeer.ServerState.LOOKING)
                                    && (n.electionEpoch < logicalclock)) {
                                Vote v = getVote();
                                ToSend notmsg = new ToSend(ToSend.mType.notification,
                                                           v.getId(),
                                                           v.getZxid(),
                                                           logicalclock,
                                                           self.getPeerState(),
                                                           response.sid,
                                                           v.getPeerEpoch());
                                sendqueue.offer(notmsg);
                            }
                        } else {
                            /*
                             * If this server is not looking, but the one that sent the ack
                             * is looking, then send back what it believes to be the leader.
                             */
                            Vote current = self.getCurrentVote();
                            if (ackstate == QuorumPeer.ServerState.LOOKING) {
                                // ...
                                ToSend notmsg = new ToSend(
                                    ToSend.mType.notification,
                                    current.getId(),
                                    current.getZxid(),
                                    logicalclock,
                                    self.getPeerState(),
                                    response.sid,
                                    current.getPeerEpoch());
                                sendqueue.offer(notmsg);
                            }
                        }
                    }
                } catch (InterruptedException e) {
                    System.out.println("Interrupted Exception while waiting for new message" +
                                       e.toString());
                }
            }
            LOG.info("WorkerReceiver is down");
        }
    }
}

// QuorumCnxManager.java
public Message pollRecvQueue(long timeout, TimeUnit unit)
throws InterruptedException {
    return recvQueue.poll(timeout, unit);
}

class RecvWorker extends Thread {

    // ...

    @Override
    public void run() {
        threadCnt.incrementAndGet();
        try {
            while (running && !shutdown && sock != null) {
                /**
                 * Reads the first int to determine the length of the
                 * message
                 */
                int length = din.readInt();
                if (length <= 0 || length > PACKETMAXSIZE) {
                    throw new IOException(
                        "Received packet with invalid packet: "
                        + length);
                }
                /**
                 * Allocates a new ByteBuffer to receive the message
                 */
                byte[] msgArray = new byte[length];
                din.readFully(msgArray, 0, length);
                ByteBuffer message = ByteBuffer.wrap(msgArray);
                addToRecvQueue(new Message(message.duplicate(), sid));
            }
        } catch (Exception e) {
            LOG.warn("Connection broken for id " + sid + ", my id = " +
                     self.getId() + ", error = " , e);
        } finally {
            LOG.warn("Interrupting SendWorker");
            sw.finish();
            if (sock != null) {
                closeSocket(sock);
            }
        }
    }
}

public void addToRecvQueue(Message msg) {
    synchronized (recvQLock) {
        if (recvQueue.remainingCapacity() == 0) {
            try {
                recvQueue.remove();
            } catch (NoSuchElementException ne) {
                // element could be removed by poll()
                LOG.debug("Trying to remove from an empty " +
                          "recvQueue. Ignoring exception " + ne);
            }
        }
        try {
            // 添加到消息接收队列
            recvQueue.add(msg);
        } catch (IllegalStateException ie) {
            // This should never happen
            LOG.error("Unable to insert element in the recvQueue " + ie);
        }
    }
}
```

# 小结

在ZKServer启动初始化leader选举算法的同时也会初始化好集群间网络通信管理器，同时启动监听客户端连接请求。在选举过程中会主动与比自己serverId小的其他节点建立连接，连接建立后立即发送自己的serverId用于对方校验，当校验通过时会为这个连接初始化一个消息发送工作线程SendWorker以及一个消息接收工作线程RecvWorker。每个SendWorker对应一个消息发送队列，所有的RecvWorker对应同一个消息接收队列。
