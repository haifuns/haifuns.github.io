title: RabbitMQ 基础
author: Haif.
tags:
  - RabbitMQ
categories:
  - 消息中间件
date: 2019-07-15 20:30:00
copyright: true
---

# 消息中间件

消息 (Message) 是指在应用间传送的数据。消息可以非常简单，比如只包含文本字符串、 JSON 等，也可以很复杂，比如内嵌对象。

消息队列中间件 (Message Queue Middleware，简称为 MQ) 是指利用高效可靠的消息传递 机制进行与平台无关的数据交流，并基于数据通信来进行分布式系统的集成。通过提供消息传递和消息排队模型，它可以在分布式环境下扩展进程间的通信。

消息队列中间件，也可以称为消息队列或者消息中间件。它一般有两种传递模式:点对点 (P2P, Point-to-Point) 模式和发布/订阅 (Pub/Sub) 模式。

## 中间件作用

- 解耦
- 冗余（存储）
- 扩展性
- 削峰
- 可恢复性
- 顺序保证
- 缓冲
- 异步通信

# 特点

* 可靠性：RabbitMQ使用机制保证可靠性，如持久化、传输确认以及发布确认等
* 灵活的路由：通过交换器路由消息到队列
* 扩展性：可集群
* 高可用性： 队列可以在集群中的机器上设置镜像，使得在部分节点出现问题的情况下队列仍然可用（镜像集群：不同队列消息同步）
* 多种协议： 除了原生支持 AMQP 协议，还支持 STOMP， MQTT 等
* 多语言客户端：如 Java、 Python、 Ruby、 PHP、 C#、 JavaScript 等。
* 管理界面：提供了一个易用的用户界面，使得用户可以监控和管理消息、集群中的节点等。（rabbitmq_management插件）
* 插件机制：插件丰富可扩展

# 安装

<!-- more -->

* 安装Erlang

第一步，解压安装包（可在[官网][1]下载安装），并配置安装目录，这里我们预备安装到/opt/erlang 目录下:
```shell
[root@hidden -)# tar zxvf otp_src_19.3.tar.gz 
[root@hidden -)# cd otp src 19.3 
[root@hidden otp src_19.3)# ./configure --prefix=/opt/er1ang 
```
第二步，如果出现类似关键报错信息: No curses library functions found。那么此时需要安装 ncurses，安装步骤(遇到提示输入 y 后直接回车即可)如下:
```shell
[root@hidden otp_src_19.3)# yum install ncurses-devel
```
第三步，安装 Erlang:
```shell
[root@hidden otp_src_19.3)# make
[root@hidden otp_src_19.3)# make install
```
第四步，修改/etc/profile 配置文件，添加下面的环境变量:

```shell
ERLANG HOME=/opt/erlang
export PATH=PATH:ERLANG HOME/bin
export ERLANG_HOME
```
最后执行如下命令让配置文件生效:
```shell
[root@hidden otp_src_19.3) # source /etc/profile
```
可以输入 erl 命令来验证 Erlang 是否安装成功，如果出现类似以下的提示即表示安装成功:
```shell
[root@hidden -)# erl
Erlang/OTP 19 [erts-8.1) [source) [64-bit) [smp:4 : 4) [async-threads : 10) [hipe) [kernel-poll:false) 
Eshell V8 . 1 (abort with ^G ) 
1>
```
* 安装RabbitMQ

[官网][2]下载地址

这里选择将 RabbitMQ 安装到/opt
```shell
[root@hidden -]# tar zvxf rabbitmq-server-generic-unix-3.6.10.tar.gz -C /opt
[root@hidden - ]# cd lopt
[root@hidden -]# mv rabbitmq_server-3.6.10 rabbitmq
```
同样修改/etc/profile 文件 添加下面的环境变量
```
export PATH=$PATH : /opt/rabbitmq/sbin
export RABBITMQ HOME=/opt/rabbitmq
```
之后执行 source /etc/profile 命令让配置文件生效。
运行 RabbitMQ
```shell
rabbitmq-server -detached
```
rabbitmq-server 命令后面添加一个 "-detached" 参数是为了能够让RabbitMQ服务以守护进程的方式在后台运行，这样就不会因为当前 Shell 窗口的关闭而影响服务。
运行 `rabbitmqctl status` 命令查看 RabbitMQ 是否正常启动:
```
[root@hidden -]# rabbitmqctl status
```shell
`rabbitmqctl cluster_status` 命令来查看集群信息，目前只有一个 RabbitMQ 服务节点，可以看作单节点
的集群
```shell
[root@hidden -]# rabbitmqctl cluster_status
```

# 相关概念

> RabbitMQ 整体上是一个生产者与消费者模型，主要负责接收、存储和转发消息。

* Producer: 生产者，就是投递消息的一方。
* Consumer: 消费者， 就是接收消息的一方。
* Broker: 消息中间件的服务节点。
* Queue: 队列，是 RabbitMQ 的内部对象，用于存储消息。
  * 多个消费者可以订阅同一个队列，这时队列中的消息会被平均分摊（Round-Robin，即轮询） 给多个消费者进行处理，而不是每个消费者都收到所有的消息并处理
* Exchange: 交换器。
    - fanout：把所有发送到该交换器的消息路由到所有与该交换器绑定的队列中。
    - direct：把消息路由到那些 BindingKey 和 RoutingKey完全匹配的队列中。
    - headers：不依赖于路由键的匹配规则来路由消息，而是根据发送的消息内容中的 headers 属性进行匹配。
    - topic：将消息路由到 BindingKey 和 RoutingKey 相匹配的队 列中，但这里的匹配规则有些不同，它约定:
    
      * RoutingKey 为一个点号"."分隔的字符串(被点号"."分隔开的每一段独立的字符 串称为一个单词 )，如com.rabbit.client
      * BindingKey 和 RoutingKey 一样也是点号"."分隔的字符串
      * BindingKey 中可以存在两种特殊字符串"*"和"#"，用于做模糊匹配，其中"*"用于匹配一个单词，"#"用于匹配多规格单词(可以是零个)。

- RoutingKey: 路由键。生产者将消息发给交换器的时候， 一般会指定一个 RoutingKey，用 来指定这个消息的路由规则，而这个 RoutingKey 需要与交换器类型和绑定键 (BindingKey) 联合使用才能最终生效。

- Binding: 绑定。 RabbitMQ 中通过绑定将交换器与队列关联起来，在绑定的时候一般会指定一个绑定键 (BindingKey)。

# 代码示例

> hello world demo

* 引入依赖
```
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-amqp</artifactId>
    </dependency>
```
* 生产消费消息
```java
@Slf4j
public class RabbitProducer {

    public static void main(String[] args) throws IOException, TimeoutException {
        ConnectionFactory factory = new ConnectionFactory();
        factory.setHost("59.110.240.***");
        factory.setPort(5672);
        factory.setUsername("admin");
        factory.setPassword("admin");
        // 创建连接
        Connection connection = factory.newConnection();
        // 创建信道
        Channel channel = connection.createChannel();
        // 创建交换器 type="direct"、持久化、非自动删除
        channel.exchangeDeclare("exchange_demo","direct", true, false, null);
        // 创建队列 持久化、非排他、非自动删除
        channel.queueDeclare("queue_demo",true, false, false, null);
        // 交换器与队列通过路由键绑定
        channel.queueBind("queue_demo", "exchange_demo", "routingKey_demo");
        // 可绑定多个队列
        // channel.queueBind("queue_demo2", "exchange_demo", "routingKey_demo");
        // 发送持久化消息
        channel.basicPublish("exchange_demo", "routingKey_demo", MessageProperties.PERSISTENT_TEXT_PLAIN, "hello world".getBytes());
        channel.close();
        connection.close();
        log.info("send message to mq down!");
    }
}

@Slf4j
public class RabbitConsumer {
    public static void main(String[] args) throws IOException, TimeoutException, InterruptedException {
        Address[] addresses = new Address[]{
                new Address("59.110.240.***",5672)
        };
        ConnectionFactory factory = new ConnectionFactory();
        factory.setUsername("admin");
        factory.setPassword("admin");
        Connection connection = factory.newConnection(addresses);
        // 创建信道
        Channel channel = connection.createChannel();
        // 设置客户端最多接收未被ack的消息个数
        channel.basicQos(64);
        Consumer consumer = new DefaultConsumer(channel) {
            @Override
            public void handleDelivery(String consumerTag, Envelope envelope, AMQP.BasicProperties properties, byte[] body) throws IOException { 
                log.info("receive message:{}", new String(body));

                // 手动应答
                channel.basicAck(envelope.getDeliveryTag(), false);

                // 手动拒绝，(消息标记，multi多条，requeue重新入队)
                // channel.basicNack(envelope.getDeliveryTag(), false, false);
                // 拒绝单条
                // channel.basicReject(envelope.getDeliveryTag(), false);
            }
        };
        
        // 回调
        channel.basicConsume("queue_demo", consumer);
        TimeUnit.SECONDS.sleep(5);
        channel.close();
        connection.close();
    }
}
```

# 运转流程

无论是生产者还是消费者，都需要和RabbitMQ Broker建立TCP 连接，也就是Connection 。客户端紧接着可以创建AMQP 信道(Channel) ，每个信道都会被指派一个唯一的ID。信道是建立在Connection之上的虚拟连接， RabbitMQ 处理的每条AMQP指令都是通过信道完成。(复用TCP连接，减少性能开销,便于管理)

## 生产者发送消息

1. 生产者连接到RabbitMQ Broker，建立一个连接(Connection)，开启一个信道(Channel)
2. 生产者声明一个交换器，并设置相关属性，比如交换机类型、是否持久化等
3. 生产者声明一个队列并设置相关属性，比如是否排他、是否持久化、是否自动删除等
4. 生产者通过路由键将交换器和队列绑定起来
5. 生产者发送消息至RabbitMQ Broker，其中包含路由键、交换器等信息
6. 相应的交换器根据接收到的路由键查找相匹配的队列
7. 如果找到，则将从生产者发送过来的消息存入相应的队列中
8. 如果没有找到，则根据生产者配置的属性选择丢弃还是回退给生产者
9. 关闭信道
10. 关闭连接

## 消费者接收消息

1. 消费者连接到RabbitMQ Broker ，建立一个连接(Connection ) ，开启一个信道(Channel)
2. 消费者向RabbitMQ Broker 请求消费相应队列中的消息，可能会设置相应的回调函数，
以及做一些准备工作
3. 等待RabbitMQ Broker 回应并投递相应队列中的消息， 消费者接收消息
4. 消费者确认( ack) 接收到的消息
5. RabbitMQ 从队列中删除相应己经被确认的消息
6. 关闭信道
7. 关闭连接

# 进阶

## Exchange

* durable: 设置是否持久化。durable设置为true表示持久化，反之是非持久化。持久化可以将交换器存盘，在服务器重启的时候不会丢失相关信息。
* autoDelete: 设置是否自动删除。autoDelete 设置为true则表示自动删除。自动删除的前提是至少有一个队列或者交换器与这个交换器绑定， 之后所有与这个交换器绑定的队列或者交换器都与此解绑。注意不能错误地把这个参数理解为: "当与此交换器连接的客户端都断开时， RabbitMQ 会自动删除本交换器" 。
* internal: 设置是否是内置的。如果设置为true，则表示是内置的交换器，客户端无法直接发送消息到这个交换器中，只能通过交换器路由到交换器这种方式。
* argument: 其他一些结构化参数 alternate-exchange:备份交换器

## Queue

* durable: 设置是否持久化。为true则设置队列为持久化。持久化的队列会存盘，在服务器重启的时候可以保证不丢失相关信息。
* exclusive: 设置是否排他。为true则设置队列为排他的。如果一个队列被声明为排他队列，该队列仅对首次声明它的连接可见，并在连接断开时自动删除。这里需要注意三点:排他队列是基于连接(Connection)可见的，同一个连接的不同信道(Channel)是可以同时访问同一连接创建的排他队列; "首次"是指如果一个连接己经声明了一个排他队列，其他连接是不允许建立同名的排他队列的，这个与普通队列不同:即使该队列是持久化的，一旦连接关闭或者客户端退出，该排他队列都会被自动删除，这种队列
适用于一个客户端同时发送和读取消息的应用场景。
* autoAck: 是否自动确认，当autoAck 等于false时， RabbitMQ会等待消费者显式地回复确认信号后才从内存(或者磁盘)中移去消息(实质上是先打上删除标记，之后再删除) 。当autoAck 等于true时， RabbitMQ 会自动把发送出去的消息置为确认，然后从内存(或者磁盘)中删除，而不管消费者是否真正地消费到了这些消息。
* autoDelete: 设置是否自动删除。为true则设置队列为自动删除。自动删除的前提是:至少有一个消费者连接到这个队列，之后所有与这个队列连接的消费者都断开时，才会自动删除。不能把这个参数错误地理解为: "当连接到此队列的所有客户端断开时，这个队列自动删除"，因为生产者客户端创建这个队列，或者没有消费者客户端与这个队列连接时，都不会自动删除这个队列。
* argurnents: 设置队列的其他一些参数，如
    * x-message-ttl:过期时间
    * x-expires:自动删除前处于未使用状态的时间
    * x-max-length/x-max-length-bytes:最大消息长度/总量(当队列中的消息要超过队列限制时，将失效队首元素)
    * x-dead-letter-exchange、x-deadletter-routing-key: 死信
    * x-max-priority:优先级

## Message

当消息无法被路由时，可以通过设置mandatory/immediate将消息返回给生产者。还可以设置alternate-exchange参数，将消息储存在备份交换器（Altemate Exchange），而不返回客户端。

* mandatory

当mandatory参数设为true 时，交换器无法根据自身的类型和路由键找到一个符合条件
的队列，那么RabbitMQ会调用Basic.Return命令将消息返回给生产者。当mandatory 参
数设置为false 时，出现上述情形，则消息直接被丢弃。

* immediate

当immediate 参数设为true 时，如果交换器在将消息路由到队列时发现队列上并不存在
任何消费者，那么这条消息将不会存入队列中。当与路由键匹配的所有队列都没有消费者时，
该消息会通过Basic.Return 返回至生产者。

## TTL

Time to Live，即过期时间，消息在队列中生存时间超过TTL时可能会变成死信

* 设置方式
 
    * 队列属性设置，x-message-ttl参数，单位`毫秒`
    * 对消息单独设置（1、2两种方式同时使用时以数值小的为准）
    
* x-expires:控制队列被自动删除前处于未使用状态的时间

## 死信队列

DLX ，全称为Dead-Letter-Exchange ，可以称之为死信交换器

消息变成死信一般是由于以下几种情况:
1. 消息被拒绝(Basic.Reject/Basic.Nack)，并且设置requeue参数为false;
2. 消息过期;
3. 队列达到最大长度;

## 延迟队列

AMQP/Rabbitmq未提供此功能，但是可以通过TTL&DLX模拟延迟队列功能，设置TTL并且订阅死信队列。

## RPC实现

一般在RabbitMQ 中进行RPC是很简单。客户端发送请求消息，服务端回复响应的消息。为了接收响应的消息，需要在请求消息中发送一个回调队列,可以使用默认的队列，参考下面代码中的replyTo。

```java
String callbackQueueName = channel.queueDeclare().getQueue();
BasicProperties props = new BasicProperties .Builder().replyTo(callbackQueueName).build();
channel.basicPubish("","rpc queue",props,message.getBytes()) ;
// then code to read a response message from the callback_queue...
```

* replyTo:通常用来设置回调队列

* correlationId:用来关联请求(request) 和其调用RPC之后的回复(response)。

RabbitMQ官方 RRC[客户端][3]&[服务端][4]调用样例

## 持久化

* Excahnge

durable=true

* Queue

durable=true

* Message

BasicProperties 中deliveryMode属性;deliveryMode=1代表不持久化，deliveryMode=2代表持久化。

## 生产者确认

### 事务机制

* channel.txSelect:客户端将信道置为事务模式;
* channel.tx.Select-Ok:Broker确认己将信道置为事务模式:
* channel.txCommit:客户端提交事务;
* channel.tx.Commit-Ok:Broker确认事务提交;
* channel.txRollback:客户端提交事务回滚;
* channel.txRollback-Ok:Broker确认事务回滚;

代码示例:
```java
try {
	channel.txSelect();
	channel.basicPublish(exchange, routingKey, MessageProperties.PERSISTENT_TEXT_PLAIN, msg.getBytes());
	int result = 1 / 0;
	channel.txCommit();
} catch (Exception e) {
	e.printStackTrace();
	channel.txRollback();
}
```

事务确认流程：

![Image text](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-tx-commit.png)

事务回滚流程：

![Image text](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-tx-rollback.png)

### 发送方确认机制（publisher confirm）

生产者通过调用channel.confirmSelect将信道设置成confirm(确认)模式，一旦信道进入confirm模式，所有在该信道上面发布的消息都会被指派一个唯一的ID从l开始)，一旦消息被投递到所有匹配的队列之后，RabbitMQ就会发送一个确认(Basic.Ack) 给生产者(包含消息的唯一ID)，这就使得生产者知晓消息已经正确到达了目的地了。如果消息和队列是可持久化的，那么确认消息会在消息写入磁盘之后发出。RabbitMQ 回传给生产者的确认消息中的delivery Tag包含了确认消息的序号， 此外RabbitMQ也可以设置channel.basicAck方法中的multiple参数，表示到这个序号之前的所有消息都己经得到了处理。

相比之下，发送方确认机制优势在于它是异步的，如果RabbitMQ因为自身内部错误导致消息丢失，就会发送一条nack （Basic.Nack) 命令，生产者应用程序同样可以在回调方法中处理该nack 命令。

代码示例：
```java
try {
	channel.confirmSelect() ; //将信道置为publisher confirm模式
	//之后正常发送消息
	channel.basicPublish( "exchange" , "routingKey" , null , "publisher confirm test".getBytes());
	if(!channel.waitForConfirms()) {
		System.out.println("send message failed");
		// do something else..
	}
} catch (InterruptedException e){ 
	e.printStackTrace() ;
}

//异步confirm
try{
    channel.confirmSelect() ;
    channel.addConfirmListener(new ConfirmListener() {
    
    	//Basic.Ack
    	public void handleAck(long deliveryTag , boolean multiple) throws IOException {
    		//deliveryTag:消息唯一有序序号
    		System.out.println("Nack, SeqNo : " + deliveryTag + ", multiple : " + multiple);
    		// multiple=false一条, true多条
    		if (multiple) {
    			// unconfirm有序集合 SortedSet
    			confirmSet.headSet(deliveryTag - 1).clear();
    		} else {
    			confirmSet.remove(deliveryTag);
    		}
    	}
    
    	//Basic.Nack
    	public void handleNack(long deliveryTag, boolean multiple) throws IOException {
    		if (multiple) {
    			confirmSet.headSet (deliveryTag - 1).clear();
    		} else {
    			confirmSet.remove(deliveryTag) ;
    		}
    		// 消息重发
    	}
    });
} catch (InterruptedException e){ 
	e.printStackTrace() ;
}
```

发送方确认机制：

![Image text](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-confirm.png)

## 消息可靠性

消息可靠传输一般是业务系统接入消息中间件时首先需要考虑的问题,一般消息中间件的消息传输保障分为三个层次：

* At most once: 最多一次。消息可能会丢失，但绝不会重复传输。
* At least once: 最少一次。消息绝不会丢失，但可能会重复传输。
* Exactly once: 恰好一次。每条消息肯定会被传输一次且仅传输一次。

rabbitmq可以支持其中的“最多一次”和“最少一次”。

最少一次投递需要考虑以下几方面内容：

1. 消息生产者需要开启事务机制或者发送方确认机制，保证消息可靠的传输到mq
2. 生产者配合使用mandatory参数或者备份数据库来确认消息能从交换器路由到队列
3. 消息和队列进行持久化处理
4. 消费者手动确认，autoAck=false



[1]: https://www.erlang.org/downloads
[2]: https://www.rabbitmq.com/download.html
[3]: https://github.com/rabbitmq/rabbitmq-tutorials/blob/master/java/RPCClient.java
[4]: https://github.com/rabbitmq/rabbitmq-tutorials/blob/master/java/RPCServer.java