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
| - [ ] Code Repo (5)      | | Links: 2 Skills, 4 Knowledge, 1 Quest    | | --- Summary ---        |
| - [ ] Design Spec (3)    | +------------------------------------------+ | Architecture spec for... |
| - [ ] Data Analysis (2)  | | [CODE] Knowledge Canvas ReactFlow Engine | |                          |
|                          | | Type: Code Repo | v2.0 | Reusability: 95%| | --- Linked Skills ---   |
| Status:                  | | Links: 1 Skill, 3 Knowledge, 2 Quests    | | - Neuroscience (Lvl 3) |
| (o) Active (12)          | +------------------------------------------+ |                          |
| ( ) Archived (2)         | | [DESIGN] System Database Schema (0039)   | | --- Knowledge Nodes ---|
| ( ) Drafts (0)           | | Type: Design Spec | v1.0                 | | - LTP (Verified)       |
|                          | +------------------------------------------+ | - Synaptic Spine Growth  |
| Linked Skill Filter:     |                                              |                          |
| [All Skills           v] |                                              | [Archive]   [Delete]     |
+--------------------------+----------------------------------------------+--------------------------+
```

---

## 2. Component Specifications

### 2.1 Artifact Card (Center Grid/List View)
- **Type Icon & Badge**: Visually distinguishes `document`, `code_repository`, `design_spec`, `data_analysis`, etc.
- **Title & Version Pill**: Clear typography with semantic version tag (e.g. `v1.0.0`).
- **Summary Preview**: Truncated 2-line preview of the deliverable abstract.
- **Reusability Score Bar**: Color-coded progress bar (0% - 100%) indicating how reusable the artifact is.
- **Relationship Count Badges**: Pill chips showing attached counts (`2 Skills`, `4 Knowledge Nodes`, `1 Quest`).
- **Selection State**: Amber/gold highlight ring when selected and open in the right drawer.

### 2.2 Right Detail Drawer (Artifact Inspector)
- **Header**: Title, Type pill, Version tag, External link button (opens GitHub / arXiv / Figma in new tab).
- **Metadata Section**: Reusability score meter, created date, last updated date, lifecycle status.
- **Summary & Description**: Formatted markdown rendering for detailed notes.
- **Relational Accordions**:
  - **Linked Skills**: Lists attached skills with player's current level and demonstration rating.
  - **Knowledge Nodes**: Lists synthesized knowledge facts with epistemic badges (`verified`, `inferred`).
  - **Linked Quests**: Lists associated quest goals and deliverable fulfillment flags.
  - **Originating Activities**: Links to the activity sessions during which this artifact was produced.
- **Action Footer**:
  - `[Edit Metadata]` $\rightarrow$ Opens Edit Modal.
  - `[Manage Links]` $\rightarrow$ Opens Relationship Management Dialog.
  - `[Archive / Restore]` $\rightarrow$ Triggers archival toggle.
  - `[Delete]` $\rightarrow$ Opens confirmation dialog with fail-closed provenance check.

---

## 3. Modals & Dialogs

### 3.1 Create Artifact Modal
- Form fields: Title (required), Artifact Type (dropdown), Summary, Description (markdown textarea), Version, External URL, Reusability Score slider (0.00 - 1.00), Initial linked skills/knowledge multiselect.

### 3.2 Edit Metadata Modal
- Allows updating title, summary, description, version, external URL, reusability score, and lifecycle status.
- Strictly validated on client and server.

### 3.3 Delete / Archive Confirmation Dialog
- Warns the user if the artifact is actively referenced by Knowledge Provenance.
- If referenced: Proactively advises the user to **Archive** rather than Delete to preserve historical graph integrity.

---

## 4. Design-Sequence Checkpoint

> [!IMPORTANT]
> **Design-Sequence Checkpoint (Pre-Stage 7C)**:
> Before building Stage 7C UI components, we will pause and evaluate extracting:
> 1. Global App Shell & Navigation Bar (unifying Dashboard, Quests, Skills, Knowledge Map, and Artifacts).
> 2. Shared Drawer & Inspector Primitives (unifying Knowledge Detail Drawer and Artifact Detail Drawer).
> 3. Shared Design Tokens (colors, typography, cards, badges).
