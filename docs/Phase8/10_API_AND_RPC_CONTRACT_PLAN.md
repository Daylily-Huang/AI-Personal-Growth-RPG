# Phase 8 — API and RPC Contract Architecture Plan

## 1. Governance & Implementation Boundary

This document defines the **formal interface contracts and transaction semantics** for all Outer Growth Loop write operations. In accordance with Phase 8A rules, **no application route handlers or database procedures are implemented at this stage**.

### 1.1 Direct Repository vs. RPC-Only Write Authority Matrix

To preserve data integrity, write authority is divided strictly between direct repository writes (under RLS) and transactional RPCs (under PostgreSQL transaction locks):

| Entity | Direct Repository Writes | RPC-Only Operations | Rationale |
| :--- | :--- | :--- | :--- |
| **`seasons`** | `DRAFT` metadata edits | `rpc_plan_season`, `rpc_activate_season`, `rpc_conclude_season`, `rpc_cancel_season`, `rpc_amend_final_season_review` | Single `ACTIVE` invariant, 0..1 MAIN cardinality, atomic conclusion, terminal state locking, and post-conclusion review amendments require transaction guards. |
| **`season_quests`** | None (strictly read-only direct) | `rpc_link_season_quest`, `rpc_unlink_season_quest` | Direct client writes denied via RLS. Both Season and Quest ownership asserted by RPC and trigger (P0-01). |
| **`season_reviews`** | None (read-only direct) | `rpc_finalize_season_review` (periodic), atomic `rpc_conclude_season` (initial FINAL), `rpc_amend_final_season_review` (amended FINAL) | Finalized reviews are immutable and require durable commit-key retry identity and parent row locking. |
| **`journal_entries`** | `INSERT`, `UPDATE`, soft-delete (`is_archived`) | None | Private user reflections; fail-closed RLS WITH CHECK and database trigger assert cross-entity tenant ownership (P0-01). |
| **`strategies`** | Create hypothesis, edit action protocol | `rpc_evaluate_strategy_status`, `rpc_transition_strategy_status`, `rpc_create_strategy_version` | Status changes and protocol versioning require deterministic evaluation, user confirmation, and audit. |
| **`strategy_supports`**| None (read-only direct) | `rpc_insert_strategy_support` | Direct client writes denied via RLS. Non-null source identity de-duplication and ownership assertion required. |
| **`reward_accounts`** | Read-only direct | Internal settlement procedures only | Balances must never be mutated directly by client. |
| **`reward_transactions`**| Read-only direct | `rpc_grant_reward_credit`, `rpc_correct_reward_transaction`, `rpc_reserve_wish_credits`, `rpc_unreserve_wish_credits`, `rpc_redeem_wish`, `rpc_refund_wish_redemption` | Append-only ledger requires event-driven settlement, schema-backed correction/refund dedup, and canonical source dedup. |
| **`wishes`** | Create `IDEA`/`ACTIVE`, edit title/cost | `rpc_set_primary_wish`, `rpc_reserve_wish_credits`, `rpc_unreserve_wish_credits`, `rpc_redeem_wish`, `rpc_refund_wish_redemption`, `rpc_archive_wish`, `rpc_cancel_wish` | Single `PRIMARY` invariant, terminal `REDEEMED` state, and credit reservation require locking. |
| **`milestones`** | None (read-only direct) | `rpc_confirm_milestone`, `rpc_settle_milestone_reward`, `rpc_revoke_milestone` | Recognition proof verification, reward minting, and atomic revocation require transaction guards. Direct writes denied. |
| **`outer_loop_proposals`**| `INSERT` (via AI gateway) | `rpc_review_outer_loop_proposal` | User accept/edit/reject and domain entity commit require atomic CAS. Client direct writes prohibited. |

---

## 2. Standardized 13-Point RPC Specification Framework

Every state-changing procedure below is specified against the required 13-point contract:
1. **Authentication**: Session requirement.
2. **Ownership checks**: Tenant isolation via `auth.uid()`.
3. **Input schema**: Strongly typed parameter definitions.
4. **Current-state precondition**: Required entity state before execution.
5. **Allowed transition**: Strict lifecycle progression.
6. **Idempotency identity**: Request token vs canonical source identity.
7. **Deterministic validation**: Server-side business logic and policy evaluation.
8. **Locks / CAS / Concurrency behavior**: Row-level locking (`FOR UPDATE`) or atomic CAS.
9. **Atomic side effects**: Transactional mutations across tables.
10. **Audit write**: Required event written to `outer_loop_audit_events`.
11. **Error taxonomy**: Machine-readable error codes and HTTP statuses.
12. **Replay behavior**: Idempotent replay semantics.
13. **Cross-tenant behavior**: Fail-closed rejection of foreign tenant IDs.

---

## 3. High-Risk Transactional RPC Contracts

---

### 3.1 Season Lifecycle RPCs

#### 1. `rpc_plan_season`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `season.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_season_id": "uuid",
     "p_planned_start_date": "date",
     "p_target_duration_days": "integer (14..84)",
     "p_success_criteria": "jsonb",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Season exists with `status = 'DRAFT'`.
5. **Allowed transition**: `DRAFT -> PLANNED`.
6. **Idempotency identity**: `p_request_idempotency_key`.
7. **Deterministic validation**: Duration must be between 14 and 84 days (inclusive). Success criteria must be valid JSON array of criteria objects.
8. **Locks / CAS / Concurrency**: `SELECT * FROM seasons WHERE id = p_season_id AND user_id = auth.uid() FOR UPDATE;`.
9. **Atomic side effects**:
   - Updates season: `status = 'PLANNED'`, `planned_start_date = p_planned_start_date`, `target_duration_days = p_target_duration_days`, `success_criteria = p_success_criteria`, `updated_at = clock_timestamp()`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`SEASON_PLANNED`).
11. **Error Taxonomy**:
    - 400 `INVALID_DURATION` (must be 14..84 days)
    - 404 `SEASON_NOT_FOUND`
    - 409 `INVALID_STATE_TRANSITION` (season is not in DRAFT)
12. **Replay behavior**: If already `PLANNED` under same idempotency key, returns existing season record (HTTP 200).
13. **Cross-tenant behavior**: Fails closed with 404.

#### 2. `rpc_activate_season`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `season.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_season_id": "uuid",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Target season must exist with `status = 'PLANNED'`. Must have at least 1 linked quest (MAIN or FOCUS). May have 0 or 1 linked `MAIN` quest (0..1 MAIN Quest rule; linking a MAIN quest is optional).
5. **Allowed transition**: `PLANNED -> ACTIVE`. Direct activation from `DRAFT -> ACTIVE` is strictly prohibited.
6. **Idempotency identity**: `p_request_idempotency_key`.
7. **Deterministic validation**: Asserts no other active season exists for the user. Asserts season has $\ge 1$ linked quest and $\le 1$ linked MAIN quest.
8. **Locks / CAS / Concurrency**: Acquires exclusive lock on user's active seasons:
   `SELECT id FROM seasons WHERE user_id = auth.uid() AND status = 'ACTIVE' FOR UPDATE;`
   If an active season exists, aborts with 409 Conflict.
9. **Atomic side effects**:
   - Updates target season: `status = 'ACTIVE'`, `started_at = clock_timestamp()`.
   - Inserts audit event: `event_type = 'SEASON_ACTIVATED'`.
10. **Audit write**: `outer_loop_audit_events` row with `entity_type = 'seasons'`, `entity_id = p_season_id`.
11. **Error Taxonomy**:
    - 401 `UNAUTHORIZED`
    - 404 `SEASON_NOT_FOUND`
    - 409 `ACTIVE_SEASON_EXISTS`
    - 409 `INVALID_STATE_TRANSITION` (if season is DRAFT or terminal)
    - 422 `NO_LINKED_QUESTS` (must link at least 1 quest before activation)
12. **Replay behavior**: If the season is already `ACTIVE` and `request_idempotency_key` matches, returns existing season record (HTTP 200).
13. **Cross-tenant behavior**: Fails closed with 404 / 403.

#### 3. `rpc_conclude_season`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `season.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_season_id": "uuid",
     "p_target_status": "text ('COMPLETED' | 'ENDED_EARLY' | 'ABANDONED')",
     "p_final_review": "jsonb NULL (mandatory if COMPLETED or ENDED_EARLY)",
     "p_final_review_commit_key": "uuid NULL (mandatory if COMPLETED or ENDED_EARLY)",
     "p_abandonment_reason": "text NULL (mandatory if ABANDONED)",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Season `status = 'ACTIVE'`.
   - If `p_target_status IN ('COMPLETED', 'ENDED_EARLY')`: `p_final_review` and `p_final_review_commit_key` are mandatory; review must contain valid payload (`period_start`, `period_end`, `objective_summary`, `qualitative_reflection`, `criteria_evaluation`).
   - If `p_target_status = 'ABANDONED'`: `p_abandonment_reason` must not be blank.
5. **Allowed transition**: `ACTIVE -> COMPLETED`, `ACTIVE -> ENDED_EARLY`, `ACTIVE -> ABANDONED`.
6. **Idempotency identity**: `p_request_idempotency_key` (for season conclusion request), `p_final_review_commit_key` (for review commit identity).
7. **Deterministic validation**: Asserts target status is one of the three valid terminal statuses. If review is present, validates review date ranges and UUID format of `p_final_review_commit_key`.
8. **Locks / CAS / Concurrency**: Row lock on parent season: `SELECT * FROM seasons WHERE id = p_season_id AND user_id = auth.uid() FOR UPDATE;`.
9. **Atomic side effects**:
   - If `p_target_status IN ('COMPLETED', 'ENDED_EARLY')`:
     - Calculates `next_version = COALESCE(MAX(version), 0) + 1` for `review_type = 'FINAL'`.
     - Inserts immutable row into `season_reviews` (`season_id = p_season_id`, `user_id = auth.uid()`, `review_type = 'FINAL'`, `version = next_version`, `commit_key = p_final_review_commit_key`, content from `p_final_review`).
     - If prior review existed, sets `superseded_by_id`.
     - Updates season: `status = p_target_status`, `ended_at = clock_timestamp()`.
     - **Decoupled Reward Boundary (P1-03)**: Zero reward credits are minted during Phase 8B season conclusion (`rpc_conclude_season` does NOT call `rpc_grant_reward_credit`). When Phase 8E is authorized, completed seasons become eligible for server-authoritative idempotent minting reading historical `COMPLETED` season truth.
   - If `p_target_status = 'ABANDONED'`:
     - Updates season: `status = 'ABANDONED'`, `ended_at = clock_timestamp()`, `abandonment_reason = p_abandonment_reason`. Zero review rows inserted.
   - Linked quests remain untouched in their current states (Rule: SEASON_DECOUPLED_LIFECYCLE, Harness: O015).
   - Writes audit event with reason and review details.
10. **Audit write**: `outer_loop_audit_events` row recording conclusion status, review ID (if created), and abandonment reason.
11. **Error Taxonomy**:
    - 400 `MISSING_FINAL_REVIEW` (if completing/early-ending without review)
    - 400 `MISSING_FINAL_REVIEW_COMMIT_KEY` (if completing/early-ending without valid UUID commit key)
    - 400 `MISSING_ABANDONMENT_REASON` (if abandoning without reason)
    - 404 `SEASON_NOT_FOUND`
    - 409 `SEASON_NOT_ACTIVE`
12. **Replay behavior**: If already concluded with identical terminal status and `request_idempotency_key` matches, returns existing record (HTTP 200).
13. **Cross-tenant behavior**: Fails closed with 404.

#### 4. `rpc_cancel_season`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `season.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_season_id": "uuid",
     "p_cancellation_reason": "text NULL",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Season exists with `status IN ('DRAFT', 'PLANNED')`. Once a season reaches `ACTIVE`, it can never be cancelled (must be concluded or abandoned).
5. **Allowed transition**: `DRAFT -> CANCELLED`, `PLANNED -> CANCELLED`.
6. **Idempotency identity**: `p_request_idempotency_key`.
7. **Deterministic validation**: Asserts season is not `ACTIVE` or terminal.
8. **Locks / CAS / Concurrency**: `SELECT * FROM seasons WHERE id = p_season_id AND user_id = auth.uid() FOR UPDATE;`.
9. **Atomic side effects**:
   - Updates season: `status = 'CANCELLED'`, `updated_at = clock_timestamp()`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`SEASON_CANCELLED`).
11. **Error Taxonomy**:
    - 404 `SEASON_NOT_FOUND`
    - 409 `CANNOT_CANCEL_ACTIVE_OR_TERMINAL_SEASON`
12. **Replay behavior**: Returns existing cancelled record (HTTP 200).
13. **Cross-tenant behavior**: Fails closed with 404.

#### 5. `rpc_finalize_season_review`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `season.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_season_id": "uuid",
     "p_review_type": "text ('WEEKLY' | 'AD_HOC')",
     "p_period_start": "timestamptz",
     "p_period_end": "timestamptz",
     "p_objective_summary": "jsonb",
     "p_qualitative_reflection": "text",
     "p_criteria_evaluation": "jsonb",
     "p_tactical_adjustments": "text NULL",
     "p_commit_key": "uuid"
   }
   ```
4. **Current-state precondition**: Season must exist with `status = 'ACTIVE'`. (For `FINAL` reviews, use atomic `rpc_conclude_season`).
5. **Allowed transition**: Inserts immutable periodic review record into `season_reviews`.
6. **Idempotency identity**: Durable client key: `UNIQUE (user_id, commit_key)`.
7. **Deterministic validation**: Verifies time range (`period_end >= period_start`). Validates review schema.
8. **Locks / CAS / Concurrency**: Locks parent season row: `SELECT * FROM seasons WHERE id = p_season_id AND user_id = auth.uid() FOR UPDATE;`.
9. **Atomic side effects**:
   - Checks if `commit_key` already exists for this user. If found, returns existing review (idempotent replay).
   - Calculates sequential version: `SELECT COALESCE(MAX(version), 0) + 1 FROM season_reviews WHERE season_id = p_season_id AND review_type = p_review_type;`.
   - Inserts row into `season_reviews` with `version = max_version + 1`, `commit_key = p_commit_key`.
   - If prior version existed, sets `superseded_by_id = new_row.id` on the prior row.
   - Writes audit event. Zero mutations to XP or skills.
10. **Audit write**: `outer_loop_audit_events` (`REVIEW_FINALIZED`).
11. **Error Taxonomy**:
    - 400 `INVALID_PERIOD_RANGE`
    - 404 `SEASON_NOT_FOUND`
    - 409 `SEASON_NOT_ACTIVE`
    - 422 `SCHEMA_VALIDATION_FAILED`
12. **Replay behavior**: Idempotent on `commit_key`; returns existing review record.
13. **Cross-tenant behavior**: Fails closed with 404.

#### 6. `rpc_amend_final_season_review`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `season.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_season_id": "uuid",
     "p_amended_review": "jsonb",
     "p_amendment_reason": "text",
     "p_commit_key": "uuid",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Target season must exist with terminal status: `status IN ('COMPLETED', 'ENDED_EARLY')`. (Draft, planned, active, or abandoned seasons cannot have final review amendments). At least one prior `FINAL` review must exist for this season.
5. **Allowed transition**: Inserts a new immutable superseding `FINAL` review version for the terminal season. Season status remains unchanged (`COMPLETED` or `ENDED_EARLY`) and is NOT reopened.
6. **Idempotency identity**: Durable client key: `UNIQUE (user_id, commit_key)`.
7. **Deterministic validation**: Asserts `p_amendment_reason` is non-empty. Asserts `p_commit_key` is a valid UUID. Validates review schema against `SeasonReviewPayload` (`period_start`, `period_end`, `objective_summary`, `qualitative_reflection`, `criteria_evaluation`). Asserts `period_end >= period_start`.
8. **Locks / CAS / Concurrency**: Row lock on parent season row:
   `SELECT * FROM seasons WHERE id = p_season_id AND user_id = auth.uid() FOR UPDATE;`
   Serializes version allocation and prevents concurrent review insertions.
9. **Atomic side effects**:
   - Checks if `p_commit_key` already exists for this user in `season_reviews`. If found, returns existing review (exact idempotent replay, HTTP 200).
   - Locates current latest active `FINAL` review for this season:
     `SELECT * FROM season_reviews WHERE season_id = p_season_id AND review_type = 'FINAL' AND superseded_by_id IS NULL FOR UPDATE;`
   - Calculates `next_version = prior_review.version + 1`.
   - Inserts new row into `season_reviews`:
     `season_id = p_season_id`, `user_id = auth.uid()`, `review_type = 'FINAL'`, `version = next_version`, `commit_key = p_commit_key`, `supersedes_id = prior_review.id`, content from `p_amended_review`, `amendment_reason = p_amendment_reason`.
   - Updates `prior_review`: sets `superseded_by_id = new_row.id`.
   - Season status and timestamps (`started_at`, `ended_at`) remain completely untouched. Zero XP or reward mutations.
   - Writes audit event with `event_type = 'FINAL_REVIEW_AMENDED'`.
10. **Audit write**: `outer_loop_audit_events` recording `season_id`, `prior_review_id`, `new_review_id`, `version`, and `amendment_reason`.
11. **Error Taxonomy**:
    - 400 `MISSING_AMENDMENT_REASON`
    - 400 `INVALID_COMMIT_KEY`
    - 404 `SEASON_NOT_FOUND`
    - 409 `SEASON_NOT_TERMINAL` (if season is not in COMPLETED or ENDED_EARLY)
    - 409 `NO_PRIOR_FINAL_REVIEW` (if no prior final review exists to amend)
    - 422 `SCHEMA_VALIDATION_FAILED`
12. **Replay behavior**: Idempotent on `p_commit_key`. Returns existing amended review record (HTTP 200).
13. **Cross-tenant behavior**: Fails closed with 404.

#### 7. `rpc_link_season_quest` / `rpc_unlink_season_quest`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts BOTH `season.user_id = auth.uid()` AND `quest.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_season_id": "uuid",
     "p_quest_id": "uuid",
     "p_role": "text ('MAIN' | 'FOCUS')"
   }
   ```
4. **Current-state precondition**: Season status `IN ('DRAFT', 'PLANNED', 'ACTIVE')`.
5. **Allowed transition**: Creates or removes link in `season_quests`.
6. **Idempotency identity**: Natural key `(season_id, quest_id)`.
7. **Deterministic validation**: If `role = 'MAIN'`, asserts no other quest in the season currently holds `MAIN` (enforces 0..1 MAIN Quest rule).
8. **Locks / CAS / Concurrency**: Row lock on `seasons` row.
9. **Atomic side effects**: Inserts or deletes row in `season_quests`. Writes audit log.
10. **Audit write**: `outer_loop_audit_events` (`SEASON_QUEST_LINKED` / `UNLINKED`).
11. **Error Taxonomy**:
    - 403 `TENANT_MISMATCH` (if quest belongs to another user)
    - 409 `MAIN_QUEST_ALREADY_EXISTS`
    - 409 `SEASON_TERMINATED`
12. **Replay behavior**: Linking already linked quest returns HTTP 200 without duplicate insertion.
13. **Cross-tenant behavior**: If either entity belongs to another tenant, transaction aborts with 403 Forbidden.

---

### 3.2 Strategy & Playbook RPCs

#### 8. `rpc_insert_strategy_support`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts strategy and referenced source belong to `auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_strategy_id": "uuid",
     "p_observation_type": "text ('SUPPORT' | 'COUNTER_EVIDENCE')",
     "p_source_class": "text ('SEASON_REVIEW' | 'ACTIVITY' | 'QUEST_OUTCOME' | 'ARTIFACT' | 'CORE_EVIDENCE_REFERENCE' | 'JOURNAL_CONTEXT' | 'MANUAL_OBSERVATION')",
     "p_source_id": "uuid",
     "p_evaluator_version": "text",
     "p_note": "text NULL",
     "p_observed_at": "timestamptz"
   }
   ```
4. **Current-state precondition**: Strategy exists and `lifecycle_status IN ('TESTING', 'SUPPORTED', 'CONTEXTUAL', 'WEAKENED')`. `p_source_id` must be a valid, non-null UUID.
5. **Allowed transition**: Appends empirical observation to `strategy_supports`.
6. **Idempotency identity**: Composite source identity constraint: `UNIQUE (strategy_id, source_class, source_id, observation_type, evaluator_version)`.
7. **Deterministic validation**: Asserts `p_source_id IS NOT NULL`. If `source_class = 'MANUAL_OBSERVATION'`, `p_source_id` must reference a valid tenant-scoped `journal_entries.id` or dedicated immutable observation UUID.
8. **Locks / CAS / Concurrency**: Target strategy row locked `FOR UPDATE`.
9. **Atomic side effects**:
   - Inserts row into `strategy_supports`.
   - Triggers deterministic re-evaluation of confidence level via `rpc_evaluate_strategy_status`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`STRATEGY_SUPPORT_LOGGED`).
11. **Error Taxonomy**:
    - 400 `NULL_SOURCE_ID_PROHIBITED`
    - 404 `STRATEGY_NOT_FOUND`
    - 409 `DUPLICATE_OBSERVATION` (handled idempotently)
    - 422 `INVALID_SOURCE_CLASS`
12. **Replay behavior**: Replaying with identical source identity returns existing record without duplicate insertion (HTTP 200).
13. **Cross-tenant behavior**: Foreign source reference fails closed with 403 Forbidden.

#### 9. `rpc_evaluate_strategy_status`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `strategy.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_strategy_id": "uuid",
     "p_confirm_promotion": "boolean DEFAULT false"
   }
   ```
4. **Current-state precondition**: Strategy exists.
5. **Allowed transition**: Derives confidence level (`LOW`, `MODERATE`, `HIGH`, `VERY_HIGH`). If `p_confirm_promotion = true` and criteria met, promotes `TESTING -> SUPPORTED`. If counter-evidence ratio drops below 60%, automatically demotes `SUPPORTED | CONTEXTUAL -> WEAKENED`.
6. **Idempotency identity**: Pure deterministic calculation over logged `strategy_supports`.
7. **Deterministic validation**:
   - Evaluates distinct observation dates, completed seasons, core links, and net success ratio $\frac{\text{Supports}}{\text{Supports} + \text{Counters}}$.
   - Derives confidence:
     - `LOW`: $< 65\%$ or 1 observation.
     - `MODERATE`: $\ge 2$ distinct dates, 0 seasons, $\ge 1$ Core link, ratio $\ge 65\%$.
     - `HIGH`: $\ge 4$ distinct dates, $\ge 1$ completed season, $\ge 2$ Core links, ratio $\ge 75\%$.
     - `VERY_HIGH`: $\ge 8$ distinct dates, $\ge 2$ completed seasons, $\ge 4$ Core links, ratio $\ge 85\%$.
   - **Promotion Gate (O8)**: Promotion to `SUPPORTED` requires derived confidence $\ge$ `HIGH`. Status is updated to `SUPPORTED` ONLY if `p_confirm_promotion = true` (user confirmation). Background evaluators derive confidence without mutating lifecycle status.
8. **Locks / CAS / Concurrency**: Row lock on `strategies` row (`FOR UPDATE`).
9. **Atomic side effects**:
   - Updates `strategies.confidence_level`.
   - If user confirmed and criteria met, updates `strategies.lifecycle_status = 'SUPPORTED'`.
   - If ratio drops $< 60\%$, updates `strategies.lifecycle_status = 'WEAKENED'`.
   - Writes audit event if status or confidence changed.
10. **Audit write**: `outer_loop_audit_events` (`STRATEGY_EVALUATED`).
11. **Error Taxonomy**:
    - 404 `STRATEGY_NOT_FOUND`
    - 422 `INSUFFICIENT_SUPPORT_FOR_PROMOTION` (if `p_confirm_promotion = true` but criteria unmet)
12. **Replay behavior**: Pure deterministic calculation; identical inputs produce identical derived values.
13. **Cross-tenant behavior**: Fails closed with 404.

#### 10. `rpc_transition_strategy_status`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `strategy.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_strategy_id": "uuid",
     "p_target_status": "text ('HYPOTHESIS' | 'TESTING' | 'SUPPORTED' | 'CONTEXTUAL' | 'WEAKENED' | 'RETIRED')",
     "p_context_boundary_note": "text NULL (mandatory if CONTEXTUAL)",
     "p_retirement_reason": "text NULL (mandatory if RETIRED)",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Strategy exists. Transition must follow allowed graph:
   - `HYPOTHESIS -> TESTING`
   - `TESTING -> SUPPORTED` (requires derived confidence $\ge$ `HIGH`)
   - `TESTING -> RETIRED`
   - `SUPPORTED -> CONTEXTUAL` / `CONTEXTUAL -> SUPPORTED`
   - `SUPPORTED -> WEAKENED` / `CONTEXTUAL -> WEAKENED`
   - `WEAKENED -> TESTING` (re-testing with revised protocol)
   - `WEAKENED -> RETIRED`
5. **Allowed transition**: User-confirmed manual or policy transitions.
6. **Idempotency identity**: `p_request_idempotency_key`.
7. **Deterministic validation**: Asserts target status is permitted from current status. If `SUPPORTED`, asserts confidence $\ge$ `HIGH`.
8. **Locks / CAS / Concurrency**: Row lock on `strategies` (`FOR UPDATE`).
9. **Atomic side effects**:
   - Updates `strategies.lifecycle_status = p_target_status`, `updated_at = clock_timestamp()`.
   - Writes audit event with reason/notes.
10. **Audit write**: `outer_loop_audit_events` (`STRATEGY_STATUS_TRANSITIONED`).
11. **Error Taxonomy**:
    - 400 `MISSING_CONTEXT_BOUNDARY_NOTE`
    - 400 `MISSING_RETIREMENT_REASON`
    - 404 `STRATEGY_NOT_FOUND`
    - 409 `INVALID_LIFECYCLE_TRANSITION`
    - 422 `PROMOTION_CRITERIA_UNMET`
12. **Replay behavior**: Idempotent on `request_idempotency_key`; returns existing strategy status (HTTP 200).
13. **Cross-tenant behavior**: Fails closed with 404.

#### 11. `rpc_create_strategy_version`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `strategy.user_id = auth.uid()`.
3. **Input Schema**:
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
4. **Current-state precondition**: Strategy exists.
5. **Allowed transition**: Appends immutable snapshot to `strategy_versions` and updates current strategy protocol.
6. **Idempotency identity**: `p_request_idempotency_key`.
7. **Deterministic validation**: Protocol texts must not be blank.
8. **Locks / CAS / Concurrency**: `SELECT * FROM strategies WHERE id = p_strategy_id AND user_id = auth.uid() FOR UPDATE;`.
9. **Atomic side effects**:
   - Computes `next_version = strategy.version + 1`.
   - Inserts row into `strategy_versions` (`version_number = next_version`, snapshot content).
   - Updates `strategies`: `version = next_version`, `action_protocol = p_action_protocol`, `context_trigger = p_context_trigger`, `expected_outcome = p_expected_outcome`, `updated_at = clock_timestamp()`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`STRATEGY_VERSION_CREATED`).
11. **Error Taxonomy**:
    - 404 `STRATEGY_NOT_FOUND`
    - 422 `BLANK_PROTOCOL_CONTENT`
12. **Replay behavior**: Idempotent on `request_idempotency_key`; returns version record (HTTP 200).
13. **Cross-tenant behavior**: Fails closed with 404.

---

### 3.3 Reward Economy RPCs

#### 12. `rpc_grant_reward_credit`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts caller owns target `reward_accounts` and verified source record.
3. **Input Schema**:
   ```json
   {
     "p_source_type": "text ('SEASON' | 'QUEST' | 'MASTERY' | 'ARTIFACT' | 'REAL_WORLD_VERIFIED')",
     "p_source_id": "text (UUID or composite identity, e.g. ${skill.id}:M6)",
     "p_policy_version": "text",
     "p_request_idempotency_key": "text"
   }
   ```
   *(Note: Client DOES NOT pass `p_amount`. Credit amount is strictly derived on server).*
4. **Current-state precondition**: Source record must exist in database, belong to caller, and satisfy policy criteria:
   - Quest: `status = 'completed' AND (quest_size IN ('major', 'epic', 'main') OR is_boss = true)`.
   - Season: `status = 'COMPLETED'` with confirmed final review.
   - Mastery: Verified `evidence` backing M6, M8, or M10. `canonical_source_id` is composite `${skill.id}:M${level}`.
   - Real-World: Independently verified proof record (not self-attestation alone).
5. **Allowed transition**: Appends `EARN` event to `reward_transactions`.
6. **Idempotency identity**: Canonical source identity:
   `UNIQUE (user_id, canonical_source_type, canonical_source_id, policy_version, event_kind) WHERE event_kind = 'EARN'`.
7. **Deterministic validation**: Server calculates exact credit amount from `(source_record, policy_version)`.
8. **Locks / CAS / Concurrency**: Locks `reward_accounts` row `FOR UPDATE`.
9. **Atomic side effects**:
   - Inserts row into `reward_transactions` (`event_kind = 'EARN'`, `amount = calculated_amount`).
   - Updates `reward_accounts`: folds ledger via `foldRewardLedger`. If deficit exists, incoming credits pay down deficit first.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`REWARD_CREDIT_GRANTED`).
11. **Error Taxonomy**:
    - 400 `INVALID_SOURCE_CLASS` (e.g. attempting micro-task or login)
    - 404 `SOURCE_NOT_FOUND`
    - 409 `REWARD_ALREADY_MINTED` (canonical source unique index collision)
    - 422 `POLICY_CRITERIA_UNMET`
12. **Replay behavior**:
    - If identical `request_idempotency_key` is submitted, returns existing transaction record (HTTP 200).
    - If a different request key is submitted for an already-minted canonical source identity, fails closed with HTTP 409 Conflict (`REWARD_ALREADY_MINTED`).
13. **Cross-tenant behavior**: Fails closed with 403 / 404.

#### 13. `rpc_correct_reward_transaction`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Caller owns original transaction and account.
3. **Input Schema**:
   ```json
   {
     "p_target_transaction_id": "uuid",
     "p_correction_reason": "text",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Original transaction must exist with `event_kind = 'EARN'`. No prior `CORRECTION` transaction may exist for this target.
5. **Allowed transition**: Appends `CORRECTION` event with negative amount matching the original grant.
6. **Idempotency identity**: Schema-backed partial unique index on `(correction_for_id)` ensures exactly ONE correction per original transaction.
7. **Deterministic validation**: Asserts target transaction has not already been corrected.
8. **Locks / CAS / Concurrency**: Locks `reward_accounts` and `reward_transactions` row `FOR UPDATE`.
9. **Atomic side effects**:
   - Appends `CORRECTION` transaction (`amount = -original.amount`, `correction_for_id = p_target_transaction_id`).
   - Re-folds ledger via `foldRewardLedger`. If `current_available` drops below 0, records `correction_deficit` and clamps available balance to 0.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`REWARD_TRANSACTION_CORRECTED`).
11. **Error Taxonomy**:
    - 404 `TRANSACTION_NOT_FOUND`
    - 409 `TRANSACTION_ALREADY_CORRECTED`
    - 422 `CORRECTION_FOR_ID_ALREADY_EXISTS`
12. **Replay behavior**:
    - Replay with same `request_idempotency_key` returns existing correction record (HTTP 200).
    - Submitting a different request key for an already-corrected transaction fails closed with HTTP 409 Conflict (`TRANSACTION_ALREADY_CORRECTED`).
13. **Cross-tenant behavior**: Fails closed with 404.

#### 14. `rpc_set_primary_wish`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts wish belongs to `auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_wish_id": "uuid",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Wish exists and `status = 'ACTIVE'`.
5. **Allowed transition**: Wish: `ACTIVE -> PRIMARY`. Any existing `PRIMARY` wish is atomically demoted to `ACTIVE`.
6. **Idempotency identity**: Partial unique index `UNIQUE (user_id) WHERE status = 'PRIMARY'`.
7. **Deterministic validation**: Asserts target wish is currently `ACTIVE`.
8. **Locks / CAS / Concurrency**: Locks all relevant wish rows for the user:
   `SELECT id, status FROM wishes WHERE user_id = auth.uid() AND (id = p_wish_id OR status = 'PRIMARY') FOR UPDATE;`.
9. **Atomic side effects**:
   - If an existing wish has `status = 'PRIMARY'` and `id != p_wish_id`, demotes it to `status = 'ACTIVE'`.
   - Updates target wish: `status = 'PRIMARY'`, `updated_at = clock_timestamp()`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`WISH_SET_PRIMARY`).
11. **Error Taxonomy**:
    - 404 `WISH_NOT_FOUND`
    - 409 `WISH_NOT_ACTIVE` (e.g. if wish is IDEA, RESERVED, or REDEEMED)
12. **Replay behavior**: Replay with same request key returns existing primary wish record (HTTP 200).
13. **Cross-tenant behavior**: Fails closed with 404.

#### 15. `rpc_reserve_wish_credits`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts wish and reward account belong to `auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_wish_id": "uuid",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Wish status must be `PRIMARY`. Account `current_available >= wish.credit_cost`.
5. **Allowed transition**: Wish: `PRIMARY -> RESERVED`.
6. **Idempotency identity**: `p_request_idempotency_key`.
7. **Deterministic validation**: Balance check against `current_available`.
8. **Locks / CAS / Concurrency**: Locks `reward_accounts` and `wishes` rows `FOR UPDATE`.
9. **Atomic side effects**:
   - Appends `RESERVE` transaction (`amount = wish.credit_cost`).
   - Re-folds ledger: decrements `current_available`, increments `current_reserved`.
   - Updates `wishes.status = 'RESERVED'`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`WISH_CREDITS_RESERVED`).
11. **Error Taxonomy**:
    - 404 `WISH_NOT_FOUND`
    - 409 `WISH_NOT_PRIMARY`
    - 422 `INSUFFICIENT_AVAILABLE_CREDITS`
12. **Replay behavior**: If wish is already `RESERVED` under same idempotency key, returns HTTP 200.
13. **Cross-tenant behavior**: Fails closed with 404.

#### 16. `rpc_unreserve_wish_credits`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Caller owns wish and account.
3. **Input Schema**:
   ```json
   {
     "p_wish_id": "uuid",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Wish status is `RESERVED`.
5. **Allowed transition**: Wish: `RESERVED -> PRIMARY`.
6. **Idempotency identity**: `p_request_idempotency_key`.
7. **Deterministic validation**: Asserts wish is in `RESERVED` state.
8. **Locks / CAS / Concurrency**: Locks `reward_accounts` and `wishes` rows `FOR UPDATE`.
9. **Atomic side effects**:
   - Appends `UNRESERVE` transaction (`amount = wish.credit_cost`).
   - Re-folds ledger: decrements `current_reserved`, increments `current_available`.
   - Updates `wishes.status = 'PRIMARY'`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`WISH_CREDITS_UNRESERVED`).
11. **Error Taxonomy**:
    - 404 `WISH_NOT_FOUND`
    - 409 `WISH_NOT_RESERVED`
12. **Replay behavior**: Idempotent; returns existing wish state (HTTP 200).
13. **Cross-tenant behavior**: Fails closed with 404.

#### 17. `rpc_redeem_wish`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Caller owns wish and account.
3. **Input Schema**:
   ```json
   {
     "p_wish_id": "uuid",
     "p_celebration_note": "text NULL",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Wish status is `RESERVED`.
5. **Allowed transition**: Wish: `RESERVED -> REDEEMED` (terminal state).
6. **Idempotency identity**: Unique constraint on `reward_redemptions.transaction_id`.
7. **Deterministic validation**: Asserts wish is currently `RESERVED`.
8. **Locks / CAS / Concurrency**: Locks `reward_accounts` and `wishes` rows `FOR UPDATE`.
9. **Atomic side effects**:
   - Appends `REDEEM` transaction (`amount = wish.credit_cost`).
   - Re-folds ledger: decrements `current_reserved`, increments `lifetime_redeemed`.
   - Updates `wishes.status = 'REDEEMED'`. Sets `wishes.cooldown_until = clock_timestamp() + interval '7 days'`.
   - Inserts permanent, immutable receipt into `reward_redemptions`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`WISH_REDEEMED`).
11. **Error Taxonomy**:
    - 404 `WISH_NOT_FOUND`
    - 409 `WISH_NOT_RESERVED`
    - 409 `WISH_ALREADY_REDEEMED`
12. **Replay behavior**:
    - Replay with same request key returns existing redemption receipt (HTTP 200).
    - Concurrent second redemption attempt fails closed with HTTP 409 Conflict (`WISH_ALREADY_REDEEMED`).
13. **Cross-tenant behavior**: Fails closed with 404.

#### 18. `rpc_refund_wish_redemption`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Caller owns wish, redemption receipt, and account.
3. **Input Schema**:
   ```json
   {
     "p_redemption_id": "uuid",
     "p_refund_reason": "text",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Redemption receipt exists and has not been refunded.
5. **Allowed transition**: Compensating refund restoring spent credits to ledger.
6. **Idempotency identity**: Schema-backed partial unique constraint:
   `CREATE UNIQUE INDEX uq_reward_tx_refund_for_redemption ON reward_transactions (refund_for_redemption_id) WHERE event_kind = 'REFUND';`
7. **Deterministic validation**: Asserts refund reason is provided. Asserts redemption exists and has not already been refunded.
8. **Locks / CAS / Concurrency**: Locks `reward_accounts` row `FOR UPDATE`.
9. **Atomic side effects**:
   - Appends `REFUND` transaction to `reward_transactions` (`amount = redemption.credits_spent`, `refund_for_redemption_id = p_redemption_id`).
   - Re-folds ledger: decrements `lifetime_redeemed`, increments `current_available`.
   - **Terminal State Invariant**: `reward_redemptions` receipt is 100% immutable (zero columns updated). The `Wish` entity **strictly remains in `REDEEMED` status** (never transitions back to `ACTIVE`).
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`WISH_REDEMPTION_REFUNDED`).
11. **Error Taxonomy**:
    - 404 `REDEMPTION_NOT_FOUND`
    - 409 `REDEMPTION_ALREADY_REFUNDED`
12. **Replay behavior**:
    - Replay with same `request_idempotency_key` returns existing refund transaction (HTTP 200).
    - Submitting a different request key for an already-refunded redemption fails closed with HTTP 409 Conflict (`REDEMPTION_ALREADY_REFUNDED`).
13. **Cross-tenant behavior**: Fails closed with 404.

#### 19. `rpc_archive_wish` / `rpc_cancel_wish`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Caller owns target wish.
3. **Input Schema**:
   ```json
   {
     "p_wish_id": "uuid",
     "p_action": "text ('ARCHIVE' | 'CANCEL')",
     "p_reason": "text NULL",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Wish exists with `status IN ('IDEA', 'ACTIVE', 'PRIMARY')`. If status is `RESERVED`, wish must be explicitly unreserved first. If `REDEEMED`, cannot be archived or cancelled.
5. **Allowed transition**: `IDEA/ACTIVE/PRIMARY -> ARCHIVED` or `CANCELLED`.
6. **Idempotency identity**: `p_request_idempotency_key`.
7. **Deterministic validation**: Asserts status is not `RESERVED` or `REDEEMED`.
8. **Locks / CAS / Concurrency**: `SELECT * FROM wishes WHERE id = p_wish_id AND user_id = auth.uid() FOR UPDATE;`.
9. **Atomic side effects**:
   - Updates target wish: `status = (p_action == 'ARCHIVE' ? 'ARCHIVED' : 'CANCELLED')`, `updated_at = clock_timestamp()`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`WISH_DISCARDED`).
11. **Error Taxonomy**:
    - 404 `WISH_NOT_FOUND`
    - 409 `CANNOT_DISCARD_RESERVED_OR_REDEEMED_WISH`
12. **Replay behavior**: Returns existing wish state idempotently (HTTP 200).
13. **Cross-tenant behavior**: Fails closed with 404.

---

### 3.4 Milestone Subsystem RPCs

#### 20. `rpc_confirm_milestone`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts underlying source belongs to `auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_milestone_key": "text",
     "p_title": "text",
     "p_description": "text",
     "p_recognition_class": "text ('CORE_VERIFIED' | 'USER_CONFIRMED_REAL_WORLD')",
     "p_source_type": "text",
     "p_source_id": "text",
     "p_external_evidence_url": "text NULL",
     "p_external_credential_id": "text NULL",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Milestone identity does not already exist for user: `UNIQUE (user_id, milestone_key, source_type, source_id)`.
5. **Allowed transition**: Inserts recognition record in `milestones`.
6. **Idempotency identity**: Composite natural key `UNIQUE (user_id, milestone_key, source_type, source_id)`.
7. **Deterministic validation**:
   - `p_source_id` must be non-empty text.
   - If `CORE_VERIFIED`: Asserts source record exists in Core and satisfies criteria.
   - If `USER_CONFIRMED_REAL_WORLD`: Records self-attestation with optional external proof URL/credential. Notes that self-attestation alone DOES NOT grant reward credits.
8. **Locks / CAS / Concurrency**: Database unique index constraint check on `(user_id, milestone_key, source_type, source_id)`.
9. **Atomic side effects**: Inserts row into `milestones` with `status = 'ACTIVE'`, `granted_reward_credit = false`. Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`MILESTONE_CONFIRMED`).
11. **Error Taxonomy**:
    - 400 `MISSING_SOURCE_ID`
    - 409 `MILESTONE_ALREADY_EXISTS`
    - 422 `INVALID_RECOGNITION_CLASS`
12. **Replay behavior**: Returns existing milestone record idempotently (HTTP 200).
13. **Cross-tenant behavior**: Foreign source check fails closed with 403.

#### 21. `rpc_settle_milestone_reward`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts milestone belongs to `auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_milestone_id": "uuid",
     "p_policy_version": "text",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Milestone exists, `status = 'ACTIVE'`, and `granted_reward_credit = false`. If `USER_CONFIRMED_REAL_WORLD`, must possess verified independent external evidence (`external_evidence_url` or `external_credential_id`).
5. **Allowed transition**: Mints credits and links milestone to reward transaction.
6. **Idempotency identity**: Canonical Core source identity:
   `UNIQUE (user_id, underlying_canonical_source_type, underlying_canonical_source_id, policy_version, 'EARN')`.
7. **Deterministic validation**: Anchors to underlying Core source (`canonical_source_type = 'QUEST'`, `${quest.id}`, or `'MASTERY'`, `${skill.id}:M${level}`). If that Core event already minted credits, rejects minting to prevent wrapper double-minting.
8. **Locks / CAS / Concurrency**: Locks `milestones` and `reward_accounts` rows `FOR UPDATE`.
9. **Atomic side effects**:
   - Invokes internal `grant_reward_credit` procedure.
   - Updates `milestones.granted_reward_credit = true`, `reward_transaction_id = tx.id`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`MILESTONE_REWARD_SETTLED`).
11. **Error Taxonomy**:
    - 404 `MILESTONE_NOT_FOUND`
    - 409 `REWARD_ALREADY_MINTED_FOR_SOURCE` (wrapper double-mint blocked)
    - 422 `INELIGIBLE_FOR_REWARD` (self-attestation without independent proof)
12. **Replay behavior**: Returns existing settlement without duplicate crediting.
13. **Cross-tenant behavior**: Fails closed with 404.

#### 22. `rpc_revoke_milestone`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `milestone.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_milestone_id": "uuid",
     "p_revocation_reason": "text",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Milestone exists and `status = 'ACTIVE'`.
5. **Allowed transition**: Milestone: `ACTIVE -> REVOKED`. Row is preserved for historical audit (append-/status-preserving, strictly never hard-deleted).
6. **Idempotency identity**: `p_request_idempotency_key`.
7. **Deterministic validation**: Asserts `p_revocation_reason` is non-empty string.
8. **Locks / CAS / Concurrency**: Locks `milestones` row `FOR UPDATE`. If `granted_reward_credit = true`, also locks `reward_accounts` row `FOR UPDATE`.
9. **Atomic side effects**:
   - Updates `milestones`: `status = 'REVOKED'`, `revoked_at = clock_timestamp()`, `revocation_reason = p_revocation_reason`, `updated_at = clock_timestamp()`.
   - If `milestones.granted_reward_credit = true` AND `milestones.reward_transaction_id IS NOT NULL`:
     - Locates original `EARN` transaction in `reward_transactions`.
     - Appends an offsetting `CORRECTION` transaction: `event_kind = 'CORRECTION'`, `amount = -original.amount`, `correction_for_id = milestones.reward_transaction_id`, `notes = 'Milestone revoked: ' || p_revocation_reason`.
     - Re-folds ledger via `foldRewardLedger`: decrements `current_available` and `lifetime_earned`. If available drops below 0, records deficit and clamps available to 0.
   - Writes audit event with `event_type = 'MILESTONE_REVOKED'`.
10. **Audit write**: `outer_loop_audit_events` recording `milestone_id`, `revocation_reason`, and `correction_tx_id` (if credit was reversed).
11. **Error Taxonomy**:
    - 400 `MISSING_REVOCATION_REASON`
    - 404 `MILESTONE_NOT_FOUND`
    - 409 `MILESTONE_ALREADY_REVOKED`
12. **Replay behavior**: Replaying with same `request_idempotency_key` returns existing revoked milestone state (HTTP 200).
13. **Cross-tenant behavior**: Fails closed with 404.

---

### 3.5 AI Proposal Review RPC

#### 23. `rpc_review_outer_loop_proposal`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `proposal.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_proposal_id": "uuid",
     "p_decision": "text ('ACCEPTED' | 'EDITED' | 'REJECTED')",
     "p_edited_payload": "jsonb NULL",
     "p_rejection_reason": "text NULL",
     "p_review_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Proposal exists with `status = 'PROPOSED'` and `expires_at > clock_timestamp()`.
5. **Allowed transition**: `PROPOSED -> ACCEPTED | EDITED | REJECTED`.
6. **Idempotency identity**: Durable persisted key: `UNIQUE (user_id, review_request_idempotency_key) WHERE review_request_idempotency_key IS NOT NULL` + CAS on `status = 'PROPOSED'`.
7. **Deterministic validation**: If accepted/edited, validates payload against target domain schema. If rejected, optionally records rejection reason.
8. **Locks / CAS / Concurrency**:
   ```sql
   UPDATE outer_loop_proposals
   SET status = p_decision,
       decision = p_decision,
       reviewed_at = clock_timestamp(),
       reviewed_by_id = auth.uid(),
       review_request_idempotency_key = p_review_request_idempotency_key,
       rejection_reason = p_rejection_reason,
       updated_at = clock_timestamp()
   WHERE id = p_proposal_id AND status = 'PROPOSED' AND user_id = auth.uid()
   RETURNING *;
   ```
   If zero rows updated:
   - Queries `outer_loop_proposals WHERE id = p_proposal_id AND user_id = auth.uid()`.
   - **Exact Same-Key Replay**: If `review_request_idempotency_key = p_review_request_idempotency_key` AND `decision = p_decision`: returns HTTP 200 with previously committed domain entity / proposal state.
   - **Distinct Key / Concurrent Loser**: If status is already terminal (`ACCEPTED`/`EDITED`/`REJECTED`) with a different key or different decision, aborts with HTTP 409 `PROPOSAL_ALREADY_REVIEWED`.
9. **Atomic side effects**:
   - If `ACCEPTED` or `EDITED`: Inserts corresponding domain record (`seasons`, `strategies`, etc.) within same transaction.
   - Updates proposal: `resulting_entity_type`, `resulting_entity_id`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`PROPOSAL_REVIEWED`).
11. **Error Taxonomy**:
    - 404 `PROPOSAL_NOT_FOUND`
    - 409 `PROPOSAL_ALREADY_REVIEWED` (distinct retry or concurrent loser blocked)
    - 422 `PROPOSAL_EXPIRED`
    - 422 `PAYLOAD_VALIDATION_FAILED`
12. **Replay behavior**:
    - Same request key replay under matching decision returns committed domain entity (HTTP 200).
    - Concurrent race loser or second attempt with distinct key receives HTTP 409 Conflict (`PROPOSAL_ALREADY_REVIEWED`).
13. **Cross-tenant behavior**: Fails closed with 404.
