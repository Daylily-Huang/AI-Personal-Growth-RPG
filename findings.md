# 调查发现与核心架构决策 (Findings)

> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **更新时间**: 2026-09-13

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
