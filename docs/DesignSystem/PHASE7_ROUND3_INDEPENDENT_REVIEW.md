# PHASE 7 — ROUND 3 INDEPENDENT REVIEW

> 审查日期：2026-09-11
> 审查者：独立审查 AI（未参与 Round 3 实现）
> 依据手册：`review/phase7-round3-planning:docs/DesignSystem/PHASE7_ROUND3_EXECUTION.md`（1352 行，全文读取）
> 隔离方式：`.codex/round3-review` 独立克隆，detached 检出被审 Head，工作区干净

---

## 审查对象锚点

| 项 | 值 |
|---|---|
| PR | #25 `feat(motion): Phase 7 Round 3 reduced-motion polish` |
| 被审 Exact Head | `6b31a72a137b8217af70687af1daacc8c7d0e121` |
| 真实分支点 | `9d394d11e3c858fe02abf52a18351482975a372c`（= Round 2 merge commit = 当前 main） |
| 分支点核验方式 | `145d798^` = `9d394d1`；`git merge-base main HEAD` = `9d394d1` |
| Round 3 提交 | `145d798`（实现）、`6b31a72`（语义等价测试） |
| Exact-Head CI | Run `34392543831`，`head_sha` = `6b31a72`，attempt 1，conclusion success |
| Round 2 仲裁 | PR #23 merged from approved Head `d17dbd8`，merge commit `9d394d1`，已核验为 main 祖先 |

**时序说明**：Round 2 于 2026-09-09T17:43:52Z 合并；Round 3 两个提交时间戳在其后（`6b31a72` 为 2026-09-09T18:41:04Z）。硬入口门禁在实现前已满足。

---

## 变更范围（相对真实 main，三点 diff）

```
M  src/app/artifacts/page.tsx                          +2  -2
M  src/app/knowledge/components/KnowledgeGraphCanvas.tsx  (+14 resolve, 2 call sites)
M  src/app/login/page.tsx                              +1  -1
M  src/app/skills/components/SkillGraphCanvas.tsx       (+14 resolve, 2 call sites)
A  tests/phase7-motion-reduced-motion.test.tsx          +336
5 files changed, 374 insertions(+), 7 deletions(-)
```

---

## 冻结路径审计（逐文件机检）

```
✓ 允许: src/app/artifacts/page.tsx
✓ 允许: src/app/knowledge/components/KnowledgeGraphCanvas.tsx
✓ 允许: src/app/login/page.tsx
✓ 允许: src/app/skills/components/SkillGraphCanvas.tsx
✓ 允许: tests/phase7-motion-reduced-motion.test.tsx
```

- `src/app/api/**` drift: **0**
- `src/lib/**` drift: **0**
- `supabase/**` drift: **0**
- `src/proxy.ts` drift: **0**
- `src/styles/design-tokens.css` drift: **0**
- `package.json` / `pnpm-lock.yaml` drift: **0**
- `src/components/**`（非 6.2 白名单）drift: **0** — 共享组件零改动，故 6.2 条件授权未被使用

---

## 逐 Workstream 核验

| Workstream | 要求 | 实测证据 | 结论 |
|---|---|---|---|
| A 全局 reduced-motion 契约 | 保留 `globals.css` reset，不改 tokens | `globals.css` 未被改；`@media (prefers-reduced-motion: reduce)` 四个 `!important` 声明在位（`animation-duration: 0.01ms`、`animation-iteration-count: 1`、`transition-duration: 0.01ms`、`scroll-behavior: auto`）；`design-tokens.css` 零改动 | PASS |
| B loading / 永续动效 | reduced 下每个 spinner/pulse 静止，保留语义 | 页面级 15 处 `animate-spin`/`animate-pulse` **全部** 带 `motion-reduce:animate-none`（逐行 grep 核验，0 处未配对）；`role="status"`/`aria-busy`/文本语义未删 | PASS |
| C 图谱相机（Skill） | reduced → 0，normal 非零且克制 | `setCenter`/`fitView` 均改走 `resolveGraphCameraDuration`；normal 由 `--duration-normal` 解析为 250ms（原 600/450ms） | PASS |
| C 图谱相机（Knowledge） | 同上 | 同上；normal 250ms（原 500/400ms） | PASS |
| C 图谱边 | 保持静态 | 两画布 `toFlowEdges` 全部 `animated: false`；测试直接断言 | PASS |
| D InspectorDrawer | 审计，不改 | 共享组件零改动；全局 reset 承担 reduced 降级 | PASS (N/A) |
| E BaseModal | 审计，不改 | 同上 | PASS (N/A) |
| F shell/导航 | 审计，不改 | 共享骨架零改动 | PASS (N/A) |
| G 微交互 | 克制 | 无新增 transition/animation 类 | PASS |
| H 环境/装饰动效 | 无新增装饰动效 | 全仓 **零** `@keyframes`、零原生 `animation:` 声明；仅 Tailwind `animate-spin`/`animate-pulse` 内建工具类 | PASS (NOT PRESENT) |
| I 滚动行为 | 无程序化平滑滚动 | 唯一 `scrollIntoView` 在 `dashboard/page.tsx:199`，为 `behavior: "auto"` | PASS |
| 17 动效/状态解耦 | 无业务状态被动画阻塞 | 全部 `setTimeout`/`requestAnimationFrame` 均为视觉调度、焦点调度或防抖；无 `transitionend`/`animationend` 驱动状态变更 | PASS |

### 补充核验：声明式 `fitView` prop（测试未覆盖路径）

两画布仍有未 token 化的声明式 `fitView` prop（`fitViewOptions={{ padding }}`，无 `duration`）。追查依赖实现确认其安全性：

```
@xyflow/system@0.0.80 fitViewport() → panZoom.setViewport(vp, { duration: options?.duration })  // undefined
@xyflow/system@0.0.80 getD3Transition(selection, duration = 0) → hasDuration=false → 无 transition
```

结论：`duration: undefined` → 默认 0 → **瞬移**，reduced-motion 安全。该路径无 P1 缺陷。

---

## 质量门禁（在隔离副本 @ `6b31a72` 亲自复现）

| 门禁 | 结果 |
|---|---|
| `vitest run`（全量） | **40 files passed / 19 skipped（共 59）；655 passed / 279 skipped（共 934）**，exit 0 |
| `harness:deterministic`（`tests/growth-engine.test.ts`） | **1 file passed；11 tests passed**，exit 0 |
| `lint`（eslint） | exit 0，0 errors / 0 warnings |
| `tsc --noEmit` | exit 0，0 errors |
| `build`（next build，Turbopack） | exit 0；路由表完整（22 API + 6 页面 + Proxy middleware） |
| Round 3 专项套件 | 7 tests passed（已含于全量） |
| `test:e2e`（本地） | **1 file skipped / 9 tests skipped** — 本地 `XP_RPG_TEST_DB_URL` 未设置，明确记为 skipped，非 passed |

### 本地计数核对（19 skipped 文件 = DB 门控 + E2E）

20 个文件引用 `XP_RPG_TEST_DB_URL`，其中 `ci-env-script.test.ts` 为纯静态检查并已通过，其余 19 个被跳过，与 `40 passed | 19 skipped` 完全吻合，无隐藏跳过。

### 依赖等价性证明

`git diff 066fe81 6b31a72 -- package.json pnpm-lock.yaml` 为空。因隔离副本受 Turbopack「symlink 越出项目根」限制，`next build` 于工作区 `066fe81` 执行——该状态与被审 Head **依赖零差异、零变更文件**，就本门禁而言等价。

---

## GitHub Actions（Run `34392543831`）

`head_sha=6b31a72a137b8217af70687af1daacc8c7d0e121`，`event=pull_request`，`run_attempt=1`，`conclusion=success`。

**`check`**（job `102604170377`）— 全部 success：Checkout / Setup pnpm / Setup Node.js / Install dependencies / **Lint** / **Test** / **Build**。

**`supabase-integration`**（job `102604170558`）— 全部 success：Initialize containers / Setup Supabase CLI / **Start local Supabase stack** / **Export local Supabase credentials** / **Build production app** / **Run database-backed tests** / **Deterministic growth-engine harness** / **Run E2E tests** / **Stop containers**。

### DB-backed 与 E2E 真实执行 — 原始日志实证

审查者持仓库 admin 权限，已直接下载两个 job 的原始日志（`actions/jobs/{id}/logs`，HTTP 200）。

**`supabase-integration` 日志原文（ANSI 剥离后）：**

```
Test Files  59 passed (59)      ← Run database-backed tests (pnpm test)
  Tests  934 passed (934)

Test Files  1 passed (1)        ← Deterministic growth-engine harness
  Tests  11 passed (11)

Test Files  1 passed (1)        ← Run E2E tests (pnpm test:e2e)
  Tests  9 passed (9)
```

**`check` job 日志原文：**

```
Test Files  40 passed | 19 skipped (59)
```

### 结论：本地 skipped 与 CI 执行的差异已被完全解释

| 环境 | `XP_RPG_TEST_DB_URL` | Test Files | Tests |
|---|---|---|---|
| 本地审查副本 | 未设置 | 40 passed **/ 19 skipped** | 655 passed / **279 skipped** |
| CI `check` | 未设置 | 40 passed **/ 19 skipped** | 同上 |
| CI `supabase-integration` | **已注入** | **59 passed / 0 skipped** | **934 passed / 0 skipped** |

CI `supabase-integration` 中 **59/59 文件全部通过、零跳过**，证明本地那 19 个 DB 门控文件（RLS 权限矩阵、结算事务、租户隔离、Stage 7D 产物安全等）以及 9 项 E2E **确实真实执行**，未被静默跳过。

此前的间接推断（workflow + 导出脚本 + `describe.skipIf` 三方交叉验证）与日志实证结论一致，但因直接证据已取得，间接推断不再作为依据。

*（日志含已脱敏的环境变量，未纳入提交。）*

---

## 人工验证

| 项 | 状态 |
|---|---|
| 浏览器路由 / 视口宽度（375/768/1024/1440） | **NOT VERIFIED** — Chrome Bridge extension 未连接（`opencli doctor` daemon 正常但扩展缺失）；本次审查亦未执行 |
| 实体触摸设备 | **NOT VERIFIED** |
| VoiceOver / NVDA / JAWS | **NOT VERIFIED** |
| `prefers-reduced-motion: reduce` 真实 OS 仿真 | **NOT VERIFIED**（仅 jsdom mock 证明） |

实现方在 `progress.md` 中已**如实**标注上述 NOT VERIFIED，未伪造声明——符合手册 §19.5 与 §26。

---

## 发现清单

### P0 — 0 项

### P1 — 0 项

无。逐项排除：reduced-motion 下相机 duration=0（含未 token 化的声明式 `fitView`，已追查依赖确认为 0）；无核心流程永续动效未处理（15/15 配对 + 全局 reset 兜底）；无共享组件越权改动；无新依赖/新 token；图谱边保持静态；无动效阻塞业务状态；reduced-motion 不改变任何语义数据。

### P2 — 4 项（非阻断）

**P2-1｜18.4「Loading motion」测试覆盖不完整**
测试仅扫描 `login/page.tsx` 与 `artifacts/page.tsx`（§18.4 明确列出 6 条路由）。实际 page-local loader 分布于 5 个文件共 15 处，其中 `skills/page.tsx`（1 处）、`knowledge/page.tsx`（1 处）、`knowledge/components/KnowledgeDetailPanel.tsx`（3 处）、`KnowledgeEdgeDetailPanel.tsx`（3 处）、`EditNodeMetadataModal.tsx`（1 处）、`SkillDetailPanel.tsx`（2 处）、`SkillNode.tsx`（1 处）**均未被该断言覆盖**。另有 `animate-pulse` 类未被该扫描关注。
*独立核验结论*：我已逐行 grep 确认 15/15 全部配对，**无运行时缺陷**，故仅属测试覆盖缺口。
*依据*：手册 §18.4、§20.5、§26「Do not claim a source-string scan proves runtime behavior」。

**P2-2｜§18.7 语义等价测试深度不足**
`preserves authoritative graph facts...` 断言的是**映射后的节点/边 prop 快照**（id/name/level/xp/masteryLevel/masteryConfidence/verificationStatus/confidence/isArchived/label/animated），而非手册要求的**已渲染 DOM 文本**。手册列举的 Evidence labels、relation labels、archive lifecycle 及 `aria-*` 语义等价未被直接断言。
*独立核验结论*：reduced-motion 偏好仅流入 `resolveGraphCameraDuration`，不触及任何数据 prop（已逐行核对 diff），**功能上无缺陷**。
*依据*：手册 §18.7。

**P2-3｜token 不可读时 normal-motion 亦退化为 0**
`resolveGraphCameraDuration` 在 `--duration-normal` 缺失或不可解析时返回 0，**两种偏好下均瞬移**。此为首选手册 §10.2 第 3 条「fail safely」，方向保守；但与实现方自己的测试命名 `"fails safely with zero-duration graph movement when the motion token is unavailable"` 并列时，normal-motion 用户会得到视觉跳变（health 环境中因 `globals.css` 导入 tokens 而不可达）。建议记为已知取舍。

**P2-4｜同源 helper 重复两份**
`resolveGraphCameraDuration` 在 Skills 与 Knowledge 两画布逐字重复。手册 §10.2 第 2/4 条要求 resolver 保持呈现层局部且不得置于 `src/lib/**`，实现守规；但跨画布重复存在漂移风险。非阻断。

---

## 验收矩阵（手册 §23）

| Gate | 状态 |
|---|---|
| PR #23 Round 2 merged from approved Head | PASS |
| Round 2 approved Head ancestor of current main | PASS |
| Round 3 branch point recorded（`9d394d1`） | PASS |
| Backend/domain/API delta | 0 |
| Supabase delta | 0 |
| Dependency delta | 0 |
| Design-token delta | 0 |
| Shared-component delta | 0（6.2 白名单未使用） |
| XP/Mastery/Evidence semantics | unchanged |
| Knowledge authority/confidence semantics | unchanged |
| Round 1 keyboard semantics | PASS（`phase7-a11y-keyboard` 全绿） |
| Round 2 responsive/overflow regression | PASS（`phase7` 相关套件全绿） |
| `/skills?view=table` · `/knowledge?view=table` | PASS |
| Skill graph reduced camera motion | PASS |
| Knowledge graph reduced camera motion | PASS |
| Graph edges remain static | PASS |
| Loading spinner/pulse reduced contract | PASS（实现正确；测试覆盖见 P2-1） |
| InspectorDrawer reduced-motion semantics | PASS (N/A) |
| BaseModal reduced-motion semantics | PASS (N/A) |
| Shell/navigation motion regression | PASS (N/A) |
| Smooth scroll reduced behavior | PASS |
| `var(--touch-target-min)` preserved | PASS（`44px`，两表格视图仍引用） |
| No business state gated by animation | PASS |
| Normal motion restrained/non-blocking | PASS（统一 250ms，较原值收紧） |
| Reduced motion semantic equivalence | PASS（实现无缺陷；断言深度见 P2-2） |
| Local unit/integration suite | PASS with exact skipped accounting |
| deterministic harness | PASS |
| lint | PASS |
| TypeScript | PASS |
| production build | PASS |
| new Exact-Head check CI | SUCCESS |
| new Exact-Head supabase-integration CI | SUCCESS |
| remote DB-backed tests actually executed | PASS（日志实证 59/59 files、934/934 tests、0 skipped） |
| remote E2E actually executed | PASS（日志实证 9/9 tests passed） |
| Round 4 work absent | PASS |

---

## 裁决

```
PHASE 7 — ROUND 3 INDEPENDENT REVIEW

PR: #25
Branch Point: 9d394d11e3c858fe02abf52a18351482975a372c
Reviewed Exact Head: 6b31a72a137b8217af70687af1daacc8c7d0e121
Exact-Head CI: 34392543831

P0: 0
P1: 0
P2: 4  (P2-1 测试覆盖 / P2-2 断言深度 / P2-3 token 缺失退化 / P2-4 helper 重复)

Frozen-path Audit: PASS
Backend / Domain / API / Supabase Drift: 0
Shared UI / Layout / Token / Dependency Drift: 0
Round 1 Regression: PASS
Round 2 Regression: PASS
Round 3 Premature Work: 0
Round 4 Premature Work: 0

VERDICT:
GO

ROUND 3:
AWAITING MERGE (PR #25 open, mergeable_state=clean)

NEXT ROUND ELIGIBILITY:
Round 4 final cross-page acceptance audit remains UNAUTHORIZED.
Phase 7 is NOT FINAL FROZEN.
```

`No merge performed. No Phase 7 Round 4 work started.`
