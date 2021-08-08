title: 【Redis】内存管理
author: HAIF.
tags:
  - Redis
categories:
  - NoSQL
date: 2021-02-13 14:00:00
---

# 内存消耗

## 内存使用统计

通过执行`info memory`命令可以获取Redis内存相关指标。内存统计指标和对应解释如下表所示：


属性名 | 属性描述
---|---
used_memory | 内存存储的所有数据内存占用量
used_memory_human | 以可读的格式返回used_memory
used_memory_rss | 从操作系统的角度显示Redis进程占用的物理内存总量
used_memory_peak | 内存使用的最大值，表示used_memory的峰值
used_memory_peak_human | 以可读格式返回used_memory_peak
used_memory_lua | Lua引擎消耗的内存大小
mem_fragmentation_ratio | used_memory_rss/used_memory比值，表示内存碎片率。大于1表示used_memory_rss - used_memory多出的部分内存被内存碎片消耗；小于1一般是操作系统把Redis内存交换到磁盘导致
mem_allocator | Redis使用的内存分配器，默认为jemalloc

<!-- more -->

## 内存消耗划分

Redis进程内内存消耗主要包括：自身内存、对象内存、缓冲内存、内存碎片。

其中Redis空进程自身内存消耗非常小，通常used_memory_rss在3MB左右，used_memory在800KB左右，一个空Redis进程消耗内存可以忽略不计。

对象内存是Redis内存占用最大的一块，存储着用户所有数据。

缓冲内存主要包括：客户端缓冲、复制积压缓冲区、AOF缓冲区。

## 子进程内存消耗

子进程内存消耗主要是指AOF/RDB重写时Redis创建的子进程内存消耗。Redis执行fork操作产生的子进程不需要消耗1倍父进程内存，实际消耗根据期间写入的命令量决定，但是依然要预留出一些内存防止溢出。

# 内存管理

## 内存上限

Redis默认无限使用服务器内存，使用maxmemory参数可以限制最大可用内存。需要注意的是，maxmemory限制的是Redis实际使用的内存量，也就是used_memory统计的内存。由于内存碎片率的存在，实际消耗内存可能会大于maxmemory设置的值。

Redis内存上限可以通过`config set maxmemory`进行动态修改。

## 内存回收策略

Redis的内存回收机制主要体现在两个方面：
* 删除达到过期时间的键对象
* 内存使用达到maxmemory上限时触发内存溢出控制策略

## 删除过期键对象

Redis所有键都可以设置过期属性，由于进程内保存大量键，维护每个键精准的过期删除机制会导致消耗大量的CPU成本过高，因此Redis采用惰性删除和定时任务删除机制实现过期键的内存回收。

* 惰性删除：用于当客户端读取带有超时属性的键时，如果已经超出键设置的过期时间，会执行删除操作并返回空。
* 定时任务删除：Redis内部维护着一个定时任务，默认每秒运行10次。其中删除过期键逻辑采用自适应算法，根据键的过期比例使用快慢两种速率模式回收，快慢两种模式删除逻辑相同只是超时时间不同。任务流程如下：
    -  定时任务在每个数据库随机检查20个键，当发现过期时删除对应键。
    -  如果超过检查数25%的键过期，循环执行回收逻辑直到不足25%或运行超时（慢模式下超时时间为25ms）
    -  如果之前回收键逻辑超时，则在Redis触发内部事件前再次以快模式回收（快模式下超时时间为1ms且2s内只能运行1次）

## 内存溢出控制策略

当Redis所用的内存达到maxmemory上限时会触发相应的溢出控制策略。具体策略受maxmemoey-policy参数控制，支持6种策略：
1. noeviction：默认策略，不会删除任何数据，拒绝写入并返回OOM错误
2. volatile-lru：根据LRU算法删除设置了超时属性的键，直到腾出足够空间，如果没有可以删除的键则回退到noeviction策略
3. allkeys-lru：根据LRU算法删除键，不管数据有没有设置超时属性，直到腾出足够空间为止
4. allkeys-random：随机删除所有键，直到腾出足够空间
5. volatile-random：随机删除过期键，直到腾出足够空间
6. volatile-ttl：根据键值对象的ttl属性，删除最近将要过期的数据，如果没有回退到noevication策略