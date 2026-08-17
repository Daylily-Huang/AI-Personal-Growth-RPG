-- 0010_mastery_verifications.sql
-- Mastery 验证请求（Round4 P1：verification-required 的升级不得自动授予）。
-- 一个 proposal 若升级需要验证，则只产生 pending 记录；skill.mastery 不变，
-- 直到该记录被 verified 才会真正授予。
--
-- 说明：本迁移尚未真正执行（Supabase 接入时按 docs/06 顺序运行）。

create table if not exists public.mastery_verifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    -- Round5: 一个验证必须绑定真实存在的 skill（不可依赖 NULL + UNIQUE 的坑）
    skill_id uuid not null references skills(id),
    skill_name text not null,
    from_level integer not null,
    to_level integer not null,
    evidence_level integer not null,
    status text not null default 'pending'
        check (status in ('pending', 'verified', 'rejected')),
    proposal_assessment_id uuid references ai_assessments(id),
    created_at timestamptz not null default now(),
    resolved_at timestamptz
);

create index if not exists mastery_verifications_user_status_idx
    on public.mastery_verifications (user_id, status);

-- Round5: 每个 skill 至多一个 pending 验证（防止重复排队）。
-- 需要 skill_id not null + 排除 NULL 的唯一索引（部分索引只约束 pending 行）。
create unique index mastery_verifications_one_pending_idx
    on public.mastery_verifications (user_id, skill_id)
    where status = 'pending';
