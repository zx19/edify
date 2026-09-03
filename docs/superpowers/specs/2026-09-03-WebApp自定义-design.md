# WebApp 自定义：UI 重构 + 应用级配置 设计稿

> 状态：设计定稿（2026-09-03，对话逐节确认）；前置决策：路径 A（二开本仓库 web 代码，《WebApp自定义-二开与自建前端手册》§1）
> 关联：手册 `docs/guide/WebApp自定义-二开与自建前端手册.md`（现状机制）、工作台 UI 重构 PRD（token 层同源约定）、系统管理控制台 mockup（新视觉语言来源）

## 1. 目标与边界

- **范围两条**：① WebApp（`(shareLayout)`，终端用户凭分享码免登录访问的界面）**UI 重构**——对齐新视觉语言（白+黑+橙，与系统管理控制台/工作台重构同语言），**全部功能保留**；② **应用级配置能力增强**。
- **不做**：主题多预设/细定制（chat_color_theme 单色机制保留）、per-message 类型定制、终端用户侧个性化（终端用户零配置）、`webapp-signin`/`webapp-reset-password`（社区版企业专属死路径）、工作台 `/installed/<id>` 消费 ui_config（已确认：视觉共享、配置分离）。
- **成功标准**：三族页面换新视觉（light+dark）；现有功能零回归（会话/引用/反馈/建议问题/附件/语音/嵌入 SDK）；编排者可在应用级设置弹窗配置布局/组件/品牌项且 WebApp 按配置渲染；console 调试面板视觉不变。

## 2. 数据结构（终稿，经代码管线实证）

### 2.1 存储：`sites` 表加一列 JSONB（方案对比后定案）

```sql
ALTER TABLE sites ADD COLUMN ui_config JSONB;  -- nullable，NULL = 全部默认值
```

**选定理由（代码实证，非原则推演）**——两条路径改动的实际管线：

- 写入侧 `app_site_command_repository.py:36` 是泛化循环：`for field_name, value in asdict(changes).items(): setattr(site, field_name, value)`。`AppSiteChanges` 加 `ui_config` 字段即自动落库，仓储层零代码。
- 读取侧 `web_app_runtime_query_service.py:71` `record.site._asdict()` 自动展开。`_map_site_configuration` 加一行即自动下发。
- 「新建表」方案：同样要改 `AppSiteUpdatePayload`/`AppSiteChanges`/`_map_site_configuration`/`WebSiteResponse` 四处（上游摩擦不减少），另需新模型 + 双写特判（打断泛化循环）+ 二次查询 merge，合计 ~50+ 行 vs 加列的 6 处 × 1-2 行。「零上游摩擦」仅省 `model.py` +2 行，却要在同为上游热文件的 `app_definition_query_repository.py` 插入更大结构块。
- 结论：两者语义等价（均为一应用一份 JSON），选搭乘现成管线的加列。

**配置内容结构**（pydantic `AppSiteUiConfig` = 校验模型 + 前端类型来源）：

```jsonc
{
  "layout": {
    "show_conversation_sidebar": true,   // 会话历史侧栏显隐（chat/agent 族）
    "sidebar_width": "standard"         // "standard" | "compact"
  },
  "components": {
    "show_citation": true,              // 引用来源
    "show_message_actions": true,        // 点赞/复制/重新生成
    "show_suggested_questions": true     // 建议问题
  },
  "brand": {
    "footer_text": "",                  // 页脚文字（空 = 走优先级链回落）
    "welcome_subtitle": ""               // 欢迎屏副标题（空 = 不渲染）
  }
}
```

- NULL = 全部默认值，**新项目无存量迁移**（QA/生产均未上线）。
- 未知键丢弃（前向兼容）；非法类型/取值 400。
- 现有列一律不动；`show_workflow_steps` 等既有开关保留原列原语义，不搬入 JSONB；欢迎屏副标题只做呈现层（新增键），不复用/修改现有 `description` 列的存储。
- 配置项清单以 mockup 阶段定稿为准（本表为初稿）。

### 2.2 接口（两个既有端点，零新端点）

| 端点 | 改动 |
|---|---|
| `POST /console/api/apps/<id>/site` | `AppSiteUpdatePayload` 加 `ui_config`，白名单校验后经 `AppSiteChanges` → setattr 循环落库 |
| `GET /api/site`（WebApp 公开链路） | `WebSiteResponse` 加 `ui_config`，默认值填充后整块下发（终端用户侧零逻辑） |

### 2.3 编辑入口：access-point 的「设置」弹窗（现成弹窗加分区）

`app/<id>/access-point` → WebApp 卡片「设置」按钮 → `SettingsModal`（`overview/settings/index.tsx`）新增「界面」分区（Divider 隔开），承载 §2.1 配置项；现有项与保存按钮模型（统一提交）不变，payload 增 `ui_config` 键。相邻弹窗不动：「嵌入到网站」（iframe 片段）、「自定义」（GitHub/Service API 指引）。

### 2.4 应用级 vs 工作区级分界

原则：跟着「应用自身使用场景」走的放应用级；跟着「空间组织身份」走的放工作区级。本次新增项**全部应用级**（`sites.ui_config`）；工作区级（`tenants.custom_config_dict`：去品牌/Logo 替换，`CAN_REPLACE_LOGO=true` 已在 QA 开启生效）一项不加。

**页脚品牌渲染优先级链**（三族共用同一渲染工具函数，不写三遍；消费点：chat 侧栏底部 `sidebar/index.tsx:170`、embedded 移动端页脚 `embedded-chatbot/index.tsx:77-91`、text-generation 侧栏 `text-generation-sidebar.tsx:170-226`）：

```
应用级 ui_config.brand.footer_text / footer 相关
  ↓ 未配置
工作区级 custom_config（replace_webapp_logo / remove_webapp_brand）
  ↓ 未配置
默认（Dify Logo / 默认品牌行）
```

现有代码三级链中的 `systemFeatures.branding.enabled`（enterprise workspace_logo）在社区版恒 false，新 UI 直接按上述两级+默认实现。

## 3. UI 重构本体

### 3.1 重设计范围（三族 + 一对齐 + 不动）

| 页面 | 层级 | 内容 |
|---|---|---|
| `chat-with-history`（/chat、/agent） | **壳层重设计** | 会话历史侧栏（列表/项/hover/置顶/重命名交互）、header、聊天面板容器、输入区外观、开场白+建议问题呈现、inputs-form |
| `embedded-chatbot`（/chatbot） | 壳层重设计 | header、面板容器、品牌页脚（ui_config 驱动，经优先级链） |
| `text-generation`（/completion、/workflow、/env/workflow） | 壳层重设计 | 表单区、运行结果区、侧栏 |
| `form/[token]`（humanInputLayout 人工介入） | 对齐级 | 轻量对齐新语言（结构不变，只换 token） |
| `webapp-signin` / `webapp-reset-password` | **不动** | 企业版 webapp_auth 专属，社区版死路径 |

**功能保留红线**：会话历史（含置顶/重命名/删除）、引用浮层、点赞/复制/重新生成、建议问题、附件上传、语音（ASR/TTS）、开场白变量替换、Agent Roster 渲染、嵌入 SDK（embed.js 行为）——全部保留，只换视觉与布局形态。

### 3.2 作用域 token 与 accent 机制

- `(shareLayout)/layout.tsx` 根节点挂 `.webapp-theme` 作用域类；新语言变量集（light + **新定义 dark 变体**）写为共享 CSS 文件。dark 是硬需求：WebApp 无手动切换、跟随系统（`defaultTheme: 'system'`）。
- light 基准（源自系统管理控制台 mockup）：`--bg:#FFFFFF`、`--bg-soft:#F7F7F8`、`--text-1:#0A0A0B`（三级灰 #3D3D42/#8A8A93）、`--accent:#FF8C00`（deep #E67A00、soft #FFF3E0）、border #E8E8EA/#D9D9DC、Inter+PingFang、radius 12px/9px、三级阴影。dark 变体（底色/灰阶反转/橙亮档）在 token 定稿时一并定义。
- **应用主题色兼容**：`chat_color_theme` 保留原列原语义，注入为作用域内 accent 覆盖（未配置 = 默认橙 #FF8C00）；`chat_color_theme_inverted` 一并处理；现有 `createTheme()` 内联样式机制由作用域变量机制替代。
- **底层共用件不重设计**：markdown 渲染、citation 浮层、消息操作条等只在 `.webapp-theme` 作用域内做 token 对齐（改 CSS 变量映射，不改组件结构）→ console 调试面板（不挂作用域类）零影响。

### 3.3 与工作台/管理台重构线的接口（防重复工作约定）

- **token 一份**：本设计的 token 层与工作台 PRD「公共 token 层」为**同一物**；WebApp 先动工先落地，工作台/管理台后续消费（若彼线先行则反向）。
- **组件同源三用**：`chat-with-history`/`text-generation` 壳层同时被工作台 `/installed/<id>`（`explore/installed-app/index.tsx:18,263`）消费——本设计交付的壳层重设计即两线共享成果，工作台线不再动这两族组件。
- **配置分离**：`ui_config` 只经 `/api/site`（WebApp 链路）下发；`/installed/<id>` 走 console 数据链路、不消费 `ui_config`（受众不同：终端用户 vs 空间成员）。

### 3.4 文案

新 UI 文案走 `web/i18n/<locale>/share.json`（品牌区/侧栏/表单），按 `site.default_language` 切换——沿用现状机制，仅新增 key（每个 key 全 locale 同步）。

## 4. 实施与验证

### 4.1 实施顺序

1. **mockup（HTML）先行**：三族页面新视觉定稿（含 dark 变体、ui_config 各开关态），照既有流程（系统管理控制台/工作台先例）。**前置：拿真实应用分享码去 QA 看现状页面**（记忆约定：现状以 QA 为唯一事实来源）。
2. token 层 + `.webapp-theme` 挂载（含 dark、accent 覆盖）。
3. 三族壳层重设计 + ui_config 消费。
4. console 弹窗「界面」分区 + api 校验/下发（§2.2/2.3）。
5. 测试与 QA 走查。

### 4.2 构建与部署约束（沿用手册 §3.4）

- `NEXT_PUBLIC_*` 构建期固化；改动上线走 `k8s/scripts/build-images.sh` 自构 lomva-web（`NEXT_PUBLIC_BASE_PATH=/lomva`），更新 overlay images 后 deploy。
- embed.js 若有触碰需 `pnpm uglify-embed` 后重构镜像。
- api 侧 migration 经 `flask upgrade-db`（entrypoint 现成机制）。

### 4.3 测试与验收

| 验收项 | 方式 |
|---|---|
| 功能零回归 | 既有 e2e 回归（会话/引用/反馈/建议问题/附件/语音/嵌入）+ 手工走查三族 |
| console 调试面板零影响 | 渲染断言：不挂 `.webapp-theme` 的页面视觉 token 不变 |
| ui_config 渲染 | vitest：各开关 true/false/null 三态渲染断言（侧栏显隐/组件显隐/页脚优先级链） |
| api 校验 | 非法 ui_config 400 用例；合法落库/下发 round-trip |
| dark 变体 | 系统明暗两态截图走查 |
| 品牌优先级链 | 应用级/工作区级/默认三级组合用例 |

## 5. 决策记录（沿途拍板，防止回头重议）

| # | 决策 | 依据/背景 |
|---|---|---|
| 1 | 路径 A（二开） | 手册 §1；WebApp 面向内部、可接受匿名 |
| 2 | 方案二：壳层重设计+作用域 token+JSONB | 「重构」深度要求 + console 零影响 + 配置后续加项零 migration |
| 3 | ui_config 不影响工作台 /installed/<id> | 受众不同，配置语义分离（用户确认） |
| 4 | 新配置全放应用级，工作区级不加项 | 分界原则：应用场景 vs 组织身份 |
| 5 | 存储定 sites 加 JSONB 列（曾议新表，否决） | 代码管线实证：泛化 setattr/_asdict 搭乘零代码 vs 新表 ~50+ 行；语义等价选小改动 |
| 6 | CAN_REPLACE_LOGO=true 已开（QA 部署生效） | 用户拍板先开启；页脚链变两级+默认 |
| 7 | 品牌设置辨析定稿：「品牌设置」= access-point 应用级设置弹窗（本设计扩展它）；工作区级 Logo 在工作空间设置→自定义 tab（左上角工作空间卡片入口） | 三轮代码核实：设置面板 tab 显隐条件（权限=RBAC 企业依赖不开、账单=CLOUD 专属） |
| 8 | dark 变体为硬需求 | WebApp 跟随系统无切换入口 |
