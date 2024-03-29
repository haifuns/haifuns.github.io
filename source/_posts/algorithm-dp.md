title: 【算法基础】暴力递归到动态规划（小结）
author: haifun
tags:
  - 算法
  - 动态规划
categories:
  - 算法
date: 2022-09-11 16:40:00

---

# 什么样的暴力递归可以继续优化

1. 有重复调用一个子问题的解，这类递归可以优化
2. 如果每一个子问题都是不同解，无法优化也不用优化

# 暴力递归和动态规划的关系

1. 某一个暴力递归有解的重复调用，即可以把这个暴力递归优化为动态规划
2. 任何动态规划问题，都一定对应着某一个有重复过程的暴力递归
3. 不是所有的暴力递归都一定对应着动态规划

# 暴力递归过程的设计原则（面试）

1. 每一个可变参数的类型不要比 int 类型更加复杂
2. 原则1 可以违反，可以让类型突破到一维线性结构，但必须是单一可变参数
3. 如果原则1 被违反，但是不违反原则2，只需要做到记忆化搜索即可
4. 可变参数的个数应能少则少

# 常见的4种尝试模型

1. 从左往右的尝试模型
2. 范围上的尝试模型
3. 多样本位置全对应的尝试模型
4. 寻找业务限制的尝试模型

# 如何找到某个问题的动态规划方式

1. **设计暴力递归：重要原则+4种常见尝试模型（重要）**
2. 分析有没有重复解：套路解决
3. 用记忆化搜索：用严格表结构实现动态规划，套路解决
4. 看看能够继续优化：套路解决

# 暴力递归到动态规划的套路

1. 已经有个了一个不违反原则的暴力递归，并且存在解的重复调用
2. 找到哪些参数的变化会影响返回值，对每一个列出变化范围
3. 参数间的所有组合数量意味着表的大小
4. 总能改出记忆化搜索的方法，也就是傻缓存，非常容易得到
5. 规定好严格表的大小，分析位置的依赖顺序，然后从基础填写到最终解
6. 对于有枚举行为的决策过程，进一步优化

# 动态规划的进一步优化

1. 空间压缩
2. 状态化简
3. 四边形不等式
4. 其他优化技巧