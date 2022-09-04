title: 【算法基础】暴力递归到动态规划（二）
author: haifun
tags:
  - 算法
  - 动态规划
categories:
  - 算法
date: 2022-09-04 22:00:00

---

# 1.背包的最大价值

有一批货物，每个货物的质量和价值已知，用一个称重确定的背包能装入的货物最大价值是多少？

## 暴力递归

```java
/**
 * 返回不超重情况下，背包货物的最大价值
 *
 * 暴力递归实现
 *
 * @param w   所有货物质量
 * @param v   所有货物价值
 * @param bag 背包容量
 * @return
 */
public static int maxValue(int[] w, int[] v, int bag) {
    if (w == null || v == null || w.length != v.length || w.length == 0) {
        return 0;
    }

    return process(w, v, 0, bag);
}

/**
 * 从index开始选择包里还能装的最大价值
 *
 * @param w     所有货物质量
 * @param v     所有货物价值
 * @param index 当前货物位置
 * @param rest  剩余容量
 * @return
 */
public static int process(int[] w, int[] v, int index, int rest) {
    if (rest < 0) {
        return -1;
    }
    if (index == w.length) {
        return 0;
    }
    int p1 = process(w, v, index + 1, rest); // 不要当前货
    int p2 = 0;
    int next = process(w, v, index + 1, rest - w[index]); // 要当前货
    if (next != -1) {
        p2 = v[index] + next; // 不要index了，减掉index价值
    }
    return Math.max(p1, p2);
}
```

## 动态规划

```java
public static int dp(int[] w, int[] v, int bag) {
    if (w == null || v == null || w.length != v.length || w.length == 0) {
        return 0;
    }
    int N = w.length;
    // index 0 ~ N
    // rest 0 ~ bag
    int[][] dp = new int[N + 1][bag + 1];

    // dp[N][..] = 0，从倒数第二行往上填
    for (int index = N - 1; index >= 0; index--) {
        for (int rest = 0; rest <= bag; rest++) {
            int p1 = dp[index + 1][rest]; // 不要货物，下一行、容量不变位置
            int p2 = 0;
            // 要货物，如果容量够，下一行、容量减当前货质量位置
            int next = rest - w[index] < 0 ? -1 : dp[index + 1][rest - w[index]];
            if (next != -1) {
                p2 = v[index] + next;
            }
            dp[index][rest] = Math.max(p1, p2);
        }
    }
    return dp[0][bag];
}
```

# 2.数字转化字母

规定1和A对应、2和B对应、3和C对应、...、26和Z对应。
那么一个数字字符串比如“111”就可以转化为“AAA”、“KA”、“AK”。
给定一个只有数字字符组成的字符串str，返回最多有多少种转化结果。

## 暴力递归

```java
public static int number(String str) {
    if (str == null || str.length() == 0) {
        return 0;
    }
    return process(str.toCharArray(), 0);
}

// 转化str[i..]，返回有多少种转化方法
public static int process(char[] str, int i) {
    if (i == str.length) {
        return 1;
    }

    // i没到最后，说明有字符
    if (str[i] == '0') { // 之前的决定有问题，不会单独出现0开头的
        return 0;
    }

    // str[i] != '0'
    // i单转
    int ways = process(str, i + 1);
    // i和后面数字合并转，合并不能超过27
    if (i + 1 < str.length && (str[i] - '0') * 10 + str[i + 1] - '0' < 27) {
        ways += process(str, i + 2);
    }
    return ways;
}
```

## 动态规划

```java
// 从右往左的动态规划，dp[i]表示str[i.]有多少种转化方式
public static int dp(String s) {
    if (s == null || s.length() == 0) {
        return 0;
    }
    char[] str = s.toCharArray();
    int N = str.length;
    int[] dp = new int[N + 1];
    dp[N] = 1; // 最右只有一种
    for (int i = N - 1; i >= 0; i--) {
        if (str[i] != '0') {
            int ways = dp[i + 1]; // 当前字符
            if (i + 1 < str.length && (str[i] - '0') * 10 + str[i + 1] - '0' < 27) {
                ways += dp[i + 2]; // 当前字符 + 下一个字符
            }
            dp[i] = ways;
        }
    }
    return dp[0];
}
```

# 3.贴纸拼词（LeetCode 691.）

给定一个字符串 str 和一个字符串类型的数组 arr，其中都是小写英文字母。
arr 中每一个字符串代表一张贴纸，你可以把单个字符剪开使用，目的是拼出 str。
每个贴纸的数量是无限的，返回至少需要多少张贴纸可以完成这个任务。

例如：str = "babac"，arr = ["ba", "c", "abcd"]，至少需要两张贴纸 “ba” 和 “abcd” 或 “abcd” 和 “abcd”。

## 暴力递归

```java
public static int minStickers1(String[] stickers, String target) {
    int ans = process1(stickers, target);
    return ans == Integer.MAX_VALUE ? -1 : ans;
}

// 所有贴纸stickers，每一种贴纸都有无穷张
public static int process1(String[] stickers, String target) {
    if (target.length() == 0) {
        return 0;
    }
    int min = Integer.MAX_VALUE;
    for (String first : stickers) { // 每张贴纸做为第一张
        String rest = minus(target, first); // 使用贴纸后剩余的字符
        if (rest.length() != target.length()) {
            min = Math.min(min, process1(stickers, rest));
        }
    }
    return min + (min == Integer.MAX_VALUE ? 0 : 1);
}

// s1是目标字符，s2是贴纸，返回目标-贴纸后的字符
public static String minus(String s1, String s2) {
    char[] str1 = s1.toCharArray();
    char[] str2 = s2.toCharArray();
    int[] count = new int[26];
    for (char cha : str1) {
        count[cha - 'a']++; // 累计目标每个字母个数
    }
    for (char cha : str2) {
        count[cha - 'a']--; // 减去贴纸中每个字母数
    }
    StringBuilder builder = new StringBuilder();
    for (int i = 0; i < 26; i++) {
        if (count[i] > 0) {
            for (int j = 0; j < count[i]; j++) {
                builder.append((char) (i + 'a'));
            }
        }
    }
    return builder.toString(); // 剩余的字母合并
}
```

## 暴力低估词频和剪枝优化

```java
// 暴力递归词频和剪枝优化
public static int minStickers2(String[] stickers, String target) {
    int N = stickers.length;
    // 关键优化(用词频表替代贴纸数组)
    int[][] counts = new int[N][26];
    for (int i = 0; i < N; i++) {
        char[] str = stickers[i].toCharArray();
        for (char cha : str) {
            counts[i][cha - 'a']++;
        }
    }
    int ans = process2(counts, target);
    return ans == Integer.MAX_VALUE ? -1 : ans;
}

// stickers[i] 为i号贴纸的字符统计
public static int process2(int[][] stickers, String t) {
    if (t.length() == 0) {
        return 0;
    }

    char[] target = t.toCharArray();
    // 目标词频统计
    int[] tcounts = new int[26];
    for (char cha : target) {
        tcounts[cha - 'a']++;
    }

    int N = stickers.length;
    int min = Integer.MAX_VALUE;
    for (int i = 0; i < N; i++) {
        // 第一张贴纸
        int[] sticker = stickers[i];
        // 最关键的优化(重要的剪枝!这一步也是贪心!)
        if (sticker[target[0] - 'a'] > 0) {
            StringBuilder builder = new StringBuilder();
            for (int j = 0; j < 26; j++) {
                if (tcounts[j] > 0) {
                    int nums = tcounts[j] - sticker[j];
                    for (int k = 0; k < nums; k++) {
                        builder.append((char) (j + 'a'));
                    }
                }
            }
            String rest = builder.toString();
            min = Math.min(min, process2(stickers, rest));
        }
    }
    return min + (min == Integer.MAX_VALUE ? 0 : 1);
}
```

## 暴力递归缓存优化

```java
// 记忆化搜索，暴力递归缓存优化
public static int minStickers3(String[] stickers, String target) {
    int N = stickers.length;
    int[][] counts = new int[N][26];
    for (int i = 0; i < N; i++) {
        char[] str = stickers[i].toCharArray();
        for (char cha : str) {
            counts[i][cha - 'a']++;
        }
    }
    HashMap<String, Integer> dp = new HashMap<>();
    dp.put("", 0);
    int ans = process3(counts, target, dp);
    return ans == Integer.MAX_VALUE ? -1 : ans;
}

public static int process3(int[][] stickers, String t, HashMap<String, Integer> dp) {
    if (dp.containsKey(t)) {
        return dp.get(t);
    }
    char[] target = t.toCharArray();
    int[] tcounts = new int[26];
    for (char cha : target) {
        tcounts[cha - 'a']++;
    }
    int N = stickers.length;
    int min = Integer.MAX_VALUE;
    for (int i = 0; i < N; i++) {
        int[] sticker = stickers[i];
        if (sticker[target[0] - 'a'] > 0) {
            StringBuilder builder = new StringBuilder();
            for (int j = 0; j < 26; j++) {
                if (tcounts[j] > 0) {
                    int nums = tcounts[j] - sticker[j];
                    for (int k = 0; k < nums; k++) {
                        builder.append((char) (j + 'a'));
                    }
                }
            }
            String rest = builder.toString();
            min = Math.min(min, process3(stickers, rest, dp));
        }
    }
    int ans = min + (min == Integer.MAX_VALUE ? 0 : 1);
    dp.put(t, ans);
    return ans;
}
```

# 4.最长公共子序列（LeetCode 1143.）

给定两个字符串 str1 和 str2，返回这两个字符串的最长公共子序列的长度。如果不存在公共子序列，返回 0。

一个字符串的子序列是指这样一个新的字符串：它是由原字符串在不改变字符的相对顺序的情况下删除某些字符（也可以不删除任何字符）后组成的新字符串。

例如，"ace" 是 "abcde" 的子序列，但 "aec" 不是 "abcde" 的子序列。
两个字符串的公共子序列是这两个字符串所共同拥有的子序列。

题目本质就是问str1[0..i]和str2[0..j]，这个范围上最长公共子序列长度是多少？

可能性分类以及递归过程:

1. 最长公共子序列，一定不以str1[i]字符结尾、也一定不以str2[j]字符结尾
    - 最长公共子序列 = str1[0..i-1] 与 str2[0..j-1] 的最长公共子序列长度(后续递归)
2. 最长公共子序列，可能以str1[i]字符结尾、但是一定不以str2[j]字符结尾
    - 最长公共子序列 = str1[0..i] 与 str2[0..j-1] 的最长公共子序列长度(后续递归)  
3. 最长公共子序列，一定不以str1[i]字符结尾、但是可能以str2[j]字符结尾
    - 最长公共子序列 = str1[0..i-1] 与 str2[0..j] 的最长公共子序列长度(后续递归)
4. 最长公共子序列，必须以str1[i]字符结尾、也必须以str2[j]字符结尾
	- 最长公共子序列总长度 = str1[0..i-1] 与 str2[0..j-1] 的最长公共子序列长度(后续递归) + 1(共同的结尾)

注意：1、2、3、4并不是完全互斥的，可能会有重叠的情况。

以上四种情况已经穷尽了所有可能性。四种情况中取最大即可：

其中2、3一定参与最大值的比较：
- 当str1[i] == str2[j]时，1 一定比 4 小，所以 4 参与
- 当str1[i] != str2[j]时，4 压根不存在，所以 1 参与

因为 1 中时钟有一个样本的范围比 2 和 3 小，所以：
- 当 str1[i] == str2[j] 时，需要从 2、3、4 中选出最大值。
- 当 str1[i] != str2[j] 时，需要从 2、3 中选出最大值。

## 暴力递归

```java
public static int longestCommonSubsequence1(String s1, String s2) {
	if (s1 == null || s2 == null || s1.length() == 0 || s2.length() == 0) {
		return 0;
	}
	char[] str1 = s1.toCharArray();
	char[] str2 = s2.toCharArray();
	// 尝试
	return process1(str1, str2, str1.length - 1, str2.length - 1);
}

// str1[0..i]和str2[0..j] 范围上最长公共子序列长度是多少？
public static int process1(char[] str1, char[] str2, int i, int j) {
	if (i == 0 && j == 0) {
		// str1[0..0]和str2[0..0]，都只剩一个字符了
		// 那如果字符相等，公共子序列长度就是1，不相等就是0
		return str1[i] == str2[j] ? 1 : 0;
	} else if (i == 0) {
		// str1[0..0]和str2[0..j]，str1只剩1个字符，但是str2不只一个字符
		// 因为str1只剩一个字符了，所以str1[0..0]和str2[0..j]公共子序列最多长度为1
		// 如果str1[0] == str2[j]，那么此时相等已经找到了！公共子序列长度就是1，也不可能更大了
		// 如果str1[0] != str2[j]，只是此时不相等而已，
		// 那么str2[0..j-1]上有没有字符等于str1[0]呢？不知道，所以递归继续找
		if (str1[i] == str2[j]) {
			return 1;
		} else {
			return process1(str1, str2, i, j - 1);
		}
	} else if (j == 0) {
		// 和上面的else if同理
		// str1[0..i]和str2[0..0]，str2只剩1个字符了，但是str1不只一个字符
		// 因为str2只剩一个字符了，所以str1[0..i]和str2[0..0]公共子序列最多长度为1
		// 如果str1[i] == str2[0]，那么此时相等已经找到了！公共子序列长度就是1，也不可能更大了
		// 如果str1[i] != str2[0]，只是此时不相等而已，
		// 那么str1[0..i-1]上有没有字符等于str2[0]呢？不知道，所以递归继续找
		if (str1[i] == str2[j]) {
			return 1;
		} else {
			return process1(str1, str2, i - 1, j);
		}
	} else { // i != 0 && j != 0
		// 这里的情况为：
		// str1[0..i]和str2[0..i]，str1和str2都不只一个字符
		// p1对应分析可能性3
		int p1 = process1(str1, str2, i - 1, j);
		// p2对应分析可能性2
		int p2 = process1(str1, str2, i, j - 1);
		// p3对应分析可能性4，如果可能性4存在，即str1[i] == str2[j]，那么p3就求出来，参与pk
		// 如果可能性4不存在，即str1[i] != str2[j]，那么让p3等于0，然后去参与pk，反正不影响
		int p3 = str1[i] == str2[j] ? (1 + process1(str1, str2, i - 1, j - 1)) : 0;
		return Math.max(p1, Math.max(p2, p3));
	}
}
```

## 动态规划

```java
public static int longestCommonSubsequence2(String s1, String s2) {
	if (s1 == null || s2 == null || s1.length() == 0 || s2.length() == 0) {
		return 0;
	}
	char[] str1 = s1.toCharArray();
	char[] str2 = s2.toCharArray();
	int N = str1.length;
	int M = str2.length;
	int[][] dp = new int[N][M];
	dp[0][0] = str1[0] == str2[0] ? 1 : 0;
	for (int j = 1; j < M; j++) {
		dp[0][j] = str1[0] == str2[j] ? 1 : dp[0][j - 1];
	}
	for (int i = 1; i < N; i++) {
		dp[i][0] = str1[i] == str2[0] ? 1 : dp[i - 1][0];
	}
	for (int i = 1; i < N; i++) {
		for (int j = 1; j < M; j++) {
			int p1 = dp[i - 1][j];
			int p2 = dp[i][j - 1];
			int p3 = str1[i] == str2[j] ? (1 + dp[i - 1][j - 1]) : 0;
			dp[i][j] = Math.max(p1, Math.max(p2, p3));
		}
	}
	return dp[N - 1][M - 1];
}
```

