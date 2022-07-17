title: 【算法基础】前缀树
author: haifun
tags:
  - 算法
  - 异或
categories:
  - 算法
date: 2022-07-17 15:30:00

---

前缀树也称为字典树、Trie树，优点在于利用字符串的公共前缀来减少查询时间，常被搜索引擎用于文本词频统计。

# 前缀树构建过程

以字符串“abc”，“abd”，“bce”，“abcd”为例，前缀树构建过程如下图所示：

- 每个节点记录经过当前节点的字符串数量p和是否是字符串结尾e
- 每条线段表示字符

![image](https://img.haifuns.com/md/img/trie.png)

# 前缀树实现

```java
public static class Node {
    public int pass;
    public int end;
    public Node[] nexts;

    public Node() {
        pass = 0;
        end = 0;
        nexts = new Node[26];
    }
}

public static class Trie {
    public Node root;

    public Trie() {
        root = new Node();
    }

    // 插入字符串word
    public void insert(String word) {
        if (word == null) {
            return;
        }

        char[] chs = word.toCharArray();

        Node node = root;
        node.pass++;
        int path = 0;
        for (int i = 0; i < chs.length; i++) { // 从左往右遍历字符
            path = chs[i] - 'a'; // 字符
            if (node.nexts[path] == null) { // 当前字符对应的node不存在就新建
                node.nexts[path] = new Node();
            }
            node = node.nexts[path]; // 指针移动到当前node
            node.pass++; // 当前node pass + 1
        }
        node.end++; // 最后一个字符对应的node end + 1
    }

    // 删除字符串word
    public void delete(String word) {
        if (search(word) != 0) { // 不存在直接跳过
            char[] chs = word.toCharArray();
            Node node = root;
            node.pass--; // root pass直接-1
            int path = 0;
            for (int i = 0; i < chs.length; i++) {
                path = chs[i] - 'a';
                if (--node.nexts[path].pass == 0) { // 如果字符pass-1后是0，直接设为空结束
                    node.nexts[path] = null;
                    return;
                }
                node = node.nexts[path];
            }
            node.end--;
        }
    }

    // 查找word加入过几次
    public int search(String word) {
        if (word == null) {
            return 0;
        }

        char[] chs = word.toCharArray();
        Node node = root;
        int index = 0;
        for (int i = 0; i < chs.length; i++) {
            index = chs[i] - 'a';
            if (node.nexts[index] == null) {
                return 0;
            }
            node = node.nexts[index];
        }
        return node.end;
    }

    // 查找以pre作为前缀的字符串数量
    public int prefixNumber(String pre) {
        if (pre == null) {
            return 0;
        }
        char[] chs = pre.toCharArray();
        Node node = root;
        int index = 0;
        for (int i = 0; i < chs.length; i++) {
            index = chs[i] - 'a';
            if (node.nexts[index] == null) {
                return 0;
            }
            node = node.nexts[index];
        }
        return node.pass;
    }
}
```
