# 调查发现

## 当前状态
- Round10 Stage1 Gate 已完成：本地 Supabase 迁移、独立空库 smoke、完整测试、deterministic harness、lint、build 均通过；工作区改动尚未提交/推送。
- 当前代码仍由 `DemoRepository` 提供运行时数据；`src/lib/supabase/index.ts` 已预留 Stage2 wiring point。
- 不能在未确认设计前直接修改业务代码；本轮先完成 Stage2 设计评审。

## 证据
- `docs/Check/Round10.txt` 的原始结论为 `8.8/10 CONDITIONAL NO-GO`；后续 `docs/Check/Round10_VERIFICATION_SUMMARY.md` 记录 Gate 已通过，状态可推进 Stage2。
- Stage2 目标明确为：`SupabaseRepository`、`settle_activity` `SECURITY DEFINER` RPC、从 `auth.uid()` 推导 ownership、原子结算、幂等、Activity confirmed/frozen 不可篡改、双用户 RLS 隔离与并发测试。
- `Repository.applySettlement` 已定义 delta 语义、重复结算返回冲突、服务端重算 repetition snapshot、至少一个 pending MasteryVerification 等契约；Supabase 实现必须把这些保证放进 RPC/数据库事务，而不是复制到浏览器。
- `activities`、`ai_assessments`、`xp_transactions`、`skills`、`player_states` 均已有 `user_id`；但 `xp_transactions` 的 activity/assessment/skill 外键在 `0019` 才补齐，tenant 复合外键和结算 RPC仍未实现。
- `src/lib/supabase/index.ts` 明确当前仍运行 `DemoRepository`，只预留 Stage2 统一 wiring point。
- Git 工作区有未跟踪 `docs/Check/Round10.txt`，不应擅自纳入本轮提交。
- 当前不改 UI；先以最小后端垂直切片完成权威结算和运行时隔离，再接线前端。
