title: 【算法基础】贪心算法
author: haifun
tags:
  - 算法
  - 贪心算法
categories:
  - 算法
date: 2022-08-28 20:30:00

---

贪心算法的特点：
1. 最自然智慧的算法
2. 用一种局部最功利的标准，总是做出在当前看来是最好的选择。
3. 难点在于证明局部最功利的标准可以得到全局最优解，实际解题过程中不要纠结贪心策略的证明，用对数器去验证贪心策略的正确性
4. 对于贪心算法的学习主要以增加阅历和经验为主

堆和排序是贪心算法最常用的两个技巧。

# 最小字典序

给定一个由字符串组成的数组strs，把所有的字符串拼接起来，返回所有可能的拼接结果中，字典序最小的结果。

```java
public static class MyComparator implements Comparator<String> {
    @Override
    public int compare(String a, String b) {
        return (a + b).compareTo(b + a); // 不能直接a.comareTo(b)，e.g. a=b，b=ba，得到bba，正确结果bab
    }
}

public static String lowestString(String[] strs) {
    if (strs == null || strs.length == 0) {
        return "";
    }
    Arrays.sort(strs, new MyComparator());
    String res = "";
    for (int i = 0; i < strs.length; i++) {
        res += strs[i];
    }
    return res;
}
```

# 会议室最多宣讲场次

一些项目想要占用一个会议室宣讲，会议室同一时间只能容纳一个宣讲，给定每个项目宣讲的开始时间和结束时间，要求合理安排宣讲日程使得会议室进行的宣讲场次最多，返回最多的宣讲场次。

```java
public static class Program {
	public int start;
	public int end;

	public Program(int start, int end) {
		this.start = start;
		this.end = end;
	}
}

// 会议的开始时间和结束时间，都是数值，不会 < 0
public static int bestArrange(Program[] programs) {
	Arrays.sort(programs, new ProgramComparator());
	int timeLine = 0;
	int result = 0;
	// 依次遍历每一个会议，结束时间早的会议先遍历
	for (int i = 0; i < programs.length; i++) {
		if (timeLine <= programs[i].start) {
			result++;
			timeLine = programs[i].end;
		}
	}
	return result;
}

public static class ProgramComparator implements Comparator<Program> {

	@Override
	public int compare(Program o1, Program o2) {
		return o1.end - o2.end;
	}

}
```

# 最小代价分金（哈夫曼编码问题）

一块金条切成两半，需要花费和长度相同的铜板。如果长度为20的金条不管怎么切都要花费20个铜板。

例如：给定数组{10,20,30}，表示一共三个人，整块金条长度为60，金条想要分成10，20，30三个部分。

如果先把长度60的金条分成10和50，花费60；再把50分为20和30花费50，总花费110。
如果先把长度60的金条分为30和30，花费60；再把30分为10和20花费30，总花费90。

一群人想要整分整块金条，怎么分割代价最小？

```java
public static int lessMoney(int[] arr) {
    // 小根堆
    PriorityQueue<Integer> pQ = new PriorityQueue<>();
    for (int i = 0; i < arr.length; i++) {
        pQ.add(arr[i]);
    }
    int sum = 0;
    int cur = 0;
    while (pQ.size() > 1) {
        cur = pQ.poll() + pQ.poll(); // 每次取出最小的两个数
        sum += cur;
        pQ.add(cur); // 加起来后放回小根堆
    }
    return sum; // 直到堆里只剩两个数，返回和
}
```

# 项目安排最大利润

输入：正数数组costs、正数数组profits、正数K、正数M

- costs[i] 表示 i 号项目的花费
- profits[i] 表示 i 号项目在扣除花费之后的利润
- K 表示最多能串行的做 K 个项目
- W 表示初始资金

说明：每做完一个项目，马上就能获得收益，可以支持去做下一个项目。不能并行做项目。

要求：输出可以获得的最大钱数。

```java
public static int findMaximizedCapital(int K, int W, int[] Profits, int[] Capital) {
    // 小根堆，按花费排序
    PriorityQueue<Program> minCostQ = new PriorityQueue<>(new MinCostComparator());
    // 大根堆，按利润排序
    PriorityQueue<Program> maxProfitQ = new PriorityQueue<>(new MaxProfitComparator());
    for (int i = 0; i < Profits.length; i++) {
        minCostQ.add(new Program(Profits[i], Capital[i]));
    }
    for (int i = 0; i < K; i++) {
        while (!minCostQ.isEmpty() && minCostQ.peek().c <= W) {
            maxProfitQ.add(minCostQ.poll()); // 当前资金所有可以做的项目，加入利润大根堆
        }
        if (maxProfitQ.isEmpty()) {
            return W;
        }
        W += maxProfitQ.poll().p; // 选择利润最大的项目，剩余资金=初始+利润
    }
    return W;
}

public static class Program {
    public int p; // 利润
    public int c; // 花费

    public Program(int p, int c) {
        this.p = p;
        this.c = c;
    }
}

public static class MinCostComparator implements Comparator<Program> {

    @Override
    public int compare(Program o1, Program o2) {
        return o1.c - o2.c;
    }

}

public static class MaxProfitComparator implements Comparator<Program> {

    @Override
    public int compare(Program o1, Program o2) {
        return o2.p - o1.p;
    }

}
```

# 点灯问题

给定一个字符串str，只由 ‘X’ 和 ‘.’ 两种字符构成。

- ‘X’ 表示墙，不能放灯也不需要点亮
- ‘.’ 表示民居，可以放灯，需要点亮

如果灯放在 i 位置，可以让 i-1，i 和 i+1 三个位置被点亮。

要求返回如果点亮str中所有需要点亮的位置，至少需要几盏灯？

```java
public static int minLight(String road) {
	char[] str = road.toCharArray();
	int i = 0;
	int light = 0;
	while (i < str.length) {
		if (str[i] == 'X') {
			i++;
		} else {
			light++;
			if (i + 1 == str.length) {
				break;
			} else { // i+1位置 X .
				if (str[i + 1] == 'X') {
					i = i + 2;
				} else {
					i = i + 3;
				}
			}
		}
	}
	return light;
}
```
