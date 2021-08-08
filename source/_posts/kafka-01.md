title: 【Kafka】：初识篇
author: Haif.
tags:
  - Kafka
categories:
  - 消息中间件
date: 2021-05-15 09:40:00

---

# 概述

Kafka起初是由LinkedIn公司采用Scala语言开发的一个多分区、多副本且基于ZooKeeper协调的分布式消息系统，现已捐献Apache基金会，定位为一个分布式流式处理平台，以高吞吐、可持久化、可水平扩展、支持流数据处理等多种特性而被广泛使用。

<!-- more -->

# 快速部署

```powershell
$ docker pull wurstmeister/zookeeper
$ docker pull wurstmeister/kafka

$ docker run -d --name=zookeeper -p 2181:2181 --restart always wurstmeister/zookeeper
$ docker run -d --name kafka -p 9092:9092 --restart=always -e KAFKA_BROKER_ID=0 -e KAFKA_ZOOKEEPER_CONNECT=192.168.40.134:2181/kafka -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://192.168.40.134:9092 -e KAFKA_LISTENERS=PLAINTEXT://:9092 --restart always wurstmeister/kafka

$ docker exec -it kafka /bin/bash
bash-4.4$ kafka-topics.sh --zookeeper 192.168.40.134:2181/kafka --create --topic topic-demo  --replication-factor 1 --partitions 4 # 创建主题，副本因子1，分区4
bash-4.4$ kafka-topics.sh --zookeeper 192.168.40.134:2181/kafka --describe --topic topic-demo # 查看主题信息

bash-4.4$ kafka-console-consumer.sh --bootstrap-server 192.168.40.134:9092 --topic topic-demo # 消费消息

# 另一个终端
bash-4.4$ kafka-console-producer.sh --broker-list 192.168.40.134:9092 --topic topic-demo # 发送消息
>hello kafka
```

# 基本概念

典型的Kafka体系架构包含若干Producer、若干Broker、若干Consumer以及一个ZooKeeper集群。如下图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/kafka/kafka01.png)

其中：
* Producer为生产者，负责创建消息并投递到Kafka。
* Consumer为消费者，从Kafka接收消息。
* Broker为服务代理节点，可简单看做是一个Kafka服务实例。
* ZooKeeper负责Kafka集群元数据管理和控制器选举等工作。

Kafka中还有两个重要概念：

1. Topic（主题）：主题是逻辑概念，消息以主题为单位归类，生产者将消息发送到指定主题，消费者订阅主题进行消费。
2. Partition（分区）：分区在存储层面可看作可追加日志文件。同一个主题可以细分为多个分区。同时分区也有多副本机制，leader副本负责处理读写请求，follower副本只负责同步leader消息。
    * AR（Assigned Replicas）：分区中所有副本。AR = ISR + OSR。
    * ISR（In-Sync Replicas）：所有与leader副本保持一定程度同步的副本（包含leader副本）。
      * HW（High Watermark）：高水位，标识特定的消息偏移量（offset），消费者只能拉取到这个offset之前的消息。
      * LEO（Log End Offset）：标识当前日志文件中下一条待写入消息的offset。
    * OSR（Out-of-Sync Replicas）：与leader副本同步滞后过多的副本，此状态的副本无选举资格。

消息在被追加到分区日志文件时会被分配一个唯一的偏移量（offset），用来保证消息在分区内的顺序性。但是offset并不跨区，也就是说Kafka保证的是分区有序而不是主题有序。

如下图所示，日志文件中有9条消息，起始消息offset为0，最后一条为8，offset=9表示下一条待写入的消息。日志文件的HW为6，表示消费者只能拉取到offset在[0,5]的消息。HW及以后的消息消费者不可见。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/kafka/kafka02.png)