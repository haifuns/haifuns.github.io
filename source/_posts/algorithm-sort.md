title: 【算法基础】排序算法（总）
author: haifun
tags:
  - 算法
  - 排序
categories:
  - 算法
date: 2022-06-21 23:00:00

---

# 排序算法分析

## 执行效率

排序算法执行效率分析从以下几个方面来衡量：

- 最好情况、最坏情况、平均情况时间复杂度
- 时间复杂度的系数、常数 、低阶
- 比较次数和交换（或移动）次数

## 内存消耗

算法的内存消耗可以通过空间复杂度来衡量。针对排序算法的空间复杂度，引入原地排序（Sorted in place）概念，特指空间复杂度是 O(1) 的排序算法。

## 稳定性

排序算法的稳定性：如果待排序的序列中存在值相等的元素，经过排序之后，相等元素之间原有的先后顺序不变则稳定，否则不稳定。

# 冒泡排序（Bubble Sort）

冒泡排序只会操作相邻的两个数据。每次冒泡操作都会对相邻的两个元素进行比较，看是否满足大小关系要求。如果不满足就让它俩互换。一次冒泡会让至少一个元素移动到它应该在的位置，重复 n 次，就完成了 n 个数据的排序工作。

## 动画演示

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/algorithm/BubbleSort.gif)

## 代码示例

```java
public static void bubbleSort(int[] arr) {
    if (arr == null || arr.length < 2) {
        return;
    }
    int n = arr.length;

    // 0 - n
    // 0 - n-1
    // 0 - n-2
    for (int end = n - 1; end >= 0; end--) {

        // 提前退出冒泡循环的标志位
        boolean flag = false;

        // 0, 1
        // 1, 2
        // 2, 3
        for (int second = 1; second <= end; second++) {
            if (arr[second - 1] > arr[second]) {
                // 表示有数据交换
                flag = true;
                swap(arr, second - 1, second);
            }
        }

        // 没有数据交换，提前退出
        if (!flag) {
            break;
        }
    }
}

public static void swap(int[] arr, int i, int j) {
    int tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}
```
## 复杂度分析

时间复杂度：

- 最好情况：要排序的数据已经是有序的了，只需要进行一次冒泡操作，时间复杂度O(n)，例如：“1,2,3,4,5,6”
- 最坏情况：要排序的数据刚好是倒序排列的，需要进行 n 次冒泡操作，时间复杂度为 O(n^2)，例如：“6,5,4,3,2,1”
- 平均情况：O(n^2)

空间复杂度：

冒泡排序只涉及相邻数据交换操作，时间复杂度为O(1)，是一个原地排序算法。

# 插入排序（Insertion Sort）

插入排序包含元素比较和元素移动两种操作。当需要将一个数据 a 插入到已排序区间时，需要拿 a 与已排序区间的元素依次比较大小，找到合适的插入位置。然后将插入点之后的元素顺序往后移动一位，再插入 a 元素。

## 动画演示

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/algorithm/InsertionSort.gif)

## 代码示例

```java
public static void insertSort(int[] arr) {
    if (arr == null || arr.length < 2) {
        return;
    }

    int n = arr.length;
    for (int i = 1; i < n; i++) {
        for (int j = i - 1; arr[j] > arr[j + 1] && j >= 0; j--) {
            swap(arr, j, j + 1);
        }
    }
}

public static void swap(int[] arr, int i, int j) {
    int tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}
```

## 复杂度分析

时间复杂度：

- 最好情况，数据有序，复杂度O(n)
- 最坏情况，数据倒序，复杂度O(n^2)
- 平均情况：O(n^2)

空间复杂度：

插入排序算法是原地排序算法，空间复杂度O(1)

# 选择排序（Selection Sort）

选择排序算法的实现思路有点类似插入排序，也分已排序区间和未排序区间。但是选择排序每次会从未排序区间中找到最小的元素，将其放到已排序区间的末尾。

## 动画演示

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/algorithm/SelectionSort.gif)

## 代码示例

```java
public static void selectSort(int[] arr) {
    if (arr == null || arr.length < 2) {
        return;
    }
    int n = arr.length;
    for (int i = 0; i < n; i++) {
        int minValueIndex = i;
        for (int j = i + 1; j < n; j++) {
            minValueIndex = arr[minValueIndex] > arr[j] ? j : minValueIndex;
        }
        swap(arr, i, minValueIndex);
    }
}

public static void swap(int[] arr, int i, int j) {
    int tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}
```

## 复杂度分析

时间复杂度：

最好/最坏/平均情况下时间复杂度都为 O(n^2)

空间复杂度：

原地排序，复杂度O(1)

# 归并排序（Merge Sort）

归并排序：如果要排序一个数组，先把数组从中间分成前后两部分，然后对前后两部分分别排序，再将排好序的两部分合并。

## 动画演示

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/algorithm/MergeSort.gif)

## 代码示例

```java
public static void mergeSort(int[] arr) {
    if (arr == null || arr.length < 2) {
        return;
    }

    process(arr, 0, arr.length - 1);
}

public static void process(int[] arr, int l, int r) {
    if (l == r) {
        return;
    }

    // 中点位置 (l+r)/2
    int mid = l + ((r - l) >> 1);

    // 二分后分别排序
    process(arr, l, mid);
    process(arr, mid + 1, r);

    // 合并已经排好序的两块数组
    merge(arr, l, mid, r);
}

public static void merge(int[] arr, int l, int mid, int r) {
    // 辅助数组
    int[] help = new int[r - l + 1];

    int i = 0;

    // 用两个指针分别指向[l,mid], (mid, r]
    int p1 = l;
    int p2 = mid + 1;

    // 正常范围, 依次比较, 小的放到辅助数组, 指针后移
    while (p1 <= mid && p2 <= r) {
        help[i++] = arr[p1] <= arr[p2] ? arr[p1++] : arr[p2++];
    }

    // 如果p1没越界, p2越界, 把p1剩下的数拷贝到辅助数组
    while (p1 <= mid) {
        help[i++] = arr[p1++];
    }

    // 如果p2没越界, p1越界, 把p2剩下的数拷贝到辅助数组
    while (p2 <= r) {
        help[i++] = arr[p2++];
    }

    for (int j = 0; j < help.length; j++) {
        arr[l + j] = help[j];
    }
}
```

## 复杂度分析

时间复杂度：

根据Master公式，T(N) = 2 * T(N/2) + O(N)，a=2，b=2，d=1, log(b,a)==d，所以时间复杂度为O(N * logN)

最好情况、最坏情况，平均情况，时间复杂度都是 O(nlogn)。

空间复杂度：

空间复杂度O(n)。

# 快速排序（Quick Sort）

快速排序算法（Quicksort），简称为“快排”，利用的也是分治思想。

快排思想：(要排序数组中下标从 p 到 r 之间的一组数据)

- 选择 p 到 r 之间的任意一个数据作为 pivot（分区点）。
- 遍历 p 到 r 之间的数据，将小于 pivot 的放到左边，将大于 pivot 的放到右边，将 pivot 放到中间。

经过这一步骤之后，数组 p 到 r 之间的数据就被分成了三个部分，前面 p 到 q-1 之间都是小于 pivot 的，中间是 pivot，后面的 q+1 到 r 之间是大于 pivot 的。

根据分治、递归的处理思想，可以用递归排序下标从 p 到 q-1 之间的数据和下标从 q+1 到 r 之间的数据，直到区间缩小为 1，所有的数据都有序了。

## 动画演示

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/algorithm/QuickSort.gif)

## 代码示例

```java
// 随机快速排序
public static void quickSort(int[] arr) {
    if (arr == null || arr.length < 2) {
        return;
    }
    process(arr, 0, arr.length - 1);
}

public static void process(int[] arr, int l, int r) {
    if (l >= r) {
        return;
    }
    swap(arr, l + (int) (Math.random() * (r - l + 1)), r);
    int[] equalArea = partition(arr, l, r);
    process(arr, l, equalArea[0] - 1);
    process(arr, equalArea[1] + 1, r);
}

// 在arr[l...r]范围上, 对arr[r]做划分值
// 对于l...r范围, 小于arr[r]在左边, 等于在中间, 大于在右边
public static int[] partition(int[] arr, int l, int r) {
    // 小于区域右边界
    int lessR = l - 1;
    // 大于区域左边界
    int moreL = r;
    int index = l;
    while (index < moreL) {
        if (arr[index] < arr[r]) {
            // 如果小于, 跟小于区域右侧第一个值交换, 继续处理下一个值
            swap(arr, ++lessR, index++);
        } else if (arr[index] > arr[r]) {
            // 如果大于, 跟大于区域左侧第一个值交换, 交换完不需要移动index
            swap(arr, --moreL, index);
        } else {
            index++;
        }
    }
    // 交换大于区域左侧第一个值和目标arr[r]
    swap(arr, moreL, r);

    // 返回等于位置左右边界
    return new int[] { lessR + 1, moreL };
}

public static void swap(int[] arr, int i, int j) {
    int tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}
```

## 复杂度分析

时间复杂度：

* 最好、平均情况 O(nlogn)， 每次分区操作，都能正好把数组分成大小接近相等的两个小区间
* 最坏情况 O(n^2)，数组已有序排列

空间复杂度：O(nlogn)

# 排序算法复杂度快查表

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/algorithm/sort.png)