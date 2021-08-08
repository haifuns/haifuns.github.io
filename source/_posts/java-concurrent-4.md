title: 【Java 并发编程系列】【J.U.C】：ThreadLocalRandom
author: Haif.
tags:
  - 并发
categories:
  - 并发
date: 2020-12-26 17:47:30
---

## Random 类及其局限性

java.util.Random 是使用较为广泛的随机数生成工具类，使用方法如下：
```java
public class RandomTest {
    
    public static void main(String[] args) {

        // 创建一个默认种子的随机数生成器
        Random random = new Random() ;
        // 输出10个在0~5（包含0，不包含5）之间的随机数
        for (int i = 0; i < 10; i++) {
            System.out.println(random.nextInt(5));
        }
    }
}
```

<!-- more -->

Random 部分源码如下：
```java
public class Random implements java.io.Serializable {

    private final AtomicLong seed; // 种子原子变量
    
    public int nextInt(int bound) {
        if (bound <= 0) // 参数检查
            throw new IllegalArgumentException(BadBound);

        int r = next(31); // 根据老的种子生成新的种子
        
        ··· // 根据新的种子计算随机数
        
        return r;
    }
    
    protected int next(int bits) {
        long oldseed, nextseed;
        AtomicLong seed = this.seed;
        do {
            oldseed = seed.get(); // 获取当前原子变量种子值
            nextseed = (oldseed * multiplier + addend) & mask; // 根据当前种子值计算新的种子
        } while (!seed.compareAndSet(oldseed, nextseed)); // CAS 更新老的种子，失败循环更新
        return (int)(nextseed >>> (48 - bits)); // 使用固定算法根据新的种子计算随机数
    }
    
    ···
}
```
通过阅读源码不难发现，每个Random 实例里都有一个原子性的种子变量用来记录当前的种子值，当要生成新的随机数时需要根据当前种子计算新的种子并更新回原子变量。在多线程下使用单个Random 实例生成随机数时，当多个线程同时计算随机数来计算新的种子时，多个线程会竞争同一个原子变量的更新操作，由于原子变量的更新是CAS 操作，同时只有一个线程会成功，所以会造成大量线程进行自旋重试，这会降低并发性能，所以ThreadLocalRandom 应运而生。

## ThreadlocalRandom

为了弥补多线程高并发情况下Random 的缺陷， 在JUC 包下新增了ThreadLocalRandom类，使用方法如下：
```java
public class RandomTest {
    
    public static void main(String[] args) {

	// 获取一个随机数生成器
	ThreadLocalRandom random2 = ThreadLocalRandom.current();
	// 输出10个在0~5（包含0，不包含5）之间的随机数
	for (int i = 0; i < 10; i++) {
	      System.out.println(random.nextInt(5));
	}
    }
}
```
### 源码分析

#### Unsafe 机制
```java
private static final sun.misc.Unsafe UNSAFE;
private static final long SEED;
private static final long PROBE;
private static final long SECONDARY;
static {
    try {
        UNSAFE = sun.misc.Unsafe.getUnsafe(); // 获取unsafe实例
        Class<?> tk = Thread.class;
        SEED = UNSAFE.objectFieldOffset // 获取Thread类里面threadLocalSeed变量在Thread实例里面的偏移量
            (tk.getDeclaredField("threadLocalRandomSeed"));
        PROBE = UNSAFE.objectFieldOffset // 获取Thread类里面threadLocalRandomProbe变量在Thread实例里面的偏移量
            (tk.getDeclaredField("threadLocalRandomProbe"));
        SECONDARY = UNSAFE.objectFieldOffset // 获取Thread类里面threadLocalRandomSecondarySeed变量在Thread实例里面的偏移量
            (tk.getDeclaredField("threadLocalRandomSecondarySeed"));
    } catch (Exception e) {
        throw new Error(e);
    }
}
```

#### ThreadLocalRandom current() 方法
此方法获取ThreadLocalRandom 实例，并初始化调用线程中的threadLocalRandomSeed 和threadLocalRandomProbe 变量
```java
static final ThreadLocalRandom instance = new ThreadLocalRandom();

public static ThreadLocalRandom current() {
    if (UNSAFE.getInt(Thread.currentThread(), PROBE) == 0) // 当前线程threadLocalRandomProbe变量是否为0，判断是否第一次调用
        localInit(); 
    return instance; // 返回ThreadLocalRandom 实例
}

// 根据probeGenerator计算当前线程中的threadLocalRandomProbe初始值，
// 然后根据seeder计算当前线程初始种子，并设置到当前线程
static final void localInit() { 
    int p = probeGenerator.addAndGet(PROBE_INCREMENT);
    int probe = (p == 0) ? 1 : p; // skip 0
    long seed = mix64(seeder.getAndAdd(SEEDER_INCREMENT));
    Thread t = Thread.currentThread();
    UNSAFE.putLong(t, SEED, seed);
    UNSAFE.putInt(t, PROBE, probe);
}
```
#### int nextInt(int bound) 方法
计算当前线程下一个随机数
```java
public int nextInt(int bound) {
    if (bound <= 0) // 校验参数
        throw new IllegalArgumentException(BadBound);
    int r = mix32(nextSeed()); // 根据当前线程中的种子计算新种子
    
    ··· // 根据新种子和bound计算随机数

    return r;
}

// 首先使用r = UNSAFE.getLong(t, SEED) 获取当前线程中threadLocalRandomSeed 变量的值， 
// 然后在种子的基础上累加GAMMA 值作为新种子，
// 而后使用UNSAFE.putLong 方法把新种子放入当前线程的threadLocalRandomSeed 变量中。
final long nextSeed() {
    Thread t; long r; // read and update per-thread seed
    UNSAFE.putLong(t = Thread.currentThread(), SEED,
                   r = UNSAFE.getLong(t, SEED) + GAMMA);
    return r;
}
```

### 总结
ThreadLocalRandom 使用ThreadLocal 的原理，让每个线程都持有一个本地的种子变量，该种子变量只有在使用随机数时才会被初始化。在多线程下计算新种子时是根据自己线程内维护的种子变量进行更新，从而避免了竞争。