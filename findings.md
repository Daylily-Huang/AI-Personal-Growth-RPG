# 调查发现与核心架构决策 (Findings)

> **权威状态主文档**：请统一参阅 [`docs/MASTER_PROJECT_HANDOFF.md`](docs/MASTER_PROJECT_HANDOFF.md)。  
> **更新时间**: 2026-09-05

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
