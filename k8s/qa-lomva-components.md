# qa-ai-lomva 组件清单（Pods / Services / PVCs）

> 参考文档：QA 环境 `qa-ai-lomva` 命名空间全部工作负载与存储的用途说明。
> 数据快照 2026-08-21；pod 名后缀（ReplicaSet 哈希/随机串）随发布变化，以 Deployment/StatefulSet 名为准。
> 部署/回滚操作见 [README.md](README.md)；事故复盘见 [../docs/postmortems/](../docs/postmortems/)。

## 概览

- 命名空间：`qa-ai-lomva`（独立，勿在其中创建/删除 Namespace 对象）
- 入口：`https://qa-xai.xingshulin.com/lomva` → nginx-ingress（class `nginx-ingress`）→ svc/nginx
- 命名约定：集群内资源一律 `lomva-` 前缀（避开 qa-ai 里的旧 `dify-*` / `xai-*` 栈）
- 外部依赖（**不在命名空间内**）：自建 PostgreSQL（qa-postgres-default.xsl.link），库 `lomva` / `lomva_plugin`

## 架构分层

```
浏览器
  │ https://qa-xai.xingshulin.com/lomva
  ▼
Ingress (nginx-ingress, 共享 CLB)
  ▼
nginx ──────────────► web (Next.js 前端, :3000)
  │ /api,/console/api
  ▼
api (:5001) ──► worker / worker-beat (Celery, 经 redis)
  │             api-websocket (:5001, socket.io 协作)
  ├──► plugin-daemon (:5002) ──► 插件子进程（本地 Python 运行时）
  ├──► sandbox (:8194) ──► ssrf-proxy (:3128) ──► 外网
  ├──► agent-backend (:5050) ──► local-sandbox (:5004) ──► agent-ssrf-proxy (:3128)
  ├──► redis (:6379, 缓存 + Celery broker)
  ├──► weaviate (:8080/:50051, 向量库)
  └──► PostgreSQL（外部自建）
```

## Pods

14 个工作负载（13 Deployment + 2 StatefulSet 中实际 14 pod），全部单副本。

### 入口层

| Pod（工作负载） | 镜像 | 职责 |
|---|---|---|
| lomva-nginx | nginx:1.27-alpine | 统一反向代理：按路径分发到 web / api / api-websocket，处理子路径 `/lomva` 的改写 |
| lomva-web | z123x/lomva-web:1.16.1-edify-2 | Next.js 前端。自建镜像，构建期注入 `NEXT_PUBLIC_BASE_PATH=/lomva`（子路径部署要求） |

### 应用服务层（同一镜像 z123x/lomva-api，不同启动命令）

| Pod（工作负载） | 职责 |
|---|---|
| lomva-api | 主后端（Flask）：REST API、应用编排、会话/鉴权；首次启动跑 DB migration |
| lomva-api-websocket | socket.io 服务：工作流多人协作编辑的实时同步 |
| lomva-worker | Celery worker：异步任务（知识库索引、消息执行、邮件等） |
| lomva-worker-beat | Celery beat：定时任务调度（只发令不执行） |

### 插件与代码执行层

| Pod（工作负载） | 镜像 | 职责 |
|---|---|---|
| lomva-plugin-daemon | langgenius/dify-plugin-daemon:0.6.10-local | 插件运行时宿主：安装/校验插件包，为每个插件拉起本地 Python 子进程；api/worker 经 :5002 调用插件（工具、插件化模型）。**挂了 = 所有工具/插件调用失败** |
| lomva-sandbox | langgenius/dify-sandbox:0.2.15 | 工作流「代码执行」节点的安全沙箱（:8194） |
| lomva-ssrf-proxy | ubuntu/squid | sandbox 出网的正向代理（:3128），防 SSRF：沙箱代码只能经它访问外网 |

### Agent 层（fork 特有，dify-agent 栈）

| Pod（工作负载） | 镜像 | 职责 |
|---|---|---|
| lomva-agent-backend | z123x/lomva-agent-backend:1.16.1-edify-2 | Agent 后端服务（:5050），独立于主 api 的 agent 运行时 |
| lomva-agent-local-sandbox | z123x/lomva-agent-local-sandbox:1.16.1-edify-2 | Agent 的本地沙箱（:5004），执行 agent 产生的代码/命令 |
| lomva-agent-ssrf-proxy | ubuntu/squid | agent 栈专用的 SSRF 代理（:3128），与 dify 主栈的 ssrf-proxy 隔离 |

### 数据层（StatefulSet）

| Pod | 镜像 | 职责 |
|---|---|---|
| lomva-redis-0 | redis:6-alpine | 缓存 + Celery broker + 会话数据 |
| lomva-weaviate-0 | semitechnologies/weaviate:1.27.0 | 向量数据库：知识库 RAG 的 embedding 存储与检索（:8080 HTTP / :50051 gRPC） |

## PVCs

5 个 PVC，全部 Bound。CBS 单盘最小 10Gi，故容量均为下限。

| PVC | 存储类 | 模式 | 挂载方 | 存什么 |
|---|---|---|---|---|
| lomva-app-storage | qa-cfs（文件存储） | **RWX** | api、api-websocket、worker（3 个 Deployment 共挂） | Dify 本地文件存储：用户上传文件、应用附件、生成的图片等。**计划切 COS**（`STORAGE_TYPE=tencent_cos`，含租户私钥在内的全部文件都走 storage 抽象层进对象存储），切换稳定后此 PVC 可删，并解锁 api/worker 多副本 |
| lomva-plugin-storage | qa-cbs（块存储） | RWO | plugin-daemon 独占 | 已安装插件包、插件 Python 虚拟环境、工作目录、缓存 |
| lomva-redis-data | qa-cbs | RWO | redis-0 | Redis 持久化数据（AOF/RDB） |
| lomva-sandbox-deps | qa-cbs | RWO | sandbox | 代码执行节点的 Python 依赖缓存（避免每次冷启动重装） |
| lomva-weaviate-data | qa-cbs | RWO | weaviate-0 | 向量索引数据 |

### 为什么 app-storage 用 CFS、其余用 CBS

- **RWX 是硬需求**：api / api-websocket / worker 是独立 Deployment，K8s 会把它们的 pod 调度到不同节点；CBS 块存储单盘只能挂一台 CVM（RWO），跨节点共挂必然 Multi-Attach 死锁（见 [2026-08-20 复盘](../docs/postmortems/2026-08-20-qa-lomva-first-deploy.md)）。
- **独占卷用 CBS 即可**：其余 4 块卷各自只被一个 pod 使用，RWO 更便宜、性能更好。
- **代价与对策**：RWO + 单副本 Deployment 滚动更新会死锁（新 pod 抢不到盘、旧 pod 不释放）。plugin-daemon 已在清单中固化 `strategy: Recreate`（2026-08-21）；redis/weaviate/sandbox 是 StatefulSet，天然串行重建不受影响。

## 运维速查

| 场景 | 入口 |
|---|---|
| 某 pod 是干什么的 | 查本文「Pods」表（按 `lomva-` 前缀匹配工作负载名） |
| 发布/回滚/改配置 | [README.md](README.md)「QA 上线流程」「回退方案」「修改配置」 |
| 存储扩容 | 编辑对应 PVC 的 `storage` 后重新 apply（CBS/CFS 均支持在线扩容，10Gi 是下限不是上限） |
| 常见故障 | README「FAQ」表 + docs/postmortems/ 两篇复盘 |
| prod 部署差异 | prod 用 TencentDB PG、`prod-cbs`/`prod-cfs` 存储类，见 overlays/prod |
