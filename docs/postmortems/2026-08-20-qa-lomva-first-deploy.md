# qa-ai-lomva 首次部署排障记录（2026-08-19 ~ 08-20）

QA 环境（https://qa-xai.xingshulin.com/lomva，命名空间 qa-ai-lomva）从零拉起过程中
连环暴露的问题与修复，按发现顺序记录。所有修复均以 commit 固化，本文只留结论与机制。

## 存储层

### RWO 共享盘跨节点 Multi-Attach 死锁
`lomva-app-storage` 被 api / api-websocket / worker 三个 Deployment 共挂，RWO 云盘只允许
单节点挂载。三个副本被调度到不同节点时，后到的 pod 永远等不到 attach（卡 Init，
K8s 不会自愈重新调度）。
**修复**：app-storage 改用 CFS（ReadWriteMany，qa-cfs / prod-cfs），其余 PVC 仍用 CBS。
多副本扩容前应迁移到对象存储（opendal s3 + COS）。

### qa-cbs 随机选区
共享的 qa-cbs 为 Immediate 绑定、供给时随机选可用区，两次落到内存过载的 ap-beijing-7
导致 pod 无法调度（`Exceed overload threshold` + `volume node affinity conflict`）。
当时用重删 PVC 重试落回 -6 区；多 AZ 的 prod 集群应建 WaitForFirstConsumer 的 SC。

## 配置层

### CONSOLE_API_URL 缺失 → cookie 前缀不一致 → CSRF 401 死循环（最隐蔽）
- overlay 未显式配置 `CONSOLE_API_URL`，api pod 落到镜像默认 `http://127.0.0.1:5001`
- `is_secure()` 因此为 False，API 下发的 cookie 名不带 `__Host-` 前缀
- web 侧按自己的 https 判断读 `__Host-csrf_token` → 名字永远对不上 → CSRF 头缺失
  → profile 恒 401 → `/lomva/` ⇄ `auth/refresh` 无限重定向
**修复**：public-urls.env 显式配置 https 的 CONSOLE_API_URL（qa/prod 都加了）。
**教训**：API 的 `is_secure()` 同时决定 cookie 的 `Secure` 属性与 `__Host-` 前缀，而前缀
必须与 web 侧 `CSRF_COOKIE_NAME()` 的判断一致，任何一侧 URL 配置不对齐就静默死循环。

### 外部 PG 掐空闲连接 → flask-login 吞异常误判 401
自建 PG（qa-postgres-default.xsl.link）会掐空闲 TCP 连接，连接池
`SQLALCHEMY_POOL_PRE_PING=false` 时池内留着死连接。死连接上的异常发生在 flask-login
request_loader 内部时被吞掉、按"未登录"处理 → 偶发 401/500，与上一问题叠加放大了
排查难度。
**修复**：`SQLALCHEMY_POOL_PRE_PING=true`（qa/prod 都加了）。

## 镜像层

### fork 与上游镜像接口分叉 → 404
web 用自建镜像（z123x/lomva-web），api/agent-backend/local-sandbox 用上游
langgenius 镜像。fork 已有上游没有的接口（如 `/console/api/workspaces/current/summary`）
→ 页面 404。
**修复**：全部切换自建镜像（z123x/lomva-*:1.16.1-edify）。
**规则**：改 fork 代码后必须跑 `.github/workflows/lomva-build-push.yml` 重建全部镜像。

## nginx 子路径层（/lomva 尾斜杠连环坑）

Next.js `trailingSlash:false`，规范 URL 是 `/lomva`（无斜杠）；nginx 按有斜杠的
location 组织转发。两者对"该不该有尾斜杠"的相反预期引出四个问题：

1. **308⇄301 死循环**：Next 把 `/lomva/` 308 回 `/lomva`，nginx 目录式 301 又指回
   `/lomva/`。
2. **X-Forwarded-Proto 覆写**：nginx 用自身 `$scheme`(http) 覆写，web(Next) 据此生成
   http 绝对 URL → Mixed Content。
3. **301 绝对 Location 降级 http**：nginx 对 `/lomva`（无斜杠）生成
   `Location: http://.../lomva/`，fetch 跟随后被浏览器拦截（Mixed Content 的直接元凶，
   且 301 被浏览器永久缓存，修复后需手动清缓存）。
4. **plugin-daemon 301 丢前缀**：daemon 对 `/e/<单段>` 301 到 `/e/<id>/`，不带
   `/lomva`，浏览器跟随后 404。

**最终形态**（subpath/config/nginx/default.conf）：
- `location = /lomva` 与 `location = /lomva/` 精确匹配，两种形态都直接代理 web 的
  规范 URL，不发任何重定向
- map 透传 ingress 的 X-Forwarded-Proto（直连时回退 $scheme）
- `absolute_redirect off`（防御性，nginx 自身重定向一律相对 Location）
- `/lomva/e/` 加 `proxy_redirect /e/ /lomva/e/` 补回前缀
- 探针路径带 basePath（web/nginx 都是 `/lomva/`）

## 遗留问题（待办）

### 同域名新旧 dify 的 cookie 冲突（未修复）
qa-xai.xingshulin.com 根路径已有旧 dify 栈。两边同一套代码、同样在 https 下无
COOKIE_DOMAIN 时，cookie 名（`__Host-access_token` 等）、域、path(/) 完全相同，
**会互踢会话**。
方案（需改 fork 代码）：cookie path 按部署子路径（CONSOLE_API_URL 的路径前缀 /
web 的 basePath）隔离，path≠/ 时放弃 `__Host-` 前缀（规范不允许），依赖 RFC 6265
的 cookie 排序（更长 path 在前）实现自动遮蔽。

### 其他
- prod 部署前提：prod-cfs SC 存在；prod 集群若多 AZ 需 WFFC SC
- 浏览器侧故障期的 301 已被永久缓存，需各端清一次站点数据
