title: Docker搭建Prometheus+Grafana监控
author: Haif.
tags:
  - DevOps
categories:
  - DevOps
date: 2021-02-25 20:25:00
copyright: true
---

# 环境说明

监控组件说明：

* Grafana：负责展示数据。
* Prometheus：负责收集数据。其中采用Prometheus中的Exporter：
    * Node Exporter：负责收集硬件和操作系统数据。
    * Cadvisor：负责收集容器数据。
    * Alertmanager：负责告警。

运行环境准备：
* docker
* docker-compose

<!-- more -->

# 准备配置文件

```sh
$ mkdir /opt/docker-compose
$ mkdir -p /opt/monitor/config

$ mkdir -p /opt/monitor/prometheus/data
$ chmod 777 -R /opt/monitor/prometheus/data
$ mkdir -p /opt/monitor/grafana/data
$ chmod 777 -R /opt/monitor/grafana/data

$ cd /opt/monitor/config
$ vi prometheus.yml # 添加prometheus配置文件
$ vi alertmanager.yml # 添加alertmanager配置，配置收发邮件邮箱
$ vi node_down.yml # 添加node exporter配置，配置告警规则
```

## prometheus.yml

```yml
# my global config
global:
  scrape_interval:     15s # Set the scrape interval to every 15 seconds. Default is every 1 minute.
  evaluation_interval: 15s # Evaluate rules every 15 seconds. The default is every 1 minute.
  # scrape_timeout is set to the global default (10s).

# Alertmanager configuration
alerting:
  alertmanagers:
  - static_configs:
    - targets: ['alertmanager:9093']
      # - alertmanager:9093

# Load rules once and periodically evaluate them according to the global 'evaluation_interval'.
rule_files:
  - "node_down.yml"
  # - "first_rules.yml"
  # - "second_rules.yml"

# A scrape configuration containing exactly one endpoint to scrape:
# Here it's Prometheus itself.
scrape_configs:
  # The job name is added as a label `job=<job_name>` to any timeseries scraped from this config.
  - job_name: 'prometheus'
    static_configs:
      - targets: ['prometheus:9090']

  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  - job_name: 'node'
    scrape_interval: 8s
    static_configs:
      - targets: ['node-exporter:9100']
```

## alertmanager.yml

```yml
global:
  smtp_smarthost: ''        # 邮箱服务器
  smtp_from: ''             # 发件邮箱
  smtp_auth_username: ''    # 用户名
  smtp_auth_password: ''    # 密码
  smtp_require_tls: false   # 不进行tls验证

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 10m
  receiver: live-monitoring

receivers:
- name: 'live-monitoring'
  email_configs:
  - to: ''                  # 收件邮箱
```

## node_down.yml

```yml
groups:
- name: node_down
  rules:
  - alert: InstanceDown
    expr: up == 0
    for: 1m
    labels:
      user: test
    annotations:
      summary: "Instance {{ $labels.instance }} down"
      description: "{{ $labels.instance }} of job {{ $labels.job }} has been down for more than 1 minutes."
```

# 编写docker-compose

```sh
$ cd /opt/docker-compose
$ vi docker-compose-monitor.yml
```
## docker-compose-monitor.yml

```yml
version: '2'

networks:
    monitor:
        driver: bridge

services:
    prometheus:
        image: prom/prometheus
        container_name: prometheus
        hostname: prometheus
        restart: always
        volumes:
            - /opt/monitor/config/prometheus.yml:/etc/prometheus/prometheus.yml
            - /opt/monitor/config/node_down.yml:/etc/prometheus/node_down.yml
            - /opt/monitor/prometheus/data:/prometheus
        command:
            - '--config.file=/etc/prometheus/prometheus.yml' # 加载主配置文件
            - '--storage.tsdb.path=/prometheus' # 启动数据持久存储
        ports:
            - "9090:9090"
        networks:
            - monitor

    grafana:
        image: grafana/grafanai
        container_name: grafana
        hostname: grafana
        restart: always
        volumes:
            - /opt/monitor/grafana/data:/var/lib/grafana
        ports:
            - "3000:3000"
        networks:
            - monitor

    alertmanager:
        image: prom/alertmanager
        container_name: alertmanager
        hostname: alertmanager
        restart: always
        volumes:
            - /opt/monitor/config/alertmanager.yml:/etc/alertmanager/alertmanager.yml
        ports:
            - "9093:9093"
        networks:
            - monitor
            
    node-exporter:
        image: quay.io/prometheus/node-exporter
        container_name: node-exporter
        hostname: node-exporter
        restart: always
        ports:
            - "9100:9100"
        networks:
            - monitor

    cadvisor:
        image: google/cadvisor:latest
        container_name: cadvisor
        hostname: cadvisor
        restart: always
        volumes:
            - /:/rootfs:ro
            - /var/run:/var/run:rw
            - /sys:/sys:ro
            - /var/lib/docker/:/var/lib/docker:ro
        ports:
            - "8080:8080"
        networks:
            - monitor
```

# 启动docker-compose

```sh
# 启动容器
$ docker-compose -f /opt/docker-compose/docker-compose-monitor.yml up -d

# 删除容器
$ docker-compose -f /opt/docker-compose/docker-compose-monitor.yml down
```

# 监控使用

* Prometheus地址： http://ip:9090
* 服务状态：http://ip:9090/targets
* Grafana地址：http://ip:3000

在Grafana中添加Prometheus数据源：`Configuration -> DataSource -> Prometheus`