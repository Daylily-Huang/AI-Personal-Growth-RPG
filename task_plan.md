# AI Personal Growth RPG — 项目总体计划与当前状态 (Task Plan)

> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **当前里程碑**: Phase 8B — Season & Review 权威实现（FINAL FROZEN）；Phase 8C Round 2 已接受，Round 3 Journey Journal UI 进行中
> **当前主分支基线 (main)**: `7df500b1c764efd247938dcf3da4e83b6e2e8e45`
> **最新状态**: 当前 main 基线为 `7df500b1c764efd247938dcf3da4e83b6e2e8e45`。Phase 8C Round 2 最终 exact head `8c156032c95caae7b1832ad7dc0d2603d5bb8981` 的 CI Run `35367209443` 已双 job 全绿，两次独立复审均为 `P0=0 / P1=0 / P2=0 + GO`，Round 2 已接受。Round 3 Journey Journal UI 已完成本地实现；targeted 27/27、全量 752 passed / 314 skipped、lint/build/deterministic 11/11/diff 均全绿，待提交推送后运行 exact-head CI 与独立复审。

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
- [in_progress] **Phase 8C**: controlling document、Round 1 与 Round 2 已通过 exact-head CI + 独立复审；Round 3 Journey Journal UI 已完成本地实现与门禁，待新 exact-head CI + 独立复审

## 2026-09-18 — Phase 8C Journal + State Controlling Document

- [in_progress] 独立复核冻结的 Phase 8 架构包与当前 Phase 8B FINAL FROZEN 基线。
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
- [in_progress] Round 3：新增 `/journey/journal` 与 Journey “日志”导航；实现反思 create/edit、类型/归档筛选、Quest/Season context、archive/unarchive、7 个主观状态控件、当前筛选集描述性均值，以及 loading/empty/error、Ctrl/⌘+Enter、responsive 与长文本处理。定向测试 27/27；全量 `46 files passed / 22 skipped`、`752 passed / 314 skipped`；lint、production build、deterministic 11/11、`git diff --check` 全绿；冻结 Phase8 00–12 与 Round 2 authority 区域零新增差异。
- 当前实现入口基线：`main` / `origin/main` = `7df500b1c764efd247938dcf3da4e83b6e2e8e45`。
- Gatekeeper GO 已解除“只允许文档/治理变更”限制；生产实现必须按 controlling document 的 Round 1 → Round 2 → Round 3 → Round 4 顺序推进。
