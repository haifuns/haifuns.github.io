title: Transformer 详解
author: haif.
tags:
  - Transformer
categories:
  - AI
date: 2026-07-16 12:00:00

---

> 以"猫追了老鼠"为例，贯穿全文。

---

## 一、整体架构

原始论文（Attention Is All You Need，2017）提出的 Transformer 是一个 **Encoder-Decoder** 结构，专为序列到序列任务（如翻译）设计。

```
原文输入                          目标输出（逐词生成）
"猫追了老鼠"                      "The cat chased the mouse"
     ↓                                      ↑
┌─────────────┐   Encoder输出(K,V)   ┌─────────────┐
│   Encoder   │ ──────────────────→ │   Decoder   │
│  (N=6层)    │                      │  (N=6层)    │
└─────────────┘                      └─────────────┘
```

两部分共用相同的基础组件，但职责不同：
- **Encoder**：读懂整句输入，输出一组富含语义的向量
- **Decoder**：逐词生成输出，每步都能查阅 Encoder 的结果

---

## 二、输入表示

### 2.1 Tokenization + Input Embedding（分词 + 输入嵌入）

计算机看不懂文字，第一步是把文字切成 **token**，再映射为向量。

切分单位不一定是单字。现代分词器（如 BPE）统计训练数据中的高频组合——"老鼠"整体出现的频率远高于"老"单独出现，因此作为**一个 token** 保留：

```
"猫追了老鼠" → ["猫", "追", "了", "老鼠"]   # 4个token
```

每个 token 通过一个可学习的 Embedding 矩阵映射为向量：

```
"猫"  → [0.2, -0.5, 0.8, 0.1, ...]   # 512维（论文默认）
"追"  → [0.7,  0.3, -0.2, 0.9, ...]
"了"  → [-0.1, 0.6,  0.4, 0.2, ...]
"老鼠"→ [0.5,  0.8, -0.3, 0.6, ...]
```

语义相近的词，向量方向也相近——"猫"和"狗"的向量比"猫"和"追"更接近。

### 2.2 Positional Encoding（位置编码）

Transformer 同时处理所有 token，没有 RNN 那样的天然顺序。但"猫追老鼠"和"老鼠追猫"意思截然不同，必须注入位置信息。

论文用**固定的正弦/余弦函数**生成位置编码，直接加到 Embedding 上：

```
最终输入 = Token Embedding + Positional Encoding

"猫"的向量 + 位置1的编码 → 带位置信息的"猫"
"追"的向量 + 位置2的编码 → 带位置信息的"追"
```

位置编码的每一维用不同频率的正弦/余弦，使得任意两个位置的编码都可区分，且模型能从中推断相对距离。

---

## 三、Encoder（编码器）

每个 Encoder 层包含两个子层，每个子层后都有 **残差连接 + Layer Normalization**：

```
输入 x
  ↓
[Multi-Head Self-Attention]
  ↓
Add & Norm:  x = LayerNorm(x + Attention(x))
  ↓
[Feed-Forward Network]
  ↓
Add & Norm:  x = LayerNorm(x + FFN(x))
  ↓
输出（送入下一层，或作为 Decoder 的 K、V）
```

### 3.1 Scaled Dot-Product Attention（缩放点积注意力）

这是整个 Transformer 的核心运算。

每个 token 都会被变换成三个向量（通过三个独立的线性投影矩阵）：

| 名称 | 含义 | 比喻 |
|------|------|------|
| **Q（Query）** | 我在问什么？ | 搜索关键词 |
| **K（Key）** | 我能回答什么？ | 索引标签 |
| **V（Value）** | 我的实际内容 | 真正的信息 |

计算步骤：

```
1. 相似度打分：score = Q · Kᵀ
2. 缩放（防止点积过大导致梯度消失）：score = score / √d_k
3. 归一化：weight = softmax(score)
4. 加权求和：output = weight · V
```

以"追"为例，它会向所有词发出查询，得到不同的注意力权重：

```
"追"关注"猫"（谁在追）：权重 0.60
"追"关注"老鼠"（追谁）：权重 0.30
"追"关注"了"（助词）：  权重 0.05
"追"关注自身：          权重 0.05

"追"的新表示 = 0.60×"猫"的V + 0.30×"老鼠"的V + 0.05×"了"的V + 0.05×"追"的V
```

结果："追"的向量现在**融合了整句话的上下文信息**。

### 3.2 Multi-Head Attention（多头注意力）

单次 Attention 只能从一个角度理解关系。论文将 Q、K、V 分别投影到 **h=8 个子空间**，并行运行 8 个 Attention，每个头学到不同的关注模式：

```
头1：关注主谓语法关系（"追" ↔ "猫"）
头2：关注动宾语义关系（"追" ↔ "老鼠"）
头3：关注时态/助词（"追" ↔ "了"）
...
→ 把8个头的输出拼接（concat）
→ 再经一个线性变换压回原始维度
```

### 3.3 Position-wise Feed-Forward Network（逐位置前馈网络）

每个 token 的向量经过 Attention 后，还要独立过一个两层全连接网络（不同 token 之间不交互）：

```
FFN(x) = Linear₂(ReLU(Linear₁(x)))

维度变化：512 → 2048（扩展4倍）→ 512（压缩回来）
```

Attention 负责聚合不同位置的信息，FFN 负责对每个位置做更深的特征变换——两者分工明确。

### 3.4 Add & Norm（残差连接 + 层归一化）

每个子层的输出都加上其输入（残差连接），再做 Layer Normalization：

```
output = LayerNorm(x + Sublayer(x))
```

残差连接让梯度在深层网络中顺畅流动，避免梯度消失；LayerNorm 稳定每层的数值分布，加快训练收敛。

---

## 四、Decoder（解码器）

每个 Decoder 层包含**三个子层**，同样都有残差连接 + LayerNorm：

```
输入（已生成的目标序列）
  ↓
[Masked Multi-Head Self-Attention]   ← 只看已生成的词
  ↓
Add & Norm
  ↓
[Cross-Attention]                    ← 查阅 Encoder 的输出
  ↓
Add & Norm
  ↓
[Feed-Forward Network]
  ↓
Add & Norm
  ↓
输出
```

### 4.1 Masked Self-Attention（掩码自注意力）

Decoder 先对自己已生成的词做 Self-Attention，但加了**因果遮罩（Causal Mask）**——生成第 t 个词时，只能看到位置 1 到 t-1 的词，看不到未来：

```
已生成：<start> The
现在预测第3个词，只能 Attention <start> 和 The，未来位置的分数被置为 -∞（softmax后权重为0）
```

这保证了推理时的自回归特性——不能"提前看答案"。

### 4.2 Cross-Attention（交叉注意力 / 编码器-解码器注意力）

这是 Decoder 和 Encoder 之间的桥梁，也是 Decoder 最关键的一步。

- **Q** 来自 Decoder 当前层的输出（代表"我现在生成到哪了，我需要什么"）
- **K、V** 来自 Encoder 最后一层的输出（代表"原句的完整理解"）

```
当 Decoder 准备生成 "cat" 时：
  Q = Decoder 对 "The" 的表示
  K、V = Encoder 对 ["猫","追","了","老鼠"] 的编码

→ Attention 分数最高的是"猫"对应的 K
→ 从"猫"的 V 中取出信息
→ 生成 "cat"
```

每一步生成，Decoder 都会精准定位原句中最相关的部分，而不是依赖一个固定的压缩向量。

### 4.3 自回归生成过程

Decoder 逐词生成，每次把已生成的词作为下一步的输入：

```
步骤1：输入 <start>                → 生成 "The"
步骤2：输入 <start> The           → 生成 "cat"
步骤3：输入 <start> The cat       → 生成 "chased"
步骤4：输入 <start> The cat chased → 生成 "the"
步骤5：...                        → 生成 "mouse"
步骤6：...                        → 生成 <end>，停止
```

---

## 五、输出层

Decoder 最后一层的输出向量，经过一个线性投影映射到词表维度，再做 Softmax 得到概率分布：

```
Decoder输出向量（512维）
   ↓
Linear（512 → 词表大小，如 30000）
   ↓
Softmax → 每个词的概率
   ↓
"The" 0.41 / "A" 0.23 / "One" 0.08 / ...
   ↓
选词策略：
  - 贪心解码：直接取最高概率
  - Beam Search：保留 top-k 条路径，最终选最优序列
  - 采样：按概率随机采样（temperature 控制随机程度）
```

训练时，用**交叉熵损失**衡量预测分布与真实词之间的差距，通过反向传播更新所有参数。

---

## 六、完整架构图

```
原文输入（"猫追了老鼠"）           目标输入（训练时）/ 已生成词（推理时）
        ↓                                      ↓
  Input Embedding                        Output Embedding
        +                                      +
  Positional Encoding                   Positional Encoding
        ↓                                      ↓
┌───────────────────┐              ┌───────────────────────┐
│   Encoder × N     │              │     Decoder × N        │
│                   │              │                        │
│  ┌─────────────┐  │              │  ┌──────────────────┐  │
│  │ Multi-Head  │  │              │  │ Masked Multi-Head│  │
│  │ Self-Attn   │  │              │  │ Self-Attention   │  │
│  └──────┬──────┘  │              │  └────────┬─────────┘  │
│  Add & Norm       │              │  Add & Norm            │
│  ┌─────────────┐  │    K, V      │  ┌──────────────────┐  │
│  │    FFN      │  │ ──────────→  │  │  Cross-Attention │  │
│  └──────┬──────┘  │              │  └────────┬─────────┘  │
│  Add & Norm       │              │  Add & Norm            │
└───────────────────┘              │  ┌──────────────────┐  │
                                   │  │      FFN         │  │
                                   │  └────────┬─────────┘  │
                                   │  Add & Norm            │
                                   └───────────────────────┘
                                              ↓
                                   Linear → Softmax → 输出词
```

---

## 补充一：纯 Decoder 架构（GPT 类）

原始论文是 Encoder-Decoder，但后来的语言模型（GPT、LLaMA 等）证明：**只用 Decoder 也能做几乎所有任务**。

去掉 Encoder 后，Decoder 结构简化为：

```
输入（前文所有 token）
  ↓
Embedding + Positional Encoding
  ↓
┌──────────────────────────────┐
│  Decoder-only Block × N层    │
│                              │
│  Masked Self-Attention       │  ← 只看前文，无 Cross-Attention
│  Add & Norm                  │
│  FFN                         │
│  Add & Norm                  │
└──────────────────────────────┘
  ↓
Linear → Softmax → 预测下一个词
```

任务从"翻译原句"变成了"根据前文续写"。训练目标也更简单：对于每一个 token，预测它的下一个 token，整个序列并行计算损失。

```
输入："猫追了老鼠，然后"
→ 预测下一词：各词有不同概率
→ 采样得到"猫"
→ 再以"...然后猫"为输入，预测下一词
→ 循环，直到生成结束符或达到长度上限
```

**两种架构对比：**

| | Encoder-Decoder | 纯 Decoder |
|---|---|---|
| 代表模型 | 原始 Transformer、T5、BART | GPT 系列、LLaMA、Qwen |
| 典型任务 | 翻译、摘要 | 对话、生成、补全（几乎一切） |
| Cross-Attention | 有 | 无 |
| 信息来源 | 原文编码 + 已生成词 | 仅已生成词 |
| 直觉 | 先读懂原文，再逐词翻译 | 根据上文接着写 |

---

## 补充二：主流模型的架构演进

标准 Transformer 是起点，过去几年每个组件都有针对性的改进。

### 位置编码：正弦 → RoPE（旋转位置编码）

原始正弦位置编码加在 Embedding 上，超出训练长度就失效。

**RoPE（旋转位置编码）** 现已是几乎所有开源模型的标配（LLaMA、Qwen、Mistral）：
- 不加在 Embedding 上，而是在每层 Attention 计算 Q·K 时，直接对向量做旋转变换
- 位置信息体现为向量之间的相对角度，天然具备相对位置感知
- 配合 YaRN 等外推技术，可把训练时的 4K 上下文扩展到 128K 甚至更长

### Attention：MHA（多头注意力）→ GQA（分组查询注意力）

原始 Multi-Head Attention 每个头都有独立的 K 和 V，推理时需要把每一层每个头的 K、V 都缓存起来（KV Cache），显存压力很大。

**GQA（Grouped Query Attention）** 让多个 Q 头共享同一组 K、V：

```
原始 MHA：32个Q头 + 32个K头 + 32个V头
GQA：     32个Q头 +  8个K头 +  8个V头   ← KV Cache 缩小4倍，速度更快
```

效果接近 MHA，是 LLaMA 3、Qwen2、Gemma 等的标准配置。

### FFN（前馈网络）：ReLU → SwiGLU（门控线性单元）/ MoE（混合专家）

原始 FFN 使用 ReLU 激活。主流模型改用 **SwiGLU**（LLaMA、Qwen、Gemini）：

```
原始：  FFN(x) = Linear₂(ReLU(Linear₁(x)))
SwiGLU：FFN(x) = Linear₃(Linear₁(x) × swish(Linear₂(x)))
                                         ↑ 门控机制，动态控制信息流
```

更激进的是 **MoE（混合专家）**，用于 Mixtral、Qwen-MoE、DeepSeek-V2：
- FFN 层由 N 个"专家"网络并排组成（如 8 个）
- 每次推理由一个路由器动态选择激活其中 2～4 个
- 总参数量大（如 46B），但每次实际计算量小（如等效 12B）
- 效果接近大模型，推理成本接近小模型

### 归一化：Post-Norm（后归一化）+ LayerNorm（层归一化）→ Pre-Norm（前归一化）+ RMSNorm（均方根归一化）

原始论文用 **Post-Norm**（子层计算后归一化）。实践发现训练不稳定，现在普遍改为 **Pre-Norm**（先归一化再计算）。

归一化函数也从 LayerNorm 换成更轻量的 **RMSNorm**：

```
LayerNorm：计算均值 + 方差，归一化后缩放
RMSNorm：  只计算均方根（省去均值计算），归一化后缩放  ← 更快，效果相当
```

---

## 补充三：训练方式的演进

### 预训练：规模定律（Scaling Law）

DeepMind 的 Chinchilla 研究（2022）给出关键结论：**给定计算预算，模型参数量和训练数据量应同步增长**，而不是只堆参数。

- GPT-3（2020）：参数 175B，训练数据约 300B tokens——数据偏少
- LLaMA 1（2023）：参数 7B/13B，训练数据 1T tokens——同等计算量下效果更好
- 后续模型普遍采用"适中参数 + 海量数据 + 长时训练"的路线

### 指令微调（SFT，Supervised Fine-Tuning）

预训练模型只会"续写"，不会"按指令回答"。用高质量的指令-回答对做**监督微调（Supervised Fine-Tuning）**，让模型学会按要求行事。数据量不需要很大（几万到几十万条），但质量要求高。

### 对齐训练：RLHF（基于人类反馈的强化学习）→ DPO（直接偏好优化）

**RLHF（从人类反馈中强化学习）**，早期 ChatGPT 方案：
```
① 人类对多个回答排序，收集偏好数据
② 训练奖励模型（Reward Model）为回答打分
③ 用 PPO 强化学习优化语言模型，使其生成高分回答
```
有效，但流程复杂、训练不稳定、超参敏感。

**DPO（直接偏好优化）**，现在开源模型主流方案：
```
① 收集同样的偏好对（好回答 vs 差回答）
② 直接优化语言模型，跳过独立的奖励模型
```
更简单稳定，效果与 RLHF 相当。

### 长上下文扩展

原始 Attention 的计算复杂度是 O(n²)，序列长度翻倍则计算量翻四倍，从 4K 扩展到 128K 代价极高。主要解法：

- **FlashAttention**：重写 GPU 内核，减少 HBM 读写次数，速度提升 2-4 倍，几乎是所有现代模型的标配
- **RoPE 外推（YaRN / ABF）**：调整 RoPE 的缩放系数，让模型在超出训练长度时仍能感知位置
- **滑动窗口 Attention**（Mistral / Gemma）：每个 token 只关注附近固定窗口内的词，复杂度降为 O(n·w)，牺牲部分全局感知

---

## 补充四：主流模型横向对比

| 模型 | 架构 | 位置编码 | Attention | FFN | 归一化 | 对齐 | 上下文 |
|------|------|---------|-----------|-----|-------|------|------|
| GPT-3 | 纯 Decoder | 学习式 | MHA | ReLU | Post-LN | RLHF | 4K |
| LLaMA 3 | 纯 Decoder | RoPE | GQA | SwiGLU | Pre-RMSNorm | SFT+DPO | 128K |
| Qwen2.5 | 纯 Decoder | RoPE | GQA | SwiGLU | Pre-RMSNorm | SFT+RLHF | 128K |
| Mixtral 8×7B | 纯 Decoder | RoPE | GQA | MoE+SwiGLU | Pre-RMSNorm | SFT+DPO | 32K |
| Gemma 2 | 纯 Decoder | RoPE | GQA+滑动窗口 | GeGLU | Pre-RMSNorm | SFT+RLHF | 8K |
| T5 | Encoder-Decoder | 相对位置 | MHA | ReLU | Pre-LN | SFT | 512 |
| 原始 Transformer | Encoder-Decoder | 正弦固定 | MHA | ReLU | Post-LN | 无 | 512 |

> Claude 3、GPT-4 的内部架构未公开，未列入。

**各方向趋势一览：**

| 组件 | 原始论文 | 现在主流 | 改进动机 |
|------|---------|---------|---------|
| 位置编码 | 正弦函数 | RoPE | 更好的长度外推 |
| Attention | MHA | GQA | 减少 KV Cache |
| FFN 激活 | ReLU | SwiGLU | 更强的表达能力 |
| FFN 结构 | Dense | MoE | 增大参数、控制计算量 |
| 归一化位置 | Post-Norm | Pre-Norm | 训练稳定性 |
| 归一化函数 | LayerNorm | RMSNorm | 减少计算量 |
| 对齐方式 | 无 | SFT → DPO | 指令遵循与安全 |
