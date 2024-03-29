title: 分布式共识算法之Multi Paxos算法
author: haifun
tags:
  - 分布式
categories:
  - 分布式
date: 2021-11-17 21:30:00

---

分布式共识的复杂性主要来源于网络的不可靠和请求可并发两个因素。相应的，Basic Paxos算法的活锁问题（两个提案节点互不相让地争相提出自己的提案，抢占同一个值的修改权限，导致整个系统持续性地“反复横跳”，在外部看就像是被锁住了一样），以及许多Basic Paxos异常场景中的问题，都源于任何一个提案都能完全平等地与其他节点并发地提出提案而带来的复杂问题。

为此，Lamport提出了一种Paxos的改进版本，**“Multi Paxos”算法，其目的是在既不破坏Paxos中“众节点平等”的原则，又能在提案节点中实现主次之分，限制每个节点都有不受控的提案权利**。

# 算法过程

Multi Paxos对Basic Paxos的核心改进是增加了“选主”的过程。提案节点通过定时轮询（心跳），确定当前网络中所有节点里是否存在一个主提案节点，如果不存在主节点，那么节点会在心跳超时之后使用Basic Paxos中定义的准备、批准的两轮网络交互过程，向其他所有节点广播竞选主节点的请求。如果得到了多数派决策节点的批准，那么就认为竞选成功。

在选主完成后，除非主节点失联后重新竞选，否则从此以后就只有主节点本身才能发起提案。此时，无论是哪个提案节点收到客户端的操作请求，都会将请求转发给主节点来完成提案，**主节点的提案过程中无需再进行准备过程，因为可以视为经过选举时的一次准备之后，后续的提案都是对相同提案ID的一连串批准过程**。

> 在选主完成后，不存在其他节点与主节点竞争，相当于处在无并发环境中进行有序操作，此时系统中要对某个值达成一致只需要一轮批准交互。

此时算法流程如下图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/distributed/paxos/multi-paxos-01.png)

如上图所示，请求中Accept请求中多了一个i，i为主节点的“任期编号”，任期编号必须是单调递增的，用于应对主节点陷于网络分区中恢复，但是另外一部分节点仍然有多数派且已经完成选举的情况。此时必须以任期编号大的主节点为准。

当节点有了选主机制，从整体上看，节点角色不再区分为提案节点、决策节点、记录节点，而是同样的角色，只有主和从的区别。

此时算法流程如下图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/distributed/paxos/multi-paxos-02.png)
