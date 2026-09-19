# Phase 8D Strategy Playbook Implementation Controlling

## 1. Governance Boundary

Status: ADMISSION CANDIDATE — production implementation remains BLOCKED pending independent exact-head Gatekeeper GO

Baseline:

- Main baseline: `98dbe37e0a6fe334b6638ca568bc3ba06b4c3aac`
- Phase 8D production implementation is blocked until this document receives an independent exact-head Gatekeeper review with `P0=0 / P1=0 / P2=0 + GO`.

This document defines implementation contracts. It does not authorize implementation before Gatekeeper admission.

## 2. Scope

### In Scope

- Strategy hypothesis lifecycle.
- Personal Playbook route `/journey/playbook`.
- Strategy evidence collection and deterministic status evaluation.
- Strategy version history.
- User confirmation flow for AI-generated strategy proposals.

### Out of Scope

- Automatic strategy creation by AI.
- Automatic promotion to `SUPPORTED`.
- Changes to XP, mastery, reward, or ledger rules.
- Deletion of strategy history.

## 3. Domain Model

Frozen tables:

- `strategies`
- `strategy_versions`
- `strategy_supports`

Strategy lifecycle:

```
HYPOTHESIS -> TESTING -> SUPPORTED
                 |          |
                 v          v
             RETIRED    CONTEXTUAL
                 ^          |
                 |          v
              WEAKENED <----
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
- VERY_HIGH

## 4. Strategy Authority Rules

AI may produce `STRATEGY_HYPOTHESIS` proposals only.

AI output must pass `OuterLoopProposal` review. The user must explicitly accept or edit and accept before a strategy enters `HYPOTHESIS`.

The application database is the only authority that commits lifecycle state.

## 5. Promotion Gate

`TESTING -> SUPPORTED` requires all conditions:

- At least 4 distinct observation dates.
- At least 1 completed Season.
- At least 2 Growth Core links.
- Support ratio >= 75%.
- Derived confidence >= HIGH.
- Explicit user confirmation.

The deterministic confidence rubric is:

| Confidence | Distinct dates | Completed Seasons | Core links | Support ratio |
| --- | ---: | ---: | ---: | ---: |
| LOW | 1 observation, or ratio < 65% | 0 | optional | < 65% or single observation |
| MODERATE | >= 2 | 0 | >= 1 | >= 65% |
| HIGH | >= 4 | >= 1 | >= 2 | >= 75% |
| VERY_HIGH | >= 8 | >= 2 | >= 4 | >= 85% |

Support ratio is `SUPPORT / (SUPPORT + COUNTER_EVIDENCE)` over accepted immutable support rows. Source-class weights documented in the frozen Strategy spec are metadata/evidential guidance only in Phase 8D; they MUST NOT silently alter this deterministic confidence calculation or lifecycle eligibility.

When the support ratio drops below 60%, deterministic evaluation automatically weakens `SUPPORTED` or `CONTEXTUAL` to `WEAKENED`. No other automatic lifecycle promotion is allowed.

## 6. Database Authority Contract

### strategies

- Primary tenant owner is `user_id = auth.uid()`; private rows require fail-closed RLS.
- User may create a `HYPOTHESIS` directly, or a `STRATEGY_HYPOTHESIS` proposal may create it only after accepted/edited user review.
- Direct client updates may edit descriptive fields, but database authority MUST reject direct mutation of `lifecycle_status` and `confidence_level`.
- Material protocol/context changes MUST go through `rpc_create_strategy_version`, increment `version`, and append an immutable snapshot.
- Strategy history is retired rather than hard-deleted in normal product flows. `RETIRED` remains queryable history.

### strategy_versions

- Entire row is immutable.
- `UNIQUE(strategy_id, version_number)`.
- Insert only through `rpc_create_strategy_version`; direct authenticated `INSERT`, `UPDATE`, and `DELETE` are denied.
- Tenant-isolation trigger asserts `NEW.user_id` equals the parent strategy owner.
- Version allocation is serialized by locking the parent `strategies` row.

### strategy_supports

- Entire row is append-only/immutable after insert.
- `source_id uuid NOT NULL`.
- `UNIQUE(strategy_id, source_class, source_id, observation_type, evaluator_version)`.
- Insert only through `rpc_insert_strategy_support`; direct authenticated `INSERT`, `UPDATE`, and `DELETE` are denied.
- Tenant-isolation trigger asserts support owner equals parent strategy owner. For `JOURNAL_CONTEXT`, the referenced journal row MUST belong to the same user. Other source classes MUST be validated against their canonical tenant-owned source where applicable.
- Duplicate canonical source identity is an idempotent replay, never a second confidence contribution.

## 7. RPC Contracts

Required RPCs:

### rpc_insert_strategy_support

Input:

```json
{
  "p_strategy_id": "uuid",
  "p_observation_type": "SUPPORT | COUNTER_EVIDENCE",
  "p_source_class": "SEASON_REVIEW | ACTIVITY | QUEST_OUTCOME | ARTIFACT | CORE_EVIDENCE_REFERENCE | JOURNAL_CONTEXT | MANUAL_OBSERVATION",
  "p_source_id": "uuid",
  "p_evaluator_version": "text",
  "p_note": "text | null",
  "p_observed_at": "timestamptz"
}
```

Contract:

- Strategy must belong to caller and be in `TESTING | SUPPORTED | CONTEXTUAL | WEAKENED`.
- Referenced source must belong to caller; foreign-tenant sources fail closed.
- `MANUAL_OBSERVATION` must anchor to a tenant-scoped immutable journal/observation UUID.
- Lock strategy row `FOR UPDATE`.
- Insert exactly one immutable support row under the composite source identity; exact replay returns the existing row.
- Re-evaluate deterministic confidence after insertion and write `STRATEGY_SUPPORT_LOGGED` audit.
- Null source identity is rejected; no support inflation through duplicate replay is permitted.

### rpc_evaluate_strategy_status

Input:

```json
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

### rpc_transition_strategy_status

Input:

```json
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

### rpc_create_strategy_version

Input:

```json
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
- Durable request idempotency MUST make exact replay return the previously created version instead of allocating another number.
- Writes a `STRATEGY_VERSION_CREATED` audit event.

All RPCs require:

- authenticated user.
- tenant ownership validation.
- idempotency handling.
- transactional audit records.
- fail-closed cross-tenant behavior.

## 8. Evidence Rules

Supported source classes:

- SEASON_REVIEW
- ACTIVITY
- QUEST_OUTCOME
- ARTIFACT
- CORE_EVIDENCE_REFERENCE
- JOURNAL_CONTEXT
- MANUAL_OBSERVATION

Evidence records require stable source identity and cannot be replayed into duplicate support records.

Canonical ownership checks are fail-closed:

- `SEASON_REVIEW` -> caller-owned `season_reviews.id`.
- `ACTIVITY` -> caller-owned Activity source.
- `QUEST_OUTCOME` -> caller-owned Quest source.
- `ARTIFACT` / `CORE_EVIDENCE_REFERENCE` -> caller-owned durable Core source.
- `JOURNAL_CONTEXT` -> caller-owned `journal_entries.id`.
- `MANUAL_OBSERVATION` -> caller-owned immutable journal/observation UUID.

The implementation must prove that a foreign-tenant UUID, a missing UUID, and a mismatched source class cannot create a support record.

## 9. API and UI Boundary

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
- review AI `STRATEGY_HYPOTHESIS` proposals through the existing proposal-review authority.

The UI MUST NOT import browser Supabase write authority, mutate lifecycle/confidence directly, or expose service-role credentials.

### 9.1 STRATEGY_HYPOTHESIS settlement

- AI may only create an `outer_loop_proposals` row with proposal type `STRATEGY_HYPOTHESIS`.
- Payload fields are `title`, `description`, `context_trigger`, `action_protocol`, `expected_outcome`, and optional supporting activity IDs as defined by the frozen AI contract.
- `rpc_review_outer_loop_proposal` remains the single atomic user-review CAS boundary.
- `REJECTED` creates no Strategy.
- `ACCEPTED` or `EDITED` validates the final payload, creates exactly one `HYPOTHESIS` strategy in the same transaction, records `resulting_entity_type/resulting_entity_id`, and audits the review.
- Same review key replay returns the already-created strategy; a different/concurrent second review loses with the existing proposal-review conflict contract.
- Supporting activity IDs in an AI proposal are contextual proposal evidence only. They MUST NOT silently materialize `strategy_supports` rows or raise confidence without passing the Strategy support authority.

## 10. Required Validation

Exit tests:

- O008_AI_CANNOT_COMMIT_STRATEGY
- O009_STRATEGY_REQUIRES_CROSS_TIME_SUPPORT
- O017_STRATEGY_CONFIDENCE_IS_DETERMINISTIC_DERIVED
- O021_AI_PROPOSAL_REQUIRES_CONFIRM_BEFORE_COMMIT

Security validation:

- RLS tenant isolation.
- Cross-tenant source rejection.
- RPC idempotency.
- Version immutability.
- Concurrent transition protection.

Required runtime/database counterexamples:

- direct authenticated writes cannot set `confidence_level` or lifecycle status;
- direct authenticated writes cannot insert/update/delete Strategy version/support rows;
- source replay cannot raise support count twice;
- foreign-tenant strategy/source/version/proposal references fail closed;
- concurrent version creation yields a serialized monotonic version sequence;
- concurrent lifecycle transitions cannot both win;
- evaluation below promotion thresholds cannot reach `SUPPORTED`;
- confidence derives identically from the same immutable evidence set;
- counter-evidence ratio below 60% weakens supported/contextual strategies;
- proposal reject creates no Strategy; accept/edit creates one Strategy; same-key replay remains one Strategy.

## 11. Implementation Sequence

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

## 12. Definition of Done

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
