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
│    Phase 5: Core Screens (Dashboard ✅ FROZEN -> Quests ✅ FROZEN -> Skills 🚀 IN REVIEW)│
│                                 ↓                                                   │
│    Phase 6: Advanced Canvas Modernization (Knowledge Graph Canvas)                  │
│                                 ↓                                                   │
│    Phase 7: End-to-End A11y, Responsive & Motion Polish                             │
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

### Phase 5 — Dashboard, Quests & Skills Migration (IN PROGRESS)
- **Objective**: Modernize existing product pages onto the shared primitive system.
- **Deliverables**:
  - `/dashboard`: Overhauled practitioner overview with calm stat cards, active quests, and activity feed. ✅ **FINAL FROZEN** (Stage 5A-UI via PR #18)
  - `/quests`: Quest hierarchy tree, milestone progress meters, full 7-state lifecycle matrix, BaseModal creation flow, and semantic nested lists. ✅ **FINAL FROZEN** (Stage 5B-UI via PR #19)
  - `/skills`: Interactive skill tree with light-first ink-wash nodes, M0–M10 mastery badges, and evidence inspection. 🚀 **STAGE 5C-UI CODING COMPLETE & IN REVIEW**

### Phase 6 — Knowledge Map Canvas Modernization
- **Objective**: Modernize the force-directed graph canvas for Knowledge Nodes.
- **Deliverables**:
  - Canvas graph viewport with semantic node clustering, edge authority filters, and real-time inspector linkage.

### Phase 7 — End-to-End A11y, Responsive & Motion Polish
- **Objective**: Full keyboard navigation, screen reader conformance, responsive stress-testing, and motion tuning.
