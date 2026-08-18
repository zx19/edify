#!/usr/bin/env bash
# 部署 edify 到当前 kubectl context 指向的集群，并做冒烟检查。
#
# 用法：
#   ./k8s/scripts/deploy.sh            # 部署 overlays/qa（测试环境），交互确认集群
#   ASSUME_YES=1 ./k8s/scripts/deploy.sh   # 跳过确认（CI 用）
#   OVERLAY=k8s/overlays/prod NAMESPACE=prod-ai ./k8s/scripts/deploy.sh   # 线上
#   OVERLAY=k8s/overlays/local SMOKE_PATH= ./k8s/scripts/deploy.sh        # 本地 kind
set -euo pipefail

OVERLAY="${OVERLAY:-k8s/overlays/qa}"
NAMESPACE="${NAMESPACE:-qa-ai-lomva}"
SMOKE_PATH="${SMOKE_PATH-/lomva}"   # 不带尾斜杠；overlays/local（根路径）验证时设为空字符串

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "==> 当前集群: $(kubectl config current-context)"
if [[ "${ASSUME_YES:-0}" != "1" ]]; then
  read -r -p "确认部署到该集群？[y/N] " ans
  [[ "${ans:-N}" =~ ^[yY]$ ]] || { echo "已取消"; exit 1; }
fi

# 预检：命名空间必须已存在（本清单不管理 Namespace 生命周期——共享命名空间时 delete -k 不会误伤其他栈）
if ! kubectl get ns "$NAMESPACE" >/dev/null 2>&1; then
  echo "!! 命名空间 $NAMESPACE 不存在。请与集群管理员确认后手动创建："
  echo "   kubectl create ns $NAMESPACE"
  exit 1
fi

# 预检：真实机密文件（gitignored）是否已就位
if [[ -f "$OVERLAY/config/secret.env.example" && ! -f "$OVERLAY/config/secret.env" ]]; then
  echo "!! 缺少 $OVERLAY/config/secret.env（真实机密，不入 git）。请先执行："
  echo "   cp $OVERLAY/config/secret.env.example $OVERLAY/config/secret.env"
  echo "   然后编辑填入真实值"
  exit 1
fi

echo "==> kubectl apply -k $OVERLAY"

# 服务端 dry-run 校验（不落库）：提前拦截不可变字段等校验错误
kubectl apply -k "$OVERLAY" --dry-run=server > /dev/null

# 与集群现状的差异预览（首次部署会全量列出）；有差异时 diff 退出码为 1，属预期
kubectl diff -k "$OVERLAY" || true
if [[ "${ASSUME_YES:-0}" != "1" ]]; then
  read -r -p "确认应用以上变更？[y/N] " ans
  [[ "${ans:-N}" =~ ^[yY]$ ]] || { echo "已取消"; exit 1; }
fi

kubectl apply -k "$OVERLAY"

echo "==> 等待 init Job 与有状态组件"
kubectl -n "$NAMESPACE" wait --for=condition=complete job/lomva-init-permissions --timeout=300s
for sts in lomva-postgres lomva-redis lomva-weaviate; do
  # postgres 为可选组件（qa/prod 用外部 PG，集群内无此 StatefulSet），按存在性跳过
  if kubectl -n "$NAMESPACE" get statefulset "$sts" >/dev/null 2>&1; then
    kubectl -n "$NAMESPACE" rollout status "statefulset/$sts" --timeout=300s
  fi
done

echo "==> 等待全部 Deployment（api 首次 migration 较慢，最长 10 分钟）"
kubectl -n "$NAMESPACE" wait --for=condition=available deploy --all --timeout=600s

echo "==> 冒烟检查（port-forward 经 nginx 转发）"
kubectl -n "$NAMESPACE" port-forward svc/nginx 18080:80 &
PF_PID=$!
trap 'kill "$PF_PID" 2>/dev/null || true' EXIT
sleep 3
curl -fsS -o /dev/null -w "web  %{http_code}\n" "http://localhost:18080${SMOKE_PATH}/" \
  || echo "!! web 检查失败（tke overlay 需确认 web 镜像带 NEXT_PUBLIC_BASE_PATH=/lomva 构建）"
curl -fsS "http://localhost:18080${SMOKE_PATH}/console/api/version" \
  && echo " <- api" || echo "!! api 检查失败：kubectl -n $NAMESPACE logs deploy/lomva-api"

echo
kubectl -n "$NAMESPACE" get ingress lomva 2>/dev/null || true
echo "完成。"
