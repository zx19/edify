# WebApp 重设计 · 功能对照表 v2：类型 2 `/chatbot`（embedded-chatbot 嵌入式）

> 三件套第 3 件（重出）。输入：功能清单（`2026-09-21-WebApp重设计-功能清单-类型2-chatbot.md`，沿用）+ mockup v2（`2026-09-24-WebApp重设计-mockup-类型2-chatbot.html`，2026-09-24 出稿评审无异议）+ 方向定稿（`2026-09-24-WebApp重设计-design.md` §4）。
> **本表取代 `2026-09-21-WebApp重设计-功能对照表-类型2-chatbot.md`**（旧表方向=旧视觉语言，已作废）。
> 变化类型：原位 / 换位置 / 形态 / 标注。**保留红线（iframe 协议 / embed.js / URL 参数契约）逐字保全，本表登记为原位不动。**

## 1. 路由与外壳

| 功能（清单行） | 新设计落点 | 类型 |
|---|---|---|
| 路由 + AuthenticatedLayout 门禁 | 不变 | 标注 |
| 桌面外壳：整屏 `bg-chatbot-bg` 灰白渐变 | `--bg` 纯色（去渐变） | 形态 |
| 移动外壳：rounded-2xl 卡片 + 蓝渐变头 inline 样式 | 卡片保留；**头部中性化**（蓝渐变退役，`backgroundHeaderColorStyle` 机制由 token 替代） | 形态 |
| 文档标题 = site.title | 保留（branding 后缀链去 Dify 化随全局收口） | 标注 |

## 2. Header（极薄 40px，中性）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 桌面 powered by 品牌链 | header 右小字（沿用现状落点）；末级默认「杏树林」 | 原位（品牌变更既定） |
| 展开/收起按钮（iframe 内 + config + isToggledByButton && !isDraggable） | header 右 icon 钮（条件链不变；mockup 可实操演示） | 原位 |
| 重置对话按钮（有会话且 URL 未锁 conversation_id） | header 右 ↻ | 原位 |
| 查看会话变量 ViewFormDropdown | header 右（有会话+表单非空+非全隐藏） | 原位 |
| 移动端 customerIcon（isDify() 恒 false 分支） | **删除分支**（去 Dify 化，入删旧台账） | 形态 |
| 移动端标题/按钮着色（CssTransform） | 中性 token（着色机制退役） | 形态 |

## 3. iframe 通信协议【保留红线】

| 功能 | 落点 | 类型 |
|---|---|---|
| iframe 检测 / 上行 ready / 下行 config（origin 钉死）/ 上行 expand-change | **逐字保全** | 原位 |
| embed.js 父页侧全量行为（URL 构造/参数压缩/预创建/回包/toggleExpand/气泡按钮/拖拽/ESC） | **逐字保全** | 原位 |

## 4. URL 参数契约【保留红线】

| 功能 | 落点 | 类型 |
|---|---|---|
| `sys.*` / `user.*` / inputs 预填 / `?locale=` / `?sendOnEnter=` / `?conversation_id=` / embeddedConversationId/embeddedUserId | **逐字保全** | 原位 |

## 5. 表单卡（聊天设置卡）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 聊天设置卡（collapsed「编辑」/ 展开「关闭」/ 新会话「开始对话」） | 欢迎屏流内卡片「聊天设置」（折叠条族形态）；开始对话 = accent CTA（原 `theme.primaryColor` 串改 accent token） | 形态（视觉） |
| 7 种字段类型渲染 | 同 chat 族样式族 | 原位 |
| ViewFormDropdown 会话变量查看 | 保留（header 入口，见 §2） | 原位 |

## 6. 欢迎屏与描述卡

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 描述卡（site.description，仅新会话） | 开场白下一行 line-clamp + 「展开」（同 chat 族 §6 形态） | 形态 |
| 欢迎屏双变体（有/无建议问题） | chat 族同语言：居中图标 + 开场白 + 建议问题卡片（窄宽退化单列）；无建议问题 = 居中图标+大字 | 形态 |
| opening_statement 来源链 | 保留 | 标注 |
| 回答图标三级（isDify→LogoAvatar / use_icon_as_answer_icon / null） | **消息流去头像**（D3）；isDify 分支删除；`use_icon_as_answer_icon` 无渲染落点（字段接收不报错） | 形态 |
| 工作流暂停恢复（humanInput resume） | 保留 | 标注 |
| `hideProcessDetail`（chatbot 隐藏过程明细） | 保留（过程卡不渲染；深度思考折叠条保留） | 标注 |
| 必填表单未齐禁输入 | 保留（输入禁用态 60% 透明，同 chat 族） | 标注 |

## 7. 聊天核心（chat 族同语言复用——落点随 chat 对照表 v2）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 用户气泡 | 浅灰胶囊右置（chat 族同） | 形态 |
| 输入区 | 悬浮卡 + accent 发送/focus 晕环（chat 族同） | 形态 |
| 消息操作条/建议问题/深度思考 | hover 显现 / pill / 折叠条（chat 族同） | 形态 |
| 移动端表单卡差异占位 | 移动端表单浮层 token 化（同 chat 族 §3） | 原位 |

## 8. 重写点汇总核销（清单 §8 → 新落点）

| # | 项 | 新落点 |
|---|---|---|
| 1 | createTheme + CssTransform 样式串机制（含脏串 bug） | **机制退役**：token + accent 注入（`chat_color_theme` 只注入 `--accent` 族；mockup 工具条可演示换色） |
| 2 | DifyLogo 末级品牌 | 「杏树林」链（chat 单元口径） |
| 3 | isDify() referrer 分支 | 删除（删旧台账） |
| 4 | chat_color_theme_inverted | 退役（chat 单元先例；字段接收不报错无渲染） |
| 5 | 默认蓝渐变头（移动）/灰白渐变底（桌面） | 中性 token（本表 §1） |
| 6 | iframe 协议三消息 + embed.js | 保留不动 |
| 7 | URL 参数契约 | 保留不动 |

## 评审检查项核对

- [x] 清单每行有落点（§3/§4 红线登记原位不动）
- [x] 条件项显隐（展开钮/重置/变量/表单）mockup 开关实证
- [x] dark 变体（工具条可切）
- [x] accent 注入演示（chat_color_theme 三档换色）
- [x] 双宿主形态（直连全屏 / 气泡窗 400px 退化 + 展开收起）

## 实现核销（2026-09-30 回炉闭环）

计划：`docs/superpowers/plans/2026-09-30-chatbot单元呈现层回炉.md`（行为变更 10 条/mockup 偏差 3 条登记在册）。

| 节 | 落点 | 实现（commit） | 核销 |
|---|---|---|---|
| §1 路由与外壳 | `--bg` 纯色 + 移动卡片保留中性化（iframe 内不渲卡，宿主 embed.js 自带 chrome） | `b8a641f325` | ✅ |
| §2 Header | 40px 极薄 + 右组（查看变量/重置/展开收起）+ powered-by 双落点（直连 header 小字/气泡移动 footer） | `9b2e82dbe5` | ✅ |
| §3 iframe 协议 | 逐字保全（零逻辑改动；header spec 协议用例全绿 + 气泡窗走查实证 ready/config/expand-change） | — | ✅ |
| §4 URL 参数契约 | 逐字保全（零改动） | — | ✅ |
| §5 表单卡 | 欢迎屏流内「聊天设置」折叠条族卡 + accent CTA；会话中变量查/改统一走 header ViewFormDropdown | `f8eebc927b` | ✅ |
| §6 欢迎屏与描述卡 | chat 族同语言（居中图标+开场白 h1+副标题+建议 2×2）+ 描述 line-clamp-1 收编 + 去头像死 prop 摘除 | `f8eebc927b` | ✅ |
| §7 聊天核心 | chat 族复用携带（720 列恢复，窄宽自然退化） | `f8eebc927b` | ✅ |
| §8-1 createTheme/CssTransform | webapp 面零消费核销；`theme/` 模块残留 = console overview/try-app 消费面（另立项清扫），context.theme 空转字段已摘 | 收口 commit | ✅（残留登记） |
| §8-2 DifyLogo 末级品牌 | 「杏树林」链；`logo-embedded-chat-*` 零消费死码已删 | 收口 commit | ✅ |
| §8-3 isDify() 分支 | v1 已删，核销 | — | ✅ |
| §8-4 chat_color_theme_inverted | 已退役（字段接收不报错） | — | ✅ |
| §8-5 渐变头/渐变底 | 中性 token（§1/§2 实现） | `b8a641f325`/`9b2e82dbe5` | ✅ |

验证口径：chatbot 族 9 spec 文件全绿 + chat 核心 56 文件 1141 用例零改动回归绿 + tsc 0；QA 走查 21/21（桌面直连/移动 390/气泡窗 iframe 协议/dark）实证通过。
