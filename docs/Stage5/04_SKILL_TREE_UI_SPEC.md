# Stage 5 — Skill Tree UI Specification

> **Status**: PROPOSED / DESIGN FREEZE CANDIDATE  
> **Target Milestone**: Stage 5 (Skill Tree)  
> **Related Rules**: `docs/Design ChatGPT/07_UI_DESIGN_SYSTEM.md`, `src/app/skills/page.tsx`

---

## 1. Information Architecture & Layout Overview

The `/skills` page is structured as a **3-Column Canvas Workspace** powered by `@xyflow/react`:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Header: [Logo] Skill Tree       [Search Skills...]       Dashboard | Quests | Skills   │
├───────────────────┬────────────────────────────────────────────┬───────────────────────┤
│ Left Panel        │ Center Canvas                              │ Right Detail Panel    │
│ (280px)           │ (Flex Grow)                                │ (380px, Collapsible)  │
│                   │                                            │                       │
│ ┌───────────────┐ │ ┌─────────────┐                            │ ┌───────────────────┐ │
│ │ Domain Filter │ │ │  [Skill A]  │───(prerequisite)──►[Skill B│ │ │ Skill Name & Tag │ │
│ │ • All Domains │ │ └─────────────┘                            │ │ Level & XP Bar    │ │
│ │ • CS (12)     │ │        │ (contains)                        │ │ Mastery & Conf    │ │
│ │ • Ecology (8) │ │        ▼                                   │ │                   │ │
│ │ • Body (5)    │ │ ┌─────────────┐                            │ │ Evidence Timeline │ │
│ └───────────────┘ │ │ [Subskill]  │                            │ │ • E4 Code refactor│ │
│                   │ └─────────────┘                            │ │ • E2 Summary note │ │
│ ┌───────────────┐ │                                            │ │                   │ │
│ │ Status Filter │ │ [Controls: Zoom, Fit, Layer Layout]        │ │ Prerequisites (✓) │ │
│ │ [Learning]    │ │ [MiniMap: Bottom Left]                     │ │ Next Unlocks (➔)  │ │
│ │ [Proficient]  │ │                                            │ └───────────────────┘ │
│ └───────────────┘ │                                            │                       │
└───────────────────┴────────────────────────────────────────────┴───────────────────────┘
```

---

## 2. Component Breakdown

### 2.1 Left Panel: Domain Hierarchy & Quick Filter
- **Domain Selector**:
  - Tree list of domains (with sub-domains indented);
  - Shows skill counts per domain (e.g. `Computer Science (14)`, `Molecular Ecology (9)`);
  - Clicking a domain filters the canvas nodes and centers the viewport on that domain cluster.
- **Search & Derived State Filter**:
  - Instant text filter by name/alias;
  - Filter pills: `All`, `Learning`, `Proficient`, `Advanced`, `Locked`.

---

### 2.2 Center Canvas: ReactFlow Skill Graph
- **Library**: `@xyflow/react` (retained, no rewrite).
- **Custom `SkillNode` Component**:
  - **Header**: Skill Name + Domain Tag badge;
  - **Pills Row**: `Lv.{level}` (Amber badge) + `M{masteryLevel}` (Sky badge) + `Derived State` (e.g. `Learning` / `Locked` icon);
  - **Metrics Footer**: Current XP + Mini Confidence Bar (`Math.round(confidence * 100)%`);
  - **Visual States by Derived State**:
    - `locked`: Grayscale border, lock icon, muted opacity (0.6);
    - `available`: Dashed emerald border, pulse glow;
    - `learning`: Solid sky-500 border, blue accent;
    - `proficient`: Solid amber-500 border, warm glow;
    - `advanced`: Solid purple-500 border, double ring, crown/sparkle badge.
- **Edge Styling**:
  - `prerequisite`: Solid line with arrow marker, color `#38bdf8` (Sky);
  - `contains`: Dashed line with circle marker, color `#a855f7` (Purple);
  - `supports`: Dotted subtle line, color `#71717a` (Zinc).

---

### 2.3 Right Panel: Deep Skill Detail & Evidence Inspector
- **Header Section**:
  - Skill Title, Aliases chips, Domain category;
  - Edit metadata button (triggers modal for name/alias/description update);
  - Archive/Unarchive toggle.
- **Mastery & Progression Section**:
  - Level progress bar: `Current XP / Next Level XP`;
  - Mastery Ladder indicator: Displays rank from `M0 (Unknown)` to `M10 (Create)`, highlighting current validated rank;
  - Mastery Confidence Meter with tooltip explaining retention and decay.
- **Evidence & Audit Timeline**:
  - Chronological feed of linked `evidence_records` and `activities`;
  - Each item displays: Evidence Level badge (`E0`–`E6`), Activity Title, Verification Checkmark, Timestamp.
- **Prerequisites & Unlocks Graph**:
  - **Prerequisites Checklist**: Lists upstream skills with fulfillment indicator (✓ if M >= 2 or Lv >= 2, ✗ if unfulfilled);
  - **Next Unlocks**: Clickable cards of downstream skills that unlock when this skill advances.
- **Future Hooks (Interface Only — Out of Scope for Stage 5 Implementation)**:
  - `Related Quests` (Placeholder container, reserved for Stage 7 Quest-Skill integration);
  - `Produced Artifacts` (Placeholder container, reserved for Stage 7 Artifact Library).

---

## 3. Responsive & Interactive Behavior

1. **Node Selection**: Clicking any node in the ReactFlow canvas sets `selectedSkillId` and opens the Right Detail Panel;
2. **Canvas Re-center**: Selecting a skill from the search/filter smoothly animates the camera (`fitView` / `setCenter`) to focus on that node;
3. **Empty State**: When no skills exist (fresh player), displays welcoming onboarding card: *“还没有技能节点 — 完成第一次 Growth Assessment 并确认后，系统会根据真实行为建立技能树。”* with a direct CTA to `/dashboard`;
4. **Error & Loading States**: Displays skeleton canvas and retry button on fetch failure.
