title: 【Netty】工作原理解析
author: Haif.
tags:
  - Netty
categories:
  - Netty
date: 2020-12-26 17:34:00

---

# 线程模型介绍

不同的线程模式，对程序的性能有很大影响，为了搞清 Netty 线程模式，下面来系统的讲解下各个线程模式， 最后看看 Netty 线程模型有什么优越性。

目前存在的线程模型有： 

* 传统阻塞 I/O 服务模型
* Reactor 模式

根据 Reactor 的数量和处理资源池线程的数量不同，有 3 种典型的实现：

*  单 Reactor 单线程
*  单 Reactor 多线程
*  主从 Reactor 多线程

Netty 线程模式：Netty 主要基于主从 Reactor 多线程模型做了一定的改进，其中主从 Reactor 多线程模型有多个 Reactor。

<!-- more -->

# 传统阻塞 I/O 服务模型

## 工作原理示意图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/netty/old-io-model.png)

## 模型特点

* 采用阻塞 IO 模式获取输入的数据
* 每个连接都需要独立的线程完成数据的输入，业务处理, 数据返回

## 问题分析

* 当并发数很大，就会创建大量的线程，占用很大的系统资源
* 连接创建后，如果当前线程暂时没有数据可读，该线程会阻塞在 read 操作，造成线程资源浪费

# Reactor 模式

Reactor: 反应器模式，也被称为分发者模式(Dispatcher)或通知者模式(notifier)。

针对传统阻塞 I/O 服务模型的 2 个缺点，解决方案如下：

* 基于 I/O 复用模型：多个连接共用一个阻塞对象，应用程序只需要在一个阻塞对象等待，无需阻塞等待所有连接。当某个连接有新的数据可以处理时，操作系统通知应用程序，线程从阻塞状态返回，开始进行业务处理。
* 基于线程池复用线程资源：不必再为每个连接创建线程，将连接完成后的业务处理任务分配给线程进行处理，一个线程可以处理多个连接的业务。

## Reactor 模式设计思想

Reactor 模式基本设计思想是I/O 复用结合线程池，如下图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/netty/reactor-model.png)

1. Reactor 模式，通过一个或多个输入同时传递给服务处理器(基于事件驱动) 。
2. 服务器端程序处理传入的多个请求，并将它们同步分派到相应的处理线程，因此 Reactor 模式也叫 Dispatcher 模式。
3. Reactor 模式使用 IO 复用监听事件，收到事件后，分发给某个线程(进程)， 这点就是网络服务器高并发处理关键。

## Reactor 模式核心组成

1. Reactor：Reactor 在一个单独的线程中运行，负责监听和分发事件，分发给适当的处理程序来对 IO 事件做出反应。
2. Handlers：处理程序执行 I/O 事件要完成的实际事件。Reactor 通过调度适当的处理程序来响应 I/O 事件，处理程序执行非阻塞操作。

## Reactor 模式分类

根据 Reactor 的数量和处理资源池线程的数量不同，有 3 种典型的实现：
1. 单 Reactor 单线程
2. 单 Reactor 多线程
3. 主从 Reactor 多线程

## 单Reactor 单线程模式

### 工作原理示意图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/netty/reactor-model1.png)

### 工作流程说明

1. Select 是前面 I/O 复用模型介绍的标准网络编程API，可以实现应用程序通过一个阻塞对象监听多路连接请求。
2. Reactor 对象通过 Select 监控客户端请求事件，收到事件后通过 Dispatch 进行分发。
3. 如果是建立连接请求事件，则由 Acceptor 通过 Accept 处理连接请求，然后创建一个 Handler 对象处理完成连接后的各种事件
4. 如果不是建立连接事件，则 Reactor 会分发调用连接对应的 Handler 来响应。
5. Handler 会完成 Read -> 业务处理 -> Send 的完整业务流程。

### 优缺点分析

* 优点：模型简单，没有多线程、进程通信、竞争的问题，全部都在一个线程中完成。
* 缺点：
   * 性能问题，只有一个线程，无法完全发挥多核 CPU 的性能。Handler 在处理某个连接上的业务时，整个进程无法处理其他连接事件，很容易导致性能瓶颈。
   * 可靠性问题，线程意外终止，或者进入死循环，会导致整个系统通信模块不可用，不能接收和处理外部消息，造成节点故障。

使用场景：客户端的数量有限，业务处理非常快速，比如 Redis 在业务处理的时间复杂度 O(1) 的情况。

## 单Reactor 多线程模式

### 工作原理示意图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/netty/reactor-model2.png)

### 工作流程说明

1. Reactor 对象通过 Select 监控客户端请求事件，收到事件后，通过 dispatch 进行分发。
2. 如果建立连接请求, 则由 Acceptor 通过 accept 处理连接请求，然后创建一个 Handler 对象处理完成连接后的各种事件。
3. 如果不是连接请求，则由 Reactor 分发调用连接对应的 Handler 来处理。
4. Handler 只负责响应事件，不做具体的业务处理，通过 read 读取数据后，会分发给后面的 Worker 线程池的某个线程处理业务。
5. Worker 线程池会分配独立线程完成真正的业务，并将结果返回给 Handler。
6. Handler 收到响应后，通过 send 将结果返回给 client。

### 优缺点分析

* 优点：可以充分的利用多核 CPU 的处理能力。
* 缺点：多线程数据共享和访问比较复杂，Reactor 处理所有的事件的监听和响应，在单线程运行，在高并发场景容易出现性能瓶颈。

## 主从Reactor 模式

针对单 Reactor 多线程模型中，Reactor 在单线程中运行，高并发场景下容易成为性能瓶颈，可以让 Reactor 在 多线程中运行。

### 工作原理示意图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/netty/reactor-model3.png)

### 工作流程说明

1. Reactor 主线程 MainReactor 对象通过 select 监听连接事件，收到事件后，通过Acceptor 处理连接事件。
2. 当 Acceptor 处理连接事件后，MainReactor 将连接分配给 SubReactor。
3. SubReactor 将连接加入到连接队列进行监听，并创建 handler 进行各种事件处理。
4. 当有新事件发生时，SubReactor 就会调用对应的 handler 处理。
5. handler 通过 read 读取数据，分发给后面的 worker 线程处理。
6. worker 线程池分配独立的 worker 线程进行业务处理，并返回结果。
7. handler 收到响应的结果后，再通过 send 将结果返回给 client。
8. Reactor 主线程可以对应多个 Reactor 子线程, 即 MainRecator 可以关联多个SubReactor。

### 优缺点分析

* 优点：
    * 父线程与子线程的数据交互简单职责明确，父线程只需要接收新连接，子线程完成后续的业务处理。
    * 父线程与子线程的数据交互简单，Reactor 主线程只需要把新连接传给子线程，子线程无需返回数据。
* 缺点：编程复杂度较高

结合实例：这种模型在许多项目中广泛使用，包括 Nginx 主从 Reactor 多进程模型，Memcached 主从多线程， Netty 主从多线程模型的支持。

## Reactor 模式优点和缺点

### 优点

1. 响应快，不必为单个同步时间所阻塞，虽然 Reactor 本身依然是同步的。
2. 可以最大程度的避免复杂的多线程及同步问题，并且避免了多线程/进程的切换开销。
3. 扩展性好，可以方便的通过增加 Reactor 实例个数来充分利用 CPU 资源。
4. 复用性好，Reactor 模型本身与具体事件处理逻辑无关，具有很高的复用性。

### 缺点

1. 相比传统的简单模型，Reactor增加了一定的复杂性，因而有一定的门槛，并且不易于调试。
2. Reactor模式需要底层的Synchronous Event Demultiplexer支持，比如Java中的Selector 支持，操作系统的select系统调用支持，如果要自己实现Synchronous Event Demultiplexer 可能不会有那么高效。
3. Reactor模式在IO 读写数据时还是在同一个线程中实现的，即使使用多个Reactor 机制的情况下，那些共享一个Reactor 的Channel 如果出现一个长时间的数据读写，会影响这个Reactor 中其他Channel 的响应时间，比如在大文件传输时，IO 操作就会影响其他Client 的响应时间，因而对这种操作，使用传统的Thread-Per-Connection 或许是一个更好的选择，或者此时使用改进版的Reactor 模式如Proactor 模式。

# Netty 模型

Netty 主要基于主从 Reactors 多线程模型做了一定的改进，其中主从 Reactor 多线程模型有多个 Reactor。

## 工作原理示意图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/netty/netty-model.png)

## 工作流程说明

1. Netty 抽象出两组线程池 BossGroup 专门负责接收客户端的连接，WorkerGroup 专门负责网络的读写。
2. BossGroup 和 WorkerGroup 类型都是 NioEventLoopGroup。
3. NioEventLoopGroup 相当于一个事件循环组，这个组中含有多个事件循环，每一个事件循环是 NioEventLoop。
4. NioEventLoop 表示一个不断循环的执行处理任务的线程，每个 NioEventLoop 都有一个 selector ，用于监听绑定在其上的 socket 的网络通讯。其内部采用串行化设计，从消息的读取 -> 解码 -> 处理 -> 编码 -> 发送，始终由 IO 线程 NioEventLoop 负责。
5. NioEventLoopGroup 可以有多个线程, 即可以含有多个 NioEventLoop。
6. 每个 Boss NioEventLoop 循环执行的步骤：
    - 轮询 accept 事件。
    - 处理 accept 事件，与 client 建立连接，生成 NioScocketChannel ，并将其注册到某个 Worker NIOEventLoop 上 的 selector。
    - 处理任务队列的任务，即 runAllTasks。
7. 每个 Worker NIOEventLoop 循环执行的步骤：
    - 轮询 read，write 事件。
    - 处理 I/O 事件， 即read ，write 事件，在对应 NioScocketChannel 处理业务。
    - 处理任务队列的任务，即 runAllTasks。
8. 每个 Worker NIOEventLoop 处理业务时，会使用pipeline（管道），pipeline 中包含了 channel , 即通过pipeline 可以获取到对应通道, 管道中维护了很多的handler 处理器用来处理 channel 中的数据。

## 案例： TCP 服务

* 服务端

```
public class NettyServer {

    public static void main(String[] args) {

        // 创建两个线程组 bossGroup 和 workerGroup
        // bossGroup 只是处理连接请求, 真正的和客户端业务处理, 会交给workerGroup 完成
        // bossGroup 和 workerGroup 含有的子线程(NioEventLoop)的个数默认是实际cpu 核心数 * 2
        EventLoopGroup bossGroup = new NioEventLoopGroup(1);
        EventLoopGroup workerGroup = new NioEventLoopGroup();

        ServerBootstrap bootstrap = new ServerBootstrap();

        bootstrap.group(bossGroup, workerGroup) // 设置两个线程组
                .channel(NioServerSocketChannel.class) // 使用NioSocketChannel 作为服务器的通道实现
                .option(ChannelOption.SO_BACKLOG, 128) // 设置线程队列得到连接个数
                .childOption(ChannelOption.SO_KEEPALIVE, true) // 设置保持活动的连接状态
                .childHandler(new ChannelInitializer<SocketChannel>() { // 创建一个通道测试对象(匿名对象)
                    @Override
                    protected void initChannel(SocketChannel ch) throws Exception {
                        // 给pipeline 设置处理器
                        ch.pipeline().addLast(new NettyServerHandler());
                    }
                }); // 给workGroup 的EventLoop 对应的管道设置处理器

        System.out.println("服务器已准备就绪...");

        try {
            // 启动服务器, 绑定端口并设置同步
            ChannelFuture channelFuture = bootstrap.bind(8080).sync();

            // 对关闭通道监听
            channelFuture.channel().closeFuture().sync();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } finally {
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
}

/**
 * 自定义handler处理器
 */
class NettyServerHandler extends ChannelInboundHandlerAdapter {

    /**
     * 读取数据实际(这里可以读取客户端发送的消息)
     * @param ctx 上下文对象, 含有管道pipeline, 通道channel, 地址
     * @param msg 客户端发送的数据
     */
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {

        System.out.println("服务器读取线程: " + Thread.currentThread().getName());
        System.out.println("server ctx = " + ctx);


        Channel channel = ctx.channel();
        // ChannelPipeline pipeline = ctx.pipeline(); // 本质是一个双向链表

        // 将msg 转成一个ByteBuf
        // ByteBuf是Netty提供的, 不是NIO的ByteBuffer
        ByteBuf buf = (ByteBuf) msg;

        System.out.println("收到客户端消息: " + buf.toString(CharsetUtil.UTF_8));
        System.out.println("客户端地址: " + channel.remoteAddress());
    }

    /**
     * 数据读取完毕
     */
    @Override
    public void channelReadComplete(ChannelHandlerContext ctx) throws Exception {
        // writeAndFlush 是write + flush
        // 将数据写入到缓存, 并刷新
        ctx.writeAndFlush(Unpooled.copiedBuffer("bye ~", CharsetUtil.UTF_8));
    }
}
```

* 客户端

```
public class NettyClient {
    public static void main(String[] args) {
        // 客户端需要一个事件循环组
        EventLoopGroup group = new NioEventLoopGroup();

        // 创建客户端启动对象
        // 注意客户端使用的不是ServerBootstrap 而是Bootstrap
        Bootstrap bootstrap = new Bootstrap();
        // 设置相关参数
        bootstrap.group(group) //设置线程组
                .channel(NioSocketChannel.class) // 设置客户端通道的实现类(反射)
                .handler(new ChannelInitializer<SocketChannel>() {
                    @Override protected void initChannel(SocketChannel ch) throws Exception {
                        ch.pipeline().addLast(new NettyClientHandler()); //加入自己的处理器
                    }
                });

        System.out.println("客户端准备就绪...");

        try {
            // 启动客户端去连接服务器端
            ChannelFuture channelFuture = bootstrap.connect("127.0.0.1", 8080).sync();
            // 监听关闭通道
            channelFuture.channel().closeFuture().sync();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } finally {
            group.shutdownGracefully();
        }
    }
}

class NettyClientHandler extends ChannelInboundHandlerAdapter {

    /**
     * 当通道就绪就会触发该方法
     */
    @Override
    public void channelActive(ChannelHandlerContext ctx) throws Exception {
        System.out.println("client ctx = " + ctx);

        ctx.writeAndFlush(Unpooled.copiedBuffer("hello ~", CharsetUtil.UTF_8));
    }

    /**
     * 当通道有读取事件时触发
     */
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        ByteBuf buf = (ByteBuf) msg;
        System.out.println("服务器消息: " + buf.toString(CharsetUtil.UTF_8));
        System.out.println("服务器地址: "+ ctx.channel().remoteAddress());
    }

    /**
     * 异常事件
     */
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        cause.printStackTrace();
        ctx.close();
    }
}
```

## 任务队列 Task

### 使用场景

1. 用户程序自定义的普通任务
2. 用户自定义定时任务
3. 非当前 Reactor 线程调用 Channel 的各种方法

### 代码演示

```
class NettyServerTaskHandler extends ChannelInboundHandlerAdapter {

    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {

        // 自定义普通任务, 该任务是提交到taskQueue中
        ctx.channel().eventLoop().execute(new Runnable() {
            @Override
            public void run() {
                try {
                    Thread.sleep(5 * 1000);
                    ctx.writeAndFlush(Unpooled.copiedBuffer("hello ~ task", CharsetUtil.UTF_8));
                    System.out.println("channel hash =" + ctx.channel().hashCode());
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });

        // 注意此处第二个普通任务在任务一基础上睡眠5s, 10s后输出
        ctx.channel().eventLoop().execute(new Runnable() {
            @Override
            public void run() {
                try {
                    Thread.sleep(5 * 1000);
                    ctx.writeAndFlush(Unpooled.copiedBuffer("hello ~ task2", CharsetUtil.UTF_8));
                    System.out.println("channel hash =" + ctx.channel().hashCode());
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });

        // 自定义定时任务, 该任务是提交到scheduledTaskQueue中
        ctx.channel().eventLoop().schedule(new Runnable() {
            @Override
            public void run() {
                try {
                    Thread.sleep(5 * 1000);
                    ctx.writeAndFlush(Unpooled.copiedBuffer("hello ~ timed task", CharsetUtil.UTF_8));
                    System.out.println("channel hash =" + ctx.channel().hashCode());
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }, 5, TimeUnit.SECONDS);
    }

    @Override
    public void channelReadComplete(ChannelHandlerContext ctx) throws Exception {
        ctx.writeAndFlush(Unpooled.copiedBuffer("bye ~", CharsetUtil.UTF_8));
    }
}
```

# 异步模型

## 基本介绍

异步的概念和同步相对，当一个异步过程调用发出后，调用者不能立刻得到结果。实际处理这个调用的组件在完成后，通过状态、通知和回调来通知调用者。 

Netty 中的 I/O 操作是异步的，包括 Bind、Write、Connect 等操作会简单的返回一个 ChannelFuture，调用者并不能立刻获得结果，而是通过 Future - Listener 机制，用户可以方便的主动获取或者通过通知机制获得 IO 操作结果。Netty 的异步模型是建立在 future 和 callback 的基础上。

Future 表示异步的执行结果, 可以通过它提供的方法来检测执行是否完成，比如检索计算等。

## 工作原理示意图

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/netty/async-model.png)

说明: 
1. 在使用 Netty 编程时，拦截操作和转换出入站数据只需要提供 callback 或利用 future 即可。这使得链式操作简单、高效，并有利于编写可重用的、通用的代码。
2. Netty 框架的目标就是让你的业务逻辑从网络基础应用编码中分离出来、解脱出来。

## Future-Listener 机制

1. 当 Future 对象刚刚创建时，处于非完成状态，调用者可以通过返回的 ChannelFuture 来获取操作执行的状态，注册监听函数来执行完成后的操作。
2. 常见有如下操作：
    - 通过 isDone 方法来判断当前操作是否完成 
    - 通过 isSuccess 方法来判断已完成的当前操作是否成功
    - 通过 getCause 方法来获取已完成的当前操作失败的原因
    - 通过 isCancelled 方法来判断已完成的当前操作是否被取消
    - 通过 addListener 方法来注册监听器，当操作已完成(isDone 方法返回完成)，将会通知指定的监听器；如果 Future 对象已完成，则通知指定的监听器

### 代码示例

绑定端口是异步操作，当绑定操作处理完，将会调用相应的监听器处理逻辑

```
// 启动服务器, 绑定端口并设置同步
ChannelFuture channelFuture = bootstrap.bind(8080).sync();
// 给ChannelFuture注册监听器, 监控关心的事件
channelFuture.addListener(new ChannelFutureListener() {
    @Override
    public void operationComplete(ChannelFuture future) throws Exception {
        if (future.isSuccess()) {
            System.out.println("监听端口 8080 成功");
        } else {
            System.out.println("监听端口 8080 失败");
        }
    }
});
```

# 案例：HTTP 服务

```
public class HttpServer {

    public static void main(String[] args) {
        EventLoopGroup bossGroup = new NioEventLoopGroup();
        EventLoopGroup workerGroup = new NioEventLoopGroup();

        ServerBootstrap bootstrap = new ServerBootstrap();

        bootstrap.group(bossGroup, workerGroup)
                .channel(NioServerSocketChannel.class)
                .childHandler(new CustomHttpServerInitializer());

        try {
            ChannelFuture channelFuture = bootstrap.bind(8080).sync();
            channelFuture.channel().closeFuture().sync();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } finally {
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
}

class CustomHttpServerInitializer extends ChannelInitializer<SocketChannel> {

    @Override
    protected void initChannel(SocketChannel ch) throws Exception {
        // 得到管道
        ChannelPipeline pipeline = ch.pipeline();

        // 加入一个netty提供的http编解码器
        pipeline.addLast("httpServerCodec", new HttpServerCodec());
        // 增加一个自定义handler
        pipeline.addLast(new CustomHttpServer());
    }
}

class CustomHttpServer extends SimpleChannelInboundHandler<HttpObject> {

    /**
     * 读取客户端数据
     */
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, HttpObject msg) throws Exception {
        if (msg instanceof HttpRequest) {
            System.out.println("pipeline hash = " + ctx.pipeline().hashCode() + "handler hash = " + this.hashCode());

            System.out.println("客户端地址: " + ctx.channel().remoteAddress());

            // 请求信息
            HttpRequest httpRequest = (HttpRequest) msg;
            // 获取URI, 过滤指定资源
            URI uri = new URI(httpRequest.uri());
            if ("/favicon.ico".equals(uri.getPath())) {
                return;
            }

            // 回复信息给浏览器
            ByteBuf content = Unpooled.copiedBuffer("hello ~", CharsetUtil.UTF_8);

            // 构造http响应, 即httpResponse
            FullHttpResponse response = new DefaultFullHttpResponse(HttpVersion.HTTP_1_1, HttpResponseStatus.OK, content);

            response.headers().set(HttpHeaderNames.CONTENT_TYPE, "text/plain");
            response.headers().set(HttpHeaderNames.CONTENT_LENGTH, content.readableBytes());

            ctx.writeAndFlush(response);
        }
    }
}
```