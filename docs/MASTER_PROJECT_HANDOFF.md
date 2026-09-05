# AI Personal Growth RPG — 项目全景交接与治理主文档 (Master Project Handoff)

> **文档版本**: 1.0 (Master Comprehensive Handoff)  
> **更新时间**: 2026-09-05  
> **适用对象**: 后续所有接手的 AI 工程师、独立审查 AI、项目协作者  
> **当前主分支基线 (main)**: `a987092512b878663eee7f34666268df7fa8d6da`  
> **当前所处里程碑**: Phase 5 — Stage 5C-UI Skills Modernization (Round 1 开发完成，已推送分支，待 PR 审查)  
> **代码仓库**: `Daylily-Huang/AI-Personal-Growth-RPG`  
> **核心工作区路径**: `d:\AI_Personal_Growth_RPG`（WSL 挂载路径：`/mnt/d/AI_Personal_Growth_RPG`）

---

## 目录
1. [项目愿景、世界观与核心不可违背铁律](#1-项目愿景世界观与核心不可违背铁律)
2. [双 AI 协同治理模型 (Two-AI Governance Protocol)](#2-双-ai-协同治理模型-two-ai-governance-protocol)
3. [整体技术架构与技术栈选型](#3-整体技术架构与技术栈选型)
4. [项目全周期里程碑状态与冻结基线 (Roadmap & Freezes)](#4-项目全周期里程碑状态与冻结基线-roadmap--freezes)
5. [当前阶段详述：Phase 5 — Stage 5C-UI Skills Modernization](#5-当前阶段详述phase-5--stage-5c-ui-skills-modernization)
6. [环境运行规则、痛点与关键避坑指南 (Critical Gotchas)](#6-环境运行规则痛点与关键避坑指南-critical-gotchas)
7. [质量门禁与验证指令集 (Quality Gates Cheatsheet)](#7-质量门禁与验证指令集-quality-gates-cheatsheet)
8. [接手 AI 极速上手与后续路线图推进指引 (Next Actions)](#8-接手-ai-极速上手与后续路线图推进指引-next-actions)

---

## 1. 项目愿景、世界观与核心不可违背铁律

### 1.1 项目定位
**AI Personal Growth RPG** 是一个将“现实生活中的真实个人成长、技能精进、知识内化与产物输出”转化为严肃 RPG（角色扮演游戏）形态的应用系统。
系统通过 AI Game Master（GM）对用户记录的日常活动进行评估，但**坚决杜绝**传统换皮挂机游戏中的廉价正反馈。

### 1.2 十大不可违背核心铁律 (Non-Negotiable Invariants)
优先原则：`01_SYSTEM_RULES > 02_PRODUCT_DESIGN > 03_TECHNICAL_IMPLEMENTATION > 04~10 > 当前实现代码`。

1. **Time is not XP (时间不是经验)**：单纯耗费时间不等于成长，严禁按照时长单纯线性折算经验。
2. **XP is not Mastery (经验不是掌握度)**：积攒海量经验不能自动晋升掌握阶梯（Mastery Level 0~5），掌握度具有质变门槛。
3. **High Mastery requires Evidence (高熟练度必须有确凿证据)**：M3 及以上的晋升必须关联经过验证的证据（Verified Evidence），绝不允许凭空晋升。
4. **LLM produces proposals; Application code commits permanent growth state (大模型只出提议，确定性代码拥有终审权)**：
   - 严禁让大语言模型直接写入或修改数据库。
   - LLM 只能生成结构化提议（Proposals），由用户通过两阶段确认流（Two-Phase Confirmation）后，经由后端确定性代码提交永久状态。
5. **Final XP is computed by deterministic Growth Engine code (最终经验由确定性代码计算)**：任何数值、惩罚系数、衰减均由 `src/lib/growth-engine` 纯函数计算，严禁相信大模型给出的数值。
6. **Every XP mutation must be traceable through the ledger (每一笔经验变动必须有据可查)**：每笔 XP 增减必须记录在不可篡改的流水账本（`xp_transactions` / `ledger`）中，确保可对账、可审计。
7. **Repetition must reduce XP unless a real breakthrough occurs (重复行为经验衰减)**：缺乏新意与难度的机械重复必须触发收益衰减（Diminishing Returns），除非伴随真实突破。
8. **Failure may produce Learning XP (失败也能产出学习经验)**：真实世界中的失败尝试属于有效探索，可产出针对性的学习经验。
9. **Temporary state must not be confused with permanent capability (临时状态严禁与永久能力混淆)**：短期的状态加成或灵感不能直接当作永久技能等级。
10. **防沉迷与严肃伦理红线**：严禁加入赌博、开箱（Loot-box）、强制连续签到打卡（Forced Streak）、羞辱性负反馈或惩罚性留存机制。

---

## 2. 双 AI 协同治理模型 (Two-AI Governance Protocol)

为了确保每一行代码都经得起生产环境检验与架构约束，本项目采用**执行与审查严格隔离的双 AI 协同机制**：

```
┌─────────────────┐        PR 链接 / 提示词        ┌─────────────────┐
│   执行者 AI     │ ───────────────────────────> │   审查者 AI     │
│  (Implementer)  │                              │   (Auditor)     │
│   [Antigravity] │ <─────────────────────────── │  [External AI]  │
└─────────────────┘       审核裁决 (GO / NO-GO)    └─────────────────┘
         │                                                ▲
         ▼                                                │
   本地代码与分支                                     独立代码审查
   质量门禁全绿                                     SHA/安全/架构审计
   Zero Backend Delta                               P0/P1/P2 严格排查
```

- **执行者 AI (Implementer / Antigravity)**：
  - 负责拆解需求、编写生产代码与测试、运行全量本地质量门禁（Vitest, Harness, Lint, TSC, Build）、推送分支并为用户生成提审材料。
  - **沟通铁律**：与用户交流时禁止无意义寒暄，严格遵循两段式格式输出：
    - `### 你需要做的事情`
    - `### 给下一个 AI 的提示词`
- **审查者 AI (Independent Reviewer / Auditor)**：
  - 拥有最高质量裁决权。在 GitHub 上独立检出分支，比对 Base SHA、Head SHA，核验 CI 运行状态。
  - 按照 P0（阻断级）、P1（架构/规范违规）、P2（文档/微小瑕疵）标准严格扫描，给出 `GO → APPROVE` 或 `NO-GO → NEED_FIX`。
- **用户 (User / Relay Operator)**：
  - 承担中继枢纽职责：在 GitHub Web 端点击对比链接开 PR、转发双方提示词、在获得审查通过后在 GitHub 上点击 Squash and merge。

---

## 3. 整体技术架构与技术栈选型

### 3.1 核心技术栈
- **Web 框架**: Next.js 16.3.1（开启 App Router、Turbopack 编译打包）
- **UI 运行环境**: React 19 + TypeScript 5 (开启严格类型检查 `strict: true`)
- **样式与设计系统**: Tailwind CSS (基于 CSS Variables 设计系统) + Modern Eastern Ink-Wash (新中式水墨浅色优先视觉体系)
- **图谱与可视化**: ReactFlow (`@xyflow/react`) + SVG 拓扑图谱
- **数据库与后端服务**: Supabase (PostgreSQL 15+, 启用 Row Level Security, RPC 事务存储过程, 触发器, Ledger 账本)
- **测试框架**: Vitest 4.1.10 (jsdom 浏览器环境仿真) + 确定性成长引擎 Harness
- **AI 本地桥接**: WSL DSH 托管的本地 AI Gateway（`http://127.0.0.1:3099/v1`），链路为：图片 → Minimax-m3 多模态解析 → DeepSeek-v4-flash 文本推理（受 Go 订阅计费管理，切勿私自重启）。

### 3.2 目录拓扑结构与职责边界
```
AI_Personal_Growth_RPG/
├── docs/                           # 治理与架构权威规范（01_SYSTEM_RULES 至 09_PROJECT_GOVERNANCE）
│   ├── DesignSystem/               # 全局视觉设计规范与逐页迁移路线图 (01~09)
│   └── Check/                      # 历次验收与核验记录总结
├── src/
│   ├── app/                        # Next.js App Router 页面与 API 路由
│   │   ├── api/                    # 后端 HTTP 路由（在 UI 现代化阶段绝对冻结！）
│   │   ├── dashboard/              # 仪表盘主页 (Phase 5A ✅ FINAL FROZEN)
│   │   ├── quests/                 # 任务系统主页 (Phase 5B ✅ FINAL FROZEN)
│   │   ├── skills/                 # 技能树主页 (Phase 5C 🚀 ROUND 1 待审)
│   │   ├── knowledge/              # 知识图谱主页 (Phase 6 ⏳ 待启动)
│   │   └── artifacts/              # 产物系统主页 (Phase 4 ✅ FINAL FROZEN)
│   ├── components/
│   │   ├── layout/                 # 全局布局骨架 (AppHeader, AppSidebar, InspectorDrawer)
│   │   └── ui/                     # 共享冻结 UI 基元库 (LevelBadge, MasteryBadge, XPProgress, BaseModal 等)
│   ├── lib/                        # 领域核心引擎与数据层 (在 UI 现代化阶段绝对冻结！)
│   │   ├── growth-engine/          # 确定性经验与掌握度计算引擎
│   │   ├── store/                  # Supabase 仓储实现
│   │   └── ai/                     # GM 提议解析与 Schema 校验
│   └── styles/
│       └── design-tokens.css       # 全站唯一权威 CSS Design Tokens (浅色水墨基底)
├── supabase/                       # 数据库迁移脚本、RLS 策略与 RPC (在 UI 阶段绝对冻结！)
└── tests/                          # 自动化测试套件 (611+ 项单元与集成测试)
```

---

## 4. 项目全周期里程碑状态与冻结基线 (Roadmap & Freezes)

### 4.1 阶段状态总览表
| 里程碑 | 阶段代号 | 核心交付内容 | 当前状态 | 冻结依据 / PR |
| :--- | :--- | :--- | :--- | :--- |
| **基础设施** | Stage 0 | Supabase 本地环境、RLS 安全隔离、身份认证体系 | **FINAL FROZEN** | PR #1~#3 |
| **核心业务** | Stage 1~4 | 活动解析、两阶段确认流、确定性成长引擎、任务系统 | **FINAL FROZEN** | PR #4~#9 |
| **领域模型** | Stage 5 | 技能树领域服务、派生状态、API 契约 | **FINAL FROZEN** | Stage 5 验收归档 |
| **领域模型** | Stage 6 | 知识图谱领域服务、权威状态、API 契约 | **FINAL FROZEN** | Stage 6 验收归档 |
| **领域模型** | Stage 7A/7B | 产物权威定义（Durable Work Product）、链接关系 | **FINAL FROZEN** | PR #10~#12 |
| **视觉基石** | Phase 1 | 新中式水墨 Design Tokens (`design-tokens.css`) | **FINAL FROZEN** | PR #13 |
| **全局骨架** | Phase 2 | Global AppShell (`AppHeader`, `AppSidebar`, 响应式) | **FINAL FROZEN** | PR #14 |
| **共享基元** | Phase 3 | Shared UI Primitives (徽章、进度条、模态窗基元) | **FINAL FROZEN** | PR #15 |
| **产物视效** | Phase 4 (7C/7D) | 产物档案库 UI 现代化、InspectorDrawer 集成 | **FINAL FROZEN** | PR #16~#17 |
| **核心页面** | Phase 5 - 5A | Dashboard 个人仪表盘视觉重构 | **FINAL FROZEN** | PR #18 |
| **核心页面** | Phase 5 - 5B | Quests 任务系统视觉重构与无障碍治理 | **FINAL FROZEN** | PR #19 |
| **核心页面** | **Phase 5 - 5C** | **Skills 技能树与 ReactFlow 画布现代化** | **IN PROGRESS** | **待审查 (PR #20)** |
| **高级画布** | Phase 6 | Knowledge Graph Canvas 知识图谱画布现代化 | **QUEUED** | 待 Stage 5C 冻结后启动 |
| **全站抛光** | Phase 7 | 端到端无障碍 (A11y)、全视口响应式与动效收敛 | **QUEUED** | 待 Phase 6 完成后启动 |

---

## 5. 当前阶段详述：Phase 5 — Stage 5C-UI Skills Modernization

### 5.1 本阶段核心目标
将 `/skills` 页面及其所有子组件彻底剥离旧版暗黑赛博朋克/霓虹视效，全面迁移至**新中式水墨浅色优先（Modern Eastern Ink-Wash, Light-First）**设计体系，集成全局单实例 `InspectorDrawer`，消除所有直接引用的 `var(--gold-*)`，做到零后端变更与全绿安全门禁。

### 5.2 交付文件变更清单 (11 个文件，+1195 / -333)
1. **`docs/DesignSystem/08_PAGE_MIGRATION_PLAN.md`**：更新 ASCII 路线图中 Stage 5B 冻结标记（独立 Commit `16995f9`）。
2. **`src/app/skills/components/presentation.ts`**：
   - 彻底清除赛博朋克霓虹色（`#00f0ff`, `#a855f7` 等）。
   - 连边配置为纯静态（`animated: false`），消除跑马灯动效。
   - 连边语义严格遵循 Tokens（PREREQUISITE=虚线粗边，EXTENDS=实线细边，MUTUAL=点线聚焦边）。
   - 节点色彩完全映射至浅色 Design Tokens。
   - 剔除游戏玄幻图标 `Crown`，替换为标准 SVG 状态指示器。
3. **`src/app/skills/components/SkillNode.tsx`**：
   - 采用水墨纸质卡片视觉（`--surface-raised`, `--border-subtle`, `--radius-lg`）。
   - 复用 `<LevelBadge>` 与 `<MasteryBadge>` 冻结基元。
   - 完善键盘无障碍：`tabIndex={0}`，支持 `Enter`/`Space` 触发选择。
4. **`src/app/skills/components/SkillGraphCanvas.tsx`**：
   - 配置 `colorMode="light"`。
   - `Background` 采用浅色点阵，`Controls` 与 `MiniMap` 浅色水墨化。
   - 视口适配遵循 `prefers-reduced-motion`。
5. **`src/app/skills/components/DomainFilterPanel.tsx`**：
   - 采用语义化 `<h3>` 标题，解决与 AppHeader 的标题级别冲突。
   - 筛选态使用 `--selection-neutral-*` 浅色 Token。
6. **`src/app/skills/components/EvidenceTimeline.tsx`**：
   - 浅色时间线卡片，复用 `<LevelBadge>`，清晰区分 Verified 与 Inferred 状态。
7. **`src/app/skills/components/SkillDetailPanel.tsx`**：
   - 阶梯进度复用 `<XPProgress />` 基元。
   - 编辑领域弹窗全面复用 `<BaseModal>` 基元（杜绝私造弹窗 DOM）。
   - 移除全部直接引用的 `var(--gold-*)` 与 `text-[var(--text-gold-accent)]`。
8. **`src/app/skills/page.tsx`**：
   - 集成全局单实例 `<InspectorDrawer open={...} onClose={...} title="技能全景档案" mode="auto">`。
   - 响应式单实例布局：桌面端为 Push 列，移动端为 Modal 抽屉。
   - 彻底废除移动端重复手写的 Drawer 覆盖层及 raw z-index（`z-40`, `z-50`）。
   - 满足 `tests/global-app-shell.test.tsx` 中对静态字符串契约的检查。
9. **`tests/phase5-skills-ui.test.tsx` (全新编写，24 项断言)**：
   - 全面覆盖 Token 合法性、黄金色白名单、零 raw z-index、零暗黑模式、零玄幻图标、无障碍键盘、派生状态与空状态等 35 项要求。
10. **`tests/stage5c-presentation.test.ts` (21 项断言)**：全部更新为浅色水墨与静态连边断言。
11. **`tests/stage5c-ui.test.tsx` (37 项断言)**：全部更新为浅色表面与 SVG 状态图标断言。

### 5.3 严格零后端变更 (Zero Backend Delta)
- `src/app/api/**`: 0 改动
- `supabase/**`: 0 改动
- `src/lib/**`: 0 改动
- `src/proxy.ts`: 0 改动
- `src/components/ui/**`: 0 改动（完全复用现有基元）
- `package.json` / `pnpm-lock.yaml`: 0 改动

---

## 6. 环境运行规则、痛点与关键避坑指南 (Critical Gotchas)

后续接手 AI **必须牢记以下运行环境特点与避坑铁律**，否则将引发挂起或测试假失败：

### 6.1 WSL Ubuntu 与 Windows 双环境分工
- **文件系统**: 项目物理路径位于 `d:\AI_Personal_Growth_RPG`，在 WSL 中的挂载路径为 `/mnt/d/AI_Personal_Growth_RPG`。
- **所有开发、测试、构建命令必须在 WSL 中执行**：
  Windows PowerShell 环境缺少配置好的 pnpm 与 Node.js 运行时，必须通过统一命令调用 WSL：
  ```bash
  wsl -d Ubuntu -- bash -lc "cd /mnt/d/AI_Personal_Growth_RPG && <命令>"
  ```
- **Git Push 必须在 Windows PowerShell 中执行**：
  WSL 内部的 Git 没有绑定宿主机的交互式凭据管理器，执行 `git push` 会永久挂起阻塞！提交代码后，推送到 GitHub 必须通过宿主 Windows 命令执行：
  ```powershell
  git push origin <branch-name>
  ```

### 6.2 黄金色白名单 (Gold Whitelist) 审计红线
- 审查 AI 对“金色滥用”采取零容忍态度。
- **红线**：禁止在页面组件或业务卡片中直接编写 `var(--gold-*)`、`var(--border-gold-*)`、`var(--text-gold-*)` 或使用 `text-gold` / `border-gold` 类。
- **合规方式**：任何金色/琥珀色质感必须且只能封装在冻结 UI 基元内部（如 `<LevelBadge>`, `<MasteryBadge>`, `<XPProgress>`, `<TierBadge>`）。业务层一律使用 `--text-primary`、`--border-subtle`、`--surface-raised` 等中性水墨 Tokens。

### 6.3 模态窗与图层堆叠治理 (Modal & z-layer Governance)
- **严禁手写遮罩/弹窗**：禁止在任何页面写 `<div className="fixed inset-0 bg-black/50 z-50">`。
- **弹窗统一基元**：必须且只能引用 `@/components/ui/BaseModal`。
- **侧滑抽屉统一基元**：必须且只能引用 `@/components/layout/InspectorDrawer`。
- **严禁使用 Tailwind 原始 z 类**：禁止使用 `z-10`, `z-40`, `z-50`。所有图层必须引用 `design-tokens.css` 中声明的语义变量（如 `--z-drawer`, `--z-modal`, `--z-modal-backdrop`）。

### 6.4 `global-app-shell.test.tsx` 静态扫描契约
- 该测试套件中的测试 10 与测试 14 并非渲染测试，而是通过 `fs.readFileSync` 扫描文件源码字符串：
  - 测试 10：检查 `src/app/skills/page.tsx` 是否包含 `setMobileNavOpen(true)`。
  - 测试 14：检查 `src/app/skills/page.tsx` 是否包含：
    `xl:relative xl:w-[var(--drawer-width-desktop)] xl:shrink-0`、`xl:hidden`、`xl:static`。
- 在对 `page.tsx` 重构时，必须以代码或响应式注释的形式保留这组契约字符串，否则全局测试会报红色故障。

---

## 7. 质量门禁与验证指令集 (Quality Gates Cheatsheet)

在提交任何改动或向审查 AI 提审之前，必须在 WSL 中依次执行并通过以下所有指令：

```bash
# 1. 运行 Skills 专项测试套件 (82 项全过)
wsl -d Ubuntu -- bash -lc "cd /mnt/d/AI_Personal_Growth_RPG && pnpm vitest run tests/stage5c-presentation.test.ts tests/stage5c-ui.test.tsx tests/phase5-skills-ui.test.tsx"

# 2. 运行 App Shell 响应式集成套件 (80 项全过)
wsl -d Ubuntu -- bash -lc "cd /mnt/d/AI_Personal_Growth_RPG && pnpm vitest run tests/global-app-shell.test.tsx"

# 3. 运行全量单元与集成测试 (611 项全过，0 失败)
wsl -d Ubuntu -- bash -lc "cd /mnt/d/AI_Personal_Growth_RPG && pnpm test"

# 4. 运行确定性增长引擎 Harness (11 项全过)
wsl -d Ubuntu -- bash -lc "cd /mnt/d/AI_Personal_Growth_RPG && pnpm harness:deterministic"

# 5. 代码代码风格检查 (0 errors, 0 warnings)
wsl -d Ubuntu -- bash -lc "cd /mnt/d/AI_Personal_Growth_RPG && pnpm lint"

# 6. 类型安全检查 (0 errors)
wsl -d Ubuntu -- bash -lc "cd /mnt/d/AI_Personal_Growth_RPG && pnpm tsc --noEmit"

# 7. Next.js 生产环境打包验证 (19 static routes, 编译成功)
wsl -d Ubuntu -- bash -lc "cd /mnt/d/AI_Personal_Growth_RPG && pnpm build"
```

---

## 8. 接手 AI 极速上手与后续路线图推进指引 (Next Actions)

当你作为新会话中的接手 AI 启动时，请按照当前项目所处的实际状态执行对应的分流逻辑：

```
                                  检查当前状态
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
      【场景 A: 审查 AI 给出 GO】               【场景 B: 审查 AI 给出 NO-GO】
                  │                                         │
        1. 用户在 GitHub 合并 PR                   1. 提取审查报告中的 P1/P2
        2. 本地切 main 分支拉取最新代码             2. 在 src/app/skills/** 手术式修复
        3. 更新 08_PAGE_MIGRATION_PLAN            3. 运行全量测试门禁验证
        4. 标记 Stage 5C 为 FINAL FROZEN           4. Commit 并 Push 到 feature 分支
        5. 创建 feature/phase6 分支               5. 生成 Round 2 提审提示词给用户
        6. 请求审查 AI 授权 Phase 6 启动
```

### 场景 A：审查通过并合并后，如何启动 Phase 6（知识图谱画布）
1. 确认 PR 已由用户在 GitHub 上通过 **Squash and merge** 合并入 `main`。
2. 本地拉取最新代码：
   ```bash
   wsl -d Ubuntu -- bash -lc "cd /mnt/d/AI_Personal_Growth_RPG && git checkout main && git pull origin main"
   ```
3. 更新 `docs/DesignSystem/08_PAGE_MIGRATION_PLAN.md`，将 `Stage 5C-UI Skills Modernization` 状态更新为 `[FINAL FROZEN]`。
4. 提交文档更新：
   ```bash
   wsl -d Ubuntu -- bash -lc "cd /mnt/d/AI_Personal_Growth_RPG && git commit -am 'docs(roadmap): mark Stage 5C-UI Skills Modernization as FINAL FROZEN'"
   git push origin main
   ```
5. 开启新分支：
   ```bash
   wsl -d Ubuntu -- bash -lc "cd /mnt/d/AI_Personal_Growth_RPG && git checkout -b feature/phase6-knowledge-canvas"
   ```
6. 向审查 AI 发送 **PHASE 6: ADVANCED CANVAS MODERNIZATION (KNOWLEDGE GRAPH) ROUND 1 IMPLEMENTATION AUTHORIZATION** 请求。

### 场景 B：审查未通过（NEED_FIX），如何执行外科手术式修复
1. 仔细通读审查 AI 的报告，明确每一个 P1/P2 的违规根因（如漏掉的 Token、某个 DOM 的无障碍 ARIA 属性不完整、测试缺少边界覆盖等）。
2. 严守边界：**绝对不要触碰后端、API、数据库或共享基元**，所有修复严格限制在 `src/app/skills/**` 和对应测试文件内。
3. 保持修复极简且精准，杜绝大面积重写。
4. 修复完成后重新跑通第 7 节中的全量质量门禁。
5. 提交并推送，输出清晰的修复清单，请求进入下一轮审查。
