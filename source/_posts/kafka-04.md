title: 【Kafka】：再均衡原理剖析
author: Haif.
tags:
  - Kafka
categories:
  - 消息中间件
date: 2021-05-22 20:30:00

---

# 概述

Kafka中多个消费者间的分区分配由消费者协调器（ConsumerCoordinator）和组协调器（GroupCoordinator）共同完成。全部消费组被分为多个子集，每个子集在服务端对应者一个GroupCoordinator进行管理，而消费者客户端中的ConsumerCoordinator组件负责与GroupCoordinator进行交互。

GroupCoordinator与ConsumerCoordinaor之间最重要的工作就是负责执行消费者再均衡。分区分配工作也是在再均衡期间完成的。

<!-- more -->

# 触发时机

触发再均衡的场景如下：

* 新的消费者加入消费组。
* 消费者宕机。
* 消费者主动退出消费组。
* 消费组对应的GroupCoordinaor节点发生变更。
* 消费组内订阅的任一主题或主题分区数量发生变化。

# 再均衡流程

## 第一阶段（FIND_COORDINATOR）

此阶段消费者需要与所属消费组对应的GroupCoordinator所在的broker建立连接。如果消费者已经保存与消费组对应的GroupCoordinator节点的信息，并且与之建立的网络连接正常，那么就直接进入第二阶段。否则，需要向负载最小的节点（leastLoadedNode）发送FindCoordinatorRequest（coordinator_key + coordinator_type）请求来查找对应的GroupCoordinator。

Kafka收到FindCoordinatorRequest消息后，会根据coordinator_key（即groupId）查找对应的GroupCoordinator节点，返回对应的node_id、ip、port信息。

查找GroupCoordinator的方式为先根据groupId的hash值对__consumers_offsets的分区数取余，得到分区号，然后寻找此分区leader副本所在的broker节点，即这个groupId所对应的GroupCoordinator节点。

消费者groupId最终的分区分配方案及组内消费者提交的消费位移都会提交到查到的broker节点上。

## 第二阶段（JOIN_GROUP）

此阶段消费者会向GroupCoordinator发送JoinGroupRequest请求，请求体包含如下信息：

* group_id：消费组id。
* session_timeout：对应消费者session.timeout.ms，默认10s。当GroupCoordinator超过session_timeout指定的时间没有收到心跳则认为消费者已下线。
* reblance_timeout：对应消费者max.poll.interval.ms，默认5min。表示消费组再平衡时GroupCoordinator等待消费者重新加入的最长时间。
* member_id：GroupCoordinator分配给消费者的id。消费者第一次发送JoinGroupRequest请求时此字段为null。
* protocol_type：消费者实现协议，此处传consumer。
* group_protocols：多个分区分配策略，配置多种策略时包含多个protocol_name和protocol_metadata信息。

### 选举消费者组leader

GroupCoordinator需要为消费组内的消费者选举一个消费组leader，当消费者组还没有leader时，第一个加入的消费者即为消费者组leader，如果leader退出了消费者组就随机选一个消费者作为leader。

### 选举分区分配策略

消费组需要从各个消费者呈报的分配策略中选举出一个策略，由消费者投票选出。具体选举过程如下：

1. 收集各个消费者支持的所有分配策略（partition.assignment.strategy）组成候选集。
2. 每个消费者从候选集中找出第一个支持的的策略并投票。
3. 计算候选集中的策略投票数，选票最多的策略即为当前消费组的分配策略。

分配策略选举完成后Kafka会发送给消费者JoinGroupResponse回执，回执中包含GroupCoordinator中投票选举出的分配策略信息，并且只有leader消费者的回执中包含各个消费者的订阅信息。

## 第三阶段（SYNC_GROUP）

此阶段leader消费者会根据上一个阶段选举出来的分区分配策略进行具体的分区分配，之后通过GroupCorrdinator转发同步分配方案。

所有消费者会向GroupCoordinator发送SyncGroupRequest请求，并且只有leader消费者的请求中携带分区分配方案。

GroupCoordinator会将leader消费者请求中的分区分配策略连同这个消费组的元数据信息存入Kafka的__consumer_offsets主题中。最后发送分区分配方案给各个消费者。

## 第四阶段（HEARTAEAT）

进入此阶段后消费组中的所有消费者就会处于正常工作状态。在开始消费前，消费者需要拉取消息的起始位置，如果之前提交过消费位移则通过OffsetFetchRequest向GroupCoordinator获取上次提交的位移并从此处继续消费。

消费者通过一个独立的心跳线程向GroupCoordinator发送心跳，心跳间隔由heartbeat.interval.ms指定，默认3s。如果一个消费者发生崩溃并停止消费消息，那么GroupCoordinator会等待session.timeout.ms时间确认消费者死亡后触发再均衡。