-- 0030_function_default_privileges_tighten.sql
-- Round21 P2-2: Tighten default privileges on functions so new functions are fail-closed by default.
-- Future functions must explicitly grant EXECUTE permissions to intended roles.

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public grant execute on functions to service_role;
