# Phase 8A — Outer Growth Loop Architecture Freeze — R1 Independent Review

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`  
**Reviewer:** Independent Review AI / Gatekeeper  
**Review date:** 2026-09-15  
**PR:** #31 — `docs(phase8a): freeze Outer Growth Loop architecture`  
**Base:** `main@0a85de522503cf3f0a656f74f248c9a65e7b5da5`  
**Reviewed Exact Head:** `dc4a70f6df4b9c79e266747eeca8204d41701831`  
**Controlling document:** `review/phase8a-architecture-freeze-planning-20260913@422f55656881633ecebddcd2f08a5bff02db8f58`  
**Phase 7:** `FINAL FROZEN — unchanged`  
**Phase 8 production implementation:** `NOT AUTHORIZED`

---

# 0. Final verdict

```text
P0 = 0
P1 = 6
P2 = 4

PHASE 8A ARCHITECTURE FREEZE:
NO-GO -> NEED_FIX

PR #31 MERGE AUTHORIZED:
NO

PHASE 7 FINAL FROZEN:
YES — unchanged

PHASE 8B IMPLEMENTATION:
BLOCKED
```

The package is mechanically clean and contains substantial correct architecture work, but it is **not yet internally safe enough to freeze as the implementation authority for Phase 8B–8G**. The blockers are not stylistic. They affect reward accounting correctness, anti-double-mint authority, compatibility with frozen Core semantics, lifecycle determinism, schema enforceability, and retry/atomicity contracts.

No merge is authorized at this Exact Head.

---

# 1. Independent evidence summary

## 1.1 PR identity and topology — SOURCE VERIFIED

Independent GitHub inspection confirms:

```text
PR:            #31
state:         OPEN
merged:        false
mergeable:     true
draft:         false
base:          main
base_sha:      0a85de522503cf3f0a656f74f248c9a65e7b5da5
head:          docs/phase8a-outer-loop-architecture-freeze
head_sha:      dc4a70f6df4b9c79e266747eeca8204d41701831
commits:       1
changed_files: 14
additions:     2473
deletions:     0
```

`compare(base, head)` is `ahead_by=1 / behind_by=0`, and the merge base is exactly the authorized main baseline.

Current `main` remains:

```text
0a85de522503cf3f0a656f74f248c9a65e7b5da5
```

No baseline drift occurred during this review.

## 1.2 Docs-only scope — SOURCE VERIFIED / PASS

Exactly fourteen files changed, all under `docs/Phase8/**`:

```text
docs/Phase8/00_PHASE8_MASTER_ROADMAP.md
docs/Phase8/01_OUTER_LOOP_DOMAIN_MODEL.md
docs/Phase8/02_OUTER_LOOP_AUTHORITY_RULES.md
docs/Phase8/03_SEASON_AND_REVIEW_SPEC.md
docs/Phase8/04_JOURNAL_AND_STATE_SPEC.md
docs/Phase8/05_STRATEGY_PLAYBOOK_SPEC.md
docs/Phase8/06_REWARD_ECONOMY_AND_WISHES_SPEC.md
docs/Phase8/07_MILESTONE_ACHIEVEMENT_SPEC.md
docs/Phase8/08_AI_GM_OUTER_LOOP_CONTRACT.md
docs/Phase8/09_DATABASE_SCHEMA_PLAN.md
docs/Phase8/10_API_AND_RPC_CONTRACT_PLAN.md
docs/Phase8/11_TESTING_SECURITY_AND_HARNESS_PLAN.md
docs/Phase8/12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md
docs/Phase8/ADR/README.md
```

There is zero drift in:

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

This part of the Phase 8A authorization was followed correctly.

## 1.3 Exact-head CI — RUNTIME VERIFIED / PASS

Independent lookup of workflow runs attached to Exact Head `dc4a70f6...` found:

```text
CI run:      34984978085
event scope: pull-request exact-head run
status:      completed
conclusion:  success

check:                 completed / success
supabase-integration:  completed / success
```

The integration job includes successful production build, DB-backed tests, deterministic Growth Engine harness, and E2E execution.

Important evidence boundary: this CI proves the docs-only PR did not regress the existing executable baseline. The proposed Phase 8 O001–O022 cases are **SOURCE VERIFIED as architecture specifications only**; they are **NOT RUNTIME VERIFIED** because Phase 8 production implementation is intentionally not present in Phase 8A.

---

# 2. Architecture areas that are correctly aligned

The following decisions are materially aligned with the controlling document and should be preserved during correction:

- binding sequence `8B Season+Review -> 8C Journal+State -> 8D Strategy -> 8E Reward -> 8F Milestone -> 8G optional`;
- `Season <-> Quest = N:N`, with `MAIN | FOCUS`, and at most one MAIN per Season;
- at most one ACTIVE Season per user at database level;
- no `Activity.season_id`; default Season Activity membership is a derived read model;
- Review is conceptually separate from Journal and cannot create XP/Mastery/Evidence truth;
- `Journal != Verified Evidence` and subjective state is isolated from permanent capability;
- Strategy requires cross-time support and AI cannot independently publish `SUPPORTED`;
- Strategy confidence is intended as deterministic derived state rather than LLM truth;
- XP is non-spendable and Reward is physically separated from `xp_transactions`;
- no generic Goal domain, no PastSelf table, no Streak domain, no XP wallet;
- unified `OuterLoopProposal` proposal-only authority pattern;
- tenant ownership / RLS / cross-reference ownership intent is present at the system level;
- O001–O022 test catalogue exists and covers the intended four verification layers.

These are not the cause of the NO-GO.

---

# 3. P1 findings — must close before R2

## P1-01 — Reward Ledger canonical accounting is mathematically incomplete

**Affected:**
- `docs/Phase8/06_REWARD_ECONOMY_AND_WISHES_SPEC.md`
- `docs/Phase8/09_DATABASE_SCHEMA_PLAN.md`

The package describes `reward_transactions` as a “double-entry” ledger, but the proposed schema is actually a **single-account append-only event ledger**. No paired debit/credit accounts or balanced postings exist. The term is therefore architecturally misleading unless a real double-entry model is introduced.

More importantly, the published canonical balance formulas are incorrect for the declared event model.

Current `LifetimeEarned` includes positive corrections but omits negative corrections. Example:

```text
EARN +100
CORRECTION -20
```

With no deficit condition, the published formula still yields 100 earned / 100 available instead of the required 80-equivalent net credit position.

`REFUND` is declared as a canonical event that restores credits, but it is absent from the canonical balance equations. A redeemed reward followed by a REFUND therefore has no defined authoritative balance effect.

This violates the controlling requirement that canonical balances be derivable reproducibly from ledger history or maintained with exact atomic ledger parity.

### Required correction

Define one deterministic canonical fold over every event class. At minimum specify each event's exact signed effect on:

```text
available
reserved
redeemed/lifetime_redeemed
net earned / correction deficit
```

The fold must cover all six events:

```text
EARN
CORRECTION
RESERVE
UNRESERVE
REDEEM
REFUND
```

and must define correction-deficit handling without silently discarding negative ledger history.

If retaining the current schema, rename it accurately as an **append-only event ledger**. Do not call it double-entry accounting unless actual balanced postings are designed.

---

## P1-02 — Reward mint authority and canonical source de-duplication are not fail-closed

**Affected:**
- `docs/Phase8/06_REWARD_ECONOMY_AND_WISHES_SPEC.md`
- `docs/Phase8/07_MILESTONE_ACHIEVEMENT_SPEC.md`
- `docs/Phase8/09_DATABASE_SCHEMA_PLAN.md`
- `docs/Phase8/10_API_AND_RPC_CONTRACT_PLAN.md`

`rpc_grant_reward_credit` accepts both:

```text
p_amount
p_idempotency_key
```

as request inputs. The contract does not require the authoritative amount to be recomputed from a deterministic versioned server policy, nor does the database enforce the frozen one-time source identity:

```text
(user_id, source_type, source_id, policy_version, event_kind)
```

A caller/retry path can therefore vary `p_idempotency_key` for the same source and defeat `UNIQUE(idempotency_key)` unless additional undocumented validation exists. That is incompatible with O10's anti-farming guarantee.

There is a second de-duplication problem: the docs permit direct Reward EARN from Quest/Mastery/Artifact **and** permit a Milestone wrapping that same Core event to EARN again using `milestone_id` as its source key. The controlling document explicitly requires wrapper-level recognition not to reward the same underlying event twice.

There is also an authority mismatch for `USER_CONFIRMED_REAL_WORLD`: self-attestation is acceptable as a recognition record, but the controlling Reward source is an **independently confirmed real-world milestone**. A self-attested recognition must not automatically become an authoritative credit faucet.

### Required correction

Freeze a single canonical issuance identity and enforce it at DB/RPC level. Required properties:

1. authoritative credit amount is derived/validated server-side from `policy_version + verified source`, not trusted from caller input;
2. canonical source identity is derived server-side;
3. DB unique constraint/index or equivalent settlement table guarantees one EARN per canonical source/policy/event;
4. changing a request idempotency key cannot mint a second grant;
5. Core-backed Milestones must de-duplicate against the **underlying Core source**, not merely the Milestone wrapper ID;
6. `USER_CONFIRMED_REAL_WORLD` recognition and **reward eligibility** must be separate concepts; only independently validated/policy-eligible real-world milestones may mint credit.

---

## P1-03 — Phase 8 docs silently drift from frozen Core vocabulary and fields

**Affected:**
- `docs/Phase8/01_OUTER_LOOP_DOMAIN_MODEL.md`
- `docs/Phase8/02_OUTER_LOOP_AUTHORITY_RULES.md`
- `docs/Phase8/06_REWARD_ECONOMY_AND_WISHES_SPEC.md`
- `docs/Phase8/07_MILESTONE_ACHIEVEMENT_SPEC.md`

Independent source inspection of the frozen Core confirms:

```text
Mastery:
M0 Unknown
M1 Exposure
M2 Understand
M3 Recall
M4 Explain
M5 Apply
M6 Independent
...

QuestSize:
micro | minor | standard | major | epic | main

QuestStatus:
locked | available | active | paused | completed | failed | archived

Quest also carries:
isMainQuest
isBoss
```

PR #31 instead contains incompatible language such as:

```text
Mastery Level 3 = Proficient
Mastery Level 4 = Advanced
Mastery Level 5 = Master
```

and reward eligibility proof such as:

```text
Quest.tier IN ('MAJOR', 'EPIC', 'BOSS')
Quest.status = 'COMPLETED'
```

The frozen Quest domain has no `tier` field and no `BOSS` QuestSize enum. Boss is represented separately. The persisted/current status vocabulary is lowercase.

`01_OUTER_LOOP_DOMAIN_MODEL.md` also sketches `Activity.activity_time`, while the frozen Activity contract exposes `createdAt` / database `created_at` and the Season derivation spec elsewhere uses `created_at`.

`02_OUTER_LOOP_AUTHORITY_RULES.md` additionally characterizes XP as “monotonic”; the frozen Core supports correction transaction semantics, so Phase 8 must not introduce a stronger monotonicity claim unless the Core authority explicitly guarantees it.

### Required correction

Use frozen Core names and fields exactly. Do not invent alternate mastery labels, Quest tier fields, status enums, or Activity time fields.

For reward eligibility, specify a deterministic mapping against the real Core model, for example using authoritative `quest_size` plus `is_boss`, rather than a new `tier` domain.

---

## P1-04 — Cross-document lifecycle machines contradict the controlling freeze

**Affected:**
- `docs/Phase8/01_OUTER_LOOP_DOMAIN_MODEL.md`
- `docs/Phase8/03_SEASON_AND_REVIEW_SPEC.md`
- `docs/Phase8/06_REWARD_ECONOMY_AND_WISHES_SPEC.md`
- `docs/Phase8/09_DATABASE_SCHEMA_PLAN.md`
- `docs/Phase8/10_API_AND_RPC_CONTRACT_PLAN.md`

Three material contradictions exist.

### A. Wish lifecycle

`01_OUTER_LOOP_DOMAIN_MODEL.md` defines:

```text
BACKLOG -> ACTIVE -> REDEEMABLE -> RESERVED -> REDEEMED
```

The controlling document freezes:

```text
IDEA -> ACTIVE -> PRIMARY -> RESERVED -> REDEEMED
IDEA/ACTIVE/PRIMARY -> ARCHIVED | CANCELLED
RESERVED -> PRIMARY
```

`06` and `09` mostly follow the controlling lifecycle. `01` does not.

### B. Season activation

The controlling doc and `03` freeze:

```text
DRAFT -> PLANNED -> ACTIVE
```

but `10_API_AND_RPC_CONTRACT_PLAN.md` allows:

```text
DRAFT -> ACTIVE
PLANNED -> ACTIVE
```

That bypasses the explicit PLANNED state contract.

### C. Review lifecycle

`01` defines a persistent Review lifecycle:

```text
DRAFT -> CONFIRMED -> SUPERSEDED
```

but `09` defines `season_reviews` without a lifecycle/status field, while `10` directly inserts a finalized FINAL review during Season conclusion.

Both designs can be valid individually, but the architecture freeze cannot contain both. If draft Review content lives only in `OuterLoopProposal`, then the persistent `SeasonReview` should be explicitly “finalized/supersedable record only.” If a persistent draft state is required, the schema/API must represent it consistently.

### Required correction

Publish one canonical state machine per domain and make all fourteen docs consume that same vocabulary. No alternate state names or shortcut transitions.

---

## P1-05 — Database schema plan does not meet the controlling per-table contract and contains unenforceable semantics

**Affected:**
- `docs/Phase8/09_DATABASE_SCHEMA_PLAN.md`

The controlling document requires **every proposed table** to specify:

```text
purpose / authority class
PK / FK
user ownership
unique / partial unique constraints
lifecycle fields
immutable fields
timestamps
indexes
FK delete behavior
RLS intent
correction / versioning behavior
write authority: direct vs RPC
migration order
```

The schema plan provides these inconsistently. Several tables omit RLS intent, explicit write authority, FK deletion policy, immutability/correction rules, or lifecycle enforcement. Important examples include `strategies`, `strategy_versions`, `strategy_supports`, `reward_accounts`, `wishes`, and `milestones`.

Two mandatory concurrency safeguards are also missing structurally:

- `strategy_supports` has no source-identity de-duplication constraint although the controlling doc explicitly requires Strategy support insertion to be de-duplicated by source identity;
- final Review creation/finalization has no explicit retry/idempotency structure even though it must be retry-safe.

The Season schema also states:

```text
ON DELETE RESTRICT if status has ever been ACTIVE
```

This is not a valid conditional FK action. `ON DELETE` behavior cannot dynamically depend on a row's historical lifecycle. The architecture must distinguish fixed FK actions from application/RPC/trigger/RLS rules that prohibit normal product deletion after activation.

### Required correction

Add a complete per-table contract matrix and make every required field explicit. Replace conditional pseudo-SQL delete semantics with an implementable normal-product deletion rule plus fixed FK behavior.

---

## P1-06 — API/RPC contract package is incomplete and not uniformly retry-safe

**Affected:**
- `docs/Phase8/10_API_AND_RPC_CONTRACT_PLAN.md`

The controlling doc requires every planned write API/RPC to specify:

```text
Authentication
Ownership checks
Input schema
Current-state precondition
Allowed transition
Idempotency key
Deterministic validation
Atomic side effects
Audit write
Error taxonomy
Replay behavior
Cross-tenant behavior
```

The current contracts do not meet that requirement uniformly.

Examples:

- `rpc_activate_season` has no explicit idempotency/replay contract and incorrectly allows `DRAFT -> ACTIVE`;
- `rpc_conclude_season` does not fully define idempotency/replay/locking semantics and does not carry the controlling `ABANDONED` termination-reason contract;
- `rpc_evaluate_strategy_status` does not fully define replay/idempotency and user-accepted hypothesis preconditions;
- `rpc_review_outer_loop_proposal` has no explicit concurrency lock/CAS/idempotency rule preventing simultaneous ACCEPT operations from creating duplicate domain records;
- correction settlement can be replayed with a different caller-provided key unless the target transaction itself is structurally de-duplicated;
- the package defines `UNRESERVE` and `REFUND` as ledger/lifecycle events but supplies no complete write contract for them;
- controlling high-risk Milestone confirmation with Reward issuance is not defined as an atomic contract;
- Strategy support insertion + status settlement lacks a canonical write contract;
- ordinary link/write operations are not summarized in a direct-write-vs-RPC authority matrix.

### Required correction

Complete the contract matrix for every state-changing path, including missing unreserve/refund/milestone/support operations. Every externally retried mutation must have an explicit server-authoritative retry policy and race behavior.

---

# 4. P2 findings — must also close for Phase 8A FINAL FROZEN

## P2-01 — Invariant IDs and Harness IDs are conflated

The controlling document defines architecture invariants `O1–O12` and test catalogue IDs `O001–O022`.

PR #31 starts using labels such as `O13`, `O14`, `O16`, `O17`, `O20`, `O21`, `O22` as if they are additional architecture invariants, while the harness simultaneously uses `O013`, `O016`, etc. Some labels also collide semantically; for example one document annotates the single PRIMARY Wish rule as `O16` while `O016` is the Review-does-not-create-Growth-Truth harness case.

This weakens audit traceability.

### Required correction

Keep namespaces distinct:

```text
Architecture invariants: O1..O12 only
Harness cases:          O001..O022
```

Use descriptive rule names for additional derived constraints, or introduce a new namespace only if the controlling document is formally amended.

Also correct “5-state Strategy lifecycle” wording: the frozen Strategy vocabulary contains six statuses (`HYPOTHESIS`, `TESTING`, `SUPPORTED`, `CONTEXTUAL`, `WEAKENED`, `RETIRED`).

---

## P2-02 — PR metadata contains immutable-anchor and formatting corruption

The PR body writes the authorized baseline without the leading zero (`a85de...`) and contains malformed escaped strings such as `\review/...`, `\reward_transactions`, plus damaged Season/Quest wording.

The actual PR base is correct; this is a metadata/documentation defect, not a topology defect.

### Required correction

Update the PR body after the corrective push so all immutable anchors and architecture statements exactly match the reviewed repository state.

---

## P2-03 — Phase 7 accessibility wording needs evidence-limit carry-forward

`00_PHASE8_MASTER_ROADMAP.md` summarizes Phase 7 as fully end-to-end accessible without carrying the known final-freeze limitations:

```text
VoiceOver:             NOT VERIFIED
NVDA:                  NOT VERIFIED
JAWS:                  NOT VERIFIED
physical touch device: NOT VERIFIED
```

Phase 7 remains FINAL FROZEN; these limitations were nonblocking. But Phase 8 documentation must not silently upgrade them into stronger runtime evidence.

### Required correction

Add a compact historical-evidence note preserving:

```text
emulated != physical device
source scan != runtime proof
```

Do not reopen Phase 7.

---

## P2-04 — `v1.0-core` tag gate remains unresolved and the Phase 8B prerequisite list omits it

Independent GitHub lookup of:

```text
refs/tags/v1.0-core
```

returned `404 Not Found`.

Therefore:

```text
v1.0-core tag: NOT PRESENT / NOT VERIFIED
```

The controlling document explicitly states that this does not block Phase 8A documentation, but Phase 8B production implementation may not begin until the reviewer either verifies the tag or explicitly replaces the tag gate with an immutable main-baseline declaration.

`12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md` currently lists Phase 8B prerequisite as only “Phase 8A accepted and merged,” which loses this gate.

### Required correction

Carry the gate honestly. Recommended path: do **not** create an arbitrary tag during this correction. State that the Phase 8B controlling document must pin the exact future Phase 8A merge commit as its immutable Core/Outer-architecture baseline, and that this Gatekeeper-pinned SHA explicitly replaces the absent `v1.0-core` tag gate.

---

# 5. Required R2 correction scope

R2 remains a docs-only Phase 8A correction. The execution AI must modify the existing PR #31 branch only.

Allowed:

```text
docs/Phase8/**
PR #31 body metadata
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

Do not create migrations or implementation code to “prove” the design.

Do not reopen Phase 7.

Do not start Phase 8B.

---

# 6. R2 acceptance gate

A new Exact Head is eligible for R2 review only if all of the following are true:

1. PR remains based on the same authorized main baseline unless Gatekeeper explicitly re-bases the controlling baseline.
2. Diff remains entirely `docs/Phase8/**`.
3. Reward ledger has a correct deterministic event fold covering all event kinds and correction deficit.
4. Reward EARN amount/source identity is server-authoritative and structurally de-duplicated against wrapper double-mint.
5. Self-attested real-world recognition cannot automatically mint credits without independent/policy-grade validation.
6. All frozen Core vocabulary/fields exactly match current Core authority.
7. Wish, Season, Review, Strategy state machines are identical across all docs and API/schema plans.
8. Every candidate table has the complete controlling §17 contract.
9. Every write path has the complete controlling §18 contract.
10. StrategySupport and Review finalization are explicitly retry/de-dup safe.
11. O1–O12 versus O001–O022 namespaces are clean.
12. Phase 7 AT/touch evidence limits are preserved without reopening Phase 7.
13. Absent `v1.0-core` gate is honestly replaced by a future Gatekeeper-pinned Phase 8A merge baseline declaration.
14. PR body immutable anchors are corrected.
15. New Exact-Head PR CI is `completed / success` for both `check` and `supabase-integration`.

Only after independent R2 re-review reaches:

```text
P0 = 0
P1 = 0
P2 = 0
```

may Phase 8A be declared `FINAL FROZEN` and PR #31 become merge-authorized.

---

# 7. Final state

```text
PR #31 R1:
NO-GO -> NEED_FIX

P0 = 0
P1 = 6
P2 = 4

DOCS-ONLY SCOPE:
PASS

EXACT-HEAD CI:
34984978085 = SUCCESS

PHASE 7:
FINAL FROZEN — unchanged

PHASE 8A:
NOT FROZEN

PHASE 8B:
BLOCKED

MERGE AUTHORIZED:
NO
```
