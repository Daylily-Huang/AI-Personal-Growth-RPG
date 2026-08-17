# Round5 跟进摘要（供 Round6 审查）

对应 `docs/Check/Round5.txt` 结论：**Milestone 2.6 PASS；上 Supabase 前先做 `Milestone 2.7 — Growth Settlement Integrity`**。

本轮只做 2.7 的 10 项 + invariant tests，**无新 UI、无 Supabase、无 Quest/Knowledge/Artifact、无大规模重构**，收敛优先。

## IN SCOPE（Round5 10 项）

1. 一个 Activity 最多一笔原始 activity XP 结算
2. 支持 Assessment revision，但不能重复发 XP
3. `XpTransaction.xpType`（activity | adjustment | correction）
4. 同类 Activity 并发 → repetition snapshot 正确（原子边界内计算 + conflict）
5. settlement optimistic concurrency / retry（`repetition_conflict` → 服务端重试）
6. Activity 创建时冻结 `rulesVersion`；ledger 记录冻结版本
7. 移除 mock `base_value` 对 `totalMinutes` 的直接奖励
8. pending Mastery verification 唯一性（绑定 skill_id not null）
9. 明确 primary-only skill XP policy（文档 + invariant 测试）
10. Skill 稳定 ID（name 不再是永久身份）

## OUT OF SCOPE

- Supabase / Auth / RLS / SupabaseRepository / migrations 真正执行
- 新 UI、Quest/Knowledge/Artifact
- AI 上下文增强（把 Skill Catalog+Mastery 放进 prompt）——属 skill ontology，留到后续
- 双 Agent 评估

---

## 1+2. 一个 Activity 最多一笔原始结算（Assessment revision 不重复发 XP）

- 服务端：`DemoRepository.applySettlement` 在原子写内检查 `xpType='activity'` 是否已存在该 Activity → 有则返回 `already_settled`，不落账。
- 存储层：`0009` 新增部分唯一索引：

```sql
create unique index xp_transactions_one_activity_settlement_idx
  on xp_transactions (activity_id) where xp_type = 'activity';
```

- Assessment revision 照常允许（`addAssessment` 对已 confirmed 的活动不降级状态），只是无法再造一笔原始 XP。
- 测试：`confirm.test.ts` 同活动两 Assessment → 1 笔 ledger、总 XP 不变、revision 数量 2。

## 3. xpType

```ts
xpType: "activity" | "adjustment" | "correction";   // XpTransaction
xp_type text not null default 'activity'             // 0009 已有，TS 现已同步
```

- 服务端所有正常结算 `xpType = "activity"`。
- 未来 correction/adjustment 另起交易，天然避开 activity 唯一索引。

## 4+5. 同类并发 repetition snapshot + optimistic concurrency / retry

关键改动：**authoritative repetition count 在原子 applySettlement 内部、基于已提交视图重新计算**（`countRecentSimilar` 作为共享纯规则模块，被 store 引用），而不是只信服务端读到的旧快照。

```text
服务端读快照 → 算 count → 构造 settlement
  ↓ applySettlement（原子）
    存储端基于已提交 ledger 重算 authoritative count
    不一致 → { repetition_conflict, actualRepetitionCount }（不写任何东西）
  ↓ 服务端拿到 conflict → 用 fresh count 自动重试（最多 3 次）
```

- 测试：
  - `concurrency.test.ts`：同 skill + 同 type 并发两次结算 → `counts == [0, 1]`，且两条 XP 分别等于 `calculateXp(count=0/1)` 的确定性值，首次 > 重复。
  - `demo-repository.test.ts`：塞一个错误 count 的 settlement → `repetition_conflict` + `actualRepetitionCount=0` + 零写入。
- Demo 单进程同步读写天然原子；Supabase 阶段该逻辑落在 DB 事务/RPC 内，同样一条 `current += delta` + 快照一致性。

## 6. rulesVersion 冻结

- `Activity.rulesVersion` 创建时冻结（`RULES_VERSION`）。
- ledger `transaction.rulesVersion = activity.rulesVersion`（不是部署时引擎版本）。
- 测试：`confirm.test.ts` 断言 `transaction.rulesVersion === activity.rulesVersion === RULES_VERSION`。
- 未来引擎升级即引入 version→engine 注册表（单引擎 v0.1 时先定好字段与边界）。

## 7. mock 不再把时间计入 base_value

`src/lib/ai/assess.ts`：

```ts
// 修正前
base_value = min(30, 10 + evidence*3 + floor(totalMinutes/30))
// 修正后
base_value = min(30, 10 + evidence*3)
```

时间只经 `effectiveMinutes → timeFactor`（封顶 1.00–1.15）进入确定性引擎；任务规模走 Quest Size / workload scale（产品规则，docs/02 #71）。

## 8. pending verification 唯一性

- migration `0010`：`skill_id uuid not null references skills(id)` + 部分唯一索引 `(user_id, skill_id) where status='pending'`（不再依赖 nullable + 普通 UNIQUE 的 NULL 坑）。
- Demo 存储端在 applySettlement 内去重：同一 skill 已有 pending 则跳过再建。
- 测试：`demo-repository.test.ts` 两次验证请求 → 仅 1 条 pending。

## 9. primary-only skill XP policy（明确为产品规则）

docs/02 #71 + docs/06 §14：

```text
一次结算 XP 100% 归主技能（affected_skills[0]）
副技能只建节点/关联/证据，不拿 XP，不产生 ledger 行
绝不给多个技能各加全额（凭空双倍 XP）
```

- 测试：`confirm.test.ts` 多技能提议 → 仅 1 笔 ledger、主技能拿 XP、副技能 xp=0/mastery 不变。

## 10. Skill 稳定 ID

- `SkillState` 增加 `id`（永久身份）+ `aliases`（AI 匹配辅助）。
- Demo 存储按 `id` 键控技能（`Record<id, SkillState>`），`resolveSkillId(label)` 按 name/alias 解析或创建；`XpTransaction.skillId`、`MasteryVerification.skillId` 引用稳定 id。
- 旧 `.data`（v1/v2）自动迁移：重 key 到 id，旧 name 变成 alias。
- 测试：同一 label 两次 `resolveSkillId` → 同一 id；多次结算同技能 → 同一 `skillId`。
- SkillTree UI 仍按 name 渲染（视觉层），id 化 UI 接线与 ontology 留到 Milestone 3。

---

## 文件清单

```text
src/lib/store/types.ts              # xpType / skillId+aliases / rulesVersion / ConfirmResult.actualRepetitionCount / Db v3
src/lib/store/repository.ts         # resolveSkillId + SettlementResult(reasons/actualCount) + 原子结算保证注释
src/lib/store/demo-repository.ts    # v3 + normalize 旧库 + 活动级幂等 + repetition 冲突 + 验证去重
src/lib/store/settlement.service.ts # xpType / 冻结 rulesVersion / conflict 自动重试
src/lib/ai/assess.ts                # mock base_value 去时间
supabase/migrations/0009_xp_transactions.sql   # 活动级部分唯一索引
supabase/migrations/0010_mastery_verifications.sql # skill_id not null + pending 唯一
docs/Design ChatGPT/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md
docs/Design ChatGPT/02_PRODUCT_DESIGN.md        # primary-only + time≠XP 产品规则
tests/confirm.test.ts               # 活动幂等 / xpType / 冻结版本 / primary-only / skill id 稳定（11）
tests/demo-repository.test.ts       # conflict / already_settled / pending 去重 / skill id（8）
tests/concurrency.test.ts           # 同技能同类并发 repetition 快照（2）
docs/Check/Round5_FIX_SUMMARY.md    # 本文件
```

## 验证

```text
pnpm lint                → 0 error / 0 warning
pnpm test                → 6 files / 43 tests passed
pnpm harness:deterministic → 11 tests passed
pnpm build               → 成功
旧 .data 迁移             → normalize 路径（重 key + backfill）冒烟通过
```

## 下一步

提交单独 commit → 等下一轮 Gate Review。通过后进入 **Milestone 3 — Supabase Foundation**（完整 MVP migrations → Auth → RLS → user-scoped repository → SupabaseRepository → DB atomic settlement/RPC → empty DB migration test）。
