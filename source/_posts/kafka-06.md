title: 【Kafka】：日志存储
author: Haif.
tags:
  - Kafka
categories:
  - 消息中间件
date: 2021-05-29 23:10:00

---

# 概述

Kafka中的消息以主题为基本单位进行归类，每个主题可以分为一个或多个分区，不考虑多副本的情况下，一个分区对应一个日志（Log）。

为了防止Log过大、便于消息维护和管理，Kafka引入了日志分段（LogSegment）的概念，将Log切分为多个LogSegment。Log和LogSegment都不是纯粹物理意义上的概念，实际上，Log在物理层面是以文件夹形式存储，而每个LogSegment对应磁盘上的一个日志文件和两个索引文件，以及可能的其他文件。

# 文件目录

Log对应一个命名形式为`<topic>-<partiton>`的文件夹，向Log中追加消息时是顺序写入的，只有最后一个LogSegment才能执行写入操作（称为activeSegment，即当前活跃数据），此前的LogSegment都不能写入数据。随着消息的不断写入，当activeSegment满足一定条件时，就会创建新的activeSegment，之后追加消息到新的activeSegment。

每个LogSegment中的日志文件都对应两个索引文件：

* 偏移量索引文件（.index文件后缀）
* 时间戳索引文件（.timeindex文件后缀）

每个LogSegment都有一个基准偏移量baseOffset，用来表示当前LogSegment中的第一条消息的offset。偏移量是一个64位的长整数，日志文件和两个索引文件都是根据baseOffset命名的，名称固定为20位数字，比如第一个LogSegment的baseOffset为0，对应的日志文件为`00000000000000000000.log`。

<!-- more -->

# 日志格式

## V1版本

Kafka消息格式（V1版本，未压缩）如下图所示，图中RECORD为消息体，offset和message size为日志头部（LOG_OVERHEAD）。与消息对应的还有消息集的概念，消息集中包含一条或者多条消息，消息集不仅是存储于磁盘及在网络上传输（Produce & Fetch）的基本形式，而且是Kafka中压缩的基本单元，结构如图中右边部分。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/kafka/kafka05.png)

消息格式中的各个字段如下：
* crc32（4B）：crc32校验值，校验范围为magic到value之间。
* magic（1B）：消息格式版本号。
* timestamp（8B）：消息时间戳。（broker端可配置，默认使用生产者创建消息时的时间）
* attributes（1B）：消息属性。低3位表示压缩类型，0-NONE，1-GZIP，2-SNAPPY，3-LZ4。第4位表示timestamp类型，0-CreateTime，1-LogAppendTime。其余位保留。
* key length（4B）：消息key的长度。-1表示key为null。
* key：消息键。
* value length（4B）：实际消息体的长度。-1表示消息为null。
* value：消息体。

## 消息压缩

为了得到更好的压缩效果，Kafka实现的压缩方案是将多条消息一起压缩。一般情况下，生产者发送的压缩消息在broker中也是保持压缩状态进行存储的，消费者从broker拉取到的也是压缩消息，在处理消息前才会进行解压。

Kafka日志压缩方式通过参数`compression.type`配置，默认值为producer，即保留生产者使用的压缩方式。压缩方式还可以配置为gzip/snappy/lz4三种压缩算法，以及可以配置不压缩（uncompressed）。

消息压缩时，将整个消息集作为内层消息，内层消息整体作为外层的value。压缩后的消息key为null，value是多条压缩消息。当生产者创建压缩消息时，对内部压缩消息设置的offset从0开始，offset由broker进行转换，保存内层最后一条的绝对位移在外层offset。如下图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/kafka/kafka06.png)

## V2版本

V2版本中的消息集称为Record Batch，而不是Messgage Set，其内部也包含一条或者多条消息，如下图中部和右边。在消息压缩时，Record Batch Header部分（图左，first offset到records count字段）是不被压缩的，被压缩的是records字段中的所有内容。

生产者客户端中的ProducerBatch对应RecordBatch，而ProducerRecord对应Record。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/kafka/kafka07.png)

消息格式中Record部分字段为varints变长字段，Kafka会根据具体值确定需要几个字节保存。部分字段解释如下：

* length：消息总长度。
* attributes：已弃用。
* timestamp delta：时间戳增量，保存与RecordBatch的起始时间戳差值。
* offset delta：时间戳增量，保存与RecordBatch起始位移的差值。

RecordBatch字段解释如下：

* first offset：当前RecordBatch的起始偏移。
* length：从partition leader epoch字段开始到末尾的长度。
* partition leader epoch：分区leader纪元，可以看作分区leader的版本号或更新次数。
* magic：消息格式版本号，V2版本此字段为2。
* attributes：消息属性，低3位表示压缩格式，第4位表示时间戳类型，第5位表示此RecordBatch是否处于事务中，第6位表示是否是控制消息（ControlBatch），控制消息用来支持事务功能。
* last offset delta：RecordBatch中最后一个Record的offset与first offset的差值。
* first timestamp：RecordBatch中第一条Record的时间戳。
* max timestamp：RecordBatch中最大的时间戳。
* producer id：PID，用来支持幂等和事务。
* producer epoch：同producer id，用来支持幂等和事务。
* producer sequence：同producer id、producer epoch，用来支持幂等和事务。
* records count：RecordBatch中的Record的个数。

# 日志索引

每个日志分段文件都对应两个索引文件，用来提高查找消息的效率。偏移量索引文件用来建立消息偏移量到物理地址之间的映射关系，方便快速定位到消息所在的物理文件位置。时间戳索引文件用来根据指定时间戳来查找对应的偏移量信息。

Kafka中的索引文件以稀疏索引的方式构造，其不保证每条消息在索引文件中都有对应的索引项，每当写入一定量的消息时（broker端参数log.index.interval.bytes控制，默认4KB），偏移量索引文件和时间戳索引文件分别增加一个偏移量索引和时间戳索引项。

稀疏索引通过MapppedByteBuffer将索引文件映射到内存中以加快索引查询速度。偏移量索引文件中的偏移量是单调递增的，查询指定偏移量时，使用二分查找快速定位偏移量位置，如果指定偏移量不在索引文件中，则会返回小于指定偏移量的最大偏移量。时间戳索引查找方式同理，至于找到对应的物理文件位置时需要再根据偏移量索引再次定位。

对于日志分段文件，其切分条件如下，满足其一即可：

1. 当前日志分段文件的大小超过了broker端参数log.segment.bytes配置的值。默认值为1GB。
2. 当前日志分段中消息的最大时间戳与当前系统的时间戳差值大于log.roll.ms或log.roll.hours参数配置的值。默认情况下只配置log.roll.hours参数，为7天。
3. 偏移量索引或时间戳索引文件大小达到broker端参数log.index.size.max.bytes配置的值，默认10MB。
4. 追加的消息的偏移量与当前日志分段的偏移量之间的差值大于Integer.MAX_VALUE，即要追加的消息偏移量不能转变为相对偏移量（offset - baseOffset > Integer.MAX_VALUE）。

## 偏移量索引

每个偏移量索引项占8个字节，分为两个部分：

1. relativeOffset：相对偏移量，表示消息相对于baseOffset的偏移量，占用4个字节，当前索引文件文件名即为baseOffset。
2. position：物理地址，也就是消息在日志分段文件中的对应物理位置，占用4个字节。

## 时间戳索引

每个时间戳索引项占12个字节，也分为两个部分：

1. timestamp：当前日志分段的最大时间戳，占用8个字节。
2. relativeOffset：时间戳对应的消息相对偏移量，占用4个字节。

# 日志清理

为了控制消息存储占用的磁盘空间，Kafka提供了两种日志清理策略：

1. 日志删除（Log Retention）：按照一定策略直接删除不符合条件的日志分段。
2. 日志压缩（Log Compaction）：针对每个消息的key进行整合，对于相同的key的不同value值，只保留最后一个版本。

通过broker端参数log.cleanup.policy参数设置日志清理策略，默认为delete即采用日志清理策略，可配置为compact即日志压缩策略，还可以配置为delete,compact即同时支持两种策略。日志清理的粒度可以控制到主题级别，对应主题级别参数cleanup.policy。

对于日志删除，Kafka的日志管理器中有一个专门的日志删除任务来周期性检测和删除不符合保留条件的日志分段文件，默认频率5分钟。当前日志分段的保留策略有三种：

* 基于时间的保留策略
* 基于日志大小的保留策略
* 基于日志起始偏移量的保留策略

# 磁盘存储

## 磁盘顺序写

Kafka采用文件追加的方式写入消息，即只能在日志文件的尾部追加新的消息，并且不允许修改已写入的消息。这种顺序写盘的操作使得Kafka即使使用磁盘作为存储介质，其所能承载的吞吐量也不容小觑。

## 页缓存

Kafka中大量使用了页缓存，消息先被写入页缓存，然后由操作系统负责具体的刷盘任务，同时Kafka提供同步刷盘及强制性刷盘（fsync）功能，通过log.flushl.interval.messages、log.flush.interval.ms等参数控制。

## 零拷贝

Kafka还使用了零拷贝（Zero-Copy，将数据直接从磁盘文件复制到网卡设备中，而不需要经由应用程序）技术来进一步提升性能。