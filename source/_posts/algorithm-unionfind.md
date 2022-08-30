title: 【算法基础】并查集
author: haifun
tags:
  - 算法
  - 并查集
categories:
  - 算法
date: 2022-08-30 20:00:00

---

并查集是一种树型的数据结构，用于处理一些不相交集合的合并及查询问题。

并查集主要操作：

- 初始化：把每个点所在集合初始化为其自身。
- 查找：查找元素所在的集合，即根节点。
- 合并：将两个元素所在的集合合并为一个集合。

# 代码实现

hash表实现并查集，便于理解。

```java
public static class Node<V> {
    V value;

    public Node(V v) {
        value = v;
    }
}

public static class UnionFind<V> {
    // 样本 -> 封装对象
    public HashMap<V, Node<V>> nodes;
    // 封装对象 -> 封装对象，表实现父指针
    public HashMap<Node<V>, Node<V>> parents;
    // 集合代表节点 -> 集合大小
    public HashMap<Node<V>, Integer> sizeMap;

    public UnionFind(List<V> values) {
        nodes = new HashMap<>();
        parents = new HashMap<>();
        sizeMap = new HashMap<>();
        for (V cur : values) {
            Node<V> node = new Node<>(cur);
            nodes.put(cur, node);
            parents.put(node, node); // 初始化时每一个节点指向自己
            sizeMap.put(node, 1); // 初始化时每一个节点都是自己所在集合的代表节点
        }
    }

    // 找到给定节点的代表节点
    public Node<V> findFather(Node<V> cur) {
        Stack<Node<V>> path = new Stack<>();
        while (cur != parents.get(cur)) {
            path.push(cur);
            cur = parents.get(cur);
        }

        // 此时cur为代表节点

        while (!path.isEmpty()) {
            // 优化点，减少链长度
            // 经过的所有节点都直接指向代表节点
            parents.put(path.pop(), cur);
        }
        return cur;
    }

    // a b样本是否在一个集合
    public boolean isSameSet(V a, V b) {
        // 找a b的代表节点，比较是否是一个
        return findFather(nodes.get(a)) == findFather(nodes.get(b));
    }

    public void union(V a, V b) {
        // a代表节点
        Node<V> aHead = findFather(nodes.get(a));
        // b代表节点
        Node<V> bHead = findFather(nodes.get(b));
        if (aHead != bHead) {
            // a所在集合大小
            int aSetSize = sizeMap.get(aHead);
            // b所在集合大小
            int bSetSize = sizeMap.get(bHead);
            // 大集合代表节点
            Node<V> big = aSetSize >= bSetSize ? aHead : bHead;
            // 小集合代表节点
            Node<V> small = big == aHead ? bHead : aHead;
            // 优化点，小挂到大上，减少链长度
            // 小集合代表节点指向大集合代表节点
            parents.put(small, big);
            // 更新大集合代表节点对应的集合大小
            sizeMap.put(big, aSetSize + bSetSize);
            // 删除小集合
            sizeMap.remove(small);
        }
    }

    public int sets() {
        return sizeMap.size();
    }
}
```

hash表常数时间慢，数组实现方式：

```java
public static class UnionFind {
    // parent[i]=k -> i的父亲是k
    private int[] parent;
    // size[i]=k -> i所在的集合大小是k，如果i是代表节点，size[i]才有意义，否则无意义
    private int[] size;
    // 辅助结构
    private int[] help;
    // 一共有多少个集合
    private int sets;

    public UnionFind(int N) {
        parent = new int[N];
        size = new int[N];
        help = new int[N];
        sets = N;
        for (int i = 0; i < N; i++) {
            parent[i] = i; // 初始代表节点都是自己
            size[i] = 1; // 每个集合大小是1
        }
    }

    // 从i开始一直往上，往上到不能再往上，代表节点，返回
    // 过程中做路径压缩优化
    private int find(int i) {
        int hi = 0;
        while (i != parent[i]) { // parent是自己为代表节点
            help[hi++] = i; // help中存放的是链上经过的节点
            i = parent[i];
        }
        for (hi--; hi >= 0; hi--) {
            parent[help[hi]] = i; // 路径压缩，链上经过的所有节点都指向代表节点
        }
        return i;
    }

    public void union(int i, int j) {
        int f1 = find(i); // i所在集合代表节点
        int f2 = find(j); // j所在集合代表节点
        if (f1 != f2) { // 不在同一个集合
            if (size[f1] >= size[f2]) { // 小集合挂到大集合上
                size[f1] += size[f2];
                parent[f2] = f1;
            } else {
                size[f2] += size[f1];
                parent[f1] = f2;
            }
            sets--; // 集合总数量-1
        }
    }

    public int sets() {
        return sets;
    }
}
```

# 1.省份数量（LeetCode 547.）

有 n 个城市，其中一些彼此相连，另一些没有相连。如果城市 a 与城市 b 直接相连，且城市 b 与城市 c 直接相连，那么城市 a 与城市 c 间接相连。

省份是一组直接或间接相连的城市，组内不含其他没有相连的城市。

给你一个 n x n 的矩阵 isConnected ，其中 isConnected[i][j] = 1 表示第 i 个城市和第 j 个城市直接相连，而 isConnected[i][j] = 0 表示二者不直接相连。

返回矩阵中省份的数量。

提示：
- isConnected[i][j] 为 1 或 0
- isConnected[i][i] == 1
- isConnected[i][j] == isConnected[j][i]

```java
public static int findCircleNum(int[][] M) {
    int N = M.length;
    // 0..N-1，初始集合数=城市数
    UnionFind unionFind = new UnionFind(N);
    for (int i = 0; i < N; i++) {
        for (int j = i + 1; j < N; j++) { // 只遍历矩阵右上部分
            if (M[i][j] == 1) { // i和j互相认识
                unionFind.union(i, j); // 合并集合
            }
        }
    }
    return unionFind.sets();
}
```

# 2.岛屿数量（LeetCode 200.）

给你一个由'1'（陆地）和 '0'（水）组成的的二维网格，请你计算网格中岛屿的数量。

岛屿总是被水包围，并且每座岛屿只能由水平方向和/或竖直方向上相邻的陆地连接形成。

此外，你可以假设该网格的四条边均被水包围。

示例 1：
输入：grid = [
  ["1","1","1","1","0"],
  ["1","1","0","1","0"],
  ["1","1","0","0","0"],
  ["0","0","0","0","0"]
]
输出：1

示例 2：
输入：grid = [
  ["1","1","0","0","0"],
  ["1","1","0","0","0"],
  ["0","0","1","0","0"],
  ["0","0","0","1","1"]
]
输出：3

```java
// 递归实现，感染算法，复杂度O(m*n)，最优解
public static int numIslands1(char[][] board) {
    int islands = 0;
    for (int i = 0; i < board.length; i++) {
        for (int j = 0; j < board[0].length; j++) {
            if (board[i][j] == '1') { // 每遇到一个'1'都是新岛屿
                islands++;
                infect(board, i, j); // 感染所有相邻'1'，变为0
            }
        }
    }
    return islands;
}

// 从(i,j)这个位置出发，把所有练成一片的'1'字符，变成0
public static void infect(char[][] board, int i, int j) {
    if (i < 0 || i == board.length || j < 0 || j == board[0].length || board[i][j] != '1') {
        return;
    }
    board[i][j] = 0;
    // 感染上下左右相邻'1'
    infect(board, i - 1, j);
    infect(board, i + 1, j);
    infect(board, i, j - 1);
    infect(board, i, j + 1);
}

// 并查集实现
public static int numIslands2(char[][] board) {
    int row = board.length;
    int col = board[0].length;
    UnionFind uf = new UnionFind(board);

    // 第0行
    for (int j = 1; j < col; j++) {
        if (board[0][j - 1] == '1' && board[0][j] == '1') { // 左和自己都是'1'
            uf.union(0, j - 1, 0, j); // 合并
        }
    }

    // 第0列
    for (int i = 1; i < row; i++) {
        if (board[i - 1][0] == '1' && board[i][0] == '1') { // 上和自己都是'1'
            uf.union(i - 1, 0, i, 0); // 合并
        }
    }

    for (int i = 1; i < row; i++) {
        for (int j = 1; j < col; j++) {
            if (board[i][j] == '1') { // 自己是'1'
                if (board[i][j - 1] == '1') { // 左是'1'
                    uf.union(i, j - 1, i, j); // 合并
                }
                if (board[i - 1][j] == '1') { // 上是'1'
                    uf.union(i - 1, j, i, j); // 合并
                }
            }
        }
    }
    return uf.sets();
}

public static class UnionFind {
    private int[] parent;
    private int[] size;
    private int[] help;
    private int col;
    private int sets;

    // 二维转一维
    public UnionFind(char[][] board) {
        col = board[0].length; // 列
        sets = 0;
        int row = board.length; // 行
        int len = row * col; // 总个数，行*列
        parent = new int[len];
        size = new int[len];
        help = new int[len];
        for (int r = 0; r < row; r++) {
            for (int c = 0; c < col; c++) {
                if (board[r][c] == '1') {
                    int i = index(r, c);
                    parent[i] = i;
                    size[i] = 1;
                    sets++;
                }
            }
        }
    }

    // (r,c) -> i
    private int index(int r, int c) {
        return r * col + c; // 下标，所在行*总列数+所在列数
    }

    // 原始位置 -> 下标
    private int find(int i) {
        int hi = 0;
        while (i != parent[i]) {
            help[hi++] = i;
            i = parent[i];
        }
        for (hi--; hi >= 0; hi--) {
            parent[help[hi]] = i;
        }
        return i;
    }

    public void union(int r1, int c1, int r2, int c2) {
        int i1 = index(r1, c1);
        int i2 = index(r2, c2);
        int f1 = find(i1);
        int f2 = find(i2);
        if (f1 != f2) {
            if (size[f1] >= size[f2]) {
                size[f1] += size[f2];
                parent[f2] = f1;
            } else {
                size[f2] += size[f1];
                parent[f1] = f2;
            }
            sets--;
        }
    }

    public int sets() {
        return sets;
    }
}
```

# 3.岛屿数量II（LeetCode 305.）

假设你要设计一个游戏，用一个 m 行 n 列的 2d 网格来存储游戏地图。

起始的时候，每个格子的地形都被默认标记为「水」。我们可以通过使用 addLand 进行操作，将位置 (row, col) 的「水」变成「陆地」。

你将会被给定一个列表，来记录所有需要被操作的位置，然后你需要返回计算出来 每次 addLand 操作后岛屿的数量。

注意：一个岛的定义是被「水」包围的「陆地」，通过水平方向或者垂直方向上相邻的陆地连接而成。你可以假设地图网格的四边均被无边无际的「水」所包围。

示例:

输入: m = 3, n = 3, positions = [[0,0], [0,1], [1,2], [2,1]]
输出: [1,1,2,3]
解析:

起初，二维网格 grid 被全部注入「水」。（0 代表「水」，1 代表「陆地」）
```
0 0 0
0 0 0
0 0 0
```
操作 #1：addLand(0, 0) 将 grid[0][0] 的水变为陆地。
```
1 0 0
0 0 0 岛屿的数量为 1
0 0 0
```
操作 #2：addLand(0, 1) 将 grid[0][1] 的水变为陆地。
```
1 1 0
0 0 0 岛屿的数量为 1
0 0 0
```
操作 #3：addLand(1, 2) 将 grid[1][2] 的水变为陆地。
```
1 1 0
0 0 1 岛屿的数量为 2
0 0 0
```
操作 #4：addLand(2, 1) 将 grid[2][1] 的水变为陆地。
```
1 1 0
0 0 1 岛屿的数量为 3
0 1 0
```

```java
// 第一种实现，O(m*n) + O(k)，网格很大时初始化过重
public static List<Integer> numIslands2v1(int m, int n, int[][] positions) {
    UnionFind1 uf = new UnionFind1(m, n);
    List<Integer> ans = new ArrayList<>();
    for (int[] position : positions) {
        ans.add(uf.connect(position[0], position[1]));
    }
    return ans;
}

public static class UnionFind1 {
    private int[] parent;
    private int[] size;
    private int[] help;
    private final int row;
    private final int col;
    private int sets;

    public UnionFind1(int m, int n) {
        row = m;
        col = n;
        sets = 0;
        int len = row * col;
        parent = new int[len];
        size = new int[len];
        help = new int[len];
    }

    private int index(int r, int c) {
        return r * col + c;
    }

    private int find(int i) {
        int hi = 0;
        while (i != parent[i]) {
            help[hi++] = i;
            i = parent[i];
        }
        for (hi--; hi >= 0; hi--) {
            parent[help[hi]] = i;
        }
        return i;
    }

    private void union(int r1, int c1, int r2, int c2) {
        if (r1 < 0 || r1 == row || r2 < 0 || r2 == row || c1 < 0 || c1 == col || c2 < 0 || c2 == col) {
            return;
        }
        int i1 = index(r1, c1);
        int i2 = index(r2, c2);
        if (size[i1] == 0 || size[i2] == 0) { // 如果有任何一个没有初始化
            return;
        }
        int f1 = find(i1);
        int f2 = find(i2);
        if (f1 != f2) { // 合并集合
            if (size[f1] >= size[f2]) {
                size[f1] += size[f2];
                parent[f2] = f1;
            } else {
                size[f2] += size[f1];
                parent[f1] = f2;
            }
            sets--;
        }
    }

    public int connect(int r, int c) {
        int index = index(r, c); // r行c列下标
        if (size[index] == 0) { // 如果没有初始化，动态初始化
            parent[index] = index; // 初始化集合，代表节点是自己
            size[index] = 1; // 初始化集合
            sets++; // 集合数量+1
            // 跟上下左右集合合并
            union(r - 1, c, r, c);
            union(r + 1, c, r, c);
            union(r, c - 1, r, c);
            union(r, c + 1, r, c);
        }
        return sets;
    }

}

// 第二种实现，如果m*n比较大，会经历很重的初始化，而k比较小，优化方法
public static List<Integer> numIslands2v2(int m, int n, int[][] positions) {
    UnionFind2 uf = new UnionFind2();
    List<Integer> ans = new ArrayList<>();
    for (int[] position : positions) {
        ans.add(uf.connect(position[0], position[1]));
    }
    return ans;
}

public static class UnionFind2 {
    private HashMap<String, String> parent;
    private HashMap<String, Integer> size;
    private ArrayList<String> help;
    private int sets;

    public UnionFind2() {
        parent = new HashMap<>();
        size = new HashMap<>();
        help = new ArrayList<>();
        sets = 0;
    }

    private String find(String cur) {
        while (!cur.equals(parent.get(cur))) {
            help.add(cur);
            cur = parent.get(cur);
        }
        for (String str : help) {
            parent.put(str, cur);
        }
        help.clear();
        return cur;
    }

    private void union(String s1, String s2) {
        if (parent.containsKey(s1) && parent.containsKey(s2)) { // 两个集合都初始化过了
            String f1 = find(s1);
            String f2 = find(s2);
            if (!f1.equals(f2)) { // 集合合并
                int size1 = size.get(f1);
                int size2 = size.get(f2);
                String big = size1 >= size2 ? f1 : f2;
                String small = big == f1 ? f2 : f1;
                parent.put(small, big);
                size.put(big, size1 + size2);
                sets--;
            }
        }
    }

    public int connect(int r, int c) {
        String key = String.valueOf(r) + "_" + String.valueOf(c);
        if (!parent.containsKey(key)) { // 已经初始化了
            parent.put(key, key); // 初始化集合，代表节点是自己
            size.put(key, 1); // 初始化集合
            sets++; // 集合数量+1
            // 上下左右key
            String up = String.valueOf(r - 1) + "_" + String.valueOf(c);
            String down = String.valueOf(r + 1) + "_" + String.valueOf(c);
            String left = String.valueOf(r) + "_" + String.valueOf(c - 1);
            String right = String.valueOf(r) + "_" + String.valueOf(c + 1);
            // 和上下左右集合合并
            union(up, key);
            union(down, key);
            union(left, key);
            union(right, key);
        }
        return sets;
    }
}
```
