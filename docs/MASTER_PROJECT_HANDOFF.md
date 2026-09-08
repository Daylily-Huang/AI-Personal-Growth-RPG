# AI Personal Growth RPG — 项目全景交接与治理主文档 (Master Project Handoff)

> **文档版本**: 1.2 (Master Comprehensive Handoff)
> **更新时间**: 2026-09-08
> **适用对象**: 后续所有接手的 AI 工程师、独立审查 AI、项目协作者  
> **Phase 6 合并基线 (main)**: `186e5bed71844ba274680b10ab939bc5169e669d`
> **当前所处里程碑**: Phase 7 — Round 1 (**MERGED / COMPLETE**); Round 2 Responsive Stress Hardening (**AUTHORIZED / CODE NOT STARTED**)
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
2. **XP is not Mastery (经验不是掌握度)**：积攒海量经验不能自动晋升掌握阶梯（Mastery Level M0~M10），掌握度具有质变门槛与证据等级硬约束（见 `docs/Design ChatGPT/01_SYSTEM_RULES.md` Rule 4 与 `src/lib/growth-engine/mastery.ts`）。
3. **High Mastery requires Evidence (高熟练度必须有确凿证据)**：晋升至 M5（Apply）及以上或单次跨级 >= 2 级必须关联经过验证的证据（Verified Evidence），且提议上限严格受证据等级约束（E0→M2, E1→M3, E2→M4, E3→M5, E4→M6, E5→M8, E6→M10），绝不允许凭空晋升。
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
│   │   ├── skills/                 # 技能树主页 (Phase 5C ✅ FINAL FROZEN)
│   │   ├── knowledge/              # 知识图谱主页 (Phase 6 ✅ FINAL FROZEN)
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
| **核心页面** | **Phase 5 - 5C** | **Skills 技能树与 ReactFlow 画布现代化** | **FINAL FROZEN** | **PR #20 (Squash Commit 6e238a4)** |
| **高级画布** | **Phase 6** | **Knowledge Graph Canvas 知识图谱画布现代化** | **FINAL FROZEN** | **PR #21，merge commit `186e5bed71844ba274680b10ab939bc5169e669d`；Exact Head `066fe811e187c547069b3ed3965f24d19e280e9a`；CI `34179971347`** |
| **全站抛光** | **Phase 7 — Round 1** | **端到端无障碍语义、键盘导航与图谱表格替代视图** | **MERGED / COMPLETE** | **PR #22；merge commit `533ab09ebeb8bb827401446f022cf9a83c7db89c`；Exact Head `9cafc345a074577084cad08bbdbed1789911d8ff`；CI `34223921283`** |
| **全站抛光** | **Phase 7 — Round 2** | **全视口响应式压力硬化、溢出/裁切、Drawer/Table/Graph workspace 与触控目标治理** | **AUTHORIZED / CODE NOT STARTED** | **`docs/DesignSystem/PHASE7_ROUND2_EXECUTION.md`；branch `feature/phase7-responsive-stress`** |

---

## 5. 阶段回顾：Phase 5 — 核心业务页面全量冻结 (FINAL FROZEN)

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

当前状态：Phase 5 核心业务页面（Dashboard、Quests、Skills）已全线 **FINAL FROZEN**（PR #20 Squash Commit `6e238a4`，基线冻结 Commit `a93e2bc`）。**Phase 6: Advanced Canvas Modernization (Knowledge Graph Canvas)** 已完成独立复核并通过 PR #21 合并，现为 **FINAL FROZEN**。Phase 7 Round 1 已完成独立复核并通过 PR #22 合并；Round 2 已正式授权，但代码工作尚未开始。

### Phase 6 — Knowledge Graph Canvas Modernization（FINAL FROZEN）
1. **合并证据**：PR #21，批准 Exact Head `066fe811e187c547069b3ed3965f24d19e280e9a`，merge commit `186e5bed71844ba274680b10ab939bc5169e669d`，CI run `34179971347`。
2. **冻结范围**:
   - `/knowledge` 画布全面浅色水墨化（Light-First Ink-Wash），清除所有旧黑底（`bg-[#0b0f17]`）、赛博朋克深色类与硬编码色值。
   - 确定性领域聚类（Deterministic Domain/Category Clustering），纯前端布局函数，零新算法依赖，同一输入稳定输出。
   - 关系边权威与静态化：所有边默认 `animated: false`，消除闪电与跑马灯动效；严格保留五大关系类型与对称/有向语义。
   - 全局单实例 `InspectorDrawer` 集成（`mode="auto"`），节点与关系共用，支持只读关联技能富集（`LevelBadge`/`MasteryBadge`/`XPProgress`）与产物/证据溯源；Linked Skill Summary 明确属于 Skill 子区块，不改变 Knowledge 语义。
   - `KnowledgeNodeView` 使用冻结的交互式 `RPGCard`，通过 `role="button"`、`tabIndex=0` 和 Enter/Space 激活提供键盘语义，不是原生 `<button>`。
   - 保证严格零后端、零共享基元、零领域模型修改。
3. **后续规则**：Phase 6 的 backend/domain authority、Supabase、shared UI primitives、shared layout、design tokens 与 dependencies 继续冻结；任何重新开放必须先有明确的新变更授权。

### Phase 7 — Round 1: Accessibility Semantics + Keyboard + Graph Table Views（MERGED / COMPLETE）
1. PR #22 以批准 Exact Head `9cafc345a074577084cad08bbdbed1789911d8ff` 合并，merge commit 为 `533ab09ebeb8bb827401446f022cf9a83c7db89c`。
2. Approved CI `34223921283` 的 `check` 与 `supabase-integration` 均成功；DB-backed tests、deterministic harness 与 E2E 步骤实际执行并成功。
3. Round 1 保持 backend/domain authority、Supabase、shared UI/layout、design tokens、dependencies zero drift，并保留 `/skills?view=table`、`/knowledge?view=table` 与图谱键盘语义。

### 下一阶段正式入口：Phase 7 — Round 2: Responsive Stress Hardening
1. 正式执行手册：`docs/DesignSystem/PHASE7_ROUND2_EXECUTION.md`。
2. 实施分支策略：从当前 `main` `533ab09ebeb8bb827401446f022cf9a83c7db89c` 创建 `feature/phase7-responsive-stress`，使用独立 PR；不得直接提交 `main`，不得沿用已合并的 Round 1 分支。
3. 范围：`320/375/768/1024/1440` 视口压力、导航模式转换、workspace grid、page-level overflow/clipping、InspectorDrawer、BaseModal、graph/table density 与现有 `var(--touch-target-min)` 治理。
4. Round 2 继续冻结 backend/domain authority、Supabase、shared UI/layout、design tokens 与 dependencies；Round 3 motion polish、Round 4 final audit/freeze 均未授权。
5. 继续遵守双 AI 协同治理、独立复核、Exact Head CI 与 skipped 测试如实报告规则。
