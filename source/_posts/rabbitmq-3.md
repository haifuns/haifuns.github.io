title: RabbitMQ 存储&告警&流控&镜像队列
author: Haif.
tags:
  - RabbitMQ
categories:
  - 消息中间件
date: 2020-12-26 16:30:00
copyright: true

---

# 存储机制

不管是持久化的消息还是非持久化的消息都可以被写入到磁盘。持久化的消息在到达队列时就被写入到磁盘，并且如果可以，持久化的消息也会在内存中保存一份备份，这样可以提高一定的性能，当内存吃紧的时候会从内存中清除。非持久化的消息一般只保存在内存中，在内存吃紧的时候会被换入到磁盘中，以节省内存空间。这两种类型的消息的落盘处理都在RabbitMQ 的"持久层"中完成。

持久层是一个逻辑上的概念，实际包含两个部分队列索引(rabbit_queue_index) 和消息存储 (rabbit_msg_store)。

* rabbit_queue_index 负责维护队列中落盘消息的信息，包括消息的存储地点、是否已被交付给消费者、是否已被消费者 ack 等。
* rabbit_msg_store 以键值对的形式存储消息，它被所有队列共享，在每个节点中有且只有一个。rabbit_msg_store 具体还可以分为：
    * msg_store_persistent 负责持久化消息的持久化，重启后消息不会丢失。
    * msg_store_transient 负责非持久化消息的持久化，重启后消息会丢失。

<!-- more -->

消息(包括消息体、属性和 headers) 可以直接存储在 rabbit_queue_index 中，也可以被保存在rabbit_msg_store 中。默认在 `$RABBITMQ_HOME/var/lib/mnesia/rabbit@$HOSTNAME/` 路径下包含 queues 、msg_store_persistent 、msg_store_transient 文件夹，其分别存储对应的信息。

最佳的配备是较小的消息存储在 rabbit_queue_index 中而较大的消息存储在rabbit_msg_store 中。这个消息大小的界定可以通过 `queue_index_embed_msgs_below`
来配置，默认大小为 4096 B。注意这里的消息大小是指消息体、属性及 headers 整体的大小。当一个消息小于设定的大小阈值时就可以存储在 rabbit_queue_index 中，这样可以得到性能上的优化。

rabbit_queue_index 中以顺序(文件名从0开始累加) 的段文件来进行存储，后缀为".idx"，每个段文件中包含固定的 *SEGMENT_ENTRY_COUNT* 条记录，
*SEGMENT_ENTRY_COUNT* 默认值为 16384 。每个 rabbit_queue_index 从磁盘中读取消息的时候至少要在内存中维护一个段文件，所以设置 `queue_index_embed_msgs_below` 值的时候要格外谨慎，一点点增大也可能会引起内存爆炸式的增长。

经过 rabbit_msg_store 处理的所有消息都会以追加的方式写入到文件中，当文件的大小超过指定的限制(file_size_limit) 则关闭这个文件再创建一个新的文件以供新的消息写入。文件名(文件后缀是".rdq") 开始进行累加。因此文件名最小的文件也是最老的文件。
* 在进行消息的存储时，RabbitMQ 会在 ETS (Erlang Term Storage) 表中记录消息在文件中的位置映射(Index)和文件的相关信息(FileSummary)。
* 在读取消息的时候，先根据消息的 ID (msg_id) 找到对应存储的文件，如果文件存在并且未被锁住，则直接打开文件，从指定位置读取消息的内容。如果文件不存在或者被锁住了，则发送请求由 rabbit_msg_store 进行处理。

消息的删除只是从 ETS 表删除指定消息的相关信息，同时更新消息对应的存储文件的相关信息。执行消息删除操作时，并不立即对在文件中的消息进行删除，也就是说消息依然在文件中，仅仅是标记为垃圾数据而己。当一个文件中都是垃圾数据时可以将这个文件删除。当检测到前后两个文件中的有效数据可以合并在一个文件中，并且所有的垃圾数据的大小和所有文件(至少有3个文件存在的情况下)的数据大小的比值超过设置的阈值 *GARBAGE_FRACTION* (默认值为 0.5) 时才会触发垃圾回收将两个文件合并。

## 队列的结构

通常队列由 rabbit_amqqueue_process 和backing_queue 这两部分组成：

* rabbit_amqqueue_process 负责协议相关的消息处理，即接收生产者发布的消息、向消费者交付消息、处理消息的确认(包括生产端的 confirm 和消费端的 ack)。
* backing queue 是消息存储的具体形式和引擎，并向 rabbit_amqqueue_process 提供相关的接口以供调用。

如果消息投递的目的队列是空的，并且有消费者订阅了这个队列，那么该消息会直接发送给消费者，不会经过队列这一步。而当消息无法直接投递给消费者时，需要暂时将消息存入队列，以便重新投递。消息存入队列后，不是固定不变的，它会随着系统的负载在队列中不断地流动，消息的状态会不断发生变化。RabbitMQ中的队列消息可能会处于以下4 种状态：
1. alpha: 消息内容(包括消息体、属性和 headers) 和消息索引都存储在内存中
2. beta: 消息内容保存在磁盘中，消息索引保存在内存中
3. gamma: 消息内容保存在磁盘中，消息索引在磁盘和内存中都有
4. delta: 消息内容和索引都在磁盘中

对于持久化的消息，消息内容和消息索引都必须先保存在磁盘上，才会处于上述状态中的gamma 状态的消息是只有持久化的消息才会有的状态。

RabbitMQ 在运行时会根据统计的消息传送速度定期计算一个当前内存中能够保存的最大消息数量 (target_ram_count) ，如果 alpha 状态的消息数量大于此值时，就会引起消息的状态转换，多余的消息可能会转换到 beta 状态、gamma 状态或者 delta 状态。

区分这状态的主要作用是满足不同的内存和 CPU 需求：
* alpha 状态最耗内存，但很少消耗 CPU；
* delta 状态基本不消耗内存，但是需要消耗更多的 CPU 和磁盘I/O 操作。delta 状态需要执行两次I/O 操作才能读取到消息，一次是读消息索引(从 rabbit_queue_index 中)，一次是读消息内容(从 rabbit_msg_store 中)；
* beta 和gamma 状态都只需要一次I/O 操作就可以读取到消息(从 rabbit_msg_store 中)；

对于普通的没有设置优先级和镜像的队列来说， backing_queue 的默认实现是rabbit_variable_queue，其内部通过5 个子队列 Q1、Q2、Delta、Q3、Q4 来体现消息的各个状态。整个队列包括 rabbit_amqqueue_process、backing_queue 的各个子队列。

队列的结构可以参考下图：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-queue.png)

其中：

* Q1、Q4 只包含 alpha 状态的消息
* Q2、Q3 包含 beta 和 gamma 状态的消息
* Delta 只包 delta 状态的消息

一般情况下，消息按照 Q1 -> Q2 -> Delta -> Q3 -> Q4 这样的顺序步骤进行流动，但并不是每一条消息都一定会经历所有的状态，这个取决于当前系统的负载状况。从 Q1 至 Q4 基本经历内存到磁盘，再由磁盘到内存这样的一个过程，如此可以在队列负载很高的情况下，能够通过将部分消息由磁盘保存来节省内存空间，而在负载降低的时候，这部分消息又渐渐回到内存被消费者获取，使得整个队列具有很好的弹性。

消费者获取消息也会引起消息的状态转换。当消费者获取消息时

1. 首先会从 Q4 中获取消息，如果获取成功则返回。如果 Q4 空，则尝试从Q3 中获取消息。
2. 系统首先会判断 Q3 是否为空
    - 如果为空，返回队列为空，即此时队列中无消息。
    - 如果 Q3 不为空，则取出 Q3 中的消息，进而再判断此时 Q3 和 Delta 中的长度
        - 如果都为空，则可以认为 Q2、Delta、Q3、Q4 全部为空，此时将 Q1 中的消息直接转移至Q4，下次直接从 Q4 中获取消息。
        - 如果 Q3 为空， Delta 不为空，则将 Delta 消息转移至 Q3 中，下次可以直接从 Q3 中获取消息。

在将消息从 Delta 转移到 Q3 过程中是按照索引分段读取的，首先读取某一段，然后判断读取的消息的个数与 Delta 消息的个数是否相等，如果相等，则可以判定此时 Delta 中已无消息 ，则直接将 Q2 刚读取到的消息一并放入到 Q3 中。如果不相等，仅将此次读取到的消息转移到 Q3。

这里就有两处疑问:

**为什么 Q3 为空则可以认定整个队列为空？**

**为什么 Q3 Delta 为空时，则可以认为 Q2 Delta Q3 Q4 全部为空？**

试想一下，

* 如果 Q3 为空，Delta 不为空，那么在 Q3 取出最后一条消息的时候，Delta 上的消息就会被转移 Q3，这样与 Q3 为空矛盾；
* 如果 Delta 为空且 Q2 不为空，则在 Q3 取出最后一条消息时会将 Q2 的消息并入到 Q3 ，这样 Q3 也与 Q3 为空矛盾；
* 在 Q3 取出 最后一条消息之后，如果 Q2、Delta、Q3 都为空，且 Q1 不为空时，则 Q1 的消息会被转移到 Q4 这与 Q4 为空矛盾。

通常在负载正常时，如果消息被消费的速度不小于接收新消息的速度，对于不需要保证可靠不丢失的消息来说，极有可能只会处于 alpha 状态。对于 durable 属性设置为 true 的消息，它一定会进入 gamma 状态，并且在开启 publisher confirm 机制时，只有到了 gamma 状态时才会确认该消息已被接收，若消息消费速度足够快、内存充足，这些消息也不会继续走到下一个状态。

在系统负载较高时，已接收到的消息若不能很快被消费掉，这些消息就会进入到很深的队列中去，这样会增加处理每个消息的平均开销。因为要花更多的时间和资源处理"堆积"的消
息，如此用来处理新流入的消息的能力就会降低，使得后流入的消息又被积压到很深的队列中继续增大处理每个消息的平均开销，继而情况变得越来越恶化，使得系统的处理能力大大降低。

应对这一问题一般有3 种措施：

1. 增加 prefetch_count 的值，即一次发送多条消息给消费者，加快消息被消费的速度；
2. 采用 multiple ack，降低处理 ack 带来的开销；
3. 流量控制，详细内容可以参考下文[流控](#流控)；

## 惰性队列

RabbitMQ 从3.6.0 版本开始引入了惰性队列(Lazy Queue)的概念。惰性队列会尽可能地将消息存入磁盘中，而在消费者消费到相应的消息时才会被加载到内存中，它的一个重要的设计目标是能够支持更长的队列即支持更多的消息存储。当消费者由于各种各样的原因(比如消费者下线、岩机或者由于维护而关闭等)致使长时间 内不能消费消息而造成堆积时，惰性队列就很有必要了。

默认情况下，当生产者将消息发送到 RabbitMQ 的时候，队列中的消息会尽可能地存储在内存之中，这样可以更加快速地将消息发送给消费者。即使是持久化的消息，在被写入磁盘的同时也会在内存中驻留一份备份。当 RabbitMQ 需要释放内存的时候，会将内存中的消息换页至磁盘中，这个操作会耗费较长的时间，也会阻塞队列的操作，进而无法接收新的消息。

惰性队列会将接收到的消息直接存入文件系统中，而不管是持久化的或者是非持久化的，这样可以减少了内存的消耗，但是会增加I/O 的使用，如果消息是持久化的，那么这样的I/O 操作不可避免，惰性队列和持久化的消息可谓是"最佳拍档"。注意如果惰性队列中存储的是非持久化的消息，内存的使用率会一直很稳定，但是重启之后消息一样会丢失。

队列具备两种模式: default 和 lazy 。默认的为 default 模式，在 3.6.0 之前的版本无
须做任何变更。lazy 模式即为惰性队列的模式，可以通过调用 channel.queueDeclare 方法的时候在参数中设置，也可以通过 Policy 的方式设置，如果一个队列同时使用这两种方式设置，那么 Policy 的方式具备更高的优先级。如果要通过声明的方式改变已有队列的模式，那么只能先删除队列，然后再重新声明一个新的。

在队列声明的时候可以通过 `x-queue-mode` 参数来设置队列的模式，取值为 default 和lazy 。下面示例演示了一个惰性队列的声明细节：

```java
Map<String, Object> args = new HashMap<String, Object>();
args.put("x-queue-mode", "lazy");
channel.queueDeclare("myqueue", false, false, false, args);
```

对应的 Policy 设置方式为:

```
$ rabbitmqctl set_policy Lazy "^myqueue$" '{"queue-mode":"lazy"}' --apply-to queues
```

> 惰性队列和普通队列相比，只有很小的内存开销。这里很难对每种情况给出一个具体的数
> 值，但是我们可以类比一下:发送1 千万条消息，每条消息的大小为1 KB，并且此时没有任何的消费者，那么普通队列会消耗 1.2GB 的内存，而惰性队列只消耗1.5MB 的内存。

> 据官方测试数据显示，对于普通队列，如果要发送1 千万条消息，需要耗费 801 秒，平均发送速度约为 13000 条/秒。如果使用惰性队列，那么发送同样多的消息时，耗时是 421 秒，平均发送速度约为 24000 条/秒。出现性能偏差的原因是普通队列会由于内存不足而不得不将消息换页至磁盘。如果有消费者消费时，惰性队列会耗费将近 40M 的空间来发送消息，对于一个消费者的情况，平均的消费速度约为 14000 条/秒。

# 内存及磁盘告警

当内存使用超过配置的阈值或者磁盘剩余空间低于配置的阈值时，RabbitMQ 都会暂时阻塞(block)客户端的连接(Connection)，并停止接收从客户端发来的消息，以此避免服务崩溃。与此同时，客户端与服务端的心跳检测也会失效。可以通过 `rabbitmqctl list_connections` 命令或者Web 管理界面来查看它的状态。

被阻塞的 Connection 的状态要么是 blocking ，要么是 blocked 。前者对应于并不试图发送消息的 Connection ，比如消费者关联的 Connection ，这种状态下的 Connection 可以继续运行。而后者对应于一直有消息发送的 Connection ，这种状态下的 Connection 会被停止发送消息。

注意在一个集群中，如果 Broker 节点的内存或者磁盘受限，都会引起整个集群中所有的Connection 被阻塞。

理想的情况是当发生阻塞时可以在阻止生产者的同时而又不影响消费者的运行。但是在 *AMQP* 协议中，一个信道 (Channel) 上可以同时承载生产者和消费者，同一个 Connection 中也可以同时承载若干个生产者的信道和消费者的信道，这样就会使阻塞逻辑错乱，虽然大多数情况下并不会发生任何问题，但还是建议生产和消费的逻辑可以分摊到独立的 Connection 之上而不发生任何交集。客户端程序可以通过添加 BlockedListener 来监昕相应连接的阻塞信息。

## 内存告警

RabbitMQ 服务器会在启动或者执行 `rabbitmqctl set_vm_memory_high_watermark fraction` 命令时计算系统内存的大小。默认情况下 vm_memory_high_watermark 的值为 0.4，即内存阈值为 0.4，表示当 RabbitMQ 使用的内存超过 40% 时，就会产生内存告警并阻塞所有生产者的连接。一旦告警被解除(有消息被消费或者从内存转储到磁盘等情况的发生)，一切都会恢复正常。

默认情况下将 RabbitMQ 所使用内存的阈值设置为 40%，这并不意味着此时 RabbitMQ 能使用超过 40% 的内存，这仅仅只是限制了 RabbitMQ 消息生产者。在最坏的情况下，Erlang 的垃圾回收机制会导致两倍的内存消耗，也就是 80% 的使用占比。

> 如果设置fraction 为0 ，所有的生产者都会被停止发送消息，这个功能可以适用于需要集群中所有消息发布的情况。正常情况下建议 vm_memory_high_watermark 取值在 0.4 到 0.66 之间，不建议取值超过 0.7。

内存阈值可以通过 rabbitmq.config 配置文件来配置，下面示例中设置了默认的内存阈值为 0.4:

```shell
# 1. 按比例配置
[
    {
        rabbit, [
            {vm_memory_high_watermark, 0.4}
        ]
    }
].

# 2. 设置内存阈值的绝对值（默认单位B，1024 MB = 1024 * 1024 * 1024 = 1073741824 B）
[
    {
        rabbit, [
            {vm_memory_high_watermark, {absolute, 1073741824}}
        ]
    }
].

# 3. 设置单位内存阈值
[
    {
        rabbit, [
            {vm_memory_high_watermark, {absolute, "1024M"}}
        ]
    }
].

# 可用单位：
# k, kiB: kibibytes (2^10 bytes)
# M, MiB: mebibytes (2^20)
# G, GiB: gibibytes (2^30)
# kB: kilobytes (10^3)
# MB: megabytes (10^6)
# GB: gigabytes (10^9)
```

与此配置对应的 rabbitmqctl 系列的命令为：

```
# 1. 按比例
$ rabbitmqctl set_vm_memory_high_watermark {fraction}

# 2. 按绝对值
$ rabbitmqctl set_vm_memory_high_watermark absolute {memory_limit}
```

在服务器重启之后使用命令方式所设置的阈值会失效，而通过配置文件的方式设置的阈值则不会在重启之后失效，但是修改后的配置需要在重启之后才能生效。

在某个 Broker 节点触及内存并阻塞生产者之前，它会尝试将队列中的消息换页到磁盘以释放内存空间。持久化和非持久化的消息都会被转储到磁盘中，其中持久化的消息本身就在磁盘中有1 份副本，这里会将持久化的消息从内存中清除掉。

默认情况下，在内存到达内存阐值的 50% 会进行换页动作。也就是说，在默认的内存阈值为 0.4 的情况下，当内存超过 0.4 * 0.5 = 0.2 时会进行换页动作。可以通过在配置文件中配置
`vm_memory_high_watermark_paging_ratio` 项来修改此值，下面示例中将换页比率从默认的 0.5 修改为 0.75：

```shell
[
    {
        rabbit, [
            {vm_memory_high_watermark_paging_ratio, 0.75},
            {vm_memory_high_watermark, 0.4}
        ]
    }
].
```

上面的配置会在 RabbitMQ 存使用率达到 0.3 时进行换页动作，并在 40% 时阻塞生产者。可以将 `vm_memory_high_watermark_paging_ratio` 值设置为大于1 的浮点数，这种配置相当于禁用了换页功能。注意这里 RabbitMQ 中并没有类似 rabbitmqctl vm_memory_high_watermark_paging_ratio {xxx} 的命令。

如果 RabbitMQ 无法识别所在的操作系统，那么在启动的时候会在日志文件中追加一些信息，并将内存的值假定为 1GB 相应的日志信息参考如下：

```
Unknown total memory size for your OS {unix,magic_homebrew_os}. Assuming memory size is 1024MB.
```

对应 `vm_memory_high_watermark` 为 0.4 的情形来说，RabbitMQ 的内存阈值就约为 410MB。如果操作系统本身的内存大小为 8GB ，可以将 `vm_memory_high_watermark` 设置3 ，这样内存阁值就提高到了 3GB。

## 磁盘告警

当剩余磁盘空间低于确定的阈值时，RabbitMQ 同样会阻塞生产者，这样可以避免因非持久化的消息持续换页而耗尽磁盘空间导致服务崩溃。默认情况下，磁盘阈值为 50MB，这意味着当磁盘剩余空间低于 50MB 时会阻塞生产者并停止内存中消息的换页动作。这个阈值的设置可以减小但不能完全消除因磁盘耗尽而导致崩溃的可能性，比如在两次磁盘空间检测期间内，磁盘空间从大于 50MB 被耗尽到 0MB。一个相对谨慎的做法是将磁盘阈值设置为与操作系统所显示的内存大小一致。

Broker 节点启动的时候会默认开启磁盘检测的进程，相对应的服务日志为：

```
Disk free limit set to 50MB
```

对于不识别的操作系统而言，磁盘检测功能会失效，对应的服务日志为：

```
Disabling disk free space monitoring
```

RabbitMQ 会定期检测磁盘剩余空间，检测的频率与上一次执行检测到的磁盘剩余空间大小有关。正常情况下，每 10 秒执行一次检测，随着磁盘剩余空间与磁盘阈值的接近，检测频率会有所增加。当要到达磁盘阈值时，检测频率为每秒 10 次，这样有可能会增加系统的负载。

可以通过在配置文件中配置 `disk_free_limit` 项来设置磁盘阈值。下面示例中将磁盘阈值设置为 1G 左右：

```shell
[
    {
        rabbit, [
            {disk_free_limit, 1000000000}
        ]
    }
].

# 单位设置
[
    {
        rabbit, [
            {disk_free_limit, "1GB"}
        ]
    }
].
```

还可以参考机器内存的大小为磁盘阈值设置一个相对的比值。比如将磁盘阈值设置为与集群内存一样大：

```shell
[
    {
        rabbit, [
            {disk_free_limit, {mem_relative, 1.0}}
        ]
    }
].
```

与绝对值和相对值这两种配置对应的 rabbitmqctl 系列的命令为: `rabbitmqctl set_disk_free_limit {disk_limit}` 和 `rabbitmqctl set_disk_free_limit mem_relative {fraction}`，和内存阈值的设置命令一样，Broker 重启之后将会失效。同样，通过配置文件的方式设置的阈值则不会在重启之后失效，但是修改后的配置需要在重启之后才能生效。正常情况下，建议相对内存比值取值为1.0 和2.0 之间。

# 流控

RabbitMQ 可以对内存和磁盘使用量设置阈值，当达到阈值后，生产者将被阻塞(block)直到对应项恢复正常。除了这两个阈值，从 2.8.0 版本开始，RabbitMQ 还引入了流控 (*Flow Control*) 机制来确保稳定性。流控机制是用来避免消息的发送速率过快而导致服务器难以支撑的情形，内存和磁盘告警相当于全局的流控 (*Global Flow Control*) ，一旦触发会阻塞集群中所有的 Connection ，而本节的流控是针对单个 Connection 的，可以称之为 *Per-Connection Flow Control* 或者 *Intemal Flow Control* 。

## 流控原理

Erlang 进程之间并不共享内存(binary类型的除外)，而是通过消息传递来通信，每个进程都有自己的进程邮箱(mailbox) 。默认情况下 Erlang 并没有对进程邮箱的大小进行限制，所以当有大量消息持续发往某个进程时，会导致该进程邮箱过大，最终内存溢出并崩溃。RabbitMQ 中，如果生产者持续高速发送，而消费者消费速度较低时，如果没有流控，很快就使内部进程邮箱的大小达到内存阀值。

RabbitMQ 使用了一种基于信用证算法 (credit-based algorithm) 的流控机制来限制发送消息的速率以解决前面所提出的问题，它通过监控各个进程的进程邮箱，当某个进程负载过高而来不及处理消息时，这个进程的进程邮箱就会开始堆积消息。当堆积到一定量时，就会阻塞而不接收上游的新消息。从而慢慢地，上游进程的进程邮箱也会开始堆积消息。当堆积到一定量时也会阻塞而停止接收上游的消息，最后就会使负责网络数据包接收的进程阻塞而暂停接收新的数据。


以下图为例，进程A 接收消息并转发至进程B ，进程B 接收消息并转发至进程C 。每个进程中都有一对关于收发消息的credit 值。以进程B 为例， {% raw %}{{credit_from, C}, value}{% endraw %} 表示能发送多少条消息给C ，每发送一条消息该值减 1，当为 0 时，进程B 不再往进程C 发送消息也不再接收进程 A 的消息。 {% raw %}{{credit_to, A}, value}{% endraw %} 表示再接收多少条消息就向进程A 发送增加 credit 值的通知，进程A 接收到该通知后就增加 {% raw %}{{credit_from, B}, value}{% endraw %} 所对应的值，这样进程A 就能持续发送消息。当上游发送速率高于下游接收速率时，credit 
值就会被逐渐耗光，这时进程就会被阻塞，阻塞的情况会一直传递到最上游。当上游进程收到来自下游进程的增加 credit 值的通知时，若此时上游进程处于阻塞状态则解除阻塞，开始接收更上游进程的消息，一个个传导最终能够解除最上游的阻塞状态。由此可知，基于信用证的流控机制最终将消息发送进程的发送速率限制在消息处理进程的处理能力范围之内。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-flowcontrol1.png)

一个连接 (Connection) 触发流控时会处于 "flow" 的状态，也就意味着这个 Connection 的状态每秒在 blocked 和unblocked 之间来回切换数次，这样可以将消息发送的速率控制在服务器能够支撑的范围之内。可以通过 `rabbitmqctl_list_connections` 命令或者 Web 管理页面来查看Connection 状态。

处于 flow 状态的 Connection 和处于 running 状态的 Connection 并没有什么不同，这个状态只是告诉系统管理员相应的发送速率受限了，而对于客户端而言，它看到的只是服务器的带宽要比正常情况下要小一些。

流控机制不只是作用于Connection ，同样作用于信道(Channel)和队列。从Connection 到Channel，再到队列，最后是消息持久化存储形成一个完整的流控链，对于处于整个流控链中的任意进程，只要该进程阻塞，上游的进程必定全部被阻塞，也就是说，如果某个进程达到性能瓶颈，必然会导致上游所有的进程被阻塞。所以我们可以利用流控机制的这个特点找出瓶颈之所在。处理消息的几个关键进程及其对应的顺序关系如下图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-flowcontrol2.png)

其中的各个进程如下所述：

* rabbit_reader: Connection 的处理进程，负责接收、解析 AMQP 协议数据包等；
* rabbit_channel: Channel 的处理进程，负责处理 AMQP 协议的各种方法、进行路由解析等；
* rabbit_amqqueue_process: 队列的处理进程，负责实现队列的所有逻辑；
* rabbit_msg_store: 负责实现消息的持久化；

当某个 Connection 处于 flow 状态，但这个 Connection 没有一个 Channel 处于 flow 状态时，这就意味这个 Connection 中有一个或者多个 Channel 出现了性能瓶颈。某些 Channel 程的运作(比如处理路由逻辑)会使得服务器 CPU 的负载过高从而导致了此种情形。尤其是在发送大量较小的非持久化消息时，此种情形最易显现。

当某个 Connection 处于 flow 状态，并且这个 Connection 中也有若干个 Channel 处于 flow 状态，但没有任何一个对应的队列处于 flow 状态时，这就意味着有一个或者多个队列出现了性能瓶颈。这可能是由于将消息存入队列的过程中引起服务器 CPU 负载过高，或者是将队列中的消息存入磁盘的过程中引起服务器I/O 负载过高而引起的此种情形。尤其是在发送大量较小的持久化消息时，此种情形最易显现。

当某个 Connection 处于 flow 状态，同时这个 Connection 中也有若干个 Channel 处于 flow
状态，并且也有若干个对应的队列处于 flow 状态时，这就意味着在消息持久化时出现了性能瓶颈。在将队列中的消息存入磁盘的过程中引起服务器 I/O 负载过高而引起的此种情形。尤其是在发送大量较大的持久化消息时，此种情形最易显现。

# 镜像队列

如果 RabbitMQ 集群是由多个 Broker 节点组成的，那么从服务的整体可用性上来讲，该集群对于单点故障是有弹性的，但是同时也需要注：尽管交换器和绑定关系能够在单点故障问题上幸免于难，但是队列和其上的存储的消息却不行，这是因为队列进程及其内容仅仅维持在单个节点之上，所以一个节点的失效表现为其对应的队列不可用。

引入镜像队列 (Mirror Queue) 的机制，可以将队列镜像到集群中的其他 Broker 节点之上，如果集群中的一个节点失效了，队列能自动地切换到镜像中的另一个节点上以保证服务的可用性。在通常的用法中，针对每一个配置镜像的队列(以下简称镜像队列)都包含一个主节点(master) 和若干个从节点(slave)，相应的结构可以参考下图：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-mirror-queue.png)

slave 会准确地按照 master 执行命令的顺序进行动作，故slave 与master 上维护的状态应该是相同的。如果master 由于某种原因失效，那么"资历最老"的slave 会被提升为新的 master。根据slave 加入的时间排序，时间最长的slave即为"资历最老"。发送到镜像队列的所有消息会
被同时发往master 和所有的slave 上，如果此时master 挂掉了，消息还会在slave 上，这样slave 提升为master 的时候消息也不会丢失。除发送消息(Basic.Publish) 外的所有动作都只会向master 发送，然后再由master 将命令执行的结果广播给各个slave。

如果消费者与slave 建立连接并进行订阅消费，其实质上都是从master 上获取消息。比如消费者与slave 建立了TCP 连接之后执行一个 Basic.Get 的操作，那么首先是由slave 将 Basic.Get 请求发往master ，再由master 准备好数据返回给slave ，最后由slave 投递给消费者。

> 这里大多的读写压力都落到了master 上，是否负载会做不到有效的均衡？或者说是否可以像 MySQL 一样能够实现master 写而slave 读呢？注意这里的master 和slave 是针对队列而言的，而队列可以均匀地散落在集群的各Broker 节点中以达到负载均衡的目的，因为真正的负载还是针对实际的物理机器而言的，而不是内存中驻留的队列进程。

注意要点：

RabbitMQ 的镜像队列同时支持 publisher confirm 和事务两种机制。在事务机制中，只有当前事务在全部镜像中执行之后，客户端才会收到Tx.Commit-Ok 的消息。同样的，在publisher confirm 机制中生产者进行当前消息确认的前提是该消息被全部进行所接收了。

不同于普通的非镜像队列，镜像队列的 backing_queue 比较特殊，其实现并非是 `rabbit_variable_queue`，它内部包裹了普通 backing_queue 进行本地消息消息持久化处理，在此基础上增加了将消息和ack 复制到所有镜像的功能。镜像队列的结构可以参考下图，master 的backing_queue 采用的是 `rabbit_mirror_queue_master`，而slave 的backing queue 实现是 `rabbit_mirror_queue_slave`。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-mirror-queue2.png)

所有对 `rabbit_mirror_queue_master` 的操作都会通过组播 GM (Guaranteed Multicast) 的方式同步到各个slave 中。GM 负责消息的广播，`rabbit_mirror_queue_slave` 负责回调处理，而 master 上的回调处理是由 coordinator 负责完成的，如前所述，除了Basic.Publish，所有的操作都是通过master 来完成的，master 消息进行处理的同时将消息的处理通过 GM 广播给所有的 slave，slave GM 收到消息后，通过回调交由
`rabbit_mirror queue_slave` 进行实际的处理。

GM 模块实现的是一种可靠的组播通信协议，该协议能够保证组播消息的原子性，即保证组中活着的节点要么都收到消息要么都收不到，它的实现大致为：

将所有的节点形成一个循环链表，每个节点都会监控位于自己左右两边的节点，当有节点新增时，相邻的节点保证当前广播的消息会复制到新的节点上，当有节点失效时，相邻的节点会接管以保证本次广播的消息会复制到所有的节点。在master 和slave 上的这些 GM 形成一个组(gm_group)，这个组的信息
会记录在Mnesia 中。不同的镜像队列形成不同的组。操作命令从master 对应的GM 发出后，顺着链表传送到所有的节点。由于所有节点组成了一个循环链表，master 对应的GM 最终会收
到自己发送的操作命令，这个时候master 就知道该操作命令都同步到了所有的slave 上。

当slave 挂掉之后，除了与slave 相连的客户端连接全部断开，没有其他影响。当master 挂掉之后，会有以下连锁反应：

1. 与master 连接的客户端连接全部断开；
2. 选举最老的slave 作为新的master ，因为最老的slave 与旧的master 之间的同步状态应该是最好的。如果此时所有slave 处于未同步状态，则未同步的消息会丢失；
3. 新的master 重新入队所有 unack 的消息，因为新的slave 无法区分这些unack 的消息是否已经到达客户端，或者是ack 信息丢失在老的master 链路上，再或者是丢失在老的master 组播ack 消息到所有slave 的链路上，所以出于消息可靠性的考虑，重新入队所有unack 的消息，不过此时客户端可能会有重复消息；
4. 如果客户端连接着slave ，并且Basic.Consume 消费时指定了 `x-cancel-on-ha-failover` 参数，那么断开之时客户端会收到一个 Consumer Cancellation Notification 的通知，消费者客户端中会回调Consumer 接口的handleCancel 方法。如果未指定 `x-cancel-on-ha-failover` 参数，那么消费者将无法感知master 宕机；

镜像队列的配置主要是通过添加相应的Policy 来完成的，

```
rabbitmqctl set_policy [-p vhost] [--priority priority] [--apply-to apply-to) {name} {pattern} {definition}
```

命令中的definition 部分，对于镜像队列的配置来说，需要包含3 个部分：ha-mode、ha-params 和ha-sync-mode。

* ha-mode：指明镜像队列的模式，有效值为all、exactly、nodes，默认为all；
    * all 表示在集群中所有的节点上进行镜像；
    * exactly 表示在指定个数的节点上进行镜像，节点个数由 ha-params 指定；
    * nodes 表示在指定节点上进行镜像，节点名称通过 ha-params 指定，节点的名称通常类似于rabbit@hostname ，可以通过`rabbitmqctl cluster_status`命令查看到；
* ha-params：不同的 ha mode 配置中需要用到的参数；
* ha-sync-mode：队列中消息的同步方式，有效值为automatic 和manual；

举个例子，对队列名称以 “queue_” 开头的所有队列进行镜像，并在集群的两个节点上完成镜像，Policy 的设置命令为：
```
rabbitmqctl set_policy --priority 0 --apply-to queues mirror_queue "^queue_" '{"ha-mode":"exactly","ha-params":2,"ha-sync-mode":"automatic"}'
```

ha-mode 参数对排他队列并不生效，因为排他队列是连接独占的，当连接断开时队列会自动删除，所以实际上这个参数对排他队列没有任何意义。

将新节点加入已存在的镜像队列时，默认情况下 ha-sync-mode 取值为 manual，镜像队列中的消息不会主动同步到新的 slave 中，除非显式调用同步命令。当调用同步命令后，队列开始阻塞，无法对其进行其他操作，直到同步完成。当 ha-sync-mode 设置为 automatic 时，新加入的 slave 会默认同步已知的镜像队列，由于同步过程的限制，所以不建议对生产环境中正在使用的队列进行操作。使用 `rabbitmqctl list_queues {name} slave_pids synchronised_slave_pids` 命令可以查看哪些 slaves 已经完成同步。通过手动方式同步一个队列的命令为 `rabbitrnqctl sync_queue {name}` ，同样也可以取消某个队列的同步操作: `rabbitmqctl cancel_sync_queue {name}`。

当所有 slave 都出现未同步状态，并且 `ha-promote-on-shutdown` 设置为 `when-synced`
(默认)时，如果 master 因为主动原因停掉，比如通过 `rabbitmqctl stop` 命令或者优雅关闭操作系统，那么 slave 不会接管 master ，也就是此时镜像队列不可用；但是如果 master 因为被动原因停掉，比如 Erlang 虚拟机或者操作系统崩溃，那么 slave 会接管 master。这个配置项隐含的价值取向是保证消息可靠不丢失，同时放弃了可用性。如果`ha-promote-on-shutdown` 设置为always ，那么不论 master 因为何种原因停止，slave 都会接管 master，优先保证可用性，不过消息可能会丢失。

镜像队列中最后一个停止的节点会是 master ，启动顺序必须是 master 先启动。如果 slave 先启动，它会有 30 秒的等待时间，等待 master 的启动，然后加入到集群中。如果 30 秒内 master
没有启动，slave 会自动停止。当所有节点因故(断电等)同时离线时，每个节点都认为自己不是最后一个停止的节点，要恢复镜像队列，可以尝试在 30 秒内启动所有节点。