title: 【Java 并发编程系列】【J.U.C】：Queue
author: Haif.
tags:
  - 并发
categories:
  - 并发
date: 2020-12-26 17:56:00

---

## ConcurrentLinkedQueue

ConcurrentLinkedQueue 线程安全的**无界非阻塞**队列，其底层数据结构使用单向链表实现，对于入队和出队操作使用 CAS 来实现线程安全。

### 类图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/ConcurrentLinkedQueue-uml.png)

ConcurrentLinkedQueue 内部的队列使用单向链表的方式实现，其中有两个volatile 类型的Node 节点分别用来存放队列首、尾节点。

Node 内部则维护一个使用volatile 修饰的item，用来存放节点的值；next 用来存放链表的下一个节点；其内部使用UNSafe 工具类提供的CAS 算法来保证入队时操作链表的原子性。

<!-- more -->

### 实现原理

#### offer 操作

在队列末尾添加一个元素，如果传递的参数是null 则抛出NPE 异常，否则由于 ConcurrentLinkedQueue 是无界队列，该方法一直会返回true 。另外，由于使用CAS 无阻塞算法，因此方法不会阻塞挂起调用。

```java
public boolean offer(E e) {
    checkNotNull(e); // e为空抛出空指针异常
    final Node<E> newNode = new Node<E>(e); // 构造Node节点，构造函数内部调用unsafe.putObject

    for (Node<E> t = tail, p = t;;) { // 从尾节点进行插入
        Node<E> q = p.next;
        if (q == null) { // 如果q是空说明p是尾节点，则执行插入
            // p is last node
            if (p.casNext(null, newNode)) { // 使用cas设置p节点的next节点
                // CAS成功，则说明新增节点已经被放入链表
                if (p != t) // hop two nodes at a time
                    casTail(t, newNode);  // Failure is OK.
                return true;
            }
            // Lost CAS race to another thread; re-read next
        }
        else if (p == q)
            // 多线程操作时，由于poll操作移除元素后可能会把head变为自引用，也就是head的next变成了head，所以这里需要重新找新的head
            p = (t != (t = tail)) ? t : head;
        else
            // 寻找尾节点
            p = (p != t && t != (t = tail)) ? t : q;
    }
}
```

#### add 操作

add 操作是在链表末尾添一个元素，其实在内部调用的还是 offer 操作。

```java
public boolean add(E e) {
    return offer(e);
}
```

#### poll 操作

poll 操作是在队列头部获取并移除一个元素 如果队列为空则返回 null。

```java
public E poll() {
    restartFromHead: // goto标记
    for (;;) {
        for (Node<E> h = head, p = h, q;;) {
            E item = p.item; // 保存当前节点值

            if (item != null && p.casItem(item, null)) { // 当前节点有值则CAS变为null
                
                if (p != h) // CAS成功则标记当前节点并从链表删除
                    updateHead(h, ((q = p.next) != null) ? q : p);
                return item;
            }
            else if ((q = p.next) == null) { // 当前队列为空则返回null
                updateHead(h, p);
                return null;
            }
            else if (p == q) // 如果当前节点被自引用，则重新寻找新的队列头节点
                continue restartFromHead;
            else
                p = q;
        }
    }
}

final void updateHead(Node<E> h, Node<E> p) {
    if (h != p && casHead(h, p))
        h.lazySetNext(h);
}
```

#### peek 操作

获取队列头部一个元素（只获取不移除），如果队列为空则返回 null。

```java
public E peek() {
    restartFromHead:
    for (;;) {
        for (Node<E> h = head, p = h, q;;) {
            E item = p.item; // 保存当前节点值
           
            if (item != null || (q = p.next) == null) { 
                updateHead(h, p);  // 在第一次调peek操作时，会删除哨兵节点，并让队列的head节点指向队列里面第一个元素或者null
                return item;
            }
            else if (p == q) // 如果当前节点被自引用，则重新寻找新的队列头节点
                continue restartFromHead;
            else
                p = q;
        }
    }
}
```

#### size 操作

计算当前队列元素个数，在并发环境下不是很有用，因为CAS 没有加锁，所以从调用size 函数到返回结果期间有可能增删元素，导致统计的元素个数不精确。

```java
public int size() {
    int count = 0;
    for (Node<E> p = first(); p != null; p = succ(p))
        if (p.item != null)
            // 最大值Integer.MAX_VALUE
            if (++count == Integer.MAX_VALUE) 
                break;
    return count;
}

// 获取第一个队列元素（哨兵元素不算），没有则返回null
Node<E> first() {
    restartFromHead:
    for (;;) {
        for (Node<E> h = head, p = h, q;;) {
            boolean hasItem = (p.item != null);
            if (hasItem || (q = p.next) == null) {
                updateHead(h, p);
                return hasItem ? p : null;
            }
            else if (p == q)
                continue restartFromHead;
            else
                p = q;
        }
    }
}

// 获取当前节点的next元素，如果是自引入节点则返回真正的头节点
final Node<E> succ(Node<E> p) {
    Node<E> next = p.next;
    return (p == next) ? head : next;
}
```

#### remove 操作

如果队列里面存在该元素则删除该元素，如果存在多个则删除第一个，并返回true，否则返回false。

```java
public boolean remove(Object o) {
    if (o != null) {
        Node<E> next, pred = null;
        for (Node<E> p = first(); p != null; pred = p, p = next) {
            boolean removed = false;
            E item = p.item;
            if (item != null) {
                if (!o.equals(item)) {
                    next = succ(p);
                    continue;
                }
                removed = p.casItem(item, null); // 相等则使用CAS设置为null，同时一个线程操作成功，失败的线程循环查找队列中是否有匹配的其他元素
            }

            next = succ(p); // 获取next元素
            if (pred != null && next != null) // 如果有前驱节点，并且next不为空则链接前驱节点到next
                pred.casNext(p, next);
            if (removed)
                return true;
        }
    }
    return false; // 为空返回false
}
```

#### contains操作

判断队列里面是否含有指定对象，由于是遍历整个队列，所以像size 操作一样结果也不是那么精确，有可能调用该方法时元素还在队列里面，但是遍历过程中其他线程才把该元素删除了，那么就会返回 false。

```java
public boolean contains(Object o) {
    if (o == null) return false;
    for (Node<E> p = first(); p != null; p = succ(p)) {
        E item = p.item;
        if (item != null && o.equals(item))
            return true;
    }
    return false;
}
```

## LinkedBlokingQueue

LinkedBlokingQueue是使用独占锁实现的**无界（可指定有界）阻塞**队列。

### 类图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/LinkedBlokingQueue-uml.png)

LinkedBlockingQueue 也是使用单向链表实现的，其也有两个Node ，分别用来存放首、尾节点，并且还有一个初始值为 0 的原子变量count ，用来记录队列元素个数。

还有两个ReentrantLock 的实例，分别用来控制元素入队和出队的原子性，其中takeLock 用来控制同时只有一个线程可以从队列头获取元素，其他线程必须等待。putLock 控制同时只能有一个线程可以获取锁，在队列尾部添加元素，其他线程必须等待。

另外，notEmpty 和notFull 是条件变量，它们内部都有一个条件队列用来存放进队和出队时被阻塞的线程，其实这是生产者-消费者模型。

从LinkedBlokingQueue 的构造函数可知，其默认容量是0x7fffffff，用户也可以自定义容量，所以从一定程度上可以说从LinkedBlokingQueue 是有界阻塞队列。

```java
public LinkedBlockingQueue() {
    this(Integer.MAX_VALUE);
}

public LinkedBlockingQueue(int capacity) {
    if (capacity <= 0) throw new IllegalArgumentException();
    this.capacity = capacity;
    last = head = new Node<E>(null); // 初始化首、尾节点，让他们指向哨兵节点
}
```

### 实现原理

#### offer操作

向队列尾部插入一个元素，如果队列中有空闲则插入成功后返回true ，如果队列己满则丢弃当前元素然后返回false 。此方法是非阻塞。

```java
public boolean offer(E e) {
    if (e == null) throw new NullPointerException(); // e为空元素则抛空指针异常
    final AtomicInteger count = this.count;
    if (count.get() == capacity) // 如果队列已满则丢弃并返回false
        return false;
    int c = -1;
    Node<E> node = new Node<E>(e); // 构造新节点
    final ReentrantLock putLock = this.putLock; // 获取putLock独占锁
    putLock.lock();
    try {
        if (count.get() < capacity) { // 如果队列不满则进队列，并递增元素计数
            enqueue(node);
            c = count.getAndIncrement();
            if (c + 1 < capacity) // 如果新元素入队后还有空闲空间则唤醒一个入队线程
                notFull.signal();
        }
    } finally {
        putLock.unlock(); // 释放锁
    }
    if (c == 0)
        signalNotEmpty(); // 唤醒notEmpty条件队列中因为调用notEmpty的await方法（比如调用take方法时队列为空）而被阻塞的线程
    return c >= 0;
}

private void signalNotEmpty() {
    final ReentrantLock takeLock = this.takeLock;
    takeLock.lock();
    try {
        notEmpty.signal();
    } finally {
        takeLock.unlock();
    }
}
```

#### put操作

向队列尾部插入一个元素，如果队列中有空闲则插入后直接返回，如果队列已满则阻塞当前线程，直到队列有空闲插入成功后返回。如果在阻塞时被其他线程设置了中断标志，被阻塞线程会抛出InterruptedException 异常而返回。

```java
// put操作代码与offer类似
public void put(E e) throws InterruptedException {
    // 非空校验
    if (e == null) throw new NullPointerException();
    // 构建新节点，并获取独占锁putLock
    int c = -1;
    Node<E> node = new Node<E>(e);
    final ReentrantLock putLock = this.putLock;
    final AtomicInteger count = this.count;
    putLock.lockInterruptibly();
    try {
        // 如果队列已满则等待
        while (count.get() == capacity) { // 此处循环检查防止虚假唤醒
            notFull.await();
        }
        // 进队列并递增计数
        enqueue(node);
        c = count.getAndIncrement();
        // 还有剩余空间则唤醒入队线程
        if (c + 1 < capacity)
            notFull.signal();
    } finally {
        // 解锁
        putLock.unlock();
    }
    if (c == 0)
        // 入队成功唤醒出队线程
        signalNotEmpty();
}
```

#### poll操作

从队列头部获取并移除一个元素 如果队列为空则返回null 。此方法是不阻塞的。

```java
public E poll() {
    final AtomicInteger count = this.count;
    if (count.get() == 0) // 计数为0直接返回null
        return null;
    E x = null;
    int c = -1;
    final ReentrantLock takeLock = this.takeLock; // 获取独占锁
    takeLock.lock();
    try {
        if (count.get() > 0) { // 队列不为空
            x = dequeue(); // 出队
            c = count.getAndDecrement(); // 递减计数
            if (c > 1)
                notEmpty.signal(); // 还有元素则唤醒下一个出队线程
        }
    } finally {
        takeLock.unlock(); // 解锁
    }
    if (c == capacity)
        signalNotFull(); // 当前线程已满，移除元素后唤醒一个因调用put而被阻塞到notFull条件队列的线程
    return x;
}

// 出队
private E dequeue() {
    Node<E> h = head;
    Node<E> first = h.next;
    h.next = h; // help GC
    head = first;
    E x = first.item;
    first.item = null;
    return x;
}
```

#### peek操作

获取队列头部元素但是不从队列里面移除它，如果队列为空返回null 。此方法是不阻塞的。

```java
public E peek() {
    if (count.get() == 0) // 无元素直接返回null
        return null;
    final ReentrantLock takeLock = this.takeLock; // 获取takeLock
    takeLock.lock();
    try {
        Node<E> first = head.next;
        if (first == null) // 防止其他线程执行了poll或take操作导致线程变为空
            return null;
        else
            return first.item;
    } finally {
        takeLock.unlock(); // 解锁
    }
}
```

#### take操作

获取当前队列头部元素并从队列里移除它，如果队列为空则阻塞当前线程直到队列不为空然后返回元素，如果在阻塞时被其他线程设置了中断标志，则阻塞线程会抛出InterruptedException 异常而返回。

```java
public E take() throws InterruptedException {
    E x;
    int c = -1;
    final AtomicInteger count = this.count;
    final ReentrantLock takeLock = this.takeLock; // 获取锁
    takeLock.lockInterruptibly();
    try {
        while (count.get() == 0) { // 当前队列为空则阻塞挂起
            notEmpty.await();
        }
        x = dequeue(); // 出队
        c = count.getAndDecrement(); // 递减计数
        if (c > 1)
            notEmpty.signal(); // 唤醒出队线程
    } finally {
        takeLock.unlock(); // 解锁
    }
    if (c == capacity)
        signalNotFull(); // 唤醒入队线程
    return x;
}
```

#### remove操作

删除队列里面指定的元素，有则删除并返回true ，没有则返回 false。

```java
public boolean remove(Object o) {
    if (o == null) return false;
    fullyLock(); // 双重加锁
    try {
        for (Node<E> trail = head, p = trail.next; // 遍历队列找到则删除并返回true
             p != null;
             trail = p, p = p.next) {
            if (o.equals(p.item)) {
                unlink(p, trail);
                return true;
            }
        }
        return false;
    } finally {
        fullyUnlock(); // 解锁
    }
}

void unlink(Node<E> p, Node<E> trail) {
    p.item = null;
    trail.next = p.next;
    if (last == p)
        last = trail;
    if (count.getAndDecrement() == capacity) // 如果当前线程已满，删除后唤醒等待线程
        notFull.signal();
}

void fullyLock() {
    putLock.lock();
    takeLock.lock();
}

void fullyUnlock() {
    takeLock.unlock();
    putLock.unlock();
}
```

#### size操作

获取当前队列元素个数。

```java
public int size() {
    return count.get();
}
```

由于进行入队和出队操作时的count加了锁，所以结果比ConcurentLinkedQueue的size 方法准确。

> ConcurentLinkedQueue中遍历链表获取size未使用原子变量保存是因为使用原子变量保存队列元素个数需要保证入队、出队和原子变量操作时原子性操作，而ConcurentLinkedQueue 使用的是CAS 无锁算法，所以无法实现。

## ArrayBlockingQueue

ArrayBlockingQueue 是用**有界数组**方式实现的**阻塞**队列。

### 类图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/ArrayBlockingQueue-uml.png)

ArrayBlockingQueue 内部结构如下：

- items： 数组，用来存放队列元素
- putIndex：入队元素下标
- takeIndex: 出队元素下标
- count: 队列元素个数
- lock: 独占锁，保证出、入操作的原子性
- notEmpty: 出队条件变量 
- notFull：入队条件变量

构造函数如下：

```java
public ArrayBlockingQueue(int capacity) {
    this(capacity, false);
}

public ArrayBlockingQueue(int capacity, boolean fair) {
    if (capacity <= 0)
        throw new IllegalArgumentException();
    this.items = new Object[capacity];
    lock = new ReentrantLock(fair);
    notEmpty = lock.newCondition();
    notFull =  lock.newCondition();
}
```

ArrayBlockingQueue 是有界队列，构造函数必须传入队列大小参数。在默认情况下使用ReentrantLock 提供的非公平独占锁进行出、入队操作的同步。

### 实现原理

#### offer操作

向队列尾部插入一个非空元素，如果队列有空闲空间则插入成功后返回true ，如果队列已满则丢弃当前元素然后返回false 。此方法是不阻塞的。

```java
public boolean offer(E e) {
    checkNotNull(e); // 非空校验
    final ReentrantLock lock = this.lock; // 获取独占锁
    lock.lock();
    try {
        if (count == items.length) // 如果队列已满返回false
            return false;
        else {
            enqueue(e); // 队列有空闲空间则插入元素
            return true;
        }
    } finally {
        lock.unlock(); // 解锁
    }
}

private void enqueue(E x) {
    final Object[] items = this.items; // 元素入队
    items[putIndex] = x;
    if (++putIndex == items.length) // 计算下一个元素应该存放的下标位置
        putIndex = 0;
    count++;
    notEmpty.signal(); // 唤醒出队阻塞线程
}
```

#### put操作

向队列尾部插入一个非空元素，如果队列有空闲空间则插入后直接返回true ，如果队列已满则阻塞当前线程直到队列有空闲并插入成功后返回true ，如果在阻塞时被其他线程设置了中断标志， 则被阻塞线程会抛出InterruptedException 异常而返回。

```java
public void put(E e) throws InterruptedException {
    checkNotNull(e);
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly(); // 获取可中断锁
    try {
        while (count == items.length) // 如果队列已满则把当前线程放入notFull管理的条件队列
            notFull.await();
        enqueue(e); // 插入元素
    } finally {
        lock.unlock();
    }
}
```

#### poll操作

从队列头部获取一个元素，如果队列为空则返回null。此方法是不阻塞的。

```java
public E poll() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return (count == 0) ? null : dequeue();
    } finally {
        lock.unlock();
    }
}

private E dequeue() {
    final Object[] items = this.items;
    @SuppressWarnings("unchecked")
    E x = (E) items[takeIndex]; // 获取元素值
    items[takeIndex] = null; // 获取后设置为空
    if (++takeIndex == items.length) // 重置队列头下标
        takeIndex = 0;
    count--; // 队列元素个数减1
    if (itrs != null)
        itrs.elementDequeued(); 
    notFull.signal(); // 唤醒入队阻塞的线程
    return x;
}
```

#### take操作

获取当前队列头部元素并从队列里面移除它。如果队列为空则阻塞当前线程直到队列不为空然后返回元素。此方法响应中断。

```java
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        while (count == 0)
            notEmpty.await();
        return dequeue(); // 获取队列头元素
    } finally {
        lock.unlock();
    }
}
```

#### peek操作

获取队列头部元素但是不从队列里面移除它。

```java
public E peek() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return itemAt(takeIndex); // null when queue is empty
    } finally {
        lock.unlock();
    }
}

final E itemAt(int i) {
    return (E) items[i];
}
```

#### size操作

计算当前队列元素个数（全局锁，结果精准）。

```java
public int size() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return count;
    } finally {
        lock.unlock();
    }
}
```

## PriorityBlockingQueue

PriorityBlockingQueue 是**带优先级的无界阻塞**队列，每次出队都返回优先级最高或者最低的元素。其内部是使用平衡二叉树堆实现的，所以直接遍历队列元素不保证有序。默认使用对象的CompareTo 方法提供比较规则，如果需要自定义比较规则则可以自定义comparators。

### 类图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/PriorityBlockingQueue-uml.png)

PriorityBlockingQueue 内部结构如下：

* queue：数组，用来存放队列元素
* size：队列元素个数
* allocationSpinLock：自旋锁，使用CAS 操作保证只有一个线程可以进行扩容，0表示当前没有进行扩容，1表示正在扩容
* lock: 独占锁，保证同时只有一个线程可以进行入队、出队操作
* notEmpty：出队条件变量

构造函数如下：

```java
private static final int DEFAULT_INITIAL_CAPACITY = 11;

public PriorityBlockingQueue() {
    this(DEFAULT_INITIAL_CAPACITY, null);
}

public PriorityBlockingQueue(int initialCapacity) {
    this(initialCapacity, null);
}

public PriorityBlockingQueue(int initialCapacity,
                             Comparator<? super E> comparator) {
    if (initialCapacity < 1)
        throw new IllegalArgumentException();
    this.lock = new ReentrantLock();
    this.notEmpty = lock.newCondition();
    this.comparator = comparator;
    this.queue = new Object[initialCapacity];
}
```

PriorityBlockingQueue 默认队列容量为11，默认比较器为null，也就是使用元素的compareTo方法确认优先级（元素必须实现Comparable接口）。

### 实现原理

#### offer操作

在队列中插入一个元素，由于是无界队列所以一直返回true。

```java
public boolean offer(E e) {
    if (e == null)
        throw new NullPointerException();
    final ReentrantLock lock = this.lock;
    lock.lock();
    int n, cap;
    Object[] array;
    while ((n = size) >= (cap = (array = queue).length)) // 当前元素个数>=队列容量则扩容
        tryGrow(array, cap);
    try {
        Comparator<? super E> cmp = comparator;
        if (cmp == null) // 默认比较器是null
            siftUpComparable(n, e, array);
        else
            siftUpUsingComparator(n, e, array, cmp); // 自定义比较器
        size = n + 1; // 将队列元素个数加1
        notEmpty.signal(); // 唤醒阻塞在出队的线程
    } finally {
        lock.unlock();
    }
    return true;
}

private void tryGrow(Object[] array, int oldCap) {
    lock.unlock(); // 释放获取的锁
    Object[] newArray = null;
    if (allocationSpinLock == 0 &&
        UNSAFE.compareAndSwapInt(this, allocationSpinLockOffset, // CAS更新扩容标记
                                 0, 1)) {
        try {
            // oldCap<64，则扩容oldCap+2，否则扩容50%
            int newCap = oldCap + ((oldCap < 64) ?
                                   (oldCap + 2) : // grow faster if small
                                   (oldCap >> 1));
            if (newCap - MAX_ARRAY_SIZE > 0) {    // 最大值Integer.MAX_VALUE - 8
                int minCap = oldCap + 1;
                if (minCap < 0 || minCap > MAX_ARRAY_SIZE)
                    throw new OutOfMemoryError();
                newCap = MAX_ARRAY_SIZE;
            }
            if (newCap > oldCap && queue == array)
                newArray = new Object[newCap];
        } finally {
            allocationSpinLock = 0;
        }
    }
    if (newArray == null) // CAS更新失败后，当前线程让出CPU，尽量让扩容成功的线程获取锁，但扩容线程并不一定能获取到锁
        Thread.yield();
    lock.lock();
    if (newArray != null && queue == array) {
        queue = newArray;
        System.arraycopy(array, 0, newArray, 0, oldCap);
    }
}

// 二叉树堆 建堆算法
private static <T> void siftUpComparable(int k, T x, Object[] array) {
    Comparable<? super T> key = (Comparable<? super T>) x;
    // 队列元素个数>0则判断插入位置，否则直接入队
    while (k > 0) {
        int parent = (k - 1) >>> 1;
        Object e = array[parent];
        if (key.compareTo((T) e) >= 0)
            break;
        array[k] = e;
        k = parent;
    }
    array[k] = key;
}
```

#### poll操作

获取队列内部堆树的根节点元素。

```java
public E poll() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return dequeue();
    } finally {
        lock.unlock();
    }
}

private E dequeue() {
    int n = size - 1;
    if (n < 0)
        return null;
    else {
        Object[] array = queue; // 获取队列头元素
        E result = (E) array[0];
        E x = (E) array[n]; // 获取队列尾元素
        array[n] = null; // 尾元素赋值为null
        Comparator<? super E> cmp = comparator;
        // 重新调整堆
        if (cmp == null)
            siftDownComparable(0, x, array, n);
        else
            siftDownUsingComparator(0, x, array, n, cmp);
        size = n;
        return result;
    }
}
```

#### put操作

put 操作内部调用的是offer 操作，由于是无界队列，所以不需要阻塞。

#### take操作

获取队列内部堆树的根节点元素，如果队列为空则阻塞，响应中断。

```java
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly(); // 获取可中断锁
    E result;
    try {
        while ( (result = dequeue()) == null) // 获取队列尾元素，如果队列为空则阻塞
            notEmpty.await();
    } finally {
        lock.unlock();
    }
    return result;
}
```

#### size操作

计算队列元素个数。

```java
public int size() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return size;
    } finally {
        lock.unlock();
    }
}
```

## DelayQueue

DelayQueue 并发队列是一个**无界阻塞延迟**队列，队列中的每个元素都有个过期时间，当从队列获取元素时，只有过期元素才会出队列。队列头元素是最快要过期的元素。

### 类图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/DelayQueue-uml.png)

DelayQueue 内部使用PriorityQueue 存放数据，使用ReentrantLock 实现线程同步。队列中的元素需要实现Delayed 接口，实现比较接口。

```java
public interface Delayed extends Comparable<Delayed> {

    long getDelay(TimeUnit unit);
}
```

leader 变量的使用基于 Lead - Follower 模式的变体，用于尽量减少不必要的线程等待。当一个线程调用队列的take 方法变leader 线程后，它会调用条件变量available.awaitNanos(delay) 等待delay 时间，但是其他线程（follwer 线程）会调用available.await()进行无限等待。leader 线程延迟时间过期后，会退出take 方法，并通过调用available.signal()方法唤醒一个follwer 线程，被唤醒的follwer 线程被选举为新的leader 线程。

### 实现原理

#### offer操作

插入非空元素到队列，由于是无界队列所以一直返回true 。插入元素要实现Delayed 接口。

```java
public boolean offer(E e) {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        q.offer(e);
        if (q.peek() == e) { // 如果当前元素是最先过期则重置leader线程为null，并唤醒出队阻塞线程
            leader = null;
            available.signal();
        }
        return true;
    } finally {
        lock.unlock();
    }
}
```

#### take操作

获取并移除队列里面延迟时间过期的元素，如果队列里面没有过期元素则等待。

```java
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        for (;;) {
            E first = q.peek(); // 获取但不移除队首元素
            if (first == null)
                available.await(); // 如果队首元素为空则阻塞
            else {
                long delay = first.getDelay(NANOSECONDS); // 元素剩余到期时间
                if (delay <= 0)
                    return q.poll(); // 已经过期出队返回
                first = null; // don't retain ref while waiting
                if (leader != null)
                    available.await(); // leader不为空说明其他线程在执行take，当前线程阻塞等待
                else {
                    Thread thisThread = Thread.currentThread();
                    leader = thisThread; // 选择当前线程为leader线程
                    try {
                        available.awaitNanos(delay); // 执行等待delay时间（期间释放锁），超时重新竞争锁获取到期元素
                    } finally {
                        if (leader == thisThread)
                            leader = null;
                    }
                }
            }
        }
    } finally {
        if (leader == null && q.peek() != null)
            available.signal();
        lock.unlock();
    }
}
```

#### poll操作

获取并移除队头过期元素。

```java
public E poll() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        E first = q.peek();
        if (first == null || first.getDelay(NANOSECONDS) > 0) // 队列为空或队首元素未过期直接返回null
            return null;
        else
            return q.poll();
    } finally {
        lock.unlock();
    }
}
```

#### size操作

计算队列元素个数，包含过期的和没有过期的。

```java
public int size() {
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        return q.size();
    } finally {
        lock.unlock();
    }
}
```