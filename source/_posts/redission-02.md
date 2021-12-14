title: 【Redission源码】公平锁源码解析
author: haifun
tags:
  - Redission
categories:
  - 分布式锁
date: 2021-12-13 00:15:00
---

Redission提供RedissonFairLock实现公平锁，使用方式如下：

```java
RLock fairLock = redisson.getFairLock("anyLock");
fairLock.lock();
fairLock.unlock();
```

RedissionFairLock可以保证当多个Residdion客户端线程同时请求加锁时，优先分配给先发起请求的线程。所有请求线程会在一个队列中排队，当某个线程宕机时，Redission会等待5秒后继续下一个线程。也就是说如果前面有5个线程都处于等待状态，那么后面的线程会等待至少25秒。

# 排队加锁

RedissionFairLock继承自RedissionLock，加锁逻辑中重写了#tryLockInnerAsync方法，加锁lua有所不同，除了hash存放锁外，还存在一个list结构存在等待队列，一个zset结构存在等待队列timeout时间。详细处理如下所示：

```java
<T> RFuture<T> tryLockInnerAsync(long waitTime, long leaseTime, TimeUnit unit, long threadId, RedisStrictCommand<T> command) {
    long wait = threadWaitTime;
    if (waitTime != -1) {
        wait = unit.toMillis(waitTime);
    }

    long currentTime = System.currentTimeMillis();
    
    // ...
    
    if (command == RedisCommands.EVAL_LONG) {
        return evalWriteAsync(getRawName(), LongCodec.INSTANCE, command,
                // remove stale threads
                "while true do " +
                    // 从等待队列redisson_lock_queue:{锁名}中获取第1个元素
                    "local firstThreadId2 = redis.call('lindex', KEYS[2], 0);" +
                    // 如果没有排队加锁的线程，就跳出循环执行加锁逻辑
                    "if firstThreadId2 == false then " +
                        "break;" +
                    "end;" +

                    // 获取当前线程剩余超时时间
                    "local timeout = tonumber(redis.call('zscore', KEYS[3], firstThreadId2));" +
                    // 如果超时时间小于当前时间，那么直接移除当前等待的线程
                    "if timeout <= tonumber(ARGV[4]) then " +
                        // remove the item from the queue and timeout set
                        // NOTE we do not alter any other timeout
                        "redis.call('zrem', KEYS[3], firstThreadId2);" +
                        "redis.call('lpop', KEYS[2]);" +
                    "else " +
                        "break;" +
                    "end;" +
                "end;" +

                // 如果锁不存在或者队列redisson_lock_queue:{锁名}不存在或者队列中第一个元素是uuid:threadId
                // check if the lock can be acquired now
                "if (redis.call('exists', KEYS[1]) == 0) " +
                    "and ((redis.call('exists', KEYS[2]) == 0) " +
                        "or (redis.call('lindex', KEYS[2], 0) == ARGV[2])) then " +

                    // remove this thread from the queue and timeout set
                    // 从redisson_lock_queue:{锁名}中移除第一个元素
                    "redis.call('lpop', KEYS[2]);" +
                    // 从zset结构redisson_lock_timeout:{锁名}中弹出uuid:threadId
                    "redis.call('zrem', KEYS[3], ARGV[2]);" +

                    // 遍历timeout zset，给每个元素减5秒
                    // decrease timeouts for all waiting in the queue
                    "local keys = redis.call('zrange', KEYS[3], 0, -1);" +
                    "for i = 1, #keys, 1 do " +
                        "redis.call('zincrby', KEYS[3], -tonumber(ARGV[3]), keys[i]);" +
                    "end;" +

                    // add hash 锁名，field uuid:threadId，value 1
                    // 设置过期时间，默认30秒，返回空
                    // acquire the lock and set the TTL for the lease
                    "redis.call('hset', KEYS[1], ARGV[2], 1);" +
                    "redis.call('pexpire', KEYS[1], ARGV[1]);" +
                    "return nil;" +
                "end;" +

                // 如果当前线程已经加过锁了，就把value加1，更新过期时间，返回空
                // check if the lock is already held, and this is a re-entry
                "if redis.call('hexists', KEYS[1], ARGV[2]) == 1 then " +
                    "redis.call('hincrby', KEYS[1], ARGV[2],1);" +
                    "redis.call('pexpire', KEYS[1], ARGV[1]);" +
                    "return nil;" +
                "end;" +

                // 获取当前线程等待超时时间，如果存在就返回剩余的超时时间
                // the lock cannot be acquired
                // check if the thread is already in the queue
                "local timeout = redis.call('zscore', KEYS[3], ARGV[2]);" +
                "if timeout ~= false then " +
                    // the real timeout is the timeout of the prior thread
                    // in the queue, but this is approximately correct, and
                    // avoids having to traverse the queue
                    "return timeout - tonumber(ARGV[3]) - tonumber(ARGV[4]);" +
                "end;" +

                // add the thread to the queue at the end, and set its timeout in the timeout set to the timeout of
                // the prior thread in the queue (or the timeout of the lock if the queue is empty) plus the
                // threadWaitTime
                // 从等待队列里取出最后一个线程
                "local lastThreadId = redis.call('lindex', KEYS[2], -1);" +
                "local ttl;" +
                "if lastThreadId ~= false and lastThreadId ~= ARGV[2] then " +
                    // 最后一个线程等待ttl
                    "ttl = tonumber(redis.call('zscore', KEYS[3], lastThreadId)) - tonumber(ARGV[4]);" +
                "else " +
                    // 正在加锁的线程ttl
                    "ttl = redis.call('pttl', KEYS[1]);" +
                "end;" +
                // timeout = 上一个锁ttl + 30s + 当前时间
                "local timeout = ttl + tonumber(ARGV[3]) + tonumber(ARGV[4]);" +
                // 把当前线程添加到超时zset里，值为timeout
                "if redis.call('zadd', KEYS[3], timeout, ARGV[2]) == 1 then " +
                    // 把当前线程添加到等待队列
                    "redis.call('rpush', KEYS[2], ARGV[2]);" +
                "end;" +
                "return ttl;",
                // key[1] 锁名；key[2] 等待队列 redisson_lock_queue:{锁名}；key[3] 超时zset redisson_lock_timeout:{锁名}
                Arrays.asList(getRawName(), threadsQueueName, timeoutSetName),
                // ARGV[1] 超时时间；ARGV[2] field uuid:threadId；ARGV[3] 等待时间，默认5秒；ARGV[4] 当前时间
                unit.toMillis(leaseTime), getLockName(threadId), wait, currentTime);
    }

    throw new IllegalArgumentException();
}
```

# 可重入加锁

RedissionFairLock公平锁可重入加锁逻辑同可重入锁RedissionFairLock，当加锁线程是当前线程，那么把lock key对应的field value值加1，然后更新lock key过期时间。

# 超时重新入队

如果当前线程已经加入等待队列开始排队，并且超过了等待时间（前面每个锁5秒），那么再次获取锁时，首先会移除当前线程（以及之前线程）在等待队列和超时集合中的值，然后尝试获取锁，如果获取锁失败会重新把当前线程添加到等待队列末尾，并且重新放到超时集合中，timeout为队列中最后一个线程超时时间 + 5秒。

# 释放锁

在解锁时，RedissionFairLock会先删除等待队列中已经超时的线程，然后开始处理解锁，如果被当前线程重入了多次就把value减1，否则直接删除锁，同时发布一条解锁消息通知订阅的等待线程。

```java
protected RFuture<Boolean> unlockInnerAsync(long threadId) {
    return evalWriteAsync(getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_BOOLEAN,
            // remove stale threads
            "while true do "
            + "local firstThreadId2 = redis.call('lindex', KEYS[2], 0);"
            + "if firstThreadId2 == false then "
                + "break;"
            + "end; "
            // 删除等待队列中已经过期的线程
            + "local timeout = tonumber(redis.call('zscore', KEYS[3], firstThreadId2));"
            + "if timeout <= tonumber(ARGV[4]) then "
                + "redis.call('zrem', KEYS[3], firstThreadId2); "
                + "redis.call('lpop', KEYS[2]); "
            + "else "
                + "break;"
            + "end; "
          + "end;"
            
          // 如果锁不存在
          + "if (redis.call('exists', KEYS[1]) == 0) then " + 
                "local nextThreadId = redis.call('lindex', KEYS[2], 0); " + 
                "if nextThreadId ~= false then " +
                    "redis.call('publish', KEYS[4] .. ':' .. nextThreadId, ARGV[1]); " +
                "end; " +
                "return 1; " +
            "end;" +
            "if (redis.call('hexists', KEYS[1], ARGV[3]) == 0) then " +
                "return nil;" +
            "end; " +
            // 重入加锁处理
            "local counter = redis.call('hincrby', KEYS[1], ARGV[3], -1); " +
            "if (counter > 0) then " +
                "redis.call('pexpire', KEYS[1], ARGV[2]); " +
                "return 0; " +
            "end; " +
                
            // 如果只重入了一次直接删除
            "redis.call('del', KEYS[1]); " +
            "local nextThreadId = redis.call('lindex', KEYS[2], 0); " + 
            "if nextThreadId ~= false then " +
                // 发布一条解锁消息，通知等待加锁的线程
                "redis.call('publish', KEYS[4] .. ':' .. nextThreadId, ARGV[1]); " +
            "end; " +
            "return 1; ",
            Arrays.asList(getRawName(), threadsQueueName, timeoutSetName, getChannelName()),
            LockPubSub.UNLOCK_MESSAGE, internalLockLeaseTime, getLockName(threadId), System.currentTimeMillis());
}
```