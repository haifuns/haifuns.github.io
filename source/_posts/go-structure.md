title: 【Go入门】程序结构
author: haifun
tags:
  - Go入门
categories:
  - Go
date: 2022-08-29 20:00:00

---

# 命名

Go语言中的函数名、变量名、常量名、类型名、语句标号和包名等所有的命名，都遵循一个简单的命名规则：必须以一个字母（Unicode字母）或下划线开头。

关键字：

```go
break      default       func     interface   select
case       defer         go       map         struct
chan       else          goto     package     switch
const      fallthrough   if       range       type
continue   for           import   return      var
```

预定义名:

```go
内建常量: true false iota nil

内建类型: int int8 int16 int32 int64
          uint uint8 uint16 uint32 uint64 uintptr
          float32 float64 complex128 complex64
          bool byte rune string error

内建函数: make len cap new append copy close delete
          complex real imag
          panic recover
```

# 声明

Go语言主要有四种类型的声明语句：var、const、type和func，分别对应变量、常量、类型和函数实体对象的声明。

```go
package main

import "fmt"

const boilingF = 212.0 // 常量

func main() { // 函数
    var f = boilingF // 变量
    var c = (f - 32) * 5 / 9
    fmt.Printf("boiling point = %g°F or %g°C\n", f, c)
    // Output:
    // boiling point = 212°F or 100°C
}
```

# 变量

变量声明语法：

```go
var 变量名字 类型 = 表达式 // 一般语法

var s string // 零值初始化机制

// 同时声明一组
var i, j, k int                 // int, int, int
var b, f, s = true, 2.3, "four" // bool, float64, string

// 简短声明，:= 格式，自动类型推导
i := 100 // int
i, j := 0, 1 // 按组简短声明

i, j = j, i // 交换 i 和 j 的值
```

## 指针

如果用“var x int”声明语句声明一个 x 变量，那么 `&x` 表达式（取 x 变量的内存地址）将产生一个指向该整数变量的指针，指针对应的数据类型是 `*int`，指针被称之为“指向 int 类型的指针”。

```go
x := 1
p := &x         // p, *int类型，指向x
fmt.Println(*p) // "1"
*p = 2          // 等同于 x = 2
fmt.Println(x)  // "2"

var x, y int
fmt.Println(&x == &x, &x == &y, &x == nil) // "true false false"

var p = f()
func f() *int {
    v := 1
    return &v
}
fmt.Println(f() == f()) // "false"
```

## new函数

表达式 new(T) 将创建一个 T 类型的匿名变量，初始化为 T 类型的零值，然后返回变量地址，返回的指针类型为 *T。

```go
p := new(int)   // p, *int 类型, 指向匿名的 int 变量
fmt.Println(*p) // "0"
*p = 2          // 设置 int 匿名变量的值为 2
fmt.Println(*p) // "2"
```

new函数使用通常相对比较少，因为对于结构体来说，直接用字面量语法创建新变量的方法会更灵活。

# 类型

类型声明方式：

```go
type 类型名字 底层类型
```

一个类型声明语句创建了一个新的类型名称，和现有类型具有相同的底层结构。新命名的类型提供了一个方法，用来分隔不同概念的类型，这样即使它们底层类型相同也是不兼容的。

对于每一个类型 T，都有一个对应的类型转换操作 T(x)，用于将 x 转为 T 类型（译注：如果 T 是指针类型，可能会需要用小括弧包装 T，比如 (*int)(0)）。只有当两个类型的底层基础类型相同时，才允许这种转型操作，或者是两者都是指向相同底层结构的指针类型，这些转换只改变类型而不会影响值本身。

# 包和文件

一个包的源代码保存在一个或多个以.go为文件后缀名的源文件中，通常一个包所在目录路径的后缀是包的导入路径。

每个包都有一个全局唯一的导入路径。除了包的导入路径，每个包还有一个包名，包名一般是短小的名字（并不要求包名是唯一的），包名在包的声明处指定。按照惯例，一个包的名字和包的导入路径的最后一个字段相同。

如果一个名字是大写字母开头的，那么该名字是导出的（因为汉字不区分大小写，因此汉字开头的名字是没有导出的）。

## 包的初始化

如果包中含有多个.go源文件，它们将按照发给编译器的顺序进行初始化，构建工具首先会将.go文件根据文件名排序，然后依次调用编译器编译。

对于在包级别声明的变量，如果有初始化表达式则用表达式初始化，还有一些没有初始化表达式的，例如某些表格数据初始化并不是一个简单的赋值过程。在这种情况下，可以用一个特殊的init初始化函数来简化初始化工作。每个文件都可以包含多个init初始化函数。

```go
func init() { /* ... */ }
```

init初始化函数除了不能被调用或引用外，其他行为和普通函数类似。在每个文件中的init初始化函数，在程序开始执行时按照它们声明的顺序被自动调用。

每个包在解决依赖的前提下，以导入声明的顺序初始化，每个包只会被初始化一次。因此，如果一个p包导入了q包，那么在p包初始化的时候可以认为q包必然已经初始化过了。初始化工作是自下而上进行的，main包最后被初始化。以这种方式，可以确保在main函数执行之前，所有依赖的包都已经完成初始化工作了。

包的初始化顺序：全局变量 -> init函数 -> main函数。