-- 0020_activity_immutability.sql
-- Stage2-A: Activities are facts. Confirmed rows are frozen; raw_input and
-- rules_version are immutable even before confirmation.

create or replace function public.guard_activity_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'confirmed' then
    raise exception 'confirmed activity % is immutable', old.id using errcode = '55000';
  end if;

  if new.raw_input is distinct from old.raw_input
     or new.rules_version is distinct from old.rules_version then
    raise exception 'activity facts raw_input and rules_version are immutable' using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_activity_immutability on public.activities;
create trigger trg_activity_immutability
before update on public.activities
for each row execute function public.guard_activity_immutability();
