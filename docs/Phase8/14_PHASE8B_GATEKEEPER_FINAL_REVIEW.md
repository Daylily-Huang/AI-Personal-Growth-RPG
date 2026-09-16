# Phase 8B — Independent Gatekeeper Final Review

> **Review type**: Independent read-only Gatekeeper review  
> **Reviewed implementation head**: `c4b4f2c847606ef24a41d4948f9245fe500b3bc2`  
> **PR**: #33 — `feature/phase8b-season-review` -> `main`  
> **Architecture baseline**: `0dffb9d706c3c941c46078c89bf3ae6e70d65d5f`  
> **Required governance overlay**: `c457944caf7bc12ab84033ea8a8d644cc1921e25`  
> **Review date**: 2026-09-17  
> **Verdict**: **NO-GO / NEED_FIX**  
> **Findings**: **P0 = 0, P1 = 2, P2 = 2**

---

## 1. Executive Verdict

Phase 8B is **not yet eligible for FINAL FROZEN or merge**.

The implementation is materially stronger than the initial authority-layer checkpoint: the five-table scope is respected, the nine authorized RPCs exist, Growth Core mutation boundaries remain intact, Journey UI stays inside Phase 8B, and the current exact-head CI is green. However, the controlling contract requires not merely green CI but correct idempotency/concurrency/security semantics and an independent review result of `P0=0 / P1=0 / P2=0 + GO`.

This review found two P1 contract violations and two P2 contract mismatches. Phase 8C therefore remains blocked until corrective commits receive exact-head CI and independent re-review.

---

## 2. CI Evidence — Verified but Not Treated as Semantic Proof

The following CI evidence was independently verified:

- `80abfa3878a76e1f74279c86d0c5413786fad9e9` — Run `35128996512`: success.
- `c4b4f2c847606ef24a41d4948f9245fe500b3bc2` — Run `35129835770`: success.
- For Run `35129835770`, both `check` and `supabase-integration` completed successfully, including:
  - Lint
  - Test
  - Build
  - local Supabase startup
  - database-backed tests
  - deterministic Growth Engine harness
  - E2E

**Interpretation**: this proves the implemented test suite and pipeline pass on the reviewed head. It does **not** prove untested frozen-contract cases. The findings below are specifically in semantic paths not covered by the current regression suite.

---

## 3. P1 Findings

### P1-01 — Same-commit-key concurrent Review replay is not deterministically idempotent

**Affected code**:
- `supabase/migrations/0044_phase8b_rpc_authority.sql`
  - `rpc_finalize_season_review`
  - `rpc_amend_final_season_review`

**Frozen contract**:
- Review writes use durable `UNIQUE (user_id, commit_key)` identity.
- Exact replay on the same commit key must return the already committed Review.
- Review version allocation must serialize on the parent Season row.
- The controlling document requires same-key idempotent replay plus concurrency coverage.

**Observed implementation**:
Both Review RPCs query `season_reviews` for `p_commit_key` **before** acquiring the parent Season `FOR UPDATE` lock. Under two concurrent requests using the same `commit_key`, both transactions can observe no existing Review. The first transaction then acquires the Season lock and inserts. After it commits, the second acquires the lock but does not re-check `commit_key`; it proceeds to `INSERT` and can fail on the unique constraint instead of returning the previously committed Review.

**Why this matters**:
Network retries / double-submit can produce a conflict/error despite being an exact replay. This violates the frozen RPC replay contract even though duplicate state remains prevented by the unique constraint.

**Current test gap**:
Round 5 tests cover:
- sequential same-key replay;
- concurrent Review creation with **different** random commit keys;
- concurrent FINAL amendments with **different** random commit keys.

They do not cover concurrent exact replay with the same commit key.

**Required correction**:
Serialize before the authoritative replay check, or re-check the commit key after acquiring the Season lock. An equivalent fail-safe implementation may catch the unique collision and resolve it by loading and validating the canonical existing Review, but exact replay must return the same Review rather than surface an error.

**Required regression tests**:
1. Concurrent `rpc_finalize_season_review` calls with the same `commit_key`: both succeed; same Review ID; exactly one row/version inserted.
2. Concurrent `rpc_amend_final_season_review` calls with the same `commit_key`: both succeed; same Review ID; exactly one superseding version inserted.

---

### P1-02 — `CANCELLED` Season can be hard-deleted through the normal product path

**Affected code**:
- `supabase/migrations/0043_phase8b_outer_loop_foundation.sql`
- `src/lib/outer-loop/repository.ts`
- `src/app/api/seasons/[id]/route.ts`

**Frozen contract**:
`CANCELLED` is a terminal Season state. The Season specification permits pruning only unactivated `DRAFT` or `PLANNED` Seasons with zero dependent child records.

**Observed implementation**:
The delete trigger blocks only:

```text
ACTIVE, COMPLETED, ENDED_EARLY, ABANDONED
```

It does not block `CANCELLED`. Authenticated users retain direct `DELETE` authority on `seasons`, and the API DELETE route delegates to `deleteUnactivated()` without an application-level status gate. Therefore a cancelled Season with no restrictive child FK can be deleted.

**Why this matters**:
A terminal lifecycle record and its cancellation history can disappear from the authoritative Season table. This is inconsistent with the canonical lifecycle/history rule and the product method name/intent (`deleteUnactivated`).

**Current test gap**:
O022 tests `COMPLETED` deletion rejection and DRAFT deletion, but there is no regression case asserting that a `CANCELLED` Season is non-deletable.

**Required correction**:
Make delete authorization fail closed so only `DRAFT` or `PLANNED` can be hard-deleted (with existing FK restrictions still protecting dependent rows). Add DB-backed and API regression coverage for `CANCELLED`.

---

## 4. P2 Findings

### P2-01 — HTTP adapter collapses specified 422 validation outcomes to 400

**Affected code**:
- `src/lib/outer-loop/http.ts`

**Frozen contract examples**:
- `PROPOSAL_EXPIRED` -> HTTP 422.
- `PAYLOAD_VALIDATION_FAILED` / schema-validation failures -> HTTP 422 where specified by the RPC contract.

**Observed implementation**:
The generic mapper routes SQLSTATE `22023`, `INVALID_*`, `MISSING_*`, and `PROPOSAL_EXPIRED` to HTTP 400. Since these RPC errors use `22023`, the 422 taxonomy is not preserved through the HTTP surface.

**Required correction**:
Special-case contractually defined 422 domain errors before the generic 400 mapping, and add adapter tests asserting the exact status/code behavior.

---

### P2-02 — Proposal expiry is detected but the canonical `EXPIRED` lifecycle state is never materialized

**Affected code**:
- `supabase/migrations/0044_phase8b_rpc_authority.sql`
- Phase 8B proposal lifecycle as frozen in `08_AI_GM_OUTER_LOOP_CONTRACT.md`

**Frozen contract**:
A stale unreviewed proposal transitions to `status = 'EXPIRED'` while `decision` remains `NULL`.

**Observed implementation**:
`rpc_review_outer_loop_proposal` checks `expires_at` and raises `PROPOSAL_EXPIRED`, but does not transition the row to `EXPIRED`. No Phase 8B implementation path reviewed here materializes that status.

**Required correction**:
Implement a deterministic authorized expiration path consistent with the proposal authority model and audit requirements, then add DB-backed coverage proving stale proposals become `EXPIRED` without creating domain state.

---

## 5. Verified Non-Findings / Positive Boundaries

The review did **not** identify a P0 issue in the reviewed head. In particular:

- No Phase 8B production diff creates Phase 8C–8G tables or reward infrastructure.
- `rpc_conclude_season` does not mint reward credits.
- Season completion does not mutate linked Quest lifecycle state.
- Review finalization does not write XP / Mastery / Evidence truth.
- The single-active-Season invariant is backed by a partial unique index and serialized activation logic.
- `season_quests` direct authenticated writes are denied and cross-tenant ownership is checked.
- Review records are immutable except the one-time `superseded_by_id` linkage.
- AI proposal review remains bounded behind deterministic database authority; no browser/model service-role exposure was found in the reviewed Phase 8B application code.

These positive results do not waive the four findings above.

---

## 6. Required Re-review Gate

A corrective head may be submitted for Gatekeeper re-review only after all of the following are present:

1. P1-01 fixed for both Review RPCs.
2. Real database concurrency tests for same-key Review replay added and passing.
3. P1-02 fixed so `CANCELLED` Season hard-delete fails closed.
4. DB/API regression coverage for cancelled-season deletion added.
5. P2-01 HTTP 422 taxonomy corrected and covered.
6. P2-02 proposal expiry lifecycle corrected and covered.
7. Full exact-head CI green, including database-backed tests, deterministic harness, build, and E2E.
8. Corrective head SHA + CI run IDs recorded.

Only after independent re-review reaches **`P0=0 / P1=0 / P2=0`** may the Gatekeeper issue **GO**.

---

## 7. Final Decision

```text
P0 = 0
P1 = 2
P2 = 2

VERDICT = NO-GO / NEED_FIX
MERGE = BLOCKED
PHASE 8C = BLOCKED
```

The current green CI remains valid evidence for the paths it executes, but it does not close the uncovered semantic contract violations documented above.
