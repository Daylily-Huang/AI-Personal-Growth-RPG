# Stage 7 — Artifact Implementation Plan

> **Status**: DESIGN FREEZE  
> **Milestone**: Stage 7 (Artifact Management & Synthesis System)  
> **Dependencies**: Stage 0–6 (FROZEN)  
> **Related Documents**: `01_ARTIFACT_DOMAIN_MODEL.md`, `02_ARTIFACT_AUTHORITY_RULES.md`, `03_ARTIFACT_API_AND_STATE.md`, `04_ARTIFACT_UI_SPEC.md`, `06_STAGE7_ACCEPTANCE_GATES.md`

---

## 1. Architectural Strategy & Sub-Stage Split

```mermaid
graph TD
    subgraph Stage 7A: Schema & Authority [FINAL FROZEN]
        A1[0041 Migration & Table Rebuild] --> A2[Normalized Relational Join Tables]
        A2 --> A3[Composite Foreign Keys: CASCADE vs RESTRICT]
        A3 --> A4[Column-Level UPDATE Privileges]
        A4 --> A5[Fail-Closed Deletion Trigger]
        A5 --> A6[Live PostgreSQL Authority Test Suite: 42/42 PASS]
    end

    subgraph Stage 7B: API, Read-Model & Settlement [FINAL FROZEN]
        B1[Artifact Repository & Link Service] --> B2[RESTful Endpoints /api/artifacts]
        B2 --> B3[Batch Relationship Management: All 5 Entities]
        B3 --> B4[0042 Migration: AI Proposal Resolution & Atomic Settlement]
        B4 --> B5[HTTP Integration Tests: 15 Gate 7B Verification Cases: 41/41 PASS]
    end

    subgraph Global Visual Design Freeze [CURRENT IN PROGRESS]
        V0[Visual System Documentation & Design Tokens] --> V1[AppShell & Primitives Spec]
    end

    subgraph Stage 7C: Interactive UI [BLOCKED PENDING GLOBAL VISUAL DESIGN FREEZE PASS]
        C0[Design-Sequence Checkpoint] --> C1[Artifacts Gallery & List View]
        C1 --> C2[Detail Inspector Drawer: 5 Relational Accordions]
        C2 --> C3[Create / Edit / Archive / Superseded Dialogs]
        C3 --> C4[Assessment Confirm Proposal Resolution Control]
    end

    subgraph Stage 7D: E2E & Final Freeze [FUTURE]
        D1[Full End-to-End Test Suite] --> D2[Cross-Tenant Security Audit]
        D2 --> D3[Final Freeze Merge to main]
    end

    Stage 7A --> Stage 7B --> Stage 7C --> Stage 7D
```


---

## 2. Sub-Stage Detailed Breakdown

### 2.1 Stage 7A — Domain Model, Schema & Authority (Branch: `feature/stage7a-artifact-authority`)
- **Migration `0041_artifact_management_authority.sql`**:
  - Rebuild / upgrade `public.artifacts` with strict constraints (`artifact_type` 8 canonical types, `lifecycle_status` enum, `reusability_score numeric(3,2)`, `check_artifact_lifecycle_coherence`).
  - Create normalized join tables:
    - `public.artifact_activities` (`ON DELETE CASCADE`)
    - `public.artifact_skills` (`ON DELETE CASCADE`)
    - `public.artifact_knowledge_nodes` (`ON DELETE CASCADE`)
    - `public.artifact_quests` (`ON DELETE CASCADE`)
    - `public.artifact_evidence` (`ON DELETE RESTRICT`)
  - Enforce composite foreign keys `(user_id, artifact_id)` and `(user_id, entity_id)` to guarantee tenant boundary at DB level.
  - Implement column-level UPDATE privileges on `public.artifacts` (whitelisted user-authoritative columns) and child tables (semantic columns only); revoke raw UPDATE on immutable/audit columns.
  - Implement fail-closed delete guard trigger `prevent_artifact_delete_if_referenced()` protecting Knowledge Provenance and Evidence.
  - Row Level Security (RLS) policies on all tables (`auth.uid() = user_id`).
  - Comprehensive live PostgreSQL test suite (`tests/stage7a-db-authority.test.ts`, 42 tests).

### 2.2 Stage 7B — Repository, API Layer & Settlement Integration
- Typed `SupabaseArtifactRepository` implementing CRUD, filtering, pagination, and multi-relational joins across all 5 entity types.
- Next.js App Router API routes under `src/app/api/artifacts/**`.
- Batch link management across activities, skills, knowledge nodes, quests, and evidence.
- **Assessment Artifact Proposal + Atomic Settlement Integration**:
  - Forward migration `0042_artifact_settlement_integration.sql`.
  - Migrate AI prompt and schema to plural `artifactProposals: ArtifactProposal[]`.
  - Process confirm-time `artifactResolutions: ArtifactResolutionInput[]` (`CREATE`, `EXISTING`, `IGNORE`) bound strictly by `proposalIndex`.
  - Enforce exact $N$-of-$N$ resolution coverage and derive metadata strictly from stored assessment proposal (with optional `approvedOverrides`).
  - Atomic, idempotent settlement execution (zero duplicate mutations, repeat confirm preserves `409 Conflict` `already_confirmed`).
  - 15 required verification cases in HTTP integration test suite (`tests/stage7b-http-api.test.ts`).

### 2.3 Stage 7C — Artifacts Workspace UI
- Pause at **Design-Sequence Checkpoint** to evaluate extracting global app shell, shared navigation, and drawer primitives.
- Implement `/artifacts` page with Left filter bar (active, draft, archived, superseded, all), Center artifact gallery/list, and Right detail inspector with 5 relational accordions.
- Interactive Modals (Create, Edit, Manage Links, Archive/Delete confirmation, Restore Superseded).
- Assessment confirmation dialog resolution picker integration bound to `proposalIndex`.
- UI component and interaction test suite (`tests/stage7c-ui.test.tsx`).

### 2.4 Stage 7D — E2E Integration, Security Isolation & Final Freeze
- Full browser/HTTP lifecycle E2E tests in `tests/e2e-http-browser.test.ts`.
- Live PostgreSQL hostile-client and security isolation audit (`tests/stage7d-security-isolation.test.ts`).
- Credential leak and CI log sanitization audit.
- Final documentation synchronization and freeze.
