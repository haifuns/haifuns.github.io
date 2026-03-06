title: 【AI】部署 OpenClaw 到服务器
author: haif.
tags:
  - Agent
categories:
  - AGI
date: 2026-03-05 14:00:00

---

# 安装 - Docker

```bash
git clone https://github.com/openclaw/openclaw.git
# github加速 https://ghfast.top
 
cd openclaw
./docker-setup.sh
# docker加速镜像 https://github.com/dongyubin/DockerHub
 
# 启动后引导配置先尽量跳过
 
# 查看日志
docker compose exec openclaw-gateway openclaw logs --follow
 
# 重新设置配置
docker compose run --rm openclaw-cli onboard
 
# 启动网关
docker compose exec openclaw-gateway openclaw gateway
```

# 主要目录

1.  \~/.openclaw - 配置

    *   存储 OpenClaw 记忆
    *   配置文件
    *   第三方 API 密钥等
2.  \~/openclaw/workspace - 工作空间

    *   Agent 可访问文件
    *   Agent 创建的文件

# 配置模型

## 智谱

```bash
# 配置GLM模型 https://docs.openclaw.ai/zh-CN/providers/zai
docker compose exec openclaw-gateway openclaw onboard --auth-choice zai-api-key
```

## MiniMax

```bash

# https://docs.openclaw.ai/zh-CN/providers/minimax
docker compose exec openclaw-gateway openclaw plugins enable minimax-portal-auth  # 如果已加载则跳过
docker compose exec openclaw-gateway openclaw gateway restart  # 如果 Gateway 网关已在运行则重启
docker compose exec openclaw-gateway openclaw onboard --auth-choice minimax-portal
```

## LongCat

自定义提供商，修改~/.openclaw/openclaw.json

```
{
    "auth":
    {
        "profiles":
        {
            "longcat:default":
            {
                "provider": "longcat",
                "mode": "api_key"
            }
        }
    },
    "models":
    {
        "mode": "merge",
        "providers":
        {
            "longcat":
            {
                "baseUrl": "https://api.longcat.chat/anthropic",
                "apiKey": "ak_*****",
                "auth": "api-key",
                "api": "anthropic-messages",
                "authHeader": true,
                "models":
                [
                    {
                        "id": "LongCat-Flash-Chat",
                        "name": "LongCat-Flash-Chat",
                        "reasoning": false,
                        "input":
                        [
                            "text"
                        ],
                        "contextWindow": 200000,
                        "maxTokens": 8192,
                        "compat":
                        {
                            "maxTokensField": "max_tokens"
                        }
                    }
                ]
            }
        }
    },
    "agents":
    {
        "defaults":
        {
            "model":
            {
                "primary": "longcat/LongCat-Flash-Chat"
            }
        }
    }
}
```

# 配置消息渠道 - 飞书

```bash

# 安装飞书插件 https://docs.openclaw.ai/zh-CN/channels/feishu
docker compose exec openclaw-gateway openclaw plugins install @openclaw/feishu
docker compose exec openclaw-gateway openclaw channels add
```

# 配置远程访问 - 域名

```bash
# 修改配置，允许远程访问
vim ~/.openclaw/openclaw.json
#{"gateway":{"bind":"lan","controlUi":{"allowedOrigins":["10.18.*.*:18798"]}}}
 
# nginx 反向代理
location /openclaw/ {
        proxy_http_version 1.1;
        proxy_set_header Connection "upgrade";
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Host 10.18.*.*:18789/;
        proxy_pass http://10.18.*.*:18789/;
    }
 
# 设备配对（首次连接）
# 获取登录链接，关注token
docker compose exec openclaw-gateway openclaw dashboard --no-open
# 列出待处理的请求
docker compose exec openclaw-gateway openclaw devices list
# 按请求 ID 批准
docker compose exec openclaw-gateway openclaw devices approve <requestId>
```

管理后台：<https://domain-name/openclaw>

# 安装 Skills

服务器 centos7 不支持 node >= 20，
方式1，利用 docker 下载 skills：

```bash

mkdir -p ~/.openclaw/workspace/skills
 
# 启动交互式 Docker 容器，映射数据卷
docker run -it --rm \
  --name clawhub-installer \
  -v "/root/.openclaw/workspace/skills:/app/skills" \
  -w /app \
  node:24-alpine \
  sh
 
npx clawhub@latest install <skill-slug>
```
方式2，下载zip

```bash
# 安装baidu-search skill
cd ~/.openclaw/workspace/skills
# 从 clawhub 找 zip 下载链接
wget -O baidu-search.zip https://wry-manatee-359.convex.site/api/v1/download?slug=baidu-search
unzip baidu-search.zip -d ./baidu-search

vi .env
# BAIDU_API_KEY=bce-v3/ALTAK-****

# 重启 gateway
cd /opt/docker/openclaw
docker compose exec openclaw-gateway openclaw gateway restart
```

# 相关资料

*   [OpenClaw 官方仓库](https://github.com/openclaw/openclaw)
*   [OpenClaw 官方文档](https://docs.openclaw.ai/zh-CN)
*   [ClawHub 社区](https://clawhub.ai/)，[awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills)，[skillsmp](https://skillsmp.com/)，[skills.sh](https://skills.sh/)
*   [智谱 GLM](https://bigmodel.cn/)，[GLM 免费模型](https://docs.bigmodel.cn/cn/guide/models/free/glm-4.7-flash)，[MiniMax](https://minimaxi.com/)，[LongCat 开放平台](https://longcat.chat/platform/api_keys)
*   [飞书开放平台](https://open.feishu.cn/)
