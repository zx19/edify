# WebApp 重设计 · 功能清单：类型 1 `/chat`（chat-with-history）

> 三件套第 1 件（功能清单登记）。来源：代码穷举（file:line 可核）+ QA 运行态确认（2026-09-07，聊天助手 `Phtr0xqu8I2aBtL5`，DeepSeek 模型，截图 `qa-type1-chat-message.png`/`webapp-agent-chat-current.png`）。
> 标记：✅=QA 运行态已确认；⚪=代码存在、QA 未触发（条件性功能，注明开启条件）。
> 类型 1 覆盖：普通 Chat / Chatflow / Agent App（`getBuiltInAccessUrls` 全部映射 `/chat/` 段，QA 实证 agent新手 同样走此形态）。

## 1. 侧栏（桌面）

| 功能 | 代码 | QA |
|---|---|---|
| 应用信息区（图标+标题） | `sidebar/index.tsx:95-107` | ✅ |
| 侧栏展开/收起按钮（收起态悬停浮出面板） | `sidebar/index.tsx:108-125`、`index.tsx:51-62` | ✅ |
| 新建会话按钮 | `sidebar/index.tsx:127-137` | ✅ |
| 置顶会话分组（有置顶才显示） | `sidebar/index.tsx:139-150` | ⚪ |
| 会话列表 + 会话项切换 | `sidebar/index.tsx:152-164`、`item.tsx:27-35` | ✅ |
| 会话项操作（置顶/取消置顶/重命名/删除） | `item.tsx:39-51`、`operation.tsx:42-109` | ✅（更多按钮） |
| 重命名弹窗 | `rename-modal.tsx:20-61` | ⚪ |
| 删除确认弹窗 | `sidebar/index.tsx:193-212` | ⚪ |
| 「更多」菜单：**主题切换（跟随系统/浅色/深色）** | `share/text-generation/menu-dropdown.tsx:69-74` | ✅ |
| 「更多」菜单：隐私政策链接（有配置才显示） | `menu-dropdown.tsx:76-87` | ⚪ |
| 「更多」菜单：关于弹窗（图标/标题/描述/版权/免责声明） | `menu-dropdown.tsx:88-90`、`info-modal.tsx:16-67` | ✅（菜单项） |
| 「更多」菜单：退出登录（仅非 public 访问模式） | `menu-dropdown.tsx:91-99` | ⚪ |
| Powered by 页脚（品牌三级链：workspace logo/自定义 logo/Dify） | `sidebar/index.tsx:168-191` | ✅ |

## 2. 桌面 Header（聊天面板顶部）

| 功能 | 代码 | QA |
|---|---|---|
| 展开侧栏按钮（侧栏收起时） | `header/index.tsx:92-99` | ✅ |
| 应用图标/标题 | `header/index.tsx:100-113` | ✅ |
| 当前会话操作下拉（置顶/重命名/删除） | `header/index.tsx:114-126`、`header/operation.tsx:38-69` | ⚪ |
| 新建会话按钮（侧栏收起时出现） | `header/index.tsx:131-150` | ⚪ |
| 重置对话按钮 | `header/index.tsx:152-168` | ✅ |
| 查看会话变量入口（有变量表单时） | `header/index.tsx:169`、`inputs-form/view-form-dropdown.tsx:6-43` | ⚪ |

## 3. 移动端专属

| 功能 | 代码 | QA |
|---|---|---|
| 独立 Header（菜单按钮/图标标题/会话操作/更多下拉） | `header-in-mobile.tsx:81-121` | ⚪（未测） |
| 侧栏全屏浮层 + 变量设置全屏浮层 | `header-in-mobile.tsx:123-159` | ⚪ |
| 删除确认/重命名弹窗（移动端形态） | `header-in-mobile.tsx:160-189` | ⚪ |
| 整体布局上下结构（断点切换） | `index.tsx:35-76`、`hooks.tsx:90-91` | ⚪ |

## 4. 消息区（问题/答案）

| 功能 | 代码 | QA |
|---|---|---|
| 用户消息气泡（右侧）+ 用户头像 | `chat/index.tsx:215-251`、`question.tsx:148-254` | ✅ |
| 问题气泡操作：复制、**编辑后重发**（保存/取消） | `question.tsx:148-254`、`204-228` | ⚪ |
| 回答气泡 + 机器人头像 + 响应中动画 | `answer/index.tsx:162-170` | ✅ |
| **推理面板（「已深度思考」折叠，展开看思维链）** | `answer/reasoning-panel.tsx:14-28` | ✅（DeepSeek） |
| 回答 Markdown 渲染 | `answer/basic-content.tsx:10-36` | ✅ |
| Agent 思考链/工具调用过程（Agent 内容变体） | `answer/agent-content.tsx:14-57` | ⚪（Agent App 时） |
| Workflow 过程折叠面板（chatflow） | `answer/workflow-process.tsx:16-142` | ⚪（chatflow 时） |
| 人工介入表单内嵌聊天区（问题表单/已提交态） | `answer/index.tsx:213-224` | ⚪（human input 时） |
| 答案附件列表（下载/预览） | `answer/index.tsx:273-290` | ⚪ |
| **消息操作栏（hover）：赞同/反对** | `answer/operation.tsx:238-296` | ✅ |
| 点踩反馈内容弹窗 | `answer/operation.tsx:465-525` | ⚪ |
| 操作栏：复制 | `answer/operation.tsx:414-424` | ✅ |
| 操作栏：重新生成 | `answer/operation.tsx:425-429` | ✅ |
| 操作栏：朗读（TTS 开启才显示） | `answer/operation.tsx:409-413` | ⚪（本应用未开 TTS） |
| 管理员标注反馈栏（supportAnnotation 才显示） | `answer/operation.tsx:298-394` | ⚪ |
| **性能指标行（耗时/Token/tokens 每秒，回答下方）** | `answer/more.tsx:10-61` | ✅（直接可见非纯 hover） |
| 同问题多答案切换（上一条/下一条） | `answer/index.tsx:301-309`、`content-switch.tsx` | ⚪ |
| 引用/来源列表（含命中详情弹窗） | `answer/index.tsx:298-300`、`citation/index.tsx:19-133` | ⚪（RAG 应用时） |
| 开场白建议问题按钮 | `answer/suggested-questions.tsx:10-39` | ⚪（本应用未配） |
| 答案后推荐问题（suggested_questions_after_answer 开启） | `chat/index.tsx:173-174`、`try-to-ask.tsx:12-41` | ⚪ |
| 停止响应按钮（流式响应中） | `chat/index.tsx:270-281` | ⚪ |
| 标注作者信息展示 | `answer/index.tsx:291-296` | ⚪ |

## 5. 输入区

| 功能 | 代码 | QA |
|---|---|---|
| 文本输入框 + 占位符（`site.input_placeholder` 优先） | `chat-input-area/index.tsx:324-356`、`chat/index.tsx:286-287` | ✅ |
| 发送按钮（空内容禁用） | `chat-input-area/operation.tsx:57-73` | ✅ |
| Enter 发送/Shift+Enter 换行（`sendOnEnter` 可翻转） | `chat-input-area/index.tsx:175-189` | ✅ |
| Command/Ctrl+↑/↓ 输入历史 | `chat-input-area/index.tsx:190-206` | ⚪ |
| 附件上传按钮（`file_upload.enabled` 才显示；本地/URL 双方式） | `chat-input-area/operation.tsx:42-44`、`file-uploader-in-chat-input/index.tsx:12-51` | ⚪ |
| 拖拽/剪贴板粘贴上传 + 拖拽高亮 | `chat-input-area/index.tsx:103-109`、`351-355` | ⚪ |
| 语音输入（`speech_to_text.enabled` 才显示） | `chat-input-area/operation.tsx:45-55` | ⚪ |
| 输入禁用态（必填变量未填/上传中/待填人工表单/响应中） | `chat-wrapper.tsx:108-151` | ⚪ |
| 输入高度自适应 | `chat-input-area/hooks.ts:1-39` | ✅ |

## 6. 开场白与变量表单

| 功能 | 代码 | QA |
|---|---|---|
| 欢迎屏：应用图标 + Markdown 开场白（有建议问题左右布局，否则居中） | `chat-wrapper.tsx:360-415` | ✅（本应用未配开场白，空态居中） |
| 应用描述卡片（新会话，可展开/折叠） | `chat-wrapper.tsx:296-347` | ⚪ |
| 开场白变量替换 | `chat/hooks.ts:245-254` | ⚪ |
| 变量表单（桌面新会话+已有会话均显示；移动端仅新会话） | `chat-wrapper.tsx:349-358`、`inputs-form/index.tsx:15-93` | ⚪ |
| 变量字段 8 型：文本/数字/段落/复选/下拉/单文件/多文件/JSON | `inputs-form/content.tsx:75-159` | ⚪ |
| 开始聊天按钮（折叠表单） | `inputs-form/index.tsx:67-83` | ⚪ |
| 变量隐藏时自动跳过表单 | `hooks.tsx:328-330` | ⚪ |

## 7. 全局行为

| 功能 | 代码 | QA |
|---|---|---|
| 标签页标题=`site.title`、favicon | `index.tsx:33`、`hooks.tsx:137-143` | ✅ |
| 按站点默认语言自动切换 i18n | `hooks.tsx:173-178` | ⚪ |
| 会话自动命名（首轮后服务端命名，QA 实证「介绍你自己 🙂」） | `hooks.tsx:347-387`、`366-374` | ✅ |
| 匿名 passport（分享码免登录，localStorage `passport-<code>`） | `(shareLayout)/components/splash.tsx` | ✅ |

## 与设计稿的出入（已实证，mockup 前须吸收）

1. **WebApp 有手动主题切换**（侧栏「更多」：跟随系统/浅色/深色，`menu-dropdown.tsx:69-74`）——设计稿决策 #8「无切换入口」表述有误；dark 变体仍是硬需求，理由改为「用户可手动切换」。
2. **性能指标行默认可见**（非纯 hover）——新 UI 需决定其呈现策略（保留/收进 hover/配开关）。
3. 「更多」菜单是三族共享组件（text-generation 的 `menu-dropdown`），重构时注意联动。

## 待 mockup 定稿的设计关联

- ui_config `layout.show_conversation_sidebar`：关闭时 §1/§2 侧栏与 header 的会话操作需有降级形态（至少保留新建/重置）
- ui_config `components.show_message_actions`：覆盖 §4 操作栏（赞同/反对/复制/重新生成）
- ui_config `components.show_citation`：覆盖引用列表
- ui_config `components.show_suggested_questions`：覆盖开场白建议问题 + 答案后推荐问题
- ui_config `brand.footer_text`：接替 Powered by 页脚渲染（三级品牌链）
