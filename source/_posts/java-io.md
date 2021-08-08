title: 【Java I/O】BIO、NIO、AIO
author: Haif.
tags:
  - Java IO
categories:
  - Java
date: 2020-12-26 17:26:00
copyright: true

---

## I/O 模型

### BIO

BIO 就是传统的`java.io`包，**同步并阻塞**，基于流模型实现，在读入输入流或者输出流时，在读写动作完成之前，线程会一直阻塞。

* 优点是代码比较简单、直观
* 缺点是效率和扩展性很低，容易成为应用性能瓶颈

### NIO

NIO 是*Java 1.4*引入的`java.nio`包，**同步非阻塞**，提供了 Channel、Selector、Buffer 等新的抽象，可以构建多路复用的、同步非阻塞 IO 程序，同时提供了更接近操作系统底层高性能的数据操作方式。

### AIO

AIO 是*Java 1.7*之后引入的包，是 NIO 的升级版本，**异步非阻塞**，（Asynchronous IO），异步 IO 是基于事件和回调机制实现的，也就是应用操作之后会直接返回，不会堵塞在那里，当后台处理完成，操作系统会通知相应的线程进行后续的操作。

<!-- more -->

## BIO、NIO、AIO 适用场景分析

* BIO 方式适用于连接数目比较小且固定的架构，这种方式对服务器资源要求比较高，并发局限于应用中，JDK1.4 以前的唯一选择，但程序简单易理解。
* NIO 方式适用于连接数目多且连接比较短（轻操作）的架构，比如聊天服务器，弹幕系统，服务器间通讯等。编程比较复杂，JDK1.4 开始支持。
* AIO 方式使用于连接数目多且连接比较长（重操作）的架构，比如相册服务器，充分调用 OS 参与并发操作，编程比较复杂，JDK7 开始支持。

## BIO、NIO、AIO 对比表


\ | BIO| NIO | AIO
---|---|---|---
IO 模型 | 同步阻塞 | 同步非阻塞（多路复用） | 异步非阻塞
编程难度 | 简单 | 复杂 | 复杂
可靠性 | 差 | 好 | 好
吞吐量 | 低 | 高 | 高

## BIO 详解

### 概述

Java BIO 就是传统的 java io 编程，其相关的类和接口在 `java.io`。

BIO(blocking I/O) ： 同步阻塞，服务器实现模式为一个连接一个线程，即客户端有连接请求时服务器端就需 要启动一个线程进行处理，如果这个连接不做任何事情会造成不必要的线程开销，可以通过线程池机制改善(实现多个客户连接服务器)。

### 工作机制

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/io/bio.png)

1. 服务器端启动一个 ServerSocket 
2. 客户端启动 Socket 对服务器进行通信，默认情况下服务器端需要对每个客户建立一个线程与之通讯
3. 客户端发出请求后, 先咨询服务器是否有线程响应，如果没有则会等待，或者被拒绝 
4. 如果有响应，客户端线程会等待请求结束后，在继续执行

### 应用示例

1. 使用 BIO 模型编写一个服务器端，监听8080 端口，当有客户端连接时，就启动一个线程与之通讯
2. 使用线程池机制改善，可以连接多个客户端
3. 服务器端接收客户端发送的数据(telnet 方式即可)

代码如下：

```java
public class BioServer {

    public static void main(String[] args) throws IOException {
        // 创建线程池
        ExecutorService executorService = Executors.newCachedThreadPool();

        // 创建ServerSocket
        ServerSocket serverSocket = new ServerSocket(8080);
        System.out.println("server start");

        while (true) {

            // 监听, 等待客户端连接
            final Socket socket = serverSocket.accept();;
            System.out.println("client connect, thread: "+ Thread.currentThread());

            executorService.execute(() -> handler(socket));
        }
    }

    // 与客户端通信
    public static void handler(Socket socket) {
        byte[] bytes = new byte[1024];

        // 通过socket获取输入流
        try (InputStream inputStream = socket.getInputStream()) {
            // 循环读取客户端发送的数据
            while (true) {
                int read = inputStream.read(bytes);
                if (read != -1) {
                    System.out.println("receive message: " + new String(bytes, 0 , read) + ", thread: "+ Thread.currentThread());
                } else {
                    break;
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        } finally {
            System.out.println("client close, thread: "+ Thread.currentThread());
        }
    }
}
```

cmd 窗口使用 telnet 127.0.0.1 8080 创建连接，输入ctrl+]，输入send <message> 发送消息测试

### BIO 问题分析

* 每个请求都需要创建独立的线程，与对应的客户端进行数据Read ，业务处理，数据 Write
* 当并发数较大时，需要创建大量线程来处理连接，系统资源占用较大
* 连接建立后，如果当前线程暂时没有数据可读，则线程就阻塞在 Read 操作上，造成线程资源浪费

## NIO 详解

见下一篇[【Java I/O】NIO 详解]()

## AIO 介绍

JDK 7 引入了 Asynchronous I/O，即 AIO。在进行 I/O 编程中，常用到两种模式：Reactor 和 Proactor。Java 的 NIO 就是 Reactor，当有事件触发时，服务器端得到通知，进行相应的处理。

AIO 即 NIO2.0，叫做异步不阻塞的 IO。AIO 引入异步通道的概念，采用了 Proactor 模式，简化了程序编写，有效的请求才启动线程，它的特点是先由操作系统完成后才通知服务端程序启动线程去处理，一般适用于连接数较多且连接时间较长的应用。

目前 AIO 还没有广泛应用，Netty 也是基于 NIO, 而不是 AIO。