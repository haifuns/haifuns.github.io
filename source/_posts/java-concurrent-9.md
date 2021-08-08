title: 【Java 并发编程系列】【J.U.C】：LockSupport
author: Haif.
tags:
  - 并发
categories:
  - 并发
date: 2020-12-26 17:50:00

---

## 介绍

LockSupport 工具类的主要作用是挂起和唤醒线程，该工具类是创建锁和其他同步类的基础。LockSupport 类与每个使用它的线程都会关联一个许可证，在默认情况下调用LockSupport 类的方法的线程是不持有许可证的。LockSupport 是使用Unsafe 类实现的。

<!-- more -->

## 主要函数

### static void park()

如果调用park 方法的线程已经拿到了与LockSupport 关联的许可证，则调用LockSupport.park() 时会马上返回，否则调用线程会被禁止参与线程的调度，也就是会被阻塞挂起。

在如下代码中，在main 函数中直接调用park 方法，最终只会输出begin park!，然后当前线程被挂起，这是因为默认情况下调用线程是不持有许可证的。

```java
public static void main(String[] args) {

      System.out.println("begin park!");

      LockSupport.park();
		
      System.out.println("end park!");
}
```

在其他线程调用unpark(Thread thread) 方法并且将当前线程作为参数时，调用park 方法而被阻塞的线程会返回。另外，如果其他线程调用了阻塞线程的interrupt()方法，设置了中断标志或者线程被虚假唤醒，则阻塞线程也会返回。所以在调用park 方法时最好也使用循环条件判断方式。需要注意的是，因调用park() 方法而被阻塞的线程被其他线程中断而返回时并不会抛出InterruptedException 异常。

### static void unpark(Thread thread)

当一个线程调用unpark 时，如果参数thread 线程没有持有thread 与LockSupport 类关联的许可证， 则让thread 线程持有。如果thread 之前因调用park() 而被挂起，则调用unpark 后，该线程会被唤醒。如果thread 之前没有调用park ，则调用unpark 方法后， 再调用park 方法，其会立刻返回。

修改代码如下：

```java
public static void main(String[] args) {

      System.out.println("begin park!");

      // 使当前线程获得许可证
      LockSupport.unpark(Thread.currentThread());
	
      // 再次调用park方法
      LockSupport.park();
		
      System.out.println("end park!");
}
```

输出结果为：
```
begin park!
end park!
```

### static void parkNanos(long nanos)

如果调用park 方法的线程已经拿到了与LockSupport 关联的许可证，则调用LockSupport.parkNanos(long nanos) 方法后会马上返回。该方法的不同在于，如果没有拿到许可证，则调用线程会被挂起nanos 时间后修改为自动返回。

另外park 方法还支持带有blocker 参数的方法void park(Object blocker) 方法，当线程在没有持有许可证的情况下调用park 方法而被阻塞挂起时，这个blocker 对象会被记录到该线程内部。

使用诊断工具可以观察线程被阻塞的原因，诊断工具是通过调用getBlocker(T hread) 方法来获取blocker 对象的，所以JDK 推荐我们使用带有blocker 参数的park 方法，并且blocker 被设置为this ，这样当在打印线程堆横排查问题时就能知道是哪个类被阻塞了。

例如下面的代码：

```java
public class ParkTest {

      public void parkTest() {
            LockSupport.park(); // 1
      }

      public static void main(String[] args) {
            ParkTest test = new ParkTest();
            test.parkTest();
      }
}
```
运行代码后，使用jstack <pid> 命令查看线程堆栈可以看下如下结果：

```java
"main" #1 prio=5 os_prio=0 tid=0x0000000003652800 nid=0x345c waiting on condition [0x000000000341f000]
   java.lang.Thread.State: WAITING (parking)
        at sun.misc.Unsafe.park(Native Method)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:304)
        at ParkTest.parkTest(ParkTest.java:6)
        at ParkTest.main(ParkTest.java:11)
```
修改代码1 为LockSupport.park(this);后，再次输出线程堆栈结果如下：
```java
"main" #1 prio=5 os_prio=0 tid=0x0000000002a12800 nid=0x2a28 waiting on condition [0x000000000247f000]
   java.lang.Thread.State: WAITING (parking)
        at sun.misc.Unsafe.park(Native Method)
        - parking to wait for  <0x00000000d5bf4418> (a ParkTest)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:175)
        at ParkTest.parkTest(ParkTest.java:6)
        at ParkTest.main(ParkTest.java:11)
```

使用带blocker 参数的park 方法，线程堆栈可以提供更多有关阻塞对象的信息。

### static void park(Object blocker)

```java
public static void park(Object blocker) {
    // 获取调用线程
    Thread t = Thread.currentThread();
    // 设置此线程blocker变量
    setBlocker(t, blocker);
    // 挂起线程
    UNSAFE.park(false, 0L);
    // 线程被激活后清除blocker变量，因为一般都是在线程阻塞时才分析原因
    setBlocker(t, null);
}
```

Thread 类里面有个变量volatile Object parkBlocker ， 用来存放park 方法传递的blocker 对象，也就是把blocker 变量存放到了调用park 方法的线程的成员变量里面。

### static void parkNanos(Object blocker, long nanos)

相比park(Object blocker) 方法多了超时时间。

### static void parkUntil(Object blocker, long deadline)

```java
public static void parkUntil(Object blocker, long deadline) {
    Thread t = Thread.currentThread();
    setBlocker(t, blocker);
    
    // isAbsolute=true,time=deadline;表示到deadline 时间后返回
    UNSAFE.park(true, deadline);
    setBlocker(t, null);
}
```

其中参数deadline 的时间单位为ms ，该时间是从1970 年到现在某一个时间点的毫秒值。这个方法和parkNanos(Object blocker, long nanos) 方法的区别是，后者是从当前算等待nanos 秒时间，而前者是指定一个时间点，比如需要等到2017.12.11 12:00:00 ，则把这个时间点转换为从1970 年到这个时间点的总毫秒数。