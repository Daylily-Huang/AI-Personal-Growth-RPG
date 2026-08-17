-- 0017_rls.sql
-- RLS + 用户引导触发器（M3 Stage1 的"Auth + RLS"落点）。
--
-- 设计意图（对应 Gate："User A 到底能不能看到 User B 的成长记录？"）：
--   1) 所有私有表 enable RLS，且每条策略都是 `auth.uid() = user_id`；
--   2) 插入策略 `with check (user_id = auth.uid())` 防客户端伪造他人 user_id；
--   3) service_role 密钥天然绕过 RLS —— 只允许服务端管理路径使用；
--   4) 注册新 auth user 时自动补 profiles + player_states（handle_new_user）。
--
-- 真实隔离验证（User A 看到不到 User B）属于集成层（两用户各建会话互查），
-- 在接入 SupabaseRepository + 集成测试（含 CI secrets）阶段执行。

-- ============================================================
-- RLS 开启 + 策略：所有用户私有表
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'player_states', 'domains', 'skills', 'quests', 'activities',
    'ai_assessments', 'evidence_records', 'xp_transactions',
    'mastery_verifications', 'mastery_events', 'knowledge_nodes',
    'knowledge_edges', 'artifacts', 'artifact_links', 'reviews'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- 每个私有表四类策略：select/update/delete 用 auth.uid()（using），
-- insert 用 with check (user_id = auth.uid())。DO 块遍历生成。
do $$
declare
  t text;
  p text;
begin
  foreach t in array array[
    'profiles', 'player_states', 'domains', 'skills', 'quests', 'activities',
    'ai_assessments', 'evidence_records', 'xp_transactions',
    'mastery_verifications', 'mastery_events', 'knowledge_nodes',
    'knowledge_edges', 'artifacts', 'artifact_links', 'reviews'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('create policy %I on public.%I for select using (user_id = auth.uid());',
                   t || '_select_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('create policy %I on public.%I for insert with check (user_id = auth.uid());',
                   t || '_insert_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('create policy %I on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid());',
                   t || '_update_own', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for delete using (user_id = auth.uid());',
                   t || '_delete_own', t);
  end loop;
end $$;

-- 全局只读表：任何已认证用户可读（写入交由服务端/seed）。
alter table public.rules_versions enable row level security;
drop policy if exists rules_versions_select_authenticated on public.rules_versions;
create policy rules_versions_select_authenticated on public.rules_versions
  for select to authenticated using (true);

-- ============================================================
-- Auth bootstrap：注册 → 自动补 profiles + player_states
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.player_states (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
