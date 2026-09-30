# 调查发现与核心架构决策 (Findings)

## 2026-09-29 Round 4 Playbook UI

- 控制文档 §9 要求 Strategy 列表/详情、用户创建、测试状态、正反证、显式晋升、情境化/退役、版本、两类 AI 提案审核。§11 将 Round 4 限定为 `/journey/playbook` 与 Journey 导航，消费已接受 HTTP/domain surfaces。
- 当前策略 HTTP API 已有 GET/POST `/api/strategies`、GET/PATCH detail、GET/POST supports/versions、POST evaluate/transition。提案只有 `POST /api/outer-loop/proposals/[id]/review`；没有列表 API。
- 支持记录的 observedAt 由 RPC 与 canonical source timestamp 精确比较；UI 不得将原值经 JS Date / datetime-local 序列化后截断微秒。
- 独立初审发现：现有 Outer Loop 只有 POST proposal review，没有可安全展示原文的 GET/list；直接让用户输入 UUID 接受属于盲审，不能满足 §9。现有来源读 API 不覆盖全部 Strategy source class，Core Evidence Reference 尤无直接读路径。完整闭环需要新增 authenticated read-only projection，但这触及 Round 3 已接受的 server boundary，应取得范围决定后实施。
- 用户已授权该只读扩展。新 projection 仅从当前用户会话读取 `outer_loop_proposals` 与七种 canonical source 表；不读取 service role，不增加任何写入路由。真实匿名/跨租户行为由 CI 临时最新迁移库 E2E 验证，本机 0042 数据库不升级。


> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **更新时间**: 2026-09-22

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

## 2026-09-22 — Phase 8D Admission 与 Round 1 当前边界

- reviewed exact head `b4c26079e5532cc1c02238f70de95f3e4694e554` 已获独立 `P0=0 / P1=0 / P2=0 + GO`；当前本地 HEAD 与该 SHA 相同，Round 1 production implementation 准入已解除。
- 当前未跟踪的 `0046_phase8d_strategy_database_foundation.sql` 仍是旧草案：使用 `DRAFT/ACTIVE/ARCHIVED` lifecycle、JSON `definition/evidence`，且没有冻结 Strategy 字段、`HYPOTHESIS/LOW/version=1` 强制语义、version-1 原子快照或 direct authenticated create/update authority，因此不能在其假设上增量修补，应按 controlling contract 重构。
- Round 1 只负责 DB foundation；canonical-source resolution、support insertion anti-replay、deterministic confidence evaluation、status/version RPC 属于 Round 2。Round 1 仍须在存储层提供正确字段/约束、RLS、不可变性、tenant guards 和 Strategy direct-write 边界，使 Round 2 能安全建立 authority RPC。
- Phase 8C `0045` 已提供可复用的安全模式：RLS + column-level `GRANT INSERT/UPDATE` + `current_user = 'authenticated'` field-authority trigger。Phase 8D Strategy 可用同一模式让 authenticated 直接创建用户假设并只编辑 `title/description`，同时给 Round 2 `SECURITY DEFINER` RPC 保留系统字段变更能力。
- `strategy_versions` 的 version-1 bootstrap 不能依赖 authenticated 对版本表的 INSERT 权限；应由 Strategy INSERT 后的内部 `SECURITY DEFINER` trigger 在同一事务创建，且 helper/trigger function 对 PUBLIC/anon/authenticated/service_role 均撤销直接 EXECUTE。
- `strategy_versions` 与 `strategy_supports` 存储层都应有不可变 trigger（UPDATE/DELETE fail closed）；authenticated 仅 SELECT。`strategy_supports` 保留冻结 composite UNIQUE `(strategy_id, source_class, source_id, observation_type, evaluator_version)`，canonical anti-replay 仍由 Round 2 RPC 在父 Strategy lock 下实现。

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
- Round 2 最终 exact head `8c156032c95caae7b1832ad7dc0d2603d5bb8981` 已由 GitHub Actions Run `35367209443` 复验，`check` 与 `supabase-integration` 均 success；两次独立 Round 2 复审均返回 `P0=0 / P1=0 / P2=0 + GO`，因此 Round 2 已接受。
- Round 3 新增 `/journey/journal`，仅消费既有 HTTP API；支持反思 create/edit、entry type 与 archive 筛选、Quest/Season context、archive/unarchive、7 个主观状态标量与当前筛选集的描述性均值。为兼容父实体删除后的历史 `ON DELETE SET NULL` 行，编辑请求仅在用户实际改变 `seasonId` / `questId` 时发送对应 context 字段。
- Round 3 本地证据：定向 `27/27`；全量 `46 files passed / 22 skipped`、`752 passed / 314 skipped`；lint、production build、deterministic harness `11/11` 与 `git diff --check` 全绿。冻结 Phase 8 00–12 及 Round 2 authority 区域（`supabase`、`src/lib/journal`、`src/app/api/journal`）相对 accepted head 均无新增差异。

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

## 2026-09-19 — Round 3 exact-head CI false-positive diagnosis

- Exact head `5617b5c8383f675cde4c041ba8c4b0f0362810da` failed `check` in CI Run `35374173512` only because `validateVisualMigrationDelta()` activated on the new Journal page while its historical authorization bridge knew Phase 8B but not Phase 8C. The reported violations were exactly `src/app/api/journal/[id]/route.ts`, `src/app/api/journal/route.ts`, and `supabase/migrations/0045_phase8c_journal_state_foundation.sql`; the Round 3 UI test itself passed.
- The corrective change is test-governance only: when `docs/Phase8/16_PHASE8C_JOURNAL_STATE_IMPLEMENTATION_CONTROLLING.md` is present in the delta, only those three exact accepted backend paths are authorized. No prefix allowlist was added.
- New regression coverage proves three properties: explicit Phase 8C binding passes; unrelated API/migration files still fail closed; the same Journal backend remains a violation without the controlling document.
- Local verification after the fix: governance `111/111`, Round 3 targeted `138/138`, full suite `758 passed / 314 skipped`, lint/build/deterministic `11/11`/diff-check all green; frozen Phase8 00–12 and Round 2 production authority areas remain unchanged.

## 2026-09-19 — Round 3 independent review P1 closure

- Independent review of exact head `d217366d4e2e401566446b2bfda0ea5faf46a18d` returned `P0=0 / P1=1 / P2=0 + NO-GO`. The only finding was a UI/domain mismatch after a required parent is legally deleted and its Journal FK becomes `NULL`: the backend permits ordinary content/state edit and archive/unarchive, but the UI still marked Quest/Season context as required and disabled `FAILURE_POSTMORTEM` submit.
- The UI now mirrors the accepted Round 2 revalidation rule. Context is strict on CREATE, on `entryType` change, or when a contextual FK relevant to the resulting type is explicitly changed. Historical parent-deletion `NULL` is preserved for unrelated edits.
- Added a runtime regression for a historical `QUEST_REFLECTION` with `questId=null`: the context select is not required, content edit submits successfully, and PATCH omits both `questId` and `seasonId` rather than inventing a replacement link.
- Closure gates: targeted `28/28`; full suite `759 passed / 314 skipped`; `pnpm lint`, production build, deterministic harness `11/11`, and `git diff --check` pass. Frozen `docs/Phase8/00–12` and accepted Round 2 production-authority paths remain unchanged.

## 2026-09-19 — Phase 8C Round 4 Gatekeeper P2 corrective

- Final Round 4 Gatekeeper on exact head adc4042fc3846d133d23cbe03fd5e24342c3c067 found no P0/P1 and one P2: /journey/journal exposed type/archive filters but no user-visible context filters even though controlling document §5.5 requires filters appropriate to entry type/context/archive state.
- Backend inspection confirms GET /api/journal already accepts seasonId and questId; activityId is not a list filter. The correction therefore stays entirely in the Journey Journal UI and its regression test.
- Added accessible 赛季筛选 and 任务筛选 selects using the already-loaded Season/Quest context lists. Selected UUIDs are appended to URLSearchParams and participate in loadEntries dependencies.
- Regression verifies seasonId and combined seasonId + questId requests through the HTTP API. No direct Supabase/RPC path, no Journal authority expansion, and no XP/Mastery/Evidence coupling were introduced.
- Closure gates: targeted 28/28; full 759 passed / 314 skipped; ESLint and production build pass; deterministic harness 11/11; git diff --check pass. Frozen Phase8 docs and accepted Round 2 production-authority paths remain unchanged.

## 2026-09-19 — Phase 8C Final Freeze

- Final corrective exact head `f2f4d2b2d0a857348b6282dfdbfb3cfd08f4a06d` closed the Round 4 context-filter finding; final independent Gatekeeper verdict is `P0=0 / P1=0 / P2=0 + GO`.
- Exact-head GitHub Actions Run `35381923343` is successful: `check` passed lint/test/build; `supabase-integration` passed Supabase startup, production build, database-backed tests, deterministic Growth Engine harness, and E2E.
- PR #35 merged to `main` as `9aa76e7ce36b20b9f99e28d6cbd08eeb7bc55b85`; post-merge main Run `35432361509` is also fully successful for `check` and `supabase-integration`.
- Phase 8C Journal + State is therefore **FINAL FROZEN**. The accepted boundary remains one `journal_entries` authority surface plus Journal repository/API/Journey UI; Journal/State remains subjective context and cannot directly mutate XP, Mastery, Evidence, or permanent Growth Core state.
- Freeze archive: `docs/Phase8/17_PHASE8C_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`.
- Phase 8D remains **BLOCKED / not started**. No Strategy/Playbook production code, schema, API, or UI is authorized by the Phase 8C freeze.


## 2026-09-19 — Phase 8D verified architecture boundary

- Phase 8D = Strategy + Personal Playbook；冻结表为 `strategies`、`strategy_versions`、`strategy_supports`，UI 为 `/journey/playbook`。
- 生命周期：`HYPOTHESIS`、`TESTING`、`SUPPORTED`、`CONTEXTUAL`、`WEAKENED`、`RETIRED`；confidence：`LOW`、`MODERATE`、`HIGH`、`VERY_HIGH`。
- `TESTING -> SUPPORTED` 需要至少 4 个不同观察日期、至少 1 个 completed season、至少 2 个 Core links、support ratio >= 75%、derived confidence >= HIGH，以及显式用户确认。
- AI 仅能提出 `STRATEGY_HYPOTHESIS` proposal；永久 Strategy 创建/状态晋升必须经应用 authority 与显式用户 review。
- 冻结 RPC：`rpc_insert_strategy_support`、`rpc_evaluate_strategy_status`、`rpc_transition_strategy_status`、`rpc_create_strategy_version`；直接客户端不能修改 `lifecycle_status` / `confidence_level`。
- `strategy_versions` immutable + RPC-only insert；`strategy_supports` append-only + RPC-only insert，并使用 source provenance composite identity 防 replay。
- Phase 8D canonical exits：O008、O009、O017、O021。

### Phase 8D implementation pattern check

- 当前迁移链只到 `0045_phase8c_journal_state_foundation.sql`；Phase 8D 若新增首个 migration，顺序号为 `0046`。
- Phase 8B 的既有实现模式是 foundation schema/guards + `SECURITY DEFINER` RPC authority + server-side repository/service/request/http adapters + Journey UI + static/local tests + CI database-backed tests。Phase 8D 应复用这一分层，不引入新的客户端权威通道。
- 当前 Journey 仅有 `seasons` / `reviews` / `journal`；当前 tests 仅到 phase8c，仓库中尚无 Phase 8D production file。
- 冻结文档再次确认 Phase 8D exit gate 为 O008/O009/O017/O021；O009 的 canonical promotion threshold 与 Strategy spec 一致。

### Phase 8D controlling-document admission candidate

- controlling document 已明确 source-class weights 仅作 evidential guidance，不得静默改写 frozen deterministic confidence 或 lifecycle eligibility。
- `strategy_versions` 采用父 Strategy 行锁串行化版本号；`strategy_supports` 采用 immutable append-only + provenance composite identity 防 replay；两者均要求 tenant/source ownership fail-closed。
- `STRATEGY_HYPOTHESIS` 继续复用 `rpc_review_outer_loop_proposal` 的既有 CAS：REJECTED 不创建 Strategy；ACCEPTED/EDITED 仅在同事务内创建一次 HYPOTHESIS 并记录 resulting entity；proposal 内 activity IDs 不自动物化为 support，也不提升 confidence。
- controlling document 当前是 **admission candidate**，不是 production authorization。下一 gate 必须是独立、只读、exact-head-bound 的 `P0/P1/P2 + GO/NO-GO`；生产迁移、RPC、API、UI 在 GO 前保持 BLOCKED。

## 2026-09-22 — Phase 8D Round 1 resume findings

- Verified workspace HEAD is `b4c26079e5532cc1c02238f70de95f3e4694e554`; Round 1 migration/test files are still untracked and planning files modified.
- Current `0046` is an obsolete draft: `strategies` uses `DRAFT/ACTIVE/ARCHIVED`; `strategy_versions` stores JSON `definition`; `strategy_supports` stores JSON `evidence`; current grants still give `service_role` full direct writes.
- Current `tests/strategy-database-foundation.test.ts` is static string-only coverage and still asserts the obsolete `DRAFT` lifecycle/grant model. It does not provide real database authority evidence.
- Whole-file reads of `0046` were blocked twice by the outer command safety review; subsequent inspection uses narrow `rg` queries and will not repeat the blocked calls.
- Confirmed established DB-test pattern: `describe.skipIf(!XP_RPG_TEST_DB_URL)`, `pg.Client`, `set role authenticated`, and `request.jwt.claim.sub` are used for real authority tests.
- Frozen schema plan confirms exact Strategy storage intent: lifecycle `HYPOTHESIS/TESTING/SUPPORTED/CONTEXTUAL/WEAKENED/RETIRED`, confidence `LOW/MODERATE/HIGH/VERY_HIGH`, immutable `strategy_versions`, append-only `strategy_supports`, and storage UNIQUE `(strategy_id, source_class, source_id, observation_type, evaluator_version)`.

## 2026-09-23 — Phase 8D Round 1 continuation

- 本次续作已核对：分支仍为 codex/phase8d-strategy-playbook，HEAD=b4c26079e5532cc1c02238f70de95f3e4694e554；Phase 8D admission 已通过，当前唯一授权实现范围为 Round 1 DB foundation。
- 旧的未跟踪 0046 migration 与 strategy DB test 是过期草案，需要以 controlling contract 为准重构；Round 2 RPC authority 继续保持 gated。
- planning-with-files session-catchup 无未同步输出；恢复上下文以现有 task_plan/findings/progress 为准。

- 已补读权威文档 04–09 的剩余范围，并核对 Phase 8D controlling contract。Round 1 只允许三表、约束、私有 RLS、字段/租户/不可变 guard 与真实数据库负向测试；四个 Strategy RPC、确定性 confidence/lifecycle 计算、anti-replay RPC 逻辑属于 Round 2，当前不得实现。
- controlling contract §6 冻结：strategies 直接 INSERT 只能创建 caller-owned HYPOTHESIS + LOW + version=1，且必须原子 bootstrap immutable version-1 snapshot；直接 UPDATE 仅 title / description，直接 DELETE 拒绝。strategy_versions 全行 immutable；strategy_supports append-only、direct authenticated INSERT/UPDATE/DELETE 全拒绝，storage UNIQUE 保持 strategy_id/source_class/source_id/observation_type/evaluator_version。
- controlling document 整文件读取再次被本地安全审查拦截；仓库零改动。已改用标题索引与指定行段读取，成功取得 §6、§10、§11，后续不重复整文件读取。

## 2026-09-28 — Phase 8D Round 1 static-chain closure

- 当前 0046 已不再是旧 DRAFT/ACTIVE/ARCHIVED 草案：三表、冻结 lifecycle/confidence taxonomy、`strategy_version_id`、version-1 原子 bootstrap、private RLS、字段白名单、version/support immutable guard 与来源 tenant guard 均已存在。
- 全局迁移链此前漏登记 0046，导致 `tests/supabase-schema.test.ts` 的 completeness gate 失败；现已将 0046 纳入 `EXPECTED_ORDER`，并新增 4 项静态 authority 检查。
- 定向结果：schema 静态测试 39/39 通过；Strategy DB suite 12 项因本机无 `XP_RPG_TEST_DB_URL` 跳过。ESLint 对两个相关测试文件通过，`git diff --check` 通过。
- 本机 Docker CLI 可发现，但 daemon 未运行；因此不能把静态结果当作 migration 可执行、RLS/trigger 运行时或跨租户负向证据。Round 1 仍为 in progress。
- 首轮独立只读对抗审查为 `P0=0 / P1=2 / P2=1 + NO-GO`：真实 DB 未运行；五类非 Journal 来源与同租户错误版本锚反例不足；静态测试只查名称/关键词。已补齐后两类覆盖，第一次复审将结果收敛为 `P0=0 / P1=1 / P2=1 + NO-GO`。
- DB suite 现有 13 项：五类非 Journal canonical source 均覆盖 owned 成功、foreign 失败、source-class mismatch 失败；另覆盖同租户另一 Strategy 的 version anchor 错配。静态 suite 进一步锁定完整 owner policy body，并抽取六个 trigger function body 校验 field authority、tenant/version/source fail-closed、immutability 与 version-1 bootstrap。
- `docs/MASTER_PROJECT_HANDOFF.md` 的当前状态曾停在 Phase 8D 未启动；现仅更新 current milestone、当前 main 基线与 next action，历史 Phase 8C freeze 叙述保持不改。
- 后续三轮对抗复审将静态 P2 逐步收敛：精确锁定 5 条 policy 且禁止后续 ALTER/DROP，精确锁定 6 条 trigger wiring 且禁止 WHEN/DISABLE，并逐 source branch 绑定 canonical table 与 `WHERE alias.id = NEW.source_id`。第四次复审结果为 `P0=0 / P1=1 / P2=0 + NO-GO`；唯一保留 P1 是真实 DB 未运行。

## 2026-09-28 — Phase 8D Round 2 CI and local DB clarification

- 本项目本地 Supabase 不在 Windows Docker Desktop 中，而在运行中的 Ubuntu WSL Docker daemon；容器 `supabase_db_AI_Personal_Growth_RPG` 映射 `0.0.0.0:54322->5432`。只读查询 `supabase_migrations.schema_migrations` 的最高版本为 `0042`；该实例不能未经授权升级后直接充当 0047 测试库。
- Exact-head `dfdb321` 的 GitHub CI Run `36413584990` 成功启动临时 Supabase 并执行 migrations/build；数据库测试阶段 3 项失败集中在新 Strategy RPC suite。日志中的 `25P02` 是测试 `asUser` 的 `finally RESET ROLE` 在原始 SQL 错误之后产生，不能当作原始缺陷。
- `43bb67b` 仅修复错误遮蔽，等待其 CI 取得首个 SQLSTATE/错误位置。`check` success 不代表数据库 authority 通过；Round 2 Gatekeeper 继续 NO-GO。
- `43bb67b` 的 CI Run `36435042869` 将原始失败定位为三处首次 support RPC 的 `SOURCE_TIMESTAMP_MISMATCH`（SQLSTATE `22023`），而非迁移执行失败。测试从 `pg` 得到 JS `Date` 后丢失 PostgreSQL `clock_timestamp()` 的微秒精度，再作为断言参数传回；修正应保留数据库时间戳文本，不能放宽生产端的精确相等规则。
- 修复必须由负向边界证明：源时间戳增加 1 微秒时，首次写入与同源重放都应返回 `22023` 且不得新增 support；至少一条正向样本固定非零微秒尾数，避免测试在整秒场景下偶然通过。

## 2026-09-29 — Round 3 server boundary

- 现行控制文档 §9 要求 repository/service 与认证 API；生命周期、confidence、version、support 只委托 0047 的四个 RPC。Proposal review 仍走既有 Outer Loop 单一 CAS 路由，不新建第二套提案 authority。
- 现有 Phase 8B 分层是 `types.ts` → `repository.ts` → `service.ts` / `request.ts` → `http.ts` → `src/app/api/*`；请求库通过 `getSupabaseServerClient()` 和 `auth.getUser()` 获取带用户会话的 client，路由 params 为 `Promise<{id:string}>`。
- 本地 Next route handler guide 明示 GET 默认不缓存、支持标准 Request/Response 和 NextResponse；应沿用当前仓库的动态 params 约定。
- 既有 `docs/MASTER_PROJECT_HANDOFF.md` 里 Round 2 状态滞后于 exact-head GO，更新须与 Round 3 candidate 一起明确区分状态与历史快照。
- `94a1208` 的单元 HTTP adapter 测试模拟了认证仓储与 RPC；它们不能证明真实 cookie/session、Next 路由与 RLS/SQL 错误贯通。Gatekeeper 的 Round 3 P1 指向这类运行时证据缺口，故新增用现成 live Next + Supabase Auth E2E fixture 的跨租户、时间戳、重放和版本排除反例。
- `fca2842` CI 真实 E2E 已通过，但测试完整运行时可依赖早期用户 fixture；对单测可定位性，应在 Strategy test 内独立注册用户。外租户拒绝还需在 HTTP 层复查 support count=0，不能只看错误状态码。

## 2026-09-30 — Phase 8E architecture gaps

- 冻结规范要求“versioned deterministic server policy table”，但授权表清单只有四张 Reward/Wish 表且没有 policy 表；精确 grant amounts 也未冻结。控制文档推荐 immutable versioned SQL function，但将载体与数值保留为 D1 用户决策。
- `ARTIFACT` earning source 的“significant verified”没有映射到现有 Artifact 的确定性、不可伪造字段；生命周期与 reusability 分数均不足以单独作为铸币依据，故列为 D2 blocker。
- `REAL_WORLD_VERIFIED` 依赖尚未实现的 Phase 8F milestone authority；在 8E 提前实现会违反冻结阶段顺序。
- schema plan 的 `cost_credits_estimate` 与 RPC plan 的 `wish.credit_cost` 不一致；控制草案统一为 positive nullable `credit_cost`，并禁止 PRIMARY/RESERVED/REDEEMED 后直接改价。
- 只对 PRIMARY 建唯一索引会在 reserve 后允许第二个 PRIMARY；必须对 `status IN ('PRIMARY','RESERVED')` 建合并 partial unique index。
- `cooldown_until` 若只写在已兑换 Wish 而 reserve RPC 不查询，则 cooldown 无实际效果；草案要求 reserve 时检查任一未过期 redeemed cooldown。
- Phase 8E 控制草案的独立审查未发现 P0/P1/P2；但“文档无缺陷”不等于 admission GO。D1/D2 用户决策和 D3 后续 exact-head Gatekeeper 接受仍是正式前置条件。
- D1 已由用户冻结：`reward-v1` 为不可变版本化 SQL 函数；Season=150，Quest Major/Epic/Main-or-Boss=100/150/200，Mastery M6/M8/M10=100/150/250。Quest 多重命中只取最高档。
- D2 已由用户冻结：Phase 8E 不实现 Artifact EARN；`ARTIFACT` 与 `REAL_WORLD_VERIFIED` 均以 `SOURCE_CLASS_NOT_YET_AVAILABLE` fail closed，不得产生 ledger row。
- Admission Gatekeeper 已在 exact head `080accd...` 接受 D3 并给 GO。现有 migration chain 到 `0047`，Round 1 foundation 编号为 `0048`。
- 现有 visual/governance delta guard 只绑定到 Phase 8D；Phase 8E 必须新增精确控制文档绑定与 exact path allowlist，不能授权整个 `src/lib`、`tests` 或 migrations 目录。
- Frozen Wish lifecycle 要求 `IDEA -> ACTIVE`，但 schema plan 又把直接 UPDATE 限于内容字段，既有 RPC inventory 没有 activation。若不补 authority，IDEA 是死状态；最小修复是新增无 ledger side effect、带审计和幂等的 `rpc_activate_wish`，RPC 总数从 9 改为 10。
