# Stage2-B Verification Summary

> 项目：AI Personal Growth RPG
> 日期：2026-08-20
> 依据：Round14 审查（8.6/10，P0=0/P1=2/P2=3）给出的 Gate 结论——完成 Stage2-A.3 后 **GO → 完整 Stage2-B / settle_activity**
> 前置提交：`68340d6`（含 Round14 Stage2-A.3 与计划状态）

## 1. 目标

实现服务端权威结算链路（Stage2-B）：`settle_activity` 权威结算 RPC、XP 原子结算、幂等、repetition snapshot、Mastery 单调增长（pending verification）、composite tenant 隔离、双用户 RLS 隔离、并发结算测试。

核心原则（沿用项目约束）：
- TS `SettlementService` 仍是 Growth Engine 规则的**唯一副本**（XP 数学、mastery 资格），产出 **delta-based** `SettlementToApply`；
- 数据库只负责在**一个事务内**原子应用 deltas 并强制 authority 不变量，不在客户端复制成长规则；
- 永久成长状态只由 service_role RPC 写入。

## 2. 本轮实现

### 2.1 `0024_settlement_authority.sql` — settle_activity RPC

`settle_activity(p_user_id uuid, p_settlement jsonb) returns jsonb`，`SECURITY DEFINER` + `search_path=public`，**仅 service_role 可 EXECUTE**（撤销 authenticated/anon/public）。

事务内顺序执行的 authority 不变量：

| # | 步骤 | 不变量 |
|---|---|---|
| 1 | 锁定 assessment（`for update`） | 存在性；`user_id = p_user_id`（双用户隔离）；`status='pending'` |
| 2 | 锁定 activity（`for update`，id 取自 assessment 行） | 归属；`status <> 'confirmed'` |
| 3 | 幂等 | 该 Activity 无 `xp_type='activity'` 的账本行（部分唯一索引兜底）；行锁串行化并发 |
| 4 | 解析/创建主 skill | 按 `normalized_name` upsert（0019 唯一约束 + trigger） |
| 5 | 权威 repetition snapshot | 从**已提交账本**重算相似数；与客户端计数不符 → `repetition_conflict` + `actualRepetitionCount` |
| 6 | 写账本 | `rules_version` 取 Activity 冻结值（权威），忽略客户端载荷 |
| 7 | player delta | `total_xp += delta`，等级由 SQL 曲线重算 |
| 8 | skill delta | `xp += delta`，level 重算，`last_used_at` |
| 9 | mastery | `upgrade` → 写 `mastery_events`；`request_verification` → 创建/去重 pending 验证（**不自动升级**） |
| 10 | 二级 skills | 按 normalized_name 解析/创建（关系 schema 暂无边表，不写边） |
| 11 | supersede | 同 Activity 的兄弟 pending revision → `superseded` |
| 12 | 确认 | assessment → `confirmed` + `confirmed_at`；activity → `confirmed` |

返回 `{ok, reason?, actualRepetitionCount?, skillId, transaction, masteryVerification?}`。

新增 SQL 等级曲线 `xp_threshold_for_level` / `player_level_from_xp`，与 `src/lib/growth-engine/levels.ts` 完全对齐，并用 parity 测试锁定。

### 2.2 TS 接线

- `SupabaseRepository.applySettlement`：经 admin client（service_role）调用 `settle_activity`，把 jsonb 结果映射为 `SettlementResult`（`repetition_conflict` 带 `actualRepetitionCount`，供 `SettlementService` 乐观重试）。
- `POST /api/assessments/[id]/confirm`：从 Demo `getSettlementService()` 切换到请求级 `getRequestRepository()` + `SettlementService`（Supabase 已配置 → 真实结算 RPC；未配置 → Demo；未认证 → 401，沿用 fail-closed）。
- `supabase gen types --local` 重生成 `database.types.ts`（含 `settle_activity`）。

### 2.3 测试

- **`tests/settlement-rpc.test.ts`**（真实 PostgreSQL，7 项，`XP_RPG_TEST_DB_URL` 门控）：
  1. 原子结算：账本 + player delta + skill delta + assessment/activity 确认 + `rules_version` 取冻结值；
  2. 幂等：同一 assessment 二次结算失败，账本仅 1 行；
  3. repetition 冲突 + 乐观重试：过期计数 → `repetition_conflict(actual=1)`，用新鲜计数重试成功；
  4. mastery：`request_verification` 创建 1 条 pending 且**不**自动升级；同 skill 二次结算去重返回同一 pending id；
  5. 双用户隔离：B 结算 A 的 assessment → `not_owned`，A 无任何写入；
  6. 并发：双客户端并行结算同一 assessment → 恰有一个 `ok=true`，账本 1 行；
  7. 等级曲线 parity：SQL vs TS `levelFromXp`（0..12000 采样点）。
- **`authority-final-state.test.ts`**：新增 `settle_activity` EXECUTE 仅 service_role（authenticated/anon/public 均拒绝）。
- **`supabase-schema.test.ts`**：`EXPECTED_ORDER` 扩至 0024。
- **`empty-db-migration.smoke.test.ts`**：迁移链注释 0001..0023 → 0001..0024。

## 3. 验证结果

### 3.1 数据库迁移

```text
supabase db reset --yes → 0001..0024 全部成功（含 settle_activity 与等级曲线函数）
```

### 3.2 完整验证

| 套件 | 结果 |
|---|---:|
| TypeScript | 通过 |
| 完整 Vitest（含真实 pg 结算/权限终态） | **110 passed** |
| deterministic harness | 11 passed |
| ESLint | 0 errors（既有 `_settlement` warning 随 applySettlement 实现而消失） |
| Windows production build | 通过 |

### 3.3 Stage2-B 关键行为验证

| 断言 | 结果 |
|---|---|
| settle_activity EXECUTE 仅 service_role | 通过 |
| 原子结算（账本/player/skill/确认） | 通过 |
| 同一 assessment 二次结算失败（幂等） | 通过 |
| repetition 快照冲突 + 新鲜计数重试成功 | 通过 |
| request_verification 仅创建 pending，不自动升级 | 通过 |
| 每 skill 至多一个 pending verification（去重） | 通过 |
| 跨用户结算被拒（not_owned）且无跨用户写入 | 通过 |
| 并发结算恰一个成功 | 通过 |
| SQL 等级曲线与 TS levelFromXp 一致 | 通过 |

## 4. 结论

Stage2-B 核心已落地：永久成长状态的唯一写入口现在是数据库事务内的 `settle_activity` RPC，具备 ownership、原子性、幂等、权威 repetition snapshot、mastery 单调（pending verification）与并发安全；真实 PostgreSQL 行为测试与并发测试全部通过。

### 残留 / 边界（后续轮次）
- **Skill 语义别名**：`normalized_name` 仅大小写/空白归一，语义别名（Statistics/统计学）未解析——0019 明确留待 Skill Ontology。
- **skill_edges 关系表**：尚未建模，结算只创建二级 skill 不写边（demo JSON 有边，关系 schema 无表）。
- **create_activity 参数面**（Round14 P2-1）：`p_quest_id` tenant 校验（composite tenant FK）、`p_activity_type` 若为 AI-derived 应移出创建参数。
- **HTTP 级 wiring 集成测试**（Round14 P2-2）：本轮以 resolver 单元测试 + 路由 401/5xx 映射覆盖 fail-closed 语义，完整 HTTP 链路测试待补。
- **skill_name_snapshot**（Round14 P2-3）：`xp_transactions` 已有 `skill_name` 列承担结算时快照语义；`skillName` 显示映射仍以 JOIN 当前名 + ledger 快照并存。
- **读取路径**：Dashboard/Skills/Ledger 仍走 DemoRepository，待完整 Auth UI 落地后全量切换。
