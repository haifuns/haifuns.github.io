title: 【Java 并发编程系列】【J.U.C】：AQS
author: Haif.
tags:
  - 并发
categories:
  - 并发
date: 2020-12-26 17:52:00

---

## 锁的底层支持

AbstractQueuedSynchronizer 抽象同步队列简称AQS，它是实现同步器的基础组件，并发包中锁的底层就是使用AQS 实现的。

AQS 类图结构如图：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/AQS-uml.png)

<!-- more -->

由该图可以看到， AQS 是一个FIFO 的双向队列，其内部通过节点head 和tail 记录队首和队尾元素，队列元素的类型为Node 。其中Node 中的thread 变量用来存放进入AQS 队列里面的线程： Node 节点内部的SHARED 用来标记该线程是获取共享资源时被阻塞挂起后放入AQS 队列的， EXCLUSIVE 用来标记线程是获取独占资源时被挂起后放入AQS 队列的； waitStatus 记录当前线程等待状态，可以为CANCELLED（线程被取消了）、SIGNAL（ 线程需要被唤醒）、CONDITION （线程在条件队列里面等待）、PROPAGATE（释放共享资源时需要通知其他节点）；prev 记录当前节点的前驱节点， next 记录当前节点的后继节点。

在AQS 中维持了一个单一的状态信息state，可以通过getState 、setState 、compareAndSetState 函数修改其值。对于ReentrantLock 的实现来说，state 可以用来表示当前线程获取锁的可重入次数；对于读写锁ReentrantReadWriteLock 来说，state 的高16 位表示读状态，也就是获取该读锁的次数，低16 位表示获取到写锁的线程的可重入次数；对于semaphore 来说， state 用来表示当前可用信号的个数：对于CountDownlatch 来说，state 用来表示计数器当前的值。

AQS 内部类ConditionObject 用来结合锁实现线程同步。ConditionObject 是条件变量，每个条件变量对应一个条件队列（单向链表队列）用来存放调用条件的await 方法后被阻塞的线程。队列头、尾元素分别是firstWaiter 和lastWaiter。

对于AQS 来说，线程同步的关键是对状态值state 进行操作。根据state 是否属于一个线程，操作state 的方式分为独占方式和共享方式。

* **在独占方式下获取和释放资源使用的方法是：**

独占方法 | 描述
---|---
void acquire(int arg) | 独占式获取同步状态，如果当前线程获取同步状态成功，则由该方法返回，否则，将会进人同步队列等待
void acquireInterruptibly(int arg) | 与acquire(int arg)相同，但是该方法响应中断，当前线程未获取到同步状态而进入同步队列中，如果当前线程被中断，则该方法会抛出InterruptedException并返回
boolean release(int) | 独占式的释放同步状态，该方法会在释放同步状态之后，将同步队列中第一个节点包含的线程唤醒

* **在共享方式下获取和释放资源使用的方法是：**

共享方法 | 描述
---|---
void acquireShared(int arg) | 共享式的获取同步状态，如果当前线程未获取到同步状态，将会进入同步队列等待，与独占式获取的主要区别是在同一时刻可以有多个线程获取到同步状态
void acquireSharedInterruptibly(int arg) | 与acquireShared(int )相同，该方法响应中断
void acquireShared(int) | 共享式的释放同步状态 

**在独占方式下，获取与释放资源的流程如下：**

1. 当一个线程调用acquire(int arg)方法获取独占资源时，会首先使用tryAcquire 方法尝试获取资源，具体是设置状态变量state 的值，成功则直接返回，失败则将当前线程封装为类型为Node.EXCLUSIVE 的Node 节点后插入到AQS 阻塞队列的尾部，并调用LockSupport.park(this) 方法挂起自己。
```java
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        selfInterrupt();
}
```
2. 当一个线程调用release(int arg) 方法时会尝试使用tryRelease 操作释放资源，这里是设置状态变量state 的值，然后调用LockSupport.unpark(thread) 方法激活AQS 队列里面被阻塞的一个线程（thread）。被激活的线程则使用tryAcquire 尝试，看当前状态变量state 的值是否能满足自己的需要，满足则该线程被激活，然后继续向下运行，否则还是会被放入AQS 队列并被挂起。
```java
public final boolean release(int arg) {
    if (tryRelease(arg)) {
        Node h = head;
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h);
        return true;
    }
    return false;
}
```

**在共享方式下，获取与释放资源的流程如下：**

1. 当线程调用acquireShared(int arg) 获取共享资源时，会首先使用trγAcquireShared 尝试获取资源，具体是设置状态变量state 的值，成功则直接返回，失败则将当前线程封装为类型为Node.SHARED 的Node 节点后插入到AQS 阻塞队列的尾部，并使用LockSupport.park(this) 方法挂起自己。

```java
public final void acquireShared(int arg) {
    if (tryAcquireShared(arg) < 0)
        doAcquireShared(arg);
}
```

2. 当一个线程调用releaseShared(int arg) 时会尝试使用tryReleaseShared 操作释放资源，这里是设置状态变量state 的值，然后使用LockSupport.unpark(thread) 激活AQS 队列里面被阻塞的一个线程（thread）。被激活的线程则使用tryReleaseShared 查看当前状态变量state 的值是否能满足自己的需要，满足则该线程被撤活，然后继续向下运行，否则还是会被放入AQS 队列并被挂起。

```java
public final boolean releaseShared(int arg) {
    if (tryReleaseShared(arg)) {
        doReleaseShared();
        return true;
    }
    return false;
}
```

**最后，来看看如何维护AQS 提供的队列，主要看入队操作:**

当一个线程获取锁失败后该线程会被转换为Node 节点，然后就会使用enq(final Node node) 方法将该节点插入到AQS 的阻塞队列。

```java
private Node enq(final Node node) {
    for (;;) {
        Node t = tail;
        if (t == null) { // Must initialize
            if (compareAndSetHead(new Node()))
                tail = head;
        } else {
            node.prev = t;
            if (compareAndSetTail(t, node)) {
                t.next = node;
                return t;
            }
        }
    }
}
```

如上代码，当要在AQS 队列尾部插入元素时， AQS 队列头、尾节点都指向null 时，使用CAS 算法设置一个哨兵节点为头节点，如果CAS 设置成功，则让尾部节点也指向哨兵节点，这时候队列状态如下图中（2）所示；
然后再插入node 节点，设置node 的前驱节点为尾部节点（4），然后通过CAS 算法设置node 节点为尾部节点（5），CAS 成功后再设置原来的尾部节点的后驱节点为node（6）。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/AQS-Queue.png)

## 条件变量的支持

类比配合synchronized 内置锁实现线程间同步的 notify 和wait ，条件变量的signal 和await 方法也是用来配合锁（使用AQS 实现的锁）实现线程间同步的基础设施。

它们的不同在于，synchronized 同时只能与一个共享变量的notify 或wait 方法实现同步， 而AQS 的一个锁可以对应多个条件变量。

使用方法示例如下：
```java
public static void main(String[] args) {

    ReentrantLock lock = new ReentrantLock();
    Condition condition = lock.newCondition();

    new Thread(() -> {
        lock.lock();
        try {
            System.out.println("begin wait");
            condition.await();
            System.out.println("end wait");
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            lock.unlock();
        }
    }).start();

    new Thread(() -> {
        lock.lock();
        try {
            System.out.println("begin signal");
            condition.signal();
            System.out.println("end signal");
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            lock.unlock();
        }
    }).start();
}
```
输出结果：
```
begin wait
begin signal
end signal
end wait
```

在上面代码中， lock.newCondition() 的作用其实是new 了一个在AQS 内部声明的ConditionObject 对象， ConditionObject 是AQS 的内部类，可以访问AQS 内部的变量（例如状态变量state）和方法。在每个条件变量内部都维护了一个条件队列，用来存放调用条件变量的await() 方法时被阻塞的线程。注意这个条件队列和AQS 队列不是一回事。

ConditionObject 相关源码如下：
```java
 /**
  * 可中断条件等待
  
  * 调用前必须先调用lock.lock()获取锁
  * 
  */
public final void await() throws InterruptedException {
    if (Thread.interrupted())
        throw new InterruptedException();
    Node node = addConditionWaiter(); // 创建新的node节点，并插入到条件队列末尾
    int savedState = fullyRelease(node); // 释放当前线程获取的锁
    int interruptMode = 0;
    while (!isOnSyncQueue(node)) { // 调用park方法阻塞挂起当前线程
        LockSupport.park(this);
        if ((interruptMode = checkInterruptWhileWaiting(node)) != 0)
            break;
    }
    
    // ···
}

 /**
  * 将等待时间最长的线程(如果存在的话)从这个条件的等待队列移动到拥有锁的等待队列
  
  * 调用前必须先调用lock.lock()获取锁
  * 
  */
public final void signal() {
    if (!isHeldExclusively())
        throw new IllegalMonitorStateException();
    Node first = firstWaiter;
    if (first != null)
        doSignal(first); // 将条件队列列头元素移动到AQS队列
}

private Node addConditionWaiter() {
    Node t = lastWaiter;
    
    // ···
    
    Node node = new Node(Thread.currentThread(), Node.CONDITION); // 根据当前线程创建一个类型为Node.CONDITION 的节点
    if (t == null)
        firstWaiter = node;
    else
        t.nextWaiter = node;
    lastWaiter = node; // 将新构建好的节点添加到单向条件队列末尾
    return node;
}
```

* 当多个线程同时调用lock.lock() 法获取锁时，只有一个线程获取到了锁，其他线程会被转换为Node 节点插入到lock 锁对应的AQS 阻塞队列里面，并做自旋CAS 尝试获取锁。

* 如果获取到锁的线程又调用了对应的条件变量的await() 方法，则该线程会释放获取到的锁，并被转换为Node 节点插入到条件变量对应的条件队列里面。这时候因为调用lock.lock() 方法被阻塞到AQS 队列里面的一个线程会获取到被释放的锁，如果该线程也调用了条件变量的await() 方法则该线程也会被放入条件变量的条件队列里面。

* 当另外一个线程调用条件变量的signal() 或者signalAll() 方法时，会把条件队列里面的一个或者全部Node 节点移动到AQS 的阻塞队列里面，等待时机获取锁。

**一个锁对应一个AQS 阻塞队列，对应多个条件变量， 每个条件变量有自己的一个条件队列。**

如图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/AQS-Condition.png)

## 基于AQS实现自定义同步器

在如下代码中， NonReentrantLock为自定基于AQS的不可重入独占锁，其内部定义了一个Sync 用来实现具体的锁的操作， Sync 继承于AQS 。由于我们实现的是独占模式的锁，所以Sync重写了tryAcquire、tryRelease 和isHeldExclusively 3 个方法。另外， Sync 提供了newCondition 这个方法用来支持条件变量。

```java
import java.io.Serializable;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.AbstractQueuedSynchronizer;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;

/**
 * 基于AQS的不可重入独占锁
 */
public class NonReentrantLock implements Lock, Serializable {

    /**
     * 内部帮助类
     */
    private static class Sync extends AbstractQueuedSynchronizer {

        /**
         * 锁是否已经被持有
         */
        @Override
        protected boolean isHeldExclusively() {
            return getState() == 1;
        }

        /**
         * 如果state为0则尝试获取锁
         */
        @Override
        protected boolean tryAcquire(int acquires) {
            assert acquires == 1;
            if (compareAndSetState(0, 1)) {
                setExclusiveOwnerThread(Thread.currentThread());
                return true;
            }
            return false;
        }

        /**
         * 尝试释放锁，设置state为0
         */
        @Override
        protected boolean tryRelease(int releases) {
            assert releases == 1;
            if (getState() == 0) {
                throw new IllegalMonitorStateException();
            }
            setExclusiveOwnerThread(null);
            setState(0);
            return true;
        }

        /**
         * 提供条件变量接口
         */
        Condition newCondition() {
            return new ConditionObject();
        }
    }

    /**
     * 创建一个Sync来做具体的工作
     */
    private final Sync sync = new Sync();

    @Override
    public void lock() {
        sync.acquire(1);
    }

    @Override
    public void lockInterruptibly() throws InterruptedException {
        sync.acquireInterruptibly(1);
    }

    @Override
    public boolean tryLock() {
        return sync.tryAcquire(1);
    }

    @Override
    public boolean tryLock(long time, TimeUnit unit) throws InterruptedException {
        return sync.tryAcquireNanos(1, unit.toNanos(time));
    }

    @Override
    public void unlock() {
        sync.release(1);
    }

    @Override
    public Condition newCondition() {
        return sync.newCondition();
    }

    public boolean isLocked() {
        return sync.isHeldExclusively();
    }
}
```