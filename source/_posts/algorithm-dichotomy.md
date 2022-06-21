title: 【算法基础】二分法
author: haifun
tags:
  - 算法
  - 二分法
categories:
  - 算法
date: 2022-06-21 22:00:00

---

二分法是一种常用的算法，对于一个有序数组，通过折半查找的方式可以有效降低查找时的时间复杂度，O(n) -> O(logn)。但是有序并不是所有问题求解时使用二分的必要条件，只要能正确构建左右两侧的淘汰逻辑就可以使用二分。

# 1. 在一个有序数组中，找到某个数是否存在

```java
public boolean find(int[] arr, int num) {
    if (arr == null || arr.length == 0) {
        return false;
    }

    int left = 0;
    int right = arr.length - 1;

    while (left <= right) {
        int mid = l + ((r - l) >> 1);
        if (arr[mid] == num) {
            return true;
        } else if (arr[mid] < num) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }

    return false;
}
```

# 2. 在一个有序数组中，找>=某个数最左侧的位置

```java
public int mostLeftNoLessNumIndex(int[] arr, int num) {
    if (arr == null || arr.length == 0) {
        return -1;
    }

    int l = 0;
    int r = arr.length - 1;
    int ans = -1;

    while (l <= r) {
        int mid = l + ((r - l) >> 1);
        if (arr[mid] >= num) {
            ans = mid;
            r = mid - 1;
        } else {
            l = mid + 1;
        }
    }

    return ans;
}
```

# 3. 在一个有序数组中，找<=某个数最右侧的位置

```java
public static int mostRightNoLessNumIndex(int[] arr, int num) {
    if (arr == null || arr.length == 0) {
        return -1;
    }

    int l = 0;
    int r = arr.length - 1;
    int ans = -1;

    while (l <= r) {
        int mid = l + ((r - l) >> 1);
        if (arr[mid] <= num) {
            ans = mid;
            l = mid + 1;
        } else {
            r = mid - 1;
        }
    }

    return ans;
}
```

# 4. 局部最小值问题，数据整体无序且满足相邻的数不相等, 返回一个局部最小

局部最小:
1. arr[0] < arr[1], 则0是局部最小
2. arr[n-2] > arr[n-1], 则n-1是局部最小
3. arr[i-1] < arr[i] < arr[i+1], 则i为局部最小

```java
public int oneMinIndex(int[] arr) {

    if (arr == null || arr.length == 0) {
        return -1;
    }

    if (arr.length == 1) {
        return 0;
    }

    int n = arr.length;

    // 最左局部最小
    if (arr[0] < arr[1]) {
        return 0;
    }

    // 最右局部最小
    if (arr[n - 2] > arr[n - 1]) {
        return n - 1;
    }

    // 普通情况局部最小
    int l = 0;
    int r = n - 1;

    while (l < r - 1) {
        int mid = l + ((r - l) >> 1);
        // 直接满足局部最小
        if (arr[mid - 1] > arr[mid] && arr[mid] < arr[mid + 1]) {
            return mid;
        } else {
            // 此时arr最左下降↘, 最右上升↗
            // 如果mid左侧上升, 则0 - mid之间必存在局部最小, ↘ ... ↗, 移动右边界
            if (arr[mid] > arr[mid - 1]) {
                r = mid - 1;
            } else {
                l = mid + 1;
            }
        }
    }

    return arr[l] < arr[r] ? l : r;
}
```
