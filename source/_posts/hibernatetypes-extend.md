title: Hibernate/Jpa扩展支持Json/Hstore
author: haif.
tags:
  - Hibernate
  - PostgreSQL
copyright: true
categories:
  - 数据库
date: 2020-04-28 23:45:00
---
## 

* 本文使用开源扩展 [Hibernate Types](https://github.com/vladmihalcea/hibernate-types/) 实现操作postgresql json/jsonb/hstore数据类型 

#### 添加依赖

```
<!-- Hibernate 5.4, 5.3 and 5.2 -->
<dependency>
    <groupId>com.vladmihalcea</groupId>
    <artifactId>hibernate-types-52</artifactId>
    <version>${hibernate-types.version}</version>
</dependency>
```
<!-- more -->
#### 声明Hibernate类型

```
@TypeDefs({
		@TypeDef(name = "json", typeClass = JsonBinaryType.class),
		@TypeDef(name = "jsonb", typeClass = JsonBinaryType.class),
		@TypeDef(name = "hstore", typeClass = PostgreSQLHStoreType.class)
})
@Table(name = "STUDENT")
public class Student implements Serializable {

	···
	
	@Type(type = "hstore")
	@Column(name = "BOOK", columnDefinition = "hstore")
	private Map<String,String> book;

	@Type(type = "json")
	@Column(name = "INFO", columnDefinition = "json")
	private Object info;

	@Type(type = "jsonb")
	@Column(name = "FRIEND", columnDefinition = "jsonb")
	private Object friend;
}
```

* json/jsonb引用JsonBinaryType
* hstore引用PostgreSQLHStoreType
  * postgresql使用hstore需要安装扩展`CREATE EXTENSION hstore;`

完成后即可以使用这些数据类型的高级查询功能：

```
List<Student> students = entityManager.createNativeQuery(
    "SELECT jsonb_pretty(s.friend) " +
    "FROM student s " +
    "WHERE s.friend ->> 0 = '李四'")
.getResultList();
```

#### JPA简单操作

```
@Query(value = "SELECT s.* FROM student s WHERE s.friend ->> 0 = :name", nativeQuery = true)
	List<Student> queryByFriend(@Param("name") String name);
```

* json

| 操作符 | 右操作类型 | 返回类型   | 描述                                                 | 示例                                             | 示例结果     |
| ------ | ---------- | ---------- | ---------------------------------------------------- | ------------------------------------------------ | ------------ |
| ->     | int        | json/jsonb | 获取JSON数组元素（从零开始索引，从末数开始为负整数） | '[{"a":"foo"},{"b":"bar"},{"c":"baz"}]'::json->2 | {"c":"baz"}  |
| ->     | text       | json/jsonb | 通过键获取JSON对象字段                               | '{"a": {"b":"foo"}}'::json->'a'                  | {"b":"foo"}  |
| ->>    | int        | text       | 获取JSON数组元素为 `text`                            | '[1,2,3]'::json->>2                              | 3            |
| ->>    | text       | text       | 获取JSON对象字段为 `text`                            | '{"a":1,"b":2}'::json->>'b'                      | 2            |
| #>     | text[]     | json/jsonb | 在指定路径获取JSON对象                              | '{"a": {"b":{"c": "foo"}}}'::json#>'{a,b}'       | {"c": "foo"} |
| #>>    | text[]     | text       | 在指定路径下获取JSON对象为 `text`                    | '{"a":[1,2,3],"b":[4,5,6]}'::json#>>'{a,2}'      | 3            |

* store

| 操作符                 | 描述                                     | 示例                                                | 示例结果                       |
| ---------------------- | ---------------------------------------- | --------------------------------------------------- | ------------------------------ |
| hstore -> text   | 获取密钥值（如果不存在`NULL`）           | 'a=>x, b=>y'::hstore -> 'a'                       | x                         |
| hstore -> text[]  | 获取密钥值（如果不存在`NULL`）           | 'a=>x, b=>y, c=>z'::hstore -> ARRAY['c','a']      | {"z","x"}                    |
| hstore &#124;&#124; hstore | 组合`hstore`                   | 'a=>b, c=>d'::hstore &#124;&#124; 'c=>x, d=>q'::hstore      | "a"=>"b", "c"=>"x", "d"=>"q" |
| hstore ? text  | 是否包含键                               | 'a=>1'::hstore ? 'a'                              | t                            |
| hstore ?& text[] | 是否包含所有指定的键                     | 'a=>1,b=>2'::hstore ?& ARRAY['a','b']             | t                            |
| hstore ?&#124; text[] | 是否包含任意指定的键                | 'a=>1,b=>2'::hstore ?&#124; ARRAY['b','c']        | t                            |
| hstore @> hstore | 左包含右                                 | 'a=>b, b=>1, c=>NULL'::hstore @> 'b=>1'           | t                            |
| hstore <@ hstore  | 左包含在右边                             | 'a=>c'::hstore <@ 'a=>b, b=>1, c=>NULL'           | f                            |
| hstore - text   | 删除键                                   | 'a=>1, b=>2, c=>3'::hstore - 'b'::text            | "a"=>"1", "c"=>"3"           |
| hstore - text[]  | 删除多个键                               | 'a=>1, b=>2, c=>3'::hstore - ARRAY['a','b']       | "c"=>"3"                     |
| hstore - hstore   | 删除匹配对                               | 'a=>1, b=>2, c=>3'::hstore - 'a=>4, b=>2'::hstore | "a"=>"1", "c"=>"3"           |

#### 其他

* json/hstore更多语法移步[JSON Functions and Operators](https://www.postgresql.org/docs/devel/functions-json.html)/[hstore](https://www.postgresql.org/docs/devel/hstore.html)官方文档。中文版：[JSON Functions and Operators](http://postgres.cn/docs/9.6/functions-json.html)/[hstore](http://postgres.cn/docs/9.6/hstore.html)
* 可能会遇到的语法包含特殊字符可参考[How to escape question mark ? character with Spring JpaRepository](https://stackoverflow.com/questions/50464741/how-to-escape-question-mark-character-with-spring-jparepository)