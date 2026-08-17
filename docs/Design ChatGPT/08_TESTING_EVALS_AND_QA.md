# AI Personal Growth RPG — 测试、AI Evals 与质量保证规范

> 版本：v0.1

---

# 1. 测试优先级

```text
Growth Rules
>
Data Integrity
>
Security
>
AI Contract
>
Core User Flow
>
UI details
```

---

# 2. Unit Tests

重点测试：

- XP Engine
- level thresholds
- repetition penalty
- modifier bounds
- mastery eligibility
- quest progress aggregation

---

# 3. XP 必测案例

## Case XP-01 时间刷分

输入：

```text
同样成果：
A 用 60 min
B 用 300 min
```

预期：

> B 不应仅因为时间获得 5 倍 XP。

## XP-02 重复行为

第 30 次执行已经熟练的简单操作。

预期：

> XP 大幅递减。

## XP-03 真实突破

已有技能在新环境独立应用成功。

预期：

> Novelty / Transfer 对成长有合理提升。

## XP-04 失败学习

任务失败但定位根因并形成排错流程。

预期：

```text
Outcome low
Learning positive
Artifact possible
```

## XP-05 低效

长时间低效活动。

预期：

> 不扣永久历史 XP。

---

# 4. Mastery Evals

## M-01 自述

> “我已经完全掌握。”

无其他证据。

预期：

> 不允许直接 M6+。

## M-02 解释

能正确用自己的语言解释。

预期：

> E2 候选，Mastery 上限应合理。

## M-03 真实应用

在真实任务中独立应用成功。

预期：

> E4 候选。

## M-04 多次应用

跨多个任务、跨时间独立成功。

预期：

> E5 候选，Stability 提升。

## M-05 系统化

形成自己的 SOP / 判断框架。

预期：

> M8 候选，但仍需检查质量。

---

# 5. Anti-Farming Evals

测试：

- 人为拆任务
- 重复提交同一 Activity
- 复制同一 Artifact
- 重复 Confirm
- 虚报超长时长
- 已掌握低难任务反复完成
- 无关 Side Quest 刷 Main Quest

---

# 6. AI Contract Tests

AI 返回必须：

- 符合 schema
- confidence ∈ [0,1]
- Evidence ∈ E0–E6
- Mastery ∈ M0–M10
- uncertainty_notes 可为空但字段存在
- 不直接返回数据库 SQL
- 不要求客户端持有密钥

---

# 7. Prompt Regression Set

建立固定 JSON fixtures：

```text
evals/activity/
evals/mastery/
evals/review/
```

每次：

- Prompt 改动
- Model 改动
- Growth Rule 改动

运行 regression。

---

# 8. Security Tests

至少：

- User A 不能 SELECT User B
- User A 不能 UPDATE User B
- anon 不能读取私有数据
- service-role key 不进入 client
- OpenAI key 不进入 client
- Storage path 有用户隔离

---

# 9. Transaction Tests

确认 Assessment：

- 第一次成功
- 第二次重复请求不重复发 XP
- 中途失败 rollback
- assessment 非本人时拒绝
- rejected assessment 不能 confirm

---

# 10. E2E

核心 happy path：

```text
Login
→ Quick Log
→ AI Proposal
→ Confirm
→ XP
→ Skill update
→ Dashboard
→ History
```

核心 failure path：

```text
Quick Log
→ AI timeout
→ Activity 仍存在
→ Retry
→ Proposal
→ Confirm
```

---

# 11. UI QA

每页检查：

- Loading
- Empty
- Error
- Success
- Mobile
- Keyboard
- Long text
- Chinese / English mixed text
- Very large XP number
- Many nodes
- Zero nodes

---

# 12. Performance QA

重点：

- Dashboard 不做 N+1 大量查询
- Knowledge Graph 按需加载
- React Flow 大节点量不卡死
- AI 请求有 timeout / retry
- 大型 Review 不阻塞基础 Activity 保存

---

# 13. Product Quality Evals

每周测试真实问题：

1. AI 有没有虚夸成长？
2. 是否出现 XP inflation？
3. 用户是否开始刷简单任务？
4. Next Quest 是否真的推动现实目标？
5. Mastery 是否可信？
6. Weekly Review 是否提供新洞察？
7. UI 是否越来越像“数据垃圾场”？
8. 记录行为是否变得太麻烦？

---

# 14. Release Gate

任何版本发布前：

- [ ] build pass
- [ ] lint pass
- [ ] unit tests pass
- [ ] RLS tests pass
- [ ] E2E core flow pass
- [ ] AI schema regression pass
- [ ] migration reviewed
- [ ] `.env` secrets checked
- [ ] docs updated
- [ ] changelog updated
