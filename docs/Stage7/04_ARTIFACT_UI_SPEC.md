# Stage 7 — Artifact UI & Workspace Specification

> **Status**: DESIGN FREEZE  
> **Milestone**: Stage 7 (Artifact Management & Synthesis System)  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), Global Visual Design Freeze (PREREQUISITE)  
> **Related Documents**: `01_ARTIFACT_DOMAIN_MODEL.md`, `02_ARTIFACT_AUTHORITY_RULES.md`, `03_ARTIFACT_API_AND_STATE.md`, `05_STAGE7_IMPLEMENTATION_PLAN.md`, `06_STAGE7_ACCEPTANCE_GATES.md`

---

## 1. User Experience & Layout Architecture

The Artifact workspace lives at `/artifacts` and is rendered inside the global `AppShell` (inheriting `AppSidebar` and `AppHeader`), providing a cohesive 3-column workspace for reviewing, organizing, and inspecting durable work products.

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ AppShell                                                                                           │
│ ┌──────────────┬─────────────────────────────────────────────────────────────────────────────────┐ │
│ │ AppSidebar   │ AppHeader: 产出台 (Artifacts) / Breadcrumbs • LV.14 • XP Progress               │ │
│ │ (Global Nav) ├─────────────────────────────────────────────────────────────────────────────────┤ │
│ │              │ AppWorkspace                                                                    │ │
│ │ • Dashboard  │ ┌─────────────────────────┬───────────────────────────────┬───────────────────┐ │ │
│ │ • Quests     │ │ Left: Filter & Taxonomy │ Center: Artifact Gallery/List │ InspectorDrawer   │ │ │
│ │ • Skills     │ │ [Search artifacts...]   │ [+ New Artifact] [Grid|List]  │ (ArtifactInspector│ │ │
│ │ • Knowledge  │ │                         │ ┌───────────────────────────┐ │  Content)         │ │ │
│ │ • Artifacts* │ │ Artifact Types (8):     │ │ [RFC] Neural Plasticity   │ │ Title: LTP RFC    │ │ │
│ │ • Settings   │ │ - [x] All Types (14)    │ │ Type: Document | v1.2.0   │ │ Type: Design Spec │ │ │
│ │              │ │ - [ ] Document (4)      │ │ Reusability: 0.85         │ │ Reusability: 0.90 │ │ │
│ │              │ │ - [ ] Code Repo (5)     │ │ Links: 2 Sk, 4 Kn, 1 Ev   │ │ External: [PR #8] │ │ │
│ │              │ │ - [ ] Design Spec (3)   │ └───────────────────────────┘ │ --- Summary ---   │ │ │
│ │              │ │                         │ ┌───────────────────────────┐ │ Spec for LTP...   │ │ │
│ │              │ │ Status Filter:          │ │ [CODE] ReactFlow Canvas   │ │ --- Relations --│ │ │
│ │              │ │ (o) Active (12)         │ │ Type: Code Repo | v2.0.0  │ │ • Skills (Demo) │ │ │
│ │              │ │ ( ) Drafts (2)          │ │ Reusability: 0.95         │ │ • Knowledge (4) │ │ │
│ │              │ │ ( ) Superseded (1)      │ └───────────────────────────┘ │ • Quests (1)      │ │ │
│ │              │ │ ( ) Archived (2)        │ ┌───────────────────────────┐ │ • Activities (1)  │ │ │
│ │              │ │                         │ │ [SPEC] Database Schema    │ │ • Evidence (E4) │ │ │
│ │              │ │ Linked Skill Filter:    │ │ Type: Design Spec | Super │ │                   │ │ │
│ │              │ │ [All Skills          v] │ └───────────────────────────┘ │ [Edit]  [Archive]│ │ │
│ │ [Collapse <] │ └─────────────────────────┴───────────────────────────────┴───────────────────┘ │ │
│ └──────────────┴─────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1 Artifact Card (`ArtifactCard`)
- **Type Icon & Badge**: Visually distinguishes the 8 canonical types (`document`, `code_repository`, `design_spec`, `data_analysis`, `presentation`, `synthesis_note`, `creative_work`, `other`).
- **Title & Version Pill**: Clear typography with semantic version tag (e.g. `v1.0.0`).
- **Lifecycle Badge**: Dedicated `StatusBadge` styling consuming frozen tokens (`var(--status-draft-*)`, `var(--status-active-*)`, `var(--status-superseded-*)`, `var(--status-archived-*)`).
- **Summary Preview**: Truncated 2-line preview of the deliverable abstract.
- **Reusability Score Bar**: Color-coded progress bar (0.00 - 1.00) indicating deliverable reusability.
- **Relationship Count Badges**: Pill chips showing attached counts (`2 Skills`, `4 Knowledge Nodes`, `1 Quest`, `1 Evidence`).
- **Selection State**: Entity selection border (`var(--entity-artifact-border)` / `var(--selection-neutral-border)`) when active. Generic selection does NOT consume progression Gold.

### 2.2 Right Detail Drawer (`ArtifactInspectorContent`)
- **Header**: Title, Type pill, Version tag, External link button (opens GitHub / arXiv / Figma in new tab).
- **Metadata Section**: Reusability score meter, created date, last updated date, lifecycle status.
- **Summary & Description**: Formatted markdown rendering for detailed notes.
- **Relational Accordions (All 5 Entity Types)**:
  - **Linked Skills**: Lists attached skills directly from the frozen `ArtifactSkillLink` read model:
    - Skill name (`name`)
    - Cumulative Skill Level (`level`, e.g. `Lvl 3` from `ArtifactSkillLink.level`)
    - Artifact Demonstration Level (`demonstrationLevel`, integer 1..5, e.g. `Demonstration Level 4/5` from `ArtifactSkillLink.demonstrationLevel`).
    - *Invariant*: `Artifact Skill Demonstration Level (1..5) != Skill Mastery (M0–M10)`. Demonstration level is never displayed as M0–M10.
  - **Knowledge Nodes**: Lists synthesized/cited knowledge concepts with 4 authority badges (`verified`, `inferred`, `rejected`, `superseded`), epistemic confidence ($\le 0.95$ for inferred), and 4 relation types (`cites`, `implements`, `synthesizes`, `evaluates`).
  - **Linked Quests**: Lists associated quest goals and deliverable fulfillment flags (`isPrimaryDeliverable`).
  - **Originating Activities**: Links to the activity sessions during which this artifact was produced (`activityRole: produced | referenced | modified`).
  - **Linked Evidence**: Lists attached mastery evidence records with `evidenceLevel` (**E0..E6**), `verified` state badge, and audit description.
- **Action Footer**:
  - `[Edit Metadata]` $\rightarrow$ Opens Edit Modal.
  - `[Manage Links]` $\rightarrow$ Opens Relationship Management Dialog.
  - `[Archive / Restore]` $\rightarrow$ Triggers archival toggle (sets `lifecycle_status = 'archived'` / `'active'`).
  - `[Restore Superseded]` $\rightarrow$ (When viewing a superseded artifact) restores status back to `active` or `draft`.
  - `[Delete]` $\rightarrow$ Opens confirmation dialog with fail-closed provenance and evidence checks.

---

## 3. Modals & Dialogs

### 3.1 Create Artifact Modal
- **Form Fields**: Title (required), Artifact Type (dropdown of 8 canonical types), Summary, Description (markdown textarea), Version (default `'1.0'`), External URL, Reusability Score slider (`0.00` - `1.00`), Initial Status (`draft` / `active`).
- **Initial Relation Pickers (All 5 Entities)**: Multiselect dropdowns for attaching Activities, Skills, Knowledge Nodes, Quests, and Evidence records.

### 3.2 Edit Metadata Modal
- Allows updating title, artifact type, summary, description, version, external URL, reusability score, and lifecycle status.
- Strictly validated on client and server against PostgreSQL column whitelist.

### 3.3 Manage Links Dialog (Relationship Manager)
- Tabbed or multi-section modal for batch attaching / detaching links across:
  1. **Activities**: Select originating activity and assign role (`produced`, `referenced`, `modified`).
  2. **Skills**: Select target skill and assign `demonstrationLevel` (integer 1..5).
  3. **Knowledge Nodes**: Select concept/claim and assign relation type (`cites`, `implements`, `synthesizes`, `evaluates`).
  4. **Quests**: Select quest and toggle `isPrimaryDeliverable`.
  5. **Evidence**: Attach / detach proof records (`public.evidence_records`).

### 3.4 Delete / Archive Confirmation Dialog
- Evaluates whether the artifact is actively referenced:
  1. **Knowledge Provenance**: Referenced by `knowledge_nodes` or `knowledge_edges` (`source_type = 'artifact'`).
  2. **Evidence Grounding**: Attached to `evidence_records` via `artifact_evidence`.
- **Fail-Closed Warning**: If either condition is true, physical deletion is **BLOCKED** by PostgreSQL (`23503`). The dialog explicitly alerts the player to **Archive** rather than Delete to protect historical grounding integrity.

### 3.5 Assessment Confirmation: Artifact Resolution UX (Stage 7C Future)
- When reviewing an Activity Assessment that proposes deliverables (`artifactProposals`), the confirmation dialog presents an interactive resolution control for each proposed item (bound by its `proposalIndex`):
  1. **Create New (`create`)**: Commits the stored proposal as a new Artifact deliverable (`role = 'produced'`). Allows optional inline edits to whitelisted fields (`approvedOverrides`: title, artifactType, reusabilityScore).
  2. **Link Existing (`existing`)**: Opens a search dropdown of the player's existing Artifacts to link by stable UUID, selecting role (`modified` or `referenced`).
  3. **Ignore (`ignore`)**: Discards the proposal during settlement without creating or linking an Artifact.
- Exact $N$-of-$N$ resolution coverage is validated before submission.

---

## 4. Implementation Prerequisite

> [!IMPORTANT]
> **Prerequisite for Stage 7C UI Implementation**:
> Stage 7C UI implementation begins directly by consuming the **FINAL FROZEN Global Visual Design System** (`AppShell`, `InspectorDrawer`, `ArtifactInspectorContent`, `GlassPanel`, `RPGCard`, `StatusBadge`, and shared primitives). No further design-sequence checkpoints are required.
