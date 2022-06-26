title: 【算法基础】递归
author: haifun
tags:
  - 算法
  - 递归
categories:
  - 算法
date: 2022-06-26 22:30:00

---

方法或函数调用自身的方式称为递归调用，调用称为递，返回称为归。递归是一种应用非常广泛的算法（或者编程技巧）。

递归的优缺点：
- 优点：代码简洁、清晰、可读性高。
- 缺点：空间复杂度高、有堆栈溢出风险、存在重复计算（如斐波那契数列的递归）、过多的函数调用会耗时较多等问题。

递归需要满足的三个条件：

1. 一个问题的解可以分解为几个子问题的解
2. 这个问题与分解之后的子问题，除了数据规模不同，求解思路完全一样
3. 存在递归终止条件

如何编写递归代码？：
写递归代码最关键的是找到如何将大问题分解为小问题的规律，并且基于此写出递推公式，然后再推敲终止条件，最后将递推公式和终止条件翻译成代码。

# 从数组中找到最大值（递归实现）

```java
// 求arr中的最大值
public static int getMax(int[] arr) {
    return process(arr, 0, arr.length - 1);
}

// arr[l..r]位置找到最大值
public static int process(int[] arr, int l, int r) {
    // arr[l..r]范围只有一个数, 直接返回, bad case
    if (l == r) {
        return arr[l];
    }

    // 中点
    int mid = l + ((r - l) >> 1);
    int leftMax = process(arr, l, mid);
    int rightMax = process(arr, mid + 1, r);
    return Math.max(leftMax, rightMax);
}
```

# 递归复杂度分析：Master公式

T(N) = a * T(N/b) + O(N^d)，a,b,d都是常数。

Master公式估计递归复杂度要求：子问题规模一致都是N/b，调用了a次，除了调用子问题其他问题的时间复杂度O(N^d)。

满足条件通过Master公式来确定时间复杂度：

1. 如果 log(b,a) < d，复杂度为O(N^d)
2. 如果 log(b,a) > d，复杂度为O(N^log(b,a))
3. 如果 log(b,a) == d，复杂度为O(N^d * logN)