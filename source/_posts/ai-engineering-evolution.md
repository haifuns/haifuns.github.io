title: AI 工程能力演进：从模型到可靠系统
author: haif.
tags:
  - 演进
categories:
  - AI
date: 2026-04-26 22:00:00

---

## 先回答一个问题：AI 应用开发的本质是什么？

大多数 AI 项目的失败，不是因为模型不够强，而是因为**不知道模型和工程系统之间隔着什么**。

一个 LLM 再强，如果：

- 不知道你的私有数据（知识断层）
- 不知道外部世界发生了什么（实时性断层）
- 不能可靠地完成任务（控制断层）
- 不能被人信任地使用（可靠性断层）

它就只是一个能说会道的玩具。

过去三年，整个 AI 工程生态的核心任务，就是**一层一层填补这四个断层**。本文的结构，就是沿着这条线索展开。

---

## 模型演进：四次能力跃迁

### 四代范式

如果把 LLM 的发展压缩成一句话：**模型越来越会"想"，系统越来越会"做"。**

按训练范式划分，LLM 经历了四次代际切换：

| 代际 | 阶段 | 核心问题 | 代表 |
|------|------|---------|------|
| 第一代 | 规模定律 | 参数量够大就能变强 | GPT-3（2020） |
| 第二代 | 对齐与指令 | 模型要听得懂人话 | RLHF、DPO（2022–2023） |
| 第三代 | 推理期计算 | 难的问题多想一会 | o1、DeepSeek-R1（2024） |
| 第四代 | 多模态原生 | 统一感知世界 | GPT-4o、Gemini 2.5（2024–2025） |

**对齐技术的演进**值得单独说。方向很清晰：降低人工标注成本，提高稳定性。

```
RLHF：人类标注偏好 → 训练 Reward Model → PPO 微调
  ↑
  缺点：标注成本高，多样性受限，Reward hacking 风险

DPO（Direct Preference Optimization）：绕过 Reward Model，直接用偏好数据优化
  ↑
  缺点：依赖高质量偏好数据集

Constitutional AI：基于规则（宪法原则）自动对齐，无需人工逐条标注
```

当模型能力接近甚至超越人类标注者时，对齐问题升级为 **Scalable Oversight**：如何监督一个比你更聪明的模型？这仍是 2025–2026 年最前沿的开放问题。

### 推理模型：慢思考的工程价值

2024 年 9 月 o1 发布是 LLM 发展的一个转折点。

```
快思考（传统）：问题 → 自回归生成 → 答案
慢思考（o1/R1）：问题 → [内部思维链搜索、试错、反思] → 答案
```

这不是噱头。o1 在 AIME 数学竞赛、Codeforces 编程竞赛上的表现超过 99% 的人类选手。DeepSeek-R1 以 MIT 许可证开源，用纯强化学习（GRPO）训练出对标 o1 的推理能力，训练成本不到 600 万美元。

对工程师来说，这意味着：**需要严密推理的任务，终于可以交给模型了**。但也要注意，推理模型的 token 消耗是普通模型的 10–100 倍，合理分流是关键。

### 上下文窗口膨胀：改变了什么

从 4K 到 10M tokens，不只是数字变化，它消解了一些原本必须靠 RAG 才能解决的问题。

| 上下文窗口 | 时间 | 工程意义 |
|-----------|------|---------|
| 4K | 2022 | 标准对话，RAG 成为刚需 |
| 128K | 2023 | 整本书、整个代码库可塞入 Prompt |
| 1M | 2024 | 多文档长报告、长视频字幕处理 |
| 10M | 2025–2026 | 全代码仓库 + 全历史对话，RAG 部分场景被替代 |

**技术挑战的核心**：位置编码（RoPE/ALiBi）、注意力计算（Flash Attention）、成本控制（稀疏注意力、语义压缩）。

当上下文窗口足够大时，整个 RAG 管线的必要性会部分消解——但不会完全消失，因为向量检索还有知识隔离和成本优势。

---

## 工程范式演进

Prompt Engineering 不是一成不变的技巧，它经历了三次范式升级。

### 范式一：Prompt Engineering（2022–2023）

这是最早被认识的层次：**怎么问，决定了模型怎么答。**

```
ICL（In-Context Learning）：给例子，让模型从例子中推断规律
  关键：示例数量 ↑ 但边际收益递减，过多示例反而稀释主题

CoT（Chain-of-Thought）：让模型输出推理过程再给答案
  关键发现：数学、逻辑、多步推理任务准确率显著提升

Zero-Shot CoT：一句 "Let's think step by step" 触发推理链，无需手工示例
```

**Structured Output 是工程中最高频的需求**：强制 JSON 格式输出。最佳实践：

- 优先用模型原生的 `response_format: { type: "json_object" }` 参数，而非依赖 Prompt 描述
- System Prompt 中提供 JSON Schema 约束字段类型
- 复杂嵌套结构拆分为多步，避免单次输出过长截断

### 范式二：Context Engineering（2023–2024）

当单次 Prompt 不够用，问题变成：**下一步该喂模型什么信息？**

这就是 Context Engineering 的本质——对"输入环境"的工程化。

RAG 是最典型的实践：

```
Naive RAG：Query → 检索 Top-K → 拼接 → 生成
HyDE：用 LLM 生成假设答案，再检索匹配
Corrective RAG：加入结果评估和重检索
GraphRAG：构建知识图谱，支持跨文档全局性问题
Agentic RAG：Agent 自主决定是否检索、检索什么
```

**GraphRAG 的动机**：向量相似度匹配在"这篇文档里某个事实是什么"上很有效，但在"这份财报体现了公司什么样的战略转变"这类全局性问题上往往失效——因为答案分散在多个章节，没有明显的相似段落。

```
向量 RAG：擅长局部事实问答
GraphRAG：擅长全局主题摘要
结构化 RAG：Text-to-Cypher / Text-to-SQL，适合强结构化数据
```

### 范式三：Harness Engineering（2025–2026）

这是当前最核心、也最被低估的工程范式。

**核心公式**：

```
Agent = Model + Harness
```

模型是天赋异禀但方向不可控的千里马，Harness 是缰绳、护栏和验收机制的总和——**Harness 是 Agent 运行环境中除模型本身之外的一切**。

```
Prompt Engineering → 对马喊话的技巧（单次调用怎么说）
Context Engineering → 给马看地图（每步该喂什么信息）
Harness Engineering → 造高速公路，配护栏和限速牌（整个任务怎么结构化推进）
```

后者的边界包含前者：Harness = Prompt + Context + 执行控制系统。

**Harness 六层核心组件**：

| 层级 | 职责 | 典型实现 |
|------|------|---------|
| 上下文管理 | 组织提示词与文档，定义信息边界 | RAG 管线、Compaction 策略 |
| 工具系统 | 模型通过写代码调用工具，而非塞满上下文 | Tool Mediation |
| 执行编排 | 步骤划分、决策节点、终止条件、异常处理 | Planner-Generator-Evaluator |
| 状态与记忆 | 跨 session 持久状态 | Episodic / Semantic / 程序记忆 |
| 评估与观测 | 生产与验收分离，独立验收系统 | Evaluator、Trace 工具 |
| 约束与失败恢复 | 限制不可做的事，自动重试与路径切换 | 棘轮效应、轨迹编译 |

**两个关键工程机制**：

- **棘轮效应**：每次失败经验 → Critic 分析根因 → Refiner 更新规则 → 下一个 Agent 受益。错误不是浪费，而是系统养料。
- **轨迹编译**：同类任务连续成功 3 次以上 → 编译为确定性脚本，省去 LLM 调用。聪明的系统会越来越快。

**工程师角色的转变**：

```
旧角色：亲手写代码的工匠
新角色：设计规则的乐队指挥

核心活动：架构设计 → 意图拆解 → 验收结果
```

> "Agent 的每一次失败，都是环境设计不完善的信号。正确的回应不是换更强的模型，而是重新设计它运行的环境。"

---

## ReAct 循环：Agent 的底层骨架

不管用哪个框架（MCP、AutoGen、LangGraph），所有 Agent 的底层都是同一个模式：

```
思考（Reason）→ 动手（Act）→ 看结果（Observe）→ 再思考 → 解决问题
```

**ReAct vs CoT 的本质区别**：CoT 是纯推理，ReAct 引入环境反馈——模型能观察行动结果并据此修正推理。

```
# ReAct 的标准格式
Thought:     需要查询北京的天气
Action:      search_weather(city="北京")
Observation:  晴，25°C
Thought:     天气适合户外活动
Action:      generate_suggestions(topic="户外")
Final Answer: 建议去公园跑步
```

从 ReAct 循环的视角，可以清晰地看到这几年工程进展的填补路径：

| 缺失环节 | 补全技术 | 时间 |
|---------|---------|------|
| 动手能力 | RAG | 2023 |
| 动手工具 | Function Calling | 2023 |
| 动手标准化 | MCP | 2024 |
| 动手复用性 | Skill System | 2025 |
| 动手协作 | A2A | 2025 |
| 看结果可靠性 | Harness | 2025–2026 |

---

## MCP、Skill、Spec：工程标准化的三板斧

### MCP（Model Context Protocol）

当 Agent 系统中的工具、数据源、模型越来越多，N×M 的集成复杂度急剧膨胀。

MCP 是 Anthropic 在 2024 年提出的标准化协议——**AI 世界的 USB-C**：

```
旧方式：每个 AI 产品 × 每个工具 = N×M 个集成点
MCP：每个 AI 产品接 MCP → 每个工具实现 MCP Server = N+M 个集成点
```

```
Host Application
    └── MCP Client
            ├── Tools Client
            ├── Memory Client
            └── Prompts Client
                    │
              MCP Protocol
                    │
            MCP Server（文件系统 / Git / 数据库 / ...）
```

2025 年，OpenAI、Google、Microsoft 均已采纳 MCP，生态快速扩张。

### Skill System

通用 Prompt 解决不了专业领域问题——你需要领域知识、最佳实践、质量标准、工具集的一体化封装。

```
Skill = 领域知识 + 最佳实践 + 工具集 + 质量标准
```

| 维度 | 通用 Prompt | Skill |
|------|-----------|-------|
| 粒度 | 文本指令 | 结构化封装 |
| 可复用性 | 复制粘贴 | 版本化管理 |
| 可测试性 | 难以自动化 | 可独立测试 |
| 持久化 | 每次会话重建 | 持久存储 |

Skill 与 MCP 的区别：MCP 是**通信协议层**（类比 USB-C 接口），Skill 是**应用能力层**（类比驱动程序包）。

### Spec 驱动开发

AI 应用开发中，需求模糊是最大的痛点——用户说"我要一个智能助手"，工程师无法直接翻译成代码。

Spec 驱动是解法：**用结构化方式定义输入、输出、约束条件和质量标准**。

```
传统开发：需求文档 → 开发 → 测试

AI 开发：Spec（输入/输出/约束/质量标准）
              → Prompt / Skill 配置
              → Evaluation（自动 + 人工）
              → 迭代优化
```

核心是把"我想要什么"拆解成可验证的质量指标，而非模糊的自然语言描述。

---

## Agent 架构：多 Agent 如何协作

### 协作拓扑的演进

单 Agent 能力有限，复杂任务需要多个 Agent 协同。协作拓扑经历了几代演进：

| 拓扑 | 特征 | 代表框架 | 主要问题 |
|------|------|---------|---------|
| 顺序流水线 | A 完成 → B 检查 → C 输出 | LangChain Chain | 误差逐级累积 |
| 去中心化群聊 | 多 Agent 自行决定何时接力 | AutoGen | 易陷入死循环 |
| 层级式组织 | Planner 分配、Worker 执行、Reviewer 监督 | MetaGPT | 当前最稳定的工程化范式 |
| 群体智能 | 大量同质化 Agent 通过局部互动涌现全局能力 | Swarm | 适合并行探索任务 |

**Planner → Generator → Evaluator** 三层是当前最成熟的层级式架构：

- **Planner**：理解任务，拆解步骤
- **Generator**：执行每个步骤
- **Evaluator**：验证输出质量，决定是否返工

### Agent 的四层记忆

```
Agent = LLM（大脑）+ Planning（规划）+ Memory（记忆）+ Tools（行动）
```

记忆分四层，缺一不可：

| 层次 | 描述 | 实现方式 |
|------|------|---------|
| Working Memory | 当前任务上下文 | Context Window |
| Episodic Memory | 过去的交互经验 | 向量数据库（带时间戳） |
| Semantic Memory | 长期知识与概念 | 向量数据库 + 摘要压缩 |
| Sensory Memory | 即时感知输入 | 实时流处理 |

核心挑战：遗忘策略（保留什么）、跨会话一致性、敏感信息隐私保护。

---

## 工具链全景图

从模型调用到最终产品，需要一条完整的工具链。每一层都有对应的工程选择。

### 模型调用层

| 工具 | 定位 | 适用场景 |
|------|------|---------|
| OpenAI SDK | OpenAI 官方 | GPT 系列，Streaming / JSON Mode |
| Anthropic SDK | Anthropic 官方 | Claude 系列，Prompt Caching |
| LiteLLM | 多模型统一接口 | 一套代码切换不同厂商 |
| Ollama | 本地模型运行时 | 本地运行 Llama、Qwen |
| vLLM | 高性能推理引擎 | 生产级本地部署，PagedAttention |

**Prompt Caching**：长 System Prompt 或固定上下文的场景（如 RAG 前缀），启用后可降低 60–90% 的重复 token 成本。注意：缓存前缀内容必须稳定不变。

**生产级错误处理**：

- Rate Limit（429）→ 指数退避重试，最多 3 次
- 超时 → 合理 timeout，长任务拆分多步
- 幂等性 → 写操作防止重试导致重复执行

### 应用框架层

| 框架 | 核心定位 | 擅长场景 |
|------|---------|---------|
| LangChain | 链式编排 + 生态最丰富 | 快速原型、复杂 Agent 流程 |
| LlamaIndex | 知识检索专精 | RAG 管道、文档问答 |
| CrewAI | 多 Agent 协作 | 角色分工明确的任务流水线 |
| AutoGen | 对话式多 Agent | 代码生成、自动调试 |
| Claude Agent SDK | 原生 Agent 支持 | 生产级 Agent，内置安全机制 |

### 向量数据库

| 工具 | 特点 | 适用场景 |
|------|------|---------|
| Chroma | 轻量、易嵌入、开源 | 本地开发、快速原型 |
| Qdrant | 高性能、Rust 实现 | 生产级向量检索 |
| Weaviate | 原生多模态、GraphQL | 多模态检索、知识图谱 |
| pgvector | PostgreSQL 插件 | 已有 PG 基础设施 |
| Milvus | 分布式、超大规模 | 亿级向量、企业级 |

### 可观测性

LLM 应用的黑盒特性使可观测性不可或缺：

| 工具 | 能力 | 特点 |
|------|------|------|
| LangSmith | Trace、Eval、Prompt 管理 | LangChain 官方，深度集成 |
| Langfuse | Trace、成本追踪、数据集 | 开源可自托管 |
| Helicone | 请求代理、成本分析、缓存 | 零侵入，一行代码接入 |
| Braintrust | Eval 平台、Golden Set 管理 | 专注评测，CI 集成 |

**核心观测指标**：Latency（首 token / 完整响应）、Token 消耗与成本、工具调用成功率、Prompt 版本与效果对比。

---

## 交互形态演进：从对话框到系统级 AI

AI 的交互模式不是静态的，它在快速演进：

| 阶段 | 交互特征 | 代表形态 |
|------|---------|---------|
| 问答式 UI | 一问一答，被动响应 | ChatGPT Web |
| 嵌入式 Copilot | 侧边栏辅助，人工触发 | GitHub Copilot |
| 系统级 AI OS | 跨应用调度，底层基础设施 | Apple Intelligence、MCP Host |
| 主动式 AI | 基于场景意图主动执行，无需指令 | 后台常驻 Agent |

**Computer Use 是一个关键节点**：LLM 直接控制 GUI——操作浏览器、点击按钮、填表、读写文件。这标志着 AI 从**信息生成者**向**任务执行者**的范式转变。

---

## 安全与可靠性

### 幻觉问题

LLM 生成看似合理但实际错误的内容，是最核心的可靠性挑战：

| 策略 | 说明 |
|------|------|
| RAG | 提供真实文档，减少凭空生成 |
| CoT | 暴露推理过程，便于发现逻辑错误 |
| Citation | 强制输出带引用来源 |
| Self-Check | 让模型自我验证输出 |
| Human-in-loop | 关键环节人工审核 |

### 安全护栏

```
输入 → [输入过滤/意图检测] → 模型 → [输出过滤/格式校验] → 输出
```

Guardrail 解决的问题：有害内容过滤、Prompt Injection 防御、输出格式强制约束。

---

## 技术选型速查

| 场景 | 推荐方案 |
|------|---------|
| 简单问答 / 客服 | Prompt + RAG |
| 数据分析 / 报告生成 | ReAct + 代码执行 |
| 复杂多步推理 | 推理模型（o1 / R1 系列） |
| 复杂任务分解 | Agent + Planning |
| 多系统集成 | Multi-Agent + MCP |
| 跨文档全局理解 | GraphRAG |
| 实时界面操作 | Computer Use |
| 专业领域应用 | Skill System + Fine-tuning |
| 端侧 / 隐私敏感 | SLM（Phi-3、Qwen 小参数） |
| 质量保证 | Evaluation Harness |

---

## 附：演进全景速览

```
六条演进主线

能力边界  纯文本 → 多模态 → 操作物理世界
自主性    被动回答 → 工具调用 → 自主规划
上下文    单轮 → 多轮 → 长期记忆 → 全局理解
执行模式  单步 → 链式 → 树搜索 → 层级协作
工程化    Prompt → Skill → MCP → 标准化生态
算力与成本 暴力堆参数 → 极致压缩 → 推理期动态分配
            ↑ 第六条主线常被忽视，但它是一切商业闭环的物质基础


四次训练范式

规模定律主导（2020–2023）  堆算力、堆数据
对齐与指令（2023–2024）   RLHF → DPO → Constitutional AI
推理期计算（2024–2025）    o1、R1，慢思考
多模态原生（2024–2026）   统一感知，统一建模


三次工程范式

Prompt Engineering    对马喊话的技巧
Context Engineering   给马看地图
Harness Engineering  造高速公路，配护栏和限速牌
```
