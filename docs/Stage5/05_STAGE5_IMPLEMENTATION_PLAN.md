# Stage 5 — Skill Tree Implementation Plan (5A–5D)

> **Status**: PROPOSED / DESIGN FREEZE CANDIDATE  
> **Target Milestone**: Stage 5 (Skill Tree)  
> **Pre-requisite**: PR #1 Stabilization Merged (Commit `43fdbc8`)

---

## 1. Out-of-Scope Declaration (Hard Boundaries)

To protect delivery velocity and system stability, the following features are **strictly prohibited** in Stage 5:

- ❌ **Knowledge Map UI / Concept Graph** (Deferred to Stage 6)
- ❌ **Artifact Library & Ingestion Pipeline** (Deferred to Stage 7)
- ❌ **Review System / Spaced Repetition Engine** (Deferred to Stage 8)
- ❌ **PWA / Mobile Native Shell**
- ❌ **Third-party Integrations** (Zotero, GitHub, Obsidian, Notion)
- ❌ **Vector DB / Semantic Embeddings Engine**
- ❌ **Freeform Drag-and-Drop Persistent Graph Layout Editor** (Coordinates are computed deterministically via layered DAG layout)
- ❌ **Achievement / Badge / Trophy System**
- ❌ **New Boss Encounter Mechanics**

---

## 2. Phased Implementation Roadmap (5A–5D)

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 5A: Domain Model, Schema & Graph Authority                       │
│ • Database migration: public.skill_edges + constraints + anti-cycle   │
│ • Domain hierarchy support in repository layer                         │
│ • Repository port & store implementations (Demo + Supabase)            │
│ • Unit & repository test suite                                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 5B: Skill API & Derived State Calculation                        │
│ • Pure derived state engine (locked/available/learning/proficient/...) │
│ • API Routes: GET /api/skills, GET /api/skills/[id]                   │
│ • Edge management: POST /api/skills/edges, DELETE /api/skills/edges    │
│ • Metadata update: PATCH /api/skills/[id]                              │
│ • API integration test suite                                           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 5C: 3-Column UI & Interactive Skill Tree Canvas                  │
│ • Upgrade /skills page with Left Domain Filter, Center Canvas, Right   │
│ • Custom ReactFlow Node (Lv, M-Rank, Confidence, State badges)         │
│ • Distinct Edge styling (prerequisite / contains / supports)           │
│ • Right Detail Panel with Evidence Timeline & Prereq checklist         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 5D: End-to-End Integration, Security Matrix & Freeze             │
│ • Database-backed tests against local Supabase stack                   │
│ • E2E Playwright/Browser tests for /skills exploration                 │
│ • RLS & cross-tenant isolation verification                            │
│ • Stage 5 Acceptance Gates validation & Milestone Freeze               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Sub-Stage Specifications

### 3.1 Stage 5A: Skill Domain Model + Authority
- **Objectives**:
  1. Add `supabase/migrations/0036_skill_edges.sql`:
     - Create `public.skill_edges` with `source_skill_id`, `target_skill_id`, `relation_type` (`prerequisite`, `contains`, `supports`);
     - Add foreign keys, tenant isolation constraint, anti-self-edge check (`source != target`), and anti-duplicate unique constraint;
     - Add DB trigger function `prevent_skill_edge_cycle()` for `prerequisite` and `contains` DAG integrity;
     - Configure strict RLS policies on `public.skill_edges` and tighten update rules on `public.skills`.
  2. Extend `Repository` interface:
     - `listSkillEdges(): Promise<SkillEdge[]>`
     - `addEdge(edge: NewSkillEdgeInput): Promise<SkillEdge>`
     - `deleteEdge(id: string): Promise<void>`
     - `getSkillDetails(id: string): Promise<SkillDetailSnapshot | null>`
     - `updateSkillMetadata(id: string, updates: UpdateSkillInput): Promise<SkillState>`
  3. Update `DemoRepository` and `SupabaseRepository` to implement the new methods.
- **Verification**:
  - `tests/skill-edges-schema.test.ts`: Anti-cycle, tenant isolation, anti-self edge tests.

---

### 3.2 Stage 5B: Skill API + Derived State
- **Objectives**:
  1. Implement deterministic `computeSkillDerivedState()` function in `src/lib/skills/derived-state.ts`;
  2. Implement DAG topological layout calculation in `src/lib/skills/layout.ts`;
  3. Implement API endpoints:
     - `GET /api/skills`: Returns hierarchical domains, positioned nodes with derived state, styled edges;
     - `GET /api/skills/[id]`: Returns deep metadata, evidence records, mastery events, prerequisite checklist;
     - `POST /api/skills/edges`: Validates and inserts relationship edges;
     - `DELETE /api/skills/edges/[id]`: Deletes relationship edge;
     - `PATCH /api/skills/[id]`: Safely updates display metadata.
- **Verification**:
  - `tests/skill-derived-state.test.ts`: Unit test for all 6 derived states.
  - `tests/api-skills.test.ts`: API route tests with auth, error, and payload validation.

---

### 3.3 Stage 5C: Skill Tree UI + Detail Panel
- **Objectives**:
  1. Refactor `src/app/skills/page.tsx` into a modular 3-column architecture:
     - `src/app/skills/components/DomainFilterPanel.tsx` (Left panel)
     - `src/app/skills/components/SkillGraphCanvas.tsx` (Center canvas with `@xyflow/react`)
     - `src/app/skills/components/SkillNode.tsx` (Custom rich node)
     - `src/app/skills/components/SkillDetailPanel.tsx` (Right collapsible drawer)
     - `src/app/skills/components/EvidenceTimeline.tsx` (Evidence & activity list)
  2. Maintain zero flicker, smooth zooming, fit-to-view, and responsive layout.
- **Verification**:
  - `pnpm lint`, `pnpm build`, interactive UI verification.

---

### 3.4 Stage 5D: Integration, Security & Freeze
- **Objectives**:
  1. Run full test suite with Supabase local stack (`supabase start`);
  2. Add E2E tests in `tests/e2e-skills-browser.test.ts`;
  3. Verify RLS and tenant isolation in `tests/rls-skills.test.ts`;
  4. Run `pnpm harness:deterministic` and `pnpm test`.
- **Verification**:
  - GitHub Actions `check` and `supabase-integration` all green.
