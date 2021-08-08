title: 【JVM】：字节码执行引擎
author: Haif.
tags:
  - JVM
categories:
  - JVM
date: 2020-12-26 17:19:00
copyright: true

---

## 概述

JVM字节码执行引擎功能基本上就是输入字节码文件，然后对字节码进行解析并处理，最后输出执行结果。实现方式可能有通过解释器直接解释执行字节码，或者通过即时编译器产生本地代码，也就是编译执行，也可能两者皆有。

<!-- more -->

## 栈帧

栈帧是用于支持JVM进行方法调用和方法执行的数据结构，栈帧随方法调用创建，方法结束销毁。栈帧中存储方法局部变量表、操作数栈、动态连接、方法返回地址等信息。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/jvm/stackframe.png)

### 局部变量表

局部变量表用来存放方法参数和方法内部定义的局部变量存储空间。

* 以变量槽slot为单位，目前一个slot存放32位以内的数据类型
* 对于64位数占两个slot
* 对于实例方法，第0位slot存放this，然后从1到n，依次分配给参数列表
* 根据方法体内部定义的变量顺序和作用域分配slot
* slot是复用的，以节省栈帧空间，这种设计可能会影响系统垃圾回收行为

### 操作数栈

后入先出栈，操作数栈用来存放运行期间，各个指令操作的数据。

* 操作数栈中元素的数据类型必须和字节码指令的顺序严格匹配
* 虚拟机在实现栈帧的时候可能会做一些优化，让两个栈帧出现部分重叠区域，用来存放公共数据

### 动态连接

每个栈帧持有一个指向运行时常量池中该栈帧所属方法的引用，以支持方法调用过程的动态连接

#### 静态解析

类加载时或第一次使用时，符号引用就转换成直接引用

#### 动态连接

运行期间转换为直接引用

### 方法返回地址

方法执行返回的地址，当一个方法开始执行后，只有两种方式可以退出这个方法。

1. 执行引擎遇到任意一个方法返回的字节码指令，是否有返回值和返回值类型根据遇到何种方法返回指令决定，这种退出方法简称正常完成出口

2. 在方法的执行过程中遇到了异常，并且异常没有在方法体中处理，这种退出方法简称异常完成出口

无论何种退出方式，在方法退出后，都需要返回到方法被调用的位置，程序才能继续执行，方法返回时可能需要在栈帧中保存一些信息，用来帮助恢复它的上层方法的执行状态。

## 方法调用

方法调用就是确定调用方法的版本即调用哪一个方法，不涉及方法内部执行过程

* 解析调用：部分方法是直接在类加载解析阶段就确定了直接引用关系
* 分派调用：对于实例方法，也称虚方法，因为重载和多态，需要在运行期动态委派

### 静态分派

所有依赖静态类型来定位方法执行版本的分派信息，比如：重载方法

```
/*
 * 方法静态分派演示
 */
public class StaticDispatch {

    static abstract class Human{
    }
    
    static class Man extends Human{
    }
    
    static class Women extends Human{
    }
    
    public  void sayHello(Human guy){
        System.out.println("hello human");
    }
    
    public  void sayHello(Man guy){
        System.out.println("hello man");
    }
    
    public  void sayHello(Women guy){
        System.out.println("hello women");
    }
    
    public static void main(String[] args){
        Human man = new Man();
        Human women = new Women();
        StaticDispatch sr = new StaticDispatch();
        sr.sayHello(man);
        sr.sayHello(women);
    }
}
```

运行结果：
```
hello human
hello human
```
Human man = new Man() 这行代码中的我们把这行代码中“Human”称为变量的静态类型，后面的Man称为变量的实际类型，静态类型和实际类型在程序中都可以发生一些变化，区别是静态类型的变化仅仅在使用时发生，变量本身的静态类型不会被改变，并且最终的静态类型是在编译期可知的；而实际类型变化的结果在运行期才可确定，编译器在编译程序的时候并不知道一个对象的实际类型是什么。例如下面的代码：

```
// 实际类型变化
Human human = (new Random()).nextBoolean() ? new Man() : new Woman();
// 静态类型变化
sr.sayHello((Man)man);
sr.sayHello((Women)man);
```
对象human的实际类型是可变的，编译期间到底是Man还是Woman，必须等到程序运行到这行的时候才能确定。而human的静态类型是Human，也可以在使用时（如sayHello()方法中的强制转型）临时改变这个类型，但这个改变仍是在编译期是可知的，两次sayHello()方法的调用，在编译期完全可以明确转型的是Man还是Woman。

### 动态分派

根据运行期的实际类型来定位方法执行版本的分派方式，比如：覆盖方法

```
/**
* 方法动态分派演示
*/
public class DynamicDispatch {
    static abstract class Human {
        protected abstract void sayHello();
    }
    
    static class Man extends Human {
        @Override
        protected void sayHello() {
            System.out.println("man say hello");
        }
    }
    
    static class Woman extends Human {
        @Override
        protected void sayHello() {
            System.out.println("woman say hello");
        }
    }
    
    public static void main(String[] args) {
        Human man = new Man();
        Human woman = new Woman();
        man.sayHello();
        woman.sayHello();
        man = new Woman();
        man.sayHello();
    }
}
```
执行结果：
```
man say hello
woman say hello
woman say hello
```

显然这里选择调用的方法版本是不可能再根据静态类型来决定的，因为静态类型同样都是Human的两个变量man和woman在调用sayHello()方法时产生了不同的行为，甚至变量man在两次调用中还执行了两个不同的方法。导致这个现象的原因很明显，是因为这两个变量的实际类型不同，Java虚拟机是如何根据实际类型来分派方法执行版本的呢？

这就要从invokevirtual指令入手，要弄清楚它是如何确定调用方法版本、如何实现多态查找。根据《Java虚拟机规范》，
invokevirtual指令的运行时解析过程大致分为以下几步：

1. 找到操作数栈顶的第一个元素所指向的对象的实际类型，记作C。
2. 如果在类型C中找到与常量中的描述符和简单名称都相符的方法，则进行访问权限校验，如果
通过则返回这个方法的直接引用，查找过程结束；不通过则返回java.lang.IllegalAccessError异常。
3. 否则，按照继承关系从下往上依次对C的各个父类进行第二步的搜索和验证过程。
4. 如果始终没有找到合适的方法，则抛出java.lang.AbstractMethodError异常。

invokevirtual指令执行的第一步就是在运行期确定接收者的实际类型，所以两次调用中的invokevirtual指令并不是把常量池中方法的符号引用解析到直接引用上就结束了，还会根据方法接收者的实际类型来选择方法版本，这个过程就是Java语言中方法重写的本质。我们把这种在运行期根据实际类型确定方法执行版本的分派过程称为动态分派。

### 单分派和多分派

方法的接受者与方法的参数统称为方法的宗量，根据分派基于多少种宗量，可以划分为单分派和多分派。单分派是根据一个宗量对目标方法进行选择。多分派则是根据多于一个宗量对目标方法选择。