# 项目历史工作进度 (Progress Log)

> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **更新时间**: 2026-09-18

---

## 2026-09-17 — Phase 8B Season & Review 实施

- 已有实现：0043 五表 foundation、0044 九个权威 RPC、Phase 8B DB/RPC 测试、outer-loop repository/service scaffold；Draft PR #33。
- 首轮真实 CI Run `35118406738`：`check` 与 `supabase-integration` 均未通过。
- 已确认并修复第一层阻断：Phase 8B DB tests 不再把多条参数化 SQL 作为单个 prepared statement 执行，fixture cleanup 改为逐条查询。
- 已保留本地 CI 守卫修复：迁移白名单纳入 0043/0044；visual migration activation 不再仅由验证测试文件触发。
- Run `35119470754` 已证明真实 Supabase DB/RPC 权威层、deterministic harness 与 E2E 全绿。
- Round 3 已实现 `/api/seasons`、Season lifecycle action routes、Season-Quest link、Review finalize/amend、全局 Review read 与 outer-loop proposal review HTTP 适配器，并新增统一 Phase 8B HTTP 错误映射。
- 新增 Round 3 API 契约测试 10 项；本机全量结果 711 passed / 295 skipped，lint/build 全绿。
- 顺带修复 Windows 下 governance delta helper 对 `HEAD^1` 的 shell 转义兼容性，定向治理回归 26/26 通过。
- Round 3 已提交为 exact head `6e5ccdfc902dee3d9478742876aaefc0560f7e02`；GitHub Actions Run `35121618237` 的 `check` 与 `supabase-integration` 全绿，Round 4 进入门禁已满足。
- Round 4 已实现 Journey UI：`/journey/seasons` 与 `/journey/reviews`，覆盖 Season lifecycle、Quest 关联、周期 Review、FINAL amendment 与只读版本历史；Journey 局部 AppShell 保持单实例且未触碰历史全局导航治理。
- 修复 Next.js 16.3.1 production build 对 `/journey/reviews` 的 `useSearchParams()` Suspense 阻断：server page 解析 async `searchParams`，交互逻辑迁移到 `ReviewsClient`。
- Round 4 本地门禁：Round 3+4 定向 18/18；全量 44 files passed / 21 skipped，719 passed / 295 skipped；全量 ESLint 与 production build 全绿。
- Round 4 exact head `6f94f3a06ea30cfb77faa870053aedcbf03f6b8b` 已由 CI Run `35124441177` 复验，`check` 与 `supabase-integration` 均全绿。
- Round 5 新增 canonical exit / 并发覆盖：O006 ABANDONED Growth Core snapshot（含真实 XP ledger row）、O015 Quest 状态不随 Season conclusion 改写、并发 WEEKLY Review version allocation、并发 FINAL amendment version allocation，以及 Proposal CAS 的 EDITED / REJECTED / concurrent winner-loser 数据库运行时覆盖。
- Round 5 首个测试提交 `631451edc6c585f6c327e3fd38a8accb7ae6696d` 的 CI Run `35127960690` 在 `Run database-backed tests` 失败；根因是新增 O006 基线 XP transaction 使用 `ASSESSMENT_A`，但 fixture 未先插入对应 `public.ai_assessments` 父记录，触发 `fk_xp_transactions_assessment`，并非 Phase 8B RPC/CAS 逻辑失败。
- 已手术式修复 fixture：在 XP row 前 seed `ai_assessments`，cleanup 顺序改为先删 `xp_transactions`、再删 `ai_assessments`、后删 activity；commit `80abfa3878a76e1f74279c86d0c5413786fad9e9`。
- 修复后本机门禁：44 files passed / 21 skipped，725 tests passed / 301 skipped；ESLint、Next.js production build、deterministic harness 11/11 全绿。数据库相关 14 tests 本地因未配置 `XP_RPG_TEST_DB_URL` 正常 skip，不作为 DB 运行时证据。
- Exact-head CI Run `35128996512` 已全绿：`check` success；`supabase-integration` success，其中 production build、database-backed tests、deterministic Growth Engine harness、E2E 均 success。
- 下一步：对 exact implementation head 做独立只读 Gatekeeper 终审；若 `P0=0 / P1=0 / P2=0` 且明确 `GO`，则 Phase 8B implementation 满足 DoD 1–8，DoD 9 仍要求在 Phase 8C 前合入。


## 2026-09-18 — Phase 8B 项目收尾与终局冻结

- Gatekeeper 历史 NO-GO 头 `c4b4f2c...` 的四项 finding 已由 corrective head `ae35a63ab15abab6c6e7fafd06fd51281ab6e634` 手术式关闭，并补齐同 commit-key 并发 replay、CANCELLED 删除、HTTP 422 taxonomy、proposal EXPIRED 生命周期/审计回归。
- Independent exact-head re-review 已记录为 `P0=0 / P1=0 / P2=0 + GO`。
- GitHub Actions Run `35310121814` 对 corrective exact head 全绿：`check` 与 `supabase-integration` 均 success，后者包含真实 database-backed tests、deterministic Growth Engine harness 与 E2E。
- PR #33 已于 2026-09-18 合入 `main`，merge commit `0e4bec5f26411669f7031af4523b6d4fca747f96`。
- Post-merge main push CI Run `35315613393` 全绿，证明当前 main 的 push-to-main governance path 已恢复正常。
- Phase 8B DoD 独立审查与最终 merge gate 均满足，状态更新为 **FINAL FROZEN**；Phase 8C 尚未启动。
- 新增归档：`docs/Phase8/15_PHASE8B_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`。

## 2026-09-18 — Phase 8C controlling document 审查与草拟

- 已从 `main` 基线 `7df500b1c764efd247938dcf3da4e83b6e2e8e45` 创建文档分支 `codex/phase8c-controlling-review`。
- 已完成 AGENTS.md 要求的 Design ChatGPT 01–09 前置规则阅读（本轮补完 04–09），并复核 Phase 8 冻结架构的 Journal/State、DB、API/RPC、测试、安全与 phase ordering 边界。
- 已确认关键 O011 编号冲突：Phase 8C 控制文档将采用 supplemental `C011_JOURNAL_STATE_NOT_CAPABILITY`，不篡改 frozen canonical O011。
- 当前只进入 controlling-document planning/drafting；Phase 8C production implementation 仍为 BLOCKED，等待后续独立 Gatekeeper GO。
- 已新增 `docs/Phase8/16_PHASE8C_JOURNAL_STATE_IMPLEMENTATION_CONTROLLING.md` 草案；状态明确为 `DRAFT — PENDING INDEPENDENT GATEKEEPER; PRODUCTION IMPLEMENTATION BLOCKED`。
- 草案已封口三处架构歧义：O011 编号冲突、hard-delete 未闭合契约、WEEKLY_REFLECTION 描述中的 Review link 与冻结 schema 不一致。
- 首轮文档校验发现并修复尾随空格：`git diff --check` 命中 `task_plan.md` 1 处；同时清理新 controlling draft 头部用于 Markdown 强制换行的尾随空格，避免提交门禁噪声。
- 最终文档门禁通过：`git diff --cached --check` 无错误；四个修改文件均为有效 UTF-8 且无 NUL；无 `src/`、`supabase/`、`tests/` 或冻结 Phase 8 00–12 变更；现有用户未跟踪文件保持未触碰。
- controlling draft 首次提交：`0925b3a27043021d5c73e0a5c241c712d34c78ee`，分支 `codex/phase8c-controlling-review` 已推送。
- 已创建 Draft PR #35：`docs: draft Phase 8C Journal + State controlling document`；下一治理步骤是由独立 Gatekeeper 对 PR exact head 做只读审查，当前不授权生产实现。
- 独立只读 Gatekeeper 使用单独 Codex 会话审查 exact head `d83c324b4666816359f8b86df87bafca4bf4aa22`，结果 `P0=0 / P1=2 / P2=0 — NO-GO`；tracked worktree/index 未被 reviewer 修改。
- 已按两项 finding 做最小 controlling-document 修正：authoring-time context 与 FK `ON DELETE SET NULL` 解耦并增加 parent-deletion regression；`JOURNAL_INSIGHT` 全面延期出 Phase 8C production scope。
- corrective head `e40cd4cf248c82f77a980ff841d6f20c6b6834e2` 的独立复审结果为 `P0=0 / P1=1 / P2=0 — NO-GO`：P1-02 已关闭；P1-01R 发现 parent deletion 后 context FK 合法变 NULL 的历史 Journal 会被“每次 deliberate edit 重检 context”规则阻断普通编辑。
- 第二轮最小修正已收窄 UPDATE 校验：仅显式变更 `entry_type` 或 relevant contextual FK 时重检；父删除后的普通 content/state edit 与 archive/unarchive 保持允许，并新增对应 acceptance coverage。
- 第二轮 corrective commit `a702985041c3fb616ea3b64b5998ffd6de0d087b` 已推送，远端分支与本地 exact head 一致；独立复审结果为 `P0=0 / P1=0 / P2=0 + GO`。P1-01R、P1-02 均关闭，Phase 8C production implementation 准入解除。
- 已进入 Phase 8C Round 1：范围限定为 `journal_entries` migration、数据库约束、RLS/tenant trigger 与真实 database-backed tests；冻结 Phase 8 00–12 保持不改。
- Round 1 实现前检查确认现有迁移编号止于 0044；Phase 8C schema 契约仅授权一张 `journal_entries` 表，下一 migration 采用 0045，不提前创建 API/UI/AI 代码。
- Round 1 已落地 `0045_phase8c_journal_state_foundation.sql`：单表 `journal_entries`、9 值 taxonomy CHECK、7 个 state scalar CHECK、Season/Quest/Activity `ON DELETE SET NULL`、required indexes、RLS owner policies、`trg_enforce_journal_entry_tenant_isolation`、immutable-field/update timestamp guard 与最小列权限。
- 新增 `tests/phase8c-db-foundation.test.ts`，覆盖 taxonomy、scalar 边界、tenant SELECT、跨租户 context、immutable/system timestamps、archive/unarchive、client UUID、parent deletion SET NULL 与 Growth Core 无副作用；`tests/supabase-schema.test.ts` 已纳入 0045 chain 和离线 authority guards。
- 本机 targeted tests：`35 passed / 8 skipped`；8 个 DB tests 因 `XP_RPG_TEST_DB_URL` 未配置而 skip，不作为 DB runtime 证据。两测试文件 ESLint 全绿，`git diff --check` 无错误。Round 2 必须等待 CI 的真实 Supabase DB tests 成功后再进入。
- Round 1 implementation 已提交为 `c9d0d2765a043a4dc874a6c0a1f16da9f29807f8` 并推送至 PR #35；GitHub Actions Run `35339072556` 已全绿，真实 database-backed tests、deterministic harness、E2E 均 success，Round 2 阻塞解除。
- Round 2 已新增 `src/lib/journal/{types,repository,request,http}.ts` 与 `/api/journal`、`/api/journal/[id]` Route Handlers；范围仅 authenticated create/read/list/update/archive，没有 hard-delete route、Journal RPC 或 `JOURNAL_INSIGHT` production authority。
- Round 2 domain validation 已落实：三类 authoring context 必填；显式 `entryType`/Quest/Season context PATCH 才触发 resulting-entry 重检；父删除造成的历史 `SET NULL` 行仍允许普通正文、state 与 archive/unarchive PATCH。
- 新增 `tests/phase8c-api-domain.test.ts`，并增强 `tests/phase8c-db-foundation.test.ts` 的 O007/O018/C011 命名与 `FAILURE_POSTMORTEM` parent-deletion compatibility；随后修正 resulting-entry relevant-context PATCH 校验，并补充历史行无关 contextual FK 更新与非法 timestamp→HTTP 400 回归。最终定向门禁 `49 passed / 8 skipped`；全量 `45 files passed / 22 skipped`、`747 passed / 313 skipped`；ESLint 与 production build 全绿。首次全量测试的一次 Windows `EPERM` 经 `quest-system.test.ts` 隔离 13/13 与全量复跑全绿确认未复现。8 个 skipped 仅因本机未配置 `XP_RPG_TEST_DB_URL`。
- Round 2 Gatekeeper 在 exact head `c74a58322e063b9461fbae5bf2c2e5f641a05f66` 返回 `P0=0 / P1=3 / P2=0 — NO-GO`。三项 corrective 已落到 `tests/phase8c-db-foundation.test.ts`：跨租户 DELETE 返回 0 行且目标仍存在；parent SET NULL 后完成 archive→unarchive，并比较 Journal 7 标量与 Growth Core 前后快照；C011 使用 STATE_LOG 上下边界值，并比较非空 `player_states`、`skills`、稳定 `quests.status` 及 XP/Evidence/Mastery event counts。当前定向本地门禁 `14 passed / 8 skipped`，8 个 skipped 仍仅因本机缺 `XP_RPG_TEST_DB_URL`。
- 首个 corrective exact head `10b925cf8994fa2f938c2dac13b2e4ff13871266` 的 CI Run `35363322596`：`check` success，但 `supabase-integration` 在真实 DB tests 的 fixture setup 失败，错误为 `23505 player_states_pkey`。根因是 auth-user bootstrap 已存在 `player_states`，测试又普通 INSERT 同一 `user_id`；已将该基线 seed 改为 `ON CONFLICT (user_id) DO UPDATE`，保持非空 Growth Core 基线而避免重复主键。
- 第二个 corrective exact head `886761353a0b053e89f1836e26e287a612b0f2fa` 的 CI Run `35363920987` 已全绿：`check` 与 `supabase-integration` 均 success，后者包含真实 Supabase startup、production build、database-backed tests、deterministic harness 与 E2E。
- 对 `8867613...` 的独立 Round 2 复审返回 `P0=0 / P1=1 / P2=0 — NO-GO`。先前三项 P1 均被确认关闭；新增 P1 指向 DB authority：authenticated 角色可直接 INSERT/UPDATE，现有 RLS + field-authority trigger 未强制 required authoring context，可绕过 repository validation。
- 已完成该 P1 的手术式 corrective：migration trigger 对 authenticated CREATE 强制三类 required context；authenticated UPDATE 仅在 `entry_type` 或 resulting type 的 relevant contextual FK 显式变化时重检，因此父实体删除造成的自动 `SET NULL` 不会阻断历史行普通编辑/归档。DB tests 已覆盖无 context direct INSERT、主动移除 context 与无 context entry-type 转换。
- 当前本地门禁：targeted `14 passed / 9 skipped`，全量 `45 files passed / 22 skipped`、`747 passed / 314 skipped`，lint、production build、deterministic harness 11/11、`git diff --check` 全绿；冻结 Phase8 00–12 仍零改动。本机 Docker daemon 不可用，因此 DB runtime 证据仍待新 exact-head CI。
- Round 2 最终 exact head `8c156032c95caae7b1832ad7dc0d2603d5bb8981` 的 GitHub Actions Run `35367209443` 已确认 `check` 与 `supabase-integration` 双绿；两次独立复审均为 `P0=0 / P1=0 / P2=0 + GO`，Round 2 正式接受。
- Round 3 Journey Journal UI 已实现：新增 `/journey/journal` 与 Journey “日志”导航，覆盖反思 create/edit、类型/归档筛选、Quest/Season context、archive/unarchive、7 个主观状态控件、当前筛选集描述性均值，以及 loading/empty/error、Ctrl/⌘+Enter、响应式与长文本处理；UI 仅调用既有 HTTP API。
- Round 3 本地门禁：定向 `27/27`；全量 `46 files passed / 22 skipped`、`752 passed / 314 skipped`；lint、production build、deterministic harness `11/11`、`git diff --check` 全绿；冻结 Phase 8 00–12 与 Round 2 authority 区域相对 `8c156032...` 均零新增差异。下一步为提交推送 Round 3，绑定新 exact head 跑 CI 并做独立复审。

## 关键里程碑归档记录

- **Stage 0~4 业务核心已冻结**：
  - Stage 0 基础设施与 Supabase/RLS 隔离
  - Stage 1 活动解析与校验
  - Stage 2 两阶段确认流与 RPC 结算事务
  - Stage 3 读路径集成与认证中间件
  - Stage 4 任务系统层级与权威大小快照
- **Stage 5~7 领域模型与服务已冻结**：
  - Stage 5 技能树与派生状态服务
  - Stage 6 知识图谱与推断/验证状态机
  - Stage 7A/7B 成果（Artifacts）实体权威与关系链路
- **Phase 1~4 全局视觉基石已冻结**：
  - Phase 1 设计 Tokens
  - Phase 2 AppShell 骨架
  - Phase 3 共享 UI 基元库
  - Phase 4 成果库视觉现代化
- **Phase 5 核心页面视觉现代化 (当前进行中)**：
  - 2026-09-03: Stage 5A Dashboard 现代化完成，PR #18 合入 main 并标记 FINAL FROZEN。
  - 2026-09-04: Stage 5B Quests 现代化完成，PR #19 合入 main 并标记 FINAL FROZEN。
  - 2026-09-05: Stage 5C Skills 现代化完成，ReactFlow 画布、SkillNode、DetailPanel、InspectorDrawer 浅色水墨化，82 项测试全绿。
- **独立审查与复审缺陷修复追踪 (2026-09-05)**：
  - 2026-09-05 初审（`2026-09-05_PROJECT_REVIEW.md`）：提出 P1-01（掌握度跨实体误授）、P1-02（AI 失败 mock 泄露）、P2-01（账本重复计数截断）、P2-02（入口文档滞后）。
  - 2026-09-05 复审（`2026-09-05_PROJECT_RE_REVIEW.md`）：
    * P1-01 已确认关闭（掌握度要求 skill 类型并精确匹配名称，删除 changes[0] 兜底）。
    * 提出 P1-A（新技能空 UUID 传入 countRecentSimilarTransactions 阻断结算）。
    * 提出 P1-B（未配置 AI 凭据时仍默认允许真实 Supabase 模式生成 mock）。
    * 提出 P2-A（`tests/ai-assessment-failure.test.ts` 中 any 类型与未使用变量造成 lint 阻断）。
    * 提出 P2-B（`docs/MASTER_PROJECT_HANDOFF.md` 实际文件未落地）。
  - 2026-09-05 代码手术式修复闭环：
    * P1-A 已修复：`countRecentSimilarTransactions` 对空 `skillId` 短路返回 0，不发送无效 PostgREST UUID 查询。
    * P1-B 已修复：`assessActivity` 严格检查 `allowDemoFallback === true`，生产/Supabase 模式缺配置直接抛出 `ai_not_configured` 并保留 Activity。
    * P2-A 已修复：移除 any 类型与未使用变量，ESLint 0 errors 0 warnings。
    * P2-B 已修复：`docs/MASTER_PROJECT_HANDOFF.md` 物理写入磁盘，更新 README.md 与 AGENTS.md 链接。
  - 2026-09-06 终审与合流（`2026-09-06_E860DAD_REVIEW.md`）：
    * R1 已关闭：门禁测试套件统一引入 `AUTHORIZED_CORE_BUGFIX_ALLOWLIST` 精确手术式白名单，零破坏零删除，所有 PR Delta 测试全绿。
    * R2 已关闭：实现轻量级进程内确定性 OpenAI 测试服务（`tests/helpers/mock-ai-server.ts`），真实 Next.js / Supabase 集成测试自动挂载，生产环境严格保持 fail-closed。
    * R3 已关闭：`docs/MASTER_PROJECT_HANDOFF.md` 修正 Mastery 等级为 M0~M10，验证门槛为目标 >= M5 或单次跨级 >= 2。
    * GitHub Actions CI 双绿通过（`check` ✅, `supabase-integration` ✅）。
    * **PR #20 已通过 Squash and merge 合入 main（Commit `6e238a4`），Stage 5C-UI Skills Modernization 正式宣告 FINAL FROZEN！**
