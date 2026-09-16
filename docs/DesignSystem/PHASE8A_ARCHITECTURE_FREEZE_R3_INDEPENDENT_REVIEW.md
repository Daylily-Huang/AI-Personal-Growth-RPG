# Phase 8A — Outer Growth Loop Architecture Freeze — R3 Independent Final Review

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`  
**Reviewer:** Independent Review AI / Gatekeeper  
**Review date:** 2026-09-16  
**PR:** #31  
**Authoritative main baseline:** `0a85de522503cf3f0a656f74f248c9a65e7b5da5`  
**Reviewed Exact Head:** `f356f84eb55e86146627a1b6e6c6fa2b2cd6e47c`  
**R2 controlling review:** `c79fc38d2f765ebbad2fa9cc68b625e700840ef5`  
**Phase 8A controlling document:** `422f55656881633ecebddcd2f08a5bff02db8f58`  

---

# 0. Final R3 adjudication

```text
P0 = 1
P1 = 5
P2 = 4

PHASE 8A R3 = NO-GO -> NEED_FIX
PR #31 MERGE AUTHORIZED = NO
PHASE 8A FINAL FROZEN = NO
PHASE 8B IMPLEMENTATION = BLOCKED
PHASE 7 FINAL FROZEN = YES — unchanged
```

R2 corrective work materially closed several prior defects: FINAL Review + Season terminalization is now atomic; Review version allocation uses a real parent-row lock; Reward correction/refund de-duplication has schema-backed identities; `REDEEMED` Wish remains terminal; Strategy `SUPPORTED` promotion now uses the HIGH threshold plus explicit user confirmation; and the Exact-Head CI is green.

However, Phase 8A is an **architecture freeze**, not a prose-completion gate. The R3 Exact Head still contains one P0 cross-tenant reference vulnerability in the planned schema surface, plus multiple implementability and cross-document defects. Therefore no merge or freeze is authorized.

No Phase 8 production implementation is authorized by this review.

---

# 1. Evidence ledger

## 1.1 PR topology and exact scope

Independent GitHub verification:

```text
PR #31 state: open
merged: false
mergeable: true
draft: false
base: main
base_sha: 0a85de522503cf3f0a656f74f248c9a65e7b5da5
head: docs/phase8a-outer-loop-architecture-freeze
head_sha: f356f84eb55e86146627a1b6e6c6fa2b2cd6e47c
commits: 3
changed_files: 14
additions: 3327
deletions: 0
```

`main` independently remains:

```text
0a85de522503cf3f0a656f74f248c9a65e7b5da5
```

Changed files remain exactly the declared 14 files under:

```text
docs/Phase8/**
```

No `src/**`, `tests/**`, `supabase/**`, `scripts/**`, `.github/**`, dependency, lockfile, or production configuration drift exists.

Classification:

```text
DOCS-ONLY SCOPE = SOURCE VERIFIED / PASS
PRODUCTION IMPLEMENTATION = NOT STARTED
PHASE 7 FINAL FROZEN = YES — unchanged
```

## 1.2 Exact-Head CI

Independent Exact-Head workflow run:

```text
35062638675
```

Verified:

```text
event: pull_request
head_sha: f356f84eb55e86146627a1b6e6c6fa2b2cd6e47c
base_sha: 0a85de522503cf3f0a656f74f248c9a65e7b5da5
status: completed
conclusion: success

check: completed / success
supabase-integration: completed / success
```

The `check` job contains lint/test/build. The `supabase-integration` job contains database-backed tests, deterministic Growth Engine harness, and E2E.

Classification:

```text
EXACT-HEAD EXISTING CI = RUNTIME VERIFIED / GREEN
```

This proves the docs-only PR does not regress the currently implemented frozen system. It does **not** runtime-verify any Phase 8 behavior.

## 1.3 Phase 8 harness evidence vocabulary

R3 confirms the package still correctly states:

```text
O001–O022 specifications = SOURCE VERIFIED
O001–O022 Phase 8 runtime = NOT VERIFIED
```

This remains mandatory until actual implementation phases execute those tests.

---

# 2. R2 findings materially closed in R3

The following corrective work is accepted and must be preserved:

1. **R2 P1-01 core ordering:** `rpc_conclude_season` now atomically inserts a user-confirmed `FINAL` SeasonReview and transitions `ACTIVE -> COMPLETED / ENDED_EARLY`. `ABANDONED` remains reason/audit based without mandatory FINAL Review.
2. **R2 P1-02 core reward reversal:** schema-backed unique identities now exist for one correction per original EARN and one refund per redemption. Refund no longer reopens a `REDEEMED` Wish, and `reward_redemptions` remains immutable.
3. **R2 P1-04 core concurrency:** `season_reviews` now has a durable tenant-scoped `commit_key` and version allocation is serialized by locking the parent Season row.
4. **R2 P1-05 base de-dup:** `strategy_supports.source_id` is now non-null and included in the composite source identity.
5. **R2 P1-06 primary Strategy rule:** `HIGH` now means >=4 distinct dates + >=1 completed Season + >=2 Core links + >=75% ratio, and `SUPPORTED` requires explicit user confirmation.
6. **R2 P1-08:** MAIN Quest cardinality is restored to `0..1`; a MAIN Quest is no longer required for activation.
7. **R2 P2-01:** `foldRewardLedger` now fails closed on impossible negative reserved/redeemed states rather than silently clamping them.
8. **R2 P2-02/P2-03/P2-05:** frozen `active` terminology, Reward field names, and threshold-specific Mastery source identity are materially improved.

These closures do not override the blockers below.

---

# 3. P0 finding — architecture security blocker

## P0-01 — Direct-write foreign-key surfaces still permit forgeable cross-tenant references

**Affected:**
- `09_DATABASE_SCHEMA_PLAN.md`
- `02_OUTER_LOOP_AUTHORITY_RULES.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`
- controlling document §14

The controlling document states:

```text
cross-entity links must prove both ends belong to the same user
```

and explicitly classifies:

```text
Any cross-tenant reference that can be forged by an authenticated user is a P0.
```

The current schema plan still contains direct-write surfaces where RLS only checks the child row's `user_id`, while the referenced foreign entity ownership is not structurally proven.

The clearest example is `season_quests`:

```text
RLS Policy Intent:
SELECT, INSERT, DELETE allowed for auth.uid() = user_id

Write Authority:
RPC-only rpc_link_season_quest / rpc_unlink_season_quest
because both Season and Quest ownership must be asserted
```

These two statements are incompatible. Under the documented RLS intent, User A can construct a join row with:

```text
user_id   = User A
season_id = User A's Season
quest_id  = User B's Quest
```

The ordinary FK proves only that the Quest exists; `auth.uid() = season_quests.user_id` does not prove that the referenced Quest belongs to User A. This bypasses the exact ownership assertion that the RPC is supposed to guarantee.

The same structural pattern needs audit wherever direct-write child rows contain foreign IDs, including at minimum:

```text
journal_entries -> season_id / quest_id / activity_id
strategy_versions -> strategy_id
Phase 8G focus_sessions -> quest_id / activity_id
Phase 8G protocol_versions -> protocol_id
```

**Required correction:** choose an enforceable fail-closed pattern for every such relation. Acceptable examples include:

- deny direct client INSERT/UPDATE for relationship-bearing rows and require ownership-validating RPCs;
- use composite tenant-aware foreign keys such as `(user_id, target_id)` -> `(user_id, id)` where practical;
- use database triggers / RLS `WITH CHECK` subqueries that verify ownership of every referenced target;
- retain redundant ownership validation inside RPCs.

`season_quests` must not simultaneously be documented as direct INSERT/DELETE-capable and RPC-only.

Until no authenticated caller can forge a cross-tenant reference, Phase 8A cannot be frozen.

---

# 4. P1 findings — blocking architecture defects

## P1-01 — Season authority guard protects the wrong timestamp field names

**Affected:**
- `02_OUTER_LOOP_AUTHORITY_RULES.md`
- `09_DATABASE_SCHEMA_PLAN.md`

The canonical Season schema defines:

```text
started_at
ended_at
```

but the direct-write authority guard is specified against:

```text
activated_at
concluded_at
```

Those fields do not exist in the same canonical schema.

Therefore `trg_enforce_season_field_authority` is not implementable as written and does not freeze protection for the actual lifecycle timestamps.

**Required correction:** use one exact vocabulary everywhere. At minimum, direct client metadata editing must be unable to mutate:

```text
status
started_at
ended_at
```

and any other lifecycle authority fields that are RPC-owned. The trigger, schema, authority document, and RPC contracts must use identical names.

---

## P1-02 — FINAL Review amendment/versioning remains impossible after Season terminalization, and conclude uses an incompatible commit-key type

**Affected:**
- `03_SEASON_AND_REVIEW_SPEC.md`
- `09_DATABASE_SCHEMA_PLAN.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

The domain specification correctly states that finalized Reviews are immutable and later corrections/amendments create a new superseding version.

But the write contracts do not provide a valid path for a FINAL Review amendment after the Season becomes terminal:

```text
rpc_finalize_season_review:
review_type = WEEKLY | AD_HOC only
Season must be ACTIVE

rpc_conclude_season:
Season must be ACTIVE
creates FINAL and terminalizes the Season
```

After `COMPLETED` / `ENDED_EARLY`, neither RPC can create a superseding FINAL review. This contradicts the frozen version/supersession model.

There is also a direct type mismatch:

```text
season_reviews.commit_key = uuid NOT NULL
```

while `rpc_conclude_season` accepts:

```text
p_request_idempotency_key = text
```

and specifies:

```text
commit_key = p_request_idempotency_key
```

No canonical cast/derivation contract is defined.

**Required correction:**

- freeze one type for the durable Review commit identity;
- for atomic Season conclusion, accept an explicit `p_final_review_commit_key uuid`, or make the external request key itself UUID everywhere;
- define a terminal-Season FINAL amendment path that creates a new immutable version without reopening or re-terminalizing the Season;
- retain parent-Season serialization and explicit supersession semantics.

---

## P1-03 — Phase 8B Season conclusion has an illegal forward dependency on Phase 8E Reward infrastructure

**Affected:**
- `10_API_AND_RPC_CONTRACT_PLAN.md`
- `12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md`
- controlling document §5

The binding implementation sequence is:

```text
8B Season + Review
8C Journal
8D Strategy
8E Reward + Wishes
8F Milestones
```

The Phase 8B scope contains only Season/Review governance tables and does not include Reward tables/RPCs.

However, `rpc_conclude_season` currently specifies:

```text
If COMPLETED:
call server-authoritative rpc_grant_reward_credit
```

`rpc_grant_reward_credit` belongs to Phase 8E and cannot exist during an independently implementable/acceptable Phase 8B.

This reverses the dependency chain and prevents Phase 8B from satisfying its own frozen scope without prematurely implementing Phase 8E.

**Required correction:** remove Reward settlement from Phase 8B Season terminalization. Phase 8B should persist the terminal Season + confirmed FINAL Review + audit only. When Phase 8E is later authorized, Reward eligibility can read already-completed Season truth and mint idempotently under the Phase 8E policy.

If an automatic bridge is desired later, design it in Phase 8E without making the earlier Phase 8B RPC depend on future infrastructure.

---

## P1-04 — Proposal replay/idempotency contract references a persistence field that does not exist

**Affected:**
- `08_AI_GM_OUTER_LOOP_CONTRACT.md`
- `09_DATABASE_SCHEMA_PLAN.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

`rpc_review_outer_loop_proposal` attempts to distinguish exact retry from a second/concurrent review by checking:

```text
proposal.request_idempotency_key
```

But neither the canonical `OuterLoopProposal` envelope nor the database schema defines such a persisted field.

The current schema contains proposal status, payload/provenance metadata, timestamps, and result pointers, but no durable review request identity. Therefore the documented CAS replay branch cannot be implemented as written:

```text
same decision + same request key -> HTTP 200 prior result
other second attempt -> HTTP 409
```

**Required correction:** add a durable review-commit/request identity with tenant-scoped uniqueness, or define a separate immutable mutation receipt/audit lookup contract and make the RPC explicitly use it. The same-key replay path must be mechanically distinguishable from a new key and a true concurrent loser.

---

## P1-05 — Milestone persistence and revocation contracts are incomplete and do not match the API plan

**Affected:**
- `07_MILESTONE_ACHIEVEMENT_SPEC.md`
- `09_DATABASE_SCHEMA_PLAN.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

The Milestone API plan requires/persists concepts including:

```text
recognition_class
source_type
source_id
evidence_url
granted_reward_credit
reward_transaction_id
```

and `rpc_settle_milestone_reward` checks:

```text
granted_reward_credit = false
```

But the Milestone schema plan does not freeze the required source/proof/grant fields as a coherent table contract. It also omits item 15 (`Idempotency / Dedup Rule`) despite claiming a uniform 16-point schema contract.

More importantly, the Milestone lifecycle explicitly includes:

```text
ACTIVE -> REVOKED / CORRECTED
```

and the Milestone spec requires invalidation to:

```text
1. mark milestone REVOKED
2. write audit
3. append reward CORRECTION when applicable
```

Yet the 21-RPC catalogue contains confirmation and reward settlement only; it has no `rpc_revoke_milestone` / correction contract that performs this history-bearing multi-record settlement atomically.

This leaves O005's advertised milestone-revocation path undefined.

**Required correction:**

- freeze all required Milestone provenance/reward fields and their types;
- add the missing idempotency/dedup contract;
- define a revocation/correction RPC with authentication, ownership, source invalidation proof, locks, status transition, optional Reward CORRECTION, audit, retry identity, replay behavior, and cross-tenant handling;
- keep Milestone history append-/status-preserving rather than destructive.

---

# 5. P2 findings — must close before architecture freeze

## P2-01 — Strategy `SUPPORTED` threshold language is still inconsistent outside the core Strategy documents

The primary Strategy spec/domain/API now correctly use:

```text
>=4 distinct dates
>=1 completed Season
>=2 Core links
>=75% support ratio
confidence >= HIGH
explicit user confirmation
```

But stale weaker language remains:

- `02_OUTER_LOOP_AUTHORITY_RULES.md` describes the cross-time gate as at least two observations;
- `12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md` labels the Phase 8D strict threshold as `>=2 distinct dates`;
- O009 in `11_TESTING_SECURITY_AND_HARNESS_PLAN.md` only proves that two observations on the **same day** fail, and does not prove that 2–3 distinct dates still fail the new >=4 rule.

**Fix:** distinguish clearly between “minimum evidence exists” and “eligible for SUPPORTED”, or normalize all implementation/acceptance language to the canonical >=4 promotion gate. Add a harness case for 3 distinct dates + otherwise-satisfied criteria remaining non-SUPPORTED.

---

## P2-02 — `UNRESERVED` appears as a Wish status even though it is not in the frozen lifecycle

`09_DATABASE_SCHEMA_PLAN.md` states that status transitions to:

```text
PRIMARY, RESERVED, REDEEMED, UNRESERVED
```

are RPC-only.

There is no `UNRESERVED` Wish status. Unreserve is the transition:

```text
RESERVED -> PRIMARY
```

via `rpc_unreserve_wish_credits`.

**Fix:** remove `UNRESERVED` as a status token and use the canonical transition wording.

---

## P2-03 — Generic RLS wording still contradicts the per-table least-privilege model

`02_OUTER_LOOP_AUTHORITY_RULES.md` §5 says all tables have explicit `auth.uid() = user_id` policies for:

```text
SELECT, INSERT, UPDATE, DELETE
```

while §6 and `09_DATABASE_SCHEMA_PLAN.md` correctly deny or restrict direct write verbs for proposals, ledgers, receipts, reviews, strategies, etc.

**Fix:** replace the generic CRUD statement with “RLS / privileges are per-table least-privilege and no weaker than `auth.uid() = user_id`”, then reference the exact authority matrix.

---

## P2-04 — Concurrent Wish redemption error taxonomy is still inconsistent

The replay distinction is improved, but the exact concurrent-loser error remains inconsistent:

- `11_TESTING_SECURITY_AND_HARNESS_PLAN.md` O019 expects `409 WISH_ALREADY_REDEEMED`;
- `06_REWARD_ECONOMY_AND_WISHES_SPEC.md` uses `409 CONCURRENT_MODIFICATION`;
- `10_API_AND_RPC_CONTRACT_PLAN.md` allows `CONCURRENT_MODIFICATION / WISH_NOT_RESERVED`.

Architecture freeze requires one deterministic contract.

**Fix:** choose one canonical concurrent-loser error code/status and use it identically in Reward spec, RPC contract, and O019 harness assertion. Exact same-key replay remains HTTP 200 with the prior receipt.

---

# 6. R2 finding closure matrix

| R2 finding | R3 result | Notes |
|---|---|---|
| P1-01 FINAL Review / Season ordering | CORE CLOSED, FOLLOW-ON OPEN | Atomic conclusion fixed; FINAL amendment path/type mismatch remains P1-02. |
| P1-02 Reward reversal/refund | CLOSED | Structural correction/refund identities and terminal Wish semantics accepted. |
| P1-03 RPC authority enforcement | OPEN / ESCALATED | `season_quests` direct-write bypass creates P0 cross-tenant risk; Season trigger fields also wrong. |
| P1-04 Review idempotency/concurrency | PARTIALLY CLOSED | Commit key + row lock fixed; terminal FINAL supersession and conclude key type remain. |
| P1-05 StrategySupport de-dup | CLOSED | Non-null source identity accepted; cross-tenant enforcement still governed by P0-01. |
| P1-06 Strategy lifecycle/confidence | SUBSTANTIALLY CLOSED | Core documents aligned; stale >=2 implementation/harness wording remains P2-01. |
| P1-07 Write contract coverage | OPEN | Milestone revocation/correction contract still absent. |
| P1-08 MAIN cardinality | CLOSED | 0..1 restored. |
| P2-01 ledger fail-closed | CLOSED | Impossible negative reserved/redeemed states throw. |
| P2-02 Core/RPC residue | CLOSED | `active` and canonical Strategy RPC names corrected. |
| P2-03 Reward field parity | CLOSED | `net_earned`, request key, cache semantics aligned. |
| P2-04 Replay semantics | PARTIALLY CLOSED | Core same-key/new-key distinction improved; proposal persistence and O019 error drift remain. |
| P2-05 Mastery source identity | CLOSED | M6/M8/M10 use threshold-specific composite source identity. |
| P2-06 audit provenance | SUBSTANTIALLY CLOSED | Required audit provenance columns now explicit; keep compatibility with compound settlements under future implementation review. |

---

# 7. Mandatory R3 corrective scope

Continue on the existing PR #31 branch only:

```text
docs/phase8a-outer-loop-architecture-freeze
```

Allowed:

```text
docs/Phase8/**
PR #31 metadata if needed
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

Mandatory objectives:

1. eliminate all forgeable cross-tenant reference paths, especially `season_quests` and every direct-write FK-bearing table;
2. align Season authority guards to actual `started_at` / `ended_at` fields;
3. define a type-safe, retry-safe FINAL Review commit identity and a terminal FINAL-review amendment/supersession path;
4. remove the Phase 8B -> Phase 8E Reward forward dependency from Season conclusion;
5. persist a real proposal-review idempotency identity or equivalent immutable mutation receipt;
6. complete Milestone provenance schema and add atomic revocation/correction RPC contract;
7. normalize Strategy >=4 promotion language and test catalogue;
8. remove `UNRESERVED` pseudo-status;
9. normalize generic RLS wording to the per-table least-privilege model;
10. freeze one exact O019 concurrent redemption error code.

After correction, perform a full cross-document audit, not keyword replacement.

---

# 8. R4 Gate requirements

A future R4 may return GO only if independent GitHub inspection verifies all of the following at one exact head:

```text
P0 = 0
P1 = 0
P2 = 0
```

and:

```text
PR #31 remains open/unmerged until Gatekeeper authorization
base remains the authorized main baseline unless independently re-authorized
scope remains docs/Phase8/** only
Exact-Head pull_request CI is completed/success
check = success
supabase-integration = success
O001-O022 specifications = SOURCE VERIFIED
O001-O022 Phase 8 runtime = NOT VERIFIED
Phase 8 production implementation = NOT STARTED
Phase 7 = FINAL FROZEN — unchanged
```

Only after those conditions are independently verified may the Gatekeeper authorize merge and Phase 8A FINAL FROZEN.
