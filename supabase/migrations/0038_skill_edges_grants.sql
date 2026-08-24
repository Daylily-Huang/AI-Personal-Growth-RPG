-- 0038_skill_edges_grants.sql
-- Stage 5D (Gate: Security / Tenant Isolation) — HUMAN_REQUIRED approved fix.
--
-- Discovery: 0036 created public.skill_edges but never granted table privileges
-- to `authenticated`. Every user-scoped request path (GET /api/skills,
-- GET /api/skills/[id], POST /api/skills/edges, DELETE /api/skills/edges/[id])
-- reads skill_edges through the authenticated role, so the whole Stage 5 read
-- surface returned 500 for real users. Only PATCH /api/skills/[id] survived
-- because it goes through the security-definer update_skill_metadata RPC.
--
-- Fix: grant standard DML on skill_edges to authenticated (RLS policies from
-- 0036 continue to scope every row to user_id = auth.uid(); the composite
-- tenant FKs still block cross-tenant references) and to service_role
-- (settlement/admin paths).
--
-- Approved by repo owner in the Stage 5D Round 1 HUMAN_REQUIRED review
-- (option: "new migration 0038"); content matches the owner's locally stashed
-- 0036 amendment.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.skill_edges TO authenticated, service_role;
