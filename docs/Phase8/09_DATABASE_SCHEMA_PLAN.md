# Phase 8 — Database Schema Architecture Plan

## 1. Governance Boundary & Migration Policy

**CRITICAL DIRECTIVE**: This document is a **structural schema design specification only**. Absolutely NO SQL migration files (`supabase/migrations/*.sql`) are authorized to be created in Phase 8A.

Database migrations will be authored incrementally within their respective implementation phases (Phase 8B through 8G) only after independent acceptance of each phase's controlling scope.

---

## 2. Table Inventory & Domain Boundary

### 2.1 Authorized Phase 8 Core Tables (14 Tables)
1. **Governance & Audit Layer (Phase 8B)**:
   - `outer_loop_proposals`
   - `outer_loop_audit_events`
2. **Season & Review Subsystem (Phase 8B)**:
   - `seasons`
   - `season_quests`
   - `season_reviews`
3. **Journal & State Subsystem (Phase 8C)**:
   - `journal_entries`
4. **Strategy & Personal Playbook Subsystem (Phase 8D)**:
   - `strategies`
   - `strategy_versions`
   - `strategy_supports`
5. **Reward Economy & Wishes Subsystem (Phase 8E)**:
   - `reward_accounts`
   - `reward_transactions`
   - `wishes`
   - `reward_redemptions`
6. **Milestone Subsystem (Phase 8F)**:
   - `milestones`

### 2.2 Optional Expansion Tables (Phase 8G Only)
- `focus_sessions`
- `growth_protocols`
- `protocol_versions`

### 2.3 Explicitly Rejected Tables (Prohibited)
- `goals`: Quest system already owns the full hierarchical goal tree.
- `past_self`: Must remain a derived read-only comparison view.
- `streaks`: Conflicts with non-punitive, qualitative season dynamics.
- `journal_evidence`: Direct journal-to-evidence conversion is prohibited (O7).
- `xp_wallet`: XP is permanently non-spendable; credits live in `reward_accounts`.
- `reward_marketplace`: No trading, gifting, or commercialization.

---

## 3. Comprehensive Per-Table Schema Specifications

Every table below is specified against the required 16-point architectural contract.

---

### 3.1 Governance & Audit Layer

#### 1. `outer_loop_proposals`
1. **Purpose / Authority Class**: Non-authoritative envelope storing AI GM recommendations awaiting interactive client preview and explicit user confirmation.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**:
   - `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
   - `reviewed_by_id REFERENCES auth.users(id) ON DELETE SET NULL`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: None.
6. **Partial Unique Constraints**: `CREATE UNIQUE INDEX uq_proposals_review_idempotency ON outer_loop_proposals (user_id, review_request_idempotency_key) WHERE review_request_idempotency_key IS NOT NULL;` (Durable client review idempotency identity).
7. **Lifecycle Fields**: `status text NOT NULL DEFAULT 'PROPOSED'` (`PROPOSED`, `ACCEPTED`, `EDITED`, `REJECTED`, `EXPIRED`), `decision text NULL` (`ACCEPTED`, `EDITED`, `REJECTED`).
8. **Immutable Fields**: `id`, `user_id`, `proposal_type`, `schema_version`, `source_refs`, `model_metadata`, `created_at`, `expires_at`. Post-review fields populated upon user review: `reviewed_by_id uuid NULL`, `reviewed_at timestamptz NULL`, `review_request_idempotency_key text NULL`, `rejection_reason text NULL`, `resulting_entity_type text NULL`, `resulting_entity_id uuid NULL`.
9. **Timestamps**: `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`, `reviewed_at timestamptz NULL`, `expires_at timestamptz NOT NULL`.
10. **Indexes**: `INDEX idx_outer_proposals_user_status ON outer_loop_proposals(user_id, status)`.
11. **FK Delete Behavior**: `user_id`: `ON DELETE CASCADE`.
12. **RLS Policy Intent**: `SELECT` allowed for `auth.uid() = user_id`. Direct client `INSERT`, `UPDATE`, and `DELETE` are strictly denied via `WITH CHECK (false)`.
13. **Correction / Versioning Model**: Unreviewed proposals expire via `expires_at`. Reviewed proposals transition to terminal status (`ACCEPTED`, `EDITED`, `REJECTED`).
14. **Write Authority**: Proposal generation via server AI gateway route; state transition strictly via `rpc_review_outer_loop_proposal`. Clients have zero direct write capability.
15. **Idempotency / Dedup Rule**: Atomic CAS: `UPDATE outer_loop_proposals SET status = p_decision, reviewed_at = clock_timestamp(), reviewed_by_id = auth.uid(), review_request_idempotency_key = p_request_idempotency_key WHERE id = p_proposal_id AND status = 'PROPOSED'`. If zero rows updated, exact same-key retry returns HTTP 200 with prior result; new key or concurrent loser returns HTTP 409 Conflict (`PROPOSAL_ALREADY_REVIEWED`).
16. **Migration Phase / Order**: Phase 8B (Order 1).

#### 2. `outer_loop_audit_events`
1. **Purpose / Authority Class**: Append-only security and operational audit trail recording state transitions, RPC settlements, and revocations.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**: `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: `UNIQUE (user_id, request_idempotency_key)`.
6. **Partial Unique Constraints**: None.
7. **Lifecycle Fields**: None (immutable append-only events).
8. **Immutable Fields**: Entire row is immutable after insert. Requires `request_idempotency_key text NOT NULL`, `policy_version text NOT NULL`, `schema_version text NOT NULL`.
9. **Timestamps**: `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_outer_audit_user_created ON outer_loop_audit_events(user_id, created_at DESC)`.
11. **FK Delete Behavior**: `user_id`: `ON DELETE CASCADE`.
12. **RLS Policy Intent**: `SELECT` allowed for `auth.uid() = user_id`. `INSERT` strictly restricted to internal RPC functions (security definer). No client `UPDATE` or `DELETE`.
13. **Correction / Versioning Model**: Append-only. Erroneous events are corrected by appending subsequent corrective audit events.
14. **Write Authority**: RPC-only.
15. **Idempotency / Dedup Rule**: `request_idempotency_key text NOT NULL` guarantees request traceability and replay safety.
16. **Migration Phase / Order**: Phase 8B (Order 2).

---

### 3.2 Season & Review Subsystem (Phase 8B)

#### 3. `seasons`
1. **Purpose / Authority Class**: Authoritative macro-cycle container providing temporal context over Quests (14–84 days).
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**: `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: None.
6. **Partial Unique Constraints**: `CREATE UNIQUE INDEX uq_seasons_single_active ON seasons(user_id) WHERE status = 'ACTIVE';` (Enforces rule `SINGLE_ACTIVE_SEASON`).
7. **Lifecycle Fields**: `status text NOT NULL DEFAULT 'DRAFT'` (`DRAFT`, `PLANNED`, `ACTIVE`, `COMPLETED`, `ENDED_EARLY`, `ABANDONED`, `CANCELLED`).
8. **Immutable Fields**: `id`, `user_id`, `created_at`. Once `ACTIVE`, `started_at` is immutable. Once terminal, entire row is immutable.
9. **Timestamps**: `started_at timestamptz NULL`, `ended_at timestamptz NULL`, `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`, `updated_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_seasons_user_status ON seasons(user_id, status)`.
11. **FK Delete Behavior**: Dependent child tables (`season_quests`, `season_reviews`) specify fixed `ON DELETE RESTRICT`.
12. **RLS Policy Intent**: `SELECT` and `INSERT` allowed for `auth.uid() = user_id`. Direct client `UPDATE` permitted only for metadata (`name`, `description`, `theme_color`, `icon_key`). Trigger `trg_enforce_season_field_authority` rejects direct updates to `status`, `started_at`, `ended_at`, or `abandonment_reason`. Trigger `trg_prevent_active_season_delete` rejects direct `DELETE` if status has ever been `ACTIVE`.
13. **Correction / Versioning Model**: Terminal seasons (`COMPLETED`, `ENDED_EARLY`, `ABANDONED`) cannot be reopened; post-mortems and recalibrations are handled via versioned `season_reviews`.
14. **Write Authority**: Status transitions to `PLANNED`, `ACTIVE`, `COMPLETED`, `ENDED_EARLY`, `ABANDONED`, `CANCELLED` strictly via RPCs (`rpc_plan_season`, `rpc_activate_season`, `rpc_conclude_season`, `rpc_cancel_season`).
15. **Idempotency / Dedup Rule**: Activation guarded by partial unique index and CAS. Atomic conclusion in `rpc_conclude_season` locks parent season row (`FOR UPDATE`) and commits FINAL review in the same transaction.
16. **Migration Phase / Order**: Phase 8B (Order 3).

#### 4. `season_quests`
1. **Purpose / Authority Class**: $N:N$ link table mediating season focus over existing Quests. Strict RPC-managed join table.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**:
   - `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
   - `season_id REFERENCES seasons(id) ON DELETE RESTRICT`
   - `quest_id REFERENCES quests(id) ON DELETE RESTRICT`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: `UNIQUE (season_id, quest_id)`.
6. **Partial Unique Constraints**: `CREATE UNIQUE INDEX uq_season_quests_single_main ON season_quests(season_id) WHERE role = 'MAIN';` (Enforces 0..1 MAIN quest per season; MAIN quest is optional).
7. **Lifecycle Fields**: None. Links are active while present.
8. **Immutable Fields**: `id`, `user_id`, `season_id`, `quest_id`, `created_at`.
9. **Timestamps**: `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_season_quests_season ON season_quests(season_id)`, `INDEX idx_season_quests_quest ON season_quests(quest_id)`.
11. **FK Delete Behavior**: `season_id`: `ON DELETE RESTRICT`; `quest_id`: `ON DELETE RESTRICT`.
12. **RLS Policy Intent**: `SELECT` allowed for `auth.uid() = user_id`. Direct client `INSERT`, `UPDATE`, and `DELETE` are strictly **DENIED** via `WITH CHECK (false)` / `USING (false)`.
13. **Correction / Versioning Model**: Quests may be linked or unlinked (`rpc_link_season_quest`, `rpc_unlink_season_quest`) during `PLANNED` or `ACTIVE` states.
14. **Write Authority**: Strictly RPC-only (`rpc_link_season_quest`, `rpc_unlink_season_quest`). The RPC asserts `season.user_id = auth.uid()` AND `quest.user_id = auth.uid()`. Furthermore, database trigger `trg_enforce_season_quest_tenant_isolation` enforces fail-closed that `NEW.user_id` matches both referenced `season.user_id` and `quest.user_id` (P0-01).
15. **Idempotency / Dedup Rule**: Natural composite unique constraint `(season_id, quest_id)`.
16. **Migration Phase / Order**: Phase 8B (Order 4).

#### 5. `season_reviews`
1. **Purpose / Authority Class**: Authoritative, user-confirmed retrospective synthesis record. Immutable upon creation.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**:
   - `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
   - `season_id REFERENCES seasons(id) ON DELETE RESTRICT`
   - `superseded_by_id REFERENCES season_reviews(id) ON DELETE RESTRICT`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**:
   - `UNIQUE (user_id, commit_key)` (Durable client idempotency identity).
   - `UNIQUE (season_id, review_type, version)` (Sequential version constraint per review type).
6. **Partial Unique Constraints**: None.
7. **Lifecycle Fields**: `review_type text NOT NULL` (`WEEKLY`, `FINAL`, `AD_HOC`).
8. **Immutable Fields**: Entire review record is immutable once inserted. Amendments produce a new row with incremented `version` and new `commit_key`. Requires `commit_key uuid NOT NULL`.
9. **Timestamps**: `period_start timestamptz NOT NULL`, `period_end timestamptz NOT NULL`, `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_season_reviews_season ON season_reviews(season_id, review_type)`.
11. **FK Delete Behavior**: `season_id`: `ON DELETE RESTRICT`.
12. **RLS Policy Intent**: `SELECT` allowed for `auth.uid() = user_id`. Client `INSERT`, `UPDATE`, and `DELETE` denied.
13. **Correction / Versioning Model**: Versioned immutable records (`version`, `superseded_by_id`). Amendments to `FINAL` reviews on concluded seasons are supported via `rpc_amend_final_season_review` without reopening the season.
14. **Write Authority**: RPC-only (`rpc_finalize_season_review` for periodic reviews on ACTIVE seasons; atomic `rpc_conclude_season` for initial `FINAL` review; `rpc_amend_final_season_review` for superseding `FINAL` reviews on terminal seasons).
15. **Idempotency / Dedup Rule**: Idempotent replay via durable `commit_key uuid NOT NULL`. Serialized version increment via parent Season row lock (`SELECT * FROM seasons WHERE id = p_season_id FOR UPDATE`).
16. **Migration Phase / Order**: Phase 8B (Order 5).

---

### 3.3 Journal & State Subsystem (Phase 8C)

#### 6. `journal_entries`
1. **Purpose / Authority Class**: Authoritative storage of subjective reflections and 7-dimensional context state. Private by default.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**:
   - `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
   - `season_id REFERENCES seasons(id) ON DELETE SET NULL`
   - `quest_id REFERENCES quests(id) ON DELETE SET NULL`
   - `activity_id REFERENCES activities(id) ON DELETE SET NULL`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: None.
6. **Partial Unique Constraints**: None.
7. **Lifecycle Fields**: `is_archived boolean NOT NULL DEFAULT false`.
8. **Immutable Fields**: `id`, `user_id`, `created_at`.
9. **Timestamps**: `logged_at timestamptz NOT NULL DEFAULT clock_timestamp()`, `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`, `updated_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_journal_user_logged ON journal_entries(user_id, logged_at DESC)`, `INDEX idx_journal_season ON journal_entries(season_id)`.
11. **FK Delete Behavior**: Foreign entity links (`season_id`, `quest_id`, `activity_id`) specify `ON DELETE SET NULL`.
12. **RLS Policy Intent**: `SELECT`, `UPDATE`, `DELETE` allowed for `auth.uid() = user_id`. Client direct `INSERT` and `UPDATE` enforce cross-tenant reference protection via fail-closed RLS `WITH CHECK`:
    ```sql
    auth.uid() = user_id AND
    (season_id IS NULL OR season_id IN (SELECT id FROM seasons WHERE user_id = auth.uid())) AND
    (quest_id IS NULL OR quest_id IN (SELECT id FROM quests WHERE user_id = auth.uid())) AND
    (activity_id IS NULL OR activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()))
    ```
    Additionally, database trigger `trg_enforce_journal_entry_tenant_isolation` verifies before INSERT/UPDATE that any non-null `season_id`, `quest_id`, or `activity_id` belongs to `NEW.user_id`, raising an exception if cross-tenant reference is detected (P0-01).
13. **Correction / Versioning Model**: Direct user edits update `content_markdown` and `updated_at`. Archival via `is_archived = true`. Hard delete allowed only if unreferenced by finalized reviews.
14. **Write Authority**: Direct repository operations under tenant-validated RLS and trigger guards.
15. **Idempotency / Dedup Rule**: Client-generated UUID PK for optimistic local creation.
16. **Migration Phase / Order**: Phase 8C (Order 6).

---

### 3.4 Strategy & Personal Playbook Subsystem (Phase 8D)

#### 7. `strategies`
1. **Purpose / Authority Class**: Authoritative Personal Playbook heuristic record.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**: `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: None.
6. **Partial Unique Constraints**: None.
7. **Lifecycle Fields**: `lifecycle_status text NOT NULL DEFAULT 'HYPOTHESIS'` (`HYPOTHESIS`, `TESTING`, `SUPPORTED`, `CONTEXTUAL`, `WEAKENED`, `RETIRED`), `confidence_level text NOT NULL DEFAULT 'LOW'` (`LOW`, `MODERATE`, `HIGH`, `VERY_HIGH`).
8. **Immutable Fields**: `id`, `user_id`, `created_at`.
9. **Timestamps**: `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`, `updated_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_strategies_user_status ON strategies(user_id, lifecycle_status)`.
11. **FK Delete Behavior**: Child tables (`strategy_supports`, `strategy_versions`) specify `ON DELETE RESTRICT` or `ON DELETE CASCADE`.
12. **RLS Policy Intent**: `SELECT`, `INSERT` allowed for user. Direct client `UPDATE` is restricted to descriptive fields; trigger `trg_enforce_strategy_field_authority` rejects direct updates to `lifecycle_status` and `confidence_level`.
13. **Correction / Versioning Model**: Protocol revisions increment `version` and append to `strategy_versions`. Status changes require evaluation RPC and user confirmation. Ineffective strategies transition to `RETIRED`.
14. **Write Authority**: Hypothesis creation direct or via proposal review; status evaluation and transitions strictly via `rpc_evaluate_strategy_status` and `rpc_transition_strategy_status`.
15. **Idempotency / Dedup Rule**: RPC evaluation is deterministic over logged supports.
16. **Migration Phase / Order**: Phase 8D (Order 7).

#### 8. `strategy_versions`
1. **Purpose / Authority Class**: Immutable audit snapshot of material protocol revisions to a strategy.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**:
   - `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
   - `strategy_id REFERENCES strategies(id) ON DELETE CASCADE`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: `UNIQUE (strategy_id, version_number)`.
6. **Partial Unique Constraints**: None.
7. **Lifecycle Fields**: None.
8. **Immutable Fields**: Entire row is immutable.
9. **Timestamps**: `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_strategy_versions_strat ON strategy_versions(strategy_id)`.
11. **FK Delete Behavior**: `strategy_id`: `ON DELETE CASCADE`.
12. **RLS Policy Intent**: `SELECT` allowed for `auth.uid() = user_id`. Client `INSERT`, `UPDATE`, and `DELETE` strictly denied via RLS.
13. **Correction / Versioning Model**: Append-only revision history.
14. **Write Authority**: Strictly RPC-only (`rpc_create_strategy_version`). In addition, database trigger `trg_enforce_strategy_version_tenant_isolation` asserts before insert that `NEW.user_id = (SELECT user_id FROM strategies WHERE id = NEW.strategy_id)` (P0-01).
15. **Idempotency / Dedup Rule**: Unique constraint on `(strategy_id, version_number)`.
16. **Migration Phase / Order**: Phase 8D (Order 8).

#### 9. `strategy_supports`
1. **Purpose / Authority Class**: Empirical observation log capturing supporting and counter-evidence events for a strategy.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**:
   - `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
   - `strategy_id REFERENCES strategies(id) ON DELETE CASCADE`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: `UNIQUE (strategy_id, source_class, source_id, observation_type, evaluator_version)` (Mandatory source identity dedup constraint).
6. **Partial Unique Constraints**: None.
7. **Lifecycle Fields**: `observation_type text NOT NULL` (`SUPPORT`, `COUNTER_EVIDENCE`).
8. **Immutable Fields**: Entire row is immutable once inserted. Requires non-null `source_id uuid NOT NULL`.
9. **Timestamps**: `observed_at timestamptz NOT NULL`, `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_strat_supp_strategy ON strategy_supports(strategy_id, observation_type)`.
11. **FK Delete Behavior**: `strategy_id`: `ON DELETE CASCADE`.
12. **RLS Policy Intent**: `SELECT` allowed for user. Client direct `INSERT`, `UPDATE`, and `DELETE` strictly denied via RLS.
13. **Correction / Versioning Model**: Append-only evidence. Erroneous observations are corrected by appending opposite counter-evidence or version increment.
14. **Write Authority**: RPC-only (`rpc_insert_strategy_support`). Database trigger `trg_enforce_strategy_support_tenant_isolation` verifies before insert that `NEW.user_id = (SELECT user_id FROM strategies WHERE id = NEW.strategy_id)` and if `source_class = 'JOURNAL_CONTEXT'`, `NEW.user_id = (SELECT user_id FROM journal_entries WHERE id = NEW.source_id)` (P0-01).
15. **Idempotency / Dedup Rule**: `source_id` is strictly `NOT NULL` (system entities anchor to entity UUID, manual observations anchor to immutable `journal_entries.id` or dedicated observation UUID). Natural unique constraint guarantees fail-closed anti-replay.
16. **Migration Phase / Order**: Phase 8D (Order 9).

---

### 3.5 Reward Economy & Wishes Subsystem (Phase 8E)

#### 10. `reward_accounts`
1. **Purpose / Authority Class**: Authoritative cached materialized balance view derived deterministically from `foldRewardLedger(reward_transactions)`. Maintained with exact atomic parity to the event ledger.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**: `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL UNIQUE`.
5. **Unique Constraints**: `UNIQUE (user_id)`.
6. **Partial Unique Constraints**: None.
7. **Lifecycle Fields**: None.
8. **Immutable Fields**: `id`, `user_id`. Materialized balance columns: `lifetime_earned integer NOT NULL DEFAULT 0`, `net_earned integer NOT NULL DEFAULT 0`, `lifetime_redeemed integer NOT NULL DEFAULT 0`, `current_reserved integer NOT NULL DEFAULT 0`, `current_available integer NOT NULL DEFAULT 0`, `correction_deficit integer NOT NULL DEFAULT 0`.
9. **Timestamps**: `updated_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_reward_accounts_user ON reward_accounts(user_id)`.
11. **FK Delete Behavior**: `user_id`: `ON DELETE CASCADE`.
12. **RLS Policy Intent**: `SELECT` allowed for user. Direct client `INSERT`, `UPDATE`, `DELETE` strictly denied.
13. **Correction / Versioning Model**: Always synchronizes with the deterministic fold of `reward_transactions`.
14. **Write Authority**: RPC-only (internal reward settlement procedures with row-level locks).
15. **Idempotency / Dedup Rule**: Exactly one account row per user.
16. **Migration Phase / Order**: Phase 8E (Order 10).

#### 11. `reward_transactions`
1. **Purpose / Authority Class**: Physical, single-account append-only event ledger for all reward credits. Strictly immutable.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**:
   - `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
   - `account_id REFERENCES reward_accounts(id) ON DELETE RESTRICT`
   - `correction_for_id REFERENCES reward_transactions(id) ON DELETE RESTRICT`
   - `refund_for_redemption_id REFERENCES reward_redemptions(id) ON DELETE RESTRICT`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: `UNIQUE (user_id, request_idempotency_key)`.
6. **Partial Unique Constraints**:
   ```sql
   CREATE UNIQUE INDEX uq_reward_tx_canonical_source ON reward_transactions (
       user_id,
       canonical_source_type,
       canonical_source_id,
       policy_version,
       event_kind
   ) WHERE event_kind = 'EARN';

   CREATE UNIQUE INDEX uq_reward_tx_correction_for ON reward_transactions (
       correction_for_id
   ) WHERE event_kind = 'CORRECTION';

   CREATE UNIQUE INDEX uq_reward_tx_refund_for_redemption ON reward_transactions (
       refund_for_redemption_id
   ) WHERE event_kind = 'REFUND';
   ```
7. **Lifecycle Fields**: `event_kind text NOT NULL` (`EARN`, `CORRECTION`, `RESERVE`, `UNRESERVE`, `REDEEM`, `REFUND`).
8. **Immutable Fields**: Entire row is immutable. Zero `UPDATE` or `DELETE` permitted. Requires `canonical_source_id text NOT NULL` (supports `${skill.id}:M6`, `${quest.id}`, etc.).
9. **Timestamps**: `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_reward_tx_user_created ON reward_transactions(user_id, created_at DESC)`.
11. **FK Delete Behavior**: `account_id`: `ON DELETE RESTRICT`; `correction_for_id`: `ON DELETE RESTRICT`; `refund_for_redemption_id`: `ON DELETE RESTRICT`.
12. **RLS Policy Intent**: `SELECT` allowed for user. Direct client `INSERT`, `UPDATE`, `DELETE` denied.
13. **Correction / Versioning Model**: Corrections append new `CORRECTION` transactions pointing to `correction_for_id`. Refunds append new `REFUND` transactions pointing to `refund_for_redemption_id`.
14. **Write Authority**: RPC-only (`rpc_grant_reward_credit`, `rpc_correct_reward_transaction`, `rpc_reserve_wish_credits`, `rpc_unreserve_wish_credits`, `rpc_redeem_wish`, `rpc_refund_wish_redemption`).
15. **Idempotency / Dedup Rule**:
    - Replay with same `request_idempotency_key` returns existing transaction (HTTP 200).
    - Different request key for already-minted canonical source fails closed with HTTP 409 Conflict (`REWARD_ALREADY_MINTED`).
    - Multiple corrections on same transaction fail closed via `uq_reward_tx_correction_for` with HTTP 409 Conflict (`CORRECTION_ALREADY_EXISTS`).
    - Multiple refunds on same redemption fail closed via `uq_reward_tx_refund_for_redemption` with HTTP 409 Conflict (`REDEMPTION_ALREADY_REFUNDED`).
16. **Migration Phase / Order**: Phase 8E (Order 11).

#### 12. `wishes`
1. **Purpose / Authority Class**: Real-world reward celebration targets defined by user.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**: `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: None.
6. **Partial Unique Constraints**: `CREATE UNIQUE INDEX uq_wishes_single_primary ON wishes(user_id) WHERE status = 'PRIMARY';` (Enforces rule `SINGLE_PRIMARY_WISH`).
7. **Lifecycle Fields**: `status text NOT NULL DEFAULT 'IDEA'` (`IDEA`, `ACTIVE`, `PRIMARY`, `RESERVED`, `REDEEMED`, `ARCHIVED`, `CANCELLED`).
8. **Immutable Fields**: `id`, `user_id`, `created_at`.
9. **Timestamps**: `cooldown_until timestamptz NULL`, `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`, `updated_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_wishes_user_status ON wishes(user_id, status)`.
11. **FK Delete Behavior**: Dependent redemptions specify `ON DELETE RESTRICT`.
12. **RLS Policy Intent**: `SELECT`, `INSERT` allowed for user. Direct client `UPDATE` allowed only for editable content (`title`, `description`, `cost_credits_estimate`). Trigger `trg_enforce_wish_field_authority` rejects direct updates to or from `PRIMARY`, `RESERVED`, and `REDEEMED`.
13. **Correction / Versioning Model**: `REDEEMED` is strictly terminal! On refund via `rpc_refund_wish_redemption`, credit is restored via ledger `REFUND` event, while the Wish remains `REDEEMED` to preserve audit history.
14. **Write Authority**: Status transitions to `PRIMARY`, `RESERVED`, `REDEEMED`, `ARCHIVED`, `CANCELLED`, and credit unreservation (`RESERVED -> PRIMARY`) strictly via transactional RPCs (`rpc_set_primary_wish`, `rpc_reserve_wish_credits`, `rpc_unreserve_wish_credits`, `rpc_redeem_wish`, `rpc_refund_wish_redemption`, `rpc_archive_wish`, `rpc_cancel_wish`).
15. **Idempotency / Dedup Rule**: Single `PRIMARY` wish enforced by partial unique index.
16. **Migration Phase / Order**: Phase 8E (Order 12).

#### 13. `reward_redemptions`
1. **Purpose / Authority Class**: Historical fulfillment receipt for redeemed wishes. Strictly immutable.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**:
   - `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
   - `wish_id REFERENCES wishes(id) ON DELETE RESTRICT`
   - `transaction_id REFERENCES reward_transactions(id) ON DELETE RESTRICT`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: `UNIQUE (transaction_id)`.
6. **Partial Unique Constraints**: None.
7. **Lifecycle Fields**: None. Receipt is permanently immutable once issued.
8. **Immutable Fields**: Entire row is 100% immutable.
9. **Timestamps**: `redeemed_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_reward_redemptions_user ON reward_redemptions(user_id, redeemed_at DESC)`.
11. **FK Delete Behavior**: `wish_id`: `ON DELETE RESTRICT`; `transaction_id`: `ON DELETE RESTRICT`.
12. **RLS Policy Intent**: `SELECT` allowed for user. Direct client writes, updates, and deletes are denied.
13. **Correction / Versioning Model**: Immutable receipt. Refunds append an append-only `REFUND` ledger event referencing `refund_for_redemption_id`; the receipt row itself is never updated.
14. **Write Authority**: RPC-only (`rpc_redeem_wish`).
15. **Idempotency / Dedup Rule**: Unique constraint on `transaction_id`.
16. **Migration Phase / Order**: Phase 8E (Order 13).

---

### 3.6 Milestone Subsystem (Phase 8F)

#### 14. `milestones`
1. **Purpose / Authority Class**: Formal recognition layer celebrating authentic leaps in competence and durable creations. Strictly separate from Growth Core truth.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**:
   - `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
   - `reward_transaction_id REFERENCES reward_transactions(id) ON DELETE SET NULL`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**:
   - `UNIQUE (user_id, milestone_key, source_type, source_id)` (Dedup rule ensuring one active recognition per source event).
   - `UNIQUE (user_id, request_idempotency_key)` (Durable client idempotency identity).
6. **Partial Unique Constraints**: None.
7. **Lifecycle Fields**: `status text NOT NULL DEFAULT 'ACTIVE'` (`ACTIVE`, `REVOKED`, `CORRECTED`).
8. **Immutable Fields**: `id`, `user_id`, `milestone_key`, `title`, `description`, `recognition_class`, `source_type`, `source_id`, `created_at`. Provenance & Settlement fields: `recognition_class text NOT NULL CHECK (recognition_class IN ('CORE_VERIFIED', 'USER_CONFIRMED_REAL_WORLD'))`, `source_type text NOT NULL CHECK (source_type IN ('QUEST', 'MASTERY', 'ARTIFACT', 'SEASON', 'EXTERNAL_CREDENTIAL'))`, `source_id text NOT NULL`, `external_evidence_url text NULL`, `external_credential_id text NULL`, `granted_reward_credit boolean NOT NULL DEFAULT false`, `reward_transaction_id uuid NULL`, `revoked_at timestamptz NULL`, `revocation_reason text NULL`, `request_idempotency_key text NOT NULL`.
9. **Timestamps**: `recognized_at timestamptz NOT NULL DEFAULT clock_timestamp()`, `revoked_at timestamptz NULL`, `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`, `updated_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_milestones_user_class ON milestones(user_id, recognition_class)`, `INDEX idx_milestones_source ON milestones(user_id, source_type, source_id)`.
11. **FK Delete Behavior**: `reward_transaction_id`: `ON DELETE SET NULL`.
12. **RLS Policy Intent**: `SELECT` allowed for `auth.uid() = user_id`. Direct client `INSERT`, `UPDATE`, `DELETE` denied via RLS.
13. **Correction / Versioning Model**: Revocations update status to `REVOKED` via atomic `rpc_revoke_milestone`, recording `revocation_reason` and `revoked_at`. If `granted_reward_credit = true`, an offsetting `CORRECTION` transaction is appended to `reward_transactions`. Milestone history is strictly preserved (never hard-deleted). Core-backed milestones anchor canonical reward source identity directly to underlying Core entities (`QUEST`, `MASTERY:M<level>`, `ARTIFACT`), preventing wrapper double-minting.
14. **Write Authority**: Strictly RPC-only (`rpc_confirm_milestone`, `rpc_settle_milestone_reward`, `rpc_revoke_milestone`).
15. **Idempotency / Dedup Rule**: Natural composite unique constraint `UNIQUE (user_id, milestone_key, source_type, source_id)` prevents duplicate recognition for the same source. `request_idempotency_key` ensures replay safety.
16. **Migration Phase / Order**: Phase 8F (Order 14).

---

### 3.7 Optional Expansion Tables (Phase 8G Only)

#### 15. `focus_sessions`
1. **Purpose / Authority Class**: Local temporal focus logging tool. Raw focus time NEVER generates direct XP or reward credits (O11).
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**:
   - `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
   - `quest_id REFERENCES quests(id) ON DELETE SET NULL`
   - `activity_id REFERENCES activities(id) ON DELETE SET NULL`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: None.
6. **Partial Unique Constraints**: None.
7. **Lifecycle Fields**: `status text NOT NULL DEFAULT 'COMPLETED'` (`COMPLETED`, `CANCELLED`).
8. **Immutable Fields**: `id`, `user_id`, `duration_seconds`, `started_at`, `ended_at`.
9. **Timestamps**: `started_at timestamptz NOT NULL`, `ended_at timestamptz NOT NULL`.
10. **Indexes**: `INDEX idx_focus_user_started ON focus_sessions(user_id, started_at DESC)`.
11. **FK Delete Behavior**: Foreign entity links specify `ON DELETE SET NULL`.
12. **RLS Policy Intent**: `SELECT`, `UPDATE`, `DELETE` allowed for `auth.uid() = user_id`. Client direct `INSERT` and `UPDATE` enforce cross-tenant reference protection via fail-closed RLS `WITH CHECK`:
    ```sql
    auth.uid() = user_id AND
    (quest_id IS NULL OR quest_id IN (SELECT id FROM quests WHERE user_id = auth.uid())) AND
    (activity_id IS NULL OR activity_id IN (SELECT id FROM activities WHERE user_id = auth.uid()))
    ```
    Additionally, database trigger `trg_enforce_focus_session_tenant_isolation` asserts before INSERT/UPDATE that any non-null `quest_id` or `activity_id` belongs to `NEW.user_id` (P0-01).
13. **Correction / Versioning Model**: History log.
14. **Write Authority**: Direct repository writes under user RLS and tenant validation trigger.
15. **Idempotency / Dedup Rule**: Client-generated UUID PK.
16. **Migration Phase / Order**: Phase 8G (Order 15).

#### 16. `growth_protocols`
1. **Purpose / Authority Class**: Personal execution protocols, routines, and checklists under the Personal Playbook.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**: `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: None.
6. **Partial Unique Constraints**: None.
7. **Lifecycle Fields**: `is_active boolean NOT NULL DEFAULT true`.
8. **Immutable Fields**: `id`, `user_id`, `created_at`.
9. **Timestamps**: `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`, `updated_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_protocols_user_active ON growth_protocols(user_id, is_active)`.
11. **FK Delete Behavior**: Child table `protocol_versions` specifies `ON DELETE CASCADE`.
12. **RLS Policy Intent**: `auth.uid() = user_id`.
13. **Correction / Versioning Model**: Protocol revisions append to `protocol_versions`.
14. **Write Authority**: Direct repository writes under user RLS.
15. **Idempotency / Dedup Rule**: Client-generated UUID PK.
16. **Migration Phase / Order**: Phase 8G (Order 16).

#### 17. `protocol_versions`
1. **Purpose / Authority Class**: Immutable snapshots of protocol checklist definitions.
2. **Primary Key**: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
3. **Foreign Keys**:
   - `user_id REFERENCES auth.users(id) ON DELETE CASCADE`
   - `protocol_id REFERENCES growth_protocols(id) ON DELETE CASCADE`
4. **`user_id` Ownership**: Explicit tenant column `user_id uuid NOT NULL`.
5. **Unique Constraints**: `UNIQUE (protocol_id, version_number)`.
6. **Partial Unique Constraints**: None.
7. **Lifecycle Fields**: None.
8. **Immutable Fields**: Entire row is immutable.
9. **Timestamps**: `created_at timestamptz NOT NULL DEFAULT clock_timestamp()`.
10. **Indexes**: `INDEX idx_protocol_versions_proto ON protocol_versions(protocol_id)`.
11. **FK Delete Behavior**: `protocol_id`: `ON DELETE CASCADE`.
12. **RLS Policy Intent**: `SELECT` allowed for `auth.uid() = user_id`. Direct client `INSERT`, `UPDATE`, and `DELETE` denied via RLS.
13. **Correction / Versioning Model**: Append-only versions.
14. **Write Authority**: Strictly RPC-only or repository write with database trigger `trg_enforce_protocol_version_tenant_isolation` asserting before insert that `NEW.user_id = (SELECT user_id FROM growth_protocols WHERE id = NEW.protocol_id)` (P0-01).
15. **Idempotency / Dedup Rule**: Natural unique constraint `(protocol_id, version_number)`.
16. **Migration Phase / Order**: Phase 8G (Order 17).
