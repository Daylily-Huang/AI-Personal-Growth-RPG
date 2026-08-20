# Round14 Verification Summary

> 项目：AI Personal Growth RPG
> 日期：2026-08-20
> 对应审查：`docs/Check/Round14.txt`
> 前置提交：`4fc2d46 fix(round13): final authority closure (Stage2-A.2)`

## 1. 审查基线

Round14 对远程 `main`（`4fc2d46`）的审查结论：

- 评分：8.6 / 10
- 状态：CONDITIONAL FAIL
- P0：0
- P1：2
- P2：3
- **Gate：NO-GO → 完整 Stage2-B**，必须先完成 Stage2-A.3 Authority Final-Final Closure（只修两个 P1）

审查确认 Round13 的三个 P1 已真正关闭（activities 直写旁路封死、generated types 含双 RPC 且客户端泛型化、Supabase Assessment 写入路径真实接线），但新实现暴露出两个新的 authority 问题：

1. **P1-1**：`create_activity` 的 `rules_version` 选择错误——无 `status='active'` 过滤（可选中 draft）、`order by version desc` 是文本字符串排序（v9/v10 会错序）、注册表为空时 `coalesce('v1')` 兜底导致与 Growth Engine 实际声明的 `RULES_VERSION='growth-engine-v0.1'` 漂移，审计字段不可信。
2. **P1-2**：`getRequestRepository()` 是 fail-open——Supabase 已配置但 session 缺失 / auth 异常时静默降级到 DemoRepository 且路由仍返回 201，造成双 source of truth。

## 2. 本轮实现（Stage2-A.3）

### 2.1 P1-1：`rules_version` 权威修复（0023）

新增 `supabase/migrations/0023_rules_version_authority.sql`：

- **至多一个 active 版本**：部分唯一索引 `rules_versions_one_active`（`where status = 'active'`），数据库层强制不变量。
- **Seed**：注册 `growth-engine-v0.1 = active`（幂等，仅当版本行不存在时插入），与 `src/lib/growth-engine/xp.ts` 的 `RULES_VERSION` 一致，新库不再空 registry。
- **create_activity 重写**（签名不变，`create or replace`）：
  ```sql
  select version into v_rules_version
    from public.rules_versions
   where status = 'active'
   order by activated_at desc nulls last
   limit 1;
  if v_rules_version is null then
    raise exception 'no_active_rules_version';
  end if;
  ```
  - active-only（不选 draft）；
  - 按 `activated_at desc`（不按文本 version 字符串排序）；
  - **fail-closed**：无 active 版本直接抛 `no_active_rules_version`，删除 `coalesce('v1')` 兜底。
- 权限面不变：仅 `authenticated` 可 EXECUTE，撤销 `anon`/`public`。

### 2.2 P1-2：`getRequestRepository()` 改为 fail-closed

`src/lib/store/request-repository.ts`：

```ts
export async function getRequestRepository(): Promise<Repository> {
  if (!isSupabaseConfigured()) return new DemoRepository();
  return getAuthenticatedRepository(); // 不再 try/catch 降级 Demo
}
```

- 未配置 Supabase → Demo mode（本地无登录 UI 可运行）；
- 已配置 Supabase → 必须走 authenticated Supabase 路径；
  - 无会话 → `AuthRequiredError` → 路由 **401**；
  - auth 基础设施异常 → 抛错 → 路由 **5xx**；
  - **禁止** catch-all 后静默降级 Demo。

两个 API 路由（`POST /api/activities`、`POST /api/activities/[id]/assess`）增加 `AuthRequiredError` → 401 映射。

### 2.3 测试

- `tests/authority-final-state.test.ts`（真实 PostgreSQL，新增 2 项断言）：
  - active=`growth-engine-v0.1`、draft=`growth-engine-v999`（文本排序会胜出的版本）与 `growth-engine-v0.2` 并存 → `create_activity` 仍冻结 `growth-engine-v0.1`；
  - 全部版本非 active → `create_activity` 抛 `no_active_rules_version`（fail-closed）。
  - 同时把原 "create_activity 强制 pending_assessment" 断言收紧为 `rules_version === 'growth-engine-v0.1'`。
- `tests/request-repository.test.ts`（新增，3 项）：
  - Supabase 未配置 → `DemoRepository`；
  - Supabase 已配置 + 无会话 → `AuthRequiredError`（不降级 Demo）；
  - Supabase 已配置 + auth 基础设施异常 → 抛错（不降级 Demo）。
- `tests/supabase-schema.test.ts`：`EXPECTED_ORDER` 追加 `0023_rules_version_authority`。
- `tests/empty-db-migration.smoke.test.ts`：迁移链注释 0001..0022 → 0001..0023。

## 3. 验证结果

### 3.1 数据库迁移

```text
supabase db reset --yes → 0001..0023 全部成功（含 0023 seed：growth-engine-v0.1=active）
```

### 3.2 完整验证

| 套件 | 结果 |
|---|---:|
| TypeScript（tsc --noEmit） | 通过 |
| 完整 Vitest（含真实 pg 权限终态 + resolver fail-closed） | **102 passed** |
| deterministic harness | 11 passed |
| ESLint | 0 errors（1 个既有无关 warning：supabase-repository.ts:112 `_settlement`） |
| Windows production build | 通过 |

### 3.3 Round14 两项 P1 行为验证

| 断言 | 结果 |
|---|---|
| create_activity 冻结 ACTIVE 版本（忽略 draft、不受文本排序影响） | 通过 |
| 无 active 版本时 create_activity fail-closed（抛 no_active_rules_version） | 通过 |
| Supabase 未配置 → Demo mode | 通过 |
| Supabase 已配置 + 无会话 → AuthRequiredError（401 语义） | 通过 |
| Supabase 已配置 + auth 基础设施异常 → 抛错（5xx 语义） | 通过 |

## 4. 结论

Round14 的两个 P1 已按 Stage2-A.3 方案关闭并通过真实数据库与测试验证：
- `rules_version` 现在只可能是唯一的 ACTIVE 版本（数据库层强制），无 active 时创建活动失败关闭，审计字段重新可信，为 Stage2-B 的永久 XP ledger 依赖做好准备；
- 写入路径在 Supabase 已配置时 fail-closed：未认证 401、基础设施异常 5xx，不再有静默 Demo 双写。

按审查建议，**达到 GO → 完整 Stage2-B（settle_activity）门槛**。

### 残留项（P2，按审查建议留待 Stage2-B）
- P2-1：`create_activity` 参数面偏宽——`p_quest_id` 的 tenant 校验（composite tenant FK）、`p_activity_type` 若为 AI-derived 应移出创建参数。
- P2-2：HTTP 级 wiring 集成测试（本轮以 resolver 单元测试覆盖 fail-closed 行为，HTTP 层 401/5xx 语义依赖路由映射验证）。
- P2-3：`skill_name_snapshot`（结算时快照 skill 名）。
