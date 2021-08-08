title: 【Java 并发编程系列】【J.U.C】：ThreadPoolExecutor
author: Haif.
tags:
  - 并发
categories:
  - 并发
date: 2020-12-26 17:57:00

---

## 线程池

**线程池主要解决以下两个问题：**

1. 当执行大量异步任务时线程池能够提供较好的性能。线程是可复用的，减少创建和销毁开销。
2. 线程池也提供了一种资源限制和管理的手段，比如可以限制线程的个数，动态新增线程等。

**线程池状态含义如下：**

* RUNNING：接受新任务并处理阻塞队列里的任务
* SHUTDOWN：拒绝新任务但是处理阻塞队列里的任务
* STOP：拒绝新任务并且抛弃阻塞队列里的任务，同时会中断正在处理的任务
* TIDYING：所有任务都执行完后当前线程池活动线程数为0，将要调用terminated 方法
* TERMINATED：终止状态

<!-- more -->

**线程池状态转换列举如下：**

* RUNNING -> SHUTDOWN：显示调用shutdown() 方法或隐式调用finalize() 方法里面的shutdown() 方法
* RUNNING/SHUTDOWN -> STOP：显示调用shutdownNow() 方法
* SHUTDOWN -> TIDYING：当线程池和任务队列都为空时
* STOP -> TIDYING：当线程池为空时
* TIDYING -> TERMINATED：当terminated() hook 方法执行完成时

**线程池参数如下：**

* corePoolSize：线程池核心线程个数
* workQueue：任务阻塞队列（比如基于数组的有界阻塞ArrayBlockingQueue、基于链表的无界阻塞LinkedBlockingQueue、最多只有一个元素的同步队列SynchronousQueue以及优先级队列PriorityBlockingQueue等）
* maximunPoolSize：线程池最大线程数量
* ThreadFactory：线程创建工厂
* RejectedExecutionHandler：饱和策略，当队列满并且队列个数达到maximunPoolSize后采取的策略，比如AbortPolicy（抛出异常）、CallerRunsPolicy（使用调用者所在线程来运行任务）、DiscardOldestPolicy（调用poll丢弃一个任务，执行当前任务）以及DiscardPolicy（丢弃且不抛异常）
* keeyAliveTime：存活时间，如果当前线程池中的线程数量比核心线程数量多并且是闲置状态，则这些闲置线程的最大存活时间
* TimeUnit：存活时间单位

**线程池类型如下：**

* newFixedThreadPool：创建一个核心线程个数和最大线程个数都是nThread 的线程池，并且阻塞队列长度为Integer.MAX_VALUE。keeyAliveTime=0 说明只要线程个数比核心线程数多并且当前空闲则回收。

```java
public static ExecutorService newFixedThreadPool(int nThreads) {
    return new ThreadPoolExecutor(nThreads, nThreads,
                                  0L, TimeUnit.MILLISECONDS,
                                  new LinkedBlockingQueue<Runnable>());
}

// 自定义线程工厂
public static ExecutorService newFixedThreadPool(int nThreads, ThreadFactory threadFactory) {
    return new ThreadPoolExecutor(nThreads, nThreads,
                                  0L, TimeUnit.MILLISECONDS,
                                  new LinkedBlockingQueue<Runnable>(),
                                  threadFactory);
}
```

* newSingleThreadExecutor：创建一个核心线程数和最大线程数都是1的线程池，阻塞队列长度为Interger.MAX_VALUE，keeyAliveTime=0 说明只要线程个数比核心线程数多并且当前空闲则回收。

```java
public static ExecutorService newSingleThreadExecutor() {
    return new FinalizableDelegatedExecutorService
        (new ThreadPoolExecutor(1, 1,
                                0L, TimeUnit.MILLISECONDS,
                                new LinkedBlockingQueue<Runnable>()));
}

// 自定义线程工厂
public static ExecutorService newSingleThreadExecutor(ThreadFactory threadFactory) {
    return new FinalizableDelegatedExecutorService
        (new ThreadPoolExecutor(1, 1,
                                0L, TimeUnit.MILLISECONDS,
                                new LinkedBlockingQueue<Runnable>(),
                                threadFactory));
}
```

* newCachedThreadPool：创建一个按需创建线程的线程池，初始线程数是0，最多线程个数为Integer.MAX_VALUE，并且阻塞队列为同步队列。keeyAliveTime=60 说明只要当前线程在60s 内空闲则回收。此线程池的特殊之处在于，加入同步队列的任务会被马上执行，同步队列里最多只能有一个任务。

```java
public static ExecutorService newCachedThreadPool() {
    return new ThreadPoolExecutor(0, Integer.MAX_VALUE,
                                  60L, TimeUnit.SECONDS,
                                  new SynchronousQueue<Runnable>());
}

// 自定义线程工厂
public static ExecutorService newCachedThreadPool(ThreadFactory threadFactory) {
    return new ThreadPoolExecutor(0, Integer.MAX_VALUE,
                                  60L, TimeUnit.SECONDS,
                                  new SynchronousQueue<Runnable>(),
                                  threadFactory);
}
```

* newScheduledThreadPool：创建一个周期线程池，支持定时及周期性任务执行。

```java
public static ScheduledExecutorService newScheduledThreadPool(int corePoolSize) {
    return new ScheduledThreadPoolExecutor(corePoolSize);
}

// 自定义线程工厂
public static ScheduledExecutorService newScheduledThreadPool(
        int corePoolSize, ThreadFactory threadFactory) {
    return new ScheduledThreadPoolExecutor(corePoolSize, threadFactory);
}
```

## ThreadPoolExecutor 

### 类图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/ThreadPoolExecutor-uml.png)


如上ThreadPoolExecutor 类图所示，其中：

* mainLock 是独占锁，用来控制新增Worker 线程操作的原子性
* termination 是mainLock锁对应条件队列，线程调用 awaitTermination 时用来存放阻塞线程
* Worker 继承AQS 和Runnable 接口，是具体承载任务的对象。 Worker继承AQS,
实现了简单不可重入独占锁，其中
    * state=0 表示锁未被获取
    * state=1 表示锁已经被获取的状态，
    * state=-1是创建Worker 默认的状态，创建时状态值设置为-1 是为了避免线程在 runWorker 方法前被中断
    * firstTask 记录该工作线程执行的第一个任务
    * thread 是具体执行任务的线程
* DefaultThreadFactory 是线程工厂，newThread 方法是对线程的一个修饰，其中
    * poolNumber 是静态原子变量，用来统计线程工厂的个数
    * threadNumber 记录每个线程工厂创建的线程数

### 原理剖析

#### public void execute(Runable command)

提交非空任务command 到线程池进行执行。

```java
public void execute(Runnable command) {
    if (command == null)
        throw new NullPointerException();

    int c = ctl.get(); // 获取当前线程池的状态+线程个数变量的组合值
    if (workerCountOf(c) < corePoolSize) { // 当前线程池中线程个数小于corePoolSize则开启新线程运行
        if (addWorker(command, true))
            return;
        c = ctl.get();
    }
    if (isRunning(c) && workQueue.offer(command)) { // 线程池处于RUNNABLE状态则添加任务到阻塞队列
        int recheck = ctl.get(); // 二次检查
        if (! isRunning(recheck) && remove(command)) // 如果当前线程池状态不是RUNNABLE则从队列删除任务并执行拒绝策略
            reject(command);
        else if (workerCountOf(recheck) == 0) // 如果当前线程池为空则添加一个线程
            addWorker(null, false);
    }
    else if (!addWorker(command, false)) // 如果队列满，则新增线程，新增失败则执行拒绝策略
        reject(command);
}

// 新增线程
private boolean addWorker(Runnable firstTask, boolean core) {
    retry:
    for (;;) {
        int c = ctl.get();
        int rs = runStateOf(c);

        // 检查队列是否只在必要时为空
        if (rs >= SHUTDOWN &&
            ! (rs == SHUTDOWN &&
               firstTask == null &&
               ! workQueue.isEmpty()))
            return false;

        // 循环CAS增加线程个数
        for (;;) {
            int wc = workerCountOf(c);
            
            // 如果线程个数超限则返回false
            if (wc >= CAPACITY ||
                wc >= (core ? corePoolSize : maximumPoolSize))
                return false;
                
            // CAS增加线程个数
            if (compareAndIncrementWorkerCount(c))
                break retry;
            // 如果CAS失败则检查线程池状态是否变化，变化则调到外层循环重新尝试获取线程池状态，否则循环CAS
            c = ctl.get();  // Re-read ctl
            if (runStateOf(c) != rs)
                continue retry;
            // else CAS failed due to workerCount change; retry inner loop
        }
    }

    // CAS成功后
    boolean workerStarted = false;
    boolean workerAdded = false;
    Worker w = null;
    try {
        // 创建worker
        w = new Worker(firstTask);
        final Thread t = w.thread;
        if (t != null) {
        
            // 加独占锁，实现workers同步
            final ReentrantLock mainLock = this.mainLock;
            mainLock.lock();
            try {
                // 重新检查线程池状态，避免在获取锁前被调用shutdown
                int rs = runStateOf(ctl.get());

                if (rs < SHUTDOWN ||
                    (rs == SHUTDOWN && firstTask == null)) {
                    if (t.isAlive()) // precheck that t is startable
                        throw new IllegalThreadStateException();
                    
                    // 添加任务
                    workers.add(w);
                    int s = workers.size();
                    if (s > largestPoolSize)
                        largestPoolSize = s;
                    workerAdded = true;
                }
            } finally {
                mainLock.unlock();
            }
            
            // 添加任务成功后则启动任务
            if (workerAdded) {
                t.start();
                workerStarted = true;
            }
        }
    } finally {
        if (! workerStarted)
            addWorkerFailed(w);
    }
    return workerStarted;
}
```

#### shutdown操作

调用此方法后，线程池就不会再接受新的任务了，但是工作队列里面的任务还是要执行的。该方法会立刻返回，并不等待队列任务完成再返回。

```java
public void shutdown() {
    final ReentrantLock mainLock = this.mainLock;
    mainLock.lock();
    try {
        checkShutdownAccess(); // 权限检查
        advanceRunState(SHUTDOWN); // 设置当前线程池状态是SHUTDOWN，如果已经是SHUTDOWN状态则直接返回
        interruptIdleWorkers(); // 设置中断标志
        onShutdown(); // hook for ScheduledThreadPoolExecutor
    } finally {
        mainLock.unlock();
    }
    tryTerminate(); // 尝试将状态变为TERMINATED
}

// 更新线程池状态
private void advanceRunState(int targetState) {
    for (;;) {
        int c = ctl.get();
        if (runStateAtLeast(c, targetState) ||
            ctl.compareAndSet(c, ctlOf(targetState, workerCountOf(c))))
            break;
    }
}

// 设置中断标志
private void interruptIdleWorkers() {
    interruptIdleWorkers(false);
}

private void interruptIdleWorkers(boolean onlyOne) {
    final ReentrantLock mainLock = this.mainLock;
    mainLock.lock();
    try {
        for (Worker w : workers) {
            Thread t = w.thread;
            // 如果工作线程没有被中断并且没有在运行则设置中断状态
            if (!t.isInterrupted() && w.tryLock()) {
                try {
                    t.interrupt();
                } catch (SecurityException ignore) {
                } finally {
                    w.unlock();
                }
            }
            if (onlyOne)
                break;
        }
    } finally {
        mainLock.unlock();
    }
}

// 尝试将状态变为TERMINATED
final void tryTerminate() {
    for (;;) {
        int c = ctl.get();
        if (isRunning(c) ||
            runStateAtLeast(c, TIDYING) ||
            (runStateOf(c) == SHUTDOWN && ! workQueue.isEmpty()))
            return;
        if (workerCountOf(c) != 0) { // Eligible to terminate
            interruptIdleWorkers(ONLY_ONE);
            return;
        }

        final ReentrantLock mainLock = this.mainLock;
        mainLock.lock();
        try {
            if (ctl.compareAndSet(c, ctlOf(TIDYING, 0))) { // 设置线程池状态为TIDYING
                try {
                    terminated();
                } finally {
                    ctl.set(ctlOf(TERMINATED, 0)); // 设置线程池状态为TERMINATED
                    termination.signalAll(); // 激活因调用条件变量termination的await系列方法而被阻塞的所有线程
                }
                return;
            }
        } finally {
            mainLock.unlock();
        }
        // else retry on failed CAS
    }
}
```

#### shutdownNow操作

调用shutdownNow 方法后，线程池不会再接受新的任务，并且会丢弃工作队列里面的任务，正在执行的任务会被中断，该方法会立刻返回。返回值为队列里面被丢弃的任务列表。

```java
public List<Runnable> shutdownNow() {
    List<Runnable> tasks;
    final ReentrantLock mainLock = this.mainLock;
    mainLock.lock();
    try {
        checkShutdownAccess(); // 权限检查
        advanceRunState(STOP); // 设置线程池状态为STOP
        interruptWorkers(); // 中断所有线程
        tasks = drainQueue(); // 将队列任务移动到tasks
    } finally {
        mainLock.unlock();
    }
    tryTerminate(); // 尝试将状态变为TERMINATED
    return tasks;
}

// 中断所有线程
private void interruptWorkers() {
    final ReentrantLock mainLock = this.mainLock;
    mainLock.lock();
    try {
        for (Worker w : workers)
            w.interruptIfStarted();
    } finally {
        mainLock.unlock();
    }
}
```

#### awaitTermination操作

调用此方法后，当前线程会被阻塞，直到线程池状态变为TERMINATED 才返回，或者等待时间 超时才返回。

```java
public boolean awaitTermination(long timeout, TimeUnit unit)
    throws InterruptedException {
    long nanos = unit.toNanos(timeout);
    final ReentrantLock mainLock = this.mainLock;
    mainLock.lock();
    try {
        for (;;) {
            if (runStateAtLeast(ctl.get(), TERMINATED))
                return true;
            if (nanos <= 0)
                return false;
            nanos = termination.awaitNanos(nanos);
        }
    } finally {
        mainLock.unlock();
    }
}
```

## ScheduledThreadPoolExecutor

ScheduledThreadPoolExecutor是一个可以在指定一定延迟时间后或者定时进行任务调度执行的线程池。

### 类图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/ScheduledThreadPoolExecutor-uml.png)

ScheduledFutureTask 是具有返回值的任务，继承自FutureTask 。FutureTask 的内部有一个变量state 用来表示任务的状态，一开始状态为NEW ，所有状态为：

```java
    private static final int NEW          = 0; // 初始状态
    private static final int COMPLETING   = 1; // 执行中状态
    private static final int NORMAL       = 2; // 正常运行结束状态
    private static final int EXCEPTIONAL  = 3; // 运行中异常
    private static final int CANCELLED    = 4; // 任务被取消
    private static final int INTERRUPTING = 5; // 任务正在被中断
    private static final int INTERRUPTED  = 6; // 任务已经被中断

```

可能的任务状态转换路径为：

* NEW -> COMPLETING -> NORMAL ：初始状态 -> 执行中 -> 正常结束
* NEW -> COMPLETING -> EXCEPTIONAL ：初始状态 -> 执行中 -> 执行异常
* NEW -> CANCELLED ：初始状态 -> 任务取消
* NEW -> INTERRUPTING -> INTERRUPTED ：初始状态 -> 被中断中 -> 被中断

ScheduledFutureTask 内部还有一个变量period 用来表示任务的类型，任务类型如下：

* period=0 说明当前任务是一次性的，执行完毕后退出
* period 为负数，说明当前任务是fixed-delay 任务，是固定延迟的定时可重复执行任务
* period 为正数，说明当前任务是fixed-rate 任务，是固定频率的定时可重复执行任务

ScheduledThreadPoolExecutor的一个构造函数如下，有构造函数可知线程池队列是DelayedWorkQueue

```java
// 使用改造后的DelayQueue
public ScheduledThreadPoolExecutor(int corePoolSize) {
    // 调用父类ThreadPoolExecutor构造函数
    super(corePoolSize, Integer.MAX_VALUE, 0, NANOSECONDS,
          new DelayedWorkQueue());
}

public ThreadPoolExecutor(int corePoolSize,
                          int maximumPoolSize,
                          long keepAliveTime,
                          TimeUnit unit,
                          BlockingQueue<Runnable> workQueue) {
    this(corePoolSize, maximumPoolSize, keepAliveTime, unit, workQueue,
         Executors.defaultThreadFactory(), defaultHandler);
}
```

### 原理剖析


#### schedule(command: Runnable, delay: long, unit: TimeUnit)

提交一个延迟执行的任务，从提交时间算起延迟单位为unit 的delay 时间后开始执行。任务只会执行一次。

```java
public ScheduledFuture<?> schedule(Runnable command,
                                   long delay,
                                   TimeUnit unit) {
    // 参数校验
    if (command == null || unit == null)
        throw new NullPointerException();
    
    // 任务转换
    RunnableScheduledFuture<?> t = decorateTask(command,
        new ScheduledFutureTask<Void>(command, null,
                                      triggerTime(delay, unit)));
                                      
    // 添加任务到延迟队列
    delayedExecute(t);
    return t;
}

// ScheduledFutureTask构造函数
ScheduledFutureTask(Runnable r, V result, long ns) {
    super(r, result); // 调用父类FutureTask构造函数，通过适配器把runnable转换为callable
    this.time = ns;
    this.period = 0; // 标记为一次性任务
    this.sequenceNumber = sequencer.getAndIncrement();
}

// 添加任务到延迟队列
private void delayedExecute(RunnableScheduledFuture<?> task) {
    if (isShutdown())
        reject(task); // 如果线程池关闭则执行拒绝策略
    else {
        super.getQueue().add(task); // 添加任务到延迟队列
        // 检查线程池状态
        if (isShutdown() &&
            !canRunInCurrentRunState(task.isPeriodic()) &&
            remove(task))
            task.cancel(false);
        else
            ensurePrestart(); // 确保至少一个线程正在处理任务
    }
}
```

下面看一下线程池中的线程如何获取并执行任务：

具体执行任务的线程是Worker，Worker调用任务的run 方法来执行，这里的任务是ScheduledFutureTask，其run 方法源码如下：

```java
public void run() {
    // 是否只执行一次
    boolean periodic = isPeriodic();
    // 是否取消任务
    if (!canRunInCurrentRunState(periodic))
        cancel(false);
    // 任务是否可重复执行
    else if (!periodic)
        ScheduledFutureTask.super.run();
    // 单次任务执行
    else if (ScheduledFutureTask.super.runAndReset()) {
        // 设置time=time+period
        setNextRunTime();
        // 重新把任务放到delay队列
        reExecutePeriodic(outerTask);
    }
}
```

#### scheduleWithFixedDelay(command: Runnable, initialDelay: long, delay: long, unit: TimeUnit)

当任务执行完毕后，让其延迟固定时间后再次运行（fixed-delay 任务）。其中initialDelay 表示提交任务后延迟多少时间开始执行任务command ，delay 表示当任务执行完毕后延长多少时间后再次运行command 任务，unit 是initialDelay 和delay 的时间单位。任务会一直重复运行直到任务运行中抛出了异常、被取消或者关闭了线程池。

```java
public ScheduledFuture<?> scheduleWithFixedDelay(Runnable command,
                                                 long initialDelay,
                                                 long delay,
                                                 TimeUnit unit) {
    if (command == null || unit == null)
        throw new NullPointerException();
    if (delay <= 0)
        throw new IllegalArgumentException();
        
    // 任务转换，period=-delay<0表示可重复执行的任务
    ScheduledFutureTask<Void> sft =
        new ScheduledFutureTask<Void>(command,
                                      null,
                                      triggerTime(initialDelay, unit),
                                      unit.toNanos(-delay));
    RunnableScheduledFuture<Void> t = decorateTask(command, sft);
    sft.outerTask = t;
    delayedExecute(t); // 添加任务到队列
    return t;
}
```

fixe-delay 类型的任务的执行原理为，当添加一个任务到延迟队列后，等待 initialDelay 时间，任务就会过期，过期的任务就会被从队列移除，并执行。执行完毕后，会重新设置任务的延迟时间，然后再把任务放入延迟队列，循环往复。需要注意的是，如果一个任务在执行中抛出了异常，那么这个任务就结束了，但是不影响其他任务的执行。

#### scheduleAtFixedRate(command: Runnable, initialDelay: long, delay: long, unit: TimeUnit)

该方法相对起始时间点以固定频率调用指定的任务（fixed-rate 任务）。当把任务提交到线程池并延迟initialDelay 时间，时间单位为unit 后开始执行任务 command 。然后initialDelay+period 时间点再次执行，而后在 initialDelay + 2 * period 时间点再次执行，循环往复，直到抛出异常或者调用了任务的cancel方法取消了任务，或者关闭了线程池。

```java
public ScheduledFuture<?> scheduleAtFixedRate(Runnable command,
                                              long initialDelay,
                                              long period,
                                              TimeUnit unit) {
    if (command == null || unit == null)
        throw new NullPointerException();
    if (period <= 0)
        throw new IllegalArgumentException();
        
    // 装饰任务类，注意period=period>0，非负
    ScheduledFutureTask<Void> sft =
        new ScheduledFutureTask<Void>(command,
                                      null,
                                      triggerTime(initialDelay, unit),
                                      unit.toNanos(period));
    RunnableScheduledFuture<Void> t = decorateTask(command, sft);
    sft.outerTask = t;
    delayedExecute(t);
    return t;
}

```

相对于 fixed-delay 任务来说，fixed-rate 方式执行规则为，时间为 initialDelay + n * period 时启动任务，但是如果当前任务还没有执行完，下次要执行任务的时间到了则不会并发执行，下次要执行的任务会延迟执行，要等到当前任务执行完毕后再执行。