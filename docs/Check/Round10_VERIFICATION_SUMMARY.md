# Round10 Verification Summary — Stage1 Gate

**Verification date:** 2026-08-19
**Environment:** Windows Docker Desktop 29.7.2 with WSL 2 Ubuntu; Docker Desktop program/data configured on D:.

## Result

Round10 Stage1 verification gate: **PASS / GO to Stage2**.

The migration chain `0001_profiles.sql` through `0019_schema_integrity.sql` was executed successfully on a dedicated local Supabase-compatible PostgreSQL database with the Supabase `auth` schema present.

## Evidence

| Check | Result | Details |
|---|---:|---|
| Supabase local stack | PASS | `supabase start` completed; local PostgreSQL exposed on `127.0.0.1:54322` |
| Migration chain | PASS | `0001` through `0019` applied successfully by Supabase CLI on the local stack |
| Empty-DB migration smoke | PASS | Dedicated `rpg_smoke_round10` database; 1 test passed |
| `@types/pg` | PASS | Added `@types/pg@8.23.1`; TypeScript build completed |
| Full Vitest suite | PASS | 8 files passed; 83 tests passed; 1 gated DB smoke test skipped when no URL was supplied |
| Deterministic harness | PASS | `tests/growth-engine.test.ts`: 11 tests passed |
| ESLint | PASS | `pnpm lint` completed without errors |
| Production build | PASS | Next.js 16.3.1 compiled, TypeScript completed, 9 static pages generated |

## Minimal fixes made during verification

1. Added `@types/pg` to `devDependencies` and synchronized `pnpm-lock.yaml`.
2. Updated the migration smoke assertion to accept PostgreSQL's normalized representation of the `evidence_level` constraint (`>= 0 and <= 6`) as well as the source `between 0 and 6` form.
3. Updated the RLS static test to assert the actual Round8 authority-matrix naming and teardown list; the previous test expected retired policy-name fragments even though the migration correctly generated the new names.
4. Added `supabase/config.toml` through `supabase init` for reproducible local Supabase operation.
5. Added `supabase/.gitignore` and ignored `supabase/.temp` generated runtime files from ESLint.

## Scope boundary

This verification does not implement Stage2. The following remain intentionally deferred:

- `SupabaseRepository`
- `settle_activity` `SECURITY DEFINER` RPC
- authenticated `auth.uid()` ownership derivation
- Activity frozen-state immutability
- composite tenant foreign keys
- two-user runtime isolation and settlement concurrency integration tests

Those are the next Stage2 implementation and review scope.

## Reproduction commands

```bash
corepack pnpm install
corepack pnpm exec supabase start
XP_RPG_TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/<fresh-supabase-db> \
  corepack pnpm vitest run tests/empty-db-migration.smoke.test.ts
corepack pnpm test
corepack pnpm harness:deterministic
corepack pnpm lint
corepack pnpm build
```

The smoke test must use a fresh disposable database that includes the Supabase `auth` schema; do not rerun the full chain against the already-migrated default `postgres` database.
