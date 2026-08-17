# ADR-0001 — Milestone 3: Supabase Foundation 承载决策

- 日期：2026-08-17
- 状态：Accepted（Stage1 已实现；Stage2 待 Gate）

## 上下文

Project growth state 目前全部在本地 JSON demo store（DemoRepository）。
Milestone 3 把它搬到 Supabase (PostgreSQL + Auth + RLS)，需要先确立连接与数据层承载决策，
供数据库/RLS Gate Review 审查，再实现 SupabaseRepository + settlement RPC。

## 决策

### 1. 数据模型：事实表与缓存分离

- `activities`（事实）→ `xp_transactions`（账本，append-only）→ `skills`/`player_states` 为缓存。
- `total_xp` / `skill.xp` 是缓存，最终依据永远是账本；cache 只能由权威结算事务写入。

### 2. 身份

- Skill ID = 随机 UUID（运行时 `crypto.randomUUID()`，绝不由名字派生）。
- 所有私有表 `user_id uuid not null references auth.users(id)`。
- 未定 identifier 统一用 `id uuid primary key default gen_random_uuid()`。

### 3. RLS 模式

- 每个私有表 `enable row level security` + 四类策略，键式 `auth.uid()`：
  - select/update/delete：`using (user_id = auth.uid())`
  - insert：`with check (user_id = auth.uid())`（防伪造他人 user_id）
- `rules_versions`（全局）只对 authenticated 开放读。
- service_role 绕过 RLS：只允许 `getSupabaseAdminClient()` 的受信后台路径。

### 4. 客户端分层（Stage1 只建不接业务）

- browser（publishable key）→ server（publishable key + cookies，用户会话）→ admin（secret）。
- 处理当前用户数据一律走 RLS 会话客户端，admin 客户端禁用型、不接浏览器输入。

### 5. 数据库不变量（Review P1，落在 RPC/事务层而非 app 层）

- Mastery **单调**：普通 growth settlement 只允许 `new_mastery = greatest(current, proposed)`，
  永不倒退；真正的降低/纠错走 `correction` event/pipeline（`event_type='correction'`）。
- `xp_transactions.assessment_id UNIQUE`：跨进程并发幂等由 DB 兜底。
- `xp_type CHECK` 与 `(activity_id) WHERE xp_type='activity'` 部分唯一：
  一个 Activity 至多一笔原始结算。
- 一个 Activity 至多一份被确认的 assessment（`(activity_id) WHERE status='confirmed'` 唯一）。
- 每个 skill 至多一个 pending verification。

### 6. Auth bootstrap

- `handle_new_user` 触发器（security definer，`set search_path = public`）：注册即建
  `profiles` + `player_states`。

## 后果

- 正面：多租户隔离可证明（集成测试两用户互查）；并发幂等 DB 兜底；审计/重算有账本。
- 代价：每用户行的写入都要过会话客户端（RLS）；业务代码不能直接写缓存——必须走 RPC 事务。
- 待办：SupabaseRepository（Stage2）、settlement RPC/事务、真实集成测试、supabase CLI 生成
  DB 类型。
