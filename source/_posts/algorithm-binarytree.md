title: 【算法基础】二叉树
author: haifun
tags:
  - 算法
  - 二叉树
categories:
  - 算法
date: 2022-07-30 23:00:00

---

二叉树（binary tree）是指树中节点的度不大于2的有序树，它是一种最简单且最重要的树。二叉树的递归定义为：二叉树是一棵空树，或者是一棵由一个根节点和两棵互不相交的，分别称作根的左子树和右子树组成的非空树；左子树和右子树又同样都是二叉树。

二叉树节点结构：

```java
public static class Node {
    public int value;
    public Node left;
    public Node right;

    public Node(int v) {
        value = v;
    }
}
```


# 二叉树的遍历

## 递归实现

- 先序遍历：任何子树的处理顺序都是先头结点、再左子树、然后右子树
- 中序遍历：任何子树的处理顺序都是先左子树、再头结点、然后右子树
- 后序遍历：任何子树的处理顺序都是先左子树、再右子树、然后头结点

三种遍历方式本质上都是递归序，先序、中序、后序都是在递归序的基础上加工而来。
递归序中每个节点总能到达三次，第一次到达一个节点就打印就是先序、第二次打印是中序、第三次打印是后序。

```java
// 先序打印所有节点
public static void pre(Node head) {
    if (head == null) {
        return;
    }
    System.out.println(head.value);
    pre(head.left);
    pre(head.right);
}

// 中序打印所有节点
public static void in(Node head) {
    if (head == null) {
        return;
    }
    in(head.left);
    System.out.println(head.value);
    in(head.right);
}

// 后序打印所有节点
public static void pos(Node head) {
    if (head == null) {
        return;
    }
    pos(head.left);
    pos(head.right);
    System.out.println(head.value);
}
```

## 非递归实现

```java
public static class Node {
  public int value;
  public Node left;
  public Node right;

  public Node(int v) {
    value = v;
  }
}

// 栈实现先序
public static void pre(Node head) {
  System.out.print("pre-order: ");
  if (head != null) {
    Stack<Node> stack = new Stack<Node>();
    stack.add(head);
    while (!stack.isEmpty()) {
      head = stack.pop(); // 弹出最左
      System.out.print(head.value + " ");
      if (head.right != null) { // 先压入右子节点，后压入左子节点
        stack.push(head.right);
      }
      if (head.left != null) {
        stack.push(head.left);
      }
    }
  }
  System.out.println();
}

// 栈实现中序
public static void in(Node cur) {
  System.out.print("in-order: ");
  if (cur != null) {
    Stack<Node> stack = new Stack<Node>();
    while (!stack.isEmpty() || cur != null) {
      if (cur != null) {
        stack.push(cur); // 以cur为头的数整条左边界入栈，直到遇到空
        cur = cur.left;
      } else {
        cur = stack.pop(); // 弹出节点打印，弹出节点右孩子设置为cur
        System.out.print(cur.value + " ");
        cur = cur.right;
      }
    }
  }
  System.out.println();
}

// 两个栈实现后序
public static void pos1(Node head) {
  System.out.print("pos-order: ");
  if (head != null) {
    Stack<Node> s1 = new Stack<Node>(); // 先类似先序实现头右左
    Stack<Node> s2 = new Stack<Node>(); // 不打印，栈1压入栈2，得到左右头
    s1.push(head);
    while (!s1.isEmpty()) {
      head = s1.pop(); // 头 右 左
      s2.push(head);
      if (head.left != null) {
        s1.push(head.left);
      }
      if (head.right != null) {
        s1.push(head.right);
      }
    }
    // 左 右 头
    while (!s2.isEmpty()) {
      System.out.print(s2.pop().value + " ");
    }
  }
  System.out.println();
}

// 一个栈实现后序，hard，了解即可
public static void pos2(Node h) {
  System.out.print("pos-order: ");
  if (h != null) {
    Stack<Node> stack = new Stack<Node>();
    stack.push(h);
    Node c = null;
    while (!stack.isEmpty()) {
      c = stack.peek();
      if (c.left != null && h != c.left && h != c.right) {
        stack.push(c.left);
      } else if (c.right != null && h != c.right) {
        stack.push(c.right);
      } else {
        System.out.print(stack.pop().value + " ");
        h = c;
      }
    }
  }
  System.out.println();
}
```

# 二叉树的按层遍历

1. 实际上就是宽度优先遍历，使用队列实现
2. 可以通过设置flag变量的方式来发现某一层的结束[二叉树的按层遍历](#二叉树的遍历)

```java
public static void level(Node head) {
  if (head == null) {
    return;
  }
  Queue<Node> queue = new LinkedList<>();
  queue.add(head); // 压入头节点
  while (!queue.isEmpty()) {
    Node cur = queue.poll(); // 弹出一个节点
    System.out.println(cur.value);
    if (cur.left != null) {
      queue.add(cur.left); // 有左节点压入
    }
    if (cur.right != null) {
      queue.add(cur.right); // 有右节点压入
    }
  }
}
```

# 实现二叉树的序列化和反序列化

1. 先序/后序方式序列化和反序列化
2. 按层方式序列化和反序列化

二叉树无法通过中序遍历的方式实现序列化和反序列化，因为不同的两棵树，可能得到同样的中序序列，即便补了空位置也可能一样。
比如如下两棵树：

```
         __2
        /
       1
       和
       1__
          \
           2
```

补足空位置的中序遍历结果都是{null, 1, null, 2, null}。

```java
// 先序序列化
public static Queue<String> preSerial(Node head) {
  Queue<String> ans = new LinkedList<>();
  pres(head, ans);
  return ans;
}

public static void pres(Node head, Queue<String> ans) {
  if (head == null) {
    ans.add(null);
  } else {
    ans.add(String.valueOf(head.value));
    pres(head.left, ans);
    pres(head.right, ans);
  }
}

// 先序反序列化
public static Node buildByPreQueue(Queue<String> prelist) {
  if (prelist == null || prelist.size() == 0) {
    return null;
  }
  return preb(prelist);
}

public static Node preb(Queue<String> prelist) {
  String value = prelist.poll();
  if (value == null) {
    return null;
  }
  Node head = new Node(Integer.valueOf(value));
  head.left = preb(prelist);
  head.right = preb(prelist);
  return head;
}

// 后序序列化
public static Queue<String> posSerial(Node head) {
  Queue<String> ans = new LinkedList<>();
  poss(head, ans);
  return ans;
}

public static void poss(Node head, Queue<String> ans) {
  if (head == null) {
    ans.add(null);
  } else {
    poss(head.left, ans);
    poss(head.right, ans);
    ans.add(String.valueOf(head.value));
  }
}

// 后序反序列化
public static Node buildByPosQueue(Queue<String> poslist) {
  if (poslist == null || poslist.size() == 0) {
    return null;
  }
  // 左右中 -> stack(中右左)
  Stack<String> stack = new Stack<>();
  while (!poslist.isEmpty()) {
    stack.push(poslist.poll());
  }
  return posb(stack);
}

public static Node posb(Stack<String> posstack) {
  String value = posstack.pop();
  if (value == null) {
    return null;
  }
  Node head = new Node(Integer.valueOf(value));
  head.right = posb(posstack);
  head.left = posb(posstack);
  return head;
}

// 按层序列化
public static Queue<String> levelSerial(Node head) {
  Queue<String> ans = new LinkedList<>();
  if (head == null) {
    ans.add(null);
  } else {
    ans.add(String.valueOf(head.value));
    Queue<Node> queue = new LinkedList<Node>();
    queue.add(head);
    while (!queue.isEmpty()) {
      head = queue.poll();
      if (head.left != null) { // 左子节点，不管是不是空都序列化，不为空放到队列
        ans.add(String.valueOf(head.left.value));
        queue.add(head.left);
      } else {
        ans.add(null);
      }
      if (head.right != null) { // 右节点一样序列化， 不为空放到队列
        ans.add(String.valueOf(head.right.value));
        queue.add(head.right);
      } else {
        ans.add(null);
      }
    }
  }
  return ans;
}

// 按层反序列化
public static Node buildByLevelQueue(Queue<String> levelList) {
  if (levelList == null || levelList.size() == 0) {
    return null;
  }
  Node head = generateNode(levelList.poll());
  Queue<Node> queue = new LinkedList<Node>(); // 类似序列化步骤，用队列遍历
  if (head != null) {
    queue.add(head);
  }
  Node node = null;
  while (!queue.isEmpty()) {
    node = queue.poll();
    node.left = generateNode(levelList.poll());
    node.right = generateNode(levelList.poll());
    if (node.left != null) { // 不为空放到队列
      queue.add(node.left);
    }
    if (node.right != null) {
      queue.add(node.right);
    }
  }
  return head;
}

public static Node generateNode(String val) {
  if (val == null) {
    return null;
  }
  return new Node(Integer.valueOf(val));
}
```

# 工具函数：打印二叉树

```java
// 旋转90度打印
public static void printTree(Node head) {
    System.out.println("Binary Tree:");
    printInOrder(head, 0, "H", 17);
    System.out.println();
}

public static void printInOrder(Node head, int height, String to, int len) {
    if (head == null) {
        return;
    }
    printInOrder(head.right, height + 1, "v", len);
    String val = to + head.value + to;
    int lenM = val.length();
    int lenL = (len - lenM) / 2;
    int lenR = len - lenM - lenL;
    val = getSpace(lenL) + val + getSpace(lenR);
    System.out.println(getSpace(height * len) + val);
    printInOrder(head.left, height + 1, "^", len);
}

public static String getSpace(int num) {
    String space = " ";
    StringBuffer buf = new StringBuffer("");
    for (int i = 0; i < num; i++) {
        buf.append(space);
    }
    return buf.toString();
}
```
