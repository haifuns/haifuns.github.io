title: 【Java 并发编程系列】：线程基础
author: Haif.
tags:
  - 并发
categories:
  - 并发
date: 2020-12-26 17:44:00

---

## 什么是线程

线程是进程中的一个实体，线程本身是不会独立存在。进程是代码在数据集合上的一次运行活动， 是系统进行资源分配和调度的基本单位，线程则是进程的一个执行路径， 一个进程中至少有一个线程，进程中的多个线程共享进程的资源。

操作系统在分配资源时是把资源分配给进程的， 但是CPU 资源比较特殊， 它是被分配到线程的， 因为真正要占用CPU 运行的是线程，所以也说线程是CPU 分配的基本单位。

## 线程创建与运行

Java 中有三种线程创建方式，分别为:

1. 通过继承Thread类，重写run方法
2. 通过实现Runnable接口的run 方法
3. 通过使用FutureTask 方式, 实现Callable接口的call 方法

<!-- more -->

* 继承Thread类，重写run方法
```java
public class ThreadTest {

	// 继承Thread类并重写run方法
	public static class MyThread extends Thread {
		@Override
		public void run() {
			System.out.println("I am a child thread");
		}
	}

	public static void main(String[] args) {

		// 创建线程
		Singleton.ThreadTest.MyThread thread = new Singleton.ThreadTest.MyThread();

		// 启动线程
		thread.start();
	}
}
```
如上代码中，MyThread类继承Thread类，并重写run() 方法。创建MyThread实例后调用start方法启动线程。值得注意的是，调用start 方法后线程不是马上执行，而是处于就绪状态，等待获取CPU 资源后才会处于运行状态，run 方法执行完毕后，线程处于终止状态。

使用继承方式的好处是， 在run 方法内获取当前线程直接使用this 就可以了，无须使用Thread.currentThread() 方法；不好的地方是Java 不支持多继承，如果继承了Thread 类，那么就不能再继承其他类。另外任务与代码没有分离， 当多个线程执行一样的任务时需要多份任务代码，而Runable 则没有这个限制。

* 实现Runnable接口的run 方法
```java
public class RunnableTask implements Runnable {

	@Override
	public void run() {
		System.out.println("I am a child thread");
	}

	public static void main(String[] args) {

		RunnableTask task = new RunnableTask();
		new Thread(task).start();
		new Thread(task).start();
	}
}
```
如上面代码所示，两个线程共用一个task 代码逻辑，如果需要，可以给RunnableTask 添加参数进行任务区分。另外，RunnableTask 可以继承其他类。但是上面介绍的两种方式 都有一个缺点，就是任务没有返回值。

* 使用FutureTask 方式, 实现Callable接口的call 方法
```java
public class CallerTask implements Callable<String> {

	@Override
	public String call() throws Exception {
		return "caller task";
	}

	public static void main(String[] args) throws ExecutionException, InterruptedException {
		// 创建异步任务
		FutureTask<String> futureTask = new FutureTask<>(new CallerTask());
		
		// 启动线程
		new Thread(futureTask).start();
		
		// 等待任务执行完毕并返回结果
		String result = futureTask.get();
		System.out.println(result);
	}
}
```
如上代码中的CallerTask 类实现了Callable 接口的call() 方法。创建FutureTask 对象（构造函数为CallerTask 的实例），然后使用创建的FutrueTask 对象作为任务创建了一个线程并且启动它， 最后通过futureTask.get() 等待任务执行完毕并返回结果。

## 线程等待与通知

Java 中的Object 类是所有类的父类，鉴于继承机制， Java 把所有类都需要的方法放到了Object 类里面，其中就包含通知与等待系列函数。

### wait() 函数

当一个线程调用一个共享变量的wait() 方法时， 该调用线程会被阻塞挂起， 直到发生下面几件事情之一才返回：
1. 其他线程调用了该共享对象的notify() 或者notifyAll() 方法
2. 其他线程调用了该线程的interrupt() 方法， 该线程抛出InterruptedException 异常返回

需要注意的是，如果调用wait() 方法的线程没有事先获取该对象的监视器锁，则调用wait() 方法时调用线程会抛出IllegalMonitorStateException 异常。

线程通过以下方法获取共享变量的监视器锁：
1. 执行synchronized 同步代码块时， 使用该共享变量作为参数。
```java
synchronized(共享变量) {
    // do something
}
```
2. 调用该共享变量的方法，并且该方法使用了synchronized 修饰。
```java
synchronized void method(int a, int b) {
    // do something
}
```

另外需要注意的是，一个线程可以从挂起状态变为可以运行状态（也就是被唤醒），即使该线程没有被其他线程调用notify()、notifyAll() 方法进行通知，或者被中断，或者等待超时，这就是所谓的虚假唤醒。

（虚假唤醒在应用实践中很少发生），防患做法是不停地去测试该线程被唤醒的条件是否满足，不满足则继续等待，也就是说在一个循环中调用wait() 方法进行防范。退出循环的条件是满足了唤醒该线程的条件。
```java
synchronized(obj) {
    while(条件不满足) {
        obj.wait();
    }
}
```
### wait(long timeout) 函数

如果一个线程调用共享对象的该方法挂起后，没有在指定的timeout ms时间内被其他线程调用该共享变量的 notify() 或者notifyAll() 方法唤醒，那么该函数会因为超时而返回。

### wait(long timeout, int nanos) 函数
nanos 纳秒，在nanos > 0 时使参数timeout 递增1。
```java
public final void wait(long timeout, int nanos) throws InterruptedException {
    if (timeout < 0) {
        throw new IllegalArgumentException("timeout value is negative");
    }

    if (nanos < 0 || nanos > 999999) {
        throw new IllegalArgumentException(
              "nanosecond timeout value out of range");
    }

    if (nanos > 0) {
        timeout++;
    }

    wait(timeout);
}
```

### notify() 函数

一个线程调用共享对象的notify() 方法后，会随机唤醒一个在该共享变量上调用wait 系列方法后被挂起的线程。被唤醒的变量只有在获取到共享变量监视器锁后才能继续执行。

类似wait 系列方法，只有当前线程获取到了共享变量的监视器锁后，才可以调用共享变量的notify() 方法，否则会抛出IllegalMonitorStateException 异常。

### notifyAll() 函数

notifyAll() 方法会唤醒所有在该共享变量上由于调用wait 系列方法而被挂起的线程。

## 等待线程执行终止的join 方法

挂起调用线程，直到被调用线程结束执行，调用线程才会继续执行。

## 让线程睡眠的sleep 方法

当一个执行中的线程调用了Thread 的sleep 方法后，调用线程会暂时让出指定时间的执行权，也就是在这期间不参与CPU 的调度，但是该线程所拥有的监视器资源，比如锁还是持有不让出的。指定的睡眠时间到了后该函数会正常返回，线程就处于就绪状态，然后参与CPU 的调度。

如果在睡眠期间其他线程调用了该线程的interrupt()方法中断了该线程，则该线程会在调用sleep 方法的地方抛出InterruptedException 异常而返回。

## 让出CPU 执行权的yield 方法

当一个线程调用Thread 的yield 方法时， 当前线程会让出CPU 使用权，然后处于就绪状态，线程调度器会从线程就绪队列里面获取一个线程优先级最高的线程，当然也有可能会调度到刚刚让出CPU 的那个线程来获取CPU 执行权。

## 线程中断

Java 中的线程中断是一种线程间的协作模式，通过设置线程的中断标志并不能直接终止该线程的执行，而是被中断的线程根据中断状态自行处理。

* void interrupt() : 中断线程
* boolean isInterrupted() : 检测当前线程是否被中断
```java
public boolean isInterrupted() {
    // 传递false，说明不清除中断标志
    return isInterrupted(false);
}
```
* boolean interrupted() : 检测当前线程是否被中断，与isInterrupted不同的是，该方法如果发现当前线程被中断，会清除中断标志，并且该方法是static 方法，可以通过Thread 类直接调用。
```java
public static boolean interrupted() {
    // 清除中断标志
    return currentThread().isInterrupted(true);
}
```
## 线程状态与状态转换

### 线程状态

Java语言定义了6种线程状态，在给定的一个时刻，线程只能处于其中的一个状态。这6种状态分别是：

状态名称 | 说明
---|---
NEW | 初始状态，线程被构建但是还没有调用start()方法
RUNNABLE | 运行状态，包括操作系统线程状态中的运行（Running）和就绪（Ready），线程正在执行或等待操作系统为其分配执行时间。
WAITING | 等待状态，等待被其他线程显式唤醒（通知或中断）
TIME_WAITING | 超时等待状态，无须等待被其他线程显式唤醒，在一定时间之后由系统自动唤醒
BLOCKED | 阻塞状态，表示线程阻塞于锁
TERMINATED | 终止状态，线程已执行完毕

### 线程状态转换

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/threadstatus.png)

## 线程上下文切换

CPU 一般是使用时间片轮转方式让线程轮询占用，所以当前线程CPU 时间片用完后，就会处于就绪状态并让出CPU ，等下次轮到自己的时候再执行，这就是上下文切换。（通过程序计数器记录线程让出CPU 时的执行地址，待再次分配到时间片时线程就从自己私有的计数器指定地址继续执行。另外需要注意的是，如果执行的是native 方法，那么pc 计数器记录的是undefined 地址，只有执行的是Java 代码时pc 计数器记录的才是下一条指令的地址。）

线程上下文切换时机有：
* 当前线程的CPU 时间片使用完处于就绪状态时
* 当前线程被其他线程中断时

## 线程死锁

### 什么是线程死锁

死锁是指两个或两个以上的线程在执行过程中，因争夺资源而造成的互相等待的现象，在无外力作用的情况下，这些线程会一直相互等待而无法继续运行下去。

死锁的产生必须具备以下四个条件：
* 互斥条件： 指线程对己经获取到的资源进行排它性使用，即该资源同时只由一个线程占用。
* 请求并持有条件： 指一个线程己经持有了至少一个资源但又要请求己被其他线程占有的资源时，当前线程会被阻塞但并不释放己获取的资源。
* 不可剥夺条件： 指线程获取到的资源在自己使用完之前不能被其他线程抢占， 只有在自己使用完毕后才由自己释放该资源。
* 环路等待条件： 指在发生死锁时， 必然存在一个线程 - 资源的环形链。

### 如何避免线程死锁

要避免死锁，只需要破坏掉至少一个构造死锁的必要条件即可，但只有请求并持有和环路等待条件是可以被破坏的。保持资源申请的有序性可以避免死锁。

## 守护线程与用户线程

Java 中的线程分为两类，分别为daemon 线程（守护线程）和user 线程（用户线程）。在JVM 启动时会调用main 函数， main 函数所在的线程就是一个用户线程，在JVM 内部启动了很多守护线程， 比如垃圾回收线程。

### 守护线程与用户线程区别

当最后一个非守护线程结束时， JVM 会正常退出，而不管当前是否有守护线程，也就是说守护线程是否结束并不影响JVM 的退出。即只要有一个用户线程还没结束， 正常情况下JVM 就不会退出。

下面代码中演示如何创建守护线程：
```java
public static void main(String[] args) {

	Thread daemonThread = new Thread(() -> {
		System.out.println("I am a daemon thread")
	});

    // 设置为守护线程
	daemonThread.setDaemon(true);
	daemonThread.start();
}
```