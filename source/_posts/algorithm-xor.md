title: 【算法基础】异或运算
author: haifun
tags:
  - 算法
  - 异或
categories:
  - 算法
date: 2022-06-22 20:00:00

---

异或运算：相同为0，不同为1。异或运算相当于无进位相加。

# 1. 不用额外变量交换两个数

```java
public static void main(String[] args) {
    int a = 16;
    int b = 61;

    System.out.println(a);
    System.out.println(b);

    a = a ^ b;
    b = a ^ b; // a ^ b ^ b = a
    a = a ^ b; // a ^ b ^ a = b

    System.out.println(a);
    System.out.println(b);

    int[] arr = { 1, 6, 16, 61 };
    System.out.println(arr[0]);
    System.out.println(arr[2]);

    swap(arr, 0, 2);

    System.out.println(arr[0]);
    System.out.println(arr[2]);
}

// 异或实现数组位置交换
// 前提是i, j不为同一个位置
public static void swap(int[] arr, int i, int j) {
    arr[i] = arr[i] ^ arr[j];
    arr[j] = arr[i] ^ arr[j]; // arr[i] ^ arr[j] ^ arr[j] = arr[i]
    arr[i] = arr[i] ^ arr[j]; // arr[i] ^ arr[j] ^ arr[i] = arr[j]
}
```

# 2. 一个数组中有一个数出现了奇数次，其他数出现偶数次，找到出现奇数次的数

遍历异或，结果是出现奇数次的数。

```java
public static void main(String[] args) {
    int[] arr2 = { 1, 1, 2, 2, 3, 4, 3, 5, 6, 5, 6 };
    int ans = 0;
    for (int i = 0; i < arr2.length; i++) {
        ans = ans ^ arr2[i];
    }
    System.out.println(ans);
}
```

# 3. 怎么提取出一个int类型的数二进制最低位的1

a & (~a+1) 即 a & -a。补码公式：-n = ~n + 1，引申：~n = -n - 1

```
         a = 011011100110000
        ~a = 100100011001111
    ~a + 1 = 100100011010000 = -a
a & (~a+1) = 000000000010000
```

# 4. 一个数组中有两种数出现了奇数次，其他数出现偶数次，找到出现奇数次的数

```java
public void printOddTimesNum2(int[] arr) {
    int eor = 0;
    for (int i = 0; i < arr.length; i++) {
        eor ^= arr[i]; // 最终eor得到两个奇数异或后的值
    }

    int rightOne = eor & (-eor); // 提取出最右的1

    int onlyOne = 0; // eor'
    for (int i = 0; i < arr.length; i++) {
        if ((arr[i] & rightOne) != 0) { // &运算不等于0, 满足条件条件的是部分出现偶数次的数和一个奇数次的数
            onlyOne ^= arr[i]; // 最终eor'为在eor最右1位置不为1的奇数
        }
    }
    System.out.println(onlyOne + " " + (eor ^ onlyOne)); // eor ^ eor'得到另一个奇数
}
```

# 5. 一个数组中有一种数出现了K次，其他数出现M次，，1 <= K < M，找到出现K次的数

要求：额外空间复杂度O(1)，时间复杂度O(n)

```java
public int onlyKTimes(int[] arr, int k, int m) {
    int[] help = new int[32]; // 整个数组二进制每位计数
    for (int num : arr) {
        for (int i = 0; i < 32; i++) {
            help[i] += (num >> i) & 1;
        }
    }

    int ans = 0;
    for (int i = 0; i < 32; i++) {
        help[i] %= m; // 取余不为0说明是出现k次的数
        if (help[i] != 0) {
            ans |= 1 << i; // 合并每一个二进制位
        }
    }

    return ans;
}
```
