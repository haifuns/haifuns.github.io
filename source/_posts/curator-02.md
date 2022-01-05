title: 【Curator源码】信号量&不可重入锁源码解析
author: haifun
tags:
  - Curator
  - Zookeeper
categories:
  - 分布式锁
date: 2022-01-05 20:35:00
---

curator提供的信号量使用方式如下：

```java
InterProcessSemaphoreV2 semaphore = new InterProcessSemaphoreV2(client, "/semaphore/semaphore_01", 3);
// 获取信号
Lease lease = semaphore.acquire();
// 返还信号
semaphore.returnLease(lease);
```

# 获取信号

curator信号量内部包含一个可重入锁，在获取信号时，首先会尝试获取内部可重入锁，在获取完成后，直接在path/leases路径下创建一个瞬时有序节点并创建一个watch监听器，然后获取到所有子节点，当且仅当当前的有序节点是子节点中第一个时认为获取信号成功，否则线程wait，直到其他线程返回信号时watcher收到状态变更notify后重新判断。当获取信号成功后释放内部可重入锁。

```java
// InterProcessSemaphoreV2
public Lease acquire() throws Exception {
    Collection<Lease> leases = acquire(1, 0, null);
    return leases.iterator().next();
}

public Collection<Lease> acquire(int qty, long time, TimeUnit unit) throws Exception {
    long startMs = System.currentTimeMillis();
    boolean hasWait = (unit != null);
    long waitMs = hasWait ? TimeUnit.MILLISECONDS.convert(time, unit) : 0;

    // ...
    
    ImmutableList.Builder<Lease> builder = ImmutableList.builder();
    boolean success = false;
    try {
        while ( qty-- > 0 ) {
            int retryCount = 0;
            long startMillis = System.currentTimeMillis();
            boolean isDone = false;
            while ( !isDone ) {
                switch ( internalAcquire1Lease(builder, startMs, hasWait, waitMs) ) {
                    case CONTINUE: {
                        isDone = true;
                        break;
                    }

                    // ...
                }
            }
        }
        success = true;
    } finally {
        if ( !success ) {
            returnAll(builder.build());
        }
    }

    return builder.build();
}

private InternalAcquireResult internalAcquire1Lease(ImmutableList.Builder<Lease> builder, long startMs, boolean hasWait, long waitMs) throws Exception {
    if ( client.getState() != CuratorFrameworkState.STARTED ) {
        return InternalAcquireResult.RETURN_NULL;
    }

    if ( hasWait ) {
        long thisWaitMs = getThisWaitMs(startMs, waitMs);
        if ( !lock.acquire(thisWaitMs, TimeUnit.MILLISECONDS) ) {
            return InternalAcquireResult.RETURN_NULL;
        }
    } else {
        // 内部可重入锁，尝试加锁
        lock.acquire();
    }

    Lease lease = null;

    try {
        PathAndBytesable<String> createBuilder = client.create().creatingParentContainersIfNeeded().withProtection().withMode(CreateMode.EPHEMERAL_SEQUENTIAL);
        // 创建瞬时有序节点，path/leases
        String path = (nodeData != null) ? createBuilder.forPath(ZKPaths.makePath(leasesPath, LEASE_BASE_NAME), nodeData) : createBuilder.forPath(ZKPaths.makePath(leasesPath, LEASE_BASE_NAME));
        String nodeName = ZKPaths.getNodeFromPath(path);
        lease = makeLease(path);

        if ( debugAcquireLatch != null ) {
            debugAcquireLatch.await();
        }

        synchronized (this) {
            for (;;) {
                List<String> children;
                try {
                    // 获取当前path/leases下所有子节点，注册watcher
                    children = client.getChildren().usingWatcher(watcher).forPath(leasesPath);
                } catch ( Exception e ) {
                    if ( debugFailedGetChildrenLatch != null ) {
                        debugFailedGetChildrenLatch.countDown();
                    }
                    returnLease(lease); // otherwise the just created ZNode will be orphaned causing a dead lock
                    throw e;
                }
                if ( !children.contains(nodeName) ) {
                    log.error("Sequential path not found: " + path);
                    returnLease(lease);
                    return InternalAcquireResult.RETRY_DUE_TO_MISSING_NODE;
                }

                // 如果字节点数量小于最大值，那么获取成功
                if ( children.size() <= maxLeases ) {
                    break;
                }
                if ( hasWait ) {
                    long thisWaitMs = getThisWaitMs(startMs, waitMs);
                    if ( thisWaitMs <= 0 ) {
                        returnLease(lease);
                        return InternalAcquireResult.RETURN_NULL;
                    }
                    wait(thisWaitMs);
                } else {
                    // 失败阻塞
                    wait();
                }
            }
        }
    } finally {
        // 获取完毕释放内部锁
        lock.release();
    }
    builder.add(Preconditions.checkNotNull(lease));
    return InternalAcquireResult.CONTINUE;
}
```

# 释放信号

在需要释放信号时，直接删除当前瞬时有序节点。

```java
public void close() throws IOException {
    try {
        // 释放直接删除path/leases下的子节点
        client.delete().guaranteed().forPath(path);
    } catch ( KeeperException.NoNodeException e ) {
        log.warn("Lease already released", e);
    } catch ( Exception e ) {
        ThreadUtils.checkInterrupted(e);
        throw new IOException(e);
    }
}
```

# 不可重入锁

非可重入锁内部包含一个信号量InterProcessSemaphoreV2，最大数量为1。加锁时获取信号，解锁时释放信号。
