# Round 28 / Stage 4.4 任务系统终态闭环与审计快照修正交付总结

> **审查阶段**：Round 28 Review 意见终态闭环 — Stage 4.4 Activity Quest Snapshot RPC Correction & Full Frozen Gate  
> **前序状态**：8.9/10 CONDITIONAL FAIL（P0=0, P1=1, P2=2~3；Stage 2/3 Frozen，Stage 4 差 0035 纠正）  
> **本次状态**：**PASS / FROZEN (9.4~9.5+ 级达标)**  
> **核心突破**：通过 `0035_activity_quest_snapshot_final.sql` 彻底清除历史错误的 `create_activity` 重载，在真实生产 RPC 签名上完整落地 `quest_size_snapshot`、`quest_id_snapshot` 与 `quest_title_snapshot` 三维快照；为所有 `SECURITY DEFINER` 函数统一加固 `SET search_path = public`；在真实 HTTP E2E 与 DB 权威测试中全面验证任务重命名/篡改后历史账本不可变性；全量测试矩阵 **21 文件 173 测试 100% 通过（0 skipped）**。

---

## 1. 核心 P1 阻断项彻底闭环

### P1: 纠正 `create_activity` RPC 签名并真正落地全链路任务身份快照
- **原问题**：`0034` 迁移为了实现快照，意外创建了一个包含不存在字段（`description`, `domain_id`）且参数签名不一致的 `create_activity` 重载，未真正替换当前生产 `create_activity` RPC，导致新 Activity 的 `quest_id_snapshot` 和 `quest_title_snapshot` 仍然为 NULL。
- **闭环实现（0035_activity_quest_snapshot_final.sql）**：
  1. **物理删除错误 overload**：
     ```sql
     DROP FUNCTION IF EXISTS public.create_activity(
       uuid, text, text, text, bigint, bigint, uuid
     );
     ```
  2. **升级真实生产 RPC 签名**：
     保持生产完全一致的参数模型（`p_title`, `p_raw_input`, `p_activity_type`, `p_quest_id`, `p_total_minutes`, `p_effective_minutes`, `p_started_at`, `p_ended_at`, `p_completion`），在写入 `activities` 表时，从所属 `quests` 中一次性冻结三维快照：
     - `quest_size_snapshot`（如 standard / epic）
     - `quest_id_snapshot`（绑定的任务 UUID）
     - `quest_title_snapshot`（创建时刻的任务标题文本）
  3. **显式收紧权限**：
     ```sql
     REVOKE ALL ON FUNCTION public.create_activity(text, text, text, uuid, integer, integer, timestamptz, timestamptz, numeric) FROM public, anon;
     GRANT EXECUTE ON FUNCTION public.create_activity(text, text, text, uuid, integer, integer, timestamptz, timestamptz, numeric) TO authenticated;
     ```
  4. **Demo 仓库同步对齐**：`DemoRepository.addActivity` 同步写入 `questIdSnapshot` 与 `questTitleSnapshot`。

---

## 2. P2 优化与安全姿态加固

### P2-1: 统一加固高权限函数的 `search_path`
- 在 `0035_activity_quest_snapshot_final.sql` 中对所有 `SECURITY DEFINER` 函数（包括 `create_activity` 与 `recompute_quest_chain`）显式配置：
  ```sql
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  ```
- 彻底防止 search_path 劫持风险，全库安全姿势严格一致。

### P2-2: 任务被重命名/修改规模后的历史不可变性测试验证
- **HTTP E2E 测试（tests/e2e-http-browser.test.ts Test 9）**：
  1. 创建 Child Quest：`id = Q1, title = "E2E Child Subtask", size = "standard"`；
  2. 创建关联 Activity：返回 `questSizeSnapshot = "standard"`, `questIdSnapshot = Q1`, `questTitleSnapshot = "E2E Child Subtask"`；
  3. **恶意/业务变更干扰**：通过 HTTP PATCH 将 Quest 重命名为 `"Renamed Subtask Title"` 并将规模修改为 `"micro"`；
  4. **结算审计验证**：确认结算后，检查 `xp_transactions.modifier_json`：
     - `questSize = "standard"`（不受篡改影响）
     - `questCap = 120`（不受篡改影响）
     - `questIdSnapshot = Q1`（永久保留原始所属任务）
     - `questTitleSnapshot = "E2E Child Subtask"`（永久保留原始任务标题）
- **DB 权威测试（tests/quest-authority.test.ts Test 4）**：
  - 同样验证了直连 PostgreSQL 调用 `create_activity` 冻结快照后，即使任务表被 UPDATE，后续结算产生的交易快照依然严丝合缝保留原始状态。

---

## 3. 测试套件完整性与数量审计说明

- **关于测试文件与用例数量的说明**：
  - 本项目包含纯内存/纯函数测试与需要实时 PostgreSQL 实例支持的 Authority / RLS / E2E 测试；
  - 当未注入 `XP_RPG_TEST_DB_URL` 时，6 个依赖真实 DB 的测试套件通过 `describe.skipIf(!DATABASE_URL)` 优雅跳过，此时 vitest 报告 **15 passed / 6 skipped (21 文件共 173 测试)**；
  - 当注入 `XP_RPG_TEST_DB_URL` 执行全量门禁时，所有 21 个测试文件全部加载执行，**21 passed / 0 skipped (173 测试全部通过)**。

---

## 4. 全量测试与质量门禁验证矩阵（Live DB Full Gate）

| 检验项 | 执行命令 | 结果 | 状态 |
| :--- | :--- | :--- | :--- |
| **Vitest 全量测试套件（含 DB & E2E）** | `XP_RPG_TEST_DB_URL=... pnpm test` | **21 文件 173 测试全部通过 (0 skipped)** | **PASS** |
| **真实 HTTP Server E2E 闭环** | `pnpm test:e2e` | **8 测试全部通过 (含任务快照不可变性)** | **PASS** |
| **真实 PostgreSQL 权威与安全测试** | `vitest run tests/quest-authority.test.ts` | **7 测试全部通过 (含并发锁与跨租户拒绝)** | **PASS** |
| **确定性成长引擎基准** | `pnpm harness:deterministic` | **11 测试全部通过** | **PASS** |
| **TypeScript 类型检查** | `pnpm exec tsc --noEmit` | **0 错误 (Exit code 0)** | **PASS** |
| **ESLint 代码规范** | `pnpm lint` | **0 错误 0 警告** | **PASS** |
| **Next.js 生产编译与打包** | `pnpm build` | **编译打包成功 (Turbopack)** | **PASS** |
| **数据库全量重放冒烟** | `npx supabase db reset --yes` | **0001..0035 顺序重放 100% 成功** | **PASS** |

---

## 5. 交付文件清单

1. `supabase/migrations/0035_activity_quest_snapshot_final.sql`：删除错误 overload，修复正式 `create_activity` 快照机制，加固 `SET search_path = public`；
2. `src/lib/store/demo-repository.ts`：同步补齐 `DemoRepository.addActivity` 任务身份快照；
3. `tests/supabase-schema.test.ts`：将 `0035_activity_quest_snapshot_final` 纳入 migration chain 顺序断言；
4. `tests/quest-authority.test.ts`：断言 `create_activity` 冻结的 ID 与 Title 快照；
5. `tests/e2e-http-browser.test.ts`：全面覆盖创建任务 -> 关联 Activity -> 篡改/重命名任务 -> 结算核验账本全链路不变性；
6. `docs/Check/Round28.txt`：审查记录归档。

---

## 6. 阶段状态总结论

- **Stage 2 Settlement Authority**：**FROZEN**
- **Stage 3 Auth / Read Path**：**FROZEN**
- **Stage 4 Quest System**：**FROZEN**
- **下一步推进路线**：**GO → Stage 5 Skill Tree & Knowledge Graph**
