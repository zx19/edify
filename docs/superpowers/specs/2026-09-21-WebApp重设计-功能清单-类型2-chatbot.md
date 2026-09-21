# WebApp 重设计 · 功能清单：类型 2 `/chatbot/[token]`（embedded-chatbot 嵌入式）

> 三件套第 1 件（功能清单登记）。来源：代码穷举（file:line 可核）+ QA 运行态确认（2026-09-21，应用 agent新手 `V7gdYecYd4IqpTzV`，:3001 代理 qa-xai 实证 + 自搭跨源宿主页实证 iframe 协议）。
> 标记：✅=QA 运行态已确认；⚪=代码存在、QA 未触发（注明开启条件）。
> 与类型 1 关系：聊天核心（消息区/输入区/操作条/建议问题）复用 chat 族同一组件树——chat 单元重写已携带（黑气泡白字、accent 橙输入区，QA 截图实证）。本清单只登记 chatbot 专属面；消息区明细见《2026-09-07-WebApp重设计-功能清单-类型1-chat》§4-§6。
> 族外消费方：`/chatbot/[token]` 主路由、console `app/overview/embedded` 嵌入配置页、`explore/try-app` 变体（AppSourceType.tryApp）。

## 1. 路由与外壳

| 功能 | 代码 | QA |
|---|---|---|
| 路由 + AuthenticatedLayout 门禁（access-mode 复用 3a 基建） | `app/(shareLayout)/chatbot/[token]/page.tsx` | ✅ |
| 桌面外壳：整屏 `bg-chatbot-bg` 灰白渐变（manual-light.css:2 `--color-chatbot-bg`） | `embedded-chatbot/index.tsx:42-46` | ✅ |
| 移动外壳：rounded-2xl 卡片 + inline `theme.backgroundHeaderColorStyle`（默认蓝渐变 #2563eb→#0ea5e9） | `index.tsx:44-50`、`theme/theme.ts:28-32` | ✅ |
| 文档标题 = site.title（后缀走 systemFeatures.branding 既定链） | `index.tsx:38`、`hooks/use-document-title.ts` | ✅（"agent新手 - Dify"，品牌链机制非本单元重写点） |

## 2. Header（`embedded-chatbot/header/index.tsx`）

| 功能 | 代码 | QA |
|---|---|---|
| 桌面 powered by 品牌链：workspace_logo → replace_webapp_logo → **DifyLogo**【重写点：末级改「杏树林」，对齐 chat 单元口径】 | `:88-112` | ✅ |
| 展开/收起按钮（仅 iframe 内 + 收到 config + `isToggledByButton && !isDraggable`） | `:114-144` | ✅（跨源 harness 实证出现+点击） |
| 重置对话按钮（有会话且 URL 未指定 conversation_id） | `:145-160`、`hooks.tsx:121` | ✅（发消息后截图可见） |
| 查看会话变量 ViewFormDropdown（有会话 + inputsForms 非空 + 非全隐藏） | `:161-163`、`inputs-form/view-form-dropdown.tsx` | ⚪（应用无表单字段） |
| 移动端：customerIcon（`isDify()`=referrer 含 dify.ai 才给 LogoHeader——我方环境恒 false） | `:174-175`、`utils.ts:1-3` | ⚪（恒假分支） |
| 移动端：标题着色 `CssTransform(theme.colorFontOnHeaderStyle)`（蓝底白字 / inverted 主色字） | `:176-181` | ✅（蓝底白字截图实证） |
| 移动端：展开/重置/变量三钮（着色 `theme.colorPathOnHeader`） | `:183-246` | ✅（结构）/⚪（展开钮需 iframe） |

## 3. iframe 通信协议【保留红线，逐字保全】

iframe 侧（`header/index.tsx:38-82`）：

| 功能 | 代码 | QA |
|---|---|---|
| iframe 检测 `window.self !== window.top` | `:38` | ✅ |
| 上行 `dify-chatbot-iframe-ready`（targetOrigin=document.referrer origin，fallback `'*'`） | `:60-71` | ✅ |
| 下行 `dify-chatbot-config` → 首条定 parentOrigin（event.origin 钉死），payload.isToggledByButton && !isDraggable 控展开钮 | `:44-58` | ✅ |
| 上行 `dify-chatbot-expand-change`（targetOrigin=parentOrigin） | `:73-82` | ✅ |

父页侧（`public/embed.js` / `embed.min.js`，461 行，客户站集成脚本）：

| 功能 | 代码 | QA |
|---|---|---|
| iframe URL = `baseUrl/routeSegment(默认chatbot)/token?参数` | `embed.js:134-141` | ✅（协议对端推断） |
| URL 参数压缩：inputs + `sys.*` + `user.*`（deflate+base64） | `:100-126` | ⚪ |
| `sendOnEnter=false` 透传 URL | `:133-136` | ⚪ |
| 预创建隐藏 iframe 后台加载 | `:142-153` | ⚪ |
| 收 ready → 回 `dify-chatbot-config` | `:221-232` | ✅ |
| 收 expand-change → toggleExpand 切 iframe cssText | `:200-213,234-237` | ✅ |
| 聊天气泡按钮 / 拖拽 / ESC 关闭 / containerProps 自定义 | `:240+` | ⚪ |

**QA 实证方法**：自搭跨源宿主页（:5999 嵌 :3001 iframe，模拟 embed.js 回包）——ready 收到 → config 下发 → 展开钮出现 → 点击 → expand-change 回收，全链通过。

## 4. URL 参数契约（`hooks.tsx` + `chat/utils`）

| 功能 | 代码 | QA |
|---|---|---|
| `sys.*` 系统变量（含 locale/user_id/conversation_id） | `hooks.tsx:86-98` | ⚪ |
| `user.*` 用户变量（initUserVariables.avatar_url → Chat questionIcon 头像） | `hooks.tsx:246-250`、`chat-wrapper.tsx:474-482` | ⚪ |
| inputs 预填（URL → inputsForms default，按类型转换/截断） | `hooks.tsx:171-251` | ⚪ |
| `?locale=` 语言覆盖（优先 sys.locale，再 site.default_language） | `hooks.tsx:99-120` | ⚪ |
| `?sendOnEnter=false` → Shift+Enter 发送 | `chat-wrapper.tsx:61-67` | ⚪ |
| `?conversation_id=` 预选会话（禁重置钮） | `hooks.tsx:86-98,121` | ⚪ |
| embeddedConversationId/embeddedUserId（webAppStore 通道） | `hooks.tsx:82-98` | ⚪ |

## 5. 表单卡（`inputs-form/`）

| 功能 | 代码 | QA |
|---|---|---|
| 聊天设置卡：collapsed 态「编辑」/ 展开态（有会话）「关闭」/ 新会话「开始对话」钮（`backgroundColor=theme.primaryColor`【重写点：accent token】） | `inputs-form/index.tsx:30-108` | ⚪（应用无表单字段） |
| 7 种字段类型渲染（text/number/paragraph/checkbox/select/singleFile/multiFiles/jsonObject） | `inputs-form/content.tsx:59-164` | ⚪ |
| ViewFormDropdown 会话变量查看 | `inputs-form/view-form-dropdown.tsx` | ⚪ |

## 6. 欢迎屏与描述卡（`chat-wrapper.tsx`）

| 功能 | 代码 | QA |
|---|---|---|
| 描述卡：site.description，line-clamp-3 + 展开/收起（仅新会话） | `:291-333` | ⚪（应用无描述） |
| 欢迎屏双变体：有建议问题=横排图标+气泡卡；无=居中图标+大字 | `:356-418` | ✅（居中变体截图实证） |
| opening_statement 来源 currentConversationItem.introduction \|\| config.opening_statement | `:79` | ✅ |
| 回答图标三级：isDify()→LogoAvatar / use_icon_as_answer_icon→AnswerIcon / 否则 null | `:420-429` | ✅（robot 图标） |
| 工作流暂停恢复（DFS 找最后 humanInput 节点自动 resume） | `:154-187` | ⚪ |
| `hideProcessDetail` 传入（chatbot 隐藏过程明细） | `:469` | ⚪ |
| 必填表单未齐禁输入（inputDisabled 链） | `:107-145` | ⚪ |

## 7. 聊天核心（复用 chat 族，已重写携带——登记为差异确认）

| 功能 | 现状 | QA |
|---|---|---|
| 用户气泡黑底白字（token 双层，含 markdown 继承修正 1bef5f12b2） | 已生效 | ✅（desktop 截图实测 rgb(10,10,11)/白字） |
| 输入区 accent 橙 focus 晕环 + 发送钮 | 已生效 | ✅（截图实证橙环） |
| 消息操作条/建议问题/深度思考面板 | 已生效 | ✅（「已深度思考(0.7s)」实证） |
| 移动端表单卡差异：有会话时渲染空 div 占位 | `chat-wrapper.tsx:336-344` | ⚪ |

## 8. 重写点汇总（交给 mockup/对照表决策）

| # | 项 | 现状 | 目标方向 |
|---|---|---|---|
| 1 | createTheme + CssTransform 样式串机制 | theme.ts 全量（header 底/字、按钮色、气泡色 style 串 + `backgroundColor: color: white;` 脏串 bug :36-38） | token 双层 + accent 注入（chat 单元 4-chat-9 先例），chat_color_theme 只注入 --accent 族 |
| 2 | DifyLogo 末级品牌（header powered by + 移动页脚） | header:108、index.tsx:90 | 「杏树林」链（chat 单元口径） |
| 3 | isDify() referrer 分支（LogoHeader/LogoAvatar） | utils.ts:1-3，恒 false | 去 Dify 化：保留分支结构 or 删（mockup 定） |
| 4 | chat_color_theme_inverted | theme.ts:22,33 | chat 单元已注记退役，chatbot 同口径待 mockup |
| 5 | 默认蓝渐变头（移动）/ 灰白渐变底（桌面） | theme.ts:28-32、manual-light.css:2 | 新 mockup 视觉 |
| 6 | iframe 协议三消息 + embed.js | 见 §3 | **保留不动**（计划拍板红线） |
| 7 | URL 参数契约 | 见 §4 | **保留不动**（客户集成面） |

## 9. QA 实证记录

- 环境：web-new :3001 + dev:proxy :5003 → qa-xai.xingshulin.com/lomva；应用 agent新手 `V7gdYecYd4IqpTzV`
- 直连：桌面 1280×800 / 移动 390×844 双视口，欢迎屏 + 发消息（POST /api/chat-messages 200）截图 `/tmp/chatbot-{desktop-welcome,desktop-chat,mobile-welcome}.png`
- iframe：宿主页 :5999 harness（截图 `/tmp/chatbot-iframe-host.png`），§3 全链通过
- 已知偏差点检：气泡黑底白字 ✅（chat 单元修正携带）；输入区橙环 ✅；移动蓝渐变头/桌面灰白底/Dify 页脚 = 待重写旧视觉（本清单登记）
