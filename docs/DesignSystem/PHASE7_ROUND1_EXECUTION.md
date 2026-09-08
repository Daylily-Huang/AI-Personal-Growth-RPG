# Phase 7 — Round 1 Execution Manual

## End-to-End A11y, Responsive & Motion Polish

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`  
**Execution stage:** Phase 7 — Round 1  
**Round 1 focus:** Accessibility semantics, keyboard navigation, and graph alternative views  
**Authoritative starting main SHA:** `a40ff9806e3c90d02e298245956c8fe5236e2913`  
**Prerequisite:** Phase 6 — Knowledge Graph Canvas Modernization = **FINAL FROZEN**  
**Status before execution:** Phase 7 code work **NOT STARTED**

---

# 1. Purpose

Phase 7 is the final cross-page polish stage for the current visual-system migration. It is not a product-feature phase and it does not reopen any business/domain authority work.

The complete Phase 7 objective is:

```text
End-to-End Accessibility
+ Responsive Stress Hardening
+ Reduced-Motion / Interaction Polish
+ Final Cross-Page Regression Audit
```

To keep review scope controlled, Phase 7 is divided into independently reviewable rounds:

```text
Round 1 — Accessibility semantics + keyboard + graph table alternatives  ← EXECUTE NOW
Round 2 — Responsive stress hardening
Round 3 — Motion / reduced-motion polish
Round 4 — Final cross-page acceptance audit and Phase 7 freeze
```

**This execution manual authorizes Round 1 only.**

Do not begin Round 2, Round 3, or Round 4 until Round 1 receives an independent `GO` review.

---

# 2. Governing documents

Before changing code, read these files in full from the current `main` branch:

```text
docs/MASTER_PROJECT_HANDOFF.md
docs/DesignSystem/03_GLOBAL_APP_SHELL.md
docs/DesignSystem/04_SHARED_COMPONENT_SYSTEM.md
docs/DesignSystem/05_ENTITY_VISUAL_LANGUAGE.md
docs/DesignSystem/06_MOTION_AND_FEEDBACK.md
docs/DesignSystem/07_RESPONSIVE_AND_ACCESSIBILITY.md
docs/DesignSystem/08_PAGE_MIGRATION_PLAN.md
docs/DesignSystem/09_GLOBAL_VISUAL_ACCEPTANCE_GATES.md
```

Also inspect the current implementation and tests for:

```text
src/app/dashboard/**
src/app/quests/**
src/app/skills/**
src/app/knowledge/**
src/app/artifacts/**
src/app/login/**
src/components/layout/**
src/components/ui/**
tests/**
```

Do not trust old completion reports when source code or current `main` differs.

---

# 3. Non-negotiable project invariants

Round 1 must preserve all frozen product/domain rules:

```text
Time is not XP
XP is not Mastery
High Mastery requires Evidence
LLM proposal != committed authority
Final XP is deterministic
Every XP mutation is ledger-traceable
Knowledge authority != Skill mastery
Knowledge confidence != truth
Mastery != confidence
Artifact != Evidence
Archive lifecycle != authority state
Frontend presentation must not compute permanent authority facts
Frontend presentation must not fabricate mastery / XP / confidence
```

Phase 7 is strictly presentation/accessibility hardening.

No implementation in this round may alter business semantics, persistence rules, settlement behavior, authority transitions, RLS, API contracts, XP computation, mastery computation, or evidence semantics.

---

# 4. Baseline and branch protocol

## 4.1 Preflight

Before creating the implementation branch:

1. Fetch latest `main`.
2. Confirm `main` still contains `a40ff9806e3c90d02e298245956c8fe5236e2913` as its Phase 7 starting baseline.
3. If `main` has advanced only because this execution manual was added, use that new docs-only main tip as the branch point and record both:
   - frozen Phase 7 code baseline: `a40ff9806e3c90d02e298245956c8fe5236e2913`
   - actual branch-point SHA: current main tip
4. If `main` contains unrelated production-code changes after the frozen baseline, stop implementation and report the divergence for independent review.

## 4.2 Branch

Create:

```text
feature/phase7-a11y-keyboard
```

Do not commit directly to `main`.

## 4.3 PR policy

Round 1 must end in its own PR.

Suggested title:

```text
feat(a11y): Phase 7 Round 1 keyboard and semantic accessibility
```

Do not merge automatically.

---

# 5. Round 1 authorized scope

Round 1 is deliberately narrow.

## 5.1 Primary page-local paths

Authorized when needed:

```text
src/app/dashboard/**
src/app/quests/**
src/app/skills/**
src/app/knowledge/**
src/app/artifacts/**
src/app/login/**
```

## 5.2 Shared accessibility paths — conditional authorization

These paths are frozen from earlier phases and may only be changed if a cross-page accessibility defect cannot be correctly solved page-locally:

```text
src/components/layout/**
src/components/ui/**
```

Any change under these paths must satisfy all of the following:

1. accessibility / keyboard behavior only;
2. no visual redesign;
3. no new business logic;
4. no public semantic contract break;
5. existing callers remain compatible;
6. direct regression coverage is added;
7. completion report explicitly lists and justifies the shared change.

A shared primitive must not be copied into a page to avoid this rule.

## 5.3 Test paths

Authorized:

```text
tests/**
```

Prefer a dedicated suite such as:

```text
tests/phase7-a11y-keyboard.test.tsx
```

Existing tests may be strengthened when required.

---

# 6. Forbidden scope

The following remain frozen and MUST NOT change in Round 1:

```text
src/app/api/**
src/lib/**
supabase/**
src/proxy.ts
src/styles/design-tokens.css
package.json
pnpm-lock.yaml
```

Also forbidden:

```text
new dependencies
new database migrations
new API routes solely for accessibility
new domain fields
new authority states
new XP / mastery calculations
new design tokens
page-specific raw hex colors
raw numeric z-index values
new custom modal / drawer systems
large visual redesigns
Phase 8 or unrelated feature work
```

Do not change Dashboard, Quest, Skill, Knowledge, Artifact domain meaning while making them accessible.

---

# 7. Round 1 execution order

Execute the following in order.

---

## Step 1 — Produce a current accessibility inventory

Inspect all current user-facing routes:

```text
/
/login
/dashboard
/quests
/skills
/knowledge
/artifacts
```

For every route, inventory:

```text
semantic landmarks
page heading hierarchy
buttons
links
inputs
selects
checkboxes / radios
menus / navigation
cards that behave as buttons
modals / dialogs
InspectorDrawer interactions
empty-state actions
retry actions
icon-only controls
graph nodes
graph edges or edge-selection controls
list/table alternatives
focus order
Escape behavior
```

Do not create a separate audit-only PR. The inventory is the basis for implementation and should be summarized in the completion report.

Classify findings:

```text
P0 — inaccessible critical flow / keyboard cannot complete core action
P1 — frozen a11y specification violation
P2 — minor semantic or announcement defect
```

Fix only Round 1 accessibility/keyboard findings.

---

## Step 2 — Semantic landmark and control audit

Target the frozen accessibility requirements in `07_RESPONSIVE_AND_ACCESSIBILITY.md`.

Required outcomes:

### 2.1 Landmarks

Every rendered application state must expose a coherent semantic structure using the existing shell where applicable:

```text
header
nav
main
aside / complementary content when appropriate
dialog for modal surfaces
```

Do not add redundant nested landmarks simply to satisfy a scanner.

### 2.2 Heading hierarchy

Each primary route must have one meaningful top-level page heading or equivalent accessible page title relationship.

Do not use heading levels purely for font sizing.

### 2.3 Interactive semantics

All user-operable controls must be keyboard reachable and programmatically understandable.

Rules:

- use native `button`, `a`/Next `Link`, input, select, checkbox semantics whenever practical;
- existing frozen interactive primitives such as `RPGCard` may remain when they already provide correct role, `tabIndex`, Enter/Space activation and focus behavior;
- icon-only controls require an accessible name;
- decorative icons must not become noisy screen-reader content;
- disabled controls must expose a true disabled/unavailable state rather than only visual dimming;
- no clickable `div` without correct semantics;
- no positive `tabIndex` ordering hacks;
- no raw internal `<a href="/...">` regressions where Next `Link` is the project convention.

### 2.4 Form labeling

Every form control must have an explicit programmatic label.

Placeholder text is not a label.

Validation/error states must remain understandable without color alone.

---

## Step 3 — Keyboard-only navigation across core flows

A keyboard-only user must be able to traverse and operate each primary route without a mouse.

Verify and fix:

```text
Tab / Shift+Tab order follows the visual/logical reading order
focus is always visible
Enter activates link/button semantics
Space activates button-like controls without scrolling the page
Escape does not leak through nested overlays
focus does not become stranded in hidden content
focus does not jump unpredictably after async refreshes
```

### 3.1 Overlay ownership rule

For nested UI such as an edit modal opened from an InspectorDrawer:

```text
Escape #1 closes the modal only
parent drawer remains open
focus returns to the control that opened the modal when feasible
Escape #2 may close the drawer according to existing drawer behavior
```

Do not let a modal Escape event simultaneously dismiss its parent drawer.

### 3.2 Modal focus containment

`BaseModal` or the existing modal stack must provide correct focus containment while open.

If this is already implemented, preserve it and add regression coverage instead of rewriting it.

If a shared fix is required, it must be surgical and satisfy §5.2.

---

## Step 4 — Skill and Knowledge graph keyboard accessibility

This is a mandatory Round 1 deliverable.

The frozen specification requires accessible navigation for both high-density graph workspaces.

Targets:

```text
/skills
/knowledge
```

### 4.1 Focusable graph nodes

Graph nodes must expose a reliable keyboard focus target and accessible name containing enough entity identity/state context to distinguish nodes.

Do not fabricate domain values solely for the aria label.

### 4.2 Arrow-key connected-node traversal

Implement deterministic arrow-key traversal between connected nodes.

Navigation behavior must not alter graph/domain semantics.

Recommended deterministic rule:

1. Build candidates only from currently loaded nodes connected to the focused node by an existing visible/loaded edge.
2. Treat navigation adjacency independently from semantic edge direction; navigating backward along a directed edge does not change the relation itself.
3. For the pressed arrow, prefer connected nodes spatially located in that direction using current rendered/layout coordinates.
4. Select the nearest candidate in that direction.
5. Resolve equal-distance ties with a stable identifier order.
6. If no connected candidate exists in that direction, keep focus on the current node.
7. Never create, delete, reverse or mutate an edge as part of keyboard navigation.

`Enter` / `Space` must select/inspect the focused node using the same selection state as pointer interaction.

### 4.3 Reduced-motion compatibility

If keyboard focus causes canvas recentering, continue honoring `prefers-reduced-motion` and do not introduce a new animated path.

Full motion polish remains Round 3; Round 1 must merely avoid regression.

---

## Step 5 — Implement real accessible table alternatives for both graphs

The frozen specification explicitly requires:

```text
/skills?view=table
/knowledge?view=table
```

Round 1 must implement/verify these URL-addressable alternatives.

### 5.1 URL behavior

Requirements:

- default route behavior remains the current visual graph/tree experience;
- `?view=table` activates the accessible table representation;
- switching view updates the URL through Next routing conventions;
- reloading/bookmarking `?view=table` must restore table mode;
- unsupported `view` values must fail safely to the normal supported view rather than break the page.

### 5.2 Actual table semantics

Use genuine table semantics where the content is tabular:

```text
table
thead
tbody
th scope="col"
tr
td
caption or equivalent accessible naming
```

Do not merely restyle a collection of `div`s to look like a table.

### 5.3 Skill table

Only display data already supplied by the Skill read model/current frontend state.

Candidate columns may include, when actually available:

```text
Skill name
Domain
Mastery level
Mastery confidence
XP / next-level progress
parent / relationship summary
```

Do not derive mastery from Knowledge state.

Do not fabricate missing confidence, XP, level or relationship values.

Each row must have a keyboard-operable path to the same Skill inspection/details behavior as the visual graph.

### 5.4 Knowledge table

Only display real Knowledge read-model values.

Candidate columns may include, when actually available:

```text
Knowledge title
Node type
Domain
Authority state
Epistemic confidence
Linked Skill name if real
connection count
```

Knowledge table rows must not present Skill Mastery/XP as Knowledge properties.

If linked Skill information is shown, preserve the existing isolated read-only Skill semantics.

Each row must have a keyboard-operable path to the same Knowledge inspection/details behavior as the canvas/list interaction.

### 5.5 Relation accessibility

The table/list alternative must provide a usable way to understand graph relationships without relying on line color, line shape, or spatial position alone.

For Knowledge relations, preserve the frozen five-relation ontology and authority semantics.

`contradicts` and `relates_to` remain symmetric/non-directional semantically.

Do not convert accessibility labels into new domain truth.

---

## Step 6 — Screen-reader state clarity

Ensure state is not communicated by color alone.

Examples requiring textual/programmatic state:

```text
selected / active
verified / inferred / rejected / superseded / archived
mastery level
confidence type and value
quest status
artifact status
loading
empty
error
unavailable
```

Do not use `aria-live` broadly. Use it only for meaningful asynchronous status that a screen-reader user would otherwise miss.

Avoid duplicate announcements from visible text plus redundant aria labels.

---

## Step 7 — Preserve touch-target and existing visual governance

Round 2 will perform full responsive stress testing, but Round 1 must not regress existing touch-target governance.

Maintain:

```text
var(--touch-target-min)
```

for current page-local controls already governed by that token.

Also preserve:

```text
no raw hex in modernized production UI
no raw numeric z-index
no unreviewed gradients/neon styling
no custom page-specific modal/drawer
no direct gold misuse
```

Do not redesign pages as part of accessibility work.

---

# 8. Required automated regression coverage

Round 1 must add tests that directly exercise the new behavior rather than relying solely on source-string scans.

At minimum cover:

## 8.1 Route semantics

Representative rendered tests for the main routes should verify meaningful landmarks/headings and accessible names for key controls.

Do not force identical DOM structure across pages where semantics legitimately differ.

## 8.2 Keyboard activation

Test representative real controls/components for:

```text
Tab reachability where test environment supports it
Enter activation
Space activation
Space prevents unintended scroll for button-like cards
Escape containment for nested modal/drawer flows
```

## 8.3 Skill graph keyboard traversal

Directly test the real graph-node navigation helper/component behavior:

```text
connected candidate chosen deterministically
unconnected nodes skipped
no-direction candidate leaves focus unchanged
Enter/Space invokes normal selection
```

## 8.4 Knowledge graph keyboard traversal

Same requirements as Skill graph, without altering relation semantics.

## 8.5 URL-backed table views

Directly test:

```text
/skills?view=table
/knowledge?view=table
view toggle URL behavior
reload/initial query interpretation
invalid view fallback
real table roles / headers / rows
row inspection interaction
```

## 8.6 Authority separation regressions

Retain and rerun existing tests proving:

```text
Knowledge authority != Skill mastery
Knowledge confidence != Skill mastery confidence
Linked Skill Summary is read-only
no fabricated M0/XP/confidence fallback
all Knowledge edges static
symmetric Knowledge relations remain non-directional
single InspectorDrawer semantics remain intact
BaseModal behavior remains intact
```

## 8.7 Frozen-path gate

Strengthen/retain a gate proving Round 1 does not modify forbidden paths relative to the actual branch base.

The gate must cover at least:

```text
src/app/api/**
src/lib/**
supabase/**
src/proxy.ts
src/styles/design-tokens.css
package.json
pnpm-lock.yaml
```

If shared `src/components/ui/**` or `src/components/layout/**` changes are made, they must be explicitly visible in the completion report rather than hidden by the gate.

---

# 9. Manual verification matrix

Automated tests do not prove the entire accessibility experience. Before requesting independent review, perform and report a manual keyboard pass at minimum.

Use these viewport widths where practical while performing the Round 1 keyboard pass:

```text
375px
768px
1024px
1440px
```

Round 2 will own exhaustive responsive stress testing, so Round 1 only records obvious layout blockers encountered during keyboard use.

For every primary route, manually verify:

```text
Can reach all primary controls by keyboard
Visible focus is not clipped
No focus enters hidden UI
No unexpected keyboard trap
Modal focus remains contained
Escape closes only the expected surface
Drawer/modal trigger focus behavior remains coherent
Graph/table toggle is keyboard operable
Table mode remains useful without canvas interaction
```

### Assistive-technology boundary

If VoiceOver/NVDA/JAWS or physical touch-device testing is not available in the execution environment, do not claim it was performed.

Report it explicitly as an unverified boundary.

---

# 10. Required quality gates

Before pushing the PR, run:

```bash
pnpm test
pnpm harness:deterministic
pnpm lint
pnpm tsc --noEmit
pnpm build
```

All must pass.

Then push the branch and obtain a PR-triggered GitHub Actions run for the **new Exact Head SHA**.

Required remote jobs:

```text
check: SUCCESS
supabase-integration: SUCCESS
```

Reporting rules:

- never reuse CI from Phase 6;
- never cite CI from an older Phase 7 head as evidence for a newer head;
- local DB/E2E skips remain skips;
- only report DB-backed tests/E2E as passed when the Supabase integration job actually executes them;
- report exact test counts from the new run rather than copying historical counts.

---

# 11. Independent-review acceptance matrix

Round 1 is eligible for `GO` only if every required gate passes.

| Gate | Required state |
| --- | --- |
| Phase 7 branch created from approved current main | PASS |
| Backend/domain/Supabase drift | 0 |
| Dependency changes | 0 |
| Design-token changes | 0 |
| Core routes have coherent semantic landmarks | PASS |
| Key controls have accessible names | PASS |
| Keyboard-only primary flows | PASS |
| Nested modal/drawer Escape leakage | 0 |
| Modal focus containment | PASS |
| Skill graph keyboard traversal | PASS |
| Knowledge graph keyboard traversal | PASS |
| `/skills?view=table` | PASS |
| `/knowledge?view=table` | PASS |
| Table modes use semantic tables | PASS |
| Graph relation semantics preserved | PASS |
| Knowledge/Skill anti-conflation preserved | PASS |
| Existing touch-target governance not regressed | PASS |
| `pnpm test` | PASS |
| deterministic harness | PASS |
| lint | PASS |
| TypeScript | PASS |
| production build | PASS |
| New Exact Head `check` CI | SUCCESS |
| New Exact Head `supabase-integration` CI | SUCCESS |

Any P0 or P1 finding results in:

```text
NO-GO → NEED_FIX
```

Do not merge without a subsequent independent-review authorization.

---

# 12. Explicit non-goals for Round 1

Do NOT perform these now:

```text
full mobile/tablet/desktop layout redesign
exhaustive overflow correction across every viewport
motion-duration retuning
new animation system
new design tokens
visual refresh of frozen pages
new product features
shop / inventory / achievements / onboarding implementation
backend or database refactor
Phase 7 final freeze
```

Those are either later Phase 7 rounds or separate product roadmap work.

---

# 13. Round 2 handoff boundary

After Round 1 receives independent `GO`, the reviewer will issue the next execution order for:

```text
Phase 7 — Round 2
Responsive Stress Hardening
```

Expected future Round 2 focus includes:

```text
320/375 mobile stress
768 tablet
1024 desktop transition
1440/large desktop
navigation mode transitions
drawer behavior
modal sizing
grid collapse/expansion
horizontal overflow
touch-target audit
graph/table density behavior
```

Do not begin these broad changes during Round 1 unless a defect directly blocks keyboard accessibility.

---

# 14. Required completion report

When Round 1 is complete, return exactly the following structure to the user/review AI:

```text
PHASE 7 — ROUND 1 COMPLETE
→ REQUEST INDEPENDENT REVIEW

Repository: Daylily-Huang/AI-Personal-Growth-RPG
Branch: feature/phase7-a11y-keyboard
PR: #<number>
Frozen Phase 7 code baseline: a40ff9806e3c90d02e298245956c8fe5236e2913
Actual branch-point SHA: <sha>
New Exact Head SHA: <sha>

Changed files:
- <all changed files>

Accessibility inventory:
- P0 found/fixed: <count>
- P1 found/fixed: <count>
- P2 found/fixed: <count>

Round 1 deliverables:
- semantic landmarks/control naming: <PASS/notes>
- keyboard primary flows: <PASS/notes>
- modal/drawer focus & Escape behavior: <PASS/notes>
- Skill graph arrow-key traversal: <PASS>
- Knowledge graph arrow-key traversal: <PASS>
- /skills?view=table: <PASS>
- /knowledge?view=table: <PASS>
- authority/mastery/confidence separation: <PASS>

Shared frozen-component changes:
- <none OR exact files + justification>

Local validation:
- pnpm test: <exact result>
- pnpm harness:deterministic: <exact result>
- pnpm lint: <result>
- pnpm tsc --noEmit: <result>
- pnpm build: <result>

Manual keyboard verification:
- tested routes: <routes>
- tested viewports: <widths>
- unverified AT/device boundaries: <truthful list>

GitHub Actions:
- run id: <id>
- exact head sha: <sha>
- check: <result>
- supabase-integration: <result>
- DB-backed tests: <actual execution result>
- deterministic harness: <actual execution result>
- E2E: <actual execution result>

No merge performed.
No Phase 7 Round 2 work started.
```

---

# 15. Prohibited shortcuts

```text
Do not treat source-string scanning as proof of runtime accessibility.
Do not add aria-labels that merely duplicate or contradict visible text.
Do not fabricate missing data for screen readers.
Do not use positive tabIndex to force an artificial focus order.
Do not make every container focusable.
Do not replace native semantics with ARIA without need.
Do not hide canvas accessibility problems behind aria-hidden without a valid alternative.
Do not call a div grid a table if the requirement is tabular semantics.
Do not modify backend/domain code for a UI accessibility problem.
Do not add dependencies to solve problems already addressable with React/DOM/platform APIs.
Do not weaken existing Phase 5/6 authority separation tests.
Do not count skipped tests as passed.
Do not merge the PR automatically.
Do not start Round 2 before independent review.
```

---

# 16. Execution principle

The goal of Round 1 is not to make the application look different.

The goal is to make the existing application **operable and understandable without relying on a mouse, spatial graph perception, or color-only cues**, while preserving every frozen business and authority invariant.
