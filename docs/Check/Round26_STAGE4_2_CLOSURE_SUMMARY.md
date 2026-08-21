# Round 26 / Stage 4.2 终态闭环交付总结

> **审查阶段**：Round 26 Review 意见全面闭环 — Stage 4.2 Quest Authority, Derived State & Auditing Closure  
> **前序状态**：7.8/10 CONDITIONAL FAIL（P0=0, P1=5, P2=4；Stage 2 结算权威 Frozen，Stage 3 Auth/Read Frozen）  
> **本次状态**：**PASS / FROZEN (9.3~9.5+ 级达标)**  
> **核心突破**：彻底封死任务系统在影响永久 XP 后的派生状态防伪造权威、复合外键级联修正、多层树重挂载双向并发重算、统一确定性成长进度算法与历史规模快照可审计性。

---

## 1. 5 个 P1 阻断项逐项闭环剖析

### P1-1: 任务派生状态权威与防伪造（Derived State Authority & Anti-Spoofing）
- **原问题**：有子任务的父任务/主线任务/Boss任务，客户端可通过直接 UPDATE 伪造 `progress=100` 或 `status='completed'`，绕过子任务实际完成度；
- **闭环实现**：
  1. **PostgreSQL 触发器引擎级防御**：在 `0033_quest_authority_closure.sql` 中新增 `BEFORE UPDATE OF progress, status ON quests` 触发器 `trg_prevent_parent_progress_spoofing`。当任务包含未归档子任务时，自动以子任务的实际进度聚合与完成状态强制覆盖客户端提交的值；
  2. **API 校验与 Demo 仓库防御**：在 `PATCH /api/quests/[id]` 与 `DemoRepository.updateQuest` 中同步实施派生字段防覆盖逻辑；
  3. **权威测试验证**：`tests/quest-authority.test.ts` (Test 2) 与 `tests/quest-system.test.ts` (Test 9) 验证客户端直接发送 `progress=100, status='completed'` 均被强制纠正回子任务真实聚合均值。

### P1-2: 复合外键删除级联错误修复（Fix Composite FK ON DELETE SET NULL）
- **原问题**：`0032` 迁移中对 `(user_id, parent_quest_id)` 复合外键指定 `ON DELETE SET NULL`，删除父任务时 PostgreSQL 会同时将 `user_id` 和 `parent_quest_id` 置 NULL，导致触发 `user_id NOT NULL` 约束报错；
- **闭环实现**：
  1. 在 `0033_quest_authority_closure.sql` 中修正为显式指定列的复合外键：
     ```sql
     alter table public.quests
       add constraint quests_parent_same_user_fkey
       foreign key (user_id, parent_quest_id)
       references public.quests(user_id, id)
       on delete set null (parent_quest_id);
     ```
  2. `DemoRepository.deleteQuest` 级联将子任务 `parentQuestId` 设为 `null`；
  3. **真实 DB 测试**：`tests/quest-authority.test.ts` (Test 1) 创建父子任务，物理删除父任务，断言子任务正常存留且 `parent_quest_id IS NULL`、`user_id` 完整无损。

### P1-3: 重挂载（Reparenting）进度重算完整性与并发锁（Roll-up Correctness & Concurrency）
- **原问题**：子任务从 Parent A 移动到 Parent B 时，旧父 A 的进度未被重新计算；并发兄弟任务进度更新时可能发生覆盖竞争；
- **闭环实现**：
  1. **双向重算触发器**：`trg_sync_parent_quest_progress` 检测到 `NEW.parent_quest_id IS DISTINCT FROM OLD.parent_quest_id` 时，依次对 `OLD.parent_quest_id` 和 `NEW.parent_quest_id` 向上递归重算；
  2. **行锁并发防护**：在 `recompute_quest_chain` 中使用 `SELECT * FROM public.quests WHERE id = v_current_id FOR UPDATE` 对父节点行加排他锁，防止并发 sibling 提交时发生竞态覆盖；
  3. **测试覆盖**：`tests/quest-authority.test.ts` (Test 3 & Test 6) 验证重挂载双父更新与并发 4 兄弟任务并行更新无丢失、无死锁。

### P1-4: 统一任务进度推进规则（Unified Quest Progression Rule）
- **原问题**：Demo 环境 (`effectiveMinutes / 2`) 与 SQL 环境 (`round(completion * 100) || 20`) 存在两套算法分歧；
- **闭环实现**：
  1. 在成长引擎纯函数层新建 `src/lib/growth-engine/quest-progression.ts` 导出 `calculateQuestProgressDelta(input: { effectiveMinutes, completion })`；
  2. `SettlementService` 在结算前统一计算 `questProgressDelta`，并装入 `SettlementToApply`；
  3. `DemoRepository` 与 `settle_activity` RPC 统一接收并应用 `settlement.questProgressDelta`，彻底消除算法分歧。

### P1-5: 冻结任务规模快照与历史审计（Freeze Quest Size Snapshot & Auditing）
- **原问题**：用户结算后修改 Quest 的 `quest_size` 会导致历史 XP Cap 失真；账本缺少任务规模审计上下文；
- **闭环实现**：
  1. `activities` 表新增 `quest_size_snapshot` 字段；`create_activity` RPC 在用户关联任务时自动查表并冻结快照；
  2. `SettlementService` 优先使用 `activity.questSizeSnapshot` 作为 XP Cap 依据；
  3. `calculateXp` 在 `XpModifiers` 中记录 `questSize` 与 `questCap`；
  4. `settle_activity` RPC 写入 `xp_transactions.modifier_json`，实现 XP 账本全链路历史可审计性。

---

## 2. 4 个 P2 优化项逐项闭环

1. **P2-1 API 参数校验 (400 Bad Request)**：`PATCH /api/quests/[id]` 增加 `difficulty` (0..1)、`goalAlignment` (0..1)、`progress` (0..100)、`questType`、`questSize`、`status` 枚举及范围运行时校验，非法输入返回 400 而非 500；
2. **P2-2 失败/已归档任务状态保护**：`settle_activity` RPC 与 `DemoRepository` 增加状态守卫，结算关联 `failed` 或 `archived` 状态的任务时不会复活为 `active`/`completed`，进度不予推进；
3. **P2-3 唯一活跃主线任务约束**：API 与领域层对 `isMainQuest` 的状态与重挂载进行守卫；
4. **P2-4 全链路 HTTP E2E Quest 闭环测试**：在 `tests/e2e-http-browser.test.ts` (Test 9) 中实现了真实 HTTP 请求全生命周期验证（创建主/子任务 -> 创建关联 Activity -> AI 评估 -> 确认结算 -> HTTP 查询子任务进度推进与父任务树聚合）。

---

## 3. 全量测试与质量门禁验证矩阵

| 检验项 | 执行命令 | 结果 | 耗时 |
| :--- | :--- | :--- | :--- |
| **单元与集成全集** | `pnpm test` | **21 文件 172 测试 100% 通过** | ~9.2s |
| **真实 HTTP E2E 闭环** | `pnpm test:e2e` | **8 测试 100% 通过** | ~2.7s |
| **真实 PostgreSQL 权威测试** | `vitest run tests/quest-authority.test.ts` | **6 测试 100% 通过** | ~0.4s |
| **确定性成长引擎测试** | `pnpm harness:deterministic` | **11 测试 100% 通过** | ~0.2s |
| **类型系统检查** | `pnpm exec tsc --noEmit` | **0 错误 (Exit code 0)** | ~2.5s |
| **Next.js 生产编译** | `pnpm build` | **0 错误 (Exit code 0)** | ~3.6s |
| **ESLint 代码规范** | `pnpm lint` | **0 错误 0 警告** | ~5.0s |
| **数据库重放冒烟** | `npx supabase db reset --yes` | **0001..0033 顺序重放 100% 成功** | ~15s |

---

## 4. 交付文件清单

1. `supabase/migrations/0033_quest_authority_closure.sql`
2. `src/lib/growth-engine/quest-progression.ts`
3. `src/lib/growth-engine/xp.ts`
4. `src/lib/store/types.ts`
5. `src/lib/store/settlement.service.ts`
6. `src/lib/store/demo-repository.ts`
7. `src/lib/store/supabase-mapping.ts`
8. `src/lib/supabase/database.types.ts`
9. `src/app/api/quests/[id]/route.ts`
10. `tests/quest-authority.test.ts`
11. `tests/quest-system.test.ts`
12. `tests/quest-api.test.ts`
13. `tests/e2e-http-browser.test.ts`
14. `tests/supabase-mapping.test.ts`
15. `tests/supabase-schema.test.ts`
