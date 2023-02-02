title: 【Go入门】函数&方法&接口
author: haifun
tags:
  - Go入门
categories:
  - Go
date: 2023-02-02 12:30:00

---

# 函数

函数声明包含函数名、形式参数列表、返回值列表（可省略）以及函数体。定义方式如下：

```go
func name(parameter-list) (result-list) {
    body
}
```

- 方法名首字母大写才能被其他文件使用
- 函数中基本数据类型和数组默认都是值传递，修改不会影响原始值
- 不支持传统函数重载
- 函数的类型称为函数的签名，如果两个函数形式参数列表和返回值列表中的变量一一对应，则两个函数有相同的签名。
- 函数类型的零值是nil，函数值可以与nil比较，函数值之间不可比较

## 匿名函数

拥有函数名的函数只能在包级语法块中被声明，函数字面量不受限制。
函数字面量是一种表达式即：func关键字后没有函数名，它的值称为匿名函数。

## Deferred函数

defer，延迟函数调用，不限制使用次数，执行时按调用defer语句顺序的倒序进行。

## Panic异常

当运行时发生panic异常时，程序会中断运行，并立即执行在改goroutine中被延迟的函数（defer机制）。
不是所有的panic异常都来自运行时，直接调用内置的panic函数也会引发panic异常，panci函数接受任何值作为参数，当某些不应该发生的场景发生时，就可以调用panic中断运行。

## Recover捕获异常

当在deferred函数中调用内置函数recover，当程序发生panic异常时，revocer会使程序从panic中恢复，并返回panic value，未发生panic异常时，recover会返回nil。

```go
func panicRecover() (result int, err error) {
    defer func() {
        // recover, 捕获异常
        switch p := recover(); p {
        case nil:
            result = 1
        default:
            result = -1
            err = fmt.Errorf("internal error: %v", p)
        }
    }()
    panic("manual throw error")
}
```

# 方法

在函数声明时，在名字前放一个变量，即是一个方法。其中附加的参数会将这个函数附加到这个类型上，即相当于为这个类型定义了一个独占的方法。

```go
type Point struct {
    X, Y float64
}

// Distance 普通函数
func Distance(p, q Point) float64 {
    return math.Hypot(q.X-p.X, q.Y-p.Y)
}

// Distance Point独占方法
func (p Point) Distance(q Point) float64 {
    return math.Hypot(q.X-p.X, q.Y-p.Y)
}
```

以上两个Distance并不会发生冲突，一个是包级别的函数，另一个是类下声明的方法。代码中参数p称为方法的接收器。 

当调用一个函数时会对其每一个参数值进行拷贝，如果一个函数需要更新一个变量，或者函数的其中一个参数太大需要避免这种默认拷贝时，这时就需要用到指针。对应接收器为指针而不是对象的方法。

在现实程序中，一般会约定如果某个类中有一个指针作为接收器的方法，那么这个类中的所有方法都必须有一个指针接收器。

# 接口

接口类型具体描述了一系列方法的集合，一个实现了这些方法的具体类型即是这个接口类型的实例。

接口值由两部分组成，一个具体的类型和那个类型的值，称为接口的动态类型和动态值。接口的零值就是它的类型和值部分都是nil。

## 类型断言

类型断言是一种使用在接口值上的操作，语法为`x.(T)`，其中x表示一个接口类型，T表示一个类型。类型断言用来检查操作对象的动态类型与断言的类型是否匹配。

1. 如果断言的类型T是一个具体类型，检查x的动态类型与T是否相同
    - 如果成功，结果为x的动态值，类型是T
    - 如果失败，抛出panic
2. 如果T是一个接口类型，检查x的动态类型是否满足T
    - 如果成功，结果类型为T，动态类型和值部分与x相同，也就是可以获取的方法集合改变了（通常更大）