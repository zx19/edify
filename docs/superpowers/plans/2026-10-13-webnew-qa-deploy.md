# 新轨前端上 QA(并存子路径 /lomva-new)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** web-new 以 `qa-xai.xingshulin.com/lomva-new` 并存部署到 QA,与旧轨共享后端,获得真环境验收能力。

**Architecture:** 专用镜像(lomva-web-new,basePath=/lomva-new)+ qa overlay 新增 Deployment/Service + nginx 加 4 条 location(页面+socket.io+两条尾斜杠规范)+ ingress 加 1 条 path;API 全部共享旧轨 `/lomva/console/api`(cookie path=/lomva 静态,见设计 §2)。

**Tech Stack:** GitHub Actions(docker/build-push-action)、Kustomize、nginx、kubectl。

**设计文档:** `docs/superpowers/specs/2026-10-13-webnew-qa-deploy-design.md`(已提交 14fb52a3d3)

## Global Constraints

- **全部增量**:对既有资源零修改;`kubectl diff` 只允许出现新增对象和 nginx configmap 内容变化
- **API 路径**:新轨 env `CONSOLE_API_URL`/`APP_API_URL` 必须指 `https://qa-xai.xingshulin.com/lomva`(非 /lomva-new)——cookie path 静态取自后端 CONSOLE_API_URL
- **kubectl 访问**:需 VPN;用 `KUBECONFIG=$HOME/.kube/config kubectl` 直调(kqa 非交互失效);先 diff 后 apply
- **镜像 tag**:本批 `1.17.0-edify-6`;只有 web-new 需要在 overlay pin 新 tag,其余镜像 pin 不动
- **提交规范**:精简一句话,无 Co-Authored-By

---

### Task 1: workflow 加 build-web-new job

**Files:**
- Modify: `.github/workflows/lomva-build-push.yml`(build-web job 后追加,约 L99 之后)

- [ ] **Step 1: 追加 job**

在 `build-web:` job 块结束后(L99 `cache-to` 行之后)追加:

```yaml
  # 新轨(web-new)并存轨镜像:basePath 在 inputs.base_path 基础上加 -new 后缀
  # (QA:/lomva → /lomva-new)。生产整切时本 job 需参数化 basePath,见设计 §4-4。
  build-web-new:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USER }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push web-new
        uses: docker/build-push-action@v6
        with:
          context: .
          file: web-new/Dockerfile
          platforms: linux/amd64
          push: true
          tags: ${{ env.IMAGE_PREFIX }}-web-new:${{ inputs.tag }}
          build-args: |
            NEXT_PUBLIC_BASE_PATH=${{ inputs.base_path }}-new
            SKIP_VINEXT=true
          cache-from: type=gha,scope=lomva-web-new
          cache-to: type=gha,mode=max,scope=lomva-web-new
```

注意:复制前先读一遍 build-web 现状缩进(2 空格 job 级),保持完全一致;`SKIP_VINEXT=true` 沿用旧轨口径。

- [ ] **Step 2: 本地校验 yaml 语法**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/lomva-build-push.yml'))"`
Expected: 无输出退出 0

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/lomva-build-push.yml
git commit -m "ci: lomva-build-push 加 build-web-new job(新轨并存镜像,basePath 加 -new 后缀)"
```

---

### Task 2: qa overlay 新增 web-new Deployment/Service + env

**Files:**
- Create: `k8s/overlays/qa/web-new.yaml`
- Create: `k8s/overlays/qa/config/web-new-public.env`

- [ ] **Step 1: 写 web-new.yaml**

以 base/app/web.yaml 为模,注意 probe 探子路径(镜像 basePath=/lomva-new,根路径 404):

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lomva-web-new
  labels:
    app: web-new
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web-new
  template:
    metadata:
      labels:
        app: web-new
    spec:
      containers:
        - name: web
          image: z123x/lomva-web-new
          envFrom:
            - configMapRef:
                name: lomva-web-new-config
          ports:
            - containerPort: 3000
          readinessProbe:
            httpGet:
              path: /lomva-new/
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: web-new
spec:
  selector:
    app: web-new
  ports:
    - port: 3000
      targetPort: 3000
```

- [ ] **Step 2: 写 web-new-public.env(仅差异键)**

```bash
# 新轨并存轨(/lomva-new)web 配置差异键:
# API 共享旧轨 /lomva 路径——后端 cookie path 静态取自 api 的 CONSOLE_API_URL(=/lomva),
# 新轨若用 /lomva-new/api 会因 cookie path 不匹配鉴权全崩(设计 §2)
CONSOLE_API_URL=https://qa-xai.xingshulin.com/lomva
APP_API_URL=https://qa-xai.xingshulin.com/lomva
NEXT_PUBLIC_BASE_PATH=/lomva-new
NEXT_PUBLIC_SOCKET_URL=wss://qa-xai.xingshulin.com
```

- [ ] **Step 3: Commit(与 Task 4 wiring 一起验完再提,见 T4)**

---

### Task 3: qa overlay nginx configmap + ingress path

**Files:**
- Create: `k8s/overlays/qa/config/nginx/nginx.conf`(原样复制 subpath 版)
- Create: `k8s/overlays/qa/config/nginx/proxy.conf`(原样复制 subpath 版)
- Create: `k8s/overlays/qa/config/nginx/default.conf`(subpath 版 + 新轨 4 条 location)
- Modify: `k8s/overlays/qa/ingress.yaml`

机制:subpath overlay 以 `behavior: replace` 整体替换 `lomva-nginx-config`(三文件各放相同副本);qa overlay 同法再 replace 一次,default.conf 加入新轨规则。

- [ ] **Step 1: 复制两份不变文件**

```bash
mkdir -p k8s/overlays/qa/config/nginx
cp k8s/overlays/subpath/config/nginx/nginx.conf k8s/overlays/qa/config/nginx/nginx.conf
cp k8s/overlays/subpath/config/nginx/proxy.conf k8s/overlays/qa/config/nginx/proxy.conf
cp k8s/overlays/subpath/config/nginx/default.conf k8s/overlays/qa/config/nginx/default.conf
```

- [ ] **Step 2: default.conf 加新轨 4 条 location**

在 `location /lomva/socket.io/ {` 块**之前**插入(位置无关——nginx 前缀匹配最长优先,集中放头部便于审阅):

```nginx
    # ---- 新轨并存轨(/lomva-new):页面转发 web-new,API 共享 /lomva 不动 ----
    # 协作 WebSocket 同 /lomva 口径剥前缀
    location /lomva-new/socket.io/ {
      proxy_pass http://api-websocket:5001/socket.io/;
      include proxy.conf;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_cache_bypass $http_upgrade;
    }

    # web-new 镜像以 NEXT_PUBLIC_BASE_PATH=/lomva-new 构建,保留完整路径转发
    location /lomva-new/ {
      proxy_pass http://web-new:3000;
      include proxy.conf;
    }

    # 尾斜杠规范同 /lomva 处注释:精确匹配接住两种形态直转,不发重定向
    location = /lomva-new {
      proxy_pass http://web-new:3000;
      include proxy.conf;
    }

    location = /lomva-new/ {
      proxy_pass http://web-new:3000/lomva-new;
      include proxy.conf;
    }
```

- [ ] **Step 3: ingress.yaml 加 path**

在 `- path: /lomva` 块后追加:

```yaml
          # 新轨并存轨(web-new),同样由 nginx 剥离/分流
          - path: /lomva-new
            pathType: Prefix
            backend:
              service:
                name: nginx
                port:
                  number: 80
```

---

### Task 4: kustomization wiring + 本地构建验证

**Files:**
- Modify: `k8s/overlays/qa/kustomization.yaml`

- [ ] **Step 1: 三处修改**

resources 段加:

```yaml
  - web-new.yaml
```

configMapGenerator 段加(与既有 lomva-web-config 平级):

```yaml
  # 新轨并存轨 web 配置:base web-config.env + qa web-public.env + 新轨差异键,后者覆盖前者
  - name: lomva-web-new-config
    behavior: merge
    envs:
      - ../../base/config/web-config.env
      - config/web-public.env
      - config/web-new-public.env
  # qa 在 subpath 之上再 replace 一次 nginx 配置:加入 /lomva-new 路由(三文件须全量,replace 语义)
  - name: lomva-nginx-config
    behavior: replace
    files:
      - nginx.conf=config/nginx/nginx.conf
      - proxy.conf=config/nginx/proxy.conf
      - default.conf=config/nginx/default.conf
```

images 段加(tag 在 T6 构建完成后回填,先写占位 edify-6):

```yaml
  - name: z123x/lomva-web-new
    newTag: 1.17.0-edify-6
```

- [ ] **Step 2: 本地 kustomize 构建验证(不触集群)**

Run: `kubectl kustomize k8s/overlays/qa > /tmp/qa-render.yaml && echo OK`
Expected: OK;再查关键产物:

```bash
grep -c "lomva-web-new" /tmp/qa-render.yaml          # 期望 ≥3(Deployment/Service/images)
grep -A2 "location /lomva-new/" /tmp/qa-render.yaml | head -4  # nginx 规则在渲染产物里
grep "lomva-web-new-config" /tmp/qa-render.yaml | head -3      # configmap 生成+引用
```

- [ ] **Step 3: 验证 env 合并正确性**

渲染产物中 `lomva-web-new-config-*` 的 data 里:
- `NEXT_PUBLIC_BASE_PATH` 必须是 `/lomva-new`(web-new-public.env 最后覆盖)
- `CONSOLE_API_URL` 必须是 `https://qa-xai.xingshulin.com/lomva`
- `SERVER_CONSOLE_API_URL=http://api:5001`(自 base web-config.env 继承)

Run: `kubectl kustomize k8s/overlays/qa | python3 -c "import sys,yaml; [print(yaml.safe_load(d)['data']) for d in yaml.safe_load_all(sys.stdin) if d and yaml.safe_load(d).get('kind')=='ConfigMap' and 'web-new' in yaml.safe_load(d)['metadata']['name']]"` 
(若 python yaml 多次 load 报错,改 `kubectl kustomize ... | grep -B2 -A40 "name: lomva-web-new-config"`)

Expected: 上述三键值如上

- [ ] **Step 4: Commit**

```bash
git add k8s/overlays/qa/ .github/workflows/lomva-build-push.yml
git commit -m "feat(qa): 新轨并存部署 /lomva-new——web-new Deployment/Service + nginx 4 规则 + ingress path(workflow job 见前 commit)"
```
(若 T1 未单独提交则合并成这一条;已单独提交则 message 去掉括号尾)

---

### Task 5: 构建镜像

- [ ] **Step 1: 推送 main,触发构建**

```bash
git push origin main
gh workflow run lomva-build-push.yml -f tag=1.17.0-edify-6 -f base_path=/lomva
```

- [ ] **Step 2: 等构建完成,验证 web-new 镜像存在**

```bash
gh run list --workflow lomva-build-push.yml --limit 1   # 等 success
curl -s "https://hub.docker.com/v2/repositories/z123x/lomva-web-new/tags/1.17.0-edify-6" | head -c 200
```

Expected: tag 存在,last_pushed 为当前时间。**已知慢点**:push/构建在 VPN 下可能很慢,后台跑+通知,不阻塞干等。

---

### Task 6: 部署 + 验收

前置:VPN 在线;`export KUBECONFIG=$HOME/.kube/config`

- [ ] **Step 1: diff——断言「只增」**

```bash
kubectl diff -k k8s/overlays/qa 2>&1 | grep "^+" | grep -v "^+++" | grep -v "lomva-new\|web-new\|lomva-nginx-config\|data:" | head -20
```

Expected: 空(除新对象、nginx configmap data、hash 名变化外无其他新增行)。**若出现对既有 Deployment/Service 的修改行,停止并排查。**

- [ ] **Step 2: apply + rollout**

```bash
kubectl apply -k k8s/overlays/qa
kubectl -n qa-ai-lomva rollout status deploy/lomva-web-new --timeout=180s
kubectl -n qa-ai-lomva rollout restart deploy/lomva-nginx   # nginx configmap 变更需重启生效
kubectl -n qa-ai-lomva rollout status deploy/lomva-nginx --timeout=120s
```

- [ ] **Step 3: curl 冒烟**

```bash
# 新轨首页 HTML(200 且有 basePath 痕迹)
curl -s -o /dev/null -w '%{http_code}\n' https://qa-xai.xingshulin.com/lomva-new/signin   # 期望 200
# 旧轨回归
curl -s -o /dev/null -w '%{http_code}\n' https://qa-xai.xingshulin.com/lomva/signin      # 期望 200
# 共享 API 经新轨页面同源路径仍通(公开端点)
curl -s https://qa-xai.xingshulin.com/lomva/console/api/setup | head -c 120            # 期望 JSON
```

- [ ] **Step 4: 浏览器验收(Playwright MCP)**

1. `https://qa-xai.xingshulin.com/lomva-new/signin` 登录创始人 → 落地控制台正常
2. 头像菜单 → 系统管理 → `/lomva-new/admin/workspaces` 四页走查(空间/成员/管理员/审计各刷一次)
3. 旧轨 `https://qa-xai.xingshulin.com/lomva` 登录回归:首页 + 一个已有应用详情页打开正常
4. 双轨会话互通:新轨登录后,旧轨直接开 `/lomva` 已登录(共享 cookie)

- [ ] **Step 5: Commit 验收记录(如有配置修正) + 推送**

---

### Task 7: 手册与记忆收口

**Files:**
- Modify: `docs/guide/系统管理-部署与验收手册.md`(§4 冒烟节后补新轨一节)
- Modify: 记忆 `edify-tke-deployment-context`(QA web=旧轨一条改为双轨并存事实)

- [ ] **Step 1: 手册 §4 尾部追加「新轨(/lomva-new)冒烟」小节**

内容:三条 curl(signin 双轨 200 + setup JSON)+ 浏览器四步(同 T6 Step 4);注明激活/邀请链接需手动换前缀(设计 §4-1)。

- [ ] **Step 2: 手册 §8-5 修订**

「QA web 镜像是旧轨」改为「QA 双轨并存:旧轨 /lomva(web/Dockerfile)+ 新轨 /lomva-new(web-new/Dockerfile,2026-10-13 起);新轨 API 共享 /lomva/console/api(cookie path 静态)」。

- [ ] **Step 3: 记忆更新 + 提交推送**

`edify-tke-deployment-context` 的「QA web 镜像 = 旧轨」段改为双轨事实;`edify-frontend-rewrite-progress` 新轨上 QA 从「待拍板」改为「已落地(并存子路径)」。

```bash
git add docs/guide/系统管理-部署与验收手册.md
git commit -m "docs: 系统管理手册补新轨并存冒烟与双轨事实"
git push origin main
```
