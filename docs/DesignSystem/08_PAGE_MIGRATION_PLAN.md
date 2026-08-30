# Page Migration & Implementation Roadmap

> **Document**: `08_PAGE_MIGRATION_PLAN.md`  
> **Status**: DESIGN FREEZE CANDIDATE (ROUND 3 FINAL REVIEW)  
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
│   Phase 1: Visual Foundation & Tokens (Tailwind v4 @theme Architecture) │
│                                ↓                                        │
│   Phase 2: Global App Shell (Unified Background, Nav, Header, Drawer)   │
│                                ↓                                        │
│   Phase 3: Shared UI Primitives Library (Cards, Badges, Meters, Modals) │
│                                ↓                                        │
│   Phase 4: Stage 7C Artifact UI (Gallery, Links Drawer, Confirm Picker) │
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
- Presentation-only helper utilities under `src/lib/**` (e.g. `src/lib/ui-utils.ts`) if strictly presentational with zero domain mutations.

### 2.2 Strictly Prohibited Denylist Paths
- `src/app/api/**` (Frozen RESTful endpoints)
- `supabase/migrations/**` (Frozen SQL migrations `0001` through `0042`)
- `src/lib/store/**` (Frozen database repositories & settlement service)
- `src/lib/ai/**` (AI prompt schemas & GM contracts when business contracts would change)
- `src/lib/growth-engine/**` (Deterministic XP & growth calculation engine)
- Domain authority modules, `0041_artifact_management_authority.sql`, `0042_artifact_settlement_integration.sql`

---

## 3. Detailed Phase Breakdown

### Phase 1 — Visual Foundation & Tokens (Tailwind CSS v4 Integration)
- **Objective**: Establish global token runtime using existing Tailwind CSS v4 architecture.
- **Deliverables**:
  - Integrate tokens into `src/app/globals.css` using `@theme { ... }` for literal theme properties and `@theme inline { ... }` for CSS variable bindings.
  - Declare CSS custom properties for all frozen tokens from `02_DESIGN_TOKENS.md`.
  - Configure Tailwind v4 mobile-first theme breakpoints (`--breakpoint-md: 48rem`, `--breakpoint-lg: 64rem`, `--breakpoint-xl: 90rem`).
  - Add atmospheric ink-wash vector silhouettes to `public/assets/environment/`.

### Phase 2 — Unified Global App Shell
- **Objective**: Replace per-page layouts with the global `AppShell`.
- **Deliverables**:
  - `src/components/layout/AppShell.tsx`: Root shell container with environmental background veil (`var(--bg-veil-overlay)`).
  - `src/components/layout/AppSidebar.tsx`: Desktop expandable/collapsible sidebar with neutral active indicators (`var(--selection-neutral-*)`).
  - `src/components/layout/AppHeader.tsx`: Top bar with Song-serif breadcrumbs, player level badge (`LevelBadge`), and XP bar (`XPProgress`).
  - `src/components/layout/MobileNav.tsx`: Bottom navigation bar for mobile viewports.
  - `src/components/layout/InspectorDrawer.tsx`: Standardized structural slide-over drawer shell.

### Phase 3 — Shared UI Primitives Library
- **Objective**: Build and test all presentation primitives in isolation.
- **Deliverables**:
  - Surfaces: `GlassPanel`, `RPGCard`, `SectionCard`, `StatCard`.
  - Badges: `LevelBadge`, `MasteryBadge` (M0–M10 5-diamond meter), `ConfidenceBadge` (3 variants), `StatusBadge`, `EntityChip`.
  - Meters: `XPProgress`, `QuestProgress`, `ReusabilityMeter`.
  - Controls: `PrimaryButton` (Gold), `SecondaryButton` (Neutral), `DangerButton` (Functional Danger), `SearchInput`, `FilterBar`.
  - Overlays: `ConfirmDialog`, `BaseModal`, `ToastNotification`, `Tooltip`.

### Phase 4 — Stage 7C: Artifact UI Implementation
- **Objective**: Implement the complete Artifact user interface on top of frozen Stage 7B APIs.
- **Deliverables**:
  - `/artifacts` Gallery Page: Responsive grid of `ArtifactCard`s with type/status filters and search.
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
  - `/knowledge`: Emerald celadon styling, zoom LOD rendering, 5 Knowledge edge types (`prerequisite`, `contains`, `supports`, `contradicts`, `relates_to`), and accessible table view toggle (`KnowledgeInspectorContent`).

### Phase 7 — Comprehensive Quality & A11y Verification
- **Objective**: Complete end-to-end regression, contrast verification, and cross-device testing.
- **Deliverables**:
  - Composited contrast audit ($\ge 7:1$ on primary body, $\ge 4.5:1$ on normal text).
  - Vitest + E2E browser tests execution across all migrated routes.

---

## 4. Strict Boundary Rules During Freeze

1. **No Out-of-Sequence Implementation**: Do not begin Phase 4 (Stage 7C) or Phase 5 (Page Migrations) until this Global Visual Design Freeze package is reviewed and APPROVED.
2. **Zero Backend Changes**: Migration phases modify ONLY frontend presentation components. Backend routes, Supabase migrations, and domain services remain untouched.
