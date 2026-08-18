-- 0018_authority_rls_matrix.sql
-- M3 Stage1.1 (Round8 P0 fix): replace the blanket 4-policy RLS from 0017 with a
-- table-specific AUTHORITY MATRIX.
--
-- Why this matters (Round8 Gate — CONDITIONAL FAIL / NO-GO to Stage2):
--   0017 granted every authenticated user full SELECT/INSERT/UPDATE/DELETE on their
--   OWN rows for ALL private tables — including the permanent growth ledger
--   (xp_transactions, player_states, skills, mastery_events, mastery_verifications,
--   ai_assessments, evidence_records). That lets a logged-in user bypass the entire
--   AI → Proposal → Growth Engine → Settlement → Ledger authority chain and directly
--   `UPDATE skills SET mastery_level = 10` or `INSERT xp_transactions`.
--
-- Correct model (this migration):
--   RLS must distinguish "whose row" AND "which of my own columns I may touch".
--   Permanent growth state is SERVER-ONLY (written exclusively by the settle_activity
--   RPC / SECURITY DEFINER paths), never by the client Data API.
--   - read-only ledger / permanent-state tables: authenticated SELECT only.
--   - user-authored content (domains/quests/activities/knowledge*/artifacts/reviews):
--     full CRUD on own rows.
--   - profiles: SELECT + UPDATE (INSERT is performed by the auth trigger; no DELETE).
--
-- Policies are named `{table}_select|_insert|_update|_delete` so the offline
-- policy-matrix test can assert presence/absence per table.
--
-- NOTE: server-side writes go through SECURITY DEFINER RPC (or service_role) which
-- bypasses these policies — that is the ONLY sanctioned write path for permanent
-- state. This migration only constrains the `authenticated` (client JWT) role.

-- ============================================================
-- 1) Tear down 0017's blanket policies
-- ============================================================
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
    foreach p in array array['select_own', 'insert_own', 'update_own', 'delete_own']
    loop
      execute format('drop policy if exists %I on public.%I', t || '_' || p, t);
    end loop;
  end loop;
end $$;

-- ============================================================
-- 2) Authority matrix — authenticated (client JWT) role
-- ============================================================

-- ---- read-only permanent state / ledger (SELECT only) ----
create policy xp_transactions_select on public.xp_transactions
  for select to authenticated using (user_id = auth.uid());

create policy player_states_select on public.player_states
  for select to authenticated using (user_id = auth.uid());

create policy skills_select on public.skills
  for select to authenticated using (user_id = auth.uid());

create policy ai_assessments_select on public.ai_assessments
  for select to authenticated using (user_id = auth.uid());

create policy evidence_records_select on public.evidence_records
  for select to authenticated using (user_id = auth.uid());

create policy mastery_verifications_select on public.mastery_verifications
  for select to authenticated using (user_id = auth.uid());

create policy mastery_events_select on public.mastery_events
  for select to authenticated using (user_id = auth.uid());

-- ---- profiles: SELECT + UPDATE (INSERT via auth trigger, no DELETE) ----
create policy profiles_select on public.profiles
  for select to authenticated using (user_id = auth.uid());

create policy profiles_update on public.profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- user-authored content: full CRUD on own rows ----
create policy domains_select on public.domains
  for select to authenticated using (user_id = auth.uid());
create policy domains_insert on public.domains
  for insert to authenticated with check (user_id = auth.uid());
create policy domains_update on public.domains
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy domains_delete on public.domains
  for delete to authenticated using (user_id = auth.uid());

create policy quests_select on public.quests
  for select to authenticated using (user_id = auth.uid());
create policy quests_insert on public.quests
  for insert to authenticated with check (user_id = auth.uid());
create policy quests_update on public.quests
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy quests_delete on public.quests
  for delete to authenticated using (user_id = auth.uid());

create policy activities_select on public.activities
  for select to authenticated using (user_id = auth.uid());
create policy activities_insert on public.activities
  for insert to authenticated with check (user_id = auth.uid());
create policy activities_update on public.activities
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy activities_delete on public.activities
  for delete to authenticated using (user_id = auth.uid());

create policy knowledge_nodes_select on public.knowledge_nodes
  for select to authenticated using (user_id = auth.uid());
create policy knowledge_nodes_insert on public.knowledge_nodes
  for insert to authenticated with check (user_id = auth.uid());
create policy knowledge_nodes_update on public.knowledge_nodes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy knowledge_nodes_delete on public.knowledge_nodes
  for delete to authenticated using (user_id = auth.uid());

create policy knowledge_edges_select on public.knowledge_edges
  for select to authenticated using (user_id = auth.uid());
create policy knowledge_edges_insert on public.knowledge_edges
  for insert to authenticated with check (user_id = auth.uid());
create policy knowledge_edges_update on public.knowledge_edges
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy knowledge_edges_delete on public.knowledge_edges
  for delete to authenticated using (user_id = auth.uid());

create policy artifacts_select on public.artifacts
  for select to authenticated using (user_id = auth.uid());
create policy artifacts_insert on public.artifacts
  for insert to authenticated with check (user_id = auth.uid());
create policy artifacts_update on public.artifacts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy artifacts_delete on public.artifacts
  for delete to authenticated using (user_id = auth.uid());

create policy artifact_links_select on public.artifact_links
  for select to authenticated using (user_id = auth.uid());
create policy artifact_links_insert on public.artifact_links
  for insert to authenticated with check (user_id = auth.uid());
create policy artifact_links_update on public.artifact_links
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy artifact_links_delete on public.artifact_links
  for delete to authenticated using (user_id = auth.uid());

create policy reviews_select on public.reviews
  for select to authenticated using (user_id = auth.uid());
create policy reviews_insert on public.reviews
  for insert to authenticated with check (user_id = auth.uid());
create policy reviews_update on public.reviews
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reviews_delete on public.reviews
  for delete to authenticated using (user_id = auth.uid());
