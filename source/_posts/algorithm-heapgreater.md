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