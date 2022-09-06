title: 【算法基础】暴力递归到动态规划（四）
author: haifun
tags:
  - 算法
  - 动态规划
categories:
  - 算法
date: 2022-09-06 23:59:00

---

# 1.最小距离累加和问题

给定一个二维数组 matrix，一个人必须从左上角出发，最后到达右下角。

中途只能向下或者向右走，沿途的数字都累加就是距离累加和。返回最小距离累加和。

## 暴力递归

```java
public static int minPathSum(int[][] m) {
	if (m == null || m.length == 0 || m[0] == null || m[0].length == 0) {
		return 0;
	}
	int row = m.length;
	int col = m[0].length;
	return process(m, row - 1, col - 1);
}

public static int process(int[][] m, int row, int col) {
	if (row < 0 || row > m.length || col < 0 || col > m[0].length) {
		return 0;
	}

	if (row != 0 && col == 0) {
		return process(m, row - 1, col) + m[row][col];  // 第0列，上边值 + 当前值
	}

	if (row == 0 && col != 0) {
		return process(m, row, col - 1) + m[row][col];  // 第0行，左边值 + 当前值
	}

	int left = process(m, row, col - 1);
	int up = process(m, row - 1, col);
	return Math.min(left, up) + m[row][col];  // min(上边值, 左边值) + 当前值
}
```

## 动态规划

```java
public static int minPathSum(int[][] m) {
	if (m == null || m.length == 0 || m[0] == null || m[0].length == 0) {
		return 0;
	}
	int row = m.length;
	int col = m[0].length;
	int[][] dp = new int[row][col];
	dp[0][0] = m[0][0];
	for (int i = 1; i < row; i++) {
		dp[i][0] = dp[i - 1][0] + m[i][0]; // 第0列，上边值 + 当其值
	}
	for (int j = 1; j < col; j++) {
		dp[0][j] = dp[0][j - 1] + m[0][j]; // 第0行，左边值 + 当其值
	}
	for (int i = 1; i < row; i++) { // 从上往下
		for (int j = 1; j < col; j++) { // 从左到右
			dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1]) + m[i][j]; // min(上边值, 左边值) + 当其值
		}
	}
	return dp[row - 1][col - 1]; // 右下角
}
```

## 动态规划（空间压缩优化）

```java
public static int minPathSum(int[][] m) {
	if (m == null || m.length == 0 || m[0] == null || m[0].length == 0) {
		return 0;
	}
	int row = m.length;
	int col = m[0].length;
	int[] dp = new int[col]; // 列，也可以用行计算，推算过程同理，行列谁短用谁
	dp[0] = m[0][0];
	for (int j = 1; j < col; j++) {
		dp[j] = dp[j - 1] + m[0][j]; // 初始第0列，左边值 + 当前值
	}
	for (int i = 1; i < row; i++) { // 从上往下
		dp[0] += m[i][0]; // 当前行第一个值，上边 + 当前值
		for (int j = 1; j < col; j++) { // 从左往右
			// dp[j - 1] -> 当前位置左边值，更新过了
			// dp[j] -> 当前位置上边值，没更新还是上一行的值
			dp[j] = Math.min(dp[j - 1], dp[j]) + m[i][j]; // min(上边值, 左边值) + 当其值
		}
	}
	return dp[col - 1];
}
```

# 2.零钱兑换问题

货币数组 arr，其中都是正数，每个值都认为是一张不同的货币，即使值相同也认为是不同的。

给定一个正数 aim，返回能组成 aim 的方法数。

例如：arr = {1,1,1}，aim = 2

第 0 个和第 1 个、第 1 个和第 2 个、第 0 个和第 2 个都能组成 2，返回 3。

## &#x20;暴力递归

```java
public static int coinWays(int[] arr, int aim) {
	return process(arr, 0, aim);
}

public static int process(int[] arr, int index, int rest) {
	if (rest < 0) {
		return 0;
	}
	if (index == arr.length) { // 没钱了
		return rest == 0 ? 1 : 0;
	} else {
		return process(arr, index + 1, rest) + process(arr, index + 1, rest - arr[index]); // 用当前位置钱，剩余钱减少 + 不用当前位置钱
	}
}
```

## &#x20;动态规划

```java
// 暴力递归改动态规划
public static int dp(int[] arr, int aim) {
	if (aim == 0) {
		return 1;
	}
	int N = arr.length;
	int[][] dp = new int[N + 1][aim + 1]; // index 0~N，aim 0~aim
	dp[N][0] = 1;
	for (int index = N - 1; index >= 0; index--) { // 从下往上
		for (int rest = 0; rest <= aim; rest++) { // 从左往右
			dp[index][rest] = dp[index + 1][rest] + (rest - arr[index] >= 0 ? dp[index + 1][rest - arr[index]] : 0);
		}
	}
	return dp[0][aim];
}
```

# 3.零钱兑换问题2-面值无限张

面值数组 arr，其中都是正数且没有重复，每个值都认为是一种面值且张数是无限的。

给定一个正数 aim，返回能组成 aim 的方法数。

例如：arr = {1,2}，aim = 4

1+1+1+1、1+1+2、2+2，返回 3。

## 暴力递归

```java
public static int coinsWay(int[] arr, int aim) {
	if (arr == null || arr.length == 0 || aim < 0) {
		return 0;
	}
	return process(arr, 0, aim);
}

public static int process(int[] arr, int index, int rest) {
	if (index == arr.length) { // 没钱了
		return rest == 0 ? 1 : 0;
	}
	int ways = 0;
	for (int zhang = 0; zhang * arr[index] <= rest; zhang++) { // 使用 0 ~ 钱数/面值 张
		ways += process(arr, index + 1, rest - (zhang * arr[index]));
	}
	return ways;
}
```

## 动态规划

```java
public static int dp(int[] arr, int aim) {
	if (arr == null || arr.length == 0 || aim < 0) {
		return 0;
	}
	int N = arr.length;
	int[][] dp = new int[N + 1][aim + 1];
	dp[N][0] = 1;
	for (int index = N - 1; index >= 0; index--) { // 从下往上
		for (int rest = 0; rest <= aim; rest++) { // 从左往右
			int ways = 0;
			for (int zhang = 0; zhang * arr[index] <= rest; zhang++) {
				ways += dp[index + 1][rest - (zhang * arr[index])]; // 枚举每张面值
			}
			dp[index][rest] = ways;
		}
	}
	return dp[0][aim];
}
```

## 动态规划（优化枚举）

```java
public static int dp(int[] arr, int aim) {
	if (arr == null || arr.length == 0 || aim < 0) {
		return 0;
	}
	int N = arr.length;
	int[][] dp = new int[N + 1][aim + 1];
	dp[N][0] = 1;
	for (int index = N - 1; index >= 0; index--) {
		for (int rest = 0; rest <= aim; rest++) {
			dp[index][rest] = dp[index + 1][rest];
			if (rest - arr[index] >= 0) {
 				// 画出二维表观察，优化遍历枚举，当前位置遍历枚举 = 左边位置 + 下边位置
				dp[index][rest] += dp[index][rest - arr[index]];
			}
		}
	}
	return dp[0][aim];
}
```

# 4.零钱兑换问题3-面值有限张

货币数组 arr，其中都是正数，每个值都认为是一种面值。值相同的货币没有任何不同。

给定一个正数 aim，返回能组成 aim 的方法数。

例如：arr = {1,2,1,1,2,1,2}，aim = 4

1+1+1+1、1+1+2、2+2，返回 3。

## 暴力低估

```java
public static class Info {
	public int[] coins; // 面值
	public int[] zhangs; // 张数

	public Info(int[] c, int[] z) {
		coins = c;
		zhangs = z;
	}
}

public static Info getInfo(int[] arr) {
	HashMap<Integer, Integer> counts = new HashMap<>();
	for (int value : arr) {
		if (!counts.containsKey(value)) {
			counts.put(value, 1);
		} else {
			counts.put(value, counts.get(value) + 1);
		}
	}
	int N = counts.size();
	int[] coins = new int[N];
	int[] zhangs = new int[N];
	int index = 0;
	for (Entry<Integer, Integer> entry : counts.entrySet()) {
		coins[index] = entry.getKey();
		zhangs[index++] = entry.getValue();
	}
	return new Info(coins, zhangs);
}

public static int coinsWay(int[] arr, int aim) {
	if (arr == null || arr.length == 0 || aim < 0) {
		return 0;
	}
	Info info = getInfo(arr);
	return process(info.coins, info.zhangs, 0, aim);
}

public static int process(int[] coins, int[] zhangs, int index, int rest) {
	if (index == coins.length) {
		return rest == 0 ? 1 : 0;
	}
	int ways = 0;
	for (int zhang = 0; zhang * coins[index] <= rest && zhang <= zhangs[index]; zhang++) { // 限制张数+余额，可以使用多少张
		ways += process(coins, zhangs, index + 1, rest - (zhang * coins[index]));
	}
	return ways;
}
```

## 动态规划

```java
public static int dp(int[] arr, int aim) {
	if (arr == null || arr.length == 0 || aim < 0) {
		return 0;
	}
	Info info = getInfo(arr);
	int[] coins = info.coins;
	int[] zhangs = info.zhangs;
	int N = coins.length;
	int[][] dp = new int[N + 1][aim + 1];
	dp[N][0] = 1;
	for (int index = N - 1; index >= 0; index--) {
		for (int rest = 0; rest <= aim; rest++) {
			int ways = 0;
			for (int zhang = 0; zhang * coins[index] <= rest && zhang <= zhangs[index]; zhang++) {
				ways += dp[index + 1][rest - (zhang * coins[index])];
			}
			dp[index][rest] = ways;
		}
	}
	return dp[0][aim];
}
```

## 动态规划（优化枚举）

```java
public static int dp(int[] arr, int aim) {
	if (arr == null || arr.length == 0 || aim < 0) {
		return 0;
	}
	Info info = getInfo(arr);
	int[] coins = info.coins;
	int[] zhangs = info.zhangs;
	int N = coins.length;
	int[][] dp = new int[N + 1][aim + 1];
	dp[N][0] = 1;
	for (int index = N - 1; index >= 0; index--) {
		for (int rest = 0; rest <= aim; rest++) {
			dp[index][rest] = dp[index + 1][rest];
			if (rest - coins[index] >= 0) {
				// 画出二维表观察，优化枚举，面值无限张时 当前位置枚举 = 左边位置 + 下边位置
				dp[index][rest] += dp[index][rest - coins[index]];
			}
			// 用超了张数
			if (rest - coins[index] * (zhangs[index] + 1) >= 0) {
				// 减去多用的张数位置，下一行，列 = 余额 - 面值 * (实际张数 + 1)
				dp[index][rest] -= dp[index + 1][rest - coins[index] * (zhangs[index] + 1)];
			}
		}
	}
	return dp[0][aim];
}
```

# 5.区域内随机移动概率问题

给定 5 个参数，N，M，row，col，k。

表示在 N\*M 区域上，醉汉 Bob 初始会在 (row,col) 位置上，一共会迈出 k 步，每一步等概率向上下左右四个方向走一个单位。

任何时候 Bob 只要离开 N\*M 的区域就会直接死亡。

返回 k 步后，Bob 还在 N\*M 区域的概率。

## 暴力递归

```java
public static double livePosibility(int row, int col, int k, int N, int M) {
	return (double) process(row, col, k, N, M) / Math.pow(4, k); // 4^k
}

// 目前在row，col位置，还有rest步要走，走完了如果还在棋盘中就获得1个生存点，返回总的生存点数
public static long process(int row, int col, int rest, int N, int M) {
	if (row < 0 || row == N || col < 0 || col == M) { // 越界
		return 0;
	}
	// 还在棋盘中，没有剩余步数
	if (rest == 0) {
		return 1;
	}
	// 还在棋盘中，往上下左右走
	long up = process(row - 1, col, rest - 1, N, M);
	long down = process(row + 1, col, rest - 1, N, M);
	long left = process(row, col - 1, rest - 1, N, M);
	long right = process(row, col + 1, rest - 1, N, M);
	return up + down + left + right;
}
```

## 动态规划

```java
public static double livePosibility(int row, int col, int k, int N, int M) {
	long[][][] dp = new long[N][M][k + 1];
	for (int i = 0; i < N; i++) {
		for (int j = 0; j < M; j++) {
			dp[i][j][0] = 1; // 三维，第0层，没有步数了
		}
	}
	for (int rest = 1; rest <= k; rest++) { // 层数，从上往下
		for (int r = 0; r < N; r++) {
			for (int c = 0; c < M; c++) {
				dp[r][c][rest] = pick(dp, N, M, r - 1, c, rest - 1);
				dp[r][c][rest] += pick(dp, N, M, r + 1, c, rest - 1);
				dp[r][c][rest] += pick(dp, N, M, r, c - 1, rest - 1);
				dp[r][c][rest] += pick(dp, N, M, r, c + 1, rest - 1);
			}
		}
	}
	return (double) dp[row][col][k] / Math.pow(4, k);
}

public static long pick(long[][][] dp, int N, int M, int r, int c, int rest) {
	if (r < 0 || r == N || c < 0 || c == M) {
		return 0;
	}
	return dp[r][c][rest];
}
```

