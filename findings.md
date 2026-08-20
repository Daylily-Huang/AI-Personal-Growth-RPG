# 调查发现

## 当前状态
- Round11 已确认 Round10 Stage1 Gate 正式冻结：Stage1 评分 9.2/10，P0=0，GO → Stage2。
- 当前代码仍由 `DemoRepository` 提供运行时数据；`src/lib/supabase/index.ts` 已预留 Stage2 wiring point。
- Stage2 应拆成两个可审查 commit：Stage2-A 先做 Repository/Auth wiring/generated DB types/Activity immutability/basic mapping；Stage2-B 再做 settlement RPC/事务/幂等/repetition/mastery/concurrency/双用户测试。
- 本轮已开始执行 Stage2-A 和网站诊断。
- 网站诊断证据：`src/app/page.tsx` 仅重定向到 `/dashboard`，API 路由本身使用 DemoRepository；Next 开发服务器显示 Ready，但访问 3000 无响应。
- 启动链路存在两个独立问题：直接执行项目 `next` 时因缺少 Windows SWC 包而尝试调用 `pnpm config get registry`，但当前 Bash PATH 没有 pnpm；使用受控 pnpm 时又因检测到现有 Linux/WSL `node_modules`，在无 TTY 环境中触发 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`。
- 页面使用 `next/font/google`，在当前受限网络环境会触发字体下载；已先移除该运行时网络依赖，改用本地系统字体，避免页面编译阻塞。但旧 dev 进程仍需重启后验证。
- `.env.local` 含真实 Supabase publishable/secret key，未改动、未输出、未纳入本次修复；secret 已存在泄露风险，后续应轮换。

## 证据
- `docs/Check/Round10.txt` 的原始结论为 `8.8/10 CONDITIONAL NO-GO`；后续 `docs/Check/Round10_VERIFICATION_SUMMARY.md` 记录 Gate 已通过，状态可推进 Stage2。
- Stage2 目标明确为：`SupabaseRepository`、`settle_activity` `SECURITY DEFINER` RPC、从 `auth.uid()` 推导 ownership、原子结算、幂等、Activity confirmed/frozen 不可篡改、双用户 RLS 隔离与并发测试。
- `Repository.applySettlement` 已定义 delta 语义、重复结算返回冲突、服务端重算 repetition snapshot、至少一个 pending MasteryVerification 等契约；Supabase 实现必须把这些保证放进 RPC/数据库事务，而不是复制到浏览器。
- `activities`、`ai_assessments`、`xp_transactions`、`skills`、`player_states` 均已有 `user_id`；但 `xp_transactions` 的 activity/assessment/skill 外键在 `0019` 才补齐，tenant 复合外键和结算 RPC仍未实现。
- `src/lib/supabase/index.ts` 明确当前仍运行 `DemoRepository`，只预留 Stage2 统一 wiring point。
- Git 工作区有未跟踪 `docs/Check/Round10.txt`，不应擅自纳入本轮提交。
- 当前不改 UI；先以最小后端垂直切片完成权威结算和运行时隔离，再接线前端。
- 网站无法进入根因已关闭：项目此前携带 WSL/Linux `node_modules`，Windows Next 缺少 `@next/swc-win32-x64-msvc`，造成 Ready 后请求挂起。现已备份旧依赖、安装 Windows 依赖、移除 `next/font/google` 网络字体；`/` 307、`/dashboard` 200、`/api/dashboard` 200，且受控 Node 22.22.2 + pnpm 11.7.0 下 production build 通过。
- Stage2-A 已新增最小 `Database` 类型、纯 snake_case↔domain mapping、RLS 用户域 `SupabaseRepository` 与 `getAuthenticatedRepository()`。默认 API 仍使用 DemoRepository，避免无登录 UI 时把现有网站变为 401；真实 Confirm 结算明确留给 Stage2-B 的 `settle_activity` RPC。
- 新增 `0020_activity_immutability.sql`：confirmed Activity 禁止任何 UPDATE；任何状态下 `raw_input` 与 `rules_version` 都不可修改。函数显式固定 `search_path=public`。

## Round12 审查结论
- 远程审查确认 Stage2-A 核心提交 `c882d91` 与摘要提交 `aa0b82f` 已进入 `main`。
- Round12 结论：Stage2-A 7.9/10，CONDITIONAL FAIL；P0=0，P1=3，不应直接进入完整 Stage2-B。
- P1-1：`SupabaseRepository.addAssessment()` 使用 authenticated client INSERT `ai_assessments`，但 0018 对该表仅 SELECT，真实 Supabase 必然被 RLS 拒绝；不能简单开放 INSERT，因为 Proposal 属于 server-authored state。应增加 trusted server-only assessment persistence，在一个数据库事务内写 assessment 并将 Activity 设为 assessed。
- P1-2：activities 当前 authenticated UPDATE 仍可修改 status，0020 只阻止 old.status=confirmed 和 facts 改动，不能阻止客户端伪造 assessed/confirmed/pending 状态。应移除客户端 UPDATE 权限，状态转移只允许 trusted assessment persistence / settlement RPC。
- P1-3：`database.types.ts` 是手写 mini schema，不是真正 generated types，且与真实 schema 漂移。应使用 `supabase gen types typescript --local` 并加入 `db:types` script。
- 其他问题：xp transaction mapper 的 skillName 为空；getPlayer 缺行时静默返回默认玩家，应改为 invariant error（P2）。
- Round12 建议先做 Stage2-A.1 Authority Wiring Closure：assessment trusted persistence、Activity state authority、真实 generated types、transaction skillName mapping，完成后再进入 Stage2-B。
- Stage2-A.1 已完成代码和验证：0021 迁移在本地 Supabase 通过；authenticated 对 ai_assessments INSERT 和 activities status UPDATE 均被拒绝；service_role record_ai_assessment 原子写入并转移 Activity 状态；完整 suite 89 passed/1 skipped，harness 11 passed，tsc/lint/build 通过。首次迁移重放暴露的 0021 delete policy 幂等问题已修复。
- Round13 审查（8.0/10 CONDITIONAL FAIL，P0=0/P1=3/P2=3）指出 Stage2-A.1 尚未真正闭合：Activity INSERT 仍可伪造 confirmed、generated types 过期且 RPC 缺失、Assessment 未真正 wiring、authority 测试仍搜字符串、CI 未跑数据库集成。已实施 Stage2-A.2 Final Authority Closure 关闭上述 P1 与大部分 P2。
- Stage2-A.2 已落地：0022 删除 `activities_insert` 并新增 `create_activity` SECURITY DEFINER RPC（auth.uid() 推导归属、status 强制 pending_assessment、rules_version 取权威版本、时间戳服务端生成）；重生成 `database.types.ts`（含 record_ai_assessment + create_activity）并对 admin/server/browser 三个客户端加 `<Database>` 泛型；SupabaseRepository.addActivity 走 create_activity、addAssessment 走 AssessmentPersistenceService；POST /api/activities 与 /api/activities/[id]/assess 接入请求级 getRequestRepository（Supabase 已配置且已登录则走 Supabase，否则回退 Demo）；新增 `tests/authority-final-state.test.ts`（7 项真实 pg 权限终态断言）、修正 `supabase-schema.test.ts` activities CRUD 漂移、CI 增加 supabase-integration job。验证：完整 suite 97 passed、harness 11 passed、tsc/lint/build 通过。P2 残留：skillName 结算时快照（Stage2-B 加 skill_name_snapshot）、读取路径仍未全量切 Supabase。

## Round14 审查结论（Stage2-A.3）
- Round14 审查（8.6/10 CONDITIONAL FAIL，P0=0/P1=2/P2=3）确认 Stage2-A.2 的三个 P1 已真正关闭，但暴露两个新 authority 问题，Gate = NO-GO → 完整 Stage2-B，要求先做 Stage2-A.3 Authority Final-Final Closure 只修两个 P1：
- P1-1 `rules_version` authority 错误：0022 用 `order by version desc limit 1`（无 active 过滤、text 字符串排序）+ `coalesce('v1')` 兜底，会选中 draft、且注册表为空时写入 'v1'，与 Growth Engine 实际声明的 `RULES_VERSION='growth-engine-v0.1'` 漂移，审计字段不可信。修复：0023 新增部分唯一索引保证至多一个 active、注册 `growth-engine-v0.1=active` seed、create_activity 改为 `where status='active' order by activated_at desc`，无 active 时 `raise exception 'no_active_rules_version'`（fail-closed，不兜底）。
- P1-2 `getRequestRepository()` fail-open：Supabase 已配置但 session 缺失/auth 异常时静默降级 Demo 且路由仍返回 201，形成双 source of truth。修复：已配置即走 `getAuthenticatedRepository()`（未认证抛 AuthRequiredError→路由 401、基础设施异常→5xx），未配置才 Demo；两个 API 路由映射 AuthRequiredError→401。
- Stage2-A.3 已落地并验证：0023 在本地 Supabase 重放成功；authority-final-state 新增 2 项真实 pg 断言（active 优先于 draft 且不受字符串排序影响、无 active 时 fail-closed）；新增 `tests/request-repository.test.ts`（3 项：未配置→Demo、已配置无会话→AuthRequiredError、已配置基础设施异常→抛错）；EXPECTED_ORDER 扩至 0023；完整 suite 102 passed、harness 11 passed、tsc/lint/build 通过（lint 0 errors，1 个既有无关 warning：supabase-repository.ts:112 `_settlement` 未使用）。
- 残留（P2，按审查建议留待 Stage2-B）：create_activity 参数面偏宽（p_quest_id tenant 校验、p_activity_type 若为 AI-derived 应移除）、HTTP 级 wiring 集成测试（本轮以 resolver 单元测试覆盖 fail-closed 行为）、skill_name_snapshot。
