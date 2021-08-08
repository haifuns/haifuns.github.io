title: 【JVM】：类从加载、连接、初始化到卸载
author: Haif.
tags:
  - JVM
categories:
  - JVM
date: 2020-12-26 17:15:00
copyright: true

---

## 类加载、类加载器，双亲委派模型

### 类加载

1. 通过类的全限定名获取该类的二进制字节流
2. 把二进制字节流转化为方法区的运行时数据结构
3. 在堆上创建一个java.lang.Class对象，用来封装类在方法区内的数据结构，并向外提供访问方法区内数据结构的接口

* 常见方式：本地文件、jar等归档文件中加载
* 动态方式：将java源文件动态编译成class
* 其它方式：网络下载、从专有数据库中加载等
<!-- more -->
### 类加载器

Java虚拟机自带加载器包括以下几种：

* 启动类加载器（BootstrapClassLoader）
* 平台类加载器（PlatformClassLoader） jdk9, jdk8: 扩展类加载器ExtensionClassLoader
* 应用程序类加载器（AppClassLoader）
* 用户自定义加载器，是java.lang.ClassLoader的子类，用户可以定制类的加载方式，自定义加载器加载顺序在所有系统类加载器之后

### 类加载器的关系

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/jvm/classloader.png)

### 双亲委派模型

JVM中的ClassLoader通常采用双亲委派模型，要求除启动类加载器外，其余的类加载器都应该有自己的父加载器。加载器间是组合关系而非继承。工作过程如下：
1. 类加载器接收到类加载请求后。首先搜索它的内建加载器定义的所有“具名模块”
2. 如果找到了合适的模块定义，将会使用该加载器来加载
3. 如果class没有在这些加载器定义的具名模块中找到，那么将会委托给父加载器，直到启动类加载器
4. 如果父加载器反馈不能完成请求，比如在它的搜索路径下找不到这个类，那子类加载器自己来加载
5. 在类路径下找到的类成为这些加载器的无名模块

双亲委派模型说明：

1. 双亲委派模型有利于保证Java程序的稳定
2. 实现双亲委派的代码在java.class.ClassLoader的loadClass()方法中，自定义类加载器推荐重写findClass()方法
3. 如果有一个类加载器能加载某个类，成为定义类加载器，所有能成功返回该类的Class的类加载器都被称为初始类加载器
4. 如果没有指定父加载器，默认就是启动类加载器
5. 每个类加载器都有自己的命名空间，命名空间由该加载器及其所有父加载器所加载的类构成，不同的命名空间可以出现类的全路径相同的情况
6. 运行时包由同一个类加载器的类构成，决定两个类是否属于同一个运行时包不仅要看全路径是否一样，还要看定义类加载器是否相同。只有属于同一个运行时包的类才能实现相互包可见

自定义类加载器：
```java
public class MyClassLoader extends ClassLoader {

	private String loaderName;

	public MyClassLoader(String loaderName) {
		this.loaderName = loaderName;
	}

	@Override
	protected Class<?> findClass(String name) throws ClassNotFoundException {
		byte[] data = this.loadClassData(name);
		return this.defineClass(name, data, 0, data.length);
	}

	private byte[] loadClassData(String name) {
		byte[] data = null;

		name = name.replace(".", "/");
		try (ByteArrayOutputStream out = new ByteArrayOutputStream(); InputStream in = new FileInputStream(new File(
				"target/" + name + ".class"))){

			byte[] buffer = new byte[1024];
			int size = 0;
			while ((size = in.read(buffer)) != -1) {
				out.write(buffer, 0, size);
			}

			data = out.toByteArray();
		} catch (IOException e) {
			e.printStackTrace();
		}

		return data;
	}
}

public class MyClass {
    public MyClass() {
    }
}

public class ClassCloaderMain {

	public static void main(String[] args) throws ClassNotFoundException {
		MyClassLoader classLoader = new MyClassLoader("myClassLoader1");

		Class cls = classLoader.loadClass("classloader.MyClass");

		System.out.println("cls class loader == " + cls.getClassLoader());
		System.out.println("cls parent class loader == " + cls.getClassLoader().getParent());
	}
}

/*
控制台打印:
cls class loader == classloader.MyClassLoader@3caeaf62
cls parent class loader == sun.misc.Launcher$AppClassLoader@18b4aac2
*/
```

破坏双亲委派模型：

* 双亲委派模型问题： 父加载器无法向下识别子加载器加载的资源

为了解决这个问题，引入线程上下文类加载器，可以通过Thread的setContextClassLoader()进行设置，例如数据库连接驱动加载

* 另一种典型情况是实现热替换，比如OSGI的模块热部署，它的类加载器不再是严格按照双亲委派模型，很多可能就在平级的类加载器中执行了

## 类连接

将已经读入内存的类二进制数据合并到JVM运行环境中去，包含以下几个步骤：
1. 验证：确保被加载类的正确性
    * 类文件结构验证
    * 元数据验证
    * 字节码验证
    * 符号引用验证
2. 解析：把常量池中的符号引用换为直接引用

### 类初始化

为类的静态变量赋初始值，或者说执行类的构造器<client>方法

1. 如果类未加载或连接，先进行加载连接
2. 如果存在父类且父类未初始化，先初始化父类
3. 如果类中存在初始化语句，依次执行
4. 如果是接口
    * 初始化类不会先初始化它实现的接口
    * 初始化接口不会初始化父接口
    * 只有程序首次使用接口中的变量或调用接口方法时，接口才会初始化
5. ClassLoader类的loadClass()方法装载类不会初始化这个类，不是对类的主动使用

### 类初始化时机

Java程序对类的使用分成： 主动使用和被动使用。JVM必须在每个类或接口“首次主动使用”时才会初始化它们，被动使用的类不会导致类的初始化。

主动使用的情况：
1. 创建类实例
2. 访问类或接口的静态变量
3. 调用类的静态方法
4. 反射某个类
5. 初始化子类，父类还没初始化
6. JVM启动时运行的主类
7. 定义了default方法的接口，当接口实现类初始化

## 类卸载

当代表类的Class对象不再被引用，那么Class对象生命周期就结束了，对应方法区的数据也会被卸载。

JVM自带的类加载器装载的类不会卸载，由用户自定义的类加载器加载的类可以被卸载。