# 项目历史工作进度 (Progress Log)

> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **更新时间**: 2026-09-05

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
- 下一步：精确暂存 Round 4 文件与本轮证据文档，commit/push → exact-head GitHub CI（含真实 Supabase）复验；CI 绿色后进入 Round 5 exit verification / 独立 Gatekeeper。

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
