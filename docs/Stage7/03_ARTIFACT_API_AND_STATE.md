# Stage 7 — Artifact API & State Specification

> **Status**: DESIGN FREEZE  
> **Milestone**: Stage 7 (Artifact Management & Synthesis System)  
> **Dependencies**: Stage 0–6 (FROZEN)  
> **Related Documents**: `01_ARTIFACT_DOMAIN_MODEL.md`, `02_ARTIFACT_AUTHORITY_RULES.md`, `04_ARTIFACT_UI_SPEC.md`, `05_STAGE7_IMPLEMENTATION_PLAN.md`, `06_STAGE7_ACCEPTANCE_GATES.md`

---

## 1. RESTful API Surface

| Method | Endpoint | Description | Auth & Permission |
|:---|:---|:---|:---|
| `GET` | `/api/artifacts` | List artifacts with filtering, search, and pagination. | Authenticated (`auth.uid() = user_id`) |
| `POST` | `/api/artifacts` | Create a new user-authored artifact with optional links. | Authenticated (`auth.uid() = user_id`) |
| `GET` | `/api/artifacts/[id]` | Get detailed artifact record including all joined relationships. | Authenticated (`auth.uid() = user_id`) |
| `PATCH` | `/api/artifacts/[id]` | Update artifact metadata, lifecycle status, and archive state. | Authenticated (`auth.uid() = user_id`) |
| `DELETE` | `/api/artifacts/[id]` | Delete artifact (blocked if referenced by provenance/evidence). | Authenticated (`auth.uid() = user_id`) |
| `POST` | `/api/artifacts/[id]/links` | Batch attach or detach relational links across all 5 entity types. | Authenticated (`auth.uid() = user_id`) |

---

## 2. Request & Response Payloads

### 2.1 `GET /api/artifacts`
#### Query Parameters
- `type` (optional): Filter by `artifact_type` (`document`, `code_repository`, `design_spec`, `data_analysis`, `presentation`, `synthesis_note`, `creative_work`, `other`).
- `status` (optional, default `'active'`): Filter by lifecycle state (`active`, `archived`, `all`, `draft`, `superseded`).
- `skillId` (optional): Filter artifacts demonstrating a specific skill.
- `questId` (optional): Filter artifacts produced for a specific quest.
- `search` (optional): Case-insensitive text search matching `title` or `summary`.
- `limit` (optional, default `50`, max `100`): Result count limit.
- `offset` (optional, default `0`): Pagination offset.

#### Response (200 OK)
```json
{
  "artifacts": [
    {
      "id": "a1b2c3d4-0000-0000-0000-000000000001",
      "title": "Neural Plasticity Research Paper",
      "artifactType": "document",
      "summary": "Comprehensive survey on LTP and Hebbian learning mechanisms.",
      "lifecycleStatus": "active",
      "version": "v1.2",
      "externalUrl": "https://arxiv.org/abs/example",
      "reusabilityScore": 0.85,
      "isArchived": false,
      "createdAt": "2026-08-26T10:00:00Z",
      "updatedAt": "2026-08-26T12:00:00Z",
      "counts": {
        "skills": 2,
        "knowledgeNodes": 4,
        "quests": 1,
        "activities": 3,
        "evidence": 1
      }
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

---

### 2.2 `POST /api/artifacts`
#### Request Body
```json
{
  "title": "Knowledge Graph Canvas Architecture RFC",
  "artifactType": "design_spec",
  "summary": "Technical architecture for ReactFlow 3-column epistemic canvas.",
  "description": "Detailed design specification covering zoom controls, node styling, and CAS modals.",
  "version": "1.0",
  "externalUrl": "https://github.com/Daylily-Huang/AI-Personal-Growth-RPG/pull/8",
  "reusabilityScore": 0.90,
  "metadata": {
    "framework": "ReactFlow",
    "pages": 12
  },
  "skillIds": ["s1-uuid"],
  "knowledgeNodeIds": ["k1-uuid", "k2-uuid"],
  "questIds": ["q1-uuid"],
  "activityIds": ["act1-uuid"],
  "evidenceIds": ["ev1-uuid"]
}
```

#### Response (201 Created)
```json
{
  "artifact": {
    "id": "new-artifact-uuid",
    "title": "Knowledge Graph Canvas Architecture RFC",
    "artifactType": "design_spec",
    "summary": "Technical architecture for ReactFlow 3-column epistemic canvas.",
    "description": "Detailed design specification covering zoom controls, node styling, and CAS modals.",
    "lifecycleStatus": "active",
    "version": "1.0",
    "externalUrl": "https://github.com/Daylily-Huang/AI-Personal-Growth-RPG/pull/8",
    "reusabilityScore": 0.90,
    "metadata": { "framework": "ReactFlow", "pages": 12 },
    "isArchived": false,
    "createdAt": "2026-08-26T22:30:00Z",
    "updatedAt": "2026-08-26T22:30:00Z"
  }
}
```

---

### 2.3 `GET /api/artifacts/[id]`
#### Response (200 OK)
```json
{
  "artifact": {
    "id": "a1b2c3d4-0000-0000-0000-000000000001",
    "title": "Neural Plasticity Research Paper",
    "artifactType": "document",
    "summary": "Comprehensive survey on LTP and Hebbian learning mechanisms.",
    "description": "In-depth survey paper reviewing modern neurobiological findings...",
    "lifecycleStatus": "active",
    "version": "v1.2",
    "storagePath": null,
    "externalUrl": "https://arxiv.org/abs/example",
    "reusabilityScore": 0.85,
    "metadata": {},
    "isArchived": false,
    "archivedAt": null,
    "createdAt": "2026-08-26T10:00:00Z",
    "updatedAt": "2026-08-26T12:00:00Z"
  },
  "links": {
    "skills": [
      {
        "id": "skill-uuid-1",
        "name": "Neuroscience Research",
        "level": 3,
        "demonstrationLevel": 4
      }
    ],
    "knowledgeNodes": [
      {
        "id": "node-uuid-1",
        "title": "Long-Term Potentiation (LTP)",
        "nodeType": "concept",
        "verificationStatus": "verified",
        "relationType": "synthesizes"
      }
    ],
    "quests": [
      {
        "id": "quest-uuid-1",
        "title": "Complete Neurobiology Module",
        "status": "completed",
        "isPrimaryDeliverable": true
      }
    ],
    "activities": [
      {
        "id": "activity-uuid-1",
        "title": "Surveyed synaptic plasticity papers",
        "activityRole": "produced",
        "completedAt": "2026-08-26T10:00:00Z"
      }
    ],
    "evidence": [
      {
        "id": "evidence-uuid-1",
        "evidenceLevel": 4,
        "description": "Published research paper draft on synaptic plasticity",
        "verified": true
      }
    ]
  }
}
```

---

### 2.4 `PATCH /api/artifacts/[id]`
#### Request Body
```json
{
  "title": "Updated Title",
  "summary": "Updated summary",
  "reusabilityScore": 0.95,
  "lifecycleStatus": "archived",
  "isArchived": true
}
```
#### Response (200 OK)
Returns updated `artifact` object.

---

### 2.5 `DELETE /api/artifacts/[id]`
- If referenced by knowledge provenance or evidence: Returns **`409 Conflict`** (`code: "referenced_by_provenance"`, `error: "Cannot delete artifact referenced by knowledge provenance or evidence records. Please archive instead."`).
- If unreferenced: Deletes artifact and cascading joins $\rightarrow$ returns **`204 No Content`**.

---

### 2.6 `POST /api/artifacts/[id]/links` (Batch Link Management)
#### Request Body (All 5 Entity Types)
```json
{
  "activities": [
    { "activityId": "act-1", "action": "attach", "activityRole": "produced" },
    { "activityId": "act-2", "action": "detach" }
  ],
  "skills": [
    { "skillId": "sk-1", "action": "attach", "demonstrationLevel": 4 },
    { "skillId": "sk-2", "action": "detach" }
  ],
  "knowledgeNodes": [
    { "nodeId": "kn-1", "action": "attach", "relationType": "synthesizes" },
    { "nodeId": "kn-2", "action": "detach" }
  ],
  "quests": [
    { "questId": "q-1", "action": "attach", "isPrimaryDeliverable": true },
    { "questId": "q-2", "action": "detach" }
  ],
  "evidence": [
    { "evidenceId": "ev-1", "action": "attach" },
    { "evidenceId": "ev-2", "action": "detach" }
  ]
}
```
#### Response (200 OK)
Returns refreshed relationship counts and links object.

---

## 3. AI Assessment & Settlement Contract (Stage 7B Integration)

### 3.1 Assessment Response: Plural `artifactProposals`
During `POST /api/activities/[id]/assess`, the AI may return 0, 1, or N proposals inside `assessment.proposal.artifactProposals`:
```json
{
  "assessment": {
    "id": "assessment-uuid",
    "activityId": "activity-uuid",
    "proposal": {
      "artifactProposals": [
        {
          "title": "Synaptic Plasticity Literature Review",
          "artifactType": "document",
          "summary": "12-page comprehensive review on LTP and synaptic scaling.",
          "description": "Synthesized 24 papers on hippocampal plasticity mechanisms.",
          "version": "1.0",
          "externalUrl": "https://arxiv.org/abs/example",
          "reusabilityScore": 0.85,
          "metadata": { "pageCount": 12 },
          "skillIds": ["skill-uuid-1"],
          "knowledgeNodeIds": ["node-uuid-1", "node-uuid-2"],
          "questIds": ["quest-uuid-1"]
        },
        {
          "title": "Synaptic Plasticity Seminar Slides",
          "artifactType": "presentation",
          "summary": "Slide deck for 45-minute presentation.",
          "version": "1.0",
          "reusabilityScore": 0.70,
          "skillIds": ["skill-uuid-1"]
        }
      ]
    }
  }
}
```

### 3.2 Confirmation Request: `artifactResolutions` (Bound by `proposalIndex`)
On `POST /api/assessments/[id]/confirm`, the client submits resolution directives explicitly bound to the proposal indices:
```json
{
  "artifactResolutions": [
    {
      "proposalIndex": 0,
      "resolution": "create",
      "approvedOverrides": {
        "title": "Synaptic Plasticity Literature Review (Final Draft)",
        "reusabilityScore": 0.90
      }
    },
    {
      "proposalIndex": 1,
      "resolution": "existing",
      "artifactId": "existing-deck-artifact-uuid",
      "activityRole": "modified"
    }
  ]
}
```

### 3.3 Confirmation Validation & Response Codes
- **Coverage Validation (HTTP 400)**: If `artifactResolutions` has duplicate indices, out-of-range indices, or missing indices relative to stored proposals, returns **`400 Bad Request`** with zero mutations.
- **Malformed UUID (HTTP 400)**: If `artifactId` in an `existing` directive is not a valid UUID string, returns **`400 Bad Request`**.
- **Foreign UUID (HTTP 404)**: If `artifactId` is well-formed but belongs to another tenant, returns **`404 Not Found`** (non-disclosing), aborting settlement.
- **Normalized-Title Collision (HTTP 409)**: If `create` encounters an existing normalized title for the same user, returns **`409 Conflict`** (`code: "artifact_title_conflict"`), rolling back the entire settlement transaction.
- **Repeat Confirmation (HTTP 409)**: If the assessment is already settled, returns **`409 Conflict`** (`code: "already_confirmed"`), guaranteeing zero duplicate mutations.
- **Successful Settlement (HTTP 200)**: Commits the atomic transaction and returns the settled growth state.
