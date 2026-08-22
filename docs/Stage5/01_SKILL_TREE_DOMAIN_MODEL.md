# Stage 5 — Skill Tree Domain Model

> **Status**: PROPOSED / DESIGN FREEZE CANDIDATE  
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
| **Graph Semantics** | 有向无环图（DAG），表达**依赖、包含、支撑**关系 | 网状概念图（Concept Network），表达**因果、关联、分类**关系 |

---

## 2. Taxonomy & Entity Hierarchy

```text
Domain (域：知识/能力大类，支持树状层级)
  │
  ├── Skill (原子技能：稳定 UUID 身份，具备 XP、Level、Mastery、Confidence)
  │     │
  │     ├── [Edge: contains] ──── Subskill / Skill Cluster (子技能/技能簇)
  │     ├── [Edge: prerequisite] ─ Upstream Skill (前置依赖技能)
  │     └── [Edge: supports] ───── Cross-domain / Auxiliary Skill (协同支撑技能)
```

### 2.1 Domain (域)
- **定义**：技能与成长的最高层级分类，支持自引用父子层级（例如 `Computer Science` └── `Web Engineering`）。
- **持久化表**：`public.domains`
- **核心字段**：
  - `id`: UUID (Primary Key)
  - `user_id`: UUID (Tenant Isolation)
  - `name`: 显示名称（如 `Computer Science`）
  - `slug`: 规范化唯一标识（如 `computer-science`）
  - `parent_id`: 可空外键指向父域
  - `sort_order`: 排序权重

### 2.2 Skill (技能)
- **定义**：可重复实践、可独立评估、产生实际成果的行动能力。
- **持久化表**：`public.skills`
- **核心原则**：
  - **ID 永久性**：运行时通过 `crypto.randomUUID()` / `gen_random_uuid()` 分配，**严禁由名称派生**；
  - **名称与别名**：`name` 为主显示名，`aliases` 为别名数组（用于多语言或近义词 AI 匹配，如 `["TS", "TypeScript 编程"]`）；
  - **规范化唯一键**：`normalized_name` 由数据库触发器自动计算（小写、去空格），确保同一用户下不出现同名重复技能。

---

## 3. Skill State Attributes

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
               │   • Confidence Decay       │    • Derived Status (状态) │
               └────────────────────────────┴────────────────────────────┘
```

### 3.1 Non-Negotiable Axioms
1. **Level != Mastery**:
   - `Level` 表示在该技能上累计投入的有效练习量（由 Growth Engine 计算的不可逆 XP 驱动）；
   - `Mastery` 表示通过证据验证达到的能力深度阶梯（M0–M10）。
   - *反例规避*：用户进行了 100 次初级练习，Level 达到 Lv.20，但未提供复杂独立应用证据，其 Mastery 依然保持在 M3。
2. **Mastery != Confidence**:
   - `Mastery` 记录历史达到的最高验证等级（不会随时间自然扣除）；
   - `Mastery Confidence` 表示当前能力的活跃留存置信度（随未练习时长逐步衰减）。
3. **Domain != Skill**:
   - Domain 负责宏观分类与统计聚合，不直接记录单个 XP 事务；Skill 是所有 Growth Loop 结算的最小落脚点。

---

## 4. Skill Edge Relations (Stage 5 Minimal Graph)

Stage 5 V1 冻结以下三类最小且完备的有向关系：

| 关系类型 (`relation_type`) | 语义定义 | 拓扑约束 | 业务影响 |
|---|---|---|---|
| **`prerequisite`** | **前置依赖**：`Source` 是学习/解锁 `Target` 的必要前提。 | **严格 DAG**（禁止任何有向环） | 决定 `Target` 的解锁状态（`locked` vs `available`）。 |
| **`contains`** | **结构包含**：`Source` 是复合技能，`Target` 是其下属的子技能或技能簇。 | **严格树/森林**（禁止环，一个子技能至多属于一个 parent 包含技能） | 决定技能树可视化折叠与层级聚类展示。 |
| **`supports`** | **协同支撑**：`Source` 对 `Target` 具有正向协同或迁移促进作用，但非强依赖。 | **允许跨域 DAG**（禁止自环，禁止重复边） | 用于高阶推荐、协同经验加成及关联技能高亮展示。 |

---

## 5. Domain Invariants Summary

1. **租户绝对隔离**：所有 Skill 与 SkillEdge 必须绑定相同 `user_id`，禁止跨租户建边；
2. **禁止自环**：`source_skill_id != target_skill_id`；
3. **唯一关系约束**：同一对节点之间同种关系唯一；
4. **无损级联**：Skill 被物理删除时（仅限未确认结算的新增草稿），关联 Edge 级联删除；已被结算锁定的 Skill 优先采用 `status = 'archived'`，保留完整历史账本与引用链。
