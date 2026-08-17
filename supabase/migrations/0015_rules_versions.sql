-- 0015_rules_versions.sql
-- 规则版本注册表（全局，不属用户私有）。
-- engine registry（第一次 rules_version bump 前必须实现，Gate 标记）激活时，
-- 每个活跃版本一段 config_json，settlement 据此选取引擎；本迁移只建容器。

create table if not exists public.rules_versions (
    id uuid primary key default gen_random_uuid(),
    version text not null unique,
    status text not null default 'draft'
        check (status in ('draft', 'active', 'archived')),
    config_json jsonb not null default '{}'::jsonb,
    description text,
    activated_at timestamptz
);
