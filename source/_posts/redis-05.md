title: 【Redis】哨兵模式
author: HAIF.
tags:
  - Redis
categories:
  - NoSQL
date: 2021-01-24 20:18:00
---

# 概述

Redis从2.8开始正式提供了Redis Sentinel（哨兵）来实现高可用。

Redis Sentinel具有以下几个功能：

* 监控：Sentinel节点会定期检测Redis数据节点、其他Sentinel节点是否可达
* 通知：Sentinel节点会将故障转移结果通知给应用方
* 主节点故障转移：实现从节点晋升为主节点并维护后续正确的主从关系
* 配置提供者：在Redis Sentienl结构中，客户端在初始化时连接的是Sentienl节点集合，从中获取主节点信息

<!-- more -->

## 主从复制的问题

Redis主从复制模式是将主节点的数据改变同步给从节点，从节点即可以做备份也可以扩展主节点读能力。

但是主从复制模式存在如下问题：
1. 如果主节点故障，需要人工将从节点晋升为主节点，同时需要修改应用方的主节点地址，还需要命令其他从节点复制新的主节点。
2. 主节点的写能力受单机限制
3. 主节点的存储能力受到单机限制

## Redis Sentinel

当主节点出现故障时，Redis Sentinel能自动完成故障发现和故障转移，并通知应用方，从而实现真正的高可用。

Redis Sentinel是一个分布式架构，其中包含若干个Sentinel节点和Redis数据节点。每个Sentinel节点会对数据节点和其他Sentinel节点进行监控，当发现其他节点不可达时，会对节点做下线标识。如果被标识的是主节点，并且大多数Sentinel节点都认为主节点不可达时，则会选举出一个Sentinel节点来完成自动故障迁移工作，不需要人工干预。Redis Sentinel方案有效解决了Redis的高可用问题。

如下图所示，Redis Sentinel与Redis主从复制模式只是多了若干Sentinel节点并没有针对Redis节点做了特殊处理。

![Redis主从复制与Redis Sentinel架构的区别](https://haif-cloud.oss-cn-beijing.aliyuncs.com/redis/redis-sentinel-1.png)

# 安装部署

下面将以3个Sentinel节点、1个主节点、2个从节点组成一个Redis Sentinel为例进行部署。

物理结构如下表所示：

角色 | ip | port
---|---|---
master | 127.0.0.1 | 6379
slave-1 | 127.0.0.1 | 6380
slave-2 | 127.0.0.1 | 6381
sentinel-1 | 127.0.0.1 | 26379
sentinel-2 | 127.0.0.1 | 26380
sentinel-3 | 127.0.0.1 | 26381

## 部署Redis数据节点

Redis Sentinel中Redis数据节点没有做任何特殊配置，只需正常安装启动。

### 启动主节点

配置：

```
redis-6379.conf
port 6379 
daemonize yes 
logfile "6379.log"
dbfilename "dump-6379.rdb" 
dir "/opt/soft/redis/data/"
```

启动主节点：

```
redis-server redis-6379.conf
```

验证：

```
redis-cli -h 127.0.0.1 -p 6379 ping
```

### 启动从节点

配置1（从节点2配置同理）：

```
redis-6380.conf
port 6380 
daemonize yes 
logfile "6380.log" 
dbfilename "dump-6380.rdb" 
dir "/opt/soft/redis/data/" 
slaveof 127.0.0.1 6379
```

启动从节点：

```
redis-server redis-6380.conf
redis-server redis-6381.conf
```

验证：

```
redis-cli -h 127.0.0.1 -p 6380 ping
redis-cli -h 127.0.0.1 -p 6381 ping
```

### 确认主从关系

主节点视角下有两个从节点，分别是127.0.0.1:6380和127.0.0.1:6381

```
$ redis-cli -h 127.0.0.1 -p 6379 info replication
# Replication
role:master
connected_slaves:2
slave0:ip=127.0.0.1,port=6380,state=online,offset=281,lag=1
slave1:ip=127.0.0.1,port=6381,state=online,offset=281,lag=0
···
```

从节点的视角，它的主节点是127.0.0.1:6379

```
$ redis-cli -h 127.0.0.1 -p 6380 info replication
# Replication
role:slave
master_host:127.0.0.1
master_port:6379
master_link_status:up
···
```

## 部署Sentinel节点

### 配置Sentinel节点

```
redis-sentinel-26379.conf
port 26379 
daemonize yes 
logfile "26379.log" 
dir /opt/soft/redis/data 
sentinel monitor mymaster 127.0.0.1 6379 2 # 监控127.0.0.1:6379这个主节点(别名 mymaster)，2代表判断主节点失败至少需要2个Sentinel节点同意
sentinel down-after-milliseconds mymaster 30000 # 判定节点不可达超时时间，单位毫秒
sentinel parallel-syncs mymaster 1 # 故障转移后，每次向主节点发起复制操作的从节点个数
sentinel failover-timeout mymaster 180000 # 故障转移超时时间
#sentinel auth-pass <master-name> <password> # 主节点密码
#sentinel notification-script <master-name> <script-path> # 故障转移期间事件通知脚本
#sentinel client-reconfig-script <master-name> <script-path> # 故障转移结束后触发脚本
```

### 启动Sentinel节点

Sentinel节点的启动方法有两种：

1. 使用redis-sentinel命令：
```
redis-sentinel redis-sentinel-26379.conf
```

2. 使用redis-server命令加--sentinel参数：
```
redis-server redis-sentinel-26379.conf --sentinel
```

### 确认

Sentinel节点本质上是一个特殊的Redis节点，所以也可以通过info命令来查询它的相关信息：

```
$ redis-cli -h 127.0.0.1 -p 26379 info Sentinel
# Sentinel
sentinel_masters:1
sentinel_tilt:0
sentinel_running_scripts:0
sentinel_scripts_queue_length:0
master0:name=mymaster,status=ok,address=127.0.0.1:6379,slaves=2,sentinels=3
```

从info的Sentinel片段看，Sentinel节点找到了主节点127.0.0.1:6379，发现了它的两个从节点，同时发现Redis Sentinel一共有3个Sentinel节点。

# Sentinel API

```
sentinel masters # 展示所有被监控的主节点状态和统计信息

sentinel master <master name> # 展示指定<master name>的主节点状态以及统计信息

sentinel slaves <master name> # 展示指定<master name>的从节点以及相关统计信息

sentinel sentinels <master name> # 展示指定<master name>的Sentinel节点集合（不包含当前Sentinel节点）

sentinel get-master-addr-by-name <master name> # 返回指定<master name>主节点的IP地址和端口

sentinel reset <pattern> # 当前Sentinel节点对符合<pattern>（通配符风格）主节点的配置进行重置，包含清除主节点的相关状态（例如故障转移），重新发现从节点和Sentinel节点

sentinel failover <master name> # 对指定<master name>主节点进行强制故障转移（没有和其他Sentinel节点“协商”），当故障转移完成后，其他Sentinel节点按照故障转移的结果更新自身配置

sentinel ckquorum <master name> # 检测当前可达的Sentinel节点总数是否达到<quorum>的个数

sentinel flushconfig # 将Sentinel节点的配置强制刷到磁盘上

sentinel remove <master name> # 取消当前Sentinel节点对于指定<master name>主节点的监控

sentinel monitor <master name> <ip> <port> <quorum> # 通过命令的形式来完成Sentinel节点对主节点的监控

sentinel set <master name> # 动态修改Sentinel节点配置选项

sentinel is-master-down-by-addr # Sentinel节点之间用来交换对主节点是否下线的判断
```

# 实现原理

Redis Sentinel的基本实现原理，具体包含以下几个方面：
Redis Sentinel的三个定时任务、主观下线和客观下线、Sentinel领导者选举、故障转移。

## 三个定时任务

Redis Sentinel通过三个定时任务完成对各个节点发现和监控：
1. 每隔10秒，每个Sentinel节点会向数据主节点和从节点发送info命令获取最新的拓扑结构，作用有三点：
    - 通过向主节点执行info命令，获取从节点信息，所以不需要显示配置从节点
    - 有新节点加入时可以立即感知
    - 节点不可达或故障转移后，可以通过info命令实时更新节点拓扑信息
2. 每隔2秒，每个Sentinel节点会向数据节点的__sentinel__:hello频道发送该节点对于主节点的判断以及当前Sentinel节点的信息，同时每个Sentinel也会订阅此频道，以获取其他Sentinel节点以及它们对主节点的判断。此任务完成以下两个工作：
    - 通过订阅主节点__sentinel__:hello频道，获取其他Sentinel节点信息，对于新节点保存信息并建立连接
    - Sentinel节点之间交换主节点状态，作为后面客观下线以及领导者选举的依据
3. 每隔1秒，每个Sentinel节点会向主节点、从节点、其余Sentinel节点发送一条ping命令做一次心跳检测确保这些节点可达

## 主观下线和客观下线

### 主观下线

Redis Sentinel的第三个定时任务中，每个Sentinel节点会每隔1秒对主节点、从节点、其他Sentinel节点发送ping命令做心跳检测，当这些节点超过down-after-milliseconds没有进行有效回复，Sentinel节点就会对该节点做失败判定，这个行为叫做主观下线。主观下线存在误判的可能。

### 客观下线

当Sentinel主观下线的节点是主节点时，该Sentinel节点会通过sentinel is-master-down-by-addr命令向其他Sentinel节点询问对主节点的判断，当超过<quorum>个数，Sentinel节点认为主节点确实有问题，这时该Sentinel节点会做出客观下线的决定，客观下线是大部分Sentinel节点都对主节点的下线做了同意的判定。

## Sentinel领导者选举

假如Sentinel节点对于主节点已经做了客观下线，接下来Redis会基于Raft算法从Sentinel节点之间会做一个领导者选举的工作，选出一个Sentinel节点作为领导者进行故障转移的工作。

Sentinel节点选举大致思路如下：
1. 每个在线的Sentinel节点在做出主节点主观下线时候，会向其他Sentinel节点发送sentinel is-master-down-by-addr命令，要求将自己设置为领导者
2. 收到命令的Sentinel节点，如果没有同意过其他Sentinel节点的sentinel is-master-down-by-addr命令，将同意该请求，否则拒绝
3. 如果该Sentinel节点发现自己的票数已经大于等于max(quorum, num(sentinels)/2+1)，那么它将成为领导者
4. 如果此过程没有选举出领导者，将进入下一次选举

## 故障转移

领导者选举出的Sentinel节点负责故障转移，具体步骤如下：
1. 在从节点列表中选出一个节点作为新的主节点，选择方法如下：
    - 过滤：“不健康”（主观下线、断线）、5秒内没有回复过Sentinel节点ping响应、与主节点失联超过down-after-milliseconds*10秒
    - 选择slave-priority（从节点优先级）最高的从节点列表，如果存在则返回，不存在继续
    - 选择复制偏移量最大的从节点，存在返回，不存在继续
    - 选择runId最小的节点
2. Sentinel领导者节点会对第一步选出来的从节点执行slave no one命令让其成为主节点
3. Sentinel领导者节点会向其他从节点发送命令，让它们成为新主节点的从节点，复制规则与parallel-syncs参数有关
4. Sentinel节点集合会将原来的主节点更新为从节点，并保持对其关注，当其恢复后命令它去复制新的主节点