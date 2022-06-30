title: 【算法基础】快速排序
author: haifun
tags:
  - 算法
  - 排序
categories:
  - 算法
date: 2022-06-30 23:55:00

---

快速排序算法（Quicksort），简称为“快排”，利用的是分治思想。

快排思想：(要排序数组中下标从 p 到 r 之间的一组数据)

选择 p 到 r 之间的任意一个数据作为 pivot（分区点）。
遍历 p 到 r 之间的数据，将小于 pivot 的放到左边，将大于 pivot 的放到右边，将 pivot 放到中间。
经过这一步骤之后，数组 p 到 r 之间的数据就被分成了三个部分，前面 p 到 q-1 之间都是小于 pivot 的，中间是 pivot，后面的 q+1 到 r 之间是大于 pivot 的。

根据分治、递归的处理思想，可以用递归排序下标从 p 到 q-1 之间的数据和下标从 q+1 到 r 之间的数据，直到区间缩小为 1，所有的数据都有序了。

# 荷兰国旗问题

快速排序思想中数据按大小分区也即荷兰国旗问题：

给定一个数组arr和一个数num，要求对于[l,r]范围内的数，小于num的数放到最左边，等于num放到中间，大于num放到最右边。

```java
/**
 * 荷兰国旗问题, 在arr[l..r]上, 以arr[r]做划分值, 小于arr[r] 等于arr[r] 大于arr[r]
 *
 * 返回等于区域左右边界
 */
public static int[] netherlandsFlag(int[] arr, int l, int r) {
    int less = l - 1; // 小于区域右边界
    int more = r; // 大于区域左边界
    int index = l;

    while (index < more) { // 只需要处理到大于区域左边界左边第一个数
        if (arr[index] < arr[r]) {
            swap(arr, index++, ++less); // 当前值交换到小于区域, 小于区域右边界+1, index+1
        } else if (arr[index] > arr[r]) {
            swap(arr, index, --more); // 当前值交换到大于区域, 大于区域左边界-1, index不动因为交换过来的值没判断过
        } else {
            index++;
        }
    }

    swap(arr, more, r); // arr[r] 交换到大于区域左边界
    return new int[] { less + 1, more }; // 等于区域边界
}

public static void swap(int[] arr, int i, int j) {
    int tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}
```

# 普通快速排序

普通快速排序直接利用荷兰国旗问题递归求解，复杂度为O(N^2)，当数组本身有序时，每次都需要对[0,r-1]做分区处理。

```java
// 普通快排 O(N^2)
public static void quickSort(int[] arr) {
    if (arr == null || arr.length < 2) {
        return;
    }
    process(arr, 0, arr.length - 1);
}

// arr[L..R] 排有序
public static void process(int[] arr, int l, int R) {
    if (L >= R) {
        return;
    }
    // [equalArea[0] , equalArea[0]]
    int[] equalArea = netherlandsFlag(arr, L, R);
    process(arr, L, equalArea[0] - 1);
    process(arr, equalArea[1] + 1, R);
}
```

# 随机快速排序*

随机快速排序是针对普通快排优化后的排序算法，也是通常快速排序所指的排序方式，复杂度为O(N*logN)，最好最坏情况都是概率事件。

```java
// 随机快速排序 O(N*logN)
public static void quickSort(int[] arr) {
    if (arr == null || arr.length < 2) {
        return;
    }
    process(arr, 0, arr.length - 1);
}

public static void process(int[] arr, int L, int R) {
    if (L >= R) {
        return;
    }
    swap(arr, L + (int) (Math.random() * (R - L + 1)), R);
    int[] equalArea = netherlandsFlag(arr, L, R);
    process(arr, L, equalArea[0] - 1);
    process(arr, equalArea[1] + 1, R);
}
```

# 非递归实现快排

```java
// 快排非递归版本需要的辅助类
// 要处理的是什么范围上的排序
public static class Op {
    public int l;
    public int r;

    public Op(int left, int right) {
        l = left;
        r = right;
    }
}

// 快排非递归版本 用栈来执行
public static void quickSortByStack(int[] arr) {
    if (arr == null || arr.length < 2) {
        return;
    }
    int N = arr.length;
    swap(arr, (int) (Math.random() * N), N - 1);
    int[] equalArea = netherlandsFlag(arr, 0, N - 1);
    int el = equalArea[0];
    int er = equalArea[1];
    Stack<Op> stack = new Stack<>();
    stack.push(new Op(0, el - 1));
    stack.push(new Op(er + 1, N - 1));
    while (!stack.isEmpty()) {
        Op op = stack.pop(); // op.l ... op.r
        if (op.l < op.r) {
            swap(arr, op.l + (int) (Math.random() * (op.r - op.l + 1)), op.r);
            equalArea = netherlandsFlag(arr, op.l, op.r);
            el = equalArea[0];
            er = equalArea[1];
            stack.push(new Op(op.l, el - 1));
            stack.push(new Op(er + 1, op.r));
        }
    }
}

// 快排非递归版本 用队列来执行
public static void quickSortByQueue(int[] arr) {
    if (arr == null || arr.length < 2) {
        return;
    }
    int N = arr.length;
    swap(arr, (int) (Math.random() * N), N - 1);
    int[] equalArea = netherlandsFlag(arr, 0, N - 1);
    int el = equalArea[0];
    int er = equalArea[1];
    Queue<Op> queue = new LinkedList<>();
    queue.offer(new Op(0, el - 1));
    queue.offer(new Op(er + 1, N - 1));
    while (!queue.isEmpty()) {
        Op op = queue.poll();
        if (op.l < op.r) {
            swap(arr, op.l + (int) (Math.random() * (op.r - op.l + 1)), op.r);
            equalArea = netherlandsFlag(arr, op.l, op.r);
            el = equalArea[0];
            er = equalArea[1];
            queue.offer(new Op(op.l, el - 1));
            queue.offer(new Op(er + 1, op.r));
        }
    }
}
```
