# edify Kubernetes 部署（腾讯云 TKE）

本目录提供 edify（Dify）的 Kubernetes 部署清单，基于 Kustomize：

- `base/`：全部组件清单（中间件集群内自建：PostgreSQL / Redis / Weaviate）
- `overlays/tke/`：腾讯云 TKE 环境（CLB Ingress、TCR 镜像替换示例）

组件（与 `docker/docker-compose.yaml` 默认组件集一致）：nginx（入口）、api、api-websocket、worker、worker-beat、web、agent-backend、plugin-daemon、sandbox、local-sandbox、ssrf-proxy、agent-ssrf-proxy、postgres、redis、weaviate、init-permissions（Job）。全部部署在命名空间 `qa-ai`。

## 前置条件

- kubectl ≥ 1.27（内置 `kustomize`，无需单独安装）
- 一个 K8s 集群：TKE 集群，或本地 kind（验证用，Docker Desktop ≥ 8GB 内存）
- TKE：确认集群已装 CLB Ingress Controller（TKE 默认组件），使用默认 CBS StorageClass

## 快速验证（本地 kind）

```bash
kind create cluster --name lomva
kubectl apply -k k8s/base
kubectl -n qa-ai wait --for=condition=available deploy --all --timeout=600s
kubectl -n qa-ai port-forward svc/nginx 8080:80
```

打开 http://localhost:8080/install 创建管理员。验证完 `kind delete cluster --name lomva`。

## TKE 部署（https://qa-xai.xingshulin.com/lomva）

本 overlay 已按**子路径** `https://qa-xai.xingshulin.com/lomva` 配置好：对外 URL 在
`overlays/tke/config/public-urls.env` 和 `web-public.env`，子路径路由在
`overlays/tke/config/nginx/default.conf`（剥前缀转发 api，保留前缀转发 web）。

1. **修改 Secret（必须）**：编辑 `base/config/lomva-secret.env`，更换所有开发默认密钥
   （`SECRET_KEY` 可留空，api 会自动生成并持久化到共享存储）。
2. **构建并推送镜像**：子路径部署要求 **web 镜像必须带 `--build-arg NEXT_PUBLIC_BASE_PATH=/lomva`
   自建**（上游官方镜像只支持根路径）。直接用脚本完成 4 构建 + 2 转推 + 推送：

   ```bash
   TCR_NAMESPACE=ccr.ccs.tencentyun.com/<你的命名空间> ./k8s/scripts/build-images.sh
   ```

   完成后取消 `overlays/tke/kustomization.yaml` 中 `images:` 段注释并替换为你的 TCR 地址。
3. **部署**（apply + 等待就绪 + 冒烟检查，一条命令）：

   ```bash
   ./k8s/scripts/deploy.sh
   ```

   或手动：`kubectl apply -k k8s/overlays/tke && kubectl -n qa-ai wait --for=condition=available deploy --all --timeout=600s`

4. **获取入口**：本集群使用 nginx-ingress controller（共享 CLB），Ingress 创建后
   `kubectl -n qa-ai get ingress lomva` 的 ADDRESS 与现有 `dify-nginx-ingress` 相同——
   流量走现有共享 CLB，**不会新建 CLB，也无需改 DNS**。
   可用 `kubectl -n qa-ai port-forward svc/nginx 18080:80` 先绕过 Ingress 做冒烟验证。
   建议分阶段上线：先临时注释 `overlays/tke/kustomization.yaml` 中的 `- ingress.yaml`
   部署并验证 pod 全部 Ready（对现有环境零影响），再恢复该行使外部流量接入。

## 修改配置

- 共享非机密：`base/config/lomva-config.env`（api / worker / api-websocket / plugin-daemon 等共用）
- 机密：`base/config/lomva-secret.env`
- web 前端：`base/config/web-config.env`
- TKE 环境覆盖（对外 URL、子路径）：`overlays/tke/config/*.env`，merge 进同名 ConfigMap
- 单个组件专属：直接改对应 YAML 里的 `env:` 块

改完重新 `kubectl apply -k ...` 即可——kustomize 会给 ConfigMap/Secret 名加内容 hash，
引用它们的 Pod 自动滚动更新。

## 自建镜像推 TCR（部署本仓库改动）

本仓库可构建 4 个组件镜像，另外 2 个直接转推上游镜像。推荐用脚本一次完成：

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

然后编辑 `overlays/tke/kustomization.yaml`，取消 `images:` 段注释并替换为你的 TCR 地址。
TKE 拉取 TCR 私有镜像需配置访问凭证（TCR 控制台下发，或在集群中创建 imagePullSecret）。

## 存储说明

默认 6 个 PVC 全部走集群默认 StorageClass（TKE 为 CBS，RWO）。注意 CBS 是块存储，
多个 Pod 挂同一 RWO 卷时会被调度到同一节点（`lomva-app-storage` 被 api/worker/api-websocket
共享）。多节点生产环境建议：改用 CFS（文件存储，支持 RWX）建 StorageClass，
或把对象存储切到腾讯云 COS（见下节）。调整容量：编辑对应 PVC 的 `storage` 后重新 apply
（CBS 支持在线扩容）。

## 切换托管服务（可选）

- **TencentDB for PostgreSQL**：删除 `middleware/postgres.yaml`，把 `lomva-config.env`
  的 `DB_HOST`/`DB_PORT` 指向托管实例，`lomva-secret.env` 更新 `DB_PASSWORD`。
- **TencentDB for Redis**：删除 `middleware/redis.yaml`，更新 `REDIS_HOST` 及
  `REDIS_PASSWORD`、`CELERY_BROKER_URL`、`DIFY_AGENT_REDIS_URL`。
- **COS 对象存储**：`lomva-config.env` 设 `STORAGE_TYPE=tencent_cos`，补充
  `TENCENT_COS_BUCKET_NAME` / `TENCENT_COS_REGION` / `TENCENT_COS_SCHEME`，
  `lomva-secret.env` 补充 `TENCENT_COS_SECRET_ID` / `TENCENT_COS_SECRET_KEY`；
  此后 `lomva-app-storage` PVC 仍需保留（SECRET_KEY 等本地状态用）。

## 切换向量库为 pgvector（可选）

1. `lomva-config.env`：`VECTOR_STORE=pgvector`，追加 `PGVECTOR_HOST=pgvector`、`PGVECTOR_PORT=5432`、
   `PGVECTOR_USER=postgres`、`PGVECTOR_DATABASE=dify`；`lomva-secret.env` 追加 `PGVECTOR_PASSWORD=...`
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
  2. `overlays/tke/config/nginx/default.conf`：加 `location /lomva/socket.io/`，剥前缀转发
     `api-websocket:5001/socket.io/`（带 Upgrade 头；服务端零改动）
  3. `overlays/tke/ingress.yaml`：删除根路径 `/socket.io/` 规则
  4. `NEXT_PUBLIC_SOCKET_URL` 保持 origin-only（`wss://qa-xai.xingshulin.com`，不能加子路径）
  5. 重新构建 web 镜像后生效
