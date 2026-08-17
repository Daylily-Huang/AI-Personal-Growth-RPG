# AI Personal Growth RPG — 项目治理、版本与变更控制

> 版本：v0.1

---

# 1. 为什么需要此文档

这个项目的最大风险之一不是代码 bug，而是：

> 开发过程中规则逐渐漂移，最后变成普通 Todo + XP App。

因此核心规则、产品规则和实现规则必须有明确变更层级。

---

# 2. 规则层级

```text
L0 Growth Constitution
L1 Product Rules
L2 Technical Architecture
L3 Implementation Detail
```

越靠上，越不能随意改。

---

# 3. L0 变更

例如：

- XP 是否奖励时间
- XP 与 Mastery 是否分离
- Evidence 是否必须
- AI 是否可以直接授予永久成长

必须：

1. 明确提出修改
2. 写出修改原因
3. 分析副作用
4. 给出 A/B 方案
5. 用户明确确认
6. bump rules_version

---

# 4. L1 变更

例如：

- Dashboard 信息结构
- Quest 类型
- Skill Tree 与 Knowledge Map 是否分离

需要：

- 说明原因
- 更新 PRODUCT_DESIGN
- 更新 acceptance tests

---

# 5. L2 变更

例如：

```text
Supabase → 其他 Postgres 服务
React Flow → 其他图库
Vercel → 其他部署
```

可以修改，但必须创建 ADR。

---

# 6. L3 变更

例如：

- 组件命名
- hook 拆分
- SQL index
- CSS 实现

Coding Agent 可自主决定。

---

# 7. Versioning

建议：

```text
Product spec: v0.1
Growth rules: growth-engine-v0.1
Prompt: activity-evaluator-v0.1
DB migration: sequential migration
App release: 0.1.0
```

---

# 8. CHANGELOG

每次 release 记录：

```text
Added
Changed
Fixed
Rules Impact
Migration Required
Prompt Changed
```

---

# 9. ADR

重大技术决策记录：

```text
docs/ADR/0001-...
```

模板：

```md
# Title

Status:
Date:

## Context

## Decision

## Alternatives

## Consequences
```

---

# 10. Scope Control

每个开发任务必须写：

```text
In Scope
Out of Scope
Acceptance Criteria
```

防止 Coding Agent 顺手扩张产品。

---

# 11. Bug 与规则问题必须分开

例如：

> “一个 Activity 加了两次 XP。”

这是：

```text
Bug
```

而：

> “重复行为到底应该衰减 40% 还是 60%？”

这是：

```text
Rule Design
```

不能把第二类问题当普通代码修复擅自改掉。

---

# 12. 数据 Migration 原则

任何 migration：

- 可解释
- 可重复部署
- 不依赖手工 Dashboard 操作
- 有 rollback / recovery 思路
- 重大迁移前有备份

---

# 13. AI Prompt 变更

Prompt 变动若可能改变评分：

> 必须 bump prompt_version。

旧 assessment 必须保留旧 prompt_version。

---

# 14. Rules Migration

默认：

> 新规则只作用于新 Activity。

不要自动用新规则重算历史。

若未来决定重算：

- 先 dry-run
- 展示差异
- 用户确认
- 保留旧账本或 adjustment history

---

# 15. 项目原则

开发 Agent 必须记住：

> “代码是实现规则的工具，不是重新设计规则的许可证。”
