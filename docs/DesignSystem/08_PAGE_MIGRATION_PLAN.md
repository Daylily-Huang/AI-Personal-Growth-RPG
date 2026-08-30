# Page Migration & Implementation Roadmap

> **Document**: `08_PAGE_MIGRATION_PLAN.md`  
> **Status**: DESIGN FREEZE CANDIDATE  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md` to `07_RESPONSIVE_AND_ACCESSIBILITY.md`  
> **Related Documents**: `09_GLOBAL_VISUAL_ACCEPTANCE_GATES.md`

---

## 1. Migration Strategy & Sequencing Invariants

The migration to the new Global Visual System follows a strict, layered implementation roadmap. Business logic, database schemas, and API contracts remain strictly unchanged throughout visual migration.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     LAYERED IMPLEMENTATION ROADMAP                      │
│                                                                         │
│   Phase 1: Visual Foundation & Tokens (CSS Variables & Tailwind Config) │
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

## 2. Detailed Phase Breakdown

### Phase 1 — Visual Foundation & Tokens
- **Objective**: Establish global token runtime and Tailwind CSS configuration.
- **Deliverables**:
  - Update `tailwind.config.ts` with custom colors (`gold`, `celadon`, `azure`, `amethyst`, `vermilion`), opacity tokens, and surface variants.
  - Implement `src/styles/design-tokens.css` with CSS custom properties from `02_DESIGN_TOKENS.md`.
  - Add atmospheric ink-wash vector silhouettes and noise overlays to `public/assets/environment/`.

### Phase 2 — Unified Global App Shell
- **Objective**: Replace legacy per-page layouts with the global `AppShell`.
- **Deliverables**:
  - `src/components/layout/AppShell.tsx`: Root shell container with environmental background veil.
  - `src/components/layout/AppSidebar.tsx`: Desktop expandable/collapsible sidebar with active gold indicators.
  - `src/components/layout/AppHeader.tsx`: Top bar with Song-serif breadcrumbs, player level badge, and XP bar.
  - `src/components/layout/MobileNav.tsx`: Bottom navigation bar for mobile viewports.
  - `src/components/layout/InspectorDrawer.tsx`: Standardized right-side slide-over drawer.

### Phase 3 — Shared UI Primitives Library
- **Objective**: Build and test all presentation primitives in isolation.
- **Deliverables**:
  - Surfaces: `GlassPanel`, `RPGCard`, `SectionCard`, `StatCard`.
  - Badges: `LevelBadge`, `MasteryBadge`, `ConfidenceBadge`, `StatusBadge`, `EntityChip`.
  - Meters: `XPProgress`, `QuestProgress`, `ReusabilityMeter`.
  - Inputs & Controls: `PrimaryButton`, `SecondaryButton`, `DangerButton`, `SearchInput`, `FilterBar`.
  - Overlays: `ConfirmDialog`, `BaseModal`, `ToastNotification`, `Tooltip`.

### Phase 4 — Stage 7C: Artifact UI Implementation
- **Objective**: Implement the complete Artifact user interface on top of frozen Stage 7B APIs.
- **Deliverables**:
  - `/artifacts` Gallery Page: Responsive grid of `ArtifactCard`s with type/status filters and search.
  - Artifact Detail & Link Inspector: Slide-over drawer with tabs for linked Skills, Knowledge, Quests, Activities, and Evidence.
  - Artifact Creation & Resolution Picker in Assessment Confirm Flow: UI components for resolving AI proposals (`CREATE`, `EXISTING`, `IGNORE`).

### Phase 5 — Dashboard, Quests & Skills Migration
- **Objective**: Modernize existing product pages onto the shared primitive system.
- **Deliverables**:
  - `/dashboard`: Overhauled practitioner overview with calm stat cards, active quests, and activity feed.
  - `/quests`: Quest hierarchy tree, milestone progress meters, and linked artifact indicators.
  - `/skills`: Interactive skill tree with hexagonal nodes, 5-pip mastery meters, and evidence inspection.

### Phase 6 — Knowledge Map Canvas Modernization
- **Objective**: Modernize the force-directed graph canvas for Knowledge Nodes.
- **Deliverables**:
  - `/knowledge`: Emerald celadon styling, zoom LOD rendering, edge relationship labels (`cites`, `implements`, `synthesizes`, `evaluates`), and accessible table view toggle.

### Phase 7 — Comprehensive Quality & A11y Verification
- **Objective**: Complete end-to-end regression, contrast verification, and cross-device testing.
- **Deliverables**:
  - Lighthouse accessibility audit ($> 95$ score target).
  - Vitest + E2E browser tests execution across all migrated routes.

---

## 3. Strict Boundary Rules During Freeze

1. **No Out-of-Sequence Implementation**: Do not begin Phase 4 (Stage 7C) or Phase 5 (Page Migrations) until this Global Visual Design Freeze package is reviewed and APPROVED.
2. **Zero Backend Changes**: Migration phases modify ONLY frontend presentation components (`src/components/**`, `src/app/**`). Backend routes, Supabase migrations, and domain services remain untouched.
