title: 【字符串匹配】DFA 算法（确定有限自动机）
author: haifun
tags:
  - 文本匹配
categories:
  - 算法
date: 2021-12-21 13:40:00
mathjax: true
---

# 有限自动机

一个有限自动机`M`是一个5元组$(Q, q_0, A, \Sigma, \delta)$，其中：

- $Q$是状态的有限集合
- $q_0 \in Q$是初始状态
- $A \sube Q$是一个特殊的接受状态集合
- $\Sigma$是有限输入字母表
- $\delta$是一个从$Q \times \Sigma \to Q$的函数，称为`M`的转移函数

有限自动机开始于状态$q_0$，每次读入输入字符串的一个字符。如果有限自动机在状态q时读入了字符a，则它将从状态q转移为状态$\delta(q,a)$。每当其当前状态q属于A时，就认为自动机M接受了读入的所有字符串。

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/algorithm/stringmatch/dfa-01.png)

如上图，一个拥有状态集Q={0,1}的简单状态自动机，开始状态$q_0$为0，字母表$\Sigma$ = {a, b}，图左用表格表示转移函数$\delta$，图右为等价的状态转换图。状态1是唯一的接受状态。这个自动机接收奇数个a结尾的字符串，例如对于输入abaaa，包含初始状态，这个自动机输入状态序列为{0,1,0,1,0,1}，因此它接收这个输入，如果输入是abbaa，自动机输入状态序列为{0,1,0,0,1,0}，因此它拒绝这个输入。

有限自动机M引入一个函数$\phi$，称为终态函数，它是从$\Sigma^* \to Q$的函数，满足$\phi(\omega)$是M在扫描字符串$\omega$后终止时的状态。

# 字符串匹配自动机

对于给定模式P[1...m]，其相应的字符串匹配自动机定义如下：

- 状态集合Q为{0,1,...,m}，开始状态$q_0$是0状态，并且只有状态m是唯一被接受的状态。
- 对任意的状态q和字符a，转移函数$\delta$定义如下：

$$\delta(q,a) = \sigma(P_qa)$$

其中$\sigma$为辅助函数，称为P的后缀函数，$\sigma$是一个从$\Sigma^*$到{0,1,...,m}上的映射，满足$\sigma(x)$是x的后缀P的最长前缀的长度，例如，对模式P=ab，有$\sigma(ccaca) = 1，\sigma(ccab) = 2$。

对于给定模式P[1...m]，转移函数$\delta$计算伪代码如下：

```
m = P.length
for q = 0 to m
    for each charater a ∈ Σ
        k = min(m+1,q+2)
        repeat
            k = k - 1
        until Pk ⊃ Pq a // Pq a是Pk的前缀
        δ(q,a) = k
return δ
```

由此可以得到自动机准备时间复杂度为$O(m^3 \Sigma)$（通过改进转移函数可以使准备时间复杂度提升为$O(m \Sigma)$，这里暂时不探讨），运行时间复杂度为O(n)。

匹配示例：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/algorithm/stringmatch/dfa-02.png)

上图中：

- (A)是字符串匹配自动机的状态转换图，它可以接受所有以字符串ababaca结尾的字符串。状态0是初始状态，状态7是仅有的接受状态
- (B)为转移函数
- (C)是自动机在文本abababacaba上的操作

# 代码实现

```java
public class FiniteAutomatonMatcher {

    static int NO_OF_CHARS = 65536;

    static int getNextState(char[] pat, int m, int state, int x) {

        // 如果当前字符与模式中下一个字符相同，则直接+1
        if (state < m && x == pat[state]) {
            return state + 1;
        }

        // ns是下一个状态
        int ns, i;
        
        // 倒序遍历状态
        for (ns = state; ns > 0; ns--) {
            // 如果模式中包含这个字符，ns-1是符号下标
            if (pat[ns - 1] == x) {
                // 遍历前缀所有字符
                for (i = 0; i < ns - 1; i++) {
                    // 比较 pat[0..i] 前缀，pat[0..state-1]c 后缀
                    // ns-1是c的位置，i为前缀，state-(ns-1)-i为后缀
                    if (pat[i] != pat[state - ns + 1 + i]) {
                        break;
                    }
                }
                // 前缀=后缀
                if (i == ns - 1) {
                    return ns;
                }
            }
        }

        return 0;
    }

    static void computeTransFun(char[] pat, int m, int[][] tf) {
        int state, x;
        for (state = 0; state <= m; ++state) {
            for (x = 0; x < NO_OF_CHARS; ++x) {
                tf[state][x] = getNextState(pat, m, state, x);
            }
        }
    }

    static void search(char[] pat, char[] txt) {
        int m = pat.length;
        int n = txt.length;

        int[][] tf = new int[m + 1][NO_OF_CHARS];

        // 构建转换函数
        computeTransFun(pat, m, tf);

        int i, state = 0;
        for (i = 0; i < n; i++) {
            state = tf[state][txt[i]];
            if (state == m) {
                System.out.println("Pattern found at index " + (i - m + 1));
            }
        }
    }

    public static void main(String[] args) {
        char[] txt = "我爱北京天安门，天安门在北京，北京城在北方".toCharArray();
        char[] pat = "北京".toCharArray();
        search(pat, txt);
    }
}
```


- 算法导论
- 自动机代码：https://www.geeksforgeeks.org/finite-automata-algorithm-for-pattern-searching
- 改进转移函数自动机代码：https://www.geeksforgeeks.org/pattern-searching-set-5-efficient-constructtion-of-finite-automata
