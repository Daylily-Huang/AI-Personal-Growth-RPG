# Phase 8C — Journal + State Context Implementation Controlling Document

> **Document Version**: 0.9 Draft
> **Date**: 2026-09-18
> **Status**: DRAFT — PENDING INDEPENDENT GATEKEEPER; PRODUCTION IMPLEMENTATION BLOCKED
> **Authority Level**: Phase-specific controlling draft for Phase 8C implementation
> **Frozen Phase 8A Architecture Package**: `docs/Phase8/00_PHASE8_MASTER_ROADMAP.md` through `docs/Phase8/12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md`
> **Phase 8B Accepted Implementation Merge**: `0e4bec5f26411669f7031af4523b6d4fca747f96`
> **Phase 8C Exact Implementation Entry Baseline**: `7df500b1c764efd247938dcf3da4e83b6e2e8e45`
> **Required Review Outcome Before Implementation**: `P0 = 0 / P1 = 0 / P2 = 0 + GO`

---

## 1. Purpose and Authority

This document translates the frozen Phase 8 architecture into a bounded implementation contract for **Phase 8C — Journal + State Context only**.

It does not reopen Phase 1–7 Growth Core rules, Phase 8B Season/Review authority, or any later Phase 8D–8G subsystem.

This draft is **not implementation authorization**. Production work remains blocked until an independent Gatekeeper reviews this exact controlling document against the repository baseline and returns:

```text
P0 = 0
P1 = 0
P2 = 0
GO
```

If implementation convenience, stale documentation, or current code conflicts with this controlling document or the frozen Phase 8 architecture package, the implementation must fail closed and use project change control rather than silently redefining the contract.

---

## 2. Baseline and Entry Gate

### 2.1 Phase 8B prerequisite

`12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md` requires Phase 8B to be accepted and merged before Phase 8C.

That prerequisite is satisfied:

- Phase 8B is recorded as **FINAL FROZEN**.
- Accepted Phase 8B implementation merge: `0e4bec5f26411669f7031af4523b6d4fca747f96`.
- Current `main` / `origin/main` baseline: `7df500b1c764efd247938dcf3da4e83b6e2e8e45`.
- `0e4bec5...` is an ancestor of `7df500b...`.
- No Phase 8C production implementation was detected under `src/`, `supabase/`, or `tests/` at this baseline.

### 2.2 Immutable implementation entry baseline

The Phase 8C implementation branch must descend from:

```text
7df500b1c764efd247938dcf3da4e83b6e2e8e45
```

Any later baseline substitution must be explicitly recorded and independently re-reviewed before production implementation begins.

### 2.3 Gatekeeper entry rule

Even though the dependency gate is satisfied, production implementation remains **BLOCKED** until this controlling document itself is independently accepted.

The author of this draft must not self-certify the final Gatekeeper result.

---

## 3. Independent Architecture Review Findings

The existing Phase 8 package is internally coherent on the major Journal/State boundaries, but three implementation ambiguities require explicit control.

### 3.1 Canonical Phase 8C shape is one table

The frozen architecture explicitly defines one canonical entity:

```text
journal_entries
```

A separate State table is rejected for initial Phase 8. The seven subjective state dimensions are nullable attributes on `journal_entries`.

**Controlling resolution**: Phase 8C may create exactly one new Phase 8C domain table: `journal_entries`.

### 3.2 O011 identifier conflict

`04_JOURNAL_AND_STATE_SPEC.md` names:

```text
O011_TEMPORARY_STATE_NOT_CAPABILITY
```

and `12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md` lists O007/O011/O018 as the Phase 8C exit gate.

However, the canonical numbered harness in `11_TESTING_SECURITY_AND_HARNESS_PLAN.md` defines:

```text
O011_FOCUS_TIME_NOT_DIRECT_XP_OR_REWARD
```

for the later Focus subsystem.

**Controlling resolution**:

- Do not renumber or rewrite the frozen canonical O011.
- Phase 8C keeps canonical **O007** and **O018**.
- Phase 8C adds the supplemental acceptance assertion:

```text
C011_JOURNAL_STATE_NOT_CAPABILITY
```

This supplemental test implements the O11 invariant for Journal/State without corrupting the frozen numbered harness.

Changing frozen O-test numbering requires separate change control / ADR.

### 3.3 Hard-delete contract is not sufficiently closed

`04_JOURNAL_AND_STATE_SPEC.md` and `09_DATABASE_SCHEMA_PLAN.md` describe hard delete as conditional on the Journal row being unreferenced by finalized Review / Strategy support history.

At the Phase 8C boundary:

- the frozen `journal_entries` schema contains no finalized-review FK;
- `StrategySupport` belongs to Phase 8D;
- normal API write authority in `10_API_AND_RPC_CONTRACT_PLAN.md` lists INSERT, UPDATE, and soft-delete/archive only.

**Controlling resolution**:

- The normal Phase 8C product deletion path is **archive only**: `is_archived = true`.
- A user-facing hard-delete endpoint or UI is **not required and not authorized by this Phase 8C DoD**.
- The underlying table may retain the frozen tenant-scoped DELETE RLS policy, but implementation must not invent incomplete finalized-reference logic.
- Any future product hard-delete flow requires explicit referential analysis and change control before it becomes an accepted contract.

### 3.4 WEEKLY_REFLECTION mentions a Review link that does not exist in the schema

The taxonomy describes `WEEKLY_REFLECTION` as typically having a Season link and Review link, but the frozen Phase 8C table has only:

- `season_id`
- `quest_id`
- `activity_id`

There is no `season_review_id` / `review_id` field.

**Controlling resolution**:

- Do not add a Review FK in Phase 8C.
- A weekly reflection may use `season_id` as available context.
- Adding a direct Review FK is a schema-contract change and requires explicit change control.

### 3.5 AI insight is advisory; Strategy remains Phase 8D

The frozen architecture permits `JOURNAL_INSIGHT` proposals and pattern analysis, but Strategy entities and StrategySupport belong to Phase 8D.

**Controlling resolution**:

- Phase 8C may expose read-only/advisory Journal insight behavior.
- Phase 8C must not create, transition, version, or support Strategy records.
- AI integration is optional for Phase 8C completion and is not a prerequisite for the core Journal/State exit gate.

---

## 4. Non-Negotiable Invariants

All Phase 8C implementation must preserve:

1. **Time is not XP.**
2. **XP is not Mastery.**
3. **High Mastery requires Verified Evidence.**
4. **JournalEntry != Verified Evidence.**
5. **Temporary state is not permanent capability.**
6. **State scalars have zero mathematical or programmatic coupling to XP, Skill level, Mastery, Evidence eligibility, Quest status, or permanent character stats.**
7. **Outer Loop cannot mutate historical Growth Core truth.**
8. **AI is proposal/advisory authority only and never receives direct database authority.**
9. **Journal content is private by default and tenant-isolated fail closed.**
10. **No reward, streak, shame, punitive state penalty, or mood-based stat mechanic may be introduced.**

No implementation detail may weaken these invariants.

---

## 5. Authorized Phase 8C Scope

Only the following production scope is authorized after Gatekeeper acceptance.

### 5.1 Database schema — exactly one new table

Phase 8C may create:

```text
journal_entries
```

Required logical fields:

| Field | Contract |
| --- | --- |
| `id` | UUID primary key; DB default allowed; client-generated UUID supported for optimistic creation |
| `user_id` | non-null tenant owner; references `auth.users(id) ON DELETE CASCADE` |
| `entry_type` | canonical Journal taxonomy discriminator |
| `title` | Journal title text |
| `content_markdown` | user-authored Journal content |
| `energy` | nullable integer 1..5 |
| `focus` | nullable integer 1..5 |
| `stress` | nullable integer 1..5 |
| `resistance` | nullable integer 1..5 |
| `recovery` | nullable integer 1..5 |
| `mood_valence` | nullable integer -2..2 |
| `self_confidence` | nullable integer 1..5; subjective only |
| `season_id` | nullable FK to `seasons(id) ON DELETE SET NULL` |
| `quest_id` | nullable FK to `quests(id) ON DELETE SET NULL` |
| `activity_id` | nullable FK to `activities(id) ON DELETE SET NULL` |
| `is_archived` | non-null boolean, default false |
| `logged_at` | non-null timestamptz, default current clock time |
| `created_at` | non-null timestamptz, immutable |
| `updated_at` | non-null timestamptz, updated deterministically on edits |

Required indexes:

```text
idx_journal_user_logged (user_id, logged_at DESC)
idx_journal_season (season_id)
```

No second Journal/State domain table is authorized.

### 5.2 Canonical entry taxonomy

The accepted `entry_type` set is:

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

The database must reject values outside this taxonomy.

Explicit context requirements from the frozen Journal specification must be deterministically enforced:

- `QUEST_REFLECTION` requires non-null `quest_id`.
- `SEASON_REFLECTION` requires non-null `season_id`.
- `FAILURE_POSTMORTEM` requires at least one of `quest_id` or `season_id`.

The implementation must not add a Review FK to satisfy descriptive text in the taxonomy.

### 5.3 Subjective state constraints

All seven state fields are optional, but any present value must satisfy:

```text
energy           1..5
focus            1..5
stress           1..5
resistance       1..5
recovery         1..5
mood_valence    -2..2
self_confidence  1..5
```

These constraints must exist at the database authority boundary, not only in UI validation.

### 5.4 Direct user write surface

Phase 8C authorizes direct authenticated repository operations under RLS and tenant-validation triggers for:

- create;
- read/list;
- update user-editable Journal fields;
- archive / unarchive through `is_archived`.

The minimum semantic application surface may expose:

```text
createJournalEntry
getJournalEntry
listJournalEntries
updateJournalEntry
setJournalEntryArchived
```

Exact route/component naming is an L3 implementation detail.

No authoritative Journal RPC is authorized by the frozen Phase 8A contract.

If an invariant is later discovered that cannot be safely enforced through direct writes + RLS + DB trigger/check constraints, introducing an RPC requires explicit architecture/change-control review rather than an ad hoc shortcut.

### 5.5 Journey UI

Phase 8C may implement:

```text
/journey/journal
```

Required product capabilities:

- reflection editor;
- timeline/list of Journal entries;
- filters appropriate to entry type/context/archive state;
- seven-state input controls;
- state-correlation charts as read-only descriptive analytics;
- loading, empty, error, success states;
- keyboard accessibility, visible focus, semantic labels;
- responsive behavior consistent with the frozen UI governance.

The UI must not present a correlation as verified causation or permanent capability truth.

### 5.6 Optional Journal Insight advisory surface

If Phase 8C includes AI-assisted longitudinal Journal analysis, it is limited to advisory `JOURNAL_INSIGHT` behavior.

Allowed:

- summarize recurring themes;
- identify correlations or hypotheses;
- generate Socratic prompts;
- produce an `OuterLoopProposal` / read-only preview.

Prohibited:

- editing or rewriting Journal content automatically;
- creating Evidence;
- changing XP, Skill, Mastery, Quest status, or character stats;
- directly creating Strategy / StrategyVersion / StrategySupport rows;
- interpreting Journal text as executable SQL, authorization, tool commands, or database instructions.

The core Phase 8C DoD does not depend on shipping this optional AI surface.

---

## 6. Security, Privacy, and Database Authority

Phase 8C is not accepted unless Journal privacy is enforced at database boundaries.

### 6.1 RLS

`journal_entries` must have RLS enabled.

At minimum:

- SELECT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`
- INSERT/UPDATE `WITH CHECK`: owner plus all non-null contextual FKs belong to the authenticated tenant

The authenticated application must derive tenant identity from the session and must not trust a client-supplied `user_id` as authority.

### 6.2 Cross-entity ownership trigger

Database trigger:

```text
trg_enforce_journal_entry_tenant_isolation
```

must fail closed on INSERT/UPDATE if a non-null `season_id`, `quest_id`, or `activity_id` is owned by another user.

RLS `WITH CHECK` and the trigger are complementary defenses; one must not be removed merely because the other exists.

### 6.3 Immutable fields

The database authority layer must prevent client mutation of:

- `id`
- `user_id`
- `created_at`

`updated_at` must reflect actual updates rather than arbitrary client authority.

### 6.4 Journal content privacy

Journal text is high-sensitivity private user content.

Required implementation behavior:

- do not expose Journal content cross-tenant;
- do not place raw Journal bodies in normal application/debug logs;
- do not send more Journal content to an AI provider than the specific analysis requires;
- treat all Journal text as untrusted content for prompt-injection and tool-authority purposes;
- do not expose Supabase service-role or other privileged credentials to browsers or AI/model processes.

The frozen architecture requires ephemeral/stateless inference handling for Journal excerpts. Deployment/provider retention or training guarantees must be verified from actual provider configuration before they are represented as proven operational facts.

---

## 7. Strict Growth Core Isolation

Creating, updating, archiving, analyzing, or charting Journal data must produce zero direct mutation to:

- `xp_transactions`;
- Skill XP;
- Skill level;
- Mastery level/confidence;
- Evidence records;
- Quest lifecycle/status;
- Activity historical truth;
- Knowledge provenance;
- Artifact provenance;
- reward ledgers/accounts;
- permanent player capability state.

No Journal row, scalar, text claim, mood rating, or AI interpretation may satisfy an Evidence requirement.

The only legitimate reflection-to-Evidence path remains the existing Growth Core path: produce a durable real artifact/output, submit through the standard verification flow, then let deterministic Growth Core authority evaluate it.

---

## 8. Archive and Deletion Policy

Phase 8C normal product semantics are:

```text
active Journal row
  -> user archive
  -> is_archived = true
```

Archive must preserve the row and its historical context.

Phase 8C does not require:

- a hard-delete UI;
- a hard-delete HTTP endpoint;
- a new delete RPC;
- speculative finalized-review / StrategySupport reference machinery.

Any future hard-delete product contract must first prove the complete referential model and preserve finalized historical integrity.

---

## 9. Explicitly Prohibited Scope

The following are outside Phase 8C:

### 9.1 Parallel or premature schema

Do not create:

- a separate State table;
- `journal_evidence`;
- a Journal-to-Evidence bridge;
- `review_id` / `season_review_id` on `journal_entries` without change control;
- Strategy tables;
- Reward/Wish tables;
- Milestone tables;
- Focus Session tables;
- Protocol tables.

### 9.2 Phase 8D–8G functionality

Do not implement:

- Strategy lifecycle or Personal Playbook;
- Strategy support/promotion;
- reward minting, reservation, redemption, refund;
- wishes;
- milestones;
- focus sessions;
- growth protocols;
- Past Self capability mutation.

### 9.3 Growth Core side effects

Do not add Journal-triggered:

- XP grants or deductions;
- mood/energy XP multipliers;
- Mastery promotion/demotion;
- automatic Evidence;
- Quest completion/failure;
- permanent character-stat changes.

---

## 10. Required Phase 8C Acceptance Tests

Phase 8C cannot be declared complete until all required database/security/application assertions pass.

### 10.1 Canonical frozen tests

#### O007 — `O007_JOURNAL_NOT_EVIDENCE_BY_DEFAULT`

Creating a Journal entry that claims mastery, including high `self_confidence`, must leave Evidence and Mastery unchanged.

#### O018 — `O018_CROSS_TENANT_OUTER_LINKS_FAIL_CLOSED`

For the Phase 8C surface, User A must be unable to create/update a Journal row that references User B's Season, Quest, or Activity; cross-tenant reads/updates/deletes must also fail closed.

### 10.2 Supplemental Phase 8C test

#### C011 — `C011_JOURNAL_STATE_NOT_CAPABILITY`

Creating/updating Journal state values, including boundary/extreme values such as:

```text
energy = 1
stress = 5
mood_valence = -2
self_confidence = 5
```

must create zero changes in:

- XP ledger;
- Skill XP/level;
- Mastery;
- Evidence;
- Quest status;
- permanent player capability state.

This test fulfills the Journal-specific O11 invariant without reusing the canonical O011 identifier already assigned to Focus Time in the frozen harness.

### 10.3 Required database and domain tests

At minimum, Phase 8C acceptance must also cover:

- all nine canonical `entry_type` values accepted;
- unknown `entry_type` rejected;
- scalar lower/upper boundaries accepted;
- out-of-range scalar values rejected by the database;
- `QUEST_REFLECTION` without `quest_id` rejected;
- `SEASON_REFLECTION` without `season_id` rejected;
- `FAILURE_POSTMORTEM` without Quest or Season rejected;
- forged cross-tenant `season_id`, `quest_id`, and `activity_id` each rejected;
- `id`, `user_id`, and `created_at` client mutation rejected;
- archive/unarchive permitted only for owner;
- client-generated UUID creation behaves deterministically and duplicate PK insertion does not duplicate rows;
- Journal write/archive operations leave Growth Core snapshots unchanged.

### 10.4 Optional AI path tests

Only if `JOURNAL_INSIGHT` production integration is included in Phase 8C:

- AI output cannot directly modify a Journal row;
- AI output cannot create Evidence;
- AI output cannot create Strategy records;
- model-produced SQL/tool-like instructions are treated as untrusted text;
- raw Journal content is not emitted to normal application logs;
- proposal preview/review behavior preserves user control.

---

## 11. Binding Implementation Sequence

Implementation must proceed in bounded rounds after Gatekeeper GO.

### Round 1 — Schema, constraints, RLS, tenant trigger

- add only `journal_entries`;
- add taxonomy and scalar CHECK constraints;
- add required context-link constraints;
- add FK delete behavior and indexes;
- add immutable-field/update timestamp guards;
- enable RLS and fail-closed ownership policies;
- add `trg_enforce_journal_entry_tenant_isolation`;
- add real database-backed negative tenant tests.

Round 1 must pass before application write adapters begin.

### Round 2 — Repository/API/domain validation

- implement authenticated create/read/list/update/archive operations;
- derive tenant identity from auth;
- preserve client-generated UUID support;
- expose no Journal lifecycle RPC;
- map validation/ownership failures consistently;
- add O007, O018, C011 and domain-contract tests.

### Round 3 — Journey Journal UI

- implement `/journey/journal`;
- add reflection editor, timeline/list, state controls, filters, archive flow, and descriptive charts;
- add Journey navigation only for the Journal surface authorized here;
- verify loading/empty/error states, keyboard behavior, responsive layouts, and long private text handling.

### Round 4 — Optional Journal Insight

This round may be omitted.

If included:

- implement advisory `JOURNAL_INSIGHT` only;
- preserve the unified proposal boundary;
- do not create Strategy state;
- add prompt-injection/privacy/no-write tests.

### Round 5 — Exit verification and freeze candidate

- run O007, O018, and C011;
- run all Phase 8C database/RLS/trigger/domain tests;
- run existing Growth Core regression suite;
- run deterministic Growth Engine harness;
- run lint, production build, and relevant E2E;
- record exact implementation Head SHA and CI run evidence;
- submit the exact implementation head to an independent Gatekeeper.

---

## 12. Change Control

The following require an ADR/change-control review and independent approval before implementation:

- adding a second Phase 8C domain table;
- adding a Journal-to-Evidence conversion path;
- adding a Review FK to `journal_entries`;
- introducing an authoritative Journal RPC;
- adding hard-delete product behavior beyond the bounded archive contract;
- coupling any Journal/state value to XP, Mastery, Evidence, Quest state, rewards, or permanent character stats;
- allowing AI to write Journal or Strategy domain state directly;
- implementing Phase 8D–8G capability early;
- renumbering or redefining the frozen O-test identifiers;
- relaxing RLS, tenant triggers, or immutable-field protection.

L3 implementation details that preserve the frozen contract may be decided by the implementer and reviewed normally.

---

## 13. Definition of Done for Phase 8C

Phase 8C may be declared **FINAL FROZEN** only when all of the following are true:

1. Exactly one Phase 8C domain table, `journal_entries`, is added; no prohibited scope leaks in.
2. Canonical taxonomy, context requirements, scalar ranges, immutable fields, indexes, and FK behavior are enforced.
3. RLS and `trg_enforce_journal_entry_tenant_isolation` pass real cross-tenant negative tests.
4. O007 and O018 pass.
5. Supplemental C011 passes and proves temporary Journal state cannot mutate permanent capability.
6. Normal deletion UX uses archive semantics; no unsupported hard-delete product contract is introduced.
7. `/journey/journal` is functional, private, accessible, responsive, and has loading/empty/error handling.
8. Optional AI behavior, if shipped, remains advisory/proposal-only and creates no Strategy/Growth Core truth.
9. Existing Growth Core tests and deterministic harness remain green.
10. Lint, production build, relevant E2E, and database-backed Phase 8C tests are green.
11. Exact implementation Head SHA and CI run IDs are recorded.
12. Independent implementation Gatekeeper reports `P0 = 0 / P1 = 0 / P2 = 0 + GO`.
13. The accepted Phase 8C implementation is merged before Phase 8D begins.

---

## 14. Authorization Statement

**BLOCKED / PENDING GATEKEEPER**: this document is a Phase 8C controlling **draft**, not an active production implementation authorization.

Phase 8C production implementation may begin only after a separate independent Gatekeeper reviews this exact document and records:

```text
P0 = 0 / P1 = 0 / P2 = 0 + GO
```

Once accepted, the authorization remains deliberately narrow: Journal + State Context only, with no redesign of Growth Core truth and no premature Phase 8D–8G authority.

---

## 15. Independent Gatekeeper Review Record

Pending.

The future reviewer must bind the verdict to:

- the exact controlling-document commit SHA;
- the exact implementation entry baseline;
- the frozen Phase 8 architecture package;
- all scope, security, O011-resolution, deletion, and AI-authority constraints in this document.

Until that record exists with `P0 = 0 / P1 = 0 / P2 = 0 + GO`, production implementation remains blocked.
