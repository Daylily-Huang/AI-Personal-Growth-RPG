# Stage 6 — Acceptance Gates & Quality Checklist

> **Status**: FINAL FROZEN (STAGE 6A ROUND 5 CLOSURE)  
> **Target Milestone**: Stage 6 (Knowledge Map)  
> **Related Documents**: `01_KNOWLEDGE_MAP_DOMAIN_MODEL.md`, `02_KNOWLEDGE_AUTHORITY_RULES.md`, `03_KNOWLEDGE_API_AND_STATE.md`

---

## 1. Acceptance Gates by Sub-Stage

### Gate 6A: Schema, Authority & Graph Invariants (CURRENT TARGET)
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

### Gate 6B: API & Progressive Loading (NEXT)
- [ ] Complete RESTful endpoints under `/api/knowledge/**`;
- [ ] Sanctioned Node & Edge verify/reject atomic authority transitions (generic raw client mutations strictly blocked);
- [ ] Progressive loading query contract (`rootNodeId`, `depth` 1..3, bounded limits);
- [ ] 100% HTTP integration tests with authenticated and cross-tenant attack assertions.

---

### Gate 6C: Interactive Canvas UI (FUTURE)
- [ ] ReactFlow knowledge graph with 4-channel visual encoding;
- [ ] Node & Edge detail drawer with provenance inspection;
- [ ] Proposal verify/reject interactive confirmation modals.

---

### Gate 6D: E2E Integration & Final Freeze (FUTURE)
- [ ] Real browser/HTTP E2E tests for full knowledge lifecycle;
- [ ] Zero credential leak & log sanitization audits;
- [ ] Clean PR merge into main.
