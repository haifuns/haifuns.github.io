title: Databus简介
author: HAIF.
tags:
  - Databus
categories:
  - 日志挖掘
date: 2021-08-12 21:50:00

---

# 问题引入

在互联网架构中，数据系统通常可以分为真实数据系统以及衍生数据系统。前者作为基础数据库存储用户产生的写操作，后者通常复制自主数据并对数据进行转换或业务处理，提供读取和其他复杂查询操作。

![dataflow](https://haif-cloud.oss-cn-beijing.aliyuncs.com/databus/dataflow.png)

# 数据同步方案

以缓存数据为例，缓存数据来自主数据，当主数据发生变化时，缓存中的数据也需要随之更新。要实现数据同步有两种常用解决方案：应用驱动双写和数据库日志挖掘。

## 应用双写

应用双写指在写数据到DB时，同时写入缓存。但是应用双写存在数据不一致的情况，如下图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/databus/databus-redis.png)

另外，在变更DB后更新缓存时，如果出现操作失败的情况，也有可能造成数据不一致。在需要保证严格数据一致时，使用应用双写策略并不容易实现。

## 日志挖掘

日志挖掘通过提取数据库变更日志实现数据同步，这从根本上解决了数据一致性问题。如下图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/databus/databus-flow.png)

<!-- more -->

# Databus 概述

Databus是LinkedIn于2013年开源的低延迟数据变更抓取系统。Databus支持端到端毫秒级别的延时，每台服务器每秒可处理数千更改事件，同时支持无限回溯并且有丰富的订阅功能。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/databus/databus-usecases.jpg)

如上图所示，搜索引擎和只读副本等系统充当事件消费者，当主OLTP数据库发生写入时，连接到此数据库的中继服务会将更改事件同步给事件消费者，从而实现索引或副本与源数据保持一致。

# Databus 功能特性

- 来源独立：Databus支持Oracle和Mysql两种数据源变更抓取，并且数据变更的抓取独立于数据源，不会对数据源产生影响。
- 可扩展、高可用：Databus可扩展支持数千消费者和事务数据来源，同时保持高度可用。
- 事务按序提交：Databus能保持来源数据库的事务完整性，并按照事务分组和来源提交顺序交付变更事件。
- 低延时、支持多种订阅机制：数据源变更完成后，Databus能在毫秒级别将事务提交给消费者。同时，消费者使用Databus中的服务端过滤功能可以只获取需要的特定数据。
- 无限回溯：Databus支持消费者无限回溯功能。

# Databus 日志挖掘原理

## Mysql 知识回顾

### binlog

Mysql中的二进制日志文件（binary log）记录了对数据库执行更改的所有操作，但是不包含SELECT和SHOW这类操作。

binlog主要有以下几种作用：
- 恢复：通过binlog进行数据恢复。
- 复制：通过复制和执行binlog实现主从同步。
- 审计：通过binlog判断是否有对数据库进行注入的攻击。

binlog的日志格式由binlog_format参数控制，可选格式有STATMENT、ROW、MIXED。区别如下：
- STATMENT：记录日志的逻辑SQL语句，此格式在某些情况下可能会导致主从数据不一致。例如使用rand、uuid等函数，或者使用触发器。另外在使用RC事务隔离级别时会出现丢失更新的现象从而导致主从数据不一致。
- ROW：记录表的行更改情况。
- MIXED：以上两种格式混用。

> 在使用Databus时，binlog_format需要设置为ROW模式。

### 主从同步

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/databus/mysql-replication.png)

## Databus日志挖掘方式

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/databus/databus-replication.png)

# Databus 整体架构

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/databus/databus-as-a-service.png)

Databus系统的构成如上图所示，其中包括中继（Relay）、Bootstrap服务和客户端库。Bootstrap服务中包括Bootstrap Producer和Bootstrap Server。消费者从Relay中获取最新事件，如果一个消费者的数据更新大幅落后，就需要到Bootstrap Producer里获取，提交给它的将会是自消费者上次处理变更之后的所有数据变更快照。

Databus Relay的主要功能包括：
1. 从数据来源读取变更行，并在内存缓存内将其序列化为Databus变更事件。
2. 监听来自Databus客户端（包括Bootstrap Producer）的请求，并传输新的Databus数据变更事件。

Databus Client的功能主要包括：
1. 获取Relay上新的数据变更事件，并执行特定业务逻辑的回调。
2. 如果落后Relay太多，向Bootstrap Server发起查询。
3. 新Databus客户端会向Bootstrap Server发起Bootstrap启动查询，然后切换到向Relay发起查询，以完成最新的数据变更事件。
4. 单一客户端可以处理整个Databus数据流，或者可以成为消费者集群的一部分，其中每个消费者只处理一部分流数据。

Databus Bootstrap Producer的功能主要包括：
1. 检查Relay上的新数据变更事件。
2. 将变更存储在MySQL数据库中。
3. MySQL数据库供Bootstrap和客户端使用。

Databus Bootstrap Server的功能主要包括：

1. 监听来自Databus客户端的请求，并返回长期回溯数据变更事件。

# Databus Relay

Databus Relays主要功能如下：
1. 从源数据库中的读取变化的行并序列化为Databus中的更改事件保存在内存缓冲区中。
2. 监听Databus客户端的请求，并将Databus中的更改事件传输到客户端。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/databus/databus-relays.png)

## Event Producer

Event Producer会轮询数据库并读取源数据中变更的行然后转换为[Apache Avro](https://avro.apache.org/docs/current/)记录。

从JDBC RowSets到AvroRecords的转换是根据存储在Schema Registry中的Avro Schemas完成的，然后AvroRecords被序列化成Databus事件。

## Event Buffers

Databus Relays中有一个或多个Circular Buffer 循环事件缓冲区（内存或mmap内存映射文件），用于按系统更改号（SCN）递增的顺序存储数据总线事件。每个缓冲区对应一个SCN稀疏索引，以及一个MaxSCN读写器，MaxSCN读写器会定时保存Relays中的SCN最大值。Relays通过netty channel接收客户端请求，并由Request Processor处理。

> SCN（System Change Number）即事件序列号，占64位，其中高32位表示binlog文件编号，低32位表示binlog文件偏移量，这种实现方式在Mysql主节点发生变化（如DBA执行了reset master命令将binlog文件和偏移量重置）会导致逻辑序列被重置，简单的解决方案是只清理日志。在Mysql5.6.5+版本中增加了唯一全局事务id（GTID），使用ServerId + GTID作为SCN是一种更好的选择。

## Databus Relay HA

Databus Relay除了可以监听主库消费数据外，还可以进行监听其他Databus Relay进行链式消费。直接监听主库的Relay为领导者，监听领导者的Relay为跟随者。

Databus依靠[Apache Helix](http://helix.apache.org/)进行集群管理。Helix是一种通用的集群管理框架，用于自动管理托管在节点集群上的分区，复制和分布式资源。Helix提供以下功能：

* 将资源/分区自动分配给节点
* 节点故障检测和恢复
* 动态添加资源
* 动态添加节点到集群
* 可插拔分布式状态机通过状态转换来管理资源的状态
* 自动负载均衡和过渡节流

# Databus Clients

Databus Clients负责拉取Relays中的事件，处理后发送给感兴趣的消费者。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/databus/databus-clients.png)

* Relay Puller：负责从Relay拉取数据，具体工作有挑选Relay，请求Source，请求Register，校验Schema，设置Dispatcher等。
* Bootstrap Puller：负责从Bootstrap servers拉取数据，功能类似Relay Puller。
* Dispatcher：从event buffers中读取事件，调用消费逻辑的回调，主要职责有：
    * 判断回调是否正确，回调失败后会进行重试，重试次数超限后抛出异常
    * 监控错误和超时
    * 持久化checkpoint
* Checkpoint persistence Provider：checkpoint是消费者消费变更记录点的位置，负责将checkpoint持久化到本地，保证下次启动后可以从正常的位置pull event。
* Event Callback：调用消费者自定义业务逻辑代码。

## Databus Client HA

Databus支持动态客户端负载均衡，当新的客户端加入或脱离集群时，分区动态重新分配给集群中所有客户端实例。集中写入的cheakpoint（通过Helix写到zookeeper）可以保证分区在客户端无缝移动。

# 开源日志挖掘方案Databus&Canal对比


对比项 | Databus | Canal
---|---|---
开源公司 | linkedin（13年开源，已停止维护，其内部转用brooklin） | alibaba（14年开源，最后更新时间4个月前）
数据源 | MySQL、Oracle | MySQL（内部支持Oracle）
日志解析方式 | open-replicator（开源） | Build-in（自研）
订阅/同步方式 | （美团支持订阅方式：Mafka、RabbitMQ、Thrift、Http、Zebra）| 官方同步Adapter ：Kafka、RocketMQ、HBase、RDB（MySQL/Oracle/PostgreSQL/SQLServer）、ES
Server | relay可以同时服务多个client | 一个server instance只能服务一个clinet（受限于server端保存拉取位点）
Client | client可以拉取多个relay变更，访问的relay可以指定获取某些表某些分片的变更 | client只能从一个server拉取变更，而且只能拉取全量变更
可扩展性 | client支持线性扩展，支持动态分片 | client不支持扩展
可用性 |relay和client都支持集群模式，relay故障时主备切换，client故障时动态重新分配分区。relay可以订阅mysql主库或者从库不关心其主从角色 | server和client都是主备模式，主挂备用接管。可以自动切换Mysql主从库
监控 | 提供JMX监控 | 支持prometheus监控

# 参考文献

- [Databus架构分析与初步实践（for mysql）（上篇）](https://sq.163yun.com/blog/article/173552201158811648)
- [Open sourcing Databus: LinkedIn's low latency change data capture system](https://engineering.linkedin.com/data-replication/open-sourcing-databus-linkedins-low-latency-change-data-capture-system)
- [github/linkedin/databus/wiki](https://github.com/linkedin/databus/wiki)