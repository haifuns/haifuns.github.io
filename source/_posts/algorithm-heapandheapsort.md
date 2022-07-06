title: 【算法基础】堆和堆排序
author: haifun
tags:
  - 算法
  - 堆
  - 排序
categories:
  - 算法
date: 2022-07-04 23:30:00

---

堆结构是用数组实现的完全二叉树结构，具体实现：优先级队列PriorityQueue。

完全二叉树中对于任意一个节点index=i，满足：
- 左孩子位置：2 * i + 1
- 右孩子位置：2 * i + 2
- 父节点位置：(i - 1) / 2

大根堆：完全二叉树中如果每棵子树的最大值都在顶部就是大根堆。
小根堆：完全二叉树中如果每棵子树的最小值都在顶部就是小根堆。

# 大根堆

大根堆和小根堆实现方式类似，这里只看大根堆实现：

```java
public static class MyMaxHeap {
    private int[] heap;
    private final int limit;
    private int heapSize;

    public MyMaxHeap(int limit) {
        heap = new int[limit];
        this.limit = limit;
        heapSize = 0;
    }

    public boolean isEmpty() {
        return heapSize == 0;
    }

    public boolean isFull() {
        return heapSize == limit;
    }

    public void push(int value) {
        if (heapSize == limit) {
            throw new RuntimeException("heap is full");
        }
        heap[heapSize] = value;
        // value heapSize
        heapInsert(heap, heapSize++);
    }

    // 返回最大值，并且在大根堆中，把最大值删掉
    // 剩下的数，依然保持大根堆组织
    public int pop() {
        int ans = heap[0]; // 最大值
        swap(heap, 0, --heapSize); // 交换最后位置的值和最大值
        heapify(heap, 0, heapSize); // 最后的值在0位置，从0出发重新构建堆
        return ans;
    }

    // 插入操作
    // 新加进来的数，现在停在了index位置
    private void heapInsert(int[] arr, int index) {
        // [index] [(index-1)/2]
        // index == 0
        while (arr[index] > arr[(index - 1) / 2]) { // 如果大于父节点
            swap(arr, index, (index - 1) / 2); // 跟父节点交换
            index = (index - 1) / 2; // 更新位置
        }
    }

    // 从index位置，往下看，不断的下沉
    // 停：较大的孩子都不再比index位置的数大；已经没孩子了
    private void heapify(int[] arr, int index, int heapSize) {
        int left = index * 2 + 1; // 左孩子位置
        while (left < heapSize) { // 如果有左孩子，有没有右孩子，可能有可能没有！
            // 把较大孩子的下标，给largest
            int largest = left + 1 < heapSize && arr[left + 1] > arr[left] ? left + 1 : left;
            largest = arr[largest] > arr[index] ? largest : index;
            if (largest == index) {
                break;
            }
            // index和较大孩子，要互换
            swap(arr, largest, index);
            index = largest;
            left = index * 2 + 1;
        }
    }

    private void swap(int[] arr, int i, int j) {
        int tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
}
```

# 堆排序

堆排序思想：
1. 先让整个数组变成大根堆结构，建堆过程：
    a. 从上到下的方法，时间复杂度O(N*logN)
    b. 从下到上的方法，时间复杂度O(N)
2. 把堆的最大值和堆末尾的值交换，减少堆的大小并重新调整堆，循环操作，时间复杂度O(N*logN)
3. 堆的大小减小到0时，排序完成

```java
// 堆排序额外空间复杂度O(1)
public static void heapSort(int[] arr) {
    if (arr == null || arr.length < 2) {
        return;
    }

    // 第一种方式构建大根堆，从上到下
    // O(N*logN)
    // for (int i = 0; i < arr.length; i++) {
    // heapInsert(arr, i);
    // }

    // 第二种方式构建大根堆，从下到上
    // O(N)
    for (int i = arr.length - 1; i >= 0; i--) {
        heapify(arr, i, arr.length);
    }

    int heapSize = arr.length;
    swap(arr, 0, --heapSize); // 交换0位置最大值到大根堆最后

    // O(N*logN)
    while (heapSize > 0) { // O(N)
        heapify(arr, 0, heapSize); // O(logN)
        swap(arr, 0, --heapSize); // O(1)
    }
}

// arr[index]位置的数，往上移动
public static void heapInsert(int[] arr, int index) {
    while (arr[index] > arr[(index - 1) / 2]) {
        swap(arr, index, (index - 1) / 2);
        index = (index - 1) / 2;
    }
}

// arr[index]位置的数，往下移动
public static void heapify(int[] arr, int index, int heapSize) {
    int left = index * 2 + 1; // 左孩子的下标
    while (left < heapSize) { // 下方还有孩子的时候
        // 两个孩子中，谁的值大，把下标给largest
        // 1) 只有左孩子，left -> largest
        // 2) 同时有左孩子和右孩子，右孩子的值 <= 左孩子的值，left -> largest
        // 3) 同时有左孩子和右孩子并且右孩子的值 > 左孩子的值， right -> largest
        int largest = left + 1 < heapSize && arr[left + 1] > arr[left] ? left + 1 : left;
        // 父和较大的孩子之间，谁的值大，把下标给largest
        largest = arr[largest] > arr[index] ? largest : index;
        if (largest == index) {
            break;
        }
        swap(arr, largest, index);
        index = largest;
        left = index * 2 + 1;
    }
}

public static void swap(int[] arr, int i, int j) {
    int tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}
```

# 1. 几乎有序的数组排序问题

已知一个几乎有序的数组，几乎有序指如果把数组排好序的话，每个元素移动的距离一定不超过K，并且K相对于数组长度来说是比较小的。
选择一种合适的排序策略，对这个数组进行排序。

思路：利用小根堆，小根堆大小为K，保持K个数放到小根堆里，弹出最小值就是当前堆+剩余数中的最小

```java
// O(N*logK)
public static void sortedArrDistanceLessK(int[] arr, int k) {
    if (k == 0) {
        return;
    }
    // 默认小根堆
    PriorityQueue<Integer> heap = new PriorityQueue<>();
    int index = 0;
    // 0...K-1
    for (; index <= Math.min(arr.length - 1, k - 1); index++) {
        heap.add(arr[index]);
    }
    int i = 0;
    for (; index < arr.length; i++, index++) {
        heap.add(arr[index]);
        arr[i] = heap.poll();
    }
    while (!heap.isEmpty()) {
        arr[i++] = heap.poll();
    }
}
```

# 2. 最大线段重合问题

给定很多线段，线段用[start,end]表示线段开始和结束位置，左右都是闭区间。

规定：
1. 线段的开始和结束位置一定是整数值
2. 线段重合区域的长度一定>=1

要求返回最多重合区域中，包含了几段线段。

```java
// 暴力方法 O((max - min) * N)
public static int maxCover1(int[][] lines) {
    int min = Integer.MAX_VALUE; // 所有线段最小值
    int max = Integer.MIN_VALUE; // 所有线段最大值
    for (int i = 0; i < lines.length; i++) {
        min = Math.min(min, lines[i][0]);
        max = Math.max(max, lines[i][1]);
    }
    int cover = 0;
    for (double p = min + 0.5; p < max; p += 1) { // 每0.5统计在范围内的线段数
        int cur = 0; // 包含当前0.5的线段数
        for (int i = 0; i < lines.length; i++) {
            if (lines[i][0] < p && lines[i][1] > p) {
                cur++;
            }
        }
        cover = Math.max(cover, cur); // 重合最多的0.5对应的线段数量
    }
    return cover;
}

// 堆实现 O(N*logN)
public static int maxCover2(int[][] m) {
    // 先按照线段左位置start排序
    Arrays.sort(m, (a, b) -> (a[0] - b[0]));
    // 准备好小根堆
    PriorityQueue<Integer> heap = new PriorityQueue<>();
    int max = 0;
    for (int[] line : m) {
        while (!heap.isEmpty() && heap.peek() <= line[0]) {
            heap.poll(); // 弹出所有小于start的数
        }
        heap.add(line[1]); // end加入小根堆
        max = Math.max(max, heap.size()); // 小根堆里剩下的是跟当前线段重合的线段数量
    }
    return max;
}
```

