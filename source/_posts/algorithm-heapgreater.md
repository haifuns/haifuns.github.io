title: 【算法基础】加强堆
author: haifun
tags:
  - 算法
  - 堆
  - 排序
categories:
  - 算法
date: 2022-07-06 23:20:00

---

加强堆在普通堆的基础上通过建立反向索引表和比较器，额外实现了任意节点更新和任意节点删除的功能。

# 加强堆实现

```java
public class HeapGreater<T> {

    // 堆数组
    private ArrayList<T> heap;
    // 反向索引，增加结构
    private HashMap<T, Integer> indexMap;
    // 堆大小
    private int heapSize;
    // 自定义比较器
    private Comparator<? super T> comp;

    public HeapGreater(Comparator<? super T> c) {
        heap = new ArrayList<>();
        indexMap = new HashMap<>();
        heapSize = 0;
        comp = c;
    }

    public boolean isEmpty() {
        return heapSize == 0;
    }

    public int size() {
        return heapSize;
    }

    public boolean contains(T obj) {
        return indexMap.containsKey(obj);
    }

    public T peek() {
        return heap.get(0);
    }

    public void push(T obj) {
        heap.add(obj);
        indexMap.put(obj, heapSize);
        heapInsert(heapSize++);
    }

    public T pop() {
        T ans = heap.get(0);
        swap(0, heapSize - 1);
        indexMap.remove(ans);
        heap.remove(--heapSize);
        heapify(0);
        return ans;
    }

    // 增加功能，移除任意节点
    public void remove(T obj) {
        // 堆最后位置的节点
        T replace = heap.get(heapSize - 1);
        // 指定节点位置
        int index = indexMap.get(obj);
        // 从反向索引中移除指定节点
        indexMap.remove(obj);
        // 从堆中移除最后一个节点
        heap.remove(--heapSize);
        if (obj != replace) { // 如果指定的不是最后一个节点
            heap.set(index, replace); // 把取出来的原最后节点放到指定位置
            indexMap.put(replace, index); // 更新反向索引
            resign(replace); // 更新指定位置节点，重新建堆
        }
    }

    // 增强功能，任意节点变化后重新建堆
    public void resign(T obj) {
        // 向上移或者向下移，只会执行一个
        heapInsert(indexMap.get(obj));
        heapify(indexMap.get(obj));
    }

    // 返回堆上的所有元素
    public List<T> getAllElements() {
        List<T> ans = new ArrayList<>();
        for (T c : heap) {
            ans.add(c);
        }
        return ans;
    }

    // 上移
    private void heapInsert(int index) {
        while (comp.compare(heap.get(index), heap.get((index - 1) / 2)) < 0) {
            swap(index, (index - 1) / 2);
            index = (index - 1) / 2;
        }
    }

    // 下移
    private void heapify(int index) {
        int left = index * 2 + 1;
        while (left < heapSize) {
            int best = left + 1 < heapSize && comp.compare(heap.get(left + 1), heap.get(left)) < 0 ? (left + 1) : left;
            best = comp.compare(heap.get(best), heap.get(index)) < 0 ? best : index;
            if (best == index) {
                break;
            }
            swap(best, index);
            index = best;
            left = index * 2 + 1;
        }
    }

    private void swap(int i, int j) {
        T o1 = heap.get(i);
        T o2 = heap.get(j);
        heap.set(i, o2);
        heap.set(j, o1);
        indexMap.put(o2, i);
        indexMap.put(o1, j);
    }

}
```

# 1. 前K名购买最多者得奖问题（笔试题）

给定一个整型数组int[] arr和一个布尔类型的数组boolean[] op，两个数组一定等长，假设长度为N，arr[i]表示客户编号，op[i]表示客户操作。

例如：
arr = [3, 3, 1, 2, 1, 2, 5]
op  = [T, T, T, T, F, T, F]
依次表示：3用户购买了一件商品，3用户购买了一件商品，1用户购买了一件商品，2用户购买了一件商品，1用户退货了一件商品，2用户购买了一件商品，5用户退货了一件商品。

得奖系统规则：
1. 如果某个用户购买数量为0，但是又发生了退货时间，则认为该事件无效
2. 用户发生购买商品事件，购买商品数量+1，发生退货事件，购买商品数量-1
3. 每次都是最多K个用户得奖，如果得奖人数不足K个，那就以不够的情况输出结果
4. 得奖系统分为得奖区和候选区，任何用户只要购买数>0，一定在两个区域中的一个
5. 购买数最大的前K名用户进入得奖区，在最初时如果得奖区没有达到K个用户，那就新来的用户直接进入得奖区
6. 购买数不足以进入得奖区的用户进入候选区
7. 如果候选区购买数最多的用户已经足以进入得奖区，该用户就会替换得奖区中购买数最少的用户（大于才能替换）
    - 如果得奖区中购买数最少的用户有多个，就替换最早进入的得奖区的用户
    - 如果候选区中购买数最多的用户有多个，机会给最早进入候选区的用户
8. 候选区和得奖区是两套时间，用户只会在其中一个区域，所有只会有一个区域的时间，另一个没有
    - 从得奖区出来进入候选区的用户，得奖区时间会删除，进入候选区的时间就是当前事件的时间（可以认为是arr[i]和op[i]中的i）
    - 从候选区进入得奖区的用户，候选区时间会删除，进入得奖区的时间就是当前事件的时间（可以认为是arr[i]和op[i]中的i）
9. 如果用户购买数为0，从区域中移除，区域时间也删除，如果用户重新发生购买按照规则进去区域，时间重记

```java
public static class WhosYourDaddy {
    
    private HashMap<Integer, Customer> customers;
    private HeapGreater<Customer> candHeap; // 候选区，大根堆
    private HeapGreater<Customer> daddyHeap; // 得奖区，小根堆
    private final int daddyLimit;

    public WhosYourDaddy(int limit) {
        customers = new HashMap<Integer, Customer>();
        candHeap = new HeapGreater<>(new CandidateComparator());
        daddyHeap = new HeapGreater<>(new DaddyComparator());
        daddyLimit = limit;
    }

    // 当前处理i号事件，arr[i] -> id, buyOrRefund
    // O(N*(logN+logK+K))
    public void operate(int time, int id, boolean buyOrRefund) {
        if (!buyOrRefund && !customers.containsKey(id)) { // 没买东西退款
            return;
        }
        if (!customers.containsKey(id)) { // 新买
            customers.put(id, new Customer(id, 0, 0));
        }
        Customer c = customers.get(id);
        if (buyOrRefund) {
            c.buy++; // 买加商品数量
        } else {
            c.buy--; // 退减商品数量
        }
        if (c.buy == 0) {
            customers.remove(id); // 退没了移除记录
        }
        if (!candHeap.contains(c) && !daddyHeap.contains(c)) { // 不在候选区，不在得将区
            if (daddyHeap.size() < daddyLimit) { // 得奖区没满直接放进去，时间重置
                c.enterTime = time;
                daddyHeap.push(c);
            } else { // 得奖区满了放到候选区，时间重置
                c.enterTime = time;
                candHeap.push(c);
            }
        } else if (candHeap.contains(c)) { // 之前在候选区
            if (c.buy == 0) {
                candHeap.remove(c); // 购买数量是0从候选区移除
            } else {
                candHeap.resign(c); // 数量变化重新建堆
            }
        } else { // 之前在得奖区
            if (c.buy == 0) {
                daddyHeap.remove(c); // 购买数量是0从得奖区移除
            } else {
                daddyHeap.resign(c); // 数量变化重新建堆
            }
        }
        daddyMove(time); // 检查得奖区
    }

    // 中奖人
    public List<Integer> getDaddies() {
        List<Customer> customers = daddyHeap.getAllElements();
        List<Integer> ans = new ArrayList<>();
        for (Customer c : customers) {
            ans.add(c.id);
        }
        return ans;
    }

    private void daddyMove(int time) {
        if (candHeap.isEmpty()) { // 如果候选区空了直接结束
            return;
        }
        if (daddyHeap.size() < daddyLimit) { // 如果得奖区有空位，从候选区弹出一个最大放到得奖区，时间重置
            Customer p = candHeap.pop();
            p.enterTime = time;
            daddyHeap.push(p);
        } else { // 如果得奖区满了，候选区没空
            if (candHeap.peek().buy > daddyHeap.peek().buy) { // 候选区最大和得奖区最小比较，如果候选区更大交换，时间重置
                Customer oldDaddy = daddyHeap.pop();
                Customer newDaddy = candHeap.pop();
                oldDaddy.enterTime = time;
                newDaddy.enterTime = time;
                daddyHeap.push(newDaddy);
                candHeap.push(oldDaddy);
            }
        }
    }

}

public static class Customer {
    
    public int id;
    public int buy;
    public int enterTime;

    public Customer(int v, int b, int o) {
        id = v;
        buy = b;
        enterTime = 0;
    }
}

public static class CandidateComparator implements Comparator<Customer> {

    @Override
    public int compare(Customer o1, Customer o2) {
        return o1.buy != o2.buy ? (o2.buy - o1.buy) : (o1.enterTime - o2.enterTime);
    }

}

public static class DaddyComparator implements Comparator<Customer> {

    @Override
    public int compare(Customer o1, Customer o2) {
        return o1.buy != o2.buy ? (o1.buy - o2.buy) : (o1.enterTime - o2.enterTime);
    }

}
```
