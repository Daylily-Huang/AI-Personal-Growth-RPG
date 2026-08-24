# Stage 6 — Implementation Plan & Milestone Breakdown

> **Status**: FINAL FROZEN (STAGE 6A DESIGN CLOSURE)  
> **Target Milestone**: Stage 6 (Knowledge Map)  
> **Base Commit**: `main @ 09fb707` (Stage 5 Final Freeze Merge)  
> **Related Documents**: `docs/Stage6/01_KNOWLEDGE_MAP_DOMAIN_MODEL.md` through `04_KNOWLEDGE_MAP_UI_SPEC.md`

---

## 1. Sub-Stage Delivery Strategy

To ensure zero regression on frozen Stages 0–5 and maintain verifiable incremental progress, Stage 6 is divided into 4 sequential sub-stages:

```text
Stage 6A: Schema, Authority & Database Triggers
  │   └── Migration 0039 + Composite Tenant FKs + Anti-Cycle Trigger + DB Tests
  ▼
Stage 6B: RESTful API, Repository & Progressive Subgraphs
  │   └── /api/knowledge* Endpoints + Verify/Reject RPCs + HTTP Integration Tests
  ▼
Stage 6C: Interactive Knowledge Map UI & Provenance Drawer
  │   └── 3-Column Layout + Multi-modal Visuals + ReactFlow Canvas + UI Tests
  ▼
Stage 6D: Security Matrix, Multi-Tenant E2E & Final Freeze
      └── RLS Isolation + Dual-Tenant Live HTTP Tests + Zero-Leak CI Verification
```

---

## 2. Detailed Sub-Stage Specifications

### 2.1 Stage 6A — Domain Model, Schema & Authority Base
- **Branch**: `feature/stage6a-knowledge-authority`
- **Scope**:
  - Migration `0039_knowledge_graph_authority.sql`:
    - Legacy table data safety guard.
    - `knowledge_nodes`: `node_type` (`concept`/`claim`/`topic`), `verification_status` (`inferred`/`verified`/`rejected`/`superseded`), `confidence` (inferred $\le$ 0.95, verified = 1.00), `is_archived`, `verified_at`, `verified_by`, `normalized_title` trigger, composite key `UNIQUE (user_id, id)`.
    - `knowledge_edges`: `relation_type` (`prerequisite`/`contains`/`supports`/`contradicts`/`relates_to`), `verification_status`, True Symmetric storage check constraint (`source < target` for `contradicts`/`relates_to`), `relates_to` mandatory provenance note, composite tenant FKs.
    - Tenant-safe composite FK on `evidence_records.knowledge_node_id`.
    - Anti-cycle DAG trigger on `prerequisite` and `contains` (active in DAG: `inferred` and `verified`, excluding current row on UPDATE).
    - Strict Row Level Security (RLS) policies and privilege grants (fail-closed, authenticated-only).
  - Database types regeneration (`src/lib/supabase/database.types.ts`).
  - Unit & DB authority test suite (`tests/stage6a-db-authority.test.ts`).
- **Gate 6A Target**: `supabase db reset` replay 0001→0039 PASS, vitest authority suite 100% PASS.

---

### 2.2 Stage 6B — RESTful API, Repository & Read Model
- **Branch**: `feature/stage6b-knowledge-api`
- **Scope**:
  - Store Repository extension (`src/lib/store/knowledge-repository.ts` & `supabase-knowledge-repository.ts`):
    - `getKnowledgeGraph(userId, filters)` with progressive k-hop subgraph support.
    - `getKnowledgeNodeDetail(userId, nodeId)` with provenance linkage.
    - `createKnowledgeNode`, `updateKnowledgeNode`, `deleteKnowledgeNode`.
    - `verifyKnowledgeEdge(userId, edgeId)`, `rejectKnowledgeEdge(userId, edgeId)`.
  - Next.js Route Handlers (`src/app/api/knowledge/**`):
    - Strict `auth.uid()` enforcement first.
    - UUID parsing and status validation.
    - Status code mapping (401 / 400 / 404 / 409 / 200 / 204).
  - API integration tests (`tests/stage6b-api-knowledge.test.ts`).
- **Gate 6B Target**: All API routes tested against live database and mock repository; 409 cycle/duplicate and 404 tenant isolation verified over HTTP.

---

### 2.3 Stage 6C — Interactive Knowledge Map UI
- **Branch**: `feature/stage6c-knowledge-map-ui`
- **Scope**:
  - Interactive Web Page (`src/app/knowledge/page.tsx`):
    - Left Sidebar: Domain tree, Node type filter checkboxes, Authority toggle (`All` / `Verified Only`).
    - Center Canvas (`src/app/knowledge/components/KnowledgeGraphCanvas.tsx`):
      - Multi-modal edge rendering (Solid vs Dashed vs Zigzag).
      - Distinct node entity shapes (`concept`, `claim`, `topic`).
      - Quick verify / reject action pills on edge hover.
    - Right Drawer (`src/app/knowledge/components/KnowledgeNodeDetailPanel.tsx`):
      - Provenance box: Source Activity link, Source Artifact link, Evidence tags.
      - Inbound & outbound connection lists with interactive verification buttons.
  - Component tests with jsdom (`tests/stage6c-ui.test.tsx`).
- **Gate 6C Target**: Full interactive UI rendered, visual distinction verified, provenance cards rendered, zero regression on Skill/Quest/Dashboard pages.

---

### 2.4 Stage 6D — Security Isolation, Dual-Tenant E2E & Final Freeze
- **Branch**: `feature/stage6d-knowledge-final-freeze`
- **Scope**:
  - Dual-tenant security isolation matrix (`tests/stage6d-security-isolation.test.ts`):
    - User A cannot read, update, delete, or link edges to User B's nodes.
  - Live Next.js HTTP E2E test (`tests/stage6d-knowledge-http.test.ts`).
  - GitHub Actions CI credential masking validation.
  - 全门禁 (Vitest, Deterministic Harness, E2E, tsc, lint, build) 100% GREEN.
- **Gate 6D Target**: Formal Stage 6 Final Freeze and merge to `main`.
