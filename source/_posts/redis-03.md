title: 【Redis】持久化
author: HAIF.
tags:
  - Redis
categories:
  - NoSQL
date: 2021-01-18 22:08:00
---

Redis支持RDB和AOF两种持久化机制，持久化功能可以有效的避免因进程退出造成的数据丢失，当下次重启时利用之前持久化的文件即可实现数据恢复。

<!-- more -->

# RDB

RDB持久化是把当前进程数据生成快照保存到硬盘的过程，触发RDB持久化过程分为手动触发和自动触发。

## 触发机制

手动触发分为save和bgsave两种命令：
* save命令：阻塞当前服务器，直到RDB完成，对于内存较大的实例会造成长时间阻塞，不建议线上使用
* bgsave命令：Redis进程执行fork操作创建子进程，RDB持久化过程由子进程负责，直到完成后结束。阻塞只发生在fork阶段，一般时间很短

Redis内部还存在自动触发RDB持久化机制，例如以下场景：
* 使用save相关配置，如“save m n”。表示m秒内数据集存在n次修改时，自动触发bgsave
* 如果从节点执行全量复制操作，主节点自动执行bgsave生成RDB文件并发给从节点
* 执行debug reload命令重新加载Redis时，自动触发save操作
* 默认情况下执行shutdown命令时，如果没有开启AOF持久化功能则自动执行bfsave

## RDB持久化流程

bgsave是主流的触发RDB持久化方式，其运作流程如下图所示：

![RDB持久化流程](https://haif-cloud.oss-cn-beijing.aliyuncs.com/redis/redis-bgsave.png)

1. 执行bgsave命令，Redis父进程判断当前是否存在正在执行的子进程，如RDB/AOF子进程，如果存在则bgsave命令直接返回
2. 父进程执行fork操作创建子进程，fork操作过程中父进程会阻塞，通过info stats命令查看latest_fork_usec选项，可以获得最近一个fork操作的耗时，单位为微秒
3. 父进程fork完成后，bfsave命令返回Background saving started信息，并不再阻塞父进程
4. 子进程创建RDB文件，根据父进程内存生成临时快照文件，完成后对原有文件进行原子替换。执行lastsave命令可以获取最后一次生成的RDB的时间，对应info统计的rdb_last_save_time选项
5. 子进程发送信号给父进程表示完成，父进程更新统计信息

## RDB文件

RDB文件保存在dir配置指定的目录下，文件名通过dbfilename配置指定。通过执行`config set dir {newDir}`和`config set dbfilename {newFileName}`在运行期动态修改。

Redis默认采用LZF算法对生成的RDB文件做压缩处理，压缩后的文件远小于内存大小，默认开启，通过执行`config set rdbcompression {yes|no}`动态修改

## RDB的优缺点

优点：
* RDB是一个紧凑压缩的二进制文件，代表某个时间点的数据快照。非常适合备份、全量复制场景
* Redis加载RDB恢复数据远远快于AOF方式

缺点：
* RDB不能实时持久化/秒级持久化。因为bgsave每次执行都要执行fork操作创建子进程，属于重量级操作，频繁执行成本过高
* RDB文件使用特定二进制格式保存，存在老版本Redis无法兼容新版RDB格式的问题

# AOF

AOF(append only file) 持久化：以独立日志的方式记录每次写命令，重启时再重新执行AOF文件中的命令达到恢复数据的目的。

AOF的主要作用是解决了数据持久化的实时性，目前已经是Redis持久化的主流方式。

## 使用AOF

开启AOF功能需要设置配置：appendonly yes，默认不开启。AOF文件名可以通过appendfilename配置设置，默认是appendonly.aof。保存路径与RDB持久化方式一致，通过dir配置指定。

AOF的工作流程操作：命令写入（append）、文件同步（sync）、文件重写（rewrite）、重启加载（load），如下图所示：

![AOF工作流程](https://haif-cloud.oss-cn-beijing.aliyuncs.com/redis/redis-aof.png)

1. 所有的写入命令都会追加到aof_buf（缓冲区）中
2. AOF缓冲区根据对应的策略向硬盘做同步操作
3. 定期对AOF文件进行压缩重写
4. 当Redis服务器重启时，加载AOF文件进行数据恢复

## 命令写入

AOF命令写入的内容是文本协议格式。例如set hello world命令会在AOF缓冲区追加如下文本：

```
*3\r\n$3\r\nset\r\n$5\r\nhello\r\n$5\r\nworld\r\n
```

AOF直接采用文本协议格式有如下原因：
* 文本协议具有很好的兼容性
* 直接采用协议格式可避免二次处理开销
* 文本协议可读性高，方便直接修改和处理

AOF直接把命令追加到aof_buf是因为Redis使用单线程响应命令，如果每次写AOF文件都直接追加到硬盘，那么性能完全取决于硬盘负载。而直接写到aof_buf缓冲区中，Redis可以提供多种缓冲区同步硬盘的策略，在性能和安全性方面做出平衡。

## 文件同步

Redis提供了多种AOF缓冲区同步文件策略，有参数appendfsync控制，可配置值以及含义如下表所示：

可配置值 | 说明
---|---
always | 命令写入aof_buf后调用系统fsync操作同步到AOF文件，fsync完成后线程返回
everysec（默认） | 命令写入aof_buf后调用系统write操作，write完成后线程返回。fsync同步文件操作由专门线程每秒调用一次
no | 命令写入aof_buf后调用系统write操作，不对AOF文件做fsync同步，同步硬盘操作由操作系统负责，通常同步周期最长30s

系统调用write和fsync区别如下：
* write操作会触发延迟写（delayed write）机制。Linux内核提供页缓冲区来提高硬盘I/O性能。write操作在写入系统缓冲区后直接返回，同步硬盘策略依赖于系统调度机制，比如：缓冲区页空间写满或达到特定同步周期。在同步硬盘前如果系统故障宕机，缓冲区数据将会丢失。
* fsync针对单个文件操作（比如AOF文件）做强制硬盘同步，fsync将阻塞直到同步完成。

同步策略建议配置为everysec，这也是默认配置，可做到兼顾性能和数据安全性。理论上只有在系统突然宕机的情况下丢失1秒的数据。

## 重写机制

Redis引入AOF重写机制压缩文件体积。AOF文件重写是把Redis进程内的数据转化为写命令同步到新AOF文件的过程。

重写后AOF文件变小有如下原因：
1. 进程内已经超时的数据不再写入文件；
2. 旧AOF文件含有无效命令，比如修改、删除等命令。而新AOF文件中只保留最终数据的写入命令；
3. 多条写命令被合并成一个，为了防止单条命令过大造成客户端缓冲区溢出，对于list、set、hash、zset等类型操作，单条命令最多64个元素；

### 触发机制

AOF重写过程可以手动触发和自动触发：
* 手动触发：直接调用bgrewriteaof命令
* 自动触发：根据auto-aof-rewrite-min-size和auto-aof-rewrite-percentage参数确定自动触发时机
    * auto-aof-rewrite-min-size：表示运行AOF重写时文件最小体积，默认为64MB；
    * auto-aof-rewrite-percentage：代表当前AOF文件空间（aof_current_size）和上一次重写后AOF文件空间（aof_base_size）的比值；

```
自动触发时机 = aof_current_size > auto-aof-rewrite-min-size && (aof_current_size - aof_base_size) / aof_base_size >= auto-aof-rewrite-percentage
```

### AOF重写运作流程

![AOF重写运作流程](https://haif-cloud.oss-cn-beijing.aliyuncs.com/redis/redis-aof-rewrite.png)

AOF重写运作流程说明：

1. 执行AOF重写请求
2. 父进程执行fork创建子进程
3. 
    - 主进程fork操作完成后，继续响应其它命令。所有修改命令依然可以写入AOF缓冲区并根据appendfsync策略同步到硬盘，保证原有AOF机制正确性 
    - 由于fork操作运用写时复制技术，子进程只能共享fork操作时的内存数据。由于父进程依然响应命令，Redis使用“AOF重写缓冲区”保存这部分新数据，防止新AOF文件生成期间丢失这部分数据
4. 子进程根据内存快照，按照命令合并规则写入到新AOF文件。每次批量写入硬盘数据量由配置aof-rewrite-incremental-fsync控制，默认为32MB，防止单次刷盘数据过多造成硬盘阻塞
5. 
    - 新AOF文件写入完成后，子进程发送信号给父进程，父进程更新统计信息，具体见info persistence下的aod_*相关统计
    - 父进程把AOF重写缓冲区的数据写到新的AOF文件
    - 使用新AOF文件替换老文件，完成AOF重写

## 重启加载

AOF和RDB文件都可以用于服务器重启时的数据恢复。如下图所示，表示Redis持久化文件加载流程。

![Redis持久化文件加载流程](https://haif-cloud.oss-cn-beijing.aliyuncs.com/redis/redis-load.png)

Redis持久化文件加载流程说明：
1. AOF持久化开启且存在AOF文件时，优先加载AOF文件
2. AOF关闭或AOF文件不存在时，加载RDB文件
3. 加载AOF/RDB文件成功后，Redis启动成功
4. 加载AOF/RDB文件存在错误时，Redis启动失败

## 文件校验

加载损坏的AOF文件时Redis会拒绝启动，并打印如下日志：

```
# Bad file format reading the append only file: make a backup of your AOF file, then use ./redis-check-aof --fix <filename>
```

对于错误格式的AOF文件，先进行备份，然后使用redis-check-aof --fix命令进行修复，修复后使用diff -u对比数据的差异，找到丢失的数据，有些可以人工修改补全。

AOF文件可能存在结尾不完整的情况，比如机器突然掉电导致AOF尾部文件命令写入不全。Redis提供了aof-load-truncated配置来兼容这种情况，默认开启。