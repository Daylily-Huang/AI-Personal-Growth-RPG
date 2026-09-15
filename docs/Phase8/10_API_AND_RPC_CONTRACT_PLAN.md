# Phase 8 — API and RPC Contract Architecture Plan

## 1. Governance & Implementation Boundary

This document defines the **formal interface contracts and transaction semantics** for all Outer Growth Loop write operations. In accordance with Phase 8A rules, **no application route handlers or database procedures are implemented at this stage**.

### 1.1 Direct Repository vs. RPC-Only Write Authority Matrix

To preserve data integrity, write authority is divided strictly between direct repository writes (under RLS) and transactional RPCs (under PostgreSQL transaction locks):

| Entity | Direct Repository Writes | RPC-Only Operations | Rationale |
| :--- | :--- | :--- | :--- |
| **`seasons`** | `DRAFT` CRUD, `PLANNED` metadata edits | `rpc_activate_season`, `rpc_conclude_season` | Single `ACTIVE` invariant and terminal state locking require transaction guards. |
| **`season_quests`** | None (read-only direct) | `rpc_link_season_quest`, `rpc_unlink_season_quest` | Cross-tenant validation on both Season and Quest required. |
| **`season_reviews`** | None (read-only direct) | `rpc_finalize_season_review` | Finalized reviews are immutable and require retry-safe versioning. |
| **`journal_entries`** | `INSERT`, `UPDATE`, soft-delete (`is_archived`) | None | Private user reflections; fail-closed RLS ensures tenant isolation. |
| **`strategies`** | Create hypothesis, edit action protocol | `rpc_evaluate_strategy_status` | Status promotion to `SUPPORTED` requires deterministic evaluation of logged supports. |
| **`strategy_supports`**| None (read-only direct) | `rpc_insert_strategy_support` | Source identity de-duplication and ownership assertion required. |
| **`reward_accounts`** | Read-only direct | Internal settlement procedures only | Balances must never be mutated directly by client. |
| **`reward_transactions`**| Read-only direct | `rpc_grant_reward_credit`, `rpc_correct_reward_transaction`, `rpc_reserve_wish_credits`, `rpc_unreserve_wish_credits`, `rpc_redeem_wish`, `rpc_refund_wish_redemption` | Append-only ledger requires event-driven settlement and canonical source dedup. |
| **`wishes`** | Create `IDEA`/`ACTIVE`, edit title/cost | `rpc_set_primary_wish`, `rpc_reserve_wish_credits`, `rpc_redeem_wish` | Single `PRIMARY` invariant and credit reservation require locking. |
| **`milestones`** | None (read-only direct) | `rpc_confirm_milestone`, `rpc_settle_milestone_reward` | Recognition proof verification and reward minting require atomic settlement. |
| **`outer_loop_proposals`**| `INSERT` (via AI gateway) | `rpc_review_outer_loop_proposal` | User accept/edit/reject and domain entity commit require atomic CAS. |

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

#### 1. `rpc_activate_season`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `season.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_season_id": "uuid",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Target season must exist with `status = 'PLANNED'`. Target start date and at least one linked `MAIN` quest must be defined.
5. **Allowed transition**: `PLANNED -> ACTIVE`. Direct activation from `DRAFT -> ACTIVE` is strictly prohibited.
6. **Idempotency identity**: `p_request_idempotency_key`.
7. **Deterministic validation**: Verifies duration is between 14 and 84 days.
8. **Locks / CAS / Concurrency**: Acquires exclusive lock on user's active seasons:
   `SELECT id FROM seasons WHERE user_id = auth.uid() AND status = 'ACTIVE' FOR UPDATE;`
   If an active season exists, aborts.
9. **Atomic side effects**:
   - Updates target season: `status = 'ACTIVE'`, `started_at = clock_timestamp()`.
   - Inserts audit event: `event_type = 'SEASON_ACTIVATED'`.
10. **Audit write**: `outer_loop_audit_events` row with `entity_type = 'seasons'`, `entity_id = p_season_id`.
11. **Error Taxonomy**:
    - 401 `UNAUTHORIZED`
    - 404 `SEASON_NOT_FOUND`
    - 409 `ACTIVE_SEASON_EXISTS`
    - 409 `INVALID_STATE_TRANSITION` (if season is DRAFT or terminal)
    - 422 `MISSING_SEASON_PREREQUISITES` (if duration or main quest missing)
12. **Replay behavior**: If the season is already `ACTIVE` and `request_idempotency_key` matches, returns existing season record (HTTP 200).
13. **Cross-tenant behavior**: Fails closed with 404 / 403 if `p_season_id` belongs to another tenant.

#### 2. `rpc_conclude_season`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `season.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_season_id": "uuid",
     "p_target_status": "text ('COMPLETED' | 'ENDED_EARLY' | 'ABANDONED')",
     "p_abandonment_reason": "text NULL (mandatory if ABANDONED)",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Season `status = 'ACTIVE'`. If `p_target_status = 'ABANDONED'`, `p_abandonment_reason` must not be blank.
5. **Allowed transition**: `ACTIVE -> COMPLETED`, `ACTIVE -> ENDED_EARLY`, `ACTIVE -> ABANDONED`.
6. **Idempotency identity**: `p_request_idempotency_key`.
7. **Deterministic validation**: Asserts target status is one of the three valid terminal statuses.
8. **Locks / CAS / Concurrency**: `SELECT * FROM seasons WHERE id = p_season_id AND user_id = auth.uid() FOR UPDATE;`.
9. **Atomic side effects**:
   - Updates season: `status = p_target_status`, `ended_at = clock_timestamp()`.
   - Linked quests remain untouched (Rule: SEASON_DECOUPLED_LIFECYCLE, Harness: O015).
   - Writes audit event with reason details.
10. **Audit write**: `outer_loop_audit_events` row recording conclusion status and abandonment reason if applicable.
11. **Error Taxonomy**:
    - 400 `MISSING_ABANDONMENT_REASON`
    - 404 `SEASON_NOT_FOUND`
    - 409 `SEASON_NOT_ACTIVE`
12. **Replay behavior**: If already concluded with identical terminal status, returns existing record.
13. **Cross-tenant behavior**: Fails closed with 404.

#### 3. `rpc_finalize_season_review`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `season.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_season_id": "uuid",
     "p_review_type": "text ('WEEKLY' | 'FINAL' | 'AD_HOC')",
     "p_period_start": "timestamptz",
     "p_period_end": "timestamptz",
     "p_objective_summary": "jsonb",
     "p_qualitative_reflection": "text",
     "p_criteria_evaluation": "jsonb",
     "p_tactical_adjustments": "text NULL",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Season must exist. If `FINAL`, season must be `COMPLETED` or `ENDED_EARLY`.
5. **Allowed transition**: Inserts immutable finalized review.
6. **Idempotency identity**: Deterministic composite constraint `UNIQUE (season_id, review_type, version)`.
7. **Deterministic validation**: Verifies time range (`period_end >= period_start`).
8. **Locks / CAS / Concurrency**: `SELECT COALESCE(MAX(version), 0) FROM season_reviews WHERE season_id = p_season_id AND review_type = p_review_type FOR UPDATE;`. Increments version by 1.
9. **Atomic side effects**:
   - Inserts row into `season_reviews` with `version = max_version + 1`.
   - If prior version existed, updates prior row `superseded_by_id = new_row.id`.
   - Writes audit event. Zero mutations to XP or skills.
10. **Audit write**: `outer_loop_audit_events` (`REVIEW_FINALIZED`).
11. **Error Taxonomy**:
    - 400 `INVALID_PERIOD_RANGE`
    - 404 `SEASON_NOT_FOUND`
    - 422 `SCHEMA_VALIDATION_FAILED`
12. **Replay behavior**: Idempotent on `request_idempotency_key`; returns existing review.
13. **Cross-tenant behavior**: Fails closed with 404.

#### 4. `rpc_link_season_quest` / `rpc_unlink_season_quest`
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
7. **Deterministic validation**: If `role = 'MAIN'`, asserts no other quest in the season currently holds `MAIN`.
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

#### 5. `rpc_insert_strategy_support`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts strategy and referenced source belong to `auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_strategy_id": "uuid",
     "p_observation_type": "text ('SUPPORT' | 'COUNTER_EVIDENCE')",
     "p_source_class": "text",
     "p_source_id": "uuid",
     "p_evaluator_version": "text",
     "p_note": "text NULL",
     "p_observed_at": "timestamptz"
   }
   ```
4. **Current-state precondition**: Strategy exists and `lifecycle_status IN ('TESTING', 'SUPPORTED', 'CONTEXTUAL', 'WEAKENED')`.
5. **Allowed transition**: Appends empirical observation to `strategy_supports`.
6. **Idempotency identity**: Composite source identity constraint: `UNIQUE (strategy_id, source_class, source_id, observation_type, evaluator_version)`.
7. **Deterministic validation**: Source class must be whitelisted (`SEASON_REVIEW`, `ACTIVITY`, `QUEST_OUTCOME`, `ARTIFACT`, `CORE_EVIDENCE_REFERENCE`, `JOURNAL_CONTEXT`, `MANUAL_OBSERVATION`).
8. **Locks / CAS / Concurrency**: Target strategy row locked `FOR UPDATE`.
9. **Atomic side effects**:
   - Inserts row into `strategy_supports`.
   - Triggers re-evaluation of confidence level via `rpc_evaluate_strategy_status`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`STRATEGY_SUPPORT_LOGGED`).
11. **Error Taxonomy**:
    - 404 `STRATEGY_NOT_FOUND`
    - 409 `DUPLICATE_OBSERVATION` (handled idempotently)
    - 422 `INVALID_SOURCE_CLASS`
12. **Replay behavior**: Replaying with identical source identity returns existing record without duplicate insertion.
13. **Cross-tenant behavior**: Foreign source reference fails closed with 403.

#### 6. `rpc_evaluate_strategy_status`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `strategy.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_strategy_id": "uuid"
   }
   ```
4. **Current-state precondition**: Strategy exists and user has explicitly accepted hypothesis.
5. **Allowed transition**: Status evaluated across the 6-status machine: `TESTING -> SUPPORTED | CONTEXTUAL | WEAKENED`.
6. **Idempotency identity**: Deterministic execution over logged supports.
7. **Deterministic validation**:
   - Requires $\ge 2$ distinct observation dates.
   - Requires $\ge 1$ completed Season.
   - Requires $\ge 2$ linked Core achievements (activities, quests, artifacts).
   - Computes net ratio $\frac{\text{Supports}}{\text{Supports} + \text{Counters}}$. If $\ge 75\%$, promotes to `SUPPORTED` with `HIGH` confidence. If ratio drops $< 60\%$, demotes to `WEAKENED`.
8. **Locks / CAS / Concurrency**: Row lock on `strategies` row.
9. **Atomic side effects**: Updates `strategies.lifecycle_status` and `strategies.confidence_level`.
10. **Audit write**: `outer_loop_audit_events` (`STRATEGY_EVALUATED`).
11. **Error Taxonomy**:
    - 404 `STRATEGY_NOT_FOUND`
    - 422 `UNMET_SUPPORT_REQUIREMENTS` (if attempting manual promotion without meeting thresholds)
12. **Replay behavior**: Pure deterministic calculation; identical input records produce identical state.
13. **Cross-tenant behavior**: Fails closed with 404.

---

### 3.3 Reward Economy RPCs

#### 7. `rpc_grant_reward_credit`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts caller owns target `reward_accounts` and verified source record.
3. **Input Schema**:
   ```json
   {
     "p_source_type": "text ('SEASON' | 'QUEST' | 'MASTERY' | 'ARTIFACT' | 'REAL_WORLD_VERIFIED')",
     "p_source_id": "uuid",
     "p_policy_version": "text",
     "p_request_idempotency_key": "text"
   }
   ```
   *(Note: Client DOES NOT pass `p_amount`. Credit amount is strictly derived on server).*
4. **Current-state precondition**: Source record must exist in database, belong to caller, and satisfy policy criteria:
   - Quest: `status = 'completed' AND (quest_size IN ('major', 'epic', 'main') OR is_boss = true)`.
   - Season: `status = 'COMPLETED'` with confirmed final review.
   - Mastery: Verified `evidence` backing M6, M8, or M10.
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
12. **Replay behavior**: If canonical source identity already exists, returns existing transaction record (HTTP 200). Changing `p_request_idempotency_key` cannot bypass canonical source uniqueness.
13. **Cross-tenant behavior**: Fails closed with 403 / 404.

#### 8. `rpc_correct_reward_transaction`
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
6. **Idempotency identity**: Partial unique index on `(correction_for_id)` ensures exactly ONE correction per original transaction.
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
12. **Replay behavior**: Returns existing correction record idempotently.
13. **Cross-tenant behavior**: Fails closed with 404.

#### 9. `rpc_reserve_wish_credits`
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

#### 10. `rpc_unreserve_wish_credits`
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
12. **Replay behavior**: Idempotent; returns existing wish state.
13. **Cross-tenant behavior**: Fails closed with 404.

#### 11. `rpc_redeem_wish`
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
5. **Allowed transition**: Wish: `RESERVED -> REDEEMED`.
6. **Idempotency identity**: Unique constraint on `reward_redemptions.transaction_id`.
7. **Deterministic validation**: Asserts wish is currently `RESERVED`.
8. **Locks / CAS / Concurrency**: Locks `reward_accounts` and `wishes` rows `FOR UPDATE`.
9. **Atomic side effects**:
   - Appends `REDEEM` transaction (`amount = wish.credit_cost`).
   - Re-folds ledger: decrements `current_reserved`, increments `lifetime_redeemed`.
   - Updates `wishes.status = 'REDEEMED'`. Sets `wishes.cooldown_until = clock_timestamp() + interval '7 days'`.
   - Inserts permanent receipt into `reward_redemptions`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`WISH_REDEEMED`).
11. **Error Taxonomy**:
    - 404 `WISH_NOT_FOUND`
    - 409 `WISH_NOT_RESERVED`
    - 409 `WISH_ALREADY_REDEEMED`
12. **Replay behavior**: Replaying returns the existing redemption receipt without double-redeeming.
13. **Cross-tenant behavior**: Fails closed with 404.

#### 12. `rpc_refund_wish_redemption`
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
5. **Allowed transition**: Compensating refund restoring spent credits.
6. **Idempotency identity**: Unique check asserting one `REFUND` per redemption ID.
7. **Deterministic validation**: Asserts reason is provided.
8. **Locks / CAS / Concurrency**: Locks `reward_accounts` row `FOR UPDATE`.
9. **Atomic side effects**:
   - Appends `REFUND` transaction (`amount = redemption.credits_spent`).
   - Re-folds ledger: decrements `lifetime_redeemed`, increments `current_available`.
   - Updates wish status to `ACTIVE`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`WISH_REDEMPTION_REFUNDED`).
11. **Error Taxonomy**:
    - 404 `REDEMPTION_NOT_FOUND`
    - 409 `ALREADY_REFUNDED`
12. **Replay behavior**: Idempotent; returns existing refund transaction.
13. **Cross-tenant behavior**: Fails closed with 404.

---

### 3.4 Milestone Subsystem RPCs

#### 13. `rpc_confirm_milestone`
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
     "p_source_id": "uuid NULL",
     "p_evidence_url": "text NULL",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Milestone key does not already exist for user.
5. **Allowed transition**: Inserts recognition record in `milestones`.
6. **Idempotency identity**: `UNIQUE (user_id, milestone_key)`.
7. **Deterministic validation**:
   - If `CORE_VERIFIED`: Asserts source record exists in Core and satisfies criteria.
   - If `USER_CONFIRMED_REAL_WORLD`: Records self-attestation. Notes that self-attestation alone DOES NOT grant reward credits.
8. **Locks / CAS / Concurrency**: Database unique index constraint check.
9. **Atomic side effects**: Inserts row into `milestones`. Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`MILESTONE_CONFIRMED`).
11. **Error Taxonomy**:
    - 409 `MILESTONE_ALREADY_EXISTS`
    - 422 `INVALID_RECOGNITION_CLASS`
12. **Replay behavior**: Returns existing milestone record idempotently.
13. **Cross-tenant behavior**: Foreign source check fails closed with 403.

#### 14. `rpc_settle_milestone_reward`
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
4. **Current-state precondition**: Milestone exists, `status = 'ACTIVE'`, and `granted_reward_credit = false`. If `USER_CONFIRMED_REAL_WORLD`, must possess verified independent external evidence.
5. **Allowed transition**: Mints credits and links milestone to reward transaction.
6. **Idempotency identity**: Canonical Core source identity:
   `UNIQUE (user_id, underlying_canonical_source_type, underlying_canonical_source_id, policy_version, 'EARN')`.
7. **Deterministic validation**: Anchors to underlying Core source (`canonical_source_type = 'QUEST'`, etc.). If that Core event already minted credits, rejects minting to prevent wrapper double-minting.
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

---

### 3.5 AI Proposal Review RPC

#### 15. `rpc_review_outer_loop_proposal`
1. **Authentication**: Required (`auth.uid()`).
2. **Ownership checks**: Asserts `proposal.user_id = auth.uid()`.
3. **Input Schema**:
   ```json
   {
     "p_proposal_id": "uuid",
     "p_decision": "text ('ACCEPTED' | 'EDITED' | 'REJECTED')",
     "p_edited_payload": "jsonb NULL",
     "p_request_idempotency_key": "text"
   }
   ```
4. **Current-state precondition**: Proposal exists with `status = 'PROPOSED'` and `expires_at > clock_timestamp()`.
5. **Allowed transition**: `PROPOSED -> ACCEPTED | EDITED | REJECTED`.
6. **Idempotency identity**: Atomic CAS on `status = 'PROPOSED'`.
7. **Deterministic validation**: If accepted/edited, validates payload against target domain schema.
8. **Locks / CAS / Concurrency**:
   ```sql
   UPDATE outer_loop_proposals
   SET status = p_decision, reviewed_at = clock_timestamp()
   WHERE id = p_proposal_id AND status = 'PROPOSED'
   RETURNING *;
   ```
   If zero rows updated, aborts with HTTP 409 `PROPOSAL_ALREADY_REVIEWED`.
9. **Atomic side effects**:
   - If `ACCEPTED` or `EDITED`: Inserts corresponding domain record (`seasons`, `strategies`, etc.) within same transaction.
   - Updates proposal: `resulting_entity_type`, `resulting_entity_id`.
   - Writes audit event.
10. **Audit write**: `outer_loop_audit_events` (`PROPOSAL_REVIEWED`).
11. **Error Taxonomy**:
    - 404 `PROPOSAL_NOT_FOUND`
    - 409 `PROPOSAL_ALREADY_REVIEWED` (race condition blocked)
    - 422 `PROPOSAL_EXPIRED`
    - 422 `PAYLOAD_VALIDATION_FAILED`
12. **Replay behavior**: Returns committed domain entity if already reviewed under matching decision.
13. **Cross-tenant behavior**: Fails closed with 404.
