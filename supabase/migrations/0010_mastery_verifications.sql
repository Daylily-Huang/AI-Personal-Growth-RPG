-- 0010_mastery_verifications.sql
-- Mastery 验证请求（Round4 P1：verification-required 的升级不得自动授予）。
-- 一个 proposal 若升级需要验证，则只产生 pending 记录；skill.mastery 不变，
-- 直到该记录被 verified 才会真正授予。
--
-- 说明：本迁移尚未真正执行（Supabase 接入时按 docs/06 顺序运行）。

create table if not exists public.mastery_verifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    skill_id uuid,
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
