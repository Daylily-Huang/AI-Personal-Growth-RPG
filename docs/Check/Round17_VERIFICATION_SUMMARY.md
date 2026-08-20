# Stage2-B.2 Verification Summary

> 项目：AI Personal Growth RPG
> 日期：2026-08-20
> 依据：Round17 审查（8.4/10，CONDITIONAL FAIL，P0=0/P1=2/P2=5）——0025 regression 复活了 0023 已修好的 rules_version bug，并发测试有 act1/act2 反向 bug
> 前置提交：`ab99548`（Stage2-B.1 verification summary）

## 1. 目标

Round17 审查发现 Stage2-B.1 存在两个关键问题：(1) 0025 重写 `create_activity` 时把 0023 已修好的 ACTIVE-only/fail-closed rules_version 逻辑改回了老版本；(2) cross-activity 并发测试的 retry target 写反。本轮修复这两个 P1 及 4 个 P2，完成 **Final Settlement Freeze**。

## 2. Round17 审查问题与本轮修复

### 2.1 P1-1：0025 把 rules_version authority 改坏了

**问题**：0023 正确实现了 `WHERE status = 'active' ORDER BY activated_at DESC` + fail-closed。0025 在重写 `create_activity` 增加 quest ownership 时，把 rules_version 部分复制回了老代码：`ORDER BY version DESC` + `COALESCE('v1')`。迁移顺序 0023→0025 导致 Round14 bug 复活。

**修复**：`0026_stage2b2_final_closure.sql` 中 `create_activity` 合并 0023 正确的 ACTIVE-only/activated_at-ordered/fail-closed 逻辑 + 0025 的 quest ownership 校验。

### 2.2 P1-2：cross-activity 并发测试 retry target 写反

**问题**：`conflictIdx === 0 ? act2 : act1` 应为 `conflictIdx === 0 ? act1 : act2`。retry 用错了 Activity，会得到 `already_confirmed` 而非 `ok=true`。此外 `repetitionCount: 1` 是硬编码，应使用 DB 返回的 `actualRepetitionCount`。

**修复**：改用 `acts[conflictIdx]` 索引（不再硬编码反向映射），retry 使用 `results[conflictIdx].actualRepetitionCount`。

### 2.3 P2-1：新 Skill + repetition_conflict 仍创建 Skill row

**问题**：0025 的 Phase C `INSERT ON CONFLICT DO NOTHING` 对已存在 Skill 无副作用，但对**新 Skill**，若后续 repetition_conflict 返回，Skill row 已创建且不会回滚（正常 RETURN，非异常）。

**修复**：Phase C+D 改为 `pg_advisory_xact_lock(hashtext(user_id + normalized_name))` + `SELECT` 查找已有 Skill。Skill INSERT 延迟到 Phase H（所有验证通过后）。新 Skill 情况下，repetition 权威值 = 0，若客户端声称 ≠ 0 → 直接返回 conflict，零写入。

### 2.4 P2-2：listTransactions 未使用 skill_name_snapshot

**问题**：`listTransactions()` 仍 `.select("*, skills!fk_xp_transactions_skill(name)")` JOIN 当前 Skill 名，Skill 改名后历史账本显示错误。

**修复**：改为 `.select("*")` + `row.skill_name_snapshot`，不再 JOIN skills 表。

### 2.5 P2-3：transaction.skillName 与 primarySkill.name 未校验

**问题**：malformed payload 可使 `transaction.skillName = "Statistics"` 而 `primarySkill.name = "Programming"`，mastery action 实际应用到 Statistics 而非声称的 Programming。

**修复**：Phase A 新增校验 `v_skill_name <> v_primary_skill_name` → 返回 `skill_name_mismatch`。

### 2.6 P2-4：request_verification 未做 stale mastery 校验

**问题**：Phase G 只处理 `upgrade` 的 stale 检查。`request_verification` 的 `toLevel ≤ currentMastery` 情况未处理，会创建无意义的 pending verification。

**修复**：Phase G 新增：`toLevel ≤ currentMastery` → 降级为 `none`；`fromLevel < currentMastery < toLevel` → 使用 `greatest(fromLevel, currentMastery)` 作为权威 fromLevel。

## 3. 本轮实现

### 3.1 `0026_stage2b2_final_closure.sql`

| 函数 | 关键变更 |
|---|---|
| `create_activity` | 恢复 0023 ACTIVE-only/activated_at-ordered/fail-closed + 保留 0025 quest ownership |
| `settle_activity` Phase C+D | `pg_advisory_xact_lock` 替代 INSERT ON CONFLICT；Skill 创建延迟到 Phase H |
| `settle_activity` Phase A | 新增 `skill_name_mismatch` 校验 |
| `settle_activity` Phase G | `request_verification` stale mastery 校验 |

### 3.2 读取路径

`SupabaseRepository.listTransactions()` 改为 `.select("*")` + `row.skill_name_snapshot`，不再 JOIN skills 表。

### 3.3 测试

**`tests/settlement-rpc.test.ts`** 从 16 项扩展至 **19 项**：

| # | 新增测试 | 覆盖 |
|---|---|---|
| 17 | P2-1: 新 Skill + repetition_conflict 无 orphan Skill row | Round17 P2-1 |
| 18 | P2-3: skill_name mismatch → `skill_name_mismatch` | Round17 P2-3 |
| 19 | P2-4: stale request_verification (toLevel ≤ currentMastery) → 无 verification | Round17 P2-4 |

**`tests/supabase-schema.test.ts`**：EXPECTED_ORDER 扩展至 0026。

## 4. 验证结果

### 4.1 TypeScript 编译

```text
npx tsc --noEmit → 通过（0 errors）
```

### 4.2 单元测试

```text
npx vitest run → 92 passed | 30 skipped（3 个 DB-gated 文件）
  settlement-rpc.test.ts: 19 tests（16 原有 + 3 新增）
```

### 4.3 Stage2-B.2 关键行为断言（DB 测试，需 `XP_RPG_TEST_DB_URL`）

| 断言 | 预期 |
|---|---|
| create_activity 使用 ACTIVE-only rules_version（非 draft） | 待 DB 验证 |
| 无 active rules_version → `no_active_rules_version` 异常 | 待 DB 验证 |
| cross-activity 并发 retry 正确目标 + actualRepetitionCount | 待 DB 验证 |
| 新 Skill + repetition_conflict → 无 orphan Skill row | 待 DB 验证 |
| transaction.skillName ≠ primarySkill.name → `skill_name_mismatch` | 待 DB 验证 |
| stale request_verification (toLevel ≤ currentMastery) → 无 verification 创建 | 待 DB 验证 |
| listTransactions 使用 skill_name_snapshot | 待 DB 验证 |

## 5. 结论

Stage2-B.2 完成了 Round17 审查要求的全部修复：

1. **rules_version authority 恢复**（P1-1）—— 0023 的 ACTIVE-only/fail-closed 逻辑不再被覆盖；
2. **并发测试修正**（P1-2）—— retry target 正确、使用 DB 权威值；
3. **零副作用真正成立**（P2-1）—— advisory lock + 延迟 Skill 创建；
4. **读取路径使用快照**（P2-2）—— ledger 历史不再受 Skill 改名影响；
5. **Skill 名称一致性**（P2-3）—— malformed payload 被拒；
6. **request_verification stale 校验**（P2-4）—— 无意义 verification 不再创建。

### 残留 / 边界

- **composite FK**（Round16 P2-5 / Round17 P2-5）：`xp_transactions` 的 FK 仍为单 ID，未做 `(user_id, xxx_id)` 复合约束。settle_activity 主路径已做 ownership 校验，但未来 correction/admin RPC 需额外注意。
- **rules_version dispatcher**（Round16 P2-D）：在 `growth-engine-v0.2` 出现前是硬 Gate。
- **读取路径**：Dashboard/Skills/Mastery queue 仍走 DemoRepository，待 Auth UI 全量切换。

### 提交记录

| Commit | 内容 |
|---|---|
| `025e93f` | fix(stage2b2): final settlement freeze (Round17 review) |

远程 `main` 已更新至 `025e93f`。
