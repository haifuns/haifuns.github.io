title: 【Kafka】：副本剖析
author: HAIF.
tags:
  - Kafka
categories:
  - 消息中间件
date: 2021-06-06 13:40:00

---

# 概述

Kafka为分区引入了副本机制，通过增加副本数量提升数据容灾能力以及故障自动转移。

相关概念回顾：

* 副本是相对分区而言的，即副本是特定分区的副本。
* 一个分区包含一个或多个副本，其中一个为leader副本，其余为follower副本，各个副本位于不同的broker节点中。只有leader副本对外提供服务，follower副本只负责数据同步。
* 分区中所有副本统称为AR，而ISR指与leader副本保持同步的副本集合（包含leader）。
* LEO标识每个分区最后一条消息的下一个位置，分区每个副本都有自己的LEO，ISR中最小的LEO即为HW，消费者只能拉取到HW之前的消息。

<!-- more -->

# 失效副本

正常情况下，分区的所有副本都处于ISR集合中。处于同步失效或功能失效的副本会被剥离出ISR集合，称为失效副本，失效副本对应的分区为同步失效分区。

当ISR集合中的follower副本滞后leader副本的时间超过broker端参数replica.lag.time.max.ms参数指定的值（默认1000）就判定为同步失败，此时此broker副本会被剔除ISR集合。具体实现原理为：

1. 当follower副本将leader副本LEO之前的日志全部同步时，则认为此follower副本已经追上leader副本，此时会更新lastCaughtUpTimeMs标识。
2. Kafka的副本管理器存在一个副本过期检测的定时任务，定期检查当前时间与副本的lastCaughtUpTimeMs差值是否大于replica.lag.time.max.ms指定的值。

以下几种情况可能导致副本失效：

* follower副本进程卡住，在一段时间没有向leader副本发起同步请求，比如频繁FullGC。
* follower副本进程同步过慢，在一段时间内无法追上leader副本，比如I/O开销过大。
* 新增加的副本在赶上leader副本之前。

# LEO与HW

对于多副本分区，整个消息追加过程如下：

1. 生产者客户端发送消息到leader副本中。
2. 消息被追加到leader副本的本地日志，并更新日志的偏移量。
3. follower副本向leader副本请求同步数据。
4. leader副本所在的服务器读取本地日志，并更新对应拉取的follower副本的信息。
5. leader副本所在的服务器将拉取结果返回给follower副本。
6. follower副本收到leader副本返回的拉取结果，将消息追加到本地日志中，并更新日志的偏移量信息。

在消息追加过程中各个副本LEO和HW变化情况如下：
1. 生产者一直向leader副本发送消息，某一时刻leader副本LEO>HW。
2. follower副本从leader副本拉取消息，拉取请求中会携带自身LEO信息。
3. leader副本将请求中的LEO最小值作为HW，返回给follower副本相应的信息，并且携带自身HW信息。
4. follower副本写入消息并更新LEO，然后更新自己的HW为min(owner.LEO,leader.HW)。

# Leader Epoch

在follower与leader副本的数据同步过程中，当发生宕机只依靠HW进行恢复可能会造成数据丢失。Kafka引入了leader epoch（leader的纪元信息，相当于一个版本号），在需要截断数据时使用leader epoch作为参考依据而不是HW。

