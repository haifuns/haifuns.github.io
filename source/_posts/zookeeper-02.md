title: 【ZooKeeper源码】Leader选举
author: haifun
tags:
  - ZooKeeper
categories:
  - 分布式
date: 2022-02-17 12:10:00

---

在前篇ZKServer启动流程分析的最后，QuorumPeer线程被启动，下面我们对线程执行过程中leader选举流程进行详细分析。

# QuorumPeer#run

```java
// QuorumPeer.java
public void run() {
    setName("QuorumPeer" + "[myid=" + getId() + "]" +
            cnxnFactory.getLocalAddress());

    LOG.debug("Starting quorum peer");
    try {
        // 注册jmx bean
        jmxQuorumBean = new QuorumBean(this);
        MBeanRegistry.getInstance().register(jmxQuorumBean, null);
        // ...
    } catch (Exception e) {
        LOG.warn("Failed to register with JMX", e);
        jmxQuorumBean = null;
    }

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
                LOG.info("LOOKING");

                if (Boolean.getBoolean("readonlymode.enabled")) {
                    LOG.info("Attempting to start ReadOnlyZooKeeperServer");

                    // Create read-only server but don't start it immediately
                    final ReadOnlyZooKeeperServer roZk = new ReadOnlyZooKeeperServer(
                        logFactory, this,
                        new ZooKeeperServer.BasicDataTreeBuilder(),
                        this.zkDb);

                    // Instead of starting roZk immediately, wait some grace
                    // period before we decide we're partitioned.
                    //
                    // Thread is used here because otherwise it would require
                    // changes in each of election strategy classes which is
                    // unnecessary code coupling.
                    Thread roZkMgr = new Thread() {
                        public void run() {
                            try {
                                // lower-bound grace period to 2 secs
                                sleep(Math.max(2000, tickTime));
                                if (ServerState.LOOKING.equals(getPeerState())) {
                                    roZk.startup();
                                }
                            } catch (InterruptedException e) {
                                LOG.info("Interrupted while attempting to start ReadOnlyZooKeeperServer, not started");
                            } catch (Exception e) {
                                LOG.error("FAILED to start ReadOnlyZooKeeperServer", e);
                            }
                        }
                    };
                    try {
                        roZkMgr.start();
                        // 发起leader选举
                        setCurrentVote(makeLEStrategy().lookForLeader());
                    } catch (Exception e) {
                        LOG.warn("Unexpected exception", e);
                        setPeerState(ServerState.LOOKING);
                    } finally {
                        // If the thread is in the the grace period, interrupt
                        // to come out of waiting.
                        roZkMgr.interrupt();
                        roZk.shutdown();
                    }
                } else {
                    try {
                        setCurrentVote(makeLEStrategy().lookForLeader());
                    } catch (Exception e) {
                        LOG.warn("Unexpected exception", e);
                        setPeerState(ServerState.LOOKING);
                    }
                }
                break;
            case OBSERVING:
                // ...
                break;
            case FOLLOWING:
                // ...
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
```

从以上代码可以看到在服务启动后，当节点是LOOKING即选举中状态时，会使用之前初始化好的leader选举算法（FastLeaderElection）发起一轮leader选举。

# FastLeaderElection#lookForLeader

```java
// FastLeaderElection.java
/**
 * 发起一轮leader选举
 *
 * Starts a new round of leader election. Whenever our QuorumPeer
 * changes its state to LOOKING, this method is invoked, and it
 * sends notifications to all other peers.
 */
public Vote lookForLeader() throws InterruptedException {
    try {
        self.jmxLeaderElectionBean = new LeaderElectionBean();
        MBeanRegistry.getInstance().register(
            self.jmxLeaderElectionBean, self.jmxLocalPeerBean);
    } catch (Exception e) {
        LOG.warn("Failed to register with JMX", e);
        self.jmxLeaderElectionBean = null;
    }
    if (self.start_fle == 0) {
        self.start_fle = System.currentTimeMillis();
    }
    try {
        // 投票消息列表
        HashMap<Long, Vote> recvset = new HashMap<Long, Vote>();

        HashMap<Long, Vote> outofelection = new HashMap<Long, Vote>();

        int notTimeout = finalizeWait;

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
                // 没有拉取到消息重新发送通知
                if (manager.haveDelivered()) {
                    sendNotifications();
                } else {
                    manager.connectAll();
                }

                /*
                 * Exponential backoff
                 */
                int tmpTimeOut = notTimeout * 2;
                notTimeout = (tmpTimeOut < maxNotificationInterval ?
                              tmpTimeOut : maxNotificationInterval);
                LOG.info("Notification time out: " + notTimeout);
            } else if (self.getVotingView().containsKey(n.sid)) {
                /*
                 * Only proceed if the vote comes from a replica in the
                 * voting view.
                 */
                switch (n.state) {
                // 其他节点发过来的选举中状态消息
                case LOOKING:
                    // If notification > current, replace and send messages out
                    // 如果新消息中的时间戳更大则已经开始新的一轮选举
                    if (n.electionEpoch > logicalclock) {
                        // 接受更大的时间戳
                        logicalclock = n.electionEpoch;
                        // 清空上一轮的投票消息
                        recvset.clear();
                        // 检查是否接受这条提案, 以下三种情况接受:
                        // 1. new epoch更大
                        // 2. epoch相等, new zxid更大
                        // 3. epoch相等, zxid相等, new serverId更大
                        if (totalOrderPredicate(n.leader, n.zxid, n.peerEpoch,
                                                getInitId(), getInitLastLoggedZxid(), getPeerEpoch())) {
                            // 接受提案
                            updateProposal(n.leader, n.zxid, n.peerEpoch);
                        } else {
                            updateProposal(getInitId(),
                                           getInitLastLoggedZxid(),
                                           getPeerEpoch());
                        }
                        // 通知所有其他节点
                        sendNotifications();
                    } else if (n.electionEpoch < logicalclock) {
                        // 如果消息中的时间戳更小, 说明消息已经过期了
                        if (LOG.isDebugEnabled()) {
                            LOG.debug("Notification election epoch is smaller than logicalclock. n.electionEpoch = 0x"
                                      + Long.toHexString(n.electionEpoch)
                                      + ", logicalclock=0x" + Long.toHexString(logicalclock));
                        }
                        break;
                    } else if (totalOrderPredicate(n.leader, n.zxid, n.peerEpoch,
                                                   proposedLeader, proposedZxid, proposedEpoch)) {
                        updateProposal(n.leader, n.zxid, n.peerEpoch);
                        sendNotifications();
                    }

                    if (LOG.isDebugEnabled()) {
                        LOG.debug("Adding vote: from=" + n.sid +
                                  ", proposed leader=" + n.leader +
                                  ", proposed zxid=0x" + Long.toHexString(n.zxid) +
                                  ", proposed election epoch=0x" + Long.toHexString(n.electionEpoch));
                    }

                    // 保存所有投票消息
                    recvset.put(n.sid, new Vote(n.leader, n.zxid, n.electionEpoch, n.peerEpoch));

                    // 判断是否满足过半节点投票
                    if (termPredicate(recvset,
                                      new Vote(proposedLeader, proposedZxid,
                                               logicalclock, proposedEpoch))) {

                        // Verify if there is any change in the proposed leader
                        // 检查其他消息leader提案是否有变化
                        while ((n = recvqueue.poll(finalizeWait,
                                                   TimeUnit.MILLISECONDS)) != null) {
                            if (totalOrderPredicate(n.leader, n.zxid, n.peerEpoch,
                                                    proposedLeader, proposedZxid, proposedEpoch)) {
                                recvqueue.put(n);
                                break;
                            }
                        }

                        /*
                         * This predicate is true once we don't read any new
                         * relevant message from the reception queue
                         */
                        // 如果读不到其他消息了, 则选举已经完成
                        if (n == null) {
                            // 设置当前节点leader状态
                            self.setPeerState((proposedLeader == self.getId()) ?
                                              ServerState.LEADING : learningState());

                            Vote endVote = new Vote(proposedLeader,
                                                    proposedZxid, proposedEpoch);
                            leaveInstance(endVote);
                            return endVote;
                        }
                    }
                    break;
                case OBSERVING:
                    LOG.debug("Notification from observer: " + n.sid);
                    break;
                case FOLLOWING:
                case LEADING:
                    /*
                     * Consider all notifications from the same epoch
                     * together.
                     */
                    if (n.electionEpoch == logicalclock) {
                        recvset.put(n.sid, new Vote(n.leader, n.zxid, n.electionEpoch, n.peerEpoch));
                        if (termPredicate(recvset, new Vote(n.leader,
                                                            n.zxid, n.electionEpoch, n.peerEpoch, n.state))
                                && checkLeader(outofelection, n.leader, n.electionEpoch)) {
                            self.setPeerState((n.leader == self.getId()) ?
                                              ServerState.LEADING : learningState());

                            Vote endVote = new Vote(n.leader, n.zxid, n.peerEpoch);
                            leaveInstance(endVote);
                            return endVote;
                        }
                    }

                    /**
                     * Before joining an established ensemble, verify that
                     * a majority are following the same leader.
                     */
                    // 如果集群中已经达成了共识, 在加入前需要验证leader满足大多数跟随
                    outofelection.put(n.sid, new Vote(n.leader, n.zxid,
                                                      n.electionEpoch, n.peerEpoch, n.state));
                    if (termPredicate(outofelection, new Vote(n.leader,
                                      n.zxid, n.electionEpoch, n.peerEpoch, n.state))
                            && checkLeader(outofelection, n.leader, n.electionEpoch)) {
                        synchronized (this) {
                            logicalclock = n.electionEpoch;
                            self.setPeerState((n.leader == self.getId()) ?
                                              ServerState.LEADING : learningState());
                        }
                        Vote endVote = new Vote(n.leader, n.zxid, n.peerEpoch);
                        leaveInstance(endVote);
                        return endVote;
                    }
                    break;
                default:
                    LOG.warn("Notification state unrecoginized: " + n.state
                             + " (n.state), " + n.sid + " (n.sid)");
                    break;
                }
            } else {
                LOG.warn("Ignoring notification from non-cluster member " + n.sid);
            }
        }
        return null;
    } finally {
        try {
            if (self.jmxLeaderElectionBean != null) {
                MBeanRegistry.getInstance().unregister(
                    self.jmxLeaderElectionBean);
            }
        } catch (Exception e) {
            LOG.warn("Failed to unregister with JMX", e);
        }
        self.jmxLeaderElectionBean = null;
    }
}
```

以上代码可以看到FastLeaderElection进行一轮leader选举的过程。如果当前节点可以参与选举，首先投自己一票(serverId, 最大zxid, 时间戳epoch)，然后通知所有其他节点。如果节点状态为LOOKING并且选举没有结束，则循环从接受消息的队列里获取消息，然后判断发送消息的节点状态：

如果发送消息的节点是LOOKING状态时，则选举依然在进行中，比较收到的投票时间戳与本地保存的时间戳：
- 如果新的投票时间戳大，说明旧的投票过期了，开始判断是否接受新的提案，当满足`(new epoch更大 || (epoch相等 && new zxid更大) || (epoch相等 && zxid相等 && new serverId更大))`时，就接受新的提案，否则依然接受旧提案。重新接受提案之后再次通知所有其他节点。
- 如果新的投票时间戳小，则说明消息过期了，不作任何操作。
- 如果相等，判断是否需要接受新的提案，如果接受依然需要通知其他所有节点。

接下来保存所有投票消息，判断其他节点对当前节点的投票是否满足过半数，如果满足并且消息队列里的其他消息也不会导致当前接受其他节点的提案，则选举已经完成，更新当前节点的状态为LEADING。

如果发送消息的节点是FOLLOWING或者LEADING状态时，此时说明集群中已经达成了共识，在加入前需要验证leader是否满足大多数跟随，如果检查通过就接受已经存在的leader，根据leader serverId更新当前节点的状态为LEADING/FOWLLING。

至此，ZKServer启动后新一轮的选举已经完成了，接下来节点需要根据自己的状态(LEADING/FOWLLING/OBSERVING)执行后续的操作。

# 小结

在新的ZK节点启动时，会发起一轮选举，如果可以参与竞选，把对自己的提案投票消息(serverId, 最大zxid, 时间戳epoch)发送给其他节点，并接受其他节点的投票消息。

- 如果此时集群中已经有leader了，经过过半数节点投票检查后就直接作为follower加入。
- 如果集群中没有leader，那么满足`(new epoch更大 || (epoch相等 && new zxid更大) || (epoch相等 && zxid相等 && new serverId更大))`条件的提案在满足过半数节点投票后即可竞选成功为leader。