# edify Kubernetes 部署（腾讯云 TKE）

本目录提供 edify（Dify）的 Kubernetes 部署清单，基于 Kustomize：

- `base/`：全部组件清单（Redis / Weaviate 集群内自建；不含 namespace 与 PostgreSQL）
- `components/incluster-postgres/`：集群内自建 PostgreSQL（kustomize Component，可选件）
- `overlays/subpath/`：`/lomva` 子路径部署的中间层（nginx 路由替换 + 探针修正），**不直接部署**，供 qa/prod 引用
- `overlays/qa/`：**测试环境**（`qa-xai.xingshulin.com/lomva`，外部自建 PG，命名空间 `qa-ai`）
- `overlays/prod/`：**线上环境**（外部 TencentDB PG，命名空间 `prod-ai`；域名等为占位符，部署前必改）
- `overlays/local/`：本地 kind 验证环境（base + 集群内自建 PG，命名空间 `qa-ai`）

组件（与 `docker/docker-compose.yaml` 默认组件集一致）：nginx（入口）、api、api-websocket、worker、worker-beat、web、agent-backend、plugin-daemon、sandbox、local-sandbox、ssrf-proxy、agent-ssrf-proxy、postgres（仅 local）、redis、weaviate、init-permissions（Job）。

## 前置条件

- kubectl ≥ 1.27（内置 `kustomize`，无需单独安装）
- 一个 K8s 集群：TKE 集群，或本地 kind（验证用，Docker Desktop ≥ 8GB 内存）
- 集群已装 nginx-ingress controller（本集群 class 名 `nginx-ingress`，共享 CLB 按 path 合并规则），
  使用默认 StorageClass（TKE 为 CBS，kind 为 standard）

## 快速验证（本地 kind）

```bash
kind create cluster --name lomva
kubectl apply -k k8s/overlays/local
kubectl -n qa-ai wait --for=condition=available deploy --all --timeout=600s
kubectl -n qa-ai port-forward svc/nginx 8080:80
```

打开 http://localhost:8080/install 创建管理员。验证完 `kind delete cluster --name lomva`。
（也可用脚本：`OVERLAY=k8s/overlays/local SMOKE_PATH= ./k8s/scripts/deploy.sh`）

## QA 部署（测试环境，https://qa-xai.xingshulin.com/lomva）

本 overlay 已按**子路径** `https://qa-xai.xingshulin.com/lomva` 配置好：对外 URL 在
`overlays/qa/config/public-urls.env` 和 `web-public.env`，子路径路由在
`overlays/subpath/config/nginx/default.conf`（剥前缀转发 api，保留前缀转发 web）。
PG 为**外部自建实例**（独立域名，集群内不起 postgres Pod）。

1. **配置外部 PG（必须）**：在实例上建好库和扩展（SQL 见「切换托管服务」一节），编辑
   `overlays/qa/config/external-services.env` 填 `DB_HOST`，`overlays/qa/config/secret.env` 填 `DB_PASSWORD`。
2. **修改共享 Secret（必须）**：编辑 `base/config/lomva-secret.env`，更换所有开发默认密钥
   （`SECRET_KEY` 可留空，api 会自动生成并持久化到共享存储）。
3. **构建并推送镜像**：子路径部署要求 **web 镜像必须带 `--build-arg NEXT_PUBLIC_BASE_PATH=/lomva`
   自建**（上游官方镜像只支持根路径）。用 GitHub Actions 推 Docker Hub 或本地脚本推 TCR，
   见下文「自建镜像推送」；完成后取消 `overlays/qa/kustomization.yaml` 中 `images:` 段注释并替换为你的仓库地址。
4. **部署**（apply + 等待就绪 + 冒烟检查，一条命令）：

   ```bash
   ./k8s/scripts/deploy.sh
   ```

   或手动：`kubectl apply -k k8s/overlays/qa && kubectl -n qa-ai wait --for=condition=available deploy --all --timeout=600s`

5. **获取入口**：本集群使用 nginx-ingress controller（共享 CLB），Ingress 创建后
   `kubectl -n qa-ai get ingress lomva` 的 ADDRESS 与现有 `dify-nginx-ingress` 相同——
   流量走现有共享 CLB，**不会新建 CLB，也无需改 DNS**。
   可用 `kubectl -n qa-ai port-forward svc/nginx 18080:80` 先绕过 Ingress 做冒烟验证。
   建议分阶段上线：先临时注释 `overlays/qa/kustomization.yaml` 中的 `- ingress.yaml`
   部署并验证 pod 全部 Ready（对现有环境零影响），再恢复该行使外部流量接入。

## 线上部署（prod）

与 QA 同构，差异：外部 **TencentDB** PG、命名空间 `prod-ai`、域名占位。部署前必改：

| 位置 | 改什么 |
|---|---|
| `overlays/prod/kustomization.yaml` + `namespace.yaml` | 命名空间（默认 `prod-ai`） |
| `overlays/prod/ingress.yaml` | `host` 改线上域名；ingressClassName 按线上集群确认 |
| `overlays/prod/config/public-urls.env`、`web-public.env` | 线上域名（5 处 + 3 处） |
| `overlays/prod/config/external-services.env` | TencentDB 内网地址 |
| `overlays/prod/config/secret.env` | `DB_PASSWORD`（及其余密钥覆盖） |
| `overlays/prod/kustomization.yaml` | 取消 `images:` 注释、替换镜像仓库地址 |

部署（注意线上集群的 kubectl context 可能不同）：

```bash
OVERLAY=k8s/overlays/prod NAMESPACE=prod-ai ./k8s/scripts/deploy.sh
```

## 修改配置

- 共享非机密：`base/config/lomva-config.env`（api / worker / api-websocket / plugin-daemon 等共用）
- 共享机密：`base/config/lomva-secret.env`（dev 默认值，任何环境部署前都必须更换）
- web 前端：`base/config/web-config.env`
- 环境覆盖：`overlays/<env>/config/`（`public-urls.env` 对外 URL、`web-public.env` web 侧、
  `external-services.env` 外部 PG、`secret.env` 环境专属机密），merge 进同名 ConfigMap/Secret
- 子路径 nginx 路由：`overlays/subpath/config/nginx/`（qa/prod 共用）
- 单个组件专属：直接改对应 YAML 里的 `env:` 块

改完重新 `kubectl apply -k ...` 即可——kustomize 会给 ConfigMap/Secret 名加内容 hash，
引用它们的 Pod 自动滚动更新。

## 自建镜像推送（部署本仓库改动）

本仓库可构建 4 个组件镜像，另外 2 个直接复用上游镜像。两种方式任选：

### 方式 A：GitHub Actions 构建推 Docker Hub（免本地构建）

在仓库 **Settings → Secrets and variables → Actions** 配置 `DOCKERHUB_USER`（Docker Hub 用户名）
和 `DOCKERHUB_TOKEN`（Access Token），然后 **Actions → Build and Push Lomva Images → Run workflow**
（tag 默认 `1.16.1-edify`，base_path 默认 `/lomva`）。产出 `<用户名>/lomva-{api,web,agent-backend,agent-local-sandbox}`。
sandbox / plugin-daemon 已在 Docker Hub 官方仓库（`langgenius/...`），集群直接拉取即可。

> 注意：私有仓库跑 GH-hosted runner 消耗账号的 Actions 分钟数；web 镜像构建约 10~20 分钟。

### 方式 B：本地构建推 TCR

```bash
TCR_NAMESPACE=ccr.ccs.tencentyun.com/<你的命名空间> ./k8s/scripts/build-images.sh
# 可选环境变量：TAG（默认 1.16.1-edify）、NEXT_PUBLIC_BASE_PATH（默认 /lomva）、PLATFORM（默认 linux/amd64）
```

脚本等价的手动命令：

```bash
TCR=ccr.ccs.tencentyun.com/<你的命名空间>
TAG=1.16.1-edify

# 本仓库构建（在仓库根目录执行）
docker buildx build --platform linux/amd64 -t $TCR/lomva-api:$TAG -f api/Dockerfile api --push
# 子路径部署必须带 NEXT_PUBLIC_BASE_PATH；若改为根路径部署可去掉该 build-arg
docker buildx build --platform linux/amd64 --build-arg NEXT_PUBLIC_BASE_PATH=/lomva -t $TCR/lomva-web:$TAG -f web/Dockerfile web --push
docker buildx build --platform linux/amd64 -t $TCR/lomva-agent-backend:$TAG -f dify-agent/Dockerfile dify-agent --push
docker buildx build --platform linux/amd64 -t $TCR/lomva-agent-local-sandbox:$TAG -f dify-agent-runtime/docker/Dockerfile dify-agent-runtime --push

# 上游镜像转推（sandbox / plugin-daemon 源码不在本仓库）
docker pull --platform linux/amd64 langgenius/dify-sandbox:0.2.15
docker tag langgenius/dify-sandbox:0.2.15 $TCR/lomva-sandbox:0.2.15
docker push $TCR/lomva-sandbox:0.2.15
docker pull --platform linux/amd64 langgenius/dify-plugin-daemon:0.6.10-local
docker tag langgenius/dify-plugin-daemon:0.6.10-local $TCR/lomva-plugin-daemon:0.6.10-local
docker push $TCR/lomva-plugin-daemon:0.6.10-local
```

然后编辑对应环境 overlay 的 `kustomization.yaml`（如 `overlays/qa/`），取消 `images:` 段注释并替换为你的仓库地址。
TKE 拉取 TCR 私有镜像需配置访问凭证（TCR 控制台下发，或在集群中创建 imagePullSecret）。

## 存储说明

默认 6 个 PVC 全部走集群默认 StorageClass（TKE 为 CBS，RWO）。注意 CBS 是块存储，
多个 Pod 挂同一 RWO 卷时会被调度到同一节点（`lomva-app-storage` 被 api/worker/api-websocket
共享）。多节点生产环境建议：改用 CFS（文件存储，支持 RWX）建 StorageClass，
或把对象存储切到腾讯云 COS（见下节）。调整容量：编辑对应 PVC 的 `storage` 后重新 apply
（CBS 支持在线扩容）。

## 切换托管服务（可选）

各组件的 wait initContainer 跟随 `DB_HOST`/`DB_PORT` 配置，切换数据库无需改 YAML。
默认：qa 用**外部自建 PG**、prod 用**外部 TencentDB**、local 用集群内自建 PG。

- **PostgreSQL**：外部实例上用高权限账号建两个库并在主库预建扩展：
  ```sql
  CREATE DATABASE lomva OWNER <应用账号>;
  CREATE DATABASE lomva_plugin OWNER <应用账号>;
  \c lomva
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- 主库 init 迁移依赖，扩展是库级的
  ```
  地址/密码在各环境的 `config/external-services.env` 与 `config/secret.env`。
  某环境如需改回集群内自建 PG：给该环境的 kustomization.yaml 加
  `components: [- ../../components/incluster-postgres]`，并把 `DB_HOST` 改回 `postgres`。
- **TencentDB for Redis**：删除 `base/middleware/redis.yaml` 的引用，更新 `REDIS_HOST` 及
  `REDIS_PASSWORD`、`CELERY_BROKER_URL`、`DIFY_AGENT_REDIS_URL`。
- **COS 对象存储**：`lomva-config.env` 设 `STORAGE_TYPE=tencent_cos`，补充
  `TENCENT_COS_BUCKET_NAME` / `TENCENT_COS_REGION` / `TENCENT_COS_SCHEME`，
  `lomva-secret.env` 补充 `TENCENT_COS_SECRET_ID` / `TENCENT_COS_SECRET_KEY`；
  此后 `lomva-app-storage` PVC 仍需保留（SECRET_KEY 等本地状态用）。

## 切换向量库为 pgvector（可选）

1. `lomva-config.env`：`VECTOR_STORE=pgvector`，追加 `PGVECTOR_HOST=pgvector`、`PGVECTOR_PORT=5432`、
   `PGVECTOR_USER=postgres`、`PGVECTOR_DATABASE=lomva`；`lomva-secret.env` 追加 `PGVECTOR_PASSWORD=...`
2. 仿照 `base/middleware/weaviate.yaml` 新建 `pgvector.yaml`（镜像 `pgvector/pgvector:pg16`，
   端口 5432，PVC 挂 `/var/lib/postgresql/data`），并加入 kustomization resources。

## FAQ

| 现象 | 排查 |
|---|---|
| 页面 404 / 白屏、`_next` 静态资源加载失败 | web 镜像未带子路径构建：必须用 `--build-arg NEXT_PUBLIC_BASE_PATH=/lomva` 重新构建 |
| 工作流协作不生效（多人编辑无同步） | 确认 `/socket.io/` 未被同 host 其他 Ingress 占用：`kubectl -n qa-ai describe ingress lomva` 看是否有冲突事件（nginx-ingress 对重复 host+path 取创建时间最老者） |
| 上传文件报 413 | Ingress 的 `proxy-body-size` 注解未生效；确认注解值 ≥ 应用上传上限 |
| Pod `ImagePullBackOff` | TKE 拉 Docker Hub 慢/限流：改用上方 TCR 流程，或为集群配置镜像加速 |
| PVC 一直 `Pending` | `kubectl get sc` 确认存在 default StorageClass；TKE 默认有 `cbs`，kind 为 `standard` |
| api 一直 `Init:0/2` | 在等 postgres/redis 就绪或 init-permissions Job：`kubectl -n qa-ai logs job/init-permissions` |
| api `CrashLoopBackOff` | `kubectl -n qa-ai logs deploy/api`；首次启动 migration 需几分钟，startupProbe 已兜底 |
| local-sandbox 报 Landlock 相关错误 | 节点内核 < 5.13 不支持：把 `runtime/local-sandbox.yaml` 的 `SHELLCTL_ENABLE_PATH_ISOLATION` 改为 `"false"` |
| 页面能开但发消息报错 | 检查模型供应商 key；`kubectl -n qa-ai logs deploy/plugin-daemon` / `deploy/worker` |
| 改完配置 Pod 没变化 | 正常应自动滚动（generator hash）；若直接改了生成的 ConfigMap 则需手动 `kubectl -n qa-ai rollout restart` |

## 安全说明

- `lomva-secret.env` 内为公开的开发默认值，**生产部署前必须全部更换**
- 本清单未配 NetworkPolicy（compose 的网络隔离未翻译到 K8s）；生产建议为
  ssrf-proxy / local-sandbox 增加 NetworkPolicy 限制出向流量

## 待办

- **socket.io 路径收进 `/lomva/`**（2026-08-17 记录，暂未实施）：当前协作 WebSocket 占用共享域名根路径
  `/socket.io/`（因 socket.io client 的 path 写死，URL 子路径会被当作 namespace）。改为 `/lomva/socket.io/` 需要：
  1. web 源码 `web/app/components/workflow/collaboration/core/websocket-manager.ts`：
     `socketOptions.path` 从 `NEXT_PUBLIC_BASE_PATH` 派生（`${BASE_PATH}/socket.io`，basePath 为空时行为与上游一致）
  2. `overlays/subpath/config/nginx/default.conf`：加 `location /lomva/socket.io/`，剥前缀转发
     `api-websocket:5001/socket.io/`（带 Upgrade 头；服务端零改动）
  3. `overlays/qa/ingress.yaml`、`overlays/prod/ingress.yaml`：删除根路径 `/socket.io/` 规则
  4. `NEXT_PUBLIC_SOCKET_URL` 保持 origin-only（`wss://qa-xai.xingshulin.com`，不能加子路径）
  5. 重新构建 web 镜像后生效
