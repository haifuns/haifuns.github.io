title: 【Redission源码】读写锁源码解析
author: haifun
tags:
  - Redission
categories:
  - 分布式锁
date: 2021-12-15 00:15:00
---

Redission支持可重入读写锁RReadWriteLock，允许同时有多个读锁或者一个写锁处于加锁状态。RReadWriteLock实现了juc.lock.ReadWriteLock接口，其中读锁和写锁都继承了RLock接口。

RReadWriteLock使用方法如下：

```java
RReadWriteLock rwlock = redisson.getReadWriteLock("anyRWLock");
// 最常见的使用方法
rwlock.readLock().lock();
// 或
rwlock.writeLock().lock();
```

为了解决死锁问题，在读写锁中依然使用看门狗机制不断延长有效期，默认超时时间为30秒。

# 读锁

## 加读锁

在Redission读写锁中，读锁在以下情况可以加锁成功：

1. 无锁或者其他线程只加过读锁
2. 同一个线程重复加读锁
3. **同一线程先加写锁后加读锁**

与可重入锁相比，读写锁锁结构有所不同，hash中存在一个标记锁模式的field以及多个标记加锁线程的field，所以在读锁加锁时，lua脚本存在差异：

```java
<T> RFuture<T> tryLockInnerAsync(long waitTime, long leaseTime, TimeUnit unit, long threadId, RedisStrictCommand<T> command) {
    return evalWriteAsync(getRawName(), LongCodec.INSTANCE, command,
                            // 读锁情况锁结构
                            // 1. 两个线程加读锁，"lock1": {"mode": "read", "uuid1:thread1": 1, "uuid1:thread1": 1}
                            // 2. 同一个线程重入加读锁，"lock1": {"mode": "read", "uuid1:thread1": 1, "uuid1:thread1": 2}
                            // 3. 同一个线程先加写锁后加读锁 **，"lock1": {"mode": "read", "uuid1:thread1": 1, "uuid1:thread1:write": 1}

                            // hash key=lock name 锁名，field=mode 锁模式
                            "local mode = redis.call('hget', KEYS[1], 'mode'); " +
                            // 如果模式为空，说明没有加过读写锁
                            "if (mode == false) then " +
                              // 设置模式为读锁
                              "redis.call('hset', KEYS[1], 'mode', 'read'); " +
                              // 新增锁，hash key=lock name，field=uuid:threadId，value=1
                              "redis.call('hset', KEYS[1], ARGV[2], 1); " +
                              // 新增一个读锁标记 key={lock name}:uuid:threadId:rwlock_timeout:1，value=1
                              "redis.call('set', KEYS[2] .. ':1', 1); " +
                              // 设置过期时间，默认30秒
                              "redis.call('pexpire', KEYS[2] .. ':1', ARGV[1]); " +
                              "redis.call('pexpire', KEYS[1], ARGV[1]); " +
                              "return nil; " +
                            "end; " +
                            // 如果是读锁模式，或者是当前线程加的写锁
                            "if (mode == 'read') or (mode == 'write' and redis.call('hexists', KEYS[1], ARGV[3]) == 1) then " +
                              // 重入锁，field=uuid:threadId，值加1
                              // 这里hash key是可以设置多个lock field，也就是可以加多个读锁
                              "local ind = redis.call('hincrby', KEYS[1], ARGV[2], 1); " + 
                              // {lock name}:uuid:threadId:rwlock_timeout:锁重入次数
                              "local key = KEYS[2] .. ':' .. ind;" +
                              // 设置重入标记 {lock name}:uuid:threadId:rwlock_timeout:当前重入次数
                              "redis.call('set', key, 1); " +
                              "redis.call('pexpire', key, ARGV[1]); " +
                              "local remainTime = redis.call('pttl', KEYS[1]); " +
                              // 更新过期时间
                              "redis.call('pexpire', KEYS[1], math.max(remainTime, ARGV[1])); " +
                              "return nil; " +
                            "end;" +
                            "return redis.call('pttl', KEYS[1]);",
                    // KEY[1] lock name，KEY[2] {lock name}:uuid:threadId:rwlock_timeout
                    Arrays.<Object>asList(getRawName(), getReadWriteTimeoutNamePrefix(threadId)),
                    // ARGV[1] 超时时间 默认30秒，ARGV[2] uuid:threadId，ARGV[3] uuid:threadId:write
                    unit.toMillis(leaseTime), getLockName(threadId), getWriteLockName(threadId));
}
```

## watchdog维持读锁

由于读写锁结构不同于一般可重入锁，所以watchdog维持锁的lua脚本也有所不同：

```java
protected RFuture<Boolean> renewExpirationAsync(long threadId) {
    String timeoutPrefix = getReadWriteTimeoutNamePrefix(threadId);
    String keyPrefix = getKeyPrefix(threadId, timeoutPrefix);
    
    return evalWriteAsync(getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_BOOLEAN,
            // 获取重入次数
            "local counter = redis.call('hget', KEYS[1], ARGV[2]); " +
            "if (counter ~= false) then " +
                // 不为空说明正常加锁，更新锁过期时间
                "redis.call('pexpire', KEYS[1], ARGV[1]); " +
                
                "if (redis.call('hlen', KEYS[1]) > 1) then " +
                    "local keys = redis.call('hkeys', KEYS[1]); " + 
                    "for n, key in ipairs(keys) do " + 
                        // 遍历锁hash所有field，找到uuid:threadId的值，也即重入次数
                        "counter = tonumber(redis.call('hget', KEYS[1], key)); " + 
                        "if type(counter) == 'number' then " + 
                            "for i=counter, 1, -1 do " + 
                                // 重置所有重入标记过期时间
                                "redis.call('pexpire', KEYS[2] .. ':' .. key .. ':rwlock_timeout:' .. i, ARGV[1]); " + 
                            "end; " + 
                        "end; " + 
                    "end; " +
                "end; " +
                
                "return 1; " +
            "end; " +
            "return 0;",
        // KEY[1] lock name，KEY[2] {lock name}:uuid:threadId
        Arrays.<Object>asList(getRawName(), keyPrefix),
        // ARGV[1] 默认超时时间30秒，ARGV[2] uuid:threadId
        internalLockLeaseTime, getLockName(threadId));
}
```

## 解锁读锁

在读锁进行解锁时，需要删除或者减少当前线程读锁重入次数，并且更新过期时间：

```java
protected RFuture<Boolean> unlockInnerAsync(long threadId) {
    String timeoutPrefix = getReadWriteTimeoutNamePrefix(threadId);
    String keyPrefix = getKeyPrefix(threadId, timeoutPrefix);

    return evalWriteAsync(getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_BOOLEAN,
            // 获取锁模式
            "local mode = redis.call('hget', KEYS[1], 'mode'); " +
            "if (mode == false) then " +
                // 模式不存在说明锁不存在，直接发布解锁消息，返回成功
                "redis.call('publish', KEYS[2], ARGV[1]); " +
                "return 1; " +
            "end; " +
            // 获取当前线程持有锁重入次数
            "local lockExists = redis.call('hexists', KEYS[1], ARGV[2]); " +
            "if (lockExists == 0) then " +
                "return nil;" +
            "end; " +
                
            // 重入次数 - 1
            "local counter = redis.call('hincrby', KEYS[1], ARGV[2], -1); " + 
            "if (counter == 0) then " +
                // 如果解锁前只重入了一次，说明可以解锁了，直接删除field
                "redis.call('hdel', KEYS[1], ARGV[2]); " + 
            "end;" +
            // 删除标记 {lock name}:uuid:threadId:rwlock_timeout:最后一次重入
            "redis.call('del', KEYS[3] .. ':' .. (counter+1)); " +
            
            // 如果hash中的字段数量大于1
            "if (redis.call('hlen', KEYS[1]) > 1) then " +
                "local maxRemainTime = -3; " + 
                // 获得hash key = lock name所有field
                "local keys = redis.call('hkeys', KEYS[1]); " + 
                "for n, key in ipairs(keys) do " + 
                    // 遍历field，就是在找field = uuid:threadId，得到重入次数
                    "counter = tonumber(redis.call('hget', KEYS[1], key)); " + 
                    "if type(counter) == 'number' then " + 
                        "for i=counter, 1, -1 do " + 
                            // 从1开始遍历到重入次数，得到所有{lock name}:uuid:threadId:rwlock_timeout:x的过期时间
                            "local remainTime = redis.call('pttl', KEYS[4] .. ':' .. key .. ':rwlock_timeout:' .. i); " + 
                            // 找到所有重入标记中ttl最大值
                            "maxRemainTime = math.max(remainTime, maxRemainTime);" + 
                        "end; " + 
                    "end; " + 
                "end; " +
                        
                // 如果所有重入标记最大超时时间大于0，说明锁还有重入次数
                "if maxRemainTime > 0 then " +
                    // 把标记的最大过期时间设置给锁
                    "redis.call('pexpire', KEYS[1], maxRemainTime); " +
                    "return 0; " +
                "end;" + 
                    
                // 如果模式为写锁，直接返回失败
                "if mode == 'write' then " + 
                    "return 0;" + 
                "end; " +
            "end; " +
                
            // 否则，说明可以解锁，直接删除锁，发布一条解锁消息
            "redis.call('del', KEYS[1]); " +
            "redis.call('publish', KEYS[2], ARGV[1]); " +
            "return 1; ",
            // key[1] lock name，key[2] redisson_rwlock:{lock name}，key[3] {lock name}:uuid:threadId:rwlock_timeout，key[4] {lock name}:uuid:threadId
            Arrays.<Object>asList(getRawName(), getChannelName(), timeoutPrefix, keyPrefix),
            // ARGV[1] 解锁消息通道，ARGV[2] uuid:threadId
            LockPubSub.UNLOCK_MESSAGE, getLockName(threadId));
}
```

# 写锁

Redission的读写锁中，写锁只有在以下情况才能加锁成功：

1. 没有任何线程加过锁
2. 同一个线程重复加写锁

## 加写锁

加写锁时相对简单，只需要判断是否加过锁、是否是当前线程加过写锁：

```java
<T> RFuture<T> tryLockInnerAsync(long waitTime, long leaseTime, TimeUnit unit, long threadId, RedisStrictCommand<T> command) {
    return evalWriteAsync(getRawName(), LongCodec.INSTANCE, command,
                        // 写锁情况锁结构
                        // 1. 无锁加写锁，"lock1": {"mode": "write", "uuid1:thread1:write": 1}
                        // 2. 同一个线程重入加写锁，"lock1": {"mode": "write", "uuid1:thread1:write": 2}

                        // 获取锁的模式
                        "local mode = redis.call('hget', KEYS[1], 'mode'); " +
                        // 如果获取不到说明没加过锁，直接添加锁、设置写锁模式、设置过期时间
                        "if (mode == false) then " +
                              "redis.call('hset', KEYS[1], 'mode', 'write'); " +
                              // hash key = lock name，field = uuid:threadId:write
                              "redis.call('hset', KEYS[1], ARGV[2], 1); " +
                              "redis.call('pexpire', KEYS[1], ARGV[1]); " +
                              "return nil; " +
                          "end; " +
                          // 如果锁的模式是写锁
                          "if (mode == 'write') then " +
                              // 如果写锁是当前线程加的，那么就把重入次数加1，更新过期时间
                              "if (redis.call('hexists', KEYS[1], ARGV[2]) == 1) then " +
                                  "redis.call('hincrby', KEYS[1], ARGV[2], 1); " + 
                                  "local currentExpire = redis.call('pttl', KEYS[1]); " +
                                  "redis.call('pexpire', KEYS[1], currentExpire + ARGV[1]); " +
                                  "return nil; " +
                              "end; " +
                            "end;" +
                            // 其他情况加锁失败，返回过期时间
                            "return redis.call('pttl', KEYS[1]);",
                    // KEY[1] lock name
                    Arrays.<Object>asList(getRawName()),
                    // ARGV[1] 过期时间，ARGV[2] uuid:threadId:write
                    unit.toMillis(leaseTime), getLockName(threadId));
}
```

## watchdog维持写锁

写锁结构与普通可重入锁结构一致，watchdog机制同RedissonLock，不再复述。

## 写锁解锁

当只有写锁解锁时，要么直接删除锁，要么减少写锁重入次数并且更新过期时间。当既有写锁又有读锁时，锁模式为写锁模式，在需要删除写锁时，还需要把锁模式转变为读模式。

```java
protected RFuture<Boolean> unlockInnerAsync(long threadId) {
    return evalWriteAsync(getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_BOOLEAN,
            // 查询锁模式
            "local mode = redis.call('hget', KEYS[1], 'mode'); " +
            "if (mode == false) then " +
                // 如果锁不存在，直接发布解锁消息
                "redis.call('publish', KEYS[2], ARGV[1]); " +
                "return 1; " +
            "end;" +
            // 如果模式是写锁
            "if (mode == 'write') then " +
                // 查看当前线程加的写锁重入次数
                "local lockExists = redis.call('hexists', KEYS[1], ARGV[3]); " +
                // 如果是空，直接返回
                "if (lockExists == 0) then " +
                    "return nil;" +
                "else " +
                    // 如果写锁重入次数不是空，直接减1
                    "local counter = redis.call('hincrby', KEYS[1], ARGV[3], -1); " +
                    "if (counter > 0) then " +
                        // 如果可重入了多次，更新过期时间返回
                        "redis.call('pexpire', KEYS[1], ARGV[2]); " +
                        "return 0; " +
                    "else " +
                        // 如果只加了一次读锁，当前解锁写锁后还有可能存在读锁，需要把加锁模式转换为读锁
                        
                        // 直接删除写锁 
                        "redis.call('hdel', KEYS[1], ARGV[3]); " +
                        // 如果hash里只剩下field mode，直接删除锁
                        "if (redis.call('hlen', KEYS[1]) == 1) then " +
                            "redis.call('del', KEYS[1]); " +
                            "redis.call('publish', KEYS[2], ARGV[1]); " + 
                        "else " +
                            // 如果hash里field大于1，把锁模式修改为读锁
                            // has unlocked read-locks
                            "redis.call('hset', KEYS[1], 'mode', 'read'); " +
                        "end; " +
                        "return 1; "+
                    "end; " +
                "end; " +
            "end; "
            + "return nil;",
            // KEY[1] lock name，KEY[2] redisson_rwlock:{lock name}
    Arrays.<Object>asList(getRawName(), getChannelName()),
    // ARGV[1] 解锁标记，ARGV[2] 过期时间，ARGV[3] uuid:thread:write
    LockPubSub.READ_UNLOCK_MESSAGE, internalLockLeaseTime, getLockName(threadId));
}
```