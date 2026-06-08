title: OpenSpec 技术分析
author: haif.
tags:
  - VibeCoding
  - Agent
categories:
  - AI
date: 2026-06-08 10:00:00

---

## 项目概述

OpenSpec 是一个面向 AI 编码助手的**规格驱动开发工具链（Spec-Driven Development）**，核心思想是在写代码之前先对齐需求规格。它以 Node.js CLI 工具的形式发布，支持 25+ 种 AI 助手（Claude Code、GitHub Copilot、Cursor、Codex 等），通过向这些工具注入斜杠命令（Slash Commands）和技能文件（Skills），将结构化的规格管理流程嵌入到 AI 辅助开发工作流中。

**核心理念**:
```
fluid not rigid        — 无强制阶段门，随时更新任意制品
iterative not waterfall — 拥抱需求变化，在实现中不断迭代
easy not complex       — 秒级初始化，最小仪式感
brownfield-first       — 面向已有代码库的增量变更，而非重建
```

---

## 基本功能

### 1. 变更（Change）管理

一次变更被打包成一个独立目录，包含理解和实现该变更所需的全部文档：

```
openspec/changes/add-dark-mode/
├── proposal.md      # 为什么做（Why + What）
├── design.md        # 怎么做（技术方案）
├── tasks.md         # 实现步骤（带 checkbox 的任务清单）
├── .openspec.yaml   # 变更元数据（可选）
└── specs/           # Delta Spec（差量规格）
    └── ui/
        └── spec.md  # 描述 ui 规格的哪些部分在变化
```

**核心命令**:

| 命令 | 作用 |
|------|------|
| `openspec init` | 在项目中初始化 OpenSpec |
| `openspec update` | 更新 AI 工具的指令文件 |
| `openspec new change <name>` | 创建变更目录脚手架 |
| `openspec status --change <name>` | 查看制品完成状态 |
| `openspec instructions <artifact>` | 获取创建某制品的引导指令 |
| `openspec archive [name]` | 归档变更，将 Delta Spec 合并回主 Spec |
| `openspec validate` | 校验变更和规格文档结构合法性 |
| `openspec list` | 列出活跃变更或规格 |
| `openspec view` | 交互式仪表板 |

### 2. 规格（Spec）管理

规格是系统当前行为的"真相来源"，按领域目录组织：

```
openspec/specs/
├── auth/spec.md
├── payments/spec.md
└── notifications/spec.md
```

每个 spec 文件采用结构化 Markdown，通过 `### Requirement:` 和 `#### Scenario:` 标题层次描述需求和可测试场景。

### 3. Delta Spec（差量规格）

OpenSpec 面向棕地（Brownfield）开发的核心机制。Delta Spec 只描述**变化**，不重复整个规格：

```markdown
## ADDED Requirements   → 新增需求（归档时追加到主 Spec）
## MODIFIED Requirements → 修改需求（归档时替换现有需求）
## REMOVED Requirements  → 删除需求（归档时从主 Spec 删除）
```

### 4. 工作流（Workflow）

通过斜杠命令驱动，所有节点分为两组：

**core profile（默认）**

| 节点 | 命令 | 说明 |
|------|------|------|
| Propose change | `/opsx:propose` | 全自动模式，一步创建变更并连续生成所有制品直到 apply-ready，适合需求清晰、快速启动的场景 |
| Explore ideas | `/opsx:explore` | 在创建变更前探索代码库，收集现有结构和上下文，帮助 AI 生成更准确的制品 |
| Apply tasks | `/opsx:apply` | 读取 tasks.md，逐条执行任务并打勾，是实现阶段的主命令 |
| Sync specs | `/opsx:sync` | 将主 Spec 的最新状态同步回当前变更上下文，避免并行变更导致的规格漂移 |
| Archive change | `/opsx:archive` | 将已完成变更归档，Delta Spec 合并回主 Spec，变更目录移入 archive/ |

**expanded profile（需手动启用）**

| 节点 | 命令 | 说明 |
|------|------|------|
| New change | `/opsx:new` | 只创建变更目录脚手架，不自动生成任何制品，配合 continue 实现分步审核 |
| Continue change | `/opsx:continue` | 有上下文感知的推进命令，读取已有制品后继续生成下一个或修改已有内容，是最灵活的制品操作命令 |
| Fast-forward | `/opsx:ff` | continue 的全自动版本，跳过确认直接批量生成所有缺失制品直到 apply-ready |
| Bulk archive | `/opsx:bulk-archive` | 批量归档多个已完成变更，适合积压了多个小变更时一次性清理 |
| Verify change | `/opsx:verify` | 检查代码实现是否与规格一致，建议在归档前执行 |
| Onboard | `/opsx:onboard` | 为新成员或 AI 生成项目上下文摘要，快速了解现有规格和进行中的变更 |

**典型使用路径**

```
explore → propose          （快速路径，全自动）
explore → new → continue → ff → apply → verify → archive  （分步审核路径）
                                    ↑
                               sync（有并行变更时）
```

**propose 与 new+continue 的选择**

| | `/opsx:propose` | `/opsx:new` + `/opsx:continue` |
|---|---|---|
| 速度 | 快，一步到位 | 慢，逐步推进 |
| 审核时机 | 全部生成后再审 | 每步生成后审核 |
| 适合场景 | 需求清晰 | 需求模糊、需要人机对齐 |

### 5. 工作区（Workspace）

面向多仓库/大型 monorepo 场景的协调层，支持跨仓库的 Initiative 管理：

```
openspec workspace setup   # 创建工作区
openspec workspace open    # 打开工作区（用 AI 工具或编辑器）
openspec workspace link    # 添加仓库/目录链接
```

---

## 文件结构

```
OpenSpec/
├── src/                          # TypeScript 源码
│   ├── cli/
│   │   └── index.ts              # CLI 入口，Commander.js 注册所有命令
│   ├── commands/                 # 顶层命令实现
│   │   ├── workflow/             # 工作流子命令
│   │   └── workspace/            # 工作区子命令
│   ├── core/                     # 核心业务逻辑
│   │   ├── artifact-graph/       # 制品依赖图（关键架构）
│   │   ├── collections/
│   │   │   └── initiatives/      # Initiative 集合（跨仓库协调）
│   │   ├── command-generation/   # 多工具命令生成
│   │   │   └── adapters/         # 每种 AI 工具一个 Adapter（25+）
│   │   ├── completions/          # Shell 自动补全系统
│   │   ├── context-store/        # 上下文存储（跨会话持久化）
│   │   ├── parsers/              # Markdown 解析
│   │   ├── templates/            # 工作流模板生成
│   │   │   └── workflows/        # 各工作流模板
│   │   └── workspace/            # 工作区核心逻辑
│   ├── telemetry/                # 匿名遥测（PostHog）
│   └── utils/                    # 工具函数
├── schemas/                      # 内置工作流 Schema
│   ├── spec-driven/              # 默认 Schema
│   │   ├── schema.yaml           # proposal → specs → design → tasks
│   │   └── templates/            # 各制品的 Markdown 模板
│   └── workspace-planning/       # 工作区规划 Schema
├── bin/
│   └── openspec.js               # CLI 可执行入口
├── scripts/
│   └── postinstall.js            # 安装后自动工具检测
├── test/                         # Vitest 测试套件
└── docs/                         # 用户文档
```

---

## 核心架构

### 1. 制品依赖图（Artifact Graph）

这是 OpenSpec 最核心的概念抽象。`ArtifactGraph` 类将 YAML Schema 中定义的制品（Artifact）及其依赖关系建模为有向无环图（DAG），并使用 **Kahn 算法**进行拓扑排序，确定制品的合法构建顺序。

```
proposal （根节点，无依赖）
    │
    ├──→ specs （requires: proposal）
    │
    └──→ design （requires: proposal）
              ↓
           tasks （requires: specs, design）
              ↓
           apply （实现阶段，requires: tasks）
```

AI 工具通过如下循环驱动制品创建过程：

```
openspec status --change <name> --json
  ↓ 获取 ready 状态的制品
openspec instructions <artifact-id> --change <name> --json
  ↓ 获取创建该制品的 context、rules、template、instruction
  （AI 按模板创建文件）
openspec status --change <name> --json
  ↓ 再次查询，继续下一个 ready 制品
  ...直到 applyRequires 中所有制品都完成
```

### 2. 命令生成的适配器模式（Adapter Pattern）

为了支持 25+ 种 AI 工具，OpenSpec 采用了**策略/适配器模式**解耦"命令内容"和"工具特定格式"：

```
CommandContent（工具无关）
    ├── id: 'propose'
    ├── description: '...'
    └── body: '...'（工作流指令 Markdown）
          │
          ▼ ToolCommandAdapter（每个工具实现）
    ┌─────────────────────────────────────────┐
    │  Claude Code  → .claude/commands/opsx/  │
    │  Cursor       → .cursor/rules/opsx/     │
    │  Codex        → ~/.codex/openspec/      │
    │  GitHub Copilot → .github/prompts/      │
    │  Gemini CLI   → .gemini/skills/         │
    └─────────────────────────────────────────┘
```

每个 Adapter 实现两个方法：
- `getFilePath(commandId)` — 决定命令文件写到哪里
- `formatFile(content)` — 决定文件内容格式（frontmatter 格式因工具而异）

### 3. Schema 驱动的工作流定制

工作流由 YAML Schema 文件定义，用户可以自定义制品类型和依赖关系：

```yaml
# openspec/schemas/spec-driven/schema.yaml
name: spec-driven
version: 1
artifacts:
  - id: proposal
    generates: proposal.md
    template: proposal.md
    instruction: |  # 提供给 AI 的创建指南
      ...
    requires: []

  - id: tasks
    generates: tasks.md
    template: tasks.md
    requires: [specs, design]

apply:
  requires: [tasks]    # 进入实现阶段的前提制品
  tracks: tasks.md     # 用 checkbox 追踪实现进度
```

### 4. Delta Spec 归档合并引擎

`archive.ts` 实现了将变更目录中的 Delta Spec 合并回主 Spec 的核心逻辑：

- **ADDED**: 将需求块追加到目标 spec.md 的对应区域
- **MODIFIED**: 按需求标题精确匹配，用新版本替换旧版本
- **REMOVED**: 从主 spec 中删除匹配的需求块

归档后，变更目录整体移入 `changes/archive/YYYY-MM-DD-<name>/` 保留完整历史。

---

## 设计思想

### 1. 文件系统即状态（Filesystem as State）

OpenSpec 不依赖数据库或后台服务，所有状态通过文件系统表达：

- 制品是否完成 → 对应文件是否存在
- 变更是否归档 → 目录是否在 `changes/archive/` 下
- 变更元数据 → `.openspec.yaml` 文件
- 工作区配置 → `workspace.yaml`

这使得状态天然可被 Git 追踪，支持代码审查，无需额外同步机制。

### 2. AI 工具无关（Tool Agnostic）

OpenSpec 的核心价值在于工具中立性。通过适配器模式，相同的工作流指令可以注入到任意 AI 工具的技能/命令系统中。AI 工具通过调用 `openspec` CLI 命令获取结构化数据（`--json` 输出），再基于这些数据创建文件。

### 3. 增量规格（Delta-First）

区别于重建整个规格文件，Delta Spec 只表达"变化量"，具备以下优势：
- **并行无冲突**：两个变更可同时修改不同需求，不产生 merge conflict
- **审查聚焦**：只看 delta，无需对比全量 spec
- **历史可追溯**：每次归档的 delta 说明了"为什么改"

### 4. Schema 可组合（Composable Schemas）

Schema 是 OpenSpec 的扩展点，允许团队定制工作流：
- `core` profile：propose → apply → archive（新手/快速场景）
- `expanded` profile：new → continue → ff → verify → bulk-archive（完整流程）
- 自定义 Schema：完全自定义制品类型、依赖顺序、模板内容

### 5. 隐私优先的遥测（Privacy-First Telemetry）

遥测设计严格限制数据范围：
- 只收集命令名称和版本号
- 不收集参数、路径、文件内容、PII
- CI 环境自动禁用
- 支持 `OPENSPEC_TELEMETRY=0` 或 `DO_NOT_TRACK=1` 退出
- 使用随机 UUID 作为匿名标识，不与用户身份绑定

---

## 关键子系统详解

### 上下文存储（Context Store）

Context Store 是跨仓库协调的基础设施，支持 Git 作为后端：

```
~/.local/share/openspec/context-stores/
├── registry.yaml        # 存储注册表（版本化 YAML）
└── <store-id>/
    ├── .openspec-store/
    │   └── store.yaml   # 存储元数据
    └── initiatives/     # Initiative 集合
        └── <id>/
            ├── initiative.yaml  # 状态文件（版本化）
            ├── requirements.md
            ├── design.md
            ├── decisions.md
            ├── questions.md
            └── tasks.md
```

注册表写入采用**文件锁（.lock 文件）+ 原子重命名**机制，防止并发写入竞态。

### Initiative 系统

Initiative 是跨仓库协调的高层概念，一个 Initiative 代表一个跨越多个仓库的功能或项目：

```yaml
# initiative.yaml
version: 1
id: billing-launch
title: Billing System Launch
summary: Launch new billing system across API and web repos
status: active   # exploring | active | complete | archived
created: 2026-01-01
owners: [alice, bob]
metadata: {}     # 可扩展的自定义元数据
```

### 配置文件（Profiles）系统

Profile 控制哪些工作流命令会被安装到项目（`openspec config profile`）：

- **core profile**（推荐新用户）：`propose`、`explore`、`apply`、`sync`、`archive`
- **custom profile**：用户自选工作流，可额外启用 `new`、`continue`、`ff`、`bulk-archive`、`verify`、`onboard`

### Shell 补全系统

支持 bash、zsh、fish、PowerShell 四种 Shell 的补全脚本生成和安装，采用分层架构：补全数据提供层（动态提供变更名、规格名）、各 Shell 语法生成层、安装层。

---

## 多工具适配层

OpenSpec 当前支持的 AI 工具（截至 1.3.1 版本）：

| 工具 | 技能目录 |
|------|---------|
| Claude Code | `.claude/` |
| GitHub Copilot | `.github/` |
| Cursor | `.cursor/` |
| Codex | `~/.codex/`（全局） |
| Gemini CLI | `.gemini/` |
| Windsurf | `.windsurf/` |
| Cline | `.cline/` |
| RooCode | `.roo/` |
| Continue | `.continue/` |
| Amazon Q | `.amazonq/` |
| Kiro | `.kiro/` |
| Qwen Code | `.qwen/` |
| Lingma | `.lingma/` |
| … | … |

工具检测逻辑通过检测 `detectionPaths` 或 `skillsDir` 目录是否存在来自动识别当前项目使用的 AI 工具，在 `openspec init` 时默认为检测到的工具生成命令文件。

---

## 数据模型

### Artifact Schema

```
Artifact
├── id           制品标识符（如 proposal、tasks）
├── generates    输出文件路径模式
├── description  描述
├── template     模板文件名
├── instruction  提供给 AI 的创建指南（可选）
└── requires     依赖的制品 ID 列表
```

### WorkspaceViewState

```
WorkspaceViewState
├── version          版本号（当前为 1）
├── name             kebab-case 工作区名称
├── context          关联的 Initiative 上下文（可为空）
├── links            稳定名称 → 本地路径映射
├── preferred_opener 默认打开方式（agent 或 editor）
├── tools            启用的 AI 工具列表
└── workspace_skills 技能安装状态
```

### InitiativeState

```
InitiativeState
├── version   版本号（当前为 1）
├── id        kebab-case 标识符
├── title     标题
├── summary   摘要
├── status    exploring | active | complete | archived
├── created   创建日期（YYYY-MM-DD）
├── owners    负责人列表
└── metadata  可扩展的自定义元数据
```

所有持久化状态均通过 Zod Schema 在读取时进行校验，确保数据完整性。

---

## 技术栈

| 类别 | 技术选型 | 说明 |
|------|---------|------|
| 语言 | TypeScript 5.x | 严格模式，全量类型覆盖 |
| 运行时 | Node.js ≥ 20.19.0 | ESM 原生模块 |
| 构建 | esbuild（`build.js`）| 打包为单文件 dist/，快速构建 |
| 测试 | Vitest 3.x | 单元 + 集成 + E2E 测试，支持 UI |
| CLI 框架 | Commander.js 14.x | 命令注册、子命令、钩子 |
| 交互式提示 | @inquirer/prompts 7.x | 多选、搜索等交互式 CLI |
| Schema 校验 | Zod 4.x | 运行时类型安全 |
| YAML 处理 | yaml 2.x | Schema 文件和状态文件的序列化 |
| 进度展示 | ora 8.x | Spinner 动画 |
| 颜色输出 | chalk 5.x | 终端彩色输出 |
| 文件查找 | fast-glob 3.x | 高性能 glob 匹配 |
| 遥测 | posthog-node 5.x | 匿名使用统计 |
| 版本管理 | changesets | 语义化版本发布 |
| 代码规范 | ESLint 9.x + typescript-eslint | 静态分析 |

---

## 可扩展性设计

### 自定义 Schema

用户可以从零创建或从内置 Schema fork 出自定义工作流：

```bash
openspec schema init research-first    # 从零创建
openspec schema fork spec-driven custom-flow  # Fork 后修改
```

自定义 Schema 存储在 `openspec/schemas/<name>/schema.yaml`，可以完全自定义制品类型、依赖顺序、模板内容、apply 阶段配置。

### 社区 Schema

项目支持以独立仓库分发的第三方 Schema 包（类似 VS Code 插件目录的社区扩展），通过 `docs/customization.md` 的社区目录进行索引。

### 工具适配器扩展

新增 AI 工具支持只需：
1. 在 `src/core/command-generation/adapters/` 下创建新的适配器文件，实现 `ToolCommandAdapter` 接口
2. 在 `src/core/config.ts` 的 `AI_TOOLS` 数组中注册工具配置

---

## 总结

OpenSpec 的架构核心是**围绕文件系统的、Schema 驱动的制品依赖图**。通过将 AI 工具从实现主体（AI 写代码）变为流程参与者（AI 按 OpenSpec 工作流创建规格文档），它在人和 AI 之间建立了一个轻量但有结构的对齐层。

关键设计决策：
- **文件系统即状态** — 无服务器依赖，Git 友好
- **适配器模式** — 工具无关，25+ 工具零改核心逻辑支持
- **Zod 全量校验** — 所有持久化数据入口均有类型安全保证
- **Delta-First** — 面向棕地场景的增量规格变更
- **Schema 可组合** — 工作流完全可定制，无强制流程门
