# 问题定位：Web 应用关闭再开启后旧会话 404（2026-09-07）

## 概要

访问点关闭 Web 应用再重新开启后，终端用户重新打开 webapp 会**丢失全部历史会话**，
且前端自动恢复的旧会话请求报 `404 Conversation Not Exists`。

QA 报错样例（lomva 子路径部署）：

```
GET /lomva/api/messages?conversation_id=e9466d9d-905d-4085-8436-6d7edd2e209c&limit=20&last_id=
→ 404 {"code":"not_found","message":"Conversation Not Exists. You have requested this URI
  [/api/messages] but did you mean /api/messages or /api/chat-messages or /api/saved-messages ?"}
```

（报错尾部 werkzeug 风格路由建议是 404 处理器拼接的文案，无实际意义；真实错误就是前半句。）

## 现象与复现（2026-09-07 本地验证）

| 操作序列 | 结果 |
| --- | --- |
| 关闭 → 开启，**期间不访问** webapp 页面 | ✅ 无问题，历史完好 |
| 关闭期间**访问过** webapp 页面（显示「应用不可用」）→ 开启 → 重新打开 | ❌ 历史丢失 + 旧会话 404 |
| 报错后新建对话 | ✅ 正常（新会话挂在新 EndUser 下） |

三个行为与根因链完全吻合：**开关本身无害，触发条件是关闭期间的一次页面访问**。

发消息（`POST /api/chat-messages`，本地调试观察到的）与加载历史（`GET /api/messages`，QA 观察到的）
走同一个 `get_conversation` 归属校验，都会报同样的 404。

## 根因

三层前端/后端状态的**持久性不一致**：EndUser 身份易失（passport 一清就重建）、
passport 易失（一次 404 就清）、前端记住的 conversationId 却持久（与身份无关）。
「关闭再开启」这个本应完全可逆的操作，被中间一次访问变成了身份更换。

完整触发链（关闭 → 期间访问 → 重开）：

1. **关闭只翻一个开关**：`update_app_site_status` 仅置 `App.enable_site=false`
   （`api/services/app_service.py:957`），不删任何数据——旧会话在库里完好。
2. **关闭期间访问页面**（哪怕一次）：
   - `/login/status` 里 `decode_jwt_token` 遇 `enable_site=False` 直接抛
     `BadRequest("Site is disabled.")`（`api/controllers/web/wraps.py:64-65`）→ 前端判定
     「app 未登录」——**尽管本地 passport 其实还有效**。普通 webapp 的 passport 无 exp 字段
     （`api/controllers/web/passport.py:113-123` 的 payload 不含 exp，
     `PassportService.issue` 也不加），**永不过期**，这正是平时不丢历史的原因；
   - 于是前端重取：`GET /api/passport` → 又因 `enable_site=False` 返回 404
     （`api/controllers/web/passport.py:82-83`）；
   - `web/app/(shareLayout)/components/splash.tsx:108-116` 的 catch 分支执行
     `webAppLogout(address)` → **把本地仍有效的 passport 从 localStorage 清掉**
     （`web/service/webapp-auth.ts:59-63`）。
3. **重新开启后**：
   - 前端无 passport → 重取成功 → `/api/passport` 在独立 webapp 场景**不带 `user_id`** →
     **新建一个全新 EndUser**（随机 session_id，`api/controllers/web/passport.py:103-111`）；
   - 但 localStorage 的 `CONVERSATION_ID_INFO` 存「上次会话」的 key 是 `(appId, 'DEFAULT')`
     ——`storageUserId = userId || 'DEFAULT'`，**不随 EndUser 身份变化**
     （`web/app/components/base/chat/storage.ts:75`）→ 前端自动恢复旧 conversationId；
   - `get_conversation` 要求 `Conversation.from_end_user_id == 当前 end_user.id`
     （`api/services/conversation_service.py:173-189`）→ 新身份不拥有旧会话 →
     抛 `ConversationNotExistsError` → 404（`api/controllers/web/message.py:102`、
     `completion.py:138/241`）。

会话列表接口同样按 `from_end_user_id` 过滤（`conversation_service.py:56`），所以新身份下
列表为空——「列表还在、点开 404」的不一致解释已排除。

## 修复方案（已定稿，未实施）

**方案一（选定，最小改动）**：`splash.tsx` 的 passport 404 分支不再调用 `webAppLogout`
（保留本地 passport）。站点关闭/删除是可逆或无害场景：重开后 `/login/status` 校验现有
passport 直接通过 → 同一 EndUser → 历史无缝恢复。非 404 错误分支维持现状（仍 logout）。

改动点（`splash.tsx:108-116`）：

```diff
         } catch (error) {
           if (error instanceof Response && error.status === 404) {
+            // site disabled or removed: keep the passport so the end user
+            // survives a reversible disable
             setUnavailableShareCode(effectiveShareCode)
-            await webAppLogout(address)
             return
           }
           await webAppLogout(address)
           proceedToAuth()
         }
```

配套测试（`splash.spec.tsx`，与现有用例同风格）：

- passport 404 → 显示 AppUnavailable 且 `webAppLogout` **不被调用**
- passport 非 404（如 500）→ 仍走 `webAppLogout`

备选方案（未采纳，记录备查）：

- **+ 404 优雅降级**：消息列表 404 时清掉本地残留 conversationId，静默回到新会话。
  防御后端数据被清理等场景，非本次必需。
- **稳定 user_id 持久化**：前端为每个 app 持久化稳定 user_id，重取 passport 时带上
  （后端 `passport.py:85-101` 已支持按 session_id 找回 EndUser）。根治所有 passport
  丢失场景，改动面较大。

## 影响面

- 独立 webapp（public）场景必现；enterprise 登录场景的 exchange 流程按 session_id
  找回 EndUser（`passport.py:140-214`），受影响较小。
- 广义上任何「passport 被程序性清除而 localStorage 其它数据保留」的路径都可能复现
  同样的旧 conversationId 404。

## 待办

- [ ] 实施方案一（splash.tsx + splash.spec.tsx，改动见上文）
- [ ] 本地复现步骤回归：关闭 → 期间访问 → 开启 → 历史应恢复
- [ ] QA 部署回归验证
