-- 0029_default_privileges_tighten.sql
-- Round20 P2-1: Tighten default privileges so future tables are fail-closed by default.
-- Future tables must explicitly enable RLS, create policies, and grant minimal permissions.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Ensure service_role retains automated admin maintenance access on future entities
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
