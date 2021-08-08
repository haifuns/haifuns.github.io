title: 【Redis】附加功能
author: HAIF.
tags:
  - Redis
categories:
  - NoSQL
date: 2021-01-17 23:00:00
---

Redis除了提供5种基本数据结构外，还提供了一些附加功能：

* 慢查询分析
* Redis Shell
* Pipeline
* 事务与Lua
* Bitmaps
* HyperLogLog
* 发布订阅
* GEO

<!-- more -->

# 慢查询分析

Redis客户端执行一条命令分为4个部分：
1. 发送命令
2. 命令排队
3. 命令执行
4. 返回结果

慢查询只统计步骤3的时间，没有慢查询并不代表没有超时问题。

## 配置参数

Redis提供`slowlog-log-slower-than`和`slowlog-max-len`两个配置。其中`slowlog-log-slower-than`用来设置阈值，单位时间是微秒，默认值是10000，执行时间超过10000微秒的命令会被记录在慢查询日志中。

Redis使用了一个列表来存储慢查询日志，`slowlog-max-len`是列表的最大长度。

Redis中有两种方法修改配置：
* 修改配置文件
* 使用`config set`命令动态修改

例如：
```
config set slowlog-log-slower-than 20000 # 将阈值设置为20000微妙
config set slowlog-max-len 1000 # 将列表长度设置为1000
config rewrite # 将配置文件持久化到本地配置文件
```

## 查看慢查询

* 获取慢查询日志

```
slowlog get [n] # 可选参数n可以指定条数
```

慢查询日志由四个属性组成：
1. 慢查询标识id
2. 发生时间戳
3. 命令耗时
4. 执行命令和参数

* 获取慢查询日志列表当前长度

```
slowlog len
```

* 慢查询日志重置

```
slowlog reset
```

## 最佳实践

* slowlog-max-len配置建议：线上设置1000以上。记录慢查询时Redis会对长命令做截断处理，不会占用大量内存。
* slowlog-log-slower-than配置建议：默认超过10ms判定为慢查询，需要根据Redis并发量调整该值。对于高流量的场景，如果命令执行时间在1ms以上，那么Redis最多可支撑OPS不到1000。对于高OPS场景Redis建议设置为1ms。

由于慢查询日志是一个先进先出的队列，在慢查询较多时会丢失部分日志，所以可以定时执行`slow get`命令将慢查询日志持久化到其他存储中（MySQL等）。

# Redis Shell

Redis提供了redis-cli、redis-server、redis-benchmarl等shell工具。

## redis-cli

redis-cli可选参数如下：

* -h：host，主机地址
* -p：port，端口
* -r：repeat，将命令执行多次
* -i：interbval，每隔几秒执行一次命令，与-r配合使用
* -x：从标准输入（stdin）读取数据作为最后一个参数，例如：`echo "world" | redis-cli -x set hello`
* -c：cluster，连接Redis Cluster节点，防止moved和ask异常
* -a：auth，指定密码
* --scan和--pattern：用于扫描指定模式的键
* --slave：把客户端模拟成当前Redis节点的从节点，可以用来获取当前Redis节点的更新操作
* --rdb，请求Redis实例生成并发送RDB持久化文件，保存在本地
* --pipe，将命令封装成Redis通信协议定义的数据格式，批量发送给Redis执行
* --bigkeys，使用scan命令对Redis的键进行采样，从中找到内存占用比较大的键值
* --eval，执行指定Lua脚本
* --latency
    * --latency：测试客户端到目标Redis的网络延迟
    * --latency-history：分时段输出网络延迟
    * --latency-dist：使用统计图表输出网络延迟统计信息
* --stat：实时获取Redis的重要统计信息
* --raw和--no-raw：--no-raw要求返回结果必须是原始格式，--raw返回格式化后的结果

## redis-server

redis-sever除了用来启动Redis外，还有一个`--test-memory`选项可以用来检测当前操作系统能否稳定分配指定容量的内存给Redis，通过检测可以有效避免因为内存问题造成Redis崩溃。

例如，检测当前操作系统是否能提供1G内存给Redis：

```
redis-server --test-memery 1024
```

## redis-benchmark

redis-benchmark可以为Redis做基准性能测试，可选参数如下：

* -c：client，客户端的并发数量，默认50
* -n：num，客户端请求总数量，默认100000
* -q：输出requests per second信息
* -r：random，随机插入键
* -P：每个请求的pipeline的数据量，默认1
* -k：keepalive，1使用，0不使用，默认1
* -t：对指定命令进行基准测试
* --csv：结果按照csv格式输出

# Pipline

Redis客户端执行一次命令需要经过发送、排队、执行、返回四个过程，其中发送和返回过程称为Round Trip Time（RTT，往返时间）。

Redis中大部分命令不支持批量操作，那么每个命令都要消耗一次RTT。Pipeline（流水线）机制可以改善这类问题，它可以将一组Redis命令进行组装，通过一次RTT传输给Redis，再将这组Redis命令的执行结果按顺序返回给客户端。使用Pipeline执行多条命令只需要一次RTT。

redis-cli的--pipe选项实际上就是使用了Pipeline机制，例如，下面将set hello world和incr counter两条命令组装：

```
echo -en '*3\r\n$3\r\nSET\r\n$5\r\nhello\r\n$5\r\nworld\r\n*2\r\n$4\r\nincr\r\n$7\r\ncounter\r\n' | redis-cli --pipe
```

## 原生批量命令与Pipeline对比

* 原生批量任务是原子的，Pipeline是非原子的
* 原生批量任务是一个命令对应多个key，Pipeline支持多个命令
* 原生批量任务是Redis服务端支持实现的，Pipeline需要服务端和客户端共同实现

# 事务与Lua

为了保证多条命令组合的原子性，Redis提供简单的事务功能以及集成Lua脚本来解决这个问题。

## 事务

Redis提供简单的事务功能，将需要一起执行的命令放到`multi`和`exec`两个命令之间。multi命令代表事务开始，exec命令代表事务结束，它们之间的命令是原子性执行的。

`discard`命令用来停止事务执行。

如果事务中的命令出现错误，不同情况下Redis的处理机制也不相同：
* 命令错误：语法错误会造成整个事务无法执行
* 运行时错误：Redis并不支持回滚功能，未发生错误的命令会正常执行

有些应用场景需要在执行事务之前，确保事务中的key没有被其他客户端修改过才执行事务，否则不执行。Redis提供了`watch`命令来解决这类问题。（在multi命令前执行watch key，在执行exec时，如果key被修改了事务不会执行，结果为nil）

## Lua

Lua语言于1993年诞生，设计目标是作为嵌入式程序移植到其他应用程序。由C语言实现，作为脚本语言被应用于游戏领域、Web服务器Nginx等地方。

Redis将Lua作为脚本语言，通过修改源码可实现定制命令。

在Redis中使用Lua脚本功能有如下优点：
* Lua脚本在Redis中是原子执行的，执行过程中不会插入其它命令
* 基于Lua脚本可以创造出定制命令，并且可以将这些命令常驻在内存中，实现复用
* Lua脚本可以将多条命令打包，有效较少网络开销

### 使用Lua

在Redis中执行Lua脚本有两种方法：eval和evalsha。

* eval

```
eval 脚本内容 key个数 key列表 参数列表
```

如果Lua脚本比较长，可以使用redis-cli --eval直接执行文件。

* evalsha

Redis还提供evalsha命令来执行Lua脚本。首先将Lua脚本加载到Redis服务端，得到该脚本的SHA1校验和，evalsha命令使用SHA1作为参数可以直接执行对应的Lua脚本，避免每次发送Lua脚本的开销。脚本会常驻在服务端得到复用。

加载脚本：

```
redis-cli script load "$(cat lua_get.lua)" # 将lua_get.lua加载到内存中，返回SHA1
```

执行脚本：

```
evalsha 脚本SHA1值 key个数 key列表 参数列表
```

### redis api

Lua可以使用redis.call函数实现对Redis的访问，例如：

```
redis.call("set", "hello", "world")
redis,call("get", "hello")
```

在Redis中执行效果如下：

```
$ eval 'return redis.call("get", "KEY[1]")' 1 hello
"world"
```

除redis.call外，Lua还可以使用redis.pcall函数实现对Redis的调用。区别在于，redis.call执行失败时，脚本执行结束会直接返回错误，而redis.pcall会忽略错误继续执行脚本。

### 管理Lua脚本

* `script load script`：加载脚本到内存中
* `script exists sha1 [sha1 ...]`：判断sha1是否已经加载到内存
* `script flush`：清除内存中的Lua脚本
* `script kill`：杀掉正在执行的Lua脚本。Redis提供lua-time-limit参数，默认5s，当脚本执行时间超过lua-time-limit后，会向其它命令调用发送BASY信号并提示使用script kill或shutdown nosave命令杀到busy脚本，但是不会停止服务端或客户端脚本执行

# Bitmaps

合理地使用位操作能够有效地提高内存使用率和开发效率。Redis提供了Bitmaps，可以实现对位的操作。Bitmaps不是一种数据结构，其本身就是字符串，但是可以对字符串的位进行操作。

Bitmaps单独提供了一套命令，可以把Bitmaps看做成以位为单位的数组，数据每个单元只能存放1和0，数组的下标为偏移量。

## 命令

```
setbit key offset value # 设置值

gitbit key offset # 获取值

bitcount [start] [end] # 获取Bitmaps指定范围值为1的个数

bitop op destkey key [key ...] # 对多个Bitmaps操作，op：and(交集)、or(并集)、not(非)、xor(异或)

bitpos key targetBit [start] [end] # 计算Bitmaps中第一个值为targetBit的偏移量
```

# HyperLogLog

HyperLogLog 并不是一种新的数据结构（实际类型为字符串类型），而是一种基数算法，通过HyperLogLog可以利用极小的内存空间完成独立总数的统计，数据集可以是IP、Email、ID等。

HyperLogLog内存占用量非常小，但是存在错误率，在进行数据结构选型时只需要确认以下两条：
1. 只为了计算独立总数，不需要获取单条数据
2. 可以容忍一定误差率

## 命令

```
pfadd key element [element ...] # 添加元素

pfcount key [key ...] # 计算独立用户数

pfmerge destkey sourcekey [sourcekey] # 求多个HyperLogLog并集，并赋值给destkey
```

# 发布订阅

Redis提供了基于“发布/订阅”模式的消息机制，此模式下，消息发布者与订阅者不需要直接通信，发布者客户端向指定的频道（channel）发布消息，订阅该频道的每个客户端都能收到消息。

## 命令

```
publish channel message # 发布消息

subscribe channel [channel ...] # 订阅消息
    # 客户端在执行订阅命令后进入订阅状态，只能接受subscribe、psubscribe、unsubscribe、punsubscribe的四个命令
    # 新开启的订阅客户端无法收到频道之前的消息，因为Redis不会对发布的消息进行持久化

unsubscribe [channel [channel ...]] # 取消订阅

psubscribe pattern [pattern ...] # 按照模式订阅
punsubscribe [pattern [pattern ...]] # 按照模式取消订阅

pubsub channels [pattern] # 查看活跃的频道
pubsub numsub [channel ...] # 查看频道订阅数
pubsub numpat # 查看模式订阅数
```

## 使用场景

聊天室、公告牌、服务之间都可以使用发布订阅模式实现消息解耦。

> 和很多专业的消息队列系统（例如Kafka、RocketMQ等）相比，Redis的发布订阅略显粗糙，例如无法实现消息堆积和回溯。但胜在足够简单，如果当前场景可以容忍的这些缺点，也不失为一个不错的选择。

# GEO

Redis3.2版本开始提供了GEO（地理信息定位）功能，支持存储地理位置信息用来实现诸如附近位置、摇一摇这类依赖于地理位置信息的功能。

GEO的数据类型为zset，Redis将所有地理位置信息的geohash存放在zset中。

## 命令

```
geoadd key longitube latitude member [longitude latitude member ...] # 增加地理位置信息
            # longitube：经度
            # latitude：维度
            # member：成员
            
geopos key member [member ...] # 获取地理位置信息

geodist key member1 member2 [unit] # 获取两个地理位置的距离
            # unit：表示返回结果的单位，包含以下四种
                # m (meters)：米
                # km (kilometers)：公里
                # mi (miles)：英里
                # ft (feet)：尺
                            
# 获取指定位置范围内的地理信息位置集合
georadius key longitude latitude radiusm|km|ft|mi [withcoord] [withdist] [withhash] [COUNT count] [asc|desc] [store key] [storedist key] 
georadiusbymember key member radiusm|km|ft|mi [withcoord] [withdist] [withhash] [COUNT count] [asc|desc] [store key] [storedist key]

            # withcoord：返回结果中包含经纬度
            # withdist：返回结果中包含离中心节点位置的距离
            # withhash：返回结果中包含geohash
            # COUNT count：指定返回结果的数量
            # asc|desc：返回结果按照离中心节点的距离做升序或者降序
            # store key：将返回结果的地理位置信息保存到指定键

geohash key member [member ...] # 获取geohash。Redis使用geohash将二维经纬度转换为一维字符串

zrem key member # 删除地理位置信息
```