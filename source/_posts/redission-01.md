title: 【Redission源码解析】可重入锁源码实现
author: haifun
tags:
  - Redission
categories:
  - 分布式锁
date: 2021-12-11 23:15:00
---

Redission提供的可重入锁RedissonLock实现了java.util.concurrent.locks.Lock接口，使用起来非常简单，示例如下：

```java
RLock lock = redisson.getLock("anyLock");
lock.lock();
```

同时，还支持指定锁超时时间、指定获取锁最大等待时间以及异步获取锁的方式：

```java
// 加锁后10秒钟自动解锁
// 无需调用unlock方法手动解锁
lock.lock(10, TimeUnit.SECONDS);

// 尝试加锁，最多等待100秒，加锁后10秒钟自动解锁
boolean res = lock.tryLock(100, 10, TimeUnit.SECONDS);

// 异步加锁
RLock lock = redisson.getLock("anyLock");
lock.lockAsync();
lock.lockAsync(10, TimeUnit.SECONDS);
Future<Boolean> res = lock.tryLockAsync(100, 10, TimeUnit.SECONDS);
```

接下来我们来探究一下RedissionLock可重入锁加锁原理。

# lua脚本加锁

在调用#lock加锁时，redission会先尝试加锁，成功直接返回，失败就订阅锁状态变更消息，循环重试。

```java
public void lock() {
    // ...
    lock(-1, null, false);
}

private void lock(long leaseTime, TimeUnit unit, boolean interruptibly) throws InterruptedException {
    long threadId = Thread.currentThread().getId();
    Long ttl = tryAcquire(-1, leaseTime, unit, threadId);
    // 获取成功
    // lock acquired
    if (ttl == null) {
        return;
    }

    // 订阅解锁的消息
    RFuture<RedissonLockEntry> future = subscribe(threadId);
    if (interruptibly) {
        commandExecutor.syncSubscriptionInterrupted(future);
    } else {
        commandExecutor.syncSubscription(future);
    }

    try {
        // 获取锁失败就循环重试
        while (true) {
            ttl = tryAcquire(-1, leaseTime, unit, threadId);
            // lock acquired
            if (ttl == null) {
                break;
            }

            // waiting for message
            if (ttl >= 0) {
                try {
                    // 等待解锁继续执行，超时时间为当前锁ttl
                    future.getNow().getLatch().tryAcquire(ttl, TimeUnit.MILLISECONDS);
                } catch (InterruptedException e) {
                    if (interruptibly) {
                        throw e;
                    }
                    future.getNow().getLatch().tryAcquire(ttl, TimeUnit.MILLISECONDS);
                }
            } else {
                if (interruptibly) {
                    future.getNow().getLatch().acquire();
                } else {
                    future.getNow().getLatch().acquireUninterruptibly();
                }
            }
        }
    } finally {
        // 取消订阅锁状态消息
        unsubscribe(future, threadId);
    }
}

private Long tryAcquire(long waitTime, long leaseTime, TimeUnit unit, long threadId) {
    return get(tryAcquireAsync(waitTime, leaseTime, unit, threadId));
}
```

核心加锁方法如下，使用lua加锁实现原子加锁，分布式缓存中的锁为hash结构，key为lock key，field 为 ConnectionManagerId:threadId（uuid:threadId），value为锁重入次数，过期时间默认为30s。

```java
<T> RFuture<T> tryLockInnerAsync(long waitTime, long leaseTime, TimeUnit unit, long threadId, RedisStrictCommand<T> command) {
    // 使用lua脚本加锁
    // KEYS[1] getLock指定的key，作为redis hash key
    // ARGV[1] LockWatchdogTimeout，默认过期时间，30s
    // ARGV[2] ConnectionManagerId:threadId uuid:threadId，作为redis field key
    // 如果hash key不存在，新增hash {key:{uuid:threadId:1}}，过期时间默认30s，返回空
    // 如果hash key.uuid:threadId存在，给field uuid:threadId的值加1，更新过期时间，返回空
    // 如果hash key存在，并且uuid:threadId不存在，说明已经被其他线程锁定，返回key过期时间
    return evalWriteAsync(getRawName(), LongCodec.INSTANCE, command,
            "if (redis.call('exists', KEYS[1]) == 0) then " +
                    "redis.call('hincrby', KEYS[1], ARGV[2], 1); " +
                    "redis.call('pexpire', KEYS[1], ARGV[1]); " +
                    "return nil; " +
                    "end; " +
                    "if (redis.call('hexists', KEYS[1], ARGV[2]) == 1) then " +
                    "redis.call('hincrby', KEYS[1], ARGV[2], 1); " +
                    "redis.call('pexpire', KEYS[1], ARGV[1]); " +
                    "return nil; " +
                    "end; " +
                    "return redis.call('pttl', KEYS[1]);",
            Collections.singletonList(getRawName()), unit.toMillis(leaseTime), getLockName(threadId));
}
```

在内部接下来的调用中可以看到：

```java
public <T, R> RFuture<R> evalWriteAsync(String key, Codec codec, RedisCommand<T> evalCommandType, String script, List<Object> keys, Object... params) {
    // 关键代码
    NodeSource source = getNodeSource(key);
    return evalAsync(source, false, codec, evalCommandType, script, keys, false, params);
}

private NodeSource getNodeSource(String key) {
    int slot = connectionManager.calcSlot(key);
    return new NodeSource(slot);
}

// ClusterConnectionManager.class
public int calcSlot(String key) {
    if (key == null) {
        return 0;
    }

    int start = key.indexOf('{');
    if (start != -1) {
        int end = key.indexOf('}');
        if (end != -1 && start + 1 < end) {
            key = key.substring(start + 1, end);
        }
    }

    int result = CRC16.crc16(key.getBytes()) % MAX_SLOT;
    log.debug("slot {} for {}", result, key);
    return result;
}
```

从如上代码可以看到在发起请求之前Redission先基于key计算出了slot的位置（slot=CRC16(key)&16383），在发起请求时，redission会从缓存中找到slot对应的redis节点直接向其发起请求，这样就可以节省一次重定向，这也是Redission作为smart client的体现。

# watchdog维持加锁

在加锁完成后，可以看到redission添加了一个更新锁过期时间的定时任务，每10秒钟过期一次，如果锁还在就更新过期时间。

```java
private <T> RFuture<Long> tryAcquireAsync(long waitTime, long leaseTime, TimeUnit unit, long threadId) {
    RFuture<Long> ttlRemainingFuture;
    
    // ...
    // #lock加锁真实处理逻辑
    ttlRemainingFuture = tryLockInnerAsync(waitTime, internalLockLeaseTime,
            TimeUnit.MILLISECONDS, threadId, RedisCommands.EVAL_LONG);

    ttlRemainingFuture.onComplete((ttlRemaining, e) -> {
        if (e != null) {
            return;
        }

        // 加锁成功
        // lock acquired
        if (ttlRemaining == null) {
            // ...
            // 加锁成功后维持锁定时任务
            scheduleExpirationRenewal(threadId);
        }
    });
    return ttlRemainingFuture;
}

protected void scheduleExpirationRenewal(long threadId) {
    ExpirationEntry entry = new ExpirationEntry();
    ExpirationEntry oldEntry = EXPIRATION_RENEWAL_MAP.putIfAbsent(getEntryName(), entry);
     // 如果当前锁没有续期任务就创建，如果已经存在就更新一下线程id
    if (oldEntry != null) {
        oldEntry.addThreadId(threadId);
    } else {
        entry.addThreadId(threadId);
        try {
            renewExpiration();
        } finally {
            if (Thread.currentThread().isInterrupted()) {
                cancelExpirationRenewal(threadId);
            }
        }
    }
}

private void renewExpiration() {
    
    // ...
    // 每10秒钟执行一次
    Timeout task = commandExecutor.getConnectionManager().newTimeout(new TimerTask() {
        @Override
        public void run(Timeout timeout) throws Exception {
            
            // ...
            // 维持锁过期
            RFuture<Boolean> future = renewExpirationAsync(threadId);
            future.onComplete((res, e) -> {
                // ..
                
                if (res) {
                    // // 如果锁过期时间被更新了，就重新定义一个任务
                    // reschedule itself
                    renewExpiration();
                } else {
                    // 如果锁过期时间更新失败，说明锁已经释放了，释放任务
                    cancelExpirationRenewal(null);
                }
            });
        }
    }, internalLockLeaseTime / 3, TimeUnit.MILLISECONDS);
    
    ee.setTimeout(task);
}
```

维持锁过期时间也是使用了lua脚本，如果锁还在就更新过期时间为30秒。

```java
protected RFuture<Boolean> renewExpirationAsync(long threadId) {
    // 维持锁lua
    // 如果lock key存在managerId:threadId这个field，就更新锁过期时间
    return evalWriteAsync(getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_BOOLEAN,
            "if (redis.call('hexists', KEYS[1], ARGV[2]) == 1) then " +
                    "redis.call('pexpire', KEYS[1], ARGV[1]); " +
                    "return 1; " +
                    "end; " +
                    "return 0;",
            Collections.singletonList(getRawName()),
            internalLockLeaseTime, getLockName(threadId));
}
```

# 释放锁

在需要释放锁时，redission会判断锁是否存在，锁重入次数是否小于等于1，满足条件就进行删除，然后向指定通道发送一条解锁消息，以通知获取锁的线程。

```java
public void unlock() {
    // ...
    get(unlockAsync(Thread.currentThread().getId()));
}

public RFuture<Void> unlockAsync(long threadId) {
    // ...
    RFuture<Boolean> future = unlockInnerAsync(threadId);
    // ...
}

protected RFuture<Boolean> unlockInnerAsync(long threadId) {
    // 如果lock key.thread不存在，直接返回空
    // 如果lock key.thread存在，就把value先减1
    //      如果值大于0，说明不可以释放，重置过期时间返回0
    //      否则，说明可以解锁了，删除锁，向redisson_lock__channe:{lockkey}发布一条内容为0的消息，返回1
    return evalWriteAsync(getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_BOOLEAN,
            "if (redis.call('hexists', KEYS[1], ARGV[3]) == 0) then " +
                    "return nil;" +
                    "end; " +
                    "local counter = redis.call('hincrby', KEYS[1], ARGV[3], -1); " +
                    "if (counter > 0) then " +
                    "redis.call('pexpire', KEYS[1], ARGV[2]); " +
                    "return 0; " +
                    "else " +
                    "redis.call('del', KEYS[1]); " +
                    "redis.call('publish', KEYS[2], ARGV[1]); " +
                    "return 1; " +
                    "end; " +
                    "return nil;",
            Arrays.asList(getRawName(), getChannelName()), LockPubSub.UNLOCK_MESSAGE, internalLockLeaseTime, getLockName(threadId));
}
```

# 加锁超时与自动释放

redission支持指定加锁超时时间以及锁过期时间，可以调用#tryLock(long waitTime, long leaseTime, TimeUnit unit)方法进行加锁。

```java
public boolean tryLock(long waitTime, long leaseTime, TimeUnit unit) throws InterruptedException {
    long time = unit.toMillis(waitTime);
    long current = System.currentTimeMillis();
    long threadId = Thread.currentThread().getId();
    // 直接加锁，没有watchdog机制
    Long ttl = tryAcquire(waitTime, leaseTime, unit, threadId);
    // lock acquired
    if (ttl == null) {
        return true;
    }
    
    // 如果超时直接返回
    time -= System.currentTimeMillis() - current;
    if (time <= 0) {
        acquireFailed(waitTime, unit, threadId);
        return false;
    }
    
    current = System.currentTimeMillis();
    RFuture<RedissonLockEntry> subscribeFuture = subscribe(threadId);

    // 设置最大等待时间，如果指定时间没有收到解锁状态变更直接超时返回
    if (!subscribeFuture.await(time, TimeUnit.MILLISECONDS)) {
        if (!subscribeFuture.cancel(false)) {
            subscribeFuture.onComplete((res, e) -> {
                if (e == null) {
                    unsubscribe(subscribeFuture, threadId);
                }
            });
        }
        acquireFailed(waitTime, unit, threadId);
        return false;
    }

    // 如果收到解锁消息就继续重试
    try {
        time -= System.currentTimeMillis() - current;
        if (time <= 0) {
            acquireFailed(waitTime, unit, threadId);
            return false;
        }
    
        while (true) {
            long currentTime = System.currentTimeMillis();
            ttl = tryAcquire(waitTime, leaseTime, unit, threadId);
            // lock acquired
            if (ttl == null) {
                return true;
            }

            time -= System.currentTimeMillis() - currentTime;
            if (time <= 0) {
                acquireFailed(waitTime, unit, threadId);
                return false;
            }

            // waiting for message
            currentTime = System.currentTimeMillis();
            if (ttl >= 0 && ttl < time) {
                subscribeFuture.getNow().getLatch().tryAcquire(ttl, TimeUnit.MILLISECONDS);
            } else {
                subscribeFuture.getNow().getLatch().tryAcquire(time, TimeUnit.MILLISECONDS);
            }

            time -= System.currentTimeMillis() - currentTime;
            if (time <= 0) {
                acquireFailed(waitTime, unit, threadId);
                return false;
            }
        }
    } finally {
        unsubscribe(subscribeFuture, threadId);
    }
}
```

结合不指定超时时间的加锁逻辑可以看到，在指定超时时间时redission不会设置watchdog机制进行锁续期，因为过期自动解锁时正常行为。此时解锁有锁过期自动删除和手动解锁两种情况。