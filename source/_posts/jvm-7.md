title: 【JVM】：核心参数
author: HAIF.
tags:
  - JVM
categories:
  - JVM
date: 2021-02-10 23:42:00

---

* -Xms/-XX:InitialHeapSize ：初始堆大小，默认物理内存1/64
* -Xmx/-XX:MaxHeapSize ：最大堆大小，默认物理内存1/4
* -Xmn ：新生代大小
* -XX:PermSize/-XX:MetaspaceSize ：永久代大小
* -XX:MaxPermSize/-XX:MaxMetaspaceSize ：永久代最大大小
* -Xss ：每个线程的栈内存大小
* -XX:NewSize ：新生代大小
* -XX:MaxNewSize ：新生代最大大小
* -XX:NewRatio ：老年代与新生代比值，默认2即比值2:1
* -XX:SurvivorRatio ：eden区与survivor区比值，默认为8
* -XX:MaxTenuringThreshold ：对象晋升到老年代的GC次数阈值，默认为15
* -XX:PretenureSizeThreshold ：大对象直接晋升老年代的字节阈值
* -XX:HandlePromotionFailure ：设置空间分配担保，jdk1.6后已废弃
* -XX:SoftRefLRUPolicyMSPerMB ：设置软引用能跨越的GC周期
* -XX:+DisableExplicitGC ：禁止使用System.gc()手动触发GC
<!-- more -->
---
* -XX:+UseParNewGC ：使用ParNew作为新生代收集器
*  -XX:ParallelGCThreads ：并行GC线程数，默认为CPU核心数
---
* -XX:+UseConcMarkSweepGC ：使用CMS作为老年代收集器，Serial Old将作为CMS出错后的后备收集器
* -XX:CMSInitiatingOccupancyFraction ：CMS收集器在老年代空间被使用多少后触发回收，jdk1.6默认92%
* -XX:+UseCMSCompactAtFullCollection ：在Full GC后进行Stop The World，停止工作线程进行内存碎片整理，默认开启
* -XX:CMSFullGCsBeforeCompaction ：在执行多少次Full GC后执行碎片整理，默认0即每次Full GC都进行内存整理
* -XX:+CMSParallelInitialMarkEnabled ：CMS“初始标记”阶段多线程并发开关
* -XX:+CMSScavengeBeforeRemark ：CMS“重新标记”阶段之前尽量执行一次Young GC
* -XX:+CMSParallelRemarkEnabled : 手动配置开启CMS“并行标记”
---
* -XX:+UseG1GC ：使用G1收集器，jdk1.9后默认
* -XX:G1HeapRegionSize ：指定Region大小，取值范围1MB ~ 32MB，应为2的N次幂
* -XX:G1NewSizePercent ：G1新生代初始占比，默认5%
* -XX:G1MaxNewSizePercent ：G1新生代最大占比，默认60%
* -XX:MaxGCPauseMills ：G1目标停顿时间，默认200ms
* -XX:InitiatingHeapOccupancyLPercent ：G1老年代占比Region多少触发混合回收，默认45%
* -XX:G1MixedGCCountTarget ：G1混合回收中最后一个阶段执行混合垃圾回收的目标次数，默认8次
* -XX:G1HeapWastePercent ：空闲Region达到堆指定占比停止混合回收，默认5%
* -XX:G1MixedGCLiveThresholdPercent ：存活对象占比Region低于多少可以进行回收，默认85%
---
* -XX:+HeapDumpOnOutOfMemoryError ： OOM时自动生成dump文件
* -XX:HeapDumpPath ：指定dump导出路径
* -XX:+PrintGCDetails ：打印详细GC日志
* -XX:+PrintGCTimeStamps ：打印每次GC发生的时间
* -XX:+PrintHeapAtGC ：每次GC后打印堆信息
* -Xloggc:gc.log ：指定GC日志
* -XX:+TraceClassLoading ：追踪类加载输出到日志
* -XX:+TraceClassUnloading ：追踪类卸载输出到日志
