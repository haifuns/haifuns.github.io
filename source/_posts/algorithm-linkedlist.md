title: 【算法基础】链表专练
author: haifun
tags:
  - 算法
  - 链表
categories:
  - 算法
date: 2022-07-25 20:00:00

---

链表解题方法论：

1. 对于笔试，不用太在乎空间复杂度，一切为了时间复杂度
2. 对于面试，时间复杂度第一位，但一定要找到空间最省的方法

链表题目常用数据结构和技巧：

1. 使用容器（哈希表、数组）
2. 快慢指针

# 快慢指针练习

1. 输入链表头结点，如果奇数长度返回中点，如果偶数长度返回上中点
2. 输入链表头结点，如果奇数长度返回中点，如果偶数长度返回下中点
3. 输入链表头结点，如果奇数长度返回中点前一个节点，如果偶数长度返回上中点前一个节点
4. 输入链表头结点，如果奇数长度返回中点前一个节点，如果偶数长度返回下中点前一个节点

```java
public static class Node {
    public int value;
    public Node next;

    public Node(int val) {
        this.value = val;
    }
}

// 中点或上中点
public static Node midOrUpMidNode(Node head) {
    if (head == null || head.next == null || head.next.next == null) {
        return head;
    }

    // 当快指针到尾部时慢指针在中点或上中点位置
    Node slow = head.next;
    Node fast = head.next.next;
    while (fast.next != null && fast.next.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }

    return slow;
}

// 中点或下中点
public static Node midOrDownMidNode(Node head) {
    if (head == null || head.next == null) {
        return head;
    }
    Node slow = head.next;
    Node fast = head.next;
    while (fast.next != null && fast.next.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    return slow;
}

// 中点或上中点前一个节点
public static Node midOrUpMidPreNode(Node head) {
    if (head == null || head.next == null || head.next.next == null) {
        return null;
    }
    Node slow = head;
    Node fast = head.next.next;
    while (fast.next != null && fast.next.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    return slow;
}

// 中点或下中点前一个节点
public static Node midOrDownMidPreNode(Node head) {
    if (head == null || head.next == null) {
        return null;
    }
    if (head.next.next == null) {
        return head;
    }
    Node slow = head;
    Node fast = head.next;
    while (fast.next != null && fast.next.next != null) {
        slow = slow.next;
        fast = fast.next.next;
    }
    return slow;
}
```

# 1.判断链表是否是回文结构（LeetCode 234. easy）

```java
public static class Node {
    public int value;
    public Node next;

    public Node(int val) {
        this.value = val;
    }
}

// 利用容器，额外空间n
public static boolean isPalindrome1(Node head) {
    Stack<Node> stack = new Stack<Node>();
    Node cur = head;
    while (cur != null) {
        stack.push(cur); // 全部压到栈中
        cur = cur.next;
    }
    while (head != null) {
        if (head.value != stack.pop().value) { // 重新遍历链表，同时从栈中弹出比较
            return false;
        }
        head = head.next;
    }
    return true;
}

// 快慢指针+容器，额外空间n/2
public static boolean isPalindrome2(Node head) {
    if (head == null || head.next == null) {
        return true;
    }
    Node right = head.next;
    Node cur = head.next;
    while (cur.next != null && cur.next.next != null) {
        right = right.next;
        cur = cur.next.next;
    }

    // right中点或下中点

    Stack<Node> stack = new Stack<Node>();
    while (right != null) {
        stack.push(right); // 中点后的节点压入栈中，只压入一半
        right = right.next;
    }
    while (!stack.isEmpty()) {
        if (head.value != stack.pop().value) { // 遍历链表，同时从栈中弹出比较
            return false;
        }
        head = head.next;
    }
    return true;
}

// 快慢指针，不需要额外空间
// 找到中点，反转右侧，从两边遍历比较，完成后反转恢复链表
public static boolean isPalindrome3(Node head) {
    if (head == null || head.next == null) {
        return true;
    }
    Node n1 = head.next;
    Node n2 = head.next;
    while (n2.next != null && n2.next.next != null) {
        n1 = n1.next;
        n2 = n2.next.next;
    }

    // n1中点或下中点

    n2 = n1.next; // 中点下一个节点
    n1.next = null; // 中点next设为空

    // 反转后半段链表，最后指向中点
    Node n3 = null;
    while (n2 != null) {
        n3 = n2.next;
        n2.next = n1;
        n1 = n2;
        n2 = n3;
    }

    n3 = n1; // 原链表最后一个节点
    n2 = head;// 原链表头
    boolean res = true;
    while (n1 != null && n2 != null) { // 从两头遍历比较
        if (n1.value != n2.value) {
            res = false;
            break;
        }
        n1 = n1.next; // 左 -> 中点
        n2 = n2.next; // 右 -> 中点
    }

    n1 = n3.next; // 原链表倒数第二个节点
    n3.next = null;
    while (n1 != null) { // 反转后半段链表，恢复原始链表
        n2 = n1.next;
        n1.next = n3;
        n3 = n1;
        n1 = n2;
    }
    return res;
}
```

另一道题同样的解题思路，找中点，反转链表：
一个链表有偶数个节点，编号L1->L2->L3->L4->R1->R2->R3->R4，要求返回L1->R4->L2->R3->L3->R2->L4->R1

# 2.按左边小、中间相等、右边大分隔链表（LeetCode 86. medium，相似）

1. 把链表放到数组里，在数组上做partition（笔试用）
2. 分成小中大三部分，再把各个部分串起来（面试用）

```java
public static class Node {
    public int value;
    public Node next;

    public Node(int val) {
        this.value = val;
    }
}

// 利用容器实现，放到数组做partition
public static Node listPartition1(Node head, int pivot) {
    if (head == null) {
        return head;
    }
    Node cur = head;
    int i = 0;
    while (cur != null) {
        i++;
        cur = cur.next;
    }
    Node[] nodeArr = new Node[i];
    i = 0;
    cur = head;
    for (i = 0; i != nodeArr.length; i++) { // 放到数组里
        nodeArr[i] = cur;
        cur = cur.next;
    }
    arrPartition(nodeArr, pivot); // 分区
    for (i = 1; i != nodeArr.length; i++) { // 恢复链表
        nodeArr[i - 1].next = nodeArr[i];
    }
    nodeArr[i - 1].next = null;
    return nodeArr[0];
}

public static void arrPartition(Node[] nodeArr, int pivot) {
    int small = -1; // 小于区域右边界
    int big = nodeArr.length; // 大于区域左边界
    int index = 0;
    while (index != big) {
        if (nodeArr[index].value < pivot) {
            swap(nodeArr, ++small, index++); // 小于交换当前节点与小于区域最右+1交换，交换过来的值不会大于pivot，直接判断下一个
        } else if (nodeArr[index].value == pivot) {
            index++; // 等于直接判断下一个
        } else {
            swap(nodeArr, --big, index); // 大于与大于区域左-1交换，交换完不需要移动，接着判断交换过来的节点
        }
    }
}

public static void swap(Node[] nodeArr, int a, int b) {
    Node tmp = nodeArr[a];
    nodeArr[a] = nodeArr[b];
    nodeArr[b] = tmp;
}

// 不用额外空间实现
public static Node listPartition2(Node head, int pivot) {
    Node sH = null; // small head，小于区域头节点
    Node sT = null; // small tail，小于区域尾节点
    Node eH = null; // equal head，等于区域头节点
    Node eT = null; // equal tail，等于区域尾节点
    Node mH = null; // big head，大于区域头节点
    Node mT = null; // big tail，大于区域尾节点
    Node next = null; // 下一个要处理的节点
    // 遍历链表，将所有节点分别放到小于等于大于三个区域
    while (head != null) {
        next = head.next;
        head.next = null;
        if (head.value < pivot) { // 小于
            if (sH == null) {
                sH = head; // 如果头为空，头尾都指向当前节点
                sT = head;
            } else {
                sT.next = head; // 头不是空，当前节点链到尾部
                sT = head;
            }
        } else if (head.value == pivot) { // 等于
            if (eH == null) {
                eH = head; // 如果头为空，头尾都指向当前节点
                eT = head;
            } else {
                eT.next = head; // 头不是空，当前节点链到尾部
                eT = head;
            }
        } else { // 大于
            if (mH == null) {
                mH = head; // 如果头为空，头尾都指向当前节点
                mT = head;
            } else {
                mT.next = head; // 头不是空，当前节点链到尾部
                mT = head;
            }
        }
        head = next;
    }

    // 开始串联三个部分，小于区域的尾巴，连等于区域的头，等于区域的尾巴连大于区域的头
    if (sT != null) { // 如果有小于区域
        sT.next = eH;
        eT = eT == null ? sT : eT; // 下一步，谁去连大于区域的头，谁就变成eT
    }
    // 下一步，一定是需要用eT 去接 大于区域的头
    // 有等于区域，eT -> 等于区域的尾结点
    // 无等于区域，eT -> 小于区域的尾结点
    // eT 尽量不为空的尾巴节点
    if (eT != null) { // 如果小于区域和等于区域，不是都没有
        eT.next = mH;
    }
    return sH != null ? sH : (eH != null ? eH : mH);
}
```

# 3.复制带随机指针的链表（LeetCode 138. medium）

链表节点有一个新增的指针，该指针可以指向链表中的任何节点或空节点。
给定一个此类节点组成的无环单链表头节点，要求实现链表的复制，返回新链表头节点。

要求时间复杂度O(N)，额外空间复杂度O(1)。

```java
public static class Node {
    int val;
    Node next;
    Node random;

    public Node(int val) {
        this.val = val;
        this.next = null;
        this.random = null;
    }
}

// 利用额外容器
public static Node copyRandomList1(Node head) {
    // key 老节点 -> value 新节点
    Map<Node, Node> map = new HashMap<Node, Node>();
    Node cur = head;
    while (cur != null) {
        map.put(cur, new Node(cur.val));
        cur = cur.next;
    }
    cur = head;
    while (cur != null) {
        // cur cur.next cur.random 老
        // get(cur) get(cur.next) get(cur.random) 新
        map.get(cur).next = map.get(cur.next);
        map.get(cur).random = map.get(cur.random);
        cur = cur.next;
    }
    return map.get(head);
}

// 不利用额外空间
public static Node copyRandomList2(Node head) {
    if (head == null) {
        return null;
    }
    Node cur = head;
    Node next = null;
    // 在链表基础上复制
    // 1 -> 2 -> 3 -> null
    // 1 -> 1' -> 2 -> 2' -> 3 -> 3'
    while (cur != null) {
        next = cur.next;
        cur.next = new Node(cur.val);
        cur.next.next = next;
        cur = next;
    }
    cur = head;
    Node copy = null;
    // 1 1' 2 2' 3 3'
    // 依次设置 1' 2' 3' random指针
    while (cur != null) {
        next = cur.next.next;
        copy = cur.next;
        copy.random = cur.random != null ? cur.random.next : null;
        cur = next;
    }
    Node res = head.next;
    cur = head;
    // next方向上老新混在一起，random正确
    // next方向上，把新老链表分离
    while (cur != null) {
        next = cur.next.next;
        copy = cur.next;
        cur.next = next;
        copy.next = next != null ? next.next : null;
        cur = next;
    }
    return res;
}
```

# 4.链表相交（LeetCode 160. 141. 142. easy，相似）

给定两个可能有环也可能无环的单链表的头结点head1和head2，请找出两个链表相交的第一个节点，如果不存在返回null。

要求时间复杂度O(N)，空间复杂度O(1)。

```java
public static class Node {
    public int value;
    public Node next;

    public Node(int value) {
        this.value = value;
    }
}

public static Node getIntersectNode(Node head1, Node head2) {
    if (head1 == null || head2 == null) {
        return null;
    }
    // 链表1入环节点
    Node loop1 = getLoopNode(head1);
    // 链表2入环节点
    Node loop2 = getLoopNode(head2);
    if (loop1 == null && loop2 == null) {
        return noLoop(head1, head2); // 都不为环
    }
    if (loop1 != null && loop2 != null) {
        return bothLoop(head1, loop1, head2, loop2); // 都是环
    }
    return null; // 一个是环一个不是环一定不相交
}

// 给定一个链表的头节点，返回第一个入环节点，如果没有环，则返回null
public static Node getLoopNode(Node head) {
    if (head == null || head.next == null || head.next.next == null) {
        return null;
    }

    // 快慢指针
    Node slow = head.next;
    Node fast = head.next.next;
    // 移动快慢指针到相遇
    while (slow != fast) {
        if (fast.next == null || fast.next.next == null) {
            // 无环，直接退出
            return null;
        }
        slow = slow.next;
        fast = fast.next.next;
    }

    // 当相遇时，快指针重新从头节点开始一步一步移动，慢指针继续移动，最终会在入环位置相遇
    // 推导过程可参考leetcode142题解
    fast = head;
    while (slow != fast) {
        slow = slow.next;
        fast = fast.next;
    }
    return slow;
}

// 如果两个链表都无环，返回第一个相交节点，如果不相交返回null
// 丢弃长链表更长的部分，遍历长度相同的两个链表，相同的节点就是相交位置
public static Node noLoop(Node head1, Node head2) {
    if (head1 == null || head2 == null) {
        return null;
    }

    Node cur1 = head1;
    Node cur2 = head2;
    int sum = 0;
    while (cur1.next != null) {
        sum++; // 累计cur1的长度
        cur1 = cur1.next;
    }
    while (cur2.next != null) {
        sum--; // 减掉cur2的长度
        cur2 = cur2.next;
    }

    // sum的绝对值为长链表-短链表的长度

    // 遍历到结尾都不相等，则表示不相交
    // 两个链表相交末尾节点一定是同一个
    if (cur1 != cur2) {
        return null;
    }

    // 长链表
    cur1 = sum > 0 ? head1 : head2;
    // 短链表
    cur2 = cur1 == head1 ? head2 : head1;
    sum = Math.abs(sum);
    while (sum != 0) {
        sum--;
        cur1 = cur1.next; // 移动长链表，放弃更长的部分
    }
    while (cur1 != cur2) { // 同时遍历两个链表找到相同的位置
        cur1 = cur1.next;
        cur2 = cur2.next;
    }
    return cur1;
}

// 两个链表都有环
public static Node bothLoop(Node head1, Node loop1, Node head2, Node loop2) {
    Node cur1 = null;
    Node cur2 = null;
    if (loop1 == loop2) { // 入环位置已经相交，第一个相交位置在入环前或者入环位置
        cur1 = head1; // 从头节点到入环位置判断相交，处理方式同无环
        cur2 = head2;
        int n = 0;
        while (cur1 != loop1) {
            n++;
            cur1 = cur1.next;
        }
        while (cur2 != loop2) {
            n--;
            cur2 = cur2.next;
        }
        cur1 = n > 0 ? head1 : head2;
        cur2 = cur1 == head1 ? head2 : head1;
        n = Math.abs(n);
        while (n != 0) {
            n--;
            cur1 = cur1.next;
        }
        while (cur1 != cur2) {
            cur1 = cur1.next;
            cur2 = cur2.next;
        }
        return cur1;
    } else { // 入环位置没有相交，要么链表没有相交，要么在环其他位置相交
        cur1 = loop1.next;
        while (cur1 != loop1) { // 两个链表在环其他位置相交
            if (cur1 == loop2) {
                return loop1;
            }
            cur1 = cur1.next;
        }
        return null; // 两个链表有环但是不相交
    }

}
```
