# Agent 架构梳理（新旧）与摘除评估

> 调研日期：2026-08-22。范围：edify（Dify 1.16.1 fork）中两套 Agent 功能的组成、依赖关系，
> 以及「新 Agent 栈是否可以摘除」的评估与操作方案。
> 结论先行：**新旧 Agent 运行时完全独立；新栈可摘除，分「部署层」（容易可逆）与「代码层」（大工程）两级。**

## 1. 两套 Agent 是什么

| | **旧 Agent**（上游 Dify 原生） | **新 Agent**（edify fork 新增） |
|---|---|---|
| 用户功能 | `agent-chat` 应用模式（ReAct / Function Calling 策略）；workflow 旧 Agent 节点（插件化策略） | **Agent App**（`AppMode.AGENT`）、workflow **Agent v2 节点**、Build/发布（Home Snapshot）、沙箱文件浏览、Composer/Roster/Drive |
| 运行位置 | **api 进程内**：`api/core/agent/`（`fc_agent_runner.py`、`cot_*_agent_runner.py`）+ `api/core/app/apps/agent_chat/` | 独立服务 **agent-backend**（FastAPI，端口 5050，Pydantic AI 编排），代码在 `dify-agent/` |
| 执行面 | 无沙箱 | **local-sandbox**（Go shellctl，端口 5004，tmux 作业 + Landlock 隔离 + 内嵌 SQLite `jobs` 表），代码在 `dify-agent-runtime/`；出向经 **agent-ssrf-proxy**（squid） |
| 数据存储 | 通用表：`apps` / `conversations` / `messages` / `message_agent_thoughts` | 主库 PG 中 **10 张 `agent_*` 专用表**（见 `api/models/agent.py:143-565`）；agent-backend 服务自身只用 **Redis**（`dify-agent` 前缀的 run 记录与事件流）；runtime 用本地 SQLite |
| 运行时依赖 | Tool 系统（经 `ToolManager` → `PluginToolManager` 间接用 plugin-daemon 加载插件工具）；**不依赖 sandbox、不碰 agent-backend** | 主 api（inner-api 回调：文件/Config/Drive）、plugin-daemon（模型/工具调用）、Redis |

## 2. 调用关系与独立性

```
旧 Agent：用户 → api（AgentChatAppGenerator → core/agent 的 FC/CoT runner）→ 完成
                全程 api 进程内，不含任何 AGENT_BACKEND 引用

新 Agent：用户 → api（AgentAppGenerator / DifyAgentNode / services/agent/*）
                --HTTP--> agent-backend:5050 --HTTP--> local-sandbox:5004
                agent-backend --HTTP--> api /inner/api/agent/*（Agent Stub 回调）
```

**独立性的代码证据**：

- 调度入口按应用模式分流：`api/services/app_generate_service.py:174-221`（`AGENT_CHAT` → 旧；`AGENT` → 新）
- 旧路径（`api/core/agent/`、`api/core/app/apps/agent_chat/`）中搜不到任何 `agent_backend` / `AGENT_BACKEND` 引用
- `dify-agent/` 源码不 import 主 api 代码；仅新栈的部分 service 复用了 `core.agent.publish_visibility` 辅助函数（`api/services/agent/composer_service.py:10` 等）
- DB 表名无交集；唯一交集是 `conversations.agent_workspace_binding_id` 列（新栈专用，旧 Agent 该列为空，`api/models/model.py:1201`）

**结论：摘除新栈不影响旧 Agent（`agent-chat`）应用类型、普通 chat/workflow/completion 应用、知识库、插件等全部既有功能。**

## 3. 新栈失效时的行为（摘除前必须知道）

无总开关。agent-backend 不可用时：

| 功能 | 行为 |
|---|---|
| Agent App 聊天（mode=agent） | SSE 流推送错误事件，请求失败（`api/core/app/apps/agent_app/app_generator.py:530-534`） |
| 工作流 Agent v2 节点 | 节点失败事件，不拖垮整个工作流（`api/core/workflow/nodes/agent_v2/agent_node.py:563-580`） |
| Agent Build Apply / 发布 | 直接失败（Home Snapshot 创建需调用 agent-backend） |
| 沙箱文件浏览/下载 | 502 `agent_backend_unreachable`（`api/controllers/console/app/agent_app_sandbox.py:135-148`） |
| Agent CRUD、日志、Config/Drive Inspector | **正常**（纯 DB 操作，不调 agent-backend） |

现有开关的局限：

- `NEXT_PUBLIC_ENABLE_AGENT_V2=false`：**仅隐藏前端 UI**（导航/列表/节点面板），后端 API 仍注册可调
- `AGENT_BACKEND_USE_FAKE`：换假客户端，仅用于测试
- `AGENT_SHELL_ENABLED`：只控制是否下发 shell 层，不关闭调用
- `AGENT_BACKEND_BASE_URL` 留空：客户端工厂直接抛 `ValueError`，**不是**安全关闭方式

## 4. 摘除方案

### 方案 A：部署层摘除（容易、可逆，推荐第一步）

摘掉 3 个运行时组件：agent-backend、local-sandbox、agent-ssrf-proxy。代码保留，随时可恢复。

**步骤（以 k8s 为例）**：

1. **摘除前检查存量**：确认是否已创建过 Agent App / 含 Agent v2 节点的工作流
   （查 PG：`SELECT id,name FROM apps WHERE mode='agent';`——有则说明功能在用，慎重）
2. **隐藏前端入口**：web 镜像以 `NEXT_PUBLIC_ENABLE_AGENT_V2=false` 重新构建
   （build 期变量，必须重建镜像；见 `web/features/agent-v2/feature-flag.ts:3`）
3. **k8s 清单摘除**：
   - `k8s/base/kustomization.yaml`：移除 `app/agent-backend.yaml`、`runtime/local-sandbox.yaml`、`proxy/agent-ssrf-proxy.yaml` 引用
   - `k8s/base/network-policy.yaml`：移除/调整对 `local-sandbox`、`agent-ssrf-proxy` 的策略
   - `k8s/base/config/lomva-config.env` 与 secret 中的 `AGENT_BACKEND_*` / `DIFY_AGENT_*`：可保留（服务缺席时仅相关功能报错），建议注释标注
4. **apply 后手动删除已部署资源**（apply 不删资源）：
   ```bash
   kubectl -n qa-ai-lomva delete deploy/lomva-agent-backend deploy/lomva-agent-local-sandbox deploy/lomva-agent-ssrf-proxy
   kubectl -n qa-ai-lomva delete svc/agent-backend svc/local-sandbox svc/agent-ssrf-proxy
   ```
5. **验证**：主功能冒烟（chat/workflow/知识库/插件）；Agent 相关页面已隐藏；
   已存在的 Agent App 打开会报错（符合预期，步骤 1 已确认无存量）
6. **残留无害项**：Redis 中 `dify-agent:*` key、PG 中 `agent_*` 表——均不再被读写，保留不影响

**回退**：恢复 kustomization 引用 → apply → web 镜像换回原构建。分钟级。

### 方案 B：代码层摘除（大工程，确定永久不用后再做）

前置：方案 A 已稳定运行一段时间（建议 ≥2 周）。涉及面：

| 层面 | 清理内容 |
|---|---|
| api 依赖 | `api/pyproject.toml:12,68` 的 `dify-agent` 可编辑依赖；`api/Dockerfile:27-28` 的 `COPY dify-agent/`（**不先清这两项，api 环境安装/镜像构建会直接失败**） |
| api 代码 | `api/clients/agent_backend/` 整目录；`api/core/app/apps/agent_app/`；`api/core/workflow/nodes/agent_v2/` + `node_factory.py:520-552` 注入；`api/services/agent/`、`api/services/agent_app_sandbox_service.py`；`api/controllers/console/` 的 8 个 agent 模块（`__init__.py:49-82` 注册处同步清） |
| api 配置 | `api/configs/extra/agent_backend_config.py`；`api/.env.example:705-709` |
| DB | `api/models/agent.py` 10 张表 + 相关 migration（表可留库不删，代码引用须清；`conversations.agent_workspace_binding_id` 列可留） |
| 前端 | `web/features/agent-v2/`、`web/app/components/workflow/nodes/agent-v2/`、`web/env.ts` 的 flag |
| 构建/CI | `Makefile:166-197`；`.github/workflows/` 中 build-push、docker-build、lomva-build-push、main-ci、sandbox-runtime-tests、post-merge、web-e2e 的 agent 相关段 |
| 部署 | 方案 A 的 k8s 项 + `docker/docker-compose*.yaml` 的 3 个服务、`docker/envs/core-services/` 两个 env 模板、`docker/ssrf_proxy/squid-agent.conf.template`、`k8s/scripts/build-images.sh:41-42` |
| 交叉构建 | `dify-agent-runtime/Makefile:25-26` 生成物写入 `dify-agent/`（`_agent_cli_help.json`） |

### 决策点（待产品层面确认）

**新 Agent（Agent App / Agent v2）是不是 edify 的核心功能？** fork 与上游的主要差异即这套栈：

- 是核心 → 保留现状，无需任何动作
- 暂不用 → 走方案 A（本迭代可做，分钟级回退）
- 永不使用 → A 观察后做方案 B（单独排期；额外收益：api 依赖树瘦身、镜像构建加速、追上游更容易）

## 5. 附：新栈组件速查

| 组件 | 代码 | 镜像 | 端口 | 存储 |
|---|---|---|---|---|
| agent-backend | `dify-agent/`（Python 3.12 / FastAPI） | lomva-agent-backend | 5050 | Redis（run 记录/事件流） |
| local-sandbox | `dify-agent-runtime/`（Go / shellctl） | lomva-agent-local-sandbox | 5004 | 内嵌 SQLite（jobs 表） |
| agent-ssrf-proxy | squid 配置 `docker/ssrf_proxy/squid-agent.conf.template` | ubuntu/squid | 3128 | 无 |
