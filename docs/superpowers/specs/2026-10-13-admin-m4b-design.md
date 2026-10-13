# M4b 设计：admin 续页（成员 + 系统管理员）——设计+执行计划合一

> 日期：2026-10-13；状态：已拍板
> 上游：`2026-10-12-admin-m4-design.md`(M4 壳/守卫/口径全部沿用）；设计稿 `2026-08-26-系统管理控制台UI-design.md` §4.3/§4.4
> **范围修订（2026-10-13 用户拍板）**：空间详情页**押后**（归档/恢复 UI 随之押后，后端端点已在，届时随详情页同上）;M4b = 成员页 + 系统管理员页。「页面成形」QA 门槛 = 空间列表/审计/成员/管理员四页。

## 决策记录

| # | 决策点 | 结论 |
|---|---|---|
| D1 | 详情页 | **押后**（含归档/恢复危险区 UI、集成 tab、rename、详情 GET 端点——一并随详情页里程碑再议） |
| D2 | 切片 | 成员页 → 管理员页 → 侧栏/i18n 收口，一个里程碑三任务 |
| D3 | 后端边界 | **零改动**（两页端点全齐：members 聚合 / system-admins 授撤转让） |
| D4 | 列降级 | 成员页「最后活跃时间」、管理员页「授予人」——后端未下发，均不显示并登记 |

## T1 成员页 `/admin/members`

- 过滤条：SearchInput(keyword，防抖 300ms)+ 空间下拉（`workspaces.get limit=100` 选项，全部空间/逐空间）
- 数据：`consoleQuery.admin.members.get.queryOptions({ input: { query: { keyword?, workspace_id?, page, limit: 20 } } })` → `{ data: [{ account_id, name, email, memberships: [{ workspace_id, workspace_name, role, joined_at }] }], has_more, page, total }`
- 聚合表格列：姓名/邮箱/**所属空间徽标组**(`空间名·角色`徽标，超 3 个折叠「+N」)/展开钮
- **行展开**（点击行或展开钮）：子行清单逐行列 memberships 全量（空间名 + 角色徽标 + 加入时间）；空间名暂不可点（详情页押后，纯展示）
- 分页同 M4 两页；角色徽标复用既有角色语义（owner/admin/editor/normal)
- spec：聚合渲染 / 徽标折叠 +N / 行展开清单 / keyword+空间过滤入查询参数

## T2 系统管理员页 `/admin/admins`

- 数据：`systemAdmins.get` → `[{ id, email, name, status, source, pending, created_at }]`；当前用户身份读 profile(`is_system_admin` + `system_admin_source`)
- **两级显隐**:`source === 'install'` 创始人 → 操作列可用；普通管理员 → 全页只读（操作列不渲染；后端 403 兜底不变）
- 列：姓名/邮箱/来源徽标（install=部署初始化 / env=环境变量 / invite=邮箱邀请 / grant=系统授予）/状态徽标（pending=待激活）/授予时间/操作；**无「授予人」列**(D4)
- **授予**（仅创始人，`GrantAdminDialog`)：邮箱 + 当前密码 → `systemAdmins.post { body: { email, current_password } }` → 已注册直效：toast + invalidate；未注册 PENDING：结果态展示 `invite_url` 复制（M4 创建弹窗同款降级）
- **撤销**（仅创始人，`PasswordConfirmDialog`)：密码确认 → `systemAdmins.byAccountId.delete_ { body: { current_password } }`；规则：创始人行（source=install)**无撤销入口**（不可自撤）;env 来源行按钮禁用 + title 标注「来自环境变量，需修改配置」;pending 行可撤销（作废邀请）
- **转让**（仅创始人，`TransferAdminDialog` = 密码 + 目标下拉）：目标 = 列表中非创始人且非 env 来源的 active 管理员 → `systemAdmins.transfer.post { body: { account_id, current_password } }` → 成功后 invalidate `systemAdmins` + **profile**（当前用户变普通，本页随之只读）
- **复用组件**:`PasswordConfirmDialog({ open, onOpenChange, title, description?, onConfirm(password), pending })`——撤销/转让共用（授予弹窗因含邮箱字段独立）
- spec：创始人/普通管理员显隐 / 授予双分支 / 撤销三规则（创始人行无入口、env 禁撤、pending 可撤）/ 转让成功 invalidate profile

## T3 侧栏 + i18n 收口

- 侧栏增量补：成员 `/admin/members`、系统管理员 `/admin/admins`（M4 D2 口径：建成即渲染）
- `admin.json`(zh-Hans/en-US）增量：`members.*`、`admins.*`、`passwordConfirm.*`
- spec：侧栏四项高亮跟随路由

## 非目标（M4b)

空间详情页全部（含归档/恢复 UI、集成 tab、rename、详情 GET)、成员管理写操作（一期收窄既定）、审计 actor 后端快照、授予人/最后活跃两列（D4 登记）。

## 验证

新增 spec 全绿 + admin 族既有零回归 + `pnpm type-check` 0 + CI 兜底（推送后 post-merge)。
