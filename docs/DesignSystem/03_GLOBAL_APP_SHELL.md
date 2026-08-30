# Global App Shell Architecture Specification

> **Document**: `03_GLOBAL_APP_SHELL.md`  
> **Status**: DESIGN FREEZE CANDIDATE (ROUND 2 REVIEW PENDING)  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md`, `02_DESIGN_TOKENS.md`  
> **Related Documents**: `04_SHARED_COMPONENT_SYSTEM.md`, `05_ENTITY_VISUAL_LANGUAGE.md`, `08_PAGE_MIGRATION_PLAN.md`

---

## 1. Global Shell Structure & Zones

The unified **AppShell** provides a persistent, cohesive environment across all product screens (Dashboard, Quests, Skill Tree, Knowledge Map, Artifacts, and future Reviews), ensuring that individual pages do not invent disjointed navigation or layout paradigms.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. GLOBAL BACKGROUND: Low-Contrast Ink-Wash Landscape + var(--bg-veil-overlay)              │
│                                                                                             │
│ ┌───────────────┬─────────────────────────────────────────────────────────┬───────────────┐ │
│ │ 2. SIDEBAR    │ 3. TOP HEADER ZONE                                      │ 4. CONTEXTUAL │ │
│ │    NAVIGATION │   • Page Breadcrumb / Title  • Player Identity / Level  │    DRAWER /   │ │
│ │               │   • Global XP State Meter    • Assessment Indicator     │    INSPECTOR  │ │
│ │ • Dashboard   ├─────────────────────────────────────────────────────────┤   (Slide-over)│ │
│ │ • Quests      │ 5. MAIN WORKSPACE CANVAS                                │               │ │
│ │ • Skills      │                                                         │ • Structural  │ │
│ │ • Knowledge   │   • Responsive Grid / Canvas View                       │   Shell       │ │
│ │ • Artifacts   │   • Filter & Search Bar                                 │ • Entity      │ │
│ │ • Settings    │   • GlassPanel Card Grids / Force-Directed Graphs       │   Children    │ │
│ │               │                                                         │ • Direct Link │ │
│ │ [Collapse <]  │                                                         │   Actions     │ │
│ └───────────────┴─────────────────────────────────────────────────────────┴───────────────┘ │
│ 6. GLOBAL FLOATING OVERLAYS: Modals (Z:100), Toasts (Z:120), Tooltips (Z:150)             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Shell Zone Specifications

### 2.1 Zone 1: Environmental Background (`AppEnvironment`)
- **Structure**: Fixed background container with `pointer-events-none` and `z-index: var(--z-bg-env)`.
- **Assets**: Desaturated, atmospheric vector/raster ink-wash mountain silhouettes with animated subtle mist drifting at 60s per cycle.
- **Veil Layer**: Full-screen tint mask `var(--bg-veil-overlay)` ensuring composited foreground legibility.

### 2.2 Zone 2: Navigation Sidebar (`AppSidebar`)
- **Desktop Expanded (Width: 260px)**:
  - **Brand Header**: Product seal icon (Ancient Gold brush logo) + "AI Personal Growth RPG".
  - **Navigation Links**: Clean icon + localized label + active indicator pill.
    - `/dashboard`: 仪表盘 (Overview)
    - `/quests`: 任务志 (Quests & Objectives)
    - `/skills`: 技能谱 (Capability Tree)
    - `/knowledge`: 知识图 (Knowledge Map)
    - `/artifacts`: 产出台 (Artifact Gallery)
  - **Bottom Footer**: Compact player avatar, level badge, and collapse toggle button.
- **Desktop Collapsed (Width: 72px)**:
  - Icons centered with hover tooltips (`var(--z-tooltip)`).
  - Active state shown via a 3px gold vertical highlight bar (`var(--gold-400)`).
- **Mobile Navigation (`MobileNav`)**:
  - Bottom navigation bar (height: 64px, `backdrop-blur: var(--glass-blur-xl)`, `bg: var(--surface-overlay)`).
  - 5 primary icons with active gold dot indicators.

### 2.3 Zone 3: Top Header (`AppHeader`)
- **Left Zone**: Dynamic Breadcrumbs + Current Section Title with Song-serif styling (`font-family: var(--font-serif)`, `letter-spacing: var(--tracking-wide)`).
- **Right Zone**:
  - **Player Status Capsule**: Avatar + Character Realm/Title (e.g. "筑基 · 二层" / "Level 14 Practitioner") + Global Level Badge (`LevelBadge`).
  - **Global XP Bar**: Compact animated progression bar showing `current_xp / next_level_xp` (`XPProgress`).
  - **Pending Assessment Indicator**: Subtle pulse badge indicating unconfirmed AI assessments.

### 2.4 Zone 4: Main Workspace (`AppWorkspace`)
- **Layout**: Flexible scrolling canvas with standard responsive gutters (`px-4 md:px-6 lg:px-8 py-6`).
- **Max Width**: `max-w-7xl` for standard card dashboards; full-bleed (`w-full h-[calc(100vh-4rem)]`) for Graph and Tree workspaces.

### 2.5 Zone 5: Contextual Inspector Drawer (`InspectorDrawer`)
- **Placement**: Universal structural slide-over container (`z-index: var(--z-drawer)`).
- **Structural Ownership**: Header, title, status pill, close button, focus trap, scroll body, action footer.
- **Entity Content Injection**: Does NOT hardcode entity-specific tabs. Renders entity-specific children:
  - `ArtifactInspectorContent`: 5 Artifact relation accordions (Skills, Knowledge, Quests, Activities, Evidence).
  - `SkillInspectorContent`: Capability level, M0–M10 mastery pips, mastery confidence, verified activities.
  - `KnowledgeInspectorContent`: Authority state, epistemic confidence, provenance links, 5 Knowledge edge types.
  - `QuestInspectorContent`: Quest hierarchy, objective milestones, linked activities & deliverables.

### 2.6 Zone 6: Modal & Overlay Layer (`ModalLayer`)
- **Backdrop**: Semi-transparent dark blur overlay (`z-index: var(--z-modal-backdrop)` with `backdrop-blur: var(--glass-blur-md)`).
- **Container**: Centered, elevated glass card (`var(--surface-overlay)`, `var(--border-gold-subtle)`, `var(--shadow-overlay)`).
- **Action Hierarchy**: Standard dual-button layout with Primary Affirmative (`PrimaryButton`), Secondary Cancel (`SecondaryButton`), or Danger Destructive (`DangerButton`).

---

## 3. Responsive Shell Adaptation Matrix (Tailwind v4 Mobile-First)

| Breakpoint | Sidebar Behavior | Header Zone | Workspace Layout | Inspector Drawer |
| :--- | :--- | :--- | :--- | :--- |
| **Base (Mobile: $< 768\text{px}$)** | Bottom Bar (64px) | Compact Title + Status Icon | Single column vertical stack | Fullscreen Sheet (`h-[92vh]`) |
| **`md` (Tablet: $768\text{px} - 1023\text{px}$)** | Collapsed Icon Bar (72px) | Compact Title + Level Badge | 2-Column Stack / Canvas | Slide-over Drawer (420px) |
| **`lg` (Desktop: $1024\text{px} - 1439\text{px}$)** | Expanded Sidebar (260px) | Full Breadcrumbs + XP Capsule | 2-3 Column Grid / Canvas | Overlay Drawer (480px) |
| **`xl` (Wide: $\ge 1440\text{px}$)** | Expanded Sidebar (260px) | Full Breadcrumbs + XP Capsule | 3-4 Column Grid / Canvas | Side-by-Side Push (560px) |

---

## 4. Shell State Management Principles

1. **URL State Synchronization**: Active inspector entity ID and active tab are persisted in URL query parameters (`?inspect=<entityId>&tab=<tabName>`) allowing shareable deep links.
2. **Zero Layout Shift (CLS)**: Skeleton fallbacks for sidebar player identity and header XP state prevent layout jumping during auth or profile hydration.
3. **Keyboard Accessibility**:
   - `Ctrl/Cmd + B`: Toggle Sidebar collapse state.
   - `Escape`: Close active Inspector Drawer or Modal.
   - `Tab` / `Shift+Tab`: Trapped within active Modals and accessible in standard document order.
