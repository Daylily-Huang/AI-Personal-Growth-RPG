-- 0012_knowledge_graph.sql
-- 知识图谱：knowledge_nodes + knowledge_edges。

create table if not exists public.knowledge_nodes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    skill_id uuid references public.skills(id) on delete set null,
    domain_id uuid references public.domains(id) on delete set null,
    title text not null,
    description text,
    mastery_level integer not null default 1,
    confidence numeric not null default 0.5,
    status text not null default 'draft'
        check (status in ('draft', 'active', 'archived')),
    last_reviewed_at timestamptz,
    last_used_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_edges (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    source_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
    target_node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
    relation_type text not null,
    confidence numeric not null default 0.5,
    source_type text,
    source_reference text,
    ai_inferred boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists knowledge_edges_user_nodes_idx
    on public.knowledge_edges (user_id, source_node_id, target_node_id);
