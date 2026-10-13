# 问题定位：无空间系统管理员 profile 500(2026-10-13)

## 概要

QA 环境(edify-4)无空间系统管理员账号登录后,`GET /console/api/account/profile` 返回 **500**,
导致新轨控制台对该类账号整体不可用(守卫拿不到 `is_system_admin`,页面白屏/报错)。

发现路径:M4 /activate 接缝全链走查(本机 :3001 新轨 + QA 后端)时,以 `m4-admin@xingshulin.com`
(授予来源、零空间)登录,profile 稳定 500。

## 根因

`console_account_admission(require_tenant=False)` 的**账号解析**走了无空间变体
(`current_account_with_tenant_optional`,容忍 `tenant_id=None`),但同一装饰器栈里的
**初始化检查**仍套用 `account_initialization_required` ——其内部经 `current_account_with_tenant()`
**硬断言租户存在**,无空间账号在此抛错,Flask 兜底成 500。

即:准入声明「不要求学 tenant」与初始化检查「硬断言 tenant」语义矛盾,两条路径在栈内打架。

## 为何测试没拦住

T 系列后端落地时,admin 端点组的单测把 `account_initialization_required` 等准入装饰器
**整体打桩**(`side_effect=lambda view: view`),只测了业务逻辑——「声明 require_tenant=False
的端点在真实装饰器栈下是否真放行无空间账号」这一层从未被测。QA 真实账号冒烟才暴露。

## 修复(commit `ce63498f9c`,已随 edify-5 上 QA)

1. `controllers/console/wraps.py` 新增 `account_initialization_required_allow_no_tenant`:
   仅查登录态 + 初始化状态(`AccountStatus.UNINITIALIZED` 仍拒),不触碰租户。
2. `flask_admission.py`:`require_initialized` 分支按 `require_tenant` 分流——
   `True` 用原变体(租户硬断言保留,语义不变),`False` 换无空间变体。
3. 回归锁:`TestRequireTenantFalseRealInitCheck` 两用例**不打桩 init 检查**——
   无空间 active 准入且严格解析器零调用 / 无空间 UNINITIALIZED 仍拒。
   既有两用例补 `wraps.current_account_with_tenant_optional` patch 走真链。

验证:`-k` 目标子集 70/70 绿;QA edify-5 部署后 curl profile → 200,双字段正确下发;
浏览器端无空间管理员登录 → 兜底跳转 → `/admin` 全链闭环。

## 教训

1. **准入/守卫类装饰器栈,至少各留一条「全真链」用例**(只打桩请求/上下文解析,不打桩栈内
   装饰器本身)。纯 mock 栈内件的测试对「装饰器组合语义矛盾」零检出力。
2. **新准入语义(require_tenant=False 这类)落地即配冒烟账号**。本例若 T 系列验收时就备有
   无空间管理员 QA 账号,bug 不会活到 M4 走查。
3. 受影响面自查口径:凡 `console_account_admission(require_tenant=False)` 的端点都踩同一坑
   (当时仅 profile 一处使用该声明,修复即全覆盖)。
