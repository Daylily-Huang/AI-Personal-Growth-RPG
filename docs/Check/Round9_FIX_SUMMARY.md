# Round9 Fix Summary — Stage1.2 Migration Proof (Authority & Schema Integrity)

**Gate reviewed:** `5c4e2c82` (Round8 fix). Result **8.4/10 — NO-GO**, one hard blocker.
**Scope of this round:** narrow Stage1.2 only (per reviewer: "不要继续加业务代码",
"不要再来一轮 schema 打磨"). No schema expansion, no UI, no Quest, no Stage2 work.

---

## P0 — `0019_schema_integrity.sql` fatal SQL syntax (RESOLVED)

`ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS` is **not valid PostgreSQL**
(`IF NOT EXISTS` exists for `ADD COLUMN` / `CREATE`, not for `ADD CONSTRAINT`).
This made the entire 0019 migration a hard syntax error and blocked Stage2.

All 5 offending statements replaced with **valid, idempotent `DO $$ ... $$` blocks**
that check `pg_constraint` before adding:

- `evidence_records_evidence_level_check` — re-added as `check (evidence_level between 0 and 6)`.
- `fk_xp_transactions_activity` / `_assessment` / `_skill` — FKs to `activities` / `ai_assessments` / `skills`
  (core Growth Loop tenant integrity; the other 3 tenant FKs already exist).
- `skills_user_normalized_unique` — `unique (user_id, normalized_name)`.

Retained (already valid): `add column if not exists`, `drop trigger if exists`,
`create or replace function`, the BEFORE trigger, and the DO block that drops any
pre-existing evidence CHECK before re-adding (so the file is safe to re-run on a DB
where 0008 was applied as `0..4`).

## P1 — empty-DB smoke test was a false green (RESOLVED)

Old behavior: when `XP_RPG_TEST_DB_URL` was set but `pg` was missing, the test
`console.warn` + `return` → **passed silently**.

New behavior (gating matrix, matching reviewer's spec):

| Condition | Result |
|---|---|
| No `XP_RPG_TEST_DB_URL` | `describe.skipIf` → **skipped** |
| URL set, `pg` missing | `throw` → **FAIL** (no false green) |
| URL set, DB unreachable | `connect()` throws → **FAIL** |
| Any migration statement errors | `query()` throws → **FAIL** |

Any migration failure now propagates out of the test (the `finally` only closes the
client), so the test can no longer report green on a broken migration chain.

## P1 — `pg` declared as devDependency (RESOLVED)

Added `"pg": "^8.13.0"` to `devDependencies` and synced `pnpm-lock.yaml` via
`pnpm install --lockfile-only`. Diff on the lockfile is **+110 / 0 deletions** —
only `pg` and its transitive deps (`pg-pool`, `pg-protocol`, `pg-connection-string`,
`pg-cluster`, `pgpass`, `semver`, `postgres-*`, `split2`, `xtend`) were appended;
**no existing package version was changed** (no drift). `pg` is required before the
smoke test runs (`pnpm add -D pg` in WSL/CI), which is the reviewer's Gate step 2.

## P2 — Skill normalized-name comment overstated (RESOLVED)

`0019` section-3 comment previously implied it prevents semantic duplicates
(`"Statistics"` / `"统计学"` / `"统计"`). Corrected: normalization is **case/whitespace
only** (`lower` + `btrim` + collapse internal spaces); it does **not** resolve semantic
aliases — that is future Skill Ontology work.

---

## Explicitly NOT done this round (deferred to Stage2, per reviewer)

- **Activity frozen-state authority** — `activities` is currently full CRUD for
  `authenticated`. Reviewer wants `confirmed` Activity (`raw_input` / `rules_version` /
  `effective_minutes` / `status`) and `rules_version` (frozen at creation) to be
  client-immutable. Reviewer classifies this as **Stage2** (trigger / controlled RPC).
  Not touched here to respect scope.
- **Composite tenant FK** `(user_id, activity_id) references activities(user_id, id)` —
  current FKs are plain. Reviewer agrees to defer; Stage2 `settle_activity` RPC must
  derive `user_id` from `auth.uid()` and never trust client-supplied IDs.

## Verification status (honest)

- **SQL correctness:** verified by inspection against PostgreSQL 17 `ALTER TABLE`
  grammar — the illegal `ADD CONSTRAINT IF NOT EXISTS` is gone; all replacements are
  valid `DO` blocks / plain `ADD CONSTRAINT`. The static `supabase-schema.test.ts`
  (Policy Matrix + Evidence-range consistency) is unchanged and still covers 0018/0019.
- **NOT executed here:** the empty-DB migration chain (0001→0019) was **not run** in
  this Windows shell. Two independent blockers:
  1. `node_modules` is the WSL/linux target (rolldown win32 binding missing) →
     `vitest` / `next build` cannot run here; this matches the established
     "verify in WSL" decision.
  2. The smoke test needs a live Supabase DB (`XP_RPG_TEST_DB_URL`) — none is
     available in this shell.
- **Required next (reviewer's Gate step 4, in WSL/CI):**
  ```
  pnpm add -D pg
  XP_RPG_TEST_DB_URL=<clean Supabase DB> pnpm vitest run tests/empty-db-migration.smoke.test.ts
  pnpm test && pnpm harness:deterministic && pnpm lint && pnpm build
  ```
  If that runs clean on a truly empty DB, the reviewer expects **GO → Stage2**.
