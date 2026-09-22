# WebApp 重设计 · 功能对照表：类型 3/4 `/completion` + `/workflow`（text-generation 族）

> 三件套第 3 件。输入：功能清单（`2026-09-22-WebApp重设计-功能清单-类型3-completion.md`）+ mockup（`2026-09-22-WebApp重设计-mockup-类型3-completion.html`，2026-09-22 用户评审通过——含追加拍板：**批量运行 tab 可配置默认隐藏**）。
> 变化类型：**原位** = 位置形态同现状只换 token；**换位置** = 落点移动；**形态** = 交互/呈现形态变化；**标注** = mockup 不可见的逻辑行（实现时保留）。
> 族范围：同族双型——`/completion/[token]`（isWorkflow=false）与 `/workflow/[token]`（isWorkflow=true），一份对照表通吃；族外共享件 `TextGenerationRes`/`SavedItems` 走 token 双层（console debug 零影响红线）。
> 用户拍板（2026-09-22）：桌面双列保留换肤；移动端底部抽屉保留；powered by = 桌面左栏底部 + 移动端底部一行；批量运行 tab 可配置默认隐藏。

## 1. 路由与外壳

| 功能（清单行） | 新设计落点 | 类型 |
|---|---|---|
| 双路由 + AuthenticatedLayout 门禁 | 不动 | 原位 |
| 桌面左右双列 | 保留双列：左栏白底（bg）+ 右结果区 bg-soft | 形态（视觉换肤，09-22 拍板） |
| 移动端上下结构 | 保留：上表单 + 底部结果抽屉 | 原位（09-22 拍板） |
| isInstalledApp 变体（工作台嵌入） | 保留 | 标注 |
| Loading 门禁 / 文档标题 branding 链 | 不动 | 原位 |

## 2. 左侧栏

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 应用信息区（图标+标题） | 左栏顶 32px 图标 + 名称（text-1） | 原位（视觉 token 化） |
| 更多菜单钮 | 右置 icon 钮（视觉对齐 chat 单元菜单件） | 形态（视觉） |
| 描述卡（line-clamp-3 + 展开/收起） | 同结构，文字 var(--text-3)、链接 var(--accent-deep) | 形态（视觉） |
| Tabs：运行一次/批量运行/已保存 | accent 下划线选中态（Dify 蓝下划线退役） | 形态（视觉） |
| **批量运行 tab** | **`ui_config.components.show_batch_tab` 控制，默认隐藏**；`?mode=batch` 在配置关闭时忽略落回 create | 形态（09-22 追加拍板，行为变更） |
| 已保存 tab + 数量 Badge | 仅 completion 型（isWorkflow=false）；徽标 gray-pill，选中态 accent-pill | 原位（视觉） |
| powered by 页脚 | **桌面：左栏底部**（chat 口径）；**移动端：底部一行**（chatbot 口径）；品牌链末级 **DifyLogo → 杏树林** | 形态（品牌默认变更 + 移动端换位置） |

## 3. 更多菜单（menu-dropdown）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 主题切换 | 菜单首组（视觉对齐 chat 单元） | 原位（视觉） |
| 隐私政策链接（site 配置才显示） | 同菜单 | 原位 |
| 关于弹窗（InfoModal） | 居中弹窗新视觉 | 形态（视觉） |
| 退出登录（hideLogout 规则） | 同菜单末项 | 原位 |

## 4. 运行一次（run-once）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 变量表单 8 型 | 字段族新视觉（focus accent 晕环，同 chat 表单卡口径） | 形态（视觉） |
| vision 图片上传区 | 原位（token 化） | 原位 |
| 清空按钮 | ghost 按钮 | 形态（视觉） |
| 运行按钮（accent 实心/运行中变停止） | accent 主钮（蓝色族重映射已携带，复核残留） | 形态（视觉） |
| Enter 提交 | 保留 | 标注 |

## 5. 批量运行（配置开启才可见）

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| CSV 拖放区 | 虚线卡新视觉（hover accent） | 形态（视觉） |
| 下载模板 / 结构说明 | accent 链接 | 形态（视觉） |
| 批量执行 hooks（并发/状态聚合） | 不动 | 标注 |
| 批量结果头（执行数 + 下载结果） | 大写小标题 + accent 下载链 | 形态（视觉） |
| 失败重试条 | danger-soft 吸底条 + 重试链接 | 形态（视觉） |

## 6. 结果面板

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| 空态 NoData（「AI 会在这里给你惊喜。」） | bg-soft 居中 spark 图标 + 三级灰文案 | 形态（视觉） |
| 桌面右列 / 移动端底部抽屉（drag handle） | 结构保留，token 化 | 原位（09-22 拍板） |
| 结果区 bg-chatbot-bg 渐变 | var(--bg-soft) 纯色 | 形态（视觉） |
| 加载态 / 停止响应按钮 | 保留（accent 停止钮同 chat 口径） | 原位 |
| TextGenerationRes（族外共享件：内容/复制/反馈/保存/moreLikeThis/TTS/任务编号） | **token 双层**：无作用域（console debug）视觉不变；作用域内新视觉 | 形态（视觉，1b 红线） |
| 工作流过程卡（isWorkflow） | 折叠卡新视觉（步骤行 + success 勾） | 形态（视觉） |
| 结果/详情 双 tab | 选中态 text-1 下划线 | 形态（视觉） |
| 保存结果（completion 型专属） | 保留 | 标注 |

## 7. 全局行为

| 功能 | 新设计落点 | 类型 |
|---|---|---|
| toast / access-mode 门禁 / 深浅色双通道 | 不动 | 原位 |
| accent 注入（chat_color_theme → buildAccentStyle） | 壳根 inline 注入（chat/chatbot 同机制共享件） | 标注 |
| testid | 全族零 testid（清单实证）→ 重写新增点入 `baselines/` 冻结清单 | 标注 |

## 8. 验收注记

- **console 零影响**：`TextGenerationRes`/`SavedItems` 被 console debug 消费——双层类（base = Dify 等效 + `[.webapp-theme_&]` 新视觉），族外组件 spec 保持绿。
- **批量 tab 行为变更**是本族唯一的功能性变更（默认隐藏），验收须双态实证（未配置=无 tab 且 ?mode=batch 落回 create；配置 true=tab 出现可跑批）。
- **isInstalledApp 变体**（工作台嵌入）走查待工作台线起量后复核。
- e2e 缺口同 chat（M2 阻塞链），登记 reports/test-gaps.md。
