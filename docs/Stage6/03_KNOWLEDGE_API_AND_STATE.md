# Stage 6 — Knowledge Map API & Read Model Specification

> **Status**: FINAL FROZEN (STAGE 6A ROUND 3 CLOSURE)  
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
│ /api/knowledge/[id]/verify                   │ POST   │ Promote inferred node -> verified (conf=1.00)  │
│ /api/knowledge/[id]/reject                   │ POST   │ Reject AI inferred node -> rejected            │
│ /api/knowledge/[id]                          │ DELETE │ Delete node (cascades associated edges)        │
│ /api/knowledge/edges                         │ GET    │ Query raw edges by domain or status            │
│ /api/knowledge/edges                         │ POST   │ Create user-defined knowledge edge             │
│ /api/knowledge/edges/[id]                    │ GET    │ Query edge detail with full provenance audit   │
│ /api/knowledge/edges/[id]/verify             │ POST   │ Promote inferred edge -> verified (conf=1.00)  │
│ /api/knowledge/edges/[id]/reject             │ POST   │ Reject AI inferred edge -> rejected            │
│ /api/knowledge/edges/[id]                    │ DELETE │ Delete edge                                    │
└──────────────────────────────────────────────┴────────┴────────────────────────────────────────────────┘
```

---

## 2. Progressive Loading & Query Contract (`GET /api/knowledge`)

To support large knowledge graphs without client DOM saturation, `GET /api/knowledge` defines deterministic progressive sub-graph loading:

### 2.1 Query Parameters

| Parameter | Type | Default | Bounded Rules / Behavior |
|:---|:---|:---|:---|
| **`domainId`** | UUID | `undefined` | 仅返回归属于该 domain_id 的节点及其内部连边 |
| **`status`** | Enum | `'all'` | 可选 `'all' \| 'verified' \| 'inferred' \| 'archived'`。默认 `'all'` 返回活跃节点（排除已归档与已否决节点） |
| **`nodeType`** | Enum | `undefined` | 可选 `'concept' \| 'claim' \| 'topic'` |
| **`search`** | string | `undefined` | 标题不区分大小写模糊匹配过滤 |
| **`rootNodeId`** | UUID | `undefined` | 锚点节点 ID。若指定，则从该节点出发进行 k-hop ego 图展开 |
| **`depth`** | integer | `1` (若有 root) | 展开深度，严格约束在 `1 <= depth <= 3`。若传入 $< 1$ 或 $> 3$ 返回 **`400 Bad Request (invalid_depth)`** |
| **`limit`** | integer | `60` | 单次返回最大节点数，硬性上限 `100`。超过上限截断并标记 `isTruncated: true` |

### 2.2 Execution Semantics
1. **Initial Viewport (Without `rootNodeId`)**:
   - 确定性加载顶层主题 (Topic) 及各领域核心节点（最多 `limit` 个节点，按更新时间/度数排序）；
   - 返回包含的节点和节点间的所有边。
2. **Progressive Expansion (With `rootNodeId`)**:
   - 从 `rootNodeId` 开始递归遍历入边与出边，展开至指定 `depth` 层（$k$-hop ego graph）；
   - 若 `rootNodeId` 不存在或属于其他租户，直接返回 **`404 Not Found`**；
   - 结果严格去重，最多包含 `limit` 个相关节点。

---

## 3. DTO Schemas & Type Contracts

### 3.1 Graph Query (`GET /api/knowledge`)

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
    sourceId: string | null;
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
    sourceType: "activity" | "artifact" | "user_created" | "ai_proposal" | "imported";
    sourceId: string | null;
    provenanceNote: string | null;
    verifiedAt: string | null;
    verifiedBy: string | null;
  }>;
  stats: {
    totalNodes: number;
    verifiedNodes: number;
    inferredNodes: number;
    totalEdges: number;
    verifiedEdges: number;
    inferredEdges: number;
    isTruncated: boolean;
  };
}
```

---

### 3.2 Node Detail Read Model (`GET /api/knowledge/[id]`)

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
      sourceType: string;
      sourceId: string | null;
      provenanceNote: string | null;
    }>;
    outbound: Array<{
      edgeId: string;
      targetNodeId: string;
      targetNodeTitle: string;
      targetNodeType: string;
      relationType: string;
      verificationStatus: string;
      confidence: number;
      sourceType: string;
      sourceId: string | null;
      provenanceNote: string | null;
    }>;
  };
}
```

---

### 3.3 Edge Detail Read Model (`GET /api/knowledge/edges/[id]`)

#### Response DTO (`200 OK`)
```typescript
export interface KnowledgeEdgeDetailResponse {
  edge: {
    id: string;
    sourceNodeId: string;
    sourceNodeTitle: string;
    targetNodeId: string;
    targetNodeTitle: string;
    relationType: "prerequisite" | "contains" | "supports" | "contradicts" | "relates_to";
    verificationStatus: "inferred" | "verified" | "rejected" | "superseded";
    confidence: number;
    isArchived: boolean;
    sourceType: "activity" | "artifact" | "user_created" | "ai_proposal" | "imported";
    sourceId: string | null;
    provenanceNote: string | null;
    verifiedAt: string | null;
    verifiedBy: string | null;
    createdAt: string;
    updatedAt: string;
  };
  provenance: {
    sourceActivity: {
      id: string;
      title: string;
      completedAt: string;
    } | null;
    sourceArtifact: {
      id: string;
      title: string;
      type: string;
    } | null;
  };
}
```

---

## 4. HTTP Status Code & Security Matrix

| Scenario | HTTP Status | Detail / Error Code |
|:---|:---|:---|
| 未提供有效 session 访问任何 API | **`401 Unauthorized`** | `auth_required` |
| 提供非法的 UUID 格式 (node ID / edge ID / domainId / rootNodeId) | **`400 Bad Request`** | `invalid_uuid` |
| 提供超出 1..3 范围的 progressive `depth` | **`400 Bad Request`** | `invalid_depth` |
| 尝试创建空标题知识节点 | **`400 Bad Request`** | `empty_title` |
| `relates_to` 关系未提供 `provenance_note` 说明 | **`400 Bad Request`** | `missing_provenance_note` |
| 尝试创建自环边 (`source == target`) | **`400 Bad Request`** | `self_reference_forbidden` |
| 对称关系未按规范序 (`source > target`) 提交且未被客户端排序 | **`400 Bad Request`** | `uncanonicalized_symmetric_edge` |
| 尝试对非 `inferred` 节点或边执行 verify/reject | **`409 Conflict`** | `invalid_authority_transition` |
| 尝试将 `prerequisite` 或 `contains` 连成有向环 | **`409 Conflict`** | `cyclic_dependency` (PG 23514) |
| 尝试创建完全重复的关系边 | **`409 Conflict`** | `duplicate_edge` (PG 23505) |
| 尝试查询或操作属于其他租户的节点/边/根节点 | **`404 Not Found`** | 严格防探测统一降级为 404 |
| 成功删除节点或边 | **`204 No Content`** | 空响应体 |
