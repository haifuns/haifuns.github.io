title: 【AI】什么是 Skill？
author: haif.
tags:
  - Skill
categories:
  - AGI
date: 2026-03-06 19:30:00

---

# 什么是Skill？

Agent Skills 最初是 Anthropic 在 2025.12 提出，用于解决一个问题：每次都需要重新教 AI，Skill = 可复用的工作方法。

Skill 是一个文件夹，里面装着一套标准化指令，把工作方法、团队规范、领域知识写进去，AI 就能按照写好的 SOP 去自动执行。

# Skill 结构

Skill 的核心设计是一个文件夹，分三层按需加载。

Skill 完整结构如下：

    your-skill-name/
    ├── SKILL.md              # 必需 - 主文件，包含 frontmatter 源数据、body 指令，Skill 的最小形态
    ├── scripts/              # 可选 - 可执行脚本
    │   └── example-script.sh
    ├── references/           # 可选 - 参考资料
    │   ├── example-api-guide.md
    │   └── examples/
    └── assets/               # 可选 - 模板等
        └── example-report-template.md

SKILL.md格式如下：

    ---
    name: your-skill-name                   # 上半部分，frontmatter，≈ 100 token
    description: 描述Skill 用途以及使用时机
    ---
     
    具体的操作指令                             # 下半部分，指令，< 5k token

渐进式披露确保只有相关 Skill 的完整内容会被加载。不相关的 Skill 只占 100 tokens，不会干扰 AI 的思考。解决了"怎么用最少的 token 承载最多的信息"。三层加载系统如下：

*   第一层：YAML frontmatter（100 tokens），包含 name 和 description。源数据常驻在上下文，用来明确 Skill 用途以及使用时机。
*   第二层：SKILL.md 主体，当判断需要使用此 Skill 时加载，包含完整指令、工作流、示例等。
*   第三层：脚本和参考资料，执行指令时按需加载外部文件。

# Skill 构建指南

## 第一步：写 YML frontmatter

最简格式：

    ---
    name: your-skill-name
    description: 它是做什么的。当用户要求[特定短语]时使用.
    ---

关键规则：

1.  name 必须使用 kebab-case 格式，不能有空格或大写字母。
2.  description 必须包含两个部分：这个 Skill 的功能；什么使用使用；
    1.  包含用户可能会说的具体短语
    2.  提到相关的文件类型
    3.  说清楚使用场景避免模糊表达

好坏对比：

```
# 好 - 功能明确 + 包含触发词
description: 分析 Figma 设计文件并生成开发交接文档。当用户上传 .fig 文件、询问"设计规范"、"组件文档"或"设计转代码"时使用。
 
# 坏 - 功能笼统，缺少触发词
description: 帮助完成代码审查。

```

## 第二步：写 SKILL.md 主体指令

Anthropic 推荐的结构：
```
---
name: your-skill
description: [...]
---
 
# Your Skill Name
 
## Instructions
 
### Step 1: [第一个主要步骤]
 
清楚解释发生什么。
 
示例：
``bash
python scripts/fetch_data.py --project-id PROJECT_ID
``
 
预期输出：[描述成功的样子]
 
### Step 2: [第二个主要步骤]
 
...（根据需要添加更多步骤）
 
## Examples
 
**示例 1：[常见场景]**
用户说："创建一个新的营销活动"
执行动作：
1. 通过 MCP 获取现有营销活动
2. 用提供的参数创建新营销活动
结果：营销活动创建完成，返回确认链接
（根据需要添加更多示例）
 
## Troubleshooting
 
**错误：[常见错误信息]**
- 原因：[为什么发生]
- 解决：[如何修复]
（根据需要添加更多错误案例）
```

写指令的三个黄金原则：

1.  具体且可执行
2.  包含错误处理
3.  引用外部资源要清晰

## 第三步：可选的辅助文件

关键规则：

*   文件必须叫 SKILL.md（大小写敏感）
*   文件夹名用 kebab-case
*   不要在 Skill 文件夹里放 README.md（会干扰加载）

## 实战建议：先测试，再封装

Anthropic 建议的方法：不要上来就写 Skill。

正确流程：

1.  先在对话中反复测试一个具体任务
2.  找到最有效的提示方式
3.  记录 AI 的成功输出
4.  把这个成功经验提取成 Skill

这样做的好处：利用 AI 的上下文学习能力，快速找到最优解，而不是盲目写一堆规则。

# Skill 适用场景

1.  文档类型的工作，不需要外部工具，完全使用 AI 内置能力。比如生成前端设计、PPT、合同模板、数据分析报告。
    1.  典型案例：frontend-design skill，创建独特的、生产级的前端界面，具有高设计质量。用于构建 Web 组件、页面、工件、海报或应用程序。
2.  工作流自动化，多步骤流程，需要一致的方法论。
    1.  典型案例：skill-creator skill，创建 Skill 的工作流，创建工具本身也是 Skill。
3.  MCP 增强，封装"怎么用好 MCP 提供工具"的知识。
    1.  典型案例：Sentry 官方发布的 sentry-code-review skill，使用 Sentry 的错误监控数据（通过 MCP 服务器）自动分析和修复 GitHub Pull Request 中检测到的 bug。

# 相关资料

*   [claude skill 构建指南](https://claude.com/blog/complete-guide-to-building-skills-for-claude)
*   [agentskills.io](https://agentskills.io/home)
*   [如何写出好的 Skill ？拆解 skill-creator 背后的设计！](https://mp.weixin.qq.com/s?__biz=MzIyNjM2MzQyNg%3D%3D\&mid=2247719753\&idx=1\&sn=d0bdf9aed64c8f9dc32e02a72302ced9\&chksm=e98165aa424cdb62876b5471962ffd1bb76c364af30934faa8636e318001193152d0f1fc5aea\&xtrack=1\&req_id=1771772450327586\&scene=90\&ascene=56\&devicetype=iOS26.3\&version=1800452c\&nettype=WIFI\&abtest_cookie=AAACAA%3D%3D\&lang=zh_CN\&countrycode=CN\&fontScale=100\&exportkey=n_ChQIAhIQOXiPokOzrxZEITY2xbxmChLfAQIE97dBBAEAAAAAAIlXJ5fX03sAAAAOpnltbLcz9gKNyK89dVj0M30yo9kS5Xs8ijWJuR%2FZymxOAaU9RRlvqD%2FZt%2BnEOlUMmlnOxE%2BGgES0SOGrFHfI7xnmH5JCGq1qpy%2FLtJZtw%2BS6BtRkhzGt6%2BYPrgAVznA4e%2FCx0ZwiROZ6CChfrt%2BhBD0GaEuiteC2geJcHcIg%2BvOrt3UsbkfnLURo51jhQwKYJSpVfI5A3vR4XDQq8VXyTRFQl6ue29%2Bnb5gPuj%2BE%2BNVzeMzlb7TrFVU3o7z0i0M%2BWUpP%2BSneE4E%3D\&pass_ticket=pb2K1DiLYEvCnR3e6rimYi1%2FByRXKAbJqj%2BQhKPaOjesleg7h60whTefJ6qvlusl\&wx_header=3)
*   [clawhub skills](https://clawhub.ai/skills?sort=downloads\&nonSuspicious=true)，[awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills)，[skillsmp](https://skillsmp.com/)，[skills.sh](https://skills.sh/)，[skillhub - tencent](https://skillhub.tencent.com/)
