# Round13 Verification Summary

> 项目：AI Personal Growth RPG  
> 日期：2026-08-19  
> 对应审查：`docs/Check/Round13.txt`  
> 前置提交：`bbece0a fix(round12): close authority wiring gaps`

## 1. 审查基线

Round13 对远程 `main`（`bbece0a`）的审查结论：

- 评分：8.0 / 10
- 状态：CONDITIONAL FAIL
- P0：0
- P1：3
- P2：3

审查指出的问题：

1. **P1-1**：`activities_insert` RLS 仍存在，客户端可 INSERT 一个一开始就是 `confirmed` 的 Activity（0020 的 before-update trigger 不检查 INSERT）。
2. **P1-2**：`database.types.ts` 仍是过期 generated types，`public.Functions` 为 `[_ in never]: never`，`record_ai_assessment` 缺失；三个客户端工厂都没有 `<Database>` 泛型约束。
3. **P1-3**：`AssessmentPersistenceService` 已造好但没有真实 wiring；`SupabaseRepository.addAssessment()` 仍 throw；`/assess` 路由仍走 DemoRepository，换成 Supabase 会 500。
4. **P2-1**：authority 测试仍以“搜字符串”为主，CI 没跑数据库集成。
5. **P2-2**：`supabase-schema.test.ts` 仍按 0018 期待 activities 全 CRUD，与 0021/0022 的实际终态漂移。
6. **P2-3**：`skillName` 当前是 JOIN 当前 Skill 名，不是结算时快照（建议 Stage2-B 加 `skill_name_snapshot`）。

本轮按建议实施 **Stage2-A.2 Final Authority Closure**，逐项关闭。

## 2. 本轮实现

### 2.1 封死 Activity INSERT 伪造通道（P1-1）

新增 `supabase/migrations/0022_activity_creation_authority.sql`：

- 删除 `activities_insert` RLS 策略；
- 新增 `create_activity` `SECURITY DEFINER` 函数，服务端决定：
  - `user_id = auth.uid()`；
  - `status = 'pending_assessment'`；
  - `rules_version =` 权威当前版本（registry 最高版本，空则 `v1`）；
  - `created_at / updated_at = now()`；
- 固定 `search_path = public`；
- 仅授权 `authenticated` 调用，撤销 `anon` / `public`；
- 客户端只提交 `raw_input`、`title`、`total_minutes`、`effective_minutes` 等用户事实字段。

### 2.2 真实生成类型并泛型化客户端（P1-2）

- 在 0022 落地后执行 `pnpm db:types`（即 `supabase gen types typescript --local`）；
- `src/lib/supabase/database.types.ts` 现在包含：
  - `Functions.record_ai_assessment`；
  - `Functions.create_activity`；
- 三个工厂全部加 `<Database>` 泛型：
  - `admin.ts`：`createClient<Database>(...)`；
  - `server.ts`：`createServerClient<Database>(...)`；
  - `browser.ts`：`createBrowserClient<Database>(...)`；
- 因此 `admin.rpc("record_ai_assessment", ...)` 与 `client.rpc("create_activity", ...)` 现在受 `Database` 类型约束；若以后改 RPC 参数而忘记重生成类型，`tsc` 会直接报错。

### 2.3 真实接线 Supabase 写入路径（P1-3）

- `SupabaseRepository.addActivity()` 改为调用 `create_activity` RPC；
- `SupabaseRepository.addAssessment()` 改为调用 `AssessmentPersistenceService.recordForAuthenticatedActivity(...)`（服务端 `record_ai_assessment` RPC）；
- 新增 `getRequestRepository()`（`request-repository.ts`）：
  - Supabase 已配置且请求携带会话 → 用 `SupabaseRepository`；
  - 否则回退 `DemoRepository`（保证无登录 UI 时本地站点不崩）；
- `POST /api/activities` 与 `POST /api/activities/[id]/assess` 接入 `getRequestRepository()`，真正打通：
  - 认证 → RLS 读取 Activity → AI 评估 → 可信 Assessment RPC → 返回。

### 2.4 真实权限终态测试与 CI（P1-3 / P2-1 / P2-2）

- 新增 `tests/authority-final-state.test.ts`：
  - 真实 PostgreSQL 下校验最终 policy 矩阵（activities 无 INSERT/UPDATE、DELETE 仅 pending；ai_assessments 仅 SELECT）；
  - 校验两个 RPC 的 EXECUTE 权限（record_ai_assessment 仅 service_role；create_activity 仅 authenticated）；
  - 模拟 authenticated 会话，证明：直写 confirmed Activity 被拒、`create_activity` 强制 pending_assessment 且归属 auth.uid()、authenticated 不能调用 record_ai_assessment；
  - 由 `XP_RPG_TEST_DB_URL` 网关控制，未设置则跳过。
- 修正 `supabase-schema.test.ts`：从“全 CRUD”断言中移除 activities，改为显式说明 0018 建立策略但 0021/0022 撤销直写，避免静态 grep 与最终状态漂移。
- `.github/workflows/ci.yml` 增加 `supabase-integration` job：
  - 使用 `supabase/setup-cli` + `supabase db start` 提供真实 Supabase 栈；
  - 设置 `XP_RPG_TEST_DB_URL` 并运行 `pnpm test`，使迁移冒烟与权限终态测试在 CI 中真正执行。
- 修复两个数据库集成测试并行争用同一实例：vitest 关闭 `fileParallelism`，且 schema 已存在时跳过重放，避免重复应用迁移互相干扰。

### 2.5 本轮边界与未关闭项

- **P2-3（skillName 结算快照）**：本轮未加 `skill_name_snapshot` 字段，当前仍用 `xp_transactions.skill_id JOIN skills.name`（显示当前名而非结算时快照）。这是 Stage2-B 范围，本轮未做。
- **读取路径**：Dashboard / Skills / Ledger 等读取仍走 DemoRepository，直到完整 Auth + Stage2-B 落地；写入路径已优先接线。
- **完整 Stage2-B**（settle_activity RPC、XP 结算、幂等、repetition、Mastery、双用户隔离、并发测试）尚未开始，符合 Round13 的“先 Final Closure 再 GO → Stage2-B”。

## 3. 验证结果

### 3.1 数据库迁移

```text
supabase db reset --yes → 0001..0022 全部成功
```

### 3.2 完整测试（含数据库集成）

| 套件 | 结果 |
|---|---:|
| 完整 Vitest（含 authority-final-state 7 项、smoke、schema） | 97 passed |
| deterministic harness | 11 passed |
| TypeScript | 通过 |
| ESLint | 通过 |
| Windows production build | 通过 |

### 3.3 真实 PostgreSQL 权限终态（authority-final-state.test.ts）

| 断言 | 结果 |
|---|---|
| activities 无直写 INSERT/UPDATE，DELETE 仅 pending | 通过 |
| ai_assessments 仅 SELECT | 通过 |
| record_ai_assessment EXECUTE 仅 service_role | 通过 |
| create_activity EXECUTE 仅 authenticated | 通过 |
| authenticated 直写 confirmed Activity 被拒 | 通过 |
| create_activity 强制 pending_assessment 且归属 auth.uid() | 通过 |
| authenticated 不能调用 record_ai_assessment | 通过 |

## 4. 结论

Round13 指出的 Stage2-A.2 三个 P1 与 P2-1/P2-2 已关闭并通过真实数据库与 CI 集成验证。P2-3（skillName 快照）按审查建议留待 Stage2-B。

预计满足 Round13 进入完整 Stage2-B 的门槛；下一阶段应实现 `settle_activity` 权威结算 RPC、XP 原子结算、幂等、repetition、Mastery、composite tenant FK、双用户 RLS 隔离与并发测试。
