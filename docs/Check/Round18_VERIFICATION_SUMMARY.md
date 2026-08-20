# Stage2-B Final Freeze Patch — Verification Summary

> 项目：AI Personal Growth RPG
> 日期：2026-08-20
> 依据：Round18 审查（8.8/10，P0=0/P1=2/P2=4）——new-Skill Mastery NULL 漏洞 + 真实 DB gate 未跑
> 前置提交：`536cb57`（Stage2-B.2 verification summary）

## 1. 目标

Round18 审查指出两个最后障碍：(1) 新 Skill 的 `mastery_level` 为 NULL 时，Phase G 比较 `proposedLevel <= NULL` 返回 unknown 而非 true，允许 proposedLevel=0 绕过防护降级到 M0；(2) 所有 DB 测试仍为 skipped，无实际运行证据。本轮修复 NULL 漏洞并**真实运行完整 DB test gate**。

## 2. 修复

### 2.1 P1-1：Mastery NULL 漏洞

**问题**：0026 的 Phase C+D 使用 advisory lock + 延迟 Skill 创建。当 Skill 不存在时 `v_skill_row` 为空 → `v_skill_row.mastery_level = NULL`。Phase G 的 `if v_proposed_level <= v_skill_row.mastery_level` 在 NULL 情况下返回 unknown，不触发降级。malformed payload `proposedLevel=0` 穿透到 Phase H，将默认 M1 降到 M0。

**修复**：`0027_mastery_null_closure.sql` 引入 `v_current_mastery integer`，在 Skill lookup 后设 `v_current_mastery := coalesce(v_skill_row.mastery_level, 1)`。Phase G 全部比较基于此权威值。verification `fromLevel` 也直接取 `v_current_mastery`（不信 client）。

### 2.2 P1-2：真实 DB Gate

**执行**：`supabase db reset` → 0001→0027 全部应用成功 → `XP_RPG_TEST_DB_URL=postgresql://... vitest run` 完整运行。

## 3. 真实 DB 测试结果

```text
supabase db reset → 0001..0027 全部成功

✓ tests/settlement-rpc.test.ts (21 tests) 560ms
✓ tests/authority-final-state.test.ts (10 tests) 68ms
✓ tests/empty-db-migration.smoke.test.ts (1 test) 55ms

Test Files  3 passed (3) — DB-gated，0 skipped
Tests       32 passed (32) — 0 skipped
```

全量测试套件：

```text
✓ tests/confirm.test.ts (12)
✓ tests/demo-repository.test.ts (11)
✓ tests/settlement-service.test.ts (4)
✓ tests/concurrency.test.ts (2)
✓ tests/supabase-client.test.ts (5)
✓ tests/supabase-schema.test.ts (31)
✓ tests/growth-engine.test.ts (11)
✓ tests/request-repository.test.ts (3)
✓ tests/supabase-mapping.test.ts (3)
✓ tests/similarity.test.ts (7)
✓ tests/assessment-authority.test.ts (2)
✓ tests/activity-immutability.test.ts (1)
✓ tests/settlement-rpc.test.ts (21)        ← DB
✓ tests/authority-final-state.test.ts (10)  ← DB
✓ tests/empty-db-migration.smoke.test.ts (1) ← DB

Test Files  15 passed (15)
Tests       124 passed (124) — 0 skipped
```

## 4. 关键行为验证（真实 PostgreSQL）

| 断言 | 结果 |
|---|---|
| 0001→0027 迁移链全部成功 | **PASS** |
| create_activity ACTIVE-only rules_version | **PASS** |
| 无 active → `no_active_rules_version` | **PASS** |
| settle_activity EXECUTE 仅 service_role | **PASS** |
| 原子结算（账本/player/skill/确认） | **PASS** |
| 幂等（同一 assessment 二次结算失败） | **PASS** |
| repetition 冲突 + 乐观重试 | **PASS** |
| mastery pending verification 去重 + 返回真实 DB 值 | **PASS** |
| 双用户隔离 | **PASS** |
| 并发同一 assessment 恰一个成功 | **PASS** |
| stale mastery proposal 不可降级 | **PASS** |
| canonical XP mismatch/negative/xpType 拒绝 | **PASS** (4项) |
| cross-activity same-skill 并发 → N / N+1 | **PASS** |
| quest ownership 校验 | **PASS** |
| repetition_conflict 零副作用 | **PASS** |
| skill_name_snapshot 持久化 | **PASS** |
| 新 Skill + repetition_conflict 无 orphan | **PASS** |
| skill_name mismatch 拒绝 | **PASS** |
| stale request_verification 降级 | **PASS** |
| **新 Skill + upgrade M0 → 保持 M1** | **PASS** |
| **新 Skill + request_verification M1→M1 → 无 verification** | **PASS** |
| SQL 等级曲线 parity | **PASS** |

## 5. 结论

**Stage2 Settlement Authority 正式 Frozen。**

真实 PostgreSQL 环境下 0001→0027 迁移链完整应用，124/124 测试通过，0 skipped。Mastery 单调增长不变量现在由数据库保证（包括新 Skill NULL 边界），XP 单一权威值、repetition 序列化、tenant composite integrity、skill_name_snapshot 读写闭环全部经过真实 DB 验证。

### 残留 / 边界（不阻止下一阶段）

- **Composite FK**：`xp_transactions` FK 仍为单 ID，待 correction/admin pipeline 前补。
- **rules_version dispatcher**：在 `growth-engine-v0.2` 出现前是硬 Gate。
- **Skill 语义别名**：`normalized_name` 仅大小写/空白归一，aliases 未进入 RPC 查找。
- **Secondary Skill 并发 deadlock**：理论上的 lock-order inversion，PG deadlock detection 兜底。
- **读取路径**：Dashboard/Skills/Mastery queue 仍走 DemoRepository，待 Auth UI 全量切换。

### 提交记录

| Commit | 内容 |
|---|---|
| `e7e3f84` | fix(freeze): mastery NULL closure + real DB gate green (Round18) |

远程 `main` 已更新至 `e7e3f84`。
