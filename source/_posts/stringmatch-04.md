title: 【字符串匹配】KMP算法&BM算法
author: haifun
tags:
  - 文本匹配
categories:
  - 算法
date: 2022-01-10 20:50:00
mathjax: true
---

# KMP算法

KMP算法是由Knuth、Morris、Pratt三人设计的线性时间字符串匹配算法。这个算法不需要转移函数`$\delta$`，只需要用到辅助函数`$\pi$`，根据模式预先计算并存储在数组中，数组中有m个值，而`$\delta$`有`$m\Sigma$`个值，因而预处理时间减少了一个`$\Sigma$`因子。

KMP算法预处理时间复杂度为O(m)，匹配时间复杂度为O(n)。

## 前缀函数

模式的前缀函数`$\pi$`包含模式与自身的偏移进行匹配的信息，这些信息可以用于暴力匹配算法中避免对无用偏移进行检测，也可以避免在字符串匹配机中对整个转移函数的预先计算。

对于一个已知的模式P[1..m]，模式P的前缀函数`$\pi$`满足`$\pi[q]$`是`$P_q$`的真后缀P的最长前缀长度。

例如对于模式ababaca的完整前缀函数如下图(a)所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/algorithm/stringmatch/KMP-01.png)

前缀函数computePrefixFunction(P)构建伪代码如下：

```
m = P.length
let pi[m]
pi[1] = 0
k = 0
for q = 2 to m
    while k > 0 && P[k+1] != P[q]
        k = pi[k]
    if P[k+1] == P[q]
        k = k + 1
    pi[q] = k
return pi
```

## 匹配伪代码

```
n = T.length
m = P.length
pi = computePrefixFunction(P)
q = 0
for i = 1 to n // 扫描文本T
    while q > 0 && P[q+1] != T[i]
        q = pi[q] // 下一个文本不匹配
    if P[q+1] == T[i]
        q = q + 1 // 下一个文本匹配
    if q == m
        print i - m
    q = pi[q] // 匹配失败直接跳到下一个位置
```

## 代码实现

```java
public class KMPStringMatcher {

    void kmpSearch(String pat, String txt) {
        int m = pat.length();
        int n = txt.length();

        // 前缀函数
        int[] lps = new int[m];
        // 模式索引
        int j = 0;

        // 构建前缀函数
        computeLPSArray(pat, m, lps);

        // 文本索引
        int i = 0;
        while (i < n) {
            if (pat.charAt(j) == txt.charAt(i)) {
                j++;
                i++;
            }
            if (j == m) {
                System.out.println("Found pattern at index " + (i - j));
                j = lps[j - 1];
            } else if (i < n && pat.charAt(j) != txt.charAt(i)) {
                // 匹配失败按照前缀函数移动模式指针
                if (j != 0) {
                    j = lps[j - 1];
                } else {
                    i = i + 1;
                }
            }
        }
    }

    void computeLPSArray(String pat, int m, int[] lps) {
        // 前一个最长前缀的值
        int len = 0;
        int i = 1;
        // 第一个字符固定0
        lps[0] = 0;

        // 1 to m-1
        while (i < m) {
            if (pat.charAt(i) == pat.charAt(len)) {
                // 匹配就加1
                len++;
                lps[i] = len;
                i++;
            } else {
                // (pat[i] != pat[len])
                if (len != 0) {
                    len = lps[len - 1];
                } else {
                    // len == 0)
                    lps[i] = len;
                    i++;
                }
            }
        }
    }

    public static void main(String args[]) {
        String txt = "ABABDABACDABABCABAB";
        String pat = "ABABCABAB";
        new KMPStringMatcher().kmpSearch(pat, txt);
    }
}
```

# BM算法

Boyer和Moore提出的BM算法在匹配时从右向左扫描模式串，在最坏情况下的时间复杂度为O(n)，相对于KMP从左往右匹配模式串更高效。

当文本字符串与模式字符串不匹配时，将模式串向右移动的位数 = 当前位置 - 字符在模式中最右出现的位置（如果字符不在模式中则最右出现位置为-1）。

## 代码实现

```java
public class BMStringMatcher {

    static int NO_OF_CHARS = 256;

    static void badCharHeuristic(char[] str, int size, int[] badchar) {

        // 初始化所有位置为-1
        for (int i = 0; i < NO_OF_CHARS; i++) {
            badchar[i] = -1;
        }

        // 模式中存在的字符值为最右位置
        for (int i = 0; i < size; i++) {
            badchar[str[i]] = i;
        }
    }

    static void search(char[] txt, char[] pat) {
        int m = pat.length;
        int n = txt.length;

        int[] badchar = new int[NO_OF_CHARS];

        badCharHeuristic(pat, m, badchar);

        int s = 0;
        while (s <= (n - m)) {
            int j = m - 1;

            while (j >= 0 && pat[j] == txt[s + j]) {
                j--;
            }

            if (j < 0) {
                System.out.println("Found pattern at index = " + s);
                s += (s + m < n) ? m - badchar[txt[s + m]] : 1;
            } else {
                s += Math.max(1, j - badchar[txt[s + j]]);
            }
        }
    }

    public static void main(String[] args) {

        char[] txt = "ABABDABACDABABCABAB".toCharArray();
        char[] pat = "ABABCABAB".toCharArray();
        search(txt, pat);
    }
}
```

- 算法导论（第三版）
- 算法（第四版）
- [从头到尾彻底理解KMP](https://blog.csdn.net/v_july_v/article/details/7041827)
- [KMP Algorithm for Pattern Searching](https://www.geeksforgeeks.org/kmp-algorithm-for-pattern-searching)
