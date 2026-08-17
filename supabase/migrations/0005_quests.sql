-- 0005_quests.sql
-- 任务。quest_size 对齐 Growth Engine 的 QuestSize（micro/minor/standard/major/epic/main）。

create table if not exists public.quests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    parent_quest_id uuid references public.quests(id) on delete set null,
    title text not null,
    description text,
    quest_type text not null
        check (quest_type in ('learning', 'skill', 'production', 'physical', 'maintenance', 'reflection')),
    quest_size text
        check (quest_size in ('micro', 'minor', 'standard', 'major', 'epic', 'main')),
    status text not null default 'available'
        check (status in ('locked', 'available', 'active', 'paused', 'completed', 'failed', 'archived')),
    difficulty numeric not null default 0.5,
    goal_alignment numeric not null default 0.5,
    progress numeric not null default 0,
    deadline timestamptz,
    is_main_quest boolean not null default false,
    is_boss boolean not null default false,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
