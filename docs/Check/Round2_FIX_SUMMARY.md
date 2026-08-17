# Round2 跟进摘要（PASS 后的非阻塞项 + CI）

对应 `docs/Check/Round2.txt`（第二轮 commit diff 审查，结论 **PASS 8.3/10，允许进入下一阶段**）。

第二轮没有 P0 blocker，但留下了非阻塞提醒。本轮跟进处理其中可直接落地、无需外部资源的项。

## 1. [P1/P2] Proposal `repetition_risk` 与最终惩罚不一致 → 采用审查推荐的 Option A ✅

问题：assess 阶段无法预知 primary skill / activity_type（要靠 AI proposal），所以传入 `recentSimilarCount=0`；
而 Confirm 阶段服务器会用相似计数施加真实惩罚，于是“AI 说 low、实际 ×0.4”会产生 UX 矛盾。

处理（Option A，不重做两阶段评估）：

- 保留 schema 字段名 `repetition_risk`（模型输出契约不变），但语义明确为 **AI 估算**
- `prompts.ts` 明确告诉模型：`repetition_risk` 只是基于单条文字的估算，最终惩罚由服务器在 Confirm 时重算
- `XpTransaction` 新增两个**服务器权威字段**：
  - `repetitionCount`（相似行为计数）
  - `repetitionPenalty`（Growth Engine 修正系数）
- 待确认卡片显示“重复风险（AI 估算）”，标注“非最终判定”
- Recent Growth 列表在存在惩罚时显示“重复 ×0.x（第 N 次类似活动，服务器判定）”

## 2. [P2] GitHub Actions CI 尚未建立 → 已补 ✅

新增 `.github/workflows/ci.yml`：

```text
push / PR → checkout → pnpm@11.7.0 → Node 22
→ pnpm install --frozen-lockfile
→ pnpm lint
→ pnpm test
→ pnpm build
```

这样“lint/test/build all green”不再只是本地自报，GitHub 上有独立 status 可验证（审查第 11 点）。

## 3. 其他 P2（本轮不动，明确延后）

| P2 | 处理 |
| --- | --- |
| similarity 仍为粗粒度（同 skill+type 即相似） | 接受为 MVP 近似，Session ontology / embedding 阶段再升级 |
| `Promise.all(syncFn)` 不是真 race test | 文档已明确：单进程同步执行实际串行；跨进程依赖 DB `UNIQUE` |
| migration 尚未执行 | Supabase 接入时执行（属于下一阶段） |

## 验证

```text
pnpm test    → 3 files / 23 tests passed（含 repetitionCount/Penalty 权威字段断言）
pnpm lint    → 0 error / 0 warning
pnpm build   → 成功
```

## 下一阶段（Round2 Gate 通过后的建议顺序）

```text
① Supabase schema + Auth + RLS
② Repository abstraction（demo-db → Repository 接口 → Supabase 实现）
③ XP settlement transaction（UNIQUE assessment_id 真正生效）
④ Activity List
⑤ Activity Detail（完整 XP breakdown，可审计裁判系统）
⑥ Playwright E2E
⑦ 之后继续加强 CI
```
