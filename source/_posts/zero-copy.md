title: 零拷贝（zero-copy）原理详解
author: Haif.
tags:
  - Java IO
categories:
  - Java
date: 2020-12-26 17:33:00

---

# 前置概念

## 用户空间与内核空间

CPU 将指令分为特权指令和非特权指令，对于危险指令，只允许操作系统及其相关模块使用，普通应用程序只能使用那些不会造成灾难的指令。比如 Intel 的 CPU 将特权等级分为 4 个级别：Ring0~Ring3。

其实 Linux 系统只使用了 Ring0 和 Ring3 两个运行级别（Windows 系统也是一样的）。当进程运行在 Ring3 级别时被称为运行在用户态，而运行在 Ring0 级别时被称为运行在内核态。

**简单来说：内核空间和用户空间本质上是要提高操作系统的稳定性及可用性，当进程运行在内核空间时就处于内核态，当进程运行在用户空间时就处于用户态。**

<!-- more -->

## DMA（直接存储器访问）

DMA 即Direct Memory Access ，直接存储器访问。DMA 控制方式是以存储器为中心，在主存和I/O设备之间建立一条直接通路，在DMA 控制器的控制下进行设备和主存之间的数据交换。这种方式只在传输开始和传输结束时才需要CPU的干预。它非常适用于高速设备与主存之间的成批数据传输。

# 传统I/O

下面通过一个Java 非常常见的应用场景：将系统中的文件发送到远端（磁盘文件 -> 内存（字节数组） -> 传输给用户/网络）来详细展开I/O操作。

如下图所示：

![](https://haif-cloud.oss-cn-beijing.aliyuncs.com/io/old-io.png)

1. JVM 发出read() 系统调用，上下文从用户态切换到内核态（第一次上下文切换）。通过DMA（Direct Memory Access，直接存储器访问）引擎将文件中的数据从磁盘上读取到内核空间缓冲区（第一次拷贝: hard drive -> kernel buffer）。
2. 将内核空间缓冲区的数据拷贝到用户空间缓冲区（第二次拷贝：kernel buffer -> user buffer），然后read系统调用返回。而系统调用的返回又会导致一次内核态到用户态的上下文切换（第二次上下文切换）。
3. JVM 处理代码逻辑并发送write() 系统调用，上下文从用户态切换到内核态（第三次上下文切换），然后将用户空间缓冲区中的数据拷贝到内核空间中与socket 相关联的缓冲区中（即，第2步中从内核空间缓冲区拷贝而来的数据原封不动的再次拷贝到内核空间的socket缓冲区中。）（第三次拷贝：user buffer -> socket buffer）。
4. write 系统调用返回，上下文再次从内核态切换到用户态（第四次上下文切换）。通过DMA 引擎将内核缓冲区中的数据传递到协议引擎（第四次拷贝：socket buffer -> protocol engine)，这次拷贝是一个独立且异步的过程。

## 小结

传统的I/O操作进行了4次用户态与内核态间的上下文切换，以及4次数据拷贝（2次DMA拷贝和2次CPU拷贝）。

传统的文件传输方式简单但存在冗余的上文切换和数据拷贝，多了很多不必要的开销，在高并发系统里会严重影响系统性能。

所以，**要想提高文件传输的性能，就需要减少「用户态与内核态的上下文切换」和「内存拷贝」的次数**。

# 零拷贝（zero-copy）

零拷贝是站在内核的角度来说的，其目的是消除从内核空间到用户空间的来回复制，并不是完全不会发生任何拷贝。

零拷贝不仅仅带来了更少的数据复制，还能带来其他的性能优势，例如：更少的上下⽂切换，更少的CPU 缓存伪共享以及无CPU 校验和计算。

## mmap 实现

mmap 是一种内存映射文件的方法，即将一个文件或者其它对象映射到进程的地址空间，实现文件磁盘地址和进程虚拟地址空间中一段虚拟地址的一一对映关系。实现这样的映射关系后，进程就可以采用指针的方式读写操作这一段内存，而系统会自动回写脏页面到对应的文件磁盘上，即完成了对文件的操作而不必再调用read，write等系统调用函数。相反，内核空间对这段区域的修改也直接反映用户空间，从而可以实现不同进程间的文件共享。

基于mmap的拷贝流程如下图：

![](https://haif-cloud.oss-cn-beijing.aliyuncs.com/io/mmap.png)

1. 发出mmap 系统调用，上下文从用户态切换到内核态（第一次上下文切换）。通过DMA 将磁盘文件中的内容拷贝到内核空间缓冲区中（第一次拷贝：hard drive -> kernel buffer）。
2.  mmap 系统调用返回，上下文从内核态切换到用户态（第二次上下文切换）。接着用户空间和内核空间共享这个缓冲区而不需要进行数据拷贝。
3.  发出write 系统调用，上下文从用户态切换到内核态（第三次上下文切换）。将数据从内核空间缓冲区拷贝到内核空间socket 相关联的缓冲区（第二次拷贝：kernel buffer -> socket buffer）。
4.  write 系统调用返回，上下文从内核态切换到用户态（第四次上下文切换）。通过DMA 将内核空间socket  缓冲区中的数据传递到协议引擎（第三次拷贝：socket buffer -> protocol engine）。

### 小结

通过mmap 实现的零拷贝 I/O 进行了4次用户态与内核态间的上下文切换，以及3次数据拷贝（2次DMA 拷贝和1次CPU 拷贝）。

通过mmap实现的零拷贝I/O 与传统 I/O 相比仅仅少了1次内核空间缓冲区和用户空间缓冲区之间的CPU拷贝。这样的好处是，可以将整个文件或者整个文件的一部分映射到内存当中，用户直接对内存中对文件进行操作，然后是由操作系统来进行相关的页面请求并将内存的修改写入到文件当中。应用程序只需要处理内存的数据，这样可以实现非常迅速的 I/O 操作。

## sendfile 实现

![](https://haif-cloud.oss-cn-beijing.aliyuncs.com/io/sendfile.png)

1.  发出sendfile 系统调用，上下文从用户态切换到内核态（第一次上下文切换）。通过DMA 将磁盘文件中的内容拷贝到内核空间缓冲区中（第一次拷贝：hard drive -> kernel buffer）。
2.  将数据从内核空间缓冲区拷贝到内核中与socket相关的缓冲区中（第二次拷贝:kernel buffer -> socket buffer）。
3. sendfile 系统调用返回，上下文从内核态切换到用户态（第二次上下文切换）。通过DMA 将内核空间socket  缓冲区中的数据传递到协议引擎（第三次拷贝：socket buffer -> protocol engine）。

### 小结

通过sendfile实现的零拷贝I/O 只进行了2次用户态与内核态间的上下文切换，以及3次数据的拷贝（2次DMA 拷贝和1次CPU 拷贝）。

在Java中，FileChannel 的transferTo() 方法可以实现了这个过程，该方法将数据从文件通道传输到给定的可写字节通道。

```java
public void transferTo(long position, long count, WritableByteChannel target);
```

在 UNIX 和各种 Linux 系统中，此调用被传递到 `sendfile()` 系统调用中，最终实现将数据从一个文件描述符传输到了另一个文件描述符。

此时操作系统仍然需要在内核内存空间中复制数据（kernel buffer ->socket buffer）。 虽然从操作系统的角度来看，这已经是零拷贝了（因为没有数据从内核空间复制到用户空间， 内核需要复制的原因是因为通用硬件DMA 访问需要连续的内存空间（因此需要缓冲区），但是，如果硬件支持scatter-and-gather ，这是可以避的。

## 带有DMA 收集拷贝功能的sendfile 实现

从 Linux 2.4 版本开始，操作系统底层提供了带有 scatter/gather 的DMA 来从内核空间缓冲区中将数据读取到协议引擎中。这样一来待传输的数据可以分散在存储的不同位置上，而不需要在连续存储中存放。那么从文件中读出的数据就根本不需要被拷贝到socket 缓冲区中去，只是需要将缓冲区描述符添加到socket 缓冲区中去，DMA 收集操作会根据缓冲区描述符中的信息将内核空间中的数据直接拷贝到协议引擎中。

![](https://haif-cloud.oss-cn-beijing.aliyuncs.com/io/sendfile-gather.png)

1.  发出sendfile 系统调用，上下文从用户态切换到内核态（第一次上下文切换）。通过DMA 将磁盘文件中的内容拷贝到内核空间缓冲区中（第一次拷贝：hard drive -> kernel buffer）。
2. 没有数据拷贝到socket缓冲区。取而代之的是只有相应的描述符信息会被拷贝到相应的socket 缓冲区当中。该描述符包含了两方面的信息：kernel buffer 的内存地址和kernel buffer 的偏移量。
3.  sendfile系统调用返回，上下文从内核态切换到用户态。DMA gather copy根据socket 缓冲区中描述符提供的位置和偏移量信息直接将内核空间缓冲区中的数据拷贝到协议引擎上（第二次拷贝：socket buffer -> protocol engine），这样就避免了最后一次CPU数据拷贝。

### 小结

带有DMA 收集拷贝功能的sendfile 实现的I/O 只进行了2次用户态与内核态间的上下文切换，以及2次数据的拷贝，而且这2次的数据拷贝都是非CPU 拷贝。这样一来就实现了最理想的零拷贝I/O 传输了，不需要任何一次的CPU 拷贝，以及最少的上下文切换。

## 零拷贝使用场景

- ⽂件较⼤，读写较慢，追求速度
- JVM 内存不够，不能加载太⼤的数据
- 内存宽带不够，即存在其他程序或线程存在⼤量的IO操作
- ······

使用零拷贝的技术：

- Java NIO
-  Netty
-  RocketMQ
-  Kafka
- ······

## 代码示例

* 传统I/O

```java
public class OldIOserver {
    public static void main(String[] args) throws IOException {
        ServerSocket serverSocket = new ServerSocket(7001);

        while(true) {
            Socket socket = serverSocket.accept();
            DataInputStream dataInputStream = new DataInputStream(socket.getInputStream());

            try {
                byte[] bytes = new byte[4096];
                while(true) {
                    int readCount = dataInputStream.read(bytes);
                    if (-1 == readCount) {
                        break;
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}

class OldIOClient {
    public static void main(String[] args) throws IOException {
        Socket socket = new Socket("127.0.0.1", 7001);

        FileInputStream fileInputStream = new FileInputStream("test1.zip");
        DataOutputStream dataOutputStream = new DataOutputStream(socket.getOutputStream());

        byte[] bytes = new byte[4096];
        long readCount = 0;
        long total = 0;

        long startTime = System.currentTimeMillis();

        while((readCount = fileInputStream.read(bytes)) >= 0) {
            total += readCount;
            dataOutputStream.write(bytes);
        }

        System.out.println("发送的总字节数= " + total + ", 耗时: " + (System.currentTimeMillis() - startTime));

        dataOutputStream.close();
        socket.close();
        fileInputStream.close();
    }
}
```

输出结果：

```
发送的总字节数= 192778371, 耗时: 1227
```

* 零拷贝：

```java
public class NewIOServer {
    public static void main(String[] args) throws Exception {
        InetSocketAddress address = new InetSocketAddress(7001);
        ServerSocketChannel serverSocketChannel = ServerSocketChannel.open();
        ServerSocket serverSocket = serverSocketChannel.socket();
        serverSocket.bind(address);

        ByteBuffer byteBuffer = ByteBuffer.allocate(4096);

        while (true) {
            SocketChannel socketChannel = serverSocketChannel.accept();
            int readCount = 0;
            while (-1 != readCount) {
                try {
                    readCount = socketChannel.read(byteBuffer);
                } catch (Exception ex) {
                    ex.printStackTrace();
                    break;
                }

                // 倒带, position = 0, mark作废
                byteBuffer.rewind();
            }
        }
    }
}

class NewIOClient {
    public static void main(String[] args) throws Exception {
        SocketChannel socketChannel = SocketChannel.open();
        socketChannel.connect(new InetSocketAddress("localhost", 7001));
        String filename = "test1.zip";
        FileChannel fileChannel = new FileInputStream(filename).getChannel();

        long startTime = System.currentTimeMillis();
        // linux下, 一个transferTo方法就可以完成传输
        // windows下, 一次调用transferTo只能发送8m, 超过8m需要分段传输文件
        int length = (int) fileChannel.size();
        int count = length / (8 * 1024 * 1024) + 1;
        long transferCount = 0;
        for (int i = 0; i < count; i++) {
            // transferTo 底层使用到零拷贝
            transferCount += fileChannel.transferTo(transferCount, fileChannel.size(), socketChannel);
        }

        System.out.println("发送的总字节数= " + transferCount + ", 耗时: " + (System.currentTimeMillis() - startTime));

        fileChannel.close();
    }
}
```

输出结果：

```
发送的总字节数= 192778371, 耗时: 205
```