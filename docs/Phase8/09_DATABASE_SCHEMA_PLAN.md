# Phase 8 — Database Schema Architecture Plan

## 1. Governance Boundary & Migration Policy

**CRITICAL DIRECTIVE**: This document is a **structural schema design specification only**. Absolutely NO SQL migration files (`supabase/migrations/*.sql`) are authorized to be created in Phase 8A.

Database migrations will be authored incrementally within their respective implementation phases (Phase 8B through 8G) only after independent acceptance of each phase's controlling scope.

---

## 2. Table Inventory & Domain Boundary

### 2.1 Authorized Phase 8 Core Tables
The following 14 tables constitute the complete Outer Growth Loop persistent boundary:

1. **Governance & Audit Layer**:
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

## 3. Comprehensive Schema Specifications

---

### 3.1 Governance & Audit Layer

#### `outer_loop_proposals`
- **Purpose & Authority Class**: Non-authoritative envelope for all AI GM recommendations awaiting user review.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `proposal_type`: `text NOT NULL` (`SEASON_PLAN`, `REVIEW_SUMMARY`, `STRATEGY_HYPOTHESIS`, etc.)
  - `schema_version`: `integer NOT NULL DEFAULT 1`
  - `source_refs`: `jsonb NOT NULL DEFAULT '[]'::jsonb`
  - `model_metadata`: `jsonb NOT NULL DEFAULT '{}'::jsonb`
  - `payload`: `jsonb NOT NULL`
  - `status`: `text NOT NULL DEFAULT 'PROPOSED'` (`PROPOSED`, `ACCEPTED`, `EDITED`, `REJECTED`, `EXPIRED`)
  - `resulting_entity_type`: `text NULL`
  - `resulting_entity_id`: `uuid NULL`
  - `created_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
  - `reviewed_at`: `timestamptz NULL`
  - `expires_at`: `timestamptz NOT NULL`
- **Constraints & Indexes**:
  - `CHECK (status IN ('PROPOSED', 'ACCEPTED', 'EDITED', 'REJECTED', 'EXPIRED'))`
  - `INDEX idx_outer_proposals_user_status ON outer_loop_proposals(user_id, status)`
- **RLS Policy**: `user_id = auth.uid()`.
- **Write Authority**: Direct insert by AI pipeline API; status transitions via User Review RPC.

#### `outer_loop_audit_events`
- **Purpose & Authority Class**: Append-only security and provenance log recording all Outer Loop state mutations.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `event_type`: `text NOT NULL` (e.g., `SEASON_ACTIVATED`, `STRATEGY_PROMOTED`, `WISH_REDEEMED`)
  - `entity_type`: `text NOT NULL`
  - `entity_id`: `uuid NOT NULL`
  - `idempotency_key`: `text NULL`
  - `actor_type`: `text NOT NULL` (`USER`, `RPC_ENGINE`, `ADMIN`)
  - `details`: `jsonb NOT NULL DEFAULT '{}'::jsonb`
  - `created_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
- **Constraints & Indexes**:
  - `INDEX idx_outer_audit_user_created ON outer_loop_audit_events(user_id, created_at DESC)`
- **RLS Policy**: `SELECT` allowed for `user_id = auth.uid()`. `INSERT` allowed only via internal RPCs. No `UPDATE` or `DELETE`.

---

### 3.2 Season & Review Subsystem (Phase 8B)

#### `seasons`
- **Purpose & Authority Class**: Authoritative macro-cycle container record.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `title`: `text NOT NULL`
  - `theme`: `text NULL`
  - `status`: `text NOT NULL DEFAULT 'DRAFT'` (`DRAFT`, `PLANNED`, `ACTIVE`, `COMPLETED`, `ENDED_EARLY`, `ABANDONED`, `CANCELLED`)
  - `target_duration_days`: `integer NOT NULL DEFAULT 28`
  - `planned_start_date`: `date NULL`
  - `planned_end_date`: `date NULL`
  - `started_at`: `timestamptz NULL`
  - `ended_at`: `timestamptz NULL`
  - `baseline_summary`: `text NULL`
  - `success_criteria`: `jsonb NOT NULL DEFAULT '[]'::jsonb`
  - `created_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
  - `updated_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
- **Constraints & Indexes**:
  - `CHECK (target_duration_days BETWEEN 14 AND 84)`
  - `CHECK (status IN ('DRAFT', 'PLANNED', 'ACTIVE', 'COMPLETED', 'ENDED_EARLY', 'ABANDONED', 'CANCELLED'))`
  - **Single Active Season Invariant (O13)**:
    `CREATE UNIQUE INDEX uq_seasons_single_active ON seasons(user_id) WHERE status = 'ACTIVE';`
  - `INDEX idx_seasons_user_status ON seasons(user_id, status)`
- **FK Delete Behavior**: `ON DELETE RESTRICT` if status has ever been `ACTIVE`.
- **Write Authority**: State transitions exclusively via atomic RPC (`activate_season`, `conclude_season`).

#### `season_quests`
- **Purpose & Authority Class**: $N:N$ link table mediating Season-to-Quest relationships.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `season_id`: `uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE`
  - `quest_id`: `uuid NOT NULL REFERENCES quests(id) ON DELETE RESTRICT`
  - `role`: `text NOT NULL DEFAULT 'FOCUS'` (`MAIN`, `FOCUS`)
  - `created_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
- **Constraints & Indexes**:
  - `CHECK (role IN ('MAIN', 'FOCUS'))`
  - `UNIQUE (season_id, quest_id)`
  - **At Most One MAIN Quest per Season**:
    `CREATE UNIQUE INDEX uq_season_quests_single_main ON season_quests(season_id) WHERE role = 'MAIN';`
  - `INDEX idx_season_quests_quest_id ON season_quests(quest_id)`
- **RLS Policy**: `user_id = auth.uid()`. Foreign key tenant-validation asserted in RPC.

#### `season_reviews`
- **Purpose & Authority Class**: Authoritative structured retrospective synthesis record.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `season_id`: `uuid NULL REFERENCES seasons(id) ON DELETE RESTRICT`
  - `review_type`: `text NOT NULL` (`WEEKLY`, `FINAL`, `AD_HOC`)
  - `period_start`: `timestamptz NOT NULL`
  - `period_end`: `timestamptz NOT NULL`
  - `objective_summary`: `jsonb NOT NULL DEFAULT '{}'::jsonb`
  - `qualitative_reflection`: `text NOT NULL`
  - `criteria_evaluation`: `jsonb NOT NULL DEFAULT '[]'::jsonb`
  - `tactical_adjustments`: `text NULL`
  - `version`: `integer NOT NULL DEFAULT 1`
  - `superseded_by_id`: `uuid NULL REFERENCES season_reviews(id)`
  - `created_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
- **Constraints & Indexes**:
  - `CHECK (review_type IN ('WEEKLY', 'FINAL', 'AD_HOC'))`
  - `INDEX idx_season_reviews_season ON season_reviews(season_id, review_type)`
- **Write Authority**: Creation and versioning via atomic RPC (`finalize_season_review`). Finalized reviews are immutable.

---

### 3.3 Journal & State Subsystem (Phase 8C)

#### `journal_entries`
- **Purpose & Authority Class**: Subjective reflection and daily context record.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `entry_type`: `text NOT NULL` (`FREE_REFLECTION`, `QUEST_REFLECTION`, `DAILY_SUMMARY`, `WEEKLY_REFLECTION`, `SEASON_REFLECTION`, `STATE_LOG`, `DECISION_NOTE`, `FAILURE_POSTMORTEM`, `INSIGHT`)
  - `title`: `text NULL`
  - `content_markdown`: `text NOT NULL`
  - `energy`: `integer NULL CHECK (energy BETWEEN 1 AND 5)`
  - `focus`: `integer NULL CHECK (focus BETWEEN 1 AND 5)`
  - `stress`: `integer NULL CHECK (stress BETWEEN 1 AND 5)`
  - `resistance`: `integer NULL CHECK (resistance BETWEEN 1 AND 5)`
  - `recovery`: `integer NULL CHECK (recovery BETWEEN 1 AND 5)`
  - `mood_valence`: `integer NULL CHECK (mood_valence BETWEEN -2 AND 2)`
  - `self_confidence`: `integer NULL CHECK (self_confidence BETWEEN 1 AND 5)`
  - `season_id`: `uuid NULL REFERENCES seasons(id) ON DELETE SET NULL`
  - `quest_id`: `uuid NULL REFERENCES quests(id) ON DELETE SET NULL`
  - `activity_id`: `uuid NULL REFERENCES activities(id) ON DELETE SET NULL`
  - `is_archived`: `boolean NOT NULL DEFAULT false`
  - `logged_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
  - `created_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
  - `updated_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
- **Constraints & Indexes**:
  - `INDEX idx_journal_user_logged ON journal_entries(user_id, logged_at DESC)`
  - `INDEX idx_journal_season ON journal_entries(season_id)`
- **RLS Policy**: `user_id = auth.uid()`. Strict private ownership.

---

### 3.4 Strategy & Personal Playbook Subsystem (Phase 8D)

#### `strategies`
- **Purpose & Authority Class**: Authoritative Personal Playbook heuristic record.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `title`: `text NOT NULL`
  - `description`: `text NOT NULL`
  - `context_trigger`: `text NOT NULL`
  - `action_protocol`: `text NOT NULL`
  - `expected_outcome`: `text NOT NULL`
  - `lifecycle_status`: `text NOT NULL DEFAULT 'HYPOTHESIS'` (`HYPOTHESIS`, `TESTING`, `SUPPORTED`, `CONTEXTUAL`, `WEAKENED`, `RETIRED`)
  - `confidence_level`: `text NOT NULL DEFAULT 'LOW'` (`LOW`, `MODERATE`, `HIGH`, `VERY_HIGH`)
  - `version`: `integer NOT NULL DEFAULT 1`
  - `created_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
  - `updated_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
- **Constraints & Indexes**:
  - `CHECK (lifecycle_status IN ('HYPOTHESIS', 'TESTING', 'SUPPORTED', 'CONTEXTUAL', 'WEAKENED', 'RETIRED'))`
  - `CHECK (confidence_level IN ('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'))`
  - `INDEX idx_strategies_user_status ON strategies(user_id, lifecycle_status)`
- **Write Authority**: Promotion to `SUPPORTED` and confidence recalculation strictly via deterministic RPC (`evaluate_strategy_status`).

#### `strategy_versions`
- **Purpose & Authority Class**: Immutable snapshots of material protocol revisions.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `strategy_id`: `uuid NOT NULL REFERENCES strategies(id) ON DELETE CASCADE`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `version_number`: `integer NOT NULL`
  - `action_protocol`: `text NOT NULL`
  - `change_summary`: `text NOT NULL`
  - `created_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
- **Constraints**: `UNIQUE (strategy_id, version_number)`.

#### `strategy_supports`
- **Purpose & Authority Class**: Empirical observation log capturing supporting and counter-evidence events.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `strategy_id`: `uuid NOT NULL REFERENCES strategies(id) ON DELETE CASCADE`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `observation_type`: `text NOT NULL` (`SUPPORT`, `COUNTER_EVIDENCE`)
  - `source_class`: `text NOT NULL` (`SEASON_REVIEW`, `ACTIVITY`, `QUEST_OUTCOME`, `ARTIFACT`, `CORE_EVIDENCE_REFERENCE`, `JOURNAL_CONTEXT`, `MANUAL_OBSERVATION`)
  - `source_id`: `uuid NULL`
  - `note`: `text NULL`
  - `observed_at`: `timestamptz NOT NULL`
  - `created_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
- **Constraints & Indexes**:
  - `CHECK (observation_type IN ('SUPPORT', 'COUNTER_EVIDENCE'))`
  - `INDEX idx_strat_supp_strategy ON strategy_supports(strategy_id, observation_type)`

---

### 3.5 Reward Economy & Wishes Subsystem (Phase 8E)

#### `reward_accounts`
- **Purpose & Authority Class**: Aggregated balance cache maintained with strict parity to the append-only ledger.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE`
  - `lifetime_earned`: `integer NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0)`
  - `lifetime_redeemed`: `integer NOT NULL DEFAULT 0 CHECK (lifetime_redeemed >= 0)`
  - `current_reserved`: `integer NOT NULL DEFAULT 0 CHECK (current_reserved >= 0)`
  - `current_available`: `integer NOT NULL DEFAULT 0 CHECK (current_available >= 0)`
  - `correction_deficit`: `integer NOT NULL DEFAULT 0 CHECK (correction_deficit >= 0)`
  - `updated_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
- **Write Authority**: Updated exclusively by transactional RPCs processing `reward_transactions`.

#### `reward_transactions`
- **Purpose & Authority Class**: Physical, append-only double-entry ledger for all reward credits. Immutable.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `account_id`: `uuid NOT NULL REFERENCES reward_accounts(id) ON DELETE RESTRICT`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `event_kind`: `text NOT NULL` (`EARN`, `CORRECTION`, `RESERVE`, `UNRESERVE`, `REDEEM`, `REFUND`)
  - `amount`: `integer NOT NULL`
  - `source_type`: `text NOT NULL` (`SEASON`, `QUEST`, `MASTERY`, `ARTIFACT`, `MILESTONE`, `WISH`, `MANUAL_CORRECTION`)
  - `source_id`: `uuid NULL`
  - `idempotency_key`: `text NOT NULL UNIQUE`
  - `correction_for_id`: `uuid NULL REFERENCES reward_transactions(id)`
  - `policy_version`: `text NOT NULL DEFAULT 'v1'`
  - `note`: `text NULL`
  - `created_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
- **Constraints & Indexes**:
  - `CHECK (event_kind IN ('EARN', 'CORRECTION', 'RESERVE', 'UNRESERVE', 'REDEEM', 'REFUND'))`
  - `INDEX idx_reward_tx_user_created ON reward_transactions(user_id, created_at DESC)`
- **RLS Policy**: `SELECT` permitted for user. `INSERT` strictly restricted to database RPC. No `UPDATE` or `DELETE`.

#### `wishes`
- **Purpose & Authority Class**: Real-world reward celebration desires.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `title`: `text NOT NULL`
  - `description`: `text NULL`
  - `credit_cost`: `integer NOT NULL CHECK (credit_cost > 0)`
  - `real_world_cost`: `numeric(10, 2) NULL` (informational only)
  - `currency`: `text NULL DEFAULT 'USD'`
  - `status`: `text NOT NULL DEFAULT 'IDEA'` (`IDEA`, `ACTIVE`, `PRIMARY`, `RESERVED`, `REDEEMED`, `ARCHIVED`, `CANCELLED`)
  - `cooldown_until`: `timestamptz NULL`
  - `created_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
  - `updated_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
- **Constraints & Indexes**:
  - `CHECK (status IN ('IDEA', 'ACTIVE', 'PRIMARY', 'RESERVED', 'REDEEMED', 'ARCHIVED', 'CANCELLED'))`
  - **At Most One PRIMARY Wish per User (O16)**:
    `CREATE UNIQUE INDEX uq_wishes_single_primary ON wishes(user_id) WHERE status = 'PRIMARY';`
  - `INDEX idx_wishes_user_status ON wishes(user_id, status)`
- **Write Authority**: Transitions to `RESERVED` and `REDEEMED` require atomic RPCs with balance checks.

#### `reward_redemptions`
- **Purpose & Authority Class**: Historical fulfillment receipt for redeemed wishes.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `wish_id`: `uuid NOT NULL REFERENCES wishes(id) ON DELETE RESTRICT`
  - `transaction_id`: `uuid NOT NULL REFERENCES reward_transactions(id) ON DELETE RESTRICT`
  - `credits_spent`: `integer NOT NULL CHECK (credits_spent > 0)`
  - `celebration_note`: `text NULL`
  - `redeemed_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
- **RLS Policy**: `SELECT` permitted for user. `INSERT` via redemption RPC.

---

### 3.6 Milestone Subsystem (Phase 8F)

#### `milestones`
- **Purpose & Authority Class**: Formal recognition layer celebrating authentic growth leaps.
- **Columns**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `milestone_key`: `text NOT NULL`
  - `title`: `text NOT NULL`
  - `description`: `text NOT NULL`
  - `recognition_class`: `text NOT NULL` (`CORE_VERIFIED`, `USER_CONFIRMED_REAL_WORLD`)
  - `status`: `text NOT NULL DEFAULT 'ACTIVE'` (`ACTIVE`, `REVOKED`, `CORRECTED`)
  - `source_type`: `text NOT NULL` (`SKILL_MASTERY`, `QUEST_BOSS`, `ARTIFACT_DURABLE`, `SEASON_COMPLETE`, `REAL_WORLD_EVENT`)
  - `source_id`: `uuid NULL`
  - `granted_reward_credit`: `boolean NOT NULL DEFAULT false`
  - `reward_transaction_id`: `uuid NULL REFERENCES reward_transactions(id)`
  - `recognized_at`: `timestamptz NOT NULL DEFAULT clock_timestamp()`
  - `revoked_at`: `timestamptz NULL`
  - `revocation_reason`: `text NULL`
- **Constraints & Indexes**:
  - `UNIQUE (user_id, milestone_key)`
  - `CHECK (recognition_class IN ('CORE_VERIFIED', 'USER_CONFIRMED_REAL_WORLD'))`
  - `CHECK (status IN ('ACTIVE', 'REVOKED', 'CORRECTED'))`
  - `INDEX idx_milestones_user_status ON milestones(user_id, status)`

---

## 4. Phase-by-Phase Migration Sequencing

When implementation begins, migrations must be applied strictly in this order:

```text
Phase 8B:  seasons, season_quests, season_reviews, outer_loop_proposals, outer_loop_audit_events
Phase 8C:  journal_entries
Phase 8D:  strategies, strategy_versions, strategy_supports
Phase 8E:  reward_accounts, reward_transactions, wishes, reward_redemptions
Phase 8F:  milestones
Phase 8G:  (optional) focus_sessions, growth_protocols, protocol_versions
```
