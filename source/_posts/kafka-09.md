title: 【Kafka】：高级应用
author: HAIF.
tags:
  - Kafka
categories:
  - 消息中间件
date: 2021-06-06 13:42:00

---

# 事务

## 幂等

Kafka支持幂等功能来避免生产者重试时重复写入消息，开启方式为生产者客户端参数enable.idempotence设置为true（默认为false）。幂等性功能开启需要配合以下参数：

* 如果显示设置retries则必须大于0，未显示指定默认为Integer.MAX_VALUE。
* max.in.flight.requests.per.connection参数不能大于5。
* 如果显示指定了acks，需要保证参数值为-1，不设置Kafka会自行设置。

Kafka的幂等性主要是通过日志格式中RecordBatch的producer id和first sequence两个字段实现，每个生产者在初始化时都会被分配一个pid，对于每个pid，消息发送到的每个分区都有对应的序列号，从0开始递增。生产者每发送一条消息就会将<pid,分区>对应的序列号的值加1。

broker端会为每一个<pid,分区>维护一个序列号。当收到消息时，只有它的序列号的值比维护的序列号大1时，才能正常接收。

<!-- more -->

## 事务

幂等性并不能跨多个分区运作，而事务可以保证对多个分区写入操作的原子性。在需要使用事务时，需要显示设置transactional.id参数为唯一值，并且开启幂等特性。

KafkaProducer提供5种事务相关的方法：

* initTransactions：初始化事务
* beginTransactions：开启事务
* sendOffsetsToTransaction：消费者在事务内的位移提交
* commitTransaction：提交事务
* abortTransaction：终止事务（回滚）

消费端存在参数isolation.level，默认值为read_uncommitted即可以消费未提交的事务，此参数可以设置为read_committd即只能消费已提交的消息。

### 事务实现原理

Kafka事务功能由事务协调器（TransactinoCoordinator）负责处理，TransactionCoordinator会将事务状态持久化到内部主题__transaction_state中。

事务实现原理如下：

1. 查找TransactionCoordinator，broker使用生产者请求中的transactionId的哈希值计算主题__transactino_state分区编号，leader所在broker即为要查找的TransactionCoordinator。
2. 获取pid，生产者发送transactionId到TransactionCoordinator，TransactionCoordinator收到请求后会把transactionId和对应的PID以消息形式保存在主题__transactin_state中。
3. 开启事务，生产者本地标记开启了一个事务，只有在发送第一条消息之后TransactionCoordinator才会认为此事务已经开启。
4. Conusme-Transform-Produce，此阶段包含整个事务的数据处理过程。
    - AddPartitionsToTxnRequest：生产者给新的分区发送数据前，需要先向TransactionCoordinator发送请求将<transactionId,TopicPartition>的对应关系存储到__transaction_state中。
    - ProduceRequest：生产者发送消息到用户自定义的主题中，消息中包含PID、producer_epoch和sequence number信息。
    - AddOffsetsToTxnRequest：sendOffsetsToTransaction方法可以在一个事务批次里处理的消费和发送。
    - TxnOffsetCommitRequest：生产者发送TxnOffsetCommitRequest请求给GroupCoordinator将消费位移信息offsets存储到__consumer_offsets中。
5. 提交或终止事务：生产者通知TransactionCoordinator提交或终止事务。TransactionCoordinator在收到请求后会执行一下操作：
    - 将prepare_commit或prepare_abort消息写到__transaction_state中；
    - 将提交或终止消息写入用户所使用的普通主题和__consumer_offsets中；
    - 将complete_commit或complete_abort消息写到__transaction_state；

# 过期时间（扩展）

消息过期时间功能Kafka本身并没有直接支持，但是我们可以基于消息的timestamp和消费者拦截器实现，在生产端发送消息时设置ttl存放在headers中，消费者拦截器判断消息是否超时。对于超时消息可以配合死信队列使用，即避免了消息丢失也便于进行系统诊断。

# 延时队列（扩展）

对于Kafka的延时队列扩展支持，下面将讨论两种可行方案：基于自定义延时主题；服务端增加前置缓存；

## 基于延时主题

此方案的思路是在发送延时消息时，并不直接投递到真实的主题（real_topic）中，而是先投递到Kafka内部主题（delay_topic），然后通过一个自定义的服务（DelayService）拉取这些内部主题的消息，并将满足条件的消息投递到要发送的真实主题中，消费者订阅的还是真实的主题。

考虑到延时时间一般以秒计，如果要支持2个小时内的延时消息就创建7200个主题将会造成极度的资源浪费。可以按照不同的延时等级划分，比如5s/10s/30/1min/2min/5min/10min/20min/30min/45min/1h/2h，延时消息按照延时时间投递到不同等级的主题中，同一主题的消息延时时间强制转为一致的延时时间，这样只需增加少量主题就能在误差可控情况下实现延时功能。

具体实现上，对于生产者客户端需要进行一定封装，通过生产者拦截器，根据消息的timestamp、headers字段（设置延时时间）对延时消息划分等级发送到对应的内部主题中。

发送到内部主题（delay_topic_*）中的消息会被一个独立的DelayService消费，DelayService进程与Broker进程以一对一配比进行同机部署以保证可用性。对于不同延时级别的主题，DelaySercie内部都有单独的线程进行消息拉取，以及单独的DelayQueue进行消息暂存。DelayService应对主题中每个分区进行计数，当达到一定阈值就暂停该分区消息拉取。同时还会有专门的消息发送线程获取DelayQueue的消息并转发到真实主题中。

## 服务端增加前置缓存

此方案思路为在Kafka服务中增加一个前置缓存，生产者消息正常发送，Kafka在判断是延时消息时（需扩展延时消息协议）就将消息存储在缓存中，待延时操作触发时就将消息发送到真实的主题中。为了保证消息的可靠性，可以引入缓存多副本机制。

此思路需要对Kafka内核源码进行修改，另外需要衡量后期维护成本以及社区福利等问题，一般不适合实际应用。

# 死信队列和重试队列（扩展）

对于死信队列，指由于某些原因无法被正确投递，为了保证消息不丢失，将其置于的一个特殊角色的队列。死信队列可以在broker端存入也可以在客户端存入，可根据实际场景对Kafka进行扩展实现。

重试队列指消费端消费消息失败时，为了防止消息丢失而重新将消息回滚到broker中。重试队列一般分为多个等级，每个等级一般会设置重新投递延时，重试次数越多投递延时就越大，当超过投递次数时，消息就进入死信队列。

