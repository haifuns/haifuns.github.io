title: 【算法基础】暴力递归到动态规划（五）
author: haifun
tags:
  - 算法
  - 动态规划
categories:
  - 算法
date: 2022-09-07 23:59:00

---

# 1.打死怪兽的概率

给定 3 个参数，N，M，K，表示怪兽有 N 滴血，英雄每攻击一次，怪兽会在 0~M 范围等概率流失血量。
在 K 次打击后，英雄把怪兽砍死的概率是多少？

## 暴力递归

```java
public static double right(int N, int M, int K) {
	if (N < 1 || M < 1 || K < 1) {
		return 0;
	}
	long all = (long) Math.pow(M + 1, K); // 总的可能性，(M+1)^K
	long kill = process(K, M, N);
	return (double) ((double) kill / (double) all);
}

// 怪兽还剩hp点血，每次的伤害在[0~M]范围上，还有times次可以砍，返回砍死的情况数
public static long process(int times, int M, int hp) {
	if (times == 0) { // 没有次数了
		return hp <= 0 ? 1 : 0; // 血量小于0成功
	}
	if (hp <= 0) { // 没血了
		return (long) Math.pow(M + 1, times); // 剩下的所有情况都能成功，(M+1)^times
	}
	long ways = 0;
	for (int i = 0; i <= M; i++) { // 尝试掉 0 ~ M 滴血，每种情况概率
		ways += process(times - 1, M, hp - i);
	}
	return ways;
}
```

## 动态规划

```java
public static double dp(int N, int M, int K) {
	if (N < 1 || M < 1 || K < 1) {
		return 0;
	}
	long all = (long) Math.pow(M + 1, K);
	long[][] dp = new long[K + 1][N + 1]; // 剩余步数 * 剩余血量
	dp[0][0] = 1;
	for (int times = 1; times <= K; times++) { // 从上往下
		dp[times][0] = (long) Math.pow(M + 1, times); // 已经没血了，剩下的所有步数都能成功
		for (int hp = 1; hp <= N; hp++) { // 从左往右
			long ways = 0;
			for (int i = 0; i <= M; i++) { // 枚举掉血数
				if (hp - i >= 0) { // 还有血量
					ways += dp[times - 1][hp - i]; // 位置转移，上一行
				} else { // 没血了
					ways += (long) Math.pow(M + 1, times - 1);
				}
			}
			dp[times][hp] = ways;
		}
	}
	long kill = dp[K][N];
	return (double) ((double) kill / (double) all);
}
```

## 动态规划（斜率优化）

```java
public static double dp(int N, int M, int K) {
	if (N < 1 || M < 1 || K < 1) {
		return 0;
	}
	long all = (long) Math.pow(M + 1, K);
	long[][] dp = new long[K + 1][N + 1];
	dp[0][0] = 1;
	for (int times = 1; times <= K; times++) {
		dp[times][0] = (long) Math.pow(M + 1, times);
		for (int hp = 1; hp <= N; hp++) {
			// 画图观察，当前位置值 = dp[times-1][hp-m..hp]
			// = dp[times-1][hp-1-m..hp] - dp[times-1][hp-1-m] + dp[times-1][hp]
			// = dp[times][hp-1] + dp[times-1][hp] - dp[times-1][hp-1-m]
			// = 左边 + 上边 - dp[times-1][hp-1-m]
			dp[times][hp] = dp[times][hp - 1] + dp[times - 1][hp];
			if (hp - 1 - M >= 0) { // 不越界
				// 减去多的格子
				dp[times][hp] -= dp[times - 1][hp - 1 - M];
			} else {
				// 越界了，要减去的格子概率等于上一行0位置
				dp[times][hp] -= Math.pow(M + 1, times - 1);
			}
		}
	}
	long kill = dp[K][N];
	return (double) ((double) kill / (double) all);
}
```

# 2.零钱兑换问题4-面值无限张-最少货币张数

面值数组 arr，其中都是正数且没有重复，每个值都认为是一种面值且张数是无限的。
给定一个正数 aim，返回能组成 aim 的最少货币张数。

## 暴力递归

```java
public static int minCoins(int[] arr, int aim) {
	return process(arr, 0, aim);
}

public static int process(int[] arr, int index, int rest) {
	if (index == arr.length) { // 没钱了
		return rest == 0 ? 0 : Integer.MAX_VALUE; // 0张
	} else {
		int ans = Integer.MAX_VALUE;
		for (int zhang = 0; zhang * arr[index] <= rest; zhang++) { // 尝试使用 0 ~ 钱数/面值 张
			int next = process(arr, index + 1, rest - zhang * arr[index]);
			if (next != Integer.MAX_VALUE) {
				ans = Math.min(ans, zhang + next); // 尝试成功了
			}
		}
		return ans;
	}
}
```

## 动态规划

```java
public static int dp(int[] arr, int aim) {
	if (aim == 0) {
		return 0;
	}
	int N = arr.length;
	int[][] dp = new int[N + 1][aim + 1]; // 面值 * 剩余钱数
	dp[N][0] = 0;
	for (int j = 1; j <= aim; j++) {
		dp[N][j] = Integer.MAX_VALUE; // 越界
	}
	for (int index = N - 1; index >= 0; index--) { // 从下往上
		for (int rest = 0; rest <= aim; rest++) { // 从左往右
			int ans = Integer.MAX_VALUE;
			for (int zhang = 0; zhang * arr[index] <= rest; zhang++) {
				int next = dp[index + 1][rest - zhang * arr[index]];
				if (next != Integer.MAX_VALUE) {
					ans = Math.min(ans, zhang + next);
				}
			}
			dp[index][rest] = ans;
		}
	}
	return dp[0][aim];
}
```

## 动态规划（斜率优化）

```java
public static int dp(int[] arr, int aim) {
	if (aim == 0) {
		return 0;
	}
	int N = arr.length;
	int[][] dp = new int[N + 1][aim + 1];
	dp[N][0] = 0;
	for (int j = 1; j <= aim; j++) {
		dp[N][j] = Integer.MAX_VALUE;
	}
	for (int index = N - 1; index >= 0; index--) {
		for (int rest = 0; rest <= aim; rest++) {
			// 当前值 = min(dp[index][rest - arr[index]]+1, 下边值)
			// dp[index][rest - arr[index]]+1，用了1张当前面值
			// 下面值，用了0张当前面值
			dp[index][rest] = dp[index + 1][rest];
			if (rest - arr[index] >= 0 && dp[index][rest - arr[index]] != Integer.MAX_VALUE) {
				dp[index][rest] = Math.min(dp[index][rest], dp[index][rest - arr[index]] + 1);
			}
		}
	}
	return dp[0][aim];
}
```

# 3.拆分整数

给定一个正整数 n，将其拆分为 1 个或多个正整数的和，要求拆开的数后面的不能比前面的数小。返回最多有多少种拆分方式。

## 暴力递归

```java
public static int ways(int n) {
	if (n < 0) {
		return 0;
	}
	if (n == 1) {
		return 1;
	}
	return process(1, n);
}

// 上一个拆出来的数是pre，还剩rest需要去拆，返回拆解的方法数
public static int process(int pre, int rest) {
	if (rest == 0) {
		return 1;
	}
	if (pre > rest) { // 上一个拆出来的数不能比剩下的大
		return 0;
	}
	int ways = 0;
	for (int first = pre; first <= rest; first++) { // 不能比pre小，pre..rest
		ways += process(first, rest - first);
	}
	return ways;
}
```

## 动态规划

```java
public static int dp(int n) {
	if (n < 0) {
		return 0;
	}
	if (n == 1) {
		return 1;
	}
	int[][] dp = new int[n + 1][n + 1];
	for (int pre = 1; pre <= n; pre++) { // base case
		dp[pre][0] = 1;
		dp[pre][pre] = 1;
	}
	for (int pre = n - 1; pre >= 1; pre--) { // 从下往上
		for (int rest = pre + 1; rest <= n; rest++) { // 从左往右
			int ways = 0;
			for (int first = pre; first <= rest; first++) { // pre..rest
				ways += dp[first][rest - first];
			}
			dp[pre][rest] = ways;
		}
	}
	return dp[1][n];
}
```

## 动态规划（斜率优化）

```java
public static int dp2(int n) {
        if (n < 0) {
            return 0;
        }
        if (n == 1) {
            return 1;
        }
        int[][] dp = new int[n + 1][n + 1];
        for (int pre = 1; pre <= n; pre++) {
            dp[pre][0] = 1;
            dp[pre][pre] = 1;
        }
        for (int pre = n - 1; pre >= 1; pre--) {
            for (int rest = pre + 1; rest <= n; rest++) {
                // 画图观察，当前位置 = dp[pre + 1][rest] 下边 +  dp[pre][rest - pre]
                dp[pre][rest] = dp[pre + 1][rest];
                dp[pre][rest] += dp[pre][rest - pre];
            }
        }
        return dp[1][n];
    }
```
