title: 【算法基础】暴力递归到动态规划（一）
author: haifun
tags:
  - 算法
  - 动态规划
categories:
  - 算法
date: 2022-09-03 23:30:00

---

# 1.固定步数移动到终点

假设有排成一行的 N 个位置，记为 1~N，N 一定大于等于 2。开始时机器人在其中的 M 位置上，当机器人走到边界时必须往回走（1->2,N->N-1）,当走到中间位置时可以往左走或者往右走。规定机器人必须走 K 步，最终停在P位置，问有多少种走法？

## 暴力递归实现

```java
/**
 * 固定步数移动到终点
 *
 * 实现方式1，暴力递归
 *
 * @param N     路线长度
 * @param start 开始位置
 * @param aim   目标位置
 * @param K     移动次数
 * @return 最多移动方案数
 */
public static int ways1(int N, int start, int aim, int K) {
    if (N < 2 || start < 1 || start > N || aim < 1 || aim > N || K < 1) {
        return -1;
    }
    return process1(start, K, aim, N);
}

/**
 * 从cur出发，走过rest步之后，最终停在aim的方案数
 *
 * @param cur  当前位置
 * @param rest 剩余步数
 * @param aim  目标位置
 * @param N    路线长度，位置1..n
 * @return 方案数
 */
public static int process1(int cur, int rest, int aim, int N) {
    if (rest == 0) { // 没有剩余步数，走完了！
        return cur == aim ? 1 : 0; // 当前位置是不是目标位置
    }

    if (cur == 1) { // 走到左边界只能往右走，1 -> 2，步数-1
        return process1(2, rest - 1, aim, N);
    }

    if (cur == N) { // 走到右边界只能往左走，N-1 <- N，步数-1
        return process1(N - 1, rest - 1, aim, N);
    }

    // 在中间位置可以往左走也可以往右走，步数-1
    return process1(cur - 1, rest - 1, aim, N) + process1(cur + 1, rest - 1, aim, N);
}
```

## 暴力递归缓存优化

此实现也可以称为是从顶向下的动态规划/记忆化搜索。

```java
// 实现方式1优化，利用缓存优化暴力递归
    public static int ways2(int N, int start, int aim, int K) {
        if (N < 2 || start < 1 || start > N || aim < 1 || aim > N || K < 1) {
            return -1;
        }

        // dp就是缓存表，大小 N+1 * K+1
        int[][] dp = new int[N + 1][K + 1];
        for (int i = 0; i <= N; i++) {
            for (int j = 0; j <= K; j++) {
                dp[i][j] = -1; // 初始化值为-1
            }
        }

        // dp[cur][rest] == -1 -> process2(cur, rest)之前没算过！
        // dp[cur][rest] != -1 -> process2(cur, rest)之前算过！返回值，dp[cur][rest]

        return process2(start, K, aim, N, dp);
    }

    // 当前位置cur范围： 1 ~ N
    // 剩余步数rest范围：0 ~ K
    public static int process2(int cur, int rest, int aim, int N, int[][] dp) {
        if (dp[cur][rest] != -1) {
            return dp[cur][rest]; // 之前算过返回缓存值
        }

        // 之前没算过
        int ans = 0;
        if (rest == 0) { // 没有剩余步数
            ans = cur == aim ? 1 : 0; // 当前位置是不是目标位置
        } else if (cur == 1) { // 走到左边界
            ans = process2(2, rest - 1, aim, N, dp); // 往右走，步数-1
        } else if (cur == N) { // 走到右边界
            ans = process2(N - 1, rest - 1, aim, N, dp); // 往左走，步数-1
        } else {
            // 可以往左右也可以往右走，方案求和，步数-1
            ans = process2(cur - 1, rest - 1, aim, N, dp) + process2(cur + 1, rest - 1, aim, N, dp);
        }
        dp[cur][rest] = ans; // 记录缓存
        return ans;

    }
```

## 动态规划实现

动态规划实现思路：直接算出1..n每个点走K步到达目标位置的方案数。

实现方式：
1. 先初始化第一列，即剩余步数为0时，只有目标位置方案数为1
2. 依次初始化每一列，
    - 当前位置在第一行时，只能往右走，也即方案数=数组左下
    - 当前位置在最后一行时，只能往左走，也即方案数=数组左上
    - 当前位置在中间，可以往左或右走，也即方案数=数组左上+左下
    
e.g. N=5，目标是4

```
// 0 1 2 3 4 5 6 剩余步数
--------------------
0| x x x x x x x
1| 0 0 0 1 0 4 0
2| 0 0 1 0 4 0 13
3| 0 1 0 3 0 9 0
4| 1 0 2 0 5 0 14
5| 0 1 0 2 0 5 0
当前位置
```
    
```java
public static int ways3(int N, int start, int aim, int K) {
    if (N < 2 || start < 1 || start > N || aim < 1 || aim > N || K < 1) {
        return -1;
    }

    int[][] dp = new int[N + 1][K + 1];
    dp[aim][0] = 1; // 设置目标位置为1

    for (int rest = 1; rest <= K; rest++) {
        dp[1][rest] = dp[2][rest - 1]; // 第一行，左边界
        for (int cur = 2; cur < N; cur++) {
            dp[cur][rest] = dp[cur - 1][rest - 1] + dp[cur + 1][rest - 1];
        }
        dp[N][rest] = dp[N - 1][rest - 1]; // 第n行，右边界
    }
    return dp[start][K];
}
```

# 2.预测赢家

给定一个整形数组arr，代表数值不同的纸牌排成一条线（明牌）。玩家A和玩家B依次拿走每张牌，规定玩家A先手，每次取牌时只能拿走最左或最右的牌。玩家A和玩家B都绝顶聪明，每次取牌都会使自己的分数最大化，请返回最后获胜者的分数。

## 暴力递归实现

```java
// 根据规则，返回获胜者的分数
public static int win1(int[] arr) {
    if (arr == null || arr.length == 0) {
        return 0;
    }
    int first = f1(arr, 0, arr.length - 1); // 先手最大分数
    int second = g1(arr, 0, arr.length - 1); // 后手最大分数
    return Math.max(first, second);
}

// arr[L..R]，先手获得的最好分数返回
public static int f1(int[] arr, int L, int R) {
    if (L == R) { // 只剩一张牌时先手获得
        return arr[L];
    }
    int p1 = arr[L] + g1(arr, L + 1, R); // 拿L，下一手后手
    int p2 = arr[R] + g1(arr, L, R - 1); // 拿R，下一手后手
    return Math.max(p1, p2); // 先手拿大
}

// arr[L..R]，后手获得的最好分数返回
public static int g1(int[] arr, int L, int R) {
    if (L == R) {
        return 0;
    }
    int p1 = f1(arr, L + 1, R); // 对手拿走了L位置的数，后手变 L+1..R 先手
    int p2 = f1(arr, L, R - 1); // 对手拿走了R位置的数，后手变 L..R-1 先手
    return Math.min(p1, p2); // 对手先拿，后手一定拿的小的
}
```

## 暴力递归缓存优化

```java
public static int win2(int[] arr) {
    if (arr == null || arr.length == 0) {
        return 0;
    }
    int N = arr.length;
    int[][] fmap = new int[N][N]; // 先手缓存
    int[][] gmap = new int[N][N]; // 后手缓存
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            fmap[i][j] = -1;
            gmap[i][j] = -1;
        }
    }
    int first = f2(arr, 0, arr.length - 1, fmap, gmap);
    int second = g2(arr, 0, arr.length - 1, fmap, gmap);
    return Math.max(first, second);
}

// arr[L..R]，先手获得的最好分数返回
public static int f2(int[] arr, int L, int R, int[][] fmap, int[][] gmap) {
    if (fmap[L][R] != -1) {
        return fmap[L][R];
    }
    int ans = 0;
    if (L == R) {
        ans = arr[L];
    } else {
        int p1 = arr[L] + g2(arr, L + 1, R, fmap, gmap);
        int p2 = arr[R] + g2(arr, L, R - 1, fmap, gmap);
        ans = Math.max(p1, p2);
    }
    fmap[L][R] = ans;
    return ans;
}

// arr[L..R]，后手获得的最好分数返回
public static int g2(int[] arr, int L, int R, int[][] fmap, int[][] gmap) {
    if (gmap[L][R] != -1) {
        return gmap[L][R];
    }
    int ans = 0;
    if (L != R) {
        int p1 = f2(arr, L + 1, R, fmap, gmap); // 对手拿走了L位置的数
        int p2 = f2(arr, L, R - 1, fmap, gmap); // 对手拿走了R位置的数
        ans = Math.min(p1, p2);
    }
    gmap[L][R] = ans;
    return ans;
}
```

## 动态规划实现

直接推算出数组：
- fmap：每一步先手可以获得最大值
- gmap：每一步后手可以获得最大值

观察暴力递归过程，fmap[L][R]需要借助gmap[L+1][R]和gmap[L][R-1]，而gmap[L][R]需要借助
fmap[L+1][R]和fmap[L][R-1]。也就是需要借助对方数组对应位置的左一格和下一格计算。

数组中左下部分是无效的（L>R），L=R对角线已知fmap等于arr[L]、gmap等于0。

接下来只需要对剩下逐级对角线进行计算，即可完成两个数组的推算。

```java
public static int win3(int[] arr) {
    if (arr == null || arr.length == 0) {
        return 0;
    }
    int N = arr.length;
    int[][] fmap = new int[N][N];
    int[][] gmap = new int[N][N];
    for (int i = 0; i < N; i++) {
        fmap[i][i] = arr[i]; // 初始化L=R 位置，先手arr[i]，后手0
    }
    for (int startCol = 1; startCol < N; startCol++) { // 列，1..n
        int L = 0;
        int R = startCol;
        while (R < N) { // 沿着对角线推算，每次处理前一个位置右下位置，表格左下部分L>R无用
            fmap[L][R] = Math.max(arr[L] + gmap[L + 1][R], arr[R] + gmap[L][R - 1]); // gmap 对应 fmap 位置，左一格、下一格
            gmap[L][R] = Math.min(fmap[L + 1][R], fmap[L][R - 1]); // fmap 对应 gmap 位置，左一格、下一格
            L++;
            R++;
        }
    }
    return Math.max(fmap[0][N - 1], gmap[0][N - 1]);
}
```
