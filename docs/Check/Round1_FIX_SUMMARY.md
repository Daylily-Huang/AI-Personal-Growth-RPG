# Round1 修复摘要（供第二轮 Commit Diff 审查对账）

对应 `docs/Check/Round1.txt`（独立审查第一轮，CONDITIONAL PASS）末尾的“下一条指令”7 项。

## 1. 修复 repetitionCount：不得使用全部 transaction 数量 ✅

- 移除 `recentSimilarCount = db.transactions.length`
- 新增纯函数 `countRecentSimilar()`（`src/lib/store/similarity.ts`），只在确认时按相似规则计数
- `src/app/api/activities/[id]/assess/route.ts` 不再把“全部交易数”塞给 AI（改为诚实的 `0`，注释说明原因）；真实重复惩罚由确定性引擎在 confirm 时强制兜底

## 2. 设计 MVP similarity 判定 ✅

规则（已写入 `similarity.ts` 文档注释）：

```text
同 primary skill
+ 同 activity_type
+ 最近 30 天内（以确认时间为参考点）
```

- `XpTransaction` 新增 `activityType` 字段，结算时写入
- 后续可升级为 semantic embedding 相似度，但确定性引擎保持纯净

## 3. 添加“不同类型 Activity 不互相触发重复惩罚”的测试 ✅

- `tests/similarity.test.ts`：7 个纯函数用例（跨技能=0、跨类型=0、同技能同类型计数、超 30 天忽略、参考点之后忽略、旧数据无类型不匹配、自定义窗口）
- `tests/confirm.test.ts`：端到端两种情形
  - 同技能不同活动类型 → `repetitionPenalty = 1`（无惩罚）
  - 同技能同活动类型 → 第二次 `repetitionPenalty < 1`（有惩罚）

## 4. 添加并发 confirm 测试 ✅

- `tests/confirm.test.ts`：`Promise.all` 两个并发 confirm，最终 `transactions.length === 1`，且一个 `ok`、一个 `already_confirmed`

## 5. 将 XP transaction assessmentId 设计为未来数据库 UNIQUE ✅

- `docs/06` 数据字典 `xp_transactions` 增加 `activity_type` 与 `UNIQUE(assessment_id)` 约束
- 新增迁移脚本 `supabase/migrations/0009_xp_transactions.sql`（`unique (assessment_id)` 已在建表时声明，Supabase 接入时执行）

## 6. 更新文档，明确 sequential vs concurrent idempotency 差异 ✅

- `docs/06` 新增 §23.1：Sequential / Concurrent（单进程）/ Concurrent（跨进程多实例）三档说明
- 结论：顺序幂等已保证；单进程内并发幂等已保证；跨进程/多实例幂等需数据库 `UNIQUE(assessment_id)`，这归入 Supabase 阶段

## 7. build + lint + test 全部通过 ✅

```text
pnpm lint    → 0 error / 0 warning
pnpm test    → 3 files / 23 tests passed
pnpm build   → 成功（/skills、/api/skills 等路由齐全）
```

## 本轮 IN SCOPE / OUT OF SCOPE

- IN：上述 7 项 P0/P1 修复
- OUT（审查同意留到后面）：Supabase 真实接入、Activity 列表页、Skill ontology、Playwright E2E、并发跨进程保证
- 未改动任何 Growth Constitution / XP 哲学 / 反刷分哲学等规则层内容
