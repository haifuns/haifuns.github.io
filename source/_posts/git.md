title: GitHub SSH配置
author: Haif.
tags:
  - Git
categories:
  - 工具
date: 2019-06-28 22:31:00
copyright: true
---

* 设置账号、email
```
git config --global user.name "yourname"
git config --global user.email "youremail"
```
* 检查
```
git config user.name
git config user.email
```
* 创建SSH ;`id_rsa`:私人秘钥`id_rsa.pub`:公共秘钥
```
ssh-keygen -t rsa -C "youremail"
```
* GitHub -> New SSH key ->id_rsa.pub
* 检查
```
ssh -T git@github.com
```