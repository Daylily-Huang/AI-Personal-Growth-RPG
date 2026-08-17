-- 0009_xp_transactions.sql
-- XP 结算账本（append-only）。
-- Round1 审查要求：assessment_id 必须是 UNIQUE，保证一个 assessment 至多产生一笔结算，
-- 从而在数据库层兜底"并发幂等"（两个同时 INSERT 只会成功一个）。
--
-- 说明：本迁移尚未真正执行（Supabase 接入时运行）。字段与 docs/06 数据字典保持一致。

create table if not exists public.xp_transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    activity_id uuid not null,
    quest_id uuid,
    assessment_id uuid not null,
    domain_id uuid,
    skill_id uuid,
    activity_type text,
    -- Round3: sync with domain model —
    repetition_count integer not null default 0,
    repetition_penalty numeric not null default 1,
    -- Round6: DB-level invariant — a typo like 'activty' must never bypass the
    -- partial unique index that guards "one activity settlement".
    xp_type text not null default 'activity'
        check (xp_type in ('activity', 'adjustment', 'correction')),
    amount integer not null,
    base_amount integer not null,
    modifier_json jsonb not null default '{}'::jsonb,
    reason text,
    rules_version text not null,
    created_at timestamptz not null default now(),
    -- 幂等关键约束：一个 assessment 只能结算一次
    constraint xp_transactions_assessment_id_key unique (assessment_id)
);

-- Round5 (Milestone 2.7): 一个 Activity 最多只能有一笔"原始活动 XP 结算"。
-- Assessment revision 可以有很多（重评/编辑），但只有第一笔 activity 结算能落账；
-- adjustment / correction 类型不受此限制（xpath 走另一条 pipeline）。
create unique index xp_transactions_one_activity_settlement_idx
    on public.xp_transactions (activity_id)
    where xp_type = 'activity';

create index if not exists xp_transactions_user_created_at_idx
    on public.xp_transactions (user_id, created_at desc);
