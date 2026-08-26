# Stage 7 — Acceptance Gates & Quality Checklist

> **Status**: DESIGN FREEZE  
> **Milestone**: Stage 7 (Artifact Management & Synthesis System)  
> **Related Documents**: `01_ARTIFACT_DOMAIN_MODEL.md`, `02_ARTIFACT_AUTHORITY_RULES.md`, `03_ARTIFACT_API_AND_STATE.md`, `04_ARTIFACT_UI_SPEC.md`, `05_STAGE7_IMPLEMENTATION_PLAN.md`

---

## 1. Acceptance Gates by Sub-Stage

### Gate 7A: Schema, Composite FKs & Authority Invariants (CURRENT TARGET)
- [ ] **0041 Migration Applied**: Clean schema rebuild for `artifacts` and creation of normalized join tables;
- [ ] **Artifact Taxonomy Constraints**: `artifact_type` restricted to valid enum values (`document`, `code_repository`, `design_spec`, `data_analysis`, `presentation`, `synthesis_note`, `creative_work`, `other`);
- [ ] **Lifecycle Constraints**: `lifecycle_status` restricted to valid enum values (`draft`, `active`, `archived`, `superseded`);
- [ ] **Reusability Bounds**: `reusability_score` constrained to `0.00 <= reusability_score <= 1.00`;
- [ ] **Normalized Join Tables Created**: Explicit join tables for `artifact_activities`, `artifact_skills`, `artifact_knowledge_nodes`, `artifact_quests`, `artifact_evidence`;
- [ ] **Composite Tenant-Safe FKs**: All child tables enforce `(user_id, artifact_id)` and `(user_id, foreign_id)` composite foreign keys;
- [ ] **Fail-Closed Deletion Guard**: PostgreSQL trigger blocks artifact deletion if referenced by Knowledge Provenance or Evidence records (`PG 23503 / 23514`);
- [ ] **Dual-Tenant RLS Matrix**: User A / User B reciprocal CRUD isolation 100% verified;
- [ ] **Fail-Closed Anon Role**: Anonymous role has 0 permissions.

---

### Gate 7B: API Layer & Relationship Service (NEXT)
- [ ] Complete RESTful endpoints under `/api/artifacts/**`;
- [ ] Multi-entity join hydration in `GET /api/artifacts/[id]`;
- [ ] Filter query support (`type`, `status`, `skillId`, `questId`, `search`, pagination);
- [ ] Non-disclosing 404s on cross-tenant lookups;
- [ ] 100% HTTP integration tests with authenticated and hostile-client assertions.

---

### Gate 7C: Artifacts Workspace UI (FUTURE)
- [ ] Design-Sequence Checkpoint review before implementation;
- [ ] Complete 3-column workspace at `/artifacts`;
- [ ] Interactive Artifact Cards with type badges, version pills, and reusability meters;
- [ ] Detail Drawer with markdown rendering and multi-entity relationship accordions;
- [ ] Create, Edit, and Archive/Delete confirmation modals with zero-mutation on cancel.

---

### Gate 7D: E2E Integration & Final Freeze (FUTURE)
- [ ] Real browser/HTTP E2E test covering full artifact lifecycle;
- [ ] Live PostgreSQL hostile-client and security isolation audit;
- [ ] Zero credential leak & CI log sanitization audit;
- [ ] Clean PR merge into main.
