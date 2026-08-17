-- 0002_player_states.sql
-- 玩家当前缓存与临时状态（注意：total_xp 是缓存，最终依据是 xp_transactions 账本）。
-- 暂把 player_level 当作 Provisional XP Level（由 levelFromXp 导出；正式 Player Level 属 Domain 系统）。

create table if not exists public.player_states (
    user_id uuid primary key references auth.users(id) on delete cascade,
    player_level integer not null default 1,
    total_xp numeric not null default 0,
    energy numeric not null default 70,
    focus numeric not null default 70,
    momentum numeric not null default 30,
    stress numeric not null default 0,
    updated_at timestamptz not null default now()
);
