# Phase 8A — Outer Growth Loop Architecture Freeze — R4 Independent Review

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`  
**Reviewer:** Independent Review AI / Gatekeeper  
**Review date:** 2026-09-16  
**PR:** #31  
**Authoritative main baseline:** `0a85de522503cf3f0a656f74f248c9a65e7b5da5`  
**Reviewed Exact Head:** `061738ac70e566d573fbae27fec7d4eddf5f8bcd`  
**Phase 8A controlling document:** `422f55656881633ecebddcd2f08a5bff02db8f58`  
**R1 independent review:** `107513a14e0472ecd02c20aea5f67b1693fed649`  
**R2 independent review:** `c79fc38d2f765ebbad2fa9cc68b625e700840ef5`  
**R3 independent review:** `6cf1cc9186b6e9524ce5f33e45cecc5c4828c258`  

---

# 0. Final R4 adjudication

```text
P0 = 0
P1 = 4
P2 = 2

PHASE 8A R4 ACCEPTANCE = NO-GO -> NEED_FIX
PR #31 MERGE AUTHORIZED = NO
PHASE 8A FINAL FROZEN = NO
PHASE 8B IMPLEMENTATION = BLOCKED
PHASE 7 FINAL FROZEN = YES — unchanged
PHASE 8 PRODUCTION IMPLEMENTATION = NOT STARTED
```

R3 corrective work materially closes the prior cross-tenant P0 and all four prior P2 findings. Exact-head CI is green and the PR remains strictly docs-only. However, Phase 8A is an architecture freeze, so schema/RPC/state contracts must be mutually implementable. The R4 Exact Head still contains four P1 implementation-contract conflicts plus two P2 cross-document vocabulary/lifecycle gaps. No merge is authorized.

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
head_sha: 061738ac70e566d573fbae27fec7d4eddf5f8bcd
commits: 4
changed_files: 14
additions: 3494
deletions: 0
```

`main` independently remains exactly:

```text
0a85de522503cf3f0a656f74f248c9a65e7b5da5
```

Base-to-head compare is `ahead_by=4`, `behind_by=0`, and the complete file set is exactly the fourteen declared `docs/Phase8/**` documents. There is no `src/**`, `tests/**`, `supabase/**`, `.github/**`, dependency, lock-file, or root-governance drift.

Classification:

```text
DOCS-ONLY SCOPE = SOURCE VERIFIED / PASS
PRODUCTION CODE DRIFT = NOT PRESENT
PHASE 8 PRODUCTION IMPLEMENTATION = NOT STARTED
```

## 1.2 Exact-Head CI

Independent workflow lookup resolves the exact PR head to:

```text
run: 35073826560
event: pull_request
head_sha: 061738ac70e566d573fbae27fec7d4eddf5f8bcd
base_sha: 0a85de522503cf3f0a656f74f248c9a65e7b5da5
status: completed
conclusion: success

check: completed / success
supabase-integration: completed / success
```

The `check` job includes lint/test/build. The `supabase-integration` job includes database-backed tests, deterministic Growth Engine harness, and E2E.

Classification:

```text
EXACT-HEAD EXISTING CI = RUNTIME VERIFIED / GREEN
```

This only proves the docs-only change does not regress the currently implemented frozen system. Phase 8 runtime behavior does not exist yet.

## 1.3 Evidence language

Accepted canonical evidence language remains:

```text
O001–O022 specifications = SOURCE VERIFIED
O001–O022 Phase 8 runtime = NOT VERIFIED
```

Phase 7 remains `FINAL FROZEN`; this review does not reopen Phase 7.

---

# 2. R3 finding closure verification matrix

| R3 Finding | R4 Result | Independent verification |
|---|---|---|
| P0-01 Cross-tenant FK enforcement | **CLOSED** | `season_quests` direct writes are denied; link/unlink are RPC-only; tenant triggers are specified for Season↔Quest, Journal foreign references, StrategyVersion, StrategySupport, FocusSession, and ProtocolVersion. |
| P1-01 Season authority field names | **CLOSED** | Canonical guarded fields are `status`, `started_at`, `ended_at`, `abandonment_reason`; full PR scan contains no `activated_at` or `concluded_at`. |
| P1-02 FINAL Review amendment + commit identity | **OPEN** | UUID commit-key separation is corrected, but the amendment RPC inserts `supersedes_id`, which does not exist in the `season_reviews` schema. It also updates prior `superseded_by_id` while the schema declares the entire prior review row immutable. See P1-R4-01. |
| P1-03 Phase 8B -> 8E forward dependency | **CLOSED** | `rpc_conclude_season` explicitly performs zero Reward minting; 8E later reads historical completed Season truth. |
| P1-04 Proposal review idempotency | **OPEN** | Durable review key and CAS semantics exist, but RPC/schema naming is still not closed: the RPC writes `updated_at`, absent from the proposal schema, and schema/AI contract use `p_request_idempotency_key` while the canonical RPC parameter is `p_review_request_idempotency_key`. See P1-R4-02. |
| P1-05 Milestone persistence + revocation | **OPEN** | Source/reward fields and revoke RPC were added, but revocation request identity is not durably separable from the original confirmation request identity, and the revoke fold description contradicts canonical ledger semantics. See P1-R4-03. |
| P2-01 Strategy threshold parity | **CLOSED** | 01/02/05/10/11/12 align on >=4 distinct dates, >=1 completed Season, >=2 Core links, >=75% support ratio, confidence >=HIGH, explicit user confirmation. O009 includes the 3-date rejection boundary. |
| P2-02 UNRESERVED pseudo-status | **CLOSED** | Canonical Wish state transition is `RESERVED -> PRIMARY` through `rpc_unreserve_wish_credits`; remaining `UNRESERVED` wording is only an audit/event label, not a lifecycle state. |
| P2-03 Least-privilege RLS wording | **CLOSED** | Authority rules now specify per-table least privilege and explicitly deny client writes on RPC-only tables. |
| P2-04 O019 error taxonomy | **CLOSED** | Reward spec, RPC contract, and O019 all use HTTP 409 `WISH_ALREADY_REDEEMED` for the concurrent loser. |

---

# 3. P1 findings — blocking architecture defects

## P1-R4-01 — FINAL Review amendment schema and immutability contract are still internally inconsistent

**Affected:**
- `03_SEASON_AND_REVIEW_SPEC.md`
- `09_DATABASE_SCHEMA_PLAN.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

Accepted corrective pieces:

```text
season_reviews.commit_key = UUID NOT NULL
rpc_conclude_season.p_final_review_commit_key = uuid
rpc_amend_final_season_review = defined
terminal Season remains terminal
parent Season row is locked before version allocation
```

But the RPC inserts:

```text
supersedes_id = prior_review.id
```

while the `season_reviews` schema defines only:

```text
superseded_by_id
```

and no `supersedes_id` column/FK.

The same schema states that the **entire review record is immutable once inserted**, yet the amendment RPC requires:

```text
UPDATE prior_review.superseded_by_id = new_row.id
```

Those rules cannot both be implemented literally.

**Required correction:** choose and freeze one version-link model. Recommended minimal model:

```text
season_reviews.superseded_by_id UUID NULL FK season_reviews(id)
```

with an explicit immutability boundary:

```text
review payload/content/provenance = immutable
superseded_by_id = one-time system-managed linkage metadata
```

Do not write undefined `supersedes_id`. Alternatively add a real `supersedes_id` field and make all documents/schema consistent, but only one canonical model may remain.

---

## P1-R4-02 — Proposal review replay mechanism still has schema/RPC field-name drift

**Affected:**
- `08_AI_GM_OUTER_LOOP_CONTRACT.md`
- `09_DATABASE_SCHEMA_PLAN.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

The durable idempotency architecture is conceptually correct, but the frozen contract is not exact:

1. `rpc_review_outer_loop_proposal` updates:

```text
updated_at = clock_timestamp()
```

while `outer_loop_proposals` schema timestamps contain `created_at`, `reviewed_at`, and `expires_at`, but no `updated_at`.

2. The canonical RPC input names:

```text
p_review_request_idempotency_key
```

but schema/AI-contract CAS text still uses:

```text
p_request_idempotency_key
```

for the same proposal-review mutation.

Architecture freeze cannot leave two executable signatures or an undefined column.

**Required correction:** either add and freeze `updated_at` everywhere or remove it from the RPC. Standardize the proposal review request parameter everywhere to exactly one name, preferably `p_review_request_idempotency_key`.

---

## P1-R4-03 — Milestone revocation idempotency and Reward fold semantics are not closed

**Affected:**
- `06_REWARD_ECONOMY_AND_WISHES_SPEC.md`
- `07_MILESTONE_ACHIEVEMENT_SPEC.md`
- `09_DATABASE_SCHEMA_PLAN.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

The new Milestone schema has a single:

```text
request_idempotency_key text NOT NULL
UNIQUE(user_id, request_idempotency_key)
```

which naturally stores the confirmation/create request identity. A later `rpc_revoke_milestone` receives a different `p_request_idempotency_key`, but no separate revocation request field or immutable mutation-receipt identity is frozen. Therefore the documented promise:

```text
same revocation request key replay -> HTTP 200 prior revoked state
```

has no explicit durable identity mechanism unless implementation silently repurposes/overwrites the original creation key or relies on unspecified audit lookup behavior.

Additionally `rpc_revoke_milestone` says re-folding a negative `CORRECTION` decrements `lifetime_earned`. The canonical `foldRewardLedger` defines `lifetime_earned` as gross cumulative positive earnings; negative `CORRECTION` changes `net_earned`, not `lifetime_earned`.

**Required correction:** define a durable per-mutation receipt/idempotency mechanism for revocation (e.g. audit-event lookup explicitly made part of the replay contract, or a dedicated `revocation_request_idempotency_key`), without overwriting the creation request identity. Align revocation balance effects exactly to canonical `foldRewardLedger`: negative correction reduces `net_earned`; gross `lifetime_earned` remains unchanged.

---

## P1-R4-04 — Season activation still introduces an unapproved mandatory linked-Quest prerequisite

**Affected:**
- Phase 8A controlling document §6.4
- `03_SEASON_AND_REVIEW_SPEC.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`

The controlling relation freezes:

```text
MAIN  = 0..1
FOCUS = 0..N
```

with Season as a time/context layer over Quests. That cardinality permits a Season with zero Quest links unless a separate controlling invariant says otherwise.

The current `rpc_activate_season` nevertheless requires:

```text
Must have at least 1 linked quest (MAIN or FOCUS)
NO_LINKED_QUESTS -> HTTP 422
```

This is a new implementation constraint not authorized by the controlling document and not represented as an ADR.

**Required correction:** remove the `>=1 linked quest` activation prerequisite and preserve the frozen cardinality, or submit an ADR explicitly requesting a controlling-invariant change for independent review. Do not silently strengthen `0..1 + 0..N` into `>=1 total`.

---

# 4. P2 findings — cross-document freeze cleanup

## P2-R4-01 — Proposal envelope vocabulary still omits `decision`

`09_DATABASE_SCHEMA_PLAN.md` and the proposal-review RPC freeze a first-class `decision` field, but the `OuterLoopProposal` diagram/attribute list in `08_AI_GM_OUTER_LOOP_CONTRACT.md` does not include or explain it. Either treat `status` as the sole decision and remove the redundant field, or add `decision` to the common proposal envelope everywhere. Do not freeze a partially documented duplicated authority field.

## P2-R4-02 — Milestone `CORRECTED` lifecycle state has no transition contract

The Milestone lifecycle enum is:

```text
ACTIVE | REVOKED | CORRECTED
```

and the Milestone prose says invalidated achievements may be marked `REVOKED` or `CORRECTED`, but only `ACTIVE -> REVOKED` has a defined RPC/state contract. Either define what `CORRECTED` means and how it is reached/versioned, or remove it from the initial lifecycle. An architecture freeze should not carry an unreachable authority state.

---

# 5. R4 acceptance gate

The R3 corrective is not accepted as final freeze because the remaining defects would force implementation-time invention or contract deviation.

Required next exact-head conditions:

```text
P0 = 0
P1 = 0
P2 = 0
DOCS-ONLY SCOPE = PASS
EXACT-HEAD CI = GREEN
O001–O022 specifications = SOURCE VERIFIED
O001–O022 Phase 8 runtime = NOT VERIFIED
PHASE 7 FINAL FROZEN = YES
PHASE 8 production implementation = NOT STARTED
```

Only then may the independent Gatekeeper authorize PR #31 merge and declare Phase 8A `FINAL FROZEN`.

After a future GO and merge, the exact Phase 8A merge commit SHA — not the absent `v1.0-core` tag — must be pinned by the independent Phase 8B controlling document as the immutable Phase 8B implementation baseline.
