# AI Personal Growth RPG — Stage2 工作计划

## 目标
在 Round10 Stage1 Gate 已通过的基础上，先完成并确认 Stage2 最小垂直切片设计，再实现服务端权威结算链路。优先保证 ownership、原子性、幂等性和审计可追溯性，不提前扩展 UI 或无关领域模型。

## 阶段
- [complete] 阶段 1：读取审查记录、当前代码状态和项目规范
- [complete] 阶段 2：整理未完成任务与优先级
- [complete] 阶段 3：完成 Stage1 真实 Supabase 验证
- [complete] 阶段 4：审查 Stage2 接口、schema 与测试缺口
- [complete] 阶段 5：读取 Round11 并冻结 Stage1、确定 Stage2-A/B 边界
- [in_progress] 阶段 6：实现 Stage2-A（Repository/Auth wiring/generated DB types/Activity immutability/basic mapping）
  - [complete] 6.1：诊断并修复本地网站启动阻断
  - [complete] 6.2：实现 SupabaseRepository 与基础 Auth wiring
  - [complete] 6.3：实现 Activity immutability 与基础映射测试
  - [complete] 6.4：运行完整验证并确认 migration 与本地数据库兼容
- [complete] 阶段 7：实现 Stage2-B（settle_activity 权威结算）
  - [complete] 7.1：0024 settle_activity SECURITY DEFINER RPC（service_role only）：事务内锁定 assessment/activity、ownership 校验、一笔 activity 结算幂等、权威 repetition snapshot 复核、skill 按 normalized_name upsert、player/skill delta + 等级重算、mastery upgrade 事件、pending verification 去重、supersede 兄弟 revision、确认 assessment/activity
  - [complete] 7.2：SQL 等级曲线（xp_threshold_for_level / player_level_from_xp）与 TS levelFromXp 对齐
  - [complete] 7.3：SupabaseRepository.applySettlement 接线 settle_activity RPC + 结果映射；confirm 路由切换请求级 repository（fail-closed，401）
  - [complete] 7.4：真实 PostgreSQL 结算测试（原子性/幂等/repetition 冲突与重试/mastery pending 去重/双用户隔离/并发单赢/等级曲线 parity）+ 权限断言 + EXPECTED_ORDER 至 0024
  - [complete] 7.5：摘要、提交、推送、核验远程 main
- [complete] 阶段 8：生成 Round11 摘要、提交并推送
- [complete] 阶段 9：实施 Round12 Stage2-A.1 Authority Wiring Closure
  - [complete] 9.1：Assessment trusted persistence 与原子状态转移
  - [complete] 9.2：收紧 Activity 客户端状态权限
  - [complete] 9.3：生成真实 Supabase Database types
  - [complete] 9.4：修复 transaction skillName 显示映射
  - [complete] 9.5：行为级集成测试、摘要、提交、推送
- [in_progress] 阶段 10：实施 Round13 Stage2-A.2 Final Authority Closure
  - [complete] 10.1：0022 删除 activities_insert，新增 create_activity SECURITY DEFINER RPC（封死 INSERT 伪造）
  - [complete] 10.2：重生成 database.types.ts（含两个 RPC）并泛型化 admin/server/browser 客户端
  - [complete] 10.3：SupabaseRepository 写入路径接线（addActivity→create_activity、addAssessment→AssessmentPersistenceService）+ 路由接入请求级 repository
  - [complete] 10.4：新增真实 PostgreSQL 权限终态测试 + 修正静态 schema 测试漂移 + CI 集成 job
  - [in_progress] 10.5：摘要、提交、推送、核验远程 main
- [complete] 阶段 11：实施 Round14 Stage2-A.3 Authority Final-Final Closure
  - [complete] 11.1：0023 修复 rules_version 权威（active-only + activated_at 排序 + 唯一 active 约束 + 无 active 时 fail-closed + 注册 growth-engine-v0.1=active）
  - [complete] 11.2：getRequestRepository 改为 fail-closed（已配置即走 Supabase，未认证 401、基础设施异常 5xx，禁止静默 Demo 降级）
  - [complete] 11.3：两个 API 路由将 AuthRequiredError 映射为 401
  - [complete] 11.4：新增真实 PostgreSQL rules_version 断言（active 优先于 draft、无 active 失败关闭）+ getRequestRepository fail-closed 单元测试 + 扩展 EXPECTED_ORDER 至 0023
  - [complete] 11.5：摘要、提交、推送、核验远程 main
- [complete] 阶段 12：实施 Round16 Stage2-B.1 Settlement Integrity Closure
  - [complete] 12.1：0025_settlement_integrity.sql — settle_activity 全面重写：
    - P1-1 Mastery 单调增长：Phase G 检查 proposed > current，stale proposal 降级为 none；mastery_events 只在真实 upgrade 时写入
    - P1-2 Canonical XP delta：transaction.amount 为唯一权威值；reject xpDelta/primarySkill.xpDelta 不一致；强制 xpType='activity'；reject 负数 XP
    - P1-3 Repetition 序列化：clock_timestamp() 在 SELECT FOR UPDATE 之后取值，消除 now() 事务开始时间 race
    - P2-A repetition_conflict 零副作用：所有验证（repetition/mastery）在所有永久写入之前完成
    - P2-B pending MasteryVerification 返回真实 DB row 值（select * into v_existing_pending）
    - P2-C skill_name_snapshot 落表到 xp_transactions 并用于返回 JSON
  - [complete] 12.2：0025 create_activity 重写 — P1-4 tenant composite integrity：p_quest_id 非空时验证 quest ownership（auth.uid() = quests.user_id）
  - [complete] 12.3：database.types.ts 新增 skill_name_snapshot 字段 + supabase-mapping.test.ts 适配
  - [complete] 12.4：settlement-rpc.test.ts 新增 9 个 Stage2-B.1 测试（共 16 个）：stale mastery / canonical XP mismatch / negative XP / xpType 强制 / cross-activity 并发 / quest ownership / repetition 零副作用 / verification 字段值 / skill_name_snapshot
  - [complete] 12.5：supabase-schema.test.ts EXPECTED_ORDER 扩展至 0025
  - [complete] 12.6：摘要、提交、推送、核验远程 main
- [complete] 阶段 13：实施 Round17 Stage2-B.2 Final Settlement Freeze
  - [complete] 13.1：0026_stage2b2_final_closure.sql — create_activity 恢复 0023 ACTIVE-only/fail-closed rules_version + 保留 0025 quest ownership（修 P1-1 regression）
  - [complete] 13.2：settle_activity 重写 Phase C+D — 用 pg_advisory_xact_lock 替代 INSERT ON CONFLICT DO NOTHING，Skill 创建延迟到 Phase H（P2-1 零副作用真正成立）
  - [complete] 13.3：settle_activity Phase A 新增 P2-3 — 校验 transaction.skillName == primarySkill.name
  - [complete] 13.4：settle_activity Phase G 新增 P2-4 — request_verification 也做 stale mastery 校验（toLevel ≤ currentMastery → none）
  - [complete] 13.5：修复 cross-activity 并发测试 P1-2 — act1/act2 反向 bug + 用 actualRepetitionCount retry
  - [complete] 13.6：P2-2 listTransactions() 改用 skill_name_snapshot（不再 JOIN skills 表）
  - [complete] 13.7：新增 3 个 DB 测试（共 19 个）：orphan Skill 零创建 / skill_name mismatch / stale request_verification
  - [complete] 13.8：EXPECTED_ORDER 扩展至 0026
  - [complete] 13.9：摘要、提交、推送、核验远程 main
- [complete] 阶段 14：实施 Round18 Final Freeze Patch
  - [complete] 14.1：0027_mastery_null_closure.sql — v_current_mastery := coalesce(v_skill_row.mastery_level, 1)；Phase G 全部基于此权威值；verification fromLevel 直接取 DB current
  - [complete] 14.2：新增 2 个 DB 测试（共 21 个）：new Skill + upgrade M0 → 保持 M1 / new Skill + request_verification M1→M1 → 无 verification
  - [complete] 14.3：EXPECTED_ORDER 扩展至 0027
  - [complete] 14.4：真实 DB gate 全通过 — supabase db reset 0001→0027 + settlement-rpc 21/21 + authority-final-state 10/10 + migration smoke 1/1 + 全量 124/124 tests passed, 0 skipped
  - [complete] 14.5：摘要、提交、推送、核验远程 main
- [complete] 阶段 15：实施 Stage 3（Auth Bootstrap + 全量 Supabase Read Path 与 UI 集成）
  - [complete] 15.1：Next.js Supabase Auth SSR 中间件 (`src/lib/supabase/middleware.ts`, `src/middleware.ts`)
  - [complete] 15.2：认证页面与会话控制 (`src/app/login/page.tsx`, `src/app/api/auth/logout/route.ts`, Dashboard/Skills 登出与状态栏)
  - [complete] 15.3：全量读路径切换 (`GET /api/dashboard`, `GET /api/skills` 接入 `getRequestRepository()`)
  - [complete] 15.4：0028_schema_grants.sql 补充 Data API 表权限
  - [complete] 15.5：tests/read-path-integration.test.ts 验证初始读取、E2E 成长闭环、双用户隔离
  - [complete] 15.6：全量套件 16 passed (127/127), harness 11/11 passed, eslint 0 errors / 0 warnings
- [complete] 阶段 16：实施 Stage 3.1（Auth & Read Integration Closure）
  - [complete] 16.1：修复 TypeScript / Build Gate（DashboardSnapshot 导入、类型标注、测试 SettlementToApply 契约）
  - [complete] 16.2：修复 Supabase SSR Middleware Token Refresh 与重定向 Cookie/Header 完整传播
  - [complete] 16.3：/login 共享 Demo 账号非生产环境隔离
  - [complete] 16.4：0029_default_privileges_tighten.sql 撤销 public 宽泛默认权限恢复 fail-closed
  - [complete] 16.5：tests/http-auth-flow.test.ts 覆盖未登录 API 401、登出、中间件会话传播
  - [complete] 16.6：全量套件 17 passed (136/136), tsc 0 errors, harness 11/11 passed, eslint 0 errors / 0 warnings

## 当前设计边界
- 首个切片只覆盖 Activity → Assessment → Confirm → XP Ledger/Player/Skill 的真实 Supabase 路径。
- LLM 仍只产生 proposal；RPC 不接受客户端 user_id，必须由 `auth.uid()` 推导归属。
- `settle_activity` 负责一次数据库事务内的状态检查、重复结算保护、服务端 repetition snapshot、XP ledger、player/skill delta、mastery verification 和 assessment/activity 状态更新。
- `SupabaseRepository` 只做数据映射和 RPC 调用，不在客户端复制永久成长规则。
- 复合 tenant FK、双用户 RLS 测试和并发测试属于同一 Stage2 Gate；若现有 schema 需要新增迁移，采用新增迁移，不改写已执行迁移。
- 暂不处理 Activity 编辑/更正 pipeline、正式 Auth UI、Knowledge Map 全量接线和 UI 重构。

## 约束
- 先读证据，不凭记忆判断。
- 遵循 `AGENTS.md` 的项目不变量与验证要求。
- 用户未确认 Stage2 设计前，不修改业务实现文件。
- 手术式修改，不碰无关重构。
- 修改 confirmation flow、auth、RLS、migration、XP transaction 后必须运行 `pnpm test` 和 `pnpm harness:deterministic`，并保留真实 Postgres smoke 证据。

## 错误记录
- Stage1 期间曾遇到 WSL DrvFs、Docker socket、Supabase auth schema 和 PostgreSQL CHECK 规范化问题，均已采用替代方案关闭；本阶段不重复原失败路径。
