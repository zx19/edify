# M4 设计：admin 轨——管理台壳 + 空间列表 + 审计 + /activate 接缝

> 日期：2026-10-12；状态：设计已拍板（用户逐节确认，§5 actor 显名为修订后口径）
> 关联规格（系统管理控制台五份）:
> - `2026-08-26-系统管理控制台UI-design.md`(UI 设计稿，本文 §3-§7 的上游语义)
> - `2026-08-26-系统管理控制台UI-mockup.html`（视觉基线）
> - `2026-08-27-系统管理控制台-PRD.md`(v1.8，验收标准)
> - `2026-08-27-空间侧配套修改-mockup.html`
> - `2026-08-28-系统管理控制台-待办事项.md`
> 后端前提：PlanA T 系列已落地——`/console/api/admin/*` 端点组、`is_system_admin`+`system_admin_source` 双字段随 profile 下发、契约已生成（`consoleQuery.admin.*`)。本文不新增任何后端改动。

## 1. 范围与定位

M4 = admin 轨首个里程碑，交付**可走查的管理台最小闭环**:路由组 + layout + 守卫 + 空间列表（含创建）+ 审计页 + /activate 双命名空间接缝 + 入口/落地配套。

**用户旅程闭环**：创始人授子管理员 → 受邀者收邮件点 `/activate?token=…` → 激活表单设名+密码 → 登录 → 落地 `/admin` → 建空间（含 PENDING 分支）→ 审计页查到 `workspace.create`/`admin.grant_invite` 记录。

## 2. 决策记录（2026-10-12 拍板）

| # | 决策点 | 结论 |
|---|---|---|
| D1 | 空间页范围 | **列表 + 创建弹窗**；归档/恢复留待空间详情页里程碑（忠于设计稿危险区落点） |
| D2 | 侧栏渲染 | **只渲染已建成项**（工作空间/审计日志），后续里程碑增量补，无死链无占位页 |
| D3 | 表格实现 | **页内手卷 `<table>` + token**（仿 members-page 样式）;lomva-ui table 原语化另立项（设计稿 v1.8 的账，回收时含后续详情/成员/管理员页手卷表格） |
| D4 | 闭环配套 | **纳入**：头像菜单「系统管理」入口 + 无空间管理员登录落地/误入兜底重定向 |
| D5 | 守卫落位 | **客户端守卫**(admin layout 内 client 组件，仓库 install 页惯例）；安全边界在后端 403，前端守卫为 UX 层 |
| D6 | 审计 actor 显名 | **纯前端映射**：审计页拉一次 `/admin/system-admins` 名单（极小）映射 `actor_account_id`→姓名+邮箱；已撤销管理员回退显截断 ID;目标列用 workspaces 列表映射显空间名（修订 §5 的「仅显 ID」口径） |

## 3. 文件结构

```
web-new/app/admin/
  layout.tsx                  # server:metadata + 渲染 AdminGuard
  page.tsx                    # 重定向 → /admin/workspaces
  _components/
    admin-guard.tsx           # client:守卫三分支
    admin-shell.tsx           # .admin-theme 作用域 + 侧栏 + 内容区
    admin-sidebar.tsx         # 侧栏(两项一级导航)+ 底部账号行
    status-badge.tsx          # 空间状态徽标(正常/已归档)
  workspaces/
    page.tsx                  # 空间列表
    _components/create-workspace-dialog.tsx
  audit-logs/
    page.tsx                  # 审计页
    _components/audit-detail-cell.tsx   # detail JSON 展开
```

路由组外配套改动：
- `app/components/header/account-dropdown/`：加「系统管理」入口项（`is_system_admin` 显隐）
- `app/(commonLayout)/`：加无空间系统管理员兜底重定向组件
- `app/activate/activateForm.tsx`：双命名空间接缝（§8)
- `web-new/i18n/zh-Hans/admin.json` + `en-US/admin.json` 新增（其余语言 fallback，口径 C14)

## 4. 守卫（AdminGuard)

client 组件，`useQuery(userProfileQueryOptions())` 三分支：
- **加载中** → 全屏 Loading
- **非系统管理员**(`is_system_admin`  falsy)→ 403 视图：图标 + 「无权访问」文案 + 返回首页链接；**不渲染壳与子页**、**不重定向**（避免与 §9 兜底形成循环）
- **管理员** → `<AdminShell>{children}</AdminShell>`

无空间系统管理员天然通过（守卫只读 profile，不触碰 workspace 上下文）;admin layout 不挂 `(commonLayout)` 的工作空间依赖（设计稿 §2)。

## 5. 壳（AdminShell)

- 根 div 挂 `.admin-theme` 作用域类（tokens.css 已定义，与 webapp/console 同值，无新视觉工作）
- 左侧栏：顶部「系统管理」标题；一级导航仅两项——工作空间 `/admin/workspaces`、审计日志 `/admin/audit-logs`;`usePathname` 判定当前项高亮（样式对齐 mockup:accent-soft 底 + accent-deep 字）
- 底部账号行**最小化**：头像 + 姓名 + 登出（复用现有登出逻辑）。**偏离定稿声明**：设计稿 §2 的偏好设置/外观/版本弹窗本里程碑不做，后续补齐
- 右侧内容区独立滚动；表格/弹窗视觉对齐现有 console 页面语言

## 6. 空间列表页 `/admin/workspaces`

- **工具条**:SearchInput（复用 Web composite)+ 状态下拉（全部/正常/已归档，lomva-ui Select)+「创建空间」主按钮
- **数据**:`consoleQuery.admin.workspaces.get.queryOptions({ query: { keyword, status, page, limit } })`;keyword 防抖后入查询
- **表格**（页内手卷）：空间名 / owner（姓名+邮箱）/ 成员数 / 状态徽标 / 创建时间；**无行内操作**（详情页与归档/恢复属后续里程碑）
- **分页**:lomva-ui `pagination` 原语；响应 `has_more + page + total`
- **创建弹窗**(Dialog + 原生 form 边界，可见 label):空间名 + owner 邮箱 → `workspaces.post` mutation；成功两分支：
  - 已注册直加（`owner_pending=false`):toast + 关弹窗 + invalidate 列表
  - 未注册 PENDING(`owner_pending=true`)：弹窗内转结果态——「邀请邮件已发送/发送失败」提示 + 邀请链接（`invite_url`）复制框；关闭后 invalidate

## 7. 审计页 `/admin/audit-logs`

- **过滤条**：操作类型下拉（枚举后端已产事件族 `workspace.create`/`workspace.archive`/`workspace.unarchive`/`admin.grant_invite`/`admin.revoke`/`admin.transfer`)、目标空间下拉（选项取自 workspaces 列表接口）、时间范围（起止 date → epoch 秒）、操作人文本输入（actor_account_id)
- **名称映射**(D6)：页面加载即拉 `/admin/system-admins` 全量名单（数量极小）建 `actor_account_id → {name, email}` 映射，actor 列显「姓名 + 邮箱副行」；映射缺失（已撤销管理员）回退显截断 ID。目标列 `workspace_id` 用同一 workspaces 列表映射显空间名，回退显 ID
- **表格列**：时间 / 操作人 / 动作 / 目标 / 详情；「详情」点击行内展开 pretty JSON(`detail` 为 JSON 字符串原样解析展示）
- **分页**：同空间列表

## 8. /activate 双命名空间接缝（Plan B 首项）

改造 `app/activate/activateForm.tsx`，顺序双试（成员命名空间为常见路径优先，避免无意义并发）:
1. **成员 check**（现有 `useInvitationCheck`,`member_invite` 命名空间，携 token/email/workspace_id)——`is_valid` → 现有跳 `/signin` 逻辑**零改动**
2. 成员 check 返回 `is_valid === false` → 启用 **admin check**(`consoleQuery.admin` activation check,`admin_invite` 命名空间，仅携 token;`enabled` 门控，无双发竞态）
3. **admin-valid** → 页内渲染激活表单：姓名 + 密码 + 确认密码（界面语言随当前 locale)→ POST `/admin/activation` → 成功 toast → `router.replace('/signin')`（登录 → 落地 `/` → §9 兜底重定向 → `/admin`，即 PRD US-4 AC1「激活后首登直达 /admin」)
4. **双 invalid** → 现有失效视图**零改动**

空间 owner PENDING 邀请走成员命名空间（`workspaces.post` 里 `generate_invite_token`),`/activate` 既有链路天然兼容，不在接缝改动面。

## 9. 入口与落地闭环

- **入口**:`account-dropdown` 菜单加「系统管理」项（图标 + i18n 文案）,`profile.is_system_admin` 为真才渲染，点击 → `/admin`；普通用户无感知
- **兜底重定向**:`(commonLayout)` providers 内加 client 组件，读 `userProfileQueryOptions` + `currentWorkspaceAtom`:`is_system_admin && 无空间` → `router.replace('/admin')`。单点覆盖两场景：登录落地（fallback 为 `/`）与管理员误入普通控制台页（设计稿 §4.9 #8)
- **防误跳**:profile/workspace query 未就绪时不判定（以 data 落地为准）；普通用户与有空间管理员**不跳**；反向无循环（§4 守卫只渲染 403 不重定向）

## 10. 测试（vitest;cwd=web-new;`npx vp test --project unit`)

| 对象 | 用例 |
|---|---|
| AdminGuard | 三分支：loading → Loading；非管理员 → 403 视图且无壳；管理员 → 壳+子页 |
| AdminSidebar | 当前路由项高亮 |
| 空间列表页 | 列表渲染；keyword 防抖 + status 过滤入查询参数；分页；创建弹窗两分支（直加 → toast+invalidate;PENDING → 邀请链接展示/复制） |
| 审计页 | 四维过滤入查询参数；详情展开 JSON;actor/目标名称映射与缺失回退；分页 |
| /activate 接缝 | member-valid 跳签不变；member-invalid + admin-valid → 渲染激活表单并 POST；双 invalid → 失效视图 |
| 入口 | `is_system_admin` true/false 显隐 |
| 兜底重定向 | 无空间管理员 → replace /admin；有空间管理员不跳；普通用户不跳；query 未就绪不跳 |

## 11. 非目标（M4 明确不做）

- 空间详情页（含归档/恢复危险区）、成员页、系统管理员页、插件管理/模型提供商/插件市场页
- lomva-ui table 原语新建（D3 另立项）
- 审计 actor 后端快照字段（D6 前端映射已覆盖主路径，根治另立项）
- 侧栏底部偏好/外观/版本弹窗（§5 偏离声明）
- QA 部署 + 改库标记 `source=install`（押后至页面成形；届时按《系统管理-部署与验收手册》§3/§4 执行）

## 12. 验证口径

本机无容器运行时、QA 改库押后 → M4 验证 = **新增 spec 全绿 + 既有单测零回归 + `tsc` 零错误 + CI 绿**；真机目视走查押后至 QA 部署完成。机械改动面（i18n key、菜单项）以 tsc + 单测兜底。
