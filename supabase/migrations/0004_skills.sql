-- 0004_skills.sql
-- 技能。id 是永久身份（运行时 crypto.randomUUID，绝不由名字派生）；name 只是显示名。
-- 查找走 normalized label（大小写+空白不敏感）；验重/结算一律引用 skill_id。

create table if not exists public.skills (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    domain_id uuid references public.domains(id) on delete set null,
    name text not null,
    aliases text[] not null default '{}',
    description text,
    level integer not null default 1,
    xp numeric not null default 0,
    mastery_level integer not null default 1 check (mastery_level between 0 and 10),
    mastery_confidence numeric not null default 0.5,
    status text not null default 'active' check (status in ('active', 'archived')),
    last_used_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
