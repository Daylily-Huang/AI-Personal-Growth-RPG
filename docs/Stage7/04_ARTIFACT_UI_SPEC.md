# Stage 7 — Artifact UI & Workspace Specification

> **Status**: DESIGN FREEZE  
> **Milestone**: Stage 7 (Artifact Management & Synthesis System)  
> **Dependencies**: Stage 0–6 (FROZEN)  
> **Related Documents**: `01_ARTIFACT_DOMAIN_MODEL.md`, `02_ARTIFACT_AUTHORITY_RULES.md`, `03_ARTIFACT_API_AND_STATE.md`, `05_STAGE7_IMPLEMENTATION_PLAN.md`, `06_STAGE7_ACCEPTANCE_GATES.md`

---

## 1. User Experience & Layout Architecture

The Artifact workspace lives at `/artifacts` and provides an intuitive, high-density dashboard for reviewing, organizing, and inspecting durable work products.

```text
+----------------------------------------------------------------------------------------------------+
| Header: AI Personal Growth RPG | Quests | Skills | Knowledge Map | [Artifacts] | Dashboard | User  |
+--------------------------+----------------------------------------------+--------------------------+
| Left: Filter & Taxonomy  | Center: Artifact Gallery & List              | Right: Detail Drawer     |
| [Search artifacts...]    | + [+ New Artifact]    [Grid | List]          | [Title: LTP RFC] [Edit]  |
|                          |                                              | Type: Design Spec (1.0)  |
| Types:                   | +------------------------------------------+ | Reusability: 90% (High)  |
| - [x] All Types (14)     | | [RFC] Neural Plasticity Paper            | | External: [GitHub PR #8] |
| - [ ] Document (4)       | | Type: Document | v1.2 | Reusability: 85% | |                          |
| - [ ] Code Repo (5)      | | Links: 2 Skills, 4 Nodes, 1 Quest, 1 Ev  | | --- Summary ---        |
| - [ ] Design Spec (3)    | +------------------------------------------+ | Architecture spec for... |
| - [ ] Data Analysis (2)  | | [CODE] Knowledge Canvas ReactFlow Engine | |                          |
|                          | | Type: Code Repo | v2.0 | Reusability: 95%| | --- Linked Skills ---   |
| Status Filter:           | | Links: 1 Skill, 3 Nodes, 2 Quests        | | - Neuroscience (Lvl 3) |
| (o) Active (12)          | +------------------------------------------+ |                          |
| ( ) Drafts (2)           | | [DESIGN] System Database Schema (0039)   | | --- Knowledge Nodes ---|
| ( ) Superseded (1)       | | Type: Design Spec | Superseded           | | - LTP (Verified)       |
| ( ) Archived (2)         | +------------------------------------------+ |                          |
| ( ) All (17)             |                                              | --- Linked Evidence ---  |
|                          |                                              | - Level 4 (Verified)     |
| Linked Skill Filter:     |                                              |   Grounding for Neuro    |
| [All Skills           v] |                                              |                          |
|                          |                                              | [Archive]   [Delete]     |
+--------------------------+----------------------------------------------+--------------------------+
```

---

## 2. Component Specifications

### 2.1 Artifact Card (Center Grid/List View)
- **Type Icon & Badge**: Visually distinguishes `document`, `code_repository`, `design_spec`, `data_analysis`, `presentation`, `synthesis_note`, `creative_work`, `other`.
- **Title & Version Pill**: Clear typography with semantic version tag (e.g. `v1.0.0`).
- **Lifecycle Badge**: Distinct visual styling for `Draft` (dashed outline), `Active` (solid slate), `Superseded` (muted indigo badge with rewind icon), and `Archived` (muted gray).
- **Summary Preview**: Truncated 2-line preview of the deliverable abstract.
- **Reusability Score Bar**: Color-coded progress bar (0% - 100%) indicating how reusable the artifact is.
- **Relationship Count Badges**: Pill chips showing attached counts (`2 Skills`, `4 Knowledge Nodes`, `1 Quest`, `1 Evidence`).
- **Selection State**: Amber/gold highlight ring when selected and open in the right drawer.

### 2.2 Right Detail Drawer (Artifact Inspector)
- **Header**: Title, Type pill, Version tag, External link button (opens GitHub / arXiv / Figma in new tab).
- **Metadata Section**: Reusability score meter, created date, last updated date, lifecycle status.
- **Summary & Description**: Formatted markdown rendering for detailed notes.
- **Relational Accordions (All 5 Entity Types)**:
  - **Linked Skills**: Lists attached skills with player's current level and demonstration rating (1..5).
  - **Knowledge Nodes**: Lists synthesized/cited knowledge facts with epistemic badges (`verified`, `inferred`) and relation types (`synthesizes`, `cites`, `implements`, `evaluates`).
  - **Linked Quests**: Lists associated quest goals and deliverable fulfillment flags (`isPrimaryDeliverable`).
  - **Originating Activities**: Links to the activity sessions during which this artifact was produced (`activityRole: produced | referenced | modified`).
  - **Linked Evidence**: Lists attached mastery evidence records with `evidenceLevel` (E0..E6), `verified` state badge, and audit description.
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
  2. **Skills**: Select target skill and assign demonstration level (1..5).
  3. **Knowledge Nodes**: Select concept/claim and assign relation type (`cites`, `implements`, `synthesizes`, `evaluates`).
  4. **Quests**: Select quest and toggle `isPrimaryDeliverable`.
  5. **Evidence**: Attach / detach proof records (`public.evidence_records`).

### 3.4 Delete / Archive Confirmation Dialog
- Evaluates whether the artifact is actively referenced:
  1. **Knowledge Provenance**: Referenced by `knowledge_nodes` or `knowledge_edges` (`source_type = 'artifact'`).
  2. **Evidence Grounding**: Attached to `evidence_records` via `artifact_evidence`.
- **Fail-Closed Warning**: If either condition is true, physical deletion is **BLOCKED** by PostgreSQL (`23503`). The dialog explicitly alerts the player to **Archive** rather than Delete to protect historical grounding integrity.

---

## 4. Design-Sequence Checkpoint

> [!IMPORTANT]
> **Design-Sequence Checkpoint (Pre-Stage 7C)**:
> Before building Stage 7C UI components, we will pause and evaluate extracting:
> 1. Global App Shell & Navigation Bar (unifying Dashboard, Quests, Skills, Knowledge Map, and Artifacts).
> 2. Shared Drawer & Inspector Primitives (unifying Knowledge Detail Drawer and Artifact Detail Drawer).
> 3. Shared Design Tokens (colors, typography, cards, badges).
