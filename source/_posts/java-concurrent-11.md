title: 【Java 并发编程系列】【J.U.C】：Lock
author: Haif.
tags:
  - 并发
categories:
  - 并发
date: 2020-12-26 17:54:00

---

## 介绍

## ReentrantLock

ReentrantLock 是可重入的独占锁，同时只能有一个线程可以获取该锁，其他获取该锁的线程会被阻塞而被放入该锁的AQS 阻塞队列里。

### 类图

ReentrantLock 类图如下：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/ReentrantLock-uml.png)

<!-- more -->

从类图可以看到， ReentrantLock 最终还是使用AQS来实现的，并且根据参数来决定其内部是一个公平还是非公平锁，默认是非公平锁。

```java
public ReentrantLock() {
    sync = new NonfairSync();
}

public ReentrantLock(boolean fair) {
    sync = fair ? new FairSync() : new NonfairSync();
}
```
其中Sync 类直接继承自AQS ， 它的子类NonfairSync 和FairSync 分别实现了获取锁的非公平与公平策略。


在这里，AQS 的state 状态值表示线程获取该锁的可重入次数，在默认情况下，state 的值为0 表示当前锁没有被任何线程持有。当一个线程第一次获取该锁时会尝试使用CAS 设置state 的值为1 ，如果CAS 成功则当前线程获取了该锁，然后记录该锁的持有者为当前线程。在该线程没有释放锁的情况下第二次获取该锁后，状态值被设置为2，这就是可重入次数。在该线程放该锁时，会尝试使用CAS 让状态值减1，如果减1 后状态值为0,则当前线程释放该锁。

### 获取锁

#### void lock()

当一个线程调用该方法时，说明该线程希望获取该锁。如果锁当前没有被其他线程占用并且当前线程之前没有获取过该锁，则当前线程会获取到该锁，然后设置当前锁的拥有者为当前线程， 并设置AQS 的状态值为1 ，然后直接返回。
如果当前线程之前己经获取过该锁，则这次只是简单地把AQS 的状态值加1 后返回。如果该锁己经被其他线程持有，则调用该方法的线程会被放入AQS 队列后阻塞挂起。

在如下代码中， ReentrantLock 的lock() 委托给了sync 类
```java
public void lock() {
    sync.lock();
}
```
**先来看NonfairSync的情况，即非公平锁**
```java
final void lock() {
    if (compareAndSetState(0, 1)) // CAS 设置状态值
        setExclusiveOwnerThread(Thread.currentThread());
    else
        acquire(1); // 调用AQS acquire方法
}
```

因为默认AQS 的状态值为0，所以第一个调用Lock 的线程会通过CAS 设置状态值为1, CAS 成功则表示当前线程获取到了锁，然后setExclusiveOwnerThread 设置该锁持有者是当前线程。
如果这时候有其他线程调用lock 方法企图获取该锁，CAS 会失败，然后会调用AQS的acquire 方法，传递参数为1。

AQS 的acquire 核心代码如下：

```java
public final void acquire(int arg) {
    if (!tryAcquire(arg) && // 调用ReentrantLock重写的tryAcquire方法
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        selfInterrupt();
}
```

非公平锁tryAcquire相关源码如下：

```java
protected final boolean tryAcquire(int acquires) {
    return nonfairTryAcquire(acquires);
}

final boolean nonfairTryAcquire(int acquires) {
    final Thread current = Thread.currentThread();
    int c = getState();
    if (c == 0) { // 当前AQS状态值为0
        if (compareAndSetState(0, acquires)) {
            setExclusiveOwnerThread(current); // 设置当前线程为锁持有者
            return true;
        }
    }
    else if (current == getExclusiveOwnerThread()) { // 当前线程是该锁持有者
        int nextc = c + acquires;
        if (nextc < 0) // overflow 可重入次数溢出
            throw new Error("Maximum lock count exceeded");
        setState(nextc);
        return true;
    }
    return false;
}
```

**再来看FairSync的情况，即公平锁**

```java
protected final boolean tryAcquire(int acquires) {
    final Thread current = Thread.currentThread();
    int c = getState();
    if (c == 0) { // 当前AQS状态值为0
        if (!hasQueuedPredecessors() && // 公平性策略
            compareAndSetState(0, acquires)) {
            setExclusiveOwnerThread(current);
            return true;
        }
    }
    else if (current == getExclusiveOwnerThread()) { // 当前线程是该锁持有者
        int nextc = c + acquires;
        if (nextc < 0)
            throw new Error("Maximum lock count exceeded");
        setState(nextc);
        return true;
    }
    return false;
}

// 公平性核心实现
public final boolean hasQueuedPredecessors() {

    Node t = tail; // Read fields in reverse initialization order
    Node h = head;
    Node s;
    // 如果h==t 则说明当前队列为空，直接返回false
    // 如果h!=t 并且s==null 则说明有一个元素将要作为AQS 的第一个节点入队列，返回true
    // 如果h!=t 并且s!=null和s.thread != Thread.cunentThread() 则说明队列里面的第一个元素不是当前线程，那么返回true
    return h != t &&
        ((s = h.next) == null || s.thread != Thread.currentThread());
}
```

#### void lockInterruptibly()

该方法与lock() 方法类似，不同在于它对中断进行响应，即当前线程在调用该方法时，如果其他线程调用了当前线程的interrupt() 方法， 则当前线程会抛出InterruptedException 异常，然后返回。

```java
public void lockInterruptibly() throws InterruptedException {
    sync.acquireInterruptibly(1);
}

public final void acquireInterruptibly(int arg)
        throws InterruptedException {
    if (Thread.interrupted()) // 如果当前线程被中断，则直接抛异常
        throw new InterruptedException();
    if (!tryAcquire(arg)) // 尝试获取资源
        doAcquireInterruptibly(arg); // 调用AQS可被中断方法
}
```

#### boolean tryLock()

尝试获取锁，如果当前该锁没有被其他线程持有，则当前线程获取该锁并返回true,否则返回false。注意，该方法不会引起当前线程阻塞。

```java
// tryLock() 使用的是非公平策略
public boolean tryLock() {
    return sync.nonfairTryAcquire(1);
}

final boolean nonfairTryAcquire(int acquires) {
    final Thread current = Thread.currentThread();
    int c = getState();
    if (c == 0) {
        if (compareAndSetState(0, acquires)) {
            setExclusiveOwnerThread(current);
            return true;
        }
    }
    else if (current == getExclusiveOwnerThread()) {
        int nextc = c + acquires;
        if (nextc < 0) // overflow
            throw new Error("Maximum lock count exceeded");
        setState(nextc);
        return true;
    }
    return false;
}
```

#### boolean tryLock(long timeout, TimeUnit unit)

尝试获取锁，与tryLock 的不同之处在于，它设置了超时时间，如果超时时间到没有获取到锁则返回false

```java
public boolean tryLock(long timeout, TimeUnit unit)
        throws InterruptedException {
    return sync.tryAcquireNanos(1, unit.toNanos(timeout)); // 调用AQS tryAcquireNanos方法
}
```

### 释放锁

#### void unlock()

尝试释放锁，如果当前线程持有该锁， 则调用该方法会让该线程对该线程持有的AQS状态值减1 ， 如果减去1 后当前状态值为0 ，则当前线程会释放该锁，否则仅仅减1 而己。如果当前线程没有持有该锁而调用了该方法则会抛出IllegalMonitorStateException 异常。

代码如下:

```java
public void unlock() {
    sync.release(1);
}
	
public final boolean release(int arg) {
    if (tryRelease(arg)) {
        Node h = head;
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h);
        return true;
    }
    return false;
}
	
protected final boolean tryRelease(int releases) {
	int c = getState() - releases;
	if (Thread.currentThread() != getExclusiveOwnerThread()) // 如果不是锁持有者调用unlock抛出异常
		throw new IllegalMonitorStateException();
	boolean free = false;
	if (c == 0) { // 如果当前可重入次数为0则清空锁持有线程
		free = true;
		setExclusiveOwnerThread(null);
	}
	setState(c); // 设置可重入次数为原始值-1
	return free;
}
```

## ReentrantReadWriteLock

ReentrantReadWriteLock 采用读写分离的策略，允许多个线程可以同时获取读锁。

### 类图

ReentrantReadWriteLock 类图如下：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/ReentrantReadWriteLock-uml.png)

读写锁的内部维护了一个ReadLock 和一个WriteLock ，它们依赖Sync 实现具体功能。而Sync 继承自AQS ，并且也提供了公平和非公平的实现。


* state 高16位表示读状态，也就是获取到读锁的次数；低16位表示获取到写锁的线程的可重入次数。

```java
static final int SHARED_SHIFT   = 16;
// 共享锁（读锁）状态单位值65536
static final int SHARED_UNIT    = (1 << SHARED_SHIFT);
// 共享锁线程最大个数65535
static final int MAX_COUNT      = (1 << SHARED_SHIFT) - 1;
// 排它锁（写锁）掩码， 二进制，15 个1
static final int EXCLUSIVE_MASK = (1 << SHARED_SHIFT) - 1;

/** 返回读锁线程数 */
static int sharedCount(int c)    { return c >>> SHARED_SHIFT; }
/** 返回写锁可重入个数 */
static int exclusiveCount(int c) { return c & EXCLUSIVE_MASK; }
```

* firstReader 用来记录第一个获取到读锁的线程
* firstReaderHoldCount 则记录第一个获取到读锁的线程获取读锁的可重入次数
* cachedHoldCounter 用来记录最后一个获取读锁的线程获取读锁的可重入次数

```java
static final class HoldCounter {
    int count = 0;
    // 线程id
    final long tid = getThreadId(Thread.currentThread());
}
```

* readHolds 是ThreadLocal 变量，用来存放除去第一个获取读锁线程外的其他线程获取读锁的可重入次数

```java
static final class ThreadLocalHoldCounter
    extends ThreadLocal<HoldCounter> {
    public HoldCounter initialValue() {
        return new HoldCounter();
    }
}
```

### 写锁的获取与释放

ReentrantReadWriteLock 中写锁使用WriteLock 实现。

#### void lock()

写锁是个独占锁，某时只有一个线程可以获取该锁。如果当前没有线程获取到读锁和写锁，则当前线程可以获取到写锁然后返回。如果当前己经有线程获取到读锁和写锁，则当前请求写锁的线程会被阻塞挂起。另外，写锁是可重入锁，如果当前线程己经获取了该锁，再次获取只是简单地把可重入次数加1 后直接返回。

```java
public void lock() {
    sync.acquire(1);
}
		
public final void acquire(int arg) {
	if (!tryAcquire(arg) && // 调用sync重写的tryAcquire方法
		acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
		selfInterrupt();
}

protected final boolean tryAcquire(int acquires) {

    Thread current = Thread.currentThread();
    int c = getState();
    int w = exclusiveCount(c);
    if (c != 0) { // c != 0 说明读锁或写锁已经被某个线程获取
        // w == 0 说明已经有线程获取了读锁；w != 0 并且当前线程不是写锁拥有者，则返回false
        if (w == 0 || current != getExclusiveOwnerThread())
            return false;
        if (w + exclusiveCount(acquires) > MAX_COUNT) // 当前线程获取了写锁，判断可重入次数
            throw new Error("Maximum lock count exceeded");
        
        setState(c + acquires); // 设置可重入次数
        return true;
    }
    
    // c == 0; 第一个写线程获取写锁
    if (writerShouldBlock() ||
        !compareAndSetState(c, c + acquires))
        return false;
    setExclusiveOwnerThread(current);
    return true;
}
```

对于writeShoudBlock 方法，非公平实现为：
```java
final boolean writerShouldBlock() {
    return false; // writers can always barge
}
```
此时，线程抢占式执行CAS 尝试获取写锁，抢占成功后设置锁持有者为当前线程

公平锁实现为：
```java
final boolean writerShouldBlock() {
	return hasQueuedPredecessors();
}

public final boolean hasQueuedPredecessors() {
    Node t = tail; // Read fields in reverse initialization order
    Node h = head;
    Node s;
    return h != t &&
        ((s = h.next) == null || s.thread != Thread.currentThread());
}
```
公平锁判断当前线程节点是否有前驱节点，如果有则当前线程放弃获取写锁的权限

#### void lockInterruptibly()

此方法对中断进行响应，也就是当其他线程调用了该线程的interrupt 方法中断了当前线程时，当前线程会抛出异常InterruptedException异常。

```java
public void lockInterruptibly() throws InterruptedException {
    sync.acquireInterruptibly(1);
}
```

#### boolean tryLock()

尝试获取写锁，如果当前没有其他线程持有写锁或者读锁，则当前线程获取写锁会成功，然后返回true。如果当前己经有其他线程持有写锁或者读锁则该方法直接返回false,且当前线程并不会被阻塞。如果当前线程已经持有了该写锁则简单增加AQS 的状态值后直接返回true。

```java
public boolean tryLock( ) {
    return sync.tryWriteLock();
}

final boolean tryWriteLock() {
    Thread current = Thread.currentThread();
    int c = getState();
    if (c != 0) {
        int w = exclusiveCount(c);
        if (w == 0 || current != getExclusiveOwnerThread())
            return false;
        if (w == MAX_COUNT)
            throw new Error("Maximum lock count exceeded");
    }
    if (!compareAndSetState(c, c + 1))
        return false;
    setExclusiveOwnerThread(current);
    return true;
}
```

#### boolean tryLock(long timeout, TimeUnit unit)

相比tryAcquire 多了超时参数，尝试获取写锁失败后挂起指定时间后，线程会被激活，如果还是没有获取到写锁则直接返回false，此方法响应中断。

```java
public boolean tryLock(long timeout, TimeUnit unit)
        throws InterruptedException {
    return sync.tryAcquireNanos(1, unit.toNanos(timeout));
}
```

#### void unlock()

尝试释放锁，如果当前线程持有该锁，调用该方法会让该线程对该线程持有的AQS
状态值减1 ，如果减去1 后当前状态值为0 则当前线程会释放该锁， 否则仅仅减1 而己。如果当前线程没有持有该锁而调用了该方法则会抛出IllegalMonitorStateException 异常

```java
public void unlock() {
    sync.release(1);
}

public final boolean release(int arg) {
    if (tryRelease(arg)) { // 调用ReentrantReadWriteLock中sync实现的tryRelease方法
        // 激活阻塞队列中的一个线程
        Node h = head; 
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h);
        return true;
    }
    return false;
}

protected final boolean tryRelease(int releases) {
    if (!isHeldExclusively()) // 看是否是写锁拥有者调用unlock
        throw new IllegalMonitorStateException();
    int nextc = getState() - releases; // 获取可重入值，这里没有考虑高16位，因为获取写锁时读锁状态值一定是0
    boolean free = exclusiveCount(nextc) == 0;
    if (free) // 如果写锁可重入值为0则释放锁，否则只是简单更新状态值
        setExclusiveOwnerThread(null);
    setState(nextc);
    return free;
}
```

### 读锁的获取与释放

ReentrantReadWriteLock 中的读锁是使用ReadLock 来实现的。

#### void lock()

获取读锁，如果当前没有其他线程持有写锁，则当前线程可以获取读锁，AQS 的状态值state 的高16 位的值会增加1 ，然后方法返回。否则如果其他一个线程持有写锁，则当前线程会被阻塞。

```java
public void lock() {
    sync.acquireShared(1);
}

public final void acquireShared(int arg) {
    if (tryAcquireShared(arg) < 0) // 调用ReentrantReadWriteLock中sync的tryAquireShared方法
        doAcquireShared(arg); // 调用AQS的doAcquireShared方法
}

protected final int tryAcquireShared(int unused) {
    Thread current = Thread.currentThread();
    int c = getState();
    if (exclusiveCount(c) != 0 && // 判断是否被写锁占用
        getExclusiveOwnerThread() != current)
        return -1;
    int r = sharedCount(c); // 获取读锁计数
    if (!readerShouldBlock() && // 尝试获取锁，多个线程只有一个会成功，不成功的进入fullTryAcquireShire进行重试
        r < MAX_COUNT &&
        compareAndSetState(c, c + SHARED_UNIT)) {
        if (r == 0) { // 第一个线程获取读锁
            firstReader = current;
            firstReaderHoldCount = 1;
        } else if (firstReader == current) { // 如果当前线程是第一个获取读锁的线程
            firstReaderHoldCount++;
        } else {
            HoldCounter rh = cachedHoldCounter; // 记录第一个获取读锁的线程或记录其他线程读锁的可重入数
            if (rh == null || rh.tid != getThreadId(current))
                cachedHoldCounter = rh = readHolds.get();
            else if (rh.count == 0)
                readHolds.set(rh);
            rh.count++;
        }
        return 1;
    }
    return fullTryAcquireShared(current); // 类似tryAcquireShared，但是是自旋获取
}

final int fullTryAcquireShared(Thread current) {
 
    HoldCounter rh = null;
    for (;;) {
        int c = getState();
        if (exclusiveCount(c) != 0) {
            if (getExclusiveOwnerThread() != current)
                return -1;
            // else we hold the exclusive lock; blocking here
            // would cause deadlock.
        } else if (readerShouldBlock()) {
            // Make sure we're not acquiring read lock reentrantly
            if (firstReader == current) {
                // assert firstReaderHoldCount > 0;
            } else {
                if (rh == null) {
                    rh = cachedHoldCounter;
                    if (rh == null || rh.tid != getThreadId(current)) {
                        rh = readHolds.get();
                        if (rh.count == 0)
                            readHolds.remove();
                    }
                }
                if (rh.count == 0)
                    return -1;
            }
        }
        if (sharedCount(c) == MAX_COUNT)
            throw new Error("Maximum lock count exceeded");
        if (compareAndSetState(c, c + SHARED_UNIT)) {
            if (sharedCount(c) == 0) {
                firstReader = current;
                firstReaderHoldCount = 1;
            } else if (firstReader == current) {
                firstReaderHoldCount++;
            } else {
                if (rh == null)
                    rh = cachedHoldCounter;
                if (rh == null || rh.tid != getThreadId(current))
                    rh = readHolds.get();
                else if (rh.count == 0)
                    readHolds.set(rh);
                rh.count++;
                cachedHoldCounter = rh; // cache for release
            }
            return 1;
        }
    }
}
```

#### void lockInterruptibly()

类似于lock()，此方法响应中断

#### boolean tryLock()

尝试获取读锁，如果当前没有其他线程持有写锁，则当前线程获取读锁会成功，然后返回true 。如果当前己经有其他线程持有写锁则该方法直接返回false ，但当前线程并不会被阻塞。如果当前线程己经持有了该读锁则简单增加AQS 的状态值高16 位后直接返回true 。

#### boolean tryLock(long timeout, TimeUNit unit)

相比tryLock，增加了超时参数，获取读锁失败则会把当前线程挂起指定时间，待超时时间到后当前线程被激活，如果此时还没有获取到读锁则返回false 。此方法响应中断。

#### void unlock()

尝试释放读锁（或减少重入次数），释放读锁后释放写锁
```java
public void unlock() {
    sync.releaseShared(1);
}

public final boolean releaseShared(int arg) {
    if (tryReleaseShared(arg)) { // 调用ReentrantReadWriteLock中sync的tryReleaseShared方法
        doReleaseShared(); // 释放一个由于获取写锁而被阻塞的线程
        return true;
    }
    return false;
}
    
protected final boolean tryReleaseShared(int unused) {
    Thread current = Thread.currentThread();
    
    // ···
    
    // 循环直到自己的读计数-1，CAS更新成功
    for (;;) {
        int c = getState();
        int nextc = c - SHARED_UNIT;
        if (compareAndSetState(c, nextc))
            return nextc == 0;
    }
}
```

## StampedLock

StampedLock 是并发包里面JDK8 版本新增的一个锁，该锁提供了三种模式的读写控制，当调用获取锁的系列函数时，会返回一个long 型的变量，称为戳记(stamp),这个戳记代表了锁的状态。其中try 系列获取锁的函数，当获取锁失败后会返回为0 的stamp 值。当调用释放锁和转换锁的方法时需要传入获取锁时返回的stamp 值。

StampedLock 内部组成如图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/StampedLock.png)

StampedLock 提供的三种读写模式的锁分别如下：

* 写锁 writeLock: 是一个排它锁或者独占锁
* 悲观读锁 readLock: 是一个共享锁，在没有线程获取独占写锁的情况下，多个线程可以同时获取该锁。
* 乐观读锁 tryOptimisticRead: 它是相对于悲观锁来说的，在操作数据前并没有通过CAS 设置锁的状态，仅仅通过位运算测试。如果当前没有线程持有写锁，则简单地返回一个非0 的stamp 版本信息。使用前还需要调用validate 方法验证stamp 是否可用。此锁适合读多写少场景。

StampedLock 还支持这三种锁在一定条件下进行相互转换。

另外， StampedLock 的读写锁都是不可重入锁。当多个线程同时尝试获取读锁和写锁时，谁先获取锁没有一定的规则，完全都是尽力而为，是随机的。并且该锁不是直接实现Lock 或ReadWriteLock 接口，而是其在内部自己维护了一个双向阻塞队列。