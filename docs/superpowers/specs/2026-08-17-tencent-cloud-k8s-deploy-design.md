# edify 腾讯云 TKE 部署清单设计

日期：2026-08-17
状态：已确认（用户已批准）

## 背景与目标

edify（Dify fork）当前仅有 docker-compose 部署资产（`docker/`），仓库中没有任何 K8s / Helm 资产。本设计产出一套可部署到腾讯云 TKE 的 Kubernetes 清单与配套文档。

**目标**：团队成员拿到清单后可一次性把 edify 全组件部署到 TKE（或本地 kind）并跑通核心链路。

## 关键决策（来自需求澄清）

| 决策点 | 结论 |
|---|---|
| 交付物形态 | K8s 部署清单 + 部署文档，提交到本仓库；不实际部署到真实集群 |
| 中间件 | 集群内自建（PostgreSQL / Redis / Weaviate 以 Pod 运行） |
| 镜像来源 | 两者兼顾：base 默认上游官方镜像，overlay 可整体替换为 TCR 自建镜像，文档给出构建推送流程 |
| 清单形态 | 静态 YAML + Kustomize（base + overlay），无 Helm 等额外工具依赖 |
| 向量库 | Weaviate（与 compose 默认 `VECTOR_STORE=weaviate` 一致，零配置偏差） |
| 命名空间 | `qa-ai` |

## 边界

**做**：全部默认组件的清单、ConfigMap/Secret、PVC、Service、Ingress（CLB）、README（TKE 部署步骤、自建镜像推 TCR、常见问题）。

**不做**：
- 不实际部署到真实 TKE 集群；不做 Jenkinsfile / CI 流水线
- 不接入托管 TencentDB / COS（README 仅给出切换指引：改 env 指向托管实例）
- 向量库只出 Weaviate 清单，换 pgvector 的方式在 README 说明
- 不做多副本 HA 调优（replicas 默认 1，文档说明可自行调大）

## 目录结构

```
k8s/
├── README.md                        # 部署文档
├── base/
│   ├── kustomization.yaml           # namespace、resources、images:、configMapGenerator、secretGenerator
│   ├── namespace.yaml               # qa-ai
│   ├── middleware/                  # postgres、redis、weaviate：StatefulSet + Service + PVC
│   ├── app/                         # api、worker、worker_beat、api_websocket、web、agent_backend
│   ├── runtime/                     # plugin_daemon、sandbox、local_sandbox
│   ├── proxy/                       # ssrf_proxy、agent_ssrf_proxy（squid + 配置 ConfigMap）
│   └── gateway/                     # nginx Deployment + ConfigMap + Service（集群入口）
└── overlays/
    └── tke/                         # CBS StorageClass、CLB Ingress、TCR 镜像替换示例
```

## 组件清单

完整镜像 compose 默认组件集（`docker/docker-compose.yaml` 中 ALWAYS + postgresql/weaviate/collaboration profile）：

| 组件 | 镜像 | K8s 资源 | 备注 |
|---|---|---|---|
| nginx | nginx:latest | Deployment + Service | 唯一对外入口 |
| api | langgenius/dify-api:1.16.1 | Deployment + Service | |
| api_websocket | langgenius/dify-api:1.16.1 | Deployment + Service | collaboration |
| worker | langgenius/dify-api:1.16.1 | Deployment | |
| worker_beat | langgenius/dify-api:1.16.1 | Deployment | |
| web | langgenius/dify-web:1.16.1 | Deployment + Service | |
| agent_backend | langgenius/dify-agent-backend:1.16.1 | Deployment + Service | |
| plugin_daemon | langgenius/dify-plugin-daemon:0.6.10-local | Deployment + Service + PVC | |
| sandbox | langgenius/dify-sandbox:0.2.15 | Deployment + Service | |
| local_sandbox | langgenius/dify-agent-local-sandbox:1.16.1 | Deployment + Service | |
| ssrf_proxy | ubuntu/squid:latest | Deployment + Service + ConfigMap | squid.conf |
| agent_ssrf_proxy | ubuntu/squid:latest | Deployment + Service + ConfigMap | squid.conf |
| postgres | postgres:15-alpine | StatefulSet + Service + PVC | |
| redis | redis:6-alpine | StatefulSet + Service + PVC | |
| weaviate | semitechnologies/weaviate:1.27.0 | StatefulSet + Service + PVC | |
| init_permissions | busybox:latest | Job | 对应 compose init 容器 |

镜像 tag 集中在 base `kustomization.yaml` 的 `images:` 字段，一处改版本全量生效。

## 数据流

```
浏览器 ──(Ingress/CLB 或 port-forward)──► nginx
   ├─► web（前端静态资源/SSR）
   ├─► api ──► postgres / redis / weaviate / plugin_daemon / sandbox / ssrf_proxy
   ├─► api_websocket（协作）
   └─► agent_backend ──► local_sandbox / agent_ssrf_proxy
worker、worker_beat 与 api 共用 dify-api 镜像（不同启动命令），消费同一套中间件。
```

全部 Service 为 ClusterIP，组件间通过 Service DNS 互访，环境变量语义与 compose 保持一致。

## 配置管理

以 `docker/.env.example` 为基准逐项核对提炼：

- 非机密项 → ConfigMap（DB 连接、VECTOR_STORE、各组件地址等）
- 机密项 → Secret（SECRET_KEY、DB 密码、PLUGIN_DAEMON_KEY、sandbox API key 等）
- 均由 base kustomization 的 `configMapGenerator` / `secretGenerator` 生成；overlay 可用 `patches` 覆盖

## 存储

全部 PVC 动态供给，`storageClassName` 留空使用集群默认（TKE 默认 CBS；kind 用其默认 provisioner）。PVC 共 6 个：postgres、redis、weaviate、plugin_daemon、api 应用文件存储（默认本地卷）、sandbox 依赖。README 说明如何改显式 `cbs` StorageClass 或调整容量。

## 对外暴露

- overlays/tke：Ingress（CLB）暴露 nginx:80；对外地址 `https://qa-xai.xingshulin.com/lomva`（子路径），对外 URL 与 nginx 子路径路由以 overlay 覆盖（`behavior: merge/replace`）；web 镜像需 `--build-arg NEXT_PUBLIC_BASE_PATH=/lomva` 自建
- 快速验证：`kubectl port-forward -n qa-ai svc/nginx 8080:80`（base，根路径），不强制依赖 Ingress Controller

## 自建镜像推 TCR（README 内容）

基于本仓库各 Dockerfile（`api/`、`web/` 等）给出 `docker buildx build`、tag 到 TCR 命名空间、`docker push` 的完整命令，并在 overlays/tke 的 `images:` 中给出替换示例。

## 验证（成功标准）

1. `kubectl apply -k k8s/overlays/tke`（本地用 kind 验证）后所有 Pod Ready
2. port-forward 打开 nginx，出现 Dify 安装/登录页
3. 创建应用发一条消息跑通（验证 api → postgres / redis / weaviate / plugin_daemon 链路）
4. README 附常见问题排查表（镜像拉取、PVC Pending、Init 失败等）

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| compose env 到 ConfigMap/Secret 映射项多、易遗漏 | 以 `.env.example` 逐项核对；验证步骤 3 覆盖核心链路 |
| sandbox / plugin_daemon 可能有特权或内核参数要求 | 先按无特权实现；如失败在 README 记录所需 securityContext |
| squid 配置在 K8s 下路径/权限差异 | 用 ConfigMap 挂载官方 squid.conf 模板，本地 kind 先行验证 |
