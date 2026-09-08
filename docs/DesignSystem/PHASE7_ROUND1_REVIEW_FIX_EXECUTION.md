# Phase 7 — Round 1 Independent Review Fix Execution Manual

## Status

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`  
**PR:** `#22`  
**Implementation branch:** `feature/phase7-a11y-keyboard`  
**Reviewed branch point:** `7e7d474b3b35828d4397637dd0a2b793e428e5d6`  
**Reviewed Exact Head:** `f7af7ecbd78a50201a380304342766c77a42e32f`  
**Reviewed CI run:** `34197760962`  
**Independent verdict:** **NO-GO → NEED_FIX**  
**P0:** 0  
**P1:** 3  
**P2:** 0

This document is a surgical correction order for **Phase 7 Round 1 only**. Do not begin Round 2, Round 3, or Round 4.

---

# 1. What independently passed

The following are independently verified and must remain closed:

- PR #22 is still open and unmerged.
- Exact Head is `f7af7ecbd78a50201a380304342766c77a42e32f`.
- PR base is `7e7d474b3b35828d4397637dd0a2b793e428e5d6`.
- The difference from frozen Phase 7 code baseline `a40ff9806e3c90d02e298245956c8fe5236e2913` to the branch point is docs-only.
- Current PR changed-file scope contains no backend/domain/Supabase/shared UI/shared layout/design-token/dependency drift.
- `check` and `supabase-integration` both succeeded on CI run `34197760962` for the reviewed Exact Head.
- The non-DB `check` job accurately ran `39 passed / 19 skipped` files and `643 passed / 279 skipped` tests.
- The Supabase integration job actually ran the full DB-enabled suite: `58/58` files and `922/922` tests passed.
- Deterministic harness actually ran and passed `11/11`.
- Dedicated E2E actually ran and passed `9/9`.
- URL-backed table modes exist for `/skills?view=table` and `/knowledge?view=table`.
- Skill and Knowledge arrow-key traversal helpers are deterministic, operate only on loaded/visible connected nodes, use rendered coordinates, stable ID tie-breaking, and do not mutate graph/domain semantics.
- Knowledge graph selection state is explicitly synchronized through `isSelected`.
- Existing single `InspectorDrawer`, `BaseModal`, authority/mastery/confidence/XP separation, and frozen backend/domain semantics were not reopened.

Do not rewrite these working areas unless directly necessary for one of the three findings below.

---

# 2. P1-01 — Knowledge relation table conflates relation presentation with authority state

## Evidence

File:

```text
src/app/knowledge/components/KnowledgeTableView.tsx
```

Relevant region: approximately lines **81–130** at reviewed Exact Head.

The relationship table declares a column:

```tsx
<th scope="col">权威状态</th>
```

but later renders:

```tsx
const visual = getEdgeVisual(
  edge.relationType,
  edge.verificationStatus,
  edge.confidence,
  edge.isArchived,
);
...
<td>{visual.label}</td>
```

`getEdgeVisual(...).label` is primarily a **relation presentation label**, not a generic authority-state label. Examples from frozen `presentation.ts` include:

```text
verified supports      -> SUPPORTS
verified prerequisite  -> PREREQUISITE
verified contains      -> CONTAINS
inferred supports      -> SUPPORTS (AI n%)
verified contradicts   -> CONTRADICTS [VERIFIED]
```

Therefore a screen-reader/table user can encounter a column named `权威状态` whose cell says only `SUPPORTS`, `CONTAINS`, or `PREREQUISITE`. That fails the Round 1 requirement to preserve Knowledge relation authority semantics and make `verified / inferred / rejected / superseded / archived` textually/programmatically clear.

## Required fix

Keep **relation type** and **authority state** semantically separate.

Acceptable direction:

- Relation column: relation type plus directional/symmetric semantics.
- Authority column: derive explicit authority/lifecycle text from the edge's real `verificationStatus` and `isArchived` fields, using existing frozen presentation semantics/helpers where appropriate.
- Confidence remains a distinct edge-confidence value.

Requirements:

```text
relationType != verificationStatus
relation label != authority state
confidence != authority state
archive lifecycle must remain explicit
no new domain state
no conversion of UI text into new truth
```

For all five Knowledge relations, table semantics must preserve:

```text
prerequisite — directed
contains — directed
supports — directed
contradicts — symmetric / non-directional
relates_to — symmetric / non-directional
```

Do not modify backend/domain types or `src/lib/**`.

## Required regression tests

Strengthen `tests/phase7-a11y-keyboard.test.tsx` so the relationship table directly proves at least:

1. verified `supports` displays relation `supports` and separately exposes verified authority;
2. inferred relation separately exposes inferred authority and confidence;
3. rejected and/or superseded authority remains distinguishable from relation type;
4. archived state remains explicitly discoverable when present;
5. `contradicts` and `relates_to` remain non-directional/symmetric.

The test must inspect real rendered table cells/accessible text, not source strings.

---

# 3. P1-02 — Skill table alternative omits graph relationship semantics

## Evidence

File:

```text
src/app/skills/components/SkillTableView.tsx
```

Relevant region: approximately lines **4–68** at reviewed Exact Head.

Current component props are only:

```tsx
export interface SkillTableViewProps {
  nodes: SkillFlowNodeType[];
  onSelect: (skillId: string) => void;
}
```

The table exposes a final column called `前置关系`, but the value is only a count:

```tsx
{node.data.prerequisiteCount} 个前置（未满足 {node.data.unfulfilledPrerequisiteCount}）
```

The frozen Skill edge ontology contains three actual relation types:

```text
prerequisite
contains
supports
```

The Round 1 execution contract requires the table/list alternative to provide a usable way to understand graph relationships without relying on canvas lines, colors, shapes, or spatial position. The current Skill table cannot expose the identity or direction/endpoints of graph edges and completely omits `contains` and `supports` relationships.

Opening the existing Skill detail inspector is not sufficient to close this gap: it exposes prerequisite and next-unlock information but does not expose the complete `contains` / `supports` graph relation set.

## Required fix

Provide a genuine accessible Skill relationship representation using only the already-loaded Skill graph read model.

Preferred implementation:

- pass the currently visible/loaded Skill edges into `SkillTableView`;
- preserve the existing Skill entity table;
- add a second semantic relationship table or equivalent semantic list describing each real edge with:
  - source Skill name;
  - relation type;
  - target Skill name;
  - directional semantics consistent with the frozen Skill relation model;
- no fabricated relation values;
- no backend/API/domain changes;
- no new dependency.

Do **not** derive relationship truth from `prerequisiteCount` summaries when the real edge list is already available.

The existing `前置关系` summary may remain as an entity-level summary, but it cannot be the only non-canvas relationship representation.

## Required regression tests

Strengthen `tests/phase7-a11y-keyboard.test.tsx` with a Skill fixture containing all three relation types:

```text
prerequisite
contains
supports
```

The test must prove a keyboard/screen-reader-oriented table/list user can discover:

- source identity;
- relation identity;
- target identity;
- all three relation types;
- the existing row-to-inspector path remains intact.

Do not satisfy this with source-string scanning.

---

# 4. P1-03 — Skill keyboard activation does not synchronize selected/pressed state

## Evidence

Files:

```text
src/app/skills/components/SkillNode.tsx
src/app/skills/page.tsx
```

`SkillNode.tsx`, approximately lines **27–59**, exposes:

```tsx
function SkillNodeView({ id, data, selected }: NodeProps<SkillFlowNodeType>) {
...
aria-pressed={Boolean(selected)}
...
if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
  e.preventDefault();
  e.stopPropagation();
  data.onSelect?.(id);
}
```

`src/app/skills/page.tsx`, approximately lines **103–123**, builds `flowNodes` without any page-owned selected state:

```tsx
visible.nodes.map((node) => ({
  id: node.id,
  position: node.position,
  data: { ...node.data, ... },
  type: "skillNode",
}))
```

while `handleSelect()` only updates:

```tsx
setSelectedSkillId(skillId);
setDetailOpen(true);
```

The keyboard path stops propagation and invokes the selection callback directly. It therefore opens the Inspector, but it does not cause ReactFlow's pointer-driven internal selection path to own/update the node's `selected` prop. Since the page's `flowNodes` do not derive selection from `selectedSkillId`, keyboard activation can leave:

```text
Inspector = open for Skill A
aria-pressed = false
selected visual ring = false
```

That violates the Round 1 contract:

```text
Enter / Space must select/inspect the focused node using the same selection state as pointer interaction.
```

It also violates Step 6's requirement that `selected / active` state be textually/programmatically clear.

Knowledge already demonstrates the correct architectural pattern by carrying a page-owned `isSelected` field derived from `selectedNodeId`.

## Required fix

Make Skill selection state page-owned/deterministic for both pointer and keyboard activation.

Acceptable approaches include:

### Option A — preferred

Carry a presentation-only `isSelected` field in `SkillNodeViewData`, derived from:

```text
selectedSkillId === node.id
```

Then use that page-owned value for:

```text
aria-pressed
selected ring / selected visual state
```

Pointer and keyboard callbacks must update the same `selectedSkillId` source of truth.

### Option B

Explicitly control ReactFlow node `selected` state from `selectedSkillId` if this integrates cleanly with the existing frozen graph behavior.

Whichever method is used:

- do not create a second independent selection state;
- do not modify Skill domain state;
- do not change graph edge semantics;
- closing the inspector must clear the programmatic selected state;
- selecting another Skill must clear the previous selected state;
- filtering selected Skill out of the visible graph must not leave stale `aria-pressed=true` on another/hidden node.

## Required regression tests

Do not only test that `onSelect` was called.

Add a direct page/component regression proving:

1. keyboard Enter on Skill A opens/selects Skill A;
2. Skill A exposes selected/pressed state after activation;
3. keyboard Space follows the same selection state path;
4. pointer activation and keyboard activation produce the same selected state;
5. selecting Skill B clears Skill A's selected state;
6. closing/clearing selection removes the selected state.

---

# 5. Scope for the surgical correction

Continue on the existing branch:

```text
feature/phase7-a11y-keyboard
```

Normally authorized for this correction:

```text
src/app/skills/components/SkillTableView.tsx
src/app/skills/components/SkillNode.tsx
src/app/skills/page.tsx
src/app/knowledge/components/KnowledgeTableView.tsx
tests/phase7-a11y-keyboard.test.tsx
```

Conditional only if directly required by the above fixes:

```text
src/app/skills/components/SkillGraphCanvas.tsx
src/app/knowledge/components/KnowledgeGraphCanvas.tsx
```

Do not modify unrelated files simply because they are in the broader Round 1 allowlist.

The following remain forbidden:

```text
src/app/api/**
src/lib/**
supabase/**
src/proxy.ts
src/components/ui/**
src/components/layout/**
src/styles/design-tokens.css
package.json
pnpm-lock.yaml
```

Also forbidden:

```text
new dependencies
new APIs
new domain fields/states
new design tokens
Round 2 responsive overhaul
Round 3 motion work
Round 4 freeze work
Phase 7 FINAL FROZEN declaration
automatic merge of PR #22
```

If a forbidden/shared file appears necessary, stop and report the exact blocker before editing it.

---

# 6. Existing closures that must not regress

Preserve all currently passing Round 1 behavior:

```text
/login landmark and programmatic labels
error/status announcements
single AppWorkspace main landmark pattern
Artifact page no nested main landmark
Skill graph connected-node arrow navigation
Knowledge graph connected-node arrow navigation
stable distance + ID tie-breaking
edge direction ignored only for navigation adjacency, not semantic relation
URL-backed /skills?view=table
URL-backed /knowledge?view=table
invalid view fallback
Knowledge node authority != Skill mastery
Knowledge confidence != Skill mastery confidence
XP != mastery
Linked Skill remains isolated/read-only
Knowledge symmetric relations remain symmetric
single InspectorDrawer
BaseModal reuse and Escape containment
reduced-motion recentering behavior
backend/domain/Supabase zero drift
design token zero drift
shared primitive/layout zero drift
dependency zero drift
```

---

# 7. Round 2 remains explicitly out of scope

Do not turn this correction into responsive/touch polish.

The new table action buttons should be rechecked during Round 2's touch-target stress pass. Physical touch-device validation, VoiceOver, NVDA, and JAWS remain documented unverified boundaries unless separately performed.

These are not a justification to skip the three P1 corrections above.

---

# 8. Required validation

After fixing all three findings, run:

```bash
pnpm test
pnpm harness:deterministic
pnpm lint
pnpm tsc --noEmit
pnpm build
```

Then push to the existing PR #22 branch.

A **new Exact Head SHA** is mandatory.

Wait for the PR-triggered GitHub Actions run on that new Exact Head and require:

```text
check: SUCCESS
supabase-integration: SUCCESS
```

Report skipped tests accurately:

- no-DB `check` skips remain skips;
- DB-backed/E2E may only be reported as passed if the Supabase integration job actually executed them successfully.

Do not reuse CI run `34197760962` for the corrected Head.

---

# 9. Acceptance matrix

| Gate | Required state |
| --- | --- |
| Knowledge relation type and authority state separated | PASS |
| Knowledge five-relation ontology preserved | PASS |
| Knowledge symmetric relations remain non-directional | PASS |
| Skill table/list exposes real relationship endpoints/types | PASS |
| Skill `prerequisite` relation accessible without canvas | PASS |
| Skill `contains` relation accessible without canvas | PASS |
| Skill `supports` relation accessible without canvas | PASS |
| Skill keyboard activation synchronizes selected state | PASS |
| Skill `aria-pressed` matches page selection truth | PASS |
| Pointer and keyboard use same selection source of truth | PASS |
| Existing table URL behavior | PASS |
| Existing arrow traversal | PASS |
| Existing overlay semantics | PASS |
| Authority/Mastery/Confidence/XP invariants | PASS |
| Backend/domain/Supabase delta | 0 |
| Shared UI/layout delta | 0 |
| Design token delta | 0 |
| Dependency delta | 0 |
| `pnpm test` | PASS |
| deterministic harness | PASS |
| lint | PASS |
| TypeScript | PASS |
| production build | PASS |
| new Exact Head CI | PASS |

---

# 10. Required completion report

Return exactly this structure to the independent reviewer:

```text
PHASE 7 — ROUND 1 REVIEW FIX COMPLETE
→ REQUEST INDEPENDENT RE-REVIEW

Repository: Daylily-Huang/AI-Personal-Growth-RPG
PR: #22
Branch: feature/phase7-a11y-keyboard
Previous reviewed Head: f7af7ecbd78a50201a380304342766c77a42e32f
New Exact Head SHA: <sha>

Changed files:
- <file>
- <file>

P1 closure:
- P1-01 Knowledge relation authority semantics: CLOSED
- P1-02 Skill relationship alternative: CLOSED
- P1-03 Skill keyboard selected-state synchronization: CLOSED

Regression preservation:
- existing arrow navigation: PASS
- table URL behavior: PASS
- overlay Escape/focus behavior: PASS
- authority/mastery/confidence/XP separation: PASS
- forbidden/shared/backend/domain/dependency drift: 0

Local validation:
- pnpm test: <accurate result>
- pnpm harness:deterministic: <result>
- pnpm lint: <result>
- pnpm tsc --noEmit: <result>
- pnpm build: <result>

GitHub Actions:
- run id: <new id>
- exact head sha: <new sha>
- check: <result>
- supabase-integration: <result>
- DB-backed tests: <accurate executed/pass/skip result>
- deterministic harness: <accurate executed/pass result>
- E2E: <accurate executed/pass/skip result>

No merge performed.
No Phase 7 Round 2 work started.
No Phase 7 freeze declared.
```

---

# 11. Merge rule

PR #22 is **not authorized to merge** at reviewed Head:

```text
f7af7ecbd78a50201a380304342766c77a42e32f
```

Merge authorization can only be reconsidered after all three P1 findings are closed and a new Exact Head passes independent re-review and its own exact-head CI.
