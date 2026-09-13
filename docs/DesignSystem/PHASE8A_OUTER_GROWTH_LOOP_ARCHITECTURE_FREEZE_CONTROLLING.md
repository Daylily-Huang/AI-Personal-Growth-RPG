# Phase 8A — Outer Growth Loop Architecture Freeze — Controlling Document

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`  
**Author:** Independent Review AI / Gatekeeper  
**Date:** 2026-09-13  
**Controlling baseline:** `main@0a85de522503cf3f0a656f74f248c9a65e7b5da5`  
**Phase 7:** `FINAL FROZEN — DO NOT REOPEN`  
**CI Governance Guard corrective:** `CLOSED / REPAIRED`  
**Phase 8:** `ARCHITECTURE ONLY — IMPLEMENTATION NOT AUTHORIZED`  
**Document authority:** This file controls Phase 8A execution. Where the earlier Phase 8 roadmap is ambiguous, outdated, or merely suggestive, this document supplies the binding Phase 8A decision unless an ADR is explicitly approved by the independent reviewer.

---

# 0. Purpose and authorization boundary

Phase 8A exists to freeze the **Outer Growth Loop architecture before any Phase 8 product implementation begins**.

Phase 8 extends the frozen Growth Core; it does not replace it. The product direction remains:

> Growth Core determines what real growth occurred. Outer Growth Loop organizes long-horizon intent, context, reflection, strategy, recognition, and non-addictive reality rewards around that truth.

This task authorizes **documentation and architecture only**.

It does **not** authorize:

- database migrations;
- Supabase schema/RLS/RPC changes;
- API routes;
- production TypeScript/React;
- UI pages or navigation changes;
- Growth Engine changes;
- XP/Mastery/Evidence semantics changes;
- workflow/dependency changes;
- Phase 7 edits disguised as Phase 8 preparation.

Phase 8B implementation remains blocked until Phase 8A receives a separate independent exact-head review with `P0=0 / P1=0 / P2=0` and explicit authorization.

---

# 1. Source hierarchy and current repository truth

Phase 8A must read and reconcile, in this order:

1. `docs/Design ChatGPT/01_SYSTEM_RULES.md`
2. `docs/Design ChatGPT/02_PRODUCT_DESIGN.md`
3. `docs/MASTER_PROJECT_HANDOFF.md`
4. existing Growth Engine / Ledger / Quest / Skill / Knowledge / Artifact authority documents and tests;
5. the user-authored `PHASE8_OUTER_GROWTH_LOOP_ROADMAP.md`;
6. this controlling document.

For **existing frozen Core semantics**, items 1–4 remain authoritative.

For **Phase 8A scope, sequencing, and Outer Loop decisions**, this controlling document is authoritative.

Repository state at Phase 8A start:

```text
main:
0a85de522503cf3f0a656f74f248c9a65e7b5da5

Phase 7:
FINAL FROZEN

PR #29 final-freeze docs sync:
MERGED

PR #30 CI governance correction:
MERGED

post-merge main push CI:
34758696881 = success
```

The historical Phase 8 roadmap contains pre-freeze status text for Phase 6/7. The Phase 8A documentation package must normalize those sections to the current reality rather than repeating obsolete `NEXT` states.

`v1.0-core` tag status is **NOT VERIFIED by this controlling document**. Lack of tag verification does not block architecture documentation, but Phase 8B production implementation may not begin until the independent reviewer either verifies the tag or explicitly replaces that gate with an immutable main baseline declaration.

---

# 2. Product boundary

The Growth Core remains the permanent source of truth for:

- Activity;
- Assessment;
- two-phase confirmation;
- deterministic XP settlement;
- XP Ledger;
- Quest completion/progress truth;
- Skill/Mastery truth;
- Evidence truth;
- Knowledge authority/provenance;
- Artifact authority/provenance.

Outer Growth Loop is permitted to:

- reference;
- aggregate;
- derive;
- contextualize;
- organize;
- propose;
- review;
- recognize;
- create a separate non-growth reward economy.

Outer Growth Loop is not permitted to silently become a second Growth Engine.

No Phase 8 entity may directly rewrite existing Growth Truth.

---

# 3. Non-negotiable invariants

All existing project invariants remain in force, including:

```text
Time != XP
XP != Mastery
High Mastery requires Evidence
LLM proposal != committed authority
Final XP is deterministic
Every XP mutation is ledger-traceable
Knowledge authority != Skill mastery
Confidence != truth
Mastery != confidence
Artifact != Evidence
archive lifecycle != authority state
```

Phase 8A additionally freezes the following Outer Loop invariants.

## O1 — Outer Loop cannot mutate historical Growth Truth

Season, Review, Journal, Strategy, Reward, Wish, Milestone, Focus, Protocol, or Past Self must not rewrite historical XP, Mastery, Evidence, Activity facts, Knowledge provenance, Artifact provenance, or Quest completion facts.

## O2 — XP is permanently non-spendable

```text
XP != Currency
XP != Reward Credit
XP != Balance
```

XP can never be purchased, transferred, reserved, redeemed, refunded, or reduced because a user claims a reality reward.

## O3 — Reward economy is a physically separate authority domain

Reward Credit must use an independent ledger and independent settlement authority. No Reward balance may be computed from an XP balance field and no XP transaction may double as a Reward transaction.

## O4 — Reward is subordinate to growth, not the core engagement engine

No loot boxes, gacha, random drops, forced streak rewards, loss-aversion traps, punishment loops, public XP ranking, credit trading, credit transfer, cash-out, or gambling mechanics.

## O5 — Season is not Streak

A Season is a finite growth chapter with baseline, target outcome, success criteria, focus, and review. Consecutive-day completion is never sufficient evidence that a Season succeeded.

## O6 — Strategy requires cross-time support

One Activity, one Journal entry, one AI observation, or one successful day cannot produce a `SUPPORTED` Strategy.

## O7 — Journal is subjective context by default

Journal/State may inform review and Strategy hypothesis generation, but it is not Verified Evidence and cannot silently upgrade Mastery.

Journal-to-Evidence conversion is **out of scope for initial Phase 8** and requires a future explicit authority RFC if ever introduced.

## O8 — AI remains Proposal authority only

AI may generate structured proposals and analysis. Permanent state changes require deterministic validation plus explicit user-confirm/edit/reject semantics where user intent is relevant.

## O9 — Permanent mutations are auditable

Every Phase 8 permanent state transition and ledger mutation must be attributable to user, source, request/idempotency key, timestamp, and policy/schema version where relevant.

## O10 — Repetition cannot create a farmable reward loop

No micro-task-completion faucet. Reward issuance must be based on sparse, high-value, independently identifiable milestone events with one-time idempotent source keys.

## O11 — Temporary state cannot become permanent capability

Energy, Focus, Stress, Resistance, Recovery, Mood, and self-reported confidence are context variables only. They never directly change Skill/Mastery.

## O12 — Existing frozen entities are reused before parallel concepts are created

Phase 8 v1 must not create a new generic `Goal` domain parallel to Quest. Long-term objectives continue to use Main/Epic/Major Quest semantics. Season is a time/context layer over Quests, not a replacement goal tree.

---

# 4. Canonical Phase 8 entity classification

Phase 8A must distinguish **persistent domain records**, **AI proposals**, and **derived views**.

## 4.1 Persistent Outer Loop domain records

Initial architecture may contain:

```text
Season
SeasonQuestLink
SeasonReview
JournalEntry
Strategy
StrategyVersion / StrategySupport
RewardAccount
RewardTransaction
Wish
RewardRedemption
Milestone
OuterLoopProposal
OuterLoopAuditEvent
```

Optional Phase 8G persistent records, not first-release requirements:

```text
FocusSession
GrowthProtocol
ProtocolVersion
```

## 4.2 Explicitly derived / non-authoritative views

The following must not become independent Growth Truth tables merely because they are useful in UI:

```text
Season progress
Season activity set
Strategy confidence
Reward available balance
Reward reserved balance
Past Self comparison
Next Best Action
Goal alignment summaries
Recent Growth summaries
State trend summaries
Milestone candidate list
```

Caching is permitted later for performance only if the canonical recomputation path and invalidation rules remain deterministic.

## 4.3 Explicitly rejected initial entities

Do not introduce in initial Phase 8 architecture:

```text
Goal            # Quest already owns long-term goal hierarchy
PastSelf        # derived comparison view
Streak          # concept conflicts with Season semantics
Coin/XPWallet   # Reward Credit is isolated; XP is not money
CharacterStatFromMood
JournalEvidence # implicit journal->evidence path forbidden
Marketplace
SocialLeaderboard
```

---

# 5. Binding implementation sequence

The roadmap's original order is superseded by this dependency-driven sequence:

```text
Phase 8A
Outer Loop Architecture Freeze

    ↓

Phase 8B
Season + Structured Review

    ↓

Phase 8C
Journal + State Context

    ↓

Phase 8D
Strategy + Personal Playbook

    ↓

Phase 8E
Reward Economy + Wishes

    ↓

Phase 8F
Milestones + Achievements

    ↓

Phase 8G
Optional Expansion: Focus / Protocols / Past Self
```

Rationale:

- Season supplies the temporal context.
- Review supplies structured interpretation of a completed/ongoing Season.
- Journal/State supplies subjective context explaining friction and conditions.
- Strategy is a conclusion drawn from cross-time Growth Truth + Review + optional Journal context; therefore Strategy must not precede these inputs.
- Reward is orthogonal motivation infrastructure and should not block the personal-intelligence loop.
- Milestone recognition sits over already-stable truth and reward policy.
- Focus/Protocols/Past Self are secondary action/template/feedback layers and do not justify becoming early core domains.

---

# 6. Season + Review architecture freeze

## 6.1 Season role

A Season is a finite time/context container around existing Quest/Growth Truth.

It is **not** a second Quest hierarchy and does not compute XP.

## 6.2 Duration

Freeze for v1:

```text
recommended_duration = 28 days
minimum_duration = 14 days
maximum_duration = 84 days
```

Shorter work belongs in Quest/Activity. Longer arcs should chain multiple Seasons.

## 6.3 Concurrency

A user may have multiple `DRAFT` or `PLANNED` Seasons, but at most **one ACTIVE Season** at a time.

This must be enforceable at the database level, not only in UI.

## 6.4 Season <-> Quest relation

Freeze as `N:N`.

```text
SeasonQuestLink.role = MAIN | FOCUS
```

- one Season may have `0..1 MAIN` Quest;
- one Season may have `0..N FOCUS` Quests;
- one long-lived Quest may appear in multiple Seasons;
- Season completion never marks the Quest complete automatically;
- Quest completion never automatically closes a Season.

## 6.5 Activity relation

Do **not** add a `season_id` authority field to frozen Activity in Phase 8B.

Default Season activity set is a **derived read model** using:

1. linked Season Quests;
2. existing Activity->Quest linkage;
3. Season actual time window.

Activities not linked through relevant Quest context must not be silently attributed to a Season. A Review may explicitly reference a relevant Activity without making that Activity permanently owned by the Season.

## 6.6 Lifecycle

Freeze:

```text
DRAFT
  ↓
PLANNED
  ↓
ACTIVE
  ├─> COMPLETED
  ├─> ENDED_EARLY
  └─> ABANDONED

PLANNED ─> CANCELLED
```

`COMPLETED`, `ENDED_EARLY`, `ABANDONED`, and `CANCELLED` are historical terminal states.

A Season that has reached `ACTIVE` can never be hard-deleted through normal product APIs.

## 6.7 Review is a separate domain record

Review is not Journal.

Freeze Review types:

```text
WEEKLY
FINAL
AD_HOC
```

Review contains structured references and user-confirmed synthesis. It may consume:

- Growth Core facts;
- Season baseline/criteria;
- Quest/Activity summaries;
- Artifact/Skill/Knowledge references;
- Journal context.

It may not create XP/Mastery/Evidence truth.

A `FINAL` review is required before `COMPLETED` or `ENDED_EARLY` settlement. `ABANDONED` requires an explicit termination reason/audit record even if a full final review is skipped.

Finalized Reviews are versioned/superseded rather than destructively overwritten.

---

# 7. Journal + State architecture freeze

Journal answers **"how did I experience this?"**, not **"what objectively happened?"**.

## 7.1 Persistence model

Use one `JournalEntry` domain with optional structured state fields. Do not create a separate permanent `State` capability domain in v1.

Recommended entry types:

```text
FREE_REFLECTION
QUEST_REFLECTION
DAILY_SUMMARY
WEEKLY_REFLECTION
SEASON_REFLECTION
STATE_LOG
DECISION_NOTE
FAILURE_POSTMORTEM
INSIGHT
```

## 7.2 State fields

Freeze semantic separation:

```text
energy            1..5
focus             1..5
stress            1..5
resistance        1..5
recovery          1..5
mood_valence     -2..2
self_confidence   1..5
```

These are subjective context fields, never Skill confidence or Mastery confidence.

## 7.3 Privacy

Journal is private by default.

No Phase 8A design may assume public sharing. Any future witness/social feature requires a separate privacy/authority RFC.

## 7.4 AI insight handling

AI summaries, pattern observations, and Strategy candidates use the common `OuterLoopProposal` envelope and remain non-authoritative.

No direct AI write to Strategy or Evidence is allowed.

## 7.5 Evidence boundary

For Phase 8 initial implementation:

```text
Journal != Verified Evidence
```

No automatic or implicit conversion path is permitted.

---

# 8. Strategy + Personal Playbook architecture freeze

Strategy answers:

> In what context, what approach appears to work for me?

It is distinct from Knowledge, Skill, Artifact, and Journal.

## 8.1 Lifecycle

Freeze:

```text
HYPOTHESIS
  ↓
TESTING
  ├─> SUPPORTED
  └─> CONTEXTUAL

SUPPORTED / CONTEXTUAL
  └─> WEAKENED

HYPOTHESIS / TESTING / SUPPORTED / CONTEXTUAL / WEAKENED
  └─> RETIRED
```

A retired Strategy is historical. A materially revised method becomes a new version, not a history rewrite.

## 8.2 Support requirement

A Strategy cannot become `SUPPORTED` from one observation.

At minimum the architecture must require:

- explicit user acceptance of the Strategy hypothesis;
- at least two temporally distinct support observations;
- at least one completed Season context;
- at least two linked underlying Growth Core events or outcomes;
- deterministic evaluation of counter-evidence;
- no AI-only transition to `SUPPORTED`.

`CONTEXTUAL` is appropriate when support is reproducible but only inside a bounded context.

## 8.3 Confidence

Do not make a free-editable numeric percentage authoritative.

Canonical confidence is a **derived deterministic assessment** from support/counter-support records and evaluator version.

Prefer ordinal presentation such as:

```text
LOW
MODERATE
HIGH
VERY_HIGH
```

The exact deterministic scoring rubric must be specified in the Phase 8D architecture document before implementation. If a numeric score is retained internally, it must be derived, reproducible, versioned, and not represented as truth beyond its evidence.

## 8.4 Support provenance

Strategy support/counter-support must record source references without reclassifying those references as new Evidence truth.

Possible source classes:

```text
SEASON_REVIEW
ACTIVITY
QUEST_OUTCOME
ARTIFACT
CORE_EVIDENCE_REFERENCE
JOURNAL_CONTEXT
MANUAL_OBSERVATION
```

Source class strength must be explicit.

---

# 9. Reward Economy + Wishes architecture freeze

## 9.1 Isolation

Reward Credit is an incentive accounting system, not growth truth.

Use:

```text
RewardAccount
RewardTransaction (append-only)
Wish
RewardRedemption
```

Do not reuse `xp_transactions`.

## 9.2 Initial reward sources are deliberately narrow

Phase 8E v1 may issue Reward Credit only from a versioned deterministic policy over sparse high-value source classes:

```text
1. successful Season completion with confirmed final review
2. eligible Major/Epic/Boss Quest completion
3. verified Mastery milestone
4. major durable Artifact OR independently confirmed real-world milestone
```

Micro Activities, login frequency, raw focus duration, Journal count, task count, or streak count are never valid reward faucets.

Exact credit amounts are not frozen here; they must be supplied by a deterministic, versioned policy in the Phase 8E spec. AI may suggest policy changes but cannot calculate authoritative grants at runtime.

## 9.3 Ledger event model

Freeze append-only event classes:

```text
EARN
CORRECTION
RESERVE
UNRESERVE
REDEEM
REFUND
```

Voucher functionality is **deferred from initial Phase 8E**. If vouchers are later introduced, they require a separate extension of the Reward Ledger spec rather than ad-hoc fields.

Cash/reality-budget management is also deferred from v1; `real_world_cost` on a Wish is informational only.

## 9.4 Idempotency

Each one-time EARN must have a stable unique source identity such as:

```text
(user_id, source_type, source_id, policy_version, event_kind)
```

Replay must fail closed or resolve to the already committed transaction.

Correction must append a new transaction linked to the original transaction; historical rows are never edited/deleted.

## 9.5 Balances

Canonical balances are derived from ledger events or maintained only through an authoritative atomic RPC with ledger parity.

Client-provided balance is never trusted.

If a later correction causes net credit below reserved/spent history, do not erase history or silently clamp the ledger. Architecture must expose an auditable correction deficit; spendable balance is zero until future legitimate earns offset the deficit.

This is accounting correction, not a punishment mechanic.

## 9.6 Wish lifecycle

Freeze:

```text
IDEA
  ↓
ACTIVE
  ↓
PRIMARY
  ↓
RESERVED
  ↓
REDEEMED

IDEA / ACTIVE / PRIMARY
  └─> ARCHIVED | CANCELLED

RESERVED ─> PRIMARY  # explicit unreserve
```

`COOLDOWN` is not a lifecycle status. Use `cooldown_until` or equivalent policy metadata.

At most one PRIMARY Wish per user.

Reservation and redemption require explicit user confirmation and atomic Reward Ledger settlement.

Reward Credit cannot be transferred, traded, sold, or cashed out.

---

# 10. Milestone / Achievement architecture freeze

Milestone is a **recognition layer**, not a new source of Growth Truth.

It may recognize:

- verified Mastery thresholds;
- durable Artifact milestones;
- major Quest/Boss completion;
- successful Strategy replication;
- completed Seasons;
- independently confirmed real-world achievements.

Do not reward App-use metrics such as opens, clicks, login streaks, or micro-task counts.

AI may produce a Milestone candidate through `OuterLoopProposal`; it cannot directly commit a confirmed Milestone.

Canonical Milestone records should distinguish at least:

```text
CORE_VERIFIED
USER_CONFIRMED_REAL_WORLD
```

If an underlying source is invalidated, the Milestone is corrected/revoked audibly; it is not deleted from history.

Reward issuance from a Milestone must use the same canonical source-deduplication policy as all other Reward grants so the same underlying event cannot be rewarded twice through multiple wrappers.

Rarity, if used, is derived from significance/verification strength, never difficulty of farming counts.

---

# 11. Optional Phase 8G boundary

## Focus

Focus is an action utility. Time logged in Focus can become contextual Activity metadata but never direct XP/Reward Credit.

## Growth Protocols

Protocols are versioned reusable execution templates. They may reference supported Strategies, Quest templates, evidence requirements, and review prompts. They are not Skill/Mastery truth.

## Past Self

Past Self is a derived comparison view, not a persistent domain.

It may compare non-farmable or explainable metrics such as:

- Verified Mastery;
- durable Artifact output/reuse;
- high-value Growth events;
- Main Quest progress;
- low-value Activity ratio;
- Strategy replication;
- Knowledge expansion.

It must not claim progress merely because raw task count increased.

---

# 12. Cross-entity relationship freeze

Canonical direction:

```text
Quest <---- N:N ---- Season
                     |
                     +---- 1:N ---- SeasonReview
                     |
                     +---- 0:N ---- JournalEntry (contextual association)
                     |
                     +---- N:N ---- StrategySupport

Growth Core --------> Review aggregation
Growth Core --------> Strategy support references
Growth Core --------> Milestone recognition
Growth Core --------> Reward eligibility source

Journal ------------> Review context
Journal ------------> Strategy hypothesis context
Journal -X----------> Verified Evidence direct conversion

Strategy -----------> optional later Protocol
Milestone ----------> optional Reward eligibility
Wish <-------------- Reward reservation/redemption
```

All arrows from Outer Loop to frozen Core are references/reads, not authority writes.

---

# 13. Common AI proposal contract

Prefer one common proposal envelope instead of proliferating separate AI-authority tables.

Candidate structure:

```text
OuterLoopProposal
- id
- user_id
- proposal_type
- schema_version
- source_refs
- model_metadata / prompt_contract_version
- payload
- status: PROPOSED | ACCEPTED | EDITED | REJECTED | EXPIRED
- created_at
- reviewed_at
- resulting_entity_type / resulting_entity_id (nullable)
```

Allowed proposal types may include:

```text
SEASON_PLAN
SEASON_ADJUSTMENT
REVIEW_SUMMARY
JOURNAL_INSIGHT
STRATEGY_HYPOTHESIS
STRATEGY_COUNTEREVIDENCE_ALERT
WISH_COST_SUGGESTION
MILESTONE_CANDIDATE
PROTOCOL_SUGGESTION
```

Canonical flow:

```text
AI Proposal
  ↓
Preview
  ↓
User Confirm / Edit / Reject
  ↓
Deterministic Validation
  ↓
Atomic Domain Commit
  ↓
Audit Record
```

Forbidden:

```text
LLM output -> direct INSERT/UPDATE of authoritative domain state
```

---

# 14. Security / ownership / RLS freeze

Every persistent Phase 8 entity must be tenant-owned.

Required:

- `user_id` on all user-owned records;
- RLS `auth.uid() = user_id` or stronger fail-closed equivalent;
- no client-trusted ownership fields;
- cross-entity links must prove both ends belong to the same user;
- join tables should carry user ownership explicitly when useful for RLS clarity;
- service/RPC paths must repeat ownership validation rather than relying on UI;
- foreign references must return non-disclosing behavior consistent with existing project conventions;
- AI providers never receive service-role database credentials;
- Reward reservation/redemption and single-active-Season transitions require transactional/locking semantics;
- replay/double-submit tests are mandatory.

Any cross-tenant reference that can be forged by an authenticated user is a P0.

---

# 15. Deletion, archival, and provenance freeze

Default rule: history-bearing Outer Loop records are archived/corrected, not destructively deleted.

## Season

- DRAFT/PLANNED may be hard-deleted only if never activated and no dependent historical records exist.
- ACTIVE or terminal Season: no normal hard delete.

## Review

- finalized review is immutable/versioned;
- correction creates a superseding version.

## Journal

- user may archive;
- normal edits must be auditable;
- if referenced by finalized historical objects, deletion must preserve a tombstone/reference-safe history rather than dangling provenance.

## Strategy

- retire or version; do not erase validation history.

## Reward Ledger

- immutable append-only; never delete/edit transactions.

## Wish

- archive/cancel; a redeemed Wish must remain auditable.

## Milestone

- revoke/correct; do not erase recognition history after reward linkage.

Account-wide legal/privacy deletion is a separate system-level concern and must not be confused with normal product delete semantics.

---

# 16. Idempotency and concurrency freeze

Every state-changing mutation must have deterministic retry behavior.

Minimum requirements:

- unique request/idempotency key for externally retried commit operations;
- compare-and-set or equivalent transition guard for lifecycle changes;
- at most one ACTIVE Season enforced transactionally;
- one MAIN Quest per Season enforced structurally;
- at most one PRIMARY Wish enforced structurally;
- Reward EARN unique source key;
- Reward reserve/redeem protected against double submit;
- Strategy support insertion deduplicated by source identity;
- final Review creation/finalization retry-safe;
- stale client state cannot overwrite newer terminal state;
- failure between domain mutation and audit/ledger mutation must roll back atomically where they are one settlement.

Unknown ancestry/state or impossible transitions fail closed; do not silently coerce them into success.

---

# 17. Database plan constraints

Phase 8A produces schema plans only. No migration is authorized.

Expected candidate table boundary after architecture review:

```text
outer_loop_proposals
outer_loop_audit_events

seasons
season_quests
season_reviews

journal_entries

strategies
strategy_versions        # optional if version table chosen
strategy_supports

reward_accounts
reward_transactions
wishes
reward_redemptions

milestones

# Phase 8G only
growth_protocols
protocol_versions
focus_sessions
```

Explicitly avoid initial tables:

```text
goals
past_self
streaks
journal_evidence
xp_wallet
reward_marketplace
```

The Phase 8A schema document must specify for every proposed table:

- purpose and authority class;
- primary/foreign keys;
- `user_id` ownership;
- required unique/partial unique constraints;
- lifecycle fields;
- immutable fields;
- timestamps;
- indexes;
- FK delete behavior;
- RLS policy intent;
- correction/versioning behavior;
- whether writes are direct repository writes or RPC-only;
- migration order.

---

# 18. API / RPC architecture constraints

Phase 8A may design contracts, not implement routes.

Every planned write API/RPC must specify:

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

High-risk operations should be RPC/transaction-bound where atomicity matters, including:

- Season activation/terminalization;
- Reward grant correction;
- Wish reserve/unreserve/redeem;
- Milestone confirmation when it issues Reward;
- any multi-record Strategy support/status settlement.

---

# 19. Information architecture freeze target

Avoid unlimited top-level navigation growth.

Conceptual IA target:

```text
Dashboard

Growth
  - Quests
  - Skills
  - Knowledge
  - Artifacts

Journey
  - Seasons
  - Reviews
  - Journal
  - Playbook

Rewards
  - Wishes
  - Milestones
```

Constraints:

- Dashboard remains the primary "now / next / recent real growth" surface.
- Focus is a global action/tool, not a required first-level page.
- Past Self is a Dashboard/Review analysis view, not primary navigation.
- Protocols live under Playbook/Journey, not as a new top-level section.
- Existing Growth pages remain semantically frozen; navigation restructuring, if later authorized, must not rewrite their authority semantics.
- UI must remain mature, restrained, ink-wash/light-first, RPG-flavored without mobile-game reward pollution.

---

# 20. Required Phase 8A documentation package

The execution AI must create a **docs-only** Phase 8A branch from exactly the current authorized baseline and produce:

```text
docs/Phase8/
├── 00_PHASE8_MASTER_ROADMAP.md
├── 01_OUTER_LOOP_DOMAIN_MODEL.md
├── 02_OUTER_LOOP_AUTHORITY_RULES.md
├── 03_SEASON_AND_REVIEW_SPEC.md
├── 04_JOURNAL_AND_STATE_SPEC.md
├── 05_STRATEGY_PLAYBOOK_SPEC.md
├── 06_REWARD_ECONOMY_AND_WISHES_SPEC.md
├── 07_MILESTONE_ACHIEVEMENT_SPEC.md
├── 08_AI_GM_OUTER_LOOP_CONTRACT.md
├── 09_DATABASE_SCHEMA_PLAN.md
├── 10_API_AND_RPC_CONTRACT_PLAN.md
├── 11_TESTING_SECURITY_AND_HARNESS_PLAN.md
├── 12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md
└── ADR/
```

`00_PHASE8_MASTER_ROADMAP.md` must preserve the user's product intent while updating stale Phase 6/7 status and adopting the binding stage order in this document.

ADRs are required only for genuinely unresolved design choices or any proposed deviation from this control. An ADR is not permission to violate a frozen invariant; deviations remain blocked until independent approval.

Do not update `MASTER_PROJECT_HANDOFF.md`, system rules, production docs, or existing freeze records inside this Phase 8A authoring PR unless independently re-authorized. Final handoff synchronization is a separate post-freeze docs task.

---

# 21. Phase 8A testing / harness plan requirements

The Phase 8A docs must define future tests before implementation.

Minimum deterministic harness catalogue:

```text
O001_XP_NEVER_SPENDABLE
O002_REWARD_LEDGER_ISOLATED
O003_MICRO_TASK_FARMING_BLOCKED
O004_DUPLICATE_REWARD_BLOCKED
O005_REWARD_REVERSAL_IS_CORRECTION
O006_SEASON_END_DOES_NOT_REWRITE_GROWTH
O007_JOURNAL_NOT_EVIDENCE_BY_DEFAULT
O008_AI_CANNOT_COMMIT_STRATEGY
O009_STRATEGY_REQUIRES_CROSS_TIME_SUPPORT
O010_PAST_SELF_IS_DERIVED_NON_FARMABLE
O011_FOCUS_TIME_NOT_DIRECT_XP_OR_REWARD
O012_MILESTONES_PRIORITIZE_REAL_GROWTH
O013_ONLY_ONE_ACTIVE_SEASON_PER_USER
O014_SEASON_QUEST_IS_N_TO_N
O015_SEASON_DOES_NOT_COMPLETE_QUEST
O016_REVIEW_DOES_NOT_CREATE_GROWTH_TRUTH
O017_STRATEGY_CONFIDENCE_IS_DETERMINISTIC_DERIVED
O018_CROSS_TENANT_OUTER_LINKS_FAIL_CLOSED
O019_WISH_REDEEM_IS_IDEMPOTENT_ATOMIC
O020_REWARD_CORRECTION_PRESERVES_LEDGER_HISTORY
O021_AI_PROPOSAL_REQUIRES_CONFIRM_BEFORE_COMMIT
O022_TERMINAL_SEASON_HISTORY_NOT_HARD_DELETED
```

Future test layers must include:

### Unit
- state machines;
- policy functions;
- confidence derivation;
- eligibility rules;
- derived view functions.

### Integration
- DB constraints;
- RPC atomicity;
- RLS/cross-tenant isolation;
- idempotency/replay;
- correction/versioning.

### E2E
- Season lifecycle;
- Review workflow;
- Journal context;
- Strategy proposal->support->status;
- Reward earn->reserve->redeem->correction;
- Milestone recognition;
- mobile + desktop;
- failure recovery/double submit.

### Adversarial
- reward farming;
- duplicate grants;
- forged source IDs;
- cross-user links;
- stale transitions;
- AI malformed proposals;
- direct client balance tampering;
- partial settlement;
- replay;
- backdated manipulation;
- attempt to convert Journal/Focus time directly into XP/Mastery.

---

# 22. Phase 8A execution scope

The Phase 8A authoring PR is docs-only.

Authorized paths:

```text
docs/Phase8/**
```

No other path is authorized by default.

Forbidden paths include, but are not limited to:

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
docs/DesignSystem/**   # except this controlling review branch, not execution PR
```

The execution AI must not "prepare" schema, API, components, routes, navigation, or feature flags while writing architecture docs.

---

# 23. Execution procedure

Execution AI must:

1. fetch current repository state;
2. verify `main` is still the independently authorized baseline or report drift before authoring;
3. read this controlling document completely;
4. read the source roadmap and authoritative Core docs;
5. create one Phase 8A docs branch from the exact base;
6. create the full `docs/Phase8/**` architecture package;
7. ensure all decisions are internally consistent and every entity has authority/lifecycle/ownership/deletion/idempotency rules;
8. run docs-level repository gates normally triggered by the repository;
9. open a PR to `main`;
10. do not merge;
11. return exact-head evidence to the independent Gatekeeper.

Suggested branch:

```text
docs/phase8a-outer-loop-architecture-freeze
```

Suggested PR title:

```text
docs(phase8a): freeze Outer Growth Loop architecture
```

---

# 24. Required execution report

Return:

```text
PHASE 8A ARCHITECTURE PACKAGE:
COMPLETE / INCOMPLETE

BASE SHA:
<sha>

EXACT HEAD SHA:
<sha>

PR:
<number / state>

CHANGED FILES:
<complete list>

DOCS-ONLY SCOPE:
PASS / FAIL

CORE SEMANTICS MODIFIED:
NO / YES

PHASE 7 REOPENED:
NO / YES

PHASE 8 PRODUCTION IMPLEMENTATION STARTED:
NO / YES

DOMAIN MODEL:
COMPLETE / INCOMPLETE

AUTHORITY MATRIX:
COMPLETE / INCOMPLETE

STATE MACHINES:
COMPLETE / INCOMPLETE

OWNERSHIP / RLS PLAN:
COMPLETE / INCOMPLETE

IDEMPOTENCY / CORRECTION PLAN:
COMPLETE / INCOMPLETE

REWARD LEDGER SPEC:
COMPLETE / INCOMPLETE

AI PROPOSAL CONTRACT:
COMPLETE / INCOMPLETE

TEST / ADVERSARIAL PLAN:
COMPLETE / INCOMPLETE

UNRESOLVED ADRs:
<list or NONE>

EXACT-HEAD CI:
<run id / status / conclusion>

MERGE PERFORMED:
NO
```

---

# 25. Independent acceptance gate

Phase 8A does not pass merely because documents exist.

The reviewer will verify the exact GitHub head and classify findings as P0/P1/P2.

## P0 examples

- any production/backend/migration/workflow/dependency implementation in Phase 8A;
- XP made spendable or coupled to Reward Credit;
- AI given direct permanent-state authority;
- Outer Loop allowed to rewrite Growth Truth;
- cross-tenant ownership model unsafe or undefined;
- Reward Ledger not isolated/append-only;
- destructive deletion that erases settlement/provenance;
- duplicate/replay Reward issuance not fail-closed.

## P1 examples

- ambiguous domain ownership;
- missing state-machine transitions;
- unresolved correction/idempotency rules;
- Strategy can become supported from one observation;
- Journal can silently become Evidence;
- Season/Quest relationship contradicts the frozen N:N decision;
- a new Goal domain duplicates Quest;
- confidence treated as AI-authored truth;
- docs disagree on the binding Phase 8B→8G order;
- schema/API docs do not specify RLS/atomicity/deletion behavior.

## P2 examples

- terminology drift;
- stale roadmap status text;
- missing diagrams/cross-links;
- minor incomplete examples that do not create authority ambiguity.

Pre-8B authorization requires:

```text
P0 = 0
P1 = 0
P2 = 0

Phase 8A Architecture Freeze = FINAL FROZEN
Phase 7 = FINAL FROZEN — unchanged
Phase 8B implementation = explicitly authorized by independent reviewer
```

Until then:

```text
NO PHASE 8 PRODUCTION IMPLEMENTATION.
```

---

# 26. Final controlling decision

Phase 8 product direction is accepted for architecture development, with the following binding shape:

```text
Growth Core
   ↓
Season + Review
   ↓
Journal / State Context
   ↓
Strategy / Personal Playbook
   ↓
Next Season

Growth Core
   ↓
Milestone Eligibility / High-value Event
   ↓
Isolated Reward Ledger
   ↓
Wish
   ↓
Reality Reward
```

Supporting layers:

```text
Focus     = action utility
Protocol  = reusable execution template
Past Self = derived longitudinal feedback
AI        = proposal / interpretation layer only
```

This architecture intentionally prioritizes **truth, provenance, anti-gaming, and learning what works for the user** over adding more RPG mechanics.

**Phase 8A documentation work is now authorized. Phase 8 production implementation is not.**
