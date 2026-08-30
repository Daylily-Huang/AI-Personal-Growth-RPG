# Entity Visual Language & Information Semantics

> **Document**: `05_ENTITY_VISUAL_LANGUAGE.md`  
> **Status**: DESIGN FREEZE CANDIDATE (ROUND 2 REVIEW PENDING)  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md`, `02_DESIGN_TOKENS.md`  
> **Related Documents**: `04_SHARED_COMPONENT_SYSTEM.md`, `09_GLOBAL_VISUAL_ACCEPTANCE_GATES.md`

---

## 1. Information Hierarchy & Distinct Semantic Domains

In accordance with frozen system invariants, the product encompasses fundamentally distinct concepts that must never be conflated visually:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONCEPTUAL SEPARATION INVARIANTS                     │
│                                                                         │
│   • Domain ≠ Skill               • Skill ≠ Knowledge                    │
│   • Level ≠ Mastery              • Mastery ≠ Confidence                 │
│   • Artifact ≠ Evidence          • Artifact ≠ Knowledge Node            │
│   • Quest ≠ Activity             • Time ≠ XP                            │
│   • Confidence ≠ Truth           • Authority Status ≠ Archive Lifecycle │
└─────────────────────────────────────────────────────────────────────────┘
```

Color alone must never be the sole differentiator between entities. Every entity type possesses a unique combination of **Iconography**, **Shape/Border Geometry**, **Typographic Treatment**, and **Badge Structure**.

---

## 2. Entity Visual Matrix

| Entity Type | Semantic Color Token | Icon Symbol | Border & Shape Geometry | Primary Badge & Readout | Primary Context |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Activity (行为)** | Copper Ochre (`var(--entity-activity-text)`) | ⚡ Lightning / Brush | Rounded Rect (`var(--radius-lg)`), Copper border | `ActivityType` (Learning, Creation, Production, Workout) | Timeline Feed, Settle Activity |
| **Quest (任务/使命)** | Azure Horizon (`var(--entity-quest-text)`) | 📜 Scroll / Compass | Beveled Pill Top-Edge (`var(--radius-xl)`), Azure border | `QuestProgress` ($0 - 100\%$) + Difficulty Stars | Mission Tree, Milestone Objective |
| **Skill (技能/能力)** | Ancient Gold (`var(--entity-skill-text)`) | ⚔️ Crossed Swords / Talisman | Hexagonal Node / Gold border | `MasteryBadge` (**M0–M10**) + `masteryConfidence` | Capability Graph, Skill Hierarchy |
| **Knowledge (知识/洞见)**| Emerald Celadon (`var(--entity-knowledge-text)`) | 🌿 Bamboo Leaf / Jade Nexus | Circular Node / Interconnected Edges | `AuthorityBadge` (4 States) + `epistemicConfidence` | Knowledge Map, Concept Synthesis |
| **Artifact (产出/造物)** | Amethyst Scholar (`var(--entity-artifact-text)`)| 💎 Crystal / Bound Scroll | Double-Line Top Border, Silk Texture | 8-Type Badge + `ReusabilityScore` | Work Product Gallery, Links Inspector |
| **Evidence (实证/证据)** | Vermilion Seal (`var(--entity-evidence-text)`) | 🏮 Traditional Red Seal / Stamp | Square Seal Inset, Vermilion Frame | `EvidenceLevel` ($1 - 5$) + Hash/URL Proof | Evidentiary Grounding, Audit Trail |

---

## 3. Knowledge Graph vs. Artifact Ontologies

To eliminate cross-ontology confusion, the two relational systems are strictly separated:

### 3.1 Knowledge Graph Internal Edge Ontology (Stage 6 Frozen)
Governs relationships between two Knowledge Nodes in the Knowledge Map:
1. `prerequisite`: Directed DAG edge (Concept A is required before Concept B).
2. `contains`: Directed DAG edge (Hierarchical parent-child containment).
3. `supports`: Directed causal edge (Concept A provides conceptual backing for Concept B).
4. `contradicts`: Symmetric canonical edge (Concepts A and B represent conflicting hypotheses; rendered as non-directional tension).
5. `relates_to`: Symmetric canonical edge (General conceptual association; rendered as non-directional bond).

### 3.2 Artifact ↔ Knowledge Node Relationship Ontology (Stage 7 Frozen)
Governs relationships between an Artifact and a Knowledge Node (`artifact_knowledge_nodes.relation_type`):
1. `cites`: The Artifact references the Knowledge Node as a source.
2. `implements`: The Artifact puts the Knowledge Node's concepts into concrete practice.
3. `synthesizes`: The Artifact combines or integrates the Knowledge Node.
4. `evaluates`: The Artifact critiques, benchmarks, or validates the Knowledge Node.

---

## 4. Knowledge Node Authority vs. Archive Lifecycles

Knowledge visual presentation separates epistemic authority from lifecycle archival:

### 4.1 Four Distinct Authority States
1. `verified`: Solid glowing Emerald Celadon border (`var(--entity-knowledge-border)`), checkmark seal icon. Formally sanctioned/verified knowledge.
2. `inferred`: Dashed Celadon border, subtle spark icon, confidence score displayed ($\le 0.95$). AI/Heuristic inferred concept pending human review.
3. `rejected`: Subtle gray-red border, strike-through icon. Sanctioned rejection (retained for historical/audit tracing).
4. `superseded`: Dimmed outline with forward-arrow icon. Retained historical node replaced by an upgraded concept.

### 4.2 Lifecycle Archival Dimension (`is_archived`)
- Archived status is represented by a separate dimmed visual veil and `[Archived]` tag, completely independent of whether the node was `verified`, `inferred`, `rejected`, or `superseded`.

---

## 5. XP, Level, Mastery, and Confidence Separations

```
┌───────────────────────┬───────────────────────┬───────────────────────┬───────────────────────┐
│       XP / LEVEL      │    MASTERY (M0-M10)   │      CONFIDENCE       │       PROGRESS        │
├───────────────────────┼───────────────────────┼───────────────────────┼───────────────────────┤
│ • Quantitative Volume │ • Qualitative Depth   │ • Epistemic Certainty │ • Objective % Metric  │
│ • Numerical meter     │ • M0 to M10 scale     │ • NOT verified truth  │ • Horizontal bar      │
│ • Gold progression    │ • Discrete 10-step    │ • 3 distinct contexts │ • Milestone ticks     │
│ • Level integer (1+)  │ • Skill-specific      │ • Score (0.00 - 1.00) │ • Quest-specific (%)  │
└───────────────────────┴───────────────────────┴───────────────────────┴───────────────────────┘
```

1. **Level (境界/等级)**: Represents accumulated practice volume. Rendered as an octagonal gold badge with an integer (e.g. `LV.14`).
2. **XP (修为/经验)**: Represents quantitative progression toward next level threshold (`current_xp / target_xp`).
3. **Mastery (造诣/熟练度)**: **Strictly M0–M10 scale.** Represents verified capability depth. Rendered with an explicit numeric label (`M3`, `M7`, etc.) and a 10-step discrete meter (or 5 dual-state diamonds).
4. **Confidence (置信度)**: **NEVER conflated with truth.** Represents epistemic certainty across 3 isolated contexts:
   - *Skill Mastery Confidence* (`Skill.masteryConfidence`)
   - *Assessment Proposal Confidence* (`Assessment.confidence`)
   - *Knowledge Epistemic Confidence* (`KnowledgeNode.confidence`)

---

## 6. Anti-Conflation Rules for Implementation

1. **Never use gold for generic items or Activities**: Ancient Gold is reserved exclusively for Player Level, XP milestones, Skill Mastery (M0–M10), primary affirmative actions, and the global focus ring. Activity uses Copper Ochre (`var(--entity-activity-text)`).
2. **Never render Knowledge with Skill Mastery**: Knowledge nodes display Authority State and Epistemic Confidence, never M0–M10 mastery pips or XP bars.
3. **Never render Evidence as Artifacts**: Evidence is an immutable proof record; Artifacts are versionable, re-linkable work products with 8 taxonomy types.
