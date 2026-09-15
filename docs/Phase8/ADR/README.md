# Phase 8 — Architecture Decision Records (ADR) Repository

## 1. Purpose & Governance Protocol

This directory houses Architecture Decision Records (ADRs) for the Outer Growth Loop of the AI Personal Growth RPG.

In accordance with Section 20 of `PHASE8A_OUTER_GROWTH_LOOP_ARCHITECTURE_FREEZE_CONTROLLING.md`:
> *"ADRs are required only for genuinely unresolved design choices or any proposed deviation from this control. An ADR is not permission to violate a frozen invariant; deviations remain blocked until independent approval."*

---

## 2. Current Status: Zero Unresolved Deviations

As of the Phase 8A Architecture Freeze:
- **Baseline Alignment**: 100% compliant with controlling document commit `422f55656881633ecebddcd2f08a5bff02db8f58`.
- **Invariants O1–O12**: Fully respected across all 12 specification documents.
- **Phase Sequencing**: The binding sequence (`8A -> 8B -> 8C -> 8D -> 8E -> 8F -> 8G`) has been adopted unconditionally.
- **Entity Boundaries**:
  - Seasons are $N:N$ with Quests and do not modify `activities`.
  - Journal is strictly separated from Verified Evidence (`Journal != Verified Evidence`).
  - Strategies require cross-time multi-observation support before reaching `SUPPORTED`.
  - Reward economy is physically isolated in `reward_transactions` with append-only accounting.
  - AI operates exclusively via non-authoritative `OuterLoopProposal` records.
  - Vouchers, automated budgeting, and parallel Goal tables are formally rejected/deferred.

**Result**: There are **zero unresolved architectural deviations** requiring exception approval.

---

## 3. Protocol for Future Architecture Changes

If a future implementation phase proposes any modification to a frozen specification:
1. **Author an ADR**: Create `ADR-00X-[title].md` in this directory using the standard format:
   - **Context**: Problem statement and underlying motivation.
   - **Decision**: Proposed architectural change.
   - **Status**: `PROPOSED` (cannot be `ACCEPTED` without Gatekeeper sign-off).
   - **Consequences**: Analysis of impact on Growth Core integrity, invariants O1–O12, and database migrations.
2. **Independent Review Required**: The ADR must be submitted to the independent Gatekeeper AI. Implementation remains strictly blocked until explicit independent approval is granted.
