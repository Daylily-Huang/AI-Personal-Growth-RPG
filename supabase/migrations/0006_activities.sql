-- 0006_activities.sql
-- 现实事实记录。一个 Activity 可有多个 revision（ai_assessments），但只有一笔原始
-- activity XP 结算（见 0009 部分唯一索引）。rules_version 创建时冻结。

create table if not exists public.activities (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    quest_id uuid references public.quests(id) on delete set null,
    title text not null,
    raw_input text not null,          -- 永远保留原始输入（事实）
    activity_type text,
    status text not null default 'pending_assessment'
        check (status in ('pending_assessment', 'assessed', 'confirmed')),
    started_at timestamptz,
    ended_at timestamptz,
    total_minutes integer,
    effective_minutes integer,
    completion numeric,
    rules_version text not null,      -- Round5：创建时冻结
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
