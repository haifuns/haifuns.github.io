title: 【JVM】：性能监控与故障处理工具
author: Haif.
tags:
  - JVM
categories:
  - JVM
date: 2020-12-26 17:23:00
copyright: true

---

## 基础故障处理工具

### jps：虚拟机进程状况工具

（JVM Process Status Tool），主要用来输出JVM中运行的进程状态信息。

语法格式：
```
jps [ options ] [ hostid ]
```

选项 | 作用
---|---
-q | 只输出进程id，省略主类信息
-m | 输出虚拟机进程启动时传递给主类main()函数的参数
-l | 输出主类全名，如果进程执行的是jar包，输出jar路径
-v | 输出虚拟机进程启动时的JVM参数

<!-- more -->

### jstat：虚拟机统计信息监视工具

（JVM Statistics Monitoring Tool），虚拟机统计监测工具，查看各个区域内存和GC情况。

语法格式：
```
jstat [ option vmid [interval[s|ms] [count]] ]
```
参数interval和count代表查询间隔和次数，如果省略这2个参数，说明只查询一次。

选项option可查询的虚拟机信息，主要分为三类：类加载、垃圾收集、运行期编译状况。
详细参考下表：

选项 | 作用
---|---
-class			  |	监视类加载、卸载数量、总空间以及类装载耗时。
-gc				  |	监视堆状况，包括Eden区、两个Survivor、老年代、永久代等的容量，已用时间，垃圾收集时间合计等信息。
-gccapacity		  |	（同-gc），输出各个区域最大、最小空间。
-gcutil			  |	（同-gc），输出已使用空间占总空间百分比。
-gccause		  |	（同-gcutil），输出上一次垃圾回收原因。
-gcnew			  |	监视新生代垃圾收集状况。
-gcnewcapacity	  |	（同-gcnew），输出最大、最小空间。
-gcold			  |	监视老年代垃圾收集状况。
-gcoldcapacity	  |	（同-gcnew），输出最大、最小空间。
-gcpermcapacity	  |	输出永生代最大、最小空间。
-compiler		  |	输出即时编译器编译过的方法、耗时等信息。
-printcompilation |	输出已经被即时编译的方法。

### jinfo：Java配置信息工具

（Configuration Info for Java），实时查看和调整虚拟机各项参数。

语法格式：
```
jinfo [ option ] pid
```

选项 | 作用
---|---
-flag  | 输出指定args参数的值
-flags | 不需要args参数，输出所有JVM参数的值
-sysprops | 输出系统属性，等同于System.getProperties()


### jmap：Java内存映像工具

（Memory Map for Java），用来查看堆内存使用情况。

语法格式：
```
jmap [ option ] vmid
```

选项 | 作用
---|---
-dump | 生成Java堆转储快照，格式为-dump:[live,]format=b,file=<filename>，其中live子参数说明是否只dump出存活的对象
-finalizerinfo | 显示在F-Queue中等待Finalizer线程执行finalize方法的对象。只在Linux/Solaris平台下有效
-heap | 显示Java堆详细信息，如使用哪种回收器、参数配置、分代状况等，只在Linux/Solaris平台下有效
-histo | 显示堆中对象统计信息，包括类、实例数量、合集容量
-permstat | 以ClassLoader为统计口径显示永久代内存状态，只在Linux/Solaris平台下有效
-F | -dump无响应时强制生成dump快照，只在Linux/Solaris平台下有效

### jhat：虚拟机堆转储快照分析工具

（JVM Heap Analysis Tool），与jmap搭配使用，用来分析jmap生成的堆转储快照。

### jstack：Java堆栈跟踪工具

（Stack Trace for Java），主要用来查看Java进程内的线程堆栈信息。

语法格式：
```
jstack [ option ] vmid
```

选项 | 作用
---|---
-F | 当正常输出的请求不被响应时，强制输出线程堆栈
-l | 除堆栈外，显示关于锁的附加信息
-m | 如果调用到本地方法，可以显示C/C++的堆栈

## 可视化故障处理工具

* [JConsole：Java监视与管理控制台](https://docs.oracle.com/javase/8/docs/technotes/guides/troubleshoot/tooldescr009.html)

* [VisualVM：多合-故障处理工具](http://visualvm.github.io/)
```
开启 JFR 收集: 由于JFR是商用的，所以需要解锁Java程序的商业feature:
-XX:+UnlockCommercialFeatures -XX:+FlightRecorder # JDK 1.8u40之前版本，需再jvm启动前添加参数

# 检查标志位 
jcmd <pid> VM.unlock_commercial_features

# JDK 1.8u40之后版本，不需要在启动的时候通过flag来解锁了，可以动态的解锁
jcmd <pid> VM.check_commercial_features
jcmd <pid> JFR.start delay=10s duration=1m filename=xxx.jfr
```
* [Java Mission Control：可持续在线的监控工具](https://www.oracle.com/java/technologies/jdk-mission-control.html)