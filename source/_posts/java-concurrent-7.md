title: 【Java 并发编程系列】【J.U.C】：Atomic
author: Haif.
tags:
  - 并发
categories:
  - 并发
date: 2020-12-26 17:47:00

---

## 概述

JUC 包提供了Atomiclnteger 、AtomicLong 和AtomicBoolean等原子性操作类，这些类都是使用非阻塞算法CAS 实现的，相比使用锁实现原子性操作这在性能上有很大提高。原子性操作类的原理大致相同，本文只对AtomicLong 类的实现原理以及JDK 8 中新增的LongAdder 和 LongAccumulator 类的原理讲解。

<!-- more -->

## AtomicLong

###  实现原理

AtomicLong 是原子性递增或者递减类，其内部使用Unsafe 来实现，相关源码如下：
```java
public class AtomicLong extends Number implements java.io.Serializable {
    private static final long serialVersionUID = 1927816293512124184L;

    // 获取Unsafe实例
    private static final Unsafe unsafe = Unsafe.getUnsafe();
    // 存放变量value的偏移量
    private static final long valueOffset;
    // 判断JVM是否支持Long类型无锁CAS
    static final boolean VM_SUPPORTS_LONG_CAS = VMSupportsCS8();
    
    static {
        try {
            // 获取value在AtomicLong中的偏移量
            valueOffset = unsafe.objectFieldOffset
                (AtomicLong.class.getDeclaredField("value"));
        } catch (Exception ex) { throw new Error(ex); }
    }
    
    // 实际变量值
    private volatile long value;

    public AtomicLong(long initialValue) {
        value = initialValue;
    }
}
```

#### 递增和递减操作
```java
// 调用unsafe方法，原子性设置value值为原始值 + 1， 返回值为原始值
public final long getAndIncrement() {
    return unsafe.getAndAddLong(this, valueOffset, 1L);
}

// 调用unsafe方法，原子性设置value值为原始值 - 1，返回值为原始值
public final long getAndDecrement() {
    return unsafe.getAndAddLong(this, valueOffset, -1L);
}

// 调用unsafe 方法， 原子性设置value值为原始值 + l，返回值为递增后的值
public final long incrementAndGet() {
    return unsafe.getAndAddLong(this, valueOffset, 1L) + 1L;
}

// 调用unsafe方法，原子性设置value值为原始值 - 1，返回值为递减之后的值
public final long decrementAndGet() {
    return unsafe.getAndAddLong(this, valueOffset, -1L) - 1L;
}
```

在如上代码内部都是通过调用Unsafe 的getAndAddLong 方法来实现操作，这个函数是个原子性操作，这里第一个参数是AtomicLong 实例的引用， 第二个参数是value 变量在AtomicLong 中的偏移值，第三个参数是要设置的第二个变量的值。

其中，getAndIncrement 方法在JDK 7 中的实现逻辑为:
```java
public final long getAndIncrement() {
    while (true) {
        long current= get();
        long next = current + l ;
        if (compareAndSet(current, next))
            return current ;
    }
}
```
上述代码中，每个线程先拿到变量的当前值（由于value 是volatile 变量，所以这里拿到的是最新的值），然后在工作内存中对其进行增1 操作，而后使用CAS修改变量的值。如果设置失败，则循环继续尝试，直到设置成功。

而在JDK 8中的实现逻辑为：
```java
public final long getAndIncrement() {
    return unsafe.getAndAddLong(this, valueOffset, 1L);
}
```

其中JDK 8 中unsafe.getAndAddLong 的代码为：
```java
public final long getAndAddLong(Object var1, long var2, long var4) {
    long var6;
    do {
        var6 = this.getLongVolatile(var1, var2);
    } while(!this.compareAndSwapLong(var1, var2, var6, var6 + var4));

    return var6;
}
```
JDK 7 AtomicLong 中的循环逻辑已经被JDK 8 中的原子操作类UNsafe 内置了，之所以内置应该是考虑到这个函数在其他地方也会用到，而内置可以提高复用性。

#### boolean compareAndSet(long expect, long update)

如果原子变量中的value 值等于expect，则使用update 值更新该值并返回true，否则返回false。

```java
public final boolean compareAndSet(long expect, long update) {
    return unsafe.compareAndSwapLong(this, valueOffset, expect, update);
}
```
## LongAdder

使用AtomicLong 时，在高并发下大量线程会同时去竞争更新同一个原子变量，但是由于同时只有一个线程的CAS 操作会成功，这就造成了大量线程竞争失败后，会通过无限循环不断进行自旋尝试CAS 的操作， 而这会白白浪费CPU 资源。为此JDK 8 新增了一个原子性递增或者递减类LongAdder 用来克服在高并发下使用AtomicLong 的缺点。

如下图所示，LongAdder 在内部维护多个Cell 变量，每个Cell 里面有一个初始值为0 的long 型变量，在同等并发量的情况下，争夺单个变量更新操作的线程量会减少，减少了争夺共享资源的并发量。另外，多个线程在争夺同一个Cell 原子变量时如果失败了， 它并不是在当前Cell 变量上一直自旋CAS 重试，而是尝试在其他Cell 的变量上进行CAS 尝试，这个改变增加了当前线程重试CAS 成功的可能性。在获取LongAdder 当前值时， 是把所有Cell 变量的value 值累加后再加上base 返回的。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/LongAddr.png)

LongAdder 维护了一个延迟初始化的原子性更新数组（默认情况下Cell 数组是null）和一个基值变量base。由于Cells 占用的内存是相对比较大的，所以一开始并不创建它，而是在需要时创建，也就是惰性加载。

当一开始判断Cell 数组是null 并且并发线程较少时，所有的累加操作都是对base 变量进行的。保持Cell 数组的大小为2 的N 次方，在初始化时Cell 数组中的Cell 元素个数为2 ，数组里面的变量实体是Cell 类型。Cell 类型是AtomicLong 的一个改进，用来减少缓存的争用，也就是解决伪共享问题（@sun.misc.Contended）。

### 实现原理

下面围绕以下话题从源码角度来分析LongAdder 的实现： 

1. LongAdder 的结构是怎样的？
2. 当前线程应该访问Cell 数组里面的哪一个Cell 元素？
3. 如何初始化Cell 数组？
4. Cell 数组如何扩容？
5. 线程访问分配的Cell 元素有冲突后如何处理？
6. 如何保证线程操作被分配的Cell 元素的原子性？

LongAdder 类图结构如下：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/LongAddr-uml.png)

LongAdder 类继承自Striped64 类，在Striped64 内部维护着三个变量。LongAdder 的真实值其实是base 的值与Cell 数组里面所有Cell 元素中的value 值的累加，base 是个基础值，默认为0 。cellsBusy 用来实现自旋锁，状态值只有0 和 1，当创建Cell 元素，扩容Cell 数组或者初始化Cell 数组时，使用CAS 操作该变量来保证同时只有一个线程可以进行其中之一的操作。

Cell 的构造如下：
```java
// 避免伪共享
@sun.misc.Contended static final class Cell {
    // 保证内存可见
    volatile long value;
    Cell(long x) { value = x; }
    final boolean cas(long cmp, long val) {
        return UNSAFE.compareAndSwapLong(this, valueOffset, cmp, val);
    }

    // Unsafe mechanics
    private static final sun.misc.Unsafe UNSAFE;
    private static final long valueOffset;
    static {
        try {
            UNSAFE = sun.misc.Unsafe.getUnsafe();
            Class<?> ak = Cell.class;
            valueOffset = UNSAFE.objectFieldOffset
                (ak.getDeclaredField("value"));
        } catch (Exception e) {
            throw new Error(e);
        }
    }
}
```
#### long sum()

内部操作是累加所有Cell 内部的value 值后累加base。但是由于计算总和没有对Cell 数组进行加锁，在累加过程中可能有其他线程对Cell 中的值进行了修改，也有可能对数组进行了扩容，所以sum 返回的值并不是非常精确的，其返回值并不是一个调用sum 方法时的原子快照值。
```java
public long sum() {
    Cell[] as = cells; Cell a;
    long sum = base;
    if (as != null) {
        for (int i = 0; i < as.length; ++i) {
            if ((a = as[i]) != null)
                sum += a.value;
        }
    }
    return sum;
}
```
#### void reset()

重置操作，把base 置为0，如果Cell 数组中有元素，则元素值重置为0
```java
public void reset() {
    Cell[] as = cells; Cell a;
    base = 0L;
    if (as != null) {
        for (int i = 0; i < as.length; ++i) {
            if ((a = as[i]) != null)
                a.value = 0L;
        }
    }
}
```
#### long sumThenReset()

sum 累加Cell 值后，把前一个Cell 值重置为0，base 重置为0，多线程存在问题。
```java
public long sumThenReset() {
    Cell[] as = cells; Cell a;
    long sum = base;
    base = 0L;
    if (as != null) {
        for (int i = 0; i < as.length; ++i) {
            if ((a = as[i]) != null) {
                sum += a.value;
                a.value = 0L;
            }
        }
    }
    return sum;
}
```
#### void add(long x)
```java
public void add(long x) {
    Cell[] as; long b, v; int m; Cell a;
    // 如果cells不为null继续执行，如果cells为空，则在base上累加，类似AtomicLong 
    if ((as = cells) != null || !casBase(b = base, b + x)) { 
        boolean uncontended = true;
        if (as == null || (m = as.length - 1) < 0 ||
            (a = as[getProbe() & m]) == null || // 前面的条件决定当前线程应该访问cells数组中的哪一个元素（m是当前cells数组元素个数-1，getProbe()用于获取当前线程变量threadlocalRandomProbe）
            !(uncontended = a.cas(v = a.value, v + x))) // 如果当前线程映射的元素存在， 使用CAS更新Cell元素值
            longAccumulate(x, null, uncontended); 
    }
}
    
final boolean casBase(long cmp, long val) {
    return UNSAFE.compareAndSwapLong(this, BASE, cmp, val);
}
```
#### cells 数组初始化和扩容
```java
final void longAccumulate(long x, LongBinaryOperator fn,
                          boolean wasUncontended) {
    // 初始化当前线程变量threadLocalRandomProbe的值（计算当前线程应分配到cells哪一个Cell元素用到）
    int h;
    if ((h = getProbe()) == 0) {
        ThreadLocalRandom.current(); // force initialization
        h = getProbe();
        wasUncontended = true;
    }
    boolean collide = false;                // True if last slot nonempty
    for (;;) {
        Cell[] as; Cell a; int n; long v;
        if ((as = cells) != null && (n = as.length) > 0) { // cells中有元素
            if ((a = as[(n - 1) & h]) == null) { // 当前线程应该访问cells数组的位置是空
                if (cellsBusy == 0) {       // Try to attach new Cell
                    Cell r = new Cell(x);   // Optimistically create
                    if (cellsBusy == 0 && casCellsBusy()) {
                        boolean created = false;
                        try {               // Recheck under lock
                            Cell[] rs; int m, j;
                            if ((rs = cells) != null &&
                                (m = rs.length) > 0 &&
                                rs[j = (m - 1) & h] == null) {
                                rs[j] = r;
                                created = true;
                            }
                        } finally {
                            cellsBusy = 0;
                        }
                        if (created)
                            break;
                        continue;           // Slot is now non-empty
                    }
                }
                collide = false;
            }
            else if (!wasUncontended)       // CAS already known to fail
                wasUncontended = true;      // Continue after rehash
            // 当前Cell存在则执行CAS设置
            else if (a.cas(v = a.value, ((fn == null) ? v + x :
                                         fn.applyAsLong(v, x))))
                break;
            // 当前Cell数组元素个数大于CPU个数
            else if (n >= NCPU || cells != as)
                collide = false;            // At max size or stale
            // 是否有冲突
            else if (!collide)
                collide = true;
            // 如果当前元素个数没有达到CPU个数并且有冲突则扩容
            else if (cellsBusy == 0 && casCellsBusy()) {
                try {
                    if (cells == as) {      // Expand table unless stale
                        // 扩容为之前的2倍
                        Cell[] rs = new Cell[n << 1];
                        for (int i = 0; i < n; ++i)
                            rs[i] = as[i];
                        cells = rs;
                    }
                } finally {
                    // 重置cellsBusy标识
                    cellsBusy = 0;
                }

                collide = false;
                continue;                   // Retry with expanded table
            }
            // 为了能找到一个空闲的Cell,重新计算hash值，xorshift算法生成随机数（问题5，对CAS失败的线程重新计算threadLocalRandomProbe以减少冲突）
            h = advanceProbe(h);
        }
        // 初始化Cell数组
        // cellsBusy标识，为0表示当前cells没有被初始化或扩容也没有在新建Cell元素；为1表示cells数组在被初始化或扩容或当前在创建新的Cell元素
        // casCellsBusy()通过CAS设置cellsBusy为1
        else if (cellsBusy == 0 && cells == as && casCellsBusy()) {
            boolean init = false;
            try {                           // Initialize table
                if (cells == as) {
                    // 初始化cells元素个数为2
                    Cell[] rs = new Cell[2];
                    // threadLocalRandomProbe & (数组元素个数-1) 计算当前线程应该访问cells数组的位置
                    rs[h & 1] = new Cell(x);
                    cells = rs;
                    init = true;
                }
            } finally {
                // 重置cellsBusy标识
                cellsBusy = 0;
            }
            if (init)
                break;
        }
        else if (casBase(v = base, ((fn == null) ? v + x :
                                    fn.applyAsLong(v, x))))
            break;                          // Fall back on using base
    }
}
```
## LongAccumulator

LongAdder 类是LongAccumulator 的一个特例， LongAccumulator 比LongAdder 的功能更强大，可以为累加器提供非0 的初始值，还可以指定累加规则，比如不进行累加而进行相乘。

LongAccumulator构造函数如下：
```java
public LongAccumulator(LongBinaryOperator accumulatorFunction,
                           long identity) {
    this.function = accumulatorFunction;
    base = this.identity = identity;
}
    
@FunctionalInterface
public interface LongBinaryOperator {
    long applyAsLong(long left, long right);
}
```
其中accumulatorFunction 是一个双目运算器接口，根据输入的两个参数返回一个计算值，identity 为LongAccumulator 累加器的初始值。

调用LongAdder 就相当于使用下面的方式调用LongAccumulator:
```java
LongAdder adder = new LongAdder();

LongAccumulator accumulator = new LongAccumulator(new LongBinaryOperator() {
	@Override
	public long applyAsLong(long left, long right) {
		return left + right;
	}
}, 0);
```
通过对比LongAccumulator 与LongAdder 累加操作，不同之处在于在调用casBase时，后者传递的时b+x，前者使用 function.applyAsLong(b = base, x)来计算。
```java
// LongAccumulator
public void accumulate(long x) {
    Cell[] as; long b, v, r; int m; Cell a;
    if ((as = cells) != null ||
        (r = function.applyAsLong(b = base, x)) != b && !casBase(b, r)) {
        boolean uncontended = true;
        if (as == null || (m = as.length - 1) < 0 ||
            (a = as[getProbe() & m]) == null ||
            !(uncontended =
                (r = function.applyAsLong(v = a.value, x)) == v ||
                a.cas(v, r)))
            longAccumulate(x, function, uncontended);
    }
}

final void longAccumulate(long x, LongBinaryOperator fn,
                              boolean wasUncontended) {
    int h;
    if ((h = getProbe()) == 0) {
        ThreadLocalRandom.current(); // force initialization
        h = getProbe();
        wasUncontended = true;
    }
    boolean collide = false;                // True if last slot nonempty
    for (;;) {
        Cell[] as; Cell a; int n; long v;
        if ((as = cells) != null && (n = as.length) > 0) {
            // ···
        }
        else if (cellsBusy == 0 && cells == as && casCellsBusy()) {
            // ···
        }
        else if (casBase(v = base, ((fn == null) ? v + x : // function为空默认使用v+x，等价于LongAdder，不为空使用自定义逻辑
                                        fn.applyAsLong(v, x)))) 
            break;                          // Fall back on using base
    }
}

// LongAdder
public void add(long x) {
    Cell[] as; long b, v; int m; Cell a;
    if ((as = cells) != null || !casBase(b = base, b + x)) {
        boolean uncontended = true;
        if (as == null || (m = as.length - 1) < 0 ||
            (a = as[getProbe() & m]) == null ||
            !(uncontended = a.cas(v = a.value, v + x)))
            longAccumulate(x, null, uncontended);
    }
}
```
