# Shared Component System Specification

> **Document**: `04_SHARED_COMPONENT_SYSTEM.md`  
> **Status**: DESIGN FREEZE CANDIDATE  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md`, `02_DESIGN_TOKENS.md`, `03_GLOBAL_APP_SHELL.md`  
> **Related Documents**: `05_ENTITY_VISUAL_LANGUAGE.md`, `06_MOTION_AND_FEEDBACK.md`, `08_PAGE_MIGRATION_PLAN.md`

---

## 1. Component System Hierarchy

All page interfaces are composed strictly from a unified catalog of shared UI primitives. Page-specific custom wrappers with ad-hoc styling are prohibited.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SHARED COMPONENT CATALOG                           │
│                                                                         │
│   [Structural Primitives]       [Data & Presentation]      [Feedback & Control] │
│   • AppShell                   • LevelBadge               • PrimaryButton       │
│   • PageHeader                 • MasteryBadge             • SecondaryButton     │
│   • GlassPanel                 • ConfidenceBadge          • DangerButton        │
│   • RPGCard                    • StatusBadge              • SearchInput         │
│   • SectionCard                • XPProgress               • FilterBar           │
│   • StatCard                   • QuestProgress            • Modal/ConfirmDialog │
│   • InspectorDrawer            • EntityChip               • ToastNotification   │
│   • Accordion / Tabs           • EmptyState / Skeleton    • Tooltip             │
│                                                                         │
│   [Graph & Domain Primitives]                                           │
│   • SkillNode  • KnowledgeNode  • GraphLegend  • GraphInspector         │
│   • ArtifactCard  • EvidenceSealBadge  • ProposalResolutionPicker       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Primitive Specifications

### 2.1 Surfaces & Cards

#### `GlassPanel`
- **Purpose**: Base translucent container for all structured content blocks.
- **Props**: `variant?: 'ground' | 'base' | 'raised' | 'overlay'`, `blur?: 'sm' | 'md' | 'lg' | 'xl'`, `border?: 'subtle' | 'gold' | 'none'`, `className?: string`.
- **Styling**: Applies token-driven background opacity, backdrop blur, 1px border, and top-edge highlight.

#### `RPGCard`
- **Purpose**: Primary interactive card used for activities, quests, artifacts, and summary metrics.
- **Visual Features**:
  - Translucent glass surface (`var(--surface-base)`).
  - Subtle gold border on hover (`var(--border-gold-subtle)`).
  - Top-right entity icon or status badge.
  - Interactive elevation transition (`translateY(-2px)` + subtle shadow).

#### `StatCard`
- **Purpose**: Numeric RPG metric display (XP total, completed quests, mastered skills, artifact counts).
- **Structure**:
  - Top: Subdued label (`text-xs text-secondary tracking-wider uppercase`).
  - Middle: Prominent tabular number (`text-2xl font-bold font-mono text-primary`).
  - Bottom: Trend or contextual subtitle (`text-xs text-muted`).

---

### 2.2 Indicators & Badges

#### `LevelBadge`
- **Purpose**: Displays character or skill progression tier.
- **Visual**: Octagonal or pill shape with Antique Gold border (`#d4af37`), dark slate interior, and bold Roman/Arabic numeral.

#### `MasteryBadge`
- **Purpose**: Displays verified skill mastery level (1 to 5).
- **Visual**: Tiered visual representation using 5 subtle diamond/pips indicators (filled in solid gold for verified level, hollow for unverified).

#### `ConfidenceBadge`
- **Purpose**: Displays AI GM assessment confidence metric ($0.00$ to $1.00$).
- **Visual**:
  - High ($\ge 0.80$): Emerald Celadon border & text (`#56d364`).
  - Medium ($0.50 - 0.79$): Amber Gold border & text (`#e5c158`).
  - Low ($< 0.50$): Muted Slate border & text (`#8b949e`).

#### `StatusBadge`
- **Purpose**: Lifecycle state indicators (`active`, `draft`, `archived`, `superseded`, `pending`, `confirmed`).
- **Rule**: Must pair color with an explicit semantic icon and text label (never color alone).

---

### 2.3 Progress & Meters

#### `XPProgress`
- **Purpose**: Displays experience points relative to next level threshold.
- **Visual**: Sleek 6px horizontal track (`bg-white/10`) with glowing gold fill gradient (`from-[#c5a059] to-[#e5c158]`) and numerical readouts (`current / max XP`).

#### `QuestProgress`
- **Purpose**: Displays quest completion percentage ($0\%$ to $100\%$).
- **Visual**: Azure horizon track (`#58a6ff`) with segmented milestone ticks.

---

### 2.4 Navigation & Layout Primitives

#### `PageHeader`
- **Structure**:
  - Left: Song-serif title + category pill + descriptive subtitle.
  - Right: Primary actions (`PrimaryButton`, `FilterBar`, or view toggle).

#### `InspectorDrawer`
- **Structure**:
  - Header: Entity icon + Title + Status Pill + Close button.
  - Body: Scrollable container with 5 standardized relational accordions.
  - Footer: Edit, Delete, Archive, or Share actions.

#### `Tabs` & `Accordion`
- **Visual**: Minimalist underline or boxed glass tabs with active gold indicator; smooth height expansion transitions.

---

### 2.5 Buttons & Interactive Controls

#### `PrimaryButton`
- **Style**: Antique gold solid background (`bg-[#d4af37] text-[#0d1117] font-semibold`), subtle hover glow, active scale down.

#### `SecondaryButton`
- **Style**: Translucent glass background (`bg-white/5 border border-white/15 text-primary hover:bg-white/10`).

#### `DangerButton`
- **Style**: Subtle vermilion background (`bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20`).

#### `SearchInput` & `FilterBar`
- **Style**: Integrated search field with search icon, clear button, and multi-select pill filters with active gold borders.

---

## 3. Graph & Domain-Specific Primitives

### 3.1 `SkillNode` & `KnowledgeNode`
- **Visual**: Hexagonal or circular SVG nodes rendered on dynamic force-directed canvas.
- **States**:
  - Unlocked / Mastered: Solid gold / emerald core with subtle ambient glow halo.
  - Inferred / Pending: Dashed border with subdued interior.
  - Selected / Focus: Highlight ring with connector pulse animation.

### 3.2 `ArtifactCard`
- **Visual**: Amethyst scholar silk styling (`--entity-artifact-border`), displaying:
  - 8-type taxonomy badge (e.g. `Document`, `Code Repository`, `Design Spec`).
  - Version pill (e.g. `v1.2.0`).
  - Lifecycle state (e.g. `Active`, `Superseded`).
  - Reusability score meter ($0.00$ to $1.00$).
  - Relational count pills (Skills, Knowledge, Quests, Activities, Evidence).

---

## 4. Anti-Duplication Rule

1. **Single Drawer Implementation**: `InspectorDrawer` is the sole drawer component in the codebase. Individual pages must pass children/accordions into this single primitive.
2. **Single Modal Implementation**: `ConfirmDialog` and `BaseModal` handle all dialog interactions with uniform backdrop and focus trapping.
3. **Zero Business Logic in Primitives**: Shared primitives are pure presentation components with well-defined TypeScript interfaces.
