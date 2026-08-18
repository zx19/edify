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

## QA 上线流程（测试环境，https://qa-xai.xingshulin.com/lomva）

### 0. 上线前检查清单

- [ ] 外部自建 PG：已建 `lomva` / `lomva_plugin` 库 + `uuid-ossp` 扩展（SQL 见「切换托管服务」）
- [ ] `overlays/qa/config/external-services.env`：`DB_HOST` 已填真实地址
- [ ] `overlays/qa/config/secret.env`：已由 `secret.env.example` 复制并填真实密码（gitignored）
- [ ] `base/config/lomva-secret.env`：共享密钥已更换（SECRET_KEY 可留空）
- [ ] 镜像已推送，且 `overlays/qa/kustomization.yaml` 的 `images:` 已取消注释指向你的仓库
- [ ] web 镜像确认带 `NEXT_PUBLIC_BASE_PATH=/lomva` 构建
- [ ] kubectl context 指向 QA 集群（deploy.sh 第一步会打印并要求确认）

### 1. 分阶段上线

```bash
# 阶段一：不接外部流量，先把 Pod 跑起来（对现有环境零影响）
#   临时把 overlays/qa/kustomization.yaml 里的 - ingress.yaml 注释掉
./k8s/scripts/deploy.sh        # 含 rollout 等待 + port-forward 冒烟检查

# 阶段二：确认全部 Ready 后恢复 ingress.yaml 注释，接入流量
./k8s/scripts/deploy.sh
```

> 注意：`kubectl apply` 不删除资源——注释 ingress.yaml 只在 Ingress **尚未创建**时有效；
> 已创建后要断流量必须 `kubectl -n qa-ai delete ingress lomva`（见「回退方案」）。

### 2. 验证清单

- [ ] `kubectl -n qa-ai get pods` 全部 Ready（无 postgres Pod——外部 PG）
- [ ] 冒烟通过：deploy.sh 末尾的 web 200 + `/console/api/version` 返回版本号
- [ ] `https://qa-xai.xingshulin.com/lomva/install` 能打开，创建管理员
- [ ] 配置模型供应商 key，创建应用发一条消息成功
- [ ] 确认旧环境无恙：`https://qa-xai.xingshulin.com/`（旧 dify 根路径）正常

## 线上上线流程（prod）

与 QA 同骨架，差异与额外要求：

1. **按「修改配置」填齐 prod 占位**：namespace（默认 `prod-ai`）、域名（ingress.yaml +
   `config/public-urls.env` + `config/web-public.env`）、`external-services.env`（TencentDB 地址）、
   `secret.env`（由 example 复制，真实密码）、`images:` 仓库地址
2. **TencentDB 侧准备**：建库 SQL 同 QA；**确认自动备份已开启**（控制台默认开，上线前手动做一次备份点）
3. **选低峰期**，提前通知；如线上在独立集群，先确认 kubectl context
4. 分阶段上线与验证清单同 QA（`OVERLAY=k8s/overlays/prod NAMESPACE=prod-ai ./k8s/scripts/deploy.sh`）

## 回退方案

按影响面从小到大选择：

### 1. 快速止血：摘流量（秒级，最常用）

```bash
kubectl -n qa-ai delete ingress lomva        # prod 换 -n prod-ai
```

外部请求立即不再进入本栈（共享域名上其他应用不受影响），Pod 与数据原样保留，排查完
`./k8s/scripts/deploy.sh` 重新接入。 Pod 级故障也可先 `kubectl -n qa-ai rollout restart deploy/api` 试试。

### 2. 配置回退（改错 env 等）

```bash
git revert <错误提交>          # 或手动改回
./k8s/scripts/deploy.sh        # generator hash 变化触发滚动
```

### 3. 镜像回退（新版本有问题）

**前提：新旧版本之间没有破坏性 DB migration**（api 启动会自动 migrate，schema 是单向向前的）。
纯加法 migration（新表/新列）通常可直接回退镜像；含删列/改类型的版本不要直接回退镜像，走第 4 条。

```bash
# 方式一：overlay 的 images newTag 改回旧 tag，重新 deploy.sh（推荐，有 git 记录）
# 方式二：就地回滚到上一版本
kubectl -n qa-ai rollout undo deploy/api deploy/api-websocket deploy/worker deploy/worker-beat deploy/web deploy/agent-backend
kubectl -n qa-ai rollout status deploy/api
```

### 4. 数据回退（migration 已造成破坏）

1. 先摘流量（第 1 条）
2. 恢复 PG 备份：TencentDB 用控制台「回档」到备份点；自建 PG 用上线前的 `pg_dump` 恢复
   （**上线前务必有备份**：`pg_dump -h <host> -U postgres lomva > lomva.bak`，lomva_plugin 同理）
3. 镜像回退到与备份匹配的版本（第 3 条方式一）
4. 验证后重新接入流量

### 5. 全量拆除（仅限首次验证失败、还没真实数据）

```bash
kubectl delete -k k8s/overlays/qa
```

⚠️ 会连 PVC 一起删除：集群内 redis/weaviate 数据与 CBS 卷（默认 Delete 回收策略）将销毁；
外部 PG 库不受影响（需另行手动 DROP）。**有真实数据后禁止使用此方式回退。**

## 修改配置

- 共享非机密：`base/config/lomva-config.env`（api / worker / api-websocket / plugin-daemon 等共用）
- 共享机密默认值：`base/config/lomva-secret.env`（**均为上游 docker-compose 的公开默认值，可入 git**；
  任何环境的真实机密不要写进这里）
- web 前端：`base/config/web-config.env`
- 环境覆盖：`overlays/<env>/config/`（`public-urls.env` 对外 URL、`web-public.env` web 侧、
  `external-services.env` 外部 PG 地址），merge 进同名 ConfigMap
- **环境真实机密**：`overlays/<env>/config/secret.env`——**已被 gitignore，不会提交**；
  由同目录 `secret.env.example` 复制生成后填真实值，merge 进 `lomva-secret`（同名 key 覆盖共享默认值）
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

- 真实机密只放 `overlays/<env>/config/secret.env`（**已 gitignore**）；git 里的
  `base/config/lomva-secret.env` 是上游公开默认值、`secret.env.example` 是占位模板
- 误提交补救：若真实机密已进 git 历史，仅删文件不够，需改写历史（git filter-repo）并更换该机密
- 密钥一致性分组（自定义时必须同值修改，当前默认值已保证一致）：
  - `REDIS_PASSWORD` = `CELERY_BROKER_URL` 与 `DIFY_AGENT_REDIS_URL` 中的密码段（3 处）
  - `INNER_API_KEY_FOR_PLUGIN` = `PLUGIN_DIFY_INNER_API_KEY` = `DIFY_AGENT_INNER_API_KEY`
  - `AGENT_BACKEND_API_TOKEN` = `DIFY_AGENT_API_TOKEN`
  - `SECRET_KEY` 留空则 api 自动生成并持久化到共享 PVC（api/worker/api-websocket 一致）；
    更换它会使数据库中已加密存储的模型凭据不可读，需重新录入
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
