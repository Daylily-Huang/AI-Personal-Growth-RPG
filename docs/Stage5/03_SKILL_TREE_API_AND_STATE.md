# Stage 5 — Skill Tree API & Derived State Specification

> **Status**: PROPOSED / DESIGN FREEZE (ROUND 2)  
> **Target Milestone**: Stage 5 (Skill Tree)  
> **Related Rules**: `docs/Design ChatGPT/03_TECHNICAL_IMPLEMENTATION.md`, `docs/Design ChatGPT/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md`

---

## 1. Skill Derived State Machine (Total Deterministic Function)

To prevent data corruption and state conflicts, product states (`locked`, `available`, `learning`, `proficient`, `advanced`, `archived`) are **strictly derived at query/runtime via a total deterministic function**.

```text
                               ┌──────────────┐
                               │   archived   │ (skill.status == 'archived')
                               └──────────────┘
                                      ▲
                                      │ (status check)
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
                              │ (xp > 0 || M >= 2)         │
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

---

## 2. Formal Predicates & Hard Prerequisite Invariant

Given a skill $S$, its incoming prerequisite edges $\text{Prereqs}(S) = \{ P \mid (P \to S, \text{relation} = \text{'prerequisite'}) \}$:

### 2.1 Hard Prerequisite Invariant (Mastery-Only)
$$\text{IsPrereqFulfilled}(P) \iff \Big( P.\text{mastery\_level} \ge 2 \land P.\text{mastery\_confidence} \ge 0.5 \Big)$$

$$\text{AllPrereqsMet}(S) \iff \forall P \in \text{Prereqs}(S), \text{IsPrereqFulfilled}(P)$$

> [!IMPORTANT]
> **Level (XP) Cannot Substitute Mastery**:  
> Prerequisite fulfillment is strictly predicated upon demonstrated competence depth ($M \ge 2$ Understand). Grinding XP or high Level on an upstream skill **never** bypasses the requirement for verified competence.

---

## 3. Total Truth Table & Boundary Case Coverage

The function `computeSkillDerivedState(skill, prerequisites)` is guaranteed to partition the entire state space into exactly one mutually exclusive status:

| Status (`status`) | Prereqs Met (`AllPrereqsMet`) | XP (`xp`) | Mastery (`mastery_level`) | Confidence (`mastery_confidence`) | **Derived State** | 场景与业务语义解释 |
|---|---|---|---|---|---|---|
| `'archived'` | Any | Any | Any | Any | **`archived`** | 技能已被用户主动归档隐藏。 |
| `'active'` | **False** | Any | Any | Any | **`locked`** | 存在未满足的前置依赖技能（$P.M < 2$ 或 $P.\text{conf} < 0.5$）。 |
| `'active'` | **True** | $= 0$ | $0$ | Any | **`available`** | 前置就绪，全新未接触技能（M0 无 XP）。 |
| `'active'` | **True** | $= 0$ | $1$ | Any | **`available`** | 前置就绪，仅初步感知概念（M1 无有效练习 XP）。 |
| `'active'` | **True** | $= 0$ | $2$ | Any | **`learning`** | 具备先验理解基础（M2），尚未在系统内产出练习 XP。 |
| `'active'` | **True** | $> 0$ | $0$ | Any | **`learning`** | 已产生练习记录，处于 M0 摸索起步阶段。 |
| `'active'` | **True** | $> 0$ | $1$ | Any | **`learning`** | 已产生练习记录，处于 M1 基础感知阶段。 |
| `'active'` | **True** | $\ge 0$ | $2$ | Any | **`learning`** | 处于 M2 理解阶段，尚未达到 M3 独立应用。 |
| `'active'` | **True** | $\ge 0$ | $3 \le M < 6$ | $< 0.5$ | **`learning`** | 虽达 M3–M5，但置信度衰减至临界值以下，需练习巩固。 |
| `'active'` | **True** | $\ge 0$ | $3 \le M < 6$ | $\ge 0.5$ | **`proficient`** | 掌握度达到 M3–M5 且置信度充足，具备独立实践能力。 |
| `'active'` | **True** | $\ge 0$ | $\ge 6$ | $< 0.5$ | **`learning`** | 虽达高阶 M6+，但当前置信度较低，降级至强化学习态。 |
| `'active'` | **True** | $\ge 0$ | $\ge 6$ | $\ge 0.5$ | **`advanced`** | 高阶掌握 M6–M10 且置信度饱满，具备深度证据支撑。 |

---

## 4. API Contract Specification

### 4.1 `GET /api/skills`
获取当前用户的全量技能树图谱与层级域。

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
      "position": { "x": 280, "y": 140 },
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

### 4.2 `GET /api/skills/[id]`
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
      "masteryConfidence": 0.9,
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

### 4.3 `POST /api/skills/edges`
在技能间建立关系边。

- **Request Body**:
```json
{
  "sourceSkillId": "uuid-source",
  "targetSkillId": "uuid-target",
  "relationType": "prerequisite"
}
```
- **Error Codes**:
  - `400 Bad Request`: 参数不合法或尝试建立自环 (`source == target`);
  - `409 Conflict`: 
    - `prerequisite` 关系检测到有向环 (`Cycle detected in prerequisite DAG`);
    - `contains` 关系目标节点已存在父节点 (`Target already has a contains parent`) 或检测到层级环路;
    - 关系已存在 (`Duplicate edge`).

---

### 4.4 `DELETE /api/skills/edges/[id]`
删除指定关系边。
- **Response**: `204 No Content`
- **Error Codes**:
  - `404 Not Found`: 边不存在或无权操作。

---

### 4.5 `PATCH /api/skills/[id]`
通过服务端专属 `update_skill_metadata` RPC 更新技能展示信息（白名单字段）。

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
- **Error Codes**:
  - `400 Bad Request`: 命名为空或非法参数；
  - `404 Not Found`: 技能不存在或无权操作；
  - `409 Conflict`: 与该用户下已有其他技能的 `normalized_name` 冲突。
