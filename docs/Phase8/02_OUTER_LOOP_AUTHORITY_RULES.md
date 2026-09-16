# Phase 8 — Outer Loop Authority Rules & System Invariants

## 1. Purpose & Authority Context

This document codifies the non-negotiable architectural boundaries, governance rules, and system invariants governing the Outer Growth Loop of the AI Personal Growth RPG.

The Inner Growth Loop (Phases 1–7) established deterministic Growth Truth:
- Every XP mutation is traceable through an append-only ledger (`xp_transactions`), preserving deterministic correction semantics.
- Every Skill and Mastery assessment requires deterministic verification backed by verified Evidence according to the authoritative M0–M10 model.
- Artifacts, Knowledge, Quests, and Activities form an immutable historical record of genuine personal development.

The Outer Growth Loop (Phase 8) introduces macro-cycle governance: Seasons, Structured Reviews, Subjective Journaling, Personal Playbooks (Strategies), a physically isolated Reward Economy (Wishes), and Milestones.

To preserve the foundational premise that **"Time is not XP, XP is not Mastery, and high Mastery requires Evidence,"** the Outer Growth Loop must never corrupt, dilute, or retroactively rewrite Growth Core truth.

---

## 2. The Multi-Tier Authority Matrix

Authority in the Outer Growth Loop is strictly compartmentalized across four tiers. No tier may usurp the authority of another.

| Authority Tier | Permitted Actions | Strictly Prohibited Actions | Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| **Tier 0: Growth Core Truth (Frozen)** | Read-only reference by Outer Loop for reviews, milestone eligibility, strategy evidence linking, and reward verification. | Any modification, re-calculation, or retroactive mutation originating from Outer Loop cycles. | Zero foreign key write-cascades; immutable append-only schemas; no update triggers on Core tables. |
| **Tier 1: User Intent (Sovereignty)** | Explicit confirmation, editing, or rejection of AI proposals; personal journal authoring; manual strategy hypothesis formulation; wish creation and redemption initiation; season declaration and closure. | Bypassing deterministic system validation; forging cross-tenant references; directly modifying ledger balances or historical records. | Authenticated sessions (`auth.uid()`); RLS tenant isolation; strict UI confirmation gates; server-side RPC validation. |
| **Tier 2: Deterministic Engine (Law)** | State machine validation; idempotent ledger transaction settlement; confidence level derivation; eligibility verification; atomic commits; audit event recording. | Heuristic or probabilistic decisions; arbitrary credit issuance without verified source keys; silent failure or optimistic state coercion. | PostgreSQL transactional RPCs; check constraints; partial unique indexes; deterministic TypeScript test harnesses. |
| **Tier 3: AI Game Master (Advisory)** | Structured synthesis; pattern recognition; strategy hypothesis proposals; review draft generation; counter-evidence alerts; milestone candidacy detection. | Direct database writes; automatic promotion of strategies to `SUPPORTED`; direct issuance of rewards; autonomous state transitions. | Unified `OuterLoopProposal` envelope; client preview requirement; zero database service-role credentials exposed to AI. |

---

## 3. The 12 Non-Negotiable Outer Loop Invariants (O1–O12)

### O1 — Outer Loop Cannot Mutate Historical Growth Truth
- **Definition**: Season, Review, Journal, Strategy, Reward, Wish, Milestone, Focus, Protocol, or Past Self must never alter or rewrite historical XP, Mastery, Evidence, Activity facts, Knowledge provenance, Artifact provenance, or Quest completion status.
- **Architectural Guard**: Outer Loop entities maintain one-directional read references to Growth Core tables. No trigger, cascade, or stored procedure from an Outer Loop table may perform `UPDATE` or `DELETE` on Growth Core tables.
- **Failure Mode**: Any operation attempting to modify a Growth Core record during an Outer Loop lifecycle event fails closed with a severe invariant violation error.

### O2 — XP is Permanently Non-Spendable
- **Definition**: XP is a permanent measure of validated capability development. It is governed strictly by the append-only XP ledger (preserving existing deterministic `CORRECTION` transaction semantics for audit corrections). It is never a currency, never a spendable balance, and never a reward credit.
  ```text
  XP != Currency
  XP != Reward Credit
  XP != Balance
  ```
- **Architectural Guard**: There is no spending interface, debit transaction type, or deduction RPC on the `xp_transactions` ledger. Claiming a reality reward, reserving a wish, or completing a season leaves historical XP completely untouched.
- **Failure Mode**: Any design proposing an "XP shop", "XP cost for rewards", or "XP burn" is rejected at the architecture gate.

### O3 — Reward Economy is a Physically Separate Authority Domain
- **Definition**: Reward credits exist in a physically distinct database table (`reward_transactions`) with an independent settlement authority and dedicated idempotency mechanisms.
- **Architectural Guard**: No reward balance is ever computed from `xp_transactions`. No XP ledger row may double as a reward credit grant. Reward ledger tables are isolated in schema, business logic, and API routes.
- **Failure Mode**: Merging reward credit and XP into a shared balance or ledger is a P0 architecture blocker.

### O4 — Reward is Subordinate to Growth, Not the Core Engagement Engine
- **Definition**: The reward system exists solely to celebrate authentic personal breakthroughs in reality. It must never incorporate predatory engagement mechanics.
- **Architectural Guard**: The system strictly forbids:
  - Loot boxes, gacha mechanisms, or probabilistic drops.
  - Forced daily streaks, streak freezes, or loss-aversion traps.
  - Punitive mechanics, shaming, or negative progress bars.
  - Public XP leaderboards or competitive ranking.
  - Credit trading, transfers between users, or cash-out paths.
- **Failure Mode**: Any feature incentivizing repetitive app opens or platform habituation over real-world skill development is disqualified.

### O5 — Season is Not Streak
- **Definition**: A Season is a structured growth chapter (14–84 days, recommended 28 days) with a defined baseline, learning hypotheses, target outcomes, and formal review.
- **Architectural Guard**: Consecutive-day app check-ins or activity completions do not constitute Season progress or success. Season completion requires a structured, user-confirmed Review evaluating actual real-world outcomes against initial criteria.
- **Failure Mode**: A season cannot be marked `COMPLETED` automatically by a cron job or calendar expiration without human-in-the-loop review.

### O6 — Strategy Requires Cross-Time Support
- **Definition**: A Personal Playbook Strategy cannot be promoted to `SUPPORTED` based on a single successful day, a single activity, a single journal entry, or AI speculation.
- **Architectural Guard**: Promotion to `SUPPORTED` requires:
  1. Explicit user acceptance of the strategy hypothesis.
  2. At least two temporally distinct support observations across different days/weeks.
  3. Context from at least one completed Season.
  4. At least two verified Growth Core outcomes (Activities, Quest completions, or Artifacts).
  5. Deterministic evaluation of counter-evidence (failures or regressions in the same context).
  6. Prohibition of direct AI promotion.
- **Failure Mode**: Any automated transition of a strategy from `HYPOTHESIS` or `TESTING` directly to `SUPPORTED` without meeting the multi-observation threshold fails closed.

### O7 — Journal is Subjective Context by Default
- **Definition**: Journal entries capture emotional, psychological, and subjective reflections ("How did I experience this?"), not objective growth facts ("What demonstrably occurred?").
- **Architectural Guard**: Journal entries are not Verified Evidence. They do not directly increase Skill mastery, satisfy evidence requirements, or alter character stats.
- **Initial Phase 8 Boundary**: Automatic or implicit conversion of Journal entries into Verified Evidence is strictly out of scope and forbidden. Any future bridge requires a formal RFC with human-in-the-loop verification gates.

### O8 — AI Remains Proposal Authority Only
- **Definition**: AI Game Master analysis, pattern detection, strategy hypotheses, and review drafts are non-authoritative proposals.
- **Architectural Guard**: All AI mutations flow through the unified `OuterLoopProposal` schema:
  $$\text{AI Proposal} \longrightarrow \text{Preview} \longrightarrow \text{User Confirm / Edit / Reject} \longrightarrow \text{Deterministic Validation} \longrightarrow \text{Atomic Commit} \longrightarrow \text{Audit}$$
  Direct database writes from AI background jobs or LLM completion handlers into production domain tables are impossible by architecture.

### O9 — Permanent Mutations are Auditable
- **Definition**: Every permanent lifecycle change, state transition, and ledger entry in the Outer Growth Loop must be fully auditable and tamper-evident.
- **Architectural Guard**: State transitions and ledger events require:
  - `user_id` tenant binding.
  - Cryptographically secure idempotency keys.
  - Source entity provenance (`source_type`, `source_id`).
  - Evaluator/policy schema versions.
  - Audit trail logging in `outer_loop_audit_events`.
- **Failure Mode**: Any mutation lacking origin provenance or idempotency keys is rejected by RPC validation.

### O10 — Repetition Cannot Create a Farmable Reward Loop
- **Definition**: Users cannot generate reward credits through repetitive micro-activities, task spamming, rapid journaling, or artificial activity creation.
- **Architectural Guard**: Reward credits may only be minted from sparse, high-value, independently verifiable milestone events:
  1. Successful Season completion with confirmed final review.
  2. Verified completion of eligible quests (`quest.status = 'completed' AND (quest.quest_size IN ('major', 'epic', 'main') OR quest.is_boss = true)`).
  3. Mastery threshold milestones verified by Growth Core evidence (authoritative Mastery levels M0–M10).
  4. Durable, high-order Artifact creation or independently confirmed real-world milestones.
- **Idempotency Guard**: Every credit grant requires a unique composite canonical source identity `(user_id, canonical_source_type, canonical_source_id, policy_version, event_kind)`. Replays fail closed or return the existing transaction.

### O11 — Temporary State Cannot Become Permanent Capability
- **Definition**: Subjective context variables (Energy, Focus, Stress, Resistance, Recovery, Mood Valence, Self-Reported Confidence) fluctuate dynamically and reflect momentary state, not permanent personal capability.
- **Architectural Guard**: Subjective state scalars (1..5, mood -2..2) are stored purely as context metadata on `JournalEntry`. They have zero mathematical or programmatic coupling to Skill levels, Mastery tiers, or XP calculations.
- **Failure Mode**: Systems that deduct or award skill points based on bad mood or low energy are fundamentally prohibited.

### O12 — Existing Frozen Entities are Reused Before Parallel Concepts are Created
- **Definition**: The Outer Growth Loop builds upon the solid foundation of the Core Growth Engine rather than duplicating existing primitives under new names.
- **Architectural Guard**:
  - No new `Goal` table: Quests already own the hierarchical goal structure (main, epic, major, standard, minor, micro).
  - No new `PastSelf` table: Historical comparison is a derived read-only view over immutable ledgers.
  - No new `Streak` table: Daily counts contradict qualitative season arcs.
  - No new `XPWallet`: Reward credits are managed in `reward_accounts`.
- **Relationship Model**: Seasons act as a temporal and contextual framing layer *over* Quests ($N:N$), not as a competing hierarchy.

---

## 4. Deletion, Archival, and Deficit Handling Rules

### 4.1 Immutability and Archival Hierarchy
1. **Ledgers are Permanent**: `reward_transactions` is strictly an append-only event ledger. Rows are never updated or deleted. Corrections are made via offsetting `CORRECTION` transactions.
2. **Terminal Lifecycle States are Preserved**: Once a Season becomes `ACTIVE`, or a Wish is `REDEEMED`, or a Review is `FINALIZED`, the record can never be hard-deleted via normal application APIs.
3. **Draft Pruning**: Only `DRAFT` or `PLANNED` Seasons that were never activated and have zero linked historical records may be discarded.
4. **Strategies and Protocols**: Retired or ineffective strategies transition to `RETIRED` with failure notes; their historical validation data remains intact.

### 4.2 Accounting Deficit Handling
If a historical review or milestone verification is reversed or found to be invalid, a compensating `CORRECTION` is appended to the reward ledger.
- If the correction results in net earned credits falling below already redeemed credits, the account balance enters an auditable **Correction Deficit**.
- The system **does not** retroactively revoke real-world redeemed wishes or rewrite history.
- Spendable balance is clamped at `0` until future legitimate milestone earns offset the deficit.
- This is strict append-only event ledger accounting discipline, not a punitive game mechanic.

---

## 5. Security, Ownership, and Cross-Tenant Boundaries

1. **Strict Tenant Ownership**: Every Outer Loop table must include a non-nullable `user_id` column linked to `auth.users(id)`.
2. **Fail-Closed RLS**: Row Level Security is enabled on all tables with explicit `auth.uid() = user_id` policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
3. **Cross-Entity Reference Validation**: When creating links (e.g., `SeasonQuestLink`, `StrategySupport`), the database or atomic RPC must assert that both the source entity and the referenced target entity belong to the calling `user_id`. Any cross-tenant link attempt results in immediate rejection and audit logging.
4. **Service-Role Isolation**: AI providers, background workers, and client browsers never receive Supabase service-role credentials. All mutations execute through bounded RPCs under the authenticated user's security context.

---

## 6. Database-Enforceable Direct vs. RPC Authority Guards (P1-03)

RLS provides row-level isolation, but cannot by itself prevent callers from mutating sensitive lifecycle columns. To ensure that RPC-only authority rules cannot be bypassed via direct client Supabase calls, the database enforces column-level privilege boundaries and fail-closed validation triggers:

### 6.1 `outer_loop_proposals` (SELECT-Only for Clients)
- **Direct Write Prohibition**: Direct client `INSERT`, `UPDATE`, and `DELETE` are strictly denied via RLS (`WITH CHECK (false)`).
- **Sole Mutation Authority**: Proposals can only be generated by the server/AI pipeline and reviewed/resolved via security-definer `rpc_review_outer_loop_proposal`. Clients have read-only (`SELECT`) access.

### 6.2 `seasons` (Protected Status & Deletion)
- **Direct Mutation Restriction**: Direct client `UPDATE` is permitted ONLY for descriptive metadata (`name`, `description`, `theme_color`, `icon_key`).
- **Database Trigger Guard (`trg_enforce_season_field_authority`)**: Any direct client UPDATE attempting to change `status`, `activated_at`, or `concluded_at` raises an immediate PostgreSQL exception: `"Direct lifecycle status update prohibited; must call rpc_plan_season, rpc_activate_season, or rpc_conclude_season"`.
- **Hard-Delete Prevention (`trg_prevent_active_season_delete`)**: Any direct client DELETE on a Season that has ever reached `ACTIVE` raises an exception: `"Seasons that reached ACTIVE cannot be deleted"`.

### 6.3 `wishes` (Protected Status Transitions)
- **Direct Mutation Restriction**: Direct client `UPDATE` is permitted ONLY for editable fields (`title`, `description`, `cost_credits_estimate`) while status is `IDEA` or `ACTIVE`.
- **Database Trigger Guard (`trg_enforce_wish_field_authority`)**: Direct client updates attempting to transition to or from `PRIMARY`, `RESERVED`, or `REDEEMED` are rejected. All financial reservation and redemption transitions must be executed through `rpc_set_primary_wish`, `rpc_reserve_wish`, `rpc_unreserve_wish`, `rpc_redeem_wish`, or `rpc_refund_wish_redemption`.

### 6.4 `strategies` (Protected Confidence & Status)
- **Direct Mutation Restriction**: Direct client `UPDATE` cannot modify `lifecycle_status` or `confidence_level`.
- **Database Trigger Guard (`trg_enforce_strategy_field_authority`)**: Direct updates to `lifecycle_status` or `confidence_level` raise an exception. Status evaluations and transitions are strictly executed via `rpc_evaluate_strategy_status` and `rpc_transition_strategy_status`. Changes to strategy protocol text insert a new immutable version in `strategy_versions`.

### 6.5 Ledgers & Receipts (`reward_transactions`, `reward_redemptions`, `outer_loop_audit_events`)
- **Strict RPC-Only Writes**: Direct client `INSERT`, `UPDATE`, and `DELETE` are completely denied by RLS. Rows can only be created by security-definer RPCs with atomic invariant checking. Row updates and deletions are permanently prohibited.
