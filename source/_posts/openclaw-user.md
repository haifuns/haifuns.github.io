title: 【AI】OpenClaw 多用户隔离 Docker 部署 & 升级
author: haif.
tags:
  - Agent
categories:
  - AI
date: 2026-03-20 14:00:00

---

# 多用户隔离 Docker 部署

基于本地已经有一份环境了，配置都在默认位置，复制并启动一个新的环境 xx。如果本地未部署，openclaw.json 以及插件需要自行配置。

```bash
# openclaw 仓库位置 /opt/docker/openclaw
mkdir -p /opt/docker/openclaw-docker-user/xx
cp /opt/docker/openclaw/docker-compose.yml /opt/docker/openclaw-docker-user/xx/docker-compose.yml
cp /opt/docker/openclaw/.env /opt/docker/openclaw-docker-user/xx/.env.xx
 
vi /opt/docker/openclaw-docker-user/xx/.env.xx
#OPENCLAW_CONFIG_DIR=/root/.openclaw-xx
#OPENCLAW_WORKSPACE_DIR=/root/.openclaw-xx/workspace
#OPENCLAW_GATEWAY_PORT=17789
#OPENCLAW_BRIDGE_PORT=17790
 
mkdir ~/.openclaw-xx
cp ~/.openclaw/openclaw.json ~/.openclaw-openclaw-xx/openclaw.json
cp -r ~/.openclaw/workspace/skills ~/.openclaw-openclaw-xx/workspace
cp -r ~/.openclaw/extensions/feishu ~/.openclaw-openclaw-xx/extensions
chown -R 1000:1000 ~/.openclaw-xx
 
cd /opt/docker/openclaw-docker-user/xx
# 初始化配置
docker compose --env-file .env.xx run --rm openclaw-cli onboard
 
docker compose --env-file .env.xx up -d
 
# docker exec -it openclaw-xx-openclaw-gateway-1 sh
docker compose --env-file .env.xx exec openclaw-gateway openclaw devices list
docker compose --env-file .env.xx exec openclaw-gateway openclaw devices approve <request-id>
```

# 升级 Docker 部署版本

```bash
cd /opt/docker/openclaw
git fetch --tags
# 切换分支到最新 tag，强制切换
git checkout -f -b v2026.3.13-1 v2026.3.13-1
 
# 构建镜像，禁用缓存
docker build --pull --no-cache -t openclaw:local -f Dockerfile .

cd /opt/docker/openclaw-docker-user/xx
docker compose --env-file .env.xx down
docker compose --env-file .env.xx up -d
```
