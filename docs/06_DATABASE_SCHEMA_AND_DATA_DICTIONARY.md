# AI Personal Growth RPG — 数据库 Schema 与数据字典

> 版本：v0.1  
> 数据库：PostgreSQL / Supabase  
> 原则：事实表、AI 判断、正式成长账本必须分离。

---

# 1. Source of Truth

```text
Auth identity        → Supabase Auth
Raw reality record   → activities
AI interpretation    → ai_assessments
Evidence              → evidence_records
XP history            → xp_transactions
Mastery history       → mastery_events
Current cached state  → skills / player_states
Rules                 → rules_versions
```

---

# 2. 所有私有表通用字段

建议：

```sql
id uuid primary key default gen_random_uuid(),
user_id uuid not null references auth.users(id),
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

RLS：

```sql
user_id = auth.uid()
```

---

# 3. profiles

用途：玩家基本设置。

核心字段：

```text
id
display_name
timezone
onboarding_completed
created_at
updated_at
```

---

# 4. player_states

用途：当前缓存与临时状态。

```text
user_id
player_level
total_xp
energy
focus
momentum
stress
updated_at
```

注意：

> `total_xp` 是缓存，最终依据始终是 XP Ledger。

---

# 5. domains

支持层级：

```text
Research
└── Molecular Ecology
```

字段：

```text
name
slug
description
parent_id
sort_order
```

---

# 6. skills

```text
domain_id
name
description
level
xp
mastery_level
mastery_confidence
status
last_used_at
```

`mastery_level` 范围：

```text
0–10
```

---

# 7. skill_edges

relation_type：

```text
parent
prerequisite
related
unlocks
```

附：

```text
confidence
created_by
```

---

# 8. knowledge_nodes

```text
title
description
domain_id
mastery_level
confidence
status
last_reviewed_at
last_used_at
```

---

# 9. knowledge_edges

必须包含：

```text
source_node_id
target_node_id
relation_type
confidence
source_type
source_reference
ai_inferred
```

relation_type 可包括：

```text
is_a
part_of
causes
depends_on
contrasts_with
supports
applies_to
derived_from
related_to
evidence_for
```

---

# 10. quests

```text
parent_quest_id
title
description
quest_type
quest_size
status
difficulty
goal_alignment
progress
deadline
is_main_quest
is_boss
completed_at
```

quest_type：

```text
learning
skill
production
physical
maintenance
reflection
```

status：

```text
locked
available
active
paused
completed
failed
archived
```

---

# 11. activities

活动是现实事实记录。

```text
quest_id
title
raw_input
activity_type
status
started_at
ended_at
total_minutes
effective_minutes
completion
```

关键：

> 永远保留 `raw_input`。

---

# 12. ai_assessments

```text
activity_id
rules_version
prompt_version
model_name
assessment_json
confidence
status
confirmed_at
```

status：

```text
pending
confirmed
edited
rejected
```

---

# 13. evidence_records

```text
activity_id
skill_id
knowledge_node_id
evidence_level
evidence_type
description
verified
```

---

# 14. xp_transactions

应尽量 append-only。

```text
activity_id
quest_id
assessment_id        -- UNIQUE：一个 assessment 至多产生一笔结算
domain_id
skill_id
activity_type        -- 结算时的活动类型，用于重复惩罚的 similarity 判定
repetition_count     -- 结算时的相似行为计数（服务器权威结果，非 AI 估算）
repetition_penalty   -- 结算时的重复修正系数（Growth Engine 结果）
xp_type
amount
base_amount
modifier_json
reason
rules_version
```

**强制约束（必做）**：

```sql
-- 一个 assessment 只能被结算一次，数据库层面兜底并发幂等
alter table xp_transactions
  add constraint xp_transactions_assessment_id_key unique (assessment_id);
```

修正 XP 时：

```text
新增 adjustment transaction
```

不直接修改旧记录。

---

# 15. mastery_events

```text
skill_id
knowledge_node_id
activity_id
evidence_id
from_level
to_level
confidence
event_type
reason
```

event_type：

```text
upgrade
confidence_refresh
confidence_decay
correction
```

---

# 16. artifacts

```text
title
artifact_type
description
version
storage_path
external_url
reusability_score
```

---

# 17. artifact_links

建议 polymorphic 关系不要一开始过度复杂。

可使用：

```text
artifact_id
entity_type
entity_id
relation_type
```

并在应用层严格校验。

---

# 18. reviews

```text
review_type
period_start
period_end
summary_json
narrative
```

review_type：

```text
daily
weekly
monthly
chapter
```

---

# 19. rules_versions

```text
version
status
config_json
description
activated_at
```

status：

```text
draft
active
archived
```

---

# 20. 推荐 Migration 顺序

```text
0001_profiles
0002_player_states
0003_domains
0004_skills
0005_quests
0006_activities
0007_ai_assessments
0008_evidence
0009_xp_transactions
0010_mastery_events
0011_knowledge_graph
0012_artifacts
0013_reviews
0014_rules_versions
0015_indexes
0016_rls
```

---

# 21. 索引建议

至少评估：

```text
activities(user_id, created_at desc)
xp_transactions(user_id, created_at desc)
skills(user_id, domain_id)
quests(user_id, status)
knowledge_nodes(user_id, domain_id)
ai_assessments(activity_id, status)
```

---

# 22. 事务边界

确认 Assessment 必须原子化处理：

```text
assessment pending?
↓
xp transaction
↓
mastery event
↓
quest progress
↓
cached skill update
↓
assessment confirmed
```

任何一步失败：

> 整体 rollback。

---

# 23. 幂等

建议对正式结算来源建立唯一约束。

概念：

```text
unique confirmed settlement per assessment_id
```

确保重复请求不会重复发 XP。

## 23.1 Sequential vs Concurrent 幂等（重要区分）

| 场景 | 含义 | 当前实现 |
| --- | --- | --- |
| **Sequential idempotency** | 同一个 assessment 按顺序确认两次：第一次成功，第二次返回 `already_confirmed`，账本只记 1 笔 | ✅ 已实现 + 单测覆盖 |
| **Concurrent idempotency（单进程）** | 两个确认请求几乎同时到达 | ✅ 本地 JSON store 的 `confirmAssessment` 是**同步读改写**（Node 单线程内原子完成），并发调用实际仍串行，账本只记 1 笔（已有 Promise.all 测试） |
| **Concurrent idempotency（跨进程 / 多实例）** | 多个 Node 进程 / 多台机器同时确认同一个 assessment | ❌ 尚未保证。必须靠数据库 `UNIQUE(assessment_id)` 兜底（两个 INSERT 只会成功一个，另一个触发 unique constraint） |

因此本地 Demo 阶段的结论是：

```text
顺序幂等：已保证
并发幂等：单进程内已保证；跨进程/多实例需数据库 UNIQUE 约束
```

这也就是接入 Supabase/PostgreSQL 时 `xp_transactions.assessment_id UNIQUE` 必须一次性建好的原因。

---

# 24. 删除策略

Activity 删除若已经产生正式交易：

禁止仅：

```sql
delete from activities
```

应：

1. 创建 XP correction
2. 创建 mastery correction（若需要）
3. reconciliation
4. soft delete Activity

---

# 25. Reconciliation

系统必须保留开发工具，可根据：

```text
xp_transactions
mastery_events
```

重建：

```text
skills.xp
skills.level
player_states.total_xp
```

---

# 26. 数据导出

必须能够映射为：

```text
JSON
CSV
Markdown summary
```

用户的数据不能被锁死在产品中。
