# @xsl/ui

杏树林新原语包——前端重写 2a/2b 的产出落点（执行计划 v2 §4）。

## 与 `@langgenius/dify-ui` 的关系（双轨期口径）

- 迁移期间逐原语替换：每原语走五步闭环（契约冻结 → 重写 → web-new 批量改 import → 分层验证 → 标记追平入删旧台账），旧实现统一在第 7 步终验通过后删除。
- **视觉默认值对齐 Dify 现行值**：本包不携带主题；类名引用的 CSS 变量仍由消费方现有的 dify-ui 主题提供。新视觉（白+黑+橙）只经 `@xsl/tokens` 的三个作用域类覆盖（§4 token 注记）——无作用域类 = 无新视觉，Storybook 像素 diff 在无作用域态跑。
- 冻结契约源：`baselines/dify-ui-api.json`（props 100% 对齐，不允许漂移）。

## 已迁移原语

| 原语     | 闭环日期   | 验证                                               |
| -------- | ---------- | -------------------------------------------------- |
| `cn`     | 2026-09-11 | 随 button 闭环（叶子依赖）                         |
| `button` | 2026-09-11 | `__tests__/parity.spec.tsx` 双轨 DOM/行为 diff = 0 |

## 测试

```bash
vp test --project unit   # 浏览器模式（Chromium headless），含双轨 parity
```
