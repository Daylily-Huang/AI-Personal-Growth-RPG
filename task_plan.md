# AI Personal Growth RPG — 项目总体计划与当前状态 (Task Plan)

> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **当前里程碑**: Phase 7 — 全站端到端无障碍、响应式与动效收敛 (FINAL FROZEN)  
> **当前主分支基线 (main)**: `653fe018f6cee38b2263fbcca19dffbf624d4c18`  
> **最新状态**: Phase 7 Round 4 已通过 PR #28 合入 main，全站视觉现代化与核心业务页面全部宣告 **FINAL FROZEN**

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
- [ ] **后续治理缺陷修复**: 修复 `tests/phase5-quests-ui.test.tsx` 与 `tests/phase5-skills-ui.test.tsx` 的 push-to-main merge-base delta guard 兼容性 (待独立建 task 修复)
- [pending] **Phase 8: 外部长期成长闭环 (Outer Growth Loop)** (待正式授权)
