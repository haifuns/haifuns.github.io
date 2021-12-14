title: 【Redission源码】联锁&红锁源码解析
author: haifun
tags:
  - Redission
categories:
  - 分布式锁
date: 2021-12-14 00:15:00
---

# 联锁 MultiLock

Redisson提供分布式联锁RedissonMultiLock，可以将多个RLock对象关联为一个联锁，每个RLock对象实例可以来自于不同的Redisson实例。使用方式如下：

```java
RLock lock1 = redisson.getLock("lock1");
RLock lock2 = redisson.getLock("lock2");
RLock lock3 = redisson.getLock("lock3");

RedissonMultiLock lock = new RedissonMultiLock(lock1, lock2, lock3);
// 同时加锁：lock1 lock2 lock3
// 所有的锁都上锁成功才算成功。
lock.lock();
lock.unlock();
```

## 加锁

RedissonMultiLock加锁时默认超时时间为锁个数 * 1.5秒，循环调用每个锁的加锁逻辑，如果加锁失败或者超时，就会把已经加锁成功的所有锁同步等待解锁。实际加锁处理逻辑如下：

```java
public void lock() {
    // ...
    lockInterruptibly();
}

public void lockInterruptibly() throws InterruptedException {
    lockInterruptibly(-1, null);
}

public void lockInterruptibly(long leaseTime, TimeUnit unit) throws InterruptedException {
    // 默认等待时间为每个锁1.5秒
    long baseWaitTime = locks.size() * 1500;
    long waitTime = -1;
    if (leaseTime == -1) {
        waitTime = baseWaitTime;
    } else {
        // ...
    }
    
    while (true) {
        if (tryLock(waitTime, leaseTime, TimeUnit.MILLISECONDS)) {
            return;
        }
    }
}

public boolean tryLock(long waitTime, long leaseTime, TimeUnit unit) throws InterruptedException {
    long newLeaseTime = -1;
    if (leaseTime != -1) {
        if (waitTime == -1) {
            newLeaseTime = unit.toMillis(leaseTime);
        } else {
            newLeaseTime = unit.toMillis(waitTime)*2;
        }
    }
    
    long time = System.currentTimeMillis();
    long remainTime = -1;
    if (waitTime != -1) {
        remainTime = unit.toMillis(waitTime);
    }
    long lockWaitTime = calcLockWaitTime(remainTime);
    
    int failedLocksLimit = failedLocksLimit();
    // 成功加锁集合
    List<RLock> acquiredLocks = new ArrayList<>(locks.size());
    // 遍历所有锁，挨个执行加锁
    for (ListIterator<RLock> iterator = locks.listIterator(); iterator.hasNext();) {
        RLock lock = iterator.next();
        boolean lockAcquired;
        try {
            if (waitTime == -1 && leaseTime == -1) {
                lockAcquired = lock.tryLock();
            } else {
                // 默认超时时间为锁个数 * 1.5秒，默认不过期
                long awaitTime = Math.min(lockWaitTime, remainTime);
                lockAcquired = lock.tryLock(awaitTime, newLeaseTime, TimeUnit.MILLISECONDS);
            }
        } catch (RedisResponseTimeoutException e) {
            unlockInner(Arrays.asList(lock));
            lockAcquired = false;
        } catch (Exception e) {
            lockAcquired = false;
        }
        
        if (lockAcquired) {
            // 加锁成功添加到成功集合
            acquiredLocks.add(lock);
        } else {
            if (locks.size() - acquiredLocks.size() == failedLocksLimit()) {
                break;
            }

            // 如果不允许失败，并且当前加锁失败了
            if (failedLocksLimit == 0) {
                // 把所有加锁成功的锁解锁
                unlockInner(acquiredLocks);
                if (waitTime == -1) {
                    return false;
                }
                failedLocksLimit = failedLocksLimit();
                acquiredLocks.clear();
                // reset iterator
                while (iterator.hasPrevious()) {
                    iterator.previous();
                }
            } else {
                failedLocksLimit--;
            }
        }
        
        if (remainTime != -1) {
            // 整个联锁超时时间 = 锁个数 * 1.5秒 - 当前加锁耗费时间
            remainTime -= System.currentTimeMillis() - time;
            time = System.currentTimeMillis();

            // 如果超时，解锁已经加成功的锁，返回失败
            if (remainTime <= 0) {
                unlockInner(acquiredLocks);
                return false;
            }
        }
    }

    if (leaseTime != -1) {
        acquiredLocks.stream()
                .map(l -> (RedissonLock) l)
                .map(l -> l.expireAsync(unit.toMillis(leaseTime), TimeUnit.MILLISECONDS))
                .forEach(f -> f.syncUninterruptibly());
    }
    
    return true;
}
```

## 释放锁

RedissonMultiLock释放锁逻辑非常简单，循环释放所有锁，同步等待所有锁释放完毕后结束。

```java
public void unlock() {
    List<RFuture<Void>> futures = new ArrayList<>(locks.size());

    for (RLock lock : locks) {
        futures.add(lock.unlockAsync());
    }

    for (RFuture<Void> future : futures) {
        future.syncUninterruptibly();
    }
}
```

# 红锁 RedLock

## RedLock算法

由于在Redis主从同步架构中普通锁可能出现安全失效问题，异常场景如下：

1. 客户端A从master获取到了锁
2. 在master将锁同步到slave之前，master宕机
3. slave节点晋升为master节点
4. 客户端B获取同一把锁成功

为了解决以上问题，Redis官方提供了一种RedLock算法。

RedLock算法假设有N个Redis master节点，这些节点完全独立，不存在主从复制或者其他集群协调机制。

### 加锁

获取锁步骤如下：

1. 获取当前时间戳，单位毫秒
2. 轮流尝试在每个节点使用相同的key和随机值加锁，设定一个小于锁失效时间的超时时间（例如锁自动失效时间为10秒，则超时时间在5-50毫秒之间）
3. 客户端使用当前时间 - 步骤1获得的时间得到获取锁的使用时间，当且仅当多数节点加锁成功，并且使用时间小于锁失效时间，则加锁成功
4. 如果加锁成功，锁真正的有效时间 = 过期时间 - 获取锁的使用时间
5. 如果获取锁失败，客户端应该在所有节点解锁

### 失败重试

当客户端获取锁失败时，需要在一个随机延迟后重试，防止多个客户端同时抢夺同一资源的锁从而造成脑裂都无法获取锁。

理想情况下，客户端应该并发地向所有节点发送SET命令，以节省加锁耗费的时间，降低脑裂概率。同时，在获取锁失败时，应该尽快释放已经成功取到的锁。

### 解锁

释放锁比较简单，客户端向所有节点发送释放锁命令，不需要关心节点是否已经加锁。

## RedissonRedLock

RedissonRedLock继承自RedissonMultiLock，区别在于加锁逻辑中的两个变量：允许锁个数 / 2 - 1个锁加锁失败（也即要求多数加锁成功）；每个锁加锁超时时间为1.5秒。

```java
protected int failedLocksLimit() {
    return locks.size() - minLocksAmount(locks);
}

protected int minLocksAmount(final List<RLock> locks) {
    return locks.size()/2 + 1;
}

protected long calcLockWaitTime(long remainTime) {
    return Math.max(remainTime / locks.size(), 1);
}
```