title: 【字符串匹配】AC自动机
author: haifun
tags:
  - 文本匹配
categories:
  - 算法
date: 2022-01-26 20:00:00
---

# Trie树

在了解AC自动机前需要先简单了解一下Trie树：Trie树也称为字典树、前缀树，是一种常被用于词检索的树结构。其思想非常简单：利用词的共同前缀以达到节省空间的目的。基本实现有array和linked-list两种。

以bachelor, baby, badge, jar四个单词构成的Trie树为例，array实现需要为每一个字符开辟一个字母表大小的数据，如下图所示：

![trie array实现](https://haif-cloud.oss-cn-beijing.aliyuncs.com/algorithm/stringmatch/trie-array.png)

array实现的trie树查询时间复杂度为O(n)，但是存在大量的空间浪费。linked-list实现避免了空间浪费，却增加了查询时的复杂度（公共前缀需要回溯），如下图所示：

![trie linked-list实现](https://haif-cloud.oss-cn-beijing.aliyuncs.com/algorithm/stringmatch/trie-linkedlist.png)

# AC自动机

AC自动机通过将模式串预处理为确定有限状态自动机，扫描文本一遍就能结束，匹配复杂度为O(n)。

AC自动机包含三个核心函数：

- success，成功转移到另一个状态，也称为goto表或success表
- failure，如果不能成功转移则跳转到一个特定的节点，也称为failure表
- emits，命中一个模式串，也称为output表

以文本“ushers”，模式串“he”、“she”、“his”、“hers”为例，构建的自动机如下图所示：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/algorithm/stringmatch/Aho-Corasick.png)

匹配过程：

1. 接收到字符u，首先尝试按照success表转移（图中实线），没有相应路线，转移失败
2. 按照failure表回去（图中虚线），继续接收到一个字符s，转移到状态3，然后继续按照success表转移
3. 直到失败跳转重新跳转到步骤2，或者遇到output表中标明“可输出状态”输出匹配到的字符串，然后将此状态视作普通状态继续转移

AC自动机高效之处在于在接受了“ushe”之后，再接受一个r导致无法按照success表继续转移，此时自动机按照failure表转移到2状态，然后再转移两次就能输出“hers”，整个匹配过程就好像没有失败过。

## 构建过程

### goto表

goto表本质上就是一颗Trie树，其构建过程就是Trie树的构建过程。

### failure表

failure表是状态与状态的一对一关系，如示例中的虚线部分，构造方法如下：

1. 首先规定与状态0距离为1的所有fail值为0
2. 假设当前状态是S1，S1前一个状态是S2，S2转换到S1接受字符为C即S1 = goto(S2, C)。fail(S1)求值方法为：测试goto(fail(S2)，C)
    - 如果成功，fail(S1) = goto(fail(S2), C)
    - 如果失败，继续测试goto(fail(fail(S2))，C)，如此重复直到测试成功后赋值给fail(S1)

### output表

output表在构建goto表和failure表的同时创建，例如示例中5 {she, he}，在创建goto表时类似Trie树里表示是否是单词结尾的结构，构建failure表时进行拓展。

# 双数组Trie树

双数组trie树是一种空间复杂度低的Trie树，应用于字符区间大的语言（中文、日文等）分词领域，其本身并不保存树，而是在构建树过程维护base、check双数组，双数组信息足以表示整棵树。

base数组是goto表的array实现，check数组验证转移的有效性。以状态t接受字符c转移到状态tc为例，双数组满足以下转移方程：

- base[t] + c = tc
- check[tc] = t

## 构建过程（[darts-java实现](https://github.com/komiya-atsushi/darts-java)）

1. 初始化root节点base[0] = 1; check[0] = 0
2. 对于每一群兄弟节点，寻找一个begin值使得check[begin+a1]、check[begin+a2]、...、check[begin+an]都等于0，也就是找到n个空闲空间
3. 设置check[begin+an]=begin
4. 对于每个兄弟节点，如果没有子节点（即叶子节点），令其base为负值。否则设置base为begin，同时插入子节点，执行步骤2

## 前缀查询

定义当前状态p = base[0] = 1，依次读取字符串，如果base[p] = check[base[p]] && base[base[p]] < 0则查到一个词。

然后状态转移，增加一个字符，p = base[char[i-1]] + char[i] + 1

# AC自动机（双数组Trie树实现）

AC自动机能够高速完成多模式匹配，其最终性能高低取决于具体实现，大部分实现都是使用一个Map<Character,State>，当字符区间大时其巨额空间复杂度与哈希函数性能消耗会降低整体性能。

双数组Trie树能在O(n)时间内完成单串匹配，并且内存消耗可控。然而如果要匹配多个模式串必须先实现前缀查询，然后频繁截取文本后缀才可以多匹配，文本需要回退扫描多遍，性能极低。

hankcs开源的[AhoCorasickDoubleArrayTrie](https://github.com/hankcs/AhoCorasickDoubleArrayTrie)类库结合了双数组trie树和AC自动机的优点，得到了一种近乎完美的数据结构。

- [双数组字典树](https://www.cnblogs.com/en-heng/p/6265256.html)
- [Aho-Corasick算法的Java实现与分析](http://www.hankcs.com/program/algorithm/implementation-and-analysis-of-aho-corasick-algorithm-in-java.html)
- [双数组Trie树(DoubleArrayTrie)Java实现](http://www.hankcs.com/program/java/%e5%8f%8c%e6%95%b0%e7%bb%84trie%e6%a0%91doublearraytriejava%e5%ae%9e%e7%8e%b0.html)
- [Aho Corasick自动机结合DoubleArrayTrie极速多模式匹配](http://www.hankcs.com/program/algorithm/aho-corasick-double-array-trie.html)
- [双数组trie开源代码](https://github.com/komiya-atsushi/darts-java)
- [Aho-Corasick开源代码](https://github.com/hankcs/aho-corasick)
- [双数组Trie树实现Aho-Corasick开源代码](https://github.com/hankcs/AhoCorasickDoubleArrayTrie)
