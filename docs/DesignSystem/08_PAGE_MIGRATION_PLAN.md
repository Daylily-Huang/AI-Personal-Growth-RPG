# Page Migration & Implementation Roadmap

> **Document**: `08_PAGE_MIGRATION_PLAN.md`  
> **Status**: DESIGN FREEZE CANDIDATE — REVIEW PENDING  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md` to `07_RESPONSIVE_AND_ACCESSIBILITY.md`  
> **Related Documents**: `09_GLOBAL_VISUAL_ACCEPTANCE_GATES.md`

---

## 1. Migration Strategy & Sequencing Invariants

The migration to the new Global Visual System follows a strict, layered implementation roadmap. Business logic, database schemas, and API contracts remain strictly frozen throughout visual migration.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          LAYERED IMPLEMENTATION ROADMAP                             │
│                                                                                     │
│    Phase 1: Visual Foundation & Tokens ✅ FINAL FROZEN                               │
│                                 ↓                                                   │
│    Phase 2: Global App Shell ✅ FINAL FROZEN                                         │
│                                 ↓                                                   │
│    Phase 3: Shared UI Primitives Library ✅ FINAL FROZEN                             │
│                                 ↓                                                   │
│    Phase 4: Stage 7C & 7D Artifact System ✅ FINAL FROZEN                            │
│                                 ↓                                                   │
│    Phase 5: Core Screens (Dashboard ✅ FROZEN -> Quests ✅ FROZEN -> Skills ✅ FROZEN)│
│                                 ↓                                                   │
│    Phase 6: Advanced Canvas Modernization (Knowledge Graph Canvas) ✅ FINAL FROZEN  │
│                                 ↓                                                   │
│    Phase 7: Global Polish & Cross-Page Acceptance (Round 1~4) ✅ FINAL FROZEN       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Path Allowlist & Denylist

### 2.1 Allowed Frontend Modification Paths
- `src/components/**` (Layouts, primitives, cards, drawers, dialogs)
- `src/app/**` (Pages, route layouts, views)
- `src/styles/**` (Design tokens, Tailwind extensions)

### 2.2 Strictly Denied Paths (FROZEN BACKEND / DOMAIN)
- `src/lib/growth-engine/**` (Rule Engine — FROZEN)
- `src/lib/ai/**` (GM AI Prompt & Schemas — FROZEN)
- `supabase/migrations/**` (Database Schemas & RLS — FROZEN)

---

## 3. Phase-by-Phase Execution Plan

### Phase 1 — Global Visual Foundation & Token Architecture ✅ FINAL FROZEN
- **Deliverables**: Tailwind CSS tokens, CSS variable architecture, typography scale, semantic borders, and interactive states.

### Phase 2 — Global Application Shell Architecture ✅ FINAL FROZEN
- **Deliverables**: Responsive layout shell, collapsible sidebar navigation, top header status bar, and inspector drawer.

### Phase 3 — Shared UI Primitives Library ✅ FINAL FROZEN
- **Deliverables**:
  - Surfaces: `GlassPanel`, `RPGCard`, `SectionCard`, `StatCard`.
  - Badges: `LevelBadge`, `MasteryBadge` (M0–M10 5-diamond meter), `ConfidenceBadge` (3 variants), `StatusBadge`, `EntityChip`.
  - Meters: `XPProgress`, `QuestProgress`, `ReusabilityMeter`.
  - Controls: `PrimaryButton` (Gold), `SecondaryButton` (Neutral), `DangerButton` (Functional Danger), `SearchInput`, `FilterBar`.
  - Overlays: `ConfirmDialog`, `BaseModal`, `ToastNotification`, `Tooltip`.

### Phase 4 — Stage 7C & 7D: Artifact System & Audit ✅ FINAL FROZEN
- **Objective**: Implement the complete Artifact user interface on top of frozen Stage 7B APIs and conduct comprehensive Stage 7D security, E2E, immutability, and freeze audit.
- **Status**: **COMPLETE & MERGED (FINAL FROZEN)** (Stage 7C via PR #16, Stage 7D via PR #17).
- **Deliverables**:
  - `/artifacts` Workspace & Gallery Page: Responsive grid of `ArtifactCard`s with type/status filters and search.
  - `ArtifactInspectorContent`: Injected into `InspectorDrawer` with 5 relational accordions (Skills, Knowledge, Quests, Activities, Evidence).
  - Assessment Confirm Artifact Proposal Resolution UI (Create / Existing / Ignore selector bound by `proposalIndex`).
  - Stage 7D Final Security, E2E, Immutability & Freeze Audit suites (`stage7d-artifact-db.test.ts`, `stage7d-artifact-e2e.test.ts`, `stage7d-artifact-security.test.ts`).
  - Comprehensive freeze guarantees: RLS tenant isolation, cross-category batch atomicity, full settlement rollback snapshot, duplicate confirm idempotency, concurrency mutex, SECURITY DEFINER privilege isolation, provenance / evidence immutability.
  - **ARTIFACT SYSTEM — COMPLETE & FINAL FROZEN**.

### Phase 5 — Dashboard, Quests & Skills Migration ✅ FINAL FROZEN
- **Objective**: Modernize existing product pages onto the shared primitive system.
- **Deliverables**:
  - `/dashboard`: Overhauled practitioner overview with calm stat cards, active quests, and activity feed. ✅ **FINAL FROZEN** (Stage 5A-UI via PR #18)
  - `/quests`: Quest hierarchy tree, milestone progress meters, full 7-state lifecycle matrix, BaseModal creation flow, and semantic nested lists. ✅ **FINAL FROZEN** (Stage 5B-UI via PR #19)
  - `/skills`: Interactive skill tree with light-first ink-wash nodes, M0–M10 mastery badges, and evidence inspection. ✅ **FINAL FROZEN** (Stage 5C-UI via PR #20)

### Phase 6 — Knowledge Map Canvas Modernization ✅ FINAL FROZEN
- **Objective**: Modernize the force-directed graph canvas for Knowledge Nodes.
- **Deliverables**:
  - Canvas graph viewport with semantic node clustering, edge authority filters, and real-time inspector linkage.
- **Closure**: PR #21 merged at `186e5bed71844ba274680b10ab939bc5169e669d` from approved Exact Head `066fe811e187c547069b3ed3965f24d19e280e9a`; Exact Head CI run `34179971347` passed its required jobs.
- **Frozen boundary**: Backend/domain authority, Supabase, shared UI primitives, shared layout, design tokens, and dependencies remain frozen.

### Phase 7 — Round 1: Accessibility Semantics + Keyboard + Graph Table Views ✅ MERGED / COMPLETE
- **Closure**: PR #22 merged at `533ab09ebeb8bb827401446f022cf9a83c7db89c` from approved Exact Head `9cafc345a074577084cad08bbdbed1789911d8ff`; Exact Head CI run `34223921283` passed its required jobs.
- **Delivered**: semantic landmarks/control naming, keyboard graph traversal, `/skills?view=table`, `/knowledge?view=table`, modal/drawer Escape ownership, and authority/mastery/confidence separation.
- **Frozen boundary**: Backend/domain authority, Supabase, shared UI primitives, shared layout, design tokens, and dependencies remain frozen.

### Phase 7 — Global Polish, Responsive Hardening, Reduced Motion & Final Freeze ✅ FINAL FROZEN
- **Round 1 (A11y & Keyboard)**: PR #22 merged at `533ab09ebeb8bb827401446f022cf9a83c7db89c` (CI `34223921283`).
- **Round 2 (Responsive Stress)**: PR #23 merged at `9d394d137781b0a887cf8976ceb740eb618b7636` (CI `34379381800`).
- **Round 3 (Reduced Motion)**: PR #25 (merge `a825605f6ce83baea2ec24765799da9799298c4f`) & PR #27 (merge `0e7591607507b3ac59519ab0dc656a3eed2512c4`, CI `34622336564`).
- **Round 4 (Final Cross-Page Acceptance & Phase 7 Freeze)**:
  - PR #28 merged at `653fe018f6cee38b2263fbcca19dffbf624d4c18` from approved Exact Head `f1e426ce6f64135066a652882d27c03b9cf6dca0`.
  - Exact-Head Acceptance CI `34707377871` passed completely (`check` and `supabase-integration` success).
  - Post-merge main push CI `34708617506` completed with failure (KNOWN PUSH-TO-MAIN GOVERNANCE GUARD INCOMPATIBILITY in `tests/phase5-quests-ui.test.tsx` and `tests/phase5-skills-ui.test.tsx`).
  - Final R3 Evidence: `evidence/phase7-round4-final-acceptance-r3` @ `bcec4d2b0c898071f706b7f655b0214d23a92a35`.
  - Final Independent Review: `review/phase7-round4-r3-final-independent-review-20260913` @ `eb22caa91de40fe402bb3c8d732186ee5f037f9d`.
  - P1-05 contrast compliance resolved (`PrimaryButton` 6.52:1, `LevelBadge` 6.52:1).
  - 72/72 browser matrix cells verified with 0 overflow and 0 console errors.
- **FINAL STATUS**: **PHASE 7 FINAL FROZEN**.
