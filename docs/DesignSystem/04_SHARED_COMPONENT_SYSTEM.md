# Shared Component System Specification

> **Document**: `04_SHARED_COMPONENT_SYSTEM.md`  
> **Status**: DESIGN FREEZE CANDIDATE (ROUND 3 FINAL REVIEW)  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md`, `02_DESIGN_TOKENS.md`, `03_GLOBAL_APP_SHELL.md`  
> **Related Documents**: `05_ENTITY_VISUAL_LANGUAGE.md`, `06_MOTION_AND_FEEDBACK.md`, `08_PAGE_MIGRATION_PLAN.md`

---

## 1. Component System Hierarchy

All page interfaces are composed strictly from a unified catalog of shared UI primitives. Page-specific custom wrappers with ad-hoc styling or arbitrary hex codes are prohibited.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SHARED COMPONENT CATALOG                           │
│                                                                         │
│   [Structural Primitives]       [Data & Presentation]      [Feedback & Control] │
│   • AppShell                   • LevelBadge               • PrimaryButton       │
│   • PageHeader                 • MasteryBadge (M0-M10)    • SecondaryButton     │
│   • GlassPanel                 • ConfidenceBadge          • DangerButton        │
│   • RPGCard                    • StatusBadge              • SearchInput         │
│   • SectionCard                • XPProgress               • FilterBar           │
│   • StatCard                   • QuestProgress            • Modal/ConfirmDialog │
│   • InspectorDrawer (Shell)    • EntityChip               • ToastNotification   │
│   • Accordion / Tabs           • EmptyState / Skeleton    • Tooltip             │
│                                                                         │
│   [Domain Content & Graph Primitives]                                   │
│   • SkillNode  • KnowledgeNode  • GraphLegend                           │
│   • ArtifactInspectorContent (5 Relations)                              │
│   • SkillInspectorContent  • KnowledgeInspectorContent                  │
│   • QuestInspectorContent  • ProposalResolutionPicker                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Primitive Specifications

### 2.1 Surfaces & Cards

#### `GlassPanel`
- **Purpose**: Base translucent container for all structured content blocks.
- **Props**: `variant?: 'ground' | 'base' | 'raised' | 'overlay'`, `blur?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'`, `border?: 'subtle' | 'default' | 'raised' | 'gold' | 'none'`, `className?: string`.
- **Styling**: Applies token-driven background opacity (`var(--surface-*)`), backdrop blur (`var(--glass-blur-*)`), border (`var(--border-*)`), and top-edge highlight (`var(--border-highlight-top)`).

#### `RPGCard`
- **Purpose**: Primary interactive card used for activities, quests, artifacts, and summary metrics.
- **Props**: `entityType?: 'activity' | 'quest' | 'skill' | 'knowledge' | 'artifact' | 'evidence' | 'generic'`, `selected?: boolean`.
- **Visual Features**:
  - Translucent glass surface (`var(--surface-base)`).
  - Hover treatment:
    - If `entityType` is specified: entity-specific accent border (e.g. `var(--entity-activity-border)` for activity, `var(--entity-quest-border)` for quest).
    - If `generic`: neutral hover highlight (`var(--border-hover-neutral)` + `var(--surface-hover-neutral)`).
    - **Never** universally applies gold to generic cards.
  - Interactive elevation transition (`var(--hover-surface-elevation)` + `var(--shadow-card)`).

#### `StatCard`
- **Purpose**: Numeric RPG metric display (XP total, completed quests, mastered skills, artifact counts).
- **Structure**:
  - Top: Subdued label (`text-xs text-[var(--text-secondary)] tracking-wider uppercase`).
  - Middle: Prominent tabular number (`text-2xl font-bold font-mono text-[var(--text-primary)]`).
  - Bottom: Contextual subtitle (`text-xs text-[var(--text-muted)]`).

---

### 2.2 Indicators & Badges

#### `LevelBadge`
- **Purpose**: Displays character progression Level (accumulated practice volume).
- **Visual**: Octagonal seal shape with Ancient Gold border (`var(--gold-400)`), dark slate interior, and bold integer (e.g. `LV.14`).

#### `MasteryBadge` (Frozen Single Canonical Representation)
- **Purpose**: Displays verified skill mastery level (**strictly M0 to M10 scale**).
- **Structure**:
  - Mandatory visible text label: `M0`, `M1`, `M2`, ... `M10`.
  - Visual meter: Exactly 5 diamond shapes where each diamond represents empty (`◇`), half (`◐`), or full (`◆`), providing 10 lossless progression steps:
    ```
    M0  = ◇◇◇◇◇
    M1  = ◐◇◇◇◇
    M2  = ◆◇◇◇◇
    M3  = ◆◐◇◇◇
    M4  = ◆◆◇◇◇
    M5  = ◆◆◐◇◇
    M6  = ◆◆◆◇◇
    M7  = ◆◆◆◐◇
    M8  = ◆◆◆◆◇
    M9  = ◆◆◆◆◐
    M10 = ◆◆◆◆◆
    ```
  - Solid gold fill (`var(--gold-400)`) represents verified capability depth; dimmed outline (`var(--border-subtle)`) represents unmastered tiers.

#### `ConfidenceBadge`
- **Purpose**: Displays epistemic confidence metric ($0.00$ to $1.00$). **Confidence is NEVER conflated with verified truth.**
- **Props**: `variant: 'mastery' | 'assessment' | 'knowledge'`, `score: number` ($0.00 - 1.00$), `showLabel?: boolean`.
- **Contextual Variants**:
  1. `variant="mastery"`: Displays *Skill Mastery Retention Confidence* (`Skill.masteryConfidence`).
  2. `variant="assessment"`: Displays *AI Assessment Proposal Confidence* (`Assessment.confidence`).
  3. `variant="knowledge"`: Displays *Knowledge Graph Epistemic Confidence* (`KnowledgeNode.confidence` or `KnowledgeEdge.confidence`, capped $\le 0.95$ for inferred states).
- **Visual Tiers (Dedicated Functional Confidence Tokens, Non-Gold)**:
  - High ($\ge 0.80$): `bg: var(--confidence-high-bg)`, `border: var(--confidence-high-border)`, `text: var(--confidence-high-text)`.
  - Medium ($0.50 - 0.79$): `bg: var(--confidence-medium-bg)`, `border: var(--confidence-medium-border)`, `text: var(--confidence-medium-text)`.
  - Low ($< 0.50$): `bg: var(--confidence-low-bg)`, `border: var(--confidence-low-border)`, `text: var(--confidence-low-text)`.

#### `StatusBadge`
- **Purpose**: Entity lifecycle and authority state indicators.
- **Styling**: Consumes dedicated status tokens (`var(--status-*)`) or authority tokens (`var(--authority-*)`). Must pair color with an explicit semantic icon and text label (never color alone).

---

### 2.3 Progress & Meters

#### `XPProgress`
- **Purpose**: Displays quantitative experience points relative to next level threshold.
- **Visual**: Track (`height: var(--progress-track-height)`, `bg: var(--surface-hover-neutral)`) with gold progression gradient (`var(--gold-500)` to `var(--gold-300)`) and tabular readout (`current / max XP`).

#### `QuestProgress`
- **Purpose**: Displays quest completion percentage ($0\%$ to $100\%$).
- **Visual**: Azure horizon track (`bg: var(--entity-quest-text)`) with milestone tick marks.

---

### 2.4 Navigation & Layout Primitives

#### `PageHeader`
- **Structure**:
  - Left: Song-serif title (`var(--font-serif)`) + category pill + subtitle.
  - Right: Primary actions (`PrimaryButton`, `FilterBar`, or view toggle).

#### `InspectorDrawer` (Structural Shell)
- **Purpose**: Universal structural right-side slide-over container (`z-index: var(--z-drawer)`).
- **Props**: `isOpen: boolean`, `title: string`, `entityType: string`, `statusPill?: ReactNode`, `onClose: () => void`, `actions?: ReactNode`, `children: ReactNode`.
- **Behavior**: Focus-trapped, dismissible via ESC / backdrop, scrollable body. Does NOT hardcode specific domain tabs.

#### `ArtifactInspectorContent`
- **Purpose**: Injected as children into `InspectorDrawer` when inspecting an Artifact.
- **Contains**: 5 standardized relational accordions:
  1. Linked Skills (`artifact_skills`)
  2. Linked Knowledge Nodes (`artifact_knowledge_nodes` with `relation_type`: `cites`, `implements`, `synthesizes`, `evaluates`)
  3. Linked Quests (`artifact_quests`)
  4. Producing/Referencing Activities (`artifact_activities` with `activity_role`: `produced`, `referenced`, `modified`)
  5. Grounding Evidence (`artifact_evidence`)

#### `Tabs` & `Accordion`
- **Visual**: Minimalist underline or boxed glass tabs with neutral selected indicator (`border: var(--selection-neutral-border)`); smooth CSS grid height expansion.

---

### 2.5 Buttons & Interactive Controls

#### `PrimaryButton`
- **Style**: Solid Ancient Gold background (`bg: var(--gold-400)`, `text: var(--text-inverse)`, `font-weight: 600`), subtle hover glow (`var(--glow-gold-subtle)`), active scale depression (`var(--active-surface-depression)`).

#### `SecondaryButton`
- **Style**: Translucent glass background (`bg: var(--surface-base)`, `border: var(--border-default)`, `text: var(--text-primary)`, hover `bg: var(--surface-hover-neutral)`).

#### `DangerButton`
- **Style**: Dedicated functional danger background (`bg: var(--state-danger-bg)`, `border: var(--state-danger-border)`, `text: var(--state-danger-text)`, hover `bg: var(--state-danger-hover)`).

#### `SearchInput` & `FilterBar`
- **Style**: Integrated search field with search icon, clear button, and multi-select pill filters with active state borders.

---

## 3. Graph & Domain-Specific Primitives

### 3.1 `SkillNode` & `KnowledgeNode`
- **`SkillNode`**: Hexagonal SVG node; displays name, M0–M10 badge, and mastery confidence halo.
- **`KnowledgeNode`**: Circular SVG node; displays concept title, authority status icon (`verified`, `inferred`, `rejected`, `superseded`), and 5 Knowledge edge types.

### 3.2 `ArtifactCard`
- **Visual**: Amethyst scholar silk styling (`border: var(--entity-artifact-border)`), displaying:
  - 8-type taxonomy badge (`document`, `code_repository`, `design_spec`, `data_analysis`, `presentation`, `synthesis_note`, `creative_work`, `other`).
  - Version pill (e.g. `v1.2.0`).
  - Lifecycle status (`draft`, `active`, `superseded`, `archived`).
  - Reusability score meter ($0.00$ to $1.00$).
  - Relational count pills (Skills, Knowledge, Quests, Activities, Evidence).

---

## 4. Anti-Duplication Rule

1. **Single Drawer Implementation**: `InspectorDrawer` is the sole drawer component in the codebase. Individual pages inject entity-specific inspector content (`ArtifactInspectorContent`, `SkillInspectorContent`, `KnowledgeInspectorContent`, `QuestInspectorContent`).
2. **Single Modal Implementation**: `ConfirmDialog` and `BaseModal` handle all dialog interactions with uniform backdrop and focus trapping.
3. **Zero Business Logic in Primitives**: Shared primitives are pure presentation components with well-defined TypeScript interfaces.
