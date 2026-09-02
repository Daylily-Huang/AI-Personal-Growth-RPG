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
┌─────────────────────────────────────────────────────────────────────────┐
│                     LAYERED IMPLEMENTATION ROADMAP                      │
│                                                                         │
│   Phase 1: Visual Foundation & Tokens ✅ FINAL FROZEN                    │
│                                ↓                                        │
│   Phase 2: Global App Shell ✅ FINAL FROZEN                             │
│                                ↓                                        │
│   Phase 3: Shared UI Primitives Library ✅ FINAL FROZEN                 │
│                                ↓                                        │
│   Phase 4: Stage 7C Artifact UI (Gallery, Drawer, Confirm Picker) 🚀     │
│                                ↓                                        │
│   Phase 5: Core Screen Modernization (Dashboard -> Quests -> Skills)    │
│                                ↓                                        │
│   Phase 6: Advanced Canvas Modernization (Knowledge Graph Canvas)       │
│                                ↓                                        │
│   Phase 7: End-to-End A11y, Responsive & Motion Polish                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Path Allowlist & Denylist

### 2.1 Allowed Frontend Modification Paths
- `src/components/**` (Layouts, primitives, cards, drawers, dialogs)
- `src/app/**` (**EXCLUDING** `src/app/api/**` — only page/layout presentation files)
- `src/styles/**` (Design tokens, global styles imported into `src/app/globals.css`)
- `public/assets/environment/**` (Atmospheric SVG ink-wash vectors)
- Presentation-only helper utilities under `src/lib/**` (e.g. `src/lib/ui-utils.ts`) if strictly presentational with zero domain mutations and outside frozen namespaces.

### 2.2 Strictly Frozen Backend & Domain Denylist
- `src/app/api/**` (Frozen RESTful endpoints)
- `supabase/**` (Frozen SQL migrations `0001` through `0042` and database configuration)
- `src/lib/store/**` (Frozen database repositories & settlement service)
- `src/lib/ai/**` (Frozen AI prompt schemas & GM contracts)
- `src/lib/growth-engine/**` (Deterministic XP & growth calculation engine)
- Domain authority modules, `0041_artifact_management_authority.sql`, `0042_artifact_settlement_integration.sql`

---

## 3. Detailed Phase Breakdown

### Phase 1 — Visual Foundation & Tokens (Tailwind CSS v4 Integration) ✅ FINAL FROZEN
- **Objective**: Establish global token runtime using existing Tailwind CSS v4 architecture with Light-first Modern Eastern Ink-Wash palette.
- **Status**: **COMPLETE & MERGED (FINAL FROZEN)**.

### Phase 2 — Unified Global App Shell ✅ FINAL FROZEN
- **Objective**: Replace per-page layouts with the global `AppShell`.
- **Status**: **COMPLETE & MERGED (FINAL FROZEN)** (PR #14).

### Phase 3 — Shared UI Primitives Library ✅ FINAL FROZEN
- **Objective**: Build and test all presentation primitives in isolation.
- **Status**: **COMPLETE & MERGED (FINAL FROZEN)** (PR #15).
- **Frozen Primitives**:
  - Surfaces: `GlassPanel`, `RPGCard`, `SectionCard`, `StatCard`.
  - Badges: `LevelBadge`, `MasteryBadge` (M0–M10 5-diamond meter), `ConfidenceBadge` (3 variants), `StatusBadge`, `EntityChip`.
  - Meters: `XPProgress`, `QuestProgress`, `ReusabilityMeter`.
  - Controls: `PrimaryButton` (Gold), `SecondaryButton` (Neutral), `DangerButton` (Functional Danger), `SearchInput`, `FilterBar`.
  - Overlays: `ConfirmDialog`, `BaseModal`, `ToastNotification`, `Tooltip`.

### Phase 4 — Stage 7C: Artifact UI Implementation 🚀 (ACTIVE NEXT)
- **Objective**: Implement the complete Artifact user interface on top of frozen Stage 7B APIs using the frozen visual foundation, AppShell, and Shared UI Primitives.
- **Deliverables**:
  - `/artifacts` Workspace & Gallery Page: Responsive grid of `ArtifactCard`s with type/status filters and search.
  - `ArtifactInspectorContent`: Injected into `InspectorDrawer` with 5 relational accordions (Skills, Knowledge, Quests, Activities, Evidence).
  - Assessment Confirm Artifact Proposal Resolution UI (Create / Existing / Ignore selector bound by `proposalIndex`).

### Phase 5 — Dashboard, Quests & Skills Migration
- **Objective**: Modernize existing product pages onto the shared primitive system.
- **Deliverables**:
  - `/dashboard`: Overhauled practitioner overview with calm stat cards, active quests, and activity feed.
  - `/quests`: Quest hierarchy tree, milestone progress meters, and linked artifact indicators.
  - `/skills`: Interactive skill tree with hexagonal nodes, M0–M10 mastery badges, and evidence inspection (`SkillInspectorContent`).

### Phase 6 — Knowledge Map Canvas Modernization
- **Objective**: Modernize the force-directed graph canvas for Knowledge Nodes.
- **Deliverables**:
  - Canvas graph viewport with semantic node clustering, edge authority filters, and real-time inspector linkage.

### Phase 7 — End-to-End A11y, Responsive & Motion Polish
- **Objective**: Full keyboard navigation, screen reader conformance, responsive stress-testing, and motion tuning.
