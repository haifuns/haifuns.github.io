title: 【Java 并发编程系列】【J.U.C】：CopyOnWriteArrayList
author: Haif.
tags:
  - 并发
categories:
  - 并发
date: 2020-12-26 17:48:00

---

## 介绍

并发包中的并发List 只有CopyOnWriteArrayList 。CopyOnWriteArrayList 是一个线程安全的ArrayList ，对其进行的修改操作都是在底层的一个复制的数组（快照）上进行的，也就是使用了写时复制策略。

CopyOnWriteArrayList 类图结构如下：

![image](https://haif-cloud.oss-cn-beijing.aliyuncs.com/concurrent/CopyOnWriteArrayList-uml.png)

在CopyOnWriteArrayList 的类图中，每个CopyOnWriteArrayList 对象里面有一个array 数组对象用来存放具体元素， ReentrantLock 独占锁对象用来保证同时只有一个线程对array 进行修改。

<!-- more -->

## 源码解析

### 初始化

```java
// 无参构造函数，内部创建了一个大小为0 的Object 数组作为array 初始值
public CopyOnWriteArrayList() {
    setArray(new Object[0]);
}
    
// 创建一个list，内部元素为入参的副本
public CopyOnWriteArrayList(E[] toCopyIn) {
    setArray(Arrays.copyOf(toCopyIn, toCopyIn.length, Object[].class));
}

// 入参为集合，将集合里的元素复制到array
public CopyOnWriteArrayList(Collection<? extends E> c) {
    Object[] elements;
    if (c.getClass() == CopyOnWriteArrayList.class)
        elements = ((CopyOnWriteArrayList<?>)c).getArray();
    else {
        elements = c.toArray();
        // c.toArray might (incorrectly) not return Object[] (see 6260652)
        if (elements.getClass() != Object[].class)
            elements = Arrays.copyOf(elements, elements.length, Object[].class);
    }
    setArray(elements);
}
```

### 添加元素

CopyOnWriteArrayList 中用来添加元素的函数有add(E e）、add(int index, E element）、addIfAbsent(E e)、addAllAbsent(Collection<? extends E> c)等，他们原理类似，以add(E e)为例：
```java
public boolean add(E e) {
    // 获取独占锁
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 获取array
        Object[] elements = getArray();
        int len = elements.length;
        
        // 复制array到新数组，添加元素到新数组（CopyOnWriteArrayList是无界list）
        Object[] newElements = Arrays.copyOf(elements, len + 1);
        newElements[len] = e;
        
        // 使用新数组替换添加前的数组
        setArray(newElements);
        return true;
    } finally {
        // 释放独占锁
        lock.unlock();
    }
}
```

### 获取指定位置元素
使用E get(int index)获取下标为index 的元素，如果元素不存在则抛出IndexOutOfBoundsException 异常。

```java
public E get(int index) {
    return get(getArray(), index);
}

// 步骤1，获取array数组
final Object[] getArray() {
    return array;
}
	
// 步骤2，通过下标获取指定位置元素
private E get(Object[] a, int index) {
    return (E) a[index];
}
```

由于执行步骤1 和步骤2 没有加锁，这就可能导致在线程x 执行完步骤1 后执行步骤2 前， 另外一个线程y 进行了remove 操作，导致线程x 返回已被删除的元素，这就是写时复制策略产生的弱一致性问题。

### 修改元素

使用 E set(int index, E element)修改list 中指定位置元素的值，如果指定位置元素不存在抛出IndexOutOfBoundsException异常。

```java
public E set(int index, E element) {
    // 获取独占锁，阻止其他线程对array数组修改
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 获取当前array数组
        Object[] elements = getArray();
        // 获取指定位置元素
        E oldValue = get(elements, index);

        // 如果指定位置元素与新值不一致则创建新数组并添加元素，重新设置到array
        if (oldValue != element) {
            int len = elements.length;
            Object[] newElements = Arrays.copyOf(elements, len);
            newElements[index] = element;
            setArray(newElements);
        } else { // 如果指定位置元素与新值一样，为保证volatile语义，还是需要重新设置array
            // Not quite a no-op; ensures volatile write semantics
            setArray(elements);
        }
        return oldValue;
    } finally {
        lock.unlock();
    }
}
```

### 删除元素

删除list 里面指定的元素，可以使用E remove(int index)、boolean remove(Object o）和 boolean remove(Object o, Object[] snapshot, int index)等方法，它们的原理一样。以remove(int ind ex）为例：

```java
public E remove(int index) {
    // 获取独占锁
    final ReentrantLock lock = this.lock;
    lock.lock();
    try {
        // 获取数组
        Object[] elements = getArray();
        int len = elements.length;
        
        // 获取指定元素
        E oldValue = get(elements, index);
        int numMoved = len - index - 1;
        
        // 如果要删除的是最后一个元素
        if (numMoved == 0)
            // 复制其他元素到新数组并替代老数组
            setArray(Arrays.copyOf(elements, len - 1));
        else {
            // 分两次复制删除后剩余的元素到新数组
            Object[] newElements = new Object[len - 1];
            System.arraycopy(elements, 0, newElements, 0, index);
            System.arraycopy(elements, index + 1, newElements, index,
                             numMoved);
                             
            // 使用新数组代替老数组
            setArray(newElements);
        }
        return oldValue;
    } finally {
        // 释放锁
        lock.unlock();
    }
}
```
### 弱一致性迭代器

所谓弱一致性是指返回迭代器后，其他线程对list 的增删改对迭代器是不可见的。

```java
public Iterator<E> iterator() {
    return new COWIterator<E>(getArray(), 0);
}

static final class COWIterator<E> implements ListIterator<E> {
    // array的快照版本，虽然传递的是引用，但CopyOnWriteArrayList增删改操作会替换原array
    private final Object[] snapshot;

	// 数组下标
    private int cursor;

    private COWIterator(Object[] elements, int initialCursor) {
        cursor = initialCursor;
        snapshot = elements;
    }

	// 是否遍历结束
    public boolean hasNext() {
        return cursor < snapshot.length;
    }

	// 获取元素
    @SuppressWarnings("unchecked")
    public E next() {
        if (! hasNext())
            throw new NoSuchElementException();
        return (E) snapshot[cursor++];
    }

	// ···
}
```

## 总结

CopyOnWriteArrayList 使用写时复制的策略来保证list 的一致性，而获取 - 修改 - 写入三步操作并不是原子性的，所以在增删改的过程中都使用了独占锁，来保证在某个时间只有一个线程能对list 数组进行修改。另外CopyOnWriteArrayList 提供了弱一致性的迭代器，从而保证在获取迭代器后，其他线程对list 的修改是不可见的，迭代器遍历的数组是一个快照。另外，CopyOnWriteArraySet 的底层就是使用它实现的。