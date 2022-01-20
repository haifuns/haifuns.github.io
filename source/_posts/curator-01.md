title: 【Curator源码】可重入锁源码解析
author: haifun
tags:
  - Curator
  - ZooKeeper
categories:
  - 分布式锁
date: 2022-01-04 13:10:00
---

Curator提供可重入锁，使用方式如下：

```java
InterProcessMutex interProcessMutex = new InterProcessMutex(client, "/locks/lock_01");
// 获取锁
interProcessMutex.acquire();
// 释放锁
interProcessMutex.release();
```

# 加锁

当需要加锁时，curator会直接为当前线程在当前锁路径下创建一个临时有序节点，如果这个节点是排在有序列表第一个元素即获取锁成功，否则需要注册一个watcher监听器，等待上一个临时有序节点被删除后重试尝试获取锁。由加锁逻辑可知，curator提供的可重入锁是公平的。

```java

// InterProcessMutex
public void acquire() throws Exception {
    if ( !internalLock(-1, null) ) {
        throw new IOException("Lost connection while trying to acquire lock: " + basePath);
    }
}

private boolean internalLock(long time, TimeUnit unit) throws Exception {
    
    Thread currentThread = Thread.currentThread();

    LockData lockData = threadData.get(currentThread);
    if ( lockData != null ) {
        // 如果重复加锁，计数器加1直接返回
        // re-entering
        lockData.lockCount.incrementAndGet();
        return true;
    }

    String lockPath = internals.attemptLock(time, unit, getLockNodeBytes());
    if ( lockPath != null ) {
        // 如果加锁成功，添加到线程锁map里
        LockData newLockData = new LockData(currentThread, lockPath);
        threadData.put(currentThread, newLockData);
        return true;
    }

    return false;
}

// LockInternals
String attemptLock(long time, TimeUnit unit, byte[] lockNodeBytes) throws Exception {
    //...
    
    while ( !isDone ) {
        isDone = true;

        try {
            ourPath = driver.createsTheLock(client, path, localLockNodeBytes);
            hasTheLock = internalLockLoop(startMillis, millisToWait, ourPath);
        } catch ( KeeperException.NoNodeException e ) {
            // ...
        }
    }

    if ( hasTheLock ) {
        return ourPath;
    }

    return null;
}

// LockInternalsDriver
public String createsTheLock(CuratorFramework client, String path, byte[] lockNodeBytes) throws Exception {
    String ourPath;

    // ...
    
    // 核心加锁逻辑，创建一个临时顺序节点
    // creatingParentContainersIfNeeded 自动创建父目录
    // EPHEMERAL_SEQUENTIAL 临时顺序节点
    // path = /locks/lock_01
    // ourPath = /locks/lock_01/_c_4b565d11-c377-4e77-ab2d-81c2011f50a9-lock-0000000002
    ourPath = client.create().creatingParentContainersIfNeeded().withProtection().withMode(CreateMode.EPHEMERAL_SEQUENTIAL).forPath(path);

    return ourPath;
}

private boolean internalLockLoop(long startMillis, Long millisToWait, String ourPath) throws Exception {
    boolean     haveTheLock = false;
    boolean     doDelete = false;
    try {
        if ( revocable.get() != null ) {
            client.getData().usingWatcher(revocableWatcher).forPath(ourPath);
        }

        while ( (client.getState() == CuratorFrameworkState.STARTED) && !haveTheLock ) {
            // 所有节点，从小到大排序
            List<String>        children = getSortedChildren();
            // 当前顺序节点序号
            String              sequenceNodeName = ourPath.substring(basePath.length() + 1); // +1 to include the slash

            // 获取锁，maxLeases默认等于1
            PredicateResults    predicateResults = driver.getsTheLock(client, children, sequenceNodeName, maxLeases);
            if ( predicateResults.getsTheLock() ) {
                // 如果获取到锁，直接返回
                haveTheLock = true;
            } else {
                // 前一个顺序节点path
                String  previousSequencePath = basePath + "/" + predicateResults.getPathToWatch();

                synchronized (this) {
                    try {
                        // 设置zk watcher，然后当前线程睡眠等待watch收到更改事件唤醒
                        // use getData() instead of exists() to avoid leaving unneeded watchers which is a type of resource leak
                        client.getData().usingWatcher(watcher).forPath(previousSequencePath);
                        if ( millisToWait != null ) {
                            millisToWait -= (System.currentTimeMillis() - startMillis);
                            startMillis = System.currentTimeMillis();
                            if ( millisToWait <= 0 ) {
                                doDelete = true;    // timed out - delete our node
                                break;
                            }

                            wait(millisToWait);
                        } else {
                            wait();
                        }
                    } catch ( KeeperException.NoNodeException e ) {
                        // it has been deleted (i.e. lock released). Try to acquire again
                    }
                }
            }
        }
    } catch ( Exception e ) {
        ThreadUtils.checkInterrupted(e);
        doDelete = true;
        throw e;
    } finally {
        if ( doDelete ) {
            deleteOurPath(ourPath);
        }
    }
    return haveTheLock;
}
```

# 解锁

当需要解锁时，curator会判断锁是否被重入，如果没有直接删除临时节点。此时在这个节点上注册watcher的线程收到删除事件后会被notify结束wait，然后判断是否获取到锁。

```java
// InterProcessMutex
public void release() throws Exception {

    Thread currentThread = Thread.currentThread();
    LockData lockData = threadData.get(currentThread);
    if ( lockData == null ) {
        throw new IllegalMonitorStateException("You do not own the lock: " + basePath);
    }

    // 加锁次数递减1，如果剩余的加锁次数大于0，直接返回
    int newLockCount = lockData.lockCount.decrementAndGet();
    if ( newLockCount > 0 ) {
        return;
    }
    if ( newLockCount < 0 ) {
        throw new IllegalMonitorStateException("Lock count has gone negative for lock: " + basePath);
    }
    try {
        // 如果只重入了1次，删除锁
        internals.releaseLock(lockData.lockPath);
    } finally {
        // 移除线程锁map
        threadData.remove(currentThread);
    }
}

// LockInternals
void releaseLock(String lockPath) throws Exception {
    revocable.set(null);
    deleteOurPath(lockPath);
}

private void deleteOurPath(String ourPath) throws Exception {
    try {
        client.delete().guaranteed().forPath(ourPath);
    } catch ( KeeperException.NoNodeException e ) {
        // ignore - already deleted (possibly expired session, etc.)
    }
}
```
