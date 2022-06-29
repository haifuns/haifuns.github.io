title: 【算法基础】归并排序
author: haifun
tags:
  - 算法
  - 归并
categories:
  - 算法
date: 2022-06-29 23:00:00

---

归并排序：如果要排序一个数组，先把数组从中间分成前后两部分，然后对前后两部分分别排序，再将排好序的两部分合并。

根据Master公式，T(N) = 2 * T(N/2) + O(N)，a=2，b=2，d=1, log(b,a)==d，所以时间复杂度为O(N * logN)。

# 归并排序递归实现

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

# 归并排序非递归实现

非递归核心在于操作步长
1. 步长为2^0, 每1个一组排序
2. 步长为2^1, 每2个一组排序, 最后凑不够单独一组
3. 步长为2^2, 每4个一组排序, 最后凑不够单独一组

```java
public static void mergeSort2(int[] arr) {
  if (arr == null || arr.length < 2) {
    return;
  }
  int N = arr.length;
  // 步长
  int mergeSize = 1;
  while (mergeSize < N) { // log N
    // 当前左组的，第一个位置
    int L = 0;
    while (L < N) {
      if (mergeSize >= N - L) {
        break;
      }
      int M = L + mergeSize - 1;
      int R = M + Math.min(mergeSize, N - M - 1);
      merge(arr, L, M, R);
      L = R + 1;
    }
    // 防止溢出
    if (mergeSize > N / 2) {
      break;
    }
    mergeSize <<= 1;
  }
}

public static void merge(int[] arr, int L, int M, int R) {
  int[] help = new int[R - L + 1];
  int i = 0;
  int p1 = L;
  int p2 = M + 1;
  while (p1 <= M && p2 <= R) {
    help[i++] = arr[p1] <= arr[p2] ? arr[p1++] : arr[p2++];
  }
  // 要么p1越界了，要么p2越界了
  while (p1 <= M) {
    help[i++] = arr[p1++];
  }
  while (p2 <= R) {
    help[i++] = arr[p2++];
  }
  for (i = 0; i < help.length; i++) {
    arr[L + i] = help[i];
  }
}
```

# 1. 小和问题

在一个数组中，每一个数左边比当前数小的数累加起来，叫做这个数组的小和。求指定数组的小和。

归并解题思路：
找到每个数右边更大的数数量*当前数，求和

```java
public static int smallSum(int[] arr) {
    if (arr == null || arr.length < 2) {
        return 0;
    }
    return process(arr, 0, arr.length - 1);
}

// arr[l..r]既要排好序，也要求小和返回
// 所有merge时，产生的小和，累加
// 左 排序   merge
// 右 排序  merge
// merge
public static int process(int[] arr, int l, int r) {
    if (l == r) {
        return 0;
    }
    // l < r
    int mid = l + ((r - l) >> 1);
    return process(arr, l, mid) +
           process(arr, mid + 1, r) +
           merge(arr, l, mid, r);
}

public static int merge(int[] arr, int l, int m, int r) {
    int[] help = new int[r - l + 1];
    int i = 0;
    int p1 = l;
    int p2 = m + 1;
    int res = 0;
    while (p1 <= m && p2 <= r) {
        res += arr[p1] < arr[p2] ? (r - p2 + 1) * arr[p1] : 0; // 左侧第一个数比右侧第一个更小, 此时右侧剩余的数都更大
        help[i++] = arr[p1] < arr[p2] ? arr[p1++] : arr[p2++];
    }
    while (p1 <= m) {
        help[i++] = arr[p1++];
    }
    while (p2 <= r) {
        help[i++] = arr[p2++];
    }
    for (i = 0; i < help.length; i++) {
        arr[l + i] = help[i];
    }
    return res;
}
```

# 2. 逆序对问题（LeetCode 剑指 Offer 51. hard）

在数组中的两个数字，如果前面一个数字大于后面的数字，则这两个数字组成一个逆序对。输入一个数组，求出这个数组中的逆序对的总数。

```java
public static int reversePairNumber(int[] arr) {
    if (arr == null || arr.length < 2) {
        return 0;
    }
    return process(arr, 0, arr.length - 1);
}

// arr[L..R]既要排好序，也要求逆序对数量返回
// 所有merge时，产生的逆序对数量，累加，返回
// 左 排序 merge并产生逆序对数量
// 右 排序 merge并产生逆序对数量
public static int process(int[] arr, int l, int r) {
    if (l == r) {
        return 0;
    }
    // l < r
    int mid = l + ((r - l) >> 1);
    return process(arr, l, mid) + process(arr, mid + 1, r) + merge(arr, l, mid, r);
}

public static int merge(int[] arr, int L, int m, int r) {
    int[] help = new int[r - L + 1];
    int i = help.length - 1;
    int p1 = m;
    int p2 = r;
    int res = 0;
    while (p1 >= L && p2 > m) {
        res += arr[p1] > arr[p2] ? (p2 - m) : 0; // 如果p1位置数大于p2位置，那么从m-p2都小于p1
        help[i--] = arr[p1] > arr[p2] ? arr[p1--] : arr[p2--]; // 逆序合并
    }
    while (p1 >= L) {
        help[i--] = arr[p1--];
    }
    while (p2 > m) {
        help[i--] = arr[p2--];
    }
    for (i = 0; i < help.length; i++) {
        arr[L + i] = help[i];
    }
    return res;
}
```

# 3. 翻转对问题（LeetCode 493. hard）

给定一个数组nums，如果i < j且nums[i] > 2*nums[j]就将(i, j)称作一个重要翻转对。返回给定数组中的重要翻转对的数量。

```java
public static int reversePairs(int[] arr) {
    if (arr == null || arr.length < 2) {
        return 0;
    }
    return process(arr, 0, arr.length - 1);
}

public static int process(int[] arr, int l, int r) {
    if (l == r) {
        return 0;
    }
    // l < r
    int mid = l + ((r - l) >> 1);
    return process(arr, l, mid) + process(arr, mid + 1, r) + merge(arr, l, mid, r);
}

public static int merge(int[] arr, int L, int m, int r) {
    // [L....M] [M+1....R]
    int ans = 0;

    // 首先统计数量
    // 目前囊括进来的数，是从[M+1, windowR)
    int windowR = m + 1;
    for (int i = L; i <= m; i++) {
        while (windowR <= r && (long) arr[i] > (long) arr[windowR] * 2) { // 不需要回溯
            windowR++;
        }
        ans += windowR - m - 1;
    }

    // 合并两个排序数组
    int[] help = new int[r - L + 1];
    int i = 0;
    int p1 = L;
    int p2 = m + 1;
    while (p1 <= m && p2 <= r) {
        help[i++] = arr[p1] <= arr[p2] ? arr[p1++] : arr[p2++];
    }
    while (p1 <= m) {
        help[i++] = arr[p1++];
    }
    while (p2 <= r) {
        help[i++] = arr[p2++];
    }
    for (i = 0; i < help.length; i++) {
        arr[L + i] = help[i];
    }
    return ans;
}
```

# 4. 区间和的个数（LeetCode 327. hard）

给定一个整数数组nums 以及两个整数lower 和 upper 。求数组中，值位于范围 [lower, upper] （包含lower和upper）之内的 区间和的个数 。
区间和S(i, j)表示在nums中，位置从i到j的元素之和，包含i和j(i ≤ j)。

思路：
S(i, j) = S(0,j) - S(0,i-1)，提前准备好前缀和数组，用前缀和相减减少频繁累加i-j。

```java
public static int countRangeSum(int[] nums, int lower, int upper) {
    if (nums == null || nums.length == 0) {
        return 0;
    }
    // S(i, j) = S(0, j) - S(0, i-1), 用前缀和相减代替遍历求和
    // 提前准备好前缀和数组
    long[] sum = new long[nums.length];
    sum[0] = nums[0];
    for (int i = 1; i < nums.length; i++) {
        sum[i] = sum[i - 1] + nums[i];
    }
    return process(sum, 0, sum.length - 1, lower, upper);
}

public static int process(long[] sum, int L, int R, int lower, int upper) {
    if (L == R) { // 退出条件
        return sum[L] >= lower && sum[L] <= upper ? 1 : 0; // 不能再merge直接判断
    }
    int M = L + ((R - L) >> 1);
    return process(sum, L, M, lower, upper) + process(sum, M + 1, R, lower, upper)
           + merge(sum, L, M, R, lower, upper);
}

public static int merge(long[] arr, int L, int M, int R, int lower, int upper) {
    int ans = 0;
    int windowL = L;
    int windowR = L;
    // [windowL, windowR)
    for (int i = M + 1; i <= R; i++) { // [M+1,R]
        long min = arr[i] - upper; // 最小前缀和
        long max = arr[i] - lower; // 最大前缀和
        while (windowR <= M && arr[windowR] <= max) {
            windowR++; // 满足条件的最大位置
        }
        while (windowL <= M && arr[windowL] < min) {
            windowL++; // 满足条件的最小位置
        }
        ans += windowR - windowL; // 满足条件的前缀和个数
    }
    
    long[] help = new long[R - L + 1];
    int i = 0;
    int p1 = L;
    int p2 = M + 1;
    while (p1 <= M && p2 <= R) {
        help[i++] = arr[p1] <= arr[p2] ? arr[p1++] : arr[p2++];
    }
    while (p1 <= M) {
        help[i++] = arr[p1++];
    }
    while (p2 <= R) {
        help[i++] = arr[p2++];
    }
    for (i = 0; i < help.length; i++) {
        arr[L + i] = help[i];
    }
    return ans;
}
```
