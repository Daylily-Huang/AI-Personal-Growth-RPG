# Stage 7 — Acceptance Gates & Quality Checklist

> **Status**: DESIGN FREEZE  
> **Milestone**: Stage 7 (Artifact Management & Synthesis System)  
> **Related Documents**: `01_ARTIFACT_DOMAIN_MODEL.md`, `02_ARTIFACT_AUTHORITY_RULES.md`, `03_ARTIFACT_API_AND_STATE.md`, `04_ARTIFACT_UI_SPEC.md`, `05_STAGE7_IMPLEMENTATION_PLAN.md`

---

## 1. Acceptance Gates by Sub-Stage

### Gate 7A: Schema, Composite FKs & Authority Invariants (CURRENT TARGET)
- [ ] **0041 Migration Applied**: Clean schema rebuild for `artifacts` and creation of normalized join tables;
- [ ] **Artifact Taxonomy Constraints**: `artifact_type` restricted to 8 canonical enum values (`document`, `code_repository`, `design_spec`, `data_analysis`, `presentation`, `synthesis_note`, `creative_work`, `other`);
- [ ] **Lifecycle Coherence Constraints**: `lifecycle_status = 'archived'` $\iff$ `is_archived = true` and `archived_at IS NOT NULL`; `draft`/`active`/`superseded` $\iff$ `is_archived = false` and `archived_at IS NULL`;
- [ ] **Reusability Bounds**: `reusability_score numeric(3,2)` constrained to `0.00 <= reusability_score <= 1.00`;
- [ ] **Normalized Join Tables Created**: Explicit join tables for `artifact_activities`, `artifact_skills`, `artifact_knowledge_nodes`, `artifact_quests`, `artifact_evidence`;
- [ ] **Composite Tenant-Safe FKs**: All child tables enforce `(user_id, artifact_id)` and `(user_id, foreign_id)` composite foreign keys;
- [ ] **Column-Level UPDATE Privileges**: `public.artifacts` updates restricted to user-authoritative columns; raw updates to `id`, `user_id`, `created_at`, `updated_at`, `archived_at` denied (`42501`); child table identity-rewire attacks denied (`42501`);
- [ ] **Fail-Closed Deletion Guard**: PostgreSQL trigger blocks artifact deletion if referenced by Knowledge Provenance or Evidence records (`PG 23503`);
- [ ] **Dual-Tenant RLS Matrix**: User A / User B reciprocal CRUD isolation 100% verified across all 6 tables;
- [ ] **Fail-Closed Anon Role**: Anonymous role has 0 permissions across all 6 tables.

---

## 2. Gate 7B: API Layer & Relationship Service (NEXT)
- [ ] Complete RESTful endpoints under `/api/artifacts/**`;
- [ ] Multi-entity join hydration in `GET /api/artifacts/[id]`;
- [ ] Filter query support (`type`, `status` [active/archived/all/draft/superseded], `skillId`, `questId`, `search`, pagination);
- [ ] Batch link management across all 5 entities (`activities`, `skills`, `knowledgeNodes`, `quests`, `evidence`);
- [ ] **Assessment Artifact Proposal & Atomic Settlement**:
  - `POST /api/activities/[id]/assess` generates `artifactProposal` without writing to DB;
  - `POST /api/assessments/[id]/confirm` atomically creates Artifact and relations upon settlement confirmation;
  - Verification of atomicity, rollback on failure, and idempotency on repeated confirms;
- [ ] Non-disclosing 404s on cross-tenant lookups;
- [ ] 100% HTTP integration tests with authenticated and hostile-client assertions (`tests/stage7b-http-api.test.ts`).

---

## 3. Gate 7C: Artifacts Workspace UI (FUTURE)
- [ ] Design-Sequence Checkpoint review before implementation;
- [ ] Complete 3-column workspace at `/artifacts`;
- [ ] Interactive Artifact Cards with type badges, version pills, superseded status, and reusability meters;
- [ ] Detail Drawer with markdown rendering and 5 relational accordions (Skills, Knowledge, Quests, Activities, Evidence);
- [ ] Create, Edit, Manage Links, and Archive/Delete confirmation modals with zero-mutation on cancel;
- [ ] Restore superseded work product action.

---

## 4. Gate 7D: E2E Integration & Final Freeze (FUTURE)
- [ ] Real browser/HTTP E2E test covering full artifact lifecycle;
- [ ] Live PostgreSQL hostile-client and security isolation audit;
- [ ] Zero credential leak & CI log sanitization audit;
- [ ] Clean PR merge into main.
