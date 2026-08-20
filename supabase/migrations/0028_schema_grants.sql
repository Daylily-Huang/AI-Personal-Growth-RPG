-- 0028_schema_grants.sql
-- Stage 3: Grant standard table privileges to anon, authenticated, and service_role.
-- Table-level grants allow PostgREST / Supabase Data API to process queries, while
-- Row Level Security (RLS) policies from 0017-0027 strictly govern row-level access:
--   - player_states / xp_transactions / skills / mastery_events: authenticated SELECT only (written via RPC/service_role);
--   - ai_assessments: authenticated SELECT only (written via record_ai_assessment);
--   - activities: authenticated SELECT + DELETE (pending), INSERT via create_activity RPC;
--   - service_role: bypasses RLS for trusted server operations.

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
