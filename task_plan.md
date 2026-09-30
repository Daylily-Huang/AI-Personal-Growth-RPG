# AI Personal Growth RPG — 项目总体计划与当前状态 (Task Plan)

> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **当前里程碑**: Phase 8D — Strategy + Personal Playbook（FINAL FROZEN）；Phase 8E — Reward Economy + Wishes（**ADMISSION CANDIDATE；Round 1 `0048` 已通过真实 PostgreSQL 验证，生产 RPC/API/UI BLOCKED**）
> **当前主分支基线 (main)**: `be949deb67f62269d58a0e21865580d0e67204e0`
> **最新状态**: Phase 8C **FINAL FROZEN**；Phase 8D admission 与 Round 1–5 全部通过。Round 5 corrective implementation exact head `8b33cca8e994ba45862194d5588642e9e76626ba` 的 CI Run `36590521018` 双绿，fresh independent Gatekeeper `P0=0 / P1=0 / P2=0 + GO`；PR #37 已由用户合入 `main`（merge `b93273cd87d39e04a66ed0ebfd76fa95ebd2e643`），post-merge main CI Run `36593720889` 双绿。**Phase 8D = FINAL FROZEN**（归档 `docs/Phase8/19_PHASE8D_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`）。
> **Phase 8E 当前状态**: ADMISSION CANDIDATE 已获 D3 接受；**Round 1 (`0048` 四表 foundation) 已完成真实 PostgreSQL 验证**：dev 栈定向 `6/6`、全量 `1174 passed / 1 failed / 0 skipped`（唯一失败是本机 `demo_player` 域名 UUID 历史数据碰撞），**一次性 disposable 栈（独立 project_id / 端口 5532x / 独立卷）按 CI 顺序复刻 `supabase-integration` → `76/76` 文件、`1175/1175` 用例全过、`0 skipped`**，`harness:deterministic` 11/11、`test:e2e` 10/10，`tsc`/`eslint`/`next build` 均通过。真实 DB 阻塞系上一轮误判（实为 Windows CLI 的 Docker Desktop 管道问题，套件仅由 `XP_RPG_TEST_DB_URL` 开关），并在真实执行中发现并修复 `wishes_owner_update` 的静默 0 行缺陷。4 位互不相同的 fresh 独立 Gatekeeper 复核后，最终在 `59a45f5` 给出 `P0=0 / P1=0 / P2=0 + GO`。PR #40 已开（head `59a45f5`，并已合并 `main` @ `be949deb` 解除冲突）；Round 2 (`0049` RPC/API/UI) 仍需该 head 的 exact-head GitHub CI 双绿，随后补 8B/8D 式审查落盘文档即可解锁。

---

## 阶段总览与状态

- [complete] **Stage 0–4: 业务基础与核心领域模型** (已全部 FINAL FROZEN)
  - 基础设施、活动记录、两阶段确认流、确定性增长引擎、任务系统
- [complete] **Stage 5–7: 领域高级模型与能力建设** (已全部 FINAL FROZEN)
  - Stage 5: 技能树领域服务与 API 契约
  - Stage 6: 知识图谱领域服务与 API 契约
  - Stage 7A/7B: 产物权威定义（Durable Work Product）与链接关系
- [complete] **Phase 1–4: 新中式水墨视觉体系现代化基石** (已全部 FINAL FROZEN)
  - Phase 1: 设计 Tokens (`design-tokens.css`)
  - Phase 2: 全局 AppShell (`AppHeader`, `AppSidebar`, 响应式)
  - Phase 3: 共享 UI 基元库 (`LevelBadge`, `MasteryBadge`, `XPProgress`, `BaseModal` 等)
  - Phase 4: 成果库 UI 现代化 (`/artifacts`, `InspectorDrawer` 集成)
- [complete] **Phase 5: 核心业务页面现代化** (已全部 FINAL FROZEN)
  - [complete] Stage 5A-UI: Dashboard 个人仪表盘视觉重构 (PR #18 已合入) ✅ FINAL FROZEN
  - [complete] Stage 5B-UI: Quests 任务系统视觉重构与无障碍治理 (PR #19 已合入) ✅ FINAL FROZEN
  - [complete] Stage 5C-UI: Skills 技能树与 ReactFlow 画布现代化 (PR #20 已合入) ✅ FINAL FROZEN
- [complete] **独立审查与核心引擎加固 (2026-09-05 & 2026-09-06 Review & Re-Review)**
  - [complete] P1-01: 修复掌握度提议跨技能/知识误升级 bug
  - [complete] P1-A: 修复新技能空 UUID 传入计数查询阻断结算
  - [complete] P1-B: 修复生产模式未配置 AI 时的 mock 泄露问题
  - [complete] P2-01: 修复 30 天重复计数受 1000 行限制截断问题
  - [complete] P2-A: 修复测试 any 类型与未使用变量，ESLint 全绿
  - [complete] P2-B: 落地 `docs/MASTER_PROJECT_HANDOFF.md` 权威交接主文档
  - [complete] R1: 门禁测试引入 `AUTHORIZED_CORE_BUGFIX_ALLOWLIST` 精确手术式白名单
  - [complete] R2: 实现进程内确定性 OpenAI 测试服务（`mock-ai-server.ts`），CI 双绿
  - [complete] R3: 纠正交接文档 Mastery 等级为 M0~M10 与验证门槛
- [complete] **Phase 6: 高级画布现代化 (Knowledge Graph Canvas)** (PR #21 已合入) ✅ FINAL FROZEN
- [complete] **Phase 7: 全站端到端无障碍 (A11y)、响应式与动效收敛** (PR #22, #23, #25, #27, #28 已全部合入) ✅ FINAL FROZEN
  - [complete] Round 1: 无障碍语义、键盘导航与图谱表格替代视图 (PR #22) ✅
  - [complete] Round 2: 全视口响应式压力硬化 (PR #23) ✅
  - [complete] Round 3: 动效降级与全站动效收敛 (PR #25, PR #27) ✅
  - [complete] Round 4: 全页交叉验收、活跃文本对比度合规 (P1-05)、72 格全矩阵运行时证据归档与终局冻结 (PR #28, Merge: `653fe018f6cee38b2263fbcca19dffbf624d4c18`, Exact Head CI `34707377871` success, post-merge push CI `34708617506` failure — KNOWN PUSH-TO-MAIN GOVERNANCE GUARD INCOMPATIBILITY) ✅ FINAL FROZEN
- [complete] **历史 push-to-main 治理缺陷闭环**: Phase 8B 治理加固已覆盖 merge-base delta guard；当前 main push CI Run `35315613393` 的 `check` 与 `supabase-integration` 均 success。Phase 7 历史失败 Run `34708617506` 保留为历史证据。
- [complete] **Phase 8A: Outer Growth Loop 架构冻结与实现授权准备**
- [complete] **Phase 8B: Season & Review 权威实现** ✅ FINAL FROZEN
  - [complete] DB foundation + 9 RPC authority：真实 Supabase CI Run `35119470754` 全绿
  - [complete] API routes / adapters：exact head `6e5ccdfc902dee3d9478742876aaefc0560f7e02`，CI Run `35121618237` 的 `check` 与 `supabase-integration` 全绿
  - [complete] Journey UI：`/journey/seasons` 与 `/journey/reviews` 已实现；Round 4 exact head `6f94f3a06ea30cfb77faa870053aedcbf03f6b8b`，CI Run `35124441177` 双绿
  - [complete] Round 5 exit verification：O006/O013/O014/O015/O016/O022、并发 Review version allocation、Proposal accept/edit/reject CAS 与 concurrent winner/loser 均已纳入；fixture 修复 exact head `80abfa3878a76e1f74279c86d0c5413786fad9e9`，CI Run `35128996512` 的 `check` 与 `supabase-integration` 全绿，真实 database-backed tests、deterministic harness、E2E 均 success
  - [complete] Corrective exact head `ae35a63ab15abab6c6e7fafd06fd51281ab6e634` 已关闭旧 Gatekeeper 的 P1-01/P1-02/P2-01/P2-02；独立复审结果 `P0=0 / P1=0 / P2=0 + GO`，Exact-Head CI Run `35310121814` 全绿
  - [complete] PR #33 已合入 main：merge `0e4bec5f26411669f7031af4523b6d4fca747f96`；post-merge main CI Run `35315613393` 全绿，DoD 最终 merge gate 已满足
- [complete] **Phase 8C: Journal + State** ✅ FINAL FROZEN — PR #35；final reviewed exact head `f2f4d2b2d0a857348b6282dfdbfb3cfd08f4a06d`；Exact-Head CI `35381923343` success；merge `9aa76e7ce36b20b9f99e28d6cbd08eeb7bc55b85`；post-merge main CI `35432361509` success
- [complete] **Phase 8D: Strategy + Personal Playbook** ✅ FINAL FROZEN — PR #37 已合入 `main`（merge `b93273cd87d39e04a66ed0ebfd76fa95ebd2e643`，post-merge main CI Run `36593720889` 双绿）；final reviewed implementation exact head `8b33cca8e994ba45862194d5588642e9e76626ba`，Gatekeeper `P0=0 / P1=0 / P2=0 + GO`。
- [in_progress] **Phase 8E: Reward Economy + Wishes admission** — D1/D2 用户决策已写入 controlling candidate，D3 已获 fresh Gatekeeper 接受（`cd24254`，`P0=0 / P1=0 / P2=0 + GO`）。Round 1 (`0048`) 生产 SQL/纯 fold 已实现，并已在**真实 PostgreSQL**上跑通（定向 6/6、全量 1174/1175，唯一失败为本机历史数据 `stage5b`）；期间修复 `wishes_owner_update` RLS `USING` 静默 0 行缺陷。Round 1 corrective head 待 fresh 独立 Gatekeeper；Round 2 (`0049` RPC/API/UI) 保持 BLOCKED。

### 2026-09-29 — Round 4 Playbook UI

- [complete] 核对控制契约、现有 HTTP 响应、Journey 样式和测试模式；用户批准补充当前用户可见的只读提案/来源投影。
- [complete] 实现 `/journey/playbook` 与 Journey 导航：列表/详情、创建、测试、证据、评估与显式晋升、情境化、退役、版本、知情提案审核。
- [complete] 增加交互回归，执行定向/全量测试、lint、typecheck、build 与差异边界检查。
- [complete] implementation exact head `6fea360adffc4f7d9cde7a159797d246ca55f592` 的 CI Run `36559214448` 双绿，独立只读 Gatekeeper `P0=0 / P1=0 / P2=0 + GO`；PR 保持未合并。
- [pending] Round 5 exit verification（另阶段）；不在本次 Round 4 交付内。

## 2026-09-18 — Phase 8C Journal + State Controlling Document

- [complete] 独立复核冻结的 Phase 8 架构包与当前 Phase 8B FINAL FROZEN 基线。
- [complete] 起草 `docs/Phase8/16_PHASE8C_JOURNAL_STATE_IMPLEMENTATION_CONTROLLING.md`。
- [complete] 文档一致性、编码、diff 与生产目录零改动校验通过。
- [complete] 已提交并推送 `codex/phase8c-controlling-review`，Draft PR #35 已建立。
- [complete] 独立 Gatekeeper 初审 exact head `d83c324b...`：`P0=0 / P1=2 / P2=0 — NO-GO`。
- [complete] 首轮修正 P1-01（authoring context vs FK SET NULL）与 P1-02（JOURNAL_INSIGHT proposal settlement 未授权），corrective head `e40cd4cf...` 已完成独立 exact-head 复审。
- [complete] 该复审结果为 `P0=0 / P1=1 / P2=0 — NO-GO`：P1-02 已关闭；新增 P1-01R 指出父删除后历史 Journal 若在所有 edit 上重跑 context 必填校验，将违反冻结的可编辑/可归档生命周期。
- [complete] 第二轮修正 P1-01R：CREATE 必检；UPDATE 仅在显式变更 `entry_type` / relevant contextual FK 时重检；父删除后普通 content/state/edit/archive 操作继续允许。
- [complete] corrective exact head `a702985041c3fb616ea3b64b5998ffd6de0d087b` 已完成独立 exact-head 复审：`P0=0 / P1=0 / P2=0 + GO`；P1-01R 与 P1-02 均关闭。
- [complete] Round 1：implementation exact head `c9d0d2765a043a4dc874a6c0a1f16da9f29807f8`；GitHub Actions Run `35339072556` 的 `check` 与 `supabase-integration` 均 success，其中真实 Supabase startup、database-backed tests、deterministic Growth Engine harness、E2E 全绿。
- [complete] Round 2：Journal repository/API/domain 与 parent-SET-NULL 兼容边界已实现并通过最终 exact-head 验证；accepted head 为 `8c156032c95caae7b1832ad7dc0d2603d5bb8981`，CI Run `35367209443` 双绿，两次独立复审均为 `P0=0 / P1=0 / P2=0 + GO`。
- [complete] Round 2 首轮 corrective 已关闭 `c74a583...` 的三项 P1；exact head `886761353a0b053e89f1836e26e287a612b0f2fa` 的 CI Run `35363920987` 双绿，后续独立复审确认上述三项均关闭。
- [complete] Round 2 第二轮 corrective：最终 head `8c156032c95caae7b1832ad7dc0d2603d5bb8981` 已关闭该轮唯一 P1，并由 exact-head CI 与两次独立复审确认接受。
- [complete] Round 3：新增 `/journey/journal` 与 Journey “日志”导航；实现反思 create/edit、类型/归档筛选、Quest/Season context、archive/unarchive、7 个主观状态控件、当前筛选集描述性均值，以及 loading/empty/error、Ctrl/⌘+Enter、responsive 与长文本处理。独立复审在 exact head `d217366d4e2e401566446b2bfda0ea5faf46a18d` 发现唯一 P1：父对象合法删除并 `SET NULL` 后，历史 required-context Journal 被 UI `required/disabled` 阻断普通编辑。当前已按 Round 2 规则手术式修复：CREATE 始终校验；UPDATE 仅在显式改 `entryType` 或 resulting type 的 relevant contextual FK 时重检。新定向测试 28/28；全量 `46 files passed / 22 skipped`、`759 passed / 314 skipped`；lint、production build、deterministic 11/11、`git diff --check` 全绿；冻结 Phase8 00–12 与 Round 2 authority 区域零新增差异。
- Phase 8C 实现起始基线为历史 `main` `7df500b1c764efd247938dcf3da4e83b6e2e8e45`；当前权威 `main` 已推进至 merge commit `9aa76e7ce36b20b9f99e28d6cbd08eeb7bc55b85`。
- controlling document 规定的 Round 1 → Round 2 → Round 3 → Round 4 已全部完成并通过最终 merge gate；后续不得继续扩展 Phase 8C 冻结范围。

### 2026-09-19 — Phase 8C Round 3 corrective CI governance

- [complete] Round 3 first submitted head `5617b5c8383f675cde4c041ba8c4b0f0362810da` exposed a historical visual-governance false positive in CI Run `35374173512`: the mixed Phase 8C PR was classified as a visual migration and the already-authorized Journal API/migration files were rejected by the stale guard.
- [complete] `tests/visual-foundation.test.ts` now binds the Phase 8C controlling document to exactly three accepted Round 2 backend paths; unknown backend remains fail-closed, and the same backend remains unauthorized when the controlling document is absent.
- [complete] Local corrective gates: governance regression `111/111`; Round 3 targeted regression `138/138`; full test `758 passed / 314 skipped`; lint, production build, deterministic harness `11/11`, and `git diff --check` all pass. Frozen Phase8 00–12 and Round 2 production authority areas have zero new diff.
- [complete] Corrective exact head `d217366d4e2e401566446b2bfda0ea5faf46a18d` 的 GitHub CI Run `35375469477` 已双 job 全绿；随后独立复审返回 `P0=0 / P1=1 / P2=0 + NO-GO`，唯一 finding 是历史 required-context Journal 在父删除 `SET NULL` 后被前端表单门禁阻断普通编辑。
- [complete] 该 P1 已本地关闭：表单仅在 CREATE、`entryType` 改变或 resulting type 的 relevant contextual FK 被显式改变时恢复严格 context 校验；历史 NULL 上下文普通正文/状态编辑可提交，PATCH 不补造 `questId/seasonId`。新增运行时回归验证此行为；targeted `28/28`、full `759 passed / 314 skipped`、lint/build/deterministic `11/11`、diff-check 全绿。
- [complete] Round 3 P1 corrective 已进入后续全基线 Gatekeeper；历史 parent-deletion NULL-context 编辑 finding 已关闭，后续终审仅剩 Round 4 context-filter P2。

### 2026-09-19 — Phase 8C Round 4 exit verification

- [complete] Final Gatekeeper reviewed full baseline 7df500b1c764efd247938dcf3da4e83b6e2e8e45...adc4042fc3846d133d23cbe03fd5e24342c3c067 and returned P0=0 / P1=0 / P2=1 + NO-GO; the only finding was missing Journal context-filter UI required by §5.5.
- [complete] Minimal corrective implementation adds Season and Quest context filters to /journey/journal, using the existing HTTP API seasonId / questId query contract only; no backend/domain authority changed.
- [complete] Regression test now verifies Season and Quest filter selections are sent through /api/journal, while prior parent-deletion NULL-context edit coverage remains intact.
- [complete] Local corrective gates: targeted 28/28; full 46 files passed / 22 skipped, 759 passed / 314 skipped; lint, production build, deterministic harness 11/11, and git diff --check pass. Frozen Phase8 docs and accepted Round 2 authority areas have zero new diff.
- [complete] Final corrective exact head `f2f4d2b2d0a857348b6282dfdbfb3cfd08f4a06d` 已通过独立最终 Gatekeeper：`P0=0 / P1=0 / P2=0 + GO`；Exact-Head CI Run `35381923343` 全绿。
- [complete] PR #35 已合入 `main`，merge commit `9aa76e7ce36b20b9f99e28d6cbd08eeb7bc55b85`；post-merge main CI Run `35432361509` 的 `check` 与 `supabase-integration` 均 success。
- [complete] Phase 8C 最终归档：`docs/Phase8/17_PHASE8C_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`；状态 **FINAL FROZEN**。Phase 8D 保持 BLOCKED / 未启动。


## 2026-09-19 — Phase 8D Strategy + Personal Playbook

- [complete] Phase 8C 归档 PR #36 已合入 `main`：merge `98dbe37e0a6fe334b6638ca568bc3ba06b4c3aac`；post-merge main CI Run `35436440893` 的 `check` 与 `supabase-integration` 均 success。
- [complete] Phase 8D controlling document 已形成 admission candidate：冻结范围、确定性 confidence/lifecycle 规则、四个 Strategy RPC、source provenance / anti-replay、`STRATEGY_HYPOTHESIS` proposal settlement、Playbook UI、Round 1–5 与 DoD 均已绑定。
- [complete] controlling-document reviewed exact head `b4c26079e5532cc1c02238f70de95f3e4694e554` 已通过独立 Gatekeeper：`P0=0 / P1=0 / P2=0 + GO`。
- [complete] Round 1 — DB foundation：exact head `400cf1536e86412e6183e45289d87cb21bd56ba1`，CI Run `36338180207` 的 check 与 supabase-integration 均 success，真实 database-backed tests 执行成功；fresh independent Gatekeeper 为 `P0=0 / P1=0 / P2=0 + GO`。
- [in_progress] Round 2 — RPC authority：四个 Strategy RPC、确定性评估、审计、反重放、幂等、proposal settlement 与真实 DB 负向测试。
- [pending] Round 2 exact-head CI 与独立 Gatekeeper；通过前不进入 Round 3 server boundary。
- [in_progress] Round 2 CI corrective：`dfdb321` 的 Run `36413584990` 在新增 Strategy DB suite 3 项失败；`43bb67b` 已推送以暴露被测试清理动作遮蔽的原始 SQL 错误，Run `36435042869` 待结果。数据库门禁与独立 Gatekeeper 未通过，Round 3 仍 gated。
- [in_progress] `43bb67b` CI 已确定三处首次 support 调用因测试 `Date` 毫秒截断导致 `SOURCE_TIMESTAMP_MISMATCH`；当前仅修测试为保留 PostgreSQL 微秒的 `created_at::text`，需新 exact-head 数据库 CI 验证。生产 timestamp 权威规则未放宽。
- [complete] `60d463a` exact-head CI Run `36436421919` 双 job 成功；独立 Gatekeeper 仍给 `P0=0 / P1=1 / P2=0 + NO-GO`，P1 是 §10 的真实数据库反例覆盖不足。CI green 不等于 Gatekeeper GO。
- [in_progress] 补充零证据、旧版本排除、租户、UTC 日期、Season/Core link 资格、<60% 弱化和双会话并发数据库测试；本地静态检查通过，真实 DB 运行及新 exact-head Gatekeeper 待验证。Round 3 继续暂停。
- [complete] Round 2 exact head `1910af870fc82ffde35bf76da93d4bac50a5effb`：CI Run `36438563584` 双 job success，Strategy DB suite 12 tests、总计 70 files / 1103 tests passed；独立 Gatekeeper 复核后为 `P0=0 / P1=0 / P2=0 + GO`。原跨表 dedup P1 因与控制文档 §6 明示的 canonical table identity 不符而撤回。PR #37 未合并。
- [in_progress] Round 3 — server boundary：先对齐现有 Outer Loop repository/service/request/http 分层与当前 Next route 约定；仅实现 Strategy 读/写适配和认证路由，四个 mutation 继续委托 0047 RPC，完成本地测试、exact-head CI 与独立 Gatekeeper 前不进入 Round 4 UI。
- [in_progress] Round 3 corrective：`94a1208` 的独立 exact-head Gatekeeper 为 `P0=0 / P1=1 / P2=0 + NO-GO`（真实 HTTP→认证→DB 贯通反例缺失）；已补进既有 E2E suite，待新 SHA 的隔离数据库 CI 与 fresh Gatekeeper。Round 4 继续 gated。
- [in_progress] `fca2842` 的真实 E2E CI 已通过，旧 P1 关闭；独立复审仍有两个测试稳健性 P2。已补测试独立注册与失败后零写入断言，待新 exact-head CI + fresh Gatekeeper；Round 4 不放行。
- [complete] Round 3 implementation exact head `2b0796e66fc900344a1571f39ebd771fe64abe47`：CI Run `36452011311` 双 job success，Strategy RPC 12 tests 与真实 HTTP test 11 非 skipped 通过、71 files / 1118 tests passed；独立最终 Gatekeeper 为 `P0=0 / P1=0 / P2=0 + GO`。PR #37 仍开放未合并。下一阶段为 Round 4 Playbook UI，但本次仅做文档状态同步，未开始 UI。

### 2026-09-29 — Phase 8D Round 5 exit verification

- [complete] Round 5 — exit verification：新增 `tests/phase8d-exit-verification.test.ts`，显式命名控制文档 §10/§11.6 的四个 canonical exit test O008/O009/O017/O021，并补齐 O009 的 Case A（同日聚簇）/ Case B（3 日期 MODERATE 边界）反例；未改 production/迁移。
- [complete] §10 反例与安全项逐条核对：全部条目均有具名测试覆盖（DB foundation、RPC authority、API adapters、discovery API、Playbook UI、真实 HTTP E2E）。
- [complete] 首轮独立对抗复审 `P0=0 / P1=4 / P2=6 + NO-GO` 的四项 P1 已修复：后台 `confirm=false` 非晋升断言、CONTEXTUAL 生命周期、RETIRED 历史可查询、CI-only 策略提案并发 CAS；并收敛 P2（精确 `42501` 断言、VERY_HIGH、ratio=0.75 边界、CORE_EVIDENCE_REFERENCE 零 Core link）。
- [complete] 最终 Gatekeeper 对 `3c09f8a` 的 `P2=3 + NO-GO` 已在 corrective head `8b33cca` 关闭：anon/service_role 不能提交 Strategy 真值、`supporting_activity_ids` 不物化 support、§5.1 canonical timestamp 前提、ratio 0.65/0.85 精确门槛、CONTEXTUAL confirm 仅 transition-only 契约。
- [complete] 本机真实 DB 证据：0043–0047 已增量应用到本机 Supabase dev DB（应用前 `pg_dump` 备份 `.data/phase8d-pre-0043.dump`）；exit set 无 CI `10 passed / 1 skipped`、`CI=true` `11 passed / 0 skipped`；定向 Phase 8D `69 passed / 2 skipped`；全量在 `CI=true` 且设置 Supabase key 变量时 `1151 passed / 1 failed / 0 skipped`（唯一失败为 `stage5b-db-repository` 用例 1 与本机既有 `demo_player@growth-rpg.dev` 的硬编码 domain UUID 冲突，CI 全新库不触发）；仅设 `XP_RPG_TEST_DB_URL` 时为 `1121 passed / 1 failed / 30 skipped`、3 文件失败，多出的 2 个为 stage7d 缺 key 的环境性失败。
- [complete] 本机门禁：ESLint 全量 0 error、`tsc --noEmit` 0 error、`next build` 成功、deterministic harness `11/11`、`git diff --check` 通过；测试残留已清理，scratch DB 已 drop。
- [complete] exact-head CI：`3c09f8a` Run `36587173704`、`8b33cca` Run `36590521018` 均双 job success（真实 DB tests、deterministic harness、E2E）；fresh independent Gatekeeper 对 `8b33cca` 为 `P0=0 / P1=0 / P2=0 + GO`。Round 5 接受，DoD 7/8/9 满足。
- [complete] PR #37 已由用户手动合入 `main`：merge commit `b93273cd87d39e04a66ed0ebfd76fa95ebd2e643`（parents `98dbe37e` + `f5dd59d`）；post-merge main CI Run `36593720889` 的 `check` 与 `supabase-integration` 均 success。最终归档 `docs/Phase8/19_PHASE8D_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`，Phase 8D = **FINAL FROZEN**（DoD 1–11 全部满足）。
- [complete] PR #38（归档+状态同步）已合入 `main`：merge commit `a1da765e492b8d93e6350ac32865d8e0018faa91`；pr head `597e3f8` 的 CI Run `36596794622` 双 job success，fresh 第三 Gatekeeper `P0=0 / P1=0 / P2=0 + GO`。
- [complete] 8B 式独立审查落盘补齐：`docs/Phase8/20_PHASE8D_INDEPENDENT_REVIEW_RECORD.md`，记录三个独立审查实例、四类 P1 与六类 P2 的开启与关闭证据、可复现 CI/test 证据，以及"判决属 attestation"的边界声明。
- [pending] 可选 backlog（需迁移才能改，非门禁项）：已合格 CONTEXTUAL 上 `rpc_evaluate_strategy_status(confirm=true)` 的错误码命名 `INSUFFICIENT_SUPPORT_FOR_PROMOTION` 不够精确。

### Phase 8D Errors Encountered

- 2026-09-19：一条组合式 `rg --files` + 多文件 `rg -n` 只读命令被 Codex 工具安全检查在执行前拦截；仓库零改动。后续改用拆分、窄范围只读查询，不重复该调用。

- 2026-09-19：第二条跨两个文档的复合范围读取同样被工具安全检查在执行前拦截；仓库零改动。后续严格改为单文件单命令读取。

- 2026-09-22：一条同时读取 controlling document、0044、0045 与 tests 的组合只读命令再次被 Codex 安全检查拦截；仓库零改动。已改为单文件、窄范围读取，不重复该调用。

- 2026-09-22：尝试读取 `docs/Phase8/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md` 返回 `os error 2`；项目规则中的真实路径是 `docs/Design ChatGPT/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md`，后续按该路径读取。

- 2026-09-22：按 checkpoint 简写读取 `0045_phase8c_journal_state.sql` 失败；实际迁移文件为 `0045_phase8c_journal_state_foundation.sql`，已通过 `rg --files` 确认，后续使用真实文件名。

- 2026-09-28：`pnpm vitest run ...` 通过当前 Codex fallback pnpm 启动时无法解析工作区 `vitest`（`'vitest' is not recognized`），但 `node_modules/.bin/vitest.cmd` 实际存在；后续使用该工作区二进制执行同一测试，不重复失败入口。

- 2026-09-28：首次新增的 0046 静态“无写权限”断言使用跨分号贪婪范围，误把 `strategies` 的 INSERT grant 与后续 `strategy_versions` SELECT 拼成写授权；已收窄为单条 SQL statement（`[^;]*`）并复跑通过。

- 2026-09-28：本机 `XP_RPG_TEST_DB_URL` 未配置，Docker CLI 存在但 daemon 未运行（`open //./pipe/docker_engine: The system cannot find the file specified`）；Round 1 的 12 个真实 DB 测试仍属未验证，不能进入独立 Gatekeeper 或 Round 2。
