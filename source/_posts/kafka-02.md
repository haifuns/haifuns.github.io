title: 【Kafka】：生产者
author: Haif.
tags:
  - Kafka
categories:
  - 消息中间件
date: 2021-05-22 20:00:00

---

# 概述

Kafka Producer负责向Kafka发送消息，最新的客户端为Java语言编写，但Kafka社区有提供其他语言的客户端，包括C/C++、Python、Go等。

Kafka Producer支持三种消息发送模式：发后即忘、同步发送、异步发送。

<!-- more -->

# 代码示例

```java
public class KafkaProducerTest {

    public static void main(String[] args) {
        Properties properties = new Properties();
        properties.put("key.serializer","org.apache.kafka.common.serialization.StringSerializer");
        properties.put("value.serializer","org.apache.kafka.common.serialization.StringSerializer");
        properties.put("bootstrap.servers", "192.168.40.134:9092");

        // 配置生产者实例
        KafkaProducer<String, String> producer = new KafkaProducer<>(properties);

        // 构建消息
        ProducerRecord<String, String> record = new ProducerRecord<>("topic-demo", "hello kafka");

        // 发送消息
        producer.send(record);

        producer.close();
    }
}
```

# 核心组件

* ProducerInterceptors：拦截器。
* Partitioner：分区器，决定消息路由到哪个分区。默认分区器会对key进行哈希（MurmurHash2算法），根据哈希值计算分区号，如果key为空则轮询发送。
* Metadata：缓存broker集群元数据，Topic -> Partitions（Leader+Follwers，ISR）。懒加载，初始化时不会拉取元数据而是在发送消息时拉取指定topic元数据。
    * metadata.max.age.ms：元数据刷新时间，默认5min
* Serializer：序列化器。
    * key.serializer：key序列化器
    * value.serializer：value序列化器
* RecordAccumulator：消息累加器。
    * buffer.memory：缓冲区内存大小，默认32M
    * batch.size：每个批次内存大小，默认16K
    * linger.ms：批次未满时每隔多久发送一次，默认0
    * request.timeout.ms：请求超时时间，默认30s
    * max.block.ms：缓冲区满后阻塞时间
* NetworkClient：网络通信。
    * connections.max.idle.ms：网络连接最大空闲时间，默认9min
    * reconnect.backoff.ms：重连时间间隔，默认50ms
    * send.buffer.bytes：socket发送缓冲区大小，默认128k
    * receive.buffer.bytes：socket接收缓冲区大小，默认32k
    * compression.type：消息压缩方式，默认为none不压缩
* Sender：发送线程。
    * max.request.size：每个请求最大大小，默认1M
    * acks：指定消息需要多少个follower同步成功认为发送成功，默认1（只要leader写入成功就认为成功）
    * retries：重试次数
    * retry.backoff.ms：每次重试间隔时间
    * request.timeout.ms：producer等待请求响应的最长时间，默认30s
    * max.in.flight.requests.per.connection：客户端在单个连接上能够发送的未响应请求的个数，默认5

# 消息发送流程

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/kafka/kafka03.png)

消息发送流程：

1. 回调自定义的拦截器。（图示步骤1）
2. 同步阻塞等待获取Topic元数据（无缓存需要获取）。
3. 序列化Key、Value数据转换为Byte[]。（图示步骤2）
4. 基于获取到的Topic元数据，使用Partitioner获取消息对应分区。（图示步骤3）
5. 检查要发送的消息是否超出请求最大大小以及内存缓冲最大大小。
6. 将消息添加到RecordAccumulator消息累加器中。（图示步骤4）
7. 设置自定义的Callback回调函数以及对应的Intercepor。
8. 如果某个分区对应的Batch满了，或者新创建了一个Batch就唤醒Sender线程发送消息。（图示步骤5）
9. Sender将Batch封装成ProduceRequest。（图示步骤6）
10. 在发送Kafka前，消息还会保存在InFlightRequests中，然后发往服务端。（图示步骤7、8）
11. 在服务端响应后调用Callback和Intercepor，清理InFlightRequests和RecordAccumulator中的缓存消息。（图示步骤9、10、11）

> 流程中涉及的InFlightRequests主要用来缓存已经发送出去但是还没有收到响应的请求。还可以获得LeastLoadedNode即所有Node中的最小负载，未确认的请求越多则认为负载越大。LeastLoadedNode的概念可以用于比如元数据请求、消费者组播协议的交互，避免因网络拥堵等异常而影响整体进度。