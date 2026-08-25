# Stage 6 — Knowledge Map Implementation Plan

> **Status**: FINAL FROZEN (STAGE 6A ROUND 3 CLOSURE)  
> **Target Milestone**: Stage 6 (Knowledge Map)  
> **Dependencies**: Stage 0–5 (FROZEN)  
> **Related Documents**: `01_KNOWLEDGE_MAP_DOMAIN_MODEL.md`, `02_KNOWLEDGE_AUTHORITY_RULES.md`, `03_KNOWLEDGE_API_AND_STATE.md`, `04_KNOWLEDGE_MAP_UI_SPEC.md`

---

## 1. Architectural Principles

1. **Strict Dependency Precedence**:
   - `Stage 6A` (Domain Model, Database Authority, Migration 0039 & Trigger DAG Invariants) $\rightarrow$
   - `Stage 6B` (Repository, Service Layer, Verification/Rejection Authority & RESTful Endpoints with Progressive Loading) $\rightarrow$
   - `Stage 6C` (Interactive Canvas UI, ReactFlow Layout, Detail Drawer & Mutation Modals) $\rightarrow$
   - `Stage 6D` (End-to-End Integration, Security Matrix, Zero Leakage & Final Freeze).
2. **No Code Before Sub-Stage Design Freeze**:
   - Stage 6B production code will NOT begin until Stage 6A is verified and approved.
3. **Traceable Epistemic Provenance**:
   - All knowledge nodes and edges strictly validate backing tenant entities (`public.activities`, `public.artifacts`) via DB triggers.
4. **Symmetric Storage & DAG Integrity**:
   - Canonical ordering (`source < target`) for `contradicts` and `relates_to`.
   - Dynamic cycle prevention for `prerequisite` and `contains`.

---

## 2. Sub-Stage Work Breakdown

```mermaid
graph TD
    subgraph Stage 6A: Schema & Authority [CURRENT - CLOSING]
        A1[0039 Migration & Legacy Rebuild] --> A2[Anti-Cycle DAG Trigger]
        A2 --> A3[Composite Foreign Keys & RLS]
        A3 --> A4[Provenance Target Integrity Trigger]
        A4 --> A5[Dual-Tenant DB Authority Test Suite]
    end

    subgraph Stage 6B: API & Read-Model [NEXT]
        B1[Supabase Knowledge Repository] --> B2[Node/Edge Verify/Reject Authority Engine]
        B2 --> B3[Progressive Loading k-Hop Ego Graph Query]
        B3 --> B4[RESTful API Endpoints /api/knowledge]
        B4 --> B5[HTTP Integration Test Suite]
    end

    subgraph Stage 6C: Interactive UI [FUTURE]
        C1[Knowledge Canvas / ReactFlow] --> C2[4-Channel Visual Encoding]
        C2 --> C3[Node/Edge Detail Drawer]
        C3 --> C4[Verify/Reject Proposal Modals]
    end

    subgraph Stage 6D: E2E & Final Freeze [FUTURE]
        D1[Full End-to-End Test Suite] --> D2[Cross-Tenant Security Audit]
        D2 --> D3[Final Freeze Merge to main]
    end

    Stage 6A --> Stage 6B --> Stage 6C --> Stage 6D
```

---

## 3. Sub-Stage 6B Scope (Ready to Start After 6A Freeze)
- `src/lib/store/knowledge-repository.ts` (Typed database access with tenant isolation).
- `src/lib/knowledge/authority-service.ts` (Atomic state transitions: `verifyKnowledgeNode`, `rejectKnowledgeNode`, `verifyKnowledgeEdge`, `rejectKnowledgeEdge`).
- `src/lib/knowledge/graph-layout.ts` (Deterministic progressive sub-graph loader with depth 1..3 and bounded limits).
- Next.js App Router endpoints under `src/app/api/knowledge/**`.
