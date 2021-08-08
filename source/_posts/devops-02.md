title: Prometheus+Grafana监控JVM
author: Haif.
tags:
  - DevOps
categories:
  - DevOps
date: 2021-02-25 20:26:00
copyright: true
---

# 配置JMX Exporter

## 下载jmx_exporter

```sh
$ mkdir -p /opt/monitor/jmx_exporter
$ chmod 777 -R /opt/monitor/jmx_exporter
$ wget https://repo1.maven.org/maven2/io/prometheus/jmx/jmx_prometheus_javaagent/0.3.1/jmx_prometheus_javaagent-0.3.1.jar
```

<!-- more -->

## 创建配置文件

```sh
$ vi /opt/monitor/jmx_exporter/jmx_exporter.yml
```

jmx_exporter.yml文件内容如下：

```yml
lowercaseOutputLabelNames: true
lowercaseOutputName: true
whitelistObjectNames: ["java.lang:type=OperatingSystem"]
rules:
 - pattern: 'java.lang<type=OperatingSystem><>((?!process_cpu_time)w+):'
   name: os_$1
   type: GAUGE
   attrNameSnakeCase: true
```

# 配置应用程序

## 普通运行

`java -jar -javaagent:/opt/monitor/jmx_exporter/jmx_prometheus_javaagent-0.3.1.jar=8099:/opt/monitor/jmx_exporter/jmx_exporter.yml app.jar`

## docker运行

1. 修改启动配置：添加`-javaagent:/opt/monitor/jmx_exporter/jmx_prometheus_javaagent-0.3.1.jar=8099:/opt/monitor/jmx_exporter/jmx_exporter.yml`
2. 挂载数据卷：`-v /opt/monitor/jmx_exporter:/opt/monitor/jmx_exporter`
3. 添加端口映射：`-p 8099:8099`
4. 创建容器

# 配置Prometheus拉取监控指标

1. 在prometheus.yml中添加任务：

```yml
scrape_configs:
  - job_name: 'java'
    scrape_interval: 30s
    static_configs:
    - targets:
      - 'ip:port'
      - 'ip:port'
```
2. 重启prometheus

# 配置Grafana模板

1. 配置Prometheus数据源
2. 添加[JVM dashboard](https://grafana.com/grafana/dashboards/8563/revisions)模板