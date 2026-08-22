# Stage 5 — Skill Tree Acceptance Gates & Review Checklist

> **Status**: PROPOSED / DESIGN FREEZE CANDIDATE  
> **Target Milestone**: Stage 5 (Skill Tree)  
> **Related Rules**: `docs/Design ChatGPT/04_MVP_ROADMAP_AND_ACCEPTANCE.md`, `docs/Design ChatGPT/08_TESTING_EVALS_AND_QA.md`

---

## 1. Sub-Stage Acceptance Gates

Each sub-stage PR must strictly meet its corresponding gate criteria before proceeding to the next.

### Gate 5A — Schema, Graph Invariants & Authority
- [ ] **Table Integrity**: `public.skill_edges` table created with `source_skill_id`, `target_skill_id`, `relation_type` (`prerequisite`, `contains`, `supports`).
- [ ] **Anti-Self & Anti-Duplicate**: Database constraints strictly block self-referencing edges (`source == target`) and duplicate edges of the same relation.
- [ ] **Anti-Cycle DAG Enforcement**: Trigger function or constraint strictly rejects cycles on `prerequisite` and `contains` relations.
- [ ] **Tenant Isolation**: Composite foreign keys or RLS ensure user A cannot reference or create edges pointing to user B's skills.
- [ ] **Authority Matrix**: Direct INSERT/UPDATE of raw `xp`, `level`, and `mastery_level` by standard authenticated client is revoked; only authorized settlement RPC or metadata updates are permitted.
- [ ] **Repository Parity**: Both `DemoRepository` and `SupabaseRepository` implement all `Skill` and `SkillEdge` operations with identical behavioral semantics.

---

### Gate 5B — API & Derived State Determination
- [ ] **Deterministic Derived State**: `computeSkillDerivedState` correctly computes `locked`, `available`, `learning`, `proficient`, `advanced`, and `archived` without state collisions.
- [ ] **Anti-Conflict Rule**: A skill with low mastery (e.g. M1) cannot under any circumstance yield `proficient` or `advanced`.
- [ ] **API Endpoint Completeness**:
  - `GET /api/skills`: Returns domains, positioned nodes with derived state, and styled edges;
  - `GET /api/skills/[id]`: Returns full skill details, evidence timeline, mastery history, and prerequisite checklist;
  - `POST /api/skills/edges`: Validates and adds edges; returns `400` on cycles or invalid relations;
  - `DELETE /api/skills/edges/[id]`: Deletes edge safely;
  - `PATCH /api/skills/[id]`: Updates display metadata safely.
- [ ] **Test Coverage**: Dedicated test suite covers all API routes and derived state edge cases with 100% pass rate.

---

### Gate 5C — UI & Graph Visualization
- [ ] **3-Column Architecture**:
  - Left: Domain filter tree & search bar;
  - Center: `@xyflow/react` interactive graph with smooth pan/zoom, MiniMap, and reset controls;
  - Right: Collapsible Skill Detail Panel with Evidence timeline and Prerequisites checklist.
- [ ] **Rich Node Rendering**: Custom `SkillNode` renders name, level pill (`Lv.X`), mastery rank (`M_X`), confidence percentage, and distinct visual borders corresponding to derived state (`locked`, `learning`, `proficient`, `advanced`).
- [ ] **Edge Visual Discrimination**: Distinct stroke and marker styles for `prerequisite` (solid sky arrow), `contains` (dashed purple), and `supports` (subtle dotted zinc).
- [ ] **Evidence & Audit Feed**: Detail panel clearly displays linked `evidence_records`, activity source, and verification checkmark.
- [ ] **Zero Regression**: Existing `/dashboard`, `/quests`, and `/login` pages continue functioning seamlessly.

---

### Gate 5D — Security, Performance & System Invariants
- [ ] **RLS Coverage**: All queries on `skills`, `skill_edges`, and `domains` are verified to be strictly scoped to `auth.uid() = user_id`.
- [ ] **Zero Credential Leaks**: CI export and error diagnostics remain 100% sanitized.
- [ ] **Growth Engine Invariants**:
  - `Time is not XP`;
  - `XP is not Mastery`;
  - `High Mastery requires Evidence`;
  - `Final XP is computed by deterministic Growth Engine code`;
  - `pnpm harness:deterministic` passes 100%.
- [ ] **CI Pipeline Verification**: Both `check` and `supabase-integration` GitHub Actions jobs pass on the feature branch.

---

## 2. Final Stage 5 Sign-off Criteria

| Requirement | Verification Method | Status |
|---|---|---|
| **Domain Model & Ontology Separation** | Audit against `01_SKILL_TREE_DOMAIN_MODEL.md` | Pending Review |
| **Authority & Evidence Traceability** | Audit against `02_SKILL_TREE_AUTHORITY_RULES.md` | Pending Review |
| **Derived State & API Contract** | Audit against `03_SKILL_TREE_API_AND_STATE.md` | Pending Review |
| **UI Design & Canvas Usability** | Audit against `04_SKILL_TREE_UI_SPEC.md` | Pending Review |
| **Phased Plan & Scope Containment** | Audit against `05_STAGE5_IMPLEMENTATION_PLAN.md` | Pending Review |
| **Automated Test Suite** | `pnpm test` + `pnpm harness:deterministic` | Target 100% Pass |
| **Live CI Full Stack** | GitHub Actions Run on feature branch | Target GREEN 🟢 |
