-- 0008_evidence_records.sql
-- 证据记录（Evidence ladder 的事实载体：高 Mastery 需要 Evidence）。
-- knowledge_node_id 指向 knowledge_nodes（0012 才建），故此处不加 FK，应用层校验。

create table if not exists public.evidence_records (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    activity_id uuid references public.activities(id) on delete cascade,
    skill_id uuid references public.skills(id) on delete set null,
    knowledge_node_id uuid,
    evidence_level integer not null default 1 check (evidence_level between 0 and 4),
    evidence_type text,
    description text,
    verified boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
