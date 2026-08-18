-- 0019_schema_integrity.sql
-- M3 Stage1.1 (Round8 P1 fixes): reference integrity + skill identity.
--
-- 1) Evidence range: DB CHECK must equal the AI schema / Growth Engine range
--    (E0..E6). 0008 was already edited to `between 0 and 6`; this block makes the
--    fix robust for any DB where 0008 may have already been applied as 0..4
--    (drop the existing column CHECK, re-add the correct one).
-- 2) xp_transactions foreign keys (core Growth Loop tenant integrity):
--    activity_id → activities, assessment_id → ai_assessments, skill_id → skills.
--    (assessment→activity, activity→quest, mastery_verification→skill already exist.)
-- 3) Skill normalized identity: normalized_name + unique(user_id, normalized_name)
--    + BEFORE trigger, so concurrent settlements cannot create two Skill rows for
--    the same concept ("Statistics" / "统计学" / "统计"), which would corrupt the
--    repetition skillId that the Growth Engine relies on.

-- ============================================================
-- 1) Evidence level range → E0..E6 (idempotent, applied-DB safe)
-- ============================================================
do $$
declare
  con text;
begin
  select tc.constraint_name into con
  from information_schema.constraint_column_usage ccu
  join information_schema.table_constraints tc
    on tc.constraint_name = ccu.constraint_name
   and tc.table_schema = ccu.table_schema
  where tc.table_name = 'evidence_records'
    and tc.table_schema = 'public'
    and ccu.column_name = 'evidence_level'
    and tc.constraint_type = 'CHECK';
  if found then
    execute format('alter table public.evidence_records drop constraint %I', con);
  end if;
end $$;

alter table public.evidence_records
  add constraint if not exists evidence_records_evidence_level_check
  check (evidence_level between 0 and 6);

-- ============================================================
-- 2) xp_transactions → core Growth Loop foreign keys
-- ============================================================
alter table public.xp_transactions
  add constraint if not exists fk_xp_transactions_activity
    foreign key (activity_id) references public.activities(id),
  add constraint if not exists fk_xp_transactions_assessment
    foreign key (assessment_id) references public.ai_assessments(id),
  add constraint if not exists fk_xp_transactions_skill
    foreign key (skill_id) references public.skills(id);

-- ============================================================
-- 3) Skill normalized identity (concurrency-safe dedupe)
-- ============================================================
alter table public.skills add column if not exists normalized_name text;

-- backfill (no-op on empty bootstrap)
update public.skills
  set normalized_name = regexp_replace(lower(btrim(coalesce(name, ''))), '\s+', ' ', 'g')
  where normalized_name is null or normalized_name = '';

alter table public.skills alter column normalized_name set not null;

alter table public.skills
  add constraint if not exists skills_user_normalized_unique
  unique (user_id, normalized_name);

create or replace function public.skills_normalize_name()
returns trigger
language plpgsql
as $$
begin
  new.normalized_name = regexp_replace(lower(btrim(coalesce(new.name, ''))), '\s+', ' ', 'g');
  return new;
end;
$$;

drop trigger if exists trg_skills_normalize on public.skills;
create trigger trg_skills_normalize
  before insert or update on public.skills
  for each row execute function public.skills_normalize_name();
