# WebApp 重设计 · 功能对照表 v2：类型 3/4 text-generation 族（completion / workflow）

> 三件套第 3 件（重出）。输入：功能清单（`2026-09-22-WebApp重设计-功能清单-类型3-completion.md`，沿用——族覆盖类型 3/4，QA 实证为 workflow 型应用）+ mockup v2（`2026-09-24-WebApp重设计-mockup-类型34-text-generation.html`，2026-09-24 用户评审通过，含 D7 修正后双列版）+ 方向定稿（D7 修正/D8/D10）。
> **本表取代 `2026-09-22-WebApp重设计-功能对照表-类型3-completion.md`**（旧表方向=旧视觉语言，已作废）。一表覆盖类型 3/4（族合一稿），类型差异行显式标注；env-workflow（类型 5）同族语言，待 QA 实证后单独确认。
> 变化类型：原位 / 换位置 / 形态 / 标注 / 新增。

## 1. 路由与外壳

| 功能（清单行） | 新设计落点 | 类型 |
|---|---|---|
| `/completion/[token]` 路由 + 门禁 | 不变 | 标注 |
| `/workflow/[token]` 同族复用（isWorkflow=true） | 不变 | 标注 |
| 外壳：桌面左右双列（左表单+右结果），移动上下 | **「运行一次」视图：桌面左表单（360px 独立滚动）+ 右结果（自适应独立滚动）双列**；批量/已保存视图单列 720；移动端单列（D7 修正 + D10） | 形态 |
| isInstalledApp 变体（工作台 /installed 嵌入） | 保留（同源三用；双列在嵌入窄容器退化单列，<900px 断点） | 标注 |
| Loading 门禁 | 保留 | 标注 |
| 文档标题 + branding 后缀 | 保留（后缀链去 Dify 化随全局收口） | 标注 |

## 2. 左侧栏 → 拆解（segment + header + 壳底页脚）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 应用信息区（图标+标题+更多菜单钮） | 极薄 header 左（图标+名）+ header 右 ⋯ 菜单 | 换位置 |
| 描述卡（line-clamp-3 + 展开/收起） | ⚠️**待定点**：推荐合并进「关于」弹窗（现状描述在两处重复：侧栏卡 + 关于弹窗）；备选 = 表单列顶部一行 line-clamp+展开 | 形态（待拍板） |
| Tabs：运行一次 / 批量运行 / 已保存 | **segment 切换条**（header 下居中；D8）；已保存带数量 Badge | 形态 |
| powered by 页脚 | 壳底部居中一行（品牌链末级杏树林） | 换位置 |
| 移动端结果已存在时壳体圆角收边 | 取消（无底部抽屉形态，D10） | 形态 |

## 3. 更多菜单（menu-dropdown）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 主题切换（跟随系统/浅色/深色） | header ⋯ 菜单首组三态 segment | 换位置 |
| 隐私政策链接 | ⋯ 菜单（site 配置才显示） | 换位置 |
| 关于弹窗 | ⋯ 菜单 → 居中弹窗 | 换位置 |
| 退出登录 | ⋯ 菜单末项（条件显隐沿用） | 换位置 |

## 4. 运行一次（表单列）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 变量表单 8 型 | 表单列同一样式族（text/number/select/checkbox/file/file-list/paragraph/json_object） | 形态（视觉） |
| 隐藏变量 | 不渲染（URL `sys.*`/默认值注入；无可见 UI） | 标注 |
| vision 图片上传区 | 表单字段位（visionConfig.enabled 条件） | 原位 |
| 清空按钮 | 表单列底部操作条左（sticky 沉底） | 原位 |
| 运行按钮 | 操作条右 accent 实心 ▶；**运行中原位变 ⏹ + stopping spinner**（沿用现状变形语义，同 D4 口径） | 原位 |
| Enter 提交表单 | 保留 | 标注 |

## 5. 批量运行（segment 第二视图，单列）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| tab 可配置（`ui_config.components.show_batch_tab` 默认隐藏） | segment 项显隐；off 时 URL `?mode=batch` 兜底忽略落回 run（09-22 拍板沿用） | 原位 |
| CSV 拖放区 | 单列视图内拖放卡 | 原位（视觉） |
| 下载 CSV 模板 | 拖放卡下链接 | 原位 |
| CSV 结构说明文案 | 说明卡 | 原位（视觉） |
| 批量执行（并发控制/状态聚合） | 保留（机制不变） | 标注 |
| 批量结果：执行数头 + 下载结果 + 失败重试条 | 结果头条卡（计数/重试/下载） | 形态（视觉） |

## 6. 结果面板（右列，替换式）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 空态 NoData（「AI 会在这里给你惊喜。」） | 轻提示占位（虚线框 + 引导文案；插画取消） | 形态 |
| 桌面右列 / 移动端底部抽屉 | 桌面右列 pane；**移动流内（抽屉取消，D10）** | 形态 |
| 结果区背景 bg-chatbot-bg 灰白渐变 | `--bg` 纯色（去渐变） | 形态 |
| 加载态 Loading type=area | 右列 Loading | 原位 |
| 停止响应按钮（inline） | **取消**——运行键 ⏹ 承担（同 D4 口径） | 形态 |
| TextGenerationRes（markdown/复制/赞踩/保存/moreLikeThis/TTS/任务编号） | 结果项卡片 + 底部操作行；保存/再来一条 = completion 专属；TTS 条件 | 形态（视觉） |
| 工作流过程卡（isWorkflow 时） | 折叠卡片族（badge 状态 + 步骤行；**类型 4 专属**）；`show_workflow_steps` 关闭时整卡不渲染 | 形态（视觉） |
| 结果/详情 双 tab | 沿用（详情 = inputs + meta + 任务编号） | 原位 |
| 深度思考折叠 | pill 折叠条（族共用） | 原位 |
| 保存结果 API（completion 专属） | 机制不变 | 标注 |

## 7. 全局行为

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| toast 通知 | 保留 | 标注 |
| access-mode 门禁 | 保留 | 标注 |
| 深浅色双通道 | ⋯ 菜单主题三态（机制沿用 next-themes） | 原位 |

## 类型差异汇总（一表两型的显式行）

| 面 | 类型 3 completion | 类型 4 workflow |
|---|---|---|
| 已保存 tab | 有（Badge 计数） | 无 |
| 保存/再来一条按钮 | 有（保存需 save-message API） | 无 |
| 工作流过程卡 | 无 | 有（show_workflow_steps 可控） |
| 深度思考折叠 | 有 | 有（族共用） |

## ui_config / 开关降级规则

| 开关 | off 时 |
|---|---|
| `components.show_batch_tab` | segment 只余「运行一次」（completion 再+「已保存」）；URL batch 兜底落回 run |
| `components.show_message_actions` | 结果项操作行整行不渲染（复制/赞踩/朗读/保存/再来一条） |
| `components.show_citation` | 本族结果项无引用面（无渲染对象，语义保留） |
| `show_workflow_steps`（既有列，非 ui_config） | 过程卡整卡不渲染 |
| `brand.footer_text` | 非空 → 壳底页脚直出；空 → 品牌链 |

## 评审检查项核对

- [x] 清单每行有落点（描述卡为待定点，见 §2）
- [x] 类型差异行显式标注
- [x] dark 变体（工具条可切）
- [x] ui_config / 条件项（批量 tab/工作流步骤/消息操作/vision 四开关实证）
- [x] 双列断点退化（<900px 单列）+ 移动端单列
