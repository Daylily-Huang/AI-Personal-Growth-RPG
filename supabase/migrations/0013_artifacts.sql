-- 0013_artifacts.sql
-- 产出物 + 产出物与任意实体的多态关联（应用层校验 entity_type/entity_id，见 docs/06 §17）。

create table if not exists public.artifacts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    artifact_type text,
    description text,
    version text,
    storage_path text,
    external_url text,
    reusability_score numeric not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.artifact_links (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    artifact_id uuid not null references public.artifacts(id) on delete cascade,
    entity_type text not null,
    entity_id uuid not null,
    relation_type text,
    created_at timestamptz not null default now(),
    unique (artifact_id, entity_type, entity_id, relation_type)
);
