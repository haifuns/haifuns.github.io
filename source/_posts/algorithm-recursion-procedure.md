title: 【算法基础】经典递归过程
author: haifun
tags:
  - 算法
  - 递归
categories:
  - 算法
date: 2022-09-01 23:35:00

---

暴力递归，暴力递归就是尝试：
1. 把问题转换为规模缩小了的同类问题的子问题
2. 有明确的不需要继续进行递归的条件（base case）
3. 有当得到了子问题的结果之后的决策过程
4. 不记录每一个子问题的解

# 1.汉诺（Hanoi）塔问题

假设有三个命名为 A B C 的塔座，在塔座A上插有n个直径大小不相同，由小到大编号为1，2，3，···，n的圆盘，要求将A座上的圆盘移至塔座C并按同样的顺序叠排。

圆盘移动必须遵守下列规则：

1. 每次只能移动一个圆盘 。
2. 圆盘可以插在任意一个塔座上 。
3. 任何时刻都不能将一个较大的圆盘放在一个较小的圆盘上。

问把所有的圆盘从 A 柱移动到 C 柱总计最少需要多少次移动？

思路：

想要把1..n圆盘从左移动到右分为三步：
1. 将1..n-1从左移动到中
2. 将n从左移动到右
3. 将1..n-1从中移动到右（进入递归，操作略有不同）

最优解步数：O(2<sup>n</sup> - 1)

```java
// 递归实现，需要左到右、左到中、中到左、中到右、右到左、右到中6种操作
public static void hanoi1(int n) {
	leftToRight(n); // 1..n从左到右
}

// 1~N层圆盘 从左 -> 右
public static void leftToRight(int n) {
	if (n == 1) { // base case，只有一个盘，直接移
		System.out.println("Move 1 from left to right");
		return;
	}
	leftToMid(n - 1); // 1..n-1从左到中
	System.out.println("Move " + n + " from left to right"); // n从左到右
	midToRight(n - 1); // 1..n-1从中到右
}

// 1~N层圆盘 从左 -> 中
public static void leftToMid(int n) {
	if (n == 1) { // base case，只有一个盘，直接移
		System.out.println("Move 1 from left to mid");
		return;
	}
	leftToRight(n - 1); // 1..n-1从左到右
	System.out.println("Move " + n + " from left to mid"); // n从左到中
	rightToMid(n - 1); // 1..n-1从右到中
}

// 1~N层圆盘 从右 -> 中
public static void rightToMid(int n) {
	if (n == 1) { // base case，只有一个盘，直接移
		System.out.println("Move 1 from right to mid");
		return;
	}
	rightToLeft(n - 1); // 1..n-1从右到左
	System.out.println("Move " + n + " from right to mid"); // n从右到中
	leftToMid(n - 1); // 1..n-1从中到右
}

// 1~N层圆盘 从中 -> 右
public static void midToRight(int n) {
	if (n == 1) { // base case，只有一个盘，直接移
		System.out.println("Move 1 from mid to right");
		return;
	}
	midToLeft(n - 1); // 1..n-1从中到左
	System.out.println("Move " + n + " from mid to right"); // n从中到右
	leftToRight(n - 1); // 1..n-1从左到右
}

// 1~N层圆盘 从中 -> 左
public static void midToLeft(int n) {
	if (n == 1) { // base case，只有一个盘，直接移
		System.out.println("Move 1 from mid to left");
		return;
	}
	midToRight(n - 1); // 1..n-1从中到右
	System.out.println("Move " + n + " from mid to left"); // n从中到左
	rightToLeft(n - 1); // 1..n-1从右到左
}

// 1~N层圆盘 从右 -> 左
public static void rightToLeft(int n) {
	if (n == 1) { // base case，只有一个盘，直接移
		System.out.println("Move 1 from right to left");
		return;
	}
	rightToMid(n - 1); // 1..n-1从右到中
	System.out.println("Move " + n + " from right to left"); // n从右到左
	midToLeft(n - 1); // 1..n-1从中到左
}
```

进一步观察，简化操作，1..n从from移动到to，第三根柱子为other，可以得到通用的移动步骤：
1. 将1..n-1从from移动到other
2. 将n从from移动到to
3. 将1..n-1从other移动到to（进入递归，操作完全相同）

```java
// 递归简化实现，6种移动动作合一
public static void hanoi2(int n) {
	if (n > 0) {
		func(n, "left", "right", "mid"); // 1..n 从左到右，剩余中间的柱子
	}
}

// 1..n从from移动到to，other为剩余的柱子
public static void func(int N, String from, String to, String other) {
	if (N == 1) { // base case，只有一个盘，直接移
		System.out.println("Move 1 from " + from + " to " + to);
	} else {
		func(N - 1, from, other, to); // 1..n-1从from移动到other，剩余to
		System.out.println("Move " + N + " from " + from + " to " + to); // n从from移动到to
		func(N - 1, other, to, from); // 1..n-1从other移动到to，剩余from
	}
}
```

# 2.打印一个字符串的全部子序列

```java
public static List<String> subs(String s) {
    char[] str = s.toCharArray();
    String path = "";
    List<String> ans = new ArrayList<>();
    process(str, 0, ans, path);
    return ans;
}

// str[0..index-1]已经决定过了，决定结果是path，str[index..]需要决定
// 把所有生成的子序列，放入到ans里
public static void process(char[] str, int index, List<String> ans, String path) {
    if (index == str.length) { // 所有字符都决定过了
        ans.add(path); // 结束返回
        return;
    }
    // 没有选择index位置的字符
    process(str, index + 1, ans, path);
    // 选择index位置的字符
    process(str, index + 1, ans, path + String.valueOf(str[index]));
}
```

# 3.打印一个字符串的全部子序列，要求不要出现重复字面值的子序列

```java
public static List<String> subsNoRepeat(String s) {
    char[] str = s.toCharArray();
    String path = "";
    HashSet<String> set = new HashSet<>();
    process(str, 0, set, path);
    List<String> ans = new ArrayList<>();
    for (String cur : set) {
        ans.add(cur);
    }
    return ans;
}

public static void process(char[] str, int index, HashSet<String> set, String path) {
    if (index == str.length) {
        set.add(path);
        return;
    }
    process2(str, index + 1, set, path);
    process2(str, index + 1, set, path + String.valueOf(str[index]));
}
```

# 4.打印一个字符串的全部排列

```java
// 第一版递归实现
public static List<String> permutation1(String s) {
    List<String> ans = new ArrayList<>();
    if (s == null || s.length() == 0) {
        return ans;
    }
    char[] str = s.toCharArray();
    ArrayList<Character> rest = new ArrayList<Character>();
    for (char cha : str) {
        rest.add(cha);
    }
    String path = "";
    f(rest, path, ans);
    return ans;
}

public static void f(ArrayList<Character> rest, String path, List<String> ans) {
    if (rest.isEmpty()) {
        ans.add(path);
    } else {
        int N = rest.size();
        for (int i = 0; i < N; i++) {
            char cur = rest.get(i); // 顺序选择rest中剩余的字符
            rest.remove(i); // 使用完移除
            f(rest, path + cur, ans); // 选择当前字符后，继续从剩余的字符中选择下一个字符
            rest.add(i, cur); // 恢复现场
        }
    }
}

// 第二版递归实现（优）
public static List<String> permutation2(String s) {
    List<String> ans = new ArrayList<>();
    if (s == null || s.length() == 0) {
        return ans;
    }
    char[] str = s.toCharArray();
    g(str, 0, ans);
    return ans;
}

// str[0..index-1]为已决定位置固定，str[index..]需要决定
public static void g(char[] str, int index, List<String> ans) {
    if (index == str.length) {
        ans.add(String.valueOf(str));
    } else {
        for (int i = index; i < str.length; i++) {
            swap(str, index, i); // 选择i，放到index位置
            g(str, index + 1, ans); // 继续决定index+1位置
            swap(str, index, i); // 恢复现场
        }
    }
}

public static void swap(char[] chs, int i, int j) {
    char tmp = chs[i];
    chs[i] = chs[j];
    chs[j] = tmp;
}
```

# 5.打印一个字符串的全部排列，要求不要出现重复的排列

```java
public static List<String> permutation(String s) {
    List<String> ans = new ArrayList<>();
    if (s == null || s.length() == 0) {
        return ans;
    }
    char[] str = s.toCharArray();
    g(str, 0, ans);
    return ans;
}

public static void g(char[] str, int index, List<String> ans) {
    if (index == str.length) {
        ans.add(String.valueOf(str));
    } else {
        boolean[] visited = new boolean[256]; // 记录字符是否已经被使用
        for (int i = index; i < str.length; i++) {
            if (!visited[str[i]]) {
                visited[str[i]] = true;
                swap(str, index, i);
                g(str, index + 1, ans);
                swap(str, index, i);
            }
        }
    }
}

public static void swap(char[] chs, int i, int j) {
    char tmp = chs[i];
    chs[i] = chs[j];
    chs[j] = tmp;
}
```

# 6.实现栈逆序

逆序给定栈，要求不能申请额外数据结构，只能用递归函数实现。

```java
// 逆序栈
public static void reverse(Stack<Integer> stack) {
    if (stack.isEmpty()) { // base case，栈空返回
        return;
    }
    int i = f(stack); // 移除并返回栈底元素
    reverse(stack); // 逆序栈中剩下的元素
    stack.push(i); // 重新压入到栈顶
}

// 移除并返回栈底元素
public static int f(Stack<Integer> stack) {
    int result = stack.pop();
    if (stack.isEmpty()) { // base case，栈中只剩最后一个元素返回
        return result;
    } else {
        int last = f(stack);
        stack.push(result);
        return last;
    }
}
```
