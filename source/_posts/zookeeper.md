title: ZooKeeper入门
author: Haif.
tags:
  - ZooKeeper
categories:
  - 分布式
date: 2021-03-21 21:00:00

---

# 概述

[ZooKeeper](https://zookeeper.apache.org/)是一个经典的分布式数据一致性解决方案，致力于为分布式应用提供高性能、高可用且具有严格顺序访问控制能力的分布式协调存储服务。

常被用于以下场景：

1. 分布式锁
2. 元数据管理
3. 分布式协调
4. master选举

<!-- more -->

# 安装

```shell
$ cd /usr/local
$ wget https://mirrors.bfsu.edu.cn/apache/zookeeper/zookeeper-3.6.2/apache-zookeeper-3.6.2-bin.tar.gz # 下载安装包
$ tar -zxvf apache-zookeeper-3.6.2-bin.tar.gz # 解压

$ mkdir -p /tmp/zookeeper

$ cd apache-zookeeper-3.6.2-bin/conf
$ cp zoo_sample.cfg zoo.cfg

$ cd /usr/local/apache-zookeeper-3.6.2-bin/bin
$ ./zkServer.sh start # 启动服务
$ ./zkServer.sh stop # 停止服务
$ ./zkServer.sh status # 查看状态

$ ./zkCli.sh # 进入客户端
```

# 基础命令

```shell
$ create [-s] [-e] path data acl # 创建节点
        # -s表示顺序节点
        # -e表示临时节点。默认持久节点
        # path是节点路径
        # data是节点数据
        # acl用来进行权限控制
        
$ set path data # 更新节点
$ delete path [version] # 删除节点
$ get path # 查看节点

$ stat path # 查看节点状态
    # cZxid = 0x2 # 创建节点的事务ID
    # ctime = Mon Mar 15 13:14:23 CST 2021 # 创建节点的时间
    # mZxid = 0x2 # 最后更新节点的事务ID
    # mtime = Mon Mar 15 13:14:23 CST 2021 # 最后更新节点的时间
    # pZxid = 0x2 # 子节点最后一次被修改的事务ID
    # cversion = 0 # 子节点的更改次数
    # dataVersion = 0 # 节点数据的更改次数
    # aclVersion = 0 # 节点的ACL更改次数
    # ephemeralOwner = 0x0 # 节点类型，临时节点为创建节点的会话ID，持久节点为0
    # dataLength = 3 # 数据长度
    # numChildren = 0 # 子节点个数

$ ls path # 查看节点列表
$ ls -s path # 查看节点增强列表，指定路径下的所有节点和当前节点的信息
```

# 数据模型

Zookeeper的内存数据模型可以视为树形结构（或者目录），树中各个节点被称为znode（zookeeper node）。znode兼具文件和目录的特点，既像文件一样存储着数据、元信息、ACL、时间戳等数据结构，又像目录一样可以作为路径标识的一部分。

每个znode都有一个版本号，随每次数据变化而自增，修改或删除时版本号一致才会调用成功。

znode一共有四种类型：持久的、临时的、持久有序的和临时有序的。

## 持久节点

持久znode节点通常用来为应用保存数据，即使znode的创建者不再属于应用系统时，数据也不会丢失，只能通过delete命令删除。

## 临时节点

临时znode节点仅当创建者会话有效时保存数据，当创建该节点的客户端崩溃或者关闭连接时，临时节点就会被删除。

临时znode在以下两种场景会被删除：
1. 创建该znode的客户端会话因超时或主动关闭而终止时
2. 当某个客户端（不一定是创建者）主动删除改节点时

## 有序节点

znode可以设置为有序节点，有序znode节点被分配唯一一个全局单调递增的整数。当创建有序节点时，会在路径后追加一个序号。

# 长连接和会话

客户端与zk节点建立TCP连接，基于TCP长连接进行通信。建立连接时也会建立一个会话，通过心跳感知会话是否存在，超过sessionTimeout就认为会话断开。

# Watcher监听回调

Zookeeper提供通知机制，客户端可以向Zookeeper注册需要接收通知的znode，通过对znode设置监视点（watch）来接收通知。需要注意的是监视点是一个单次触发的操作，为了接收多个通知，客户端必须在每次通知后设置一个新的监视点。

**在对同一个znode操作时，zk会先向客户端传送通知，然后再对节点进行变更。** 其意义在于在znode发生连续多次变更时，客户端在第二次变化前就接收到了通知，然后读取znode中的数据。zk使用通知机制阻止客户端所观察的更新顺序，客户端以全局的顺序来观察zk状态。

```shell
$ get -w path # 监听节点
$ ls -w path # 监听子节点
```

# 集群

## 集群角色

* Leader：选举成功为领导者节点，只有leader可以写入，写入操作原子性同步到follower
* Follower：选举失败为从节点，写入请求转发到leader
* Observer：与follower相同但是不参与选举

## Leader选举

**只要有超过一半的机器认可，则可以选举为leader。**

只要有不超过一半的机器宕机就可以保证集群正常进行选举。

## ZAB协议

ZAB即ZooKeeper原⼦⼴播协议 （ZooKeeper Atomic Broadcast protocol）。

* 集群启动：恢复模式，leader选举（过半机器选举机制） + 数据同步
* 消息写入：消息广播模式，leader采用2PC模式的过半写机制，给follower进行同步
* 崩溃恢复：恢复模式，leader/follower宕机，只要剩余机器超过一半，集群宕机不超过一半的机器，就可以选举新的leader，数据同步

ZAB协议提交事务流程如下（类似两阶段提交）：
1. leader节点向所有follower节点发送proposal提议消息
2. follower节点收到提议消息后会将消息写到磁盘日志文件中，然后响应master一个ack消息
3. 当leader收到超过半数节点的ack消息，就会发送消息给follower节点进行commit操作，follower收到commit消息后就将消息写入到内存中

### 主从同步机制

集群启动时，会进行leader选举，选举完成后follower会跟leader进行数据同步。

同步完成后进入消息广播机制，只有leader可以接受写请求，但是客户端可以连接任意节点，如果连接follower，follower会把写请求转发给leader，leader收到写请求会把请求同步给follower，过半的follower响应后，leader发送commit消息给follower提交事务。

### 崩溃恢复机制

如果leader宕机，就会进入恢复模式，重新选举leader，过半机器同意则选举出新leader，新leader等待follower同步数据，完成后进入广播模式。