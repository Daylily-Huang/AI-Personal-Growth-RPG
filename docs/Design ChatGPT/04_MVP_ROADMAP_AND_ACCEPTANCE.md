# AI Personal Growth RPG — MVP 开发路线图与逐阶段验收

> 版本：v0.1  
> 目的：让 Coding Agent 按“可运行的垂直切片”逐步开发，禁止一次铺开整个产品。

---

# 1. 总体原则

开发顺序必须遵循：

```text
先证明 Growth Loop 正确
→ 再做 Dashboard
→ 再做 Quest / Skill Tree
→ 再做 Knowledge Map
→ 再做 Review / Artifact
→ 最后才做 PWA、自动集成与高级游戏效果
```

每个阶段只有满足验收条件后才能进入下一阶段。

---

# 2. Milestone 0 — 仓库与基础设施

## M0-01 初始化仓库

完成：

- Next.js + TypeScript + App Router
- Tailwind CSS
- ESLint
- pnpm
- `.env.example`
- `docs/`
- 基础 README

验收：

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
```

均可正常运行。

## M0-02 接入 Supabase

完成：

- Supabase client/server helper
- 环境变量
- 本地/远端连接方式
- migrations 目录

验收：

- 服务端可读取 Supabase
- 浏览器不暴露 service-role key
- `.env.local` 不提交 Git

## M0-03 Auth

完成：

- 注册
- 登录
- 登出
- 受保护页面
- session refresh

验收：

- 未登录无法访问 `/dashboard`
- User A 与 User B 会得到不同数据作用域

---

# 3. Milestone 1 — 数据底座

## M1-01 Core Schema

优先创建：

1. profiles
2. player_states
3. domains
4. skills
5. quests
6. activities
7. ai_assessments
8. xp_transactions
9. mastery_events
10. rules_versions

## M1-02 RLS

所有用户私有表：

```text
RLS = ON
```

至少覆盖 SELECT / INSERT / UPDATE / DELETE。

验收：

- User A 无法读取 User B 数据
- anon 无法读取私有成长记录
- service-role 不存在于前端 bundle

## M1-03 Seed

只加入：

- 默认 Domain
- Growth Engine v0.1
- 测试数据（本地）

---

# 4. Milestone 2 — 第一个完整 Growth Loop

这是整个项目的第一个“必须打通”的垂直切片。

## M2-01 Quick Log

用户可以输入：

> 今天读了 1.5 小时 LC 方法，理解了 LR 与 LC 的区别，但还没有实际跑数据。

系统创建 Activity，保留原始 `raw_input`。

验收：

- 刷新后记录仍存在
- AI 失败也不会丢失 Activity

## M2-02 AI Assessment Proposal

服务器读取：

- Activity
- 相关 Skill
- Active Quest
- 最近同类 Activity
- 当前规则版本

AI 返回结构化 Proposal。

必须包含：

- activity type
- difficulty
- growth dimensions
- evidence
- mastery proposal
- XP semantic inputs / range
- confidence
- uncertainty
- next quest suggestion

此阶段不得增加正式 XP。

## M2-03 Proposal Review UI

显示：

- AI 如何理解
- 哪些 Skill 被影响
- Evidence
- Difficulty
- Mastery proposal
- XP proposal
- Confidence

用户可以：

```text
Confirm
Edit
Verify
Reject
```

## M2-04 Deterministic Growth Engine

实现纯函数：

```ts
calculateXp(input)
```

必须有：

- modifier bounds
- repetition penalty
- novelty
- evidence
- goal alignment
- quest size cap
- no-time-linear-farming

## M2-05 Confirm Transaction

用户 Confirm 后服务器原子化：

1. 验证 assessment ownership
2. 验证 pending 状态
3. 重算 XP
4. 写 `xp_transactions`
5. 写 mastery event（若允许）
6. 更新 skill cached state
7. 更新 quest progress
8. 标记 confirmed

必须幂等。

验收：

> 连点 Confirm 10 次只能计分 1 次。

---

# 5. Milestone 3 — Dashboard

实现最小首页：

- Player Level
- XP progress
- Energy / Focus / Momentum
- 1 个 Main Quest
- 1–3 个 Today Quest
- Recent Growth
- Quick Log
- Next Best Action

不做：

- 商城
- 装备
- 复杂 Avatar
- 排行榜

验收问题：

> 用户打开首页后 5 秒内是否知道“我现在状态怎样”和“下一步做什么”？

---

# 6. Milestone 4 — Quest System

实现：

- Main / Epic / Major / Standard / Minor / Micro
- parent-child
- status
- deadline
- difficulty
- goal alignment
- progress
- boss flag

首版先使用树结构。

验收：

- 子任务推进可以正确聚合上级任务
- 无关任务不能降低 Boss HP
- Failed 可保留 Learning XP

---

# 7. Milestone 5 — Skill Tree

实现：

- Domain
- Skill
- Skill relation
- XP
- Level
- Mastery
- Confidence
- React Flow UI

Skill Node 至少展示：

```text
Level
Mastery
Confidence
Evidence
XP
Last Used
Prerequisite
Next Unlock
Related Artifact
```

验收：

> 用户可以区分“XP 高”和“Mastery 高”是两件事。

---

# 8. Milestone 6 — Knowledge Map

实现：

- knowledge_nodes
- knowledge_edges
- relation type
- AI inferred
- confidence
- source/evidence
- progressive loading

禁止：

> AI 猜一个关系就永久作为事实。

验收：

- AI inferred 与 verified relation 可视化可区分
- 点击节点可追溯来源

---

# 9. Milestone 7 — Artifact

实现：

- Artifact Library
- relation to activity / skill / quest / knowledge
- version
- reuse metadata

首版类型：

```text
Protocol
Checklist
Code
Template
Research Note
Knowledge Card
Decision Framework
Workflow
Dataset
Figure
Writing
```

---

# 10. Milestone 8 — Review

## Daily

回答：

- 今天成长了什么
- 哪些活动低价值
- 新 Skill / Node / Artifact
- Main Quest progress
- 明日 Next Best Action

## Weekly

回答：

- 最大突破
- 最大问题
- 偏科
- XP inflation
- Mastery 虚高
- 低效任务
- 下周 1–3 个机制调整

## Monthly

回答：

> “这个月的我，比上个月具体强在哪里？”

---

# 11. Milestone 9 — PWA 与集成

只有前面闭环稳定后再开始。

候选：

- PWA
- Google Calendar
- Zotero
- GitHub
- Health / running data
- Browser extension

所有自动数据遵循：

```text
Detected
→ Proposed Activity
→ Interpretation
→ Confirmation
→ Growth
```

自动检测行为不等于自动 Mastery。

---

# 12. 每阶段 Definition of Done

任何 Phase 必须同时满足：

- [ ] 功能真实可用
- [ ] `pnpm build` 通过
- [ ] lint 通过
- [ ] 核心测试通过
- [ ] RLS 正确
- [ ] Loading 状态存在
- [ ] Empty 状态存在
- [ ] Error 状态存在
- [ ] Mobile 基本可用
- [ ] 不违反 SYSTEM_RULES
- [ ] 变更已记录
- [ ] README / docs 已更新

---

# 13. 第一个可演示版本的验收脚本

使用全新用户：

1. 注册
2. Onboarding 创建“完成毕业论文” Main Quest
3. 创建 Skill：Molecular Ecology
4. 输入学习 Activity
5. 得到 AI Proposal
6. 查看 Evidence / Confidence
7. Confirm
8. XP 进入 Ledger
9. Skill XP 改变
10. Dashboard 出现 Recent Growth
11. Activity 页面能追溯原始输入
12. 第二次 Confirm 不重复加 XP
13. 新用户无法读取此数据

以上 13 步全部通过，才算核心 MVP 成立。
