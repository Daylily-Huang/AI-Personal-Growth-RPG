-- 0003_domains.sql
-- 域：支持层级（Research └── Molecular Ecology）。

create table if not exists public.domains (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    slug text not null,
    description text,
    parent_id uuid references public.domains(id) on delete set null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, slug)
);
