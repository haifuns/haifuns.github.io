title: SVN报错Previous operation has not finished; run 'cleanup' if it was interrupted解决
author: Haif.
tags:
  - SVN
categories:
  - 工具
date: 2019-11-02 21:21:00
copyright: true
---
### 现象
svn因为版本冲突等问题导致的报错，无法cleanup、update、commit，报错"Previous operation has not finished; run 'cleanup' if it was interrupted"

### 解决步骤
1.下载sqlite3.exe
https://www.sqlite.org/2019/sqlite-tools-win32-x86-3300100.zip

2.将sqlite3.exe复制到项目.svn文件夹中，通wc.db文件同目录

3.执行命令

cd 到.svn目录
```
D:\SVN\***\.svn>sqlite3.exe wc.db
SQLite version 3.30.1 2019-10-10 20:19:45
Enter ".help" for usage hints.
sqlite> .table
ACTUAL_NODE    NODES          PRISTINE       WC_LOCK
EXTERNALS      NODES_BASE     REPOSITORY     WORK_QUEUE
LOCK           NODES_CURRENT  WCROOT
sqlite> DELETE FROM WORK_QUEUE;
sqlite>
```
4.执行svn的clean up操作