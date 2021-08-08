title: "pgbench\_--\_PostgreSQL基准测试工具"
author: Haif.
tags:
  - PostgreSQL
  - Pgbench
categories:
  - 数据库
date: 2019-09-17 21:44:00
copyright: true
---
#### 描述

pgbench是一种在PostgreSQL上运行基准测试的简单程序。它可能在并发的数据库会话中一遍一遍地运行相同序列的 SQL 命令，并且计算平均事务率（每秒的事务数）。默认情况下，pgbench会测试一种基于 TPC-B 但是要更宽松的场景，其中在每个事务中涉及五个SELECT、UPDATE以及INSERT命令。但是，通过编写自己的事务脚本文件很容易用来测试其他情况。

pgbench的典型输出像这样：

```
transaction type: <builtin: TPC-B (sort of)>
scaling factor: 10
query mode: simple
number of clients: 10
number of threads: 1
number of transactions per client: 1000
number of transactions actually processed: 10000/10000
tps = 85.184871 (including connections establishing)
tps = 85.296346 (excluding connections establishing)
```

前六行报告一些最重要的参数设置。接下来的行报告完成的事务数以及预期的事务数（后者就是客户端数量与每个客户端事务数的乘积），除非运行在完成之前失败，这些值应该是相等的（在-T模式中，只有实际的事务数会被打印出来）。最后两行报告每秒的事务数，分别代表包括和不包括开始数据库会话所花时间的情况。

默认的类 TPC-B 事务测试要求预先设置好特定的表。使用-i 进行初始化，创建默认表

```
pgbench -i [ other-options ] dbname
```

可能会用到-h/-p/-U选项指定数据库。
<!-- more -->

#### 选项

下面分成三个部分：数据库初始化期间使用的选项、运行基准时使用的选项、两种情况下都有用的选项。

##### 初始化选项

pgbench接受下列命令行初始化参数：

-i  
--initialize

要求调用初始化模式。

-F *fillfactor*  
--fillfactor=*fillfactor*

用给定的填充因子创建pgbench_accounts、 pgbench_tellers和 pgbench_branches表。默认值是 100。

-n  
--no-vacuum

初始化以后不执行清理。

-q  
--quiet

把记录切换到安静模式，只是每 5 秒产生一个进度消息。默认的记录会每 100000 行打印一个消息，这经常会在每秒钟输出很多行（特别是在好的硬件上）。

-s *scale_factor*  
--scale=*scale_factor*

将生成的行数乘以比例因子。例如，-s 100将在pgbench_accounts表中创建 10,000,000 行。默认为 1。当比例为 20,000 或更高时，用来保存账号标识符的列（aid列）将切换到使用更大的整数（bigint），这样才能足以保存账号标识符。

--foreign-keys

在标准的表之间创建外键约束。

--index-tablespace=*index_tablespace*

在指定的表空间而不是默认表空间中创建索引。

--tablespace=*tablespace*

在指定的表空间而不是默认表空间中创建表。

--unlogged-tables

把所有的表创建为非日志记录表而不是永久表。

##### 基准选项

pgbench接受下列命令行基准参数：

-b *scriptname[@weight]*  
--builtin=*scriptname[@weight]*

把指定的内建脚本加入到要执行的脚本列表中。@之后是一个可选的整数权重，它允许调节抽取该脚本的可能性。如果没有指定，它会被设置为 1。可用的内建脚本有：tpcb-like、simple-update和select-only。这里也接受内建名称无歧义的前缀缩写。如果用上特殊的名字list，将会显示内建脚本的列表并且立刻退出。

-c *clients*  
--client=*clients*

模拟的客户端数量，也就是并发数据库会话数量。默认为 1。

-C  
--connect

为每一个事务建立一个新连接，而不是只为每个客户端会话建立一个连接。这对于度量连接开销有用。

-d  
--debug

打印调试输出。

-D *varname*=*value*  
--define=*varname*=*value*

定义一个由自定义脚本（见下文）使用的变量。允许多个-D选项。

-f *filename[@weight]*  
--file=*filename[@weight]*

把一个从*filename*读到的事务脚本加入到被执行的脚本列表中。@后面是一个可选的整数权重，它允许调节抽取该测试的可能性。详见下文。

-j *threads*  
--jobs=*threads*

pgbench中的工作者线程数量。在多 CPU 机器上使用多于一个线程会有用。客户端会尽可能均匀地分布到可用的线程上。默认为 1。

-l  
--log

把每一个事务花费的时间写到一个日志文件中。详见下文。

-L *limit*  
--latency-limit=*limit*

对持续超过*limit*毫秒的事务进行独立的计数和报告， 这些事务被认为是*迟到（late）*了的事务。

在使用限流措施时（--rate=...），滞后于计划超过 *limit*毫秒并且因此没有希望满足延迟限制的事务根本 不会被发送给服务器。这些事务被认为是*被跳过（skipped）* 的事务，它们会被单独计数并且报告。

-M *querymode*  
--protocol=*querymode*

要用来提交查询到服务器的协议：

- simple：使用简单查询协议。

- extended使用扩展查询协议。

- prepared：使用带预备语句的扩展查询语句。

默认是简单查询协议。

-n  
--no-vacuum

在运行测试前不进行清理。如果你在运行一个不包括标准的表pgbench_accounts、 pgbench_branches、pgbench_history和 pgbench_tellers的自定义测试场景时，这个选项是*必需的*。

-N  
--skip-some-updates

运行内建的简单更新脚本。这是-b simple-update的简写。

-P *sec*  
--progress=*sec*

每*sec*秒显示进度报告。该报告包括运行了多长时间、从上次报告以来的 tps 以及从上次报告以来事务延迟的平均值和标准偏差。如果低于限流值（-R），延迟会相对于事务预定的开始时间（而不是实际的事务开始时间）计算，因此其中也包括了平均调度延迟时间。

-r  
--report-latencies

在基准结束后，报告平均的每个命令的每语句等待时间（从客户端的角度来说是执行时间）。详见下文。

-R *rate*  
--rate=*rate*

按照指定的速率执行事务而不是尽可能快地执行（默认行为）。该速率 以 tps（每秒事务数）形式给定。如果目标速率高于最大可能速率，则 该速率限制不会影响结果。

该速率的目标是按照一条泊松分布的调度时间线开始事务。期望的开始 时间表会基于客户端第一次开始的时间（而不是上一个事务结束的时 间）前移。这种方法意味着当事务超过它们的原定结束时间时，更迟的 那些有机会再次追赶上来。

当限流措施被激活时，运行结束时报告的事务延迟是从预订的开始时间计 算而来的，因此它包括每一个事务不得不等待前一个事务结束所花的时 间。该等待时间被称作调度延迟时间，并且它的平均值和最大值也会被 单独报告。关于实际事务开始时间的事务延迟（即在数据库中执行事务 所花的时间）可以用报告的延迟减去调度延迟时间计算得到。

如果把--latency-limit和--rate一起使用， 当一个事务在前一个事务结束时已经超过了延迟限制时，它可能会滞后 非常多，因为延迟是从计划的开始时间计算得来。这类事务不会被发送 给服务器，而是一起被跳过并且被单独计数。

一个高的调度延迟时间表示系统无法用选定的客户端和线程数按照指定 的速率处理事务。当平均的事务执行时间超过每个事务之间的调度间隔 时，每一个后续事务将会落后更多，并且随着测试运行时间越长，调度 延迟时间将持续增加。发生这种情况时，你将不得不降低指定的事务速率。

-s *scale_factor*  
--scale=*scale_factor*

在pgbench的输出中报告指定的比例因子。对于内建测试，这并非必需；正确的比例因子将通过对pgbench_branches表中的行计数来检测。不过，当只测试自定义基准（-f选项）时，比例因子将被报告为 1（除非使用了这个选项）。

-S  
--select-only

执行内建的只有选择的脚本。是-b select-only简写形式。

-t *transactions*  
--transactions=*transactions*

每个客户端运行的事务数量。默认为 10。

-T *seconds*  
--time=*seconds*

运行测试这么多秒，而不是为每个客户端运行固定数量的事务。-t和-T是互斥的。

-v  
--vacuum-all

在运行测试前清理所有四个标准的表。在没有用-n以及-v时， pgbench将清理pgbench_tellers 和pgbench_branches表，并且截断pgbench_history。

--aggregate-interval=*seconds*

聚集区间的长度（以秒计）。可以只与-l一起使用 - 通过这个选项，日志会包含每个区间的总结（事务数、最小/最大等待时间以及用于方差估计的两个额外域）。

当前在 Windows 上不支持这个选项。

--progress-timestamp

当显示进度（选项-P）时，使用一个时间戳（Unix 时间）取代从运行开始的秒数。单位是秒，在小数点后是毫秒精度。这可以有助于比较多种工具生成的日志。

--sampling-rate=*rate*

采样率，在写入数据到日志时被用来减少日志产生的数量。如果给出这个选项，只有指定比例的事务被记录。1.0 表示所有事务都将被记录，0.05 表示只有 5% 的事务会被记录。

在处理日志文件时，记得要考虑这个采样率。例如，当计算 tps 值时，你需要相应地乘以这个数字（例如，采样率是 0.01，你将只能得到实际 tps 的 1/100）。

##### 普通选项

pgbench接受下列命令行普通参数：

-h *hostname*  
--host=*hostname*

数据库服务器的主机名

-p *port*  
--port=*port*

数据库服务器的端口号

-U *login*  
--username=*login*

要作为哪个用户连接

-V  
--version

打印pgbench版本并退出。

-?  
--help

显示有关pgbench命令行参数的信息，并且退出。

#### 自定义脚本

pgbench支持通过从一个文件中（-f选项，配合-n）读取事务脚本替换默认的事务脚本，例如（先cmd cd到postgresql bin目录）：

`pgbench -M extended -h 127.0.0.1 -p 5432 -U postgres -n -P 60 -c 50 -j 50 -T 180 -f E://select.sql -r db`

-n -f 指定sql,50连接50线程持续180s,每60s打印状态，另外-d 可打印debug日志

select.sql内容如下：

```
\set numb random(1000,2000)
BEGIN;
select "id" from table1 where numb = :numb;
END;
```

#### 每语句延迟

通过-r选项，pgbench收集每一个客户端执行的每一个语句花费的事务时间。然后在基准完成后，它会报告这些值的平均值，作为每个语句的延迟。

对于默认脚本，输出看起来会像这样：

     starting vacuum...end.
    transaction type: <builtin: TPC-B (sort of)>
    scaling factor: 1
    query mode: simple
    number of clients: 10
    number of threads: 1
    number of transactions per client: 1000
    number of transactions actually processed: 10000/10000
    latency average = 15.844 ms
    latency stddev = 2.715 ms
    tps = 618.764555 (including connections establishing)
    tps = 622.977698 (excluding connections establishing)
    script statistics:
    -   statement latencies in milliseconds:0.002  \set aid random(1, 100000 * :scale)
     0.005  \set bid random(1, 1 * :scale)
     0.002  \set tid random(1, 10 * :scale)
     0.001  \set delta random(-5000, 5000)
     0.326  BEGIN;
     0.603  UPDATE pgbench_accounts SET abalance = abalance + :delta WHERE aid = :aid;
     0.454  SELECT abalance FROM pgbench_accounts WHERE aid = :aid;
     5.528  UPDATE pgbench_tellers SET tbalance = tbalance + :delta WHERE tid = :tid;
     7.335  UPDATE pgbench_branches SET bbalance = bbalance + :delta WHERE bid = :bid;
     0.371  INSERT INTO pgbench_history (tid, bid, aid, delta, mtime) VALUES (:tid, :bid, :aid, :delta, CURRENT_TIMESTAMP);
     1.212  END;

如果指定了多个脚本文件，会为每一个脚本文件单独报告平均值。

tps为平均事务率（每秒的事务数）

#### pgbench 函数

| 函数                                            | 返回类型                                    | 描述                     | 例子                             | 结果                     |
| --------------------------------------------- | --------------------------------------- | ---------------------- | ------------------------------ | ---------------------- |
| `abs(*a*)`                                    | 和*a*相同                                  | 绝对值                    | abs(-17)                       | 17                     |
| `debug(*a*)`                                  | 和*a*相同                                  | 把*a*打印到stderr，并且返回*a*  | debug(5432.1)                  | 5432.1                 |
| `double(*i*)`                                 | double                                  | 转换成 double             | double(5432)                   | 5432.0                 |
| `greatest(*a* [, *...* ] )`                   | 如果任何一个*a*是 double 则为 double，否则是 integer | 参数之中的最大值               | greatest(5, 4, 3, 2)           | 5                      |
| `int(*x*)`                                    | integer                                 | 转换成 int                | int(5.4 + 3.8)                 | 9                      |
| `least(*a* [, *...* ] )`                      | 如果任何一个*a*是 double 则为 double，否则是 integer | 参数之中的最小值               | least(5, 4, 3, 2.1)            | 2.1                    |
| `pi()`                                        | double                                  | 常量 PI 的值               | pi()                           | 3.14159265358979323846 |
| `random(*lb*, *ub*)`                          | integer                                 | [lb, ub]中的均匀分布随机整数     | random(1, 10)                  | 1和10之间的一个整数            |
| `random_exponential(*lb*, *ub*, *parameter*)` | integer                                 | [lb, ub]中的指数分布随机整数，见下文 | random_exponential(1, 10, 3.0) | 1和10之间的一个整数            |
| `random_gaussian(*lb*, *ub*, *parameter*)`    | integer                                 | [lb, ub]中的高斯分布随机整数，见下文 | random_gaussian(1, 10, 2.5)    | 1和10之间的一个整数            |
| `sqrt(*x*)`                                   | double                                  | 平方根                    | sqrt(2.0)                      | 1.414213562            |
