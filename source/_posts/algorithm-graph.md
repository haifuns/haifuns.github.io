title: 【算法基础】图
author: haifun
tags:
  - 算法
  - 图
categories:
  - 算法
date: 2022-08-31 23:55:00

---

图结构（Graph）中节点可以具有零个或多个相邻元素，两个节点之间的连接称为边（Edge）。节点也可以称为顶点（Vertex）。

图的类型：
- 无向图，边没有方向
- 有向图，边有方向
- 带权图，边带权值

图的表示方式：
- 邻接矩阵：图形中顶点之间相邻关系的矩阵。
- 邻接表：只关心存在的边，不关心不存在的边，没有空间浪费。
- 除以上两种方式外还有其他众多的方式。

在有向图中，箭头是具有方向的，从一个顶点指向另一个顶点，每个顶点被指向的箭头个数，就是它的入度。从这个顶点指出去的箭头个数，就是它的出度。

图的算法都不算难，只是coding的代价比较高。图学习方法：

1. 先用自己最熟练的方式，实现图结构的表达。
2. 在自己熟悉的结构上，实现所有常用的图算法作为模板。
3. 把面试题提供的图结构转换为自己熟悉的图结构，再调用模板或改写即可。

# 图结构实现

```java
/**
 * 边结构
 */
public class Edge {
    // 权重
    public int weight;
    // 出发点
    public Node from;
    // 到达点
    public Node to;

    public Edge(int weight, Node from, Node to) {
        this.weight = weight;
        this.from = from;
        this.to = to;
    }
}

/**
 * 点结构
 */
public class Node {
    // 点值
    public int value;
    // 入度，顶点被指向的箭头个数
    public int in;
    // 出度，顶点指出去的箭头个数
    public int out;
    // 后继点
    public ArrayList<Node> nexts;
    // 指出去的边
    public ArrayList<Edge> edges;

    public Node(int value) {
        this.value = value;
        in = 0;
        out = 0;
        nexts = new ArrayList<>();
        edges = new ArrayList<>();
    }
}

/**
 * 图结构
 */
public class Graph {
    // 包含的点，值 -> 点
    public HashMap<Integer, Node> nodes;
    // 包含的边
    public HashSet<Edge> edges;

    public Graph() {
        nodes = new HashMap<>();
        edges = new HashSet<>();
    }
}
```

# 图的宽度优先遍历（BFS）

宽度优先遍历（Breadth First Search）：
1. 利用队列实现
2. 从源节点开始依次按照宽度进队列，然后弹出
3. 每弹出一个点，把该节点所有没有进过队列的邻接点放入队列
4. 直到队列变为空结束

```java
public static void bfs(Node start) {
    if (start == null) {
        return;
    }
    Queue<Node> queue = new LinkedList<>();
    // 记录已经进入过队列的节点，防止出现回路重复遍历
    HashSet<Node> set = new HashSet<>();
    queue.add(start);
    set.add(start);
    while (!queue.isEmpty()) {
        Node cur = queue.poll();
        System.out.println(cur.value);
        for (Node next : cur.nexts) {
            if (!set.contains(next)) {
                set.add(next);
                queue.add(next);
            }
        }
    }
}
```

# 图的深度优先遍历（DFS）

深度优先遍历（Depth First Search）：
1. 利用栈实现
2. 从源节点开始把节点按照深度放入栈，然后弹出
3. 每弹出一个点，把该节点下一个没有进过栈的邻接点放入栈
4. 直到栈变为空结束

```java
public static void dfs(Node node) {
    if (node == null) {
        return;
    }
    Stack<Node> stack = new Stack<>();
    HashSet<Node> set = new HashSet<>();
    stack.add(node);
    set.add(node);
    System.out.println(node.value);
    while (!stack.isEmpty()) {
        Node cur = stack.pop();
        for (Node next : cur.nexts) {
            if (!set.contains(next)) {
                stack.push(cur);
                stack.push(next);
                set.add(next);
                System.out.println(next.value);
                break;
            }
        }
    }
}
```

# 图的拓扑排序

拓扑排序：

1. 在图中找到所有入度为0的点输出
2. 把所有入度为0的点在图中删除，继续找到入度为0的点输出，周而复始
3. 图的所有点都被删除后，依次输出的顺序就是拓扑排序

要求：有向图且其中没有环
应用：事件安排、编译顺序

拓扑排序可以有多种顺序，并不是只有唯一的顺序。

```java
// 有向图且无环
public static List<Node> sortedTopology(Graph graph) {
    // 节点 -> 剩余的入度
    HashMap<Node, Integer> inMap = new HashMap<>();
    // 剩余入度为0的点
    Queue<Node> zeroInQueue = new LinkedList<>();
    for (Node node : graph.nodes.values()) {
        inMap.put(node, node.in);
        if (node.in == 0) {
            zeroInQueue.add(node);
        }
    }
    List<Node> result = new ArrayList<>();
    while (!zeroInQueue.isEmpty()) {
        Node cur = zeroInQueue.poll();
        result.add(cur);
        for (Node next : cur.nexts) {
            inMap.put(next, inMap.get(next) - 1); // 所有的邻接点入度-1
            if (inMap.get(next) == 0) {
                zeroInQueue.add(next); // 如果邻接点入度为0，记录
            }
        }
    }
    return result;
}
```

# 1.拓扑排序（LintCode 127.）

给定一个有向图，图节点的拓扑排序定义如下:

- 对于图中的每一条有向边 A -> B , 在拓扑排序中A一定在B之前。
- 拓扑排序中的第一个节点可以是图中的任何一个没有其他节点指向它的节点。

针对给定的有向图找到任意一种拓扑排序的顺序。

点结构：

```java
public static class DirectedGraphNode {
    public int label;
    public ArrayList<DirectedGraphNode> neighbors; // 邻接点

    public DirectedGraphNode(int x) {
        label = x;
        neighbors = new ArrayList<DirectedGraphNode>();
    }
}
```

## 解法1：bfs统计入度

```java
// 此题特殊之处在于只给定了图中所有的点
// bfs实现，统计入度数
public static ArrayList<DirectedGraphNode> topSort(ArrayList<DirectedGraphNode> graph) {
    HashMap<DirectedGraphNode, Integer> indegreeMap = new HashMap<>();
    // 初始化每个点入度数为0
    for (DirectedGraphNode cur : graph) {
        indegreeMap.put(cur, 0);
    }

    // 遍历统计每个点入度数
    for (DirectedGraphNode cur : graph) {
        for (DirectedGraphNode next : cur.neighbors) {
            indegreeMap.put(next, indegreeMap.get(next) + 1);
        }
    }

    // 拓扑队列
    Queue<DirectedGraphNode> zeroQueue = new LinkedList<>();
    // 取出第一层依次压入队列
    for (DirectedGraphNode cur : indegreeMap.keySet()) {
        if (indegreeMap.get(cur) == 0) {
            zeroQueue.add(cur);
        }
    }

    // 拓扑序结果
    ArrayList<DirectedGraphNode> ans = new ArrayList<>();
    while (!zeroQueue.isEmpty()) {
        DirectedGraphNode cur = zeroQueue.poll(); // 弹出一个入度为0的点
        ans.add(cur); // 记到结果里
        for (DirectedGraphNode next : cur.neighbors) { // 当前点所有临接点入度-1
            indegreeMap.put(next, indegreeMap.get(next) - 1);
            if (indegreeMap.get(next) == 0) {
                zeroQueue.offer(next); // 如果邻接点入度为0压入队列
            }
        }
    }
    return ans;
}
```

## 解法2：dfs统计点次

```java
public static class Record {
    public DirectedGraphNode node; // 点
    public long nodes; // 点次，当前点子图所有的节点数

    public Record(DirectedGraphNode n, long o) {
        node = n;
        nodes = o;
    }
}

public static class MyComparator implements Comparator<Record> {

    @Override
    public int compare(Record o1, Record o2) {
        return o1.nodes == o2.nodes ? 0 : (o1.nodes > o2.nodes ? -1 : 1);
    }
}

// dfs思路：统计每个点的点次，点次排序高到低对应拓扑排序。点次：当前点子图所有的节点数。
public static ArrayList<DirectedGraphNode> topSort(ArrayList<DirectedGraphNode> graph) {
    HashMap<DirectedGraphNode, Record> order = new HashMap<>();
    for (DirectedGraphNode cur : graph) {
        f(cur, order); // 计算每个点的点次
    }
    ArrayList<Record> recordArr = new ArrayList<>();
    for (Record r : order.values()) {
        recordArr.add(r);
    }
    recordArr.sort(new MyComparator()); // 排序，点次高在前
    ArrayList<DirectedGraphNode> ans = new ArrayList<DirectedGraphNode>();
    for (Record r : recordArr) {
        ans.add(r.node); // 点次排序对应拓扑排序
    }
    return ans;
}

/**
 * 当前来到cur点，返回cur点所到之处，所有的点次
 *
 * @param cur   当前点
 * @param order 缓存，点 -> 点次
 * @return （cur，点次）
 */
public static Record f(DirectedGraphNode cur, HashMap<DirectedGraphNode, Record> order) {
    if (order.containsKey(cur)) {
        return order.get(cur);
    }
    // cur的点次之前没算过！
    long nodes = 0;
    for (DirectedGraphNode next : cur.neighbors) {
        nodes += f(next, order).nodes;
    }
    Record ans = new Record(cur, nodes + 1);
    order.put(cur, ans);
    return ans;
}
```

## 解法3：dfs统计深度

```java
public static class Record {
    public DirectedGraphNode node;
    public int deep;

    public Record(DirectedGraphNode n, int o) {
        node = n;
        deep = o;
    }
}

public static class MyComparator implements Comparator<Record> {

    @Override
    public int compare(Record o1, Record o2) {
        return o2.deep - o1.deep;
    }
}

public static ArrayList<DirectedGraphNode> topSort(ArrayList<DirectedGraphNode> graph) {
    HashMap<DirectedGraphNode, Record> order = new HashMap<>();
    for (DirectedGraphNode cur : graph) {
        f(cur, order);
    }
    ArrayList<Record> recordArr = new ArrayList<>();
    for (Record r : order.values()) {
        recordArr.add(r);
    }
    recordArr.sort(new MyComparator());
    ArrayList<DirectedGraphNode> ans = new ArrayList<DirectedGraphNode>();
    for (Record r : recordArr) {
        ans.add(r.node);
    }
    return ans;
}

public static Record f(DirectedGraphNode cur, HashMap<DirectedGraphNode, Record> order) {
    if (order.containsKey(cur)) {
        return order.get(cur);
    }
    int follow = 0;
    for (DirectedGraphNode next : cur.neighbors) {
        follow = Math.max(follow, f(next, order).deep);
    }
    Record ans = new Record(cur, follow + 1);
    order.put(cur, ans);
    return ans;
}
```

# 最小生成树之Kruskal算法

最小生成树定义：对于无向带权图，在不影响所有点连通的情况下，保持图连通的最少的边。

Kruskal算法（克鲁斯卡尔算法，利用并查集实现）：
1. 总是从权值最小的边开始考虑，依次考察权值依次变大的边
2. 当前的边要么进入最小生成树的集合，要么丢弃
3. 如果当前的边进入最小生成树的集合中不会形成环，就要当前边
4. 如果当前的边进入最小生成树的集合会形成环，就不要当前边
5. 考察完所有的边之后，得到最小生成树集合

```java
// 并查集
public static class UnionFind {
    // 某一个节点 -> 节点往上的节点
    private HashMap<Node, Node> fatherMap;
    // 某一个集合的代表节点 -> 代表节点所在集合的节点个数
    private HashMap<Node, Integer> sizeMap;

    public UnionFind() {
        fatherMap = new HashMap<Node, Node>();
        sizeMap = new HashMap<Node, Integer>();
    }

    public void makeSets(Collection<Node> nodes) {
        fatherMap.clear();
        sizeMap.clear();
        for (Node node : nodes) {
            fatherMap.put(node, node); // 初始化集合，每个点都是集合
            sizeMap.put(node, 1); // 初始化集合代表节点，是自己
        }
    }

    private Node findFather(Node n) {
        Stack<Node> path = new Stack<>();
        while (n != fatherMap.get(n)) {
            path.add(n);
            n = fatherMap.get(n);
        }
        while (!path.isEmpty()) {
            fatherMap.put(path.pop(), n); // 路径压缩优化
        }
        return n;
    }

    public boolean isSameSet(Node a, Node b) {
        return findFather(a) == findFather(b);
    }

    public void union(Node a, Node b) {
        if (a == null || b == null) {
            return;
        }
        Node aDai = findFather(a); // 找到代表节点
        Node bDai = findFather(b);
        if (aDai != bDai) { // 不是同一个集合
            int aSetSize = sizeMap.get(aDai); // 集合大小
            int bSetSize = sizeMap.get(bDai);
            if (aSetSize <= bSetSize) { // 小集合挂到大集合上
                fatherMap.put(aDai, bDai);
                sizeMap.put(bDai, aSetSize + bSetSize);
                sizeMap.remove(aDai);
            } else {
                fatherMap.put(bDai, aDai);
                sizeMap.put(aDai, aSetSize + bSetSize);
                sizeMap.remove(bDai);
            }
        }
    }
}

public static class EdgeComparator implements Comparator<Edge> {

    @Override
    public int compare(Edge o1, Edge o2) {
        return o1.weight - o2.weight;
    }

}

public static Set<Edge> kruskalMST(Graph graph) {
    UnionFind unionFind = new UnionFind();
    unionFind.makeSets(graph.nodes.values());
    // 从小的边到大的边，依次弹出，小根堆！
    PriorityQueue<Edge> priorityQueue = new PriorityQueue<>(new EdgeComparator());
    for (Edge edge : graph.edges) { // M 条边
        priorityQueue.add(edge); // O(logM)
    }
    Set<Edge> result = new HashSet<>();
    while (!priorityQueue.isEmpty()) { // M 条边
        Edge edge = priorityQueue.poll(); // O(logM)
        if (!unionFind.isSameSet(edge.from, edge.to)) { // 边的两边节点不在一个集合 O(1)
            result.add(edge); // 保留边
            unionFind.union(edge.from, edge.to); // 合并集合
        }
    }
    return result;
}
```

# 最小生成树之Prim算法

Prim算法（普里姆算法）：
1. 可以从任意节点触发来寻找最小生成树
2. 某个点加入到被选取的点中后，解锁这个点出发的所有新的边
3. 在所有解锁的边（所有被选取点累计解锁的边）中选择最小的边，然后看这个边会不会形成环
4. 如果会，不要当前边，继续考察剩下解锁的边中最小的边，重复3
5. 如果不会，要当前边，将该边的指向点加入到被选取的点中，重复2
6. 当所有点都被选取之后，得到最小生成树集合

```java
public static class EdgeComparator implements Comparator<Edge> {

    @Override
    public int compare(Edge o1, Edge o2) {
        return o1.weight - o2.weight;
    }

}

public static Set<Edge> primMST(Graph graph) {
    // 解锁的边进入小根堆
    PriorityQueue<Edge> priorityQueue = new PriorityQueue<>(new EdgeComparator());

    // 哪些点被解锁出来了
    HashSet<Node> nodeSet = new HashSet<>();

    Set<Edge> result = new HashSet<>(); // 依次挑选的的边在result里

    for (Node node : graph.nodes.values()) { // 随便挑一个点，循环的目的是防止森林
        // node 是开始点
        if (!nodeSet.contains(node)) {
            nodeSet.add(node); // 接入到解锁点集合
            for (Edge edge : node.edges) { // 由一个点，解锁所有相连的边
                priorityQueue.add(edge);
            }
            while (!priorityQueue.isEmpty()) {
                Edge edge = priorityQueue.poll(); // 弹出解锁的边中，最小的边
                Node toNode = edge.to; // 可能的一个新的点
                if (!nodeSet.contains(toNode)) { // 不含有的时候，就是新的点
                    nodeSet.add(toNode); // 解锁点
                    result.add(edge); // 记录有效边
                    for (Edge nextEdge : toNode.edges) { // 解锁<解锁点>的所有边
                        priorityQueue.add(nextEdge);
                    }
                }
            }
        }
        // break; // 确定图只有一条线时可以直接跳过
    }
    return result;
}
```

# 顶点到其余各顶点的最短路径（Dijkstra算法）

Dijkstra算法（迪杰斯特拉算法）是从一个顶点到其余各顶点的最短路径算法，解决的是有权图中最短路径问题。

图要求：有向无负权值，可以有环。

算法主要特点是从起始点开始，采用贪心算法的策略，每次遍历到始点距离最近且未访问过的顶点的邻接节点，直到扩展到终点为止。

Dijkstra算法，找指定节点x到其他点的最短距离：
1. 记录x到每个邻接点的权值到表里，k -> v：点 -> 权值，自己到自己距离为0
2. 从表中找到与x距离最小且没有被锁定的点m
3. 遍历m所有邻接点，重新计算每个点经过m与x的距离，如果表里不存在就新增，距离更小就更新
4. 结束后锁定m，重复2
5. 当表里所有元素都被锁定结束

## 常规实现

```java
public static HashMap<Node, Integer> dijkstra1(Node from) {
    // 距离表，记录点与原始点距离，点 -> 距离
    HashMap<Node, Integer> distanceMap = new HashMap<>();
    distanceMap.put(from, 0);
    // 锁定的点
    HashSet<Node> selectedNodes = new HashSet<>();
    // 没有被锁定，与原始点距离最小的点
    Node minNode = getMinDistanceAndUnselectedNode(distanceMap, selectedNodes);
    while (minNode != null) {
        // 原始点 -> minNode（跳转点），最小距离distance
        int distance = distanceMap.get(minNode);
        for (Edge edge : minNode.edges) {
            Node toNode = edge.to;
            if (!distanceMap.containsKey(toNode)) {
                distanceMap.put(toNode, distance + edge.weight); // 表里不存在新增
            } else {
                distanceMap.put(edge.to, Math.min(distanceMap.get(toNode), distance + edge.weight)); // 取原始距离和经过跳转点的最小距离
            }
        }
        selectedNodes.add(minNode); // 锁定跳转点
        minNode = getMinDistanceAndUnselectedNode(distanceMap, selectedNodes); // 更换跳转点
    }
    return distanceMap;
}

/**
 * 从距离表中找到没有被锁定、最小距离的点
 * @param distanceMap 距离表
 * @param touchedNodes 被锁定的点
 * @return
 */
public static Node getMinDistanceAndUnselectedNode(HashMap<Node, Integer> distanceMap, HashSet<Node> touchedNodes) {
    Node minNode = null;
    int minDistance = Integer.MAX_VALUE;
    for (Map.Entry<Node, Integer> entry : distanceMap.entrySet()) {
        Node node = entry.getKey();
        int distance = entry.getValue();
        if (!touchedNodes.contains(node) && distance < minDistance) {
            minNode = node;
            minDistance = distance;
        }
    }
    return minNode;
}
```

## 加强堆优化

Dijkstra算法过程中的2、3步骤需要不断的循环遍历查找、更新，效率较低，可以使用加强堆优化。

把距离表替换为加强堆（小根堆），需要最小距离时直接从小根堆弹出一个值，新增或更新时利用加强堆更新节点。

```java
public static class NodeRecord {
    public Node node; // 点
    public int distance; // 距离

    public NodeRecord(Node node, int distance) {
        this.node = node;
        this.distance = distance;
    }
}

public static class NodeHeap {
    // 实际的堆结构
    private Node[] nodes;
    // 节点 -> 堆中的位置
    private HashMap<Node, Integer> heapIndexMap;
    // 节点 -> 从源节点出发到该节点的目前最小距离
    private HashMap<Node, Integer> distanceMap;
    // 堆上有多少个点
    private int size;

    public NodeHeap(int size) {
        nodes = new Node[size];
        heapIndexMap = new HashMap<>();
        distanceMap = new HashMap<>();
        size = 0;
    }

    public boolean isEmpty() {
        return size == 0;
    }

    // 从源节点出发到达node的距离为distance
    public void addOrUpdateOrIgnore(Node node, int distance) {
        if (inHeap(node)) { // 在堆上，update
            distanceMap.put(node, Math.min(distanceMap.get(node), distance)); // 更新最小距离
            insertHeapify(heapIndexMap.get(node)); // 值变小了，上移
        }
        if (!isEntered(node)) { // 没进过堆，add
            nodes[size] = node;
            heapIndexMap.put(node, size);
            distanceMap.put(node, distance);
            insertHeapify(size++); // 新增上移
        }
    }

    // 弹出最小记录
    public NodeRecord pop() {
        NodeRecord nodeRecord = new NodeRecord(nodes[0], distanceMap.get(nodes[0]));
        swap(0, size - 1); // 把最后一个节点换到0位置
        heapIndexMap.put(nodes[size - 1], -1); // index改成-1
        distanceMap.remove(nodes[size - 1]); // 删除距离
        nodes[size - 1] = null; // 从堆中删除
        heapify(0, --size); // 下移0位置
        return nodeRecord;
    }

    // 上移
    private void insertHeapify(int index) {
        while (distanceMap.get(nodes[index]) < distanceMap.get(nodes[(index - 1) / 2])) { // 小于父节点
            swap(index, (index - 1) / 2); // 交换，上移
            index = (index - 1) / 2;
        }
    }

    // 下移
    private void heapify(int index, int size) {
        int left = index * 2 + 1;
        while (left < size) {
            int smallest = left + 1 < size && distanceMap.get(nodes[left + 1]) < distanceMap.get(nodes[left])
                           ? left + 1
                           : left; // index最小子节点
            smallest = distanceMap.get(nodes[smallest]) < distanceMap.get(nodes[index]) ? smallest : index;
            if (smallest == index) {
                break;
            }
            swap(smallest, index); // 子节点小于index，交换位置
            index = smallest;
            left = index * 2 + 1;
        }
    }

    // 进没进过堆
    private boolean isEntered(Node node) {
        return heapIndexMap.containsKey(node);
    }

    // 在不在堆上
    private boolean inHeap(Node node) {
        return isEntered(node) && heapIndexMap.get(node) != -1;
    }

    // 交换位置
    private void swap(int index1, int index2) {
        heapIndexMap.put(nodes[index1], index2);
        heapIndexMap.put(nodes[index2], index1);
        Node tmp = nodes[index1];
        nodes[index1] = nodes[index2];
        nodes[index2] = tmp;
    }
}

// 加强堆改进后的dijkstra算法
// 从head出发，所有head能到达的节点，生成到达每个节点的最小路径记录并返回
public static HashMap<Node, Integer> dijkstra2(Node head, int size) {
    NodeHeap nodeHeap = new NodeHeap(size);
    nodeHeap.addOrUpdateOrIgnore(head, 0);
    HashMap<Node, Integer> result = new HashMap<>();
    while (!nodeHeap.isEmpty()) {
        NodeRecord record = nodeHeap.pop();
        Node cur = record.node;
        int distance = record.distance;
        for (Edge edge : cur.edges) {
            nodeHeap.addOrUpdateOrIgnore(edge.to, edge.weight + distance);
        }
        result.put(cur, distance);
    }
    return result;
}
```
