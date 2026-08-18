# 事故复盘：qa-ai 命名空间误删（2026-08-18）

## 概要

部署 lomva（Dify fork）新栈时，按指引执行 `kubectl delete -k k8s/overlays/qa` 拆除旧渲染结果，
因 overlay 中包含共享命名空间的 `Namespace` 对象，`qa-ai` 被整体删除，**连带删除了其中的
旧 dify 栈（dify-\*，含 200 天数据）与 xai 平台栈（xai-\*）**。

## 影响

- 旧 dify（qa-xai.xingshulin.com 根路径）与 xai 平台全部 Pod/Service/ConfigMap/Secret 被删
- **数据零丢失**：`qa-cbs`/`qa-cfs` 存储类均为 Retain 策略，15 个 PV 转 Released，云盘完好，
  通过"清 claimRef + 同名 PVC 指定 volumeName 绑回"恢复全部数据卷
- 我们新栈的 3 个 Pending PVC（默认 `cbs` 类为 Delete）被删——无数据，无损失

## 根因

1. **直接原因**：overlay 管理了共享命名空间的 Namespace 对象；`delete -k` 的作用域 = 清单全部资源
2. **指令失误**：拆除指引直接给 `delete -k`，未要求先渲染预览删除范围
3. **文档矛盾**：README 回退方案声称 `delete -k`"只影响本栈"，与当时清单实际包含共享对象不符

## 幸运因素（不能依赖的运气）

- qa-cbs / qa-cfs 是 Retain（若是默认 cbs/Delete 类，数据盘已销毁）
- 发生在 QA 环境而非生产
- Released 的 PV 保留了 claimRef 信息，得以精确重建绑定关系

## 教训

1. **共享 Namespace 对象绝不由应用清单管理**——ns 是房东的东西，手动创建或集群级 IaC 管理
2. **删除/变更类操作先预览**：`kubectl diff -k`（server dry-run 差异）+ `--dry-run=server`（校验）
3. **Retain 回收策略是最后安全网**：重要数据卷的存储类必须 Retain；回收策略不能替代备份
4. **文档指令的作用域必须与清单内容一致**
5. **删除路径需要脚本化保护**（预览 + 确认），与部署路径同等对待
6. **命名空间即爆炸半径边界**：共享 ns 多栈混部，事故半径是整个 ns；每栈独立命名空间
   （本次落地：lomva 栈迁至 `qa-ai-lomva`）

## 已落地的修复

- 三个 overlay 移除 `namespace.yaml`（`namespace:` 字段保留，仅给本栈资源打归属）
- `deploy.sh`：预检 ns 存在性（只读、不创建）；apply 前加 `--dry-run=server` 校验 +
  `kubectl diff -k` 差异预览 + 二次确认
- 存储类显式 `qa-cbs`（Retain）；PVC 下限 10Gi（CBS 最小值）；工作负载 `lomva-` 前缀
- README：回退方案第 5 条作用域说明修正

## 待办

- [ ] 旧 dify / xai 工作负载从源头清单恢复（数据卷已可绑回）
- [ ] 考虑提供 `k8s/scripts/teardown.sh`（预览式拆除）
- [ ] prod 上线前复查 prod-cbs 回收策略与备份策略
