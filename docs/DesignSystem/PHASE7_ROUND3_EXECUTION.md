# Phase 7 — Round 3 Execution Manual

## Motion / Reduced-Motion Polish

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`  
**Execution stage:** Phase 7 — Round 3  
**Round 3 focus:** restrained motion consistency, reduced-motion correctness, graph-camera motion, overlay/shell transition regression, and motion governance  
**Planning document branch:** `review/phase7-round3-planning`  
**Document planning baseline:** `533ab09ebeb8bb827401446f022cf9a83c7db89c`  
**Phase 6 FINAL FROZEN merge baseline:** `186e5bed71844ba274680b10ab939bc5169e669d`  
**Phase 7 Round 1 merge commit:** `533ab09ebeb8bb827401446f022cf9a83c7db89c`  
**Phase 7 Round 2 approved Exact Head:** `d17dbd8f884b763d23cc7070078cece1e386eec8`  
**Phase 7 Round 2 approved CI:** `34379381800`  
**Round 2 PR:** `#23`  
**Prerequisite:** Round 2 MUST be merged and post-merge verified before Round 3 implementation begins.  
**Status at document creation:** Round 2 approved but not yet merged; Round 3 implementation NOT STARTED.

---

# 0. Executive directive

Round 3 is **not an animation expansion phase**.

Its job is to make the existing application motion system predictable, restrained, token-governed, and safe for users who request reduced motion.

The target state is:

```text
Normal motion:
- subtle
- short
- causality-driven
- non-blocking
- does not delay business-state commits
- uses existing motion/easing tokens wherever the implementation surface allows

Reduced motion:
- no persistent spinner/pulse movement where a static indicator is sufficient
- no graph camera travel
- no sliding/scale travel that can trigger vestibular discomfort
- no animated scrolling
- no motion-only semantic feedback
- same data, same state transitions, same keyboard/focus behavior

Governance:
- no new product animation feature
- no new design token
- no new dependency
- no backend/domain/API/Supabase change
- no Round 4 final-freeze work
```

Round 3 must end in its own independently reviewable PR.

Do not merge automatically.

---

# 1. Hard entry gate — DO NOT SKIP

Round 3 implementation may not begin merely because this document exists.

The execution AI MUST first perform the following preflight.

## 1.1 Verify PR #23 is actually merged

Fetch current repository state and confirm:

```text
PR #23 state = closed
PR #23 merged = true
Merged PR Head = d17dbd8f884b763d23cc7070078cece1e386eec8
```

If PR #23 is still open, draft, closed-unmerged, or its merged Head differs from the approved Exact Head:

```text
STOP
DO NOT START ROUND 3
RETURN TO INDEPENDENT REVIEWER
```

## 1.2 Verify post-merge ancestry

Record:

```text
Round 2 merge commit SHA
current main SHA
```

Then prove that:

```text
d17dbd8f884b763d23cc7070078cece1e386eec8
```

is an ancestor of current `main`.

Also verify that the Round 2 merge is based on the Round 1 merge baseline:

```text
533ab09ebeb8bb827401446f022cf9a83c7db89c
```

If unrelated production-code changes landed on `main` after Round 2 approval, stop and obtain independent scope confirmation before starting Round 3.

Docs-only commits after the Round 2 merge are acceptable only after they are read and confirmed not to change the Phase 7 execution boundary.

## 1.3 Re-read authoritative documents from CURRENT main

Do not use this planning branch as a substitute for current-main governance.

Read in full:

```text
docs/MASTER_PROJECT_HANDOFF.md
docs/DesignSystem/01_GLOBAL_VISUAL_DIRECTION.md
docs/DesignSystem/02_DESIGN_TOKENS.md
docs/DesignSystem/03_GLOBAL_APP_SHELL.md
docs/DesignSystem/04_SHARED_COMPONENT_SYSTEM.md
docs/DesignSystem/05_ENTITY_VISUAL_LANGUAGE.md
docs/DesignSystem/06_MOTION_AND_FEEDBACK.md
docs/DesignSystem/07_RESPONSIVE_AND_ACCESSIBILITY.md
docs/DesignSystem/08_PAGE_MIGRATION_PLAN.md
docs/DesignSystem/09_GLOBAL_VISUAL_ACCEPTANCE_GATES.md
docs/DesignSystem/PHASE7_ROUND1_EXECUTION.md
docs/DesignSystem/PHASE7_ROUND2_EXECUTION.md
```

Then read this Round 3 manual from:

```text
review/phase7-round3-planning:docs/DesignSystem/PHASE7_ROUND3_EXECUTION.md
```

If a newer reviewed Round 3 manual exists on `main`, prefer the newer authoritative version.

---

# 2. Branch and PR protocol

Only after Section 1 passes:

Create exactly:

```text
feature/phase7-motion-reduced-motion
```

from the verified post-Round-2 `main` SHA.

Record the exact branch-point SHA in the completion report.

Suggested PR title:

```text
feat(motion): Phase 7 Round 3 reduced-motion polish
```

Round 3 must use its own PR.

Do not append Round 3 implementation commits to PR #23.

Do not commit directly to `main`.

Do not open Round 4 work in the same PR.

---

# 3. Governing motion contract

Round 3 implements the frozen principles in `06_MOTION_AND_FEEDBACK.md`:

```text
Restrained & Subtle
Causality-Driven
Never Blocking
Respects Accessibility
Zero Cutscenes
```

Existing motion token authority includes the current design-token family such as:

```text
--duration-instant
--duration-fast
--duration-normal
--duration-slow
--duration-drawer
--duration-drawer-mobile
--duration-modal
--duration-accordion
--duration-xp-float
--ease-out-gentle
--ease-in-out-subtle
--ease-drawer
```

Do not create replacements such as:

```text
--duration-round3-*
--reduced-motion-*
--motion-safe-*
```

No new design token is authorized in this round.

---

# 4. Product/domain invariants — ABSOLUTELY FROZEN

Motion work must not alter any authority or business fact.

Preserve:

```text
Time is not XP
XP is not Mastery
High Mastery requires Evidence
LLM proposal != committed authority
Final XP remains deterministic
Every XP mutation remains ledger-traceable
Knowledge authority != Skill mastery
Knowledge confidence != truth
Mastery != confidence
Artifact != Evidence
Archive lifecycle != authority state
```

The visual/motion layer MUST NOT:

```text
compute XP
compute Mastery
fabricate confidence
change Knowledge authority
change Evidence semantics
change relation ontology
change persistence timing
change settlement timing
change API data
change ordering of permanent state commits
```

Animation completion must NEVER be a prerequisite for a domain mutation.

No business action may wait for `transitionend`, `animationend`, an arbitrary visual timeout, or a camera animation before committing state.

---

# 5. Round 1 and Round 2 behavior frozen inside Round 3

The following are regression contracts:

```text
/skills?view=table
/knowledge?view=table
semantic graph tables
connected-node arrow-key traversal
Enter/Space inspection
page-owned Skill selected state + aria-pressed synchronization
Knowledge authority / lifecycle / confidence separation
single InspectorDrawer ownership
BaseModal topmost Escape behavior
focus restoration
responsive shell behavior
320 / 375 / 768 / 1024 / 1440 layout fixes
page-level overflow ownership
intentional local table/graph overflow
touch target contract var(--touch-target-min)
```

Reduced-motion changes must not change these behaviors.

---

# 6. Scope control

## 6.1 Default authorized page-local paths

Round 3 may modify motion/reduced-motion behavior only where evidence requires it under:

```text
src/app/dashboard/**
src/app/quests/**
src/app/skills/**
src/app/knowledge/**
src/app/artifacts/**
src/app/login/**
tests/**
```

## 6.2 Narrow shared structural-motion allowlist

Unlike Round 2, Round 3 may require a **minimal** shared structural-motion fix because motion ownership for shell/overlay behavior lives in shared components.

Only the following shared files are conditionally authorized, and only when direct runtime evidence proves a Round 3 defect cannot be fixed page-locally:

```text
src/components/layout/AppEnvironment.tsx
src/components/layout/AppShell.tsx
src/components/layout/AppSidebar.tsx
src/components/layout/AppWorkspace.tsx
src/components/layout/MobileNav.tsx
src/components/layout/InspectorDrawer.tsx
src/components/ui/BaseModal.tsx
src/components/ui/RPGCard.tsx
```

Rules for these files:

1. motion-only change;
2. no API shape change unless strictly necessary for motion preference propagation;
3. no visual redesign;
4. no new authority/business logic;
5. no responsive redesign;
6. no new overlay implementation;
7. no new token;
8. every shared-file change must have direct behavioral regression tests;
9. every shared-file change must be explicitly listed in the completion report with reason.

If a required shared motion defect exists outside this allowlist:

```text
STOP
REQUEST SCOPE EXPANSION
```

Do not silently broaden `src/components/**`.

## 6.3 Frozen paths — MUST NOT MODIFY

```text
src/app/api/**
src/lib/**
supabase/**
src/proxy.ts
src/styles/design-tokens.css
package.json
pnpm-lock.yaml
```

Also frozen unless specifically listed in Section 6.2:

```text
src/components/**
```

## 6.4 Prohibited expansion

Do not add:

```text
new dependencies
new animation library
Framer Motion
GSAP
new CSS design tokens
new keyframe system solely for decoration
new particle effects
new parallax
new animated graph edges
new XP celebration product flow
new mastery celebration product flow
new modal/drawer implementation
new routes
new navigation destinations
new backend fields
new database fields
new API contract
Round 4 final-freeze documentation
```

---

# 7. Audit-first workflow

Before changing code, create a motion inventory from the **post-Round-2 branch point**.

At minimum inspect:

```bash
rg -n "animate-|transition-|duration-|ease-|scroll-behavior|setCenter\(|fitView\(|setTimeout\(|requestAnimationFrame|prefers-reduced-motion|motion-reduce|motion-safe" \
  src/app src/components
```

Do not treat the grep output itself as a defect list.

For every candidate classify:

```text
A. semantic/loading feedback
B. hover/focus/press micro-interaction
C. structural shell/overlay motion
D. graph camera motion
E. decorative/environment motion
F. timer not related to visual motion
```

Category F timers must not be modified merely because they match the search.

Create an internal audit table while implementing:

| Surface | Route/component | Current motion | Reduced behavior | Tokenized? | Defect? | Fix? |
| --- | --- | --- | --- | --- | --- | --- |

The completion report should summarize the resulting inventory, not dump every grep match.

---

# 8. Workstream A — Global reduced-motion contract

The current application already has a global CSS reduced-motion reset in `src/app/globals.css`.

Round 3 MUST preserve it.

Expected baseline:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Do not create a second competing global reset.

Do not edit `src/styles/design-tokens.css`.

`src/app/globals.css` may be modified only if direct verification shows the existing reduced-motion reset is insufficient for a real Round 3 defect; any change requires explicit test coverage and must preserve the same design-token authority.

Reduced motion is a presentation preference, not a data preference.

The DOM's authoritative values, labels, statuses, Mastery, XP, authority, and confidence must remain identical between:

```text
prefers-reduced-motion: no-preference
prefers-reduced-motion: reduce
```

---

# 9. Workstream B — Loading indicators and perpetual motion

Audit all loading indicators on:

```text
/login
/dashboard
/quests
/skills
/knowledge
/artifacts
```

Also audit loading states inside InspectorDrawer/detail panels and existing modals.

Rules:

### Normal motion

Existing loading spinners/pulses may animate if they are restrained and already part of the product.

### Reduced motion

Every persistent spinner/pulse must become static or effectively non-animated.

Preferred existing pattern:

```text
animate-spin motion-reduce:animate-none
animate-pulse motion-reduce:animate-none
```

Do not remove `role="status"`, `aria-busy`, accessible names, or textual loading meaning just to remove animation.

Static reduced-motion indicators must still communicate loading state to assistive technology.

Do not introduce a new animated skeleton system.

---

# 10. Workstream C — Graph camera motion

This is a mandatory Round 3 focus area.

Audit both:

```text
src/app/skills/components/SkillGraphCanvas.tsx
src/app/knowledge/components/KnowledgeGraphCanvas.tsx
```

Current implementation already checks:

```text
window.matchMedia("(prefers-reduced-motion: reduce)").matches
```

and uses zero duration under reduced motion.

Round 3 must independently verify this behavior after Round 2 merges.

## 10.1 Required reduced-motion behavior

When reduced motion is active:

```text
keyboard focus recenter -> camera duration 0
programmatic fitView -> camera duration 0
node inspection selection -> no animated camera travel
filter-triggered refit -> no animated camera travel
```

Do not disable keyboard navigation.

Do not disable selection.

Do not remove fit/recenter entirely if it is necessary for spatial usability; make it instantaneous.

## 10.2 Normal-motion behavior

Normal motion must remain short and restrained.

Audit current raw camera duration literals.

Known pre-Round-3 candidates include the existing ReactFlow camera values in Skills and Knowledge canvases.

Do not blindly preserve a long value merely because it already existed.

Do not invent a new timing value.

Where a third-party API requires a numeric duration rather than a CSS variable:

1. prefer reading an existing frozen CSS duration token at runtime;
2. keep the resolver local to the presentation layer;
3. fail safely if the token cannot be read;
4. do not place the helper under `src/lib/**`;
5. do not create a new design token;
6. do not alter graph authority/edge semantics.

If implementation complexity would outweigh the motion benefit, retaining an existing normal-motion numeric duration is preferable to introducing architectural drift; reduced-motion duration=0 remains mandatory.

## 10.3 Graph edge motion

Skill and Knowledge production presentation edges are expected to remain static.

Round 3 must not re-enable animated edge flow.

```text
animated: false
```

must remain the effective presentation behavior for the frozen graph UI.

Do not add pulse propagation or running dash animations in this round.

---

# 11. Workstream D — InspectorDrawer motion

Audit the existing shared `InspectorDrawer` without redesigning it.

Verify at representative widths:

```text
375
768
1024
1440
```

Normal motion:

- opening/closing remains restrained;
- mode transition does not create duplicate drawers;
- no focus delay is coupled to visual duration;
- backdrop motion does not block interaction after state close;
- wide push-mode remains usable.

Reduced motion:

- opening the drawer does not visually travel across the viewport for a perceptible duration;
- closing is effectively immediate;
- focus moves according to the same contract as normal mode;
- Escape closes the same topmost surface;
- opener focus restoration remains unchanged;
- modal/push breakpoint semantics remain unchanged.

The reduced-motion preference must not change:

```text
role
data-mode
aria-modal
focus trap behavior
Escape ownership
selected entity
```

Do not create a second drawer or reduced-motion-only DOM tree.

Prefer one stable subtree.

---

# 12. Workstream E — BaseModal motion

Audit `BaseModal` and representative existing modal consumers.

Normal motion:

- backdrop/modal transition remains token-governed;
- dialog remains non-blocking after its open state becomes false;
- no animation completion gates submit/cancel state.

Reduced motion:

- no perceptible scale/translate travel;
- no focus delay caused by transition timing;
- focus trap remains intact;
- Escape still closes only the topmost modal;
- opener focus restoration remains intact;
- backdrop click semantics unchanged;
- responsive sizing from Round 2 unchanged.

Do not change modal business forms merely for motion polish.

Do not create reduced-motion-specific modal markup.

---

# 13. Workstream F — Shell/sidebar/navigation transitions

Audit existing shell motion such as:

```text
sidebar collapse/expand
workspace margin transition
navigation active-state transition
header/menu state transition
```

Normal motion must remain subtle and not cause content to become inaccessible while moving.

Reduced motion must remove perceptible structural travel while preserving the final layout state.

Do not alter the Round 2 responsive breakpoint contract.

Do not change:

```text
mobile bottom navigation
md collapsed sidebar
lg expanded sidebar
xl drawer behavior
```

Motion polish cannot become responsive redesign.

---

# 14. Workstream G — Card/button/filter micro-interactions

Audit representative interactive surfaces, not every line mechanically.

Representative surfaces:

```text
RPGCard hover/selected state
primary/secondary/danger actions
filter pills
view toggles
search clear controls
table row inspection controls
graph controls
retry actions
```

Requirements:

- color/opacity/elevation transitions remain subtle;
- normal motion does not exceed frozen interaction intent;
- reduced motion must not remove visible selected/focus states;
- `:focus-visible` remains visible;
- hover movement must not be the only feedback channel;
- no transform should change hit-target geometry or overlap adjacent controls;
- touch target contract remains `var(--touch-target-min)`.

Do not replace a semantic state with animation-only feedback.

---

# 15. Workstream H — Environmental/decorative motion

The design specification describes atmospheric mist motion, but the currently frozen implementation may not contain an active mist animation.

Round 3 must follow this rule:

```text
DO NOT CREATE NEW DECORATIVE MOTION SOLELY TO MATCH AN ASPIRATIONAL SPEC SENTENCE.
```

If no production mist animation exists after Round 2 merge:

```text
record: NOT PRESENT / NO ACTION
```

Do not add it.

If an existing environment animation is present because `main` changed before Round 3 begins:

- verify reduced motion halts it completely;
- verify normal motion is subtle;
- verify it remains `aria-hidden` and `pointer-events-none`;
- verify contrast/readability unaffected.

---

# 16. Workstream I — Scroll behavior

Audit programmatic and CSS smooth scrolling.

Reduced-motion requirement:

```text
scroll-behavior: auto
```

No reduced-motion path may force:

```text
behavior: "smooth"
```

If programmatic scrolling exists, reduced-motion preference must select instant/auto behavior without changing the destination or focus target.

Do not introduce scroll-jacking.

---

# 17. Motion/state decoupling gate

Search for motion-coupled state transitions:

```bash
rg -n "transitionend|animationend|setTimeout\(|requestAnimationFrame\(" src/app src/components
```

For every match, distinguish:

```text
visual scheduling
focus scheduling
network debounce
stale-response protection
business-state delay
```

Only motion-related defects belong to Round 3.

Hard prohibition:

```text
Domain mutation waits for animation completion
Permanent state is committed after a decorative timeout
Authority changes depend on a motion callback
XP/mastery update waits for visual ticker completion
```

If such a pattern is discovered, classify it as a blocker and request independent review before refactoring business behavior, because `src/lib/**` and APIs remain frozen.

---

# 18. Required automated tests

Round 3 tests must exercise behavior.

Source-string scans alone are insufficient.

Add a dedicated file unless repository conventions strongly justify extension of an existing Phase 7 test:

```text
tests/phase7-motion-reduced-motion.test.tsx
```

At minimum test the following.

## 18.1 matchMedia harness

Provide deterministic mocked states for:

```text
prefers-reduced-motion: no-preference
prefers-reduced-motion: reduce
```

Do not rely on the developer machine OS preference.

## 18.2 Skills graph camera

Mock/spy ReactFlow camera methods and prove:

```text
reduce -> setCenter duration = 0
reduce -> fitView duration = 0
no-preference -> motion remains non-zero
```

Also prove keyboard navigation and selected state still work.

## 18.3 Knowledge graph camera

Same direct assertions:

```text
reduce -> setCenter duration = 0
reduce -> fitView duration = 0
no-preference -> motion remains non-zero
```

Retain Knowledge authority and relation semantics.

## 18.4 Loading motion

Representative spinner/pulse tests must prove the reduced-motion fallback exists without removing:

```text
role=status
aria-busy
accessible text/name
```

## 18.5 InspectorDrawer

If shared drawer code changes, directly test both preference states:

```text
open
focus enters correctly
Escape closes
focus restores
reduced preference does not alter semantic mode ownership
```

## 18.6 BaseModal

If BaseModal changes, test:

```text
focus containment
Escape topmost ownership
focus restoration
reduced preference does not alter submit/cancel behavior
```

## 18.7 Semantic equivalence

For representative Skill and Knowledge data, render under both motion preferences and assert equality of authoritative visible/read-model facts.

Reduced motion must not change:

```text
Mastery label
XP value
Knowledge authority
Knowledge confidence
Evidence labels
relation labels
archive lifecycle
```

## 18.8 Global reset regression

Retain/strengthen verification that `globals.css` includes the reduced-motion global reset.

A source check is acceptable here only as an additional governance test, not as the sole Round 3 validation.

---

# 19. Manual browser verification matrix

Manual verification must cover BOTH motion preferences.

Use browser/OS emulation where available and report exactly what was used.

## 19.1 Required routes

```text
/
/login
/dashboard
/quests
/skills
/skills?view=table
/knowledge
/knowledge?view=table
/artifacts
```

## 19.2 Required widths

At minimum:

```text
375
768
1024
1440
```

320px responsive stress was Round 2; repeat it only if a Round 3 motion change affects narrow-mobile layout or overlays.

## 19.3 Normal-motion checks

Verify:

- shell transition does not block controls;
- graph recenter/fit motion is restrained;
- drawer/modal transition does not cause focus flicker;
- loading feedback is understandable;
- no animated graph edges appear;
- no page-level overflow regression;
- tables remain usable.

## 19.4 Reduced-motion checks

Enable `prefers-reduced-motion: reduce` and verify:

- graph camera snaps instantly;
- loaders do not continually spin/pulse where motion-reduce contract exists;
- modal/drawer semantic interaction remains intact;
- structural travel is effectively eliminated by the global reduced-motion reset;
- smooth scrolling is disabled;
- keyboard/focus remains identical;
- no data/authority/mastery/confidence state changes;
- no new clipping/overflow appears.

## 19.5 Assistive-technology/device boundaries

Round 3 does not authorize fabricated claims.

Report separately:

```text
actual OS/browser reduced-motion emulation
physical device verification
VoiceOver
NVDA
JAWS
```

If unavailable, say `NOT VERIFIED`.

Do not convert viewport emulation into a physical-device PASS.

---

# 20. Motion governance scanners

Add or strengthen fail-closed tests where practical.

Recommended checks for Round 3 production delta:

### 20.1 No new animation dependency

Verify:

```text
package.json unchanged
pnpm-lock.yaml unchanged
```

### 20.2 No new design tokens

Verify:

```text
src/styles/design-tokens.css unchanged
```

### 20.3 No backend/domain drift

Verify zero changes under:

```text
src/app/api/**
src/lib/**
supabase/**
src/proxy.ts
```

### 20.4 No animated graph edge regression

Direct presentation tests must preserve static edge behavior.

### 20.5 No unpaired perpetual loaders

A scanner may flag `animate-spin` / `animate-pulse` missing a reduced-motion companion for review.

Do not make the scanner the only proof.

### 20.6 No broad raw motion expansion

Flag newly added:

```text
animation:
@keyframes
animate-[...]
transition-[...]
```

for manual review.

Do not automatically reject existing frozen usages without understanding context.

---

# 21. Required local quality gates

After implementation:

```bash
pnpm test
pnpm test:e2e
pnpm harness:deterministic
pnpm lint
pnpm tsc --noEmit
pnpm build
```

Also run the targeted Round 3 suite explicitly, e.g.:

```bash
pnpm vitest run tests/phase7-motion-reduced-motion.test.tsx
```

If repository scripts differ on the actual branch, use the repository-defined equivalent and report the exact command.

Rules:

```text
skipped != passed
unavailable != passed
emulated != physical device
source scan != runtime proof
```

---

# 22. Required remote Exact-Head CI

After local gates pass:

1. push `feature/phase7-motion-reduced-motion`;
2. open/update the dedicated Round 3 PR;
3. record the new Exact Head SHA;
4. wait for the PR-triggered GitHub Actions run for that exact Head;
5. inspect the run, not merely the status badge.

Required jobs:

```text
check = SUCCESS
supabase-integration = SUCCESS
```

Inside `supabase-integration`, independently confirm actual execution of:

```text
Start local Supabase stack
Build production app
Run database-backed tests
Deterministic growth-engine harness
Run E2E tests
Stop containers
```

Do not reuse:

```text
Round 1 CI 34223921283
Round 2 CI 34379381800
any older Round 3 CI for a changed Head
```

If the PR workflow checks out a GitHub synthetic merge commit, verify from logs that it is exactly:

```text
Merge <Round3 Exact Head> into <current verified main/base>
```

A green synthetic merge is acceptable only when its parents correspond to the reviewed Exact Head and correct base.

---

# 23. Independent-review acceptance matrix

Round 3 is eligible for GO only when every applicable gate passes.

| Gate | Required state |
| --- | --- |
| PR #23 Round 2 merged from approved Head | PASS |
| Round 2 approved Head ancestor of current main | PASS |
| Round 3 branch point recorded | PASS |
| Backend/domain/API delta | 0 |
| Supabase delta | 0 |
| Dependency delta | 0 |
| Design-token delta | 0 |
| Shared-component delta | only Section 6.2 justified motion-only changes |
| XP/Mastery/Evidence semantics | unchanged |
| Knowledge authority/confidence semantics | unchanged |
| Round 1 keyboard semantics | PASS |
| Round 2 responsive/overflow regression | PASS |
| `/skills?view=table` | PASS |
| `/knowledge?view=table` | PASS |
| Skill graph reduced camera motion | PASS |
| Knowledge graph reduced camera motion | PASS |
| Graph edges remain static | PASS |
| Loading spinner/pulse reduced contract | PASS |
| InspectorDrawer reduced-motion semantics | PASS |
| BaseModal reduced-motion semantics | PASS |
| Shell/navigation motion regression | PASS |
| Smooth scroll reduced behavior | PASS |
| `var(--touch-target-min)` preserved | PASS |
| No business state gated by animation | PASS |
| Normal motion restrained/non-blocking | PASS |
| Reduced motion semantic equivalence | PASS |
| Local unit/integration suite | PASS with exact skipped accounting |
| deterministic harness | PASS |
| lint | PASS |
| TypeScript | PASS |
| production build | PASS |
| new Exact-Head check CI | SUCCESS |
| new Exact-Head supabase-integration CI | SUCCESS |
| remote DB-backed tests actually executed | PASS |
| remote E2E actually executed | PASS |
| Round 4 work absent | PASS |

Any P0 or P1 finding means:

```text
NO-GO → NEED_FIX
```

No automatic merge.

---

# 24. Severity guidance for independent reviewer

## P0 — catastrophic/security/authority

Examples:

- business state or authority mutation changed;
- RLS/API/backend drift;
- deterministic XP/mastery semantics altered;
- cross-tenant/security regression.

## P1 — merge blocker

Examples:

- reduced-motion user still gets graph camera animation;
- perpetual animation lacks reduced-motion handling on a core flow;
- modal/drawer focus or Escape regression;
- Round 2 responsive regression caused by motion change;
- new dependency/design token;
- unauthorized shared-component modification;
- animated graph edges reintroduced;
- motion delays permanent state mutation;
- reduced-motion changes semantic data or selected state;
- Exact-Head CI mismatch.

## P2 — non-blocking quality/documentation issue

Examples:

- inaccurate completion-report wording;
- minor redundant transition class with no runtime defect;
- test naming/documentation mismatch;
- non-material scanner gap with independently verified clean diff.

Independent reviewer decides final severity.

---

# 25. Required completion report

When Round 3 implementation is complete, return exactly this structure:

```text
PHASE 7 — ROUND 3 COMPLETE
→ REQUEST INDEPENDENT REVIEW

Repository: Daylily-Huang/AI-Personal-Growth-RPG
Branch: feature/phase7-motion-reduced-motion
PR: #<number>

Phase 6 FINAL FROZEN baseline:
186e5bed71844ba274680b10ab939bc5169e669d

Phase 7 Round 1 merge commit:
533ab09ebeb8bb827401446f022cf9a83c7db89c

Phase 7 Round 2 approved Head:
d17dbd8f884b763d23cc7070078cece1e386eec8

Phase 7 Round 2 merge commit:
<verified merge SHA>

Actual Round 3 branch-point SHA:
<sha>

New Exact Head SHA:
<sha>

Changed files:
- <all files>

Motion inventory summary:
- loading spinner/pulse surfaces: <count/result>
- structural transitions: <count/result>
- graph camera paths: <count/result>
- decorative/environment motion: <count/result>
- programmatic smooth-scroll paths: <count/result>

Round 3 deliverables:
- global reduced-motion contract: <PASS/notes>
- Skill graph reduced camera motion: <PASS/notes>
- Knowledge graph reduced camera motion: <PASS/notes>
- graph static-edge preservation: <PASS/notes>
- loading motion fallback: <PASS/notes>
- InspectorDrawer motion/focus regression: <PASS/notes>
- BaseModal motion/focus regression: <PASS/notes>
- shell/navigation transition regression: <PASS/notes>
- semantic equivalence under reduced motion: <PASS/notes>
- Round 1 keyboard/table regression: <PASS/notes>
- Round 2 responsive/overflow regression: <PASS/notes>

Shared motion-component changes:
- <none OR exact file + justification>

Frozen-path audit:
- backend/domain/API: 0
- Supabase: 0
- design tokens: 0
- dependencies: 0
- unauthorized shared components: 0

Local validation:
- pnpm test: <exact result, skipped separated>
- pnpm test:e2e: <exact result, skipped separated>
- pnpm harness:deterministic: <exact result>
- pnpm lint: <result>
- pnpm tsc --noEmit: <result>
- pnpm build: <result>
- targeted Round 3 suite: <result>

Manual verification:
- routes: <routes>
- widths: <widths>
- normal-motion mode: <result>
- reduced-motion mode: <result>
- physical device: <verified/not verified>
- VoiceOver: <verified/not verified>
- NVDA: <verified/not verified>
- JAWS: <verified/not verified>

GitHub Actions:
- run id: <id>
- exact head sha: <sha>
- check: <result>
- supabase-integration: <result>
- DB-backed tests: <actual execution result>
- deterministic harness: <actual execution result>
- E2E: <actual execution result>
- stop containers: <result>

No merge performed.
No Phase 7 Round 4 work started.
Phase 7 is not FINAL FROZEN.
```

---

# 26. Prohibited shortcuts

```text
Do not start before Round 2 is merged and post-merge verified.
Do not treat this planning branch as the implementation branch.
Do not add new decorative animation just because the design specification mentions motion.
Do not add Framer Motion/GSAP or any animation dependency.
Do not create new design tokens.
Do not modify design-tokens.css.
Do not touch backend/domain/API/Supabase.
Do not re-enable animated graph edges.
Do not remove semantic loading feedback merely to remove animation.
Do not use reduced motion to disable keyboard navigation.
Do not use reduced motion to change selected state.
Do not use reduced motion to change XP/Mastery/authority/confidence data.
Do not gate state mutations on animation completion.
Do not claim a source-string scan proves runtime behavior.
Do not claim viewport emulation is physical-device validation.
Do not count skipped tests as passed.
Do not reuse old CI for a new Head.
Do not merge automatically.
Do not begin Round 4.
Do not declare Phase 7 FINAL FROZEN.
```

---

# 27. Final execution order

The execution AI should follow this exact order:

```text
1. Verify PR #23 merged from approved Round 2 Head.
2. Verify Round 2 Head ancestry on current main.
3. Re-read all current-main governance documents.
4. Record current main and Round 3 branch-point SHA.
5. Create feature/phase7-motion-reduced-motion from that exact main.
6. Build motion inventory before edits.
7. Fix only demonstrated Round 3 motion/reduced-motion defects.
8. Preserve Round 1 keyboard/table behavior.
9. Preserve Round 2 responsive/overflow/touch-target behavior.
10. Add direct behavior tests for normal + reduced preferences.
11. Run full local gates with honest skipped accounting.
12. Push and open dedicated Round 3 PR.
13. Wait for new Exact-Head CI.
14. Verify DB-backed, deterministic, and E2E steps actually executed.
15. Return the Section 25 completion report.
16. Stop. Await independent review.
```

Round 3 success means the application behaves identically in meaning and authority under both motion preferences, while reduced-motion users are not forced through camera travel, perpetual decorative motion, or structural animation.

It does **not** mean Phase 7 is finished.

Round 4 remains a separate, explicitly unauthorized final cross-page acceptance audit and freeze stage.
