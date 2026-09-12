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
   - **活跃文本对比度铁律 (P1-05 闭环)**：所有正常字号交互与徽章文本必须严格满足 WCAG 2.1 AA 对比度（$\ge 4.5:1$）。`PrimaryButton` 采用深石板文字 `--text-primary`（`#1c2127`）搭配古金底色 `--gold-400`（`#d49a26`，实测 6.52:1，hover 态 11.49:1）；`LevelBadge` 采用深石板内衬（`bg-[var(--text-primary)]`）与古金边框/文字（实测 6.52:1），彻底根除 2.49:1 非合规对比度。
   - **72 格无头浏览器全矩阵闭环**：9 路由 × 4 视口 (375/768/1024/1440) × 2 动效模式 (no-preference/reduce) 实现 100% 零水平溢出、零控制台严重错误。
   - **键盘与弹层焦点生命周期**：ReactFlow 拓扑图与原生表格替代视图双轨支持，Modal / Drawer Escape 捕获与焦点恢复规范化。
   - **CI 治理隔离**：post-merge push-to-main CI 失败（Run `34708617506`）经独立审查确认仅来源于 `tests/phase5-quests-ui.test.tsx` 与 `tests/phase5-skills-ui.test.tsx` 的 merge-base delta guard 兼容性（`KNOWN PUSH-TO-MAIN GOVERNANCE GUARD INCOMPATIBILITY`），不撤销 Phase 7 终局冻结效力。
