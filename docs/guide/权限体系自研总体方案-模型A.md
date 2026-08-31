# 权限体系自研总体方案-模型A：RBAC 本地化 + 组织级管理

> 状态：设计稿（2026-08-26，合并《RBAC 自研替代方案》《组织级权限与跨空间管理方案》；2026-08-28 修订：一期收窄贯通、插件/凭据提入一期同步至数据模型与端点、MCP 不托管、login 预检缺口补录、工作量重估；2026-08-30 修订：插件托管动作模型定稿（四动词/双向改范围/升级波双向收敛/recycling）、组织凭据加密锚点方案 A 与显式分派模型、凭据范围与插件分发解耦；2026-08-31 修订：空间侧防线三道补为四道——新增④`/permission/change` 锁改 install_permission（工作台 UI 评审发现，防 owner 改回 everyone 自装非托管插件））。
> **排期**：流 B 一期（系统管理员 + 跨空间管理 + 审计 + 插件托管 + 组织级凭据）为**上线前必做项**（组织级管理属上线交付内容）；流 A（RBAC 本地化）需求驱动。
> 决策前提：完整对齐企业版 RBAC 功能（前端现有 UI 全部可用）；**严格切换**（开启后固定角色不再授予权限）。
> 现状参考：《权限体系模型-代码核实与设计目标》；关联：《工作空间机制说明》§3.3/§3.6、《企业版与社区版功能对照》附录。

## 1. 现状与目标

**现状的精确表述**：RBAC 的"管道"已通——权限点枚举（`core/rbac/entities.py`，约 50 个）、装饰器、前端 UI、45+ 端口的控制器全部存在；写死的是**两处数据**：① 角色枚举（5 档，`models/account.py:21`）；② 角色→权限点映射（`_LEGACY_*_KEYS`，`rbac_service.py:306-493`）。角色可自定义、映射入库的部分在闭源企业后端。

**目标**：把这两处写死搬进本地数据库，分两个交付流：

- **流 A：RBAC 本地化**——替换 `_inner_call` 传输层，角色/策略/矩阵本地存取，前端与控制器零改动。
- **流 B：组织级管理**——系统管理员 + 跨空间管理 UI + 审计；权限模型上扩展 organization scope（有效权限 = 组织级 ∪ 空间级并集）。

**非目标**：不接企业后端账号体系；不做计费/license；不改变 `RBAC_ENABLED` 开关语义；一期不做 ABAC 多因子（PDP/时间/IP），资源标签约束为可选增强（见 §9）。

## 2. 总体设计

```
流 A（判定链）：
控制器/服务调用方（约 15 处，不动）
  └─ RbacService 嵌套类（不动）
       └─ _inner_call(method, endpoint, ...)              ← 唯一替换点（rbac_service.py:715）
            ├─ RBAC_BACKEND=enterprise → EnterpriseRequest HTTP（保留）
            └─ RBAC_BACKEND=local     → LocalRBACRouter：(method, path模板) → 本地 handler → PG

流 B（管理链）：
系统管理员（SYSTEM_ADMIN_EMAILS 名单 → 二期转 organization 角色）
  └─ /console/api/admin/*（@deployment_admin_required）→ TenantService 等现成服务
       └─ 全操作写 admin_audit_logs
```

**关键决策**：

1. **传输层替换而非逐方法改写**：`_inner_call` 是单点；本地实现为路由表，rebase 上游冲突面最小。
2. **显式后端选择**：新增 `RBAC_BACKEND=enterprise|local`（默认 enterprise，与上游一致）。
3. **DTO 契约以企业后端返回结构为准**：已从 `_parse_*` 与前端 `web/models/access-control.ts` 反推（§4）。
4. **组织级与空间级共用一套表**：绑定表加 `scope`（organization 时 tenant_id 为空），判定取两级并集，**并集取大**——不做"空间收缩组织"的差集语义（复杂度与心智成本都高一档）。
5. **ABAC 只做过滤器不做权限源**：own 约束（`maintainer=me`）附加在判定上；tenant 边界天然存在、不属于 ABAC。

## 3. 统一数据模型（新增表，均 tenant 隔离；* 为流 B 使用）

**租户边界约定**：Dify 现状为 tenant_id 逻辑隔离（业务表带 tenant_id、`load_user` 恢复 current_tenant、插件 daemon 按 `plugin/{tenant_id}/` 隔离）。本方案不改动该骨架，新增约定：**`tenant_id` 可空 = 组织级**（组织级凭据、organization 角色绑定）；审计表 `workspace_id` 可空（组织级动作记 NULL）；系统管理员是唯一无租户身份（`accounts.is_system_admin`），admin 端点显式传 workspace_id、不依赖 current_tenant；插件托管扇出后仍是各空间独立的租户级安装。

| 表 | 关键字段 | 说明 |
|---|---|---|
| `rbac_roles` | id、tenant_id、name、description、type、category、is_builtin、permission_keys JSONB、role_tag、时间戳 | 角色=权限点集合 |
| `rbac_member_role_bindings` | id、**tenant_id 可空**、**scope**(workspace/organization)、account_id、role_id；唯一约束按 scope | 成员-角色；organization 行即组织级授权 |
| `rbac_access_policies` | id、tenant_id、resource_type(app/dataset)、policy_key、name、permission_keys JSONB、is_builtin、时间戳 | 访问策略=资源域权限集合 |
| `rbac_access_policy_bindings` | id、tenant_id、policy_id、scope_level(workspace/resource)、resource_id 可空、subject_type(role/account)、subject_id、is_locked | 矩阵的一格 |
| `rbac_resource_whitelists` | tenant_id、resource_type、resource_id、scope(all/only_me/specific)、account_ids JSONB；唯一(tenant,resource_type,resource_id) | 资源可见范围 |
| `admin_audit_logs` * | id、actor_account_id、action、target_type、target_id、workspace_id 可空、detail JSONB、created_at | 跨空间审计 |
| `integration_grants` * | id、tenant_id 可空（组织级=空）、**plugin_id**（非完整 identifier）、version、source(marketplace/github/package)、scope(all/specific)、scope_tenant_ids JSONB、last_push_at、status(active/recycling)、时间戳；唯一(tenant_id IS NULL, plugin_id) | 插件托管记录（范围/版本/扇出状态，改范围/升级/回收依据）。**不存完整 identifier**：checksum 推送时才从包解析（三源各不同），存了必与 version 冗余冲突。source 是取包路径记录非身份组成（同版本同包无论哪源物理同一份）。status=recycling 为回收波进行中的中间态（防无 grant 的孤儿安装） |
| `organization_credentials` * | id、provider_name、credential_type(key_secret/oauth)、encrypted_config、**encryption_anchor_tenant_id**、时间戳；唯一(provider_name) | 组织级凭据（密文存储、掩码只进不出）。**加密锚点（方案 A）**：现有加密层为每租户 RSA 密钥对（`libs/rsa.py`，私钥 `privkeys/{tenant_id}/`），空 tenant_id 无密钥可用；组织凭据密文统一挂**锚租户**（首个租户或专设 org-anchor）的密钥下加解密，锚租户独立成列、tenant_id 列不再承担加密语义。**scope 与插件分发范围解耦**（见 §6.4） |
| `provider_credential_assignments` * | id、provider_name、tenant_id、assignment(org/self)、时间戳；唯一(provider_name, tenant_id) | 凭据分派指针（**一期只读、值恒为 org**）。显式分派替代回退链：解析按分派直查单条，无优先级规则。一期建表+读链路上线（热路径一个版本），二期只加写入口与切换 UI，无 schema 变更 |

要点：permission_keys 用 JSONB 数组；全部查询带 tenant_id 组合索引；Alembic 迁移按 `api/migrations/` 规范；凭据密文加密存储（组织凭据经锚租户 RSA，见上表方案 A）。

## 4. 流 A 接口面（本地 handler，45+ 端点按复杂度分三组）

### P1 — 基础 CRUD（机械，~15 个）

Catalog（`role-permissions/catalog[/app|/dataset]`，本地静态目录支持 language）、Roles 全系列（list/item CRUD/copy/members）、AccessPolicies 全系列、MemberRoles（get/batch/replace/delete）。

### P2 — 判定与快照（核心算法，~5 个）

| 端点 | 本地逻辑 |
|---|---|
| `POST /rbac/check-access` | §5 判定算法 |
| `GET /rbac/my-permissions` | workspace 快照 + app/dataset 快照（默认键 + overrides） |
| `POST /rbac/apps|datasets/permission-keys/batch` | 批量版资源域权限 |
| `GET /rbac/apps|datasets/whitelist/resources` | 白名单扫描 → `unrestricted`/受限 ids（**列表页可见性过滤关键路径**，被 app/dataset 列表、explore 隐式依赖） |

### P3 — 访问矩阵与绑定（最重，~20 个）

matrix（app/dataset/workspace 级）、whitelist get/replace、user-access-policies get/replace、role-bindings/member-bindings 系列、lock/unlock、creator-member-bindings sync。DTO 契约：`Role/AccessPolicy/AccessMatrixItem/MyPermissionsResponse` 字段以 `web/models/access-control.ts` 为准（注意容错点：空列表给 `[]`、缺 policy 的矩阵项会被过滤）。

## 5. check-access 本地判定算法（含组织级并集）

```
输入：tenant_id, account_id, scene, resource_type?, resource_id?
（maintainer 短路在装饰器层，common/wraps.py:110，不在此）

1. U_org  = 组织级角色（scope=organization 绑定）权限并集   ← 流 B 启用后生效
   U_role = 该 tenant 空间级角色权限并集
   内置 owner 角色 → 直接 allow
2. workspace 级：scene ∈ U_org ∪ U_role ?
3. 资源级（app/dataset + resource_id）：
   a. 白名单：specific 且不在列 → deny；only_me 且非 maintainer → deny
   b. P = (资源 × 成员/其角色) 显式绑定 ∪ workspace 级默认策略绑定
   c. scene ∈ (U_org ∪ U_role ∩ 资源域键) ∪ (⋃ P.permission_keys)
4. ABAC 过滤（可选增强）：命中 deny_tags / :own 约束 → deny
```

**语义校准**：企业后端合取/析取语义是黑盒，此基线必须用合同测试 + QA 真账号矩阵校准。
**键格式映射**：角色/策略的 permission_keys 与快照用点分格式（`app.acl.preview`），check-access 入参 scene 用下划线格式（`app_view_layout`，`RBACPermission` 枚举值）——判定层必须做 scene→键 映射，这是接口契约里容易漏的一点。
**缓存**：请求级 memo + Redis（`rbac:perm:{tenant}:{account}`，TTL 30-60s，写操作按 tenant 失效）。

## 6. 流 B：组织级与跨空间管理

### 6.1 系统管理员（原"部署管理员"，定名）

- **命名**：统一为「系统管理员」（`SYSTEM_ADMIN_EMAILS` / `is_system_admin` / `@system_admin_required`）。
- **账号与密码**：不是独立账号体系——普通账号 + 提权标记，密码走现成流程（首账号 `/install` 设置、其他人邀请激活/重置密码），无独立密码通道。
- **多位配置**：env 名单逗号分隔 / `is_system_admin` 列多行，均天然支持；**建议至少两位**防单点；移除即时生效（判定在每请求装饰器）。
- **判定（推荐组合）**：`account.email ∈ SYSTEM_ADMIN_EMAILS`（env 静态兜底，**仅存量升级场景实际生效**，新部署名单为空）**或** `account.is_system_admin`（持久化标记，/install 置位 + 邮箱邀请授予为主通道；二期可转组织级角色绑定）。
- **/install 改造**（小）：`RegisterService.setup()`（`account_service.py:1938`）里把首账号 `is_system_admin` 置位——装完即用、避免名单漏配导致无管理员；置位需落在 setup 自带的失败回滚范围（删 DifySetup/Join/Account/Tenant）内。/install 页面不加 UI 字段。
- **/install 一次性**：`POST /setup` 有 `SetupAlreadyCompletedError` 保护（`console/setup.py:66-105`），只建一个账号 + 一个工作空间；`GET /setup` 返回 not_started/finished。多 tenant 不走 /install，走 admin 端点。
- `INIT_PASSWORD` 是 `/install` 访问口令（`wraps.py:321`），与管理员密码无关。
- 前端显隐：`/account/profile` 返回 `is_system_admin`（账号属性随身份接口下发；system-features 不动）。

**系统管理员的授予与撤销**（多位制，无"转让"概念--授予 B + 撤销 A 即完成交接；2026-08-30 修订：授予改为**邮箱邀请制**，QA SMTP 已就绪）：

- 端点：`GET/POST /admin/system-admins`、`DELETE /admin/system-admins/<account_id>`（@system_admin_required）。
- **授予流程（邮箱邀请制）**：操作者输入目标邮箱 + **当前账号密码确认**（验证操作者身份）--邮箱**已注册且 active**：直接置 `is_system_admin` + 发通知邮件，即时生效；邮箱**未注册**：**PENDING 预创建**（复用 `invite_new_member` 的 register(status=PENDING) 路径，`account_service.py:2048`）+ 发邀请邮件（链接 `/activate?token=...`，复用 `send_invite_member_mail_task`，`tasks/mail_invite_member_task.py:15`）-> 收件人设密码激活 -> `is_system_admin` 已预置 -> 首登走「无空间管理员放行」分支直达 `/admin`。**新增系统管理员邀请 token 类型**（无空间绑定：现有 token 绑 workspace_id，系统管理员无空间）。
- 授予约束变更：放开「不预创建」（原防占位提权改由邀请 token 时效与一次性保障，既有机制）；密码确认保留（操作者身份验证）与邮件验证（接受者身份验证）**不互斥，两者都要**。
- **邮件失败降级**：SMTP 不可达/发信失败不阻塞授予--落审计「邀请已创建、邮件发送失败」-> 控制台在授予结果处**展示邀请链接供 admin 手动转交**（复制粘贴）。
- 撤销约束：**最后一位不可撤销**（防系统锁死）；允许撤销自己（剩余 ≥1）；PENDING 未激活的邀请账号可撤销（等同作废邀请）。
- env 名单与 DB 标记是**并集**：名单来源者控制台不可撤（UI 标注"来自环境变量"）。**env 兜底降级为存量升级通道**--新部署全程 env 无关（/install 直接置位）；仅已跑过 /install 的旧部署升级时靠 env 名单或 CLI grant 注入首位管理员。
- CLI 通道：`flask system-admin grant/revoke <email>`（救急/自动化）。
- **存量部署升级**：已跑过 /install 的部署没有再初始化通道，升级后首位系统管理员靠 env 名单或 CLI grant 注入。
- 二期转组织级角色后：即 `rbac_member_role_bindings` 的 organization 行增删。

### 6.1.1 bootstrap：/install 瘦身为系统管理员初始化（已定方案）

**目标形态**：

```
/install
  └─ 建系统管理员账号（email+密码，is_system_admin=true，不建 tenant）
  └─ 写 DifySetup（关闭安装页，逻辑不变）
首次登录
  └─ login 工作空间预检：无空间但 is_system_admin → 放行（既有 "workspace not found" fail 分支，login.py:180）
  └─ load_user：无空间但 is_system_admin → 放行（不带 current_tenant）
  └─ 落地 /admin（系统管理页）→ 创建首空间 + 指定 owner → 后续空间全走这里
```

**改造点**：

| 位置 | 改动 |
|---|---|
| `RegisterService.setup()`（`account_service.py:1938`） | 建账号 + 置 `is_system_admin`；**去掉** `create_owner_tenant_if_not_exist` 调用；DifySetup/回滚/遥测保留（回滚范围相应无 tenant/join） |
| `load_user`（`account_service.py:321`） | 加窄分支：无可用空间 && `is_system_admin` → 放行（current_tenant 为空）；其他情况维持现状（无空间普通账号仍返回 None/401，不建立可用会话）——**热路径，窄分支 + 回归测试**（有空间账号行为不变） |
| login 工作空间预检（`console/auth/login.py:180`） | **必改（易漏）**：既有逻辑 `get_join_tenants` 为空 → 直接返回 fail（"workspace not found, please contact system admin…"），瘦身后**首登系统管理员会被拒在登录层、到不了 load_user**——该分支需加 `is_system_admin` 放行；无空间普通账号**复用该 fail 响应**，前端把文案呈现为引导提示。`get_join_tenants` 只统计 NORMAL 租户（`account_service.py:1404`），归档唯一空间的成员同样落此分支 |
| 无空间的请求面防护 | 普通 console 接口假定 `current_tenant` 存在——系统管理员只允许访问 `/admin/*`（`@system_admin_required` 不依赖 tenant）；误入普通接口需返回明确错误而非 NPE |
| 前端登录后路由 | 无空间 && 系统管理员 → `/admin`；无空间 && 非管理员 → 登录页呈现引导文案（联系管理员开通空间，复用 login fail 响应），不建立会话；`currentWorkspaceAtom` 为空时全局 providers 需兜底 |
| /install 页面 | 文案改为「初始化系统管理员」，不加字段 |
| 首空间创建 | `POST /admin/workspaces`（name + owner_email）：owner 已注册→直加并置 owner；未注册→PENDING 预创建（复用邀请状态机） |

**被否的替代**：CLI bootstrap（`flask bootstrap-admin`）——失去网页初始化入口，仅在未来需要全自动化部署时再补。

### 6.2 管理端点（`/console/api/admin/*`，全写审计）

| 端点 | 说明 | 复用 |
|---|---|---|
| `GET /admin/workspaces` | 全空间列表/搜索/分页 | 现有 `all-workspaces` 查询 |
| `POST /admin/workspaces` | 创建空间+指定 owner；未注册邮箱走 PENDING 预创建（复用邀请状态机） | `create_owner_tenant()` |
| `POST /admin/workspaces/<id>/archive|unarchive` | 停用/启用（**一期不做物理删除**，级联风险） | `Tenant.status` + 既有登录切换（`account_service.py:321`） |
| `GET/POST /admin/workspaces/<id>/members`、`PUT/DELETE .../members/<mid>` | 成员查看/直加/改角色/移除 | `TenantService`/`RegisterService` |
| `GET/POST /admin/system-admins`、`DELETE /admin/system-admins/<id>` | 系统管理员授予/撤销（约束见 §6.1） | `Account` 标记列 |
| `GET /admin/audit-logs` | 按 workspace_id/action/actor/时间过滤 | `admin_audit_logs` |
| `GET/POST /admin/integration-grants`、`PUT/DELETE /admin/integration-grants/<id>` | 插件托管运营：列表/改范围/升级/回收（扇出为异步任务、失败空间可重试）。**无「分配」独立动作**--安装表单即选范围，分配退化为改范围编辑。**回收拆两动作**：解除托管（即时删 grant、无波次）与回收（active→recycling→卸载波→删） |
| `POST /admin/integration-grants/<id>/push` | 升级波触发（对齐 grant.version 的收敛波，方向无关：升级/回滚/修漂移同一动词；波次机制名保留 push 语义，`last_push_at` 含回滚与漂移修复波次） | 复用 `PluginService.upgrade_plugin_with_marketplace/github` 现成静态链（显式传 tenant_id） |
| `POST /admin/integrations/install` | 插件中心安装（市场/GitHub/本地包三源 + 范围选择，默认 scope=all） | 同上；本地包上传需**代理租户**（admin 无租户身份，上传路由为 tenant 域，跨租户从 identifier 复用安装未经实测，排期留半天 PoC） |
| `GET/POST/PUT/DELETE /admin/organization-credentials` | 组织级凭据 CRUD（掩码只进不出）。**范围与插件分发解耦**：凭据分派独立成流，不挂 integration_grants 范围（详见 §6.4） | `ProviderManager` |

### 6.3 审计采集

`audit_log(action, target, ...)` 工具函数统一埋点：admin 端点全量 + 关键业务动作（成员增删改、空间归档、凭据变更）。**先采集后查看**，顺序不可反。

### 6.4 集中凭据与插件托管（**已提入一期**，2026-08-26 用户决策；**一期收窄为全量组织统一**，2026-08-27 用户决策；2026-08-30 修订：加密锚点方案 A、显式分派模型、插件托管动作模型定稿）

**组织级凭据（B-P5）**：组织级凭据表（`organization_credentials`，§3，含加密锚点方案 A）+ ProviderManager 解析链改造 + 掩码只进不出。**一期全部凭据项固定「组织统一」**：解析仅组织凭据（**无回退层**，一期不存在空间自有凭据概念），空间侧凭据区只读（"由组织统一配置"）、无编辑入口、不显示来源徽标。一期交付分派地基：**分派表（`provider_credential_assignments`）建表、读链路上线、值恒为 org、无写入口**--解析链「按分派读」的行为一期建好二期不动（热路径只有一个版本，全链路回归只跑一次），二期开放自配为纯增量（写入口 + UI）。**动运行时热路径，须带模型调用全链路回归**，企业版已有接缝可参考（`ENTERPRISE_DISABLE_RUNTIME_CREDENTIAL_CHECK`、`tool_manager.py`/`model_manager.py` 的 credential policy 检查）。UI 落在系统管理控制台「模型提供商」页（设计稿 §4.7）。

**显式分派模型（替代原回退式策略，2026-08-30 定稿）**：二期开放「空间自配」时，**不做隐式回退链**（原「空间自有 > 组织」优先级），改为**显式分派指针**--每个 (provider_name, tenant_id) 一行 `assignment(org/self)`，切换 = 改指针 + 失效该空间解析缓存，解析按分派直查单条、无优先级规则。理由：① 回退破坏锁定的可判定性（「该空间在用哪份」需追优先级规则，凭据失效排查不可判定）；② 遮蔽语义与回退语义叠加后状态空间膨胀且无 UI 能讲清；③ 组织管理叙事是「谁说了算」的显式声明，隐式回退是多租户原生思路。**策略粒度收敛 provider 级**（不做 model 级：撞 load balancing 的 `CredentialSourceType` PROVIDER/CUSTOM_MODEL 语义，场景罕见）。**凭据范围与插件分发解耦**：插件范围管「装不装」、凭据分派管「用哪份」，两维度正交（空间装了插件但走自配凭据是正常形态；MCP 凭据更无处附着插件范围）。遮蔽语义随指针模型自然消失（策略不在密文行上，切换不碰密文）。**一期边界**：分派表只读不被写、无分派管理 UI、无分派写 API、无按空间范围差异；一期 organization_credentials 仅覆盖模型/工具插件的 provider 凭据，MCP 凭据（`tool_mcp_providers.encrypted_credentials`）一期维持空间自管。OAuth 类（数据源/部分触发器）组织代授权与触发器订阅共享为二期，二期复用同一分派模型（token 归属 = 分派指针）。

**插件托管与收口（B-P4，同期纳入，设计稿 §4.6/§4.8）**：托管记录（`integration_grants`）+ 逐 tenant 扇出（复用现有安装链）+ 新建空间自动安装钩子。`TenantPluginPermission.install_permission` 一期收紧为 noone：**存量空间批量迁移 + 新建空间默认 noone**（改 `server_default` 或建空间钩子；现默认 everyone，见 `api/models/account.py:389`，不改则新空间回到全员可装）。空间侧「托管态」判定以 `integration_grants` 为唯一真相：插件 × 本租户命中分发范围即视为托管（锁定升级/卸载、不参与自动更新），与 daemon 侧安装记录通过 (tenant_id, plugin_id) 对应，不依赖 daemon 打标。

**空间侧封死的四道防线（均 api 层现成/低成本，daemon 无感、不兜底）**：① 手动升级端点（`console/workspace/plugin.py` 的 `/upgrade/marketplace|github`）挂 `plugin_permission_required(install_required=True)`，install_permission 收 noone 后天然全关；② **托管态拦截**补缝隙--install_permission 是空间 owner/admin 可改回的，console 升级/卸载端点前置检查命中 grant 即 403（防「改回 everyone 后自升已托管插件」）；③ **自动升级任务过滤**--`process_tenant_plugin_autoupgrade_check_task` 不走空间侧权限判定且 ALL 模式忽略 exclude 列表，逐租户豁免名单不可行，落点为 check task 组装完 plugin_ids 后查该租户命中 grant 减去托管项（一次查询、三种 mode 通吃）；`ENABLE_CHECK_UPGRADABLE_PLUGIN_TASK` env 开关留作部署层冗余（与 `MARKETPLACE_ENABLED` 联动注册，内网部署 beat 本就不跑）；④ **权限修改端点锁定**（2026-08-31 补，工作台 UI 评审发现）——①②③ 只管升级/卸载/自动升级，而 owner/admin 可经 `POST /permission/change` 把 install_permission 改回 everyone，安装端点（`/install/pkg|github|marketplace`、`/upload/pkg|github|bundle`）随之重开，空间可自装非托管插件绕过收口；一期 `/permission/change` 直接拒绝修改 install_permission（403，提示由系统管理员托管；debug 权限维持默认「无人」同样锁改），单点锁定比给安装链逐端点挂拦截便宜。空间插件列表 UI 不显示升级入口与新版本徽标（`list_latest_versions` 在 marketplace 关闭时返回 None，内网天然无徽标）。

**admin 动作模型（四动词，2026-08-30 定稿）**：**装、升、改范围、回收**。无「分配」动作（安装表单即选范围，默认 scope=all 全组织含未来新空间；试点 = specific+清单；scope=all 与空 specific 语义不等价故并存）。改范围双向自由（试点是回环非单向漏斗；单向限制会删掉唯一 undo 路径--范围写错的纠正只剩回收重装，且上游卸载连带删工具凭据）。**统一警示原则**：意图驱动 + 静态警示 + 无动态门（无引用扫描），后果用点发现（`ToolProviderNotFoundError` + 编辑器标红）；社区版卸载链本无使用检查（`try_pre_uninstall_plugin` 为企业版行为），破坏半径信息有廉价一阶版本（grant 范围内空间数）。

| 动作 | 确认框 | 静态警示 | 波次 |
|---|---|---|---|
| 安装（源+版本+范围） | 无 | 无 | 安装波（表单提交即扇出） |
| 改范围（扩围） | 无 | 无 | 增量安装波（保存即波） |
| 改范围（收缩） | 无 | 事前 toast（"范围外空间若正在使用将无法运行"）+ **reason 必填**进审计 + 被移除空间通知 | 卸载波 |
| 升级（含回滚/修漂移） | 有（**动态副文案显式目标版本**："将 N 个空间升级到 vX" / "回滚到 vY"） | 有 | 收敛波（显式按钮触发，方向无关） |
| 解除托管 | 有（轻量） | 无 | 无波（即时删 grant，插件留在各空间，安全阀） |
| 回收 | 有（静态警示"正在使用的应用将无法运行"） | 有 | active→recycling→卸载波→删（防孤儿：波次部分失败时 grant 仍在、可重试） |

**升级波语义（双向收敛）**：漂移定义为「≠ grant.version」而非「>」--含收编瞬间存量漂移（某空间已自动升到 v2、grant 定 v1，扇出需能降回）。上行复用 `upgrade_plugin_with_marketplace/github` 现成链（含包下载/上传/缓存失效，静态方法显式传 tenant_id，admin 扇出直接可用）；**下行（回滚）走卸载+重装链**，daemon upgrade 端点无降级路径上游测试背书，不指望其双向通用。回收波沿用上游 uninstall 默认连带删该空间此插件工具凭据的行为（回收语义正确；副作用：重新托管需重配工具凭据，记录在案）。

**扇出与竞态闭合**：安装/卸载波幂等为 daemon 白送（已装返回 `AllInstalled` 跳过、卸载查无记录返回 success，重试安全，diff 不需精确）；新建空间钩子补未来（建空间事务后查 scope=all 的 grants 补装）、grant 扇出扫描补存量，**两个方向各盖一头、竞态闭合**，无分布式锁。对账为管理台手动触发的「一致性检查」（拉 daemon `list_plugins` × grants 比对 drift 报告），不新增常驻 beat 任务。

**MCP/OpenAPI 连接实例不纳入托管**：连接实例型（URL+auth+schema 一体，无"插件包+凭据"分离结构），不适用扇出与策略模型，一期维持空间自建。组织级 MCP 若做，形态为**目录/白名单模型**（管理员登记可信 MCP 服务器，空间从目录选择、不得任意填 URL）而非扇出模型，二期独立特性立项。三条线正交：**插件（包+版本+范围，扇出模型）/ 凭据（provider × 分派，指针模型）/ MCP（实例+目录，白名单模型）**，不互相从属。

### 6.5 前端

头像菜单「系统管理」入口 + 空间列表页 / 空间详情抽屉（成员、归档）/ 创建空间弹窗 / 审计日志页。服务层仿 `web/service/access-control/`。

## 7. seeding、迁移与严格切换

- **内置角色**（is_builtin）：owner/admin/editor/member/dataset-operator，权限点从 `_LEGACY_*_KEYS`（`rbac_service.py:306-493`）转置生成，保证与旧角色语义等价。
- **内置访问策略**：按 resource_type 的 `default`（全资源域键），支撑新建资源默认全员可见（替代 `initialize_created_app_rbac_access_task` 的企业依赖）。
- **Catalog 文案**：`core/rbac/catalog.py` 双语 dict（企业后端按 language 返回文案，本地自建）。
- **迁移命令**（`flask rbac-local-migrate`，参考 `api/commands/rbac.py`）：seed → 存量成员按固定角色绑定内置角色 → 存量资源白名单 scope=all → dry-run + 按 tenant 灰度。
- **回滚**：`RBAC_ENABLED=false` 即回固定角色模型，本地表保留无副作用。

## 8. 配置项

| env | 默认 | 说明 |
|---|---|---|
| `RBAC_ENABLED` | false | 总开关（上游语义不变） |
| `RBAC_BACKEND` | `enterprise` | `local` 启用本方案 |
| `RBAC_LOCAL_CACHE_TTL_SECONDS` | 30 | 判定缓存 |
| `SYSTEM_ADMIN_EMAILS` | 空 | 系统管理员名单（流 B 一期） |
| `MARKETPLACE_ENABLED` | true | 插件中心市场源开关（沿用现有配置；QA 内网不可达可关，走本地上传） |
| `MARKETPLACE_API_URL` | `https://marketplace.dify.ai` | 市场地址（沿用现有配置；内网部署指向镜像） |

## 9. 测试与验收

- 单测：check-access 判定矩阵（组织级∪空间级 × 策略 × 白名单 × maintainer × own 约束）；流 B 补 login 预检与 `load_user` 窄分支（有空间不变 / 无空间管理员放行 / 无空间普通账号 fail）。
- 合同测试：45+ 端点按 §4 DTO 契约做 schema 断言（前端 `normalizers.ts` 容错点作反向用例）。
- QA 回归：admin/editor/normal 三类账号走查应用/数据集列表、插件、成员管理；「角色与权限」「权限集」tab 全功能；非系统管理员访问 `/admin/*` 全 403；归档空间后成员登录自动切换（多空间）或明确失败提示（唯一空间）。
- 流 B QA：插件三源安装与扇出（失败空间可见可重试）、新建空间自动安装、空间侧锁定与安装权限收口（含新建空间默认 noone、四道防线逐条验证：`/permission/change` 锁改 install_permission 返回 403、改回 everyone 后自升被 403（④锁定后该路径仅作纵深验证，②兜底存量/异常权限值）、自动升级任务过滤托管插件）、改范围双向与升级/回收波次；组织凭据配置后模型调用全链路（对话/补全）与变更缓存失效、分派表读链路在真实流量下烤一个周期；登录三分支（无空间管理员 -> `/admin`、无空间普通账号 -> 引导提示、有空间账号不变）+ **第四分支：邮箱邀请的管理员**（未注册邮箱 -> PENDING 预创建 + 邀请邮件 -> 激活设密码 -> 首登直达 `/admin`；激活前登录被拒走激活流程，不走管理员放行）；管理员授予两路径（已注册直效/未注册邀请）与邮件失败降级（控制台展示邀请链接手动转交）。
- ABAC 资源标签（可选增强）：`apps/datasets` 加 sensitivity_tag + 策略 deny_tags + 判定断言；不做 PDP/多因子。

## 10. 分阶段交付（两流整合）

| 阶段 | 流 | 内容 | 工作量 |
|---|---|---|---|
| A-P0 | A | 表结构 + 迁移 + `RBAC_BACKEND` 分发骨架 | 1 |
| A-P1 | A | CRUD 组 + catalog + seeding + 迁移命令 | 3 |
| A-P2 | A | 判定组（check-access/my-permissions/batch/whitelist-resources）+ 缓存 | 2-3 |
| A-P3 | A | 矩阵/绑定组 | 3 |
| A-P4 | A | 合同测试 + QA 回归 + 灰度 | 2 |
| B-P0 | B | 名单 + 装饰器 + 前端显隐 | 0.5 |
| B-P1 | B | admin 端点组 + 审计表与埋点 + **/install 瘦身与 login/load_user 分支** | 3-4 |
| B-P2 | B | 系统管理前端（含无空间落地路由） | 2-3 |
| B-P3 | B | 组织级角色并入（依赖 A-P2） | 1-2 |
| B-P4 | B | **插件托管 + 插件中心**（提入一期，2026-08-26：三源安装、扇出/重试、空间侧三道升级防线、新建空间自动安装钩子、`TenantPluginPermission` 收口、四动词动作模型与 recycling 状态；含本地包代理租户 PoC 0.5 天） | 4-6 |
| B-P5 | B | **组织级凭据**（提入一期、一期全量组织统一：表 + 加密锚点方案 A + 分派表地基（只读恒 org）+ 解析链 + 空间侧只读 + 缓存失效） | 4-6 |
| **合计** | | | **约 25-33 人日**（两流可并行，A-P2 是最长链） |

交付顺序建议：**两流独立，B 可完全先行**——B-P0~P2（约 5.5-7.5 人日）只依赖现有 TenantService，得到系统管理 UI + 审计；**插件托管与插件中心（B-P4）、组织级凭据（B-P5）已提入一期**（约 8-12 人日：B-P4 依赖插件安装链，B-P5 动 ProviderManager 热路径，两者可并行），**流 B 一期合计约 14-20 人日**；「组织级角色」（B-P3）才依赖 A-P2 的表与判定链。A-P2 完成即具备严格切换能力；A-P3 补全矩阵 UI。衔接点无沉没成本：`@deployment_admin_required` 先按 env 名单判定，流 A 落地后迁到组织级角色，判定逻辑不变只换数据源。

## 11. 风险与对策

| 风险 | 对策 |
|---|---|
| 企业后端语义黑盒 | 合同测试锚定前端行为；QA 真账号矩阵；判定函数单文件集中 |
| 上游 rebase 冲突 | 改动收敛 `_inner_call` 分发 + 新文件 |
| check-access 热路径性能 | 双级缓存；写按 tenant 失效 |
| 列表可见性过滤遗漏（whitelist_resources 被列表页隐式依赖） | A-P2 优先；回归覆盖列表页 |
| 严格切换误锁 | 迁移先 dry-run；`RBAC_ENABLED=false` 一键回滚 |
| 判定漏收口（组织级并集） | 只注入三个收口点（check-access / check_member_permission / whitelist_resources）；合同测试覆盖 |
| 直加成员绕过邀请 | admin 端点名单限定 + 审计全记录 |
| 归档误操作 | 二次确认 + 审计；不做物理删除 |

## 11.5 附：后期升级为模型 B 的可行性分析

> 2026-08-27 评估。结论：**可行，A 的投入零返工**。仅为可行性记录，不构成一期的约束约定。

**平滑项**（A 产出全部保留生效）：新表预留 `organization_id` 可空列则升 B 只回填不改结构；`organizations`/`organization_members` 纯新增；`tenants.organization_id` 加列 + 存量归默认组织一条迁移；`is_system_admin` 直接映射平台超管；admin 端点路由不变只加过滤层；前端 /admin 独立 layout 不变、组织切换器为纯增量。

**摩擦项**（三个，均可控）：① "组织级凭据"语义迁移——A 里是部署级（tenant_id 空），升 B 时需决定存量归属（B1 归默认组织 / B3 升平台凭据）；② 插件托管 `scope=全部空间` 需归到组织维度；③ 术语——A 阶段"组织级"实为部署级，升 B 时全局改术语（平台级/组织级）。

**成本**：升 B 增量 = B 文档所列 11-14 人日（B1）/ 更多（B3），A 的代码无返工项。

## 12. 关键代码位置

- 替换点：`api/services/enterprise/rbac_service.py:715`（`_inner_call`）；legacy 映射 `:306-493`（内置角色数据源）；DTO `:74/114`
- 权限点枚举：`api/core/rbac/entities.py:24`；判定装饰器：`api/controllers/common/wraps.py:19-120`
- 控制器：`api/controllers/console/workspace/rbac.py`（约 30 端点）
- 隐式调用方：app 列表 `controllers/common/app_access.py:82`、dataset 列表 `console/datasets/datasets.py:458-467`、建资源授权 `tasks/initialize_created_app_rbac_access_task.py`、成员生命周期 `services/account_service.py:1365/1849/1890/2114`、迁移参考 `api/commands/rbac.py`
- 流 B 复用：`TenantService.create_owner_tenant`（`account_service.py:1327`）、归档切换 `:321`、机器管理员通道 `console/admin.py:11` + `ext_login.py:73`
- 流 B bootstrap 与插件/凭据：`RegisterService.setup`（`account_service.py:1938`）、login 工作空间预检（`console/auth/login.py:180`，`get_join_tenants` 只统计 NORMAL 租户）、插件安装链 `api/core/plugin/`（daemon 租户级安装）、`TenantPluginPermission`（`api/models/account.py:389`，`install_permission` 默认 everyone 需收口为 noone）
- 前端契约：`web/models/access-control.ts`、`web/service/access-control/`
