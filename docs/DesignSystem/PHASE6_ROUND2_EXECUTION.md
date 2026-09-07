# PHASE 6 — KNOWLEDGE GRAPH CANVAS MODERNIZATION
## ROUND 2 SURGICAL FIX EXECUTION MANUAL

> Repository: `Daylily-Huang/AI-Personal-Growth-RPG`  
> Pull Request: `#21`  
> Working Branch: `feature/phase6-knowledge-canvas`  
> Reviewed implementation baseline: `006fe83fc9ee394b171777d1c104b3aae8c1aa26`  
> Main baseline: `a93e2bcada3eca63c3d69ecc633fd50df0f54e94`  
> Round 1 Independent Review Verdict: **NO-GO → NEED_FIX**  
> Severity: **P0 = 0 / P1 = 2 / P2 = 3**  
> Purpose: This document is the authoritative execution handoff for the next implementation AI.  
> Scope: **surgical frontend/documentation/test corrections only**. Do not expand Phase 6 scope.

---

# 0. EXECUTION ROLE

You are the implementation AI responsible for closing the independent review findings for **Phase 6 — Knowledge Graph Canvas Modernization, Round 2**.

You must:

1. Read this entire document before editing code.
2. Inspect the current branch state and confirm PR #21 still targets `main`.
3. Treat the implementation commit `006fe83fc9ee394b171777d1c104b3aae8c1aa26` as the reviewed Round 1 implementation baseline. The current branch HEAD may be newer because this execution document itself was committed afterward.
4. Apply only the fixes explicitly authorized here.
5. Preserve all previously frozen architecture, backend authority, domain rules, shared primitives, design tokens, database behavior, API contracts, and previously frozen pages.
6. Add or update tests so every review finding has a regression gate.
7. Run all required local quality gates.
8. Push the fixes to the existing branch `feature/phase6-knowledge-canvas`.
9. Produce a concise Round 2 completion report containing exact commit SHA, changed files, test counts, CI result, and closure status for every P1/P2 item.
10. Do **not** merge PR #21 yourself unless the user explicitly instructs you to merge.

The intended outcome is:

```text
ROUND 2 COMPLETE
→ REQUEST INDEPENDENT REVIEW
```

---

# 1. NON-NEGOTIABLE GOVERNANCE BOUNDARIES

## 1.1 Frozen paths — MUST NOT MODIFY

The following paths/files remain frozen and must have **zero delta** relative to main baseline unless this document explicitly authorizes a documentation-only exception:

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
src/app/dashboard/**
src/app/quests/**
src/app/skills/**
src/app/artifacts/**
```

No backend fix is authorized or required in Round 2.

## 1.2 Authorized editable paths

Round 2 edits should normally stay inside:

```text
src/app/knowledge/**
tests/phase6-knowledge-ui.test.tsx
tests/stage6c-ui.test.tsx
tests/stage6c-presentation.test.ts
docs/DesignSystem/05_ENTITY_VISUAL_LANGUAGE.md
docs/DesignSystem/PHASE6_IMPLEMENTATION_PLAN.md
docs/DesignSystem/PHASE6_ROUND2_EXECUTION.md
docs/MASTER_PROJECT_HANDOFF.md
```

If another file appears necessary, stop and prove why before editing it. Prefer not to expand the allowlist.

## 1.3 Architectural invariants that must remain true

The following remain hard constraints:

```text
Knowledge authority ≠ Skill mastery
Knowledge confidence ≠ truth
Mastery ≠ confidence
XP ≠ mastery
Archive lifecycle ≠ authority state
LLM proposal ≠ committed authority
Frontend presentation must not compute or mutate authority facts
Frontend presentation must not fabricate mastery
No backend or domain authority drift
No private page-specific color tokens
No raw hex colors in Phase 6 production code
No raw z-index values
No new dependencies
No custom modal/drawer implementations
```

---

# 2. ROUND 1 REVIEW FINDINGS TO CLOSE

## Summary

```text
P0: 0

P1:
- P1-01 Frozen Knowledge/Skill anti-conflation rule conflicts with Linked Skill Summary
- P1-02 44px touch-target governance incomplete

P2:
- P2-01 Native-button claim is inaccurate
- P2-02 Remaining raw internal /skills anchors
- P2-03 Remaining Zap lightning icon in Edge Detail
```

All five findings must be explicitly closed in Round 2.

---

# 3. P1-01 — FORMALIZE LINKED SKILL SUMMARY WITHOUT VIOLATING KNOWLEDGE SEMANTICS

## 3.1 Problem

The frozen visual semantic rule currently states that Knowledge must never be rendered with Skill Mastery / XP. However the Phase 6 Knowledge Inspector now contains a `LinkedSkillSummary` section that intentionally renders real Skill state using:

```text
MasteryBadge
ConfidenceBadge variant="mastery"
XPProgress
```

This implementation is useful and already separates Knowledge authority from Skill mastery, but the frozen documentation does not yet authorize this cross-context read-only display.

The code must not silently redefine a frozen semantic rule.

## 3.2 Required resolution — use the documentation authorization path

Do **not** remove the Linked Skill Summary unless a concrete implementation defect requires it.

Instead, formally amend `docs/DesignSystem/05_ENTITY_VISUAL_LANGUAGE.md` so the frozen rule becomes precise:

### Required normative rule

Add an explicit rule equivalent to:

```text
A Knowledge Node itself MUST NOT own, derive, or display Skill Mastery/XP as Knowledge properties.

A Knowledge Inspector MAY render a clearly isolated, read-only Linked Skill Summary when the Knowledge Node has a real skillId, provided that:

1. the subsection is visually and semantically typed as Skill;
2. Mastery/XP values come only from the Skill read model;
3. Knowledge epistemic confidence is never converted into mastery confidence;
4. Knowledge authority is never converted into Skill mastery;
5. the subsection explicitly labels that the values belong to the linked Skill rather than the Knowledge Node;
6. loading/error states never fabricate M0, XP, confidence, level, or any fallback mastery state;
7. failure to load Skill state degrades to an unavailable-state message;
8. the integration is read-only and does not create a new mutation path.
```

## 3.3 Preserve the existing implementation behavior

`LinkedSkillSummary.tsx` should continue to:

- read `GET /api/skills/[id]` only;
- verify the returned skill ID matches the requested `skillId`;
- abort stale requests;
- hide stale prior Skill state when `skillId` changes;
- show a neutral loading state;
- show `关联技能状态暂不可用` on failure;
- never synthesize `M0`;
- keep Knowledge confidence separately rendered using `ConfidenceBadge variant="knowledge"`;
- keep Skill mastery confidence separately rendered using `ConfidenceBadge variant="mastery"`.

## 3.4 Required test gate

Add or strengthen a test proving:

```text
Given a Knowledge Node linked to Skill A:
- real Skill A mastery and XP are rendered only inside the linked Skill section;
- Knowledge confidence remains separately rendered;
- switching to Skill B removes Skill A values immediately;
- failed Skill B fetch does not render M0, XPProgress, old mastery, or fabricated confidence;
- no Knowledge authority field is transformed into mastery.
```

## 3.5 Required documentation sync

Update:

```text
docs/DesignSystem/05_ENTITY_VISUAL_LANGUAGE.md
docs/DesignSystem/PHASE6_IMPLEMENTATION_PLAN.md
```

If `docs/MASTER_PROJECT_HANDOFF.md` contains wording that says Knowledge can never show linked Skill state under any condition, align it to the new isolated read-only exception.

Do not weaken the underlying anti-conflation invariant.

---

# 4. P1-02 — COMPLETE 44PX TOUCH-TARGET GOVERNANCE

## 4.1 Problem

The design token is frozen:

```css
--touch-target-min: 44px;
```

The Phase 6 report claimed all interactive controls meet this requirement, but several controls in `/knowledge` do not explicitly enforce the token and are visually smaller than the policy target.

Examples include, but are not limited to:

```text
Mobile toolbar filter button
Mobile toolbar search input
View-mode switch button
Knowledge page local controls
EditNodeMetadataModal action buttons
EditNodeMetadataModal form controls
Node/edge detail action buttons
Any compact interactive control introduced by Phase 6
```

## 4.2 Required implementation strategy

First inventory **every interactive element** under:

```text
src/app/knowledge/**
```

Inspect:

```text
button
input
select
textarea
a[href]
Link
role="button"
ReactFlow Controls
interactive cards
modal controls
inspector controls owned by Phase 6 page content
```

Do not modify the frozen shared components themselves.

### Preferred order

1. Reuse existing shared primitives where they fit without changing frozen primitives.
2. Otherwise add local sizing using the frozen token:

```text
min-h-[var(--touch-target-min)]
min-w-[var(--touch-target-min)]
```

3. For text inputs/selects/textarea, minimum height must be enforced where appropriate.
4. For checkbox/radio controls, the **interactive labelled hit area** must satisfy the touch target; do not merely enlarge the visible 16px checkbox if wrapping the control+label in a 44px interactive row is semantically cleaner.
5. Preserve layout density on desktop where possible, but minimum touch geometry must still be correct on touch viewports.

## 4.3 ReactFlow Controls

Verify the rendered ReactFlow `Controls` buttons satisfy the same minimum target.

If local CSS/Tailwind selectors can safely enforce it from `KnowledgeGraphCanvas.tsx`, do so there.

Do not modify `@xyflow/react`, global CSS, design tokens, or shared primitives.

## 4.4 Required regression gate

Extend Phase 6 tests with a governance test that scans the Phase 6 production surface and/or renders representative controls to verify touch-target enforcement.

At minimum, cover:

```text
mobile filter button
view switcher
layout select
edge authority select
relation type select
knowledge list node button
knowledge list edge button
edit modal cancel button
edit modal save button
node verify/reject actions
edge verify/reject actions
```

The test must be strong enough that removing the touch-target class from one of these controls causes test failure.

Avoid a meaningless string-existence test that passes merely because the token appears somewhere in the file.

---

# 5. P2-01 — CORRECT THE KNOWLEDGE NODE INTERACTION SEMANTICS CLAIM

## 5.1 Actual implementation

`KnowledgeNodeView` currently uses `RPGCard`.

The frozen `RPGCard` renders a `div` and, when interactive, adds:

```text
role="button"
tabIndex=0
Enter / Space keyboard activation
```

Therefore the Round 1 statement saying Knowledge Node uses a native:

```tsx
<button type="button">
```

is inaccurate.

## 5.2 Required resolution

Do not modify frozen `RPGCard`.

Do not refactor KnowledgeNodeView away from `RPGCard` solely to force a native `<button>` if that would duplicate card structure or violate the shared primitive governance rule.

Instead:

1. Keep the accessible interactive `RPGCard` implementation if it continues to satisfy keyboard behavior.
2. Update Phase 6 documentation/handoff wording to accurately state:

```text
KnowledgeNodeView uses the frozen interactive RPGCard primitive,
which exposes role="button", tabIndex=0 and Enter/Space activation.
```

3. Add a direct regression test for the **real KnowledgeNodeView**, not a mocked graph node.

Required test assertions:

```text
interactive role is button
tabIndex is 0
Enter activates node selection
Space activates node selection
Space prevents default scrolling behavior
aria-label includes node title and authority label
selected state remains visibly encoded
```

Do not claim native-button ownership afterward.

---

# 6. P2-02 — REPLACE REMAINING INTERNAL RAW ANCHORS

## 6.1 Problem

There are still internal navigation anchors using:

```tsx
<a href="/skills">
```

in the Phase 6 Knowledge surface.

## 6.2 Required fix

Replace all internal `/skills` anchors added/retained in Phase 6 with Next.js `Link`:

```tsx
import Link from "next/link";

<Link href="/skills">...</Link>
```

Known locations to verify:

```text
src/app/knowledge/components/LinkedSkillSummary.tsx
src/app/knowledge/components/KnowledgeDetailPanel.tsx
```

Also scan all of:

```text
src/app/knowledge/**
```

for internal links that use raw `<a href="/...">`.

External links may continue using normal anchors where semantically correct.

## 6.3 Required test

Add a lightweight regression gate or source scan proving no Phase 6 production file contains an internal raw anchor pattern such as:

```text
<a href="/
```

Do not block legitimate external `http://` / `https://` anchors if any exist.

---

# 7. P2-03 — REMOVE THE REMAINING LIGHTNING / ZAP FANTASY VISUAL

## 7.1 Problem

The ReactFlow lightning edge marker was removed successfully, but `KnowledgeEdgeDetailPanel.tsx` still imports and renders `Zap` for `contradicts`.

This conflicts with the Phase 6 design goal of removing the fantasy/game lightning treatment from Knowledge relationships.

## 7.2 Required fix

Remove:

```text
Zap
```

from the Knowledge edge detail visual language.

Use a semantically neutral alternative already available from `lucide-react`, such as a conflict/relationship icon that does not imply magical energy.

Preferred characteristics:

```text
non-fantasy
non-animated
non-directional
compatible with symmetric contradicts semantics
color is not the sole semantic indicator
```

Do not add a new dependency.

Do not restore any lightning SVG marker.

## 7.3 Required regression test

Add a source/behavior test proving:

```text
KnowledgeGraphCanvas contains no lightning marker
KnowledgeEdgeDetailPanel imports/renders no Zap icon
contradicts remains symmetric
contradicts remains non-directional
contradicts remains static
```

---

# 8. ADDITIONAL QUALITY CHECKS REQUIRED IN ROUND 2

These are not new feature requests. They are regression checks required while touching the files above.

## 8.1 Async safety

Verify Node Detail and Edge Detail still ignore obsolete fetch responses after selection changes.

If existing tests already prove this sufficiently, do not refactor unnecessarily.

## 8.2 Single InspectorDrawer invariant

The page must continue to contain exactly one shared InspectorDrawer instance handling both Node and Edge content.

Do not create:

```text
NodeInspectorDrawer
EdgeInspectorDrawer
custom fixed panel
nested drawer
```

## 8.3 Modal focus containment

`BaseModal` remains the only modal primitive for:

```text
mobile filters
edit metadata
verify confirmation
reject confirmation
```

Do not create page-local backdrop/focus-trap implementations.

## 8.4 Edge semantics

Preserve the frozen five-relation matrix exactly:

```text
prerequisite  -> directed
contains      -> directed
supports      -> directed
contradicts   -> symmetric / no arrow
relates_to    -> symmetric / no arrow
```

All edges remain:

```text
animated: false
```

## 8.5 Authority semantics

Preserve:

```text
verified
inferred
rejected
superseded
archived lifecycle overlay
```

No frontend recalculation of authority or confidence is authorized.

---

# 9. TEST REQUIREMENTS

## 9.1 Mandatory Phase 6 tests

At minimum run:

```bash
pnpm vitest run tests/phase6-knowledge-ui.test.tsx
pnpm vitest run tests/stage6c-ui.test.tsx
pnpm vitest run tests/stage6c-presentation.test.ts
pnpm vitest run tests/global-app-shell.test.tsx
pnpm vitest run tests/visual-foundation.test.ts
```

If the repository uses a different existing command wrapper for these tests, use the repository-standard equivalent.

## 9.2 Mandatory full gates

Run all of:

```bash
pnpm test
pnpm harness:deterministic
pnpm lint
pnpm tsc --noEmit
pnpm build
```

All must finish with zero failures/errors/warnings according to existing project expectations.

## 9.3 Frozen-path diff audit

Before push, verify:

```bash
git diff --name-only a93e2bcada3eca63c3d69ecc633fd50df0f54e94 --
```

No unauthorized production path may appear.

Expected production changes should remain limited to `src/app/knowledge/**` plus authorized docs/tests.

## 9.4 Color/token scan

Re-run the existing Phase 6 governance scan and ensure production Phase 6 files still contain:

```text
Raw Hex Colors: 0
Raw numeric z-index classes: 0
Direct gold token use: 0 outside frozen primitives
Dark cyberpunk classes: 0
```

## 9.5 Link scan

Verify no internal raw anchor remains in Phase 6 production code:

```text
<a href="/
```

## 9.6 Lightning scan

Verify no fantasy lightning marker/icon remains in Phase 6 Knowledge production code.

Search terms should include at least:

```text
Zap
Lightning
knowledge-marker-lightning
```

Use judgment so comments describing prior removal do not create false positives; production visual references must be zero.

---

# 10. REQUIRED IMPLEMENTATION ORDER

Execute in this order to minimize churn:

## Step 1 — Re-read authority docs

Read:

```text
docs/DesignSystem/05_ENTITY_VISUAL_LANGUAGE.md
docs/DesignSystem/07_RESPONSIVE_AND_ACCESSIBILITY.md
docs/DesignSystem/09_GLOBAL_VISUAL_ACCEPTANCE_GATES.md
docs/DesignSystem/PHASE6_IMPLEMENTATION_PLAN.md
docs/MASTER_PROJECT_HANDOFF.md
```

## Step 2 — Baseline diff inspection

Inspect the current diff from:

```text
a93e2bcada3eca63c3d69ecc633fd50df0f54e94
```

to current branch HEAD.

Confirm there is no unexpected drift before editing.

## Step 3 — P1-01 documentation authorization

Amend the Knowledge/Skill anti-conflation rule to authorize an isolated, read-only Linked Skill Summary while preserving strict ownership boundaries.

Update tests only if needed to prove the existing behavior.

## Step 4 — P1-02 touch-target sweep

Inventory every interactive Phase 6 control and enforce `var(--touch-target-min)` without modifying frozen shared primitives.

Add regression coverage.

## Step 5 — P2 fixes

Apply:

```text
P2-01 accurate RPGCard interaction documentation + direct node keyboard test
P2-02 internal Link cleanup
P2-03 remove Zap/lightning visual
```

## Step 6 — Run targeted tests

Fix any regressions without expanding scope.

## Step 7 — Run full quality gates

Run full tests, deterministic harness, lint, TypeScript, build.

## Step 8 — Frozen-path audit

Confirm no forbidden paths changed.

## Step 9 — Commit

Use a focused commit message, for example:

```text
fix(knowledge): close Phase 6 Round 1 review findings
```

If documentation and implementation are intentionally split into separate commits, keep the total minimal and clearly scoped.

## Step 10 — Push existing branch

Push to:

```text
feature/phase6-knowledge-canvas
```

Do not open a second PR.

## Step 11 — Confirm remote CI

Wait for the PR #21 GitHub Actions run for the **new exact HEAD SHA**.

Do not report CI success from the old `006fe83...` run after new commits are pushed.

---

# 11. PROHIBITED SHORTCUTS

The following are unacceptable:

```text
Do not mark P1-01 resolved merely by adding a comment in code.
Do not suppress the anti-conflation test instead of formalizing the rule.
Do not delete LinkedSkillSummary solely to avoid updating the semantic spec unless a real defect is found.
Do not change Skill API or Skill domain models.
Do not add fake mastery fallback values.
Do not hardcode 44px if the frozen token can be used.
Do not alter --touch-target-min.
Do not modify RPGCard or BaseModal to solve page-local issues.
Do not reintroduce dark/neon/gradient styling.
Do not add a new UI library or graph layout dependency.
Do not create a second InspectorDrawer.
Do not create a second modal system.
Do not mutate knowledge authority in the frontend.
Do not merge the PR automatically.
Do not claim CI passed unless the workflow run is tied to the new exact HEAD SHA.
```

---

# 12. ROUND 2 ACCEPTANCE MATRIX

The implementation is ready for re-review only if every row below is PASS.

| Gate | Required State |
| --- | --- |
| P1-01 semantic governance | PASS — isolated Linked Skill exception formally documented |
| P1-01 anti-conflation | PASS — Knowledge authority/confidence still separate from Skill mastery/XP |
| P1-01 failure behavior | PASS — no fabricated M0/XP/confidence |
| P1-02 touch target | PASS — all Phase 6 interactive controls satisfy frozen minimum target policy |
| P1-02 regression gate | PASS — representative controls fail tests if touch target is removed |
| P2-01 semantics wording | PASS — no claim of native `<button>` if using RPGCard role button |
| P2-01 keyboard behavior | PASS — real KnowledgeNodeView Enter/Space verified |
| P2-02 routing | PASS — no internal raw `/...` anchor in Phase 6 production code |
| P2-03 fantasy visual | PASS — no Zap/lightning visual remains |
| Five relation ontology | PASS |
| Symmetric edge directionality | PASS |
| All edge animation | `false` |
| Single InspectorDrawer | PASS |
| BaseModal reuse | PASS |
| Backend delta | 0 |
| Knowledge domain delta | 0 |
| Shared UI primitive delta | 0 |
| Shared layout delta | 0 |
| Design token delta | 0 |
| Dependency delta | 0 |
| Previously frozen page delta | 0 |
| Raw hex in Phase 6 | 0 |
| Raw z-index in Phase 6 | 0 |
| Direct gold in Phase 6 production | 0 |
| Dark cyberpunk classes | 0 |
| `pnpm test` | PASS |
| deterministic harness | PASS |
| lint | PASS |
| TypeScript | PASS |
| production build | PASS |
| remote CI on new HEAD | PASS |

---

# 13. REQUIRED ROUND 2 COMPLETION REPORT FORMAT

When execution is complete, return exactly the following information to the user/review AI.

```text
PHASE 6 — KNOWLEDGE GRAPH CANVAS MODERNIZATION
ROUND 2 COMPLETE
→ REQUEST INDEPENDENT REVIEW

==================================================
1. REPOSITORY / PR
==================================================
Repository: Daylily-Huang/AI-Personal-Growth-RPG
PR: #21
Branch: feature/phase6-knowledge-canvas
Base SHA: <current PR base SHA>
New Exact Head SHA: <new head SHA>

==================================================
2. ROUND 2 COMMITS
==================================================
<commit list>

==================================================
3. REVIEW FINDING CLOSURE
==================================================
P1-01: CLOSED
- <what changed>
- <test evidence>

P1-02: CLOSED
- <what changed>
- <test evidence>

P2-01: CLOSED
- <what changed>

P2-02: CLOSED
- <what changed>

P2-03: CLOSED
- <what changed>

==================================================
4. CHANGED FILES
==================================================
<exact changed files>

==================================================
5. FROZEN BOUNDARY VERIFICATION
==================================================
Production Backend Delta: 0
Knowledge Domain Delta: 0
Shared UI Primitive Delta: 0
Shared Layout Delta: 0
Design Token Delta: 0
Dependency / Lockfile Delta: 0
Previously Frozen Pages Delta: 0

==================================================
6. GOVERNANCE SCANS
==================================================
Raw Hex: 0
Raw z-index: 0
Direct Gold: 0
Dark Classes: 0
Internal Raw Anchors: 0
Zap / Lightning Production Visuals: 0

==================================================
7. TESTS
==================================================
Phase 6 tests: <result>
Global AppShell: <result>
Visual Foundation: <result>
Deterministic Harness: <result>
Lint: <result>
TypeScript: <result>
Build: <result>
Full pnpm test: <result>

==================================================
8. REMOTE CI
==================================================
Workflow Run: <URL or run ID>
Head SHA: <must equal new exact Head SHA>
check: SUCCESS
supabase-integration: SUCCESS

==================================================
9. DEFECT COUNTS
==================================================
P0: 0
P1: 0
P2: 0
Unresolved Review Findings: 0

==================================================
10. REQUEST
==================================================
Request independent Round 2 review and merge authorization.
```

Do not report the Round 2 as complete if any acceptance row remains unverified.

---

# 14. FINAL EXECUTION DIRECTIVE

Implement **only** the five review closures described in this document.

The primary goal is not to add features. The goal is to make the existing Phase 6 implementation fully consistent with its own frozen governance model and accessible interaction policy.

Expected final state:

```text
P0 = 0
P1 = 0
P2 = 0
Backend Drift = 0
Shared Primitive Drift = 0
Dependency Drift = 0
All Local Gates = PASS
Remote CI on New Exact HEAD = PASS
PR #21 remains open and ready for independent re-review
```
