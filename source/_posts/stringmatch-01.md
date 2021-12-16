title: 【字符串匹配】朴素字符串匹配算法
author: haifun
tags:
  - 文本匹配
categories:
  - 算法
date: 2021-12-15 23:00:00
---

字符串匹配问题是指在一个大字符串T中查找另一个字符串S出现的所有位置，其中T、S都是定义在有限字符集合上的字符串。

字符串匹配的典型应用场景是在文本中查找特定关键字，用来有效解决这个问题的算法就是*字符串匹配算法*。在很多其他应用中字符串匹配算法也有所应用，例如：用来在DNA序列中查找特定序列；在网络搜索引擎中查找网页地址等。

进一步定义字符串匹配问题如下：假设文本是一个长度为n的数据T[1...n]，而模式是一个长度为m的数组P[1...m]，其中m <= n，T和P中的元素都来自一个有限字符集$\sum$，
当0 <= s <= n-m，并且T[s+1...s+m] = P[1...m]（即T[s+j] = P[j]，其中1 <= j  <= m），那么称模式P在文本T中出现，且偏移量为s。字符串匹配问题就是找到所有有效偏移。

常见的字符串匹配算法如下：

- 朴素字符串匹配算法
- Rabin-Karp 算法
- KMP 算法
- DFA 算法（确定性有穷自动机）
- AC 自动机

符号约定：

$\sum{^*}$表示所有有限长度的字符串集合，该字符串由字母表$\sum$中的字符组成


# 朴素字符串匹配

朴素字符串匹配是一种直接的暴力匹配算法，在[0,n-m]范围内通过循环偏移量s，检测是否满足T[s+1...s+m] = P[1...m]，从而找到所有有效偏移。

在最坏情况下，朴素字符串匹配算法时间复杂度为O((n-m+1)m)。

## 代码实现

```java
public class NativeStringMatcher {

    public static void main(String[] args) {

        String text = "我爱北京天安门，天安门在北京，北京城在北方";
        String pattern = "北京";

        long start = System.currentTimeMillis();
        stringMatch(text.toCharArray(), pattern.toCharArray());
        System.out.println(System.currentTimeMillis() - start);
    }

    private static void stringMatch(char[] t, char[] p) {

        if (t == null || p == null || t.length < p.length) {
            return;
        }

        int n = t.length;
        int m = p.length;

        for (int s = 0; s < n - m + 1; s++) {
            for (int i = 0; i < m; i++) {
                if (t[s + i] != p[i]) {
                    break;
                }
                if (i == m - 1) {
                    System.out.println("有效偏移量：" + s);
                }
            }
        }
    }
}
```
