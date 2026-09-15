# Phase 8 — API and RPC Contract Architecture Plan

## 1. Governance & Implementation Boundary

This document defines the **formal interface contracts and transaction semantics** for all Outer Growth Loop write operations. In accordance with Phase 8A rules, **no application route handlers or database procedures are implemented at this stage**.

### Foundational Security & Atomicity Principles
1. **Server-Enforced Ownership**: Every RPC extracts the user identity directly from `auth.uid()`. No client-supplied `user_id` is trusted.
2. **Atomic Settlement**: High-risk operations (e.g., Reward settlement, Season activation, Wish redemption) execute inside PostgreSQL transactions with row-level locks (`SELECT ... FOR UPDATE`).
3. **Fail-Closed Validation**: If state preconditions, cross-tenant references, or idempotency keys fail, the transaction rolls back cleanly, returning structured error codes.

---

## 2. Standardized RPC Execution Pattern

All Outer Loop write procedures adhere to the uniform 12-point pipeline:

```text
[1. Authenticate] ──► [2. Ownership Assert] ──► [3. Schema Validate] ──► [4. Check Precondition]
        │
        ▼
[5. Validate Transition] ──► [6. Idempotency Check] ──► [7. Acquire Locks] ──► [8. Mutate Domain]
        │
        ▼
[9. Record Ledger/Link] ──► [10. Log Audit Event] ──► [11. Return Entity] ──► [12. On Error: Rollback]
```

---

## 3. High-Risk Transactional RPC Contracts

---

### 3.1 Season Lifecycle RPCs

#### `rpc_activate_season`
- **Purpose**: Transitions a `PLANNED` or `DRAFT` season to `ACTIVE`, enforcing the single active season invariant (O13).
- **Authentication**: Required (`auth.uid()`).
- **Input Parameters**:
  ```json
  {
    "p_season_id": "uuid",
    "p_started_at": "timestamptz (optional, default now())"
  }
  ```
- **Preconditions**:
  - Season exists and `user_id = auth.uid()`.
  - Season `status IN ('DRAFT', 'PLANNED')`.
  - User has **zero** seasons with `status = 'ACTIVE'`.
- **Allowed Transitions**: `DRAFT -> ACTIVE`, `PLANNED -> ACTIVE`.
- **Atomic Side Effects**:
  - Updates target season `status = 'ACTIVE'`, `started_at = p_started_at`.
  - Writes `SEASON_ACTIVATED` event to `outer_loop_audit_events`.
- **Error Taxonomy**:
  - `401 Unauthorized`: Not authenticated.
  - `404 Not Found`: Season does not exist or wrong tenant.
  - `409 Conflict`: Another season is currently `ACTIVE` (`ACTIVE_SEASON_EXISTS`).
  - `422 Unprocessable`: Invalid duration or missing success criteria.
- **Cross-Tenant Guard**: Fails closed if `p_season_id` belongs to another user.

#### `rpc_conclude_season`
- **Purpose**: Atomically closes an active season with a finalized review and optional milestone evaluation.
- **Input Parameters**:
  ```json
  {
    "p_season_id": "uuid",
    "p_target_status": "text ('COMPLETED' | 'ENDED_EARLY' | 'ABANDONED')",
    "p_review_summary": "jsonb",
    "p_criteria_evaluation": "jsonb"
  }
  ```
- **Preconditions**: Target season is currently `ACTIVE` and owned by caller.
- **Atomic Side Effects**:
  - Transitions season status to target terminal status.
  - Inserts finalized `season_reviews` record (`review_type = 'FINAL'`).
  - If `COMPLETED` and success criteria satisfied, evaluates eligibility for milestone/reward credit grant.
  - Writes `SEASON_CONCLUDED` audit event.

---

### 3.2 Strategy & Playbook RPCs

#### `rpc_evaluate_strategy_status`
- **Purpose**: Deterministically computes strategy support metrics and promotes to `SUPPORTED` or downgrades to `WEAKENED` (O6, O8, O17).
- **Input Parameters**:
  ```json
  {
    "p_strategy_id": "uuid"
  }
  ```
- **Preconditions**: Strategy exists and belongs to caller.
- **Deterministic Validation Rules**:
  - Queries `strategy_supports` grouped by date and observation type.
  - Requires:
    1. $\ge 2$ distinct observation dates.
    2. $\ge 1$ linked completed Season.
    3. $\ge 2$ linked Growth Core achievements (Quests/Activities/Artifacts).
    4. Support ratio $\ge 75\%$ for `HIGH` confidence / `SUPPORTED`.
- **Atomic Side Effects**:
  - Updates `strategies.lifecycle_status` and `strategies.confidence_level`.
  - Writes audit event if status changed.

---

### 3.3 Reward Economy RPCs

#### `rpc_grant_reward_credit`
- **Purpose**: Mints reward credits from verified sparse milestone sources with strict idempotency (O3, O10).
- **Input Parameters**:
  ```json
  {
    "p_amount": "integer (> 0)",
    "p_source_type": "text ('SEASON' | 'QUEST' | 'MASTERY' | 'ARTIFACT' | 'MILESTONE')",
    "p_source_id": "uuid",
    "p_policy_version": "text",
    "p_idempotency_key": "text",
    "p_note": "text"
  }
  ```
- **Preconditions**:
  - Caller owns `reward_accounts` record.
  - `p_source_type` is an authorized sparse source (micro-tasks and streaks rejected).
  - Source record exists, belongs to user, and is verified in database.
- **Idempotency & Replay Handling**:
  - Checks if `p_idempotency_key` already exists in `reward_transactions`.
  - If exists: returns existing transaction record immediately (HTTP 200 idempotent replay).
- **Atomic Side Effects**:
  - Locks `reward_accounts` row (`FOR UPDATE`).
  - Appends row to `reward_transactions` with `event_kind = 'EARN'`.
  - Increments `reward_accounts.lifetime_earned` and `reward_accounts.current_available`.
  - Writes audit event.

#### `rpc_reserve_wish_credits`
- **Purpose**: Locks available credits against a `PRIMARY` Wish before physical redemption.
- **Input Parameters**:
  ```json
  {
    "p_wish_id": "uuid",
    "p_idempotency_key": "text"
  }
  ```
- **Preconditions**:
  - Wish status is `PRIMARY` and owned by caller.
  - `reward_accounts.current_available >= wish.credit_cost`.
- **Atomic Side Effects**:
  - Locks `reward_accounts` row (`FOR UPDATE`).
  - Appends `RESERVE` event to `reward_transactions`.
  - Decrements `current_available`, increments `current_reserved`.
  - Updates `wishes.status = 'RESERVED'`.

#### `rpc_redeem_wish`
- **Purpose**: Atomically settles a reserved wish upon real-world celebration (O19).
- **Input Parameters**:
  ```json
  {
    "p_wish_id": "uuid",
    "p_celebration_note": "text",
    "p_idempotency_key": "text"
  }
  ```
- **Preconditions**:
  - Wish status is `RESERVED` and owned by caller.
- **Atomic Side Effects**:
  - Locks `reward_accounts` and `wishes` rows.
  - Appends `REDEEM` event to `reward_transactions`.
  - Decrements `current_reserved`, increments `lifetime_redeemed`.
  - Updates `wishes.status = 'REDEEMED'`.
  - Inserts receipt into `reward_redemptions`.

#### `rpc_correct_reward_transaction`
- **Purpose**: Appends an auditable correction transaction when an underlying milestone is revoked (O5, O20).
- **Input Parameters**:
  ```json
  {
    "p_target_transaction_id": "uuid",
    "p_reason": "text",
    "p_idempotency_key": "text"
  }
  ```
- **Atomic Side Effects**:
  - Appends `CORRECTION` transaction with negative amount matching the original grant.
  - Recalculates available balance. If available drops below zero, calculates and sets `correction_deficit`, clamping `current_available = 0`.
  - Writes high-priority audit event.

---

### 3.4 AI GM Proposal Review RPC

#### `rpc_review_outer_loop_proposal`
- **Purpose**: Executes the user's decision (Accept, Edit, Reject) on an AI proposal and atomically commits the resulting domain entity (O8, O21).
- **Input Parameters**:
  ```json
  {
    "p_proposal_id": "uuid",
    "p_decision": "text ('ACCEPTED' | 'EDITED' | 'REJECTED')",
    "p_edited_payload": "jsonb (optional)"
  }
  ```
- **Preconditions**:
  - Proposal belongs to user and `status = 'PROPOSED'`.
  - `expires_at > clock_timestamp()`.
- **Atomic Side Effects**:
  - If `REJECTED`: updates `status = 'REJECTED'`, `reviewed_at = now()`.
  - If `ACCEPTED` or `EDITED`:
    - Validates payload against deterministic target schema.
    - Inserts corresponding domain record (`seasons`, `strategies`, etc.).
    - Updates `outer_loop_proposals` with `resulting_entity_type` and `resulting_entity_id`.
    - Logs audit record.

---

## 4. Standard Error Taxonomy

Every RPC returns machine-readable JSON errors adhering to the standard format:

```json
{
  "error": {
    "code": "ACTIVE_SEASON_EXISTS",
    "message": "User already has an active season. Close it before activating another.",
    "details": { "active_season_id": "uuid" }
  }
}
```

| Error Code | HTTP Status | Meaning |
| :--- | :---: | :--- |
| `UNAUTHORIZED` | 401 | Missing or invalid auth session |
| `FORBIDDEN_TENANT_MISMATCH` | 403 | Attempt to reference an entity owned by another user |
| `ENTITY_NOT_FOUND` | 404 | Target entity does not exist |
| `INVALID_STATE_TRANSITION` | 409 | Requested transition not permitted by lifecycle machine |
| `ACTIVE_SEASON_EXISTS` | 409 | Violation of single active season constraint (O13) |
| `PRIMARY_WISH_EXISTS` | 409 | Violation of single primary wish constraint |
| `INSUFFICIENT_CREDITS` | 422 | Attempting to reserve wish with inadequate available balance |
| `UNMET_SUPPORT_REQUIREMENTS`| 422 | Strategy lacks cross-time observations for promotion (O6) |
| `PROPOSAL_EXPIRED` | 422 | AI proposal has expired |
