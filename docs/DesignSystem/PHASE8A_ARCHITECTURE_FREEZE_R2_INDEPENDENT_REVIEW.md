# Phase 8A — Outer Growth Loop Architecture Freeze — R2 Independent Review

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`  
**Reviewer:** Independent Review AI / Gatekeeper  
**Review date:** 2026-09-16  
**PR:** #31  
**Authoritative main baseline:** `0a85de522503cf3f0a656f74f248c9a65e7b5da5`  
**Reviewed Exact Head:** `6d50e904d168c70ee3df60351f9968d05b41dfbe`  
**R1 controlling review:** `107513a14e0472ecd02c20aea5f67b1693fed649`  
**Phase 8A controlling document:** `422f55656881633ecebddcd2f08a5bff02db8f58`  

---

# 0. Final R2 adjudication

```text
P0 = 0
P1 = 8
P2 = 6

PHASE 8A R2 = NO-GO -> NEED_FIX
PR #31 MERGE AUTHORIZED = NO
PHASE 8A FINAL FROZEN = NO
PHASE 8B IMPLEMENTATION = BLOCKED
PHASE 7 FINAL FROZEN = YES — unchanged
```

R1 corrective work materially improved the package, especially Reward accounting, canonical reward-source de-duplication, Frozen Core terminology, Phase 7 evidence limitations, ID namespace separation, PR metadata, and the absent `v1.0-core` replacement gate. However, Phase 8A is an **architecture freeze**, so cross-document contracts must be implementable and mutually consistent before merge. The R2 Exact Head still contains multiple contradictions that would force Phase 8B+ implementation to violate one document in order to satisfy another.

No production implementation is authorized by this review.

---

# 1. Evidence ledger

## 1.1 PR topology and scope

Independent GitHub verification:

```text
PR #31 state: open
merged: false
mergeable: true
draft: false
base: main
base_sha: 0a85de522503cf3f0a656f74f248c9a65e7b5da5
head: docs/phase8a-outer-loop-architecture-freeze
head_sha: 6d50e904d168c70ee3df60351f9968d05b41dfbe
commits: 2
changed_files: 14
```

`main` independently remains:

```text
0a85de522503cf3f0a656f74f248c9a65e7b5da5
```

Base-to-head compare is `ahead_by=2`, `behind_by=0`, and contains exactly the 14 declared `docs/Phase8/**` files.

Classification:

```text
DOCS-ONLY SCOPE = SOURCE VERIFIED / PASS
PRODUCTION CODE DRIFT = NOT PRESENT
TEST / MIGRATION / WORKFLOW / DEPENDENCY DRIFT = NOT PRESENT
```

## 1.2 Exact-Head CI

Run:

```text
34996069774
```

Independent verification:

```text
event: pull_request
head_sha: 6d50e904d168c70ee3df60351f9968d05b41dfbe
base_sha: 0a85de522503cf3f0a656f74f248c9a65e7b5da5
status: completed
conclusion: success

check: success
supabase-integration: success
```

The `check` job includes lint/test/build. The `supabase-integration` job includes database-backed tests, deterministic Growth Engine harness, and E2E.

Classification:

```text
EXACT-HEAD EXISTING CI = RUNTIME VERIFIED / GREEN
```

This proves the docs-only change did not regress the currently implemented frozen system. It does **not** prove Phase 8 behavior, because Phase 8 production implementation does not yet exist.

## 1.3 O001–O022 evidence status

The R1 corrective correctly states:

```text
O001–O022 specifications = SOURCE VERIFIED
O001–O022 Phase 8 runtime = NOT VERIFIED
```

This evidence vocabulary is accepted and must remain unchanged until implementation phases execute those tests.

## 1.4 `v1.0-core` tag

Independent GitHub ref lookup still returns 404 for:

```text
refs/tags/v1.0-core
```

The new Phase 8B baseline-gate text correctly requires a future Gatekeeper-pinned Phase 8A merge SHA to replace that absent tag gate. This part is closed.

---

# 2. R1 corrective work that is accepted in R2

The following R1 corrections are materially correct and should be preserved:

1. Reward accounting is no longer described as double-entry. It is now a **single-account append-only event ledger**.
2. `foldRewardLedger` explicitly includes `EARN`, signed `CORRECTION`, `RESERVE`, `UNRESERVE`, `REDEEM`, and `REFUND`.
3. The documented trace `EARN +100 -> CORRECTION -20` now yields available `80`, not `100`.
4. The documented full redemption + refund trace restores available credits.
5. Reward grant amount is server-derived from verified source + versioned policy; no client `p_amount` is authoritative.
6. EARN de-dup now uses canonical source identity rather than only a request key.
7. Milestone wrappers anchor to underlying Core source to prevent obvious Quest/Milestone double minting.
8. `USER_CONFIRMED_REAL_WORLD` self-attestation is separated from automatic reward eligibility.
9. Frozen Quest semantics are mostly aligned to `quest_size`, `is_boss`, `is_main_quest`, and lowercase status values.
10. Mastery examples no longer relabel M3/M4/M5; advanced examples use the authoritative M0–M10 scale.
11. Activity time attribution now uses existing `created_at`; no Phase 8 `activity_time` field is introduced.
12. Wish vocabulary is largely normalized to `IDEA / ACTIVE / PRIMARY / RESERVED / REDEEMED / ARCHIVED / CANCELLED`.
13. Strategy is correctly described as a six-status lifecycle.
14. Architecture invariant IDs remain `O1..O12`; harness IDs remain `O001..O022`.
15. Phase 7 carry-forward limitations are preserved as nonblocking `NOT VERIFIED` items.
16. The future Phase 8B controlling document is required to pin the exact Phase 8A merge SHA.

These improvements do not eliminate the blockers below.

---

# 3. P1 findings — blocking architecture defects

## P1-01 — FINAL Review and Season terminalization form a circular / inverted dependency

**Affected:**
- `03_SEASON_AND_REVIEW_SPEC.md`
- `01_OUTER_LOOP_DOMAIN_MODEL.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`
- controlling document §6.7

The canonical lifecycle states that `ACTIVE -> COMPLETED` and `ACTIVE -> ENDED_EARLY` require a user-confirmed `FINAL` Review. The controlling document explicitly requires the FINAL review **before** those settlements.

But the RPC plan currently specifies:

```text
rpc_conclude_season:
ACTIVE -> COMPLETED / ENDED_EARLY
(no FINAL review precondition or atomic FINAL review creation)
```

while simultaneously specifying:

```text
rpc_finalize_season_review(FINAL):
season must already be COMPLETED or ENDED_EARLY
```

This is impossible to implement without violating one side of the freeze.

**Required correction:** choose one canonical atomic ordering and propagate it across all docs. Preferred design:

```text
ACTIVE Season
+ user-confirmed FINAL review payload/proposal
        ↓
atomic conclude transaction
        ├─ insert immutable FINAL SeasonReview
        ├─ transition Season -> COMPLETED / ENDED_EARLY
        └─ audit
```

Alternative acceptable design: finalize FINAL review while Season is still ACTIVE, then a separate terminalization RPC requires that exact finalized review. If split, concurrency and stale-final-review semantics must be explicit.

`ABANDONED` remains allowed with explicit reason/audit without full FINAL review, matching the controlling document.

---

## P1-02 — Reward correction/refund de-duplication is claimed by RPCs but absent from the schema, and refund semantics conflict with frozen history

**Affected:**
- `06_REWARD_ECONOMY_AND_WISHES_SPEC.md`
- `09_DATABASE_SCHEMA_PLAN.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

The API plan claims:

```text
CORRECTION:
partial unique index on correction_for_id
=> exactly one correction per original EARN
```

but the schema plan defines **no unique / partial unique constraint on `correction_for_id`**. Two requests using different request keys can therefore be described as structurally legal by the schema plan.

The refund path similarly claims:

```text
exactly one REFUND per redemption ID
```

but `reward_transactions` has no canonical `refund_for_redemption_id` / equivalent structural identity and no matching unique index. `reward_redemptions.UNIQUE(transaction_id)` only de-duplicates the original redemption receipt; it does not de-duplicate refund events.

There are two additional contradictions:

1. canonical Wish lifecycle makes `REDEEMED` terminal, but `rpc_refund_wish_redemption` mutates the Wish back to `ACTIVE`;
2. `reward_redemptions` is declared entirely immutable, while its correction model says refunds “update redemption metadata”.

**Required correction:**

- add a schema-backed exactly-once correction identity, e.g. a partial unique index on `correction_for_id` for `CORRECTION`;
- define a schema-backed exactly-once refund source identity anchored to the redemption receipt;
- preserve `REDEEMED` as terminal unless the Gatekeeper explicitly approves a lifecycle change;
- keep the receipt immutable and derive refunded state from the append-only REFUND event, or explicitly design a separate immutable/versioned correction model;
- align API replay semantics with those structural constraints.

---

## P1-03 — RPC-only authority can still be bypassed by the planned direct RLS write surface

**Affected:**
- `02_OUTER_LOOP_AUTHORITY_RULES.md`
- `09_DATABASE_SCHEMA_PLAN.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

Several tables declare lifecycle transitions “RPC-only” but simultaneously grant broad direct row UPDATE capability:

- `outer_loop_proposals`: RLS plan allows direct user `UPDATE`, but proposal status transitions are declared strictly `rpc_review_outer_loop_proposal` so that domain commit + audit remain atomic;
- `seasons`: RLS plan allows direct user `UPDATE`, while `ACTIVE` and terminal status transitions are declared RPC-only;
- `wishes`: direct and RPC write boundaries are not expressed as enforceable per-column privileges, so lifecycle fields can become ambiguous;
- `strategies`: direct protocol edits are intended, but lifecycle/confidence fields must remain deterministic/RPC-only.

RLS is row-level; a statement such as “UPDATE allowed for own rows” does not by itself prevent changing authority fields such as `status`.

**Required correction:** freeze an enforceable write model. Examples:

- deny direct client UPDATE entirely for proposal records;
- use RPC-only lifecycle transitions for Season/Wish/Strategy authority fields;
- if direct metadata editing is retained, specify column-level UPDATE grants or fail-closed trigger/check enforcement so authority columns cannot be directly changed;
- state exact RLS/privilege intent per table instead of a generic CRUD slogan.

No lifecycle invariant may depend on UI convention alone.

---

## P1-04 — SeasonReview “retry-safe” finalization is not actually idempotent or concurrency-safe as specified

**Affected:**
- `09_DATABASE_SCHEMA_PLAN.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

The schema calls:

```text
UNIQUE(season_id, review_type, version)
```

“retry-safe”. It is not a retry identity: the same client request can simply be treated as `version + 1` and create another review.

The RPC accepts `p_request_idempotency_key` and claims same-key replay returns the existing review, but no durable field or de-dup mechanism stores that request identity.

The proposed concurrency query:

```sql
SELECT COALESCE(MAX(version), 0)
FROM season_reviews
...
FOR UPDATE;
```

is not a valid row-locking strategy for PostgreSQL aggregate output and does not provide the intended per-Season serialization.

**Required correction:**

- define a durable review-finalization idempotency identity, e.g. `commit_key` / request key with tenant-scoped uniqueness;
- lock a real row such as the parent Season (or use another explicit serialization mechanism) before reading/incrementing review version;
- define exact supersession behavior for retries vs genuine new versions;
- coordinate this with P1-01 so FINAL review + Season conclusion cannot race.

---

## P1-05 — StrategySupport source de-duplication is not fail-closed for nullable/manual sources

**Affected:**
- `05_STRATEGY_PLAYBOOK_SPEC.md`
- `09_DATABASE_SCHEMA_PLAN.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

The Strategy spec makes `source_id` nullable and permits `MANUAL_OBSERVATION`. The schema uses:

```text
UNIQUE(strategy_id, source_class, source_id, observation_type, evaluator_version)
```

Under ordinary PostgreSQL UNIQUE semantics, NULL values are distinct, so repeated rows with `source_id = NULL` are not de-duplicated. This can inflate support/counter-support counts.

The API simultaneously describes `p_source_id` as required UUID, leaving the manual-observation identity undefined rather than solving it.

**Required correction:** every support observation must have a stable non-null canonical source identity. For manual observations, define a dedicated immutable observation identity / commit key with tenant ownership and replay semantics. Do not rely on nullable polymorphic IDs for anti-replay.

---

## P1-06 — Strategy state machine, deterministic confidence rubric, and evaluator RPC still disagree

**Affected:**
- `01_OUTER_LOOP_DOMAIN_MODEL.md`
- `05_STRATEGY_PLAYBOOK_SPEC.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

The package currently contains multiple incompatible rules:

1. `05` permits `SUPPORTED -> CONTEXTUAL` and `CONTEXTUAL -> SUPPORTED`; `01` / controlling lifecycle does not freeze those transitions.
2. `10` allows `TESTING -> WEAKENED`, while the Strategy state machine does not.
3. The confidence table says `HIGH` requires at least **4** distinct supporting observations, but `rpc_evaluate_strategy_status` can promote to `SUPPORTED` with `HIGH` after the minimum **2** distinct dates if ratio >=75% and other gates pass.
4. `05` says promotion is deterministic **and confirmed by the user**, while `rpc_evaluate_strategy_status` has no explicit confirmation/preview contract for the status mutation.

**Required correction:** freeze exactly one transition graph and exactly one deterministic mapping between support threshold, confidence ordinal, and lifecycle status. Decide explicitly whether `SUPPORTED` may exist at `MODERATE`, whether `HIGH` requires 4 supports, and how user confirmation participates in promotion. Then make `01`, `05`, `09`, `10`, and `11` identical.

---

## P1-07 — The API/RPC architecture still does not cover all state-changing write paths it claims to freeze

**Affected:**
- `10_API_AND_RPC_CONTRACT_PLAN.md`
- `09_DATABASE_SCHEMA_PLAN.md`
- lifecycle specs

The matrix declares `rpc_set_primary_wish` as RPC-only, but there is no 13-point contract for it in the numbered RPC catalogue.

Other lifecycle mutations also lack a clearly frozen write contract, including examples such as:

- `DRAFT -> PLANNED` Season transition;
- DRAFT/PLANNED Season cancellation;
- Wish archive/cancel transitions;
- lower-risk Strategy lifecycle transitions such as entering TESTING or RETIRED;
- immutable Strategy version creation coupled to an edited protocol.

The controlling document requires planned state-changing writes to define authentication, ownership, precondition, transition, idempotency, validation, atomic effects, audit, error/replay, and cross-tenant behavior. “Direct repository write” is insufficient if the mutation is a history-bearing lifecycle change subject to O9.

**Required correction:** either add explicit contracts for all history-bearing lifecycle mutations or define a shared lower-risk mutation contract that concretely supplies all controlling fields and is referenced by every transition. `rpc_set_primary_wish` must receive its own contract because it is already explicitly RPC-only.

---

## P1-08 — `rpc_activate_season` silently strengthens the frozen `0..1 MAIN` rule into an unapproved “exactly one MAIN” prerequisite

**Affected:**
- controlling document §6.4
- `03_SEASON_AND_REVIEW_SPEC.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

The frozen relation is:

```text
one Season may have 0..1 MAIN Quest
```

but `rpc_activate_season` now requires “at least one linked MAIN quest” before activation. That converts `0..1` into `1` for ACTIVE Seasons without an ADR or Gatekeeper authorization.

**Required correction:** remove the mandatory MAIN prerequisite and preserve `0..1`, or submit an ADR for independent approval explaining why the controlling invariant should change. No implementation may silently narrow a frozen cardinality.

---

# 4. P2 findings — noncritical but must close before architecture freeze

## P2-01 — `foldRewardLedger` silently clamps impossible negative ledger states instead of failing closed

The fold returns:

```text
Math.max(0, lifetime_redeemed)
Math.max(0, current_reserved)
```

This can hide corrupted or impossible event histories such as over-unreserve, refund-before-redeem, or redeem beyond reserved credits. The controlling architecture says impossible state must fail closed, not silently coerce to success.

**Fix:** validate event invariants while folding and throw/fail on impossible history; use clamping only for the intentional spendable-balance deficit rule. Define canonical ordering if intermediate-state validation depends on event sequence.

---

## P2-02 — Small Frozen Core / contract-name residue remains

Examples:

- O015 test text refers to Quest state as `in_progress / active`, but Frozen `QuestStatus` contains `active`, not literal `in_progress`;
- `05_STRATEGY_PLAYBOOK_SPEC.md` still names the promotion RPC `promote_strategy_to_supported`, while the API contract freezes `rpc_evaluate_strategy_status`.

**Fix:** remove obsolete literal names and use the exact frozen / planned contract identifiers.

---

## P2-03 — Reward domain/schema field vocabulary is not fully synchronized

Examples:

- canonical Reward fold introduces `net_earned`, but the domain-model `RewardAccount` diagram omits it;
- domain model uses `idempotency_key`, while Reward spec/schema uses `request_idempotency_key`;
- schema contract should explicitly state whether cache fields (`lifetime_earned`, `net_earned`, `lifetime_redeemed`, `current_reserved`, `current_available`, `correction_deficit`) are persisted columns or purely derived values.

**Fix:** freeze one field vocabulary and cache-vs-derived rule across `01`, `06`, and `09`.

---

## P2-04 — Replay result semantics differ across specs

Examples:

- O004 expects a second EARN with the same canonical source but a different request token to return `409 REWARD_ALREADY_MINTED`; the RPC text says any existing canonical source returns HTTP 200;
- O019 expects a concurrent second redemption to receive 409, while RPC replay wording says existing receipt is returned;
- proposal CAS says a second reviewer loses CAS and gets 409, while replay text says same decision can return the existing entity, despite no persisted request-key identity on the proposal.

**Fix:** distinguish explicitly between:

```text
same request-idempotency key replay -> return prior success
new request key but same canonical one-time source -> 409 / already settled
true concurrent loser -> deterministic 409 or prior-result semantics, consistently documented
```

---

## P2-05 — Mastery reward canonical source identity is ambiguous across M6/M8/M10 thresholds

The Reward spec advertises M6, M8, and M10 as eligible Mastery thresholds, but canonical source identity is described as:

```text
canonical_source_type = MASTERY
canonical_source_id = skill.id
```

With the EARN unique index and a single policy version, that permits only one EARN per skill, so later thresholds cannot mint separately.

**Fix:** decide whether policy intentionally allows only one Mastery reward per skill per policy version. If thresholds are independently rewardable, anchor canonical identity to the immutable Mastery transition/verification event or include the threshold in a deterministic source identity.

---

## P2-06 — Audit idempotency/provenance fields are weaker than O9 wording

O9 states permanent mutations require source, request/idempotency identity, timestamp, and policy/schema version where relevant. `outer_loop_audit_events` currently describes its `idempotency_key` as optional and does not freeze a first-class policy/schema-version field (it may be implied inside `details`, but that is not specified).

**Fix:** align audit schema contract with O9. Mutation audit events should carry the committed request identity and relevant evaluator/policy/schema version either as explicit columns or a mandatory structured details schema.

---

# 5. R1 finding closure matrix

The execution report's “all CLOSED” statement is not accepted as the R2 adjudication.

| R1 finding | R2 result | Notes |
|---|---|---|
| P1-01 Reward accounting | PARTIALLY CLOSED | Core fold bug fixed; fail-closed impossible-state handling remains P2-01. |
| P1-02 Reward mint authority | PARTIALLY CLOSED | Server amount + EARN source de-dup fixed; reversal/refund structure and mastery-source ambiguity remain. |
| P1-03 Frozen Core semantics | SUBSTANTIALLY CLOSED | Main model corrected; small literal residue remains P2-02. |
| P1-04 Lifecycle consistency | OPEN | Season/Review ordering, refund terminal-state mutation, Strategy lifecycle inconsistency remain. |
| P1-05 Database contract | OPEN | reversal/refund uniqueness, RLS authority enforcement, review idempotency, support de-dup remain. |
| P1-06 API/RPC contract | OPEN | circular review/closure flow and incomplete mutation contracts remain. |
| P2-01 ID namespace | CLOSED | O1–O12 vs O001–O022 separation accepted. |
| P2-02 PR metadata | CLOSED | PR body/title corrected. |
| P2-03 Phase 7 evidence limits | CLOSED | Correct nonblocking NOT VERIFIED carry-forward. |
| P2-04 Phase 8B baseline gate | CLOSED | Future Gatekeeper-pinned merge SHA replacement accepted. |

---

# 6. Mandatory R2 corrective scope

Continue on the existing PR #31 branch only:

```text
docs/phase8a-outer-loop-architecture-freeze
```

Allowed:

```text
docs/Phase8/**
PR #31 body metadata if needed
```

Forbidden:

```text
src/**
tests/**
supabase/**
scripts/**
.github/**
package.json
pnpm-lock.yaml
README.md
docs/MASTER_PROJECT_HANDOFF.md
docs/Design ChatGPT/**
docs/DesignSystem/**
```

Do not create Phase 8 production implementation. Do not merge PR #31.

Mandatory corrective objectives:

1. resolve FINAL Review / Season conclusion ordering atomically and consistently;
2. add schema-backed correction and refund exactly-once identities;
3. preserve canonical Wish terminal semantics during refund or explicitly obtain ADR approval;
4. make direct-vs-RPC authority enforceable, especially proposals/seasons/wishes/strategies;
5. make Review finalization genuinely retry-safe and concurrency-safe;
6. make StrategySupport source identity non-null/stable and replay-safe;
7. freeze one Strategy transition graph + confidence/status mapping;
8. cover all state-changing write paths, including `rpc_set_primary_wish`;
9. preserve `0..1 MAIN` unless separately authorized;
10. close all P2 cross-document vocabulary/replay/accounting issues.

After corrective push, wait for a new Exact-Head pull-request CI and return to Gatekeeper. No merge.

---

# 7. R3 acceptance gate

Phase 8A may receive FINAL FROZEN only if a future independent Exact-Head review verifies:

```text
P0 = 0
P1 = 0
P2 = 0

PR scope = docs/Phase8/** only
Exact-Head CI = success
Phase 8 implementation = NOT STARTED
Phase 7 = FINAL FROZEN unchanged
O001–O022 = SOURCE VERIFIED specs / runtime NOT VERIFIED
```

Until then:

```text
PHASE 8A = NOT FROZEN
PR #31 = DO NOT MERGE
PHASE 8B = BLOCKED
```
