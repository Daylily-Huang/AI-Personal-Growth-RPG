-- 0011_mastery_events.sql
-- Mastery 历史（事实表）：每次真正的 Mastery 变化记一条，永久保留（audit / undo / reconciliation）。
-- 与 skills.mastery_level 缓存不同的：这是唯一的"永久能力"变更史。

create table if not exists public.mastery_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    skill_id uuid references public.skills(id) on delete cascade,
    knowledge_node_id uuid,
    activity_id uuid references public.activities(id) on delete set null,
    evidence_id uuid,
    from_level integer not null,
    to_level integer not null,
    confidence numeric,
    event_type text not null default 'upgrade'
        check (event_type in ('upgrade', 'confidence_refresh', 'confidence_decay', 'correction')),
    reason text,
    created_at timestamptz not null default now()
);
