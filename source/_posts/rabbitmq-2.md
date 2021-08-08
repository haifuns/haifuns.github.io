title: RabbitMQ 集群
author: Haif.
tags:

  - RabbitMQ
categories:
  - 消息中间件
date: 2020-12-26 16:16:00
copyright: true

---

# 集群

RabbitMQ 集群允许消费者和生产者在 RabbitMQ 单个节点崩溃的情况下继续运行，它可以通过添加更多的节点来线性地扩展消息通信的吞吐量。当失去一个 RabbitMQ 节点时，客户端能够重新连接到集群中的任何其他节点并继续生产或者消费。

不过 RabbitMQ 集群不能保证消息的万无一失，即将消息、队列、交换器等都设置为可持久化，生产端和消费端都正确地使用了确认方式。当集群中一个 RabbitMQ 节点崩溃时，该节点上的所有队列中的消息也会丢失。

RabbitMQ 集群中的所有节点都会备份所有的元数据信息，包括以下内容：

* 队列元数据：队列的名称及属性；
* 交换器：交换器的名称及属性；
* 绑定关系元数据：交换器与队列或者交换器与交换器之间的绑定关系；
* vhost 元数据：为 vhost 内的队列、交换器和绑定提供命名空间及安全属性;

但是**不会备份消息**(当然通过特殊的配置比如镜像队列可以解决这个问题，以后会有介绍)。基于存储空间和性能的考虑，在RabbitMQ 集群中创建队列，集群只会在单个节点而不是在所有节点上创建队列的进程并包含完整的队列信息(元数据 、状态、内容)。这样只有队列的宿主节点即所有者节点知道队列的所有信息，所有其他非所有者节点只知道队列的元数据和指向该队列存在的那个节点的指针。因此当集群节点崩溃时，该节点的队列进程和关联的绑定都会消失。附加在那些队列上的消费者会丢失其所订阅的信息，并且任何匹配该队列绑定信息的新消息也都会消失。

不同于队列那样拥有自己的进程，交换器其实只是一个名称和绑定列表。当消息发布到交换器时，实际上是由所连接的信道将消息上的路由键同交换器的绑定列表进行比较，然后再路由消息。当创建一个新的交换器时，RabbitMQ 所要做的就是将绑定列表添加到集群中的所有节点上。这样，每个节点上的每条信道都可以访问到新的交换器了。

## 集群搭建
<!-- more -->
### 环境准备

* 准备三台虚拟机，主机名分别为node1、node2、node3
```shell
$ vi /etc/hosts

# 添加ip 主机名映射

192.168.0.90 node1
192.168.0.91 node2
192.168.0.81 node3
```

* 分别安装rabbitmq

```shell
# 添加erlang 源至yum存储库
$ rpm -Uvh https://download.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm

# wget https://packages.erlang-solutions.com/erlang-19.0.4-1.el7.centos.x86_64.rpm
# rpm -Uvh erlang-19.0.4-1.el7.centos.x86_64.rpm

# 安装erlang
$ yum -y install erlang

# 导入RabbitMQ源
$ wget https://www.rabbitmq.com/releases/rabbitmq-server/v3.6.8/rabbitmq-server-3.6.8-1.el7.noarch.rpm
$ rpm -Uvh https://www.rabbitmq.com/releases/rabbitmq-server/v3.6.8/rabbitmq-server-3.6.8-1.el7.noarch.rpm

# 安装RabbitMQ公共库秘钥
$ rpm --import https://www.rabbitmq.com/rabbitmq-release-signing-key.asc

# 安装RabbitMQ
$ yum install rabbitmq-server-3.6.8-1.el7.noarch.rpm

# 添加mq开机自启
$ chkconfig rabbitmq-server on

# 以守护进程方式后台运行
$ rabbitmq-server -detached

# 启动RabbitMQ服务 端口5672
$ service rabbitmq-server start

# 关闭RabbitMQ服务
$ service rabbitmq-server stop
$ rabbitmqctl stop

# 查看RabbitMQ服务状态
$ service rabbitmq-server status
$ rabbitmqctl status

# 查看已开启插件
$ rabbitmq-plugins list

# 开启管理页面 端口15672
$ rabbitmq-plugins enable rabbitmq_management

# 删除默认用户 guest/guest
$ rabbitmqctl delete_user guest
 
# 添加用户
$ rabbitmqctl add_user  {username} {password}
 
# 设置tag
$ rabbitmqctl set_user_tags {username} administrator
 
# 赋予权限（最大）
$ rabbitmqctl set_permissions -p / {username} ".*" ".*" ".*"
 
# 查看确认权限赋予是否成功
$ rabbitmqctl list_user_permissions {username}

# 修改密码
$ rabbitmqctl change_password {username} {new_password}
```

### 交换密钥令牌

编辑 RabbitMQ cookie 文件，以确保各个节点的 cookie 文件使用的是同一个值。

可以读取 node1 节点的 cookie 然后将其复制到 node2 node3 节点中 cookie 文件默认路径为 /var/lib/rabbitmq/.erlang.cookie。

cookie 相当于密钥令牌，集群中的 RabbitMQ 节点需要通过交换密钥令牌以获得相互认证，如果节点的密钥令牌不一致，那么在配置节点时就会报错。

### 配置集群

配置集群有三种方式:

* 通过 rabbitmqctl 工具的方式配置集群，这种方式也是最常用的方式，下面的演示也将使用rabbitmqctl 进行配置
* rabbitmq.config 配置文件配置
* 通过 rabbitmq-autocluster 插件配置


任选一个节点（以node1为例）为基准，将另外的节点加入选中节点集群
```shell
# node2 & node3

# 关闭RabbitMQ 应用
$ rabbitmqctl stop_app
# 将节点重置还原到最初状态。包括从原来所在的集群中删除此节点，从管理数据库中删除所有的配置数据
$ rabbitmqctl reset
# 将节点加入指定集群中
$ rabbitmqctl join_cluster rabbit@node1
# 启动RabbitMQ 应用
$ rabbitmqctl start_app
```
查看各节点状态
```shell
$ rabbitmqctl cluster_status
```

如果关闭了集群中的所有节点，则需要确保在启动的时候最后关闭的那个节点是第一个启动。如果第一个启动的不是最后关闭的节点，那么这个节点会等待最后关闭的节点启动。这个等待时间是30 秒，如果没有等到，那么这个先启动的节点也会失败。在最新的版本中会有重试机制，默认重试30 秒以等待最后关闭的节点启动。

如果最后一个关闭的节点最终由于某些异常而无法启动，则可以通过 `rabbitmqctl forget_cluster_node` 命令来将此节点剔出当前集群。

例如，集群中节点按照 node3 node2 node1 顺序关闭，此时如果要启动集群，就要先启动 node1 节点。这里可以在 node2 节点中执行命令将 node1 节点剔除出当前集群：
```shell
# --offline 参数可以在非运行状态下将 node1 剥离出当前集群
$ rabbitmqctl forget_cluster_node rabbit@node1 --offline
```

如果集群中的所有节点由于某些非正常因素，比如断电而关闭，那么集群中的节点都会认为还有其他节点在它后面关闭，此时需要调用以下命令来启动一个节点，之后集群才能正常启动。
```shell
$ rabbitmqctl force_boot
```

## 集群节点类型

在使用 `rabbitmqctl cluster_status` 命令来查看集群状态时会有 {nodes [{disc, [rabbit@nodel, rabbit@node2, rabbit@node3]}]} 一项信息，其中的 disc 标注了RabbitMQ 节点的类型。
* disc 磁盘节点
* ram 内存节点

内存节点将所有的队列、交换器、绑定关系、用户、权限和 host 的元数据定义都存储在内存中，而磁盘节点则将这些信息存储到磁盘中。

单节点的集群中必然只有磁盘类型的节点，否则当重启MQ之后，所有关于系统的配置信息都会丢失。不过在集群中，可以选择配置部分节点为内存节点，这样可以获得更高的性能。

比如将node2 节点加入node1 节点的时候可以指定node2 节点的类型为内存节点（默认磁盘节点）：
```shell
$ rabbitmqctl join_cluster rabbit@node1 --ram
```

如果集群已经搭建好了，可以使用`rabbitmqctl change_cluster_node_type {disc ram}`命令来切换节点的类型：
```shell
$ rabbitmqctl stop_app
# 将node2 从内存节点转换为磁盘节点
$ rabbitmqctl change_cluster_node_type disc
$ rabbitmqctl start_app
```

## 剔除单个节点

有两种方式将 node2 剥离出当前集群:

第一种： 在 node2 节点上执行`rabbitmqctl stop_app`或者`rabbitmqctl stop` 命令来关闭RabbitMQ 服务。之后再在 node1 节点或者 node3 节点上执行`rabbitmqctl forget_cluster_node rabbit@node2`命令将 node1 节点剔除出去。这种方式适合 node2 节点不再运行RabbitMQ 情况。
```shell
# node2
$ rabbitmqctl stop_app
# node1 | node3
$ rabbitmqctl forget_cluster_node rabbit@node2 
```

第二种： 在 node2 上执行 `rabbitmqctl reset` 命令。如果不是由于启动顺序的缘故而不得不删除一个集群节点，建议采用这种方式。
```shell
$ rabbitmqctl forget_cluster_node rabbit@node1 --offline
```

`rabbitmqctl reset` 命令将清空节点的状态并将其恢复到空白状态。当重设的节点是集群中的一部分时，该命令也会和集群中的磁盘节点进行通信，告诉它们该节点正在离开集群。不然集群会认为该节点出了故障 并期望其最终能够恢复过来。

## 集群节点升级

### 单节点

如果 RabbitMQ 集群由单独的一个节点组成，那么升级版本很容易，只需关闭原来的服务，然后解压新的版本再运行即可。不过要确保原节点的 Mnesia 中的数据不被变更，且新节点中的 Mnesia 路径的指向要与原节点中的相同。或者说保留原节点 Mnesia 数据 然后解压新版本到相应的目录，再将新版本的 Mnesia 路径指向保留的 Mnesia数据的路径（也可以直接复制保留 Mnesia 数据到新版本中相应的目录），最后启动新版本的服务即可。

### 多节点

如果 RabbitMQ 集群由多个节点组成，那么也可以参考单个节点的情形。具体步骤如下：

1. 关闭所有节点的服务 注意采用 `rabbitmqctl stop` 命令关闭。
2. 保存各个节点的 Mnesia 数据
3. 解压新版本的 RabbitMQ 到指定的目录
4. 指定新版本的 Mnesia 路径为步骤2保存的 Mnesia 数据路径
5. 启动新版本的服务，注意先重启原版本中最后关闭的那个节点

其中步骤4步骤5可以一起操作，比如执行 `RABBITMQ MNESIA BASE=/opt/mnesia rabbitmq-server-detached` 命令，其中 /opt/mnesia 为原版本保存 Mnesia 数据的路径。

## 服务日志

RabbitMQ 的日志默认存放在$RABBITMQ_HOME/var/log/rabbitmq 文件夹内。在这个文件夹内 RabbitMQ 会创建两个日志文件 RABBITMQ_NODENAME-sasl.log 和 RABBITMQ_NODENAME.log 。

* RABBITMQ_NODENAME-sasl.log 记录 Erlang 相关信息，例如查看 Erlang 崩溃报告。
* RABBITMQ_NODENAME.log 记录 RabbitMQ 应用服务日志。

## 单节点故障恢复

RabbitMQ 使用过程中，或多或少都会遇到一些故障，对于集群层面来说，更多的是单点故障。所谓的单点故障是指集群中单个节点发生了故障，有可能会引起集群服务不可用、数据丢失等异常。配置数据节点冗余（镜像队列）可以有效地防止由于单点故障而降低整个集群的可用性、可靠性。

单节点故障包括：机器硬件故障、机器掉电、网络异常、服务进程异常。

### 机器硬件故障

单节点机器硬件故障包括机器硬盘、内存、主板等故障造成的死机，无法从软件角度来恢复，此时需要在集群中的其他节点中执行`rabbitmqctl forget_cluster_node {nodename}` 命令来将故障节点剔除。

如果之前有客户端连接到此故障节点上，在故障发生时会有异常报出，此时需要将故障节点的ip地址从连接列表里删除，并让客户端重新与集群中的节点建立连接，以恢复整个应用。如果此故障机器修复或者原本有备用机器，那么也可以选择性的添加到集群中。

### 机器掉电故障

当遇到机器掉电故障，需要等待电源接通之后重启机器。此时这个机器节点上的 RabbitMQ 处于 stop 状态，但是此时不要盲目重启服务，否则可能会引起网络分区。

此时同样需要在其他节点上执行 `rabbitmqctl forget_cluster_node {nodename}` 命令将此节点从集群中剔除，然后删除当前故障机器的 RabbitMQ 中的 Mnesia
数据（相当于重置），然后再重启 RabbitMQ 服务，最后再将此节点作为一个新的节点加入到当前集群中。

### 网络异常

网线松动或者网卡损坏都会引起网络故障的发生。

* 对于网线松动，无论是彻底断开，还是“藕断丝连”，只要它不降速，RabbitMQ 集群就没有任何影响，但是为了保险起见，建议先关闭故障机器的 RabbitMQ 进程，然后对网线进行更换或者修复操作，之后再考虑是否重新开启RabbitMQ 进程。

* 而网卡故障极易引起网络分区的发生，如果监控到网卡故障而网络分区尚未发生时，理应第一时间关闭此机器节点上的 RabbitMQ 进程，在网卡修复之前不建议再次开启，如果己经发生了网络分区，可以进行手动恢复网络分区。

### 服务进程异常

对于服务进程异常，如 RabbitMQ 进程非预期终止，需要预先思考相关风险是否在可控范围之内。如果风险不可控，可以选择抛弃这个节点。一般情况下，重新启动 RabbitMQ 服务进程即可。

## 集群迁移

### 元数据重建

元数据重建是指在新的集群中创建原集群的队列、交换器、绑定关系、host 、用户、权限和Parameter 等数据信息。元数据重建之后才可将原集群中的消息及客户端连接迁移过来。

有很多种方法可以重建元数据，比如通过手工创建或者使用客户端创建。通过人工的方式来整理元数据是极其烦琐、低效的，且时效性太差，不到万不得已不建议使用，可以通过 Web 管理界面的方式重建，直接在 *Import / export definitions* 下载集群的元数据信息json文件。然后导入新集群。

这种方式需要考虑三个问题：

**1. 如果原集群突发故障，又或者开启 RabbitMQ Management 插件的那个节点机器故障不可修复，就无法导出原集群的元数据。**

这个问题 很好解决，采取一个通用的备份任务在元数据有变更或者达到某个存储周期时将最新的元数据配置备份至另一处安全的地方。这样在遇到需要集群迁移时，可以获取到最新的元数据。

**2. 如果新旧集群的 RabbitMQ 版本不一致时会出现异常情况。**

比如新建立了3.6.10 版本的集群，旧集群版本为3.5.7 ，这两个版本元数据就不相同。3.5.7 版本中的user 项的内容 3.6.10 版本的加密算法是不一样。

这里可以简单地在 Shell 控制台输入变更密码的方式来解决这个问题：

```
$ rabbitmqctl change_password {username} {new_password}
```

如果还是不能成功上传元数据，那么就需要进一步采取措施。首先对于用户、策略、权限这种元数据来说内容相对固定，且内容较少，手工重建的代价较小。相反集群中元数据最多且最复杂的要数队列、交换器和绑定这三项的内容，这三项内容还涉及其内容的参数设置，如果采用人工重建的方式代价太大，重建元数据的意义其实就在于重建队列、交换器及绑定这三项的相关信息。

* 这里有个小窍门，可以将3.6.10 的元数据从 queues 这一项前面的内容，包括 rabbit_version 、users、vhosts、permissions、parameters、global_parameters和policies
这几项内容复制后替换 3.5.7 版本中的 queues 这一项前面的所有内容然后再保存。之后将修改
并保存过后的 3.5.7 版本的元数据 JSON 文件上传到新集群 3.6.10 版本的 Web 管理界面中，至此就完成了集群的元数据重建。

**3. 如果采用上面的方法将元数据在新集群上重建，则所有的队列都只会落到同一个集群节点上，而其他节点处于空置状态，这样所有的压力将会集中到这单台节点之上。**

处理这个问题，有两种方式，都是通过程序（或者脚本）的方式在新集群上建立元数据，而非简单地在页面上上传元数据文件而己。

* 第一种方式是通过 HTTPAPI 接口创建相应的数据
* 第二种方式是随机连接集群中不同的节点的地址，然后再创建队列。与前一种方式需要节点名称的列表不同，这里需要的是节点IP地址列表。

### 数据迁移和客户端连接切换

元数据重建为集群迁移前必要的准备工作，在迁移过程中的主要工作步骤如下：

#### 生产者

首先需要将生产者的客户端与原 RabbitMQ 集群的连接断开，然后再与新的集群建立新的连接，这样就可以将新的消息流转入到新的集群中。

#### 消费者

一种是等待原集群中的消息全部消费完之后再将连接断开，然后与新集群建立连接进行消费作业。可以通过 Web 页面查看消息是否消费完成。也可以通过 `rabbitmqctl list_queues name messages messages_ready messages_unacknowledged` 命令来查看是否有未被消费的消息。

当原集群服务不可用或者出现故障造成服务质量下降而需要迅速将消息流切换到新的集群中时，此时就不能等待消费完原集群中的消息，这里需要及时将消费者客户端的连接切换到新的集群中，那么在原集群中就会残留部分未被消费的消息，此时需要做进一步的处理。如果原集群损坏，可以等待修复之后将数据迁移到新集群中，否则会丢失数据。

#### 数据迁移原理

数据迁移的主要原理是先从原集群中将数据消费出来，然后存入一个缓存区中，另一个线程读取缓存区中的消息再发布到新的集群中完成数据迁移。

RabbitMQ 本身提供的 Federation Shove 插件都可以实现此功能，确切地说 Shove 插件更贴近，不过自定义的迁移工具（可以称之为RabbitMQ ForwarMaker）可以让迁移系统更加高效、灵活。

### 自动化迁移

要实现集群自动化迁移，需要在使用相关资源时就做好一些准备工作，方便在自动化迁移过程中进行无缝切换。

与生产者和消费者客户端相关的是交换器、队列及集群的信息，如果这种类型的资源发生改变时需要让客户端迅速感知，以便进行相应的处理，则可以通过将相应的资源加载到 ZooKeeper 的相应节点中，然后在客户端为对应的资源节点加入 watcher 来感知变化，当然这个功能使用 etc 或者集成到公司层面的资源配置中心中会更加标准、高效。

如图所示，将整个 RabbitMQ 集群资源的使用分为三个部分：客户端、集群、 ZooKeeper配置管理。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-autobackup.png)

在集群中创建元数据资源时都需要在 ZooKeeper 生成相应的配置，比如在 cluster1 集群中创建交换器 exchange1 之后，需要在 /rmqNode/exchanges 路径下创建实节点 exchange1 并赋予节点的数据内容为：

```
cluster=cluster1 # 表示此交换器所在的集群名称
exchangeType=direct # 表示此交换器的类型
vhost=vhost1 # 表示此交换器所在的 vhost
username=root # 表示用户名
password=123 # 表示密码
```

同样，在 cluster1 集群中创建队列 queue1 之后，需要在 /rmqNode/queues 路径下创建实节点 queue1 ，并赋予节点的数据内容为:

```
cluster=cluster1 
bindings=exchange1 # 表示此队列所绑定的交换器
# 如果有需要，也可以添加一些其他信息，比如路由键等
vhost=vhost1
userni me=root
password=123
```

对应集群的数据在 /rmqNode/clusters 路径下，比如 cluster1 集群，其对应节点的数据内容包含 IP 地址列表信息：

```
ipList=192.168.0.1 ,192.168.0.2, 192.168.0.3 # 集群中各个节点的IP地址信息
```

客户端程序如果与其上的交换器或者队列进行交互，那么需要在相应的 ZooKeeper 节点中添加 watcher ，以便在数据发生变更时进行相应的变更，从而达到自动化迁移的目的。

生产者客户端在发送消息之前需要先连接 ZooKeeper ，然后根据指定的交换器名称如exchange1 到相应的路径/rmqNode/exchanges 中寻找 exchange1 的节点，之后再读取节点中的数据，并同时对此节点添加 watcher 。在节点的数据第一条 “cluster=cluster1” 中找到交换器所在的集群名称，然后再从路径 /rmqNode/clusters 中寻找 cluster1 节点，然后读取其对应IP 地址列表信息。这样整个发送端所需要的连接串数据（IP地址列表、vhost、usename、password等）都已获取，接下就可以与 RabbitMQ 集群 cluster1 建立连接然后发送数据了。

对于消费者客户端而言，同样需要连接ZooKeeper，之后根据指定的队列名称（queue1）到相应的路径 /rmqNode/queues 中寻找 queue1 节点，继而找到相应的连接串，然后与RabbitMQ 集群cluster1 建立连接进行消费。当然对 /rmqNode/queues/queue1 节点的 watcher 必不可少。


当cluster1 集群需要迁移到 cluster2 集群时，首先需要将 cluster1 集群中的元数据在 cluster2 集群中重建。之后通过修改 channel 和 queue 元数据信息，比如原 cluster1 集群中有交换器exchange1、exchange2 和队列 queue1、queue2，现在通过脚本或者程序将其中的"cluster=cluster1"数据修改为"cluster=cluster2"。客户端会立刻感知节点的变化，然后迅速关闭当前连接之后再与新集群 cluster2 建立新的连接后生产和消费消息，在此切换客户端连接的过程中是可以保证数据零丢失的。迁移之后，生产者和消费者都会与cluster2 集群进行互通，此时原 cluster1 集群中可能还有未被消费完的数据，此时需要使用前文中描述的自定义迁移工具（RabbitMQ ForwarMaker）将cluster1 集群中未被消费完的数据同步到 cluster2 集群中。

如果没有准备 RabbitMQ ForwardMaker 工具，也不想使用 Federation 或者 Shovel 插件，那么在变更完交换器相关的 ZooKeeper 中的节点数据之后，需要等待原集群中的所有队列都消费完全之后，再将队列相关的 ZooKeeper 中的节点数据变更，进而使得消费者的连接能够顺利迁移到新的集群之上。可以通过下面的命令来查看是否有队列中的消息未被消费完：

```
$ rabbitmqctl list_queues -p / -q | awk '{if($2>0} print $0}'
```

## 其他

### 重置数据

```shell
# 删除原有的数据
$ rm -rf /var/lib/rabbitmq/mnesia/*

# 重启服务
$ rabbitmq-server -detached
```

### 杀进程重启

```shell
# 查询mq的进程
$ ps -ef | grep rabbitmq

# 将mq的进程杀掉
$ ps -ef | grep rabbitmq | grep -v grep | awk '{print $2}' | xargs kill -9

# 启动mq
$ rabbitmq-server -detached

# 查询mq的状态
$ rabbitmqctl status
```

# 跨越集群界限

RabbitMQ 可以通过3 种方式实现分布式部署：

* 集群
* Federation
* Shovel

这3 种方式不是互斥的，可以根据需要选择其中的一种或者以几种方式的组合来达到分布式部署的目的。Federation 、Shovel 可以为RabbitMQ 的分布式部署提供更高的灵活性，但同时也提高了部署的复杂性。

## Federation

Federation 插件的设计目标是使 RabbitMQ 在不同的 Broker 节点之间进行消息传递而无须建立集群，该功能在很多场景下都非常有用：

* Federation 插件能够在不同管理域（可能设置了不同的用户和 vhost ，也可能运行在不同版本的 RabbitMQ Erlang 上）中的 Broker 或者集群之间传递消息。
* Federation 插件基于 *AMQP 0-9-1* 协议在不同的Broker 之间进行通信，并设计成能够容忍不稳定的网络连接情况。
* 一个Broker 节点中可以同时存在联邦交换器（或队列）或者本地交换器（或队列），只需要对特定的交换器（或队列）创建 Federation 连接（Federation link）。
* Federation 需要在 Broker 节点之间创建 *O(N^2)* 个连接（尽管这是最简单的使用方式），这也就意味 Federation 在使用时更容易扩展。

Federation 插件可以让多个交换器或者多个队列进行联邦：
* 一个联邦交换器（federated exchange）或者一个联邦队列（federated queue）接收上游（upstream）的消息，这里的上游是指位于其他 Broker 上的交换器或者队列。
* 联邦交换器能够将原本发送给上游交换器（upstream exchange）的消息路由到本地的某个队列中。
* 联邦队列允许一个本地消费者接收到来自上游队列（upstream queue）的消息。

### 联邦交换器

假设下图中 broker1 部署在北京，broker2 部署在上海，而 broker3 部署在广州，彼此之间相距甚远，网络延迟是一个不得不面对的问题。

例如：有一个在广州的业务 ClientA 需要连接broker3 ，并向其中的交换器 exchangeA 发送消息，此时的网络延迟很小，ClientA 可以迅速将消息发送至 exchangeA 中，就算在开启了 publisher confirm 机制或者事务机制的情况下，也可以迅速收到确认信息。此时又有一个在北京的业务ClientB 需要向 exchangeA 发送消息，那么 ClientB broker3 之间有很大的网络延迟，ClientB 将发送消息至exchangeA 会经历一定的延迟，尤其是在开启了 publisher confirm 机制或者事务机制的情况下，ClientB 会等待很长的延迟时间来接收 broker3 的确认信息，进而必然造成这条发送线程的性能降低，甚至造成一定程度上的阻塞。

使用 Federation 插件就可以很好地解决这个问题：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-federated-exchange.png)

如下图所示，在 broker3 中为交换器exchangeA（broker3 中的队列 queueA 通过 "rkA" 与 exchangeA 进行了绑定）与广州的 broker1 之间建立一条单向的 Federation link 。

此时 Federation 插件会在 broker1 上会建立一个同名的交换器 exchangeA (这个名称可以配置，默认同名)，同时建立一个内部的交换器 "exchangeA -> broker3 B" ，并通过路由键 "rkA" 将这两个交换器绑定起来。这个交换器"exchangeA -> broker3 B" 名字中的 broker3 是集群名，可以通过 `rabbitmqctl set cluster name {new name} `命令进行修改。

与此同时 Federation 插件还会在 broker1 上建立一个队列 "federation: exchangeA -> broker3 B" ，并与交换器 "exchangeA -> broker3 B" 进行绑定。Federation 插件会在队列 "federation: exchangeA -> broker3 B" broker3 中的交换器 exchangeA 之间建立一条 AMQP 连接来实时地消费队列 "federation: exchangeA -> broker3 B" 中的数据。

这些操作都是内部的，对外部业务客户端来说这条 Federation link 建立在broker1 exchangeA 与broker3 exchangeA 之间。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-federation-link.png)


回到前面的问题，部署在北京的业务 ClientB 可以连接 broker1 并向 exchangeA 发送消息，这样 ClientB 可以迅速发送完消息并收到确认信息，而之后消息通过 Federation link 转发到 broker3 交换器 exchangeA，最终消息会存入与 exchangeA 绑定的队列 queueA 中，消费者最终可以消费队列 queueA 中的消息。经过 Federation link 转发的消息会带有特殊的 headers 性标记。

### 联邦队列

除了联邦交换器，RabbitMQ 还可以支持联邦队列 (federated queue)。联邦队列可以在多个 Broker 节点(或者集群)之间为单个队列提供均衡负载的功能。一个联邦队列可以连接一个或者多个上游队列 (upstream queue)，并从这些上游队列中获取消息以满足本地消费者消费消息的需求。

下图演示了：

1. 位于两个 Broker 中的几个联邦队列(灰色)和非联邦队列(白色) 队列 queue1、queue2 原本在 broker2 中，由于某种需求将其配置为 federated queue 并将 broker1 作为 upstream

2. Federation 插件会在 broker1 上创建同名的队列 queue1、queue2，与 broker2 中的队列 queue1、queue2 分别建立两条单向独立的 Federation link

3. 当有消费者 ClinetA 连接 broker2 并通过Basic.Consume 消费队列 queue1 (或 queue2) 中的消息时：

    * 如果队列 queue1 (或 queue2)本身有若干消息堆积，那么 ClientA 直接消费这些消息，此时 broker2 中的 queue1 (或 queue2)并不会拉取 broker1 中的 queue1 (或 queue2) 的消息；
    * 如果队列 queue1 (或 queue2) 中没有消息堆积或者消息被消费完了，那么它会通过 Federation link 拉取在 broker1 中的上游队列 queue1 (或queue2) 中的消息(如果有消息)，然后存储到本地，之后再被消费者 ClientA 进行消费。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-federated-queue.png)


消费者既可以消费 broker2 中的队列，又可以消费 broker1 中的队列，Federation 的这种分布式队列的部署可以提升单个队列的容量。如果在 broker1 端部署的消费者来不及消费队列queue1 中的消息，那么 broker2 端部署的消费者可以为其分担消费，也可以达到某种意义上的负载均衡。

与federated exchange 不同，一条消息可以在联邦队列间转发无限次，如图中两个队列queue 互为联邦队列。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-federated-queue-2.png)


### Federation 的使用

为了能够使用 Federation 功能， 需要配置以下两个内容：

1. 需要配置一个或多个 upstream，每个 upstream 均定义了到其他节点的 Federation link，这个配置可以通过设置运行时的参数 (Runtime Parameter) 来完成，也可以通过 federation management 插件来完成。

2. 需要定义匹配交换器或者队列的一种/多种策略 (Policy)。

Federation 插件默认在 RabbitMQ 发布包中，开启 Federation 功能：
```
$ rabbitmq-plugins enable rabbitmq_federation
```

Federation 内部基于 AMQP 协议拉取数据，所以在开启 `rabbitmq federation` 插件的时候，默认会开启 `amqp_c lient` 插件。如果要开启 Federation 的管理插件，需要执行 `rabbitmq-plugins enable rabbitmq_federation _management` 命令。

注意:

当需要在集群中使用 Federation 功能的时候，集群中所有的节点都应该开启 Federation 插件。

## Shovel

与 Federation 具备的数据转发功能类似，Shovel 能够可靠、持续地从一个 Broker 中的队列(作为源端，即 source)拉取数据并转发至另一个 Broker 中的交换器(作为目的端，即 destination)作为源端的队列和作为目的端的交换器可以同时位于同一个 Broker 上，也可以位于不同的 Broker 上。 Shovel 可以翻译为 "铲子"，这个"铲子"可以将消息从一方"挖到"另一方。Shovel 的行为就像优秀的客户端应用程序能够负责连接源和目的地、负责消息的读写及负责连接失败问题的处理。

Shovel 的主要优势在于：
* 松耦合。Shovel 可以移动位于不同管理域中的 Broker(或者集群)上的消息，这些 Broker (或者集群)可以包含不同的用户和 vhost，也可以使用不同的 RabbitMQ Erlang 版本。
* 支持广域网。Shovel 插件同样基于 AMQP 协议 Broker 之间进行通信，被设计成可以容忍时断时续的连通情形，并且能够保证消息的可靠性。
* 高度定制。当 Shovel 成功连接后，可以对其进行配置以执行相关的 AMQP 命令。

### Shovel 原理

下图为 Shovel 的结构示意图：

这里有两个 Broker: broker1、broker2，broker1 中有交换器 exchange1 和队列 queue1，且这两者通过路由键 "rk1" 进行绑定；broker2 中有交换器 exchange2 和队列 queue2 ，且这两者通过路由键"rk2" 进行绑定。在队列 queue1 和交换器 exchange2 之间配置一个 Shovel link。

当一条内容为 "shovel test payload" 的消息从客户端发送至交换器 exchange1 的时候，这条消息会经过图图示中的数据流转最后存储在队列 queue2 中。如果在配置 Shovel link 时设置了
`add-forward-headers` 参数为 true，则在消费到队列 queue2 中这条消息的时候会有特殊headers 属性标记。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-shovel.png)

通常情况下，使用 shovel 时配置队列作为源端，交换器作为目的端。同样可以将队列配置为目的端，如下图所示：

虽然看起来队列 queue2 是通过 Shovel link 直接将消息转发至 queue2 ，其实中间也是经由 brokr2 的交换器转发，只不过这个交换器是默认的交换器而己。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-shovel2.png)

如下图所示，配置交换器为源端也是可行的。虽然看起来交换器 exchange1 是通过 Shovel link 直接将消息转发至exchange2 上的，实际上在 broker1 中会新建一个队列(名称由 RabbitMQ 自定义，比如图中的 "amq.gen-ZwolUsoUchY6a7xaPyrZZH") 并绑定 exchange1，消息从交换器 exchange1 过来先存储在这个队列中，然后 Shovel 再从这个队列中拉取消息进而转发至换器 exchange2。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/mq/rabbitmq-shovel3.png)

前面所阐述的 broker1 broker2 中的 exchange1 queue1 exchange2 queue2 都可以在 Shovel 成功连接源端或者目的端 Broker 之后再第一次创建(执行一系列相应的 AMQP 配置声明时)，它们并不一定需要在 Shovel link 建立之前创建。Shovel 可以为源端或者目的端配置多个 Broker 的地址，这样可以使得源端或者目的端的 Broker 失效后能够重连到其他 Broker 之上(随机挑选)，可以设置 `reconnect_delay` 参数以避免由于重连行为导致的网络泛洪，或者可以在重连失败后直接停止连接。针对源端和目的端的所有配置声明连成功之后被新发送。

### Shovel 使用

Shovel 插件默认 RabbitMQ 发布包中，开启方式：

```
rabbitmq-plugins enable rabbitmq_shovel
```

Shovel 内部也是基于 AMQP 协议转发数据的，所以在开启 `rabbitmq_shovel` 插件的时候也是默认开启 `amqp_client` 插件。

同时，如果要开启 Shovel 的管理插件需要执行：

```
rabbitmq-plugins enable rabbitmq_shovel_management
```