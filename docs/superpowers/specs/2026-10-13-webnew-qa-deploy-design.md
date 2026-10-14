# 新轨前端上 QA(并存子路径)设计

2026-10-13 | 状态:已拍板(用户两问后确认;路径形态 K 已拍板) | 前置:M4/M4b/3b 已合 main,QA 后端 edify-5

> **修正记录(2026-10-13 实施期实证)**:初稿路径形态为并列子路径 `/lomva-new`,首部署实测登录后 profile 401 全链崩——后端 cookie `Path=/lomva` 按**路径段**匹配,`/lomva-new` 的 `-` 不是 `/`,`document.cookie` 在新轨页面读不到 `csrf_token`,`X-CSRF-Token` 头发空(本后端 GET 也强制校验)。已拍板改 **K 案:新轨挪进 `/lomva/v2`**——被 `Path=/lomva` 天然覆盖,零后端改动,ingress 零新增。备选(后端双写 csrf cookie / csrf 改 Path=/)均有隔离或一致性代价,弃。

## 1. 目标 / 边界 / 成功标准

**目标**:web-new(新轨)以 `https://qa-xai.xingshulin.com/lomva/v2` 并存部署于 QA 集群,与旧轨共享同一后端,使新轨获得真环境(生产构建 + nginx ingress + 真实域名 cookie/CSRF)验收能力。

**不做**:
- 不整切(QA 旧轨 `/lomva` 保持默认入口,新轨页面覆盖不全)
- 不改后端、不改既有 API 路由、不动 prod overlay
- 不覆盖 webapp 分享页专项验收(随新轨自然可用,但本批不逐一走查)

**成功标准**:
1. `kubectl diff` 对既有资源零修改(只增:1 Deployment + 1 Service + 1 ConfigMap;nginx configmap 内容替换触发滚动、ingress 不动)
2. 浏览器 `/lomva/v2/signin` 登录创始人 → `/lomva/v2/admin` 四页(空间/成员/管理员/审计)可用
3. 旧轨 `/lomva` 回归无损(登录 + 首页正常)
4. 双轨同账号会话互通(均经 `/lomva/console/api`,共享 path=/lomva 会话 cookie)

## 2. 关键事实(2026-10-13 全部代码级/实机核实)

| 件 | 现状 | 设计结论 |
|---|---|---|
| cookie path | 后端静态取自 `CONSOLE_API_URL` 路径段(`api/libs/token.py` `deployment_path_prefix()`),QA = `/lomva`;**path 按路径段匹配**(RFC 6265:`/lomva-new` 不匹配,`/lomva/v2` 匹配)✅ 实机实证 | **新轨页面路径必须在 `/lomva` 内** → `/lomva/v2`;API 走 `/lomva/console/api`(共享),会话与 csrf cookie 对双轨页面+API 全部可达 |
| nginx 分流 | subpath overlay `default.conf` 按前缀:`/lomva/console/api|api|v1|openapi|files|mcp|triggers`→api、`/lomva/socket.io/`→api-websocket、`/lomva/e/`→plugin-daemon、`/lomva/`→web | 新轨加 4 条:`/lomva/v2/socket.io/`→api-websocket、`/lomva/v2/`→web-new、两条尾斜杠精确匹配;API 规则零新增;最长前缀匹配与 `/lomva/v1`(API)不撞 ✅ 渲染实证 |
| basePath | `web-new/next.config.ts` 读 `env.NEXT_PUBLIC_BASE_PATH`,构建期固化进产物 | 专用镜像 `z123x/lomva-web-new`,build-arg `NEXT_PUBLIC_BASE_PATH=<base>/v2`(Dockerfile 已支持该 ARG,entrypoint 运行期再导出) |
| SSR | web 系 `SERVER_CONSOLE_API_URL=http://api:5001` 集群内直连 | 新轨 Deployment 同值复用(经双源 envFrom 继承) |
| ingress | qa overlay 单条 `/lomva`→nginx:80(Prefix 覆盖 `/lomva` 与 `/lomva/...`,含 `/lomva/v2/...`),nginx-ingress 共享 CLB | **零改动** |
| socket.io | web 端按 basePath 拼 `/socket.io` 路径 | 新轨落 `/lomva/v2/socket.io/` → 上述 nginx 规则覆盖 |
| nginx configmap | subpath overlay `behavior: replace` 整体替换,三文件各放相同副本 | qa overlay 同法再 replace 一次:nginx.conf/proxy.conf 原样复制,default.conf 加新轨 4 条 |
| kustomize 限制 | generator env 文件受安全限制不能引用 overlay 目录外(`../../base/...` 报 security)✅ 实证 | web 配置差异键走**双源 envFrom**(Deployment 层覆盖),不做 configmap 三文件合并 |

## 3. 改动面(全部增量)

### 3.1 CI(`.github/workflows/lomva-build-push.yml`)

新增 `build-web-new` job(复制 build-web 改三处):
- `file: web-new/Dockerfile`
- tags:`${{ env.IMAGE_PREFIX }}-web-new:${{ inputs.tag }}`
- build-args:`NEXT_PUBLIC_BASE_PATH=${{ inputs.base_path }}/v2`(QA base_path=/lomva → /lomva/v2;生产整切时需参数化,§4-4)

### 3.2 k8s(仅 `k8s/overlays/qa/`,base/subpath/prod 不动)

1. **`web-new.yaml`**(新文件):Deployment `lomva-web-new`(image `z123x/lomva-web-new`)+ Service `web-new:80→3000`;readinessProbe 探 `/lomva/v2/`(沿用 subpath 探针口径)
2. **`config/web-new-public.env`**(新文件,仅 1 个差异键 `NEXT_PUBLIC_BASE_PATH=/lomva/v2` + cookie 段匹配教训注释);configMapGenerator 新建 `lomva-web-new-config`(create)。Deployment **双源 envFrom**:`lomva-web-config` 在前、`lomva-web-new-config` 在后(k8s envFrom 语义后者覆盖前者同 key)——全量键继承旧轨 web 配置,DRY。`CONSOLE_API_URL`/`APP_API_URL` 刻意维持继承旧轨 `/lomva` 值,不写进差异键文件
3. **nginx**:`config/nginx/` 三文件副本入 qa overlay,default.conf 加 4 条(socket.io 剥前缀 + 前缀转发 + 两条尾斜杠精确匹配,模式照抄 `/lomva` 既有块)
4. **ingress.yaml**:零改动(`/lomva` Prefix 已覆盖)
5. **kustomization.yaml**:resources 加 web-new.yaml;configMapGenerator 加 `lomva-web-new-config` + `lomva-nginx-config` replace;images 段 pin `z123x/lomva-web-new`(tag 随批)

### 3.3 部署与验收序列

构建(手动 workflow,tag 随批)→ overlay pin tag → `kubectl diff`(只增断言)→ apply → rollout(web-new + nginx 滚动)→ 验收四步(§1 成功标准)→ 手册 §4 冒烟口径补新轨一节

## 4. 已知限制(登记,不阻塞)

1. **后端生成的绝对链接永远指 `/lomva`**(邀请/激活邮件、form 链接——`deployment_path_prefix` 静态):新轨验收激活/邀请流时,手动把链接前缀 `/lomva` 换成 `/lomva/v2` 再访问。新轨整切为唯一轨时自然消解。
2. **双轨共享会话与本地存储**:同浏览器双轨互见登录态(cookie path 同源);且同 origin → **localStorage 双轨互通**,若旧轨控制台与新轨键撞车再处理(管理台页面重叠风险低)。若需隔离,换浏览器/隐身窗。
3. **webapp 分享页**:`/lomva/v2/chat/<token>` 理论可用(PUBLIC_API 同样共享),本批不走查。
4. **生产不适用**:prod 整切形态(单轨 basePath=/)与本方案的并存子路径不同,届时另议;`build-web-new` job 的 `/v2` 后缀约定届时需参数化。

## 5. 回滚

全部增量:`kubectl delete` 新 Deployment/Service + revert qa overlay commit 即可;nginx 规则摘除后旧轨完全不受牵连(ingress 本批零改动)。
