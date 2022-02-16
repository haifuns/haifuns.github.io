title: 分布式共识算法之ZAB协议
author: haifun
tags:
  - 分布式
categories:
  - 分布式
date: 2021-11-22 20:30:00

---

ZAB协议，即ZooKeeper Atomic Broadcast，ZooKeeper原子消息广播协议，是分布式协调服务ZooKeeper专门设计的一种支持崩溃恢复的原子广播协议。

ZAB协议与Paxos算法不完全相同，它不是一种通用的分布式一致性算法，而是一种特别为ZooKeeper设计的崩溃可恢复的原子消息广播算法。

在ZooKeeper中，主要依赖ZAB协议来实现分布式数据一致性，基于该协议，ZooKeeper实现了一种主备模式的系统架构来保持集群中各副本之间数据的一致性。

ZAB协议的核心是定义了对于那些会改变ZooKeeper服务器数据状态的事务请求的处理方式，即：所有事务请求必须由一个全局唯一的Leader服务器来协调，其他的服务器为Follower服务器。Leader服务器负责将客户端事务请求转换为一个事务Proposal（提议），并将此Proposal分发给集群中所有的Follower服务器。之后Leader服务器需要等待所有Follower服务器的反馈，一旦超过半数的Follower服务器进行了正确的反馈后，那么Leader服务器就会再次向所有的Follower服务器发送Commit消息，要求其将前一个Proposal进行提交。

# 协议模式

ZAB协议包含两种基本的模式，分别是崩溃恢复和消息广播。

当分布式系统启动，或者当Leader服务器网络中断、崩溃退出、重启等异常情况时，ZAB协议会进入恢复模式并选举产生新的Leader服务器。当Leader服务器被选出后，同时集群中超过半数的机器与Leader服务器完成状态同步后，ZAB协议就会退出恢复模式进入消息广播模式。当一台机器新加入集群时，这台服务器会进入数据恢复模式，从Leader服务器进行数据同步，同步完成后参与到消息广播流程中。

## 消息广播模式

ZAB协议的消息广播过程使用的是一个原子广播协议，类似于一个二阶段提交过程。

当客户端发起事务请求，Leader服务器会为其生成事务Proposal，对应一个全局唯一且单调递增的事务id（zxid，64位包含时间戳和计数器两部分），并按照zxid顺序将事务Proposal广播给其他所有Follower机器，如果收到超过半数的Follower的ACK响应，就广播事务提交消息。

ZAB协议中的二阶段提交过程是一种简化模型，Leader服务器在得到超过半数Follower服务器反馈ACK后就可以开始提交事务Proposal，而不需要等待集群中所有的Follower服务器都反馈响应。这种简化模型无法处理Leader服务器崩溃退出带来的数据不一致问题，因此ZAB协议中添加了崩溃恢复模式来解决这个问题。

## 崩溃恢复模式

在进行故障恢复时，ZAB协议需要保证以下两个特性：

- 确保已经在Leader服务器上提交的事务最终被所有服务器提交
- 确保丢弃只在Leader服务器上被提出的事务

# 算法流程

ZAB协议包含消息广播和故障恢复两个过程，进一步可以细分为三个阶段：

- 发现（Discovery）
- 同步（Synchronization）
- 广播（Broadcast）

## 发现阶段

发现阶段主要就是Leader选举的过程，用于在多个分布式进程中选举出主进程，准Leader L和Follower F 的工作流程分别如下：

- F.1.1，Follower F将自己最后接受的事务Proposal的epoch值发送给准Leader L。
- L.1.1，当接收到超过半数Follower的epoch消息后，准Leader L会生成一个新的epoch e' （e'为最大的epoch+1）发送给这些过半的Follower。
- F.1.2，当Follower收到L的新epoch后，如果当前自己的epoch小于收到的值，那么就接受新值，同时向L发送ACK消息，ACK消息中包含epoch值和当前Follower的历史事务Proposal集合。
- L.1.2，当L收到过半Follower的ACK消息之后，会从Quorum中选择一个Follower，将其事务集合中作为初始化事务集合Ie'，被选择的Follower需要满足epoch大于等于其他Follower，并且事务集合需要满足zxid最大。

## 同步阶段

在发现阶段完成后，就进入了同步阶段，在这一阶段，Leader L和Follower F的工作流程如下所示：

- L.2.1，Leader L将e'和选择的初始化事务集合Ie'以NEWLEADER(e',Ie')的形式发送给所有Quorum中的Follower。
- F.2.1，当Follower接收到来自L的NEWLEADER(e',Ie')消息后，
    - 如果epoch != e'，那么直接进入下一轮循环，因为此时Follower还在上一轮或者更上轮，无法参与此轮同步。
    - 如果epoch = e'，那么Follower会执行事务操作。最后Follower会反馈给Leader，表明自己已经接受并处理了所有的Ie'中的事务。
- F.2.2，当Leader收到超过半数Follower针对NEWLEADER的反馈消息后，就会向所有Follower发送Commit消息。至此，Leader完成同步阶段。
- L.2.2，当Follower收到来自Leader的Commit消息后，就会依次处理并提交之前接受的Ie'中的事务。至此，Follower完成同步阶段。

> 此阶段是ZAB协议中相对Paxos算法额外添加的，能够有效的保证Leader在新的周期中提出Proposal之前，所有的进程都已经完成了对之前所有事务的提交。

## 广播阶段

完成同步阶段后，ZAB协议就可以正式开始接受客户端新的事务请求，并进行广播流程。

- L.3.1，Leader接收到客户端新的事务请求后，会生成对应的事务Proposal，并根据ZXID的顺序向所有Follower发送提案。
- F.3.1，Follower根据消息接收的先后顺序来处理来自Leader的事务Proposal，并追加到已接受的事务Proposal集合，之后再反馈给Leader。
- L.3.2，当Leader接收到超过半数的Follower针对事务Proposal的ACK消息后，就会发送相应的Commit消息给所有的Follower，要求它们进行事务提交。
- F.3.2，Follower接收到来自Leader的Commit消息后，就会提交相应的事务Proposal。

算法流程图如下所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/distributed/zab.png)
