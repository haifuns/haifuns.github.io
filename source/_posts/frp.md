title: 内网穿透工具 -- Frp
author: Haif.
tags:
  - Frp
categories:
  - 工具
date: 2019-11-02 21:13:00
copyright: true
---
### 简介
frp 是一个可用于内网穿透的高性能的反向代理应用，支持 tcp, udp 协议，为 http 和 https 应用协议提供了额外的能力，且尝试性支持了点对点穿透。

> github:https://github.com/fatedier/frp

### FRP 安装

* 软件包下载

```
-- 服务端
wget https://github.com/fatedier/frp/releases/download/v0.29.0/frp_0.29.0_linux_amd64.tar.gz
tar xzvf frp_0.29.0_linux_amd64.tar.gz
mv frp_0.29.0_linux_amd64 frp

-- 客户端
https://github.com/fatedier/frp/releases/download/v0.29.0/frp_0.29.0_windows_amd64.zip
```
> 更多版本前往：https://github.com/fatedier/frp/releases

<!-- more -->

### 起步

> 这里以linux作为服务端，windows作为客户端实现web服务http/https穿透

### 简单连接

* 服务端

默认配置中监听的是 7000 端口，可根据自己实际情况修改
```
$ vi frps.ini

[common]
bind_port = 7000 

# 最大连接数 
max_pool_count = 500   
# 客户端映射的端口  
vhost_http_port = 9527                                                                 
# 服务器看板的访问端口                                                                 
dashboard_port = 7500
# 服务器看板账户       
dashboard_user = root 
# 服务器看板密码
dashboard_pwd = 123456 
```
启动
```
./frps -c ./frps.ini
```

* 客户端

修改frpc.ini文件
```
[common]
# server_addr 为 FRP 服务端的公网 IP
server_addr = 127.0.0.1
# server_port 为 FRP 服务端监听的端口
server_port = 7000
```
cmd cd到目录下执行.\frpc.exe -c frpc.ini
这样就可以成功在 FRP 服务端上成功建立一个客户端连接，此时我们还没有注册任何端口映射

### 通过 TCP 访问内网机器
frpc.ini添加
```
[ssh]
type = tcp
local_ip = 127.0.0.1
local_port = 22
remote_port = 6000
```
这样就在 FRP 服务端上成功注册了一个端口为 6000 的服务，接下来我们就可以通过这个端口访问内网机器上 SSH 服务，假设用户名为 frp：
$ ssh -oPort=6000 frp@公网IP

### 通过自定义域名访问部署于内网的 Web 服务
* 服务端

```
$ vim frps.ini
[common]
bind_port = 7000
# HTTP 访问端口以8080为例，自改
vhost_http_port = 8080

$ ./frps -c ./frps.ini
```
* 客户端

frpc.ini添加
```
[web]
# type = https对应的服务端vhost_http_port改为vhost_https_port
type = http
# 内网端口
local_port = 80
# 使用域名需要将域名A记录解析到 FRP 服务器的公网 IP
custom_domains = 服务端域名/ip
```
启动客户端即可以通过 http://服务端域名/ip:8080访问内网http://ip:80服务

### 为本地 HTTP 服务启用 HTTPS

通过 https2http 插件可以让本地 HTTP 服务转换成 HTTPS 服务对外提供。

启用 frpc，启用 https2http 插件，配置如下:
frpc.ini
```
[common]
server_addr = x.x.x.x
server_port = 7000

[test_htts2http]
type = https
custom_domains = test.yourdomain.com

plugin = https2http
plugin_local_addr = 127.0.0.1:80

# HTTPS 证书相关的配置
plugin_crt_path = ./server.crt
plugin_key_path = ./server.key
plugin_host_header_rewrite = 127.0.0.1
plugin_header_X-From-Where = frp
```
通过浏览器访问 https://test.yourdomain.com 即可。

### 自定义二级域名
在多人同时使用一个 frps 时，通过自定义二级域名的方式来使用会更加方便。
只需要将 *.{subdomain_host} 解析到 frps 所在服务器。之后用户可以通过 subdomain 自行指定自己的 web 服务所需要使用的二级域名，通过 {subdomain}.{subdomain_host} 来访问自己的 web 服务。

frps.ini
```
[common]
subdomain_host = frps.com
将泛域名 *.frps.com 解析到 frps 所在服务器的 IP 地址。
```
frpc.ini
```
[web]
type = http
local_port = 80
subdomain = test
```
frps 和 frpc 都启动成功后，通过 test.frps.com 就可以访问到内网的 web 服务。

注：如果 frps 配置了 subdomain_host，则 custom_domains 中不能是属于 subdomain_host 的子域名或者泛域名。
同一个 http 或 https 类型的代理中 custom_domains 和 subdomain 可以同时配置。

### 通过密码保护你的 web 服务
frpc.ini
```
[web]
type = http
local_port = 80
custom_domains = test.yourdomain.com
http_user = abc
http_pwd = abc
```
通过浏览器访问 http://test.yourdomain.com，需要输入配置的用户名和密码才能访问。

### 更多功能
* 对外提供简单的文件访问服务
* 安全地暴露内网服务
* 点对点内网穿透
* ···

