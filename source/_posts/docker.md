title: docker入门指南
author: Haif.
tags:
  - Docker
categories:
  - Docker
date: 2020-06-14 12:00:00
copyright: true
---


## 什么是Docker

Docker 是一个开源的应用容器引擎，基于 Go 语言 并遵从 Apache2.0 协议开源。Docker 可以让开发者打包他们的应用以及依赖包到一个轻量级、可移植的容器中，然后发布到任何流行的 Linux 机器上，也可以实现虚拟化。

传统虚拟机技术是虚拟出一套硬件后，在其上运行一个完整操作系统，在该系统上再运行所需应用进程；而容器内的应用进程直接运行于宿主的内核，容器内没有自己的内核，而且也没有进行硬件虚拟。因此容器要比传统虚拟机更为轻便。

## 为什么要使用 Docker？

作为一种新兴的虚拟化方式，Docker 跟传统的虚拟化方式相比具有众多的优势。

### 更高效的利用系统资源

由于容器不需要进行硬件虚拟以及运行完整操作系统等额外开销，Docker对系统资源的利用率更高。无论是应用执行速度、内存损耗或者文件存储速度，都要比传统虚拟机技术更高效。因此，相比虚拟机技术，一个相同配置的主机，往往可以运行更多数量的应用。

<!-- more -->

### 更快速的启动时间

传统的虚拟机技术启动应用服务往往需要数分钟，而 Docker容器应用，由于直接运行于宿主内核，无需启动完整的操作系统，因此可以做到秒级、甚至毫秒级的启动时间。大大的节约了开发、测试、部署的时间。

### 一致的运行环境

开发过程中一个常见的问题是环境一致性问题。由于开发环境、测试环境、生产环境不一致，导致有些 bug 并未在开发过程中被发现。而 Docker 的镜像提供了除内核外完整的运行时环境，确保了应用运行环境一致性，从而不会再出现 「这段代码在我机器上没问题啊」 这类问题。

### 持续交付和部署

对开发和运维（DevOps）人员来说，最希望的就是一次创建或配置，可以在任意地方正常运行。使用 Docker 可以通过定制应用镜像来实现持续集成、持续交付、部署。开发人员可以通过Dockerfile 来进行镜像构建，并结合 持续集成(Continuous Integration) 系统进行集成测试，而运维人员则可以直接在生产环境中快速部署该镜像，甚至结合 持续部署(ContinuousDelivery/Deployment) 系统进行自动部署。而且使用 Dockerfile 使镜像构建透明化，不仅仅开发团队可以理解应用运行环境，也方便运维团队理解应用运行所需条件，帮助更好的生产环境中部署该镜像。

### 更轻松的迁移

由于 Docker 确保了执行环境的一致性，使得应用的迁移更加容易。Docker 可以在很多平台上运行，无论是物理机、虚拟机、公有云、私有云，甚至是笔记本，其运行结果是一致的。因此用户可以很轻易的将在一个平台上运行的应用，迁移到另一个平台上，而不用担心运行环境的变化导致应用无法正常运行的情况。

### 更轻松的维护和扩展

Docker 使用的分层存储以及镜像的技术，使得应用重复部分的复用更为容易，也使得应用的维护更新更加简单，基于基础镜像进一步扩展镜像也变得非常简单。此外，Docker 团队同各个开源项目团队一起维护了一大批高质量的 官方镜像，既可以直接在生产环境使用，又可以作为基础进一步定制，大大的降低了应用服务的镜像制作成本。

## 基本概念

### 镜像（Image）

Docker 镜像是一个特殊的文件系统，除了提供容器运行时所需的程序、库、资源、配置等文件外，还包含了一些为运行时准备的一些配置参数（如匿名卷、环境变量、用户等）。镜像不包含任何动态数据，其内容在构建之后也不会被改变。

### 容器（Container）

镜像（ Image ）和容器（ Container ）的关系，就像是面向对象程序设计中的 类 和 实例一样，镜像是静态的定义，容器是镜像运行时的实体。容器可以被创建、启动、停止、删除、暂停等。容器的实质是进程，但与直接在宿主执行的进程不同，容器进程运行于属于自己的独立的 命名空间。因此容器可以拥有自己的 root文件系统、自己的网络配置、自己的进程空间，甚至自己的用户 ID空间。容器内的进程是运行在一个隔离的环境里，使用起来，就好像是在一个独立于宿主的系统下操作一样。这种特性使得容器封装的应用比直接在宿主运行更加安全。

### 仓库（Repository）

Docker Registry 是集中的存储、分发镜像的服务，Docker Registry中可以包含多个仓库（ Repository ）；每个仓库可以包含多个标签（ Tag ）；每个标签对应一个镜像。

Docker Hub是官方也是默认的Registry，包含大量优质官方镜像。由于某些原因，在国内访问可能会比较慢，可以使用国内镜像仓库提高下载速度，下文安装过程将会介绍。

## 安装 Docker

Docker 划分为 CE 和 EE。CE 即社区版（免费，支持周期三个月），EE 即企业版，强调安全，付费使用。
官方网站上有各种环境下的 [安装指南](https://docs.docker.com/engine/install/)。以下将以centos为例进行安装：

1. 卸载旧版本
```
$ sudo yum remove docker \
                  docker-client \
                  docker-client-latest \
                  docker-common \
                  docker-latest \
                  docker-latest-logrotate \
                  docker-logrotate \
                  docker-engine
```

2. 安装依赖包
```
$ sudo yum install -y yum-utils \
device-mapper-persistent-data \
lvm2
```
3. 添加 yum 软件源

```
$ sudo yum-config-manager \
--add-repo \
http://mirrors.aliyun.com/repo/Centos-7.repo

# 下载阿里的dockerCE版的yum源
$ wget https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo -O /etc/yum.repos.d/docker-ce.repo
```
4. 安装 Docker CE
* 更新 yum 软件源缓存，并安装 docker-ce
 ```
$ sudo yum makecache fast
$ sudo yum install docker-ce
 ```
5. 启动 Docker CE
```
$ sudo systemctl enable docker
$ sudo systemctl start docker
```
6. 建立 docker 用户组
* 建立 docker 组：
```
$ sudo groupadd docker
```
* 将当前用户加入 docker 组：
```
$ sudo usermod -aG docker $USER
```
7. 镜像加速
* 在 /etc/docker/daemon.json 中写入如下内容（如果文件不存在新建该文件touch daemon.json）
```
{
  "registry-mirrors": ["https://bvitsvy3.mirror.aliyuncs.com"]
}
```
* 之后重新启动服务
```
$ sudo systemctl daemon-reload
$ sudo systemctl restart docker
```

8. 其他操作
* 设置docker开机启动
```
$ sudo systemctl enable docker
```
显示：Created symlink from /etc/systemd/system/multi-user.target.wants/docker.service to /usr/lib/systemd/system/docker.service.
* 更新xfsprogs
```
yum -y update xfsprogs
```
* 查看docker版本
```
docker version
```

## 使用镜像

### 获取镜像

```
$ docker pull [选项] [Docker Registry 地址[:端口号]/]仓库名[:标签]
```
具体的选项可以通过 docker pull --help 命令看到，这里我们说一下镜像名称的格式。

* Docker 镜像仓库地址：地址的格式一般是 <域名/IP>[:端口号] 。默认地址是 Docker
Hub。

* 仓库名：如之前所说，这里的仓库名是两段式名称，即 <用户名>/<软件名> 。对于 Docker
Hub，如果不给出用户名，则默认为 library ，也就是官方镜像。

### 列出镜像

```
$ docker image ls

REPOSITORY TAG IMAGE ID CREATED SIZE
redis latest 5f515359c7f8 5 days ago 183 M
B
nginx latest 05a60462f8ba 5 days ago 181 M
B
mongo 3.2 fe9198c04d62 5 days ago 342 M
B
<none> <none> 00285df0df87 5 days ago 342 M
B
ubuntu 16.04 f753707788c5 4 weeks ago 127 M
B
ubuntu latest f753707788c5 4 weeks ago 127 M
B
ubuntu 14.04 1e0c3dd64ccd 4 weeks ago 188 M
B
```
列表包含了 仓库名 、 标签 、 镜像 ID 、 创建时间 以及 所占用的空间 。

#### 镜像体积

Docker Hub 中显示的体积是压缩后的体积。docker image ls显示的是镜像下载到本地后，展开的大小，准确说，是展开后的各层所占空间的总和。

#### 虚悬镜像

上面的镜像列表中，还可以看到一个特殊的镜像，这个镜像既没有仓库名，也没有标签，均为 <none> 。：
```
<none> <none> 00285df0df87 5 days ago 342 M
B
```

这个镜像原本是有镜像名和标签的mongo:3.2，随着官方镜像维护，发布了新版本后，重新 docker pull 时， mongo:3.2 这个镜像名被转移到了新下载的镜像身上，而旧的镜像上的这个名称则被取消，从而成为了 <none> 。除了 docker pull 可能导致
这种情况， docker build 也同样可以导致这种现象。由于新旧镜像同名，旧镜像名称被取消，从而出现仓库名、标签均为 <none> 的镜像。这类无标签镜像也被称为 虚悬镜像(dangling image) ，可以用下面的命令专门显示这类镜像：
```
$ docker image ls -f dangling=true
REPOSITORY TAG IMAGE ID CREATED SIZE
<none> <none> 00285df0df87 5 days ago 342 MB
```
一般来说，虚悬镜像已经失去了存在的价值，是可以随意删除的，可以用下面的命令删除。
```
$ docker image prune
```

#### 中间层镜像
为了加速镜像构建、重复利用资源，Docker 会利用 中间层镜像。所以在使用一段时间后，可能会看到一些依赖的中间层镜像。默认的 docker image ls 列表中只会显示顶层镜像，如果
希望显示包括中间层镜像在内的所有镜像的话，需要加 -a 参数。
```
$ docker image ls -a
```
这样会看到很多无标签的镜像，与之前的虚悬镜像不同，这些无标签的镜像很多都是中间层镜像，是其它镜像所依赖的镜像。这些无标签镜像不应该删除，否则会导致上层镜像因为依赖丢失而出错。


### 删除本地镜像

```
$ docker image rm [选项] <镜像1> [<镜像2> ...]

# 配合docker image ls
$ docker image rm $(docker image ls -q redis)
```
其中， <镜像> 可以是 镜像短 ID 、 镜像长 ID 、 镜像名 或者 镜像摘要 。

### docker commit将容器保存为镜像

docker commit 命令除了学习之外，还有一些特殊的应用场合，比如被入侵后保存现场等。但是，不要使用 docker commit 定制镜像，定制镜像应该使用 Dockerfile 来完成。

docker commit 的语法格式为：
```
docker commit [选项] <容器ID或容器名> [<仓库名>[:<标签>]]
```

可以通过 docker diff 命令看到具体的改动。

### 使用 Dockerfile 定制镜像

* FROM 指定基础镜像

如果你以 scratch 为基础镜像的话，意味着你不以任何镜像为基础，接下来所写的指令将作
为镜像第一层开始存在。

* RUN 执行命令:
   * shell 格式： RUN <命令> ，就像直接在命令行中输入的命令一样。刚才写的 Dockerfile 中的 RUN 指令就是这种格式。
    ```
    RUN echo '<h1>Hello, Docker!</h1>' > /usr/share/nginx/html/index.html
    ```
   * exec 格式： RUN ["可执行文件", "参数1", "参数2"] ，这更像是函数调用中的格式。


### 构建镜像

在 Dockerfile 文件所在目录执行：
```
$ docker build [选项] <上下文路径/URL/->

$ docker build -t nginx:v3 .
```

### 镜像构建上下文（Context）

docker build 命令最后有一个 . 。 . 表示当前目录， 但是此目录不是指定Dockerfile路径，而是在指定上下文路径。

Docker 在运行时分为 Docker 引擎（也就是服务端守护进程）和客户端工具。Docker 的引擎提供了一组 REST API，被称为 Docker
Remote API，而如 docker 命令这样的客户端工具，则是通过这组 API 与 Docker 引擎交互，从而完成各种功能。因此，虽然表面上我们好像是在本机执行各种 docker 功能，但实际上，一切都是使用的远程调用形式在服务端（Docker 引擎）完成。

当构建的时候，用户会指定构建镜像上下文的路径， docker build 命令得知这个路径后，会将路径下的所有内容打包，然后上传给 Docker 引擎。这样Docker 引擎收到这个上下文包后，展开就会获得构建镜像所需的一切文件。如果在 Dockerfile 中这么写：
```
COPY ./package.json /app/
```
这并不是要复制执行 docker build 命令所在的目录下的 package.json ，也不是复制Dockerfile 所在目录下的 package.json ，而是复制 上下文（context） 目录下的package.json 。

在默认情况下，如果不额外指定 Dockerfile 的话，会将上下文目录下的名为 `Dockerfile` 的文件作为
Dockerfile。这只是默认行为，实际上 Dockerfile 的文件名并不要求必须为 Dockerfile ，而且并不要求必须位于上下文目录中，比如可以用 -f ../Dockerfile.php 参数指定某个文件作为Dockerfile 。

### Dockerfile 指令详解

[Dockerfie 官方文档](https://docs.docker.com/engine/reference/builder/)

[Dockerfile 最佳实践文档](https://docs.docker.com/engine/userguide/engimage/dockerfile_best-practices/)

[Docker 官方镜像 Dockerfile](https://github.com/docker-library/docs)

#### COPY 复制文件

```
COPY <源路径>... <目标路径>
COPY ["<源路径1>",... "<目标路径>"]
```
#### ADD 更高级的复制文件

ADD 指令和 COPY 的格式和性质基本一致。但是在 COPY 基础上增加了一些功能。比如 <源路径> 可以是一个 URL。
如果 <源路径> 为一个 tar 压缩文件的话，压缩格式为 gzip , bzip2 以及 xz 的情况下， ADD指令将会自动解压缩这个压缩文件到 <目标路径> 去。

#### CMD 容器启动命令

CMD 指令的格式和 RUN 相似，也是两种格式：
* shell 格式： CMD <命令>
* exec 格式： CMD ["可执行文件", "参数1", "参数2"...]
* 参数列表格式： CMD ["参数1", "参数2"...] 。在指定了 ENTRYPOINT 指令后，用 CMD 指定具体的参数。

#### ENTRYPOINT 入口点

ENTRYPOINT 的格式和 RUN 指令格式一样，分为 exec 格式和 shell 格式。
ENTRYPOINT 的目的和 CMD 一样，都是在指定容器启动程序及参数。 ENTRYPOINT 在运行时也可以替代，不过比 CMD 要略显繁琐，需要通过 docker run 的参数 --entrypoint 来指定。
当指定了 ENTRYPOINT 后， CMD 的含义就发生了改变，不再是直接的运行其命令，而是将CMD 的内容作为参数传给 ENTRYPOINT 指令，换句话说实际执行时，将变为：
```
<ENTRYPOINT> "<CMD>"
```

#### ENV 设置环境变量

格式有两种：
* ENV <key> <value>
* ENV <key1>=<value1> <key2>=<value2>...

```
ENV VERSION=1.0 DEBUG=on \
NAME="Happy Feet"
```

定义了环境变量，那么在后续的指令中，就可以使用这个环境变量。比如在官方 node 镜像Dockerfile 中，就有类似这样的代码：
```
ENV NODE_VERSION 7.2.0
RUN curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.ta
r.xz" \
&& curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
&& gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc \
&& grep " node-v$NODE_VERSION-linux-x64.tar.xz\$" SHASUMS256.txt | sha256sum -c - \
&& tar -xJf "node-v$NODE_VERSION-linux-x64.tar.xz" -C /usr/local --strip-components=
1 \
&& rm "node-v$NODE_VERSION-linux-x64.tar.xz" SHASUMS256.txt.asc SHASUMS256.txt \
&& ln -s /usr/local/bin/node /usr/local/bin/nodejs
```
#### ARG 构建参数

格式： ARG <参数名>[=<默认值>]

构建参数和 ENV 的效果一样，都是设置环境变量。所不同的是， ARG所设置的构建环境的环境变量，在将来容器运行时是不会存在这些环境变量的。但是不要因此就使用 ARG 保存密
码之类的信息，因为 docker history 还是可以看到所有值的。

Dockerfile 中的 ARG 指令是定义参数名称，以及定义其默认值。该默认值可以在构建命令docker build 中用 --build-arg <参数名>=<值> 来覆盖。

#### VOLUME 定义匿名卷
格式为：
* VOLUME ["<路径1>", "<路径2>"...]
* VOLUME <路径>

为了防止运行时用户忘记将动态文件所保存目录挂载为卷，在Dockerfile 中，我们可以事先指定某些目录挂载为匿名卷，这样在运行时如果用户不指定挂载，其应用也可以正常运行，不会向容器存储层写入大量数据。
```
VOLUME /data
```
这里的 /data 目录就会在运行时自动挂载为匿名卷，任何向 /data 中写入的信息都不会记录进容器存储层，从而保证了容器存储层的无状态化。当然，运行时可以覆盖这个挂载设
置。比如：
```
docker run -d -v mydata:/data xxxx
```
在这行命令中，就使用了 mydata 这个命名卷挂载到了 /data 这个位置，替代了Dockerfile 中定义的匿名卷的挂载配置。

#### EXPOSE 声明端口
格式为 EXPOSE <端口1> [<端口2>...] 。

EXPOSE 指令是声明运行时容器提供服务端口，这只是一个声明，在运行时并不会因为这个声明应用就会开启这个端口的服务。在 Dockerfile 中写入这样的声明有两个好处，一个是帮助镜像使用者理解这个镜像服务的守护端口，以方便配置映射；另一个用处则是在运行时使用随机端口映射时，也就是 `docker run -P `时，会自动随机映射 EXPOSE 的端口。

要将 EXPOSE 和在运行时使用 -p <宿主端口>:<容器端口> 区分开来。 `-p` ，是映射宿主端口和容器端口，换句话说，就是将容器的对应端口服务公开给外界访问，而 EXPOSE 仅仅是声明容器打算使用什么端口而已，并不会自动在宿主进行端口映射。

#### WORKDIR 指定工作目录
格式为 WORKDIR <工作目录路径> 。
使用 WORKDIR 指令可以来指定工作目录（或者称为当前目录），以后各层的当前目录就被改为指定的目录，如该目录不存在， WORKDIR 会帮你建立目录。

#### USER 指定当前用户
格式： USER <用户名>

USER 指令和 WORKDIR 相似，都是改变环境状态并影响以后的层。 WORKDIR 是改变工作目录， USER 则是改变之后层的执行 RUN , CMD 以及 ENTRYPOINT 这类命令的身份。当然，和 WORKDIR 一样， USER 只是帮助你切换到指定用户而已，这个用户必须是事先建立好的，否则无法切换。
```
RUN groupadd -r redis && useradd -r -g redis redis
USER redis
RUN [ "redis-server" ]
```
如果以 root 执行的脚本，在执行期间希望改变身份，比如希望以某个已经建立好的用户来运行某个服务进程，不要使用 su 或者 sudo ，这些都需要比较麻烦的配置，而且在 TTY 缺失的环境下经常出错。建议使用 gosu 。

```
# 建立 redis 用户，并使用 gosu 换另一个用户执行命令
RUN groupadd -r redis && useradd -r -g redis redis
# 下载 gosu
RUN wget -O /usr/local/bin/gosu "https://github.com/tianon/gosu/releases/download/1.7/
gosu-amd64" \
&& chmod +x /usr/local/bin/gosu \
&& gosu nobody true
# 设置 CMD，并以另外的用户执行
CMD [ "exec", "gosu", "redis", "redis-server" ]
```

#### HEALTHCHECK 健康检查
格式：
HEALTHCHECK [选项] CMD <命令> ：设置检查容器健康状况的命令
HEALTHCHECK NONE ：如果基础镜像有健康检查指令，使用这行可以屏蔽掉其健康检查指令

#### ONBUILD 为他人做嫁衣裳
格式： ONBUILD <其它指令> 。
ONBUILD 是一个特殊的指令，它后面跟的是其它指令，比如 RUN , COPY 等，而这些指令，在当前镜像构建时并不会被执行。只有当以当前镜像为基础镜像，去构建下一级镜像的时候才会被执行。

### 其它制作镜像的方式

#### 从 rootfs 压缩包导入
```
docker import [选项] <文件>|<URL>|- [<仓库名>[:<标签>]]
```

#### docker save 和 docker load
Docker提供了 docker load 和 docker save 命令，用以将镜像保存为一个 tar 文件，然后传输到另一个位置上，再加载进来。
例如：
```
$ docker save alpine | gzip > alpine-latest.tar.gz
$ docker load -i alpine-latest.tar.gz
```

## 操作 Docker 容器

### 启动容器

* 新建并启动
所需要的命令主要为 docker run 。
例如:
```
$ docker run -t -i ubuntu:14.04 /bin/bash
root@af8bae53bdd3:/#
```
其中， -t 选项让Docker分配一个伪终端（pseudo-tty）并绑定到容器的标准输入上， -i则让容器的标准输入保持打开。

当利用 docker run 来创建容器时，Docker 在后台运行的标准操作包括：
* 检查本地是否存在指定的镜像，不存在就从公有仓库下载
* 利用镜像创建并启动一个容器
* 分配一个文件系统，并在只读的镜像层外面挂载一层可读写层
* 从宿主主机配置的网桥接口中桥接一个虚拟接口到容器中去
* 从地址池配置一个 ip 地址给容器
* 执行用户指定的应用程序
* 执行完毕后容器被终止

### 后台运行 
使用 `-d` 参数

### 启动已终止容器 
`docker container start `

### 终止容器 
`docker container stop`

### 进入容器 
* `docker attach [OPTIONS]`
* `docker exec -it [OPTIONS]`

### 导出和导入容器

#### 导出容器
如果要导出本地某个容器，可以使用 docker export 命令。
```
$ docker container ls -a
CONTAINER ID IMAGE COMMAND CREATED STATUS
PORTS NAMES
7691a814370e ubuntu:14.04 "/bin/bash" 36 hours ago Exited
(0) 21 hours ago test
$ docker export 7691a814370e > ubuntu.tar
```
这样将导出容器快照到本地文件。

#### 导入容器快照
可以使用 docker import 从容器快照文件中再导入为镜像，例如
```
$ cat ubuntu.tar | docker import - test/ubuntu:v1.0
$ docker image ls
REPOSITORY TAG IMAGE ID CREATED VIRTU
AL SIZE
test/ubuntu v1.0 9d37a6082e97 About a minute ago 171.3
MB
```
此外，也可以通过指定 URL 或者某个目录来导入，例如
```
$ docker import http://example.com/exampleimage.tgz example/imagerepo
```

#### 删除容器
可以使用` docker container rm` 来删除一个处于终止状态的容器。例如
```
$ docker container rm trusting_newton
trusting_newton
```
如果要删除一个运行中的容器，可以添加` -f `参数。Docker 会发送 SIGKILL 信号给容器。

#### 清理所有处于终止状态的容器
```
$ docker container prune
```

## Docker 数据管理

### 数据卷（Volumes）

数据卷 是一个可供一个或多个容器使用的特殊目录，它绕过 UFS，可以提供很多有用的特性：
* 数据卷 可以在容器之间共享和重用
* 对数据卷的修改会立马生效
* 对数据卷的更新，不会影响镜像
* 数据卷 默认会一直存在，即使容器被删除

#### 创建一个数据卷
```
$ docker volume create my-vol
```
#### 查看所有的 数据卷
```
$ docker volume ls
local my-vol
```
在主机里使用以下命令可以查看指定 数据卷 的信息
```
$ docker volume inspect my-vol
[
{
"Driver": "local",
"Labels": {},
"Mountpoint": "/var/lib/docker/volumes/my-vol/_data",
"Name": "my-vol",
"Options": {},
"Scope": "local"
}
]
```
在主机里使用以下命令可以查看 web 容器的信息
```
$ docker inspect web
```
#### 启动一个挂载数据卷的容器
在用 docker run 命令的时候，使用 --mount 标记来将 数据卷 挂载到容器里。在一次docker run 中可以挂载多个 数据卷 。
下面创建一个名为 web 的容器，并加载一个 数据卷 到容器的 /webapp 目录。
```
$ docker run -d -P \
--name web \
# -v my-vol:/wepapp \
--mount source=my-vol,target=/webapp \
training/webapp \
python app.py
```
#### 删除数据卷
```
$ docker volume rm my-vol
```
删除未使用的数据卷
```
$ docker volume prune
```
### 挂载主机目录 (Bind mounts)
使用 --mount 标记可以指定挂载一个本地主机的目录到容器中去。
```
$ docker run -d -P \
--name web \
# -v /src/webapp:/opt/webapp \
--mount type=bind,source=/src/webapp,target=/opt/webapp \
training/webapp \
python app.py
```
上面的命令加载主机的 /src/webapp 目录到容器的 /opt/webapp 目录。使用 -v 参数时如果本地目录不存在 Docker 会自动创建一个文件夹，现在使用 --mount 参数时如果本地目录不存在，Docker 会报错。

Docker 挂载主机目录的默认权限是 读写 ，用户也可以通过增加 readonly 指定为 只读 。
```
$ docker run -d -P \
--name web \
# -v /src/webapp:/opt/webapp:ro \
--mount type=bind,source=/src/webapp,target=/opt/webapp,readonly \
training/webapp \
python app.py
```
加了 readonly 之后，就挂载为 只读 了。如果你在容器内 /opt/webapp 目录新建文件，会
显示如下错误
```
/opt/webapp # touch new.txt
touch: new.txt: Read-only file system
```

## Docker中的网络功能
Docker 允许通过外部访问容器或容器互联的方式来提供网络服务。

### 外部访问容器
通过 `-P` 或 `-p` 参数来指定端口映射。当使用 -P 标记时，Docker 会随机映射一个 49000~49900 的端口到内部容器开放的网络端口。
-p 则可以指定要映射的端口，并且，在一个指定端口上只可以绑定一个容器。支持的格式有:

1. ip:hostPort:containerPort : 映射到指定地址的指定端口
2. ip::containerPort : 映射到指定地址的任意端口
3. hostPort:containerPort : 映射所有接口地址

使用 `hostPort:containerPort` 格式本地的 5000 端口映射到容器的 5000 端口，可以执行
```
$ docker run -d -p 5000:5000 training/webapp python app.py
```
此时默认会绑定本地所有接口上的所有地址。

### 容器互联

#### 新建网络
下面先创建一个新的 Docker 网络。
```
$ docker network create -d bridge my-net
```
-d 参数指定 Docker 网络类型，有 bridge overlay 。其中 overlay 网络类型用于Swarm mode。

#### 连接容器
运行一个容器并连接到新建的 my-net 网络
```
$ docker run -it --rm --name busybox1 --network my-net busybox sh
```
打开新的终端，再运行一个容器并加入到 my-net 网络
```
$ docker run -it --rm --name busybox2 --network my-net busybox sh
```
这样， busybox1 容器和 busybox2 容器建立了互联关系。

## Docker Compose
[Docker Compose](https://github.com/docker/compose) 是 Docker 官方编排（Orchestration）项目之一，负责快速的部署分布式应用。

Compose允许用户通过一个单独的 docker-compose.yml 模板文件来定义一组相关联的应用容器为一个项目（project）。
Compose 中有两个重要的概念：
* 服务 ( service )：一个应用的容器，实际上可以包括若干运行相同镜像的容器实例。
* 项目 ( project )：由一组关联的应用容器组成的一个完整业务单元，在 dockercompose.yml 文件中定义。

Compose 的默认管理对象是项目，通过子命令对项目中的一组容器进行便捷地生命周期管理。
Compose 项目由 Python 编写，实现上调用了 Docker 服务提供的 API 来对容器进行管理。因此，只要所操作的平台支持 Docker API，就可以在其上利用 Compose 来进行编排管理。

### 安装与卸载

Docker for Mac 、 Docker for Windows 自带 docker-compose 二进制文件，安装 Docker 之后可以直接使用。
```
$ docker-compose --version
docker-compose version 1.25.0, build 0a186604
```
linux:直接下载对应的二进制包。
```
$ sodo curl -L https://github.com/docker/compose/releases/download/1.25.0/docker-compose-`uname -s`-`uname -m` -o /usr/local/bin/docker-compose
$ sudo chmod +x /usr/local/bin/docker-compose
```

### 卸载
```
$ sudo rm /usr/local/bin/docker-compose
```
### 使用

docker-compose.yml
编写 docker-compose.yml 文件，这个是 Compose 使用的主模板文件。
```
version: '3'
services:
    web:
        build: .
        ports:
            - "5000:5000"
    redis:
        image: "redis:alpine"
```
运行 compose 项目
```
$ docker-compose up
```
### Compose 命令说明
docker-compose 命令的基本的使用格式是
```
docker-compose [-f=<arg>...] [options] [COMMAND] [ARGS...]
```
#### 命令选项
* -f, --file FILE 指定使用的 Compose 模板文件，默认为 docker-compose.yml ，可以
多次指定。
* -p, --project-name NAME 指定项目名称，默认将使用所在目录名称作为项目名。
* --x-networking 使用 Docker 的可拔插网络后端特性
* --x-network-driver DRIVER 指定网络后端的驱动，默认为 bridge
* --verbose 输出更多调试信息。
* -v, --version 打印版本并退出。

#### 命令使用说明

##### build
格式为 `docker-compose build [options] [SERVICE...] `。构建（重新构建）项目中的服务容器。
服务容器一旦构建后，将会带上一个标记名，例如对于 web 项目中的一个 db 容器，可能是web_db。可以随时在项目目录下运行 docker-compose build 来重新构建服务。选项包括：
* --force-rm 删除构建过程中的临时容器。
* --no-cache 构建镜像过程中不使用 cache（这将加长构建过程）。
* --pull 始终尝试通过 pull 来获取更新版本的镜像。

##### config
验证 Compose 文件格式是否正确，若正确则显示配置，若格式错误显示错误原因。

##### down
此命令将会停止 up 命令所启动的容器，并移除网络

##### exec
进入指定的容器。

##### help
获得一个命令的帮助。

##### images
列出 Compose 文件中包含的镜像。

##### kill
格式为 `docker-compose kill [options] [SERVICE...] `。通过发送 SIGKILL 信号来强制停止服务容器。
支持通过 -s 参数来指定发送的信号，例如通过如下指令发送 SIGINT 信号。
`$ docker-compose kill -s SIGINT`
##### logs
格式为 `docker-compose logs [options] [SERVICE...] `。查看服务容器的输出。默认情况下，docker-compose 将对不同的服务输出使用不同的颜色来区分。可以通过 --no-color 来关闭颜色。该命令在调试问题的时候十分有用。

##### pause
格式为 `docker-compose pause [SERVICE...]` 。
暂停一个服务容器。

##### port
格式为 `docker-compose port [options] SERVICE PRIVATE_PORT` 。打印某个容器端口所映射的公共端口。
选项：
* --protocol=proto 指定端口协议，tcp（默认值）或者 udp。
* --index=index 如果同一服务存在多个容器，指定命令对象容器的序号（默认为 1）。

##### ps
格式为 `docker-compose ps [options] [SERVICE...] `。列出项目中目前的所有容器。
选项：
* -q 只打印容器的 ID 信息。

##### pull
格式为 `docker-compose pull [options] [SERVICE...] `。拉取服务依赖的镜像。
选项：
* --ignore-pull-failures 忽略拉取镜像过程中的错误。

##### push
推送服务依赖的镜像到 Docker 镜像仓库。

##### restart
格式为 `docker-compose restart [options] [SERVICE...] `。重启项目中的服务。
选项：
* -t, --timeout TIMEOUT 指定重启前停止容器的超时（默认为 10 秒）。

##### rm
格式为 `docker-compose rm [options] [SERVICE...] `。删除所有（停止状态的）服务容器。推荐先执行 docker-compose stop 命令来停止容器。
选项：
* -f, --force 强制直接删除，包括非停止状态的容器。一般尽量不要使用该选项。
* -v 删除容器所挂载的数据卷。

##### run
格式为 `docker-compose run [options] [-p PORT...] [-e KEY=VAL...] SERVICE [COMMAND] [ARGS...] `。在指定服务上执行一个命令。
例如：
`$ docker-compose run ubuntu ping docker.com`
将会启动一个 ubuntu 服务容器，并执行 ping docker.com 命令。默认情况下，如果存在关联，则所有关联的服务将会自动被启动，除非这些服务已经在运行
中。该命令类似启动容器后运行指定的命令，相关卷、链接等等都将会按照配置自动创建。

两个不同点：
给定命令将会覆盖原有的自动运行命令；
不会自动创建端口，以避免冲突。

如果不希望自动启动关联的容器，可以使用 --no-deps 选项，例如
`$ docker-compose run --no-deps web python manage.py shell`
将不会启动 web 容器所关联的其它容器。

选项：

* -d 后台运行容器。
* --name NAME 为容器指定一个名字。
* --entrypoint CMD 覆盖默认的容器启动指令。
* -e KEY=VAL 设置环境变量值，可多次使用选项来设置多个环境变量。
* -u, --user="" 指定运行容器的用户名或者 uid。
* --no-deps 不自动启动关联的服务容器。
* --rm 运行命令后自动删除容器， d 模式下将忽略。
* -p, --publish=[] 映射容器端口到本地主机。
* --service-ports 配置服务端口并映射到本地主机。
* -T 不分配伪 tty，意味着依赖 tty 的指令将无法运行。

##### scale
格式为 `docker-compose scale [options] [SERVICE=NUM...] `。设置指定服务运行的容器个数。
通过 service=num 的参数来设置数量。例如：
`$ docker-compose scale web=3 db=2`
将启动 3 个容器运行 web 服务，2 个容器运行 db 服务。一般的，当指定数目多于该服务当前实际运行容器，将新创建并启动容器；反之，将停止容器。
选项：
* -t, --timeout TIMEOUT 停止容器时候的超时（默认为 10 秒）。

##### start
格式为 `docker-compose start [SERVICE...] `。启动已经存在的服务容器。

##### stop
格式为 `docker-compose stop [options] [SERVICE...] `。停止已经处于运行状态的容器，但不删除它。

选项：
* -t, --timeout TIMEOUT 停止容器时候的超时（默认为 10 秒）。

##### top
格式为 `docker-compose top [SERVICE...] `。查看各个服务容器内运行的进程。

##### unpause
格式为 `docker-compose unpause [SERVICE...] `。恢复处于暂停状态中的服务。

##### up
格式为 `docker-compose up [options] [SERVICE...] `。该命令十分强大，它将尝试自动完成包括构建镜像，（重新）创建服务，启动服务，并关联
服务相关容器的一系列操作。链接的服务都将会被自动启动，除非已经处于运行状态。可以说，大部分时候都可以直接通过该命令来启动一个项目。

默认情况， `docker-compose up `启动的容器都在前台，控制台将会同时打印所有容器的输出信息，可以很方便进行调试。当通过 Ctrl-C 停止命令时，所有容器将会停止。

如果使用 `docker-compose up -d `，将会在后台启动并运行所有的容器。一般推荐生产环境下使用该选项。

默认情况，如果服务容器已经存在， `docker-compose up `将会尝试停止容器，然后重新创建（保持使用 volumes-from 挂载的卷），以保证新启动的服务匹配 docker-compose.yml 文件的最新内容。如果用户不希望容器被停止并重新创建，可以使用 `docker-compose up --norecreate`。这样将只会启动处于停止状态的容器，而忽略已经运行的服务。如果用户只想重新部署某个服务，可以使用 `docker-compose up --no-deps -d <SERVICE_NAME> `来重新创建服务并后台停止旧服务，启动新服务，并不会影响到其所依赖的服务。

选项：
* -d 在后台运行服务容器。
* --no-color 不使用颜色来区分不同的服务的控制台输出。
* --no-deps 不启动服务所链接的容器。
* --force-recreate 强制重新创建容器，不能与 --no-recreate 同时使用。
* --no-recreate 如果容器已经存在了，则不重新创建，不能与 --force-recreate 同时使
用。
* --no-build 不自动构建缺失的服务镜像。
* -t, --timeout TIMEOUT 停止容器时候的超时（默认为 10 秒）。

##### version
格式为 `docker-compose version `。打印版本信息。


#### Compose 模板文件

默认的模板文件名称为 docker-compose.yml ，格式为 YAML 格式。
```
version: "3"
services:
    webapp:
        image: examples/web
    ports:
        - "80:80"
    volumes:
        - "/data"
```

每个服务都必须通过 image 指令指定镜像或 build 指令（需要 Dockerfile）等来自动构建生成镜像。
如果使用 build 指令，在 Dockerfile 中设置的选项(例如： CMD , EXPOSE , VOLUME , ENV等) 将会自动被获取，无需在 docker-compose.yml 中再次设置。

##### build
指定 Dockerfile 所在文件夹的路径（可以是绝对路径，或者相对 docker-compose.yml 文件的路径）。 Compose 将会利用它自动构建这个镜像，然后使用这个镜像。
```
version: '3'
services:
    webapp:
    build: ./dir
```

也可以使用 context 指令指定 Dockerfile 所在文件夹的路径。
使用 dockerfile 指令指定 Dockerfile 文件名。
使用 arg 指令指定构建镜像时的变量;
```
version: '3'
services:
    webapp:
    build:
    context: ./dir
    dockerfile: Dockerfile-alternate
    args:
        buildno: 1
```
使用 cache_from 指定构建镜像的缓存
```
build:
    context: .
    cache_from:
        - alpine:latest
        - corp/web_app:3.14
```

#### cap_add, cap_drop
指定容器的内核能力（capacity）分配。

例如，让容器拥有所有能力可以指定为：
```
cap_add:
- ALL
```
去掉 NET_ADMIN 能力可以指定为：
```
cap_drop:
- NET_ADMIN
```

#### command
覆盖容器启动后默认执行的命令。
```
command: echo "hello world"
```
#### configs
仅用于 Swarm mode

#### cgroup_parent
指定父 cgroup 组，意味着将继承该组的资源限制。

例如，创建了一个 cgroup 组名称为 cgroups_1 。
```
cgroup_parent: cgroups_1
```

#### container_name
指定容器名称。默认将会使用 `项目名称_服务名称_序号` 这样的格式。
```
container_name: docker-web-container
```

#### deploy
仅用于 Swarm mode

#### devices
指定设备映射关系。
```
devices:
    - "/dev/ttyUSB1:/dev/ttyUSB0"
```

#### depends_on
解决容器的依赖、启动先后的问题。以下例子中会先启动 redis db 再启动 web
```
version: '3'
services:
    web:
    build: .
    depends_on:
        - db
        - redis
    redis:
        image: redis
    db:
        image: postgres
```
注意： web 服务不会等待 redis db 「完全启动」之后才启动。

#### dns
自定义 DNS 服务器。可以是一个值，也可以是一个列表。
```
dns: 8.8.8.8

dns:
    - 8.8.8.8
    - 114.114.114.114
```

#### dns_search
配置 DNS 搜索域。可以是一个值，也可以是一个列表。
```
dns_search: example.com
dns_search:
    - domain1.example.com
    - domain2.example.com
```

#### tmpfs
挂载一个 tmpfs 文件系统到容器。
```
tmpfs: /run
tmpfs:
    - /run
    - /tmp
```

#### env_file
从文件中获取环境变量，可以为单独的文件路径或列表。

如果通过 docker-compose -f FILE 方式来指定 Compose 模板文件，则 env_file 中变量的路径会基于模板文件路径。
如果有变量名称与 environment 指令冲突，则按照惯例，以后者为准。
```
env_file: .env
env_file:
    - ./common.env
    - ./apps/web.env
    - /opt/secrets.env
```
环境变量文件中每一行必须符合格式，支持 # 开头的注释行。
```
# common.env: Set development environment
PROG_ENV=development
```

#### environment
设置环境变量。你可以使用数组或字典两种格式。
只给定名称的变量会自动获取运行 Compose 主机上对应变量的值，可以用来防止泄露不必要的数据。
```
environment:
    RACK_ENV: development
    SESSION_SECRET:
environment:
    - RACK_ENV=development
    - SESSION_SECRET
```
如果变量名称或者值中用到 true|false，yes|no 等表达 布尔 含义的词汇，最好放到引号里，避免 YAML 自动解析某些内容为对应的布尔语义。这些特定词汇，包括
`y|Y|yes|Yes|YES|n|N|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF`

#### expose
暴露端口，但不映射到宿主机，只被连接的服务访问。仅可以指定内部端口为参数
```
expose:
    - "3000"
    - "8000"
```
#### external_links
注意：不建议使用该指令。

链接到 docker-compose.yml 外部的容器，甚至并非 Compose 管理的外部容器。
```
external_links:
    - redis_1
    - project_db_1:mysql
    - project_db_1:postgresql
```
#### extra_hosts
类似 Docker 中的 --add-host 参数，指定额外的 host 名称映射信息。
```
extra_hosts:
    - "googledns:8.8.8.8"
    - "dockerhub:52.1.157.61"
```
会在启动后的服务容器中 /etc/hosts 文件中添加如下两条条目。
8.8.8.8 googledns
52.1.157.61 dockerhub

#### healthcheck
通过命令检查容器是否健康运行。
```
healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost"]
    interval: 1m30s
    timeout: 10s
    retries: 3
```
#### image
指定为镜像名称或镜像 ID。如果镜像在本地不存在， Compose 将会尝试拉取这个镜像。
```
image: ubuntu
image: orchardup/postgresql
image: a4bc65fd
```
#### labels
为容器添加 Docker 元数据（metadata）信息。例如可以为容器添加辅助说明信息。
```
labels:
    com.startupteam.description: "webapp for a startup team"
    com.startupteam.department: "devops department"
    com.startupteam.release: "rc3 for v1.0"
```
#### links
注意：不推荐使用该指令。

#### logging
配置日志选项。
```
logging:
    driver: syslog
    options:
        syslog-address: "tcp://192.168.0.42:123"
```
目前支持三种日志驱动类型。
driver: "json-file"
driver: "syslog"
driver: "none"


options 配置日志驱动的相关参数。
```
options:
    max-size: "200k"
    max-file: "10"
```

#### network_mode
设置网络模式。使用和 docker run 的 --network 参数一样的值。
```
network_mode: "bridge"
network_mode: "host"
network_mode: "none"
network_mode: "service:[service name]"
network_mode: "container:[container name/id]"
```
#### networks
配置容器连接的网络。
```
version: "3"
services:
    some-service:
        networks:
            - some-network
            - other-network
networks:
    some-network:
    other-network:
```
#### pid
跟主机系统共享进程命名空间。打开该选项的容器之间，以及容器和宿主机系统之间可以通过进程 ID 来相互访问和操作。
```
pid: "host"
```

#### ports
暴露端口信息。

使用宿主端口：容器端口 (HOST:CONTAINER) 格式，或者仅仅指定容器的端口（宿主将会随机选择端口）都可以。
```
ports:
    - "3000"
    - "8000:8000"
    - "49100:22"
    - "127.0.0.1:8001:8001"
```
注意：当使用 HOST:CONTAINER 格式来映射端口时，如果你使用的容器端口小于 60 并且没放到引号里，可能会得到错误结果，因为 YAML 会自动解析 xx:yy 这种数字格式为 60 进制。为避免出现这种问题，建议数字串都采用引号包括起来的字符串格式。

#### secrets
存储敏感数据，例如 mysql 服务密码。
```
version: "3"
services:
    mysql:
    image: mysql
    environment:
        MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_password
    secrets:
        - db_root_password
        - my_other_secret
secrets:
    my_secret:
        file: ./my_secret.txt
    my_other_secret:
        external: true
```
#### security_opt
指定容器模板标签（label）机制的默认属性（用户、角色、类型、级别等）。例如配置标签的用户名和角色名。
```
security_opt:
    - label:user:USER
    - label:role:ROLE
```
#### stop_signal

设置另一个信号来停止容器。在默认情况下使用的是 SIGTERM 停止容器。
```
stop_signal: SIGUSR1
```

#### sysctls
配置容器内核参数。
```
sysctls:
    net.core.somaxconn: 1024
    net.ipv4.tcp_syncookies: 0
    
sysctls:
    - net.core.somaxconn=1024
    - net.ipv4.tcp_syncookies=0
```

#### ulimits
指定容器的 ulimits 限制值。
例如，指定最大进程数为 65535，指定文件句柄数为 20000（软限制，应用可以随时修改，不能超过硬限制） 和 40000（系统硬限制，只能 root 用户提高）。
```
ulimits:
    nproc: 65535
    nofile:
        soft: 20000
        hard: 40000
```

#### volumes
数据卷所挂载路径设置。可以设置宿主机路径 （ HOST:CONTAINER ） 或加上访问模式（ HOST:CONTAINER:ro ）。该指令中路径支持相对路径。
```
volumes:
    - /var/lib/mysql
    - cache/:/tmp/cache
    - ~/configs:/etc/configs/:ro
```

#### 其它指令

指定服务容器启动后执行的入口文件。
```
entrypoint: /code/entrypoint.sh
```
指定容器中运行应用的用户名。
```
user: nginx
```
指定容器中工作目录。
```
working_dir: /code
```
指定容器中搜索域名、主机名、mac 地址等。
```
domainname: your_website.com
hostname: test
mac_address: 08-00-27-00-0C-0A
```
允许容器中运行一些特权命令。
```
privileged: true
```
指定容器退出后的重启策略为始终重启。该命令对保持服务始终运行十分有效，在生产环境中推荐配置为 always 或者 unless-stopped 。
```
restart: always
```
以只读模式挂载容器的 root 文件系统，意味着不能对容器内容进行修改。
```
read_only: true
```
打开标准输入，可以接受外部输入。
```
stdin_open: true
```
模拟一个伪终端。
```
tty: true
```
读取变量
Compose 模板文件支持动态读取主机的系统环境变量和当前目录下的 .env 文件中的变量。
例如，下面的 Compose 文件将从运行它的环境中读取变量 ${MONGO_VERSION} 的值，并写入
执行的指令中。
```
version: "3"
services:
db:
image: "mongo:${MONGO_VERSION}"
```
如果执行` MONGO_VERSION=3.2 docker-compose up `则会启动一个 mongo:3.2 镜像的容器；如果执行 `MONGO_VERSION=2.8 docker-compose up `则会启动一个 mongo:2.8 镜像的容器。若当前目录存在 .env 文件，执行 docker-compose 命令时将从该文件中读取变量。在当前目录新建 .env 文件并写入以下内容。
```
# 支持 # 号注释
MONGO_VERSION=3.6
```
执行 docker-compose up 则会启动一个 mongo:3.6 镜像的容器。

## Docker常用命令

* 获取镜像: docker pull [选项] [Docker Registry 地址[:端口号]/]仓库名[:标签]
* 列出镜像：docker image ls
  * -a: 列出中间层镜像
* 查看镜像、容器、数据卷所占用的空间：docker system df
* 列出所有虚悬镜像：docker image ls -f dangling=true
* 删除未使用的镜像：docker image prune [OPTIONS]
  *  --all , -a:	    Remove all unused images, not just dangling ones 删除所有未使用的映像，而不仅仅是悬空映像
  * --filter:		Provide filter values (e.g. ‘until=') 提供过滤值（例如'until =“）
  * --force , -f:	Do not prompt for confirmation 不要提示确认
* 容器停止：docker stop 容器名称
* 启动容器：docker start 容器名称
* 进入容器：
  * docker attach [OPTIONS]
  * docker exec -it [OPTIONS]
* 删除容器：docker rm 容器名称
* 删除镜像：docker rmi 镜像名称
* 查看运行的所有容器：docker ps
* 查看所有容器：docker ps -a
* 容器复制文件到物理机：docker cp 容器名称:容器目录 物理机目录
* 物理机复制文件到容器：docker cp 物理机目录 容器名称:容器目录