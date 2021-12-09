title: Spring生命周期
author: Haif.
tags:
  - Spring
categories:
  - Java
date: 2019-11-21 21:43:00
copyright: true
---

<img width=45% src="https://haif-cloud.oss-cn-beijing.aliyuncs.com/img/SpringBean.png" >

<br>

* 首先容器启动后，对bean进行初始化。
* 按照bean定义注入属性。
* 检测是否实现了XXXAware接口，如BeanNameAware等，将相关实例注入给bean。
* 以上步骤，bean对象已正确构造，通过实现BeanPostProcessor接口，postProcessBeforeInitialzation方法再进行一些自定义方法处理。
* BeanPostProcessor前置处理完成后，可以实现@PostConstruct、afterPropertiesSet、init-method方法，增强自定义逻辑。
* 通过实现BeanPostProcessor接口，再进行postProcessBeforInitialzation后置处理。
* 此时bean准备已完成，可以使用。
* 容器关闭后，如果bean实现了DisposableBean接口，会执行destory方法。
* 最后执行自定义的销毁前destory-method指定方法。
* bean销毁完成。https://github.com/haifuns/redisson.git
