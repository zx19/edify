#!/usr/bin/env bash
# 部署 edify 到当前 kubectl context 指向的集群，并做冒烟检查。
#
# 用法：
#   ./k8s/scripts/deploy.sh            # 部署 overlays/tke，交互确认集群
#   ASSUME_YES=1 ./k8s/scripts/deploy.sh   # 跳过确认（CI 用）
#   OVERLAY=k8s/base ./k8s/scripts/deploy.sh  # 部署 base（本地 kind 验证）
set -euo pipefail

OVERLAY="${OVERLAY:-k8s/overlays/tke}"
NAMESPACE=qa-ai
SMOKE_PATH="${SMOKE_PATH-/lomva}"   # 不带尾斜杠；overlays/local（根路径）验证时设为空字符串

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "==> 当前集群: $(kubectl config current-context)"
if [[ "${ASSUME_YES:-0}" != "1" ]]; then
  read -r -p "确认部署到该集群？[y/N] " ans
  [[ "${ans:-N}" =~ ^[yY]$ ]] || { echo "已取消"; exit 1; }
fi

echo "==> kubectl apply -k $OVERLAY"
kubectl apply -k "$OVERLAY"

echo "==> 等待 init Job 与有状态组件"
kubectl -n "$NAMESPACE" wait --for=condition=complete job/init-permissions --timeout=300s
for sts in postgres redis weaviate; do
  # postgres 为可选组件（tke overlay 用外部 PG，集群内无此 StatefulSet）
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
  && echo " <- api" || echo "!! api 检查失败：kubectl -n $NAMESPACE logs deploy/api"

echo
kubectl -n "$NAMESPACE" get ingress lomva 2>/dev/null || true
echo "完成。"
