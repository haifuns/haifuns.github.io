title: 【Java 并发编程系列】：深入剖析volatile关键字
author: Haif.
tags:
  - 并发
categories:
  - 并发
date: 2020-12-26 17:41:00

---

## 语义

volatile关键字是Java虚拟机提供的最轻量级的同步机制，volatile修饰的变量具备两个特性：

1. 保证此变量对所有线程的可见性。
2. 禁止指令重排序优化。

<!-- more -->

## 实现原理

### 可见性

#### 加锁如何解决可见性问题？

因为某一个线程进入synchronized代码块前后，线程会获得锁，清空工作内存，从主内存拷贝共享变量最新的值到工作内存成为副本，执行代码，将修改后的副本的值刷新回主内存中，线程释放锁。

而获取不到锁的线程会阻塞等待，所以变量的值肯定一直都是最新的。

#### volatile如何解决可见性问题？

每个线程操作数据的时候会把数据从主内存读取到自己的工作内存，如果操作了数据并且写回主内存，则其他线程已经读取的变量副本就会失效，需要再次去主内存中读取。

由于volatile变量只能保证可见性，在不符合以下两条规则的运算场景中，仍然要通过加锁（使用synchronized、java.util.concurrent中的锁或原子类）来保证原子性：

* 运算结果并不依赖变量的当前值，或者能够确保只有单一的线程修改变量的值。
* 变量不需要与其他的状态变量共同参与不变约束。

### 指令重排序

#### 指令重排序

为了提高性能，编译器和处理器常常会对既定的代码执行顺序进行指令重排序。一般重排序可以分为如下三种：

* 编译器优化的重排序。编译器在不改变单线程程序语义的前提下，可以重新安排语句的执行顺序。

* 指令级并行的重排序。现代处理器采用了指令级并行技术来将多条指令重叠执行。如果不存在数据依赖性，处理器可以改变语句对应机器指令的执行顺序。

* 内存系统的重排序。由于处理器使用缓存和读/写缓冲区，这使得加载和存储操作看上去可能是在乱序执行的。

但是不管怎么重排序，单线程下的执行结果不能被改变。编译器、runtime和处理器都必须遵守as-if-serial语义。

#### volatile如何禁止指令重排序？

下面是一段标准的双锁检测（Double Check Lock，DCL）单例代码，通过观察加入volatile
和未加入volatile关键字时所生成的汇编代码的差别（如何获得即时编译的汇编代码？请参考附录关于HSDIS插件的介绍）。

```java
public class Singleton {

    private volatile static Singleton instance;

    private Singleton() {
    }

    public static Singleton getInstance() {
        if (instance == null) {
	    synchronized (Singleton.class) {
		if (instance == null) {
		    instance = new Singleton();
		}
	    }
	}
	return instance;
    }
}
```
通过对比发现，关键变化在于有volatile修饰的变量，赋值后多执行了一个` “lock addl $0x0,(%rsp)” `操作，

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/volatile01.png)

这个操作的作用相当于一个内存屏障
（Memory Barrier或Memory Fence，指令重排序时不能把后面的指令重排序到内存屏障之前的位置）。

IA-32架构软件开发者手册中规定，Lock前缀的指令在多核处理器下会引发了两件事情：

1. 将当前处理器缓存行的数据写回到系统内存。
2. 这个写回内存的操作会使在其他CPU里缓存了该内存地址的数据无效。

为了提高处理速度，处理器不直接和内存进行通信，而是先将系统内存的数据读到内部缓存（L1，L2或其他）后再进行操作，但操作完不知道何时会写到内存。

如果对声明了volatile的变量进行写操作，JVM就会向处理器发送一条Lock前缀的指令，将这个变量所在缓存行的数据写回到系统内存。

在多处理器下，为了保证各个处理器的缓存是一致的，就会实现`缓存一致性协议`，每个处理器通过`嗅探`在总线上传播的数据来检查自己缓存的值是不是过期了，当处理器发现自己缓存行对应的内存地址被修改，就会将当前处理器的缓存行设置成无效状态，当处理器对这个数据进行修改操作的时候，会重新从系统内存中把数据读到处理器缓存里。

**由此可见，Java编译器会在生成指令系列时在适当的位置插入`内存屏障`指令来禁止特定类型的处理器重排序。**

JMM针对编译器制定volatile重排序规则表：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/volatile.png)

需要注意的是：volatile写是在前面和后面分别插入内存屏障，而volatile读操作是在后面插入两个内存屏障。

* 写操作：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/volatile02.png)

* 读操作：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/volatile03.png)

## 使用场景

### 解决单例双重检查对象初始化代码执行乱序问题

创建对象步骤：

* 分配内存空间
* 调用构造器，初始化实例
* 返回地址给引用

对象创建过程有可能发生指令重排序：在内存里面开辟了一片存储区域后直接返回内存的引用，这个时候还没真正的初始化完对象，因而发生异常。使用volatile禁止指令重排可解决。

## 补充

### 总线风暴

由于volatile的MESI缓存一致性协议，不断从主内存嗅探和cas不断循环，无效交互会导致总线带宽达到峰值，造成其他的功能通信的延迟。所以根据场景使用volatile或锁。

### volatile与synchronized的区别

* volatile只能修饰实例变量和类变量，而synchronized可以用在变量、方法、类、以及代码块。
* volatile保证数据的可见性，但是不保证原子性(多线程进行写操作，不保证线程安全); 而synchronized是一种排他(互斥)的机制，保证变量的修改可见性和原子性。
* volatile不会造成线程阻塞。synchronized可能会造成线程阻塞。
* volatile可以看做是轻量版的synchronized，volatile不保证原子性，但是如果是对一个共享变量进行多个线程的赋值，而没有其他的操作，那么就可以用volatile来代替synchronized，因为赋值本身是有原子性的，而volatile又保证了可见性，可以保证线程安全。

## 附录

### HSDIS 反汇编插件

虚拟机提供了一组通用的反汇编接口，可以接入各种平台下的反汇编适配器，64位x86平台选用hsdis-amd64，下载后将其放置在JAVA_HOME/lib/amd64/server下，只要与jvm.dll或libjvm.so的路径相同即可被虚拟机调用。为虚拟机安装反汇编适配器后，就可以使用-XX:+PrintAssembly参数要求虚拟机打印编译方法的汇编代码。

1. 下载[hsdis-amd64.dll](https://files.cnblogs.com/files/haif/hsdis-amd64.zip)放到JRE_HOME/bin/server路径下
2. 添加虚拟机参数 `-server -Xcomp -XX:+UnlockDiagnosticVMOptions -XX:+PrintAssembly -XX:CompileCommand=compileonly,*Singleton.*`并启动

参考文献：

* 《深入理解Java虚拟机：JVM高级特性与最佳实践（第3版）》
* 《Java并发编程的艺术》
* [The JSR-133 Cookbook for Compiler Writers](http://gee.cs.oswego.edu/dl/jmm/cookbook.html)
* [面试官没想到一个Volatile，我都能跟他扯半小时](https://www.cnblogs.com/aobing/p/12840913.html)
