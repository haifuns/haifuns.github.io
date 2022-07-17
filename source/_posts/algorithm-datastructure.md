title: 【算法基础】链表、栈、队列
author: haifun
tags:
  - 算法
  - 数据结构
categories:
  - 算法
date: 2022-06-24 20:00:00

---

# 链表

## 单向链表

```java
public class Node {
    private int value;
    private Node next;

    public Node(int value) {
        this.value = value;
    }
}
```

## 双向链表

```java
public class DoubleNode {
    private int value;
    private DoubleNode last;
    private DoubleNode next;

    public DoubleNode(int value) {
        this.value = value;
    }
}
```

## 1. 链表反转

```java
// 反转单链表
public Node reverseLinkedList(Node head) {

    Node pre = null;
    Node next = null;
    while(head != null) {
        next = head.next;
        head.next = pre;
        pre = head;
        head = next;
    }
    return pre;
}

// 反转双链表
public DoubleNode reverseDoubleLinkedList(DoubleNode head) {

    DoubleNode pre = null;
    DoubleNode next = null;
    while(head != null) {
        next = head.next;
        head.next = pre;
        head.last = next;
        pre = head;
        head = next;
    }
    return pre;
}
```

## 2. 给定值删除

```java
public static Node removeValue(Node head, int num) {
    // 移除头部为指定值的节点
    // 移动head到第一个不需要删除的位置
    while (head != null) {
        if (head.value != num) {
            break;
        }
        head = head.next;
    }

    Node pre = head;
    Node cur = head;
    while (cur != null) {
        if (cur.value == num) {
            pre.next = cur.next; // 将前一个node.next设置为当前这个node的下一个node
        } else {
            pre = cur;
        }
        cur = cur.next;
    }

    return head;
}
```

# 栈和队列

栈：数据先进后出，犹如弹匣
队列：数据先进先出，好似排队

栈和队列的实际实现方式：
- 双向链表实现
- 数组实现

## 1. 双向链表实现栈和队列

```java
public class LinkedListToQueueAndStack {

    public static class Node<V> {

        private V value;

        private Node<V> next;

        public Node(V v) {
            this.value = v;
            next = null;
        }

    }

    public static class MyQueue<V> {

        private Node<V> head;

        private Node<V> tail;

        private int size;

        public boolean isEmpty() {
            return size == 0;
        }

        public int size() {
            return this.size;
        }

        public void offer(V v) {

            Node<V> cur = new Node<V>(v);
            if (tail == null) {
                head = cur;
                tail = cur;
            } else {
                tail.next = cur;
                tail = cur;
            }

            size++;
        }

        public V poll() {
            V ans = null;
            if (head != null) {
                ans = head.value;
                head = head.next;
                size--;
            }

            if (head == null) {
                tail = null;
            }
            return ans;
        }

        public V peek() {
            V ans = null;
            if (head != null) {
                ans = head.value;
            }
            return ans;
        }
    }

    public static class MyStack<V> {

        private Node<V> head;

        private int size;

        public boolean isEmpty() {
            return size == 0;
        }

        public int size() {
            return this.size;
        }

        public void push(V v) {
            Node<V> cur = new Node<V>(v);
            if (head == null) {
                head = cur;
            } else {
                cur.next = head;
                head = cur;
            }
            size++;
        }

        public V pop() {
            V ans = null;
            if (head != null) {
                ans = head.value;
                head = head.next;
                size--;
            }
            return ans;
        }

        public V peek() {
            return head != null ? head.value : null;
        }

    }
}
```

## 2. 数组实现栈和队列

```java
public class ArrayToQueueAndStack {

    /**
     * 循环数组实现队列
     */
    public static class MyQueue {
        private int[] arr;
        private int pushi;// end
        private int polli;// begin
        private int size;
        private final int limit;

        public MyQueue(int limit) {
            arr = new int[limit];
            pushi = 0;
            polli = 0;
            size = 0;
            this.limit = limit;
        }

        public void push(int value) {
            if (size == limit) {
                throw new RuntimeException("队列满了，不能再加了");
            }
            size++;
            arr[pushi] = value;
            pushi = nextIndex(pushi);
        }

        public int poll() {
            if (size == 0) {
                throw new RuntimeException("队列空了，不能再拿了");
            }
            size--;
            int ans = arr[polli];
            polli = nextIndex(polli);
            return ans;
        }

        public boolean isEmpty() {
            return size == 0;
        }

        // 如果现在的下标是i，返回下一个位置
        private int nextIndex(int i) {
            return i < limit - 1 ? i + 1 : 0;
        }

    }

    public static class MyStack {
        private int top = -1; //栈顶
        private int[] arr;
        public MyStack(int length) {
            arr = new int[length];
        }

        public void push(int num) {
            if (top > arr.length - 1) {
                throw new RuntimeException("栈满了，不能再加了");
            }
            arr[++top] = num;
        }
        public int pop() {
            if (top < 0) {
                throw new RuntimeException("栈空了，不能再拿了");
            }
            return arr[top--];
        }
    }

}
```

## 3. 实现一个特殊的栈，在基本功能的基础上，再实现返回栈中最小元素的功能

要求：
1. pop、push、getMin操作的时间复杂度都是O(1)
2. 设计的栈类型可以使用现成的栈结构

思路：
两个栈：数据栈+最小栈
push时，数据栈正常压入，最小栈压入当前最小值
pop时，数据栈弹出返回，最小栈弹出
getMin，最小栈peek

```java
public static class MyStack {
    private Stack<Integer> stackData;
    private Stack<Integer> stackMin;

    public MyStack() {
        this.stackData = new Stack<Integer>();
        this.stackMin = new Stack<Integer>();
    }

    public void push(int newNum) {
        if (this.stackMin.isEmpty()) {
            this.stackMin.push(newNum);
        } else if (newNum < this.getmin()) {
            this.stackMin.push(newNum);
        } else {
            int newMin = this.stackMin.peek();
            this.stackMin.push(newMin);
        }
        this.stackData.push(newNum);
    }

    public int pop() {
        if (this.stackData.isEmpty()) {
            throw new RuntimeException("Your stack is empty.");
        }
        this.stackMin.pop();
        return this.stackData.pop();
    }

    public int getmin() {
        if (this.stackMin.isEmpty()) {
            throw new RuntimeException("Your stack is empty.");
        }
        return this.stackMin.peek();
    }
}
```

## 4. 栈实现队列，队列实现栈

栈实现队列思路：
两个栈实现队列，一个push栈一个pop栈，队列push压入push栈，队列poll从pop弹出
1. 从push栈倒数据到pop栈要一次性倒完
2. pop栈空了才能倒数据

```java
public static class TwoStacksQueue {
    public Stack<Integer> stackPush;
    public Stack<Integer> stackPop;

    public TwoStacksQueue() {
        stackPush = new Stack<Integer>();
        stackPop = new Stack<Integer>();
    }

    // push栈向pop栈倒入数据
    private void pushToPop() {
        if (stackPop.empty()) {
            while (!stackPush.empty()) {
                stackPop.push(stackPush.pop());
            }
        }
    }

    public void add(int pushInt) {
        stackPush.push(pushInt);
        pushToPop();
    }

    public int poll() {
        if (stackPop.empty() && stackPush.empty()) {
            throw new RuntimeException("Queue is empty!");
        }
        pushToPop();
        return stackPop.pop();
    }

    public int peek() {
        if (stackPop.empty() && stackPush.empty()) {
            throw new RuntimeException("Queue is empty!");
        }
        pushToPop();
        return stackPop.peek();
    }
}
```

队列实现栈思路：
两个队列，push进第一个队列，pop时poll第一个队列所有元素，如果是第一个队列最后一个值直接返回，如果不是push进第二个队列

```java
public static class TwoQueueStack<T> {
    public Queue<T> queue;
    public Queue<T> help;

    public TwoQueueStack() {
        queue = new LinkedList<>();
        help = new LinkedList<>();
    }

    public void push(T value) {
        queue.offer(value);
    }

    public T poll() {
        while (queue.size() > 1) {
            help.offer(queue.poll());
        }
        T ans = queue.poll();
        Queue<T> tmp = queue;
        queue = help;
        help = tmp;
        return ans;
    }

    public T peek() {
        while (queue.size() > 1) {
            help.offer(queue.poll());
        }
        T ans = queue.poll();
        help.offer(ans);
        Queue<T> tmp = queue;
        queue = help;
        help = tmp;
        return ans;
    }

    public boolean isEmpty() {
        return queue.isEmpty();
    }

}
```
