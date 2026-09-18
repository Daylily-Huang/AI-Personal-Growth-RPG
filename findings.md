# 调查发现与核心架构决策 (Findings)

> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **更新时间**: 2026-09-18

---

## 核心架构结论与共识

1. **不可违背铁律**：
   - Time is not XP；XP is not Mastery；高 Mastery 必须 Evidence。
   - LLM 只能产生 Proposal，确定性代码与结算 RPC 拥有永久状态提交权。
   - 账本（`xp_transactions`）不可篡改；任何经验变动必须有据可查。
2. **两阶段确认流与失败隔离 (P1-02 闭环)**：
   - AI 服务异常、空输出或非法 schema 时，必须抛出 `AIAssessmentError`。
   - HTTP 接口返回 502 并保留 Activity 为 `pending_assessment`，绝不能用 mock 伪装正式模型评分入账。
3. **掌握度匹配一致性 (P1-01 闭环)**：
   - `decideMasteryAction` 仅严格消费 `target_type === "skill" && target_name === skillName`。
   - 彻底废除 `changes[0]` 兜底，严禁跨技能、跨知识实体误升级。
4. **权威计数防截断 (P2-01 闭环)**：
   - 30 天重复衰减必须基于数据库精确的 `SELECT count(*)`（`count: "exact", head: true`），严禁依赖单次未分页拉取的 `listTransactions`，避免本地 `max_rows=1000` 造成的假冲突死锁。
5. **视觉体系现代化**：
   - 新中式水墨风（Modern Eastern Ink-Wash, Light-First）。
   - 严禁业务代码直连 `--gold-*`，金色/琥珀色严格封装在冻结基元（`LevelBadge`, `MasteryBadge`, `XPProgress`）内部。
   - 全局单实例 `InspectorDrawer` 集成，杜绝私自手写遮罩与 raw z-index（`z-40`, `z-50`）。
6. **Phase 7 全站无障碍、响应式、动效与对比度终局冻结 (Phase 7 Final Freeze)**：
   - **活跃文本对比度铁律 (P1-05 闭环)**：所有正常字号交互与徽章文本必须严格满足 WCAG 2.1 AA 对比度（$\ge 4.5:1$）。`PrimaryButton` 默认态/聚焦态采用深石板文字 `--text-primary`（`#1c2127`）搭配古金底色 `--gold-400`（`#d49a26`），实测对比度为 6.52:1（`RUNTIME VERIFIED`）；hover 态源码级绑定 `hover:bg-[var(--gold-300)]`（`#f2d87e`）搭配 `text-primary`（`SOURCE VERIFIED`），依据冻结 Token 与确定性公式推导对比度为 11.49:1（`INFERENCE`，原 R3 归档 hover 行因底色为 gold-400 判定为 `NOT VERIFIED`，不作为运行时证明）；`LevelBadge` 采用深石板内衬（`bg-[var(--text-primary)]`）与古金边框/文字，实测对比度为 6.52:1（`RUNTIME VERIFIED`），彻底根除 2.49:1 非合规对比度。
   - **72 格无头浏览器全矩阵闭环**：9 路由 × 4 视口 (375/768/1024/1440) × 2 动效模式 (no-preference/reduce) 实现 100% 零水平溢出、零控制台严重错误。
   - **键盘与弹层焦点生命周期**：ReactFlow 拓扑图与原生表格替代视图双轨支持，Modal / Drawer Escape 捕获与焦点恢复规范化。
   - **CI 治理隔离**：post-merge push-to-main CI 失败（Run `34708617506`）经独立审查确认仅来源于 `tests/phase5-quests-ui.test.tsx` 与 `tests/phase5-skills-ui.test.tsx` 的 merge-base delta guard 兼容性（`KNOWN PUSH-TO-MAIN GOVERNANCE GUARD INCOMPATIBILITY`），不撤销 Phase 7 终局冻结效力。

## 2026-09-18 — Phase 8C 架构复核结论

- Phase 8B 已 FINAL FROZEN，当前 `main` / `origin/main` 精确基线为 `7df500b1c764efd247938dcf3da4e83b6e2e8e45`；Phase 8C 生产实现尚未开始。
- Phase 8C 冻结范围是单表 `journal_entries` + 7 个主观状态标量；不建立独立 State 表，不建立 `journal_evidence`。
- Journal/State 仅是主观上下文：不得产生或扣除 XP，不得改变 Mastery，不得满足 Evidence，也不得修改永久 Character/Growth Core 状态。
- Journal 正常写路径应采用 authenticated direct repository write + RLS/tenant trigger；Phase 8A 未授权 journal authoritative RPC，若后续需要新增 RPC 应走 ADR/change control。
- Phase 8C 正常删除 UX 以 `is_archived` 为准；冻结文档中的 hard-delete 文字与当前 finalized-reference schema 尚未形成完整可执行契约，因此 hard delete 不作为 Phase 8C DoD。
- AI 在 8C 最多产生 `JOURNAL_INSIGHT` advisory proposal/preview；不得自动改写 Journal，不得创建/提交 Strategy，Strategy authority 属于 8D。
- 发现冻结文档编号冲突：`12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md` 把 Phase 8C exit gate 写成 O007/O011/O018，但 `11_TESTING_SECURITY_AND_HARNESS_PLAN.md` 的 canonical O011 实际是 Focus Time 不能直接产生 XP/Reward。不得静默重编号冻结 O011；Phase 8C 应补充独立断言 `C011_JOURNAL_STATE_NOT_CAPABILITY`，并保留 canonical O007/O018。
- `04_JOURNAL_AND_STATE_SPEC.md` 描述 `WEEKLY_REFLECTION` 可带 Review link，但冻结 `journal_entries` schema 没有 `review_id` / `season_review_id`。Phase 8C 不应自行加字段；本轮 controlling draft 明确只保留现有 Season/Quest/Activity context links。
- 独立 Gatekeeper 初审 PR #35 exact head `d83c324b...` 得出 `P0=0 / P1=2 / P2=0 — NO-GO`：其一，entry-type 必填 context 若做数据库 CHECK 会与 FK `ON DELETE SET NULL` 及既有 Quest hard-delete 路径冲突；其二，当前 Phase 8B `rpc_review_outer_loop_proposal` 不接受 `JOURNAL_INSIGHT`，所以 Phase 8C 不能仅以“optional”措辞授权生产 AI 接入。
- 首轮 corrective head `e40cd4cf...` 独立复审为 `P0=0 / P1=1 / P2=0 — NO-GO`。P1-02 已关闭；P1-01R 指出“所有 deliberate edit 均重检 context 必填”会导致父实体合法删除并 `SET NULL` 后的历史 Journal 无法继续编辑，与冻结规范的 direct user edits / archive 生命周期冲突。
- P1-01R 的闭合规则：CREATE 校验 resulting entry；UPDATE 仅在用户显式修改 `entry_type` 或相关 contextual FK 时重检。因父删除自动 `SET NULL` 形成的历史行仍允许普通 content/state 编辑和 archive/unarchive；用户主动移除或改变必需 context 时继续 fail-closed。
- `JOURNAL_INSIGHT` 生产 generation/review/settlement 继续完全延期，不扩展现有 proposal RPC。
- 第二轮 corrective exact head `a702985041c3fb616ea3b64b5998ffd6de0d087b` 已由独立 Gatekeeper 复审为 `P0=0 / P1=0 / P2=0 + GO`。因此 Phase 8C 生产实现准入已满足；后续实现头必须重新独立审查，不能把该 GO 错绑定到未来实现 SHA。
- 当前 migration 链截至 `0044_phase8b_rpc_authority.sql`，因此 Phase 8C Round 1 的下一顺序 migration 为 `0045`。Round 1 只允许新增 `journal_entries` 一表，并落实 taxonomy/scalar constraints、三类 `ON DELETE SET NULL` context FK、RLS、tenant-isolation trigger、immutable/update timestamp guards 与数据库测试。
- Round 1 已按上述边界实现 `0045_phase8c_journal_state_foundation.sql`：只新增 `journal_entries`；authoring-time context requirements 未做 DB CHECK，避免阻断父实体 `ON DELETE SET NULL`，其 CREATE/显式 context-update 校验仍保留给 Round 2 domain/repository 层。
- 本地离线验证：`tests/supabase-schema.test.ts` + `tests/phase8c-db-foundation.test.ts` 得到 `35 passed / 8 skipped`；跳过项均为需要 `XP_RPG_TEST_DB_URL` 的真实 DB tests。两份测试文件 ESLint 通过，`git diff --check` 通过；因此当前只有静态/类型级本地证据，DB runtime authority 仍需 CI。
- Round 1 implementation exact head `c9d0d2765a043a4dc874a6c0a1f16da9f29807f8` 已由 GitHub Actions Run `35339072556` 复验：`check` 与 `supabase-integration` 均 success；后者包含真实 Supabase startup、production build、database-backed tests、deterministic harness 与 E2E，因此 Round 2 入口门禁已满足。
- Round 2 采用独立 `src/lib/journal/*` direct-repository surface，不新增 Journal RPC。HTTP 层先取得 authenticated repository，因此 tenant identity 只来自 session；请求体中的 `userId` 不进入 repository input。
- Round 2 Gatekeeper 对 exact head `c74a58322e063b9461fbae5bf2c2e5f641a05f66` 的三项 P1 均属于 DB 运行时证据缺口：O018 缺跨租户 DELETE fail-closed；parent-deletion compatibility 缺 archive→unarchive 与无副作用快照；C011 只计事件表且 STATE_LOG 未使用边界标量。corrective 测试已将 Growth Core 基线扩展到非空 player/skill、稳定 Quest status 与既有 XP/Evidence/Mastery event counts，并锁定 Journal 7 个 state scalars。
- Context requirements 在 repository domain 层执行：CREATE 始终校验；PATCH 先计算 resulting entry type，仅当 `entryType` 改变，或该 resulting type 实际依赖的 contextual FK 被显式改变时重检。由此，父实体合法删除并 `ON DELETE SET NULL` 后形成的历史缺失 context 不会因修改无关 FK、正文、state 或 archive/unarchive 被重新阻断；主动移除/改变仍被 resulting type 要求的 context 继续 fail-closed。
- Round 2 API 不暴露 DELETE handler；normal product deletion 仅通过 `isArchived` PATCH。新 Journal surface 静态守卫确认没有 `.rpc(...)` 与 `JOURNAL_INSIGHT` production authority。
- Round 2 最终本地定向门禁为 `49 passed / 8 skipped`，新增覆盖历史行修改无关 contextual FK 不触发缺失 required context 重检，以及非法 `loggedAt` 的 DB timestamp 错误映射 HTTP 400；全量复跑为 `45 files passed / 22 skipped`、`747 passed / 313 skipped`，ESLint 与 Next.js production build 均通过。首次全量测试出现一次 Windows 文件锁 `EPERM`（`.data/demo.json.tmp -> demo.json`）；对应 `quest-system.test.ts` 隔离复跑 13/13 通过，之后全量测试再次运行全绿，因此当前证据将其归为环境抖动而非 Journal 回归。8 个 skipped 仍仅因本机未配置 `XP_RPG_TEST_DB_URL`，真实 DB 权威仍待 exact-head CI。
- 首轮 corrective 后 exact head `886761353a0b053e89f1836e26e287a612b0f2fa` 的 GitHub Actions Run `35363920987` 已确认 `check` 与 `supabase-integration` 双绿，包含真实 Supabase startup、production build、database-backed tests、deterministic harness 与 E2E。
- 对 `8867613...` 的独立 Round 2 复审结果为 `P0=0 / P1=1 / P2=0 — NO-GO`。此前三项 P1（O018 跨租户 DELETE、parent deletion 后 archive/unarchive + snapshots、C011 permanent-state/boundary snapshots）均确认关闭；新增唯一 P1 是 authenticated DB authority 可直接 INSERT/UPDATE `journal_entries`，从而绕过 repository 的三类 authoring-time required-context 校验。
- 当前 corrective 在 `trg_enforce_journal_entry_field_authority()` 内补 authenticated authority：CREATE 对 `QUEST_REFLECTION` / `SEASON_REFLECTION` / `FAILURE_POSTMORTEM` 强制 required context；UPDATE 仅在 `entry_type` 或 resulting type 的 relevant contextual FK 显式变化时重检。该设计不使用会阻断 FK `ON DELETE SET NULL` 的表级 CHECK，因此父删除后的历史 Journal 仍可普通编辑与 archive/unarchive。
- `tests/phase8c-db-foundation.test.ts` 已增加 direct authenticated DB 回归：三类缺失 context INSERT 必须拒绝；合法行主动移除 required context 必须拒绝；`FREE_REFLECTION -> QUEST_REFLECTION` 无 quest context 必须拒绝。taxonomy fixture 同步补合法 Quest/Season context。
- 当前 corrective 本地证据：targeted tests `14 passed / 9 skipped`（DB suite 因缺 `XP_RPG_TEST_DB_URL` skip）、全量 `45 files passed / 22 skipped`、`747 passed / 314 skipped`，lint、production build、deterministic harness 11/11 与 `git diff --check` 全绿。本机 Docker Desktop daemon 未运行，因此真实 DB runtime 不能在本地宣称通过，必须由新 exact-head `supabase-integration` CI 给出。

## 2026-09-17 — Phase 8B CI 证据

- Draft PR #33 当前实现提交：`b94d12708fccd205ff716ccb67fd994b81bd9b0a`；GitHub Actions Run `35118406738`。
- `supabase-integration` 已成功启动真实 Supabase、导出测试凭据并完成 production build；失败发生在 database-backed tests。
- Phase 8B 两个 DB 测试的 setup/cleanup 使用带参数的多语句 `pg.query(...)`，PostgreSQL/pg 返回 `42601 cannot insert multiple commands into a prepared statement`。这意味着首轮 CI 尚未真正完成 Phase 8B DB/RPC 行为验证。
- 同一 CI 还暴露两个静态守卫问题：`tests/supabase-schema.test.ts` 预期迁移链未包含 0043/0044；historical visual guard 将本次 backend migration delta 误判为 visual migration。两处已有手术式本地修复，需由下一次 Linux CI 验证 fail-closed 语义。

## 2026-09-17 — Phase 8B Round 3 API / Adapter 证据

- Run `35119470754` 已确认 Round 1/2 权威层：`check` 与 `supabase-integration` 全绿，真实 database-backed tests、deterministic harness、E2E 均 success。
- Round 3 新增 HTTP 适配层只包裹既有 Phase 8B repository/service 与 9 个数据库 RPC；未新增表、RPC，也未修改 XP / Mastery / Evidence / Quest 状态权威逻辑。
- 新增 `tests/phase8b-api-adapters.test.ts` 覆盖认证优先、输入校验、数据库错误到 HTTP 4xx 映射、O022 产品 DELETE fail-closed、FINAL Review 必须经 Season conclusion、proposal review 仅委托既有 authority。
- 本机全量门禁：43 test files passed / 21 skipped，711 tests passed / 295 skipped；全量 ESLint 与 Next.js production build 通过。
- 全量测试同时暴露 Windows shell 会把未引用的 `HEAD^1` 解释成 `HEAD1`；`tests/helpers/governance-delta.ts` 与对应回归测试已做最小跨平台引用修复，治理测试 26/26 通过，fail-closed 语义不变。

## 2026-09-17 — Phase 8B Round 4 Journey UI 证据

- Round 3 exact head `6e5ccdfc902dee3d9478742876aaefc0560f7e02` 已由 CI Run `35121618237` 复验：`check` 与 `supabase-integration` 均 success，因此满足 controlling document 的 Round 4 进入条件。
- 新增 `/journey/seasons` 与 `/journey/reviews`。Journey 采用局部单实例 `AppShellProvider + AppShell`，未修改历史全局 route classifier；局部导航只暴露 Seasons / Reviews。
- UI 仅调用既有 Phase 8B HTTP API，不直接导入 Supabase、不调用 `.from()` / `.rpc()`、不暴露 service-role，也未扩展 Phase 8C–8G surface。
- `/journey/reviews` 的生产构建阻塞来自 Next.js 16.3.1 对 client `useSearchParams()` 的 Suspense 要求；已改为 server page 解析 async `searchParams`，再把 `initialSeasonId` 传给 `ReviewsClient`，保留筛选行为并消除 CSR bailout。
- Round 4 + Round 3 定向测试 18/18；本机全量 44 files passed / 21 skipped，719 tests passed / 295 skipped；全量 ESLint 与 Next.js production build 通过。build route 表确认 `/journey/reviews` 为动态服务端路由、`/journey/seasons` 正常生成。

## 2026-09-17 — Phase 8B Round 5 Exit Verification 证据

- Round 4 exact head `6f94f3a06ea30cfb77faa870053aedcbf03f6b8b` 的 CI Run `35124441177` 已确认 `check` 与 `supabase-integration` 双绿，因此 Round 5 入口成立。
- canonical exit set 已包含 O006/O013/O014/O015/O016/O022；新增运行时覆盖还包括 concurrent WEEKLY Review version allocation、concurrent FINAL amendment version allocation，以及 Proposal CAS 的 EDITED、REJECTED 与 concurrent winner/loser。
- Round 5 测试提交 `631451edc6c585f6c327e3fd38a8accb7ae6696d` 的 CI Run `35127960690` 暴露的是测试夹具完整性问题：O006 为 Growth Core snapshot 新增真实 `xp_transactions` row 时引用了 `ASSESSMENT_A`，但未 seed `public.ai_assessments`，因此触发 `fk_xp_transactions_assessment`。该失败不构成 RPC/CAS 语义失败证据。
- Fixture 在 commit `80abfa3878a76e1f74279c86d0c5413786fad9e9` 修复：先插入与 Activity 同 user/rules_version 的 confirmed assessment，再插入 XP row；cleanup 按 FK 顺序先删 XP、再删 assessment、后删 Activity。
- 本机修复后：725 passed / 301 skipped；ESLint、production build、deterministic harness 11/11 全绿。数据库测试本地因无 `XP_RPG_TEST_DB_URL` 跳过，因此 DB authority 的最终运行时证据来自 GitHub CI。
- Exact-head CI Run `35128996512` 对 `80abfa3878a76e1f74279c86d0c5413786fad9e9` 全绿：`check` 的 Lint/Test/Build 全 success；`supabase-integration` 的真实 Supabase startup、production build、database-backed tests、deterministic harness、E2E 全 success。
- 截至该 exact head，Phase 8B controlling document DoD 1–7 已有实现与 CI 证据支持；DoD 8 仍需独立 Gatekeeper 对最终实现头给出 `P0=0 / P1=0 / P2=0` + `GO`，DoD 9 仍要求 accepted implementation 在 Phase 8C 开始前 merge。


## 2026-09-18 — Phase 8B Final Freeze

- 历史 Gatekeeper 文件 `docs/Phase8/14_PHASE8B_GATEKEEPER_FINAL_REVIEW.md` 只针对旧 head `c4b4f2c...`，其 `NO-GO / P1=2 / P2=2` 继续保留为历史证据；corrective head `ae35a63ab15abab6c6e7fafd06fd51281ab6e634` 已逐项关闭 P1-01/P1-02/P2-01/P2-02。
- 修复边界经独立复核：Review 同 commit-key 并发 replay 在 parent Season 锁后收敛；Season hard delete 仅允许 DRAFT/PLANNED；契约定义的 proposal/schema validation 映射 HTTP 422；过期 proposal 持久化为 EXPIRED、保持 decision/resulting entity 为空并写审计事件。
- Exact-head GitHub Actions Run `35310121814` 对 `ae35a63...` 全绿：`check` 的 lint/test/build success；`supabase-integration` 的真实 Supabase、production build、database-backed tests、deterministic harness、E2E 全 success。
- PR #33 已合入 `main`，merge commit `0e4bec5f26411669f7031af4523b6d4fca747f96`。对应 post-merge push CI Run `35315613393` 同样双 job 全绿。
- 因当前 main push 已验证成功，Phase 7 历史 Run `34708617506` 所记录的 push-to-main governance incompatibility 在当前基线已闭环；历史失败记录不删除。
- Phase 8B 已满足 controlling document 的独立复审与 merge gate，正式 **FINAL FROZEN**。Phase 8C 仅具备进入其独立规划/准入流程的前置条件，尚未启动。
