title: 【算法基础】二叉树专练（一）
author: haifun
tags:
  - 算法
  - 二叉树
categories:
  - 算法
date: 2022-07-30 23:20:00

---

# 1.将 N 叉树编码为二叉树（LeetCode 431. hard）

设计一个算法，可以将 N 叉树编码为二叉树，并能将该二叉树解码为原 N 叉树。

解题思路：对于任意节点a，将其所有子节点放在左子树的右边界上。如下图所示：

![image](https://img.haifuns.com/md/img/EncodeNaryTreeToBinaryTree.png)

```java
// N叉树
public static class Node {
    public int val;
    public List<Node> children;

    public Node() {
    }

    public Node(int _val) {
        val = _val;
    }

    public Node(int _val, List<Node> _children) {
        val = _val;
        children = _children;
    }
};

// 二叉树
public static class TreeNode {
    int val;
    TreeNode left;
    TreeNode right;

    TreeNode(int x) {
        val = x;
    }
}

class Codec {
    // N叉树编码为二叉树
    public TreeNode encode(Node root) {
        if (root == null) {
            return null;
        }
        TreeNode head = new TreeNode(root.val);
        head.left = en(root.children);
        return head;
    }

    private TreeNode en(List<Node> children) {
        TreeNode head = null;
        TreeNode cur = null;
        for (Node child : children) {
            TreeNode tNode = new TreeNode(child.val);
            if (head == null) {
                head = tNode; // 第一个子节点
            } else {
                cur.right = tNode; // 同级节点在右边界串联
            }
            cur = tNode;
            cur.left = en(child.children); // 深度优先，同级节点经过右边界串联后挂在父节点左子节点上
        }
        return head;
    }

    // 二叉树解码为N叉树
    public Node decode(TreeNode root) {
        if (root == null) {
            return null;
        }
        return new Node(root.val, de(root.left));
    }

    public List<Node> de(TreeNode root) {
        List<Node> children = new ArrayList<>();
        while (root != null) {
            Node cur = new Node(root.val, de(root.left)); // 深度优先
            children.add(cur); // 汇总所有右边界上的同级子节点
            root = root.right;
        }
        return children;
    }
}
```

# 2.求二叉树最宽的层有多少个节点

```java
// 利用容器，表记录节点层数
public static int maxWidthUseMap(Node head) {
	if (head == null) {
		return 0;
	}
	Queue<Node> queue = new LinkedList<>();
	queue.add(head);
	// key 在 哪一层，value
	Map<Node, Integer> levelMap = new HashMap<>();
	levelMap.put(head, 1);
	int curLevel = 1; // 当前正在统计哪一层的宽度，层数
	int curLevelNodes = 0; // 当前层curLevel层，宽度目前是多少
	int max = 0;
	while (!queue.isEmpty()) {
		Node cur = queue.poll();
		int curNodeLevel = levelMap.get(cur);
		if (cur.left != null) {
			levelMap.put(cur.left, curNodeLevel + 1);
			queue.add(cur.left);
		}
		if (cur.right != null) {
			levelMap.put(cur.right, curNodeLevel + 1);
			queue.add(cur.right);
		}
		if (curNodeLevel == curLevel) {
			curLevelNodes++;
		} else {
			max = Math.max(max, curLevelNodes);
			curLevel++;
			curLevelNodes = 1;
		}
	}
	max = Math.max(max, curLevelNodes);
	return max;
}

// 不用容器
public static int maxWidthNoMap(Node head) {
	if (head == null) {
		return 0;
	}
	Queue<Node> queue = new LinkedList<>();
	queue.add(head);
	Node curEnd = head; // 当前层，最右节点
	Node nextEnd = null; // 下一层，最右节点
	int max = 0;
	int curLevelNodes = 0; // 当前层的节点数
	while (!queue.isEmpty()) {
		Node cur = queue.poll();
		if (cur.left != null) {
			queue.add(cur.left);
			nextEnd = cur.left;
		}
		if (cur.right != null) {
			queue.add(cur.right);
			nextEnd = cur.right;
		}
		curLevelNodes++;
		if (cur == curEnd) {
			max = Math.max(max, curLevelNodes);
			curLevelNodes = 0;
			curEnd = nextEnd;
		}
	}
	return max;
}
```

# 3.找到二叉树的后继节点

二叉树结构定义如下：

```java
public static class Node {
	public int value;
	public Node left;
	public Node right;
	public Node parent;

	public Node(int data) {
		this.value = data;
	}
}
```
要求给定一个二叉树节点，返回此节点的后继节点。

```java
public static Node getSuccessorNode(Node node) {
	if (node == null) {
		return node;
	}
	if (node.right != null) { // 有右子树
		return getLeftMost(node.right); // 找右子树中最左的节点
	} else { // 无右子树
		Node parent = node.parent;
		while (parent != null && parent.right == node) { // 当前节点是其父亲节点右孩子
			node = parent;
			parent = node.parent;
		} // 结束时，父节点为空，或者当前节点是父节点的左孩子
		return parent;
	}
}

public static Node getLeftMost(Node node) {
	if (node == null) {
		return node;
	}
	while (node.left != null) {
		node = node.left;
	}
	return node;
}
```

# 4.打印纸条折痕问题

请把一张纸条竖着放在桌子上，然后从纸条的下边向上方对折1次，压出折痕后展开。此时折痕是凹下去的，即折痕突起的方向指向纸条的背面。如果从纸条的下边向上方连续对折2次，压出折痕后展开，此时有三条折痕，从上到下依次是下折痕、下折痕和上折痕。

给定一个输入参数N，代表纸条都从下边向上方连续对折N次，请从上到下打印所有折痕的方向。

解题思路：实际折一下，每次对折后给新折痕上标记是第几次对折以及是凹还是凸。
模拟对折几次可以发现，每次对折都是在上一次的每条折痕前新增一条凹折痕，后新增一条凸折痕，形成一个二叉树，折痕的打印即二叉树中序遍历。
如下图所示：

![image](https://img.haifuns.com/md/img/BinaryTree_PaperFolding.png)

```java
public static void printAllFolds(int N) {
	process(1, N, true); // 根节点是凹痕
	System.out.println();
}

// 中序打印整棵树，i是当前层，N是总层数
public static void process(int i, int N, boolean down) {
	if (i > N) {
		return;
	}
	process(i + 1, N, true); // 左节点凹痕
	System.out.print(down ? "凹 " : "凸 ");
	process(i + 1, N, false); // 右节点凸痕
}
```