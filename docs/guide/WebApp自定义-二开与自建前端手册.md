# WebApp 自定义手册：二次开发与自建前端

> 面向本仓库（edify / lomva 部署）的研发。覆盖两条路径：**A. 改本仓库 web 代码（二开）**、**B. 不动 Dify 前端、自建前端对接 API**。
> 关联文档：《工作空间机制说明-功能开发与运维手册》（WebApp 品牌 Logo 设置入口在「自定义」tab）。

## 1. 路径选择

| | 路径 A：二开改代码 | 路径 B：自建前端对接 API |
|---|---|---|
| 适合 | 改样式/文案/聊天交互细节、嵌入 SDK 行为 | 深度定制 UI、嵌入自有产品体系、自有账号/埋点体系 |
| 成本 | 改完需自构 web 镜像（构建期固化环境变量） | 需要自建前端（建议再加一层后端代理保护 API Key） |
| 升级 | 跟随上游 rebase 有合并成本 | 只依赖 `/v1` 契约，升级最稳 |

**本仓库建议**（决策对象仅为终端用户侧 WebApp；控制台登录/成员管理社区版已完整，不在此列）：

- **选 A**：WebApp 面向内部人员、UI 接受内置样式、匿名访问可接受（或加网关 basic auth 即够）。注意内置 webapp 的会话历史只在浏览器本地（匿名 passport 存 localStorage）。
- **选 B**：面向外部用户/客户；需要自有用户身份映射（`/v1` 的 `user` 参数，会话服务端连续）；或深度嵌入自有产品。B 的真实成本：会话历史侧栏、引用浮层、反馈、建议问题、附件、语音等内置能力需全部自建。
- 无论 A/B，升级成本上 B 更稳（只依赖 `/v1` 公开契约；A 改的 `base/chat/` 是上游高频变动区）。可混合推进：先 A 微调快速上线，触墙再上 B。

## 2. WebApp 现状架构（两条路径的共同前提）

### 2.1 路由（`web/app/(shareLayout)/`）

URL 中的 `token` 即应用分享码（share code），由 `web/service/webapp-address.ts:26` 解析。**生成机制**（api 侧）：

- 应用创建时自动生成：`events/event_handlers/create_site_record_when_app_created.py:14` 建 `sites` 记录，`code = Site.generate_code(16)`（`models/model.py:2357`，16 位 CSPRNG 随机串、查重重试）——**无需手动操作**。
- 控制台「重新生成公开链接」→ `POST /apps/<id>/site/access-token-reset`（`controllers/console/app/site.py:138`），换新码、**旧链接立即失效**。
- 域名部分：`Site.app_base_url`（`model.py:2366`）= `APP_WEB_URL` 或回退请求 origin（**正式部署必须显式配，否则反代场景易推导错**）。控制台展示 URL 的完整拼接：`{app_base_url}{NEXT_PUBLIC_BASE_PATH}/{路由段}/{code}`（`app/overview/embedded/index.tsx:77`）。本仓库 QA 约定 `APP_WEB_URL` 只写 origin，web 前端自行拼 `/lomva` basePath（`k8s/overlays/qa/config/public-urls.env:9`）。
- **分享码与路径段均不可自定义**（`sites.customize_domain` / `customize_token_strategy` 是企业版自定义域名遗留，社区版 `NOT_ALLOW`）；自定义只能走部署层（域名/子路径）。

| 路由 | 应用类型 | 页面组件 |
|---|---|---|
| `/chat/[token]` | 普通 Chat / Chatflow | `chat-with-history/`（带会话历史侧栏） |
| `/agent/[token]` | 新 Agent Chat | 同上 + `isNewAgent`（Agent Roster 渲染） |
| `/chatbot/[token]` | 嵌入式 Chatbot | `embedded-chatbot/` |
| `/completion/[token]` | 文本生成 | `share/text-generation/Main` |
| `/workflow/[token]` | Workflow 型 | 同上（`isWorkflow`） |
| `/webapp-signin` | WebApp 登录页 | 企业版 webapp_auth 开启时用 |

### 2.2 终端用户鉴权（passport）

- `(shareLayout)/layout.tsx` 注入 `WebAppStoreProvider` + `Splash`；`Splash`（`components/splash.tsx:62`）检查 `/api/login/status`，passport 过期则 `GET /api/passport` 重取，存 localStorage（`passport-<appCode>`）。
- 之后所有公开请求自动带头：`Authorization`（passport JWT）、`X-App-Code`、`X-App-Passport`（`service/fetch.ts:89`、`config/index.ts:109-113`）。
- `AuthenticatedLayout` 再拉应用数据并校验访问权限（`/api/webapp/permission`），无权限渲染 403。
- 后端签发：`api/controllers/web/passport.py:41`（匿名创建/复用 `EndUser`，JWT payload 含 app_id/app_code/end_user_id）。
- **访问控制三层**：
  1. 匿名 passport（始终生效）：`/api/*` 强制 `validate_jwt_token`（`web/wraps.py:162`），但 passport 凭分享码即可匿名换——**分享码即凭证，泄露用 access-token-reset 吊销**。
  2. WebApp 访问控制（**企业版能力，本 fork COMMUNITY 不能直接开**：① 特性开关仅 ENTERPRISE 置 true（`feature_service.py:109`）；② 访问模式读写全部转发闭源企业后端 `ENTERPRISE_API_URL`（`enterprise_service.py:290-327`），本地无表）。按应用三模式 `public` / `internal`（工作空间账号登录，`/webapp-signin` + `POST /api/login`、`/api/email-code-login`）/ `external`（企业 SSO 换 passport，`web/wraps.py:106-159` 严格校验）；前端经 `GET /api/webapp/access-mode|permission` 决定登录页/403；控制台按应用配置（`console/app/app.py:519-527`）。
     - **自研 internal 的改造点**（执行件本地已齐，只缺存取层）：`sites` 表加 `access_mode` 列/新表 + 本地 get/update（替换调用点 `webapp_auth_service.py:150/181`、`console/app/app.py:519/877`、`app_service.py:657`）；`webapp_auth.enabled` 改为 env 配置驱动。登录后端（`webapp_auth_service.py:36-133`）与前端 `/webapp-signin`/403 流程均现成，前端零改。`external`（SSO）无本地实现，不要纳入范围。
  3. 社区版替代：重置分享码收敛访问 / nginx 对 webapp 路径挂 basic auth 或 SSO 前置 / 自建后端代理（§4.6 方案 2）把鉴权收归自有侧。

### 2.3 配置数据流（WebApp 设置 → 前端消费）

console 侧「WebApp 设置」（图标、主题色、开场白、建议问题、文件上传、TTS 等）经三个接口下发——**注意都在 `/api` 前缀**（不是 `/v1`）：

| 数据 | 接口 | 前端封装 |
|---|---|---|
| 站点信息（标题/图标/主题色/默认语言） | `GET /api/site` | `service/share.ts:142` |
| 应用参数（开场白、文件上传、TTS、建议问题） | `GET /api/parameters` | `service/share.ts:234` |
| 元数据（tool_icons 等） | `GET /api/meta` | `service/share.ts:313` |

消费点：chat 类 `chat-with-history/hooks.tsx:134-165`；completion/workflow 类 `share/text-generation/hooks/use-text-generation-app-state.ts:84-178`。favicon/标题：`hooks/use-app-favicon.ts`、`use-document-title.ts`。

## 3. 路径 A：二开改代码

### 3.1 聊天组件地图（`web/app/components/base/chat/`）

| 要改什么 | 位置 |
|---|---|
| 整体布局/历史侧栏 | `chat-with-history/index.tsx:21`、`embedded-chatbot/index.tsx:21` |
| 单条回答渲染（内容/过程/引用/反馈/建议问题） | `chat/answer/index.tsx:48` |
| Agent 思考链/工具详情 | `chat/answer/agent-content.tsx:14`、`chat/thought/index.tsx:21` |
| Reasoning 思维链面板 | `chat/answer/reasoning-panel.tsx:14` |
| Workflow 过程展示 | `chat/answer/workflow-process.tsx` |
| 输入框/附件/语音入口 | `chat/chat-input-area/index.tsx:63` |
| 引用浮层 | `chat/citation/index.tsx:19`、`citation/popup.tsx` |
| 点赞/复制/重新生成 | `chat/answer/operation.tsx:79`（提交 `POST /api/messages/{id}/feedbacks`） |
| 开场白变量替换 | `chat/hooks.ts:245` `getIntroduction` + `chat/utils.ts:5` |
| Markdown/代码块/think 块 | `base/markdown/index.tsx:35`（Streamdown）、`base/markdown-blocks/` |

### 3.2 主题与品牌

- **Tailwind v4，无 `tailwind.config.ts`**：全局样式 `app/styles/globals.css` → `tailwind-core.css`；设计 token 与暗色主题来自共享包 **`packages/dify-ui`**（`src/styles/`、`src/themes/light.css/dark.css`，`html[data-theme='dark']` 切换），web 侧只覆盖 `themes/manual-light.css` / `manual-dark.css`。改基础色板去 dify-ui，改局部覆盖去 themes/。
- **WebApp 主题色**（console 里配的主题色）：`embedded-chatbot/theme/theme.ts:16` `createTheme()` 生成 header/按钮/气泡色，chat-with-history 与 embedded-chatbot 均消费。
- **品牌 Logo 替换**：console「自定义」tab（`custom/custom-page/`）→ `POST /api/workspaces/custom-config` 存 `replace_webapp_logo` / `remove_webapp_brand` → WebApp 从 `AppData.custom_config` 消费（embedded-chatbot 页脚、text-generation 侧栏）。该 tab 受 `can_replace_logo` feature 开关控制。
- **i18n**：`web/i18n/<locale>/` 下 `share.json`（聊天文案，含「Powered by」）、`login.json`、`common.json`；WebApp 按 `site.default_language` 切换语言。

### 3.3 嵌入 SDK（embed.js）

- 源码 `web/public/embed.js`（IIFE）：读 `window.difyChatbotConfig`（token/baseUrl/routeSegment/inputs/systemVariables/draggable…），对变量 gzip+base64 编进 iframe URL，创建气泡按钮 + iframe 窗口，`postMessage` 通信（`dify-chatbot-iframe-ready` / `dify-chatbot-expand-change`）。
- 构建：`pnpm uglify-embed`（`bin/uglify-embed.js`）产出 `embed.min.js`；**改 embed.js 后必须重跑压缩**，Dockerfile 会 COPY `web/public` 进镜像（`web/Dockerfile:85`）。
- 控制台「嵌入」弹窗的 iframe/script 片段模板：`app/components/app/overview/app-card-utils.ts:69-148`。

### 3.4 构建与部署（本仓库）

```bash
# k8s：自构镜像（构建期固化 NEXT_PUBLIC_*，子路径必须带对）
TCR_NAMESPACE=ccr.ccs.tencentyun.com/<ns> TAG=<tag> ./k8s/scripts/build-images.sh
# 其中 lomva-web 由 web/Dockerfile 构建，NEXT_PUBLIC_BASE_PATH 默认 /lomva
```

关键约束：

- `NEXT_PUBLIC_API_PREFIX`（console API）、`NEXT_PUBLIC_PUBLIC_API_PREFIX`（webapp `/api`）、`NEXT_PUBLIC_BASE_PATH` 等都是**构建期固化**（`web/config/index.ts:14-21`），改这些值必须重新构建镜像，运行期改 env 无效。
- docker compose 默认用上游镜像 `langgenius/dify-web:1.16.1`——**本地二开需自行 build web 镜像替换**，否则改动不生效。
- 子路径部署细节（CSRF cookie 名、Next 308 与 nginx 目录式 301 的循环规避）见 `config/index.ts` 的 `CSRF_COOKIE_NAME` 注释与 `k8s/overlays/subpath/config/nginx/default.conf`。

## 4. 路径 B：自建前端对接 API

### 4.1 两个 API 面对比

| | Service API `/v1`（**自建前端用这个**） | Web 内部 `/api`（Dify 自带 webapp 用） |
|---|---|---|
| 鉴权 | `Authorization: Bearer <app API-Key>`（`service_api/wraps.py:99` `@validate_app_token`） | passport JWT（cookie 或 `X-App-Passport` 头） |
| 终端用户标识 | 请求体/参数里的 `user` 字段（服务端按它创建/复用 EndUser） | passport 内含 end_user_id |
| 流式 | `response_mode=streaming/blocking` 可选 | chat 强制 streaming |
| 独有能力 | annotation 管理、workflow logs | saved-messages、会话置顶、webapp 登录/SSO |
| 适用 | 自建前端/服务端集成 | 不建议外部对接（契约随版本变） |

API Key 获取：console 应用详情「访问 API」页（后端 `controllers/console/apikey.py`，`/apps/<id>/api-keys`）。

> **安全建议**：API Key 不要下发到浏览器。自建前端 → 自有后端代理 → Dify `/v1`，代理层注入 Key 并映射你们的用户体系到 `user` 字段。

### 4.2 `/v1` 接口清单（`api/controllers/service_api/`，蓝图 `url_prefix="/v1"`）

| 能力 | 接口 | 控制器 |
|---|---|---|
| 对话（SSE/blocking） | `POST /v1/chat-messages`、`POST /v1/chat-messages/{task_id}/stop` | `app/completion.py:312` |
| 文本生成 | `POST /v1/completion-messages` + `/stop` | `app/completion.py:169` |
| Workflow 执行 | `POST /v1/workflows/run`、`GET /v1/workflows/run/{id}`、`GET /v1/workflow/{task_id}/events`（SSE 事件补拉）、`/stop`、`GET /v1/workflows/logs` | `app/workflow.py`、`app/workflow_events.py` |
| 会话管理 | `GET/DELETE /v1/conversations`、`POST /{id}/name`、`GET/PUT /{id}/variables` | `app/conversation.py` |
| 消息 | `GET /v1/messages`、`POST /v1/messages/{id}/feedbacks`、`GET /{id}/suggested`、`GET /v1/app/feedbacks` | `app/message.py` |
| 文件/语音 | `POST /v1/files/upload`、`/v1/audio-to-text`、`/v1/text-to-audio` | `app/file.py`、`app/audio.py` |
| 应用配置 | `GET /v1/parameters`、`/v1/meta`、`/v1/info`、`/v1/site` | `app/app.py`、`app/site.py` |
| 标注回复 | `/v1/apps/annotation-reply/*`、`/v1/apps/annotations` CRUD | `app/annotation.py` |

### 4.3 SSE 事件流（`response_mode=streaming`）

事件枚举 `StreamEvent`（`core/app/entities/task_entities.py:62`），按序处理：

- 正文：`message`（普通）/ `agent_message` + `agent_thought`（Agent）/ `text_chunk`、`reasoning_chunk`（chatflow）
- 过程：`workflow_started/finished`、`node_started/finished`、`iteration_*`、`loop_*`、`agent_log`
- 其他：`message_file`（产出文件）、`message_replace`（审核替换）、`tts_message`、`ping`、`error`、`human_input_required`（人工介入）
- 收尾：`message_end` —— `metadata` 内含 `usage`（token/费用/延迟/首 token 耗时）、`retriever_resources`（RAG 引用，含 dataset/document/segment/score/content，见 `core/rag/entities/citation_metadata.py:6`）

blocking 模式则一次性返回 JSON（`libs/helper.py:412` `compact_generate_response` 按 `response_mode` 分流）。

### 4.4 文件与语音约束

- 附件 schema：`files[]` 每项需 `type`（document/image/audio/video/custom）+ `transfer_method`（`remote_url` 给 url / `local_file` 先 `/files/upload` 拿 `upload_file_id`）。
- 大小限制（`configs/feature/__init__.py:443-476`，可 env 调整）：普通文件 15MB、图片 10MB、视频 100MB、音频 50MB；**单次只能传一个文件**；扩展名黑名单 `UPLOAD_FILE_EXTENSION_BLACKLIST`。
- 语音：ASR 上限 30MB 硬编码（`services/audio_service.py:31`）；TTS 返回 `audio/mpeg` 流，需应用开启 TTS 并选 voice。

### 4.5 本部署的接入地址与注意事项

- QA 环境 base URL：`https://qa-xai.xingshulin.com/lomva/v1`（子路径部署，nginx 剥 `/lomva` 前缀后转发 api，见 `k8s/overlays/subpath/config/nginx/default.conf:44`）。生产同理换域名。
- **域名/路径要求**：对调用方（自建前端）**无域名要求**——`/v1` 凭 API Key 鉴权、不带 cookie，蓝图未设 origins 即 flask_cors 默认全开放（`extensions/ext_blueprints.py:39-45`）。路径要求只在 Dify 自身地址上：子路径部署必须带 `/lomva` 前缀。
- CORS：`/v1` 与 `/files` 默认允许任意源（无 credentials）；`/api`（web 蓝图）由 `WEB_API_CORS_ALLOW_ORIGINS` 控制、默认 `*`（`configs/feature/__init__.py:595-603`）。浏览器直连 `/v1` 开箱可用，但注意：原生 `EventSource` 不能带 `Authorization` 头，SSE 需用 fetch 流式读取（如 fetch-event-source）。
- 文件/图片 URL：响应中的附件地址指向 Dify 域名（`FILES_URL` 留空按请求推导，`configs/feature/__init__.py:418`）；`<img>/<audio>` 直接引用不受 CORS 限制，fetch 下载走 `/files` 也默认放行。
- 限流：service API 对话接口**无独立限流**；上游模型限流会以 429 `rate_limit_error` 透传，自建前端要处理重试/降级。
- 超时：api 侧对外读/写超时默认 600s（`HTTP_REQUEST_MAX_*`），SSE 长连接无碍；nginx/ingress 层的超时另算。

### 4.6 分享码如何映射到自定义页面

「16 位码 → 应用」的映射在 api 侧完成：`GET /api/passport` 凭请求头 `X-App-Code: <码>` 查 `sites` 表（`code` 列）签发 passport（`controllers/web/passport.py:58-77`）；后续请求由 passport + `X-App-Code` 解析 app（`web/wraps.py:46`、`services/app_service.py:1082`）。自定义页面/资源部署在任意域名均可，只要请求带对 code。四种方案：

| 方案 | 做法 | 适合 | 代价 |
|---|---|---|---|
| 1. 自定义页面 + 复用 `/api` 匿名链路 | 从自有 URL 取 code → `GET /api/passport`（头 `X-App-Code`）→ 后续请求带 `X-App-Code` + `X-App-Passport`；`/api/site` 拿图标/主题等配置 | 保留免登录匿名用户语义、改动小 | `/api` 是内部契约，随版本可能变 |
| 2. 自有后端代理 + `/v1` API Key（生产推荐） | 后端维护「code/自有 slug → API Key」映射，前端只跟自有后端通信；自有用户 id 映射为 `user` 参数 | 深度定制 UI、自有账号体系、Key 保护 | 需写代理层 |
| 3. nginx 接管 webapp 路由段 | 改 `k8s/base/config/nginx/default.conf` + `overlays/subpath/...`：把 `/lomva/chat` 等段 proxy 到自有静态服务，其余 `/lomva/` 仍走 web:3000 | 要求公开链接原样不变 | 每个应用类型路由段都要列，与 Dify web 同源耦合 |
| 4. 网关 rewrite 美化短链 |  ingress/网关加「美化路径 → `/lomva/chat/<code>`」rewrite | 只要对外的短链好看 | 映射表自行维护 |

应用图标等资源：`/api/site` 返回签名 URL（指向 Dify 域名），自定义页面直接 `<img src>` 引用即可（`/files` 蓝图 CORS 默认放行）。

## 5. 常见任务速查

| 任务 | 入口 |
|---|---|
| 改聊天消息气泡/Markdown 样式 | `base/chat/chat/answer/` + `themes/manual-*.css` |
| 改嵌入气泡按钮行为 | `web/public/embed.js` → `pnpm uglify-embed` → 重构镜像 |
| 去掉「Powered by Dify」 | 品牌设置（需 `can_replace_logo`）或 i18n `share.json` + `embedded-chatbot` 页脚代码 |
| 让 webapp 改动上线 | `build-images.sh` 构 lomva-web（**带对 NEXT_PUBLIC_BASE_PATH**）→ 更新 overlay images → deploy |
| 控制台公开链接域名/路径不对 | 检查 `APP_WEB_URL`（只写 origin，带子路径会变双前缀；改后重启 api/worker）与 web 镜像构建参数 `NEXT_PUBLIC_BASE_PATH`（传错需重构镜像） |
| 给 webapp 加登录门槛 | 三条路：① 网关 basic auth/SSO 前置（零代码）；② 自建后端代理（§4.6 方案 2）；③ 自研 internal 模式（§2.2 改造点，后端中等工作量）。临时收敛可重置分享码 |
| 自建聊天 UI | `/v1/chat-messages`（SSE）+ `/v1/conversations` + `/v1/messages`，后端代理持 Key |
| 展示 RAG 引用来源 | 解析 `message_end.metadata.retriever_resources` |
| 接入自有账号体系 | 代理层把自有用户 id 映射为 `user` 参数；或评估企业版 webapp_auth |

## 6. 参考链接

- Service API 官方参考：<https://docs.dify.ai/zh/api-reference/chat-messages/>（同目录 conversations/messages/files/audio 各页）
- 本仓库相关代码：`web/app/(shareLayout)/`、`web/app/components/base/chat/`、`web/public/embed.js`、`packages/dify-ui/`、`api/controllers/service_api/`、`api/controllers/web/`、`web/config/index.ts`、`k8s/scripts/build-images.sh`
