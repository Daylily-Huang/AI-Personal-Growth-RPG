# Stage 6 — Acceptance Gates & Quality Checklist

> **Status**: FINAL FROZEN (STAGE 6D CLOSURE)  
> **Target Milestone**: Stage 6 (Knowledge Map)  
> **Related Documents**: `01_KNOWLEDGE_MAP_DOMAIN_MODEL.md`, `02_KNOWLEDGE_AUTHORITY_RULES.md`, `03_KNOWLEDGE_API_AND_STATE.md`, `04_KNOWLEDGE_MAP_UI_SPEC.md`, `05_STAGE6_IMPLEMENTATION_PLAN.md`, `07_STAGE6_FINAL_FROZEN_SUMMARY.md`

---

## 1. Acceptance Gates by Sub-Stage

### Gate 6A: Schema, Authority & Graph Invariants (FINAL FROZEN)
- [x] **0039 Migration Applied**: Replaces 0012 with fail-closed non-empty check guard;
- [x] **Verified Audit Constraints**: `verification_status = 'verified'` requires `confidence = 1.00`, `verified_at IS NOT NULL`, `verified_by = user_id`;
- [x] **Inferred Confidence Bounds**: `verification_status = 'inferred'` requires `confidence <= 0.95`;
- [x] **Provenance Immutability Trigger**: `source_type` and `source_id` are strictly immutable after creation;
- [x] **AI Proposal Insertion Invariant**: Must be inserted with `verification_status = 'inferred'`;
- [x] **Source Delete Guards**: Deletion of Activities/Artifacts referenced by knowledge graph is rejected (PG 23503);
- [x] **Provenance Target Integrity Trigger**: `validate_knowledge_provenance_target()` guarantees `activity`, `artifact`, `ai_proposal` reference existing entities owned by the same tenant;
- [x] **True Symmetric Storage**: `contradicts` and `relates_to` require `source_node_id < target_node_id`; `relates_to` requires non-empty `provenance_note`;
- [x] **Anti-Cycle DAG Trigger**: Enforces strict acyclic DAG on active `prerequisite` and `contains`; excludes current row during UPDATE;
- [x] **Inactive DAG Exclusion**: `rejected`, `superseded`, and `is_archived = true` edges excluded from cycle checks;
- [x] **Dual-Tenant RLS Matrix**: User A / User B reciprocal CRUD isolation 100% verified;
- [x] **Fail-Closed Anon Role**: Anonymous role has 0 table access.

---

### Gate 6B: API & Progressive Loading (FINAL FROZEN)
- [x] Complete RESTful endpoints under `/api/knowledge/**`;
- [x] Sanctioned Node & Edge verify/reject atomic authority transitions (`verify_knowledge_node`, `reject_knowledge_node`, `verify_knowledge_edge`, `reject_knowledge_edge`);
- [x] Migration 0040 PostgreSQL column-level permission revocations blocking raw authenticated updates on protected columns;
- [x] Progressive loading query contract (`rootNodeId`, `depth` 1..3, bounded limits with truncation banner metadata);
- [x] 100% HTTP integration tests with authenticated and cross-tenant attack assertions (32/32 PASS).

---

### Gate 6C: Interactive Canvas UI (FINAL FROZEN)
- [x] ReactFlow knowledge graph with 4-channel visual encoding (stroke style, badge, confidence pill, background tint);
- [x] Node & Edge detail drawer with full provenance inspection;
- [x] Proposal verify/reject mutually exclusive interactive confirmation dialogs with 0 mutation on Cancel;
- [x] Whitelisted metadata editor with render-phase state synchronization;
- [x] Visual QA evidence and 100% UI interaction test suite (21/21 PASS).

---

### Gate 6D: E2E Integration & Final Freeze (FINAL FREEZE)
- [x] Real Next.js HTTP server E2E test covering full knowledge lifecycle (`tests/e2e-http-browser.test.ts` Test 10);
- [x] Live PostgreSQL RLS and Hostile-Client security audit (`tests/stage6d-security-isolation.test.ts` 14/14 PASS);
- [x] Raw Data API authority bypass audit confirming column permission revocation;
- [x] Provenance integrity regressions (foreign provenance rejection, delete guards, symmetric canonical constraints);
- [x] Graph determinism & layout regression verification;
- [x] Zero credential leak & CI log sanitization audits;
- [x] Full regression test suite passing (43 test files / 487 tests PASS, 100%);
- [ ] Clean PR #9 merge into main (Owner final action).
