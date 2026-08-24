# Stage 6 — Knowledge Map Domain Model

> **Status**: FINAL FROZEN (STAGE 6A DESIGN CLOSURE)  
> **Target Milestone**: Stage 6 (Knowledge Map)  
> **Related Rules**: `docs/Design ChatGPT/01_SYSTEM_RULES.md`, `docs/Design ChatGPT/02_PRODUCT_DESIGN.md`, `docs/Design ChatGPT/04_MVP_ROADMAP_AND_ACCEPTANCE.md`, `docs/Design ChatGPT/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md`

---

## 1. Ontological Foundations & Core Invariants

The AI Personal Growth RPG enforces a fundamental structural distinction between **practical capability** and **declarative/relational knowledge**:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                                 CORE ONTOLOGICAL SEPARATION                              │
├───────────────────────────────┬──────────────────────────────────────────────────────────┤
│    Dimension                  │ Skill Tree (Stage 5 — FROZEN)                            │
├───────────────────────────────┼──────────────────────────────────────────────────────────┤
│  Core Question                │ “我会什么？” (What can I DO?)                            │
│  Atomic Unit                  │ Skill (行动能力、程序性知识、实践技能)                  │
│  Progression Metric           │ XP, Level (练习量) + Mastery M0–M10 (能力深度)           │
│  Validation Base              │ 行动产出、代码、报告、真实成果 (Evidence + Mastery)      │
│  Graph Topology               │ 混合有向图: prerequisite (DAG), contains (Tree), supports │
├───────────────────────────────┼──────────────────────────────────────────────────────────┤
│    Dimension                  │ Knowledge Map (Stage 6 — TARGET)                         │
├───────────────────────────────┼──────────────────────────────────────────────────────────┤
│  Core Question                │ “我知道什么，以及它们如何连接？” (What do I KNOW?)        │
│  Atomic Unit                  │ Knowledge Node (概念 Concept, 命题 Claim, 理论 Topic)   │
│  Epistemic State              │ Inferred (AI 推理假设) vs Verified (已验证事实)         │
│  Validation Base              │ 来源追溯 (Provenance: Activity / Artifact / User Entry)  │
│  Graph Topology               │ 语义概念网: prerequisite (DAG), contains (DAG),          │
│                               │ supports (Network), contradicts (Symmetric Canonical),   │
│                               │ relates_to (Symmetric Canonical with Note)               │
└───────────────────────────────┴──────────────────────────────────────────────────────────┘
```

### 1.1 Non-Negotiable Invariants for Stage 6

1. **AI Inference is NOT Verified Truth**:  
   AI Game Master (LLM) may propose concepts and inferred connections between them (`verification_status = 'inferred'`, confidence $\le$ 0.95), but **AI inference alone must NEVER silently become permanent verified truth**. Only explicit user verification or approved authority action can promote to `verification_status = 'verified'` (confidence = 1.00).
2. **Skill != Knowledge Node**:  
   A `Skill` (e.g. "Polymerase Chain Reaction") represents actionable skill; a `KnowledgeNode` (e.g. "Taq Polymerase Heat Resistance Principle") represents the underlying concept or fact. A knowledge node may optionally link to a skill via `skill_id`, but the two entities never collapse.
3. **High Mastery Requires Evidence; High Knowledge Requires Provenance**:  
   Every knowledge node and edge must answer: *"Why does the system believe this?"* via traceable source IDs (`activity_id`, `artifact_id`, `user_created`, `ai_proposal`, `imported`).
4. **Tenant Isolation with Composite Foreign Keys**:  
   All tables (`knowledge_nodes`, `knowledge_edges`) are strictly scoped by `user_id` with composite unique constraints and foreign keys to prevent any cross-tenant leakage.

---

## 2. Entity Hierarchy & Taxonomy

```text
Domain (域：知识与技能分类，如 Computer Science, Bioinformatics)
  │
  ├── Knowledge Node (知识节点：概念 Concept / 命题 Claim / 理论主题 Topic)
  │     ├── [FK] user_id (租户隔离)
  │     ├── [FK] domain_id (可选归属域)
  │     ├── [FK] skill_id (可选关联技能，保留认知与能力映射)
  │     ├── node_type: 'concept' | 'claim' | 'topic'
  │     ├── verification_status: 'inferred' | 'verified' | 'rejected' | 'superseded'
  │     ├── is_archived: boolean (生命周期独立于真值权威)
  │     │
  │     └── Knowledge Edge (知识边：多类型语义连接)
  │           ├── source_node_id ──► target_node_id
  │           ├── relation_type: 'prerequisite' | 'contains' | 'supports' | 'contradicts' | 'relates_to'
  │           ├── verification_status: 'inferred' | 'verified' | 'rejected' | 'superseded'
  │           ├── is_archived: boolean
  │           ├── confidence: 0.0 – 1.0 (衡量 AI 推理不确定性，非玩家经验)
  │           └── provenance: source_type, source_id, provenance_note
```

---

## 3. Knowledge Node: Concept vs Claim vs Topic

To prevent ontology confusion, `knowledge_nodes` explicitly distinguishes node semantics via `node_type`:

| `node_type` | 语义定义 | 典型示例 | 验证特点 |
|:---|:---|:---|:---|
| **`concept`** | 名词性知识单元、实体、技术术语、理论概念 | `DNA Metabarcoding`, `Attention Mechanism`, `RLS` | 通常是客观公认的名词，通过学习活动或阅读记录发现 |
| **`claim`** | 断言、命题、实验假说、设计结论 | `trnL P6 loop is suitable for degraded plant DNA` | 具有真值判断，可被 `supports` 或 `contradicts` 连接 |
| **`topic`** | 领域分支、专题大类、知识体系框架 | `Molecular Phylogenetics`, `Distributed Consensus` | 宏观容器，常作为 `contains` 关系的源节点 |

### 3.1 Knowledge Node Schema Attributes

```typescript
export interface KnowledgeNode {
  id: string; // UUID v4
  userId: string;
  domainId: string | null;
  skillId: string | null; // Optional link to practical skill
  nodeType: "concept" | "claim" | "topic";
  title: string; // Display title, e.g. "DNA Metabarcoding"
  normalizedTitle: string; // DB generated: lower(trim(title)) for unique deduplication
  description: string | null;
  verificationStatus: "inferred" | "verified" | "rejected" | "superseded";
  confidence: number; // 0.00..0.95 for inferred; 1.00 for verified
  sourceType: "activity" | "artifact" | "user_created" | "ai_proposal" | "imported";
  sourceId: string | null; // UUID of activity / artifact
  verifiedAt: string | null;
  verifiedBy: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  metadata: Record<string, unknown>; // Extensible JSON metadata
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. Knowledge Edge Ontology & Mathematical Properties

Knowledge edges are NOT Skill prerequisite edges. Different relation types exhibit distinct mathematical properties:

```text
┌────────────────┬───────────┬──────────────┬───────────────┬───────────────────────────────┐
│ Relation Type  │ Direction │ Graph Type   │ Transitivity  │ Semantic Meaning              │
├────────────────┼───────────┼──────────────┼───────────────┼───────────────────────────────┤
│ prerequisite   │ Directed  │ Strict DAG   │ Transitive    │ 理解 target 必须先理解 source │
│ contains       │ Directed  │ DAG          │ Transitive    │ source 主题/概念包含 target   │
│ supports       │ Directed  │ Network      │ Non-Transitive│ source 为 target 提供理论/实验支持 │
│ contradicts    │ Symmetric │ Canonical    │ Non-Transitive│ source 与 target 存在冲突或竞争假说│
│ relates_to     │ Symmetric │ Canonical    │ Non-Transitive│ source 与 target 存在概念关联(带说明)│
└────────────────┴───────────┴──────────────┴───────────────┴───────────────────────────────┘
```

### 4.1 True Symmetric Storage & Detailed Edge Semantics

1. **`prerequisite` (认知前置)**:
   - **方向**：`source ──► target`（理解 source 是理解 target 的认知前置条件）。
   - **约束**：**严格 DAG（禁止有向环）**。数据库通过触发器防止循环前置。
   - **示例**：`"Linear Algebra" ──prerequisite──► "Principal Component Analysis"`

2. **`contains` (层级包含)**:
   - **方向**：`source (Parent/Broader) ──► target (Child/Narrower)`。
   - **约束**：**DAG（禁止循环包含）**。
   - **示例**：`"Transformer Architecture" ──contains──► "Self-Attention"`

3. **`supports` (支撑/论据)**:
   - **方向**：`source (Evidence/Theory/Fact) ──► target (Claim/Hypothesis)`。
   - **约束**：有向网状图（允许双向互证，禁止自环 `source == target`）。
   - **示例**：`"Experimental Result A" ──supports──► "High Enzyme Efficiency Claim"`

4. **`contradicts` (矛盾/对立 — True Symmetric Storage)**:
   - **对称存储规范**：单条无序逻辑边。数据库 CHECK 约束强制规范序：`source_node_id < target_node_id`。杜绝双向重复插入。
   - **示例**：`"Neutral Mutation Theory" ──contradicts──► "Strict Selectionism"`

5. **`relates_to` (语义关联 — True Symmetric Storage + Provenance Note)**:
   - **对称存储规范**：单条无序逻辑边（强制 `source_node_id < target_node_id`）。
   - **证据说明硬约束**：必须附带非空 `provenance_note` 解释关联原因（杜绝无意义全连接）。
   - **示例**：`"Epigenetics" ──relates_to──► "Environmental Adaptation" (note: "Gene expression plasticity")`

---

## 5. Normalization, Deduplication & Tenant Integrity

### 5.1 Deduplication Rules
1. **Title Normalization**: `normalized_title = lower(regexp_replace(trim(title), '\s+', ' ', 'g'))`
2. **Node Uniqueness**: `UNIQUE (user_id, normalized_title)` 确保同一租户下不出现重复概念。
3. **Edge Uniqueness**: `UNIQUE (user_id, source_node_id, target_node_id, relation_type)` 防止同一对节点间存在完全相同的关系边。
4. **Self-Reference Prohibition**: 检查约束 `CHECK (source_node_id <> target_node_id)` 绝对杜绝自环。
5. **Symmetric Canonicalization**: `CHECK (relation_type NOT IN ('contradicts', 'relates_to') OR source_node_id < target_node_id)`

### 5.2 Tenant Composite Foreign Keys (Strict Isolation)
```sql
CONSTRAINT fk_knowledge_edges_source_tenant_safe
  FOREIGN KEY (user_id, source_node_id)
  REFERENCES public.knowledge_nodes(user_id, id)
  ON DELETE CASCADE;

CONSTRAINT fk_knowledge_edges_target_tenant_safe
  FOREIGN KEY (user_id, target_node_id)
  REFERENCES public.knowledge_nodes(user_id, id)
  ON DELETE CASCADE;
```
任何跨租户的节点引用均会在数据库外键约束层面被直接拒绝。
