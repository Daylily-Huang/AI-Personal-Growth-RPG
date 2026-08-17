# Round6 跟进摘要（供 Round7 审查）

对应 `docs/Check/Round6.txt`：**Milestone 2.7 = 8.6/10 CONDITIONAL PASS**。按审查指示，**不开大 2.8**，只做一个小而准的 **Supabase Preflight Fix**（6 项），做完即停、进 Milestone 3。

## IN SCOPE（6 项）

1. Skill ID → 随机 UUID（运行时绝不由名字派生）+ normalized alias 查找 + 防 slug collision/overwrite
2. repetition 改按 **skillId** 判定（aliases 收敛同一技能仍算重复）
3. Skill 创建移入原子 settlement（无副作用 lookup）；Repository 返回权威 persisted 结果
4. 修 zombie pending：已 confirmed 的 Activity 409（方案 B），并自动 supersede 同 Activity 的其他 pending revision
5. 权威返回 masteryVerification（创建 or 既有 pending）
6. `xp_type` 数据库 CHECK

## OUT OF SCOPE

- Supabase / Auth / RLS / SupabaseRepository / migrations 真正执行（Milestone 3）
- 完整 0001–0008 schema bootstrap（Milestone 3）
- Rules version→engine registry（Gate 标记：首次 bump 前必须做，现在单引擎 v0.1 无实际 bug）
- correction pipeline / adjustment 写入

---

## 1. Skill Identity hardening

- 运行时创建技能一律 `id = crypto.randomUUID()`；`slugSkillId()` 删除，**不再由名字推导 ID**。
- 查找用 **normalized label**（`trim + lowercase + 折叠空白`）：`"Statistics"`/`" statistics "`/`"statistics"` 解析到同一技能，杜绝大小写触发覆盖。
- `resolveSkillId()`（会写库）→ 改名为 **`lookupSkillId()`**：**纯只读**，未知返回 `null`，绝不创建。
- 旧 v2/v3 数据迁移：仅在迁移用确定性 v5 UUID 重建 id；**已存在的随机 UUID 原样保留**（修掉读时重派导致 id 漂移的 bug）。
- 测试：`lookupSkillId unknown -> null 且零写入`；`Regression Analysis` / `Regression   Analysis` / `regression analysis` → 同一 id，且技能 xp=10 **未被重置**。

## 2. repetition 改按 skillId

- `countRecentSimilar()` 参数 `skillName` → `skillId`，匹配 `tx.skillId === params.skillId`。
- 别名收敛到同一技能时仍计入重复（`Statistics` 与 `统计学` 不再绕过 anti-farming）。
- service 用 `lookupSkillId()` 拿稳定 id 再统计；未知名技能 → count 0（无历史可重复）。
- 测试：`similarity.test.ts` 全部改 skillId；同技能并发 `counts==[0,1]` 保持。

## 3. Settlement atomicity

- `SettlementToApply` 不再携带 `primarySkill.id` / `newEdges`；只带显示 label，`resolve/create skill`、相关节点 + related 边（按 skillId）全部在 **`applySettlement` 原子单元内**完成。
- `applySettlement` 返回权威结果：

```ts
{ ok, skillId, transaction, masteryVerification: created | existingPending | null }
```

- service 的 `transaction` / `masteryVerification` 一律用**返回的权威对象**，不再相信自己预生成的 phantom id。

## 4. Assessment revision lifecycle（杀僵尸）

- 方案 B：已 `confirmed` 的 Activity 再 Assess → `ActivityAlreadySettledError` → API `409 activity_already_settled`。
- 同一 Activity 在确认前有多份 pending revision 时，确认其中一份 → **其余自动标记 `superseded`**，不再被 `listPendingAssessments()` 返回。
- 测试：`confirm.test`（revision 被 superseded、pending 队列清空）；`demo-repository.test`（re-assess 409、防御性 already_settled 纵深）。

## 5. 权威 masteryVerification 返回

- 去重时不再“跳过并返回幽灵 NEW-123”：存在既有 pending 就返回**那条**；否则创建后返回创建对象。`okB.masteryVerification.id === okA.masteryVerification.id` 有测试断言。

## 6. xp_type CHECK（DB 不变量）

```sql
xp_type text not null default 'activity'
  check (xp_type in ('activity', 'adjustment', 'correction'))
```

拼写错误（`activty`/`Activity_`）无法绕过 activity 唯一索引。

---

## 文件清单

```text
src/lib/store/types.ts              # Db v4 / superseded / SettlementToApply 无副作用 / SkillEdge 用 id
src/lib/store/repository.ts         # lookupSkillId（只读）+ SettlementResult 权威返回
src/lib/store/demo-repository.ts    # UUID 技能 / normalized 匹配 / 原子 resolve+create / supersede / 权威返回 / 旧库迁移
src/lib/store/settlement.service.ts # lookup 无副作用 + skillId 判重 + 权威对象返回
src/lib/store/similarity.ts         # 按 skillId 判相似
src/app/api/skills/route.ts         # 节点=skill.id，边=sourceId/targetId
src/app/api/activities/[id]/assess/route.ts # 409 activity_already_settled
supabase/migrations/0009_xp_transactions.sql # xp_type CHECK
docs/Design ChatGPT/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md
docs/Check/Round6_FIX_SUMMARY.md    # 本文件
tests/*                             # similarity/demo-repository/confirm/settlement-service/concurrency 全部适配 + 新 invariant
```

## 验证

```text
pnpm lint                 → 0 error / 0 warning
pnpm test                 → 6 files / 46 tests passed
pnpm harness:deterministic → 11 tests passed
pnpm build                → 成功
旧 .data（slug id）迁移     → v5 重建 UUID + 引用重映射，冒烟通过
```

## 下一步

进入 **Milestone 3 — Supabase Foundation**（完整 MVP migrations → Auth → RLS → request-scoped Supabase client → SupabaseRepository → PostgreSQL settlement RPC/事务 → 空库 migration 测试 → 真实集成测试）。该阶段审查重点切到数据库约束 / RLS 隔离 / RPC 原子性。需要我先给一份 Supabase 落库 + RLS + 密钥分配清单供过目再动。
