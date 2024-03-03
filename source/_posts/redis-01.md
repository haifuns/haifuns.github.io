title: 【Redis】内存模型
author: HAIF.
tags:
  - Redis
categories:
  - NoSQL
date: 2021-01-15 23:20:00
---

# 内存模型

Redis可以存储键与5 种数据结构类型之间的映射，分别为：

* STRING 字符串
* LIST 列表
* SET 集合
* HASH 哈希
* ZSET 有序集合

<!-- more -->

下表对比了Redis 提供的5 种结构，说明结构存储值并简单介绍其语义：

结构类型 | 结构类型的值 | 结构的读写能力
---|---|---
STRING(字符串) | 字符串、整数、浮点数 | 对整个字符串或者字符串的其中一部分执行操作；对整数或浮点数执行自增(increment)或自减(decrement)操作
LIST(列表) | 一个链表，链表上每个节点都包含一个字符串 | 从链表的两端推入或者弹出元素；根据偏移量对链表进行修剪(trim)；读取单个或多个元素；根据值查找或获取元素
SET(集合) | 包含字符串的无序收集器(unordered collection)，并且被包含的每个字符串都是独一无二、各不相同的 | 添加、获取、移除单个元素；检查一个元素是否存在于集合中；计算交集、并集、差集；从集合里随机获取元素
HASH(哈希) | 包含键值对的无序哈希表 | 添加、获取、移除单个键值对；获取所有键值对
ZSET(有序集合) | 字符串成员(member)与浮点数分值(score)之间的有序映射，元素的排列顺序由分值的大小决定 | 添加、获取、删除单个元素；根据分值范围(range)或者成员来获取元素

# 内部编码

实际上每种数据结构都有自己底层的内部编码实现，而且是多种实现，Redis会在合适的场景选择合适的内部编码。对应关系如下表所示：

数据结构 | 内部编码
---|---
string | raw、int、embstr
hash | hashtable、ziplist
list | linkedlist、ziplist
set | hashtable、intset
zset | skiplist、ziplist

通过`object encoding [key]`命令可以查询key内部编码

# String(字符串)

字符串类型是Redis最基础的数据结构。字符串类型的值实际可以是字符串、数字（整数、浮点数），甚至是二进制，但是值最大不能超过512MB。

## 命令

### 设置值

```shell
set key value [ex seconds] [px milliseconds] [nx|xx]
```

set命令选项如下：
* ex seconds：为键设置秒级过期时间
* px milliseconds：为键设置毫秒级过期时间
* nx：键必须不存在才可以设置成功，用于添加
* xx：与nx相反，键必须存在才可以设置成功，用于更新

除set选项外，Redis还提供了setex和setnx两个命令：

```shell
setex key seconds value # 更新value并重新设置过期时间，此命令可保证原子性操作
setnx key value # set if not exists，key不存在则set，存在无操作
```

> setnx可以作为分布式锁的一种实现方案，官方实现：http://redis.io/topics/distlock

### 获取值

```shell
get key
```

### 批量设置值

```shell
mset key value [key value ...]
```

### 批量获取值

```shell
mget key [key ...]
```

### 计数

```shell
incr key # 自增
decr key # 自减
incrby key increment # 自增指定数字
decrby key decrement # 自减指定数字
incrbyfloat key increment # 自增浮点数
```

### 其他命令

```
append key value # 追加值
strlen key # 字符串长度
getset key value # 设置并返回原值
setrange key offeset value # 设置指定位置的字符
getrange key start end # 获取部分字符串
```

## 内部编码

字符串类型的内部编码有三种：
* int：8个字节的长整形
* embstr：小于等于39个字节的字符串
* raw：大于39个字节的字符串

Redis会根据当前值的类型和长度决定使用哪种内部编码实现。

## 使用场景

* 缓存功能
* 计数
* 共享session
* 限速

# Hash(哈希)

Redis 的哈希可以存储多个键值对之间的映射，和字符串一样，哈希存储的值可以是字符串也可以是数字，并且可以对哈希存储的数字值执行自增或者自减操作。

> 哈希类型中的映射关系是field -> value

## 操作

## 命令

```
hset key field value # 设置值
hget key field # 获取值
hdel key field [field] # 删除一个或多个值

hlen key # 计算field个数

hmget key field [field] # 批量获取field值
hmset key field value [field value] # 批量设置field

hexists key field # 判断field是否存在

hkeys key # 获取所有field
hvals key # 获取所有value
hgetall key # 获取所有field-value

hincrby key field increment # field值增加increment
hincrbyfloat key field increment # field值加上浮点数增量increment

hstrlen key field # 计算value的字符串长度
```

## 内部编码

哈希类型的内部编码有两种：
* ziplist（压缩列表）：当哈希类型元素个数小于hash-max-ziplist-entries配置（默认512个）、同时所有值小于hash-max-ziplist-value配置（默认64字节）时，Redis会使用ziplist作为哈希内部实现，ziplist使用更加紧凑的结构实现多个元素的连续存储，更加节省内存。
* hashtable（哈希表）：当哈希类型无法满足ziplist条件时，Redis会使用hashtable作为哈希内部实现，因为此时ziplist的读写效率会下降，而hashtable读写时间复杂度是O(1)。

## 使用场景

* 存储对象信息

哈希类型与关系型数据库不同之处：
* 哈希类型是稀疏的，关系型数据库是完全结构化的。例如哈希类型可以每个键有不同的field，而关系型数据库每行列一致。
* 关系型数据库可以做复杂的关系查询，而Redis模拟关系型复杂查询开发困难，维护成本高。

# List(列表)

列表（list）类型用来存储多个有序的字符串。列表中每个字符串称为元素，一个列表最多可以存储2^32-1个元素。在Redis中，可以对列表两端插入(push)和弹出(pop)，还可以获取指定范围的元素列表、获取指定索引下标的元素等。

## 命令

### 添加操作

```
rpush key value [value ...] # 从右边插入元素
lpush key value [value ...] # 从左边插入元素
linsert key before|after pivot value # 查找等于pivot的元素，在其前/后插入新元素
```

### 查询操作

```
lrange key start end # 获取指定范围内的元素列表，从左到右是0 ~ (N-1)，从右到左是-1 ~ -N，lrange key 0 -1 查询所有
lindex key index # 获取列表指定索引下标的元素
llen key # 获取列表长度
```

### 删除操作

```
lpop key # 从列表左侧弹出元素
rpop key # 从列表右侧弹出元素

lrem key count value # 删除指定元素
                     # count > 0，从左到右删除最多count个元素
                     # count < 0，从右到左删除最多count绝对值的元素
                     # count = 0，删除所有

ltrim key start end # 按照索引范围修剪列表
```

### 修改操作

```
lset key index newValue # 修改指定索引下标的元素
```

### 阻塞操作

```
blpop key [key ...] timeout
brpop key [key ...] timeout
```

blpop和brpop是lpop和rpop的阻塞版本，它们除了弹出方向不同，使用方法基本相同，所以下面以brpop命令进行说明，brpop命令包含两个参数：

* key [key...]：多个列表的键
* timeout：阻塞时间（单位：秒）

如果blpop/brpopkey时，key对应的列表为空，timeout=n，则客户端等待n秒后返回，如果timeout=0，则客户端一直阻塞，直到列表中被添加元素。如果列表不为空则直接返回。

如果使用的是多个键，redis会从左到右遍历键，一旦有一个键可以弹出元素，则客户端立即返回。

## 内部编码

列表类型的内部编码有两种：
* ziplist（压缩列表）：当列表元素个数小于hash-max-ziplist-entries配置（默认512个）、同时列表中每个元素值都小于hash-max-ziplist-value配置（默认64字节）时，Redis会选用ziplist作为列表的内部实现来减少内存的使用。
* linkedlist（链表）：当列表类型无法满足ziplist的条件时，Redis会使用linkedlist作为列表的内部实现。

## 使用场景

* 消息队列：Redis的lpush+brpop命令组合即可实现阻塞队列，生产者使用lpush从列表左侧插入元素，多个消费者使用brpop命令阻塞式“抢”列表尾部的元素。
* 文章列表

实际上列表的使用场景很多，在选择时可以参考以下口诀：

```
lpush + lpop = Stack(栈)
lpush + rpop = Queue(队列)
lpush + ltrim = Capped Collection(有限集合)
lpush + brpop = Message Queue(消息队列)
```

# Set(集合)

集合(set)类型也是用来存储多个字符串元素，集合与列表的区别在于集合中不允许有重复元素，并且集合中的元素是无序的，不能使用索引下标获取元素。

一个集合中最多可以存储2^32-1个元素。Redis除了支持集合内的增删改查，同时还支持多个集合取交集、并集、差集。

## 命令

### 集合内操作

```
sadd key element [element ...] # 添加元素，结果为成功添加个数
srem key element [element ...] # 删除元素，结果为成功删除个数

scard key # 计算元素个数
sismember key element # 判断元素是否在集合中

srandmember key [count] # 随机从集合返回指定个数元素，count默认值为1，仅返回不删除
spop key # 从集合随机弹出一个元素，并删除

smember key # 获取所有元素
```

### 集合间操作

```
sinter key [key ...] # 求多个集合的交集
suinon key [key ...] # 求多个集合的并集
sdiff key [key ...] # 求多个集合的差集
```

## 内部编码

集合类型的内部编码有两种：
* intset（整数集合）：当集合中元素都是整数且元素个数小于set-max-intset-enties配置（默认512个）时，Redis会选用intset作为集合的内部实现，从而减少内存的使用。
* hashtable（哈希表）：当集合类型无法满足intset条件时，Redis会使用hashtable作为集合内部实现。

# Zset(有序集合)

有序集合和集合一样也是字符串类型元素的集合，且不允许重复的成员。不同的是每个元素都会关联一个double类型的分数(score)。Redis正是通过分数来为集合中的成员进行从小到大的排序。

有序集合的成员是唯一的,但分数(score)却可以重复。

列表、集合、有序集合三者异同点如下表所示：

数据结构 | 是否允许重复元素 | 是否有序 | 有序实现方式 | 应用场景
---|---|---|---|---
列表 | 是 | 是 | 索引下标 | 时间轴、消息队列等
集合 | 否 | 否 | - | 标签、社交等
有序集合 | 否 | 是 | 分值 | 排行榜系统、社交等

## 命令

### 集合内操作

```
zadd key score member [score member ...] # 添加元素，返回成功添加的成员个数
zcard key # 计算成员个数
zscore key member # 计算某个成员的分数

zrank key member # 计算成员排名，分数从低到高
zrevrank key member # 计算成员排名，分数从高到低

zrem key member [member ...] # 删除成员

zincrby key increment member # 增加成员的分数

zrange key start end [withscores] # 返回指定排名范围的成员，分数从低到高，加withscores选项会返回成员的分数
zrevrange key start end [withscores] # 返回指定排名范围的成员，分数从高到低

zrangebyscore key min max [withscores] [limit offset count] # 返回指定分数范围的成员，按分数从低到高返回
                        # withscores选项会同时返回分数，
                        # [limit offset count]选项可以限制输出的起始位置和个数
                        # min和max还支持开区间（小括号）和闭区间（中括号），-inf和+inf分别代表无限小和无限大
zrevrangebyscore key max min [withscores] [limit offset count] # 返回指定分数范围的成员，按分数从高到低返回

zcount key min max # 返回指定分数范围成员个数
zremrangebyrank key start end # 删除指定排名内的升序元素
zremrangebyscore key min max # 删除指定分数范围的成员
```

### 集合间操作

```
zinterstore destination numkeys key [key ...] [weights weight [weight ...]] [aggregate sum|min|max] # 交集
    # destination：交集计算结果保存到这个键
    # numkeys：需要做交集计算键的个数
    # key [key ...]：需要做交集计算的键
    # weights weight [weight ...]：每个键的权重，在做交集计算时，每个键中的每个member会将自己分数乘以这个权重，每个键的权重默认是1
    # aggregate sum|min|max：计算成员交集后，分值可以按照sum（和）、min（最小值）、max（最大值）做汇总，默认值是sum
            
zunionstore destination numkeys key [key ...] [weights weight [weight ...]] [aggregate sum|min|max] # 并集
```

## 内部编码

有序集合类型的内部编码有两种：
* ziplist（压缩列表）：当有序集合的元素个数小于zset-max-ziplist-entries配置（默认128个），同时每个元素的值都小于zset-max-ziplist-value配置（默认64字节）时，Redis会用ziplist来作为有序集合的内部实现，ziplist可以有效减少内存的使用。
* skiplist（跳跃表）：当ziplist条件不满足时，有序集合会使用skiplist作为内部实现，因为此时ziplist的读写效率会下降。

## 使用场景

有序集合比较典型的使用场景就是排行榜系统。例如视频网站需要对用户上传的视频做排行榜，榜单的维度可能是多个方面的：按照时间、按照播放数量、按照获得的赞数。本节使用赞数这个维度，记录每天用户上传视频的排行榜。
