# Phase 8D Strategy Playbook Implementation Controlling

## 1\. Governance Boundary

Status: ADMISSION CANDIDATE — production implementation remains BLOCKED pending independent exact-head Gatekeeper GO

Baseline:

- Main baseline: `98dbe37e0a6fe334b6638ca568bc3ba06b4c3aac`
- Phase 8D production implementation is blocked until this document receives an independent exact-head Gatekeeper review with `P0=0 / P1=0 / P2=0 + GO`.

Admission review history:

- Exact head `02bbc1be379054c12592cd200474c8e5e4f2cbc6` received `P0=0 / P1=5 / P2=1 + NO-GO` on 2026-09-19. That verdict remains historical evidence and is not overwritten by this corrective candidate.
- A corrective head MUST receive a fresh independent exact-head Gatekeeper review. No production implementation is authorized by the historical NO-GO or by this document alone.

This document defines implementation contracts. It does not authorize implementation before Gatekeeper admission.

## 2\. Scope

### In Scope

- Strategy hypothesis lifecycle.
- Personal Playbook route `/journey/playbook`.
- Strategy evidence collection and deterministic status evaluation.
- Strategy version history.
- User confirmation flow for AI-generated strategy proposals.
- AI `STRATEGY_COUNTEREVIDENCE_ALERT` proposal/notification flow with zero direct commit authority.

### Out of Scope

- Automatic strategy creation by AI.
- Automatic promotion to `SUPPORTED`.
- Changes to XP, mastery, reward, or ledger rules.
- Deletion of strategy history.

## 3\. Domain Model

Frozen tables:

- `strategies`
- `strategy_versions`
- `strategy_supports`

Strategy lifecycle:

```
HYPOTHESIS -> TESTING
TESTING -> SUPPORTED
TESTING -> RETIRED
SUPPORTED -> CONTEXTUAL
CONTEXTUAL -> SUPPORTED
SUPPORTED -> WEAKENED
CONTEXTUAL -> WEAKENED
WEAKENED -> TESTING
WEAKENED -> RETIRED
```

Allowed states:

- HYPOTHESIS
- TESTING
- SUPPORTED
- CONTEXTUAL
- WEAKENED
- RETIRED

Confidence is derived only from deterministic evidence:

- LOW
- MODERATE
- HIGH
- VERY\_HIGH

## 4\. Strategy Authority Rules

AI may produce `STRATEGY_HYPOTHESIS` and `STRATEGY_COUNTEREVIDENCE_ALERT` proposal/notification records only. Neither proposal type has direct Strategy commit authority.

`STRATEGY_HYPOTHESIS` output must pass `OuterLoopProposal` review. The user must explicitly accept or edit and accept before a strategy enters `HYPOTHESIS`.

`STRATEGY_COUNTEREVIDENCE_ALERT` may identify a possible counter-evidence source, but accepting/editing the alert only acknowledges the proposal. It MUST NOT insert `strategy_supports`, change confidence, or change lifecycle status. A Strategy can be affected only after a separate explicit user action logs `COUNTER_EVIDENCE` through `rpc_insert_strategy_support`, which must re-validate the canonical source and tenant ownership.

The application database is the only authority that commits lifecycle state.

## 5\. Promotion Gate

`TESTING -> SUPPORTED` requires all conditions:

- At least 4 distinct observation dates.
- At least 1 completed Season.
- At least 2 Growth Core links.
- Support ratio >= 75%.
- Derived confidence >= HIGH.
- Explicit user confirmation.

The deterministic confidence rubric is:

| Confidence | Distinct dates | Completed Seasons | Core links | Support ratio |
| --- | --- | --- | --- | --- |
| LOW | 1 observation, or ratio < 65% | 0 | optional | < 65% or single observation |
| MODERATE | \>= 2 | 0 | \>= 1 | \>= 65% |
| HIGH | \>= 4 | \>= 1 | \>= 2 | \>= 75% |
| VERY\_HIGH | \>= 8 | \>= 2 | \>= 4 | \>= 85% |

Support ratio is `SUPPORT / (SUPPORT + COUNTER_EVIDENCE)` over accepted immutable support rows. Source-class weights documented in the frozen Strategy spec are metadata/evidential guidance only in Phase 8D; they MUST NOT silently alter this deterministic confidence calculation or lifecycle eligibility.

When the support ratio drops below 60%, deterministic evaluation automatically weakens `SUPPORTED` or `CONTEXTUAL` to `WEAKENED`. No other automatic lifecycle promotion is allowed.

### 5.1 Canonical counting semantics

All deterministic metrics are computed from accepted immutable `strategy_supports` rows anchored to the strategy's **current** `strategy_version_id`. Evidence anchored to an older version remains immutable history but contributes zero dates, Seasons, Core links, support-count, or counter-evidence-count to the current version.

- Observation date is the UTC calendar date of the database-resolved canonical source timestamp: `(canonical_observed_at AT TIME ZONE 'UTC')::date`. Caller-provided timestamps never define the counting date.
- `distinct observation dates` means distinct UTC dates among current-version rows with `observation_type = 'SUPPORT'`.
- `completed Seasons` means distinct parent `season_id` values from current-version `SUPPORT` rows whose canonical source is a caller-owned `season_reviews` row with `review_type = 'FINAL'` and whose parent `seasons.status = 'COMPLETED'`. `ENDED_EARLY`, `ABANDONED`, `CANCELLED`, non-FINAL reviews, and foreign/missing rows contribute zero completed Seasons.
- A `Core link` is one distinct canonical entity key from a current-version `SUPPORT` row that resolves to exactly one of: `(ACTIVITY, activities.id)` with `activities.status = 'confirmed'`; `(QUEST, quests.id)` with `quests.status = 'completed'` and non-null `completed_at`; or `(ARTIFACT, artifacts.id)` with `artifacts.lifecycle_status IN ('active', 'archived', 'superseded')`. Draft Artifacts, unconfirmed Activities, incomplete Quests, Journal rows, Season Reviews, and bare `CORE_EVIDENCE_REFERENCE` rows contribute zero Core links.
- Core-link distinctness is by canonical `(entity_kind, entity_id)`, not by support-row count, evaluator version, note, timestamp assertion, or source-class alias.
- `support_count` and `counter_evidence_count` count current-version rows by `observation_type` after canonical-source deduplication. If both are zero, support ratio is defined as `0%`; therefore zero evidence derives `LOW` confidence and is never promotion-eligible.
- `COUNTER_EVIDENCE` rows affect the ratio and weakening evaluation but never satisfy the positive date, completed-Season, or Core-link promotion thresholds.

`canonical_observed_at` is resolved inside database authority from the referenced source, never trusted from the caller: Season Review `created_at`; Activity `COALESCE(confirmed_at, created_at)`; Quest `COALESCE(completed_at, updated_at, created_at)`; Artifact `created_at`; Evidence Record `created_at`; Journal-backed observation `created_at`. If a public adapter accepts a caller timestamp as an assertion, any non-null mismatch with this canonical value is rejected and the caller value is never persisted as authority.

## 6\. Database Authority Contract

### strategies

- Primary tenant owner is `user_id = auth.uid()`; private rows require fail-closed RLS.
- User may create a `HYPOTHESIS` directly, or a `STRATEGY_HYPOTHESIS` proposal may create it only after accepted/edited user review.
- Direct authenticated `INSERT` is allowed only for caller-owned user-authored rows whose authoritative defaults are forced by database authority to `lifecycle_status = 'HYPOTHESIS'`, `confidence_level = 'LOW'`, and `version = 1`. Client-supplied attempts to forge any other initial lifecycle, confidence, version, owner, or system-managed provenance field MUST fail closed rather than being silently accepted.
- Every successful Strategy insert, including proposal settlement, MUST atomically create immutable `strategy_versions` version `1` from the initial `action_protocol`, `context_trigger`, and `expected_outcome`; a Strategy without its version-1 snapshot is invalid.
- Direct authenticated updates are allowlisted to `title` and `description` only, plus database-managed `updated_at`. Direct mutation of `action_protocol`, `context_trigger`, `expected_outcome`, `version`, `lifecycle_status`, `confidence_level`, owner/provenance fields, or any other non-allowlisted field MUST fail closed.
- Material protocol/context changes MUST go through `rpc_create_strategy_version`, increment `version`, and append an immutable snapshot.
- Direct authenticated `DELETE` is denied. Strategy history is retired rather than hard-deleted in normal product flows, and `RETIRED` remains queryable history.

### strategy\_versions

- Entire row is immutable.
- `UNIQUE(strategy_id, version_number)`.
- Insert only through `rpc_create_strategy_version`; direct authenticated `INSERT`, `UPDATE`, and `DELETE` are denied.
- Tenant-isolation trigger asserts `NEW.user_id` equals the parent strategy owner.
- Version allocation is serialized by locking the parent `strategies` row.

### strategy\_supports

- Entire row is append-only/immutable after insert.
- `source_id uuid NOT NULL`.
- `strategy_version_id uuid NOT NULL` references the immutable `strategy_versions` row for the same Strategy and tenant with `ON DELETE RESTRICT` semantics.
- The frozen composite `UNIQUE(strategy_id, source_class, source_id, observation_type, evaluator_version)` remains valid as a storage-level constraint, but it is **not** the confidence-contribution identity.
- Database authority derives a canonical contribution identity `(strategy_id, canonical_source_kind, source_id, observation_type)` and enforces an additional unique index/constraint that excludes `evaluator_version`, note, and timestamps. Changing evaluator version or metadata therefore cannot create another confidence contribution.
- `canonical_source_kind` is database-derived, not caller-controlled. `JOURNAL_CONTEXT` and `MANUAL_OBSERVATION` both normalize to `JOURNAL`, so the same Journal UUID cannot be replayed through two source-class aliases. Other source classes map to their canonical tenant-owned table identity.
- Insert only through `rpc_insert_strategy_support`; direct authenticated `INSERT`, `UPDATE`, and `DELETE` are denied.
- Tenant-isolation trigger asserts support owner equals parent strategy owner and `strategy_version_id` belongs to that Strategy and user. For `JOURNAL_CONTEXT` and `MANUAL_OBSERVATION`, `source_id` MUST resolve to a caller-owned `journal_entries.id`; no free-form or random observation UUID is authorized in Phase 8D. Other source classes MUST resolve to their exact canonical tenant-owned source table.
- Duplicate canonical source identity is an idempotent replay, never a second confidence contribution.

## 7\. RPC Contracts

Required RPCs:

### rpc\_insert\_strategy\_support

Input:

JSON

```
{
  "p_strategy_id": "uuid",
  "p_observation_type": "SUPPORT | COUNTER_EVIDENCE",
  "p_source_class": "SEASON_REVIEW | ACTIVITY | QUEST_OUTCOME | ARTIFACT | CORE_EVIDENCE_REFERENCE | JOURNAL_CONTEXT | MANUAL_OBSERVATION",
  "p_source_id": "uuid",
  "p_evaluator_version": "text",
  "p_note": "text | null",
  "p_observed_at": "timestamptz | null; optional assertion only"
}
```

Contract:

- Strategy must belong to caller and be in `TESTING | SUPPORTED | CONTEXTUAL | WEAKENED`.
- Referenced source must resolve to the canonical source table and belong to caller; foreign-tenant, missing, source-class-mismatched, and random UUIDs fail closed.
- `MANUAL_OBSERVATION` is journal-backed in Phase 8D: it MUST anchor to a caller-owned `journal_entries.id` and shares canonical `JOURNAL` identity with `JOURNAL_CONTEXT`.
- Lock strategy row `FOR UPDATE`.
- Resolve the current immutable `strategy_version_id` and the database-owned `canonical_observed_at`; any non-null caller timestamp is assertion-only and must exactly match or be rejected.
- Insert exactly one immutable support row under the database-derived canonical contribution identity; exact replay returns the existing row. A changed `evaluator_version`, note, asserted timestamp, or Journal source-class alias cannot create another contribution.
- Re-evaluate deterministic confidence after insertion and write `STRATEGY_SUPPORT_LOGGED` audit.
- Null source identity is rejected; no support inflation through duplicate replay is permitted.

### rpc\_evaluate\_strategy\_status

Input:

JSON

```
{
  "p_strategy_id": "uuid",
  "p_confirm_promotion": "boolean default false"
}
```

Contract:

- Locks caller-owned strategy row `FOR UPDATE`.
- Computes distinct observation dates, completed Season evidence, Core links, support ratio, and derived ordinal confidence according to section 5.
- Always persists deterministic `confidence_level` when changed.
- If ratio falls below 60%, may automatically transition `SUPPORTED | CONTEXTUAL -> WEAKENED`.
- `TESTING -> SUPPORTED` occurs only when all promotion gates are satisfied AND `p_confirm_promotion = true`; otherwise evaluation is proposal/eligibility only.
- Confirmation with insufficient evidence fails with 422 and leaves lifecycle status unchanged.
- Background/AI evaluation must call with `p_confirm_promotion = false`.

### rpc\_transition\_strategy\_status

Input:

JSON

```
{
  "p_strategy_id": "uuid",
  "p_target_status": "HYPOTHESIS | TESTING | SUPPORTED | CONTEXTUAL | WEAKENED | RETIRED",
  "p_context_boundary_note": "text | null",
  "p_retirement_reason": "text | null",
  "p_request_idempotency_key": "text"
}
```

Allowed graph:

- `HYPOTHESIS -> TESTING`
- `TESTING -> SUPPORTED` only with derived confidence >= HIGH and the full section 5 gate
- `TESTING -> RETIRED`
- `SUPPORTED -> CONTEXTUAL`
- `CONTEXTUAL -> SUPPORTED`
- `SUPPORTED -> WEAKENED`
- `CONTEXTUAL -> WEAKENED`
- `WEAKENED -> TESTING`
- `WEAKENED -> RETIRED`

Contract:

- Caller-owned strategy row is locked `FOR UPDATE`.
- `CONTEXTUAL` requires non-blank context-boundary note.
- `RETIRED` requires non-blank retirement reason.
- Promotion to `SUPPORTED` re-checks deterministic eligibility in the same transaction.
- `p_request_idempotency_key` is durable retry identity; same-key replay returns the committed state, while a conflicting request must not create a second transition.
- Writes `STRATEGY_STATUS_TRANSITIONED` audit.

### rpc\_create\_strategy\_version

Input:

JSON

```
{
  "p_strategy_id": "uuid",
  "p_action_protocol": "text",
  "p_context_trigger": "text",
  "p_expected_outcome": "text",
  "p_change_summary": "text",
  "p_request_idempotency_key": "text"
}
```

Contract:

- Caller-owned strategy row is locked `FOR UPDATE`.
- Protocol/context/outcome values must be non-blank.
- Allocate `next_version = current version + 1` while holding the parent lock.
- Insert immutable `strategy_versions` snapshot and update the current strategy protocol/version atomically.
- Existing support rows remain anchored to their prior immutable version. They are excluded from all current-version confidence/promotion metrics after the version changes.
- Re-evaluate the new current version in the same transaction. With no current-version evidence its ratio is `0%` and confidence is `LOW`; if the prior lifecycle was `SUPPORTED` or `CONTEXTUAL`, the existing deterministic weakening rule moves it to `WEAKENED`. `RETIRED` Strategies cannot create a new version.
- Durable request idempotency MUST make exact replay return the previously created version instead of allocating another number.
- Writes a `STRATEGY_VERSION_CREATED` audit event.

All RPCs require:

- authenticated user.
- tenant ownership validation.
- idempotency handling.
- transactional audit records.
- fail-closed cross-tenant behavior.

## 8\. Evidence Rules

Supported source classes:

- SEASON\_REVIEW
- ACTIVITY
- QUEST\_OUTCOME
- ARTIFACT
- CORE\_EVIDENCE\_REFERENCE
- JOURNAL\_CONTEXT
- MANUAL\_OBSERVATION

Evidence records require stable source identity and cannot be replayed into duplicate support records.

Canonical ownership checks are fail-closed:

- `SEASON_REVIEW` -> caller-owned `season_reviews.id`; it counts toward the completed-Season metric only when `review_type = 'FINAL'` and the parent caller-owned Season has `status = 'COMPLETED'`.
- `ACTIVITY` -> caller-owned `activities.id`; it counts as a Core link only when `status = 'confirmed'`.
- `QUEST_OUTCOME` -> caller-owned `quests.id`; it counts as a Core link only when `status = 'completed'` and `completed_at IS NOT NULL`.
- `ARTIFACT` -> caller-owned `artifacts.id`; it counts as a Core link only when `lifecycle_status IN ('active', 'archived', 'superseded')`.
- `CORE_EVIDENCE_REFERENCE` -> caller-owned `evidence_records.id`; it is valid provenance/support input but does not independently satisfy a Core-link unit in Phase 8D.
- `JOURNAL_CONTEXT` -> caller-owned `journal_entries.id`.
- `MANUAL_OBSERVATION` -> caller-owned `journal_entries.id`, normalized to the same canonical `JOURNAL` identity as `JOURNAL_CONTEXT`; no separate observation table or arbitrary UUID is authorized.

The implementation must prove that a foreign-tenant UUID, a missing UUID, a mismatched source class, an evaluator-version replay, a Journal/manual alias replay, and a random UUID cannot create a second or invalid support contribution.

## 9\. API and UI Boundary

Required surfaces:

- Repository/service layer for strategy domain operations.
- Authenticated API routes that delegate lifecycle/confidence/version/support mutations to the four RPC authorities.
- Journey UI route: `/journey/playbook`.

The Playbook UI must support, within Phase 8D scope:

- list/detail of strategies with lifecycle and derived confidence;
- create user-authored hypothesis;
- begin testing;
- add/view support and counter-evidence through authorized server paths;
- explicitly confirm eligible promotion to `SUPPORTED`;
- add context-boundary note and move to `CONTEXTUAL`;
- retire with reason;
- create and inspect protocol versions;
- review AI `STRATEGY_HYPOTHESIS` proposals through the existing proposal-review authority;
- review/acknowledge AI `STRATEGY_COUNTEREVIDENCE_ALERT` proposals without directly mutating Strategy truth, then require a separate explicit user action through the support RPC before counter-evidence can affect confidence or lifecycle.

The UI MUST NOT import browser Supabase write authority, mutate lifecycle/confidence directly, or expose service-role credentials.

### 9.1 STRATEGY\_HYPOTHESIS settlement

- AI may only create an `outer_loop_proposals` row with proposal type `STRATEGY_HYPOTHESIS`.
- Payload fields are `title`, `description`, `context_trigger`, `action_protocol`, `expected_outcome`, and optional supporting activity IDs as defined by the frozen AI contract.
- `rpc_review_outer_loop_proposal` remains the single atomic user-review CAS boundary.
- `REJECTED` creates no Strategy.
- `ACCEPTED` or `EDITED` validates the final payload, creates exactly one `HYPOTHESIS` strategy in the same transaction, records `resulting_entity_type/resulting_entity_id`, and audits the review.
- Same review key replay returns the already-created strategy; a different/concurrent second review loses with the existing proposal-review conflict contract.
- Supporting activity IDs in an AI proposal are contextual proposal evidence only. They MUST NOT silently materialize `strategy_supports` rows or raise confidence without passing the Strategy support authority.

### 9.2 STRATEGY\_COUNTEREVIDENCE\_ALERT settlement

- AI may create an `outer_loop_proposals` row with proposal type `STRATEGY_COUNTEREVIDENCE_ALERT` that points to a caller-owned Strategy and a candidate canonical source reference.
- `rpc_review_outer_loop_proposal` remains the user-review CAS boundary for accepting/editing/rejecting the alert record itself.
- `REJECTED` produces no Strategy/support mutation. `ACCEPTED` or `EDITED` only records the reviewed alert; it MUST NOT insert `strategy_supports`, change confidence, or transition lifecycle status.
- After an accepted/edited alert, a separate explicit user action is required to log `COUNTER_EVIDENCE` through `rpc_insert_strategy_support`. That RPC performs all canonical source, version-anchor, anti-replay, and tenant checks before any deterministic evaluation can occur.
- Same review key replay returns the existing reviewed alert; concurrent/different second review follows the existing proposal-review conflict contract.
- An alert whose Strategy or candidate source is foreign, missing, or source-class-mismatched cannot be turned into Strategy evidence.

## 10\. Required Validation

Exit tests:

- O008\_AI\_CANNOT\_COMMIT\_STRATEGY
- O009\_STRATEGY\_REQUIRES\_CROSS\_TIME\_SUPPORT
- O017\_STRATEGY\_CONFIDENCE\_IS\_DETERMINISTIC\_DERIVED
- O021\_AI\_PROPOSAL\_REQUIRES\_CONFIRM\_BEFORE\_COMMIT

Security validation:

- RLS tenant isolation.
- Cross-tenant source rejection.
- RPC idempotency.
- Version immutability.
- Concurrent transition protection.

Required runtime/database counterexamples:

- direct authenticated Strategy insert cannot forge lifecycle/confidence/version/owner/provenance; successful direct creation is `HYPOTHESIS` + `LOW` + version `1` with an atomic immutable version-1 snapshot;
- direct authenticated updates are limited to `title` / `description`; protocol/context/outcome/version/lifecycle/confidence bypass writes fail;
- direct authenticated Strategy delete fails and historical rows remain queryable through retirement;
- direct authenticated writes cannot insert/update/delete Strategy version/support rows;
- source replay cannot raise support count twice when evaluator version, note, asserted time, or Journal/manual source alias changes;
- random/free-form `MANUAL_OBSERVATION` UUIDs fail; only caller-owned Journal IDs are accepted;
- foreign-tenant strategy/source/version/proposal references fail closed;
- concurrent version creation yields a serialized monotonic version sequence;
- each support row is immutably anchored to exactly one Strategy version; version `1` exists at Strategy creation; old-version evidence contributes zero to current-version confidence after a protocol version change;
- concurrent lifecycle transitions cannot both win;
- evaluation below promotion thresholds cannot reach `SUPPORTED`;
- confidence derives identically from the same immutable evidence set;
- UTC boundary cases produce deterministic distinct-date counts; caller timestamp assertions cannot backdate or forward-date evidence;
- `0 SUPPORT / 0 COUNTER_EVIDENCE` deterministically yields a `0%` ratio and `LOW` confidence;
- only FINAL reviews of `COMPLETED` Seasons count toward the completed-Season threshold;
- only confirmed Activities, completed Quests with `completed_at`, and non-draft durable Artifacts count as distinct Core links;
- counter-evidence ratio below 60% weakens supported/contextual strategies;
- proposal reject creates no Strategy; accept/edit creates one Strategy; same-key replay remains one Strategy.
- counter-evidence alert reject/accept/edit does not mutate Strategy truth; only a separate user-confirmed, source-validated `COUNTER_EVIDENCE` support insert may affect confidence/status.

## 11\. Implementation Sequence

1. **Admission** — commit/push this controlling document and receive independent exact-head Gatekeeper `P0=0 / P1=0 / P2=0 + GO`.
2. **Round 1 — DB foundation** — next migration number `0046`; create the three tables, constraints, RLS, immutable/field-authority/tenant guards, and database-backed negative tests.
3. **Round 2 — RPC authority** — implement the four Strategy RPCs, deterministic confidence/transition behavior, idempotency, locks, audit, anti-replay, and proposal settlement integration.
4. **Round 3 — server boundary** — repository/service/request/http adapters and authenticated API routes with no duplicate business authority.
5. **Round 4 — Playbook UI** — `/journey/playbook` and Journey navigation, consuming only accepted HTTP/domain surfaces.
6. **Round 5 — exit verification** — O008/O009/O017/O021 plus security, concurrency, idempotency, proposal CAS, tenant isolation, versioning, and full regression gates.
7. **Final Gatekeeper** — independent review bound to the final implementation exact SHA; any finding requires a corrective head and fresh exact-head review.
8. **Merge gate** — prepare PR for user manual merge. Do not merge on the user's behalf.
9. **Final freeze** — after user merge, verify the actual `main` merge SHA and successful post-merge `main` CI before writing final archive/status and declaring Phase 8D FINAL FROZEN.

Phase 8D can only be declared FINAL FROZEN after merge and successful post-merge main CI verification.

## 12\. Definition of Done

Phase 8D is complete only when all are true:

1. Admission Gatekeeper approved this controlling-document exact head.
2. Three Strategy tables and all database authority guards are migrated with private RLS.
3. Four Strategy RPC contracts are implemented and database-backed tests prove authority, provenance, idempotency, and concurrency.
4. `STRATEGY_HYPOTHESIS` proposal review commits no Strategy before explicit user acceptance/edit acceptance.
5. Server/API boundaries expose no parallel lifecycle/confidence authority.
6. `/journey/playbook` implements the authorized lifecycle and evidence/version workflows.
7. O008/O009/O017/O021 and the section 10 counterexamples pass.
8. Local required gates and exact-head CI are green.
9. Independent final Gatekeeper returns `P0=0 / P1=0 / P2=0 + GO` for the final implementation head.
10. Accepted PR is manually merged by the user and post-merge `main` CI is green.
11. Historical NO-GO reviews remain preserved; final archive references the exact reviewed implementation head, merge SHA, and CI evidence.
