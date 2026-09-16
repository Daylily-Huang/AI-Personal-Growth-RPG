# Phase 8B — Season + Structured Review Implementation Controlling Document

> **Document Version**: 1.0  
> **Date**: 2026-09-16  
> **Status**: IMPLEMENTATION AUTHORIZED — SUBJECT TO THE ENTRY GATES AND SCOPE BELOW  
> **Authority Level**: Phase-specific controlling document for Phase 8B implementation  
> **Immutable Phase 8A Architecture Baseline**: `0dffb9d706c3c941c46078c89bf3ae6e70d65d5f`  
> **Required Round 0 Governance Overlay**: `c457944caf7bc12ab84033ea8a8d644cc1921e25`  
> **Round 0 CI Evidence**: GitHub Actions `CI` Run `35108208042` / Run #192 — `completed / success`  
> **Parent Architecture Package**: `docs/Phase8/00_PHASE8_MASTER_ROADMAP.md` through `docs/Phase8/12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md`

---

## 1. Purpose and Controlling Authority

This document is the explicit Phase 8B implementation authorization required by the Phase 8A architecture freeze.

It converts the frozen Phase 8A specifications into a bounded implementation mandate for **Season + Structured Review only**. It does not reopen Phase 1–7 frozen Growth Core behavior and it does not authorize Phase 8C–8G work.

If implementation code, an older roadmap, a stale handoff document, or an inferred convenience conflicts with this document or the Phase 8A architecture package, the implementation must fail closed and the conflict must be escalated through change control rather than silently resolved in code.

---

## 2. Baseline and Entry Gate

### 2.1 Immutable architecture baseline

The exact Phase 8A merge commit is:

```text
0dffb9d706c3c941c46078c89bf3ae6e70d65d5f
```

This SHA is the immutable Phase 8B **architecture baseline** and explicitly replaces the absent `v1.0-core` tag gate required by `12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md`.

Phase 8B implementation must preserve the contracts frozen at that commit unless a later, independently accepted ADR explicitly supersedes a named contract.

### 2.2 Required Round 0 governance overlay

Phase 8B implementation additionally requires the governance hardening commit:

```text
c457944caf7bc12ab84033ea8a8d644cc1921e25
```

The commit preserves historical Phase 5–7 UI governance while preventing backend-only Phase 8B work from being falsely rejected by historical UI-only guards. It also hardens rename, non-ASCII path, and path-separator handling.

Verified CI evidence for that exact commit:

- Workflow: `CI`
- Run: `35108208042` / Run #192
- Overall result: `completed / success`
- `check`: success (`Lint`, `Test`, `Build` all success)
- `supabase-integration`: success (`Build production app`, database-backed tests, deterministic Growth Engine harness, E2E all success)

### 2.3 Operational entry rule

Production implementation is authorized only on a branch whose ancestry contains the verified Round 0 governance overlay above, or on a future `main` state independently verified to contain an equivalent accepted merge of that overlay.

**Repository-state precision**: at the time this controlling document was authored, `main` / `origin/main` remained at the Phase 8A merge baseline `0dffb9d...`; the verified Round 0 overlay existed on the Phase 8B governance branch. This document does **not** falsely declare `c457944...` merged into `main`.

---

## 3. Non-Negotiable Invariants

All Phase 8B implementation must preserve the existing project invariants and the Phase 8 Outer Loop invariants. In particular:

1. **Time is not XP.**
2. **XP is not Mastery.**
3. **High Mastery requires verified Evidence.**
4. **Outer Loop cannot mutate historical Growth Core truth.**
5. **AI is proposal authority only; deterministic application/database code commits permanent state.**
6. **Season is not a streak.** A Season cannot auto-complete because time elapsed or because a user checked in repeatedly.
7. **Review does not create Growth Truth.** Review content cannot directly create XP, Evidence, Mastery, Skill advancement, Quest completion, or Activity history.
8. **Permanent mutations must be auditable and idempotent.**
9. **All user-private Phase 8B data must be tenant-isolated through fail-closed RLS and ownership validation.**
10. **No reward minting exists in Phase 8B.** Reward settlement remains Phase 8E authority.

---

## 4. Authorized Phase 8B Scope

Only the following production scope is authorized.

### 4.1 Database schema — exactly five Phase 8B tables

Migration implementation may create and secure:

1. `outer_loop_proposals`
2. `outer_loop_audit_events`
3. `seasons`
4. `season_quests`
5. `season_reviews`

Their columns, constraints, indexes, immutability rules, RLS intent, ownership semantics, idempotency identities, and migration ordering must conform to `09_DATABASE_SCHEMA_PLAN.md`.

Required migration order:

1. `outer_loop_proposals`
2. `outer_loop_audit_events`
3. `seasons`
4. `season_quests`
5. `season_reviews`

### 4.2 Season lifecycle

Authorized Season states:

```text
DRAFT
PLANNED
ACTIVE
COMPLETED
ENDED_EARLY
ABANDONED
CANCELLED
```

Required properties include:

- At most one `ACTIVE` Season per user.
- Activation is valid with zero linked Quests.
- Terminal Seasons are never reopened.
- A Season that has reached `ACTIVE` cannot be hard-deleted through normal client flows.
- Season completion does not complete, cancel, rewrite, or otherwise mutate linked Quests.
- Concluding a Season is a human-confirmed lifecycle operation, never a calendar/cron auto-transition.

### 4.3 Season-to-Quest relationship

`season_quests` is an N:N contextual relationship over the existing Quest system.

Authorized roles:

- `MAIN`: `0..1` per Season
- `FOCUS`: `0..N` per Season

The link is optional and never becomes a competing goal hierarchy. Direct client writes to `season_quests` are prohibited; link/unlink authority is RPC-only with fail-closed ownership verification for both Season and Quest.

### 4.4 Structured Review

Authorized review types:

- `WEEKLY`
- `AD_HOC`
- `FINAL`

Finalized review payloads are immutable versioned records. `superseded_by_id` is the sole system-managed one-time linkage mutation permitted on a prior review when a new version supersedes it.

For `COMPLETED` and `ENDED_EARLY`, an initial `FINAL` review must be committed atomically with Season conclusion. For `ABANDONED`, `p_abandonment_reason` is mandatory and **zero `season_reviews` rows are inserted**. Post-conclusion FINAL-review amendments apply only to `COMPLETED` / `ENDED_EARLY` Seasons and create a new immutable `FINAL` version without reopening or rewriting the terminal Season.

### 4.5 Derived Season activity read model

Phase 8B may implement a derived read model that presents Growth Core Activities in Season context.

**Hard boundary**: this authorization permits **zero schema changes to `activities`** and zero Outer Loop mutation of Activity truth.

### 4.6 AI proposal envelope and audit layer

Phase 8B may implement the `outer_loop_proposals` / `outer_loop_audit_events` infrastructure required for Season and Review proposals and state transitions.

AI-generated Season/Review content must follow:

```text
AI Proposal
  -> Preview
  -> User Accept / Edit / Reject
  -> Deterministic Validation
  -> Atomic Commit
  -> Audit Event
```

AI handlers must never directly write authoritative Season/Review state.

### 4.7 Authorized user interface

Phase 8B may implement:

- `/journey/seasons`
- `/journey/reviews`

UI work may include the components and client state strictly necessary to operate the authorized Season/Review flows. It must not introduce Phase 8C–8G product surfaces.

---

## 5. Authorized RPC / Transaction Boundary

The following Phase 8B transactional operations are authorized, subject to the exact contracts in `10_API_AND_RPC_CONTRACT_PLAN.md`:

- `rpc_plan_season`
- `rpc_activate_season`
- `rpc_conclude_season`
- `rpc_cancel_season`
- `rpc_finalize_season_review`
- `rpc_amend_final_season_review`
- `rpc_link_season_quest`
- `rpc_unlink_season_quest`
- `rpc_review_outer_loop_proposal`

The implementation must preserve the documented ownership checks, row locks / CAS semantics, replay behavior, idempotency keys, error taxonomy, and audit writes.

Direct client lifecycle-field mutation must not be used as a shortcut around these RPCs.

---

## 6. Security and Data Authority Requirements

Phase 8B is not accepted unless all of the following are enforced at database authority boundaries, not merely hidden in UI code:

1. RLS enabled for all five Phase 8B tables.
2. `user_id` tenant ownership is non-null and fail-closed.
3. Cross-tenant Season/Quest linking fails closed even if a caller forges IDs.
4. RPC-only tables deny direct client mutation.
5. Protected Season lifecycle columns cannot be directly mutated by clients.
6. Terminal history cannot be hard-deleted through normal API paths.
7. Review version allocation is serialized by locking the parent Season row.
8. Idempotent replay returns the previously committed result; conflicting replay does not duplicate state.
9. Audit events are append-only and cannot be client-edited or deleted.
10. No browser, AI provider, or model process receives Supabase service-role credentials.

---

## 7. Explicitly Prohibited Scope

The following work is **not authorized in Phase 8B**:

### 7.1 Growth Core mutation

No Phase 8B lifecycle, Review, proposal, or UI action may directly or indirectly mutate:

- `xp_transactions`
- Skill XP or Mastery state
- Evidence truth
- historical Activities
- Knowledge provenance
- Artifact provenance
- Quest completion/status as a side effect of Season completion

### 7.2 Reward economy

Do not implement or call Phase 8E reward settlement, including reward accounts, reward transactions, wishes, redemptions, credit minting, reservation, or refunds.

`rpc_conclude_season` must persist `COMPLETED` / `ENDED_EARLY` together with the required atomic FINAL Review **without minting reward credits**. `ABANDONED` must persist the abandonment reason + audit event with **zero FINAL Review rows inserted**, also without minting reward credits.

### 7.3 Future Phase 8 subsystems

Do not implement Phase 8C–8G entities or features, including:

- `journal_entries`
- strategies / strategy versions / strategy supports
- reward economy / wishes
- milestones
- focus sessions
- growth protocols / protocol versions

### 7.4 Rejected parallel concepts

Do not create:

- `goals`
- `past_self` storage table
- `streaks`
- `journal_evidence`
- `xp_wallet`
- reward marketplace / transfer system

---

## 8. Required Phase 8B Harness and Acceptance Tests

Phase 8B cannot be declared complete until the canonical Phase 8B exit set is implemented and passing:

- **O006 — `O006_SEASON_END_DOES_NOT_REWRITE_GROWTH`**
- **O013 — `O013_ONLY_ONE_ACTIVE_SEASON_PER_USER`**
- **O014 — `O014_SEASON_QUEST_IS_N_TO_N`**
- **O015 — `O015_SEASON_DOES_NOT_COMPLETE_QUEST`**
- **O016 — `O016_REVIEW_DOES_NOT_CREATE_GROWTH_TRUTH`**
- **O022 — `O022_TERMINAL_SEASON_HISTORY_NOT_HARD_DELETED`**

Acceptance must also cover at minimum:

- RLS cross-tenant negative tests for all five tables.
- Direct-write bypass attempts against RPC-owned tables/fields.
- Same-key idempotent replay and distinct-key conflict behavior.
- Concurrent activation attempts against the single-active-Season constraint.
- Concurrent Review finalization/amendment version allocation.
- `COMPLETED` / `ENDED_EARLY` conclusion + FINAL Review transaction atomicity, plus `ABANDONED` zero-review semantics.
- Proposal accept/edit/reject CAS behavior.
- Regression proof that Phase 1–7 Growth Core tests remain green.
- Existing deterministic Growth Engine harness remains green.
- Production build remains green.

---

## 9. Binding Implementation Sequence

To keep review surfaces small and prevent architecture drift, implementation should proceed in the following bounded rounds. A later round must not be used to conceal unresolved defects from an earlier round.

### Round 1 — Schema + RLS + database invariants

- Add the five authorized tables in the specified migration order.
- Add indexes, constraints, triggers, RLS, immutability and tenant-isolation guards.
- Add database-focused tests for O013/O014/O022 and cross-tenant/direct-write failures.

### Round 2 — Deterministic RPC authority

- Implement the authorized Season, Review, linking, and proposal-review RPCs.
- Prove locking, CAS, idempotency, audit, terminal-state and atomicity semantics.
- Implement O006/O015/O016 at the authority layer.

### Round 3 — Application read/write adapters and API surface

- Add repository/service/API bindings strictly around the authorized database contracts.
- Add the derived Season activity read model without modifying the `activities` schema.
- Preserve AI proposal-only authority.

### Round 4 — Journey UI

- Implement `/journey/seasons` and `/journey/reviews`.
- Preserve accessibility, responsive behavior, shared UI primitives, and existing AppShell governance.
- No Phase 8C–8G navigation or feature implementation.

### Round 5 — Exit verification and freeze candidate

- Run the complete O006/O013/O014/O015/O016/O022 exit set.
- Run required database/security tests, regression suite, deterministic harness, lint, typecheck/build, and E2E.
- Submit exact-head evidence for independent review.

---

## 10. Change Control

Any implementation proposal that requires one of the following is **blocked pending an ADR and independent Gatekeeper approval**:

- a sixth Phase 8B table;
- a new authoritative state not frozen in Phase 8A;
- mutation of a Phase 1–7 Growth Core table from Outer Loop lifecycle code;
- a new reward/XP coupling;
- a relaxation of RLS or tenant ownership;
- direct AI commit authority;
- removal or weakening of an O006/O013/O014/O015/O016/O022 assertion;
- changing the Phase 8A architecture baseline SHA;
- implementing any Phase 8C–8G capability early.

Bug fixes that preserve the frozen contract may proceed through normal review, but must include regression coverage proving the invariant remains fail-closed.

---

## 11. Definition of Done for Phase 8B

Phase 8B may be declared **FINAL FROZEN** only when all of the following are true:

1. All authorized Phase 8B scope is implemented; no prohibited scope has leaked in.
2. O006, O013, O014, O015, O016, and O022 are implemented and pass at runtime.
3. Database/RLS/idempotency/concurrency/security tests pass.
4. Phase 1–7 regression suite remains green.
5. Deterministic Growth Engine harness remains green.
6. Lint, type checking, production build, and E2E are green.
7. Exact implementation Head SHA and CI run IDs are recorded.
8. Independent review reports `P0 = 0`, `P1 = 0`, `P2 = 0` and issues explicit `GO`.
9. The accepted Phase 8B implementation is merged before Phase 8C begins.

---

## 12. Authorization Statement

**AUTHORIZED**: Phase 8B — Season + Structured Review production implementation may begin under this controlling document, provided the implementation branch satisfies the entry gate in Section 2.3 and remains within Sections 3–10.

This authorization is deliberately narrow. It authorizes implementation of the frozen Phase 8B contract; it does not authorize redesign of the contract, does not authorize Phase 8C–8G, and does not grant the AI or client application any new authority over Growth Core truth.

---

## 13. Reference Integrity Note

Several Phase 8A package files refer to:

```text
docs/DesignSystem/PHASE8A_OUTER_GROWTH_LOOP_ARCHITECTURE_FREEZE_CONTROLLING.md
```

That referenced path is not present in the current working tree. This Phase 8B document does not reconstruct, invent, or silently substitute the missing file. For Phase 8B implementation, the authoritative architecture evidence is the merged `docs/Phase8/00...12` package pinned by the immutable Phase 8A merge SHA in Section 2.1, together with this phase-specific controlling document.

---

## 14. Independent Gatekeeper Review Record

This controlling document received an independent read-only Gatekeeper review against the current repository state and the frozen Phase 8A package.

### Initial review

- Verdict: `NO-GO`
- Findings: `P0 = 0`, `P1 = 1`, `P2 = 0`
- P1: the draft incorrectly implied that `ABANDONED` Season conclusion must atomically create a FINAL Review.

### Corrective action

The document was corrected to match the frozen `rpc_conclude_season` contract:

- `COMPLETED` / `ENDED_EARLY`: atomic FINAL Review required.
- `ABANDONED`: non-empty abandonment reason + audit required; **zero `season_reviews` rows inserted**.
- Post-conclusion FINAL-review amendment: available only for `COMPLETED` / `ENDED_EARLY`.

### Re-review

- Verdict: **`GO`**
- Findings: **`P0 = 0`, `P1 = 0`, `P2 = 0`**
- No regression introduced by the corrective change.

The Phase 8B implementation authorization in Section 12 is therefore **ACTIVE**, subject to the entry gate and all scope/security/change-control boundaries in this document.
