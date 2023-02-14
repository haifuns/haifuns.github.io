title: Spring生命周期
author: Haif.
tags:
  - Spring
categories:
  - Java
date: 2019-11-21 21:43:00
copyright: true
---

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/img/spring.png)

1. 首先容器启动后，对bean进行初始化。
2. 按照bean定义注入属性。
3. 检测是否实现了XXAware接口，如BeanNameAware等，将相关信息注入到bean实例。
4. 经过以上步骤，bean实例已正确构造，通过实现BeanPostProcessor#postProcessBeforeInitialzation进行前置处理。
5. BeanPostProcessor前置处理完成后，可以通过实现InitializingBean#afterPropertiesSet、@PostConstruct、init-method方法，增强自定义逻辑。
6. 通过实现BeanPostProcessor#postProcessAfterInitialzation进行后置处理。
7. 此时bean准备已完成，可以使用。
8. 容器关闭后，如果bean实现了DisposableBean接口，会执行destory方法。
9. 最后执行自定义的销毁前destory-method指定方法。
10. bean销毁完成。
