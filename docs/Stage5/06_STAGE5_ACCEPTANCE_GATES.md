# Stage 5 — Skill Tree Acceptance Gates & Review Checklist

> **Status**: PROPOSED / DESIGN FREEZE (ROUND 2)  
> **Target Milestone**: Stage 5 (Skill Tree)  
> **Related Rules**: `docs/Design ChatGPT/04_MVP_ROADMAP_AND_ACCEPTANCE.md`, `docs/Design ChatGPT/08_TESTING_EVALS_AND_QA.md`

---

## 1. Sub-Stage Acceptance Gates

Each sub-stage PR must strictly meet its corresponding gate criteria before proceeding to the next.

### Gate 5A — Schema, Authority & Evidence Integrity
- [ ] **Table Integrity**: `public.skill_edges` table created with `source_skill_id`, `target_skill_id`, `relation_type` (`prerequisite`, `contains`, `supports`).
- [ ] **Single-Parent Contains Invariant**: Database partial unique index (`UNIQUE(user_id, target_skill_id) WHERE relation_type = 'contains'`) strictly guarantees a child skill has at most one contains parent.
- [ ] **Anti-Cycle DAG Enforcement**: Trigger function strictly rejects cycles on `prerequisite` and `contains` relations; `supports` allows directed synergy.
- [ ] **Anti-Self & Anti-Duplicate**: Database constraints strictly block self-referencing edges (`source == target`) and duplicate edges of the same relation.
- [ ] **Settlement Stable-ID Authority**: `settle_activity` accepts `SkillResolutionInput` union (`existing` with user ownership check vs `create` with normalized-name check); when `existing` is provided, RPC never guesses by name.
- [ ] **Evidence Authoritative Write Path**: `settle_activity` atomically writes an `evidence_records` row linking `(activity_id, skill_id, evidence_level, description)` during confirmed settlement.
- [ ] **Metadata Mutation RPC**: Dedicated `update_skill_metadata` RPC enforces whitelist updates (name, aliases, description, domain_id, status) and rename alias conservation; direct `UPDATE` on `public.skills` is revoked.
- [ ] **Repository Parity**: Both `DemoRepository` and `SupabaseRepository` implement all `Skill`, `SkillEdge`, and `Evidence` operations with identical behavioral semantics.

---

### Gate 5B — API & Total Derived State Determination
- [ ] **Total Deterministic Derived State**: `computeSkillDerivedState` is a total function covering 100% of state combinations (truth table with 12 boundary test cases) without gaps or overlaps.
- [ ] **Hard Prerequisite Invariant**: Prerequisite fulfillment strictly requires $M \ge 2$ and $\text{conf} \ge 0.5$; Level/XP is verified to NEVER bypass or substitute mastery depth.
- [ ] **Anti-Conflict Guarantee**: A skill with low mastery (e.g. M1) cannot under any circumstance yield `proficient` or `advanced`.
- [ ] **API Endpoint Completeness & Error Codes**:
  - `GET /api/skills`: Returns domains, positioned nodes with derived state, and styled edges;
  - `GET /api/skills/[id]`: Returns full skill details, evidence timeline, mastery history, and prerequisite checklist;
  - `POST /api/skills/edges`: Validates and adds edges; returns `409 Conflict` on cycles or single-parent conflicts;
  - `DELETE /api/skills/edges/[id]`: Deletes edge safely;
  - `PATCH /api/skills/[id]`: Invokes `update_skill_metadata` RPC.
- [ ] **Test Coverage**: Dedicated test suite covers all API routes and derived state boundary cases with 100% pass rate.

---

### Gate 5C — UI & Graph Visualization
- [ ] **3-Column Architecture**:
  - Left: Domain filter tree & search bar;
  - Center: `@xyflow/react` interactive graph with smooth pan/zoom, MiniMap, and reset controls;
  - Right: Collapsible Skill Detail Panel with Evidence timeline and Prerequisites checklist.
- [ ] **Rich Node Rendering**: Custom `SkillNode` renders name, level pill (`Lv.X`), mastery rank (`M_X`), confidence percentage, and distinct visual borders corresponding to derived state (`locked`, `available`, `learning`, `proficient`, `advanced`).
- [ ] **Edge Visual Discrimination**: Distinct stroke and marker styles for `prerequisite` (solid sky arrow), `contains` (dashed purple), and `supports` (subtle dotted zinc).
- [ ] **Evidence & Audit Feed**: Detail panel clearly displays linked `evidence_records`, activity source, and verification checkmark.
- [ ] **Zero Regression**: Existing `/dashboard`, `/quests`, and `/login` pages continue functioning seamlessly.

---

### Gate 5D — Security, Performance & System Invariants
- [ ] **RLS Coverage**: All queries on `skills`, `skill_edges`, `evidence_records`, and `domains` are verified to be strictly scoped to `auth.uid() = user_id`.
- [ ] **Zero Credential Leaks**: CI export and error diagnostics remain 100% sanitized.
- [ ] **Growth Engine Invariants**:
  - `Time is not XP`;
  - `XP is not Mastery`;
  - `High Mastery requires Evidence`;
  - `Final XP is computed by deterministic Growth Engine code`;
  - `pnpm harness:deterministic` passes 100%.
- [ ] **CI Pipeline Verification**: Both `check` and `supabase-integration` GitHub Actions jobs pass on the feature branch.

---

## 2. Final Stage 5 Sign-off Matrix

| Requirement | Verification Method | Status |
|---|---|---|
| **Domain Model & Ontology Separation** | Audit against `01_SKILL_TREE_DOMAIN_MODEL.md` | Frozen (Round 2) |
| **Authority, Settlement Union & Evidence Write** | Audit against `02_SKILL_TREE_AUTHORITY_RULES.md` | Frozen (Round 2) |
| **Total Derived State & API Contract** | Audit against `03_SKILL_TREE_API_AND_STATE.md` | Frozen (Round 2) |
| **UI Design & Canvas Usability** | Audit against `04_SKILL_TREE_UI_SPEC.md` | Frozen (Round 2) |
| **Phased Plan & Scope Containment** | Audit against `05_STAGE5_IMPLEMENTATION_PLAN.md` | Frozen (Round 2) |
| **Acceptance Gates & Invariants** | Audit against `06_STAGE5_ACCEPTANCE_GATES.md` | Frozen (Round 2) |
| **Automated Test Suite** | `pnpm test` + `pnpm harness:deterministic` | Target 100% Pass |
| **Live CI Full Stack** | GitHub Actions Run on feature branch | Target GREEN 🟢 |
