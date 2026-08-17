-- 0014_reviews.sql
-- 周期回顾（growth review / narrative）。

create table if not exists public.reviews (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    review_type text not null
        check (review_type in ('daily', 'weekly', 'monthly', 'chapter')),
    period_start date,
    period_end date,
    summary_json jsonb not null default '{}'::jsonb,
    narrative text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
