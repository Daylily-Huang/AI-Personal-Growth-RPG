# 工作进度

## 2026-08-19
- 创建持久化计划文件，准备读取 `docs/Check` 并确定下一步。
- 读取最新 `Round10.txt`：Stage1 只差真实数据库证明与完整验证，当前不应进入 UI/Stage2 业务实现。
- 用户完成 Docker Desktop 安装并开启 Ubuntu WSL Integration，Docker Desktop 29.7.2/desktop-linux 正常，数据位于 D 盘配置。
- 补充 `@types/pg`、项目级 `supabase@2.114.0`，生成 `supabase/config.toml` 与 `supabase/.gitignore`。
- 本地 Supabase 栈启动成功，`0001~0019` 完整迁移成功。
- 独立 Supabase-compatible 空库 smoke test 通过：1 test passed。
- 修复 smoke test 对 PostgreSQL CHECK 规范化表达式的脆弱字符串断言。
- 修复 RLS 静态测试对旧策略命名的错误期待。
- `pnpm test`：83 passed / 1 gated skipped；`harness:deterministic`：11 passed；`lint`：通过；`build`：通过。
- Round10 验证结果曾记录在进度文件中，但摘要文件当前不在工作区；本轮不重新追补 Round10 原始摘要，避免把历史记录与当前 Round11 收尾混淆。
- 2026-08-18：恢复上下文并确认 Stage1 Gate 已通过；读取 Repository/types、Supabase wiring point、核心 migration。形成 Stage2 最小垂直切片边界：先做服务端权威结算，不改 UI；等待用户确认设计后实现。
- 2026-08-19：读取 `docs/Check/Round11.txt`。外部审查确认 Round10 Stage1 正式冻结，评分 9.2/10、P0=0、GO → Stage2。按审查建议拆分 Stage2-A 与 Stage2-B：当前进入 Stage2-A，暂不编写巨大 settlement RPC。
- 14:20 用户要求按计划继续，并同时修复网站无法进入问题。已确认项目 `pnpm dev` 在当前 Bash 环境不可用（pnpm 不在 PATH）；直接调用 Next 后服务虽显示 Ready，但请求 3000 无响应，日志显示缺少 Windows SWC 时尝试调用不存在的 pnpm。受控 pnpm 又检测到跨平台现有 `node_modules`，因无 TTY 中止清理。另发现 `next/font/google` 会触发外部字体下载，已移除字体网络依赖，改用本地系统字体；下一步需在不破坏 WSL 依赖的前提下完成独立 Windows 依赖/启动验证。
- 2026-08-19：Windows `node_modules` 已重新安装，`@next/swc-win32-x64-msvc` 可用。服务在 3001 通过 `/`→`/dashboard` 307、Dashboard 200、Dashboard API 200 验证；使用受控 Node 22.22.2 + Corepack pnpm 11.7.0 并清除 `NODE_OPTIONS` 后 production build 通过。
- 2026-08-19：Stage2-A 初步实现：新增 `database.types.ts`、`supabase-mapping.ts`、`supabase-repository.ts`、`request-repository.ts`，实现 RLS scoped read mapping 与 Activity/Assessment 的用户归属写入；Confirm settlement 明确保持为 Stage2-B RPC 待办。新增 `0020_activity_immutability.sql` 与 mapping/迁移静态测试。tsc、lint、2 个新增测试通过；待本地 Supabase 全量 migration 和完整 suite 复核。
- 2026-08-19：验证修复：新增 migration 后更新 schema chain 测试；发现并修复 0009/0010 唯一索引缺少 `if not exists`、0018 未删除同名新策略导致重复执行失败。真实 `XP_RPG_TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres` 空库迁移冒烟通过；最终完整套件 87 passed / 1 skipped、harness 11 passed、tsc/lint/build 均通过。仅保留 Vite configLoader 的非阻断 warning。
- 2026-08-19：补齐 `docs/Check/Round11_VERIFICATION_SUMMARY.md`，记录 Round11 Stage1 PASS、9.2/10、GO→Stage2，以及 Stage2-A 实现和验证结果。下一步将与 Stage2-A 提交一起推送并核验远程 `main`。
- 2026-08-19：Round12 远程审查确认 Stage2-A 已推送，但给出 7.9/10 CONDITIONAL FAIL。发现 3 个 P1：Assessment 写入与 RLS 冲突、Activity status 可被客户端伪造、database.types.ts 不是 generated；另有 skillName 为空的 P2。按建议暂停完整 Stage2-B，新增 Stage2-A.1 Authority Wiring Closure 计划。
- 2026-08-19：开始 Stage2-A.1：已使用 `supabase gen types typescript --local` 生成完整 `database.types.ts` 并补 `db:types` script；新增 0021 assessment authority migration、server-only AssessmentPersistenceService、交易 skill join 映射和 player-state invariant。新增测试通过（项目临时目录规避系统 Temp EPERM）。
- 2026-08-19：Docker/Supabase 数据库恢复后，`supabase db reset --yes` 已成功执行 0001→0021 全部迁移。首次真实迁移重放测试发现 0021 策略缺少幂等保护，已补 `drop policy if exists activities_delete_pending` 并修正测试说明；迁移 smoke、Assessment authority、mapping 共 3 个测试文件 6 tests 全部通过。
- 2026-08-19：真实 PostgreSQL 权限行为验证通过：authenticated 直写 `ai_assessments` 被拒绝；authenticated 修改 Activity status 被拒绝；service_role 调用 `record_ai_assessment` 成功，并原子完成 Assessment 插入及 Activity pending_assessment→assessed。完整 Vitest 89 passed/1 skipped，deterministic harness 11 passed，tsc、lint、Windows production build 均通过。待创建 Round12 摘要并提交推送。
- 2026-08-19：Round13 审查（8.0/10 CONDITIONAL FAIL，P0=0/P1=3/P2=3）后实施 Stage2-A.2 Final Authority Closure。新增 0022 删除 activities_insert、加 create_activity SECURITY DEFINER RPC；重生成 database.types.ts 含两个 RPC 并对三客户端加 `<Database>` 泛型；SupabaseRepository 写入路径接线、两个写入路由接入请求级 repository；新增 authority-final-state.test.ts（7 项真实 pg 权限断言）、修正 supabase-schema.test.ts 漂移、CI 增加 supabase-integration job。修复两库测并行争用（fileParallelism:false + schema 已存在则跳过重放）。完整 Vitest 97 passed、harness 11 passed、tsc/lint/build 通过。待创建 Round13 摘要并提交推送。
