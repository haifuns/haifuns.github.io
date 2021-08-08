title: 【Java 并发编程系列】：ThreadLocal
author: Haif.
tags:
  - 并发
categories:
  - 并发
date: 2020-12-26 17:46:00

---

## ThreadLocal

ThreadLocal 即线程本地变量，也就是如果创建了一个ThreadLocal变量，那么访问这个变量的每个线程都会有这个变量的一个本地副本。当多个线程操作这个变量时，实际操作的是自己本地内存里面的变量，从而避免了线程安全问题。

## ThreadLocal 实现原理

ThreadLocal 相关类类图如下：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/threadlocal-uml.png)

<!-- more -->

如图所示，Thread 类中有threadLocals 和inheritableThreadLocals 两个ThreadLocalMap 类型的变量，而ThreadLocalMap 是一个定制化的hash map。以ThreadLocal 为键，任意对象为值的存储结构。

ThreadLocal 相关源码分析如下：

* void set(T value)
```java
public void set(T value) {
    // 获取当前线程
    Thread t = Thread.currentThread();
    // 查找当前线程的线程变量threadLocals
    ThreadLocalMap map = getMap(t);
    if (map != null)
        // 查找到线程变量则设置
        map.set(this, value);
    else
        // 第一次调用创建当前线程对应的ThreadLocalMap
        createMap(t, value);
}

ThreadLocalMap getMap(Thread t) {
    return t.threadLocals;
}

void createMap(Thread t, T firstValue) {
    t.threadLocals = new ThreadLocalMap(this, firstValue);
}
```
* T get()
```java
public T get() {
    // 获取当前线程
    Thread t = Thread.currentThread();
    // 获得当前线程的threadLocals 变量
    ThreadLocalMap map = getMap(t);
    // threadLocals 不为空则返回对应本地变量值
    if (map != null) {
        ThreadLocalMap.Entry e = map.getEntry(this);
        if (e != null) {
            @SuppressWarnings("unchecked")
            T result = (T)e.value;
            return result;
        }
    }
    // threadLocals 为空则初始化当前线程的threadLocals 变量
    return setInitialValue();
}

private T setInitialValue() {
    // 初始化为null
    T value = initialValue();
    Thread t = Thread.currentThread();
    ThreadLocalMap map = getMap(t);
    // 设置当前线程threadLocals 为null
    if (map != null)
        map.set(this, value);
    else
        createMap(t, value);
    return value;
}

protected T initialValue() {
    return null;
}
```
* void remove()
```java
public void remove() {
    // 获得当前线程的threadLocals 变量
    ThreadLocalMap m = getMap(Thread.currentThread());
    if (m != null)
        // threadLocals 不为空则删除当前线程本地变量值
        m.remove(this);
}
```

需要注意的是：每个线程的本地变量存放在线程自己的内存变量threadLocals 中，如果当前线程一直不消亡， 那么这些本地变量会一直存在， 所以可能会造成内存溢出， 因此使用完毕后要记得调用ThreadLocal 的remove 方法删除对应线程的threadLocals 中的本地变量。

## Threadlocal 不支持继承性

首先看下面一个例子：
```java
public class ThreadLocalTest  {

      // 创建线程变量
      public static ThreadLocal<String> threadLocal = new ThreadLocal<>();

      public static void main(String[] args) {
            // 设置线程变量
            threadLocal.set("thread local");

            // 启用子线程
            Thread thread = new Thread(new Runnable() {
                  @Override
                  public void run() {
                        // 子线程输出线程变量
                        System.out.println("thread:" + threadLocal.get());
                  }
            });

            thread.start();

            // 主线程输出线程变量
            System.out.println("main:" + threadLocal.get());
      }
}
```
输出结果如下：
```
main:thread local
thread:null
```

同一个ThreadLocal 变量在父线程中被设置值后， 在子线程中是获取不到的。因为在子线程thread 里面调用get 方法时当前线程为thread 线程，而这里调用set 方法设置线程变量的是main 线程，两者是不同的线程，自然子线程访问时返回null。但是可以使用InheritableThreadLocal 让子线程能访问到父线程中的值。

## InheritableThreadLocal
源码如下：
```java
public class InheritableThreadLocal<T> extends ThreadLocal<T> {

    protected T childValue(T parentValue) {
        return parentValue;
    }

    ThreadLocalMap getMap(Thread t) {
       return t.inheritableThreadLocals;
    }

    void createMap(Thread t, T firstValue) {
        t.inheritableThreadLocals = new ThreadLocalMap(this, firstValue);
    }
}
```

InheritableThreadLocal 继承自ThreadLocal，并重写了其中的三个方法，那么当第一次调用set 方法时，创建的是当前线程inheritableThreadLocals 变量而不是threadLocals。get 方法获取到的也是inheritableThreadLocals。

那么InheritableThreadLocal 如何让子线程可以访问父线程的本地变量？这要从创建Thread 的代码说起，查看Thread 类的默认构造函数，部分源码如下：
```java
public Thread(Runnable target) {
    init(null, target, "Thread-" + nextThreadNum(), 0);
}

private void init(ThreadGroup g, Runnable target, String name,
                    long stackSize) {
    init(g, target, name, stackSize, null, true);
}

private void init(ThreadGroup g, Runnable target, String name,
                      long stackSize, AccessControlContext acc,
                      boolean inheritThreadLocals) {
        
    // ···

    // 获取当前线程
    Thread parent = currentThread();
        
    // ···
        
    // 如果父线程inheritableThreadLocals 变量不为null
    if (inheritThreadLocals && parent.inheritableThreadLocals != null)
        // 设置父线程inheritableThreadLocals 到子线程
        this.inheritableThreadLocals =
            ThreadLocal.createInheritedMap(parent.inheritableThreadLocals);
    // ···
        
}

static ThreadLocalMap createInheritedMap(ThreadLocalMap parentMap) {
    return new ThreadLocalMap(parentMap);
}

private ThreadLocalMap(ThreadLocalMap parentMap) {
    Entry[] parentTable = parentMap.table;
    int len = parentTable.length;
    setThreshold(len);
    table = new Entry[len];

    for (int j = 0; j < len; j++) {
        Entry e = parentTable[j];
        if (e != null) {
            @SuppressWarnings("unchecked")
            ThreadLocal<Object> key = (ThreadLocal<Object>) e.get();
            if (key != null) {
                // 调用重写的childValue
                Object value = key.childValue(e.value);
                Entry c = new Entry(key, value);
                int h = key.threadLocalHashCode & (len - 1);
                while (table[h] != null)
                    h = nextIndex(h, len);
                table[h] = c;
                size++;
            }
        }
    }
}
```

那么只需要把【Threadlocal 不支持继承性】章节测试代码中的线程变量修改为：
```java
public static ThreadLocal<String> threadLocal = new InheritableThreadLocal<>();
```
运行结果如下：
```
main:thread local
thread:thread local
```

使用场景：
* 子线程需要使用存放在threadlocal 变量中的用户登录信息
* 一些中间件需要把统一的id 追踪的整个调用链路记录下来
* ···

参考文献：
* Java并发编程之美
* Java并发编程的艺术