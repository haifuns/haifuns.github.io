title: 【算法基础】不基于比较的排序（计数、基数）
author: haifun
tags:
  - 算法
  - 排序
categories:
  - 算法
date: 2022-07-17 23:10:00

---

计数排序和基数排序是不基于比较的排序，其思想都是基于容器（桶）进行排序。

# 计数排序

计数排序：对于有限数据范围的数据，利用一个相应大小的桶（从小到大对应每个数），对给定数组中每个值进行计数，完毕后从左到右每个数*n重新输出，完成排序。

时间复杂度：O(n+k)，空间复杂度：O(k)。

```java
public static void countSort(int[] arr) {
    if (arr == null || arr.length < 2) {
        return;
    }
    int max = Integer.MIN_VALUE;
    for (int i = 0; i < arr.length; i++) {
        max = Math.max(max, arr[i]);
    }
    int[] bucket = new int[max + 1];
    for (int i = 0; i < arr.length; i++) {
        bucket[arr[i]]++;
    }
    int i = 0;
    for (int j = 0; j < bucket.length; j++) {
        while (bucket[j]-- > 0) {
            arr[i++] = j;
        }
    }
}
```

# 基数排序

基数排序：准备一个大小为10的桶表示0-9，从个位开始，将每个数放到个位对应桶的位置里，然后按照先进先进输出，继续按照高位循环直到最大数最高位，相当于每次按照每位排序，到最高位后完成排序。

时间复杂度：O(n*k)，空间复杂度：O(n+k)。

```java
// 只适用非负数
public static void radixSort(int[] arr) {
    if (arr == null || arr.length < 2) {
        return;
    }
    radixSort(arr, 0, arr.length - 1, maxbits(arr));
}

// 最大值位数
public static int maxbits(int[] arr) {
    int max = Integer.MIN_VALUE;
    for (int i = 0; i < arr.length; i++) {
        max = Math.max(max, arr[i]);
    }
    int res = 0;
    while (max != 0) {
        res++;
        max /= 10;
    }
    return res;
}

// arr[L..R]排序 , 最大值的十进制位数digit
public static void radixSort(int[] arr, int L, int R, int digit) {
    final int radix = 10;
    int i = 0, j = 0;
    // 有多少个数准备多少个辅助空间
    int[] help = new int[R - L + 1];
    for (int d = 1; d <= digit; d++) { // 有多少位就进出几次
        // 10个空间
        // count[0] 当前位(d位)是0的数字有多少个
        // count[1] 当前位(d位)是(0和1)的数字有多少个
        // count[2] 当前位(d位)是(0、1和2)的数字有多少个
        // count[i] 当前位(d位)是(0~i)的数字有多少个
        int[] count = new int[radix]; // count[0..9]
        for (i = L; i <= R; i++) {
            // 103 1 3
            // 209 1 9
            j = getDigit(arr[i], d);
            count[j]++; // count数组先按照位数计数
        }
        for (i = 1; i < radix; i++) {
            count[i] = count[i] + count[i - 1]; // count转变成累加和，累加和：大于等于当前数个数
        }
        for (i = R; i >= L; i--) { // 原数组从右往左遍历，利用累加和可以直接找到应该在的位置
            j = getDigit(arr[i], d);
            help[count[j] - 1] = arr[i]; // 当前数应该在的位置就是相应累加和-1的位置
            count[j]--; // 使用完之后把相应位置累加和-1
        }
        for (i = L, j = 0; i <= R; i++, j++) {
            arr[i] = help[j]; // 辅助空间 -> 原始数组
        }
    }
}

// 指定位，大小
public static int getDigit(int x, int d) {
    return ((x / ((int) Math.pow(10, d - 1))) % 10);
}
```
