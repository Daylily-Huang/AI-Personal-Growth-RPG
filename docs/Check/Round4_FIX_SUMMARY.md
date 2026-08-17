# Round4 跟进摘要（供 Round5 审查）

对应 `docs/Check/Round4.txt` 结论：**Milestone 2.5 CONDITIONAL PASS，暂不建议直接上 Supabase**——要求先清掉 3 个 P1 + 5 项。

本轮实现 **Milestone 2.6 — Supabase Readiness Hardening**。

## IN SCOPE

- Repository port 全 async 化
- Settlement 事务边界重画（delta 语义，消除 lost update）
- Mastery verification 强制执行（不再被绕过）
- 并发结算一致性测试
- Demo 存储损坏保护（ENOENT / 坏 JSON / 坏形状）
- 普通 Activity 默认 quest_size = standard（cap 120）
- request-scoped repository factory（去全局 singleton）
- Player Level 标记为 Provisional XP Level
- 配套：`0010_mastery_verifications` migration + docs/06 更新

## OUT OF SCOPE

- Supabase / Auth / RLS / 后端代码本身（等 Round5 放行）
- Growth Constitution / XP 哲学 / Mastery 定义 / Evidence 阶梯（未改）
- Quest / Knowledge / Artifact 玩法
- `repetition_risk` 更名（保持 schema v2 候选）

---

## 一、P1 — Repository port 全面 async（提前一刀）

`repository.ts` 从第一天就是 **async port**：

```ts
interface Repository {
  getActivity(id): Promise<Activity | null>;
  listTransactions(): Promise<XpTransaction[]>;
  getPlayer(): Promise<PlayerState>;
  applySettlement(s): Promise<SettlementResult>;
  // ...全部 Promise
}
```

- `SettlementService.confirmAssessment` → `async`
- `DemoRepository` 内部仍是同步文件 IO（单进程内仍原子）
- `DashboardService.buildDashboardSnapshot` → async
- 所有 API route 改走 `getRepository()` / `getSettlementService()` 工厂并 `await`
- 未来 `SupabaseRepository` 直接 `await supabase...`，Service 与 route 零改动

## 二、P1 — 事务边界重画（delta 语义，消灭 lost update）

**问题**：旧模式是 Service 在外面读绝对状态 → 算绝对值 → 存整份覆盖。并发两次结算会互相覆盖（last-write-wins，丢更新）。

**新语义**：`SettlementToApply` 只携带 **增量**，存储端在自己的原子写内做 `current += delta`：

```ts
SettlementToApply {
  transaction,            // 权威 ledger 行
  xpDelta,                // = amount
  primarySkill { name, xpDelta, masteryAction },
  relatedSkillNames, newEdges,
  player { xpDelta },
  masteryVerification?,   // 需要验证时
}
```

- Demo 端：单次同步 `read → current += delta → write`
- 派生等级（player level / skill level）由存储端在 `+=` 之后**重算**（`levelFromXp`），并发结算会收敛到真实终值，而不是各自基于旧快照互相覆盖
- Supabase 端将来实现：同一个方法里做 PostgreSQL 事务 / `update ... set total_xp = total_xp + $delta`

**新测试 `tests/concurrency.test.ts`**（审阅点原话转测试）：

```text
初始 player.total_xp = 100
并发结算 A(+20) + B(+30)
断言：
  ledger sum        = 50
  player.total_xp   = 150（不是 100 + 最后写入者）
  skill.xp 之和     = ledger sum
  每个 skill.xp     == 自己的 ledger 条目
```

## 三、P1 — Mastery verification 不再被绕过

之前 `settlement` 只看 `allowed`，把 `verificationRequired` 的升级照样授予了——违反“高阶 Mastery 必须有验证”。

现在：

```text
checkMasteryProposal(false)        → 不授予（log 原因）
proposed <= current                → 不授予
allowed && !verificationRequired   → 授予（skill.mastery 更新 + confidence）
allowed && verificationRequired    → 不授予，只创建 Pending MasteryVerification
```

新增领域实体 `MasteryVerification`（

```
id, skillName, fromLevel, toLevel, evidenceLevel,
status: pending|verified|rejected, proposalAssessmentId, createdAt, resolvedAt
```

）+ `Db.masteryVerifications` + `Repository.listMasteryVerifications()` + migration `0010_mastery_verifications.sql`。

Dashboard 新增 **“Mastery 待验证”** 区块展示 pending 记录（显示“尚未授予”）。

**测试**：`confirm.test.ts` 新增“M1→M5 + E4 → 仍为 M1 + 产生 pending”；`settlement-service.test.ts` 同场景在 service 级复验。

## 四、P2 — Demo 存储损坏保护

`DemoRepository.readDb()`：

```text
文件不存在 (ENOENT) → 返回空世界（fresh world）
JSON 解析失败       → 备份为 demo.json.corrupt-<ts>，抛错，绝不覆盖原文件
形状非法            → 同上（备份 + 抛错）
旧版 v1 文件        → 兼容（缺 masteryVerifications 自动补空数组）
```

`tests/demo-repository.test.ts`（4 条）全部覆盖：缺失/坏 JSON/坏形状/ v1 兼容。

## 五、quest_size 默认 standard

`SettlementService.confirmAssessment` 的 `XpInput` 固定 `questSize: DEFAULT_QUEST_SIZE = "standard"`（cap 120），直到接入 Quest 绑定。

## 六、request-scoped repository factory

`demo-db.ts` 重构成组合根：

```ts
export function getRepository(): Repository { return new DemoRepository(); }
export function getSettlementService(): SettlementService { return new SettlementService(getRepository()); }
```

- **不再把业务规则放进仓库，也不再有全局 singleton**
- 所有 route 从工厂解析；测试也可以直接 `new DemoRepository()`
- Supabase 接入时工厂内换成 request-scoped client，调用方不动

## 七、Player Level → Provisional

- UI：`Lv.{n}` → `XP Lv.{n}` + `Provisional XP Level` 徽标（玩家与技能统一）
- docs/06：`player_level` 明确标注为 Provisional（由 XP 曲线导出），正式 Player Level 属 Domain 系统待定义

## 文件清单

```text
src/lib/store/types.ts                # 领域模型 + MasteryVerification + delta SettlementToApply
src/lib/store/repository.ts           # async Repository port
src/lib/store/settlement.service.ts   # 业务规则唯一副本（delta + mastery verification）
src/lib/store/demo-repository.ts      # JSON 实现（async 包装 + 损坏保护 + delta 落账）
src/lib/store/dashboard.service.ts    # async 读模型（含 pending verifications）
src/lib/store/demo-db.ts              # 组合根 / request-scoped factory / 兼容导出
src/app/dashboard/page.tsx            # Provisional XP Level + Mastery 待验证区块
src/app/api/*/route.ts                # 全部走工厂 + await
supabase/migrations/0010_mastery_verifications.sql
tests/confirm.test.ts                 # async + Mastery verification 用例（7）
tests/settlement-service.test.ts      # async + service 级 verification/delta（4）
tests/concurrency.test.ts             # 并发一致性（NEW，1）
tests/demo-repository.test.ts         # 损坏保护（NEW，4）
docs/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md
docs/Check/Round4_FIX_SUMMARY.md      # 本文件
```

> 附：用户把 `docs/` 下设计文档整理进了 `docs/Design ChatGPT/`（含 01–10/ADR/HARNESS），本次提交一并反映该移动。

## 验证

```text
pnpm lint                → 0 error / 0 warning
pnpm test                → 6 files / 34 tests passed
pnpm harness:deterministic → 11 tests passed
pnpm build               → 成功
live smoke (dev 3100)    → 全链路：QuickLog → Assess(E2/M4) → Confirm(xp 17)
                          + pending MasteryVerification 落库 + Dashboard/Skills 正常
```

## 下一步（接 Round5 放行后）

```text
Supabase 项目接入（URL/anon/service-role）
→ SupabaseRepository 实现同一 async port + RLS
→ PostgreSQL transactional settlement（UNIQUE assessment_id + total_xp 原子自增）
→ Mastery 验证实际的 verified/rejected 流程
```
