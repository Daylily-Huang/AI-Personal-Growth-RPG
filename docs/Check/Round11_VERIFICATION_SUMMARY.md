# Round11 Verification Summary

- 项目：AI Personal Growth RPG
- 审查轮次：Round11
- 本轮范围：Round11 审查结论 + Stage2-A 实施与验证
- 日期：2026-08-19

## 一、Round11 审查结论

Round11 针对远程提交 `d532e1b`（Round10 Stage1 verification baseline）完成复核，结论为：

```text
Stage1: PASS
Score: 9.2 / 10
P0: 0
Decision: GO TO STAGE2
```

Round11 要求停止继续扩展 Stage1，并将 Stage2 拆分为两个可审查阶段：

- Stage2-A：SupabaseRepository、Auth request wiring、generated DB types、Activity immutability、基础 read/write mapping。
- Stage2-B：`settle_activity` SECURITY DEFINER RPC、事务、幂等、repetition snapshot、Mastery、并发和双用户 RLS 隔离。

## 二、本轮 Stage2-A 完成内容

### 1. Supabase 数据类型与映射

新增：

```text
src/lib/supabase/database.types.ts
src/lib/store/supabase-mapping.ts
```

覆盖核心 Growth Loop 的数据库行到领域对象映射：

- `activities` → `Activity`
- `ai_assessments` → `Assessment`
- `xp_transactions` → `XpTransaction`
- `skills` → `SkillState`
- `player_states` → `PlayerState`
- `mastery_verifications` → `MasteryVerification`

映射保留：

- Activity 的 `raw_input`、`rules_version`、状态和时间字段；
- Assessment 的 `assessment_json` Proposal；
- Skill 的稳定 UUID 身份；
- XP Ledger 的 `xp_type`、repetition、rules version 和 modifier JSON。

### 2. RLS 用户域 SupabaseRepository

新增：

```text
src/lib/store/supabase-repository.ts
```

实现：

- 用户范围 Activity/Assessment/XP/Skill/Player/Mastery 查询；
- Activity 创建；
- Assessment 创建；
- Activity 与 Assessment 写入均显式绑定当前 `userId`；
- 只做数据访问和映射，不在 Repository 中复制成长规则。

`applySettlement` 暂未实现为普通 Data API 写入，明确保留给 Stage2-B 的权威数据库 RPC，避免客户端绕过结算权威链路。

### 3. Request-scoped Auth wiring

新增：

```text
src/lib/store/request-repository.ts
```

实现：

- 每个请求创建新的 Supabase Server Client；
- 使用 `auth.getUser()` 获取当前会话用户；
- 没有有效用户时抛出 `auth_required`；
- 不缓存跨请求用户或 Supabase Client。

当前网站默认 API 仍使用 `DemoRepository`，因此没有登录 UI 时不会被强行切换为 401。真实业务路由切换将在 Auth UI 和 Stage2-B 结算 RPC 完成后进行。

### 4. Activity 不可变迁移

新增：

```text
supabase/migrations/0020_activity_immutability.sql
```

保护规则：

- confirmed Activity 禁止任何 UPDATE；
- `raw_input` 不可修改；
- `rules_version` 不可修改；
- 触发器函数固定 `search_path = public`；
- 后续更正应走独立 correction pipeline，而不是直接修改事实记录。

## 三、网站启动修复

发现 Windows 使用了 WSL/Linux `node_modules`，导致 Next 缺少 Windows SWC，服务虽然显示 Ready，但请求无法正常响应。

已完成：

- 将原 WSL/Linux 依赖备份到 `D:\AI_Personal_Growth_RPG-wsl-node_modules-backup`；
- 重新安装 Windows 依赖；
- 补齐 `@next/swc-win32-x64-msvc`；
- 移除 `next/font/google` 外部字体下载依赖；
- 改用本地系统字体；
- 修正 Next 启动参数。

验证结果：

```text
GET /                 307 -> /dashboard
GET /dashboard        200
GET /api/dashboard    200
Next production build PASS
```

## 四、验证结果

| 验证项 | 结果 |
|---|---:|
| TypeScript | PASS |
| ESLint | PASS |
| 完整 Vitest | 87 passed / 1 skipped |
| deterministic harness | 11 passed |
| 新增 Stage2-A 测试 | PASS |
| 本地 Supabase 空库迁移冒烟 | PASS |
| Next production build | PASS |
| Dashboard/API | PASS |

完整测试中的唯一 skipped 项为未设置数据库 URL 时的 gated migration smoke；本轮另行使用本地数据库执行，结果为 1 passed。

## 五、迁移幂等修复

验证过程中发现并修复：

- `0009_xp_transactions.sql` 唯一索引缺少 `if not exists`；
- `0010_mastery_verifications.sql` 唯一索引缺少 `if not exists`；
- `0018_authority_rls_matrix.sql` 未清理同名新策略，导致重复执行迁移时报 policy already exists；
- 迁移链静态测试未包含新加入的 0020，已补齐。

## 六、当前未完成范围

以下内容仍属于 Stage2-B，未在本轮伪实现：

- `settle_activity` SECURITY DEFINER RPC；
- 从 `auth.uid()` 推导 ownership 的数据库事务；
- XP Ledger、Player、Skill 的原子 delta 结算；
- 服务端 repetition snapshot；
- assessment/activity 幂等结算；
- Mastery 单调增长与 pending verification；
- composite tenant FK；
- 双用户 RLS 隔离集成测试；
- 并发 Confirm 测试。

## 七、本轮提交

本地 Stage2-A 提交：

```text
c882d91 feat(stage2): add Supabase repository wiring
```

本摘要补齐后将与该提交一起推送到远程 `main`，并在推送后核验远程 commit。
