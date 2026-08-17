# Round3 跟进摘要（供 Round4 审查）

对应 `docs/Check/Round3.txt` 结论：**PASS，但有 1 个 P1（接 Supabase 前必须修）**。

## P1 已修：migration 与 domain model 同步 ✅

`supabase/migrations/0009_xp_transactions.sql` 补齐第 2 轮遗漏的两列：

```sql
repetition_count    integer not null default 0,
repetition_penalty  numeric not null default 1,
```

现在三方一致：

```text
TypeScript model      ✅ repetitionCount / repetitionPenalty
Data dictionary       ✅ repetition_count / repetition_penalty
Supabase migration    ✅ repetition_count / repetition_penalty
```

## P2 已按建议处理

- **Recent Growth 始终展示服务器权威重复数据**（不再只在 `penalty < 1` 时显示）：
  - 有惩罚 → `重复 ×0.88（第 1 次类似，服务器判定）`
  - 无惩罚 → `无重复惩罚（第 0 次类似，服务器判定）`
- `repetition_risk` 更名 `estimated_repetition_risk` 记为 schema v2 候选，本轮未改名以免破坏模型兼容。

## Milestone 2.5 — Data Layer Refactor / Repository Abstraction（完成）

目标（Round3 重点）：**业务规则只有一份**，防止“demo-db 一套、supabase 再复制一套”。

```text
                     ┌ DemoRepository (JSON 文件存储)
SettlementService ───┤
  (业务规则唯一副本)   └ SupabaseRepository (下一阶段实现同一 port)

calculateXp() / checkMasteryProposal() / countRecentSimilar()
  只在 SettlementService 中被引用
```

新增/重构文件：

| 文件 | 职责 |
| --- | --- |
| `src/lib/store/types.ts` | 领域模型 + `Db` + `SettlementToApply` |
| `src/lib/store/repository.ts` | **Repository 端口**（读 + 原子 `applySettlement`） |
| `src/lib/store/settlement.service.ts` | **结算业务规则唯一副本** | 
| `src/lib/store/demo-repository.ts` | JSON 文件存储实现 |
| `src/lib/store/dashboard.service.ts` | 读模型组装（不烧进存储层） |
| `src/lib/store/demo-db.ts` | 瘦门面：装配 demo repo + service，兼容导出旧接口 |

关键点：

- `applySettlement` 现在是**唯一落账入口**：内部一次同步读改写（单进程原子）；未来 Supabase 实现时，在同一个方法里做 PostgreSQL transaction + `UNIQUE(assessment_id)`，业务逻辑完全复用。
- `/api/skills` 已改用 Repository port（不再直接摸原始 db）。
- 新增 `tests/settlement-service.test.ts`：直接用 `DemoRepository + SettlementService` 跑结算，锁定“业务逻辑与存储解耦 + 幂等”。

## 验证

```text
pnpm lint   → 0 error / 0 warning
pnpm test   → 4 files / 25 tests passed
pnpm build  → 成功
```

## 下一阶段候选（接 Round3 建议）

```text
① Supabase schema + Auth + RLS        （需要你的 Supabase URL/keys）
② SupabaseRepository 实现同一 Repository port
③ PostgreSQL transactional XP settlement（UNIQUE 生效）
④ Activity List
⑤ Activity Detail / XP Audit
⑥ Playwright 核心 E2E
```
