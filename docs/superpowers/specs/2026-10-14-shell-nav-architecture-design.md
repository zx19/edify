# 路由与导航架构设计

2026-10-14 | 状态：待评审 | 触发：批 0 评审期用户指出「路由架构应先设计，每页都要壳」

> **定位**：三壳（工作台/admin/详情）散装约定的统一收口。本文档是壳层与导航的唯一事实来源；与 2026-08-28 工作台设计 §2 冲突处以本稿为准。
> **铁律**：壳层是**呈现层新写**（新组件、新实现），不是搬旧轨 header/sidebar 改色。保留的是信息架构与交互范式（QA 实证），代码零搬运。

## 1. 壳层体系（三层 + 一个界外）

| 壳 | 用在 | 视觉皮 | 现状 |
|---|---|---|---|
| **L0 全局壳（工作台）** | 主页/工作室/Agents/知识库/Skills/集成 | 默认（白黑橙） | 8-28 设计有稿未实现 |
| **L1 详情壳** | 应用详情（编排/访问点/日志/标注/监测）、知识库详情；workflow 编辑器是 L1 的画布特例 | 默认 | 9-04 全屏决策，未实现 |
| **L2 admin 壳** | /admin/* | `.admin-theme` | M4 已实现（独立 AdminShell，本稿收编） |
| 界外：webapp 壳 | /chat/\* 等终端用户页 | `.webapp-theme` | 已重写，自成体系，不入壳族 |

**壳组件一套、主题不同皮（2026-10-14 用户拍板）**：实现一个壳组件族，三处复用：

```
<AppShell>            骨架：侧栏 + 主区（无顶栏；顶栏属于页面或 L1）
  <ShellSidebar>      侧栏容器（展开 228px / 收起 56px 图标轨，头部含收起钮）
    <ShellBrand>      logo + 空间切换器位（L2 为「系统管理」标识）
    <ShellNav>        导航列表（见 §3 菜单规范）
    <ShellAccount>    底部账号区（头像+名+菜单）
<AppShellTopbar>      L1 详情壳顶栏（状态/操作区，编辑器顶栏是其特例）
```

皮经作用域类切换（`.admin-theme` 已有先例）：组件结构一致，token 随皮变。

## 2. 路由 URL 架构

**路由组与壳的映射**（壳随路由组，不是页面内状态）：

```
app/
├─ (commonLayout)/        → L0 全局壳
│   ├─ page.tsx           /            主页
│   ├─ apps/              /apps        工作室
│   ├─ agents/ skills/ datasets/ integrations/ ...
│   └─ app/(appDetailLayout)/[appId]/  → L1 详情壳（嵌套组）
│        ├─ workflow/     编排（编辑器）
│        ├─ access-point/ logs/ annotations/ overview/
│   └─ datasets/[id]/(…)               → L1（知识库详情同族）
├─ admin/                 → L2 admin 壳
│   ├─ layout.tsx         AdminGuard → AppShell(.admin-theme)
│   └─ workspaces/ members/ admins/ audit-logs/
└─ (shareLayout)/         → webapp 壳（界外）
```

规则：
1. **详情全屏是壳态，跟路由组走**：进入 `(appDetailLayout)` 即隐藏全局侧栏、挂应用内侧栏；「‹ 返回」回来源页并恢复 L0（9-04 决策的落地机制）
2. **URL 层级**：资源详情一律 `/app/[id]/<pane>`、pane 名用英文小写单数族（logs/annotations/overview/access-point/workflow）；新建路由进组前先对本文档
3. **旧 URL 兼容**：废弃路由在 next.config `redirects()` 集中登记（已有 `/explore/apps → /` 先例），不散落页面内
4. **双轨期**：新轨全套路由在 basePath（/lomva/v2）下同构；旧轨 /lomva 不动；basePath 由构建期 NEXT_PUBLIC_BASE_PATH 固化，路由代码零感知

## 3. 菜单呈现规范

**导航项解剖**：`icon + label + 可选徽标`（徽标仅 beta/计数两类，禁文字长标签）

**态**：
- default：`text-2`；hover：浅灰底；active：浅橙底 + 橙字（`accent-soft/accent-deep`）+ `aria-current="page"`
- 收起态（56px）：icon-only + tooltip（title 语义）；分组小标题隐藏
- 焦点可见性：焦点环保留（lomva-ui 口径）

**分组**：组小标题 11px uppercase 灰（如 WEB APPS）；组可折叠（chevron，状态记忆在用户偏好）；组间分隔用留白不用线

**子 menu（内联展开组，2026-10-14 拍板）**：有子页面的导航项原地展开子项（子项缩进一档、无 icon、label 小半号），如「集成 ▸ → 模型供应商 / 工具 / Agent 策略」；与 WEB APPS 动态组共用同一「组」机制（展开态记忆）。**8-28 设计的「集成二级侧栏」范式退役**——全侧栏一套组规则，少一套范式。三级（工具页内 tab）仍用 segmented/tabs，不进侧栏。

**面包屑（2026-10-14 拍板）**：
- **L1 详情壳**：顶栏左侧 `‹ 工作室 / 测试1 / 编排`——返回与路径合一（点上级段回上级页，点 ‹ 回来源页）
- **L0 二级及以上页面**：面包屑在页面内 header 左侧（L0 无顶栏）
- 两级以内不出（详情 pane 已有内侧栏承载）；三级及以上（知识库 > 数据集 > 文档 > 分段）必须出
- 末段为当前页（非链接、主文字色）；中间段可点（次文字色，hover 加深）

**入口显隐**：由权限/功能开关驱动（如「系统管理」按 `is_system_admin`）；隐藏即不渲染，不做 disabled 灰显

**壳层 a11y**：侧栏 `<nav>` landmark、当前页 aria-current、收起/展开钮有 aria-label 与 aria-expanded

## 4. 各壳导航内容（功能集照 8-31 去留拍板）

- **L0 工作台**：主页 / 工作室 / Agents(beta 徽标） / 知识库 / Skills / 集成（可展开组：模型供应商/工具/Agent 策略）；WEB APPS 组（已安装应用列表 → `/installed/[id]`)；底部账号区（含「系统管理」入口项，is_system_admin 显隐）。**Marketplace 无一一级入口**（8-31 拍板）
- **L1 详情壳**：返回（‹）+ 应用标识（icon/名/类型徽标）+ pane 导航（编排/访问点/日志/标注/监测）+ 底部账号区；侧栏可收起为图标轨
- **L2 admin 壳**：品牌位=「系统管理」+ 四页导航 + 底部账号区（含登出）；无空间切换器

## 5. 迁移与收编

1. M4 的 `AdminShell/AdminSidebar` 重构为壳族 L2 用法（结构换组件，视觉不变）——随首个 L0 实施批次同做，防双份漂移
2. 旧轨 `web/` 的 header/sidebar 代码零搬运；web-new 里 fork 拷贝的旧壳组件随各页面单元替换，收口期删净
3. 工作台设计（8-28）§2 的 IA 表并入本稿 §4；其 mockup 的侧栏视觉继续有效

## 6. 验收

- 壳组件族：单测（显隐/收起/aria)+ storybook 三壳各一实例
- 走查：L0 主页、L1 应用详情、L2 admin 各一页，展开/收起/返回三动作
- 路由：旧 URL 重定向登记齐全；双轨 /lomva 与 /lomva/v2 同构可验
