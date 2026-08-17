-- 0001_profiles.sql
-- 玩家基本设置（1:1 与 auth.users）。
-- M3 Stage1：所有"私有"表统一带 user_id 并走 RLS（见 0017_rls）。
-- handle_new_user 触发器在 0017 创建：注册 auth user 时自动补 profiles + player_states。

create table if not exists public.profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    timezone text not null default 'Asia/Shanghai',
    onboarding_completed boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
