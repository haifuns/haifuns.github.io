title: 记一次mysql index_merge引发的死锁分析
author: haifun
tags:
  - MySQL
  - 死锁
categories:
  - MySQL
  - 排查经验
date: 2022-07-26 18:00:00

---

> 注：本文中涉及公司业务信息已脱敏。

在项目监控中观察到偶现数据库死锁异常，报错如下：

```
com.mysql.jdbc.exceptions.jdbc4.MySQLTransactionRollbackException: Deadlock found when trying to get lock; try restarting transaction
    at sun.reflect.NativeConstructorAccessorImpl.newInstance0(Native Method)
    at sun.reflect.NativeConstructorAccessorImpl.newInstance(NativeConstructorAccessorImpl.java:62)
    at sun.reflect.DelegatingConstructorAccessorImpl.newInstance(DelegatingConstructorAccessorImpl.java:45)
    at java.lang.reflect.Constructor.newInstance(Constructor.java:422)
    at com.mysql.jdbc.Util.handleNewInstance(Util.java:400)
    at com.mysql.jdbc.Util.getInstance(Util.java:383)
    at com.mysql.jdbc.SQLError.createSQLException(SQLError.java:987)
    at com.mysql.jdbc.MysqlIO.checkErrorPacket(MysqlIO.java:3847)
    at com.mysql.jdbc.MysqlIO.checkErrorPacket(MysqlIO.java:3783)
    at com.mysql.jdbc.MysqlIO.sendCommand(MysqlIO.java:2447)
    at com.mysql.jdbc.MysqlIO.sqlQueryDirect(MysqlIO.java:2594)
    at com.mysql.jdbc.ConnectionImpl.execSQL(ConnectionImpl.java:2545)
    at com.mysql.jdbc.PreparedStatement.executeInternal(PreparedStatement.java:1901)
    at com.mysql.jdbc.PreparedStatement.executeUpdate(PreparedStatement.java:2113)
    at com.mysql.jdbc.PreparedStatement.executeUpdate(PreparedStatement.java:2049)
    at com.mysql.jdbc.PreparedStatement.executeUpdate(PreparedStatement.java:2034)
```

涉及表信息如下（演示表）：

```sql
CREATE TABLE `test_table` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '自增id',
  `user_id` bigint(20) NOT NULL DEFAULT '0' COMMENT '用户id',
  `class_id` int(14) NOT NULL DEFAULT '0' COMMENT '课程id',
  `is_deleted` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否删除',
  `add_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `mod_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '修改时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_class_id` (`class_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

# 死锁日志分析

从RDS中拿到了死锁日志如下：

```
LATEST DETECTED DEADLOCK
------------------------
2022-07-19 10:10:22 0x7f269177f700
*** (1) TRANSACTION:
TRANSACTION 1017957458, ACTIVE 0 sec starting index read
mysql tables in use 3, locked 3
LOCK WAIT 4 lock struct(s), heap size 1136, 3 row lock(s)
MySQL thread id 13133017, OS thread handle 139806311954176, query id 2776903298 10.**.**.179 k**_base_oniv updating
/*id:182a***d*//*ip=10.**.**.179*/update test_table
     SET is_deleted = 1,
        mod_time = '2022-07-19 10:10:22.861' 
     WHERE (  user_id = 1548612299617681421
                  and class_id = 1470379
                  and is_deleted = 0 )
*** (1) WAITING FOR THIS LOCK TO BE GRANTED:
RECORD LOCKS space id 883 page no 6297 n bits 1000 index idx_class_id of table `test_db`.`test_table` trx id 1017957458 lock_mode X waiting
*** (2) TRANSACTION:
TRANSACTION 1017957457, ACTIVE 0 sec fetching rows
mysql tables in use 3, locked 3
83 lock struct(s), heap size 8400, 669 row lock(s)
MySQL thread id 13116419, OS thread handle 139803626043136, query id 2776903296 10.**.**.178 k**_base_oniv updating
/*id:182a***d*//*ip=10.**.**.178*/update test_table
     SET is_deleted = 1,
        mod_time = '2022-07-19 10:10:22.861' 
     WHERE (  user_id = 1548831949420961886
                  and class_id = 1470379
                  and is_deleted = 0 )
*** (2) HOLDS THE LOCK(S):
RECORD LOCKS space id 883 page no 6297 n bits 1000 index idx_class_id of table `test_db`.`test_table` trx id 1017957457 lock_mode X
*** (2) WAITING FOR THIS LOCK TO BE GRANTED:
RECORD LOCKS space id 883 page no 8596 n bits 152 index PRIMARY of table `test_db`.`test_table` trx id 1017957457 lock_mode X locks rec but not gap waiting
*** WE ROLL BACK TRANSACTION (1)
```

从日志中可以看到死锁发生时间，导致死锁的事务信息，每个事务正在执行的sql，等待锁、持有锁等信息。

下面逐段对日志进行详细分析：

```
*** (1) TRANSACTION:
TRANSACTION 1017957458, ACTIVE 0 sec starting index read
```

- 1017957458 是第一个事务的 id。
- ACTIVE 0 sec 表示事务活动时间。
- starting index read 表示事务当前状态，这里表示正在读索引；其他可能的事务状态有：fetching rows，updating，deleting，inserting 等。

```
mysql tables in use 3, locked 3
LOCK WAIT 4 lock struct(s), heap size 1136, 3 row lock(s)
```

- tables in use 3, locked 3 表示有3张表被使用，有3个表锁。
- LOCK WAIT 表示事务正在等待锁。4 lock struct(s) 表示事务的锁链表长度为4，每个链表节点代表该事务持有的一个锁结构，包括表锁，记录锁以及自增锁等。
- heap size 1136 表示为事务分配的锁堆内存大小，这里不需要关心。
- 3 row lock(s)  表示当前事务持有的行锁个数。

```
MySQL thread id 13133017, OS thread handle 139806311954176, query id 2776903298 10.**.**.179 k**_base_oniv updating
```

事务的线程id，数据库ip、库名信息，这里不需要关心。

```
update ..
SET ..
WHERE ..
```

事务正在执行的sql，需要注意的是死锁日志里只会显示一条sql，分析时还需要结合代码看事务之前还执行了哪些sql。我们这里没有其他sql，只有这一个update操作。

```
*** (1) WAITING FOR THIS LOCK TO BE GRANTED:
RECORD LOCKS space id 883 page no 6297 n bits 1000 index idx_class_id of table `test_db`.`test_table` trx id 1017957458 lock_mode X waiting
```
- WAITING FOR THIS LOCK TO BE GRANTED 表示正在等待锁。
- RECORD LOCKS 表示等待的锁类型，这里是记录锁。
- space id 883 page no 6297 n bits 1000 表示文件位置，这里不关心。
- index idx_class_id of table `test_db`.`test_table` 表示锁的索引，以及索引详情。
- trx id 1017957458 是事务id。
- lock_mode X waiting 表示Next-key 锁，当前处于锁等待状态。

```
*** (2) TRANSACTION:
TRANSACTION 1017957457, ACTIVE 0 sec fetching rows
mysql tables in use 3, locked 3
83 lock struct(s), heap size 8400, 669 row lock(s)
MySQL thread id 13116419, OS thread handle 139803626043136, query id 2776903296 10.198.196.178 k**_base_oniv updating
/*id:182a1bfd*//*ip=10.198.196.178*/update test_table
     SET is_deleted = 1,
        mod_time = '2022-07-19 10:10:22.861' 
     WHERE (  user_id = 1548831949420961886
                  and class_id = 1470379
                  and is_deleted = 0 )
```

事务2这段信息跟事务1类似，不再赘述。

```
*** (2) HOLDS THE LOCK(S):
RECORD LOCKS space id 883 page no 6297 n bits 1000 index idx_class_id of table `test_db`.`test_table` trx id 1017957457 lock_mode X
*** (2) WAITING FOR THIS LOCK TO BE GRANTED:
RECORD LOCKS space id 883 page no 8596 n bits 152 index PRIMARY of table `test_db`.`test_table` trx id 1017957457 lock_mode X locks rec but not gap waiting
*** WE ROLL BACK TRANSACTION (1)
```

锁信息比较关键，第一段表示事务2持有一个idx_class_id索引上的Next-key 锁，第二段表示事务2等待获取表主键上的记录锁。此时形成了死锁，事务1被回滚。

# 死锁原因分析

死锁日志我们已经分析完毕了，从日志中可以看到事务1在等待获取索引idx_class_id上的Next-key lock，而事务2占有索引idx_class_id上的Next-key lock、等待获取主键上的记录锁，然后形成了死锁。

但是，仅靠日志还是没有弄明白死锁形成的原因，事务1占有的锁信息不知道。从结论反推原因我们可以想到事务1一定是占有了主键上的记录锁，从而相互等待形成了死锁，但是为什么？

让我们来看下sql执行计划：

| id | select_type | table | partitions | type | possible_keys | key | key_len | ref | rows | filtered | Extra |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | UPDATE | test_table |  | index_merge | idx_user_id,idx_class_id | idx_user_id,idx_class_id | 8,4 |  | 1 | 100 | Using intersect(idx_user_id,idx_class_id); Using where |

从执行计划可以看到索引类型是index_merge，mysql使用了索引合并优化。Extra中可以看到Using intersect，表示具体使用的是index merge intersection算法，对所有使用的索引同时扫描，然后将扫描结果取交集。

此时问题就比较明确了，两个事务加锁过程如下：

1. 事务1对idx_user_id加了next-key lock，然后对primary id加了record lock；
2. 事务2对idx_class_id加了next-key lock，然后要对primary id加record lock陷入等待；
3. 事务1要对idx_class_id加next-key lock陷入等待；

在上面三步完毕后死锁就形成了。

**查资料过程中发现MySQL官方已经确认了此bug：https://bugs.mysql.com/bug.php?id=77209。**

# 解决方案

1. 建立联合索引，避免index merge。
2. 优化代码，避免数据库并发操作。
3. 将优化器的index merge优化关闭。

# 参考资料

- [解决死锁之路 - 常见 SQL 语句的加锁分析](https://www.aneasystone.com/archives/2017/12/solving-dead-locks-three.html)
- [解决死锁之路（终结篇） - 再见死锁](https://www.aneasystone.com/archives/2018/04/solving-dead-locks-four.html)
- [8.2.1.3 Index Merge Optimization](https://dev.mysql.com/doc/refman/5.7/en/index-merge-optimization.html)
- [index_merge导致死锁案例分析](https://blog.csdn.net/weixin_37692493/article/details/106970386)
