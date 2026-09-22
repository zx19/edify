# WebApp 重设计 · 功能清单：类型 3 `/completion/[token]`（text-generation）

> 三件套第 1 件（功能清单登记）。来源：代码穷举（file:line 可核）+ QA 运行态确认（2026-09-22，workflow 型应用 测试1 `iX3uigRobO2K7MXE`，:3001 代理 qa-xai 实证）。
> 标记：✅=QA 运行态已确认；⚪=代码存在、QA 未触发（注明开启条件）。
> **族覆盖**：text-generation 同族两用——`/completion/[token]`（类型3，isWorkflow=false）与 `/workflow/[token]`（类型4，isWorkflow=true）。本次走查应用为 workflow 型；completion 独有行（已保存 tab 等）代码穷举登记、实机待 completion 型应用补查。
> 族外共享件：`TextGenerationRes`（app/text-generate/item）、`SavedItems`（app/text-generate/saved-items）——console debug 侧也消费，重写走 token 双层口径。

## 1. 路由与外壳

| 功能 | 代码 | QA |
|---|---|---|
| `/completion/[token]` 路由 + AuthenticatedLayout 门禁 | `app/(shareLayout)/completion/[token]/page.tsx` | ✅（同族 /workflow 实证） |
| `/workflow/[token]` 同族复用（isWorkflow=true） | `app/(shareLayout)/workflow/[token]/page.tsx` | ✅ |
| 外壳：桌面左右双列（左表单 150 栏 + 右结果区），移动上下结构 | `text-generation/index.tsx:130-196` | ✅ |
| isInstalledApp 变体（h-full rounded-2xl，工作台嵌入） | `index.tsx:135` | ⚪（工作台 /installed 嵌入时） |
| Loading 门禁（appId/siteInfo/promptConfig 未就绪） | `index.tsx:123-129` | ✅ |
| 文档标题 + branding 后缀 | hooks/use-document-title | ✅（"测试1 - Dify"） |

## 2. 左侧栏（`text-generation-sidebar.tsx`）

| 功能 | 代码 | QA |
|---|---|---|
| 应用信息区（图标+标题+更多菜单钮） | `:96-111` | ✅ |
| 描述卡（line-clamp-3 + 展开/收起） | `:112-147` | ⚪（测试1 无描述） |
| Tabs：运行一次 / 批量运行 / 已保存（isWorkflow 时无已保存；有保存数显 Badge） | `:148-162` | ✅（两 tab；已保存未现身=workflow 型符合预期） |
| powered by 页脚：旧品牌链 workspace_logo → replace_webapp_logo → **DifyLogo**【重写点：末级改「杏树林」，对齐 chat/chatbot 口径】 | `:206-229` | ✅（POWERED BY Dify 实证） |
| 移动端结果已存在时壳体圆角收边 | `:164-172,211` | ⚪ |

## 3. 更多菜单（`menu-dropdown.tsx`，本族自有资产）

| 功能 | 代码 | QA |
|---|---|---|
| 主题切换（跟随系统/浅色/深色） | `:69-74` | ✅ |
| 隐私政策链接（site 配置才显示） | `:76-87` | ⚪（未配置） |
| 关于弹窗（InfoModal：图标/标题/描述/版权/免责） | `:88-90`、`info-modal.tsx` | ✅（菜单项；弹窗未开） |
| 退出登录（hideLogout=PUBLIC/EXTERNAL_MEMBERS/installedApp 时隐） | `:91-99` | ✅（public 模式不显示，符合） |

## 4. 运行一次（`run-once/index.tsx`）

| 功能 | 代码 | QA |
|---|---|---|
| 变量表单 8 型（text/paragraph/number/select/checkbox/file/file-list/json_object） | `:216-268` 及上文 | ⚪（测试1 无变量） |
| vision 图片上传区（visionConfig.enabled 才显示） | `:273-296` | ⚪ |
| 清空按钮 | `:299-303` | ✅ |
| 运行按钮（accent 实心 ▶；运行中变停止⏹ + stopping 态 spinner） | `:304-328` | ✅（accent 橙已由蓝色族重映射携带） |
| Enter 提交表单 | form submit 结构 | ✅（运行触发实证） |

## 5. 批量运行（`run-batch/`）

> **2026-09-22 用户拍板：批量运行 tab 改为可配置——`ui_config.components.show_batch_tab`，默认隐藏**（现状恒显变更；URL `?mode=batch` 兜底逻辑同步：配置关闭时忽略 batch 落回 create）。

| 功能 | 代码 | QA |
|---|---|---|
| CSV 拖放区（拖放或浏览） | `run-batch/index.tsx`、`csv-reader` | ✅ |
| 下载 CSV 模板（按变量生成） | `csv-download` | ✅（链接实证） |
| CSV 结构说明文案 | `run-batch/index.tsx` | ✅ |
| 批量执行（多任务并发控制/状态聚合） | `hooks/use-text-generation-batch.ts` | ⚪（未上传 CSV） |
| 批量结果：执行数头 + 下载结果（ResDownload）+ 失败重试条 | `text-generation-result-panel.tsx:149-160,177-195` | ⚪ |

## 6. 结果面板（`text-generation-result-panel.tsx` + `result/`）

| 功能 | 代码 | QA |
|---|---|---|
| 空态 NoData（「AI 会在这里给你惊喜。」） | `no-data/index.tsx` | ✅ |
| 桌面右列 / 移动端底部抽屉（drag handle 开合） | `text-generation-result-panel.tsx:111-147` | ✅（桌面）/⚪（移动抽屉开合未触发） |
| 结果区背景 bg-chatbot-bg | `:146` | ✅ |
| 加载态 Loading type=area | `result/index.tsx:159-177` | ✅（运行瞬间） |
| 停止响应按钮（inline，运行中） | `result/index.tsx:118-131` | ⚪ |
| 结果项 TextGenerationRes【族外共享件】：markdown 内容/复制/反馈（赞踩）/保存（收藏）/moreLikeThis/TTS/任务编号 | `app/text-generate/item`（console 共享） | ✅（内容+复制实证）/⚪（反馈/保存/TTS） |
| 工作流过程卡（步骤+状态勾+折叠；isWorkflow 时） | result 族 + workflow-stream-handlers | ✅（用户输入/LLM/输出 三步骤绿勾） |
| 结果/详情 双 tab（详情=inputs+meta） | text-generate/item 内部 | ✅ |
| 深度思考折叠（已深度思考） | 同上 | ✅（0.0s 折叠条） |
| 保存结果 API（save-message，completion 型专属） | `hooks/use-text-generation-app-state.ts` handleSaveMessage | ⚪（workflow 型无此） |

## 7. 全局行为

| 功能 | 代码 | QA |
|---|---|---|
| toast 通知（notify 回调） | `index.tsx:46-51` | ⚪ |
| access-mode 门禁（public/登录） | AuthenticatedLayout 复用 | ✅（public 实证） |
| 深浅色双通道（next-themes） | 菜单内主题切换实证 | ✅ |

## 8. 差异与重写点汇总

| # | 项 | 现状 | 目标方向 |
|---|---|---|---|
| 1 | powered by 品牌链末级 DifyLogo | sidebar `:226` | 「杏树林」链（chat/chatbot 同口径），落点随 mockup 定 |
| 2 | Tabs 视觉（Dify 蓝下划线） | sidebar `:148-162` | token 化（accent 族已重映射，复核蓝残留） |
| 3 | 结果区 bg-chatbot-bg 灰白渐变 | result-panel `:146` | 新视觉底色 |
| 4 | TextGenerationRes / SavedItems 族外共享件 | app/text-generate/* | token 双层（console debug 零影响红线） |
| 5 | menu-dropdown 视觉 | 本族资产 | 对齐 chat 单元菜单件视觉 |
| 6 | 移动端结果抽屉形态 | 底部抽屉+drag | mockup 定（保留 or 整页） |
| 7 | testid | **全族零 testid**（走查实证 testidCounts 空） | 重写时按需新增并登记冻结清单 |

## 9. QA 实证记录

- 环境：web-new :3001 + dev:proxy :5003 → qa-xai；应用 测试1（workflow 型，public 访问）`iX3uigRobO2K7MXE`
- 桌面 1280×800：初始（双列/空态/页脚）✅、批量 tab（CSV 拖放/模板下载/禁用运行）✅、更多菜单（主题+关于）✅、运行一次 → 过程卡+结果 ✅；截图 `/tmp/wf-desktop-{init,batch,menu,ran}.png`
- 移动 390×844：单列布局 + 全宽运行钮 ✅；截图 `/tmp/wf-mobile-init.png`
- 待补：completion 型应用实机（已保存 tab/保存结果/moreLikeThis）；有变量表单的应用（8 字段型/vision）
