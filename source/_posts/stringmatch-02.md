title: 【字符串匹配】Rabin-Karp 算法
author: haifun
tags:
  - 文本匹配
categories:
  - 算法
date: 2021-12-15 23:05:00
mathjax: true
---

与朴素字符串匹配算法相同，Rabin-Karp 算法也是通过滑动一个大小为m的窗口n-m+1次进行匹配判断，不同之处在于Rabin-Karp 算法把字符串转换为字符集长度进制的哈希值，由数值比较代替了字符串直接比较，并且在匹配过程中利用了上一次匹配的信息。

# 数值计算

对于模式P[1...m]数值计算公式为：

$H(P,j)=\sum_{i=0}^{m-1}\alpha^{m-(i+1)} char(P_i)$

- P为模式字符串
- m为P的长度
- α为字符集长度也就是多少进制
- char(*) 得到当前字符对应的进制数

例如字符集[0,1,2...9]，为十进制，那么字符串“123”计算方式为：

$H(P,j)=\sum_{i=0}^{2}\alpha^{3-(i+1)} char(P_i) = 10^2 * 1 + 10 * 2 + 3 = 123$

当我们已经知道了上一个窗口的数值时，可以在此基础上计算当前窗口数值：

$H(P,j+1)=\alpha(H(P,j) - \alpha^{m-1} char(P_j)) + char(P_{j+m})$

从以上计算公式中可以看出，计算窗口数值复杂度为O(m)，窗口移动n-m+1次，最坏情况下，整个算法复杂度为O((n-m+1)m)。但是在实际应用中，算法的期望复杂度为O(n+m)。

# 代码实现

```java
public class RabinKarpStringMatcher {

    // 固定字符集字符数
    public final static int d = 256;

    public static void main(String[] args) {
        String txt = "我爱北京天安门，天安门在北京，北京城在北方";
        String pat = "北京";

        // hash平均值
        int q = 101;

        long start = System.currentTimeMillis();
        search(pat, txt, q);
        System.out.println(System.currentTimeMillis() - start);
    }

    public static void search(String pat, String txt, int q) {
        int m = pat.length();
        int n = txt.length();
        int i, j;
        int p = 0; // 模式hash值
        int t = 0; // 文本hash值
        int h = 1;

        // 进制数m-1次幂
        for (i = 0; i < m - 1; i++) {
            h = (h * d) % q;
        }

        // 计算第一个窗口hash值
        for (i = 0; i < m; i++) {
            p = (d * p + pat.charAt(i)) % q;
            t = (d * t + txt.charAt(i)) % q;
        }

        // 滑动窗口匹配
        for (i = 0; i <= n - m; i++) {

            // 检查模式和当前窗口hash值
            if (p == t) {
                // 检查所有字符
                for (j = 0; j < m; j++) {
                    if (txt.charAt(i + j) != pat.charAt(j))
                        break;
                }

                // p == t and pat[0...m-1] = txt[i, i+1, ...i+m-1]
                if (j == m) {
                    System.out.println("有效偏移量：" + i);
                }
            }

            // 计算下一个窗口hash值
            if (i < n - m) {
                t = (d * (t - txt.charAt(i) * h) + txt.charAt(i + m)) % q;

                // hash为负处理为正
                if (t < 0) {
                    t = (t + q);
                }
            }
        }
    }
}
```

- 算法导论
- [Rabin-Karp算法概述](https://www.cnblogs.com/christianl/p/13747580.html)
- Rabin-Karp 算法数值计算的通俗理解参考这篇文章：[Rabin-Karp 算法（字符串快速查找）](https://www.cnblogs.com/golove/p/3234673.html)
- 代码参考：https://www.geeksforgeeks.org/rabin-karp-algorithm-for-pattern-searching/
