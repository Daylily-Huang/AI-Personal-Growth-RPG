# Round8 跟进摘要（M3 Stage1.1 — Authority & Schema Integrity Fix）

对应 `docs/Check/Round8.txt`：**Gate = CONDITIONAL FAIL / NO-GO 到 Stage2**。
核心 P0：原 `0017_rls.sql` 对所有私有表统一授予 `SELECT/INSERT/UPDATE/DELETE` 自己的行，
把 `xp_transactions` / `player_states` / `skills` 等**永久成长态**也开放给客户端直接改，
等于绕过了 AI→Proposal→Growth Engine→Settlement→Ledger 的权威结算链。

本 commit 只做 Round8 列出的 **6 项**，不扩 Schema、不写 UI、不做 Quest。

## IN SCOPE（6 项，逐项对应）

1. **RLS 权限矩阵（P0）** — 新建 `0018_authority_rls_matrix.sql`：
   - 先 drop `0017` 的 blanket 四策略（`*_select_own/_insert_own/_update_own/_delete_own`）；
   - 按表重建 `TO authenticated` 矩阵：
     - 只读永久态/账本：`xp_transactions`、`player_states`、`skills`、`ai_assessments`、
       `evidence_records`、`mastery_verifications`、`mastery_events` → **仅 SELECT**；
     - `profiles` → SELECT + UPDATE（INSERT 由 auth 触发器，DELETE 禁止）；
     - 用户自创内容：`domains`/`quests`/`activities`/`knowledge_nodes`/`knowledge_edges`/
       `artifacts`/`artifact_links`/`reviews` → 自己的行全 CRUD。
   - 服务端写入仅经 `SECURITY DEFINER` RPC / service_role 绕过 RLS（Stage2 落实）。

2. **Evidence 范围对齐** — 编辑 `0008_evidence_records.sql`：CHECK 由 `between 0 and 4`
   改为 `between 0 and 6`，与 AI 提案 schema `max(6)` 及 Growth Engine `E0..E6` 一致。
   `0019` 另含一段 DO 块，对"已应用过旧 0..4"的库做防御性 drop+re-add。

3. **核心 Growth Loop tenant 外键** — `0019_schema_integrity.sql`：
   `xp_transactions.activity_id→activities`、`assessment_id→ai_assessments`、`skill_id→skills`。
   （`assessment→activity`(0007)、`activity→quest`(0006)、`mastery_verification→skill`(0010) 已存在。）

4. **Skill 归一化身份** — `0019`：`skills` 增加 `normalized_name` + `unique(user_id, normalized_name)`
   + BEFORE 触发器自动 `lower(btrim(regexp_replace(name,'\s+',' ')))`，防并发结算创建重复 Skill、
   破坏 repetition 的 `skillId` 身份。

5. **真正执行空库迁移** — 见 `tests/empty-db-migration.smoke.test.ts`（默认 skip；WSL/CI 提供
   `XP_RPG_TEST_DB_URL` + `pg` 时按序跑 0001–0019 并断言表/RLS/账本只读/Evidence 0..6/FK/唯一）。
   本环境（Windows shell，node_modules 为 Linux 目标）**未执行**，需 WSL 复核。

6. **测试升级** — `tests/supabase-schema.test.ts`：
   - `EXPECTED_ORDER` 扩展至 `0018/0019`；
   - 新增 **RLS Policy Matrix** 静态检查（只读表仅 SELECT、profiles 仅 SELECT+UPDATE、
     自创内容全 CRUD、策略绑定 `auth.uid()`）；
   - 新增 **Evidence 范围一致性**（DB check == AI schema `max(6)` == Engine `E0..E6`）。

## OUT OF SCOPE（按 Gate 纪律，本 commit 不做）
- 不扩 Schema（无新表/新字段超出上述 4 项）。
- 不写新 UI、不做 Quest、不做 Knowledge Map / Artifact / Review。
- `SupabaseRepository` + `settle_activity` RPC（Stage2）。
- 更广的 tenant-owned 组合外键（`(user_id,id)` 引用完整性，如 `knowledge_edges→nodes`、
  `artifact_links→artifacts`、`mastery_events→skill/activity`）——Round8 第六节建议，但超出本
  6 项最小集；列为后续 Stage2 待办，避免本 commit 范围膨胀。

## 落库文件
```text
supabase/migrations/0018_authority_rls_matrix.sql   RLS 权限矩阵（P0）
supabase/migrations/0019_schema_integrity.sql      Evidence 0..6 + xp FKs + skill normalized
supabase/migrations/0008_evidence_records.sql      CHECK 0..4 → 0..6（原地修正，空库可建）
tests/supabase-schema.test.ts                      Policy Matrix + Evidence 一致性
tests/empty-db-migration.smoke.test.ts             空库冒烟（gated）
```

## 测试
```text
pnpm test                         → 含升级后的 supabase-schema（Policy Matrix + 一致性）
pnpm harness:deterministic        → 不受影响（未改 growth-engine）
pnpm lint / pnpm build            → 未改应用代码，预期通过
XP_RPG_TEST_DB_URL=<supabase> pnpm vitest run tests/empty-db-migration.smoke.test.ts  → 空库冒烟
```
> 注：上述命令在本 Windows shell 无法运行（node_modules 为 Linux 目标，缺 win32 原生绑定），
> 须在与项目主开发环境一致的 WSL 中验证。

## Known issues / 风险
- **未在本环境执行真实迁移**：空库 bootstrap 仅经静态测试 + 离线推断验证；最终需在 WSL 对
  Supabase 库 `db reset` / 等效执行 0001–0019 后跑冒烟测试。
- 若某库已应用过旧 `0008`（0..4），`0019` 的 DO 块会 drop 旧 CHECK 再重建 0..6；但 `xp_transactions`
  外键与 `skills` 唯一约束在已有孤儿数据时会失败，需先清洗（空库无此问题）。
- `pg` 未列入 devDependencies；冒烟测试启用前需 `pnpm add -D pg`。

## 下一步
- WSL 执行：`pnpm test` + 空库冒烟，确认全绿。
- 若 6 项通过，按 Round8 Gate：大概率 **GO → Stage2 `SupabaseRepository` + `settle_activity` RPC**
  （原子、不可绕过、mastery 单调、并发幂等、repetition snapshot 事务内取）。
- Stage2 同时落实：服务端经 `SECURITY DEFINER` RPC 写永久态（匹配本 commit 的 RLS 矩阵）。
