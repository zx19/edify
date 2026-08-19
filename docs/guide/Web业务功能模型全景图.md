# Dify-Web 业务功能模型全景图

> 基于 dify-web v1.16 路由结构梳理，用于指导自研控制台的模块划分和开发优先级。
> （API 接口列已于 2026-08-19 按本仓库 `api/controllers/` 实际路由校准。）

---

## 一、顶层功能分区

Dify 控制台分为 **5 个顶层区域**：

```
┌─────────────────────────────────────────────────────┐
│                    Dify 控制台                        │
├──────────┬──────────┬──────────┬──────────┬─────────┤
│  认证区   │  工作台   │  应用区   │  资源区   │ 设置区   │
│  Auth    │ Studio   │  App     │ Resource │ Settings│
├──────────┼──────────┼──────────┼──────────┼─────────┤
│ 登录注册  │ 应用列表   │ 应用配置  │ 知识库    │ 团队成员 │
│ OAuth    │ 创建应用   │ 工作流    │ 模型供应商 │ API Key │
│ SSO      │ 模板探索   │ 调试预览  │ 工具管理   │ 环境变量 │
│ 密码找回  │           │ 日志标注  │ 插件市场   │ 品牌定制 │
│ 安装初始化 │          │ 部署发布  │ 集成中心   │         │
└──────────┴──────────┴──────────┴──────────┴─────────┘
```

---

## 二、路由结构 → 功能模块映射

### 2.1 认证区（公开页面，无需登录）

| 路由 | 功能 | dify-api 接口 | 自研优先级 |
|------|------|-------------|-----------|
| `/signin` | 登录页（邮箱+密码、OAuth） | `POST /console/api/login` | P0 必须 |
| `/signup` | 注册页（邮箱验证码三段式） | `POST /console/api/email-register/*` | P0 必须 |
| `/forgot-password` | 忘记密码（发验证码邮件） | `POST /console/api/forgot-password` | P1 可后置 |
| `/reset-password` | 重置密码（用验证码换 token 后改密） | `POST /console/api/forgot-password/resets` | P1 可后置 |
| `/activate` | 账号激活 | `GET /console/api/activate/check`、`POST /console/api/activate` | P1 可后置 |
| `/oauth-callback` | OAuth 回调 | `GET /console/api/oauth/authorize/<provider>` | P1 可后置 |
| `/install` | 首次安装引导 | `GET/POST /console/api/setup` | P1 可后置 |
| `/init` | 初始化（初始化密码校验） | `GET/POST /console/api/init` | P1 可后置 |
| `/account` | 账号设置 | `GET/POST /console/api/account/profile` 等 | P1 可后置 |
| `/device` | 设备授权（difyctl 设备流登录） | `/openapi/v1/oauth/device/*` | P2 可跳过 |

### 2.2 工作台（登录后首页）

| 路由 | 功能 | 说明 | 自研优先级 |
|------|------|------|-----------|
| `/apps` | **应用列表** | 全部应用、搜索、筛选、创建入口 | P0 必须 |
| `/agents` | Agent 列表 | 独立 Agent 管理（新版） | P2 可后置 |
| `/explore/installed/[appId]` | **模板市场** | 浏览/安装模板应用 | P2 可后置 |
| `/installed/[appId]` | 已安装应用 | 从模板安装的应用 | P2 可后置 |
| `/marketplace` | 插件市场 | 浏览/安装插件 | P2 可后置 |

### 2.3 应用区（核心，每个应用的详情页）

进入某个应用后，有 **8 个子页面**：

```
/app/[appId]/
├── overview          ← 应用概览（用量统计、调用趋势）
├── configuration     ← 应用配置（Prompt、模型、知识库、Agent）
├── workflow          ← 工作流编辑器（仅 Workflow 类型应用）
├── logs              ← 对话日志
├── annotations       ← 标注管理
├── develop           ← 开发者/API Key
├── deploy            ← 部署发布
└── access-config     ← 访问配置（谁能用、怎么访问）
```

| 子页面 | 功能 | 自研优先级 | 说明 |
|--------|------|-----------|------|
| **overview** | 应用概览 | P1 | 统计图表、调用量趋势 |
| **configuration** | 应用配置 | P0 必须 | 核心配置页 |
| **workflow** | 工作流编辑器 | P1 | 仅 Workflow 应用需要 |
| **logs** | 对话日志 | P1 | 日志查看、标注 |
| **annotations** | 标注管理 | P2 | 标注回复配置 |
| **develop** | 开发者工具 | P1 | API Key、接口文档 |
| **deploy** | 部署发布 | P1 | 发布到 Web/API/嵌入式 |
| **access-config** | 访问配置 | P1 | 权限、白名单 |

#### configuration 子页面详解（最核心）

应用分为 4 种类型，配置内容不同：

```
应用类型：
├── Chatbot（聊天助手）
│   ├── Prompt 编排（系统提示词、变量、开场白）
│   ├── 模型选择（LLM + 参数：temperature/top_p/max_tokens）
│   ├── 上下文配置（知识库绑定、检索参数）
│   ├── Agent 策略（ReAct / Function Calling + 工具选择）
│   ├── 审核配置（内容审核开关）
│   ├── 语音配置（STT / TTS）
│   └── 站点配置（外观、开场白、推荐问题）
│
├── Agent（智能体，新版独立入口）
│   ├── Agent 指令（系统角色 + 目标）
│   ├── 模型选择
│   ├── 工具集配置
│   ├── 知识库绑定
│   └── 约束配置
│
├── Workflow（工作流）
│   ├── 工作流画布（React Flow 节点编辑）
│   ├── 节点配置（17+ 种节点类型）
│   ├── 变量管理
│   ├── 输入变量定义
│   └── 调试运行
│
└── Text Generator（文本生成器）
    ├── Prompt 模板
    ├── 模型选择
    ├── 输入变量定义
    └── 输出格式配置
```

### 2.4 资源区（跨应用共享的配置）

| 路由 | 功能 | 子功能 | 自研优先级 |
|------|------|--------|-----------|
| `/datasets` | **知识库** | 数据集列表、创建、文档管理、分段、命中测试 | P0 必须 |
| 模型供应商（设置内） | **模型配置** | 供应商列表(20+)、API Key、系统默认模型 | P0 必须 |
| 工具管理（设置内） | **工具** | 内置工具、自定义工具(OpenAPI)、授权 | P1 |
| `/plugins` | 插件管理 | 安装/卸载/配置插件 | P2 可后置 |
| `/integrations` | 集成中心 | 第三方平台对接（Slack/微信等） | P2 可后置 |

### 2.5 设置区

| 功能 | 子功能 | 自研优先级 |
|------|--------|-----------|
| 工作空间设置 | 名称、Logo、成员管理、角色权限 | P0 必须 |
| API Key 管理 | 创建/删除/管理 API 密钥 | P1 |
| 环境变量 | 全局环境变量配置 | P1 |
| 品牌定制 | 自定义 Logo/名称/主题（你的品牌） | P0（自研版必需） |

---

## 三、功能依赖关系图

```
                    ┌──────────┐
                    │  认证体系  │ P0
                    │  登录注册  │
                    └─────┬────┘
                          │
                    ┌─────▼────┐
                    │  工作空间  │ P0
                    │ 成员/角色  │
                    └─────┬────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
        ┌─────▼────┐ ┌───▼────┐ ┌───▼────┐
        │  应用管理  │ │ 知识库  │ │ 模型配置 │ P0
        │  列表/创建 │ │ 数据集  │ │ 供应商  │
        └─────┬────┘ └───┬────┘ └───┬────┘
              │           │           │
              └───────────┼───────────┘
                          │
                    ┌─────▼─────┐
                    │  应用配置   │ P0
                    │ Prompt/模型 │
                    │ 知识库绑定   │
                    └─────┬─────┘
                          │
                ┌─────────┼─────────┐
                │         │         │
          ┌─────▼──┐ ┌───▼───┐ ┌──▼─────┐
          │ 调试预览 │ │ 日志  │ │ 部署发布 │ P1
          │ SSE对话 │ │ 标注  │ │ Web/API│
          └────────┘ └───────┘ └────────┘
                          │
                    ┌─────▼─────┐
                    │ 工作流编辑器│ P1
                    │ 节点/画布  │
                    └───────────┘
                          │
                    ┌─────▼─────┐
                    │  工具管理   │ P2
                    │ 插件/集成   │
                    └───────────┘
```

---

## 四、开发优先级与阶段划分

### P0：最小可用闭环（必须先做）

> 目标：用户能登录 → 创建对话型应用 → 配置 Prompt 和模型 → 调试对话 → 部署使用

| # | 模块 | 功能 | 人日 |
|---|------|------|------|
| 1 | 认证体系 | 登录/注册 + Token 管理 | 5 |
| 2 | 工作空间 | 工作空间切换 + 成员管理 | 5 |
| 3 | 应用管理 | 应用列表 + 创建向导（先只做 Chatbot） | 5 |
| 4 | 模型供应商 | 供应商配置 + API Key + 系统默认模型 | 8 |
| 5 | 应用配置 | Prompt 编排 + 模型选择 + 参数调节 | 8 |
| 6 | 调试预览 | SSE 流式对话调试 | 5 |
| 7 | 知识库基础 | 数据集列表 + 文档上传 + 基础分段 | 8 |
| 8 | 品牌定制 | 自有 Logo/名称/主题 | 3 |

**P0 小计：~47 人日（约 3 周，2前端+1全栈）**

### P1：核心能力补齐

> 目标：对齐 Dify 核心功能，可对外交付

| # | 模块 | 功能 | 人日 |
|---|------|------|------|
| 9 | 知识库进阶 | 分段预览 + 命中测试 + Embedding 配置 | 5 |
| 10 | 站点配置 | 开场白/推荐问题/外观 | 3 |
| 11 | 部署发布 | Web 发布 + API Key + 嵌入式代码 | 5 |
| 12 | 对话日志 | 日志列表 + 筛选 + 详情查看 | 5 |
| 13 | 开发者工具 | API 文档 + 接口调试 | 3 |
| 14 | 应用概览 | 用量统计图表 | 3 |
| 15 | 工作流编辑器 | 画布 + 基础节点 + 调试运行 | 25 |
| 16 | Text Generator | 文本生成应用类型 | 3 |
| 17 | 审核配置 | 内容审核 | 2 |
| 18 | 访问配置 | 权限/白名单 | 3 |

**P1 小计：~57 人日（约 5 周）**

### P2：扩展功能（按需）

> 目标：对齐 Dify 全部能力

| # | 模块 | 功能 | 人日 |
|---|------|------|------|
| 19 | Agent 配置 | 独立 Agent 入口 + 策略配置 | 5 |
| 20 | 工具管理 | 内置工具 + 自定义工具 + OAuth | 7 |
| 21 | 标注管理 | 标注列表 + 标注回复 | 4 |
| 22 | 模板市场 | 模板浏览/安装 | 3 |
| 23 | 插件系统 | 插件安装/管理/市场 | 8 |
| 24 | 集成中心 | 第三方平台对接 | 5 |
| 25 | 语音配置 | STT/TTS | 3 |
| 26 | OAuth 登录 | GitHub/Google OAuth | 3 |
| 27 | 密码找回 | 忘记密码/重置流程 | 2 |
| 28 | 教育认证 | 教育版验证（Dify 云版功能） | 2 |

**P2 小计：~42 人日（约 4 周）**

---

## 五、每个 P0 模块的功能清单

### 模块 1：认证体系

```
登录页
├── 邮箱 + 密码登录
├── 记住我（Token 持久化）
├── 登录跳转（已登录 → 工作台）
└── 错误提示

注册页
├── 邮箱 + 密码注册
├── 验证码（如需）
├── 注册协议勾选
└── 注册成功跳转

Token 管理
├── Access Token 存储（httpOnly Cookie / localStorage）
├── Refresh Token 自动刷新
├── 401 拦截 → 跳转登录
└── 退出登录 → 清除 Token
```

### 模块 3：应用管理

```
应用列表页
├── 应用卡片网格展示
├── 搜索（按名称）
├── 筛选（按类型：Chatbot/Workflow/Agent）
├── 排序（最近修改/创建时间）
├── 创建应用按钮
└── 应用操作（编辑/复制/删除）

创建应用向导
├── 选择类型
│   ├── Chatbot（聊天助手）     ← P0 先做这个
│   ├── Agent（智能体）         ← P2
│   ├── Workflow（工作流）      ← P1
│   └── Text Generator（文本生成）← P1
├── 填写基本信息（名称、描述、图标）
└── 创建完成 → 跳转配置页
```

### 模块 5：应用配置（Chatbot）

```
配置页
├── 提示词编排
│   ├── 系统提示词（Prompt 编辑器）
│   ├── 前缀提示词
│   └── 变量定义（{{variable}}）
│
├── 模型设置
│   ├── 模型选择（从已配置的供应商中选）
│   ├── 参数调节（temperature / top_p / max_tokens / presence_penalty）
│   └── 停止序列
│
├── 上下文配置
│   ├── 知识库绑定（选择数据集）
│   ├── 检索参数（TopK / Score 阈值 / 重排序）
│   └── 上下文数量限制
│
├── 对话开场（可选）
│   ├── 开场白文案
│   └── 推荐问题列表
│
└── 保存 / 发布
```

### 模块 7：知识库基础

```
知识库列表页
├── 数据集卡片网格
├── 创建数据集
└── 进入数据集详情

数据集详情页
├── 文档管理
│   ├── 上传文档（拖拽上传 .txt/.pdf/.md/.docx）
│   ├── 文档列表（名称/状态/字数/更新时间）
│   ├── 文档状态（排队中/处理中/已完成/失败）
│   └── 删除文档
│
├── 分段设置
│   ├── 分段方式（自动 / 自定义）
│   ├── 分段长度
│   ├── 分段重叠
│   └── 分隔符（自定义模式）
│
├── Embedding 模型选择
│   ├── 选择已配置的 Embedding 模型
│   └── 索引方式（高质量 / 经济）
│
└── 保存并处理
```

---

## 六、功能模块与 dify-api 接口对应

> **已按本仓库 `api/controllers/console/` 实际路由校准（2026-08-19）**。关键前提：
>
> - 控制台接口统一前缀 **`/console/api`**（下表均省略）；认证为 **HTTP-only Cookie 会话 + CSRF Token**
>   ——登录成功后服务端 set-cookie 下发 access/refresh/csrf 三个 Cookie，**响应体不返回 token**；
>   `/refresh-token` 同样从 Cookie 读取。自研控制台需 `fetch(..., { credentials: "include" })`
>   并透传 CSRF，跨域部署时前后端必须同站或配置 CORS 凭据。
> - 多数业务接口带 `@login_required` + `@account_initialization_required`，部分带 RBAC 校验
>   （如调试对话需 `APP_TEST_AND_RUN`）；`/setup`、`/init` 为未认证可用（自托管限定）。
> - 表中只列主路径，完整请求/响应模型见 `api/controllers/console/` 对应文件内的
>   Payload/Response Pydantic 定义（路径参数 `<app_id>` 等均为 URL path 参数）。
> - 设备流登录在另一蓝图 **`/openapi/v1`** 下，已单独标注。

| 自研模块 | 调用的 dify-api 接口 | 关键参数 |
|---------|---------------------|---------|
| 登录 | `POST /login` | email, password；成功 set-cookie 下发 token |
| 注册（邮箱验证码三段式） | ① `POST /email-register/send-email` ② `POST /email-register/validity` ③ `POST /email-register` | email → email+code+token → name+password+token |
| Token 刷新 | `POST /refresh-token` | 无 body，refresh token 从 Cookie 读取 |
| 忘记密码（三段式） | ① `POST /forgot-password` ② `POST /forgot-password/validity` ③ `POST /forgot-password/resets` | email → email+code+token → token+new_password |
| 安装 / 初始化 | `GET/POST /setup`、`GET/POST /init` | setup：email+name+password；init：初始化密码 |
| OAuth 登录 | `GET /oauth/login/<provider>`（发起）、`GET /oauth/authorize/<provider>`（回调） | provider=github/google |
| 设备流登录（difyctl） | `POST /openapi/v1/oauth/device/code`（取码）、`.../oauth/device/token`（轮询）、`.../oauth/device/approve`（浏览器端授权，需会话） | openapi 蓝图，非 console |
| 工作空间列表 | `GET /workspaces` | - |
| 切换工作空间 | `POST /workspaces/switch` | tenant_id |
| 成员列表 | `GET /workspaces/current/members` | - |
| 应用列表 | `GET /apps` | page, limit, name, mode, tag_ids, is_created_by_me |
| 创建应用 | `POST /apps` | name, mode(chat / agent-chat / advanced-chat / workflow / completion), description, icon |
| 应用详情（含站点配置读取） | `GET /apps/<app_id>` | - |
| 站点配置更新 | `POST /apps/<app_id>/site` | title, icon, opening_statement, suggested_questions 等 |
| 应用模型配置 | `GET/POST /apps/<app_id>/model-config` | provider, model_id, configs |
| 模型供应商列表 | `GET /workspaces/current/model-providers` | - |
| 配置供应商凭据 | `POST /workspaces/current/model-providers/<provider>/credentials` | credentials（api_key 等，结构随供应商而异） |
| 系统默认模型 | `GET/POST /workspaces/current/default-model` | model_type, provider, model |
| 知识库列表 / 创建 | `GET/POST /datasets` | page, limit / name, indexing_technique |
| 文档上传（两步） | ① `POST /files/upload`（multipart，返回 upload_file_id）② `POST /datasets/init`（首文档建库）或 `POST /datasets/<dataset_id>/documents` | file / data_source + process_rule |
| 文档索引进度 | `GET /datasets/<dataset_id>/batch/<batch>/indexing-status` | batch 由创建响应返回 |
| 对话（控制台调试） | `POST /apps/<app_id>/chat-messages` | query, inputs, conversation_id, response_mode=streaming |
| 对话日志 | `GET /apps/<app_id>/chat-conversations`（文本生成应用为 `/completion-conversations`） | page, limit |
| 工作流草稿 | `GET/POST /apps/<app_id>/workflows/draft` | graph, features, environment_variables 等 |
| 工作流调试运行 | `POST /apps/<app_id>/workflows/draft/run`（chatflow 为 `/advanced-chat/workflows/draft/run`） | inputs；SSE 流式返回 |
| 工作流发布 | `POST /apps/<app_id>/workflows/publish` | - |
| API Key | `GET/POST /apps/<resource_id>/api-keys`、`DELETE /apps/<resource_id>/api-keys/<api_key_id>`；知识库为 `/datasets/<resource_id>/api-keys` | - |

---

## 七、开发顺序建议（2 前端 + 1 全栈）

```
Week 1   认证 + 工作空间 + 基础布局
          ├── 全栈: API Client + SSE 封装 + 认证接口
          ├── 前端A: 登录注册页 + 布局框架 + 路由
          └── 前端B: 工作空间切换 + 成员管理

Week 2   应用管理 + 模型配置 + 应用配置
          ├── 前端A: 应用列表 + 创建向导
          ├── 前端B: 模型供应商配置页 + 应用配置页(Prompt+模型)
          └── 全栈: 模型 API + 应用配置 API

Week 3   调试预览 + 知识库基础 + 品牌定制
          ├── 前端A: SSE 调试面板 + 流式对话渲染
          ├── 前端B: 知识库列表 + 文档上传 + 分段配置
          └── 全栈: 知识库 API + 文档处理状态轮询
          🎯 P0 MVP 内测版

Week 4-5 知识库进阶 + 部署发布 + 日志 + 概览
Week 6-8 工作流编辑器（核心攻坚）
Week 9   工具管理 + Agent + 标注
Week 10  模板市场 + 插件 + 集成
Week 11  测试 + 性能优化 + 部署
          🚀 正式上线
```

---

## 八、功能模块工作量分布

| 优先级 | 模块数 | 人日 | 占比 |
|--------|--------|------|------|
| P0 必须 | 8 | ~47 | 37% |
| P1 核心 | 10 | ~57 | 45% |
| P2 扩展 | 10 | ~42 | 33% |
| **合计** | **28** | **~146** | - |

> 注：与之前 126 PD 的差异来自此处细化了更多子模块。实际开发可按需裁剪 P2 功能。

---

## 九、关键决策点

| 决策 | 选项 A | 选项 B | 建议 |
|------|--------|--------|------|
| MVP 先做哪种应用类型 | 只做 Chatbot | Chatbot + Workflow | **只做 Chatbot**，Workflow 留 P1 |
| 知识库做到什么程度 | 基础上传+分段 | 完整(命中测试+预览) | P0 基础，P1 补齐 |
| 插件系统 | 做兼容 Dify 插件 | 不做 | P2 按需，先跑通核心闭环 |
| OAuth 登录 | P0 就做 | P1 后置 | 后置，先用邮箱密码 |
| 模型供应商 | 全做 20+ | 先做主流 5 个 | 先做 OpenAI/Claude/通义/智谱/本地 |
