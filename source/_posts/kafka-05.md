title: 【Kafka】：主题与分区
author: Haif.
tags:
  - Kafka
categories:
  - 消息中间件
date: 2021-05-29 23:00:00

---

# 主题管理

## 创建主题

如果broker端配置参数`auto.create.topics.enable`设置为true（默认），当生产者向一个尚未创建的主题发送消息时，会自动创建一个分区数为`num.partitions`（默认1）、副本数为`default.replication.factor`（默认1）的主题。当一个消费者从一个未知主题中读取消息时，或者当任意客户端向未知主题发送元数据请求时，都会按照配置创建一个相应的主题。

不建议将`auto.create.topics.enable`参数设置为true，推荐使用kafka-topic.sh脚本手动创建主题。

示例，创建分区数为4，副本数为3的主题topic-demo：

```shell
$ kafka-topics.sh --zookeeper localhost:2181/kafka --create --topic topic-demo --replication-factor 3 --partitions 4
```

在执行完脚本之后，Kafka会在log.dir或者log.dirs参数所配置的目录下创建相应的主题分区，默认目录为/tmp/kafka-logs。

<!-- more -->

## 查看主题

```shell
$ kafka-topic.sh --zookeeper localhost:2181/kafka -list # 查看当前所有可用主题

$ kafka-topic.sh --zookeeper localhost:2181/kafka -desctibe -- topic topic-create,topic-demo # 查看指定主题详细信息
```

## 修改主题

```shell
$ kafka-topic.sh --zookeeper localhost:2181/kafka --alter --topic topic-config --partitons 3 # 将topic-config分区由1增加到3，注意：不可以减少分区

$ kafka-topic.sh --zookeeper localhost:2181/kafka --alter --topic topic-config --config max.message.bytes=2000 # 修改主题配置信息

$ kafka-topic.sh --zookeeper localhost:2181/kafka --alter --topic topic-config --delete-config max.message.bytes # 删除主题配置
```

## 配置管理

Kafka可以使用kafka-config.sh脚本动态修改配置，alter命名变更、desctibe命令查看。

```shell
$ kafka-topic.sh --zookeeper localhost:2181/kafka --describe --entity-type topics --entity-name topic-config 
                    # --describe 查看指令
                    # --entity-type 指定查看配置实体类型，topics/brokers/clients/users
                    # --entity-name 指定查看配置实体名称
                    
$ kafka-configs.sh --zookeeper localhost:2181/kafka --alter --entity-type topics --entity-name topic-config --add-config cleanup.policy=compact,max.message.bytes=10000 # 覆盖配置

$ kafka-topics.sh --zookeeper localhost:2181/kafka --describe --topic topic-config --topics-with-overrides # 查看被覆盖的配置

$ kafka-configs.sh --zookeeper localhost:2181/kafka --alter --entity-type topics --entity-name topic-config --delete-config cleanup.policy,max.message.bytes # 删除配置
```

## 删除主题

```
$ kafka-topic.sh --zookeeper localhost:2181/kafka --delete --topic topic-delete # 删除主题topic-delete
```

删除主题还有broker端配置参数`delete.topic.enable`有关，只有配置为true时（默认），才能删除主题，否则删除主题操作会被忽略。

使用kafka-topic.sh脚本删除主题本质上只是在zookeeper中的/admin/delete_topics路径下创建一个与带删除主题同名的节点，以此标记主题为待删除状态。与创建主题相同，真正删除主题的操作由Kafka的控制器负责完成。

# 分区管理

## 优先副本选举

分区使用多副本的机制提升可靠性，但是只有leader副本对外提供读写服务，而follower副本只负责在内部进行消息同步。如果分区leader副本不可用，那么整个分区都会不可用，此时Kafka会从剩余的follower副本中挑选一个新的leader副本继续对外提供服务。

为了防止Kafka集群的broker节点遇到故障导致分区漂移从而使集群负载不均衡的情况，Kafka引入了优先副本（preferred replica）的概念。优先副本即AR集合中的第一个副本，理想情况下，优先副本就是分区是的leader副本。Kafka会通过优先副本选举促使优先副本选举为leader副本，促进集群负载均衡，这一行为称为“分区平衡”。

Kafka提供分区自动平衡的功能，对应broker参数`auto.leader.rebaleance.enable`，默认为true。当开启分区自动平衡时，Kafka控制器会开启一个定时任务轮询所有broker节点，计算分区不平衡率（broker不平衡率=非优先副本leader个数/分区总数）是否超过`leader.imbalance.per.broker.percentage`参数配置的值（默认10%），如果超过设定比值就会自动进行分区平衡。

自动分区平衡可能会导致负面的性能问题、客户端阻塞等问题，对于生产环境不建议将分区自动平衡功能开启，而建议使用`kafka-perferred-replica-election.sh`脚本手动对分区leader副本进行分区平衡。

## 分区重分配

当集群中新增broker节点时，只有新创建的主题分区才有可能被分配到这个节点上，而之前的主题并不会自动分配到新加入的节点中，为了解决这样的新节点负载和原先节点的负载不均衡，Kafka支持让分区副本进行再分配，即分区重分配。

Kafka提供`kafka-reassign-partitions.sh`脚本来执行分区重分配工作，可以在集群扩容、broker节点失效的场景下对分区进行迁移。

分区重分配的基本原理是先通过控制器为每个分区添加新副本，新副本将从分区的leader副本复制所有数据，在复制完成后，控制器将旧副本从副本清单里清除完成重分配。

## 复制限流

分区重分配的本质在于数据复制，但是数据复制会占用额外的资源，当重分配的量太大就会影响性能。Kafka支持使用`kafka-config.sh`和`kafka-reassign-partitons.sh`两种方式对副本间的复制流量进行限制。

## 修改副本因子

创建主题之后同样可以修改副本因子（副本数），具体可以通过`kafka-reassign-partition.sh`脚本实现。