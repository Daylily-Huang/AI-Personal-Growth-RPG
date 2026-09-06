# AI Personal Growth RPG — 项目总体计划与当前状态 (Task Plan)

> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **当前里程碑**: Phase 5 — Stage 5C-UI Skills Modernization & 审查缺陷加固  
> **目标主分支基线 (main)**: `a987092512b878663eee7f34666268df7fa8d6da`  
> **分支 Head Commit**: `11d3b99`（`feat(skills): Stage 5C-UI Skills Modernization`）加上复审修复变更

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
- [in_progress] **Phase 5: 核心业务页面现代化**
  - [complete] Stage 5A-UI: Dashboard 个人仪表盘视觉重构 (PR #18 已合入) ✅ FINAL FROZEN
  - [complete] Stage 5B-UI: Quests 任务系统视觉重构与无障碍治理 (PR #19 已合入) ✅ FINAL FROZEN
  - [in_progress] Stage 5C-UI: Skills 技能树与 ReactFlow 画布现代化 (PR #20 待审)
- [in_progress] **独立审查缺陷加固 (2026-09-05 Review & Re-Review)**
  - [complete] P1-01: 修复 `settlement.service.ts` 掌握度提议跨技能/知识误升级 bug (复审已确认关闭)
  - [complete] P1-A: 修复新技能空 UUID 传入 `countRecentSimilarTransactions` 导致 PostgREST 报错 (代码已修复，空 ID 默认返回 0)
  - [complete] P1-B: 修复生产模式未配置 AI 时的 mock 泄露问题（强制要求 `allowDemoFallback === true`，生产环境缺失 AI 配置抛 `ai_not_configured` 并保持 `pending_assessment`）
  - [complete] P2-01: 修复 `supabase-repository.ts` 30 天重复计数受 1000 行限制截断问题（采用数据库端 exact/head 统计）
  - [complete] P2-A: 修复 `tests/ai-assessment-failure.test.ts` 中 any 类型与未使用变量，ESLint 全绿
  - [complete] P2-B: `docs/MASTER_PROJECT_HANDOFF.md` 落地至项目，修正 README 与 AGENTS 引用
- [pending] **Phase 6: 高级画布现代化 (Knowledge Graph Canvas)** (Stage 5C 冻结后启动)
- [pending] **Phase 7: 全站端到端无障碍 (A11y)、响应式与动效收敛**
