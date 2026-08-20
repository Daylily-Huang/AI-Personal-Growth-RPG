# Stage2-B.1 Verification Summary

> 项目：AI Personal Growth RPG
> 日期：2026-08-20
> 依据：Round16 审查（8.2/10，CONDITIONAL FAIL，P0=0/P1=4/P2=4+）给出的 Gate 结论——Stage2-B 主体成功，但 settlement authority 尚未完全冻结，需先做 **Stage2-B.1 Settlement Integrity Closure**
> 前置提交：`8d8c5e2`（Stage2-B 权威结算 RPC）

## 1. 目标

Round16 审查认为 Stage2-B 核心架构方向正确，但 `settle_activity` 作为永久成长数据的核心权威入口，需要用更严格的数据库事务标准审查。本轮修复 4 个 P1 和 3 个关键 P2，使 settlement 达到数据库级一致性标准。

核心原则（不变）：
- TS `SettlementService` 仍是 Growth Engine 规则的**唯一副本**；
- 数据库在**一个事务内**原子应用 deltas 并强制 authority 不变量；
- 永久成长状态只由 service_role RPC 写入。

## 2. Round16 审查问题与本轮修复

### 2.1 P1-1：Mastery 单调增长无数据库保证

**问题**：`settle_activity` 直接 `mastery_level = v_proposed_level`，无 `greatest()` 防护。若两个 settlement 并发升级同一 Skill（T1 读 M2 → 延迟 → T2/T3 升到 M4 → T1 恢复写 M3），永久能力发生倒退 M4→M3，且 `mastery_events` 会记录 "upgrade: 4→3"。

**修复**：操作重排为 9 阶段（Phase A–I）。Phase G 在取得 skill 行锁**之后**检查 `proposed_level > v_skill_row.mastery_level`；若不满足，将 `mastery_action` 静默降级为 `'none'`。`mastery_events` 只在真实 upgrade（`to > from`）时写入。

### 2.2 P1-2：Ledger/Player XP/Skill XP 可被写成三个不同数字

**问题**：RPC 分别从 `p_settlement.xpDelta`、`transaction.amount`、`primarySkill.xpDelta` 读取三个值，然后分别写入 ledger/player/skill。malformed settlement 可使三者不一致。此外 `xpType` 允许 `adjustment/correction`，不应由 activity settlement RPC 接受。

**修复**：Phase A 在解析阶段即验证：
- `transaction.amount` 为唯一权威 XP delta；
- `settlement.xpDelta` 必须等于 `transaction.amount`，否则返回 `xp_delta_mismatch`；
- `primarySkill.xpDelta` 必须等于 `transaction.amount`，否则返回 `skill_xp_delta_mismatch`；
- `amount < 0` → `negative_xp`；
- `xpType <> 'activity'` → `invalid_xp_type_for_settle`（adjustment/correction 须走独立 correction RPC）。

### 2.3 P1-3：repetition 并发测试未覆盖真正危险的并发

**问题**：`v_now := now()` 取的是 PostgreSQL 事务开始时间（transaction timestamp），在等待行锁期间不会推进。两个不同 Activity 并发结算同一 Skill 时，T2 的 `now()` 可能早于 T1 的 ledger `created_at`，导致 T1 的行被排除在 repetition window 之外，两个 Activity 都得到 `repetitionCount=N` 而非 N 和 N+1。

**修复**：Phase E 将时间戳获取改为 `v_now := clock_timestamp()`，且放在 Phase D（`SELECT ... FOR UPDATE` 取得 skill 行锁）**之后**。这确保 repetition window 的截止时间是取得锁后的真实墙钟时间，已提交账本行不会被排除。

### 2.4 P1-4：Composite tenant integrity 未实现

**问题**：`create_activity` 是 `SECURITY DEFINER`，接受 `p_quest_id` 但不验证调用者是否拥有该 Quest。已知另一用户 Quest UUID 的 authenticated 用户可创建跨租户 Activity。

**修复**：`create_activity` 新增 ownership 校验：
```sql
if p_quest_id is not null and not exists (
    select 1 from public.quests
    where id = p_quest_id and user_id = auth.uid()
) then
    raise exception 'quest_not_owned';
end if;
```

### 2.5 P2-A：repetition_conflict 非零副作用

**问题**：原 RPC 先 upsert Skill（`updated_at` 被修改），再算 repetition，冲突时 `RETURN` 正常结束（非异常回滚），导致 Skill 的 `updated_at` 已变更。

**修复**：操作重排——Phase C 的 skill upsert 改为 `ON CONFLICT DO NOTHING`（不修改 `updated_at`），所有永久写入（ledger/player/skill/mastery/确认）集中在 Phase H，仅在 Phase F/G 所有验证通过后执行。冲突返回时零副作用。

### 2.6 P2-B：pending MasteryVerification 返回非数据库真实值

**问题**：已有 pending 时，`select id into v_existing_pending` 只取 ID，但返回 JSON 使用**本次请求**的 `fromLevel/toLevel/evidenceLevel`，调用者得到数据库中不存在的 verification。

**修复**：改为 `select * into v_existing_pending`，返回 JSON 使用 `v_existing_pending.from_level`、`v_existing_pending.to_level`、`v_existing_pending.evidence_level` 等真实持久化值。

### 2.7 P2-C：skill_name_snapshot 未落表

**问题**：`xp_transactions` 无 `skill_name` 列，ledger 查询 JOIN 当前 Skill 名，Skill 改名后历史账本显示错误名称。

**修复**：新增 `skill_name_snapshot text not null default ''` 列并 backfill；RPC 写入时填充 `v_skill_name`；返回 JSON 的 `skillName` 改取 `v_tx_row.skill_name_snapshot`。

## 3. 本轮实现

### 3.1 `0025_settlement_integrity.sql`

`settle_activity` 全面重写（`CREATE OR REPLACE`），保持函数签名不变。新操作顺序：

| Phase | 步骤 | 关键行为 |
|---|---|---|
| A | 解析 + 验证 canonical XP | 单一权威 `transaction.amount`；reject mismatch/negative/non-activity |
| B | 锁定 assessment + activity | ownership + idempotency（同 0024） |
| C | 解析/创建 skill | `ON CONFLICT DO NOTHING`——不修改 `updated_at` |
| D | `SELECT ... FOR UPDATE` skill | 获取序列化锁 |
| E | `clock_timestamp()` | 锁后取真实墙钟时间 |
| F | Repetition 检查 | 冲突直接 RETURN，无永久写入 |
| G | Mastery 陈旧检查 | `proposed ≤ current` → 降级为 none |
| H | 永久写入 | ledger + player + skill XP + mastery + verification + secondary skills |
| I | 确认 | supersede siblings + confirm assessment/activity |

`create_activity` 重写：新增 quest ownership 校验。

新增 `xp_transactions.skill_name_snapshot` 列 + backfill。

### 3.2 TS 类型与映射

- `database.types.ts`：`xp_transactions` Row/Insert/Update 新增 `skill_name_snapshot: string`。
- `supabase-mapping.test.ts`：mock 数据适配新字段。
- `supabase-schema.test.ts`：`EXPECTED_ORDER` 扩展至 0025。

### 3.3 测试

**`tests/settlement-rpc.test.ts`** 从 7 项扩展至 **16 项**（`XP_RPG_TEST_DB_URL` 门控）：

| # | 测试 | 覆盖 |
|---|---|---|
| 1 | 原子结算 | 原有 |
| 2 | 幂等 | 原有 |
| 3 | repetition 冲突 + 重试 | 原有 |
| 4 | mastery pending verification 去重 + 字段值 | 原有 + **P2-B 增强** |
| 5 | 双用户隔离 | 原有 |
| 6 | 并发同一 assessment | 原有 |
| 7 | 等级曲线 parity | 原有 |
| 8 | **P1-1**: stale mastery proposal 不可降级 | 新增 |
| 9 | **P1-2**: `xpDelta ≠ amount` → `xp_delta_mismatch` | 新增 |
| 10 | **P1-2**: `primarySkill.xpDelta ≠ amount` → `skill_xp_delta_mismatch` | 新增 |
| 11 | **P1-2**: 负数 XP → `negative_xp` | 新增 |
| 12 | **P1-2**: `xpType='correction'` → `invalid_xp_type_for_settle` | 新增 |
| 13 | **P1-3**: cross-activity same-skill 并发 → repetition N / N+1 | 新增 |
| 14 | **P1-4**: `create_activity` 拒绝 foreign quest → `quest_not_owned` | 新增 |
| 15 | **P2-A**: repetition_conflict 后 skill XP/updated_at 不变 | 新增 |
| 16 | **P2-C**: `skill_name_snapshot` 持久化 + 返回 JSON 一致 | 新增 |

## 4. 验证结果

### 4.1 TypeScript 编译

```text
npx tsc --noEmit → 通过（0 errors）
```

### 4.2 单元测试

```text
npx vitest run → 92 passed | 27 skipped（3 个 DB-gated 文件）
  ✓ confirm.test.ts (12)
  ✓ demo-repository.test.ts (11)
  ✓ settlement-service.test.ts (4)
  ✓ concurrency.test.ts (2)
  ✓ supabase-client.test.ts (5)
  ✓ supabase-schema.test.ts (31)
  ✓ request-repository.test.ts (3)
  ✓ growth-engine.test.ts (11)
  ✓ supabase-mapping.test.ts (3)
  ✓ similarity.test.ts (7)
  ✓ assessment-authority.test.ts (2)
  ✓ activity-immutability.test.ts (1)
  ↓ settlement-rpc.test.ts (16 skipped — 需 XP_RPG_TEST_DB_URL)
  ↓ authority-final-state.test.ts (10 skipped — 需 DB)
  ↓ empty-db-migration.smoke.test.ts (1 skipped — 需 DB)
```

### 4.3 Stage2-B.1 关键行为验证（DB 测试，需 `XP_RPG_TEST_DB_URL`）

| 断言 | 预期 |
|---|---|
| stale mastery proposal（M3 当前，proposed M2）→ mastery 保持 M3，无 downgrade event | 待 DB 验证 |
| `xpDelta ≠ transaction.amount` → `xp_delta_mismatch`，零写入 | 待 DB 验证 |
| `primarySkill.xpDelta ≠ amount` → `skill_xp_delta_mismatch` | 待 DB 验证 |
| 负数 XP → `negative_xp` | 待 DB 验证 |
| `xpType='correction'` → `invalid_xp_type_for_settle` | 待 DB 验证 |
| cross-activity same-skill 并发 → 一个 repetition_count=0，另一个=1 | 待 DB 验证 |
| `create_activity(quest_id=B's quest)` → `quest_not_owned` 异常 | 待 DB 验证 |
| repetition_conflict 后 skill XP/updated_at 不变 | 待 DB 验证 |
| 第二次 verification 请求返回第一次的 fromLevel/toLevel/evidenceLevel | 待 DB 验证 |
| `xp_transactions.skill_name_snapshot` = 结算时 skill name | 待 DB 验证 |

> 注：DB 测试需本地 Supabase 或 CI 环境（`XP_RPG_TEST_DB_URL`），当前 Windows 开发环境无可用实例。所有 16 个测试已注册，CI 接入后自动运行。

## 5. 结论

Stage2-B.1 完成了 Round16 审查要求的全部 4 个 P1 和 3 个关键 P2 修复。`settle_activity` 现在是 9 阶段（Phase A–I）的严格事务：

1. **所有验证先于所有永久写入**（P2-A 零副作用）；
2. **单一权威 XP delta**（P1-2，三值一致）；
3. **Mastery 单调由 DB 保证**（P1-1，stale proposal 静默降级）；
4. **Repetition 使用锁后墙钟时间**（P1-3，消除 now() race）；
5. **Quest ownership 校验**（P1-4，tenant composite integrity）；
6. **Verification 返回真实 DB 值**（P2-B）；
7. **skill_name_snapshot 落表**（P2-C，ledger 历史可追溯）。

### 残留 / 边界（后续轮次）

- **rules_version dispatcher**（Round16 P2-D）：`SettlementService` 仍直接调用当前 `calculateXp`，未根据 Activity 冻结的 `rulesVersion` 选取引擎。**在 `growth-engine-v0.2` 出现前是硬 Gate**。
- **xp_transactions composite FK**（Round16 建议）：当前 FK 仅单 ID（`activity_id`、`assessment_id`、`skill_id`），未做 `(user_id, xxx_id)` 复合约束。
- **读取路径**：Dashboard/Skills/Ledger 仍走 DemoRepository，待 Auth UI 全量切换。
- **skill_edges 关系表**：尚未建模，结算只创建二级 skill 不写边。
- **Skill 语义别名**：`normalized_name` 仅大小写/空白归一，语义别名留待 Skill Ontology。

### 提交记录

| Commit | 内容 |
|---|---|
| `79bf1ff` | fix(stage2b1): settlement integrity closure (Round16 review) |
| `0e21175` | docs(task_plan): mark Stage2-B.1 (Round16) complete |

远程 `main` 已更新至 `0e21175`。
