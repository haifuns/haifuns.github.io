title: Hexo
tags:
  - Hexo
categories:
  - 工具
date: 2019-06-28 21:24:00
copyright: true
---
### 依赖
* nodejs
* git

### 安装

```
npm install -g hexo-cli

```
#### 初始化
```
hexo init
```
<!-- more -->
#### 目录
* node_modules: 依赖包
* public：存放生成的页面
* scaffolds：生成文章的一些模板
* source：用来存放你的文章
* themes：主题
* _config.yml: 博客的配置文件

#### 将hexo部署到GitHub
* 生成SSH添加到GitHub
* 修改配置文件 _config.yml
```
deploy:
      type: git
      repo: https://github.com/**/*.github.io.git
      branch: master
```
* 安装deploy-git
```
npm install hexo-deployer-git --save
```
#### 清除
```
hexo clean
```
#### 生成静态文章
```
hexo generate
hexo g
```
```
hexo server
hexo s
```
#### 部署提交
```
hexo d 
```
#### 创建文章
```
hexo new newpapername
```
#### 创建草稿
```
hexo new draft newpage
```
#### 预览草稿
```
hexo server --draft
```
#### 发布草稿
```
hexo publish draft newpage
```

### 插件


#### Hexo Admin(在线编辑)

 * 安装
 
```
npm install --save hexo-admin
```

 * 使用
    http://localhost:4000/admin/
    
#### [emoji 表情](https://github.com/crimx/hexo-filter-github-emojis)
* 安装
```
npm install hexo-filter-github-emojis --save
```
* 启用插件

向站点配置文件_config.yml 中添加如下设置：
```
githubEmojis:
  enable: true
  className: github-emoji
  unicode: true
  styles:
    display: inline
    vertical-align: middle 
  localEmojis:
```
* 使用

在[ emoji-cheat-sheet ](https://www.webfx.com/tools/emoji-cheat-sheet/)中找到你想要的表情，然后复制编码。比如你想发一个😄 直接输入😄对应的 emoji 编码 `:smile`： 就可以了。展示一波表情:bowtie: :smile: :laughing: :heart_eyes::sunny: :umbrella: :cloud: :snowflake: :snowman: :zap: