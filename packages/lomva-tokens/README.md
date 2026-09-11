# @xsl/lomva-tokens

三线共享视觉 token 共享层（执行计划 v2 §1.5 产出物，M1 验收项）。

## 用法

```ts
import '@xsl/lomva-tokens/tokens.css'
```

在目标区根元素挂作用域类：

| 作用域类         | 消费线                                 |
| ---------------- | -------------------------------------- |
| `.admin-theme`   | 系统管理控制台（web-new `app/admin/`） |
| `.webapp-theme`  | WebApp 分享页（shareLayout）           |
| `.console-theme` | 工作台控制台                           |

三个类当前定义**同一套变量值**（design §3.2 白+黑+橙，三线同源）；拆成三个入口是为后续分线微调留位。

## 机制约定

- **dark**：作用域元素加 `.dark`（如 `<body class="webapp-theme dark">`）。dark 值按 design「底色/灰阶反转/橙亮档」原则在 token 定稿时定义（本文件即定稿落点），须过三线目视评审（M1 人信号）。
- **accent 运行期覆盖（chat_color_theme）**：在作用域根元素 inline style 设 `--accent` / `--accent-deep` / `--accent-soft`，层叠覆盖类级定义。WebApp 按 `sites.ui_config` 注入（3a/第 4 步落地）。
- **与旧视觉的关系**：本文件只在三个作用域类下定义新值；无作用域类 = 不出现新视觉。新原语包（2a）CSS 变量**默认值对齐 Dify 现行视觉**（§4 token 注记），Storybook 像素 diff 在无作用域态跑。

## 值的来源

light 全量值（含状态色/pill/阴影/字体）取自系统管理控制台 mockup `:root`（`docs/superpowers/specs/2026-08-26-系统管理控制台UI-mockup.html`），与 design §3.2 摘要逐项核对一致。
