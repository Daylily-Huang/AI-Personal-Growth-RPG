# Stage 6 — Knowledge Map Implementation Plan

> **Status**: FINAL FROZEN (STAGE 6D CLOSURE)  
> **Target Milestone**: Stage 6 (Knowledge Map)  
> **Dependencies**: Stage 0–5 (FROZEN)  
> **Related Documents**: `01_KNOWLEDGE_MAP_DOMAIN_MODEL.md`, `02_KNOWLEDGE_AUTHORITY_RULES.md`, `03_KNOWLEDGE_API_AND_STATE.md`, `04_KNOWLEDGE_MAP_UI_SPEC.md`, `06_STAGE6_ACCEPTANCE_GATES.md`, `07_STAGE6_FINAL_FROZEN_SUMMARY.md`

---

## 1. Architectural Principles

1. **Strict Dependency Precedence**:
   - `Stage 6A` (Domain Model, Database Authority, Migration 0039, Provenance Immutability & Anti-Cycle DAG Invariants) $\rightarrow$ **[FINAL FROZEN]**
   - `Stage 6B` (Repository, Service Layer, Verification/Rejection Authority & RESTful Endpoints with Progressive Loading, Migration 0040) $\rightarrow$ **[FINAL FROZEN]**
   - `Stage 6C` (Interactive Canvas UI, ReactFlow Layout, Detail Drawer & Mutation Modals) $\rightarrow$ **[FINAL FROZEN]**
   - `Stage 6D` (End-to-End Integration, Security Matrix, Zero Leakage & Final Freeze) $\rightarrow$ **[FINAL FREEZE CANDIDATE / FINAL FROZEN]**.
2. **No Code Before Sub-Stage Design Freeze**:
   - All sub-stages strictly completed their design, implementation, and regression verification in sequential order.
3. **Traceable & Immutable Epistemic Provenance**:
   - `source_type` and `source_id` are permanently immutable after creation to prevent reclassification and erasure attacks.
   - Referenced sources (Activities/Artifacts) are guarded against deletion while active in the graph.
4. **Symmetric Storage & DAG Integrity**:
   - Canonical ordering (`source < target`) for `contradicts` and `relates_to`.
   - Dynamic cycle prevention for `prerequisite` and `contains`.

---

## 2. Sub-Stage Work Breakdown & Final Status

```mermaid
graph TD
    subgraph Stage 6A: Schema & Authority [FINAL FROZEN]
        A1[0039 Migration & Legacy Rebuild] --> A2[Anti-Cycle DAG Trigger]
        A2 --> A3[Composite Foreign Keys & RLS]
        A3 --> A4[Provenance Immutability & Delete Guards]
        A4 --> A5[Dual-Tenant DB Authority Test Suite]
    end

    subgraph Stage 6B: API & Read-Model [FINAL FROZEN]
        B1[Supabase Knowledge Repository] --> B2[Sanctioned Verify/Reject Authority Path]
        B2 --> B3[Progressive Loading k-Hop Ego Graph Query]
        B3 --> B4[RESTful API Endpoints /api/knowledge]
        B4 --> B5[0040 Column Permissions & HTTP Integration Tests]
    end

    subgraph Stage 6C: Interactive UI [FINAL FROZEN]
        C1[Knowledge Canvas / ReactFlow] --> C2[4-Channel Visual Encoding]
        C2 --> C3[Node/Edge Detail Drawer]
        C3 --> C4[Verify/Reject Proposal Modals]
    end

    subgraph Stage 6D: E2E & Final Freeze [FINAL FROZEN]
        D1[Full End-to-End Test Suite] --> D2[Cross-Tenant Security & Bypass Audit]
        D2 --> D3[Final Freeze Documentation & PR #9]
    end

    Stage 6A --> Stage 6B --> Stage 6C --> Stage 6D
```

---

## 3. Sub-Stage Implementation Summary

### 3.1 Stage 6A (Database Authority & Invariants — FROZEN)
- Migration `0039_knowledge_map_rebuild.sql` applied.
- Epistemic check constraints (`confidence <= 0.95` for `inferred`, `confidence = 1.00` with audit timestamp and `user_id` for `verified`).
- Provenance immutability triggers and delete guards (`23503`) for referenced Activities/Artifacts.
- Dynamic anti-cycle DAG triggers for `prerequisite` and `contains`.
- Canonical storage constraint (`source_node_id < target_node_id`) for symmetric relations (`contradicts`, `relates_to`).

### 3.2 Stage 6B (API, Authority Boundary & Progressive Loading — FROZEN)
- Migration `0040_knowledge_authority_rpc.sql` applied with PostgreSQL column-level permission revocations for raw authenticated updates on protected fields (`verification_status`, `confidence`, `verified_at`, `verified_by`, `source_type`, `source_id`, `provenance_note`).
- Atomic CAS `SECURITY DEFINER` authority RPCs (`verify_knowledge_node`, `reject_knowledge_node`, `verify_knowledge_edge`, `reject_knowledge_edge`).
- Next.js RESTful routes under `/api/knowledge/**`.
- Deterministic progressive ego-graph BFS layout (`degree DESC, updated_at DESC, id ASC`, depths 1..3, bounded limits).

### 3.3 Stage 6C (Interactive Knowledge Map UI — FROZEN)
- ReactFlow canvas workspace with 3-column layout (filter panel, canvas, right detail drawer).
- 4-channel epistemic encoding (border stroke style, node badge, confidence pill, background tint).
- Full provenance inspection drawers for Nodes and Edges.
- Mutually exclusive Verify / Reject confirmation modals with zero-mutation on Cancel.
- Whitelisted metadata editing modal with render-phase state synchronization.

### 3.4 Stage 6D (E2E Integration, Security Isolation & Final Freeze — FROZEN)
- Real Next.js HTTP server E2E test suite (`tests/e2e-http-browser.test.ts` Test 10) covering complete Knowledge lifecycle.
- Live PostgreSQL RLS and Hostile-Client security audit suite (`tests/stage6d-security-isolation.test.ts` 14 tests).
- 100% CI pass rate with sanitized logs and zero credential leakage.
