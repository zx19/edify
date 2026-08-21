# edify Kubernetes 部署（腾讯云 TKE）

本目录提供 edify（Dify）的 Kubernetes 部署清单，基于 Kustomize：

- `base/`：全部组件清单（Redis / Weaviate 集群内自建；不含 namespace 与 PostgreSQL）
- `components/incluster-postgres/`：集群内自建 PostgreSQL（kustomize Component，可选件）
- `overlays/subpath/`：`/lomva` 子路径部署的中间层（nginx 路由替换 + 探针修正），**不直接部署**，供 qa/prod 引用
- `overlays/qa/`：**测试环境**（`qa-xai.xingshulin.com/lomva`，外部自建 PG，命名空间 `qa-ai-lomva`）
- `overlays/prod/`：**线上环境**（外部 TencentDB PG，命名空间 `prod-ai-lomva`；域名等为占位符，部署前必改）
- `overlays/local/`：本地 kind 验证环境（base + 集群内自建 PG，命名空间 `qa-ai-lomva`）

组件（与 `docker/docker-compose.yaml` 默认组件集一致）：nginx（入口）、api、api-websocket、worker、worker-beat、web、agent-backend、plugin-daemon、sandbox、local-sandbox、ssrf-proxy、agent-ssrf-proxy、postgres（仅 local）、redis、weaviate、init-permissions（Job）。

## 前置条件

- kubectl ≥ 1.27（内置 `kustomize`，无需单独安装）
- 一个 K8s 集群：TKE 集群，或本地 kind（验证用，Docker Desktop ≥ 8GB 内存）
- 集群已装 nginx-ingress controller（本集群 class 名 `nginx-ingress`，共享 CLB 按 path 合并规则），
  使用默认 StorageClass（TKE 为 CBS，kind 为 standard）

## 快速验证（本地 kind）

```bash
kind create cluster --name lomva
kubectl create ns qa-ai-lomva          # 命名空间不由清单管理，手动创建一次
kubectl apply -k k8s/overlays/local
kubectl -n qa-ai-lomva wait --for=condition=available deploy --all --timeout=600s
kubectl -n qa-ai-lomva port-forward svc/nginx 8080:80
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
- [ ] 命名空间已存在（没有则 `kubectl create ns qa-ai-lomva`；**本清单不创建/删除 Namespace**，
  `delete -k` 不会误伤共享命名空间里的其他栈）
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
> 已创建后要断流量必须 `kubectl -n qa-ai-lomva delete ingress lomva`（见「回退方案」）。

### 2. 验证清单

- [ ] `kubectl -n qa-ai-lomva get pods` 全部 Ready（无 postgres Pod——外部 PG）
- [ ] 冒烟通过：deploy.sh 末尾的 web 200 + `/console/api/version` 返回版本号
- [ ] `https://qa-xai.xingshulin.com/lomva/install` 能打开，创建管理员
- [ ] 配置模型供应商 key，创建应用发一条消息成功
- [ ] 确认旧环境无恙：`https://qa-xai.xingshulin.com/`（旧 dify 根路径）正常

## 线上上线流程（prod）

与 QA 同骨架，差异与额外要求：

1. **按「修改配置」填齐 prod 占位**：namespace（默认 `prod-ai-lomva`）、域名（ingress.yaml +
   `config/public-urls.env` + `config/web-public.env`）、`external-services.env`（TencentDB 地址）、
   `secret.env`（由 example 复制，真实密码）、`images:` 仓库地址
2. **TencentDB 侧准备**：建库 SQL 同 QA；**确认自动备份已开启**（控制台默认开，上线前手动做一次备份点）
3. **选低峰期**，提前通知；如线上在独立集群，先确认 kubectl context
4. 分阶段上线与验证清单同 QA（`OVERLAY=k8s/overlays/prod NAMESPACE=prod-ai-lomva ./k8s/scripts/deploy.sh`）

## 回退方案

按影响面从小到大选择：

### 1. 快速止血：摘流量（秒级，最常用）

```bash
kubectl -n qa-ai-lomva delete ingress lomva        # prod 换 -n prod-ai-lomva
```

外部请求立即不再进入本栈（共享域名上其他应用不受影响），Pod 与数据原样保留，排查完
`./k8s/scripts/deploy.sh` 重新接入。 Pod 级故障也可先 `kubectl -n qa-ai-lomva rollout restart deploy/lomva-api` 试试。

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
kubectl -n qa-ai-lomva rollout undo deploy/lomva-api deploy/lomva-api-websocket deploy/lomva-worker deploy/lomva-worker-beat deploy/lomva-web deploy/lomva-agent-backend
kubectl -n qa-ai-lomva rollout status deploy/lomva-api
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

清单不含 Namespace 对象，此操作只影响本栈资源（共享命名空间内其他栈不受影响）。
⚠️ 但仍会连 PVC 一起删除：集群内 redis/weaviate 数据与云盘将销毁（注意本集群 qa-cbs/qa-cfs 为
Retain，PV 会转 Released 保留数据，可重建 PVC 绑回；默认 cbs 类为 Delete 则直接销毁）。
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

# 本仓库构建（在仓库根目录执行；api/web/agent-backend 以仓库根为构建上下文）
docker buildx build --platform linux/amd64 -t $TCR/lomva-api:$TAG -f api/Dockerfile . --push
# 子路径部署必须带 NEXT_PUBLIC_BASE_PATH；若改为根路径部署可去掉该 build-arg
docker buildx build --platform linux/amd64 --build-arg NEXT_PUBLIC_BASE_PATH=/lomva -t $TCR/lomva-web:$TAG -f web/Dockerfile . --push
docker buildx build --platform linux/amd64 -t $TCR/lomva-agent-backend:$TAG -f dify-agent/Dockerfile . --push
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
**单盘最小 10Gi**（所有 PVC 已按此下限设置，调小会 provisioning 失败）；
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
  **切换前先把 `.dify_secret_key` 与 `privkeys/` 搬进 COS**（否则已加密的模型凭据不可读），
  稳定后 `lomva-app-storage` PVC 可删（详见「待办」COS 条）。

## 切换向量库为 pgvector（可选）

1. `lomva-config.env`：`VECTOR_STORE=pgvector`，追加 `PGVECTOR_HOST=pgvector`、`PGVECTOR_PORT=5432`、
   `PGVECTOR_USER=postgres`、`PGVECTOR_DATABASE=lomva`；`lomva-secret.env` 追加 `PGVECTOR_PASSWORD=...`
2. 仿照 `base/middleware/weaviate.yaml` 新建 `pgvector.yaml`（镜像 `pgvector/pgvector:pg16`，
   端口 5432，PVC 挂 `/var/lib/postgresql/data`），并加入 kustomization resources。

## FAQ

| 现象 | 排查 |
|---|---|
| 页面 404 / 白屏、`_next` 静态资源加载失败 | web 镜像未带子路径构建：必须用 `--build-arg NEXT_PUBLIC_BASE_PATH=/lomva` 重新构建 |
| 工作流协作不生效（多人编辑无同步） | 确认 `/socket.io/` 未被同 host 其他 Ingress 占用：`kubectl -n qa-ai-lomva describe ingress lomva` 看是否有冲突事件（nginx-ingress 对重复 host+path 取创建时间最老者） |
| 上传文件报 413 | Ingress 的 `proxy-body-size` 注解未生效；确认注解值 ≥ 应用上传上限 |
| Pod `ImagePullBackOff` | TKE 拉 Docker Hub 慢/限流：改用上方 TCR 流程，或为集群配置镜像加速 |
| PVC 一直 `Pending` | `kubectl -n qa-ai-lomva describe pvc <名>` 看 Events：`disk size is invalid` = 低于 CBS 10Gi 下限；`storageclass not found` 等 = `kubectl get sc` 确认默认类（TKE 一般为 `cbs`，kind 为 `standard`） |
| api 一直 `Init:0/2` | 在等 postgres/redis 就绪或 init-permissions Job：`kubectl -n qa-ai-lomva logs job/lomva-init-permissions` |
| api `CrashLoopBackOff` | `kubectl -n qa-ai-lomva logs deploy/lomva-api`；首次启动 migration 需几分钟，startupProbe 已兜底 |
| local-sandbox 报 Landlock 相关错误 | 节点内核 < 5.13 不支持：把 `runtime/local-sandbox.yaml` 的 `SHELLCTL_ENABLE_PATH_ISOLATION` 改为 `"false"` |
| 页面能开但发消息报错 | 检查模型供应商 key；`kubectl -n qa-ai-lomva logs deploy/lomva-plugin-daemon` / `deploy/lomva-worker` |
| 改完配置 Pod 没变化 | 正常应自动滚动（generator hash）；若直接改了生成的 ConfigMap 则需手动 `kubectl -n qa-ai-lomva rollout restart` |

## 安全说明

- 真实机密只放 `overlays/<env>/config/secret.env`（**已 gitignore**）；git 里的
  `base/config/lomva-secret.env` 是上游公开默认值、`secret.env.example` 是占位模板
- **必须覆盖全部默认密钥（qa 已于 2026-08-21 完成轮换）**：共享集群无
  NetworkPolicy 隔离（见下条），同集群任意 pod 可直连本栈 Service；只换
  `DB_PASSWORD`/`SECRET_KEY` 时，redis/weaviate/sandbox/plugin/agent 仍是上游
  公开默认值（`difyai123456` 等），等效未授权--redis 可被 FLUSHALL/注入 celery
  任务，sandbox 可用公开 key 执行任意代码，local-sandbox 的
  `DIFY_AGENT_LOCAL_SANDBOX_AUTH_TOKEN` 为空即无认证。覆盖时按下方一致性分组
  同值修改；换 redis 密码需同时更新 `CELERY_BROKER_URL`/`DIFY_AGENT_REDIS_URL`
  两个连接串，并滚动重启 redis 与全部使用方。**注意
  `DIFY_AGENT_SERVER_SECRET_KEY` 的格式：无填充 base64url 且解码后恰为 32 字节**
  （`openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`），hex/普通 base64 都会让
  agent-backend 启动即 ValidationError
- 误提交补救：若真实机密已进 git 历史，仅删文件不够，需改写历史（git filter-repo）并更换该机密
- 密钥一致性分组（自定义时必须同值修改，当前默认值已保证一致）：
  - `REDIS_PASSWORD` = `CELERY_BROKER_URL` 与 `DIFY_AGENT_REDIS_URL` 中的密码段（3 处）
  - `INNER_API_KEY_FOR_PLUGIN` = `PLUGIN_DIFY_INNER_API_KEY` = `DIFY_AGENT_INNER_API_KEY`
  - `AGENT_BACKEND_API_TOKEN` = `DIFY_AGENT_API_TOKEN`
  - `SECRET_KEY` 留空则 api 自动生成并持久化到共享 PVC（api/worker/api-websocket 一致）；
    更换它会使数据库中已加密存储的模型凭据不可读，需重新录入
- NetworkPolicy（`base/network-policy.yaml`，**已设计、此集群不可用**，2026-08-21
  实测结论）：sandbox / local-sandbox 出向仅放行各自 ssrf 代理 + kube-dns，代理
  出向全放行。**qa-ai 集群拿到权限并实测：deny-all policy 选中 pod 后外网直连、
  DNS、pod 间（redis:6379）全部照通--集群不执行 NetworkPolicy**（Global Router
  模式；`tke-eni-agent` 在跑是假信号，混合模式也跑它）。apply 只会得到"配置成功
  但零防护"的错觉，故清单保持不引用。**后续路径**：prod 建集群时选 VPC-CNI
  独立网卡模式（支持 NetworkPolicy），本清单直接可用；qa 集群除非换网络插件否则
  无解。**因此认证是当前唯一有效防线**：见下条默认凭据要求。ingress 收紧与
  redis/weaviate 白名单的设计随清单保留，启用条件同上

## 待办

- ~~socket.io 路径收进 `/lomva/`~~（2026-08-21 已实施，见对应 commit）：web 端
  `socketOptions.path` 从 `NEXT_PUBLIC_BASE_PATH` 派生；nginx 改 `location /lomva/socket.io/`
  剥前缀转发；qa/prod ingress 删除根路径 `/socket.io/` 规则。**注意部署顺序**：
  需与新 web 镜像同时生效（旧镜像仍请求根路径，先 apply 会导致协作功能 404 直至新镜像上线）
- **COS 对象存储**（2026-08-21 细化方案）：api 与 plugin-daemon 切腾讯 COS（当前 QA app 用 CFS RWX、
  plugin 用 CBS RWO；prod overlay 用 prod-cfs）。**优先级：app 必做**（api/worker 多副本 HA 的前置）；
  **plugin 建议同批顺手做、非前置**——滚动死锁已被 `strategy: Recreate` 根治，local+Recreate 是合法稳态，
  plugin 切 COS 的剩余收益仅多副本/零停机发布；同批做的理由是当前仅装 1 个插件、试错成本最低。
  - app 侧：`STORAGE_TYPE=tencent_cos` + `TENCENT_COS_BUCKET_NAME` / `TENCENT_COS_REGION` / `TENCENT_COS_SCHEME`
  - plugin 侧：`PLUGIN_STORAGE_TYPE=tencent_cos` + `PLUGIN_STORAGE_OSS_BUCKET`（桶全名须带 `-APPID`）；
    `TENCENT_COS_SECRET_ID/KEY/REGION` 两侧同名，经 envFrom 共用；`TENCENT_COS_ENDPOINT` 可省（默认拼 myqcloud 域名）
  - **桶策略：QA 同桶**（默认 key 前缀天然不冲突：app `upload_files/`、`privkeys/`；
    plugin `plugin/`、`plugin_packages/`、`assets/`）**；prod 分桶**（CAM 按桶授权、生命周期/账单独立；
    分桶且用不同密钥时，一侧需在 Deployment 容器级 env 覆盖同名 SECRET_ID/KEY）
  - **迁移要点（易踩）**：`.dify_secret_key`（SECRET_KEY 留空时自动生成，见 `api/configs/secret_key.py`）
    与 `privkeys/`（租户加密私钥，`api/libs/rsa.py`）都走 storage 抽象层——**必须先搬进 COS**，
    否则新后端会重新生成 SECRET_KEY，数据库已加密的模型凭据全部不可读；
    其余上传文件 QA 可直接丢、插件重装即可（插件安装记录在 PG，包实体在旧盘）
  - **venv 机制（0.6.10 源码核实）**：COS 只存插件包；本地 `cwd` 是缓存——目录非空跳过解压、
    venv 有效跳过重建、损坏自动重建（`environment.go` / `environment_python.go`）。
    因此 **venv 重建只发生在 emptyDir 终态**（pod 重建后首次调用该插件时逐插件重建，
    有 Redis 分布式锁防跨 pod 并发）；**保留 PVC 则切 COS 后零冷启动**，emptyDir 改造可缓到多副本之前再做
  - plugin 侧配 `PIP_MIRROR_URL=https://mirrors.cloud.tencent.com/pypi/simple`（为 emptyDir 终态的冷启动预备）
  - 切换稳定后：删 `lomva-app-storage` PVC；api/worker 解锁多副本。
    终态（多副本前）：`lomva-plugin-storage` 改 `emptyDir` 并删除 PVC、plugin-daemon `strategy` 改回 RollingUpdate
  - **prod 第一天就配 COS，不做迁移**；切换前修正「切换托管服务」节"SECRET_KEY 等本地状态用"的旧表述
- **向量库外置**：weaviate → **pgvector**（复用外部 PG，中小规模知识库首选，步骤见「切换向量库为 pgvector」）
  或 **Tencent VectorDB**（`VECTOR_STORE=tencent` 原生支持，大规模/高 QPS 选）；
  决策并切换后删 `lomva-weaviate-data` PVC 与 weaviate StatefulSet
- **日志接 CLS + 告警**（2026-08-21 教训）：pod 重建后 `kubectl logs` 即失效；plugin-daemon 曾 Init 卡死
  17 小时无人发现。至少为「pod 长时间非 Running」「readiness 持续失败」配告警
- **Secret 管理外置**：`secret.env` 散落在各操作机器；评估腾讯云 SSM + External Secrets Operator
- **Redis → TencentDB for Redis**：prod 决策项（方法见「切换托管服务」），切换后删 redis StatefulSet 与 PVC
- **多副本 HA 调优**：依赖 COS；另含滚动部署策略（plugin-daemon 已改 Recreate，其余组件待评估）
- **镜像仓库选址**：当前 Docker Hub `z123x/lomva-*`；是否迁 TCR 未定
- **Jenkins 问题**：（待补充细节）
- **NetworkPolicy**：qa-ai 集群实测不执行（GR 模式，见安全节），**唯一出路是
  prod 建集群选 VPC-CNI 后启用清单**；届时顺带评估 ingress 收紧（先实测 kubelet
  probe 是否被节点流量拦截，参考实现 xsldify 版有缺 DNS 放行与 probe 两坑）、
  redis/weaviate ingress 白名单、全量 default-deny
- **prod 首次部署前提**：建 `prod-cfs` SC；确认 prod 集群是否多 AZ（多则建 WFFC SC）；
  填域名与 `secret.env`；`kubectl diff -k` 预览后再 apply
- **构建提速后续**（2026-08-21 已做一轮，9min→7m13s）：缓存导出仍 210s，下一步评估
  `type=registry` 缓存（Docker Hub buildcache tag）替代 GHA cache
- **浏览器缓存残留**：故障期 nginx 的 301（绝对 http Location）被浏览器永久缓存，
  各端需清一次站点数据

### 2026-08-21 全量 review 待修项（按建议顺序）

- **F2 sandbox 补 `strategy: Recreate`**：`lomva-sandbox-deps` 是 CBS RWO，Deployment
  默认 RollingUpdate，滚动时新 pod 落别的节点会 Multi-Attach 卡死（plugin-daemon
  同款事故，plugin 已修 sandbox 漏了）
- **F6 redis 加持久化**：`redis-server` 补 `--appendonly yes`，否则 pod 重启丢
  celery 队列/缓存/协作会话
- **F3 api-websocket 显式 `MIGRATION_ENABLED=false`**：当前与 api 共享 true，
  冷启动两个入口并发 `flask db upgrade`，竞态未定义；也是 api 多副本的前置
  （migration 应收敛为独立 Job）
- **F4 prod 预填自建镜像**：prod kustomization `images:` 整段注释着，直接 apply
  会拉上游 langgenius 镜像踩已知的接口分叉 404 + web 无 basePath 坑；
  预填 `z123x/lomva-*` 占位 tag
- **F5 容器 resources**：全组件无 requests/limits（BestEffort QoS，共享集群节点
  有压力时最先被驱逐）；prod 上线前至少给 api/worker/web/nginx/plugin-daemon
  配 requests
- **F7 sandbox config 硬化**：`config/sandbox/config.yaml` 的 `debug: True` 改
  False、`key: dify-sandbox` 硬编码与 secret 双来源易漂移、`worker_timeout: 5`
  与 env `WORKER_TIMEOUT=15` 冲突
- **F8 注释漂移**：qa/prod `web-public.env` 的 socket.io 注释还是旧方案（已随
  9f2fd0549c 改为 basePath 派生）；subpath kustomization 注释说 proxy.conf 是
  "相同副本"，实际 subpath 版改了 X-Forwarded-Proto（照注释同步会复现
  Mixed Content 事故）
- **F9 prod 决策项**：CORS `*` 收敛；api `SERVER_WORKER_CONNECTIONS=10` 容量评估