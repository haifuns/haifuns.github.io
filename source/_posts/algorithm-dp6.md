title: 【算法基础】暴力递归到动态规划（六）
author: haifun
tags:
  - 算法
  - 动态规划
categories:
  - 算法
date: 2022-09-11 16:30:00

---

# 1.拆分数组

给定一个正整数组 arr，将 arr 中所有的数分成两个集合，尽量让两个集合的累加和接近。
返回最近情况下，较小集合的累计和。

## 暴力递归

```java
public static int right(int[] arr) {
	if (arr == null || arr.length < 2) {
		return 0;
	}
	int sum = 0;
	for (int num : arr) {
		sum += num;
	}
	return process(arr, 0, sum / 2);
}

// 从arr[i..]自由选择，累加和尽量接近rest，但不能超过rest的情况下，最接近的累加和
public static int process(int[] arr, int index, int rest) {
	if (index == arr.length) {
		return 0;
	} else { // 还有数，arr[i]这个数
		// 可能性1，不使用arr[i]
		int p1 = process(arr, index + 1, rest);
		// 可能性2，要使用arr[i]
		int p2 = 0;
		if (arr[index] <= rest) {
			p2 = arr[index] + process(arr, index + 1, rest - arr[index]);
		}
		return Math.max(p1, p2);
	}
}
```

## 动态规划

```java
public static int dp(int[] arr) {
	if (arr == null || arr.length < 2) {
		return 0;
	}
	int sum = 0;
	for (int num : arr) {
		sum += num;
	}
	sum /= 2;
	int N = arr.length;
	int[][] dp = new int[N + 1][sum + 1]; // N * (sum/2)
	for (int i = N - 1; i >= 0; i--) { // 从下往上
		for (int rest = 0; rest <= sum; rest++) { // 从左往右
			// 可能性1，不使用arr[i]
			int p1 = dp[i + 1][rest];
			// 可能性2，要使用arr[i]
			int p2 = 0;
			if (arr[i] <= rest) {
				p2 = arr[i] + dp[i + 1][rest - arr[i]];
			}
			dp[i][rest] = Math.max(p1, p2);
		}
	}
	return dp[0][sum];
}
```

# 2.拆分数组2

给定一个正数数组 arr，把 arr 中的所有数分为两个集合。

要求：
- 如果 arr 长度为偶数，两个集合包含的个数要一样多
- 如果 arr 长度为奇数，两个集合包含的个数必须要差一个
- 两个集合的累计和尽可能接近

返回最接近情况下，较小集合的累加和。

## 暴力递归

```java
public static int right(int[] arr) {
	if (arr == null || arr.length < 2) {
		return 0;
	}
	int sum = 0;
	for (int num : arr) {
		sum += num;
	}
	if ((arr.length & 1) == 0) {
		return process(arr, 0, arr.length / 2, sum / 2);
	} else {
		return Math.max(process(arr, 0, arr.length / 2, sum / 2), process(arr, 0, arr.length / 2 + 1, sum / 2));
	}
}

// 从arr[i..]自由选择，挑选picks个数，累加和<=rest, 返回离rest最近的累加和
public static int process(int[] arr, int i, int picks, int rest) {
	if (i == arr.length) {
		return picks == 0 ? 0 : -1; // -1标记无效
	} else {
		// 不使用arr[i]这个数
		int p1 = process(arr, i + 1, picks, rest);
		// 要使用arr[i]这个数
		int p2 = -1;
		int next = -1;
		if (arr[i] <= rest) {
			next = process(arr, i + 1, picks - 1, rest - arr[i]);
		}
		if (next != -1) {
			p2 = arr[i] + next;
		}
		return Math.max(p1, p2);
	}
}
```

## 动态规划

```java
public static int dp(int[] arr) {
	if (arr == null || arr.length < 2) {
		return 0;
	}
	int sum = 0;
	for (int num : arr) {
		sum += num;
	}
	sum /= 2;
	int N = arr.length;
	int M = (N + 1) / 2;
	int[][][] dp = new int[N + 1][M + 1][sum + 1];
	for (int i = 0; i <= N; i++) {
		for (int j = 0; j <= M; j++) {
			for (int k = 0; k <= sum; k++) {
				dp[i][j][k] = -1;
			}
		}
	}
	for (int rest = 0; rest <= sum; rest++) {
		dp[N][0][rest] = 0; // i=N picks=0，有效
	}
	for (int i = N - 1; i >= 0; i--) {
		for (int picks = 0; picks <= M; picks++) {
			for (int rest = 0; rest <= sum; rest++) {
				// 不要arr[i]这个数
				int p1 = dp[i + 1][picks][rest];
				// 要使用arr[i]这个数
				int p2 = -1;
				int next = -1;
				if (picks - 1 >= 0 && arr[i] <= rest) {
					next = dp[i + 1][picks - 1][rest - arr[i]];
				}
				if (next != -1) {
					p2 = arr[i] + next;
				}
				dp[i][picks][rest] = Math.max(p1, p2);
			}
		}
	}
	if (arr.length % 2 == 0) {
		return dp[0][arr.length / 2][sum];
	} else {
		return Math.max(dp[0][arr.length / 2][sum], dp[0][(arr.length / 2) + 1][sum]);
	}
}
```

# 3.N皇后问题（无法改动态规划）

N皇后问题：在 N * N 的棋盘上要摆 N 个皇后，要求任何两个皇后不同行、不同列，也不在同一条斜线上。

给定一个整数 N，返回 N 皇后问题有多少种摆法。

N=1，返回1
N=2或3，2皇后和3皇后问题无论怎么摆都不行，返回0
N=8，返回92

## 暴力递归

```java
public static int num(int n) {
	if (n < 1) {
		return 0;
	}
	int[] record = new int[n];
	return process(0, record, n);
}

// 当前来到i行，一共是0~N-1行
// 在i行上放皇后，所有列都尝试
// 必须要保证跟之前所有的皇后不打架
// record[x] = y 表示第x行的皇后，放在了y列上
// 返回：不关心i以上发生了什么，i.. 后续有多少合法的方法数
public static int process(int i, int[] record, int n) {
	if (i == n) {
		return 1;
	}
	int res = 0;
	// i行的皇后，放哪一列呢？j列，
	for (int j = 0; j < n; j++) {
		if (isValid(record, i, j)) {
			record[i] = j;
			res += process(i + 1, record, n);
		}
	}
	return res;
}

public static boolean isValid(int[] record, int i, int j) {
	// 0..i-1
	for (int k = 0; k < i; k++) {
		// 共列或者共斜线
		if (j == record[k] || Math.abs(record[k] - j) == Math.abs(i - k)) {
			return false;
		}
	}
	return true;
}
```

## 暴力递归（位运算，常数时间优化）

```java
// 不要超过32皇后问题，越界
public static int num(int n) {
	if (n < 1 || n > 32) {
		return 0;
	}
	// 如果你是13皇后问题，limit 最右13个1，其他都是0
	int limit = n == 32 ? -1 : (1 << n) - 1;
	return process(limit, 0, 0, 0);
}

// limit : 二进制右侧N个1
// 之前皇后的列影响：colLim
// 之前皇后的左下对角线影响：leftDiaLim
// 之前皇后的右下对角线影响：rightDiaLim
public static int process(int limit, int colLim, int leftDiaLim, int rightDiaLim) {
	if (colLim == limit) {
		return 1;
	}
	// pos中所有是1的位置，是可以去尝试皇后的位置
	int pos = limit & (~(colLim | leftDiaLim | rightDiaLim));
	int mostRightOne = 0;
	int res = 0;
	while (pos != 0) {
		// pos中最右侧的1
		mostRightOne = pos & (~pos + 1);
		pos = pos - mostRightOne;
		res += process(limit, colLim | mostRightOne, (leftDiaLim | mostRightOne) << 1,
		                (rightDiaLim | mostRightOne) >>> 1);
	}
	return res;
}
```
