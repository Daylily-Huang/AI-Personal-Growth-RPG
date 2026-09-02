# Stage 7 — Acceptance Gates & Quality Checklist

> **Status**: DESIGN FREEZE  
> **Milestone**: Stage 7 (Artifact Management & Synthesis System)  
> **Related Documents**: `01_ARTIFACT_DOMAIN_MODEL.md`, `02_ARTIFACT_AUTHORITY_RULES.md`, `03_ARTIFACT_API_AND_STATE.md`, `04_ARTIFACT_UI_SPEC.md`, `05_STAGE7_IMPLEMENTATION_PLAN.md`

---

## 1. Acceptance Gates by Sub-Stage

### Gate 7A: Schema, Composite FKs & Authority Invariants (FINAL FROZEN - 42/42 PASS)
- [x] **0041 Migration Applied**: Clean schema rebuild for `artifacts` and creation of normalized join tables;
- [x] **Artifact Taxonomy Constraints**: `artifact_type` restricted to 8 canonical enum values (`document`, `code_repository`, `design_spec`, `data_analysis`, `presentation`, `synthesis_note`, `creative_work`, `other`);
- [x] **Lifecycle Coherence Constraints**: `lifecycle_status = 'archived'` $\iff$ `is_archived = true` and `archived_at IS NOT NULL`; `draft`/`active`/`superseded` $\iff$ `is_archived = false` and `archived_at IS NULL`;
- [x] **Reusability Bounds**: `reusability_score numeric(3,2)` constrained to `0.00 <= reusability_score <= 1.00`;
- [x] **Normalized Join Tables Created**: Explicit join tables for `artifact_activities`, `artifact_skills`, `artifact_knowledge_nodes`, `artifact_quests`, `artifact_evidence`;
- [x] **Composite Tenant-Safe FKs**: All child tables enforce `(user_id, artifact_id)` and `(user_id, foreign_id)` composite foreign keys (`ON DELETE CASCADE` for activities/skills/knowledge/quests; `ON DELETE RESTRICT` for evidence);
- [x] **Column-Level UPDATE Privileges**: `public.artifacts` updates restricted to user-authoritative columns; raw updates to `id`, `user_id`, `created_at`, `updated_at`, `archived_at` denied (`42501`); child table identity-rewire attacks denied (`42501`);
- [x] **Fail-Closed Deletion Guard**: PostgreSQL trigger blocks artifact deletion if referenced by Knowledge Provenance or Evidence records (`PG 23503`);
- [x] **Dual-Tenant RLS Matrix**: User A / User B reciprocal CRUD isolation 100% verified across all 6 tables;
- [x] **Fail-Closed Anon Role**: Anonymous role has 0 permissions across all 6 tables.

---

## 2. Gate 7B: API Layer, Relationship Service & Settlement Integration (FINAL FROZEN - 41/41 PASS)
- [x] Complete RESTful endpoints under `/api/artifacts/**`;
- [x] Multi-entity join hydration in `GET /api/artifacts/[id]`;
- [x] Filter query support (`type`, `status` [active/archived/all/draft/superseded], `skillId`, `questId`, `search`, pagination);
- [x] Batch link management across all 5 entities (`activities`, `skills`, `knowledgeNodes`, `quests`, `evidence`);
- [x] **Assessment Artifact Proposal & Atomic Settlement Matrix (15 Required Cases)**:
  1. **Assess 0 Proposals**: Assess returns 0 proposals $\rightarrow$ zero Artifact writes;
  2. **Single CREATE**: 1 proposal with `proposalIndex: 0`, `resolution: "create"` $\rightarrow$ exactly one Artifact created with `activity_role = 'produced'`;
  3. **Multiple CREATE**: 2 proposals with `proposalIndex: 0, 1`, `resolution: "create"` $\rightarrow$ exactly two Artifacts created in same atomic settlement;
  4. **EXISTING Owned Artifact**: Proposal with `proposalIndex: 0`, `resolution: "existing"` and owned `artifactId` $\rightarrow$ zero new Artifact rows, links existing stable UUID with `activity_role = 'modified'` or `'referenced'`;
  5. **Foreign-Tenant `artifactId`**: Proposal with well-formed foreign `artifactId` UUID $\rightarrow$ fail-closed HTTP **`404 Not Found`** (non-disclosing), full settlement rollback;
  6. **Malformed `artifactId` UUID**: Proposal with malformed UUID string $\rightarrow$ HTTP **`400 Bad Request`**, full settlement rollback;
  7. **CREATE Title Collision**: `CREATE` resolution where normalized title already exists for same user $\rightarrow$ deterministic conflict HTTP **`409 Conflict`** (`code: "artifact_title_conflict"`), rolls back entire settlement without partial writes;
  8. **IGNORE Proposal**: Proposal with `proposalIndex: 0`, `resolution: "ignore"` $\rightarrow$ zero Artifact rows and zero links created;
  9. **Mixed CREATE + EXISTING**: Multi-artifact settlement with 1 `create` and 1 `existing` $\rightarrow$ all-or-nothing atomic commitment;
  10. **Repeat Confirm Idempotency**: Repeat `POST /api/assessments/[id]/confirm` $\rightarrow$ zero duplicate Artifact / XP / Evidence / Quest mutation, returns **`409 Conflict`** (`already_confirmed`) preserving frozen HTTP contract;
  11. **Duplicate `proposalIndex`**: Confirm body contains duplicate `proposalIndex` $\rightarrow$ HTTP **`400 Bad Request`**, zero mutations;
  12. **Out-of-Range `proposalIndex`**: Confirm body contains `proposalIndex` $< 0$ or $\ge N$ $\rightarrow$ HTTP **`400 Bad Request`**, zero mutations;
  13. **Incomplete Coverage**: Confirm body omits a `proposalIndex` or has length $\ne N$ $\rightarrow$ HTTP **`400 Bad Request`**, zero mutations;
  14. **Proposal Tampering Protection**: Created Artifact metadata is strictly derived from persisted Assessment proposal (or whitelisted `approvedOverrides`), preventing arbitrary client-injected deliverable payloads;
  15. **Artifact Relation / FK Failure Rollback**: If any Artifact relationship persistence fails due to an invalid/foreign relation target or frozen FK/relationship constraint, the entire settlement transaction rolls back (asserting zero committed XP transactions, zero Evidence rows, zero Mastery events, zero Quest progress, zero Artifact rows, and zero Artifact relations).
- [x] Non-disclosing 404s on cross-tenant lookups;
- [x] 100% HTTP integration tests with authenticated and hostile-client assertions (`tests/stage7b-http-api.test.ts`).


---

## 3. Gate 7C: Artifacts Workspace UI (FINAL FROZEN - 24/24 PASS)
- [x] **Prerequisite**: Global Visual Design Freeze PASS (Gates V1–V8);
- [x] Consume the **FINAL FROZEN Global Visual Design System** (`AppShell`, `InspectorDrawer`, `GlassPanel`, `RPGCard`, and shared primitives);
- [x] Complete 3-column workspace at `/artifacts`;
- [x] Interactive Artifact Cards with type badges, version pills, superseded status, and reusability meters;
- [x] Detail Drawer (`ArtifactInspectorContent`) with markdown rendering and 5 relational accordions (Skills, Knowledge, Quests, Activities, Evidence);
- [x] Create, Edit, Manage Links, and Archive/Delete confirmation modals with zero-mutation on cancel;
- [x] Assessment Confirmation Resolution UX (3-way Create / Existing / Ignore selector bound by `proposalIndex`);
- [x] Restore superseded work product action;
- [x] Merged via PR #16.

---

## 4. Gate 7D: E2E Integration, Security Isolation & Final Freeze (FINAL FROZEN - 43/43 PASS)
- [x] **Real HTTP/API Full Product Lifecycle E2E Suite** (`tests/stage7d-artifact-e2e.test.ts`, 12/12 PASS):
  - Scenario A: Practitioner Full Lifecycle (Create -> Read -> Update -> Soft Delete -> Restore);
  - Scenario B: Multi-Entity Association Lifecycle (5 categories attached -> batch updated -> query hydrated);
  - Scenario C: Assessment Proposal Settlement Integration (CREATE & EXISTING resolutions atomic execution);
  - Scenario D: Assessment Proposal IGNORE Resolution (Zero deliverable writes, zero deliverable links);
  - Scenario E: Cross-User Attack (User B cannot link User A's artifact in settlement -> non-disclosing 404);
  - Scenario F: Stage 7C UI Contract Bridge Verification (ArtifactCreateModal, ArtifactLinkManagerModal, ArtifactProposalResolutionPicker payload shapes accepted by live endpoints).
- [x] **Hostile-Client & Security Isolation Audit** (`tests/stage7d-artifact-security.test.ts`, 16/16 PASS):
  - Strict Cross-Tenant Isolation: No enumeration, non-disclosing 404s on foreign artifact access;
  - Artifact CRUD Authority & Constraints: Canonical type validation, lifecycle coherence constraint checks;
  - Relationship Authority & True Cross-Category Batch Atomicity: Fail-closed rollback on foreign entity, all-or-nothing commitment;
  - Provenance & Evidence Deletion Protection: Fail-closed guard triggers prevent deleting referenced artifacts;
  - Assessment Proposal Settlement Full Rollback: Authoritative snapshot (`snapshotSettlementState`) proves zero state mutation on failure across player, skills, mastery, evidence, knowledge, quests, artifacts, and relations;
  - Duplicate Confirm Idempotency: Deep snapshot equality proves zero duplicate mutation on 409 rejection;
  - Concurrency Audit: Parallel confirmation requests on same assessment yield mutex protection with exactly one success and zero duplicate mutations.
- [x] **PostgreSQL RLS & RPC Privilege Matrix Audit** (`tests/stage7d-artifact-db.test.ts`, 15/15 PASS):
  - Row Level Security (RLS) enforcement on all tables;
  - Transaction isolation and non-blocking concurrency;
  - Anonymous role full rejection across all artifact tables;
  - Authoritative SECURITY DEFINER RPC privilege matrix on `settle_activity`:
    - `public`: NO EXECUTE;
    - `anon`: NO EXECUTE;
    - `authenticated`: NO EXECUTE;
    - `service_role`: EXECUTE;
  - Direct SQL runtime attack attempts by `authenticated` and `anon` rejected with `permission denied`.
- [x] **Clean PR Merge & Documentation Freeze**:
  - PR #17 merged into `main` with 0 unresolved review threads and 0 production code delta;
  - Artifact System officially declared **COMPLETE & FINAL FROZEN**.
