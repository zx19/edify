# WebApp 重设计 · 功能对照表：类型 2 `/chatbot/[token]`（embedded-chatbot 嵌入式）

> 三件套第 3 件。输入：功能清单（`2026-09-21-WebApp重设计-功能清单-类型2-chatbot.md`）+ mockup（`2026-09-21-WebApp重设计-mockup-类型2-chatbot.html`，2026-09-21 用户评审通过——白底中性头 + powered by 底部一行）。
> 变化类型：**原位** = 位置形态同现状只换 token；**换位置** = 落点移动；**形态** = 交互/呈现形态变化；**标注** = mockup 不可见的逻辑行（实现时保留）。
> 验收口径：本表每行在实现验收时逐项核销（执行计划 v2 §5.2 功能层）。
> 与类型 1 关系：消息区/输入区核心视觉已由 chat 单元携带（黑气泡白字、accent 输入区、操作条），本表只登记 chatbot 壳层差异；核心行标「已携带」验收时复核即可。

## 1. 路由与外壳

| 功能（清单行） | 新设计落点 | 类型 |
|---|---|---|
| 路由 + AuthenticatedLayout 门禁 | 不动 | 原位 |
| 桌面外壳 `bg-chatbot-bg` 灰白渐变 | `--bg-soft` 纯色消息区 + 白底头（同 chat 主区） | 形态（视觉） |
| 移动外壳蓝渐变浮卡 + 圆角 | **整体退役**：与桌面同构（白底头 + 灰底消息区 + 底部 powered 一行） | 形态（核心变化，09-21 拍板连带） |
| 文档标题 = site.title + branding 后缀 | 不动（机制属 systemFeatures 层） | 原位 |

## 2. Header（白底中性，09-21 拍板）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 桌面 header 仅右侧按钮、无图标标题 | **补回左侧 28px 图标 + 应用名**（双端同构） | 形态（桌面补齐） |
| 移动 header 图标标题（customerIcon/isDify 分支） | AppIcon + 标题；**isDify() 恒假分支删除**（去 Dify 化） | 形态 |
| 移动标题着色 `CssTransform(theme.colorFontOnHeaderStyle)` | 退役（随 createTheme 死），统一 `--text-1` | 形态 |
| 展开/收起按钮（仅 iframe + config 允许） | header 右侧 icon 钮，双端同位置；协议逻辑不动 | 原位 |
| 重置对话按钮（有会话且非 URL 锁会话） | header 右侧 icon 钮 | 原位 |
| 查看会话变量 ViewFormDropdown | header 右侧 icon 钮（有表单且非全隐藏才显示） | 原位 |
| 桌面 powered by（header 右侧） | **移至消息区底部一行**（见 §5） | 换位置 |

## 3. iframe 通信协议【保留红线】

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| iframe 检测 `window.self !== window.top` | 逐字保留 | 标注 |
| 上行 `dify-chatbot-iframe-ready`（referrer origin，fallback `'*'`） | 逐字保留 | 标注 |
| 下行 `dify-chatbot-config` → 钉 parentOrigin + 展开钮显隐 | 逐字保留 | 标注 |
| 上行 `dify-chatbot-expand-change`（targetOrigin=parentOrigin） | 逐字保留 | 标注 |
| embed.js / embed.min.js 父页侧全量 | 不动（public/ 资产） | 标注 |

## 4. URL 参数契约【保留红线】

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| `sys.*` / `user.*` / inputs 预填（deflate64） | 逐字保留 | 标注 |
| `?locale=` 语言覆盖链 | 逐字保留 | 标注 |
| `?sendOnEnter=false` | 逐字保留 | 标注 |
| `?conversation_id=` 预选 + 禁重置钮 | 逐字保留 | 标注 |
| embeddedConversationId/embeddedUserId（webAppStore） | 逐字保留 | 标注 |
| initUserVariables.avatar_url → 用户头像 | 逐字保留 | 标注 |

## 5. Powered by 页脚（09-21 拍板：底部一行常显）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 桌面 header 右侧 powered by | 移至**输入区下方一行居中**（常显，双端统一） | 换位置 |
| 移动端底部独立条 powered by | 同上合并为一行 | 换位置 |
| 品牌链末级 DifyLogo | **默认「杏树林」**（chat 单元口径：ui_config.footer_text → workspace custom_config → 默认） | 形态（品牌默认变更，去 Dify 化既定） |

## 6. 欢迎屏 / 描述卡 / 表单卡

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 欢迎屏双变体（有/无建议问题两套结构） | 统一为 mockup w-hero：60px 图标 + 标题 + 副标题（opening markdown）+ 建议问题列表 | 形态（视觉统一） |
| 描述卡（line-clamp-3 + 展开/收起） | mockup w-desc-card 同款 | 形态（视觉） |
| 表单卡「聊天设置」（collapsed 编辑/展开关闭） | chat 单元表单卡视觉族（w-form）；交互不动 | 形态（视觉） |
| 开始对话按钮 `backgroundColor=theme.primaryColor` | accent 实心（`var(--accent)`），createTheme 退役 | 形态（机制替换） |
| 7 种字段类型渲染 | 同一视觉族（复用 chat 单元表单样式） | 形态（视觉） |
| 必填未齐禁输入 / 全隐藏跳过表单 | 保留 | 标注 |

## 7. 聊天核心（chat 单元已携带——复核核销）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 用户气泡黑底白字 / dark 反色 | 已携带（token 双层，含 markdown 继承修正 1bef5f12b2） | 原位（已携带） |
| 输入区 accent focus 晕环 + 发送钮 | 已携带 | 原位（已携带） |
| 消息操作条 / 建议问题 pill / 推理面板 | 已携带 | 原位（已携带） |
| 回答图标（isDify→LogoAvatar 分支） | **删 isDify 分支**；use_icon_as_answer_icon→AnswerIcon 保留 | 形态 |
| hideProcessDetail / 工作流恢复 / SSE / feedback | 保留 | 标注 |
| `theme` prop 下传 Chat（deprecated） | 停止构造（createTheme 死），prop 签名保留兼容 | 标注 |

## 8. 全局行为

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| Loading（appChatListDataLoading） | 保留 | 原位 |
| toast / 深浅色随 next-themes 双通道 | 保留 | 标注 |
| tryApp 变体（AppSourceType.tryApp 分支） | 保留（同壳渲染） | 标注 |

## 9. 验收注记

- **协议验收**：跨源宿主页 harness 重跑（ready→config→展开钮→expand-change 全链），方法见功能清单 §9。
- **console 零影响**：embedded-chatbot 族外消费方（console `app/overview/embedded`、`explore/try-app`）渲染不变——族内改动不走 `.webapp-theme` 之外的通道，无作用域态靠 token 双层兜底。
- **蓝色族**：createTheme 默认蓝渐变/`#1C64F2` 全退役；任何残留蓝色走 tokens.css 蓝色族重映射段复核（chat 单元 b4ff5fa3b0 机制）。

## 10. 实现核销（2026-09-21，commit e8c4d3535a）

| 表行 | 实现 | 验证 |
|---|---|---|
| §1 外壳双端同构（移动浮卡退役） | index.tsx 重写为白底头+bg-soft 单列 | ✅ QA 移动视口：无蓝渐变（inline style 无 gradient）、白底头实测 |
| §2 header 白底中性（桌面补回图标+标题） | header/index.tsx 重写 | ✅ QA 桌面截图（图标+标题+右钮组）；spec 9 用例绿 |
| §2 isDify/customerIcon 退役 | 分支删除，utils.ts+utils.spec 连删 | ✅ tsc 0；无残留引用 |
| §2 展开/重置/变量钮显隐条件 | 逐字保留 | ✅ 协议 spec 7 用例绿 |
| §3 iframe 协议三消息 | 逐字保留（仅视觉类名随 header 换新） | ✅ 跨源 harness 回归：ready→config→展开钮（aria=展开）→点击→expand-change 全链 |
| §4 URL 参数契约 | hooks.tsx 零改动 | ✅ 族 spec 全绿 |
| §5 powered by 底部一行 + 杏树林链 | index.tsx 底部行；品牌链 footer_text→replace_webapp_logo→杏树林 | ✅ QA 双视口截图（居中一行「Powered by 杏树林」）；index.spec 5 用例覆盖新链 |
| §6 欢迎屏统一 hero | chat-wrapper.tsx welcome 重写（图标+标题+开场白副标题+建议问题列） | ✅ spec 绿；⚪ 实机未触发（走查应用无 opening_statement——建议问题列表形态待有配置应用走查） |
| §6 描述卡/表单卡 token 化 | chat-wrapper descriptionNode + inputs-form 双层类 | ✅ spec 绿；⚪ 实机未触发（应用无描述/表单字段） |
| §7 聊天核心已携带 | 零改动 | ✅ QA 实测气泡黑底白字（rgb(10,10,11)/白）回归 |
| §7 answerIcon isDify 分支删 | chat-wrapper 改单链 use_icon_as_answer_icon | ✅ spec 绿 |
| §7 theme prop 停传 | Chat 不再收 theme（签名保留兼容） | ✅ tsc 0 |
| accent 注入共享化 | chat/accent-style.ts 提取，chat-with-history + chatbot 双消费 | ✅ index.spec accent 4 用例（含多实例隔离/无配置不注入） |
| console 零影响 | chat-with-history 族 348 用例全绿；双层类保 try-app | ✅ |

**遗留走查项（实机）**：①欢迎屏 hero + 建议问题列（需有 opening_statement 的应用）；②表单卡新视觉（需有变量表单的应用）；③accent 换色实机（需配 chat_color_theme 的应用）。三项 spec 已覆盖逻辑，视觉待人信号。

### 回炉注记（2026-09-22 晚，用户纠偏「重写模块≠换肤」）

chat-wrapper 欢迎屏/描述卡、inputs-form/view-form-dropdown 首版为双层补丁，已回炉为单实现新写（commit 48db1bb17e）；`explore/try-app` 容器挂 `.webapp-theme`（console 内嵌 webapp 预览面与 /chatbot 同视觉，同源三用）。chatbot 族 120 + explore 173 用例全绿。
