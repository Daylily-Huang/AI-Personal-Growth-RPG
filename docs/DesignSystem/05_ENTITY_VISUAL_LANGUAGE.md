# Entity Visual Language & Information Semantics

> **Document**: `05_ENTITY_VISUAL_LANGUAGE.md`  
> **Status**: DESIGN FREEZE CANDIDATE  
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
└─────────────────────────────────────────────────────────────────────────┘
```

Color alone must never be the sole differentiator between entities. Every entity type possesses a unique combination of **Iconography**, **Shape/Border Geometry**, **Typographic Treatment**, and **Badge Structure**.

---

## 2. Entity Visual Matrix

| Entity Type | Theme Color | Icon Symbol | Border & Shape Geometry | Primary Badge & Readout | Primary Action / Context |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Activity (行为)** | Warm Amber / Slate (`#c5a059`) | ⚡ Lightning / Brush Stroke | Rounded Rect (`radius-lg`), 1px neutral border | `ActivityType` (Coding, Learning, Workout, Creation) | Timeline Log, Settle Assessment |
| **Quest (任务/使命)** | Azure Horizon (`#58a6ff`) | 📜 Scroll / Compass Rose | Beveled Pill Top-Edge (`radius-xl`), Azure border | `QuestProgress` ($0 - 100\%$) + Difficulty Stars | Objective Tracking, Tree Hierarchy |
| **Skill (技能/能力)** | Antique Gold (`#d4af37`) | ⚔️ Crossed Swords / Talisman | Hexagonal Node / Gold-Glow Border | `MasteryBadge` (1 to 5 Diamond Pips) | Skill Tree, Capability Unlock |
| **Knowledge (知识/洞见)**| Emerald Celadon (`#3fb950`) | 🌿 Bamboo Leaf / Jade Nexus | Circular Node / Interconnected Edges | `VerificationBadge` (`verified` / `inferred`) | Knowledge Map, Concept Synthesis |
| **Artifact (产出/造物)** | Amethyst Scholar (`#bc8cff`)| 💎 Crystal / Bound Scroll | Double-Line Top Border, Silk Texture | 8-Type Badge + `ReusabilityScore` | Deliverable Gallery, Link Inspector |
| **Evidence (实证/证据)** | Vermilion Seal (`#f85149`) | 🏮 Traditional Red Seal / Stamp | Square Seal Inset, Vermilion Frame | `EvidenceLevel` ($1 - 5$) + Direct Proof URL | Audit Trail, Grounding Verification |

---

## 3. Entity-Specific Visual Specifications

### 3.1 Skill vs. Knowledge Node
- **Skill (Active Capability)**:
  - Visual Focus: Represents *what the practitioner can DO*.
  - Geometry: Structured hexagons, solid antique gold borders, explicit 5-pip mastery meters.
  - Interactive Action: Level progression, verification requirements, activity grounding.
- **Knowledge Node (Mental Model & Concept)**:
  - Visual Focus: Represents *what the practitioner KNOWS & CONNECTS*.
  - Geometry: Soft circles, emerald jade edges (`#3fb950`), dual verification states (`inferred` = dashed green outline, `verified` = solid glowing celadon).
  - Interactive Action: Relationship edge traversal (`cites`, `implements`, `synthesizes`, `evaluates`).

---

### 3.2 Artifact vs. Evidence Record
- **Artifact (Permanent Tangible Deliverable)**:
  - Visual Focus: Reusable work products (Code Repositories, Design Specs, Synthesis Notes, Data Analyses).
  - Presentation: Full card with Amethyst purple silk highlights (`#bc8cff`), version pill, reusability score meter, and multi-relational linkage counts.
  - Lifecycle: `draft` $\rightarrow$ `active` $\rightarrow$ `archived` / `superseded`.
- **Evidence (Immutable Epistemic Grounding)**:
  - Visual Focus: Raw proof and validation logs grounding a specific Activity, Skill Mastery, or Knowledge state.
  - Presentation: Minimalist vermilion stamp seal (`#f85149`) with strict evidentiary level rating ($1 - 5$) and direct URL/hash verification.

---

### 3.3 XP, Level, Mastery, and Confidence Separations

```
┌───────────────────────┬───────────────────────┬───────────────────────┬───────────────────────┐
│       XP / LEVEL      │        MASTERY        │      CONFIDENCE       │       PROGRESS        │
├───────────────────────┼───────────────────────┼───────────────────────┼───────────────────────┤
│ • Quantitative Volume │ • Qualitative Depth   │ • AI Assessment Truth │ • Objective % Metric  │
│ • Numerical meter     │ • 5 Diamond Pips (◆)  │ • Percentage decimal  │ • Horizontal bar      │
│ • Gold progression    │ • Verified capability │ • Epistemic certainty │ • Milestone ticks     │
│ • Level integer (1+)  │ • Skill-specific (1-5)│ • Low/Med/High badge  │ • Quest-specific (%)  │
└───────────────────────┴───────────────────────┴───────────────────────┴───────────────────────┘
```

1. **Level (境界/等级)**: Represented as a prominent Roman or Arabic integer inside an octagonal gold seal on the character avatar.
2. **XP (修为/经验)**: Represented as a continuous numerical accumulation bar (`current_xp / target_xp`).
3. **Mastery (造诣/熟练度)**: Displayed exclusively as a 5-tier discrete pip meter (`◆◆◆◇◇` Level 3) requiring real evidentiary grounding to increment.
4. **Confidence (置信度)**: Displayed as an AI Game Master certainty percentage with a 3-tier color classification (Low/Med/High).

---

## 4. Anti-Conflation Rules for Implementation

1. **Never use gold for generic items**: Antique Gold is reserved exclusively for Player Level, XP milestones, and Skill Mastery.
2. **Never render Knowledge as Skills**: Knowledge nodes must not display XP bars or level numbers; they display verification status and relational edges.
3. **Never render Evidence as Artifacts**: Evidence is an immutable proof record; Artifacts are versionable, re-linkable work products.
