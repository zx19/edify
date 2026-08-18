#!/usr/bin/env bash
# 构建本仓库 4 个组件镜像并推送到 TCR，另转推 2 个上游镜像（sandbox / plugin-daemon 源码不在本仓库）。
#
# 用法：
#   TCR_NAMESPACE=ccr.ccs.tencentyun.com/<你的命名空间> ./k8s/scripts/build-images.sh
#
# 可选环境变量：
#   TAG                  镜像 tag（默认 1.16.1-edify；上游转推镜像沿用其原始 tag）
#   NEXT_PUBLIC_BASE_PATH  web 构建子路径（默认 /lomva，与 overlays/tke 一致；根路径部署设为空）
#   PLATFORM             构建平台（默认 linux/amd64）
set -euo pipefail

TCR_NAMESPACE="${TCR_NAMESPACE:?请先设置 TCR_NAMESPACE，例如 ccr.ccs.tencentyun.com/my-team}"
TAG="${TAG:-1.16.1-edify}"
BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-/lomva}"
PLATFORM="${PLATFORM:-linux/amd64}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

build() { # build <目标镜像名> <dockerfile> <上下文> [额外参数...]
  local name="$1" dockerfile="$2" context="$3"
  shift 3
  echo "==> build $TCR_NAMESPACE/$name:$TAG"
  docker buildx build --platform "$PLATFORM" "$@" \
    -t "$TCR_NAMESPACE/$name:$TAG" -f "$dockerfile" "$context" --push
}

retag() { # retag <上游镜像:tag> <目标镜像名:tag>
  local src="$1" dst="$2"
  echo "==> retag $src -> $TCR_NAMESPACE/$dst"
  docker pull --platform "$PLATFORM" "$src"
  docker tag "$src" "$TCR_NAMESPACE/$dst"
  docker push "$TCR_NAMESPACE/$dst"
}

# 注意：api / web / agent-backend 的 Dockerfile 以仓库根目录为构建上下文
# （COPY 路径形如 api/pyproject.toml、web/package.json），只有 agent-local-sandbox 用子目录
build lomva-api                 api/Dockerfile                       .
build lomva-web                 web/Dockerfile                       . --build-arg "NEXT_PUBLIC_BASE_PATH=$BASE_PATH"
build lomva-agent-backend       dify-agent/Dockerfile                .
build lomva-agent-local-sandbox dify-agent-runtime/docker/Dockerfile dify-agent-runtime

retag langgenius/dify-sandbox:0.2.15             lomva-sandbox:0.2.15
retag langgenius/dify-plugin-daemon:0.6.10-local lomva-plugin-daemon:0.6.10-local

cat <<EOF

完成。下一步：
1. 编辑 k8s/overlays/tke/kustomization.yaml，取消 images: 段注释，
   并把 <tcr-namespace> 替换为 ${TCR_NAMESPACE#ccr.ccs.tencentyun.com/}
2. ./k8s/scripts/deploy.sh
EOF
