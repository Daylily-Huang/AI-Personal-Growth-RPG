-- 0031_global_function_default_privileges.sql
-- Round22 P1-1: Global default privileges revocation for functions.
-- PostgreSQL standard per-schema default privileges cannot remove the built-in global PUBLIC EXECUTE.
-- We must revoke global default execute for the creator role(s).

alter default privileges revoke execute on functions from public;
alter default privileges revoke execute on functions from anon, authenticated;

alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres revoke execute on functions from anon, authenticated;

-- Ensure service_role retains execute privilege on new functions created by postgres
alter default privileges for role postgres grant execute on functions to service_role;
