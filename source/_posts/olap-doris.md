title: OLAP-ApacheDoris
author: haifun
tags:
  - Doris
categories:
  - OLAP
date: 2023-09-11 18:00:00

---

Apache Doris 是一个基于 MPP 架构的高性能、实时的分析型数据库，仅需亚秒级响应时间即可返回海量数据下的查询结果，不仅可以支持高并发的点查询场景，也能支持高吞吐的复杂分析场景。

# 数据模型

-   Aggregate Key，聚合模型，按照指定的聚合方式（SUM/REPLACE/MAX/MIN）自动聚合，读时合并。
    - 通过过预聚合，极大地降低聚合查询时所需扫描的数据量和查询的计算量，非常适合有固定模式的报表类查询场景。但是该模型对 count(*) 查询很不友好。同时因为固定了 Value 列上的聚合方式，在进行其他类型的聚合查询时，需要考虑语意正确性。
-   Unique Key，唯一模型，保证主键唯一性约束，有读时合并和写时合并两种实现方式，读时合并等同于 Aggregate Key + REPLACE，写时合并在数据导入阶段进行新增和标记删除、查询性能更好。
    - 无法利用 ROLLUP 等预聚合带来的查询优势。
    - 仅支持整行更新，如果既需要唯一主键约束，又需要更新部分列（例如将多张源表导入到一张 Doris 表的情形），则可以考虑使用 Aggregate 模型，同时将非主键列的聚合类型设置为 REPLACE\_IF\_NOT_NULL。
-   Duplicate Key，重复模型，没有主键也不聚合，数据重复时保存多份，仅排序。
    - 适合任意维度的 Ad-hoc 查询。虽然同样无法利用预聚合的特性，但是不受聚合模型的约束，可以发挥列存模型的优势（只读取相关列，而不需要读取所有 Key 列）。

# 数据划分

Doris 中数据以 Table 形式描述，Table 包含 Row 和 Column，其中：

-   Row：一行数据
-   Column：描述一行数据中的不用字段。Doris 中 Column 分为 Key 和 Value 两类，即业务角度的维度列和指标列。从聚合模型角度看，Key 列相同的行会聚合成一行，其中 Value 列的聚合方式在建表时指定。

在 Doris 存储引擎中，Table 由多个 Partition（分区）组成，Partition 是逻辑上的最小管理单元，数据导入和删除仅能针对一个 Partition 进行。每个 Partition 包含多个 Tablet（数据分片/数据分桶），Tablet 是数据移动、复制等操作的最小物理存储单元。

Doris 支持分区和分桶两层的数据划分方式，第一层是 Partition，支持 Range 和 List 两种划分方式，第二层是 Bucket（Tablet），仅支持 Hash 划分方式。也可以使用一层分区，只能使用 Bucket 划分。

分区列必须是 Key 列，支持多列分区，分区数量没有上限。分桶列对于 Aggregate 和 Unique 模型必须为 Key 列，Duplicate 模型可以是 Key 列和 Value 列。

# ROLLUP

ROLLUP 即在 Base 表的基础上将数据按照指定粒度进行进一步聚合以获得更粗粒度的聚合数据。ROLLUP 的数据基于 Base 表产生，并且在物理上是单独存储的。

ROLLUP 也可以用来调整前缀索引，只需建立一个与 Base 列一致但是顺序不一致的 ROLLUP。

# 索引

Doris 支持两种索引：

-   内建的智能索引
    - 前缀索引：将一行数据的前 36 个字节（遇到 VARCHAR 直接截断，并且最多使用 VARCHAR 20 个字节）作为这行数据的前缀。
    - ZoneMap 索引：对每列自动维护的索引信息，包含 Min/Max、Null 值个数等。
-   手动创建的二级索引
    - BloomFilter 索引：布隆过滤器索引，适用于高基数列过滤。
    - Bitmap 索引：位图索引，用来加快查询速度。

# 物化视图

物化视图是将预先计算（根据定义好的 SELECT 语句）的数据集存储在 Doris 中的一种特殊表。既能对原始明细数据进行任意维度的分析，也能快速的对固定维度进行分析查询。

物化视图是 ROLLUP 的超集，在覆盖 ROLLUP 功能的同时，还支持更丰富的聚合函数。

---

- [Apache Doris官方文档](https://doris.apache.org/zh-CN/docs/1.2/data-table/data-model/)
