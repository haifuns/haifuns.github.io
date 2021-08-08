title: 【Java 并发编程系列】：深入浅出synchronized
author: Haif.
tags:
  - 并发
categories:
  - 并发
date: 2020-12-26 17:42:00

---

## 使用场景

利用synchronized实现同步的基础：Java中的每一个对象都可以作为锁。具体表现为以下3种形式：
1. 对于普通同步方法，锁是当前实例对象。
2. 对于静态同步方法，锁是当前类的Class对象。
3. 对于同步方法块，锁是synchonized括号里配置的对象。

当一个线程试图访问同步代码块时，它首先必须得到锁，退出或抛出异常时必须释放锁。

<!-- more -->

## 实现原理

如下代码中，使用了同步代码块和同步方法，通过使用javap工具查看生成的class文件信息来分析synchronized关键字的实现细节。
```java
public class SynchronizedDemo {
      private static Object object = new Object();
      public static void main(String[] args) throws Exception{
            synchronized(object) {

            }
      }
	
      public static synchronized void method() {
      }
}
```

javap -v SynchronizedDemo.class查看字节码如下：
```java
public static void main(java.lang.String[]) throws java.lang.Exception;
    descriptor: ([Ljava/lang/String;)V
    flags: ACC_PUBLIC, ACC_STATIC
    Code:
      stack=2, locals=3, args_size=1
         0: getstatic     #2                  // Field object:Ljava/lang/Object;
         3: dup
         4: astore_1
         5: monitorenter
         6: aload_1
         7: monitorexit
         8: goto          16
        11: astore_2
        12: aload_1
        13: monitorexit
        14: aload_2
        15: athrow
        16: return
        
 public static synchronized void method();
    descriptor: ()V
    flags: ACC_PUBLIC, ACC_STATIC, ACC_SYNCHRONIZED
    Code:
      stack=0, locals=0, args_size=0
         0: return
      LineNumberTable:
        line 10: 0
```

从生成的class信息中，可以看到：

* 同步代码块使用了 monitorenter 和 monitorexit 指令实现。
* 同步方法中依靠方法修饰符上的 ACC_SYNCHRONIZED 实现。

monitorenter 和 monitorexit 这两个字节码指令都需要一个reference类型的参数来指明要锁定和解锁的对象。如果没有明确指定，那将根据synchronized修饰的方法类型（如实例方法或类方法），来决定是取代码所在的对象实例还是取类型对应的Class对象来作为线程要持有的锁。


在执行monitorenter指令时，首先要去尝试获取对象的锁。如果这个对象没被锁定，或者当前线程已经持有了那个对象的锁，就把锁的计数器的值增加一，而在执行monitorexit 指令时会将锁计数器的值减一。一旦计数器的值为零，锁随即就被释放了。获取对象锁的过程是互斥的，如果获取对象锁失败，那当前线程就会被阻塞，并放入到同步队列中，进入BLOCKED状态，直到请求锁定的对象被持有它的线程释放为止。

需要特别注意的是：

* 被synchronized修饰的同步块对同一条线程来说是可重入的。这意味着同一线程反复进入同步块也不会出现自己把自己锁死的情况。
* 被synchronized修饰的同步块在持有锁的线程执行完毕并释放锁之前，会无条件地阻塞后面其他线程的进入。这意味着无法像处理某些数据库中的锁那样，强制已获取锁的线程释放锁；也无法强制正在等待锁的线程中断等待或超时退出。

## 锁内部机制

一般锁有4种状态：无锁状态，偏向锁状态，轻量级锁状态，重量级锁状态。

在进一步深入之前，我们回顾两个概念：对象头和monitor。

### 对象头

在hotspot虚拟机中，对象在内存的分布分为3个部分：对象头，实例数据，和对齐填充。

对象头存储结构如下（32位虚拟机）：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/jvm/markword.png)

### monitor

monitor是线程私有的数据结构，每一个线程都有一个可用monitor列表，同时还有一个全局的可用列表。

monitor内部包含如下几部分：

* Owner：初始时为NULL表示当前没有任何线程拥有该monitor，当线程成功拥有该锁后保存线程唯一标识，当锁被释放时又设置为NULL；
* EntryQ：关联一个系统互斥锁（semaphore），阻塞所有试图锁住monitor失败的线程。
* RcThis：表示blocked或waiting在该monitor上的所有线程的个数。
* Nest：用来实现重入锁的计数。
* HashCode：保存从对象头拷贝过来的HashCode值（可能还包含GC age）。
* Candidate：用来避免不必要的阻塞或等待线程唤醒，因为每一次只有一个线程能够成功拥有锁，如果每次前一个释放锁的线程唤醒所有正在阻塞或等待的线程，会引起不必要的上下文切换（从阻塞到就绪然后因为竞争锁失败又被阻塞）从而导致性能严重下降。Candidate只有两种可能的值：0表示没有需要唤醒的线程，1表示要唤醒一个继任线程来竞争锁。

#### 作用

在 java 虚拟机中，线程一旦进入到被synchronized修饰的方法或代码块时，指定的锁对象通过某些操作将对象头中的LockWord指向monitor 的起始地址与之关联，同时monitor 中的Owner存放拥有该锁的线程的唯一标识，确保一次只能有一个线程执行该部分的代码，线程在获取锁之前不允许执行该部分的代码。

### 轻量级锁

> 利用了CPU原语Compare-And-Swap(CAS，汇编指令CMPXCHG)。

#### 加锁过程

* 在代码即将进入同步块的时候，如果此同步对象没有被锁定（锁标志位为“01”状态），虚拟机首先将在当前线程的栈帧中建立一个名为锁记录（Lock Record）的空间，用于存储锁对象目前的Mark Word的拷贝（Displaced Mark Word）。
* 然后，虚拟机将使用CAS操作尝试把对象的Mark Word更新为指向Lock Record的指针。
    - 如果更新成功，则获取对象轻量级锁成功，对象Mark Word的锁标志位将转变为“00”。
    - 如果失败，则说明锁已被抢占，轻量级锁就不再有效，必须要膨胀为重量级锁，锁标志变为“10”，此时Mark Word中存储的就是指向重量级锁（互斥量）的指针，后面等待锁的线程也必须进入阻塞状态。

#### 解锁过程

* 如果对象的Mark Word仍然指向线程的锁记录，那就用CAS操作把对象当前的Mark Word和线程中复制的DisplacedMark Word替换回来。
    - 如果成功替换，那整个同步过程就顺利完成了；
    - 如果替换失败，则说明有其他线程尝试过获取该锁，就要在释放锁的同时，唤醒被挂起的线程。


> “对于绝大部分的锁，在整个同步周期内都是不存在竞争的”。如果没有竞争，轻量级锁便通过CAS操作避免了使用互斥量的开销；但如果确实存在锁竞争，除了互斥量的本身开销外，还额外发生了CAS操作的开销。因此在有竞争的情况下，轻量级锁反而会比传统的重量级锁更慢。

### 偏向锁

当线程获取锁时，会在对象头和栈帧的锁记录中存储锁偏向的线程ID，当线程再次进入锁相关的同步块时，只需要判断对象头存储的线程ID是否为当前线程，而不需要进行CAS操作进行加锁和解锁。

偏向锁目的是消除数据在无竞争情况下的同步，从而提高性能。如果说轻量级锁是在无竞争的情况下使用CAS操作去消除同步使用的互斥量，那偏向锁就是在无竞争的情况下把整个同步都消除掉，连CAS操作都不去做。

#### 加锁过程

* 当锁对象第一次被线程获取时，虚拟机将会把对象头中的标志位设置为“01”、把偏向模式设置为“1”，表示进入偏向模式。
* 同时使用CAS操作把获取到这个锁的线程的ID记录在对象的Mark Word之中。
* 如果CAS操作成功，持有偏向锁的线程以后每次进入这个锁相关的同步块时，虚拟机都可以不再进行任何同步操作（例如加锁、解锁及对Mark Word的更新操作等）。

#### 解锁过程

当有其他线程请求相同锁时，偏向模式结束。根据锁对象目前是否处于被锁定的状态决定是否撤销偏向（偏向模式设置为“0”），撤销后标志位恢复到未锁定（标志位为“01”）或轻量级锁定（标志位为“00”）的状态。

> 如果程序中大多数锁总是被多个线程访问的时候，也就是竞争比较激烈，偏向锁反而会降低性能。使用参数-XX:-UseBiasedLocking 禁止偏向锁，默认开启。

### 重量级锁

一旦锁升级成重量级锁，就不会再恢复到轻量级锁状态。当锁处于这个状态下，其他线程试图获取锁时，都会被阻塞住，当持有锁的线程释放锁之后会唤醒这些线程，被唤醒的线程就会进行新一轮的夺锁之争。

### 锁对比

锁 | 优点 | 缺点 | 适用场景
---|---|---|---
偏向锁 | 加锁和解锁不需要额外的消耗，和执行非同步方法相比仅存在纳秒级别差距 | 如果线程间存在锁竞争会带来额外的锁撤销消耗 | 适用于只有一个线程访问同步块场景
轻量级锁 | 竞争的线程不会阻塞，提高了程序响应速度 | 如果始终得不到锁竞争的线程，使用自旋会消耗CPU | 追求响应时间
重量级锁 | 线程竞争不使用自旋，不会消耗CPU | 线程阻塞，响应时间慢 | 追求吞吐量

参考文献：

* 《深入理解Java虚拟机：JVM高级特性与最佳实践（第3版）》
* 《Java并发编程的艺术》