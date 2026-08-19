# Round12 Verification Summary

> 项目：AI Personal Growth RPG  
> 日期：2026-08-19  
> 对应审查：`docs/Check/Round12.txt`

## 1. 审查基线

Round12 对 Stage2-A 的审查结论为：

- 评分：7.9 / 10
- 状态：CONDITIONAL FAIL
- P0：0
- P1：3

审查指出的 P1：

1. `SupabaseRepository.addAssessment()` 使用 authenticated client 直接 INSERT `ai_assessments`，与 RLS 冲突；
2. authenticated 用户仍可直接修改 Activity `status`；
3. `database.types.ts` 是手写 mini schema，不是真实 generated types。

另有 P2：交易记录的 `skillName` 映射为空，以及 `player_states` 缺行时静默返回默认玩家。

本轮按审查意见实施 Stage2-A.1 Authority Wiring Closure，暂不进入完整 Stage2-B settlement RPC。

## 2. 本轮实现

### 2.1 Assessment 可信持久化

新增：

- `supabase/migrations/0021_assessment_authority.sql`
- `src/lib/store/assessment-persistence.service.ts`
- `tests/assessment-authority.test.ts`

实现内容：

- 新增 `record_ai_assessment` `SECURITY DEFINER` 函数；
- 固定 `search_path = public`；
- authenticated、anon、public 均无 EXECUTE 权限，仅 `service_role` 可调用；
- RPC 在事务内锁定并校验 Activity 所属关系；
- 从 Activity 读取可信 `rules_version`；
- 原子写入 Assessment，并将 Activity 从 `pending_assessment` 转为 `assessed`；
- `SupabaseRepository.addAssessment()` 不再通过普通用户客户端直接写入。

### 2.2 Activity 状态权限收紧

`0021_assessment_authority.sql`：

- 删除客户端 `activities_update` 策略；
- 删除原有 unrestricted `activities_delete` 策略；
- 仅允许用户删除 `pending_assessment` Activity；
- 客户端不能伪造 `assessed`、`confirmed` 或回退状态。

### 2.3 真实 Database types

使用本地 Supabase CLI 生成：

```text
supabase gen types typescript --local
```

更新：

```text
src/lib/supabase/database.types.ts
```

并新增 `package.json` 脚本：

```text
pnpm db:types
```

类型覆盖真实 Schema 中的完整字段和表关系，包括：

- `activities.started_at / ended_at / completion`
- `skills.domain_id / description`
- `xp_transactions.quest_id / domain_id`
- `player_states.stress`
- RPC `record_ai_assessment`

### 2.4 映射和完整性修复

- `xp_transactions` 查询关联 `skills`，正确填充 `skillName`；
- 缺失 `skill_id` 或 Skill 关联名称时显式报错；
- `player_states` 缺行时抛出 invariant error，不再伪装为默认 Lv1 玩家。

### 2.5 迁移幂等修复

真实迁移重放测试首次发现：

```text
policy "activities_delete_pending" already exists
```

已在 0021 增加：

```sql
drop policy if exists activities_delete_pending on public.activities;
```

修复后迁移重放通过。

## 3. 验证结果

### 3.1 数据库迁移

使用 Docker Desktop 本地 Supabase：

```text
supabase db reset --yes
```

结果：

```text
0001 → 0021 全部迁移成功
```

### 3.2 单元与迁移测试

```text
3 个测试文件通过
6 个测试通过
```

覆盖：

- 空库迁移 smoke；
- Assessment authority 静态约束；
- Supabase mapping。

### 3.3 真实 PostgreSQL 权限行为

已使用本地 PostgreSQL 模拟 authenticated 与 service_role：

| 场景 | 结果 |
|---|---|
| authenticated 直接 INSERT `ai_assessments` | 拒绝，符合预期 |
| authenticated 修改 Activity `status` | 拒绝，符合预期 |
| service_role 调用 `record_ai_assessment` | 成功 |
| Assessment 插入与 Activity 状态转移 | 原子完成 |
| `pending_assessment → assessed` | 成功 |

### 3.4 全量工程验证

| 验证项 | 结果 |
|---|---:|
| 完整 Vitest | 89 passed / 1 skipped |
| deterministic harness | 11 passed |
| TypeScript | 通过 |
| ESLint | 通过 |
| Windows production build | 通过 |

仅保留 Vite `configLoader: native` 的未来兼容性 warning，不影响验证结果。

## 4. 本轮边界与未完成项

本摘要只覆盖 Round12 要求的 Stage2-A.1，不代表完整 Stage2 已完成。

仍待 Stage2-B：

- `settle_activity` 权威结算 RPC；
- XP ledger、Player、Skill 的原子增量结算；
- 幂等 Confirm；
- repetition snapshot 冲突；
- Mastery 单调增长和 pending verification；
- composite tenant FK；
- 双用户 RLS 隔离测试；
- 并发结算测试。

## 5. 结论

Round12 指出的 Stage2-A.1 三个 P1 和相关 P2 已完成修复，并通过本地 Supabase 迁移、真实权限行为和全量工程验证。

本轮可提交并进入远程审查；下一阶段仍应从 Stage2-B 开始，不应把 Stage2-B 未完成部分宣称为本轮完成。
