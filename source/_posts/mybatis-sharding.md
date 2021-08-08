title: Mybatis拦截器实现水平分表
author: Haif.
tags:
  - ORM
copyright: true
categories: 数据库
date: 2019-11-21 20:50:00
---
### Mybatis插件（plugins）
Mybatis允许在已映射的语句执行过程中某一点进行拦截。Mybatis允许使用插件来拦截的方法调用包括：
* Executor (update, query, flushStatements, commit, rollback, getTransaction, close, isClosed)
* ParameterHandler (getParameterObject, setParameters)
* ResultSetHandler (handleResultSets, handleOutputParameters)
* StatementHandler (prepare, parameterize, batch, update, query)

分别拦截以下方法调用：
* 拦截执行器的方法
* 拦截参数的处理
* 拦截结果集的处理
* 拦截Sql语法构建的处理

<!-- more -->

通过 MyBatis 提供的强大机制，使用插件是非常简单的，只需实现 Interceptor 接口：
```java
import org.apache.ibatis.plugin.Interceptor;
import org.apache.ibatis.plugin.Invocation;
import java.util.Properties;

@Intercepts({@Signature(
  type= Executor.class,method = "update",args = {MappedStatement.class,Object.class})
 })
public class ExamplePlugin implements Interceptor {
    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        return null;
    }

    @Override
    public Object plugin(Object o) {
        return null;
    }

    @Override
    public void setProperties(Properties properties) {

    }
}
```
上面的插件将会拦截在 Executor 实例中所有的 “update” 方法调用， 这里的 Executor 是负责执行低层映射语句的内部对象。


### 水平分表实现

#### 自定义插件
```java
<!-- mybatis-config.xml -->
<plugins>
  <plugin interceptor="org.mybatis.example.ExamplePlugin">
    <property name="someProperty" value="100"/>
  </plugin>
</plugins>
```
SpringBoot中只需要使用@Component注解注册为bean即可

#### 选择拦截方法
实现分表主要是通过在sql构建时，对表名进行替换，所以选择拦截StatementHandler
注解为：
```java
@Intercepts({
   @Signature(type = StatementHandler.class, method = "prepare", args = { Connection.class, Integer.class })
})
```
#### 定义分区表、分表字段
使用Mybatis实现分表我们期望分表灵活，即可以选择要分区的表，分区表分表字段，甚至指定哪些方法需要分表

自定义注解：
```java
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({ ElementType.TYPE, ElementType.METHOD })
public @interface TablesPartition {

    // 是否分表
    boolean split() default true;

    TablePartition[] value();

}

@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target({})
public @interface TablePartition {

    // 表名
    String value() default "";

    // 字段
    String field() default "";
}
```

在Mapper接口/方法上定义注解
```java
@TablesPartition({
        @TablePartition(value = "table_0", field = "field_0"),
        @TablePartition(value = "table_1", field = "field_0")   
})
public interface NormalMapper {

    @TablesPartition({
            @TablePartition(value = "table_0", field = "field_0")
    })
    List<NormalEntity> selectAll();
}
```

#### 分表核心源码实现
源码实现：
```java
@Slf4j
@Component
@Intercepts({
   @Signature(type = StatementHandler.class, method = "prepare", args = { Connection.class, Integer.class })
})
public class PartitionInterceptor implements Interceptor {

    private static final ObjectFactory DEFAULT_OBJECT_FACTORY = new DefaultObjectFactory();
    private static final ObjectWrapperFactory DEFAULT_OBJECT_WRAPPER_FACTORY = new DefaultObjectWrapperFactory();
    private static final ReflectorFactory REFLECTOR_FACTORY = new DefaultReflectorFactory();

    @Override
    public Object intercept(Invocation invocation) throws Throwable {

        StatementHandler statementHandler = (StatementHandler) invocation.getTarget();
        MetaObject metaStatementHandler = MetaObject.forObject(statementHandler, DEFAULT_OBJECT_FACTORY, DEFAULT_OBJECT_WRAPPER_FACTORY,REFLECTOR_FACTORY);

        Object parameterObject = metaStatementHandler.getValue("delegate.boundSql.parameterObject");
        partitionTable(metaStatementHandler,parameterObject);

        return invocation.proceed();
    }

    @Override
    public Object plugin(Object target) {

        // 目标类是StatementHandler类型时，才包装目标类，否者直接返回目标本身,减少目标被代理的次数
        if (target instanceof StatementHandler) {
            return Plugin.wrap(target, this);
        } else {
            return target;
        }
    }

    @Override
    public void setProperties(Properties properties) {

    }

    private void partitionTable(MetaObject metaStatementHandler, Object param ) throws Exception {

        String originalSql = (String) metaStatementHandler.getValue("delegate.boundSql.sql");

        if (StringUtils.isNotBlank(originalSql)) {

            MappedStatement mappedStatement = (MappedStatement) metaStatementHandler.getValue("delegate.mappedStatement");
            String id = mappedStatement.getId();
            String className = id.substring(0, id.lastIndexOf("."));
            String methodName = id.substring(id.lastIndexOf(".") + 1);
            Class<?> clazz = Class.forName(className);
            Method method = findMethod(clazz.getDeclaredMethods(), methodName);

            // 根据配置自动生成分表SQL,不配置查主表
            TablesPartition tablesPartition = null;

            if (method != null) {
                tablesPartition = method.getAnnotation(TablesPartition.class);
            }

            if (tablesPartition  == null) {
                tablesPartition = clazz.getAnnotation(TablesPartition.class);
            }

            if (tablesPartition != null && tablesPartition.split()) {

                TablePartition[] tablePartitionList = tablesPartition.value();
                String convertedSql = originalSql;

                for (TablePartition tablePartition:tablePartitionList) {

                    StringBuilder stringBuilder = new StringBuilder(tablePartition.value());

                    String resort = "";
                    if (param instanceof Map) {
                        resort = (String)((Map) param).get(tablePartition.field());
                    } else if (param instanceof String) {
                        resort = (String)param;
                    }

                    if (!StringUtils.isEmpty(resort)) {
                        stringBuilder.append("_");
                        stringBuilder.append(resort);
                    }

                    // 替换表名前先把包含表名的字段名*_替换为"thisIsSpecialColumn"
                    convertedSql = convertedSql.replaceAll("(?i)" + tablePartition.value()+"_", "thisIsSpecialColumn");

                    // 替换表名,不区分大小写
                    convertedSql = convertedSql.replaceAll("(?i)" + tablePartition.value(), stringBuilder.toString());

                    // 替换表名完成把"thisIsSpecialColumn"替换回字段名*_
                    convertedSql = convertedSql.replaceAll("thisIsSpecialColumn", tablePartition.value()+"_");

                }

                log.debug("分表后的SQL:\n" + convertedSql);

                metaStatementHandler.setValue("delegate.boundSql.sql", convertedSql);

            }
        }
    }

    private Method findMethod(Method[] methods, String methodName) {

        for (Method method : methods) {
            if (method.getName().equals(methodName)) {
                return method;
            }
        }

        return null;
    }
}
```
