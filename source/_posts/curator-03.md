title: 【Curator源码】可重入读写锁源码解析
author: haifun
tags:
  - Curator
  - Zookeeper
categories:
  - 分布式锁
date: 2022-01-06 19:30:00
---

curator提供的读写锁使用方式如下：

```java
InterProcessReadWriteLock interProcessReadWriteLock = new InterProcessReadWriteLock(client, "");
InterProcessMutex readLock = interProcessReadWriteLock.readLock();
readLock.acquire();
readLock.release();

InterProcessMutex writeLock = interProcessReadWriteLock.writeLock();
writeLock.acquire();
writeLock.release();
```

curator读写锁加锁情况分析：

- 读锁 + 读锁，加锁成功
- 读锁 + 写锁，写锁加锁失败
- 写锁 + 读锁，同一个线程先加写锁后加读锁可以成功，否则加读锁失败
- 写锁 + 写锁，第二个写锁加锁失败

# 读锁

在读锁加锁时，curator会在path下创建一个lockname为_READ_的顺序节点。如果当前线程加写锁成功，加读锁直接成功。否则，判断在所有子节点中，当前顺序节点前面有没有写锁，有就加锁失败开始等待，否则加锁成功。

在读锁解锁时，同可重入锁，直接删除顺序节点，此时在这个节点上注册watcher的线程会被唤醒，尝试加锁。

读锁相对于可重入锁重写了获取锁的方法，源码如下：

```java
InterProcessMutex readMutex = new InternalInterProcessMutex
(
        client,
        basePath,
        READ_LOCK_NAME,
        lockData,
        // 读锁最大加锁次数
        Integer.MAX_VALUE,
        new SortingLockInternalsDriver() {
                @Override
                public PredicateResults getsTheLock(CuratorFramework client, List<String> children, String sequenceNodeName, int maxLeases) throws Exception {
                        return readLockPredicate(children, sequenceNodeName);
                }
        }
);

private PredicateResults readLockPredicate(List<String> children, String sequenceNodeName) throws Exception {
        // 如果是当前线程加的读锁，那么写锁可以加锁成功
        if ( writeMutex.isOwnedByCurrentThread() ) {
                return new PredicateResults(null, true);
        }

        int         index = 0;
        // 最前面的写锁位置
        int         firstWriteIndex = Integer.MAX_VALUE;
        // 当前读锁的位置
        int         ourIndex = -1;
        for ( String node : children ) {
                if ( node.contains(WRITE_LOCK_NAME) ) {
                        firstWriteIndex = Math.min(index, firstWriteIndex);
                } else if ( node.startsWith(sequenceNodeName) ) {
                        ourIndex = index;
                        break;
                }

                ++index;
        }

        StandardLockInternalsDriver.validateOurIndex(sequenceNodeName, ourIndex);

        // 如果当前读锁前面有写锁则加锁失败，否则加锁成功
        boolean     getsTheLock = (ourIndex < firstWriteIndex);
        String      pathToWatch = getsTheLock ? null : children.get(firstWriteIndex);
        return new PredicateResults(pathToWatch, getsTheLock);
}
```

# 写锁

在写锁加锁时，curator会在path下创建一个lockname为_WRITE_的顺序节点，然后判断当前节点是不是所有子节点中第一个，如果是第一个则加写锁成功，否则加锁失败开始等待。

在写锁解锁时，同读锁，直接删除顺序节点，此时在这个节点上注册watcher的线程会被唤醒，尝试加锁。

```java
InterProcessMutex writeMutex = new InternalInterProcessMutex
(
        client,
        basePath,
        WRITE_LOCK_NAME,
        lockData,
        // 写锁只能加一个
        1,
        new SortingLockInternalsDriver() {
                @Override
                public PredicateResults getsTheLock(CuratorFramework client, List<String> children, String sequenceNodeName, int maxLeases) throws Exception {
                        return super.getsTheLock(client, children, sequenceNodeName, maxLeases);
                }
        }
);
```
