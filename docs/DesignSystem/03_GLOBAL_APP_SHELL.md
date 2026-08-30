# Global App Shell Architecture Specification

> **Document**: `03_GLOBAL_APP_SHELL.md`  
> **Status**: DESIGN FREEZE CANDIDATE  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md`, `02_DESIGN_TOKENS.md`  
> **Related Documents**: `04_SHARED_COMPONENT_SYSTEM.md`, `05_ENTITY_VISUAL_LANGUAGE.md`, `08_PAGE_MIGRATION_PLAN.md`

---

## 1. Global Shell Structure & Zones

The unified **AppShell** provides a persistent, cohesive environment across all product screens (Dashboard, Quests, Skill Tree, Knowledge Map, Artifacts, and future Reviews), ensuring that individual pages do not invent disjointed navigation or layout paradigms.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. GLOBAL BACKGROUND: Low-Contrast Ink-Wash Landscape + Subtle Atmospheric Mist Mask       │
│                                                                                             │
│ ┌───────────────┬─────────────────────────────────────────────────────────┬───────────────┐ │
│ │ 2. SIDEBAR    │ 3. TOP HEADER ZONE                                      │ 4. CONTEXTUAL │ │
│ │    NAVIGATION │   • Page Breadcrumb / Title  • Player Identity / Level  │    DRAWER /   │ │
│ │               │   • Global XP State Meter    • Global Assessment Pulse  │    INSPECTOR  │ │
│ │ • Dashboard   ├─────────────────────────────────────────────────────────┤   (Slide-over)│ │
│ │ • Quests      │ 5. MAIN WORKSPACE CANVAS                                │               │ │
│ │ • Skills      │                                                         │ • Multi-tier  │ │
│ │ • Knowledge   │   • Responsive Grid / Canvas View                       │   Accordions  │ │
│ │ • Artifacts   │   • Filter & Search Bar                                 │ • Relational  │ │
│ │ • Settings    │   • GlassPanel Card Grids / Force-Directed Graphs       │   Metadata    │ │
│ │               │                                                         │ • Direct Link │ │
│ │ [Collapse <]  │                                                         │   Actions     │ │
│ └───────────────┴─────────────────────────────────────────────────────────┴───────────────┘ │
│ 6. GLOBAL FLOATING OVERLAYS: Modals (Z:100), Toasts (Z:120), Tooltips (Z:150)             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Shell Zone Specifications

### 2.1 Zone 1: Environmental Background (`AppEnvironment`)
- **Structure**: Fixed background container with `pointer-events-none` and `z-index: 0`.
- **Assets**: Desaturated, atmospheric vector/raster ink-wash mountain silhouettes with animated subtle mist drifting at 60s per cycle.
- **Veil Layer**: Full-screen tint mask `rgba(10, 13, 18, 0.88)` ensuring high-contrast foreground legibility (WCAG AAA).

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
  - Icons centered with hover tooltips (`--z-tooltip`).
  - Active state shown via a 3px gold vertical highlight bar.
- **Mobile Navigation (`MobileNav`)**:
  - Bottom navigation bar (height: 64px, `backdrop-blur-xl`, `bg-surface-overlay`).
  - 5 primary icons with active gold dot indicators.

### 2.3 Zone 3: Top Header (`AppHeader`)
- **Left Zone**: Dynamic Breadcrumbs + Current Section Title with Song-serif styling (`font-serif`, `tracking-wide`).
- **Right Zone**:
  - **Player Status Capsule**: Avatar + Character Realm/Title (e.g. "筑基 · 二层" / "Level 14 Practitioner") + Global Level Badge.
  - **Global XP Bar**: Compact animated progression bar showing `current_xp / next_level_xp`.
  - **Pending Assessment Indicator**: Subtle pulse badge indicating unconfirmed AI assessments.

### 2.4 Zone 4: Main Workspace (`AppWorkspace`)
- **Layout**: Flexible scrolling canvas with standard responsive gutters (`px-4 sm:px-6 lg:px-8 py-6`).
- **Max Width**: `max-w-7xl` for standard card dashboards; full-bleed (`w-full h-[calc(100vh-4rem)]`) for Graph and Tree workspaces.

### 2.5 Zone 5: Contextual Inspector Drawer (`InspectorDrawer`)
- **Placement**: Slides in from right edge (`z-index: 80`).
- **Dimensions**: `w-full sm:w-[480px] lg:w-[560px]`.
- **Behavior**:
  - Pushes or overlays canvas depending on viewport width.
  - Retains scroll position of main canvas.
  - Dismissible via ESC key, backdrop click, or close button.
  - Contains entity-specific relational accordions (Skills, Knowledge, Quests, Activities, Evidence).

### 2.6 Zone 6: Modal & Overlay Layer (`ModalLayer`)
- **Backdrop**: Semi-transparent dark blur overlay (`rgba(5, 7, 10, 0.75)` with `backdrop-blur-md`).
- **Container**: Centered, elevated glass card (`surface-overlay`, `border-gold-subtle`, `shadow-overlay`).
- **Action Hierarchy**: Standard dual-button layout with Primary Affirmative (Gold), Secondary Cancel (Muted Outline), or Danger Destructive (Vermilion).

---

## 3. Responsive Shell Adaptation Matrix

| Viewport | Sidebar Behavior | Header Zone | Workspace Layout | Inspector Drawer |
| :--- | :--- | :--- | :--- | :--- |
| **Desktop Wide ($\ge 1440\text{px}$)** | Expanded (260px) | Full Breadcrumbs + XP Capsule | 3-Column / Full Canvas | Side-by-side push (560px) |
| **Desktop / Laptop ($1024\text{px} - 1439\text{px}$)** | Expanded or Collapsed (260px/72px) | Full Breadcrumbs + XP Capsule | 2-Column / Full Canvas | Overlay slide-in (480px) |
| **Tablet ($768\text{px} - 1023\text{px}$)** | Collapsed (72px) | Compact Title + Level Badge | 1-Column Stack / Canvas | Full slide-over (100% or 420px) |
| **Mobile ($< 768\text{px}$)** | Bottom Bar (64px) | Compact Title + Status Icon | Single column vertical stack | Fullscreen sheet (`h-[92vh]`) |

---

## 4. Shell State Management Principles

1. **URL State Synchronization**: Active inspector entity ID and active tab are persisted in URL query parameters (`?inspect=<entityId>&tab=<tabName>`) allowing shareable deep links.
2. **Zero Layout Shift (CLS)**: Skeleton fallbacks for sidebar player identity and header XP state prevent layout jumping during auth or profile hydration.
3. **Keyboard Accessibility**:
   - `Ctrl/Cmd + B`: Toggle Sidebar collapse state.
   - `Escape`: Close active Inspector Drawer or Modal.
   - `Tab` / `Shift+Tab`: Trapped within active Modals and accessible in standard document order.
