# Stage 5 — Skill Tree API & Derived State Specification

> **Status**: PROPOSED / DESIGN FREEZE CANDIDATE  
> **Target Milestone**: Stage 5 (Skill Tree)  
> **Related Rules**: `docs/Design ChatGPT/03_TECHNICAL_IMPLEMENTATION.md`, `docs/Design ChatGPT/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md`

---

## 1. Skill Derived State Machine

To prevent data corruption and state conflicts, product states (`locked`, `available`, `learning`, `proficient`, `advanced`, `archived`) are **purely derived at runtime/query-time**, and are NOT arbitrarily mutable database columns.

```text
                               ┌──────────────┐
                               │   archived   │ (skill.status == 'archived')
                               └──────────────┘
                                      ▲
                                      │ (archive action)
                 ┌────────────────────┴────────────────────┐
                 │                                         │
        [Any active prerequisite unfulfilled?]             │
                 │                                         │
         YES ────┴────► ┌────────────┐                     │
                        │   locked   │                     │
                        └────────────┘                     │
                              │ (All prerequisites fulfilled)
                              ▼                            │
                        ┌────────────┐                     │
                        │ available  │ (xp == 0 && M <= 1) │
                        └────────────┘                     │
                              │ (First practice / XP > 0)  │
                              ▼                            │
                        ┌────────────┐                     │
                        │  learning  │ (M < 3 || conf < 0.5)
                        └────────────┘                     │
                              │ (M >= 3 && conf >= 0.5)    │
                              ▼                            │
                        ┌────────────┐                     │
                        │ proficient │ (3 <= M < 6)        │
                        └────────────┘                     │
                              │ (M >= 6 && conf >= 0.5)    │
                              ▼                            │
                        ┌────────────┐                     │
                        │  advanced  │ (M >= 6)            │
                        └────────────┘                     │
```

### 1.1 Formal Derived State Definitions

Given a skill $S$, its incoming prerequisite edges $\text{Prereqs}(S) = \{ P \mid (P \to S, \text{type} = \text{'prerequisite'}) \}$, and mastery confidence threshold $\theta = 0.5$:

$$\text{IsPrereqFulfilled}(P) \iff \Big( P.\text{mastery\_level} \ge 2 \lor P.\text{level} \ge 2 \Big)$$

$$\text{AllPrereqsMet}(S) \iff \forall P \in \text{Prereqs}(S), \text{IsPrereqFulfilled}(P)$$

| Derived State | 严格判定公式 (Evaluation Predicates) | 语义说明 |
|---|---|---|
| **`archived`** | $S.\text{status} = \text{'archived'}$ | 技能已归档隐藏。 |
| **`locked`** | $S.\text{status} \ne \text{'archived'} \land \neg \text{AllPrereqsMet}(S)$ | 存在未满足的前置依赖技能。 |
| **`available`** | $S.\text{status} \ne \text{'archived'} \land \text{AllPrereqsMet}(S) \land S.\text{xp} = 0 \land S.\text{mastery\_level} \le 1$ | 前置已满足，但尚未开始有效练习。 |
| **`learning`** | $S.\text{status} \ne \text{'archived'} \land \text{AllPrereqsMet}(S) \land \big( S.\text{xp} > 0 \land (S.\text{mastery\_level} < 3 \lor S.\text{mastery\_confidence} < 0.5) \big)$ | 已开始练习，处于基础掌握或待复习状态。 |
| **`proficient`** | $S.\text{status} \ne \text{'archived'} \land \text{AllPrereqsMet}(S) \land 3 \le S.\text{mastery\_level} < 6 \land S.\text{mastery\_confidence} \ge 0.5$ | 能够独立应用，掌握度达到 M3–M5。 |
| **`advanced`** | $S.\text{status} \ne \text{'archived'} \land \text{AllPrereqsMet}(S) \land S.\text{mastery\_level} \ge 6 \land S.\text{mastery\_confidence} \ge 0.5$ | 高阶掌握 M6–M10，具备强证据支撑。 |

### 1.2 Anti-Conflict Guarantee
- 状态计算为单调互斥条件阶梯，严格杜绝出现 `Mastery = M1 但 derivedState = 'advanced'` 的语义冲突。

---

## 2. API Contract Specification

### 2.1 `GET /api/skills`
获取当前用户的全量技能树、域层级及边关系。

- **Query Parameters**:
  - `domainId` *(optional, UUID)*: 按特定域过滤
  - `status` *(optional)*: `active` | `archived` | `all` (default: `active`)
- **Response Format (`200 OK`)**:
```json
{
  "domains": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "name": "Computer Science",
      "slug": "computer-science",
      "parentId": null,
      "sortOrder": 0
    }
  ],
  "nodes": [
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "domainId": "11111111-1111-1111-1111-111111111111",
      "position": { "x": 0, "y": 0 },
      "data": {
        "name": "TypeScript",
        "aliases": ["TS"],
        "level": 4,
        "xp": 350,
        "masteryLevel": 3,
        "masteryConfidence": 0.85,
        "derivedState": "proficient",
        "lastUsedAt": "2026-08-20T10:00:00.000Z",
        "prerequisiteCount": 1,
        "unfulfilledPrerequisiteCount": 0
      }
    }
  ],
  "edges": [
    {
      "id": "edge-uuid-3333",
      "source": "parent-skill-uuid",
      "target": "22222222-2222-2222-2222-222222222222",
      "relation": "prerequisite",
      "animated": true
    }
  ]
}
```

---

### 2.2 `GET /api/skills/[id]`
获取单个技能的完整深度画像及证据链。

- **Response Format (`200 OK`)**:
```json
{
  "skill": {
    "id": "22222222-2222-2222-2222-222222222222",
    "name": "TypeScript",
    "aliases": ["TS"],
    "description": "Typed superset of JavaScript",
    "domainId": "11111111-1111-1111-1111-111111111111",
    "domainName": "Computer Science",
    "level": 4,
    "xp": 350,
    "nextLevelXp": 500,
    "masteryLevel": 3,
    "masteryConfidence": 0.85,
    "derivedState": "proficient",
    "lastUsedAt": "2026-08-20T10:00:00.000Z",
    "createdAt": "2026-08-01T00:00:00.000Z"
  },
  "prerequisites": [
    {
      "id": "source-skill-uuid",
      "name": "JavaScript Fundamentals",
      "masteryLevel": 5,
      "isFulfilled": true
    }
  ],
  "nextUnlocks": [
    {
      "id": "child-skill-uuid",
      "name": "Next.js Fullstack Architecture",
      "derivedState": "learning"
    }
  ],
  "evidenceTimeline": [
    {
      "id": "ev-record-1",
      "activityId": "act-uuid-1",
      "activityTitle": "Refactor auth middleware to strict TypeScript types",
      "evidenceLevel": 4,
      "evidenceType": "production_code",
      "description": "Replaced all any types with strict generics and zod validations",
      "verified": true,
      "createdAt": "2026-08-20T10:00:00.000Z"
    }
  ],
  "masteryHistory": [
    {
      "id": "me-1",
      "eventType": "upgrade",
      "fromLevel": 2,
      "toLevel": 3,
      "confidence": 0.85,
      "reason": "Verified independent refactoring evidence (E4)",
      "createdAt": "2026-08-20T10:05:00.000Z"
    }
  ],
  "recentTransactions": [
    {
      "id": "tx-1",
      "amount": 45,
      "reason": "TypeScript refactor practice",
      "createdAt": "2026-08-20T10:05:00.000Z"
    }
  ]
}
```

---

### 2.3 `POST /api/skills/edges`
在技能间建立关系边（需经 DAG 校验）。

- **Request Body**:
```json
{
  "sourceSkillId": "uuid-source",
  "targetSkillId": "uuid-target",
  "relationType": "prerequisite"
}
```
- **Validation**:
  - `sourceSkillId != targetSkillId`（禁止自环）
  - `relationType in ['prerequisite', 'contains', 'supports']`
  - 若 `relationType === 'prerequisite' | 'contains'`，执行有向环检测（Anti-Cycle Detection），若检测到环路返回 `400 Conflict: Cycle detected in prerequisite DAG`。

---

### 2.4 `DELETE /api/skills/edges/[id]`
删除指定关系边。
- **Response**: `204 No Content`

---

### 2.5 `PATCH /api/skills/[id]`
更新技能显示元数据（不可修改 XP、Level 或 Mastery）。
- **Request Body**:
```json
{
  "name": "TypeScript Advanced",
  "aliases": ["TS", "TypeScript"],
  "domainId": "domain-uuid",
  "description": "Updated description",
  "status": "active"
}
```
- **Response**: `200 OK` 返回更新后的 Skill 对象。
