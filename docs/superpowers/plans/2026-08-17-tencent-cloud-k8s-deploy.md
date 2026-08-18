# edify 腾讯云 TKE 部署清单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 edify 仓库新增 `k8s/`，用 Kustomize（base + overlays/tke）描述全部 16 个组件，`kubectl apply -k` 即可在 TKE 或本地 kind 拉起完整 Dify 并跑通核心链路。

**Architecture:** 静态 YAML + Kustomize。base 含全部组件（中间件集群内自建：PostgreSQL/Redis/Weaviate），overlay `tke` 增加 CLB Ingress 与 TCR 镜像替换示例。共享 env 提炼为 ConfigMap/Secret（generator 生成），组件间通过 ClusterIP Service DNS 互访，nginx 为唯一入口。

**Tech Stack:** Kubernetes YAML、Kustomize（kubectl 内置）、kind（本地验证）。

**Spec:** `docs/superpowers/specs/2026-08-17-tencent-cloud-k8s-deploy-design.md`

## Global Constraints

- 命名空间固定为 `qa-ai`（由 base kustomization 的 `namespace:` 注入，各资源文件不写 namespace 字段）。
- **K8s Service 名不允许下划线**（RFC 1123）。compose 服务名 → K8s Service 名映射：`db_postgres→postgres`、`api_websocket→api-websocket`、`plugin_daemon→plugin-daemon`、`local_sandbox→local-sandbox`、`agent_backend→agent-backend`、`ssrf_proxy→ssrf-proxy`、`agent_ssrf_proxy→agent-ssrf-proxy`。所有引用主机名的 env 必须用连字符名。
- 镜像 tag 集中在 `base/kustomization.yaml` 的 `images:` 字段；各 Pod spec 里 `image:` 只写裸名称（不带 tag）。
- 中间件全部集群内自建；向量库只用 Weaviate（与 compose 默认一致）。
- env 文件中**只允许整行注释**（kustomize generator 不剥离行内注释，会把它吞进值里）。
- 不修改 `docker/` 下任何现有文件；新文件全部在 `k8s/` 下。
- commit 信息精简、单行，不加 Co-Authored-By。

## 全局接口表（各 task 产出的 Service / 对象名）

| Service（ClusterIP） | 端口 | 提供方 task | 消费方 |
|---|---|---|---|
| `postgres` | 5432 | Task 2 | api/worker/worker-beat/api-websocket/plugin-daemon |
| `redis` | 6379 | Task 2 | api/worker/worker-beat/api-websocket/agent-backend/plugin-daemon |
| `weaviate` | 8080 (http), 50051 (grpc) | Task 2 | api/worker |
| `ssrf-proxy` | 3128 | Task 3 | api/worker/sandbox（HTTP_PROXY） |
| `agent-ssrf-proxy` | 3128 | Task 3 | local-sandbox（HTTP_PROXY） |
| `plugin-daemon` | 5002 | Task 4 | api/worker/agent-backend/nginx(/e/) |
| `sandbox` | 8194 | Task 4 | api/worker（CODE_EXECUTION_ENDPOINT） |
| `local-sandbox` | 5004 | Task 4 | agent-backend |
| `api` | 5001 | Task 5 | nginx/web/plugin-daemon/agent-backend |
| `api-websocket` | 5001 | Task 5 | nginx(/socket.io/) |
| `web` | 3000 | Task 5 | nginx |
| `agent-backend` | 5050 | Task 5 | api/worker |
| `nginx` | 80 | Task 6 | 集群外（Ingress / port-forward） |

| ConfigMap / Secret（generator 名，引用时写原名，kustomize 自动改写成带 hash 的名） | 内容 | 定义于 |
|---|---|---|
| `lomva-config` (ConfigMap) | 共享非机密 env | Task 1 |
| `lomva-web-config` (ConfigMap) | web 组件 env | Task 1 |
| `lomva-secret` (Secret) | 共享机密 env（dev 默认值） | Task 1 |
| `lomva-ssrf-proxy-config` (ConfigMap) | squid.conf.template + dify_common.conf.template | Task 3 |
| `lomva-agent-ssrf-proxy-config` (ConfigMap) | agent 版 squid 模板 | Task 3 |
| `lomva-sandbox-config` (ConfigMap) | sandbox config.yaml | Task 4 |
| `lomva-nginx-config` (ConfigMap) | nginx.conf / proxy.conf / default.conf | Task 6 |

| PVC | 挂载点 | 使用方 |
|---|---|---|
| `lomva-postgres-data` (10Gi) | /var/lib/postgresql/data | postgres |
| `lomva-redis-data` (10Gi) | /data | redis |
| `lomva-weaviate-data` (10Gi) | /var/lib/weaviate | weaviate |
| `lomva-plugin-storage` (10Gi) | /app/storage | plugin-daemon |
| `lomva-app-storage` (10Gi) | /app/api/storage | api/worker/api-websocket/init-permissions Job |
| `lomva-sandbox-deps` (10Gi) | /dependencies | sandbox |

（2026-08-18 修订：全部提至 10Gi——TKE CBS 单盘最小 10Gi，低于下限 provisioning 报 `disk size is invalid`）

---

### Task 1: 目录骨架 + 共享配置（namespace / env / base kustomization）

**Files:**
- Create: `k8s/base/namespace.yaml`
- Create: `k8s/base/config/lomva-config.env`
- Create: `k8s/base/config/lomva-secret.env`
- Create: `k8s/base/config/web-config.env`
- Create: `k8s/base/kustomization.yaml`

**Interfaces:**
- Produces: namespace `qa-ai`；ConfigMap `lomva-config`、`lomva-web-config`；Secret `lomva-secret`（key 见下方文件内容，后续 task 通过 `envFrom` / `secretKeyRef` 引用原名）；`images:` tag 清单。

- [ ] **Step 1: 创建 namespace.yaml**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: qa-ai
  labels:
    app.kubernetes.io/name: lomva
```

- [ ] **Step 2: 创建 config/lomva-config.env**

```bash
# api / worker / worker-beat / api-websocket / plugin-daemon 共享配置（非机密）
# 主机名为 K8s Service DNS 名（连字符），与 compose 下划线名不同

# 基础
LANG=C.UTF-8
LC_ALL=C.UTF-8
PYTHONIOENCODING=utf-8
DEPLOY_ENV=PRODUCTION
DEPLOYMENT_EDITION=COMMUNITY
DEBUG=false
FLASK_DEBUG=false
MIGRATION_ENABLED=true
CHECK_UPDATE_URL=https://updates.dify.ai
OPENAI_API_BASE=https://api.openai.com/v1

# 日志
LOG_LEVEL=INFO
LOG_OUTPUT_FORMAT=text
LOG_TZ=UTC

# Gunicorn
DIFY_BIND_ADDRESS=0.0.0.0
DIFY_PORT=5001
SERVER_WORKER_AMOUNT=1
SERVER_WORKER_CLASS=gevent
SERVER_WORKER_CONNECTIONS=10
GUNICORN_TIMEOUT=360

# 功能开关（与 compose 默认一致）
MARKETPLACE_ENABLED=true
ENABLE_EMAIL_PASSWORD_LOGIN=true
ENABLE_EMAIL_CODE_LOGIN=false
ENABLE_SOCIAL_OAUTH_LOGIN=false
ENABLE_COLLABORATION_MODE=true
ALLOW_REGISTER=false
ALLOW_CREATE_WORKSPACE=false
ENABLE_CHANGE_EMAIL=true
ENABLE_LICENSE_EXPIRY_NOTICE=true

# 外部 URL（留空按请求推导；正式部署改为实际域名）
CONSOLE_WEB_URL=
SERVICE_API_URL=
APP_WEB_URL=
TRIGGER_URL=http://localhost
ENDPOINT_URL_TEMPLATE=http://localhost/e/{hook_id}
MARKETPLACE_API_URL=https://marketplace.dify.ai
WEB_API_CORS_ALLOW_ORIGINS=*
CONSOLE_CORS_ALLOW_ORIGINS=*

# PostgreSQL
DB_TYPE=postgresql
DB_USERNAME=postgres
DB_HOST=postgres
DB_PORT=5432
DB_DATABASE=lomva
SQLALCHEMY_POOL_SIZE=30
SQLALCHEMY_MAX_OVERFLOW=10
SQLALCHEMY_POOL_RECYCLE=3600
SQLALCHEMY_POOL_TIMEOUT=30
SQLALCHEMY_ECHO=false
SQLALCHEMY_POOL_PRE_PING=false

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_USE_SSL=false
REDIS_USE_SENTINEL=false
REDIS_USE_CLUSTERS=false
CELERY_BACKEND=redis
CELERY_USE_SENTINEL=false
BROKER_USE_SSL=false

# 对象存储：默认本地卷（lomva-app-storage PVC 挂 /app/api/storage）
STORAGE_TYPE=opendal
OPENDAL_SCHEME=fs
OPENDAL_FS_ROOT=storage

# 向量库：Weaviate
VECTOR_STORE=weaviate
VECTOR_INDEX_NAME_PREFIX=Vector_index
WEAVIATE_ENDPOINT=http://weaviate:8080
WEAVIATE_GRPC_ENDPOINT=grpc://weaviate:50051
WEAVIATE_TOKENIZATION=word

# Sandbox / 代码执行
CODE_EXECUTION_ENDPOINT=http://sandbox:8194
CODE_EXECUTION_SSL_VERIFY=True
CODE_EXECUTION_CONNECT_TIMEOUT=10
CODE_EXECUTION_READ_TIMEOUT=60
CODE_EXECUTION_WRITE_TIMEOUT=10

# SSRF 代理
SSRF_PROXY_HTTP_URL=http://ssrf-proxy:3128
SSRF_PROXY_HTTPS_URL=http://ssrf-proxy:3128

# 插件守护进程
PLUGIN_DAEMON_URL=http://plugin-daemon:5002
PLUGIN_REMOTE_INSTALL_HOST=localhost
PLUGIN_REMOTE_INSTALL_PORT=5003
PLUGIN_MAX_PACKAGE_SIZE=52428800
PLUGIN_DAEMON_TIMEOUT=600.0
PLUGIN_MODEL_SCHEMA_CACHE_TTL=3600
PLUGIN_MODEL_PROVIDERS_CACHE_ENABLED=true
PLUGIN_MODEL_PROVIDERS_CACHE_TTL=86400

# Agent 后端（api / worker 侧）
AGENT_BACKEND_BASE_URL=http://agent-backend:5050
AGENT_BACKEND_STREAM_READ_TIMEOUT_SECONDS=30
AGENT_BACKEND_STREAM_MAX_RECONNECTS=3

# 上传限制
UPLOAD_FILE_SIZE_LIMIT=15
UPLOAD_FILE_BATCH_LIMIT=5
UPLOAD_IMAGE_FILE_SIZE_LIMIT=10
ETL_TYPE=dify
MULTIMODAL_SEND_FORMAT=base64

# 工作流
WORKFLOW_MAX_EXECUTION_STEPS=500
WORKFLOW_MAX_EXECUTION_TIME=1200
HTTP_REQUEST_NODE_SSL_VERIFY=True
```

- [ ] **Step 3: 创建 config/lomva-secret.env**

值为 compose 开发默认值，README 会要求生产部署前全部更换。

```bash
# 共享机密（开发默认值，与 docker-compose 一致；生产部署前必须更换）
# SECRET_KEY 留空时 api 会自动生成并持久化到共享存储（lomva-app-storage PVC）
SECRET_KEY=
DB_PASSWORD=difyai123456
REDIS_PASSWORD=difyai123456
CELERY_BROKER_URL=redis://:difyai123456@redis:6379/1
WEAVIATE_API_KEY=WVF5YThaHlkYwhGUSmCRgsX3tD5ngdN8pkih
CODE_EXECUTION_API_KEY=dify-sandbox
PLUGIN_DAEMON_KEY=lYkiYYT6owG+71oLerGzA7GXCgOT++6ovaezWAjpCjf+Sjc3ZtU+qUEi
PLUGIN_DIFY_INNER_API_KEY=QaHbTe77CtuXmsfyhR7+vRjI/+XbV1AaFy691iy+kGDv2Jvy0/eAh8Y1
INNER_API_KEY_FOR_PLUGIN=QaHbTe77CtuXmsfyhR7+vRjI/+XbV1AaFy691iy+kGDv2Jvy0/eAh8Y1
AGENT_BACKEND_API_TOKEN=dify-agent-run-token-for-dev-only
DIFY_AGENT_API_TOKEN=dify-agent-run-token-for-dev-only
DIFY_AGENT_SERVER_SECRET_KEY=MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY
DIFY_AGENT_REDIS_URL=redis://:difyai123456@redis:6379/2
DIFY_AGENT_PLUGIN_DAEMON_API_KEY=lYkiYYT6owG+71oLerGzA7GXCgOT++6ovaezWAjpCjf+Sjc3ZtU+qUEi
DIFY_AGENT_INNER_API_KEY=QaHbTe77CtuXmsfyhR7+vRjI/+XbV1AaFy691iy+kGDv2Jvy0/eAh8Y1
DIFY_AGENT_LOCAL_SANDBOX_AUTH_TOKEN=
INIT_PASSWORD=
```

- [ ] **Step 4: 创建 config/web-config.env**

与 compose `web` 服务 environment 块逐项对应；`NEXT_PUBLIC_SOCKET_URL` 默认指向文档约定的 port-forward 地址。

```bash
# web 组件配置（对应 compose web environment 块）
CONSOLE_API_URL=
APP_API_URL=
SERVER_CONSOLE_API_URL=http://api:5001
NEXT_PUBLIC_SOCKET_URL=ws://localhost:8080
NEXT_PUBLIC_COOKIE_DOMAIN=
NEXT_TELEMETRY_DISABLED=0
EXPERIMENTAL_ENABLE_VINEXT=false
TEXT_GENERATION_TIMEOUT_MS=60000
CSP_WHITELIST=
ALLOW_EMBED=false
ALLOW_UNSAFE_DATA_SCHEME=false
MARKETPLACE_API_URL=https://marketplace.dify.ai
MARKETPLACE_URL=https://marketplace.dify.ai
TOP_K_MAX_VALUE=10
INDEXING_MAX_SEGMENTATION_TOKENS_LENGTH=4000
LOOP_NODE_MAX_COUNT=100
MAX_TOOLS_NUM=10
MAX_PARALLEL_LIMIT=10
MAX_ITERATIONS_NUM=99
MAX_TREE_DEPTH=50
ENABLE_WEBSITE_JINAREADER=true
ENABLE_WEBSITE_FIRECRAWL=true
ENABLE_WEBSITE_WATERCRAWL=true
AMPLITUDE_API_KEY=
TURNSTILE_SITE_KEY=
SENTRY_DSN=
```

- [ ] **Step 5: 创建 base/kustomization.yaml**

`resources` 目前只有 namespace；后续 task 逐个追加。`images:` 集中管理所有镜像 tag（compose `docker-compose.yaml` 中的实际版本）。

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: qa-ai

resources:
  - namespace.yaml

configMapGenerator:
  - name: lomva-config
    envs:
      - config/lomva-config.env
  - name: lomva-web-config
    envs:
      - config/web-config.env

secretGenerator:
  - name: lomva-secret
    type: Opaque
    envs:
      - config/lomva-secret.env

images:
  - name: langgenius/dify-api
    newTag: 1.16.1
  - name: langgenius/dify-web
    newTag: 1.16.1
  - name: langgenius/dify-sandbox
    newTag: 0.2.15
  - name: langgenius/dify-agent-local-sandbox
    newTag: 1.16.1
  - name: langgenius/dify-plugin-daemon
    newTag: 0.6.10-local
  - name: langgenius/dify-agent-backend
    newTag: 1.16.1
  - name: postgres
    newTag: 15-alpine
  - name: redis
    newTag: 6-alpine
  - name: semitechnologies/weaviate
    newTag: 1.27.0
  - name: ubuntu/squid
    newTag: latest
  - name: nginx
    newTag: 1.27-alpine
  - name: busybox
    newTag: "1.36"
```

- [ ] **Step 6: 验证构建**

Run: `kubectl kustomize k8s/base | grep -E "^kind:|^  name:" | head -20`
Expected: 输出包含 `Namespace`、`ConfigMap`（lomva-config/lomva-web-config，带 hash 后缀）、`Secret`（lomva-secret），命令退出码 0。

- [ ] **Step 7: Commit**

```bash
git add k8s/base
git commit -m "feat(deploy): add k8s base skeleton and shared config"
```

---

### Task 2: 中间件（postgres / redis / weaviate）

**Files:**
- Create: `k8s/base/middleware/postgres.yaml`
- Create: `k8s/base/middleware/redis.yaml`
- Create: `k8s/base/middleware/weaviate.yaml`
- Modify: `k8s/base/kustomization.yaml`（resources 追加 3 个文件）

**Interfaces:**
- Consumes: Secret `lomva-secret` 的 key `DB_PASSWORD`、`REDIS_PASSWORD`、`WEAVIATE_API_KEY`（Task 1）。
- Produces: Service `postgres:5432`、`redis:6379`、`weaviate:8080/50051`；PVC `lomva-postgres-data`、`lomva-redis-data`、`lomva-weaviate-data`。

- [ ] **Step 1: 创建 middleware/postgres.yaml**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: lomva-postgres-data
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  labels:
    app: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres
          env:
            - name: POSTGRES_USER
              value: "postgres"
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: lomva-secret
                  key: DB_PASSWORD
            - name: POSTGRES_DB
              value: "lomva"
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          command:
            - postgres
            - -c
            - max_connections=100
            - -c
            - shared_buffers=128MB
            - -c
            - work_mem=4MB
            - -c
            - maintenance_work_mem=64MB
            - -c
            - effective_cache_size=4096MB
            - -c
            - statement_timeout=0
            - -c
            - idle_in_transaction_session_timeout=0
          ports:
            - containerPort: 5432
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "postgres", "-d", "lomva"]
            initialDelaySeconds: 10
            periodSeconds: 5
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: lomva-postgres-data
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
```

- [ ] **Step 2: 创建 middleware/redis.yaml**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: lomva-redis-data
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 2Gi
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  labels:
    app: redis
spec:
  serviceName: redis
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
        - name: redis
          image: redis
          env:
            - name: REDIS_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: lomva-secret
                  key: REDIS_PASSWORD
          command: ["sh", "-c", "redis-server --requirepass \"$REDIS_PASSWORD\""]
          ports:
            - containerPort: 6379
          readinessProbe:
            tcpSocket:
              port: 6379
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: data
              mountPath: /data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: lomva-redis-data
---
apiVersion: v1
kind: Service
metadata:
  name: redis
spec:
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
```

- [ ] **Step 3: 创建 middleware/weaviate.yaml**

env 与 compose `weaviate` 服务逐项对应（`AUTHENTICATION_APIKEY_ALLOWED_KEYS` 引 Secret 中的 `WEAVIATE_API_KEY`，保证与 api 侧一致）。

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: lomva-weaviate-data
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: weaviate
  labels:
    app: weaviate
spec:
  serviceName: weaviate
  replicas: 1
  selector:
    matchLabels:
      app: weaviate
  template:
    metadata:
      labels:
        app: weaviate
    spec:
      containers:
        - name: weaviate
          image: semitechnologies/weaviate
          env:
            - name: PERSISTENCE_DATA_PATH
              value: /var/lib/weaviate
            - name: QUERY_DEFAULTS_LIMIT
              value: "25"
            - name: AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED
              value: "false"
            - name: DEFAULT_VECTORIZER_MODULE
              value: "none"
            - name: CLUSTER_HOSTNAME
              value: "node1"
            - name: AUTHENTICATION_APIKEY_ENABLED
              value: "true"
            - name: AUTHENTICATION_APIKEY_ALLOWED_KEYS
              valueFrom:
                secretKeyRef:
                  name: lomva-secret
                  key: WEAVIATE_API_KEY
            - name: AUTHENTICATION_APIKEY_USERS
              value: "hello@dify.ai"
            - name: AUTHORIZATION_ADMINLIST_ENABLED
              value: "true"
            - name: AUTHORIZATION_ADMINLIST_USERS
              value: "hello@dify.ai"
            - name: DISABLE_TELEMETRY
              value: "false"
            - name: ENABLE_TOKENIZER_GSE
              value: "false"
            - name: ENABLE_TOKENIZER_KAGOME_JA
              value: "false"
            - name: ENABLE_TOKENIZER_KAGOME_KR
              value: "false"
          ports:
            - containerPort: 8080
            - containerPort: 50051
          readinessProbe:
            httpGet:
              path: /v1/.well-known/ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
          volumeMounts:
            - name: data
              mountPath: /var/lib/weaviate
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: lomva-weaviate-data
---
apiVersion: v1
kind: Service
metadata:
  name: weaviate
spec:
  selector:
    app: weaviate
  ports:
    - name: http
      port: 8080
      targetPort: 8080
    - name: grpc
      port: 50051
      targetPort: 50051
```

- [ ] **Step 4: kustomization.yaml 的 resources 追加**

```yaml
resources:
  - namespace.yaml
  - middleware/postgres.yaml
  - middleware/redis.yaml
  - middleware/weaviate.yaml
```

- [ ] **Step 5: 验证构建**

Run: `kubectl kustomize k8s/base | grep -E "^kind:" | sort | uniq -c`
Expected: 含 `3 StatefulSet`、`3 Service`、`3 PersistentVolumeClaim` 及 Task 1 的对象；退出码 0。

- [ ] **Step 6: Commit**

```bash
git add k8s/base
git commit -m "feat(deploy): add postgres/redis/weaviate manifests"
```

---

### Task 3: SSRF 代理（ssrf-proxy / agent-ssrf-proxy）

**Files:**
- Create: `k8s/base/config/squid/dify_common.conf.template`
- Create: `k8s/base/config/squid/ssrf-squid.conf.template`
- Create: `k8s/base/config/squid/agent-squid.conf.template`
- Create: `k8s/base/proxy/ssrf-proxy.yaml`
- Create: `k8s/base/proxy/agent-ssrf-proxy.yaml`
- Modify: `k8s/base/kustomization.yaml`（resources + configMapGenerator 追加）

**Interfaces:**
- Consumes: 无（模板内容从 `docker/ssrf_proxy/` 移植）。
- Produces: Service `ssrf-proxy:3128`、`agent-ssrf-proxy:3128`；ConfigMap `lomva-ssrf-proxy-config`、`lomva-agent-ssrf-proxy-config`（key：`squid.conf.template`、`dify_common.conf.template`）。

- [ ] **Step 1: 创建 config/squid/dify_common.conf.template**

内容**逐字复制** `docker/ssrf_proxy/squid-common.conf.template`（保留 `${COREDUMP_DIR}` 占位符，由容器启动脚本展开）：

```
# Shared Squid configuration used by both ssrf_proxy and agent_ssrf_proxy.

################################## ACL Definitions ################################
acl client_localnet src 0.0.0.1-0.255.255.255	# RFC 1122 "this" network (LAN)
acl client_localnet src 10.0.0.0/8		# RFC 1918 local private network (LAN)
acl client_localnet src 100.64.0.0/10		# RFC 6598 shared address space (CGN)
acl client_localnet src 169.254.0.0/16 	# RFC 3927 link-local (directly plugged) machines
acl client_localnet src 172.16.0.0/12		# RFC 1918 local private network (LAN)
acl client_localnet src 192.168.0.0/16		# RFC 1918 local private network (LAN)
acl client_localnet src fc00::/7       	# RFC 4193 local private network range
acl client_localnet src fe80::/10      	# RFC 4291 link-local (directly plugged) machines

acl to_private_networks dst 0.0.0.0/8
acl to_private_networks dst 10.0.0.0/8
acl to_private_networks dst 100.64.0.0/10
acl to_private_networks dst 127.0.0.0/8
acl to_private_networks dst 169.254.0.0/16
acl to_private_networks dst 172.16.0.0/12
acl to_private_networks dst 192.168.0.0/16
acl to_private_networks dst 224.0.0.0/4
acl to_private_networks dst 240.0.0.0/4
acl to_private_networks dst ::/128
acl to_private_networks dst ::1/128
acl to_private_networks dst ::ffff:0:0/96    # IPv4-mapped
acl to_private_networks dst ::/96            # deprecated IPv4-compatible
acl to_private_networks dst fc00::/7
acl to_private_networks dst fe80::/10

acl SSL_ports port 443
acl Safe_ports port 80		# http
acl Safe_ports port 21		# ftp
acl Safe_ports port 443		# https
acl Safe_ports port 70		# gopher
acl Safe_ports port 210		# wais
acl Safe_ports port 1025-65535	# unregistered ports
acl Safe_ports port 280		# http-mgmt
acl Safe_ports port 488		# gss-http
acl Safe_ports port 591		# filemaker
acl Safe_ports port 777		# multiling http
acl CONNECT method CONNECT

################################## Common Parameters ################################

tcp_outgoing_address 0.0.0.0

################################## Proxy Server ################################
coredump_dir ${COREDUMP_DIR}
refresh_pattern ^ftp:		1440	20%	10080
refresh_pattern ^gopher:	1440	0%	1440
refresh_pattern -i (/cgi-bin/|\?) 0	0%	0
refresh_pattern \/(Packages|Sources)(|\.bz2|\.gz|\.xz)$ 0 0% 0 refresh-ims
refresh_pattern \/Release(|\.gpg)$ 0 0% 0 refresh-ims
refresh_pattern \/InRelease$ 0 0% 0 refresh-ims
refresh_pattern \/(Translation-.*)(|\.bz2|\.gz|\.xz)$ 0 0% 0 refresh-ims
refresh_pattern .		0	20%	4320

################################## Request Buffer ################################
client_request_buffer_max_size 100 MB

################################## Performance & Concurrency ###############################
max_filedescriptors 65536
connect_timeout 30 seconds
request_timeout 2 minutes
read_timeout 2 minutes
client_lifetime 5 minutes
shutdown_lifetime 30 seconds

server_persistent_connections on
client_persistent_connections on
persistent_request_timeout 30 seconds
pconn_timeout 1 minute

client_db on
server_idle_pconn_timeout 2 minutes
client_idle_pconn_timeout 2 minutes

quick_abort_min 16 KB
quick_abort_max 16 MB
quick_abort_pct 95

memory_cache_mode disk
cache_mem 256 MB
maximum_object_size_in_memory 512 KB

dns_timeout 30 seconds
dns_retransmit_interval 5 seconds

logformat dify_log %ts.%03tu %6tr %>a %Ss/%03>Hs %<st %rm %ru %[un %Sh/%<a %mt
access_log daemon:/var/log/squid/access.log dify_log
logfile_rotate 10
```

- [ ] **Step 2: 创建 config/squid/ssrf-squid.conf.template**

逐字复制 `docker/ssrf_proxy/squid.conf.template`（`dify_allow_private.conf` / `dify_sandbox_proxy.conf` 两个 include 文件由容器启动脚本生成空规则文件）：

```
include /etc/squid/dify_common.conf

acl allowed_domains dstdomain .marketplace.dify.ai

http_port ${HTTP_PORT}

http_access deny !Safe_ports
http_access deny CONNECT !SSL_ports
http_access allow localhost manager
http_access deny manager
include /etc/squid/dify_sandbox_proxy.conf
include /etc/squid/dify_allow_private.conf
http_access deny to_private_networks
http_access allow allowed_domains
http_access allow client_localnet
http_access allow localhost
http_access deny all
```

- [ ] **Step 3: 创建 config/squid/agent-squid.conf.template**

复制 `docker/ssrf_proxy/squid-agent.conf.template`，**把 dstdomain 改为 K8s Service 名**（`agent_backend`→`agent-backend`）：

```
# Dedicated Squid config for the dify-agent local-sandbox SSRF proxy.
# All traffic on this proxy is restricted to:
#   - agent-backend /agent-stub/* endpoints
#   - Dify API /files/* endpoints (signed upload/download URLs)
# External internet is allowed; all other private-network destinations are denied.

include /etc/squid/dify_common.conf

acl dst_agent_backend dstdomain agent-backend
acl dst_dify_api dstdomain api
acl path_files urlpath_regex -i ^/files/
acl path_agent_stub urlpath_regex -i ^/agent-stub/

http_port ${HTTP_PORT}

http_access deny !Safe_ports
http_access deny CONNECT !SSL_ports
http_access allow dst_agent_backend path_agent_stub
http_access allow dst_dify_api path_files
http_access deny to_private_networks
http_access allow all
```

- [ ] **Step 4: 创建 proxy/ssrf-proxy.yaml**

容器启动命令复刻 `docker/ssrf_proxy/docker-entrypoint.sh` 的模板展开逻辑（awk expand_env），模板从 ConfigMap 挂入 `/etc/squid/templates/`，展开结果写入容器可写的 `/etc/squid/`。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ssrf-proxy
  labels:
    app: ssrf-proxy
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ssrf-proxy
  template:
    metadata:
      labels:
        app: ssrf-proxy
    spec:
      containers:
        - name: squid
          image: ubuntu/squid
          env:
            - name: HTTP_PORT
              value: "3128"
            - name: COREDUMP_DIR
              value: /var/spool/squid
          command: ["sh", "-c"]
          args:
            - |
              set -e
              expand_env() {
                awk '{ while(match($0, /\${[A-Za-z_][A-Za-z_0-9]*}/)) { var = substr($0, RSTART+2, RLENGTH-3); val = ENVIRON[var]; $0 = substr($0, 1, RSTART-1) val substr($0, RSTART+RLENGTH) } print }' "$1"
              }
              expand_env /etc/squid/templates/squid.conf.template > /etc/squid/squid.conf
              expand_env /etc/squid/templates/dify_common.conf.template > /etc/squid/dify_common.conf
              echo "# Generated: no private allowlist configured" > /etc/squid/dify_allow_private.conf
              echo "# Generated: no sandbox bridge configured" > /etc/squid/dify_sandbox_proxy.conf
              tail -F /var/log/squid/access.log /var/log/squid/cache.log 2>/dev/null &
              /usr/sbin/squid -Nz
              exec /usr/sbin/squid -f /etc/squid/squid.conf -NYC 1
          ports:
            - containerPort: 3128
          readinessProbe:
            tcpSocket:
              port: 3128
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: config
              mountPath: /etc/squid/templates
      volumes:
        - name: config
          configMap:
            name: lomva-ssrf-proxy-config
---
apiVersion: v1
kind: Service
metadata:
  name: ssrf-proxy
spec:
  selector:
    app: ssrf-proxy
  ports:
    - port: 3128
      targetPort: 3128
```

- [ ] **Step 5: 创建 proxy/agent-ssrf-proxy.yaml**

agent 模板不含 `dify_allow_private.conf` / `dify_sandbox_proxy.conf` include，启动脚本无需生成这两个文件。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-ssrf-proxy
  labels:
    app: agent-ssrf-proxy
spec:
  replicas: 1
  selector:
    matchLabels:
      app: agent-ssrf-proxy
  template:
    metadata:
      labels:
        app: agent-ssrf-proxy
    spec:
      containers:
        - name: squid
          image: ubuntu/squid
          env:
            - name: HTTP_PORT
              value: "3128"
            - name: COREDUMP_DIR
              value: /var/spool/squid
          command: ["sh", "-c"]
          args:
            - |
              set -e
              expand_env() {
                awk '{ while(match($0, /\${[A-Za-z_][A-Za-z_0-9]*}/)) { var = substr($0, RSTART+2, RLENGTH-3); val = ENVIRON[var]; $0 = substr($0, 1, RSTART-1) val substr($0, RSTART+RLENGTH) } print }' "$1"
              }
              expand_env /etc/squid/templates/squid.conf.template > /etc/squid/squid.conf
              expand_env /etc/squid/templates/dify_common.conf.template > /etc/squid/dify_common.conf
              tail -F /var/log/squid/access.log /var/log/squid/cache.log 2>/dev/null &
              /usr/sbin/squid -Nz
              exec /usr/sbin/squid -f /etc/squid/squid.conf -NYC 1
          ports:
            - containerPort: 3128
          readinessProbe:
            tcpSocket:
              port: 3128
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: config
              mountPath: /etc/squid/templates
      volumes:
        - name: config
          configMap:
            name: lomva-agent-ssrf-proxy-config
---
apiVersion: v1
kind: Service
metadata:
  name: agent-ssrf-proxy
spec:
  selector:
    app: agent-ssrf-proxy
  ports:
    - port: 3128
      targetPort: 3128
```

- [ ] **Step 6: kustomization.yaml 追加**

resources 追加：

```yaml
  - proxy/ssrf-proxy.yaml
  - proxy/agent-ssrf-proxy.yaml
```

configMapGenerator 追加（`key=path` 语法让 ConfigMap 的 key 是 `squid.conf.template` 等模板名）：

```yaml
  - name: lomva-ssrf-proxy-config
    files:
      - squid.conf.template=config/squid/ssrf-squid.conf.template
      - dify_common.conf.template=config/squid/dify_common.conf.template
  - name: lomva-agent-ssrf-proxy-config
    files:
      - squid.conf.template=config/squid/agent-squid.conf.template
      - dify_common.conf.template=config/squid/dify_common.conf.template
```

- [ ] **Step 7: 验证构建**

Run: `kubectl kustomize k8s/base | grep -cE "^kind: (Deployment|Service)$"`
Expected: `7`（2 Deployment：ssrf-proxy、agent-ssrf-proxy；5 Service：Task 2 的 3 个 + 本 task 的 2 个）；退出码 0。另执行 `kubectl kustomize k8s/base | grep "name: lomva-ssrf-proxy-config"` 确认 ConfigMap 已生成。

- [ ] **Step 8: Commit**

```bash
git add k8s/base
git commit -m "feat(deploy): add ssrf proxy manifests and squid config"
```

---

### Task 4: 运行时（plugin-daemon / sandbox / local-sandbox）

**Files:**
- Create: `k8s/base/runtime/plugin-daemon.yaml`
- Create: `k8s/base/config/sandbox/config.yaml`
- Create: `k8s/base/runtime/sandbox.yaml`
- Create: `k8s/base/runtime/local-sandbox.yaml`
- Modify: `k8s/base/kustomization.yaml`

**Interfaces:**
- Consumes: ConfigMap `lomva-config`；Secret `lomva-secret` 的 key `PLUGIN_DAEMON_KEY`、`PLUGIN_DIFY_INNER_API_KEY`、`CODE_EXECUTION_API_KEY`、`DIFY_AGENT_LOCAL_SANDBOX_AUTH_TOKEN`；Service `postgres`、`ssrf-proxy`、`agent-ssrf-proxy`。
- Produces: Service `plugin-daemon:5002`、`sandbox:8194`、`local-sandbox:5004`；PVC `lomva-plugin-storage`、`lomva-sandbox-deps`；ConfigMap `lomva-sandbox-config`（key `config.yaml`）。

- [ ] **Step 1: 创建 runtime/plugin-daemon.yaml**

`envFrom` 引入共享配置后，用显式 `env` 覆盖 plugin-daemon 专属项（显式 env 优先级高于 envFrom，如 `DB_DATABASE=dify_plugin`）；`SERVER_KEY` / `DIFY_INNER_API_KEY` 通过 secretKeyRef 映射到共享 Secret 的对应 key。initContainer 等待 postgres 就绪，避免 CrashLoop 噪音。

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: lomva-plugin-storage
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 5Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: plugin-daemon
  labels:
    app: plugin-daemon
spec:
  replicas: 1
  selector:
    matchLabels:
      app: plugin-daemon
  template:
    metadata:
      labels:
        app: plugin-daemon
    spec:
      initContainers:
        - name: wait-postgres
          image: busybox
          command: ["sh", "-c", "until nc -z postgres 5432; do echo waiting for postgres; sleep 2; done"]
      containers:
        - name: plugin-daemon
          image: langgenius/dify-plugin-daemon
          envFrom:
            - configMapRef:
                name: lomva-config
            - secretRef:
                name: lomva-secret
          env:
            - name: SERVER_PORT
              value: "5002"
            - name: SERVER_KEY
              valueFrom:
                secretKeyRef:
                  name: lomva-secret
                  key: PLUGIN_DAEMON_KEY
            - name: DIFY_INNER_API_URL
              value: http://api:5001
            - name: DIFY_INNER_API_KEY
              valueFrom:
                secretKeyRef:
                  name: lomva-secret
                  key: PLUGIN_DIFY_INNER_API_KEY
            - name: DB_DATABASE
              value: lomva_plugin
            - name: DB_SSL_MODE
              value: disable
            - name: MAX_PLUGIN_PACKAGE_SIZE
              value: "52428800"
            - name: PPROF_ENABLED
              value: "false"
            - name: PLUGIN_REMOTE_INSTALLING_HOST
              value: 0.0.0.0
            - name: PLUGIN_REMOTE_INSTALLING_PORT
              value: "5003"
            - name: PLUGIN_WORKING_PATH
              value: /app/storage/cwd
            - name: FORCE_VERIFYING_SIGNATURE
              value: "true"
            - name: PYTHON_ENV_INIT_TIMEOUT
              value: "120"
            - name: PLUGIN_MAX_EXECUTION_TIMEOUT
              value: "600"
            - name: PLUGIN_STDIO_BUFFER_SIZE
              value: "1024"
            - name: PLUGIN_STDIO_MAX_BUFFER_SIZE
              value: "5242880"
            - name: PLUGIN_STORAGE_TYPE
              value: local
            - name: PLUGIN_STORAGE_LOCAL_ROOT
              value: /app/storage
            - name: PLUGIN_INSTALLED_PATH
              value: plugin
            - name: PLUGIN_PACKAGE_CACHE_PATH
              value: plugin_packages
            - name: PLUGIN_MEDIA_CACHE_PATH
              value: assets
          ports:
            - containerPort: 5002
            - containerPort: 5003
          readinessProbe:
            tcpSocket:
              port: 5002
            initialDelaySeconds: 10
            periodSeconds: 10
          volumeMounts:
            - name: storage
              mountPath: /app/storage
      volumes:
        - name: storage
          persistentVolumeClaim:
            claimName: lomva-plugin-storage
---
apiVersion: v1
kind: Service
metadata:
  name: plugin-daemon
spec:
  selector:
    app: plugin-daemon
  ports:
    - port: 5002
      targetPort: 5002
```

- [ ] **Step 2: 创建 config/sandbox/config.yaml**

内容与 `docker/volumes/sandbox/conf/config.yaml` 一致（`API_KEY` 等由 env 覆盖此文件值）：

```yaml
app:
  port: 8194
  debug: True
  key: dify-sandbox
max_workers: 4
max_requests: 50
worker_timeout: 5
enable_network: True # please make sure there is no network risk in your environment
allowed_syscalls: # please leave it empty if you have no idea how seccomp works
proxy:
  socks5: ''
  http: ''
  https: ''
```

- [ ] **Step 3: 创建 runtime/sandbox.yaml**

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: lomva-sandbox-deps
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 2Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sandbox
  labels:
    app: sandbox
spec:
  replicas: 1
  selector:
    matchLabels:
      app: sandbox
  template:
    metadata:
      labels:
        app: sandbox
    spec:
      containers:
        - name: sandbox
          image: langgenius/dify-sandbox
          env:
            - name: API_KEY
              valueFrom:
                secretKeyRef:
                  name: lomva-secret
                  key: CODE_EXECUTION_API_KEY
            - name: GIN_MODE
              value: release
            - name: WORKER_TIMEOUT
              value: "15"
            - name: ENABLE_NETWORK
              value: "true"
            - name: HTTP_PROXY
              value: http://ssrf-proxy:3128
            - name: HTTPS_PROXY
              value: http://ssrf-proxy:3128
            - name: SANDBOX_PORT
              value: "8194"
          ports:
            - containerPort: 8194
          readinessProbe:
            httpGet:
              path: /health
              port: 8194
            initialDelaySeconds: 10
            periodSeconds: 10
          volumeMounts:
            - name: config
              mountPath: /conf/config.yaml
              subPath: config.yaml
            - name: dependencies
              mountPath: /dependencies
      volumes:
        - name: config
          configMap:
            name: lomva-sandbox-config
        - name: dependencies
          persistentVolumeClaim:
            claimName: lomva-sandbox-deps
---
apiVersion: v1
kind: Service
metadata:
  name: sandbox
spec:
  selector:
    app: sandbox
  ports:
    - port: 8194
      targetPort: 8194
```

- [ ] **Step 4: 创建 runtime/local-sandbox.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: local-sandbox
  labels:
    app: local-sandbox
spec:
  replicas: 1
  selector:
    matchLabels:
      app: local-sandbox
  template:
    metadata:
      labels:
        app: local-sandbox
    spec:
      containers:
        - name: local-sandbox
          image: langgenius/dify-agent-local-sandbox
          env:
            - name: SHELLCTL_AUTH_TOKEN
              valueFrom:
                secretKeyRef:
                  name: lomva-secret
                  key: DIFY_AGENT_LOCAL_SANDBOX_AUTH_TOKEN
            - name: SHELLCTL_ENABLE_PATH_ISOLATION
              value: "true"
            - name: HTTP_PROXY
              value: http://agent-ssrf-proxy:3128
            - name: HTTPS_PROXY
              value: http://agent-ssrf-proxy:3128
            - name: NO_PROXY
              value: localhost,127.0.0.1
          ports:
            - containerPort: 5004
          readinessProbe:
            httpGet:
              path: /healthz
              port: 5004
            initialDelaySeconds: 10
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: local-sandbox
spec:
  selector:
    app: local-sandbox
  ports:
    - port: 5004
      targetPort: 5004
```

- [ ] **Step 5: kustomization.yaml 追加**

resources 追加：

```yaml
  - runtime/plugin-daemon.yaml
  - runtime/sandbox.yaml
  - runtime/local-sandbox.yaml
```

configMapGenerator 追加：

```yaml
  - name: lomva-sandbox-config
    files:
      - config.yaml=config/sandbox/config.yaml
```

- [ ] **Step 6: 验证构建**

Run: `kubectl kustomize k8s/base > /tmp/lomva-base.yaml && grep -cE "^kind: Deployment$" /tmp/lomva-base.yaml`
Expected: `5`（ssrf-proxy、agent-ssrf-proxy、plugin-daemon、sandbox、local-sandbox）；退出码 0。

- [ ] **Step 7: Commit**

```bash
git add k8s/base
git commit -m "feat(deploy): add plugin-daemon/sandbox/local-sandbox manifests"
```

---

### Task 5: 应用层（init Job / api / api-websocket / worker / worker-beat / web / agent-backend）

**Files:**
- Create: `k8s/base/app/init-job.yaml`
- Create: `k8s/base/app/api.yaml`
- Create: `k8s/base/app/api-websocket.yaml`
- Create: `k8s/base/app/worker.yaml`
- Create: `k8s/base/app/worker-beat.yaml`
- Create: `k8s/base/app/web.yaml`
- Create: `k8s/base/app/agent-backend.yaml`
- Modify: `k8s/base/kustomization.yaml`

**Interfaces:**
- Consumes: ConfigMap `lomva-config`、`lomva-web-config`；Secret `lomva-secret`；Service `postgres`/`redis`/`plugin-daemon`/`local-sandbox`。
- Produces: PVC `lomva-app-storage`；Job `init-permissions`；Service `api:5001`、`api-websocket:5001`、`web:3000`、`agent-backend:5050`；Deployment `worker`、`worker-beat`（无 Service）。

设计要点：
- api/worker/api-websocket 通过两个 initContainer 等待中间件就绪（`nc -z`）和 init-permissions Job 完成（共享存储上的 flag 文件），避免 CrashLoop 噪音。
- api 启动时自动执行 DB migration（`MIGRATION_ENABLED=true`），耗时较长，用 startupProbe 兜底（最长 5 分钟）。
- `MODE` env 决定 dify-api 镜像的运行形态（api / worker / beat），与 compose 一致。

- [ ] **Step 1: 创建 app/init-job.yaml**

对应 compose 的 `init_permissions` 服务：chown 共享存储并写 flag 文件（幂等）。

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: lomva-app-storage
spec:
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 10Gi
---
apiVersion: batch/v1
kind: Job
metadata:
  name: init-permissions
  labels:
    app: init-permissions
spec:
  template:
    metadata:
      labels:
        app: init-permissions
    spec:
      restartPolicy: Never
      containers:
        - name: init
          image: busybox
          command: ["sh", "-c"]
          args:
            - |
              FLAG_FILE="/app/api/storage/.init_permissions"
              if [ -f "$FLAG_FILE" ]; then
                echo "Permissions already initialized. Exiting."
                exit 0
              fi
              echo "Initializing permissions for /app/api/storage"
              chown -R 1001:1001 /app/api/storage && touch "$FLAG_FILE"
              echo "Permissions initialized. Exiting."
          volumeMounts:
            - name: storage
              mountPath: /app/api/storage
      volumes:
        - name: storage
          persistentVolumeClaim:
            claimName: lomva-app-storage
```

- [ ] **Step 2: 创建 app/api.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      initContainers:
        - name: wait-middleware
          image: busybox
          command:
            - sh
            - -c
            - |
              until nc -z postgres 5432 && nc -z redis 6379; do
                echo waiting for postgres/redis
                sleep 2
              done
        - name: wait-init
          image: busybox
          command:
            - sh
            - -c
            - |
              until [ -f /app/api/storage/.init_permissions ]; do
                echo waiting for init-permissions job
                sleep 2
              done
          volumeMounts:
            - name: storage
              mountPath: /app/api/storage
      containers:
        - name: api
          image: langgenius/dify-api
          envFrom:
            - configMapRef:
                name: lomva-config
            - secretRef:
                name: lomva-secret
          env:
            - name: MODE
              value: api
          ports:
            - containerPort: 5001
          startupProbe:
            httpGet:
              path: /health
              port: 5001
            periodSeconds: 5
            failureThreshold: 60
          readinessProbe:
            httpGet:
              path: /health
              port: 5001
            periodSeconds: 10
          volumeMounts:
            - name: storage
              mountPath: /app/api/storage
      volumes:
        - name: storage
          persistentVolumeClaim:
            claimName: lomva-app-storage
---
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - port: 5001
      targetPort: 5001
```

- [ ] **Step 3: 创建 app/api-websocket.yaml**

与 api 同镜像同存储，`SERVER_WORKER_CLASS` 覆盖为 WebSocket worker（对应 compose `collaboration` profile）。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-websocket
  labels:
    app: api-websocket
spec:
  replicas: 1
  selector:
    matchLabels:
      app: api-websocket
  template:
    metadata:
      labels:
        app: api-websocket
    spec:
      initContainers:
        - name: wait-middleware
          image: busybox
          command:
            - sh
            - -c
            - |
              until nc -z postgres 5432 && nc -z redis 6379; do
                echo waiting for postgres/redis
                sleep 2
              done
        - name: wait-init
          image: busybox
          command:
            - sh
            - -c
            - |
              until [ -f /app/api/storage/.init_permissions ]; do
                echo waiting for init-permissions job
                sleep 2
              done
          volumeMounts:
            - name: storage
              mountPath: /app/api/storage
      containers:
        - name: api-websocket
          image: langgenius/dify-api
          envFrom:
            - configMapRef:
                name: lomva-config
            - secretRef:
                name: lomva-secret
          env:
            - name: MODE
              value: api
            - name: SERVER_WORKER_AMOUNT
              value: "1"
            - name: SERVER_WORKER_CLASS
              value: geventwebsocket.gunicorn.workers.GeventWebSocketWorker
            - name: SERVER_WORKER_CONNECTIONS
              value: "1000"
            - name: GUNICORN_TIMEOUT
              value: "360"
          ports:
            - containerPort: 5001
          startupProbe:
            httpGet:
              path: /health
              port: 5001
            periodSeconds: 5
            failureThreshold: 60
          readinessProbe:
            httpGet:
              path: /health
              port: 5001
            periodSeconds: 10
          volumeMounts:
            - name: storage
              mountPath: /app/api/storage
      volumes:
        - name: storage
          persistentVolumeClaim:
            claimName: lomva-app-storage
---
apiVersion: v1
kind: Service
metadata:
  name: api-websocket
spec:
  selector:
    app: api-websocket
  ports:
    - port: 5001
      targetPort: 5001
```

- [ ] **Step 4: 创建 app/worker.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
  labels:
    app: worker
spec:
  replicas: 1
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      initContainers:
        - name: wait-middleware
          image: busybox
          command:
            - sh
            - -c
            - |
              until nc -z postgres 5432 && nc -z redis 6379; do
                echo waiting for postgres/redis
                sleep 2
              done
        - name: wait-init
          image: busybox
          command:
            - sh
            - -c
            - |
              until [ -f /app/api/storage/.init_permissions ]; do
                echo waiting for init-permissions job
                sleep 2
              done
          volumeMounts:
            - name: storage
              mountPath: /app/api/storage
      containers:
        - name: worker
          image: langgenius/dify-api
          envFrom:
            - configMapRef:
                name: lomva-config
            - secretRef:
                name: lomva-secret
          env:
            - name: MODE
              value: worker
          volumeMounts:
            - name: storage
              mountPath: /app/api/storage
      volumes:
        - name: storage
          persistentVolumeClaim:
            claimName: lomva-app-storage
```

- [ ] **Step 5: 创建 app/worker-beat.yaml**

compose 中 worker_beat 不挂存储卷，因此只需 wait-middleware。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker-beat
  labels:
    app: worker-beat
spec:
  replicas: 1
  selector:
    matchLabels:
      app: worker-beat
  template:
    metadata:
      labels:
        app: worker-beat
    spec:
      initContainers:
        - name: wait-middleware
          image: busybox
          command:
            - sh
            - -c
            - |
              until nc -z postgres 5432 && nc -z redis 6379; do
                echo waiting for postgres/redis
                sleep 2
              done
      containers:
        - name: worker-beat
          image: langgenius/dify-api
          envFrom:
            - configMapRef:
                name: lomva-config
            - secretRef:
                name: lomva-secret
          env:
            - name: MODE
              value: beat
```

- [ ] **Step 6: 创建 app/web.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels:
    app: web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: langgenius/dify-web
          envFrom:
            - configMapRef:
                name: lomva-web-config
          ports:
            - containerPort: 3000
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
    - port: 3000
      targetPort: 3000
```

- [ ] **Step 7: 创建 app/agent-backend.yaml**

env 对应 compose `agent_backend` 的 environment 块；机密值（`DIFY_AGENT_*` key/token）由 envFrom Secret 注入。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-backend
  labels:
    app: agent-backend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: agent-backend
  template:
    metadata:
      labels:
        app: agent-backend
    spec:
      initContainers:
        - name: wait-deps
          image: busybox
          command:
            - sh
            - -c
            - |
              until nc -z redis 6379 && nc -z plugin-daemon 5002; do
                echo waiting for redis/plugin-daemon
                sleep 2
              done
      containers:
        - name: agent-backend
          image: langgenius/dify-agent-backend
          envFrom:
            - secretRef:
                name: lomva-secret
          env:
            - name: DIFY_AGENT_REDIS_PREFIX
              value: dify-agent
            - name: DIFY_AGENT_PLUGIN_DAEMON_URL
              value: http://plugin-daemon:5002
            - name: DIFY_AGENT_INNER_API_URL
              value: http://api:5001
            - name: DIFY_AGENT_RUNTIME_BACKEND
              value: local
            - name: DIFY_AGENT_LOCAL_SANDBOX_ENDPOINT
              value: http://local-sandbox:5004
            - name: DIFY_AGENT_STUB_API_BASE_URL
              value: http://agent-backend:5050/agent-stub
            - name: DIFY_AGENT_SANDBOX_FILES_BASE_URL
              value: http://api:5001
            - name: DIFY_AGENT_SHUTDOWN_GRACE_SECONDS
              value: "30"
            - name: DIFY_AGENT_RUN_RETENTION_SECONDS
              value: "259200"
            - name: DIFY_AGENT_RUN_TIMEOUT_SECONDS
              value: "3600"
            - name: DIFY_AGENT_E2B_ACTIVE_TIMEOUT_SECONDS
              value: "3600"
          ports:
            - containerPort: 5050
          readinessProbe:
            tcpSocket:
              port: 5050
            initialDelaySeconds: 10
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: agent-backend
spec:
  selector:
    app: agent-backend
  ports:
    - port: 5050
      targetPort: 5050
```

- [ ] **Step 8: kustomization.yaml 的 resources 追加**

```yaml
  - app/init-job.yaml
  - app/api.yaml
  - app/api-websocket.yaml
  - app/worker.yaml
  - app/worker-beat.yaml
  - app/web.yaml
  - app/agent-backend.yaml
```

- [ ] **Step 9: 验证构建**

Run: `kubectl kustomize k8s/base > /tmp/lomva-base.yaml && grep -cE "^kind: Deployment$" /tmp/lomva-base.yaml && grep -cE "^kind: Job$" /tmp/lomva-base.yaml`
Expected: Deployment `11`（前序 5 个 + 本 task 6 个）、Job `1`；退出码 0。

- [ ] **Step 10: Commit**

```bash
git add k8s/base
git commit -m "feat(deploy): add api/worker/web/agent-backend manifests"
```

---

### Task 6: 网关 nginx

**Files:**
- Create: `k8s/base/config/nginx/nginx.conf`
- Create: `k8s/base/config/nginx/proxy.conf`
- Create: `k8s/base/config/nginx/default.conf`
- Create: `k8s/base/gateway/nginx.yaml`
- Modify: `k8s/base/kustomization.yaml`

**Interfaces:**
- Consumes: Service `api`/`api-websocket`/`web`/`plugin-daemon`。
- Produces: Service `nginx:80`（唯一对外入口）；ConfigMap `lomva-nginx-config`（key：`nginx.conf`、`proxy.conf`、`default.conf`）。

设计要点：compose 的 nginx 用 entrypoint + envsubst 做模板渲染，并依赖 Docker 内嵌 DNS（`resolver 127.0.0.11`）+ 变量间接 upstream。K8s 中 Service ClusterIP 稳定，直接静态渲染好三份配置挂 ConfigMap：去掉 resolver 与变量间接层，`proxy_pass` 直接写 Service 名；去掉 HTTPS/certbot 占位（TLS 在 CLB 层终止，见 README）。

- [ ] **Step 1: 创建 config/nginx/nginx.conf**

由 `docker/nginx/nginx.conf.template` 渲染（`NGINX_WORKER_PROCESSES=auto`、`NGINX_KEEPALIVE_TIMEOUT=65`、`NGINX_CLIENT_MAX_BODY_SIZE=100M`）：

```nginx
user  nginx;
worker_processes  auto;

error_log  /var/log/nginx/error.log notice;
pid        /var/run/nginx.pid;


events {
    worker_connections  1024;
}


http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile        on;

    keepalive_timeout  65;
    client_max_body_size 100M;

    include /etc/nginx/conf.d/*.conf;
}
```

- [ ] **Step 2: 创建 config/nginx/proxy.conf**

由 `docker/nginx/proxy.conf.template` 渲染（读写超时 3600s）：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Port $server_port;
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_buffering off;
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
```

- [ ] **Step 3: 创建 config/nginx/default.conf**

location 列表与 `docker/nginx/conf.d/default.conf.template` 一一对应；upstream 改为 K8s Service 名。`/socket.io/` 中 upgrade 头必须在 `include proxy.conf;` 之后（覆盖其中的 `Connection ""`），与模板顺序一致。

```nginx
server {
    listen 80;
    server_name _;

    location /console/api {
      proxy_pass http://api:5001;
      include proxy.conf;
    }

    location /api {
      proxy_pass http://api:5001;
      include proxy.conf;
    }

    location /socket.io/ {
      proxy_pass http://api-websocket:5001;
      include proxy.conf;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_cache_bypass $http_upgrade;
    }

    location /v1 {
      proxy_pass http://api:5001;
      include proxy.conf;
    }

    location /openapi {
      proxy_pass http://api:5001;
      include proxy.conf;
    }

    location /files {
      proxy_pass http://api:5001;
      include proxy.conf;
    }

    location /explore {
      proxy_pass http://web:3000;
      include proxy.conf;
    }

    location /e/ {
      proxy_pass http://plugin-daemon:5002;
      proxy_set_header Dify-Hook-Url $scheme://$host$request_uri;
      include proxy.conf;
    }

    location / {
      proxy_pass http://web:3000;
      include proxy.conf;
    }

    location /mcp {
      proxy_pass http://api:5001;
      include proxy.conf;
    }

    location /triggers {
      proxy_pass http://api:5001;
      include proxy.conf;
    }
}
```

- [ ] **Step 4: 创建 gateway/nginx.yaml**

三个配置文件以 subPath 挂载，覆盖镜像内同路径文件；沿用镜像默认 entrypoint。

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
          volumeMounts:
            - name: config
              mountPath: /etc/nginx/nginx.conf
              subPath: nginx.conf
            - name: config
              mountPath: /etc/nginx/conf.d/default.conf
              subPath: default.conf
            - name: config
              mountPath: /etc/nginx/proxy.conf
              subPath: proxy.conf
      volumes:
        - name: config
          configMap:
            name: lomva-nginx-config
---
apiVersion: v1
kind: Service
metadata:
  name: nginx
spec:
  selector:
    app: nginx
  ports:
    - port: 80
      targetPort: 80
```

- [ ] **Step 5: kustomization.yaml 追加**

resources 追加：

```yaml
  - gateway/nginx.yaml
```

configMapGenerator 追加：

```yaml
  - name: lomva-nginx-config
    files:
      - nginx.conf=config/nginx/nginx.conf
      - proxy.conf=config/nginx/proxy.conf
      - default.conf=config/nginx/default.conf
```

- [ ] **Step 6: 验证构建**

Run: `kubectl kustomize k8s/base > /tmp/lomva-base.yaml && grep -cE "^kind: (Deployment|StatefulSet|Service|Job|PersistentVolumeClaim|ConfigMap|Secret|Namespace)$" /tmp/lomva-base.yaml`
Expected: `43`（12 Deployment、3 StatefulSet、13 Service、1 Job、6 PVC、6 ConfigMap、1 Secret、1 Namespace）；退出码 0。

- [ ] **Step 7: Commit**

```bash
git add k8s/base
git commit -m "feat(deploy): add nginx gateway manifests"
```

---

### Task 7: TKE overlay（CLB Ingress + TCR 镜像替换示例）

**Files:**
- Create: `k8s/overlays/tke/kustomization.yaml`
- Create: `k8s/overlays/tke/ingress.yaml`

> **执行后修订（2026-08-17，域名确认后）**：对外地址定为 `https://qa-xai.xingshulin.com/lomva`（子路径部署），overlay 相应增加：
> - `config/public-urls.env`、`config/web-public.env`：以 `behavior: merge` 覆盖对外 URL 与 `NEXT_PUBLIC_BASE_PATH=/lomva`
> - `config/nginx/default.conf`：`/lomva` 子路径路由（剥前缀转发 api、保留前缀转发 web、根路径 `/socket.io/` 直通 api-websocket）；`nginx.conf`/`proxy.conf` 为 base 同内容副本，整体 `behavior: replace`
> - Ingress：host `qa-xai.xingshulin.com`，paths 为 `/lomva/` + `/socket.io/`；nginx readiness 探针 patch 为 `/lomva/`
> - web 镜像必须 `--build-arg NEXT_PUBLIC_BASE_PATH=/lomva` 自建（上游镜像仅支持根路径；socket.io client 的 path 固定 `/socket.io`，URL 子路径会被当作 namespace）

**Interfaces:**
- Consumes: base 全部资源；Service `nginx:80`。
- Produces: Ingress `lomva`（TKE CLB Ingress Controller 识别 `kubernetes.io/ingress.class: qcloud`）。

- [ ] **Step 1: 创建 overlays/tke/kustomization.yaml**

`images` 块默认整段注释：保持上游镜像；自建镜像推 TCR 后按需取消注释（README 有完整流程）。

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base
  - ingress.yaml

# 自建镜像推 TCR 后，取消注释并把 <tcr-namespace> 换成你的 TCR 命名空间：
# images:
#   - name: langgenius/dify-api
#     newName: ccr.ccs.tencentyun.com/<tcr-namespace>/lomva-api
#     newTag: 1.16.1-edify
#   - name: langgenius/dify-web
#     newName: ccr.ccs.tencentyun.com/<tcr-namespace>/lomva-web
#     newTag: 1.16.1-edify
#   - name: langgenius/dify-agent-backend
#     newName: ccr.ccs.tencentyun.com/<tcr-namespace>/lomva-agent-backend
#     newTag: 1.16.1-edify
#   - name: langgenius/dify-agent-local-sandbox
#     newName: ccr.ccs.tencentyun.com/<tcr-namespace>/lomva-agent-local-sandbox
#     newTag: 1.16.1-edify
#   - name: langgenius/dify-sandbox
#     newName: ccr.ccs.tencentyun.com/<tcr-namespace>/lomva-sandbox
#     newTag: 0.2.15
#   - name: langgenius/dify-plugin-daemon
#     newName: ccr.ccs.tencentyun.com/<tcr-namespace>/lomva-plugin-daemon
#     newTag: 0.6.10-local
```

- [ ] **Step 2: 创建 overlays/tke/ingress.yaml**

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: lomva
  annotations:
    # TKE CLB Ingress Controller
    kubernetes.io/ingress.class: qcloud
spec:
  rules:
    # 部署前改为实际域名；改完后同步更新 base/config/lomva-config.env 里的外部 URL 配置
    - host: lomva.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: nginx
                port:
                  number: 80
```

- [ ] **Step 3: 验证构建**

Run: `kubectl kustomize k8s/overlays/tke > /tmp/lomva-tke.yaml && grep -cE "^kind: Ingress$" /tmp/lomva-tke.yaml`
Expected: `1`；且输出中包含 base 的全部对象（总数比 Task 6 多 1）。退出码 0。

- [ ] **Step 4: Commit**

```bash
git add k8s/overlays
git commit -m "feat(deploy): add tke overlay with CLB ingress"
```

---

### Task 8: kind 本地端到端验证

**Files:** 无新增（纯验证 task；发现的问题回到对应 task 修复）

**Interfaces:**
- Consumes: 前面所有 task 的产物。

前置条件：本机已安装 docker、kind、kubectl（Docker Desktop 需分配 ≥8GB 内存）。

- [ ] **Step 1: 创建 kind 集群**

Run: `kind create cluster --name lomva-k8s-verify`
Expected: `Kind cluster "lomva-k8s-verify" created.`

- [ ] **Step 2: 部署 base（不含 Ingress，用 port-forward 验证）**

Run: `kubectl apply -k k8s/base`
Expected: 全部对象 `created`（namespace/configmap/secret/pvc/statefulset/deployment/job/service），无 error。

- [ ] **Step 3: 等待 Job 与有状态组件就绪**

```bash
kubectl -n qa-ai wait --for=condition=complete job/init-permissions --timeout=300s
kubectl -n qa-ai rollout status statefulset/postgres --timeout=300s
kubectl -n qa-ai rollout status statefulset/redis --timeout=300s
kubectl -n qa-ai rollout status statefulset/weaviate --timeout=300s
```

Expected: `job condition met`、`rollout status ... successfully rolled out` ×3。

- [ ] **Step 4: 等待全部 Deployment 就绪（api 首次 migration 较慢，给足 10 分钟）**

Run: `kubectl -n qa-ai wait --for=condition=available deploy --all --timeout=600s`
Expected: 12 个 Deployment 全部 `condition met`。
若不通过：`kubectl -n qa-ai get pods` 定位异常 Pod，`kubectl -n qa-ai logs <pod> -c <container>` 与 `describe pod` 排查（常见问题见 README FAQ），修复后重新 apply 并重跑本步骤。

- [ ] **Step 5: 端口转发并通过 nginx 验证链路**

```bash
kubectl -n qa-ai port-forward svc/nginx 8080:80 &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
curl -s http://localhost:8080/console/api/version
```

Expected: 第一条输出 `200`（或 307 跳转码也算 web 正常）；第二条输出 JSON，含 `"version": "1.16.1"`（证明 nginx → api → postgres 链路通，migration 已完成）。

- [ ] **Step 6: 抽查组件日志**

```bash
kubectl -n qa-ai logs deploy/plugin-daemon --tail=5
kubectl -n qa-ai logs deploy/sandbox --tail=5
kubectl -n qa-ai logs deploy/agent-backend --tail=5
kubectl -n qa-ai logs deploy/worker --tail=5
```

Expected: plugin-daemon 无数据库连接错误；sandbox 无 panic；agent-backend 无 redis 连接错误；worker 出现 celery `ready` 字样。

- [ ] **Step 7: 浏览器人工验证**

打开 `http://localhost:8080/install` 创建管理员账号 → 登录 → 设置中添加一个模型供应商（需自备 LLM API key）→ 创建空白应用发送一条消息，确认能收到回复（验证 api→plugin-daemon→模型 链路）。

- [ ] **Step 8: 清理**

```bash
kill %1 2>/dev/null  # 停掉 port-forward
kind delete cluster --name lomva-k8s-verify
```

Expected: `Deleted nodes` / `Deleted clusters`。

---

### Task 9: README 部署文档

**Files:**
- Create: `k8s/README.md`

**Interfaces:**
- Consumes: 所有 task 的最终产物路径与对象名。

- [ ] **Step 1: 创建 k8s/README.md**

完整内容如下：

````markdown
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

## TKE 部署

1. **修改 Secret（必须）**：编辑 `base/config/lomva-secret.env`，更换所有开发默认密钥
   （`SECRET_KEY` 可留空，api 会自动生成并持久化到共享存储）。
2. **修改域名**：编辑 `overlays/tke/ingress.yaml` 的 `host`；同步修改
   `base/config/lomva-config.env` 中 `TRIGGER_URL`、`ENDPOINT_URL_TEMPLATE` 和
   `base/config/web-config.env` 中 `NEXT_PUBLIC_SOCKET_URL`（`wss://你的域名`）。
3. **部署**：

   ```bash
   kubectl apply -k k8s/overlays/tke
   kubectl -n qa-ai wait --for=condition=available deploy --all --timeout=600s
   ```

4. **获取入口**：`kubectl -n qa-ai get ingress lomva` 的 ADDRESS 即 CLB VIP；
   将域名解析到该 IP。TLS 两种方案：a) 在 TKE 控制台为 CLB 绑定证书（443 转发到 Ingress）；
   b) 集群内装 cert-manager。配置后把 `lomva-config.env` 的外部 URL 改为 `https://`。

## 修改配置

所有非机密配置在 `base/config/lomva-config.env` / `web-config.env`，机密在
`base/config/lomva-secret.env`。改完重新 `kubectl apply -k ...` 即可——
kustomize 会给 ConfigMap/Secret 名加内容 hash，引用它们的 Pod 自动滚动更新。

## 自建镜像推 TCR（部署本仓库改动）

本仓库可构建 4 个组件镜像，另外 2 个直接转推上游镜像：

```bash
TCR=ccr.ccs.tencentyun.com/<你的命名空间>
TAG=1.16.1-edify

# 本仓库构建（在仓库根目录执行）
docker buildx build --platform linux/amd64 -t $TCR/lomva-api:$TAG -f api/Dockerfile api --push
docker buildx build --platform linux/amd64 -t $TCR/lomva-web:$TAG -f web/Dockerfile web --push
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
````

- [ ] **Step 2: 校对 README 与清单的一致性**

Run: `grep -n "qa-ai\|8080\|lomva-secret.env" k8s/README.md | head -10`
Expected: 命名空间、端口、文件名与实际清单一致；无引用不存在的文件。

- [ ] **Step 3: Commit**

```bash
git add k8s/README.md
git commit -m "docs(deploy): add TKE deployment guide"
```

---

## 执行后补充（2026-08-17）

- Task 7 修订：按真实域名改为子路径部署（见 Task 7 的修订块）
- 新增 `k8s/scripts/build-images.sh`（4 个仓库镜像构建 + 2 个上游镜像转推 + 推 TCR；web 自动带 `NEXT_PUBLIC_BASE_PATH=/lomva`）与 `k8s/scripts/deploy.sh`（集群确认 → apply → rollout 等待 → port-forward 冒烟检查），README 相应章节已改为脚本优先
- 新增 `.github/workflows/lomva-build-push.yml`：手动触发构建 4 个镜像推 Docker Hub（上游 build-push.yml 限定了 langgenius/dify 仓库 + Depot runner，无法复用）
- 数据库改名：主库 `lomva`、plugin 库 `lomva_plugin`（纯 env，无代码改动；主库需 `uuid-ossp` 扩展）
- PostgreSQL 外置化（QA 用外部 PG）：`postgres.yaml` 从 base 移到 `k8s/components/incluster-postgres/`（kustomize Component）；`overlays/local`（kind 验证）引用该组件，`overlays/tke` 不引用并通过 `config/external-services.env` 合并外部 `DB_HOST`/`DB_PORT`；wait initContainer 已改为跟随 `DB_HOST` 配置；deploy.sh 的 StatefulSet 等待改为按存在性跳过
- Ingress 修正：集群实际为 nginx-ingress controller（共享 CLB），非 TKE qcloud；补充 proxy-body-size 与 SSE 超时注解
- 2026-08-18 环境拆分：`overlays/tke` 重构为三层——`overlays/subpath`（/lomva 子路径中间层：nginx 配置替换 + 探针 patch，不直接部署）、`overlays/qa`（测试：qa-xai 域名 + **外部自建 PG**、namespace qa-ai）、`overlays/prod`（线上：**TencentDB PG**、namespace prod-ai、域名占位）；namespace 对象从 base 移至各环境 overlay；`deploy.sh` 的 OVERLAY/NAMESPACE 均可传参（默认 qa）

## Self-Review 记录

- **Spec 覆盖**：目录结构（Task 1-7）、16 组件（Task 2-6，init_permissions=Job）、ConfigMap/Secret（Task 1）、6 个 PVC（Task 2/4/5）、Ingress+port-forward（Task 7/8）、TCR 流程+托管切换+pgvector 说明+FAQ（Task 9）、验证标准（Task 8）。spec 的 `base/config/` 落为 generator env 文件（kustomize 惯例，等价）。
- **类型/命名一致性**：Service 名、Secret key、PVC 名已逐一对照全局接口表检查；`agent-squid.conf.template` 的 dstdomain 已改为连字符名。
- **已知取舍**：compose 的 ssrf_proxy_network 等网络隔离未翻译为 NetworkPolicy（README 安全说明中声明）；api/worker 的 Sentry 等可观测性 env 未纳入（默认关闭）。
