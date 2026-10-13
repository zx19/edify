# 新轨前端上 QA(并存子路径)设计

2026-10-13 | 状态:已拍板(用户两问后确认) | 前置:M4/M4b/3b 已合 main,QA 后端 edify-5

## 1. 目标 / 边界 / 成功标准

**目标**:web-new(新轨)以 `https://qa-xai.xingshulin.com/lomva-new` 并存部署于 QA 集群,与旧轨共享同一后端,使新轨获得真环境(生产构建 + nginx ingress + 真实域名 cookie/CSRF)验收能力。

**不做**:
- 不整切(QA 旧轨 `/lomva` 保持默认入口,新轨页面覆盖不全)
- 不改后端、不改既有 API 路由、不动 prod overlay
- 不覆盖 webapp 分享页专项验收(随新轨自然可用,但本批不逐一走查)

**成功标准**:
1. `kubectl diff` 对既有资源零修改(只增:1 Deployment + 1 Service + nginx 2 条 location + ingress 1 条 path)
2. 浏览器 `/lomva-new/signin` 登录创始人 → `/lomva-new/admin` 四页(空间/成员/管理员/审计)可用
3. 旧轨 `/lomva` 回归无损(登录 + 首页正常)
4. 双轨同账号会话互通(均经 `/lomva/console/api`,共享 path=/lomva 会话 cookie)

## 2. 关键事实(2026-10-13 全部代码级核实)

| 件 | 现状 | 设计结论 |
|---|---|---|
| cookie path | 后端静态取自 `CONSOLE_API_URL` 路径段(`api/libs/token.py` `deployment_path_prefix()`),QA = `/lomva` | **新轨 API 必须走 `/lomva/console/api`**;若走 `/lomva-new/api`,cookie path=/lomva 不匹配 /lomva-new 请求,鉴权全崩 |
| nginx 分流 | subpath overlay `default.conf` 按前缀:`/lomva/console/api|api|v1|openai|files|mcp|triggers`→api、`/lomva/socket.io/`→api-websocket、`/lomva/e/`→plugin-daemon、`/lomva/`→web | 新轨只需 2 条:`/lomva-new/socket.io/`→api-websocket、`/lomva-new/`→web-new;API 规则零新增 |
| basePath | `web-new/next.config.ts` 读 `env.NEXT_PUBLIC_BASE_PATH`,构建期固化进产物 | 专用镜像 `z123x/lomva-web-new`,build-arg `NEXT_PUBLIC_BASE_PATH=/lomva-new`(Dockerfile 已支持该 ARG,entrypoint 运行期再导出) |
| SSR | web 系 `SERVER_CONSOLE_API_URL=http://api:5001` 集群内直连 | 新轨 Deployment 同值复用 |
| ingress | qa overlay 单条 `/lomva`→nginx:80,nginx-ingress 共享 CLB | 加 `/lomva-new`→nginx:80 一条(同 host path 合并,不新建 CLB) |
| socket.io | web 端按 basePath 拼 `/socket.io` 路径 | 新轨落 `/lomva-new/socket.io/` → 上述 nginx 规则覆盖 |
| nginx configmap | subpath overlay `behavior: replace` 整体替换,三文件各放相同副本 | qa overlay 同法再 replace 一次:nginx.conf/proxy.conf 原样复制,default.conf 加新轨 2 条 |

## 3. 改动面(全部增量)

### 3.1 CI(`.github/workflows/lomva-build-push.yml`)

新增 `build-web-new` job(复制 build-web 改三处):
- `file: web-new/Dockerfile`
- tags:`${{ env.IMAGE_PREFIX }}-web-new:${{ inputs.tag }}`
- build-args:`NEXT_PUBLIC_BASE_PATH=${{ inputs.base_path }}-new`(QA base_path=/lomva → /lomva-new;注释说明:生产整切时需改可传值,本期 QA 专用)

### 3.2 k8s(仅 `k8s/overlays/qa/`,base/subpath/prod 不动)

1. **`web-new.yaml`**(新文件):Deployment `lomva-web-new`(image `z123x/lomva-web-new`,envFrom `lomva-web-config` + 新增 `lomva-web-new-config`)+ Service `web-new:80→3000`;readinessProbe 探 `/lomva-new/`(沿用 subpath 探针口径)
2. **`config/web-new-public.env`**(新文件,仅放差异键:`CONSOLE_API_URL`/`APP_API_URL` 指 `/lomva`、`NEXT_PUBLIC_BASE_PATH=/lomva-new`、`NEXT_PUBLIC_SOCKET_URL=wss://qa-xai.xingshulin.com`);configMapGenerator 新建 `lomva-web-new-config`,envs 依序 `[../../base/config/web-config.env, config/web-public.env, config/web-new-public.env]`(后者覆盖前者,全量键齐全)
3. **nginx**:`config/nginx/` 三文件副本入 qa overlay,default.conf 在 `/lomva/` 规则前加:
   ```nginx
   location /lomva-new/socket.io/ { proxy_pass http://api-websocket:5001/socket.io/; ... }
   location /lomva-new/ { proxy_pass http://web-new:3000; ... }
   ```
   (proxy.conf 公共头沿用 include;注意 `/lomva-new/` 须排在 `/lomva/` 前或依赖最长前缀匹配——nginx 前缀匹配天然最长优先,顺序无关,注释说明即可)
4. **ingress.yaml**:paths 加 `- path: /lomva-new`(Prefix)→ nginx:80
5. **kustomization.yaml**:resources 加 web-new.yaml;configMapGenerator 加 `lomva-web-new-config`(merge web-new-public.env)+ `lomva-nginx-config` replace;images 段加 `lomva-web-new` 镜像 pin(tag 随批)

### 3.3 部署与验收序列

构建(手动 workflow,tag 随批)→ overlay pin tag → `kubectl diff`(只增断言)→ apply → rollout → 验收四步(§1 成功标准)→ 手册 §4 冒烟口径补新轨一节

## 4. 已知限制(登记,不阻塞)

1. **后端生成的绝对链接永远指 `/lomva`**(邀请/激活邮件、form 链接——`deployment_path_prefix` 静态):新轨验收激活/邀请流时,手动把链接前缀 `/lomva` 换成 `/lomva-new` 再访问。新轨整切为唯一轨时自然消解。
2. **新轨旧轨共享会话**:同浏览器双轨互见登录态(cookie 同 path)。验收视角是特性;若需隔离,换浏览器/隐身窗。
3. **webapp 分享页**:`/lomva-new/chat/<token>` 理论可用(PUBLIC_API 同样共享),本批不走查。
4. **生产不适用**:prod 整切形态(单轨 basePath=/)与本方案的并存子路径不同,届时另议;`build-web-new` job 的 `-new` 后缀约定届时需参数化。

## 5. 回滚

全部增量:`kubectl delete` 新 Deployment/Service + revert qa overlay commit 即可;nginx/ingress 规则摘除后旧轨完全不受牵连。
