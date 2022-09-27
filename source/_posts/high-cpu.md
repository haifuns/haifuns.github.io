title: 【排查经验】线上cpu过高排查
author: haifun
tags:
  - 排查经验
categories:
  - 排查经验
date: 2022-09-27 20:00:00

---

1. `top -c` 查看所有的进程
2. 在1的基础上键入`P`让cpu从高到底排序
3. 选择2中cpu占比最高的pid进程
4. `top -Hp pid` 查看pid对应的线程对cpu的占比
5. 在4的页面键入`P`让当前pid的线程cpu占比从高到低排序
6. 获取第5步骤中的线程占比最高的线程id
7. 使用`printf "%x\n" tid`转为16进制（jstack中线程id是16进制）
8. 打印指定pid下指定tid的jstack日志，`jstack pid | grep tid -C 10 --color`（打印指定线程位置前后10行）
9. 根据堆栈信息找到代码块