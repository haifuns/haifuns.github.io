title: 【算法基础】暴力递归到动态规划（三）
author: haifun
tags:
  - 算法
  - 动态规划
categories:
  - 算法
date: 2022-09-05 23:30:00

---

# 1.最长回文子序列（LeetCode 516.）

给定一个字符串 str，返回这个字符串的最长回文子序列长度。

例如：str = “a12b3c43defghi1kpm”，最长回文子序列是 “1234321” 或 “123c321”，返回长度7。

> 一般来说，字符串的子序列不需要字符连续，子串需要字符连续。

此题可以利用上一篇的最长公共子序列，str 和 str 逆序的最长公共子序列就是 str 的最长回文子序列。可看上一篇回忆，这里不做实现了。

## 暴力递归

```java
public static int lpsl(String s) {
	if (s == null || s.length() == 0) {
		return 0;
	}
	char[] str = s.toCharArray();
	return f(str, 0, str.length - 1);
}

// str[L..R]最长回文子序列长度返回
public static int f(char[] str, int L, int R) {
	if (L == R) { // 剩一个字符
		return 1;
	}
	if (L == R - 1) { // 剩两个字符
		return str[L] == str[R] ? 2 : 1;
	}
	// 可能1、不以L开头也不以R结尾
	int p1 = f(str, L + 1, R - 1);
	// 可能2、以L开头不以R结尾
	int p2 = f(str, L, R - 1);
	// 可能3、不以L开头以R结尾
	int p3 = f(str, L + 1, R);
	// 可能4、以L开头以R结尾
	int p4 = str[L] != str[R] ? 0 : (2 + f(str, L + 1, R - 1));
	return Math.max(Math.max(p1, p2), Math.max(p3, p4));
}
```

## 动态规划

```java
public static int lpsl(String s) {
	if (s == null || s.length() == 0) {
		return 0;
	}
	char[] str = s.toCharArray();
	int N = str.length;
	// L 0..N-1
	// R 0..N-1
	// L > R 无效，只有表格右上部分有效
	int[][] dp = new int[N][N];
	dp[N - 1][N - 1] = 1;
	for (int i = 0; i < N - 1; i++) { // base case
		dp[i][i] = 1; // 最长对角线
		dp[i][i + 1] = str[i] == str[i + 1] ? 2 : 1; // 最长-1对角线
	}

	// 每个格子计算依赖左、下、左下三个位置
	for (int L = N - 3; L >= 0; L--) { // 列，从下往上
		for (int R = L + 2; R < N; R++) { // 行，从左往右
			dp[L][R] = Math.max(dp[L][R - 1], dp[L + 1][R]); // 可能2、可能3
			if (str[L] == str[R]) {
				dp[L][R] = Math.max(dp[L][R], 2 + dp[L + 1][R - 1]); // 可能4
			}
		}
	}
	return dp[0][N - 1];
}
```

# 2.象棋固定步数移动到终点

想像一个象棋的棋盘，将整个棋盘放入第一象限，棋盘的左下角是(0,0)位置，那么整个棋盘就是横坐标上 9 条线、纵坐标上 10 条线的区域。
给定三个参数 x、y、k，返回“马”从(0,0)位置出发，必须走 k 步，最后落在(x,y)上的方法数有多少种。

## 暴力递归

```java
// 10 * 9
public static int jump(int a, int b, int k) {
    return process(0, 0, k, a, b);
}

// 当前来到的位置是（x,y）
// 还剩下rest步需要跳
// 跳完rest步，正好跳到a，b的方法数是多少？
public static int process(int x, int y, int rest, int a, int b) {
    if (x < 0 || x > 9 || y < 0 || y > 8) { // 越界检查
        return 0;
    }
    if (rest == 0) {
        return (x == a && y == b) ? 1 : 0;
    }
    // 每个点都有8种移动方式
    int ways = process(x + 2, y + 1, rest - 1, a, b);
    ways += process(x + 1, y + 2, rest - 1, a, b);
    ways += process(x - 1, y + 2, rest - 1, a, b);
    ways += process(x - 2, y + 1, rest - 1, a, b);
    ways += process(x - 2, y - 1, rest - 1, a, b);
    ways += process(x - 1, y - 2, rest - 1, a, b);
    ways += process(x + 1, y - 2, rest - 1, a, b);
    ways += process(x + 2, y - 1, rest - 1, a, b);
    return ways;
}
```

## 动态规划

```java
public static int dp(int a, int b, int k) {
    int[][][] dp = new int[10][9][k + 1];
    dp[a][b][0] = 1; // 初始化第0层
    for (int rest = 1; rest <= k; rest++) { // 按层
        for (int x = 0; x < 10; x++) {
            for (int y = 0; y < 9; y++) {
                int ways = pick(dp, x + 2, y + 1, rest - 1);
                ways += pick(dp, x + 1, y + 2, rest - 1);
                ways += pick(dp, x - 1, y + 2, rest - 1);
                ways += pick(dp, x - 2, y + 1, rest - 1);
                ways += pick(dp, x - 2, y - 1, rest - 1);
                ways += pick(dp, x - 1, y - 2, rest - 1);
                ways += pick(dp, x + 1, y - 2, rest - 1);
                ways += pick(dp, x + 2, y - 1, rest - 1);
                dp[x][y][rest] = ways;
            }
        }
    }
    return dp[0][0][k];
}

public static int pick(int[][][] dp, int x, int y, int rest) {
    if (x < 0 || x > 9 || y < 0 || y > 8) {
        return 0;
    }
    return dp[x][y][rest];
}
```

# 3.洗咖啡杯问题（京东）

数组 arr 代表每一个咖啡机冲一杯咖啡的时间，每个咖啡机只能串行的制造咖啡。
现在有 n 个人需要喝咖啡，认为每个人喝咖啡的时间非常短，冲好的时间即是喝完的时间。
每个人喝完之后咖啡杯可以选择洗或者自然挥发干净。只有一台洗咖啡杯的机器，只能串行的洗咖啡杯。
洗杯子的机器洗完一个杯子时间为 a，任何一个杯子自然挥发干净的时间为 b。
假设时间点从 0 开始，返回所有人喝完咖啡并洗完咖啡杯的全部过程结束后，至少来到什么时间点。

## 暴力递归

```java
public static int minTime(int[] arr, int n, int a, int b) {
	int[] times = new int[arr.length];
	int[] drink = new int[n];
	return forceMake(arr, times, 0, drink, n, a, b);
}

// 每个人暴力尝试用每一个咖啡机给自己做咖啡
public static int forceMake(int[] arr, int[] times, int kth, int[] drink, int n, int a, int b) {
	if (kth == n) { // 所有咖啡制作完成，判断清洗杯子时间
		int[] drinkSorted = Arrays.copyOf(drink, kth); // 每杯咖啡制作完成时间
		Arrays.sort(drinkSorted);
		return forceWash(drinkSorted, a, b, 0, 0, 0);
	}
	int time = Integer.MAX_VALUE;
	for (int i = 0; i < arr.length; i++) { // 每个咖啡机
		int work = arr[i]; // 咖啡机需要的时间
		int pre = times[i]; // 上一杯咖啡结束时间
		drink[kth] = pre + work; // 当前杯咖啡制作完成时间
		times[i] = pre + work; // 咖啡机排队时间
		time = Math.min(time, forceMake(arr, times, kth + 1, drink, n, a, b)); // 下一杯咖啡所有可能..
		drink[kth] = 0;
		times[i] = pre;
	}
	return time;
}

public static int forceWash(int[] drinks, int a, int b, int index, int washLine, int time) {
	if (index == drinks.length) {
		return time;
	}
	// 选择一：当前index号咖啡杯，选择用洗咖啡机刷干净
	int wash = Math.max(drinks[index], washLine) + a;
	int ans1 = forceWash(drinks, a, b, index + 1, wash, Math.max(wash, time));

	// 选择二：当前index号咖啡杯，选择自然挥发
	int dry = drinks[index] + b;
	int ans2 = forceWash(drinks, a, b, index + 1, washLine, Math.max(dry, time));
	return Math.min(ans1, ans2);
}
```

## 贪心+优良尝试优化

```java
public static class Machine {
	public int timePoint; // 时间点
	public int workTime; // 制作咖啡需要的时间

	public Machine(int t, int w) {
		timePoint = t;
		workTime = w;
	}
}

public static class MachineComparator implements Comparator<Machine> {

	@Override
	public int compare(Machine o1, Machine o2) {
		return (o1.timePoint + o1.workTime) - (o2.timePoint + o2.workTime);
	}

}

// 优良一点的暴力尝试的方法
public static int minTime(int[] arr, int n, int a, int b) {
	// 小根堆
	PriorityQueue<Machine> heap = new PriorityQueue<Machine>(new MachineComparator());
	for (int i = 0; i < arr.length; i++) {
		heap.add(new Machine(0, arr[i]));
	}
	int[] drinks = new int[n]; // 每个人喝完咖啡时间
	for (int i = 0; i < n; i++) {
		Machine cur = heap.poll();
		cur.timePoint += cur.workTime;
		drinks[i] = cur.timePoint;
		heap.add(cur);
	}
	return bestTime(drinks, a, b, 0, 0);
}

// drinks 所有杯子可以开始洗的时间
// wash 单杯洗干净的时间（串行）
// air 挥发干净的时间(并行)
// free 洗的机器什么时候可用
// drinks[index..] 都变干净，最早的结束时间（返回）
public static int bestTime(int[] drinks, int wash, int air, int index, int free) {
	if (index == drinks.length) {
		return 0;
	}
	// index号杯子 决定洗
	int selfClean1 = Math.max(drinks[index], free) + wash;
	// 剩余杯子干净时间
	int restClean1 = bestTime(drinks, wash, air, index + 1, selfClean1);
	int p1 = Math.max(selfClean1, restClean1);

	// index号杯子 决定挥发
	int selfClean2 = drinks[index] + air;
	// 剩余杯子干净时间
	int restClean2 = bestTime(drinks, wash, air, index + 1, free);
	int p2 = Math.max(selfClean2, restClean2);
	return Math.min(p1, p2);
}
```

## 动态规划

```java
public static class Machine {
	public int timePoint; // 时间点
	public int workTime; // 制作咖啡需要的时间

	public Machine(int t, int w) {
		timePoint = t;
		workTime = w;
	}
}

public static class MachineComparator implements Comparator<Machine> {

	@Override
	public int compare(Machine o1, Machine o2) {
		return (o1.timePoint + o1.workTime) - (o2.timePoint + o2.workTime);
	}

}


// 贪心+优良尝试改动态规划
public static int minTime(int[] arr, int n, int a, int b) {
	PriorityQueue<Machine> heap = new PriorityQueue<Machine>(new MachineComparator());
	for (int i = 0; i < arr.length; i++) {
		heap.add(new Machine(0, arr[i]));
	}
	int[] drinks = new int[n];
	for (int i = 0; i < n; i++) {
		Machine cur = heap.poll();
		cur.timePoint += cur.workTime;
		drinks[i] = cur.timePoint;
		heap.add(cur);
	}
	return bestTimeDp(drinks, a, b);
}

public static int bestTimeDp(int[] drinks, int wash, int air) {
	int N = drinks.length;
	int maxFree = 0;
	for (int i = 0; i < drinks.length; i++) {
		maxFree = Math.max(maxFree, drinks[i]) + wash;
	}
	int[][] dp = new int[N + 1][maxFree + 1];
	// 最下层都是0
	for (int index = N - 1; index >= 0; index--) { // 从下往上填
		for (int free = 0; free <= maxFree; free++) { // 从左往右填
			int selfClean1 = Math.max(drinks[index], free) + wash;
			if (selfClean1 > maxFree) {
				break; // 因为后面的也都不用填了
			}
			// index号杯子 决定洗
			int restClean1 = dp[index + 1][selfClean1];
			int p1 = Math.max(selfClean1, restClean1);
			// index号杯子 决定挥发
			int selfClean2 = drinks[index] + air;
			int restClean2 = dp[index + 1][free];
			int p2 = Math.max(selfClean2, restClean2);
			dp[index][free] = Math.min(p1, p2);
		}
	}
	return dp[0][0];
}
```
