-- 0007_ai_assessments.sql
-- AI 判断（Proposal 历史，事实照录，永久保留用于审计）。
-- 规则：LLM 只产生 Proposal；永久成长状态由应用代码在结算事务里提交（不变量）。

create table if not exists public.ai_assessments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    activity_id uuid not null references public.activities(id) on delete cascade,
    rules_version text not null,      -- 继承 Activity 创建时冻结的版本（应用层写入）
    prompt_version text,
    model_name text,
    assessment_json jsonb not null,
    confidence numeric,
    status text not null default 'pending'
        check (status in ('pending', 'confirmed', 'edited', 'rejected', 'superseded')),
    confirmed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Round6：一个 Activity 至多一份被确认的 assessment（对应"一笔原始结算"）。
-- superseded / rejected / edited 的 revision 不占此位。
create unique index if not exists ai_assessments_one_confirmed_idx
    on public.ai_assessments (activity_id)
    where status = 'confirmed';
