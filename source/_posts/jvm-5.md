title: 【JVM】：高效并发
author: Haif.
tags:
  - JVM
categories:
  - JVM
date: 2020-12-26 17:22:00
copyright: true

---

## Java内存模型

内存模型: 在特定的操作协议下，对特定的内存或高速缓存进行读写访问的过程抽象。

Java内存模型主要关注在虚拟机中把变量值存储到内存和从内存中取出变量值这样的底层细节。

### 主内存与工作内存

Java内存模型规定：
* 所有的变量都存储在主内存（Main Memory）中。每条线程还有自己的工作内存（Working Memory），线程的工作内存中保存了被该线程使用的变量的主内存副本。
* 线程对变量的所有操作（读取、赋值等）都必须在工作内存中进行，而不能直接读写主内存中的数据。
* 不同的线程之间也无法直接访问对方工作内存中的变量，线程间变量值的传递均需要通过主内存来完成。

<!-- more -->

线程、主内存、工作内存三者的交互关系如图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/jvm/JavaMemoryModel.png)

这里所讲的主内存、工作内存与Java内存区域中的Java堆、栈、方法区等并不是同一个层次的对内存的划分，这两者基本上是没有任何关系的。

### 内存间的交互操作

Java内存模型定义了8种操作来实现内存间交互，Java虚拟机实现时必须保证下面提及的每一种操作都是原子的、不可再分的（对于double和long类型的变量来说，load、store、read和write操作在某些平台上允许有例外）。

- lock（锁定）：作用于主内存变量，把变量标识为线程独占。
- unlock（解锁）：作用于主内存变量，把处于锁定状态的变量释放，释放后的变量可以被其他线程锁定。
- read（读取）：作用于主内存的变量，把变量值从主内存传输到线程工作内存中。
- load（载入）：作用于工作内存的变量，把read操作从主内存中得到的变量值放入工作内存的变量副本中。
- use（使用）：作用于工作内存的变量，把工作内存中变量的值传递给执行引擎，每当虚拟机遇到一个需要使用变量的值的字节码指令时将会执行这个操作。
- assign（赋值）：作用于工作内存的变量，把从执行引擎接收的值赋给工作内存的变量，每当虚拟机遇到给变量赋值的字节码指令时执行这个操作。
- store（存储）：作用于工作内存的变量，把工作内存中变量的值传送到主内存中。
- write（写入）：作用于主内存的变量，把store操作从工作内存中得到的变量的值放入主内存的变量中。

内存间的交互操作如下图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/jvm/MemoryInteraction.png)

### 内存间的交互操作规则

Java内存模型还规定了在执行上述8种基本操作时必须满足如下规则：

- 不允许read和load、store和write操作之一单独出现，即不允许一个变量从主内存读取了但工作内存不接受，或者工作内存发起回写了但主内存不接受的情况出现。以上两个操作必须按顺序执行，但是不保证连续执行，其间可以插入其他指令。
- 不允许一个线程丢弃它最近的assign操作，即变量在工作内存中改变了之后必须把该变化同步回主内存。
- 不允许一个线程无原因地（没有发生过任何assign操作）把数据从线程的工作内存同步回主内存中。
- 一个新的变量只能在主内存中“诞生”，不允许在工作内存中直接使用一个未被初始化（load或assign）的变量，换句话说就是对一个变量实施use、store操作之前，必须先执行assign和load操作。
- 一个变量在同一个时刻只允许一条线程对其进行lock操作，但lock操作可以被同一条线程重复执行多次，多次执行lock后，只有执行相同次数的unlock操作，变量才会被解锁。
- 如果对一个变量执行lock操作，那将会清空工作内存中此变量的值，在执行引擎使用这个变量前，需要重新执行load或assign操作以初始化变量的值。
- 如果一个变量事先没有被lock操作锁定，那就不允许对它执行unlock操作，也不允许去unlock一个被其他线程锁定的变量。
- 对一个变量执行unlock操作之前，必须先把此变量同步回主内存中（执行store、write操作）。

### volatile型变量的特殊规则

关键字volatile可以说是Java虚拟机提供的最轻量级的同步机制，volatile修饰的变量具备两项特性：

* 保证此变量对所有线程的可见性。即对volatile变量所做的写操作能立刻反应到其他线程中。volatile修饰的变量在多线程环境下仍然是不安全的。
* volatile禁止指令重排序。

volatile变量只能保证可见性，在不符合以下两条规则的运算场景中，我们仍然要通过加锁
（使用synchronized、java.util.concurrent中的锁或原子类）来保证原子性：
- 运算结果不依赖变量的当前值，或者能确保只有一个线程修改变量的值。
- 变量不需要与其他的状态变量共同参与不变约束。

### long和double型变量的特殊规则

Java内存模型要求内存间交互的八种操作都具有原子性，但是对于64位的数据类型（long和double），允许虚拟机将没有被volatile修饰的64位数据的读写操作划分为两次32位的操作来进行，即允许虚拟机实现自行选择是否要保证64位数据类型的load、store、read和write这四个操作的原子性，这就是所谓的“long和double的非原子性协定”。

### 指令重排序

指令重排序是指JVM为了优化，在条件允许的情况下，对指令进行一定的重新排序，直接运行当前能够立刻执行的后续指令，避开获取下一条指令所需数据造成的等待。

不是所有的指令都能重排，比如：
 - 写后读，a = 1; b = a; 写一个变量后再读这个位置。
 - 写后写，a = 1; a = 2; 写一个变量后，再写这个变量。
 - 读后写，a = b; b = 1; 读一个变量后，再写这个变量。

指令重排序基本原则：
* 程序顺序原则：一个线程内保证语义串行性
* volatile规则：volatile变量的写先发生于读
* 锁规则：解锁（unlock）必然发生在随后的加锁（lock）前
* 传递性：操作A先于操作B，操作B先于操作C 那么操作A必然先于操作C
* 线程启动规则：线程的start方法先于它的每一个动作
* 线程终止规则：线程的所有操作先于线程的终结（Thread.join()）
* 线程中断规则：线程的中断（interrupt()）先于被中断的代码
* 对象终结规则：对象的构造函数执行结束先于finalize()方法

### 原子性、可见性与有序性

#### 原子性（Atomicity）

由Java内存模型来直接保证的原子性变量操作包括read、load、assign、use、store和write这六个，我们大致可以认为，基本数据类型的访问、读写都是具备原子性的（例外就是long和double的非原子性协定）。

#### 可见性（Visibility）

可见性就是指当一个线程修改了共享变量的值时，其他线程能够立即得知这个修改。

保证可见性的常见方法：volatile、synchronized、final（一旦初始化完成，其他线程可见）

#### 有序性（Ordering）

如果在本线程内观察，所有的操作都是有序的；如果在一个线程中观察另一个线程，所有的操作都是无序的。前半句是指“线程内似表现为串行的语义”（Within-Thread As-If-SerialSemantics），后半句是指“指令重排序”现象和“工作内存与主内存同步延迟”现象。

## 线程

### 线程实现

实现线程主要有三种方式：使用内核线程实现（1：1实现），使用用户线程实现（1：N实现），使用用户线程加轻量级进程混合实现（N：M实现）。

#### 内核线程实现

使用内核线程实现的方式也被称为1：1实现。内核线程（Kernel-Level Thread，KLT）就是直接由操作系统内核（Kernel）支持的线程，这种线程由内核来完成线程切换，内核通过操纵调度器（Scheduler）对线程进行调度，并负责将线程的任务映射到各个处理器上。每个内核线程可以视为内核的一个分身，这样操作系统就有能力同时处理多件事情，支持多线程的内核就称为多线程内核（Multi-Threads Kernel）。

程序一般不会直接使用内核线程，而是使用内核线程的一种高级接口——轻量级进程（Light Weight Process，LWP），轻量级进程就是通常意义上所讲的线程，由于每个轻量级进程都由一个内核线程支持，因此只有先支持内核线程，才能有轻量级进程。这种轻量级进程与内核线程之间1：1的关系称为一对一的线程模型，如图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/jvm/KLT-Thread.png)

由于内核线程的支持，每个轻量级进程都成为一个独立的调度单元，即使其中某一个轻量级进程在系统调用中被阻塞了，也不会影响整个进程继续工作。

局限性：
* 由于是基于内核线程实现的，各种线程操作，如创建、析构及同步，都需要进行系统调用。而系统调用的代价相对较高，需要在用户态（User Mode）和内核态（Kernel Mode）中来回切换。
* 每个轻量级进程都需要有一个内核线程的支持，因此轻量级进程要消耗一定的内核资源（如内核线程的栈空间），因此一个系统支持轻量级进程的数量是有限的。

#### 用户线程实现

使用用户线程实现的方式被称为1：N实现。狭义上，用户线程指的是完全建立在用户空间的线程库上，系统内核不能感知到用户线程的存在及如何实现的。用户线程的建立、同步、销毁和调度完全在用户态中完成，不需要内核的帮助。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/jvm/UT-Thread.png)

- 优势：不需要切换到内核态，操作快速、低消耗，支持大规模线程数。
- 劣势：没有系统内核支援，线程操作需要用户自行处理，实现复杂。

#### 用户线程加轻量级进程混合实现

将内核线程与用户线程一起使用的实现方式，被称为N：M实现。在这种混合实现下，既存在用户线程，也存在轻量级进程。

用户线程还是完全建立在用户空间中，因此用户线程的创建、切换、析构等操作依然廉价，并且可以支持大规模的用户线程并发。而操作系统支持的轻量级进程则作为用户线程和内核线程之间的桥梁，这样可以使用内核提供的线程调度功能及处理器映射，并且用户线程的系统调用要通过轻量级进程来完成，这大大降低了整个进程被完全阻塞的风险。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/jvm/MN-Thread.png)

### 线程调度

线程调度是指系统为线程分配处理器使用权的过程，调度主要方式有两种，分别是协同式（Cooperative Threads-Scheduling）线程调度和抢占式（Preemptive Threads-Scheduling）线程调度。

#### 协同式线程调度

线程的执行时间由线程本身来控制，线程把自己的工作执行完了之后，要主动通知系统切换到另外一个线程上去。

* 优点：实现简单，一般没有线程同步问题。Lua语言中的“协同例程”就是这类实现。
* 缺点：线程执行时间不可控制，有可能造成程序一直阻塞。

#### 抢占式线程调度

每个线程将由系统来分配执行时间，线程的切换不由线程本身来决定。例如，Java中Thread::yield()方法可以主动让出执行时间，但是如果想要主动获取执行时间，线程本身是没有什么办法的。

Java语言一共设置了10个级别的线程优先级（Thread.MIN_PRIORITY至Thread.MAX_PRIORITY）。在两个线程同时处于Ready状态时，优先级越高的线程越容易被系统选择执行。主流虚拟机上的Java线程被映射到系统的原生线程上来实现的，线程调度最终还是由操作系统说了算，线程优先级并不能保证稳定调节。

### 线程状态转换

Java语言定义了6种线程状态，在任意一个时间点中，一个线程只能有且只有其中的一种状态，并且可以通过特定的方法在不同状态之间转换。这6种状态分别是：

* 新建（New）：创建后尚未启动。
* 运行（Runnable）：包括操作系统线程状态中的Running和Ready，线程正在执行或等待操作系统为其分配执行时间。
* 无限期等待（Waiting）：等待被其他线程显式唤醒，不会被分配处理器执行时间。以下方法会让线程陷入无限期的等待状态：
    - 没有设置Timeout参数的Object::wait()方法；
    - 没有设置Timeout参数的Thread::join()方法；
    - LockSupport::park()方法。
* 限期等待（Timed Waiting）：无须等待被其他线程显式唤醒，在一定时间之后由系统自动唤醒。以下方法会让线程进入限期等待状态：
    - Thread::sleep()方法；
    - 设置了Timeout参数的Object::wait()方法；
    - 设置了Timeout参数的Thread::join()方法；
    - LockSupport::parkNanos()方法；
    - LockSupport::parkUntil()方法。
* 阻塞（Blocked）：线程被阻塞，“阻塞状态”与“等待状态”的区别是“阻塞状态”在等待着获取到一个排它锁，这个事件将在另外一个线程放弃这个锁的时候发生；而“等待状态”则是在等待一段时间，或者唤醒动作的发生。在程序等待进入同步区域的时候，线程将进入这种状态。
* 结束（Terminated）：线程已结束执行。

线程状态转换关系如图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/jvm/Thread-status.png)

## 线程安全

Java线程安全的处理方法：

1. 不可变的对象一定是线程安全的。
2. 互斥同步（阻塞同步）：synchrized/java.util.concurrent.ReentrantLock。目前两者性能相差不大，建议优先选用synchrized，ReentrantLock增加了如下特性：
    - 等待可中断：当持有锁的线程长期不释放锁，正在等待的线程可以选择放弃等待。
    - 公平锁：多个线程在等待同一个锁时，必须按照申请锁的时间顺序来依次获得锁；而非公平锁则不保证这一点。
    - 一个ReentrantLock对象可以同时绑定多个Condition对象。而synchronized是针对一个条件的，如果要多个就需要有多个锁。
3. 非阻塞同步： 基于冲突检查的乐观锁定策略，通常是先进行操作，如果没有冲突，操作就直接成功；如果共享数据被争用产生冲突，再进行其他补偿措施，最常用的补偿措施是不断地重试，直到出现没有竞争的共享数据为止。
4. 无同步方案：在多线程中，方法并不涉及共享数据，自然也就无需同步。

## 锁优化

### 自旋锁与自适应自旋

* 自旋：如果线程可以很快获得锁，那么可以不在OS层挂起线程，而是让线程做几个忙循环。
* 自适应自旋：自旋的时间不再固定，而是由前一次在同一个锁上的自旋时间和锁的拥有者决定。

自旋等待不能代替阻塞，自旋等待虽然避免了线程切换的开销，但是要占用处理器时间，所以如果锁被占用的时间很短，自旋等待的效果就会非常好，反之如果锁被占用的时间很长，那么自旋的线程只会白白消耗处理器资源，这就会带来性能的浪费。

### 锁消除

虚拟机即时编译器在运行时，对一些代码要求同步，但是对被检测到不可能存在共享数据竞争的锁进行消除。锁消除的主要判定依据来源于逃逸分析的数据支持。

通过-XX:+EliminateLocks开启锁消除。同时使用-XX:+DoEscapeAnalysis开启逃逸分析。

逃逸分析：

- 如果一个方法中定义的一个对象，可能被外部方法引用，称为方法逃逸。
- 如果对象可能被其他外部线程访问，称为线程逃逸。比如赋值给类变量或者在其他线程中访问的实例变量。

### 锁粗化

原则上，推荐将同步块的作用范围限制得尽量小，即只在共享数据的实际作用域中才进行同步，这样是为了使得需要同步的操作数量尽可能变少，即使存在锁竞争，等待锁的线程也能尽可能快地拿到锁。

大多数情况下，上面的原则都是正确的，但是如果一系列的连续操作都对同一个对象反复加锁和解锁，甚至加锁操作是出现在循环体之中的，那即使没有线程竞争，频繁地进行互斥同步操作也会导致不必要的性能损耗，这种情况建议把锁同步的范围扩大到整个操作序列。

### 轻量级锁

“轻量级”是相对于使用操作系统互斥量来实现的传统锁而言，设计初衷是在没有多线程竞争的前提下，减少传统的重量级锁使用操作系统互斥量产生的性能消耗。

先进行回忆HotSpot虚拟机对象的内存布局（尤其是对象头部分）：
![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/jvm/markword.png)

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

偏向锁目的是消除数据在无竞争情况下的同步，从而提高性能。如果说轻量级锁是在无竞争的情况下使用CAS操作去消除同步使用的互斥量，那偏向锁就是在无竞争的情况下把整个同步都消除掉，连CAS操作都不去做。

#### 加锁过程

* 当锁对象第一次被线程获取时，虚拟机将会把对象头中的标志位设置为“01”、把偏向模式设置为“1”，表示进入偏向模式。
* 同时使用CAS操作把获取到这个锁的线程的ID记录在对象的Mark Word之中。
* 如果CAS操作成功，持有偏向锁的线程以后每次进入这个锁相关的同步块时，虚拟机都可以不再进行任何同步操作（例如加锁、解锁及对Mark Word的更新操作等）。

#### 解锁过程

当有其他线程请求相同锁时，偏向模式结束。根据锁对象目前是否处于被锁定的状态决定是否撤销偏向（偏向模式设置为“0”），撤销后标志位恢复到未锁定（标志位为“01”）或轻量级锁定（标志位为“00”）的状态。

> 如果程序中大多数锁总是被多个线程访问的时候，也就是竞争比较激烈，偏向锁反而会降低性能。使用参数-XX:-UseBiasedLocking 禁止偏向锁，默认开启。

### JVM中获取锁的步骤

* 先尝试偏向锁
* 然后尝试轻量级锁
* 再尝试自旋锁
* 最后尝试普通锁，使用OS互斥量在操作系统层挂起

### 同步代码的基本规则

* 尽量减少锁持有时间
* 尽量减少锁的粒度
