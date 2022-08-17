title: 【算法基础】二叉树专练（二）
author: haifun
tags:
  - 算法
  - 二叉树
categories:
  - 算法
date: 2022-08-16 23:20:00

---

# 二叉树的递归套路（重要）

1. 假设以X节点为头，可以向X左树和X右树要任何信息
2. 在上一步的假设下，讨论以X为头结点的树，得到答案的可能性（最重要）
3. 列出所有可能性后，确定到底需要向左树和右树要什么信息
4. 把左树信息和右树信息求全集，就是任何一棵子树都要返回的信息S
5. 递归函数对于每棵子树都要返回S
6. 在代码中考虑如何利用左树信息和右树信息整合出整棵树的信息

# 1.判断二叉树是否是平衡二叉树

平衡树(Balance Tree)：任意节点的子树的高度差都小于等于1。

解题思路：

对于任意节点x，满足：
1. x左树平衡
2. x右树平衡
3. |x左树高度 - x右树高度| < 2

```java
// 递归实现
public static boolean isBalanced(Node head) {
    return process(head).isBalanced;
}

public static class Info {
    public boolean isBalanced;
    public int height;

    public Info(boolean i, int h) {
        isBalanced = i;
        height = h;
    }
}

public static Info process(Node x) {
    if (x == null) {
        return new Info(true, 0);
    }
    Info leftInfo = process(x.left);
    Info rightInfo = process(x.right);
    int height = Math.max(leftInfo.height, rightInfo.height) + 1; // 当前节点高度
    boolean isBalanced = true;
    if (!leftInfo.isBalanced) { // 左树不平
        isBalanced = false;
    }
    if (!rightInfo.isBalanced) { // 右树不平
        isBalanced = false;
    }
    if (Math.abs(leftInfo.height - rightInfo.height) > 1) { // 左右高度差 > 1
        isBalanced = false;
    }
    return new Info(isBalanced, height);
}
```

# 2.判断二叉树是否是搜索二叉树

二叉查找树(Binary Search Tree)：每一棵子树均满足左树比头节点小，右树比头节点大。

解题思路：

对于任意节点x，满足：
1. x左树是否是搜索二叉树
2. x右树是否是搜索二叉树
3. x左树最大值 < x右树最小值

```java
// 递归实现
public static boolean isBST(Node head) {
    if (head == null) {
        return true;
    }
    return process(head).isBST;
}

public static class Info {
    public boolean isBST;
    public int max;
    public int min;

    public Info(boolean i, int ma, int mi) {
        isBST = i;
        max = ma;
        min = mi;
    }

}

public static Info process(Node x) {
    if (x == null) {
        return null;
    }
    Info leftInfo = process(x.left);
    Info rightInfo = process(x.right);
    int max = x.value;
    if (leftInfo != null) {
        max = Math.max(max, leftInfo.max);
    }
    if (rightInfo != null) {
        max = Math.max(max, rightInfo.max);
    }
    int min = x.value;
    if (leftInfo != null) {
        min = Math.min(min, leftInfo.min);
    }
    if (rightInfo != null) {
        min = Math.min(min, rightInfo.min);
    }
    boolean isBST = true;
    if (leftInfo != null && !leftInfo.isBST) {
        isBST = false;
    }
    if (rightInfo != null && !rightInfo.isBST) {
        isBST = false;
    }
    if (leftInfo != null && leftInfo.max >= x.value) {
        isBST = false;
    }
    if (rightInfo != null && rightInfo.min <= x.value) {
        isBST = false;
    }
    return new Info(isBST, max, min);
}
```

# 3.判断二叉树是否是完全二叉树

完全二叉树(Complete Binary Tree)：叶子结点只能出现在最下层和次下层，且最下层的叶子结点集中在树的左部。
满二叉树肯定是完全二叉树，而完全二叉树不一定是满二叉树。

解题思路：

非递归实现，按层遍历，每个节点判断：
1. 有右子节点没有左子节点直接判断不是完全二叉树
2. 如果存在一个节点不完全（有左无右），后续节点如果有子节点，直接判断不是完全二叉树

递归实现，对于节点x满足完全二叉树有以下四种情况：
1. 左树满，右树满，左树高度 == 右树高度
2. 左树完全，右树满，左树高度 == 右树高度 + 1
3. 左树满，右树满，左树高度 == 右树高度 + 1
4. 左树满，右树完全，左树高度 == 右树高度

合并，递归实现对于每个节点需要：
1. 是否是满二叉树
2. 是否是完全二叉树
3. 高度

```java
// 按层遍历实现
public static boolean isCBT1(Node head) {
    if (head == null) {
        return true;
    }

    Queue<Node> queue = new LinkedList<>();
    // 是否遇到过左右两个孩子不双全的节点
    boolean leaf = false;
    Node l = null;
    Node r = null;
    queue.add(head);
    while (!queue.isEmpty()) {
        head = queue.poll();
        l = head.left;
        r = head.right;
        if (
            // 如果遇到了不双全的节点之后，又发现当前节点不是叶节点
            (leaf && (l != null || r != null))
            ||
            (l == null && r != null)

        ) {
            return false;
        }
        if (l != null) {
            queue.add(l);
        }
        if (r != null) {
            queue.add(r);
        }
        if (l == null || r == null) {
            leaf = true;
        }
    }
    return true;
}

// 递归实现
public static boolean isCBT2(Node head) {
    if (head == null) {
        return true;
    }
    return process(head).isCBT;
}

// 对每一棵子树，是否是满二叉树、是否是完全二叉树、高度
public static class Info {
    public boolean isFull;
    public boolean isCBT;
    public int height;

    public Info(boolean full, boolean cbt, int h) {
        isFull = full;
        isCBT = cbt;
        height = h;
    }
}

public static Info process(Node x) {
    if (x == null) {
        return new Info(true, true, 0);
    }
    Info leftInfo = process(x.left);
    Info rightInfo = process(x.right);

    int height = Math.max(leftInfo.height, rightInfo.height) + 1;

    boolean isFull = leftInfo.isFull
                     &&
                     rightInfo.isFull
                     && leftInfo.height == rightInfo.height;

    boolean isCBT = false;
    if (isFull) {
        isCBT = true;
    } else { // 以x为头整棵树，不满
        if (leftInfo.isCBT && rightInfo.isCBT) {

            if (leftInfo.isCBT
                    && rightInfo.isFull
                    && leftInfo.height == rightInfo.height + 1) {
                isCBT = true;
            }
            if (leftInfo.isFull
                    &&
                    rightInfo.isFull
                    && leftInfo.height == rightInfo.height + 1) {
                isCBT = true;
            }
            if (leftInfo.isFull
                    && rightInfo.isCBT && leftInfo.height == rightInfo.height) {
                isCBT = true;
            }

        }
    }
    return new Info(isFull, isCBT, height);
}
```

# 4.二叉树最大距离

节点距离：用最精简的走法从一个节点走到另一个节点经过的节点数（包含开始结束节点）

对于节点x最大距离有三种可能性，其中最大值即x最大距离：
1. x左树最大距离
2. x右树最大距离
3. x左树与x最远（左树高度） + x右树与x最远（x右树高度） + 1

```java
// 递归实现
public static int maxDistance2(Node head) {
    return process(head).maxDistance;
}

public static class Info {
    public int maxDistance;
    public int height;

    public Info(int m, int h) {
        maxDistance = m;
        height = h;
    }
}

public static Info process(Node x) {
    if (x == null) {
        return new Info(0, 0);
    }
    Info leftInfo = process(x.left);
    Info rightInfo = process(x.right);
    int height = Math.max(leftInfo.height, rightInfo.height) + 1;
    int p1 = leftInfo.maxDistance;
    int p2 = rightInfo.maxDistance;
    int p3 = leftInfo.height + rightInfo.height + 1;
    int maxDistance = Math.max(Math.max(p1, p2), p3);
    return new Info(maxDistance, height);
}
```

# 5.判断二叉树是否是满二叉树

满二叉树：二叉树每一个层的节点数都达到最大值，也就是说，如果二叉树的高度为 h，则结点总数是 2^h - 1。

```java
// 递归实现，第一种方法
// 收集整棵树的高度h，节点数n
// 2 ^ h - 1 == n -> 整棵树是满的
public static boolean isFull1(Node head) {
    if (head == null) {
        return true;
    }
    Info1 all = process1(head);
    return (1 << all.height) - 1 == all.nodes;
}

public static class Info1 {
    public int height;
    public int nodes;

    public Info1(int h, int n) {
        height = h;
        nodes = n;
    }
}

public static Info1 process1(Node head) {
    if (head == null) {
        return new Info1(0, 0);
    }
    Info1 leftInfo = process1(head.left);
    Info1 rightInfo = process1(head.right);
    int height = Math.max(leftInfo.height, rightInfo.height) + 1;
    int nodes = leftInfo.nodes + rightInfo.nodes + 1;
    return new Info1(height, nodes);
}

// 递归实现，第二种方法
// 收集子树是否是满二叉树，子树的高度
// 左树满 && 右树满 && 左右树高度一样 -> 整棵树是满的
public static boolean isFull2(Node head) {
    if (head == null) {
        return true;
    }
    return process2(head).isFull;
}

public static class Info2 {
    public boolean isFull;
    public int height;

    public Info2(boolean f, int h) {
        isFull = f;
        height = h;
    }
}

public static Info2 process2(Node h) {
    if (h == null) {
        return new Info2(true, 0);
    }
    Info2 leftInfo = process2(h.left);
    Info2 rightInfo = process2(h.right);
    boolean isFull = leftInfo.isFull && rightInfo.isFull && leftInfo.height == rightInfo.height;
    int height = Math.max(leftInfo.height, rightInfo.height) + 1;
    return new Info2(isFull, height);
}
```

# 6.最大搜索二叉子树大小（LeetCode 333.）

要求找到给定二叉树中所有BST子树节点数最大的子树。

对于任意节点x，要得到maxBSTSize，解题思路：

如果x不做头，需要比较：
1. x左树maxBSTSize
2. x右树maxBSTSize

如果x做头，需要判断：
1. 左树是否是BST
2. 右树是否是BST
3. 左树最大值 < x
4. 右树最小值 > x
5. 左树size + 右树size + 1

合并，递归实现对于每个节点需要：
1. maxBSTSize，当前子树最大搜索二叉子树大小
2. max，当前子树中最大值
3. min，当前子树中最小值
4. size，当前子树节点数（maxBSTSize == size，子树本身是BST）

```java
public static int largestBSTSubtree(Node head) {
    if (head == null) {
        return 0;
    }
    return process(head).maxBSTSubtreeSize;
}

public static class Info {
    public int maxBSTSubtreeSize;
    public int allSize;
    public int max;
    public int min;

    public Info(int m, int a, int ma, int mi) {
        maxBSTSubtreeSize = m;
        allSize = a;
        max = ma;
        min = mi;
    }
}

public static Info process(Node x) {
    if (x == null) {
        return null;
    }
    Info leftInfo = process(x.left);
    Info rightInfo = process(x.right);
    int max = x.val;
    int min = x.val;
    int allSize = 1;
    if (leftInfo != null) {
        max = Math.max(leftInfo.max, max);
        min = Math.min(leftInfo.min, min);
        allSize += leftInfo.allSize;
    }
    if (rightInfo != null) {
        max = Math.max(rightInfo.max, max);
        min = Math.min(rightInfo.min, min);
        allSize += rightInfo.allSize;
    }
    int p1 = -1;
    if (leftInfo != null) {
        p1 = leftInfo.maxBSTSubtreeSize;
    }
    int p2 = -1;
    if (rightInfo != null) {
        p2 = rightInfo.maxBSTSubtreeSize;
    }
    int p3 = -1;
    // 左子树是否是搜索二叉树
    boolean leftBST = leftInfo == null ? true : (leftInfo.maxBSTSubtreeSize == leftInfo.allSize);
    // 右子树是否是搜索二叉树
    boolean rightBST = rightInfo == null ? true : (rightInfo.maxBSTSubtreeSize == rightInfo.allSize);
    if (leftBST && rightBST) {
        boolean leftMaxLessX = leftInfo == null ? true : (leftInfo.max < x.val);
        boolean rightMinMoreX = rightInfo == null ? true : (x.val < rightInfo.min);
        if (leftMaxLessX && rightMinMoreX) { // 当前树是搜索二叉树
            int leftSize = leftInfo == null ? 0 : leftInfo.allSize;
            int rightSize = rightInfo == null ? 0 : rightInfo.allSize;
            p3 = leftSize + rightSize + 1;
        }
    }
    return new Info(Math.max(p1, Math.max(p2, p3)), allSize, max, min);
}
```

# 7.最大搜索二叉子树头结点

此题是上一题的变种，要求找到给定二叉树中所有BST子树节点数最大的子树的头结点。

对于任意节点x，要得到maxBSTHead，解题思路：

如果x不做头，需要比较maxBSTSize得到maxBSTHead：
1. x左树maxBSTSize，maxBSTHead
2. x右树maxBSTSize，maxBSTHead

如果x做头，需要判断：
1. 左树是否是BST
2. 右树是否是BST
3. 左树最大值 < x
4. 右树最小值 > x
5. 左树size + 右树size + 1

合并，递归实现对于每个节点需要：
1. maxBSTSize，当前子树最大搜索二叉子树大小
2. max，当前子树中最大值
3. min，当前子树中最小值
4. maxSubBSTHead，最大搜索子树头节点（maxSubBSTHead == x.left/right，子树本身是BST）

```java
public static Node maxSubBSTHead(Node head) {
	if (head == null) {
		return null;
	}
	return process(head).maxSubBSTHead;
}

public static class Info {
	public Node maxSubBSTHead;
	public int maxSubBSTSize;
	public int min;
	public int max;

	public Info(Node h, int size, int mi, int ma) {
		maxSubBSTHead = h;
		maxSubBSTSize = size;
		min = mi;
		max = ma;
	}
}

public static Info process(Node X) {
	if (X == null) {
		return null;
	}
	Info leftInfo = process(X.left);
	Info rightInfo = process(X.right);
	int min = X.value;
	int max = X.value;
	Node maxSubBSTHead = null;
	int maxSubBSTSize = 0;
	if (leftInfo != null) {
		min = Math.min(min, leftInfo.min);
		max = Math.max(max, leftInfo.max);
		maxSubBSTHead = leftInfo.maxSubBSTHead;
		maxSubBSTSize = leftInfo.maxSubBSTSize;
	}
	if (rightInfo != null) {
		min = Math.min(min, rightInfo.min);
		max = Math.max(max, rightInfo.max);
		if (rightInfo.maxSubBSTSize > maxSubBSTSize) {
			maxSubBSTHead = rightInfo.maxSubBSTHead;
			maxSubBSTSize = rightInfo.maxSubBSTSize;
		}
	}
	if ((leftInfo == null ? true : (leftInfo.maxSubBSTHead == X.left && leftInfo.max < X.value))
	        && (rightInfo == null ? true : (rightInfo.maxSubBSTHead == X.right && rightInfo.min > X.value))) {
		maxSubBSTHead = X;
		maxSubBSTSize = (leftInfo == null ? 0 : leftInfo.maxSubBSTSize)
		                + (rightInfo == null ? 0 : rightInfo.maxSubBSTSize) + 1;
	}
	return new Info(maxSubBSTHead, maxSubBSTSize, min, max);
}
```

# 8.二叉树任意两节点最低公共祖先

给定一棵二叉树的头结点head，以及另外两个节点a和b，要求返回a和b的最低公共祖先。

解题思路：

递归套路情况分析：

与x无关，x不是最低汇聚点：
1. 左树上汇聚
2. 右树上汇聚
3. a，b不全

与x有关，x是汇聚点：
1. a，b分别在左右树
2. x本身就是a，b在左树或右树
3. x本身就是b，a在左树或右树

合并，递归实现对于每个节点需要：
1. 是否发现a
2. 是否发现b
3. 是否是汇聚点

```java
public static Node lowestAncestor(Node head, Node a, Node b) {
	return process(head, a, b).ans;
}

public static class Info {
	public boolean findA;
	public boolean findB;
	public Node ans;

	public Info(boolean fA, boolean fB, Node an) {
		findA = fA;
		findB = fB;
		ans = an;
	}
}

public static Info process(Node x, Node a, Node b) {
	if (x == null) {
		return new Info(false, false, null);
	}
	Info leftInfo = process(x.left, a, b);
	Info rightInfo = process(x.right, a, b);
	boolean findA = (x == a) || leftInfo.findA || rightInfo.findA;
	boolean findB = (x == b) || leftInfo.findB || rightInfo.findB;
	Node ans = null;
	if (leftInfo.ans != null) {
		ans = leftInfo.ans;
	} else if (rightInfo.ans != null) {
		ans = rightInfo.ans;
	} else {
		if (findA && findB) {
			ans = x;
		}
	}
	return new Info(findA, findB, ans);
}
```

# 9.派对的最大快乐值

在全公司中邀请员工参加派对，每个员工能带来的快乐值不一，在不能同时邀请上下级的情况下，返回整个派对能获得的最大快乐值。

员工定义如下：

```java
class Employee {
    public int happy; // 当前员工可以带来的快乐值
    public List<Employee> nexts; // 当前员工直属下级
}
```

题目分析：
1. 公司员工本身是一棵多叉树
2. 从多叉树中挑选节点
3. 不能同时选择父子节点
4. 要求挑选节点累加值最大

递归套路，解题思路：

对于任意节点x：
- 如果选择x，x 最大累加值 = x.happy + sum(x 每一个子节点不被选择的最大累加值)
- 如果不选择x，x 最大累计值 = 0 + sum(max(x 每一个子节点被选择的最大累加值, x 每一个子节点不被选择的最大累加值))

合并，对于每个节点需要以下信息：
1. 选择当前节点的最大累加值
2. 不选择当前节点的最大累加值

```java
public static int maxHappy(Employee head) {
    Info allInfo = process(head);
    return Math.max(allInfo.no, allInfo.yes);
}

public static class Info {
    public int no;
    public int yes;

    public Info(int n, int y) {
        no = n;
        yes = y;
    }
}

public static Info process(Employee x) {
    if (x == null) {
        return new Info(0, 0);
    }
    int no = 0;
    int yes = x.happy;
    for (Employee next : x.nexts) {
        Info nextInfo = process(next);
        no += Math.max(nextInfo.no, nextInfo.yes);
        yes += nextInfo.no;

    }
    return new Info(no, yes);
}
```