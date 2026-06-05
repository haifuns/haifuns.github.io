title: Agent Trace 工具 - claude-tap
author: haif.
tags:
  - Agent
categories:
  - AI
date: 2026-06-05 18:00:00

---

[claude-tap](https://github.com/liaohch3/claude-tap) 是给 AI 编程 agent 用的本地代理和 trace 查看器。把 CLI 通过它启动，就能看到真实 API 流量：system prompt、对话历史、工具 schema、工具调用、流式响应、token 用量和请求 diff。

## 主要功能

-   👀 看见真实上下文：检查 prompt、messages、工具定义、工具调用、工具结果、流式 chunk 和 token 用量。
-   🔎 用证据定位问题：对比相邻请求，明确是哪段 prompt、消息、工具或参数发生了变化。
-   📦 留下可分享证据：每次运行都会写入 JSONL trace，并生成自包含 HTML 查看器，方便 review 或归档。
-   🔒 数据留在本机：不依赖云端 dashboard；常见认证 header 会在记录前自动脱敏。
-   🧩 覆盖主流编码 CLI：同一套流程可用于 Claude Code（默认）、Codex CLI、Gemini CLI、Kimi CLI、OpenCode、Pi、Hermes Agent、Cursor CLI、Qoder CLI、Antigravity CLI 和 CodeBuddy CLI。

## 安装

```SQL
uv tool install claude-tap
```

## 启动

```SQL
# Claude Code，默认开启浏览器实时查看器
claude-tap
```

## CLI 选项

除以下 `--tap-*` 参数外，所有参数均透传给所选客户端：

```Plain
--tap-client CLIENT      启动的客户端: claude（默认）/ agy / codex / gemini / kimi / opencode / pi / hermes / cursor / qoder / codebuddy
--tap-target URL         上游 API 地址（默认: 根据客户端自动选择）
--tap-live               客户端运行时启动实时查看器（默认开启）
--tap-no-live            关闭实时查看器（恢复 v0.1.75 之前的行为）
--tap-live-port PORT     实时查看器端口（默认: 自动分配）
--tap-no-open            不自动在浏览器里打开实时或生成的 HTML 查看器
--tap-output-dir DIR     Trace 输出目录（默认: ./.traces）
--tap-port PORT          代理端口（默认: 自动分配）
--tap-host HOST          绑定地址（默认: 127.0.0.1，--tap-no-launch 模式下为 0.0.0.0）
--tap-no-launch          仅启动代理，不启动客户端
--tap-max-traces N       最大保留 trace 数量（默认: 50，0 = 不限）
--tap-store-stream-events 捕获时把原始 SSE/WebSocket event 数组写入 trace 存储，以便查看器/导出结果展示（默认关闭）
--tap-no-update-check    禁用启动时的 PyPI 更新检查
--tap-no-auto-update     仅检查更新，不自动下载
--tap-proxy-mode MODE    代理模式: reverse 或 forward（默认：claude/codex/kimi/codebuddy 用 reverse，agy/gemini/opencode/pi/hermes/cursor/qoder 用 forward）
--tap-trust-ca           macOS 上显式把本地 CA 信任到当前用户 login keychain（agy 会自动执行）
```

## 工作原理

1.  `claude-tap` 启动反向代理或 forward proxy，并启动所选客户端
2.  支持 base URL 的客户端会指向反向代理；不支持 base URL 的客户端会通过 proxy/CA 环境变量接入
3.  SSE 和 WebSocket 流会在收到 chunk/message 时实时转发，代理开销很低
4.  每个请求-响应对或 WebSocket 会话记录到本地 trace 存储；原始 SSE/WebSocket event 数组默认不写入，如果后续需要在查看器/导出结果中展示，必须在捕获时开启 `--tap-store-stream-events`
5.  退出时生成自包含的 HTML 查看器
6.  实时模式默认开启，并通过 SSE 向浏览器广播更新
