title: 【Java I/O】NIO 详解
author: Haif.
tags:
  - Java IO
categories:
  - Java
date: 2020-12-26 17:28:00
copyright: true

---

# 概述

Java NIO 全称 java non-blocking IO，是指 JDK 提供的新 API。从 JDK1.4 开始，Java 提供了一系列改进的输入/输出的新特性，被统称为 NIO(即 New IO)，是同步非阻塞的。

NIO 三大核心部分：Channel(通道)，Buffer(缓冲区), Selector(选择器)。

NIO 是面向缓冲区，或者面向块编程的。数据读取到一个它稍后处理的缓冲区，需要时可在缓冲区中前后移动，这就增加了处理过程中的灵活性，使用它可以提供非阻塞式的高伸缩性网络。

Java NIO 的非阻塞模式，使一个线程从某通道发送请求或者读取数据，但是它仅能得到目前可用的数据，如果目前没有数据可用时，就什么都不会获取，而不是保持线程阻塞，所以直至数据变的可以读取之前，该线程可以继续做其他的事情。非阻塞写也是如此，一个线程请求写入一些数据到某通道，但不需要等待它完全写入， 这个线程同时可以去做别的事情。

<!-- more -->

# NIO 和 BIO 的比较

* BIO 以流的方式处理数据，而 NIO 以块的方式处理数据,块 I/O 的效率比流 I/O 高很多
* BIO 是阻塞的，NIO 则是非阻塞的
* BIO 基于字节流和字符流进行操作，而 NIO 基于 Channel（通道）和 Buffer（缓冲区）进行操作，数据总是从通道读取到缓冲区中，或者从缓冲区写入到通道中。Selector（选择器)用于监听多个通道的事件（比如：连接请求，数据到达等），因此使用单个线程就可以监听多个客户端通道

# 工作机制

## 示意图

NIO 简单原理示意如下图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/io/nio.png)

* Buffer 是内存块，底层是数组，数据的读取写入通过Buffer ，Buffer 可以读也可以写，需要flip 方法切换
* Channel 是双向的，可以反映底层操作系统的情况，比如Linux 底层的操作系统通道就是双向的，每个Channel 都会对应一个Buffer
* Selector 对应一个线程，一个线程对应多个Channel（连接），Selector 会根据不同的事件，在各个通道上切换 

## 缓冲区 Buffer

缓冲区（Buffer）：缓冲区本质上是一个可以读写数据的内存块，可以理解成是一个容器对象（含数组），该对象提供了一组方法，可以更轻松地使用内存块，缓冲区对象内置了一些机制，能够跟踪和记录缓冲区的状态变化情况。Channel 提供从文件、网络读取数据的渠道，但是读取或写入的数据都必须经由 Buffer。

Buffer 类内部结构如下：

```java
private int mark = -1; // 标记
private int position = 0; // 下一个要被读或写的元素索引
private int limit; // 缓冲区当前终点，不能越界，可以修改
private int capacity; // 最大容量，创建时设置
```

Buffer 类相关方法一览：

```java
// @since JDK1.4
public final int capacity() // 返回此缓冲区容量
public final int position() // 返回此缓冲区位置
public final Buffer position(int newPosition) // 设置此缓冲区位置
public final int limit() // 返回此缓冲区限制
public final Buffer limit(int newLimit) // 设置缓冲区限制
public final Buffer mark() // 在此缓冲区的位置设置标记
public final Buffer reset() // 将此缓冲区的位置重置为之前标记的位置
public final Buffer clear() // 清除此缓冲区，即将各个标记恢复到初始状态，数据并没有真正擦除
public final Buffer flip() // 反转此缓冲区
public final Buffer rewind() // 重绕此缓冲区
public final int remaining() // 返回当前位置与限制之间的元素数
public final boolean hasRemaining() // 判断当前位置与限制之间是否有元素
public boolean isReadOnly() // 判断此缓冲区是否只读

// @since JDK1.6
public boolean hasArray() // 判断此缓冲区是否具有可访问的底层实现数组
public Object array() // 返回此缓冲区底层实现数组
public int arrayOffset() // 返回此缓冲区底层实现数组中第一个缓冲区元素的偏移量
public boolean isDirect() // 判断此缓冲区是否为直接缓冲区
```

Java 中的基本数据类型（boolean除外），都有Buffer 实现类，其中最常用的是ByteBuffer （二进制数据），该类主要方法如下：

```java
public static ByteBuffer allocateDirect(int capacity) // 创建直接缓冲区
public static ByteBuffer allocate(int capacity) // 设置缓冲区初始容量
public static ByteBuffer wrap(byte[] array) // 把一个数组放到缓冲区使用
public static ByteBuffer wrap(byte[] array, int offset, int length) // 初始化位置offset，上界length的缓冲区
public byte get() // 从当前位置position上get，get后position会自动加1
public byte get(int index) // 从指定位置get
public ByteBuffer put(byte b) // 从当前位置put，put后position自动加1
public ByteBuffer put(int index, byte b) // 从指定位置put
```

## 通道 Channel

NIO 的通道（Channel）类似于流（stream，如FileInputStream），但有些区别如下： 
* 通道可以同时进行读写，而流只能读或者只能写
* 通道可以实现异步读写数据
* 通道可以从缓冲读数据，也可以写数据到缓冲

Channel 是一个接口，常用的Channel 类有：FileChannel 、DatagramChannel 、ServerSocketChannel 和SocketChannel。（ServerSocketChannel类似ServerSocket ，SocketChannel 类似Socket）

- FileChannel 用于文件的数据读写
- DatagramChannel 用于 UDP 的数据读写
- ServerSocketChannel 和 SocketChannel 用于 TCP 的数据读写

FileChannel 类主要用来对本地文件进行IO 操作，常用方法有：

```java
public int read(ByteBuffer dst) // 从通道读取数据并放到缓冲区
public int write(ByteBuffer src) // 把缓冲区数据写到通道
public long transferFrom(ReadableByteChannel src, long position, long count) // 从目标通道复制数据到当前通道
public long transferTo(long position, long count, WritableByteChannel target) // 把数据从当前通道复制到目标通道
```
### 应用示例

#### 文件读取、写入

使用Channel、Buffer将文件1中的内容写入到文件2

```java
public class FileChannelDemo {

    public static void main(String[] args) throws IOException {
        FileInputStream fileInputStream = new FileInputStream("1.txt");
        FileChannel inFileChannel = fileInputStream.getChannel();
        
        FileOutputStream fileOutputStream = new FileOutputStream("2.txt");
        FileChannel outFileChannel = fileOutputStream.getChannel();
        
        ByteBuffer buffer = ByteBuffer.allocate(512);

        // 循环读取
        while(true) {
            // 重置buffer
            buffer.clear();
            int read = inFileChannel.read(buffer);
            // 已读完
            if (read == -1) {
                break;
            }
            // 将buffer 中的数据写入到2.txt
            buffer.flip();
            outFileChannel.write(buffer);
        }
        
        fileInputStream.close();
        fileOutputStream.close();
    }
}
```

#### 拷贝文件 transferFrom 方法

使用 FileChannel和方法transferFrom 完成文件的拷贝

```java
public class FileChannelDemo2 {

    public static void main(String[] args) throws IOException {
        FileInputStream fileInputStream = new FileInputStream("a.png");
        FileOutputStream fileOutputStream = new FileOutputStream("b.png");
        // 获取各个流对应的fileChannel
        FileChannel sourceCh = fileInputStream.getChannel();
        FileChannel destCh = fileOutputStream.getChannel();
        // 使用 transferForm 完成拷贝
        destCh.transferFrom(sourceCh,0,sourceCh.size());
        // 关闭相关通道和流
        sourceCh.close();
        destCh.close();
        fileInputStream.close();
        fileOutputStream.close();
    }
}
```

### 注意事项

* ByteBuffer 支持类型化的put 和get，put 放入的是什么数据类型，get就应该使用相应的数据类型来取出
* 可以将普通Buffer 转成只读Buffer，asReadOnlyBuffer()
* NIO 还提供了 MappedByteBuffer，可以让文件直接在内存（堆外内存）中进行修改，而如何同步到文件由 NIO 来完成
```java
/**
 * MappedByteBuffer 可让文件直接在内存(堆外内存)修改, 操作系统不需要拷贝一次
 */
public class MappedByteBufferTest {

    public static void main(String[] args) throws IOException {
        RandomAccessFile randomAccessFile = new RandomAccessFile("1.txt", "rw");
        // 获取对应的通道
        FileChannel fileChannel = randomAccessFile.getChannel();

        // param1: 读写模式, param2: 可以修改的起始位置, param3: 映射到内存的大小(不是索引大小)即1.txt有多少字节映射到内存
        MappedByteBuffer mappedByteBuffer = fileChannel.map(FileChannel.MapMode.READ_WRITE, 0, 5);

        mappedByteBuffer.put(0, (byte) 'A');
        mappedByteBuffer.put(3, (byte) 'B');
        // mappedByteBuffer.put(5, (byte) 'C'); // IndexOutOfBoundsException

        randomAccessFile.close();
    }
}
```
* NIO 还支持 通过多个Buffer (即 Buffer 数组) 完成读写操作，即 Scattering 和 Gathering
```java
/**
 * Scattering：将数据写入到buffer 时, 可以采用 buffer 数组，依次写入 [分散]
 * Gathering: 从buffer 读取数据时, 可以采用 buffer 数组，依次读
 */
public class ScatteringAndGatheringTest {

    public static void main(String[] args) throws IOException {
        //使用 ServerSocketChannel 和 SocketChannel 网络
        ServerSocketChannel serverSocketChannel = ServerSocketChannel.open();
        InetSocketAddress inetSocketAddress = new InetSocketAddress(7000);

        //绑定端口到 socket, 并启动
        serverSocketChannel.socket().bind(inetSocketAddress);

        //创建 buffer 数组
        ByteBuffer[] byteBuffers = new ByteBuffer[2];
        byteBuffers[0] = ByteBuffer.allocate(5);
        byteBuffers[1] = ByteBuffer.allocate(3);

        // 等客户端连接(telnet)
        SocketChannel socketChannel = serverSocketChannel.accept();
        // 假定从客户端接收8个字节
        int messageLength = 8;

        while (true) {

            int byteRead = 0;
            while(byteRead < messageLength) {
                long length = socketChannel.read(byteBuffers);
                byteRead += length;

                System.out.println("byteRead=" + byteRead);

                // 打印当前buffer 的position 和limit
                Arrays.stream(byteBuffers)
                        .map(buffer -> "position=" + buffer.position() + ", limit=" + buffer.limit())
                        .forEach(System.out::println);
            }

            // 将所有的 buffer 进行 flip
            Arrays.asList(byteBuffers).forEach(Buffer::flip);

            // 将数据读出显示到客户端
            long byteWrite = 0;
            while (byteWrite < messageLength) {
                long length = socketChannel.write(byteBuffers);
                byteWrite += length;
            }

            // 将所有的 buffer 进行 clear
            Arrays.asList(byteBuffers).forEach(Buffer::clear);

            System.out.println("byteRead=" + byteRead + ", byteWrite=" + byteWrite + ", messageLength=" + messageLength);
        }
    }
}
```

## 选择器 Selector

Selector 能够检测多个注册的通道上是否有事件发生（注意：多个Channel 以事件的方式可以注册到同一个Selector），如果有事件发生，便获取事件然后针对每个事件进行相应的处理。这样就可以只用一个单线程去管理多个通道，也就是管理多个连接和请求。

只有在 *连接/通道* 真正有读写事件发生时，才会进行读写，就大大地减少了系统开销，并且不必为每个连接都创建一个线程，不用去维护多个线程。避免了多线程之间的上下文切换导致的开销。

Selector 类是一个抽象类, 常用方法和说明如下：
```java
// 得到一个选择器对象
public static Selector open() 
// 从内部集合中得到所有SelectionKey
public Set<SelectionKey> selectedKeys()
// 监控所有注册的通道，当其中有IO操作可以进行时，将对应的SelectionKey加入到内部集合中并返回
// 参数用来设置超时时间
public int select(long timeout)
// 阻塞
public int select()
// 不阻塞，立马返还
public int selectNow()
// 唤醒 selector
public Selector wakeup()
```

### NIO 非阻塞网络编程原理分析

NIO 非阻塞 网络编程相关的(Selector、SelectionKey、ServerSocketChannel 和 SocketChannel) 关系梳理图如下：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/io/nio-flow.png)

1. 当客户端连接时，会通过 ServerSocketChannel 得到 SocketChannel 
2. Selector 进行监听 select 方法, 返回有事件发生的通道的个数
3. 将 socketChannel 注册到 Selector 上, register(Selector sel, int ops), 一个 selector 上可以注册多个 SocketChannel 
4. 注册后返回一个 SelectionKey, 会和该 Selector 关联(集合) 
5. 进一步得到各个 SelectionKey (有事件发生) 
6. 在通过 SelectionKey 反向获取 SocketChannel , 方法 channel() 
7. 通过得到的 channel , 完成业务处理

### 代码示例

```java
/**
 * 服务端
 */
public class NIOServer {

    public static void main(String[] args) throws IOException {
        // 创建 ServerSocketChannel -> ServerSocket
        ServerSocketChannel serverSocketChannel = ServerSocketChannel.open();
        // 得到一个 Selector 对象
        Selector selector = Selector.open();
        // 绑定一个端口6666, 在服务器端监听
        serverSocketChannel.socket().bind(new InetSocketAddress(6666));
        // 设置为非阻塞
        serverSocketChannel.configureBlocking(false);
        // 把serverSocketChannel注册到selector 关心事件为OP_ACCEPT
        serverSocketChannel.register(selector, SelectionKey.OP_ACCEPT);

        // 循环等待客户端连接
        while (true) {
            // 等待1s没有事件发生就返回
            if (selector.select(1000) == 0) {
                System.out.println("服务器等待1s, 无连接");
                continue;
            }
            // 如果返回的>0, 表示已经获取到关注的事件, 就获取相关的selectionKey集合
            Set<SelectionKey> selectionKeys = selector.selectedKeys();

            Iterator<SelectionKey> iterator = selectionKeys.iterator();

            while(iterator.hasNext()) {
                // 获取到 SelectionKey
                SelectionKey key = iterator.next();
                // 根据 key 对应的通道发生的事件做相应处理
                // 如果是 OP_ACCEPT, 有新的客户端连接
                if (key.isAcceptable()) {
                    // 给该客户端生成一个 SocketChannel
                    SocketChannel socketChannel = serverSocketChannel.accept();
                    System.out.println("客户端已连接, socketChannel: " + socketChannel.hashCode());
                    // 将SocketChannel设置为非阻塞
                    socketChannel.configureBlocking(false);
                    // 将socketChannel注册到selector, 关注事件为OP_READ, 同时给socketChannel关联一个 Buffer
                    socketChannel.register(selector, SelectionKey.OP_READ, ByteBuffer.allocate(1024));
                }

                // 发生OP_READ
                if (key.isReadable()) {
                    // 通过key反向获取对应的channel
                    SocketChannel channel = (SocketChannel) key.channel();
                    // 获取到channel关联的buffer
                    ByteBuffer buffer = (ByteBuffer) key.attachment();
                    channel.read(buffer);
                    System.out.println("客户端消息: " + new String(buffer.array()));

                }

                // 手动从集合中移动当前的selectionKey, 防止重复操作
                iterator.remove();
            }
        }
    }
}

/**
 * 客户端
 */
public class NIOClient {

    public static void main(String[] args) throws IOException {
        // 得到一个网络通道
        SocketChannel socketChannel = SocketChannel.open();
        // 设置非阻塞
        socketChannel.configureBlocking(false);
        // 提供服务器端的ip和端口
        InetSocketAddress inetSocketAddress = new InetSocketAddress("127.0.0.1", 6666);
        // 连接服务器
        if (!socketChannel.connect(inetSocketAddress)) {
            while (!socketChannel.finishConnect()) {
                System.out.println("因为连接需要时间, 客户端不会阻塞, 可以做其它工作...");
            }
        }

        // 如果连接成功, 就发送数据
        ByteBuffer buffer = ByteBuffer.wrap("hello nio server".getBytes());
        // 发送数据, 将buffer数据写入channel
        socketChannel.write(buffer);
        System.in.read();
    }
}
```

### SelectionKey

SelectionKey 表示 Selector 和网络通道的注册关系, 共四种: 

```java
public static final int OP_READ = 1 << 0; // 代表读操作，值为 1
public static final int OP_WRITE = 1 << 2; // 代表写操作，值为 4
public static final int OP_CONNECT = 1 << 3; // 代表连接已经建立，值为 8
public static final int OP_ACCEPT = 1 << 4; // 有新的网络连接可以 accept，值为 16
```
相关方法如下：

```java
public Selector selector() // 得到与之关联的selecter
public SelectableChannel channel() // 得到与之关联的channel
public final Object attachment() // 得到与之关联的共享数据
public  SelectionKey interestOps(int ops) // 设置或改变监听事件
public final boolean isAcceptable() // 是否可以accept
public final boolean isReadable() // 是否可以读
public final boolean isWritable() // 是否可以写
```

### ServerSocketChannel

ServerSocketChannel 在服务器端监听新的客户端 Socket 连接

相关方法如下：

```java
public static ServerSocketChannel open() // 得到一个ServerSocketChannel通道
public final ServerSocketChannel bind(SocketAddress local) // 设置服务器端端口
public final SelectableChannel configureBlocking(boolean block) // 设置阻塞true或非阻塞false模式
public SocketChannel accept() // 接受一个连接, 返回代表这个连接的通道对象
public final SelectionKey register(Selector sel, int ops) // 注册一个选择器并设置监听事件
```

### SocketChannel

SocketChannel  是网络IO通道，具体负责进行读写操作。NIO把缓冲区的数据写入通道，或者把通道里的数据读到缓冲区。

相关方法如下：

```java
public static SocketChannel open() // 得到一个SocketChannel通道
public final SelectableChannel configureBlocking(boolean block) // 设置阻塞true或非阻塞false模式
public boolean connect(SocketAddress remote) // 连接服务器
public boolean finishConnect() // 如果connect失败，用此方法完成连接操作
public int write(ByteBuffer src) // 往通道写数据
public int read(ByteBuffer dst) // 从通道读数据
public final SelectionKey register(Selector sel, int ops, Object att) // 注册一个选择器并设置监听事件，最后一个参数设置共享数据
```

# 案例：群聊系统

* 编写一个 NIO 多人群聊系统，实现服务器端和客户端之间的数据简单通讯（非阻塞）
* 服务器端：可以监测用户上线，离线，并实现消息转发功能 
* 客户端：通过channel 可以无阻塞发送消息给其它所有用户，同时可以接受其它用户发送的消息

```java
/**
 * 服务端
 */
public class GroupChatServer {

    private Selector selector;
    private ServerSocketChannel listenerChannel;
    private final int PORT = 6667;

    public GroupChatServer() {

        try {
            // 得到Selector
            selector = Selector.open();
            // 得到ServerSocketChannel
            listenerChannel = ServerSocketChannel.open();
            // 绑定端口
            listenerChannel.bind(new InetSocketAddress(PORT));
            // 设置非阻塞模式
            listenerChannel.configureBlocking(false);
            // 将该listenChannel注册到 selector
            listenerChannel.register(selector, SelectionKey.OP_ACCEPT);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public void listener() {

        try {
            while(true) {
                int count = selector.select(2000);
                // 有事件处理
                if (count > 0) {
                    // 遍历得到selectionKey集合
                    Set<SelectionKey> selectionKeys = selector.selectedKeys();
                    Iterator<SelectionKey> iterator = selectionKeys.iterator();

                    while(iterator.hasNext()) {
                        SelectionKey selectionKey = iterator.next();
                        if (selectionKey.isAcceptable()) {
                            // 监听到accept
                            // 获得socketChannel
                            SocketChannel socketChannel = listenerChannel.accept();
                            // 非阻塞
                            socketChannel.configureBlocking(false);
                            //将该socketChannel注册到selector
                            socketChannel.register(selector, SelectionKey.OP_READ);
                            System.out.println(socketChannel.getRemoteAddress() + " 已上线");
                        } else if (selectionKey.isReadable()) {
                            readData(selectionKey);
                        }

                        // 防止重复处理
                        iterator.remove();
                    }
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    /**
     * 读取客户端消息
     */
    private void readData(SelectionKey selectionKey) {
        // 取到关联的socketChannel
        SocketChannel socketChannel = (SocketChannel) selectionKey.channel();
        ByteBuffer buffer = ByteBuffer.allocate(1024);
        try {
            // 读消息
            int count = socketChannel.read(buffer);
            if (count > 0) {
                String msg = new String(buffer.array());
                System.out.println(socketChannel.getRemoteAddress() + " 消息: " + msg);
                sendInfo(socketChannel, msg);
            }
        } catch (IOException e) {
            try {
                System.out.println(socketChannel.getRemoteAddress() + " 已下线");
                // 取消注册
                selectionKey.cancel();
                // 关闭通道
                socketChannel.close();
            } catch (IOException ex) {
                ex.printStackTrace();
            }
            e.printStackTrace();
        }
    }

    /**
     * 向其它的客户端转发消息
     */
    private void sendInfo(SocketChannel selfChannel, String msg) {
        System.out.println("开始转发消息");
        try {
            // 遍历所有注册到selector上的socketChannel, 并排除self
            for (SelectionKey key : selector.keys()) {
                Channel channel = key.channel();
                if(channel instanceof SocketChannel && channel != selfChannel) {
                    // 将消息写到channel
                    ((SocketChannel)channel).write(ByteBuffer.wrap(msg.getBytes()));
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
        System.out.println("转发完成");
    }

    public static void main(String[] args) {
        GroupChatServer chatServer = new GroupChatServer();
        chatServer.listener();
    }
}

/**
 * 客户端
 */
public class GroupChatClient {

    private final String HOST = "127.0.0.1";
    private final int PORT = 6667;
    private Selector selector;
    private SocketChannel socketChannel;
    private String username;

    public GroupChatClient() {
        try {
            selector = Selector.open();
            // 连接服务器
            socketChannel = SocketChannel.open(new InetSocketAddress(HOST, PORT));
            // 非阻塞
            socketChannel.configureBlocking(false);
            // 将channel注册到selector
            socketChannel.register(selector, SelectionKey.OP_READ);
            username = socketChannel.getLocalAddress().toString().substring(1);
            System.out.println(username + " 准备完毕");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public void sendInfo(String msg) {
        msg = username + "： " + msg;
        try {
            socketChannel.write(ByteBuffer.wrap(msg.getBytes()));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public void readMsg() {
        try {
            int readChannels = selector.select();
            // 有可以用的通道
            if (readChannels > 0) {
                Iterator<SelectionKey> iterator = selector.selectedKeys().iterator();
                while(iterator.hasNext()) {
                    SelectionKey key = iterator.next();
                    if (key.isReadable()) {
                        SocketChannel socketChannel = (SocketChannel) key.channel();
                        ByteBuffer buffer = ByteBuffer.allocate(1024);
                        // 从channel读出消息
                        socketChannel.read(buffer);
                        String msg = new String(buffer.array());
                        System.out.println(msg);
                    }
                    iterator.remove();
                }
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public static void main(String[] args) {
        GroupChatClient chatClient = new GroupChatClient();

        new Thread(new Runnable() {
            @Override
            public void run() {
                while (true) {
                    chatClient.readMsg();
                    try {
                        Thread.sleep(3000);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        }).start();

        Scanner scanner = new Scanner(System.in);
        while (scanner.hasNextLine()) {
            String s = scanner.nextLine();
            chatClient.sendInfo(s);
        }
    }
}
```
