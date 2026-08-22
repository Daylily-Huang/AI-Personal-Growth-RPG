# Stage 5 — Skill Tree Domain Model

> **Status**: PROPOSED / DESIGN FREEZE (ROUND 4)  
> **Target Milestone**: Stage 5 (Skill Tree)  
> **Related Rules**: `docs/Design ChatGPT/01_SYSTEM_RULES.md`, `docs/Design ChatGPT/02_PRODUCT_DESIGN.md`, `docs/Design ChatGPT/06_DATABASE_SCHEMA_AND_DATA_DICTIONARY.md`

---

## 1. Core Ontological Separation

The AI Personal Growth RPG distinguishes between practical competence and conceptual knowledge:

| Dimension | **Skill Tree (Stage 5)** | **Knowledge Map (Stage 6 — Out of Scope)** |
|---|---|---|
| **Core Question** | **“我会什么？” (What can I DO?)** | **“我知道什么，以及这些知识如何连接？” (What do I KNOW?)** |
| **Atomic Entity** | **`Skill`**: 行动能力、实践技能、技术工具、程序性知识 | **`KnowledgeNode`**: 概念、原理、理论命题、事实性知识 |
| **Validation Base** | 行为产出、代码、分析报告、实际应用（`Evidence` + `Mastery`） | 理解、回忆、解释、概念关联（`Review` + `Concept Map`） |
| **Progression Metric** | `XP` / `Level`（练习量）+ `Mastery Level` M0–M10（能力深度） | `Mastery`（认知掌握度）+ `Retention Stability`（记忆留存） |
| **Graph Semantics** | 混合有向图：`prerequisite` (严格 DAG), `contains` (单父树/森林), `supports` (协同有向图) | 网状概念图（Concept Network），表达**因果、关联、分类**关系 |

---

## 2. Taxonomy & Entity Hierarchy

```text
Domain (域：分类层级，支持租户安全自引用父子树)
  │
  ├── Skill (原子技能：稳定 UUID 身份，具备 XP、Level、Mastery、Confidence)
  │     │
  │     ├── [Edge: contains] ──── Subskill / Skill Cluster (子技能/技能簇：严格单父树/森林)
  │     ├── [Edge: prerequisite] ─ Upstream Skill (前置依赖技能：严格 DAG，仅看 Mastery)
  │     └── [Edge: supports] ───── Synergy Skill (协同支撑技能：有向图，允许双向互助)
```

### 2.1 Domain (域)
- **定义**：技能与成长的最高层级分类，支持自引用父子层级（例如 `Computer Science` └── `Web Engineering`）。
- **持久化表**：`public.domains`
- **租户层级完整性约束 (Column-Specific SET NULL)**：
  - `UNIQUE (user_id, id)`
  - `FOREIGN KEY (user_id, parent_id) REFERENCES public.domains(user_id, id) ON DELETE SET NULL (parent_id)`（杜绝跨租户指定 parent domain，并在父域被删时仅将 `parent_id` 置 NULL，保持 `user_id` 不变）
  - `slug`: 规范化唯一标识，`UNIQUE (user_id, slug)`

### 2.2 Skill (技能)
- **定义**：可重复实践、可独立评估、产生实际成果的行动能力。
- **持久化表**：`public.skills`
- **核心原则与外键约束 (Column-Specific SET NULL)**：
  - **ID 永久性**：运行时通过 `crypto.randomUUID()` / `gen_random_uuid()` 分配，**严禁由名称派生**；
  - **复合唯一约束**：`UNIQUE (user_id, id)` 为图结构外键提供基石；
  - **域归属外键**：`FOREIGN KEY (user_id, domain_id) REFERENCES public.domains(user_id, id) ON DELETE SET NULL (domain_id)`（杜绝跨租户绑定 Domain，域被删除时仅清空 `domain_id`，`user_id` 绝对保留）；
  - **名称与别名**：`name` 为主显示名，`aliases` 为别名数组（用于多语言或近义词 AI 匹配，如 `["TS", "TypeScript 编程"]`）；
  - **规范化唯一键**：`normalized_name` 由数据库触发器自动计算（小写、去空格），确保同一用户下不出现同名重复技能。

---

## 3. Skill State Attributes & Mastery Action Protocol

每个 Skill 实体具有以下正交的状态维度：

```text
               ┌─────────────────────────────────────────────────────────┐
               │                      Skill State                        │
               ├────────────────────────────┬────────────────────────────┤
               │   Quantitative Volume      │    Qualitative Depth       │
               │   • XP (累计经验值)          │    • Mastery Level (M0-M10)│
               │   • Level (等级 = f(XP))   │    • Mastery Confidence    │
               ├────────────────────────────┼────────────────────────────┤
               │   Temporal Freshness       │    Structural Relation     │
               │   • Last Used At (最后活跃) │    • Prerequisites (前置)  │
               │   • Persisted Confidence   │    • Derived Status (状态) │
               └────────────────────────────┴────────────────────────────┘
```

### 3.1 Non-Negotiable Axioms
1. **Level != Mastery**:
   - `Level` 表示在该技能上累计投入的有效练习量（由 Growth Engine 计算的不可逆 XP 驱动）；
   - `Mastery` 表示通过证据验证达到的能力深度阶梯（M0–M10）。
   - **硬性规则**：前置依赖解锁（Prerequisite Fulfillment）**仅受 Mastery 与 Confidence 约束，严禁通过 Level/XP 替代或绕过**。
2. **Mastery Action 3-State Protocol (Stage 2 Invariant Preserved)**:
   - 技能掌握度结算严格保留原有三态契约：
     - `{ action: "none" }`: 掌握度不变；
     - `{ action: "upgrade", proposedLevel, confidence }`: 立即提升掌握度（适用于低门槛 M1–M3 或已充分验证情况）；
     - `{ action: "request_verification", fromLevel, toLevel, confidence }`: 生成 `mastery_verifications` 待验证队列（M4+ 高门槛必须经过证据验证方可真正落账）。
3. **Mastery != Confidence**:
   - `Mastery` 记录历史达到的最高验证等级（不会随时间自然扣除）；
   - `Mastery Confidence` 表示当前能力的活跃留存置信度。
   - *Stage 5 策略*：消费已持久化的 `mastery_confidence`；自动后台时间衰减计算与事件系统统一延期至 Stage 8（Review Engine）冻结。
4. **Domain != Skill**:
   - Domain 负责宏观分类与统计聚合，不直接记录单个 XP 事务；Skill 是所有 Growth Loop 结算的最小落脚点。

---

## 4. Skill Edge Relations & Graph Invariants

Stage 5 V1 冻结以下三类最小且完备的有向关系：

| 关系类型 (`relation_type`) | 语义定义 | 拓扑与数据库约束 (DB-Level Invariants) | 业务影响 |
|---|---|---|---|
| **`prerequisite`** | **前置依赖**：`Source` 是学习/解锁 `Target` 的必要前提能力。 | 1. **严格 DAG**（DB 触发器禁止任何有向环）<br>2. 禁止自环 (`source != target`)<br>3. **复合外键**：`(user_id, source_skill_id)` 与 `(user_id, target_skill_id)` 分别复合引用 `skills(user_id, id) ON DELETE CASCADE`，数据库引擎级杜绝跨租户连线 | 决定 `Target` 的解锁状态（`locked` vs `available`/`learning`）。 |
| **`contains`** | **结构包含**：`Source` 是复合技能，`Target` 是其下属的子技能或技能簇。 | 1. **严格单父树/森林**：Partial Unique Index 约束每个 Target 至多有一个 contains parent (`UNIQUE(user_id, target_skill_id) WHERE relation_type = 'contains'`)<br>2. 禁止包含自身或祖先（DB 触发器）<br>3. 复合外键租户隔离 | 决定技能树可视化折叠与层级聚类展示。 |
| **`supports`** | **协同支撑**：`Source` 与 `Target` 具有正向协同或迁移促进作用，非阻塞前置。 | 1. **有向协同图**（允许双向互相支撑 A $\to$ B 且 B $\to$ A）<br>2. 禁止自环 (`source != target`)<br>3. 关系唯一 (`UNIQUE(user_id, source_skill_id, target_skill_id, relation_type)`)<br>4. 复合外键租户隔离 | 用于协同推荐、辅助技能高亮与协同加成展示。 |

---

## 5. Domain Invariants Summary

1. **数据库级租户绝对隔离 (Composite FKs + Column-Specific SET NULL)**：所有 `skill_edges`、`skills`、`domains` 与 `evidence_records` 必须通过 `(user_id, foreign_id)` 复合外键相互约束，并使用 `ON DELETE SET NULL (column_name)` 确保租户身份 `user_id` 永远不被置 NULL；
2. **禁止自环**：所有边关系均强制 `source_skill_id <> target_skill_id`；
3. **单父包含约束**：`contains` 关系强制单个子技能至多归属于一个父技能；
4. **前置能力判定**：前置技能是否满足严格基于 `mastery_level >= 2` 与 `mastery_confidence >= 0.5`，不接受 Level 替代；
5. **掌握度三态原貌保留**：严格保留 `none` / `upgrade` / `request_verification` 流程与验证机制；
6. **无损级联**：Skill 被物理删除时（仅限未确认结算的新增草稿），关联 Edge 级联删除；已被结算锁定的 Skill 采用 `status = 'archived'`，保留完整历史账本与引用链。
