# Phase 8B — Season + Structured Review
## Independent Gatekeeper Controlling Architecture / Execution Document

> **Status**: IMPLEMENTATION CONTROL ACTIVE — ROUND 1 ONLY AUTHORIZED  
> **Gatekeeper**: Independent Review AI  
> **Authoritative implementation baseline**: `main@0dffb9d706c3c941c46078c89bf3ae6e70d65d5f`  
> **Phase 8A**: FINAL FROZEN  
> **Phase 7**: FINAL FROZEN — unchanged  
> **Phase 8B production implementation**: NOT STARTED at publication of this document  
> **Current authorization**: Phase 8B Round 1 — Database / Authority Foundation only  
> **Later rounds**: BLOCKED until explicit independent Gatekeeper release

---

# 0. Controlling Authority and Precedence

This file is the controlling implementation contract for **Phase 8B — Season + Structured Review**.

The exact immutable Phase 8B starting baseline is:

```text
0dffb9d706c3c941c46078c89bf3ae6e70d65d5f
```

That SHA is the accepted Phase 8A merge commit and explicitly replaces the absent historical `v1.0-core` tag as the implementation gate.

The following already-frozen Phase 8A files remain binding source specifications:

```text
docs/Phase8/00_PHASE8_MASTER_ROADMAP.md
docs/Phase8/01_OUTER_LOOP_DOMAIN_MODEL.md
docs/Phase8/02_OUTER_LOOP_AUTHORITY_RULES.md
docs/Phase8/03_SEASON_AND_REVIEW_SPEC.md
docs/Phase8/08_AI_GM_OUTER_LOOP_CONTRACT.md
docs/Phase8/09_DATABASE_SCHEMA_PLAN.md
docs/Phase8/10_API_AND_RPC_CONTRACT_PLAN.md
docs/Phase8/11_TESTING_SECURITY_AND_HARNESS_PLAN.md
docs/Phase8/12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md
```

If an implementation detail is underspecified by Phase 8A, this Phase 8B controlling file may **specialize** it only where required to make the frozen architecture executable without changing its product semantics. It may not weaken Phase 8A invariants.

Precedence for Phase 8B implementation:

```text
1. This Phase 8B controlling document
2. Phase 8A FINAL FROZEN architecture package on main@0dffb9d...
3. Frozen Phase 1–7 authority contracts
4. Existing repository implementation conventions
```

Any true conflict with a frozen semantic invariant must stop implementation and be returned as an ADR candidate. Execution AI must never silently reinterpret the architecture.

---

# 1. Phase 8B Mission

Phase 8B introduces the first production slice of the Outer Growth Loop:

```text
Season
  +
Structured Review
  +
Outer Loop Proposal / Audit foundation
```

It answers:

```text
What am I changing during this chapter?
What is the temporal context around my existing Quests?
What happened during the chapter?
What did I learn from the chapter without rewriting Growth Truth?
```

The Phase 8B product loop is:

```text
DRAFT Season
↓
PLANNED Season
↓
ACTIVE Season
↓
WEEKLY / AD_HOC Review(s)
↓
FINAL Review + atomic terminalization
↓
COMPLETED / ENDED_EARLY
↓
optional immutable FINAL Review amendment
```

Alternative termination:

```text
ACTIVE
↓
ABANDONED + mandatory reason + audit
```

Phase 8B is **not** a new Growth Engine and does not create XP, Mastery, Evidence Truth, Reward Credit, Journal authority, Strategy authority, or Milestones.

---

# 2. Non-Negotiable Phase 8B Invariants

## B1 — Growth Core Is Read-Only to Phase 8B

Phase 8B may read existing:

```text
quests
activities
xp_transactions
skills / mastery state
artifacts
```

but must not alter their authority semantics.

Forbidden:

```text
ALTER activities ADD season_id
ALTER quests for Season ownership
Season completion -> Quest completion
Review -> XP
Review -> Mastery
Review -> Evidence
Season -> Reward Credit
```

The Season activity set remains a **derived read model** from linked Quests + activity time window. No `activities.season_id` may be introduced.

## B2 — Season Is Context, Quest Is Goal Authority

Season does not replace Quest.

Canonical relationship:

```text
Season ↔ Quest = N:N
MAIN  = 0..1 per Season
FOCUS = 0..N per Season
```

A Season with **zero linked Quests is valid** and may be activated.

Quest may span multiple Seasons.
Season completion never mutates Quest status.
Quest completion never auto-concludes Season.

## B3 — One ACTIVE Season Per User

At most one `ACTIVE` Season may exist for a tenant.

This must be guaranteed by a database partial unique index, not application-only checks.

## B4 — Final Review and Terminalization Are Atomic

For:

```text
ACTIVE -> COMPLETED
ACTIVE -> ENDED_EARLY
```

the transaction must atomically:

```text
lock parent Season
validate tenant + state
validate FINAL Review payload
commit immutable FINAL SeasonReview
transition Season terminal state
set ended_at
write audit event
```

No window may exist where a completed/early-ended Season lacks its initial FINAL Review.

`ABANDONED` is exempt from mandatory FINAL Review but requires non-empty abandonment reason + audit.

## B5 — Review Is User-Confirmed Synthesis, Not Growth Truth

Persistent `SeasonReview` is never an AI draft.

AI-generated draft state lives in `outer_loop_proposals`.

Persistent Review cannot:

```text
award XP
change Mastery
create Verified Evidence
change Quest status
mint Reward Credit
```

## B6 — Review Versioning Is Immutable + Forward Supersession Only

Canonical linkage:

```text
superseded_by_id UUID NULL
```

No `supersedes_id` field.

Immutable after insert:

```text
id
user_id
season_id
review_type
version
commit_key
period_start
period_end
objective_summary
qualitative_reflection
criteria_evaluation
tactical_adjustments
amendment_reason
created_at
```

Only `superseded_by_id` may be changed once by authoritative RPC:

```text
NULL -> next_review.id
```

under parent Season row lock.

## B7 — OuterLoopProposal Is Proposal Authority Only

AI may create proposal envelopes. AI cannot directly create authoritative Season/Review state.

Canonical path:

```text
AI analysis
→ persisted OuterLoopProposal(PROPOSED)
→ Preview
→ explicit user ACCEPT / EDIT / REJECT
→ deterministic validation
→ atomic domain commit
→ audit
```

## B8 — Audit Is Append-Only

`outer_loop_audit_events` is immutable and RPC/service-authority only.

It must never be exposed as client-mutable storage.

## B9 — Tenant Isolation Is Structural

Every Phase 8B row contains `user_id`.

Cross-entity mutation must prove both referenced sides belong to `auth.uid()`.

Particularly high-risk:

```text
season_quests(season_id, quest_id)
season_reviews(season_id)
proposal resulting entity references
```

A client-controlled `user_id` is never sufficient proof of referenced entity ownership.

## B10 — Idempotency Is Durable, Not Best-Effort

Network retries and concurrent duplicate submissions must not create duplicate permanent state.

Required identities include:

```text
outer_loop_proposals.review_request_idempotency_key
outer_loop_audit_events.request_idempotency_key
season_reviews.commit_key UUID
request-level idempotency keys on lifecycle RPCs
```

Same identity retry returns prior result.
Different identity against already-settled state fails closed where specified.

## B11 — No Reward Forward Dependency

Phase 8B must not create:

```text
reward_accounts
reward_transactions
wishes
reward_redemptions
milestones
```

and no Season/Review RPC may call future Reward RPCs.

Phase 8E will later read historical completed Season truth.

## B12 — Phase 7 Remains Frozen

Phase 8B may extend navigation and Dashboard in its UI round, but must not reopen or rewrite Phase 7 accessibility/visual authority.

Historical limits remain:

```text
VoiceOver:             NOT VERIFIED
NVDA:                  NOT VERIFIED
JAWS:                  NOT VERIFIED
physical touch device: NOT VERIFIED
```

---

# 3. Phase 8B Delivery Strategy — Four Controlled Rounds

Phase 8B is intentionally divided into four independent review gates.

```text
8B-R1  Database + Authority Foundation
   ↓ Gatekeeper GO + merge
8B-R2  Repository + API + AI Proposal Pipeline
   ↓ Gatekeeper GO + merge
8B-R3  Journey UI + Navigation + Dashboard Integration
   ↓ Gatekeeper GO + merge
8B-R4  Full-System Hardening + Evidence + Final Freeze
```

Execution AI may not jump rounds.

At publication of this document:

```text
8B-R1 = AUTHORIZED
8B-R2 = BLOCKED
8B-R3 = BLOCKED
8B-R4 = BLOCKED
```

Every later round must branch from the exact Gatekeeper-approved merge SHA of the prior round.

---

# 4. Round 1 — Database + Authority Foundation [AUTHORIZED]

## 4.1 Branch and Baseline

Execution branch:

```text
feature/phase8b-r1-season-review-foundation
```

Must be created from exactly:

```text
0dffb9d706c3c941c46078c89bf3ae6e70d65d5f
```

If `origin/main` differs before branch creation, do not silently rebase or choose a newer baseline. Report baseline drift to Gatekeeper.

## 4.2 Round 1 Allowed Scope

Round 1 may modify only the minimum database/type/test surface required for Season/Review authority:

```text
supabase/migrations/0043_phase8b_outer_loop_foundation.sql
supabase/migrations/0044_phase8b_season_review_authority.sql
src/lib/supabase/database.types.ts
src/types/season.ts
src/types/outer-loop.ts
tests/phase8b-schema.test.ts
tests/phase8b-security.test.ts
tests/phase8b-season-authority.test.ts
tests/phase8b-review-authority.test.ts
tests/phase8b-harness.test.ts
```

Existing shared Supabase test helpers may be minimally extended only if necessary.

Round 1 must **not** create repository classes, API routes, UI, navigation, AI model calls, or application pages.

## 4.3 Migration 0043 — Outer Loop Foundation

`0043_phase8b_outer_loop_foundation.sql` must create only:

```text
public.outer_loop_proposals
public.outer_loop_audit_events
public.seasons
public.season_quests
public.season_reviews
```

No Phase 8C–8G table is allowed.

### outer_loop_proposals

Must implement the Phase 8A frozen envelope, including at minimum:

```text
id uuid PK
user_id uuid NOT NULL FK auth.users
proposal_type text NOT NULL
schema_version integer NOT NULL
source_refs jsonb NOT NULL
model_metadata jsonb NOT NULL
payload jsonb NOT NULL
status: PROPOSED | ACCEPTED | EDITED | REJECTED | EXPIRED
decision NULL | ACCEPTED | EDITED | REJECTED
created_at
expires_at
reviewed_at NULL
reviewed_by_id NULL
review_request_idempotency_key NULL
rejection_reason NULL
resulting_entity_type NULL
resulting_entity_id NULL
```

Required partial unique index:

```text
(user_id, review_request_idempotency_key)
WHERE review_request_idempotency_key IS NOT NULL
```

Client authority:

```text
SELECT own rows only
INSERT denied
UPDATE denied
DELETE denied
```

Round 1 creates the table/constraints/RLS only. Proposal generation and review orchestration are Round 2.

### outer_loop_audit_events

Must be append-only.

Required minimum fields:

```text
id uuid PK
user_id uuid NOT NULL
entity_type text
entity_id uuid NULL
event_type / action text NOT NULL
request_idempotency_key text NOT NULL
policy_version text NOT NULL
schema_version text NOT NULL
metadata jsonb
created_at
```

Required unique:

```text
UNIQUE(user_id, request_idempotency_key)
```

Client authority:

```text
SELECT own rows only
INSERT denied
UPDATE denied
DELETE denied
```

Authoritative RPCs insert audit rows.

### seasons

Canonical status:

```text
DRAFT
PLANNED
ACTIVE
COMPLETED
ENDED_EARLY
ABANDONED
CANCELLED
```

Must include the frozen planning/metadata fields required by `03_SEASON_AND_REVIEW_SPEC.md` / `09_DATABASE_SCHEMA_PLAN.md`, including:

```text
id
user_id
name/title (choose one canonical database field and map consistently)
description
theme/icon metadata if retained
planned_start_date
target_duration_days
success_criteria
status
started_at
ended_at
abandonment_reason
created_at
updated_at
```

Implementation must not invent a second parallel title/name field. The migration, generated DB types, domain mapper, and future API contract must converge on one canonical field name.

Required constraints:

```text
target_duration_days BETWEEN 14 AND 84 when PLANNED/ACTIVE
status CHECK
single ACTIVE partial unique index on user_id
```

Metadata edits may not alter lifecycle authority fields.

Direct authenticated update privileges should be least-privilege/column-level where feasible. At minimum, clients must not be able to directly mutate:

```text
status
started_at
ended_at
abandonment_reason
user_id
```

Any Season whose `started_at IS NOT NULL` or which is terminal must not be hard-deleted through product authority.

### season_quests

Required:

```text
id
user_id
season_id FK seasons ON DELETE RESTRICT
quest_id FK quests ON DELETE RESTRICT
role MAIN | FOCUS
created_at
UNIQUE(season_id, quest_id)
UNIQUE(season_id) WHERE role='MAIN'
```

Direct authenticated mutation:

```text
INSERT denied
UPDATE denied
DELETE denied
```

RPC-only.

Database trigger `trg_enforce_season_quest_tenant_isolation` must fail closed unless:

```text
NEW.user_id = referenced season.user_id
NEW.user_id = referenced quest.user_id
```

### season_reviews

Required:

```text
id
user_id
season_id FK seasons ON DELETE RESTRICT
review_type WEEKLY | FINAL | AD_HOC
version integer >= 1
commit_key uuid NOT NULL
period_start
period_end
objective_summary
qualitative_reflection
criteria_evaluation
tactical_adjustments
amendment_reason NULL
superseded_by_id NULL FK season_reviews ON DELETE RESTRICT
created_at
```

Required unique constraints:

```text
UNIQUE(user_id, commit_key)
UNIQUE(season_id, review_type, version)
```

Direct client mutation denied.

A trigger/constraint must prevent arbitrary mutation of review content. The only authorized post-insert mutation is:

```text
superseded_by_id: NULL -> next_review.id
```

exactly once under an authoritative RPC path.

## 4.4 Migration 0044 — Season / Review Authority

Round 1 must implement the authoritative database functions and defensive triggers required for Season/Review lifecycle.

Required RPCs:

```text
rpc_plan_season
rpc_activate_season
rpc_conclude_season
rpc_cancel_season
rpc_link_season_quest
rpc_unlink_season_quest
rpc_finalize_season_review
rpc_amend_final_season_review
```

Round 1 does **not** yet implement `rpc_review_outer_loop_proposal`; that is intentionally deferred to Round 2 because accepted/edited proposal handling must be bound to real application/domain dispatch contracts.

### Security-Definer Rules

For every SECURITY DEFINER function:

```text
SET search_path explicitly
REVOKE EXECUTE FROM PUBLIC
REVOKE EXECUTE FROM anon where applicable
GRANT only the minimum role required
never trust caller-supplied user_id
resolve tenant from auth.uid()
```

Do not accept `p_user_id` as authority for authenticated lifecycle RPCs.

### rpc_plan_season

Must implement:

```text
DRAFT -> PLANNED
14..84 day validation
success criteria validation
row lock / stale-state fail-closed
request idempotency
audit
```

### rpc_activate_season

Must implement:

```text
PLANNED -> ACTIVE
zero linked quests permitted
MAIN count <= 1
one ACTIVE Season per user
started_at set exactly once
request idempotency
audit
```

Concurrency requirement:

Two attempts to activate different Seasons for the same user must result in exactly one ACTIVE Season.

The database partial unique constraint is authoritative even if application pre-check races.

### rpc_conclude_season

For `COMPLETED` / `ENDED_EARLY`:

```text
ACTIVE required
FINAL Review required
p_final_review_commit_key uuid required
parent Season FOR UPDATE
review version serialization
insert immutable FINAL Review
transition Season terminal
ended_at set
audit
one atomic transaction
```

For `ABANDONED`:

```text
ACTIVE required
non-empty abandonment_reason required
no FINAL Review required
ended_at set
audit
```

Explicitly forbidden:

```text
reward mint
quest mutation
activity mutation
xp mutation
mastery mutation
evidence mutation
```

### rpc_cancel_season

Allowed only:

```text
DRAFT -> CANCELLED
PLANNED -> CANCELLED
```

Never ACTIVE/terminal.

### rpc_link_season_quest / rpc_unlink_season_quest

Both must:

```text
validate Season tenant
validate Quest tenant
lock parent Season
allow only DRAFT / PLANNED / ACTIVE
preserve MAIN <= 1
write audit
```

Phase 8B implementation clarification:

Because `outer_loop_audit_events.request_idempotency_key` is mandatory while the Phase 8A link/unlink sketch used only a natural relation key, Round 1 SHALL add:

```text
p_request_idempotency_key text NOT NULL
```

to link/unlink RPCs.

This is a fail-closed implementation specialization, not a semantic change.

Same request key replay must return prior effect without duplicate audit rows.

Different request key for an already-linked identical natural relation may return the already-existing relation without duplicating it, but must not fabricate a second audit settlement for the same requested mutation.

### rpc_finalize_season_review

Only for:

```text
ACTIVE Season
WEEKLY | AD_HOC
```

`FINAL` initial review is owned by `rpc_conclude_season`.

`commit_key UUID` is its durable retry identity.

For audit request identity, use a deterministic namespaced representation of the durable review commit key rather than introducing a second unrelated idempotency concept, e.g.:

```text
review:<commit_key>
```

Parent Season row must be locked before version allocation.

### rpc_amend_final_season_review

Only for:

```text
COMPLETED | ENDED_EARLY
existing FINAL review required
new commit_key UUID
non-empty amendment_reason
```

Atomic behavior:

```text
lock Season
locate latest FINAL where superseded_by_id IS NULL
insert FINAL N+1
set prior.superseded_by_id = new.id once
keep Season terminal + timestamps unchanged
write audit
```

## 4.5 Round 1 Core Freeze Guard

The following existing frozen tables must have **zero schema mutation** in Round 1:

```text
activities
quests
skills
skill_edges
domains
xp_transactions
evidence_records
mastery_events
mastery_verifications
knowledge_*
artifacts / artifact_*
```

Foreign keys from new Phase 8B tables to existing `quests` are allowed.

No trigger may be added to a frozen Core table unless Gatekeeper explicitly approves it. Tenant validation belongs on the new link table/RPC.

## 4.6 Generated Database Types

`src/lib/supabase/database.types.ts` must be regenerated/updated to exactly reflect the applied schema and RPC signatures.

Forbidden:

```text
hand-waving `any`
manual casts hiding missing tables/functions
leaving Functions: never for new RPCs
runtime stringly-typed access that bypasses Database typing
```

Round 1 domain types should live outside frozen Growth Core store types:

```text
src/types/season.ts
src/types/outer-loop.ts
```

Do not add Season/Review types to `src/lib/store/types.ts` unless Gatekeeper later explicitly authorizes it.

---

# 5. Round 1 Required Runtime Tests

Round 1 must add real database-backed tests against local Supabase, not string scans alone.

At minimum:

## Schema / Constraint Tests

```text
B8B-R1-001 five Phase 8B tables exist
B8B-R1-002 no Phase 8C–8G table introduced
B8B-R1-003 one ACTIVE partial unique index exists
B8B-R1-004 one MAIN per Season partial unique index exists
B8B-R1-005 review commit/version unique constraints exist
B8B-R1-006 proposal review key partial unique index exists
```

## Tenant / RLS Tests

Use two real authenticated tenants A and B.

```text
B8B-R1-007 A cannot SELECT B Season/Review/Proposal/Audit rows
B8B-R1-008 A cannot link B Quest into A Season
B8B-R1-009 forged season_quests.user_id cannot bypass reference ownership
B8B-R1-010 client direct insert/update/delete season_quests denied
B8B-R1-011 client direct insert/update/delete season_reviews denied
B8B-R1-012 client direct mutation proposals/audit denied
```

## Lifecycle Tests

```text
B8B-R1-013 DRAFT -> PLANNED only
B8B-R1-014 DRAFT -> ACTIVE rejected
B8B-R1-015 activate with zero Quest succeeds
B8B-R1-016 concurrent activation yields exactly one ACTIVE Season
B8B-R1-017 second MAIN link rejected
B8B-R1-018 Quest may link to multiple Seasons
B8B-R1-019 Season completion leaves Quest state unchanged
B8B-R1-020 COMPLETED requires FINAL Review atomically
B8B-R1-021 ENDED_EARLY requires FINAL Review atomically
B8B-R1-022 ABANDONED requires reason and no FINAL Review
B8B-R1-023 terminal Season cannot reopen
B8B-R1-024 ever-active Season cannot hard delete
```

## Review Versioning / Idempotency Tests

```text
B8B-R1-025 same commit_key retry returns one Review
B8B-R1-026 concurrent new reviews serialize versions
B8B-R1-027 FINAL amendment creates N+1 and forward pointer
B8B-R1-028 prior Review content cannot be edited
B8B-R1-029 superseded_by_id cannot be changed twice
B8B-R1-030 FINAL amendment does not reopen terminal Season
```

## Growth Truth Non-Interference Tests

Snapshot before/after Phase 8B mutations:

```text
activities
quests
xp_transactions
user/skill mastery authority
evidence_records
artifacts
```

Required:

```text
B8B-R1-031 conclude Season changes none of the above
B8B-R1-032 finalize/amend Review changes none of the above
```

## O-Series Mapping

Round 1 must establish database-runtime evidence for:

```text
O006 Season end does not rewrite Growth
O013 only one ACTIVE Season
O014 Season ↔ Quest N:N
O015 Season does not complete Quest
O016 Review does not create Growth Truth
O022 terminal Season history is not hard deleted
```

Evidence language at Round 1 may state:

```text
SOURCE VERIFIED — frozen specification
RUNTIME VERIFIED — DB authority layer only
```

It must **not** claim full Phase 8B product runtime verification until Round 4.

All other O001–O022 remain:

```text
SOURCE VERIFIED as specifications
Phase 8 runtime NOT VERIFIED unless explicitly implemented and independently tested
```

---

# 6. Round 1 CI / Governance Gate

Before returning to Gatekeeper:

```text
pnpm lint
pnpm test
pnpm build
```

must pass.

DB-backed Supabase CI must pass with zero skipped Phase 8B DB tests.

Existing frozen test suite must remain green.

No modification to governance guards is authorized merely to make Phase 8B pass.

If an existing guard blocks the explicitly authorized Phase 8B path, stop and report the exact guard conflict to Gatekeeper. Do not weaken or bypass the guard.

Round 1 must open a PR to `main` and must not merge it.

---

# 7. Round 2 — Repository + API + AI Proposal Pipeline [DEFINED, NOT YET AUTHORIZED]

Round 2 is documented now so Round 1 schema does not paint later layers into a corner. It is not executable until Gatekeeper releases it.

Expected implementation pattern:

```text
src/lib/store/season-repository.ts
src/lib/store/supabase-season-repository.ts
```

Use a **separate bounded repository**, following the Artifact repository precedent.

Do not expand the frozen generic Growth Core `Repository` interface in `src/lib/store/repository.ts` with Season/Review responsibilities.

Expected API surfaces:

```text
GET/POST   /api/seasons
GET/PATCH  /api/seasons/[id]
POST       /api/seasons/[id]/plan
POST       /api/seasons/[id]/activate
POST       /api/seasons/[id]/conclude
POST       /api/seasons/[id]/cancel
POST       /api/seasons/[id]/quests
DELETE     /api/seasons/[id]/quests
GET/POST   /api/seasons/[id]/reviews
POST       /api/seasons/[id]/reviews/final/amend
GET        /api/reviews
POST       /api/outer-loop/proposals/generate
POST       /api/outer-loop/proposals/[id]/review
```

Final route shapes may be refined in Round 2 controlling release, but authority semantics may not change.

## AI Proposal Scope for 8B

Phase 8B may support only:

```text
SEASON_PLAN
SEASON_ADJUSTMENT
REVIEW_SUMMARY
```

No Strategy, Reward, Milestone, Journal, Focus, or Protocol permanent action may be committed in Phase 8B.

Expected files may include:

```text
src/lib/ai/outer-loop.ts
src/lib/ai/outer-loop-schemas.ts
src/lib/ai/outer-loop-prompts.ts
```

Use existing server-side OpenAI-compatible configuration conventions.

Hard rules:

```text
temperature deterministic/low
strict schema validation
no direct AI database write
no raw AI JSON trusted after parse
no production fallback to fake AI output
local deterministic mock only under explicit demo/test mode
```

Proposal creation must be server-only.

Round 2 will implement and independently review `rpc_review_outer_loop_proposal` / equivalent atomic review dispatch once the real domain/API contract is present.

---

# 8. Round 3 — Journey UI + Navigation + Dashboard Integration [DEFINED, NOT YET AUTHORIZED]

Required product routes:

```text
/journey/seasons
/journey/reviews
```

Do not move or rename frozen existing routes:

```text
/quests
/skills
/knowledge
/artifacts
```

Phase 8B does not perform a mass `/growth/*` route migration.

## Navigation Decision

During Phase 8B, add one top-level **Journey / 旅程** entry to the existing shared navigation, pointing to `/journey/seasons`.

Inside Journey, use local tabs/subnavigation:

```text
赛季 / Seasons
复盘 / Reviews
```

This avoids prematurely exposing future Journal/Playbook routes.

`MobileNav` inherits the same canonical navigation model.

## Seasons UI

`/journey/seasons` must include:

```text
Current ACTIVE Season surface
DRAFT / PLANNED upcoming Seasons
terminal Season history
create DRAFT flow
plan flow
activate flow
Quest link manager with MAIN / FOCUS roles
conclude flow
ABANDON flow
Season detail / inspector
```

Activation UI must not require any linked Quest.

Final conclusion UI must collect/confirm FINAL Review in the same user flow.

## Reviews UI

`/journey/reviews` must include:

```text
WEEKLY / FINAL / AD_HOC timeline
Season filter
current vs superseded version indication
read-only review detail
create WEEKLY / AD_HOC flow for ACTIVE Season
FINAL amendment flow for COMPLETED / ENDED_EARLY Season
```

AI Review summaries are drafts/proposals until user confirmation.

## Dashboard Additive Integration

Dashboard may receive a compact **Current Season** card because Phase 8A defines Dashboard as the current-context anchor.

Strict constraints:

```text
additive only
no rewrite of existing XP / Quest / Skill calculations
no second AppShell
no Phase 7 token changes
no semantic gold misuse
```

## Visual / Accessibility Rules

Reuse frozen Phase 7 primitives and design tokens.

Do not edit global design tokens unless a separate Gatekeeper approval is issued.

Required:

```text
keyboard-operable controls
focus-visible preserved
BaseModal / existing accessible modal primitive
no color-only state communication
44px minimum touch targets where applicable
prefers-reduced-motion parity
375px no horizontal overflow
```

Visual style remains calm ink-wash / light-first / restrained RPG.

Forbidden:

```text
casino celebration
streak pressure
confetti dependency
flashing reward affordances
fake XP for Season completion
```

---

# 9. Round 3 Visual Runtime Matrix

At minimum test these routes:

```text
/dashboard
/journey/seasons
/journey/reviews
```

Widths:

```text
375
768
1024
1440
```

Motion modes:

```text
no-preference
reduce
```

Total minimum matrix:

```text
3 × 4 × 2 = 24 cells
```

Every cell must record:

```text
render PASS/FAIL
horizontal overflow count
console error count
critical control visibility
```

Keyboard runtime flows must include:

```text
create / close modal focus trap + restoration
Season plan/activate action focus order
Quest role selector keyboard operation
Review editor confirmation flow
FINAL conclusion modal
```

Physical-device touch remains `NOT VERIFIED` unless a real physical device is actually tested.

---

# 10. Round 4 — Full-System Hardening + Final Freeze [DEFINED, NOT YET AUTHORIZED]

Round 4 is the Phase 8B final acceptance pass.

Required end-to-end scenarios:

## Flow A — Normal Season Lifecycle

```text
create DRAFT
→ plan
→ activate with 0 quests
→ link FOCUS Quest
→ link MAIN Quest
→ add WEEKLY Review
→ conclude COMPLETED + FINAL Review atomically
→ amend FINAL Review
→ confirm Season remains terminal
→ confirm Quest states unchanged
→ confirm Growth Truth unchanged
```

## Flow B — Early Ending

```text
ACTIVE
→ ENDED_EARLY + FINAL Review
```

## Flow C — Abandonment

```text
ACTIVE
→ ABANDONED with reason
→ no FINAL Review required
```

## Flow D — Concurrency

```text
Two PLANNED Seasons
→ concurrent activation
→ exactly one ACTIVE
```

## Flow E — Tenant Attack

```text
User A attempts to link User B Quest
→ fail closed
```

## Flow F — Replay

```text
same request/commit key
→ same committed result
→ no duplicate rows/audits
```

## Flow G — AI Proposal Sovereignty

```text
AI proposal
→ preview only
→ no authoritative mutation before user action
→ accept/edit/reject deterministic path
```

Phase 8B may only be marked FINAL FROZEN when independent Gatekeeper concludes:

```text
P0 = 0
P1 = 0
P2 = 0
```

and both PR Exact-Head CI and post-merge main-push CI are green.

---

# 11. Phase 8B Evidence Requirements

Execution reports are not authoritative evidence.

Gatekeeper will independently inspect:

```text
PR metadata
Exact Head
changed files
patches
migration SQL
RLS/grants
RPC bodies
generated types
unit/integration/E2E results
workflow run metadata
raw CI job logs when needed
post-merge main topology
```

Evidence vocabulary:

```text
SOURCE VERIFIED
UNIT VERIFIED
RUNTIME VERIFIED
STATIC VISUAL VERIFIED
INFERENCE
NOT VERIFIED
```

Never upgrade source inspection to runtime proof.
Never call emulation a physical-device test.
Never claim all O001–O022 runtime verified merely because Phase 8B is accepted.

For Phase 8B final acceptance, only the Phase 8B-relevant runtime assertions may be upgraded:

```text
O006
O013
O014
O015
O016
O022
```

Other O-series tests remain governed by their later phases unless independently exercised.

---

# 12. Strict Prohibitions for All Phase 8B Rounds

Do not create or implement:

```text
journal_entries
strategies
strategy_versions
strategy_supports
reward_accounts
reward_transactions
wishes
reward_redemptions
milestones
focus_sessions
growth_protocols
protocol_versions
past_self table
goals table
streaks table
xp_wallet
```

Do not modify:

```text
Growth Engine formulas
Mastery engine semantics
XP settlement authority
Evidence authority
Quest completion authority
Knowledge authority
Artifact authority
Phase 7 final accessibility evidence claims
```

Do not add reward issuance to Season completion.
Do not make time spent equal XP.
Do not make Review an Evidence source.
Do not let AI commit without user confirmation.
Do not auto-complete Quests from Season.
Do not auto-complete Season from Quest.

---

# 13. Governance / Merge Rules

For each Phase 8B round:

```text
Execution AI implements
↓
opens PR
↓
returns Exact Head + CI
↓
Independent Gatekeeper independently inspects actual GitHub state
↓
P0/P1/P2 verdict
↓
only Gatekeeper GO authorizes merge
```

Execution AI must never self-merge.

Formal GitHub APPROVE may fail because the connected identity is also PR author. If so, Gatekeeper records approval as a top-level PR comment and merges using an exact-head guard.

Every merge must use the reviewed Exact Head. Any head drift after acceptance invalidates the merge authorization until re-reviewed.

---

# 14. Round 1 Return Contract

Execution AI must finish Round 1 and stop.

Return exactly:

```text
PHASE 8B ROUND 1:
COMPLETE / INCOMPLETE

BASE SHA:
<sha>

PR:
<number / OPEN>

EXACT HEAD SHA:
<sha>

CHANGED FILES:
<complete list>

SCOPE:
PASS / FAIL

MIGRATION 0043 OUTER LOOP FOUNDATION:
PASS / FAIL

MIGRATION 0044 SEASON REVIEW AUTHORITY:
PASS / FAIL

FIVE TABLES CREATED:
PASS / FAIL

PHASE 8C-8G TABLES CREATED:
NO / YES

FROZEN CORE SCHEMA MODIFIED:
NO / YES

SINGLE ACTIVE DB CONSTRAINT:
RUNTIME VERIFIED / OTHER

SEASON QUEST TENANT ISOLATION:
RUNTIME VERIFIED / OTHER

ZERO-QUEST ACTIVATION:
RUNTIME VERIFIED / OTHER

ATOMIC FINAL REVIEW + CONCLUSION:
RUNTIME VERIFIED / OTHER

FINAL REVIEW AMENDMENT:
RUNTIME VERIFIED / OTHER

GROWTH TRUTH NON-INTERFERENCE:
RUNTIME VERIFIED / OTHER

O006:
<status>
O013:
<status>
O014:
<status>
O015:
<status>
O016:
<status>
O022:
<status>

O001-O022 SPECIFICATIONS:
SOURCE VERIFIED

FULL PHASE 8B PRODUCT RUNTIME:
NOT VERIFIED

PHASE 8B ROUND 2 STARTED:
NO

PHASE 8C+ IMPLEMENTATION STARTED:
NO

PHASE 7 FINAL FROZEN:
YES

EXACT-HEAD CI:
<run id>
<status>
<conclusion>

MERGE PERFORMED:
NO
```

Then stop and return control to Independent Gatekeeper.

---

# 15. Immediate Authorization State

As of this controlling document:

```text
AUTHORITATIVE BASELINE:
0dffb9d706c3c941c46078c89bf3ae6e70d65d5f

PHASE 8A:
FINAL FROZEN

PHASE 8B:
START AUTHORIZED

PHASE 8B ROUND 1:
AUTHORIZED

PHASE 8B ROUND 2:
BLOCKED

PHASE 8B ROUND 3:
BLOCKED

PHASE 8B ROUND 4:
BLOCKED

PHASE 8C+:
BLOCKED
```

The next implementation action is **Round 1 only**.