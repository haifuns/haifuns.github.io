title: 【Kafka】：控制器
author: HAIF.
tags:
  - Kafka
categories:
  - 消息中间件
date: 2021-06-06 13:38:00

---

# 概述

在Kafka集群中会有一个或多个broker，其中有一个broker会被选举为控制器（Kafka Controller），控制器负责整个集群中所有分区和副本的状态。当某个分区的leader副本出现故障时，由控制器负责为该分区选举出新的leader副本。当检测到某个分区的ISR集合发生变化时，由控制器负责通知所有broker更新元数据信息。当使用kafka-topic.sh脚本为topic增加分区数量时，还是由控制器负责分区的重新分配。

<!-- more -->

# 控制器选举

Kafka中的控制器选举依赖于zookeeper，broker启动时会尝试读取/controller临时节点的brokerid的值，如果读取到的brokerid值不为-1，则表示已经有其他broker节点成功竞选为控制器，如果zookeeper中不存在/controller节点或者这个节点的数据异常，那么broker会尝试创建/controller节点。竞选失败的broker节点会保存当前控制器的brokerid（activeControllerId）。每个broker会对/controller节点添加监听器来监听此节点的数据变化。当/controller节点的数据变化时，每个broker都会更新自身内存中的activeControllerId。如果broker在数据变更之前是控制器，变更后自身的brokerId与新的activeControllerId不一致，那么就需要“退位”，关闭相应的资源。

zookeeper还有一个/controller-epoch的持久节点，用于记录控制器发生变更的次数，称为控制器纪元，kafka通过controller_epoch来保证控制器的唯一性。

具有控制器身份的broker比普通broker多以下职责：

* 监听分区相关的变化。包含处理分区重分配、处理ISR集合变更、处理优先副本的选举。
* 监听主题相关的变化。包含处理主题增减、处理删除主题。
* 监听broker相关的变化。处理broker增减的变化。
* 从zookeeper读取当前所有主题、分区、broker有关的信息的管理。监听主题的分区分配变化。
* 启动并管理分区状态机和副本状态机。
* 更新集群的元数据信息。
* 如果参数auto.leader.rebalance.enable为true，还会启动一个定时任务负责维护分区的优先副本均衡。

控制器在选举成功后会读取zookeeper中各个节点的数据来初始化并管理上下文信息（ControllerContext）。比如为某个主题增加了分区，控制器负责创建分区的同时会更新上下文信息，并且需要将变更信息同步到其他broker节点中。不管是监听器触发的事件，还是定时任务触发的事件，或者是其他事件，都会读取或更新控制器中的上下文信息，Kafka的控制器使用单线程基于事件队列的模型，对每个事件进行一层封装，然后按照事件发生的先后顺序暂存到LinkedBlockingQueue中，最后使用一个专用的线程（ControllerEventThread）按照FIFO的原则处理事件。

# 分区leader选举

分区leader副本的选举由控制器负责，当创建分区或分区上线时都需要执行leader的选举动作，对应的策略为OfflinePartitionLeaderElectionStratrgy。这种策略的基本思路是按照AR集合中的副本顺序查找第一个存活对象，并且这个副本在ISR集合中。一个分区的AR集合在分配的时候被指定并且只要不发生重分配，集合内部副本的顺序是保持不变的，而分区的ISR集合的副本可能会改变。如果ISR集合中没有可用的副本，那么此时还要再检查一下unclean.leader.election.enable参数（默认false），如果参数配置为true那么表示允许从非ISR列表中的选举leader，从AR列表找到第一个存活对象副本即为leader。

当分区重分配时也会执行leader的选举动作，对应的策略为ReassignPartitionElectionStrategy。此策略的思路为从重分配的AR列表中找到第一个存活的副本，且这个副本在ISR列表中。

当发生优先副本选举时，直接将优先副本设置为leader即可，AR集合中的第一个副本即为优先副本（PreferredReplicaPartitionLeaderElectionStrategy）。

