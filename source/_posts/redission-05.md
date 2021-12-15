title: 【Redission源码】信号量&闭锁源码解析
author: haifun
tags:
  - Redission
categories:
  - 分布式锁
date: 2021-12-16 00:20:00
---

# 信号量 Semaphore

Redisson提供分布式信号量，接口和用法与juc.Semaphore相似，使用方式如下：

```java
RSemaphore semaphore = redisson.getSemaphore("semaphore");
semaphore.addPermits(10);
semaphore.acquire();
//或
semaphore.acquireAsync();
semaphore.acquire(23);
semaphore.tryAcquire();
//或
semaphore.tryAcquireAsync();
semaphore.tryAcquire(23, TimeUnit.SECONDS);
//或
semaphore.tryAcquireAsync(23, TimeUnit.SECONDS);
semaphore.release(10);
semaphore.release();
//或
semaphore.releaseAsync();
```

## 新增凭证

添加凭证实际上就是给redis中的key设置一个值。核心方法如下：

```java
public RFuture<Void> addPermitsAsync(int permits) {
    return commandExecutor.evalWriteAsync(getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_VOID,
            "local value = redis.call('get', KEYS[1]); " +
            "if (value == false) then "
              + "value = 0;"
          + "end;"
          + "redis.call('set', KEYS[1], value + ARGV[1]); "
          + "redis.call('publish', KEYS[2], value + ARGV[1]); ",
            Arrays.asList(getRawName(), getChannelName()), permits);
}
```

## 获取凭证

获取凭证时，只需判断剩余凭证大于要申请的凭证数量即可申请成功，如果获取失败就订阅凭证释放消息，收到释放凭证消息后循环获取。获取凭证核心方法如下：

```java
public RFuture<Boolean> tryAcquireAsync(int permits) {
    if (permits < 0) {
        throw new IllegalArgumentException("Permits amount can't be negative");
    }
    if (permits == 0) {
        return RedissonPromise.newSucceededFuture(true);
    }

    return commandExecutor.evalWriteAsync(getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_BOOLEAN,
              // 查询信号量
              "local value = redis.call('get', KEYS[1]); " +
              // 如果存在，并且剩余数量大于申请的数量
              "if (value ~= false and tonumber(value) >= tonumber(ARGV[1])) then " +
                  // 扣减申请的数量，返回成功
                  "local val = redis.call('decrby', KEYS[1], ARGV[1]); " +
                  "return 1; " +
              "end; " +
              // 否则返回失败
              "return 0;",
              // KEY[1] 信号量名称，KEY[2] 信号数量
              Collections.<Object>singletonList(getRawName()), permits);
}
```

## 释放凭证

释放凭证时直接给信号量增加相应数量的凭证，然后发布一条释放凭证的消息通知订阅的等待线程。释放凭证核心方法如下：

```java
public RFuture<Void> releaseAsync(int permits) {
    if (permits < 0) {
        throw new IllegalArgumentException("Permits amount can't be negative");
    }
    if (permits == 0) {
        return RedissonPromise.newSucceededFuture(null);
    }

    RFuture<Void> future = commandExecutor.evalWriteAsync(getRawName(), StringCodec.INSTANCE, RedisCommands.EVAL_VOID,
            // 直接给信号量加释放的个数
            "local value = redis.call('incrby', KEYS[1], ARGV[1]); " +
                    // 发布一条释放信号消息给等待的线程
                    "redis.call('publish', KEYS[2], value); ",
            Arrays.asList(getRawName(), getChannelName()), permits);
    if (log.isDebugEnabled()) {
        future.onComplete((o, e) -> {
            if (e == null) {
                log.debug("released, permits: {}, name: {}", permits, getName());
            }
        });
    }
    return future;
}
```

# 闭锁 CountDownLatch

Redission提供闭锁功能，接口和用法与juc.CountDownLatch相似，使用方式如下：

```java
RCountDownLatch latch = redisson.getCountDownLatch("anyCountDownLatch");
latch.trySetCount(1);
latch.await();

// 在其他线程或其他JVM里
RCountDownLatch latch = redisson.getCountDownLatch("anyCountDownLatch");
latch.countDown();
```

## 设置计数器值

CountDownLatch计数器值只有在未设置过才能设置成功，Redission提供的CountDownLatch设置计数器值核心方法如下：

```java
public RFuture<Boolean> trySetCountAsync(long count) {
    return commandExecutor.evalWriteAsync(getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_BOOLEAN,
            // 如果CountDownLatch name不存在
            "if redis.call('exists', KEYS[1]) == 0 then "
                // 新增CountDownLatch
                + "redis.call('set', KEYS[1], ARGV[2]); "
                // 发布一条新增计数器的消息
                + "redis.call('publish', KEYS[2], ARGV[1]); "
                + "return 1 "
            // 存在直接返回失败
            + "else "
                + "return 0 "
            + "end",
            Arrays.<Object>asList(getRawName(), getChannelName()), CountDownLatchPubSub.NEW_COUNT_MESSAGE, count);
}
```

## 减少计数器值

```java
public RFuture<Void> countDownAsync() {
    return commandExecutor.evalWriteNoRetryAsync(getRawName(), LongCodec.INSTANCE, RedisCommands.EVAL_BOOLEAN,
                    // 减少CountDownLatch计数器数量
                    "local v = redis.call('decr', KEYS[1]);" +
                    // 如果剩余的计数器小于0就直接删除
                    "if v <= 0 then redis.call('del', KEYS[1]) end;" +
                    // 如果剩余计数器等于0，就发布一条计数器为零的消息通知订阅的线程
                    "if v == 0 then redis.call('publish', KEYS[2], ARGV[1]) end;",
                Arrays.<Object>asList(getRawName(), getChannelName()), CountDownLatchPubSub.ZERO_COUNT_MESSAGE);
}
```

## 等待计数器值达到0

当某一个线程调用awite方法时，线程会阻塞直到CountDownLatch计数器被扣减为1，实际上就是不断循环查询计数器值，直到为0时返回。

```java
public void await() throws InterruptedException {
    // 如果计数器为0直接返回
    if (getCount() == 0) {
        return;
    }

    RFuture<RedissonCountDownLatchEntry> future = subscribe();
    try {
        commandExecutor.syncSubscriptionInterrupted(future);

        // 如果计数器大于0，就等待计数器为0的消息，循环判断直到计数器到0
        while (getCount() > 0) {
            // waiting for open state
            future.getNow().getLatch().await();
        }
    } finally {
        unsubscribe(future);
    }
}
```