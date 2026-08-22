# Stage 5 — Skill Tree Implementation Plan (5A–5D)

> **Status**: PROPOSED / DESIGN FREEZE (ROUND 3)  
> **Target Milestone**: Stage 5 (Skill Tree)  
> **Pre-requisite**: PR #1 Stabilization Merged (Commit `43fdbc8`)

---

## 1. Out-of-Scope Declaration (Hard Boundaries)

To protect delivery velocity and system stability, the following features are **strictly prohibited** in Stage 5:

- ❌ **Knowledge Map UI / Concept Graph** (Deferred to Stage 6)
- ❌ **Artifact Library & Ingestion Pipeline** (Deferred to Stage 7)
- ❌ **Review System / Spaced Repetition Engine & Auto-Decay Worker** (Deferred to Stage 8)
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
│ Stage 5A: Domain Model, Schema, Evidence & Graph Authority             │
│ • Database migration: Composite FKs (skills, skill_edges, domains)     │
│ • Single-parent contains + DAG anti-cycle + supports directed graph    │
│ • Settlement upgrade: SkillResolutionInput union + MasteryAction 3-stat│
│ • Authoritative evidence_records atomic write in settle_activity       │
│ • Evidence FK integrity: mastery_events(evidence_id) -> evidence(id)   │
│ • Domain hierarchy & skill metadata RPC (update_skill_metadata)        │
│ • Repository port & store implementations (Demo + Supabase)            │
│ • Unit & repository test suite (including cross-tenant DB tests)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 5B: Skill API & Total Derived State Calculation                  │
│ • Total deterministic derived state engine (Truth Table & Boundaries)  │
│ • Hard prerequisite evaluator (M >= 2 && conf >= 0.5)                  │
│ • API Routes: GET /api/skills, GET /api/skills/[id]                   │
│ • Edge management: POST /api/skills/edges (409 on cycle), DELETE edge  │
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
│ • RLS & cross-tenant isolation verification (composite FK tests)       │
│ • Stage 5 Acceptance Gates validation & Milestone Freeze               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Sub-Stage Specifications

### 3.1 Stage 5A: Skill Domain Model, Composite FKs, Evidence & Authority
- **Objectives**:
  1. Add migration `supabase/migrations/0036_skill_edges_and_tenant_fks.sql`:
     - Add composite unique constraints: `skills(user_id, id)` and `domains(user_id, id)`;
     - Enforce domain tenant hierarchy: `domains(user_id, parent_id) REFERENCES domains(user_id, id) ON DELETE SET NULL`;
     - Enforce skill domain tenant safety: `skills(user_id, domain_id) REFERENCES domains(user_id, id) ON DELETE SET NULL`;
     - Create `public.skill_edges` with `(user_id, source_skill_id)` and `(user_id, target_skill_id)` referencing `skills(user_id, id) ON DELETE CASCADE`;
     - Add partial unique index: `UNIQUE(user_id, target_skill_id) WHERE relation_type = 'contains'` (Single-parent invariant);
     - Add unique index: `UNIQUE(user_id, source_skill_id, target_skill_id, relation_type)`;
     - Add DB trigger function `prevent_skill_edge_cycle()` to block cycles on `prerequisite` and `contains`;
     - Ensure `supports` allows directed synergy without artificial cycle rejection;
     - Add foreign key `mastery_events(evidence_id) REFERENCES public.evidence_records(id) ON DELETE SET NULL` (P2 Evidence FK Integrity);
     - Configure strict RLS on `public.skill_edges`.
  2. Add migration `supabase/migrations/0037_skill_settlement_and_evidence.sql`:
     - Upgrade `settle_activity` RPC to accept `SkillResolutionInput` (`existing` with user ownership check vs `create` with normalized name check);
     - Preserve existing `MasteryAction` 3-state protocol (`none` / `upgrade` / `request_verification`) and pending `mastery_verifications` production;
     - Atomically insert `evidence_records` during activity settlement;
     - Create `update_skill_metadata` RPC with domain ownership check, whitelist update, and rename alias conservation;
     - Revoke direct `UPDATE` on `public.skills` for authenticated users.
  3. Extend `Repository` interface:
     - `listSkillEdges(): Promise<SkillEdge[]>`
     - `addEdge(edge: NewSkillEdgeInput): Promise<SkillEdge>`
     - `deleteEdge(id: string): Promise<void>`
     - `getSkillDetails(id: string): Promise<SkillDetailSnapshot | null>`
     - `updateSkillMetadata(id: string, updates: UpdateSkillMetadataInput): Promise<SkillState>`
  4. Update `DemoRepository` and `SupabaseRepository` to maintain behavioral parity.
- **Verification**:
  - `tests/skill-edges-schema.test.ts`: Anti-cycle, single-parent contains, composite FK cross-tenant rejection tests (User A source/target pointing to User B rejected by DB).
  - `tests/skill-settlement-authority.test.ts`: Stable-ID existing resolution vs create resolution, evidence_records write tests, MasteryAction 3-state regression test.

---

### 3.2 Stage 5B: Skill API + Derived State
- **Objectives**:
  1. Implement total deterministic `computeSkillDerivedState()` in `src/lib/skills/derived-state.ts` (100% truth table coverage);
  2. Implement hard prerequisite evaluator ($M \ge 2 \land \text{conf} \ge 0.5$, Level cannot substitute);
  3. Implement DAG topological layout calculation in `src/lib/skills/layout.ts`;
  4. Implement API endpoints:
     - `GET /api/skills`: Returns hierarchical domains, positioned nodes with derived state, styled edges;
     - `GET /api/skills/[id]`: Returns deep metadata, evidence records, mastery events, prerequisite checklist;
     - `POST /api/skills/edges`: Validates and inserts relationship edges; returns `409 Conflict` on cycles or single-parent conflicts;
     - `DELETE /api/skills/edges/[id]`: Deletes relationship edge;
     - `PATCH /api/skills/[id]`: Invokes `update_skill_metadata` RPC (with domain ownership check).
- **Verification**:
  - `tests/skill-derived-state.test.ts`: Unit tests covering all 12 boundary cases in Truth Table.
  - `tests/api-skills.test.ts`: API route tests with auth, error codes (`409`, `400`, `404`), and payload validation.

---

### 3.3 Stage 5C: Skill Tree UI + Detail Panel
- **Objectives**:
  1. Refactor `src/app/skills/page.tsx` into a modular 3-column architecture:
     - `src/app/skills/components/DomainFilterPanel.tsx` (Left panel)
     - `src/app/skills/components/SkillGraphCanvas.tsx` (Center canvas with `@xyflow/react`)
     - `src/app/skills/components/SkillNode.tsx` (Custom rich node with visual derived state)
     - `src/app/skills/components/SkillDetailPanel.tsx` (Right collapsible drawer)
     - `src/app/skills/components/EvidenceTimeline.tsx` (Evidence & activity feed)
  2. Maintain zero flicker, smooth zooming, fit-to-view, and responsive layout.
- **Verification**:
  - `pnpm lint`, `pnpm build`, interactive UI verification.

---

### 3.4 Stage 5D: Integration, Security & Freeze
- **Objectives**:
  1. Run full test suite with Supabase local stack (`supabase start`);
  2. Add E2E tests in `tests/e2e-skills-browser.test.ts`;
  3. Verify RLS and tenant isolation in `tests/rls-skills.test.ts` (including cross-tenant foreign key blocks);
  4. Run `pnpm harness:deterministic` and `pnpm test`.
- **Verification**:
  - GitHub Actions `check` and `supabase-integration` all green.
