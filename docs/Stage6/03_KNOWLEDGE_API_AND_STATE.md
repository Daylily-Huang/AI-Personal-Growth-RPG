# Stage 6 — Knowledge Map API & Read Model Specification

> **Status**: FINAL FROZEN (STAGE 6A DESIGN CLOSURE)  
> **Target Milestone**: Stage 6 (Knowledge Map)  
> **Related Rules**: `docs/Design ChatGPT/03_TECHNICAL_IMPLEMENTATION.md`, `docs/Stage6/01_KNOWLEDGE_MAP_DOMAIN_MODEL.md`, `docs/Stage6/02_KNOWLEDGE_AUTHORITY_RULES.md`

---

## 1. RESTful API Surface Overview

All Knowledge Map endpoints require authenticated Supabase sessions (`auth.uid()`). Cross-tenant access is strictly denied with HTTP 404 (or 401 unauthenticated). Anonymous access is strictly prohibited (fail-closed).

```text
┌──────────────────────────────────────────────┬────────┬────────────────────────────────────────────────┐
│ Endpoint                                     │ Method │ Purpose                                        │
├──────────────────────────────────────────────┼────────┼────────────────────────────────────────────────┤
│ /api/knowledge                               │ GET    │ Query knowledge graph (nodes + edges + layout) │
│ /api/knowledge                               │ POST   │ Create user-verified knowledge node            │
│ /api/knowledge/[id]                          │ GET    │ Query detailed node read-model with provenance │
│ /api/knowledge/[id]                          │ PATCH  │ Update node metadata, title, domain, archive   │
│ /api/knowledge/[id]                          │ DELETE │ Delete node (cascades associated edges)        │
│ /api/knowledge/edges                         │ GET    │ Query raw edges by domain or status            │
│ /api/knowledge/edges                         │ POST   │ Create user-defined knowledge edge             │
│ /api/knowledge/edges/[id]/verify             │ POST   │ Promote inferred edge -> verified (conf=1.00)  │
│ /api/knowledge/edges/[id]/reject             │ POST   │ Reject AI inferred edge -> rejected            │
│ /api/knowledge/edges/[id]                    │ DELETE │ Delete edge                                    │
└──────────────────────────────────────────────┴────────┴────────────────────────────────────────────────┘
```

---

## 2. DTO Schemas & Type Contracts

### 2.1 Graph Query (`GET /api/knowledge`)

#### Response DTO (`200 OK`)
```typescript
export interface KnowledgeGraphResponse {
  domains: Array<{
    id: string;
    name: string;
    slug: string;
    nodeCount: number;
  }>;
  nodes: Array<{
    id: string;
    title: string;
    nodeType: "concept" | "claim" | "topic";
    domainId: string | null;
    domainName: string | null;
    skillId: string | null;
    skillName: string | null;
    verificationStatus: "inferred" | "verified" | "rejected" | "superseded";
    isArchived: boolean;
    confidence: number;
    sourceType: "activity" | "artifact" | "user_created" | "ai_proposal" | "imported";
    inboundEdgeCount: number;
    outboundEdgeCount: number;
    position: { x: number; y: number }; // Deterministic force/hierarchical layout coordinates
  }>;
  edges: Array<{
    id: string;
    source: string; // source_node_id
    target: string; // target_node_id
    relationType: "prerequisite" | "contains" | "supports" | "contradicts" | "relates_to";
    verificationStatus: "inferred" | "verified" | "rejected" | "superseded";
    isArchived: boolean;
    confidence: number;
    provenanceNote: string | null;
  }>;
  stats: {
    totalNodes: number;
    verifiedNodes: number;
    inferredNodes: number;
    totalEdges: number;
    verifiedEdges: number;
    inferredEdges: number;
  };
}
```

---

### 2.2 Node Detail Read Model (`GET /api/knowledge/[id]`)

#### Response DTO (`200 OK`)
```typescript
export interface KnowledgeNodeDetailResponse {
  node: {
    id: string;
    title: string;
    description: string | null;
    nodeType: "concept" | "claim" | "topic";
    domainId: string | null;
    domainName: string | null;
    skillId: string | null;
    skillName: string | null;
    verificationStatus: "inferred" | "verified" | "rejected" | "superseded";
    isArchived: boolean;
    confidence: number;
    sourceType: "activity" | "artifact" | "user_created" | "ai_proposal" | "imported";
    sourceId: string | null;
    verifiedAt: string | null;
    verifiedBy: string | null;
    metadata: Record<string, unknown>;
    lastReviewedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  provenance: {
    sourceActivity: {
      id: string;
      title: string;
      activityType: string;
      completedAt: string;
    } | null;
    sourceArtifact: {
      id: string;
      title: string;
      type: string;
    } | null;
    evidenceRecords: Array<{
      id: string;
      type: string; // E0–E6
      content: string;
      verified: boolean;
      createdAt: string;
    }>;
  };
  connections: {
    inbound: Array<{
      edgeId: string;
      sourceNodeId: string;
      sourceNodeTitle: string;
      sourceNodeType: string;
      relationType: string;
      verificationStatus: string;
      confidence: number;
    }>;
    outbound: Array<{
      edgeId: string;
      targetNodeId: string;
      targetNodeTitle: string;
      targetNodeType: string;
      relationType: string;
      verificationStatus: string;
      confidence: number;
    }>;
  };
}
```

---

## 3. HTTP Status Code & Security Matrix

| Scenario | HTTP Status | Detail / Error Code |
|:---|:---|:---|
| 未提供有效 session 访问任何 API | **`401 Unauthorized`** | `auth_required` |
| 提供非法的 UUID 格式 (node ID / edge ID / domainId) | **`400 Bad Request`** | `invalid_uuid` |
| 尝试创建空标题知识节点 | **`400 Bad Request`** | `empty_title` |
| `relates_to` 关系未提供 `provenance_note` 说明 | **`400 Bad Request`** | `missing_provenance_note` |
| 尝试创建自环边 (`source == target`) | **`400 Bad Request`** | `self_reference_forbidden` |
| 对称关系未按规范序 (`source > target`) 提交且未被客户端排序 | **`400 Bad Request`** | `uncanonicalized_symmetric_edge` |
| 尝试将 `prerequisite` 或 `contains` 连成有向环 | **`409 Conflict`** | `cyclic_dependency` (PG 23514) |
| 尝试创建完全重复的关系边 | **`409 Conflict`** | `duplicate_edge` (PG 23505) |
| 尝试查询或操作属于其他租户的节点/边 | **`404 Not Found`** | 严格防探测统一降级为 404 |
| 成功删除节点或边 | **`204 No Content`** | 空响应体 |
