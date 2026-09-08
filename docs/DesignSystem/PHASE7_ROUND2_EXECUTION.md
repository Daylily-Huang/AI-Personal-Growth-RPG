# Phase 7 — Round 2 Execution Manual

## Responsive Stress Hardening

**Repository:** Daylily-Huang/AI-Personal-Growth-RPG
**Execution stage:** Phase 7 — Round 2
**Round 2 focus:** Responsive viewport stress hardening, overflow/clipping prevention, drawer/table/graph workspace consistency, and existing touch-target governance
**Authoritative starting main SHA:** 533ab09ebeb8bb827401446f022cf9a83c7db89c
**Phase 7 Round 1 merge commit:** 533ab09ebeb8bb827401446f022cf9a83c7db89c
**Phase 7 Round 1 approved Exact Head:** 9cafc345a074577084cad08bbdbed1789911d8ff
**Phase 7 Round 1 CI:** 34223921283
**Prerequisite:** Phase 7 — Round 1 = **MERGED / COMPLETE**
**Status before execution:** Round 2 code work **NOT STARTED**

---

# 1. Purpose and phase boundary

Phase 7 is the cross-page polish stage for the current visual-system migration. It remains presentation, accessibility, responsive, and interaction hardening only. It does not reopen business/domain authority work.

The complete Phase 7 objective is:

~~~
End-to-End Accessibility
+ Responsive Stress Hardening
+ Reduced-Motion / Interaction Polish
+ Final Cross-Page Regression Audit
~~~

The independently reviewable sequence is:

~~~
Round 1 — Accessibility semantics + keyboard + graph table alternatives   ✅ MERGED / COMPLETE
Round 2 — Responsive stress hardening                                     ← EXECUTE NOW
Round 3 — Motion / reduced-motion polish                                  NOT AUTHORIZED
Round 4 — Final cross-page acceptance audit and Phase 7 freeze             NOT AUTHORIZED
~~~

This manual authorizes **Round 2 only**. Do not begin Round 3 motion work or Round 4 final freeze work. Round 2 must end in its own independently reviewable PR and must not be merged automatically.

---

# 2. Governing documents and evidence rules

Before changing code, read these files in full from the actual current main branch:

~~~
docs/MASTER_PROJECT_HANDOFF.md
docs/DesignSystem/03_GLOBAL_APP_SHELL.md
docs/DesignSystem/04_SHARED_COMPONENT_SYSTEM.md
docs/DesignSystem/05_ENTITY_VISUAL_LANGUAGE.md
docs/DesignSystem/06_MOTION_AND_FEEDBACK.md
docs/DesignSystem/07_RESPONSIVE_AND_ACCESSIBILITY.md
docs/DesignSystem/08_PAGE_MIGRATION_PLAN.md
docs/DesignSystem/09_GLOBAL_VISUAL_ACCEPTANCE_GATES.md
docs/DesignSystem/PHASE7_ROUND1_EXECUTION.md
docs/DesignSystem/PHASE7_ROUND2_EXECUTION.md
~~~

Also inspect the current implementation, tests, package scripts, and CI workflow before choosing a fix:

~~~
src/app/dashboard/**
src/app/quests/**
src/app/skills/**
src/app/knowledge/**
src/app/artifacts/**
src/app/login/**
tests/**
package.json
.github/workflows/ci.yml
~~~

Do not treat a prior completion report, a source-string scan, a CSS class name, or a skipped test as proof of runtime responsive behavior. Report verified facts, manual observations, emulation-only observations, and unavailable device/assistive-technology boundaries separately.

---

# 3. Frozen product and architecture invariants

Round 2 is strictly responsive/presentation hardening. Every implementation must preserve:

~~~
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
~~~

The following Round 1 behavior is frozen and must remain intact:

~~~
/skills?view=table
/knowledge?view=table
semantic table roles, captions, headers, rows, and row inspection paths
deterministic connected-node keyboard traversal
page-owned Skill selected state and aria-pressed synchronization
single InspectorDrawer behavior
BaseModal focus containment and topmost Escape ownership
Knowledge relation direction/symmetry and authority/lifecycle/confidence separation
Knowledge/Skill/XP/Mastery/Confidence semantic separation
~~~

Round 2 must not alter persistence rules, settlement behavior, authority transitions, RLS, API contracts, XP computation, mastery computation, evidence semantics, relation ontology, or read-model ownership.

---

# 4. Baseline, branch, and PR protocol

## 4.1 Required preflight

1. Fetch the latest main before creating or updating the implementation branch.
2. Confirm that main contains the Round 1 merge commit 533ab09ebeb8bb827401446f022cf9a83c7db89c and the approved Round 1 Head 9cafc345a074577084cad08bbdbed1789911d8ff.
3. Record the actual branch-point SHA. If main has advanced, re-read all governing documents and record the new branch point.
4. If unrelated production-code changes have appeared after the Round 1 merge, stop and obtain independent scope confirmation before implementation.

## 4.2 Branch

Create or continue exactly:

~~~
feature/phase7-responsive-stress
~~~

The branch must start from the verified current main. Do not commit Round 2 implementation directly to main or to the already merged feature/phase7-a11y-keyboard branch.

## 4.3 PR policy

Round 2 must use its own PR.

Suggested title:

~~~
feat(responsive): Phase 7 Round 2 responsive stress hardening
~~~

The PR must contain only the authorized Round 2 changes and required direct regression tests. Do not merge automatically. Request independent review only after the new Exact Head CI has completed.

---

# 5. Scope control

## 5.1 Authorized editable paths

Round 2 implementation may modify only page-local responsive behavior in:

~~~
src/app/dashboard/**
src/app/quests/**
src/app/skills/**
src/app/knowledge/**
src/app/artifacts/**
src/app/login/**
tests/**
~~~

The implementation may use existing CSS classes and existing design tokens. It may add page-local layout wrappers or responsive class combinations when required to make the current route fit the documented viewport matrix.

## 5.2 Frozen paths — MUST NOT MODIFY

The following are frozen for this round:

~~~
src/app/api/**
src/lib/**
supabase/**
src/proxy.ts
src/components/**
src/styles/design-tokens.css
package.json
pnpm-lock.yaml
~~~

This includes src/components/layout/** and src/components/ui/**. Shared layout and shared UI are not conditionally editable in Round 2. If a defect cannot be corrected page-locally without changing a shared component, stop and request a new explicit scope authorization; do not silently edit or copy the shared primitive.

## 5.3 Prohibited expansion

Do not add:

~~~
new dependencies
new database migrations
new API routes or API fields
new domain fields or authority states
new XP / mastery / confidence calculations
new design tokens or token values
new modal/drawer systems
new graph/table product features
new navigation destinations
new motion system or motion-duration changes
unrelated Phase 8 or product-roadmap work
~~~

Do not use responsive work as a reason to redesign a frozen page, change copy unrelated to fit, or remove information that should remain available in the table/graph alternative.

---

# 6. Formal Round 2 scope

Round 2 owns responsive stress hardening across the existing user-facing routes and the two existing graph representations. The required viewport stress set is:

~~~
320px   mobile stress edge case
375px   primary mobile target
768px   tablet transition
1024px  desktop transition
1440px  wide desktop target
~~~

The four primary reporting widths are 375 / 768 / 1024 / 1440; 320px is an additional narrow-mobile stress check required by the repository's Round 1 handoff. Do not reinterpret these widths as new breakpoint definitions. Use the existing Tailwind/token breakpoint behavior from the governing documents and record the observed mode at each width.

Round 2 must cover:

~~~
navigation mode transitions
header and workspace fit
responsive grid collapse/expansion
horizontal overflow and clipping
InspectorDrawer presentation and available body space
BaseModal sizing and internal scroll behavior
/skills graph workspace density
/knowledge graph workspace density
/skills?view=table table density and local overflow
/knowledge?view=table table density and local overflow
touch-target governance using var(--touch-target-min)
mobile/tablet interaction consistency
physical touch-device boundary reporting
~~~

Round 2 does not cover motion-duration tuning, new reduced-motion behavior, new animation, or final Phase 7 freeze.

---

# 7. Responsive viewport matrix

Use this matrix as the acceptance baseline. It is derived from 03_GLOBAL_APP_SHELL.md and 07_RESPONSIVE_AND_ACCESSIBILITY.md.

| Target viewport | Shell navigation | Workspace expectation | InspectorDrawer expectation | Modal expectation |
| --- | --- | --- | --- | --- |
| 320px | Base mobile bottom bar | One-column stack; no page-level horizontal overflow | Fullscreen mobile sheet using existing drawer behavior | Fullscreen mobile sheet or existing mobile presentation; content must fit/scroll internally |
| 375px | Base mobile bottom bar | One-column stack; controls and view toggle remain reachable | Fullscreen mobile sheet; close/action controls not clipped | Fullscreen mobile presentation; no viewport clipping |
| 768px | md collapsed icon bar | Two-column/tablet workspace where documented; no accidental overlap | Tablet slide-over using existing drawer token/behavior | Centered card within viewport using existing max-width token |
| 1024px | lg expanded sidebar | Two-to-three-column or canvas workspace | Desktop overlay drawer | Centered card; no horizontal page scroll |
| 1440px | xl expanded sidebar | Three-to-four-column or full canvas workspace | Side-by-side push drawer where existing shell provides it | Wide centered card using existing max-width token |

At every width, verify the actual rendered state rather than asserting that a class name alone proves the behavior.

---

# 8. Required execution workstreams

## 8.1 Shell and navigation transitions

For /dashboard, /quests, /skills, /knowledge, and /artifacts:

- verify the mobile bottom navigation does not cover the last interactive content;
- verify tablet collapsed navigation does not overlap the header or workspace;
- verify desktop and wide navigation widths leave usable workspace width;
- verify the header title, status/progression read models, and primary actions do not clip or collide;
- verify there is one visible navigation mode at a time, with no duplicate mobile/desktop control accidentally exposed;
- preserve existing keyboard reachability and visible focus from Round 1.

For /login, verify the narrow layout keeps the heading, labelled controls, validation/error content, and submit/retry actions within the viewport without clipping.

## 8.2 Workspace layout and overflow

For every route and target viewport:

- the document must not acquire unintended horizontal page scrolling;
- scrollWidth > clientWidth is a blocker unless the overflow is an intentional local graph/table scroll region with a usable boundary;
- long titles, metadata, badges, filters, empty states, errors, and retry actions must wrap or scroll within their owning region;
- no focus ring, button label, close button, or table header may be clipped by an ancestor with hidden overflow;
- grid collapse and expansion must preserve reading order and primary action reachability;
- fixes must not simply hide content with overflow: hidden or crop a control to make a screenshot appear to fit.

Intentional dense-workspace overflow is allowed only inside the owning graph/table region. It must remain discoverable, keyboard reachable, and independent from page-level overflow.

## 8.3 InspectorDrawer behavior

Open the existing InspectorDrawer from representative card, graph-node, graph-table-row, and relation interactions.

Verify at all target widths:

- the expected mobile/tablet/desktop presentation from the shell matrix is used;
- the drawer close control remains reachable and visible;
- drawer content scrolls within the drawer body rather than forcing page-wide overflow;
- long entity titles and status content do not clip the header;
- action/footer content remains reachable at the bottom;
- the Round 1 Escape and focus ownership behavior remains unchanged;
- the drawer does not introduce a second custom overlay or modal system.

Do not modify InspectorDrawer itself in this round. Correct only page-local layout constraints around its existing contract.

## 8.4 BaseModal behavior

Open representative existing modal flows from /quests, /skills, and any other route that already uses BaseModal.

Verify at all target widths:

- the dialog remains within the viewport or has an intentional internal scroll region;
- title, form fields, validation text, and actions are not clipped;
- the existing focus containment and topmost Escape ownership remain intact;
- mobile presentation does not create page-level horizontal overflow;
- no page creates a custom modal backdrop, raw numeric z-index, or duplicate focus system.

Do not change BaseModal itself. If a shared primitive defect is observed, document it as a blocker requiring explicit follow-up authorization.

## 8.5 Graph workspace density

For /skills and /knowledge in normal graph mode:

- the graph region has a usable, non-zero viewport height at each target width;
- graph controls, legend/filter controls, and table toggle remain reachable without clipping;
- the canvas does not force the entire document to scroll horizontally;
- dense nodes/edges remain inside the graph workspace and do not cover shell controls;
- selecting a node still opens the existing InspectorDrawer;
- arrow-key traversal, Enter/Space selection, selected state, and Escape close behavior remain unchanged;
- reduced-motion behavior remains the existing behavior; do not tune it in this round.

For /skills?view=table and /knowledge?view=table:

- the semantic tables remain available after reload/query initialization;
- table headers, rows, relation columns, and row inspection controls remain discoverable;
- wide tables use a local, intentional scroll boundary where needed rather than page-level overflow;
- table controls and row actions remain reachable at mobile and tablet widths;
- no Knowledge row begins presenting Skill Mastery, XP, or Skill confidence as Knowledge state.

## 8.6 Touch-target governance

Audit current page-local interactive controls at narrow and tablet widths, including:

~~~
mobile navigation items
header/menu controls
drawer close and action controls
graph/table view toggle
filters and search clear controls
retry / empty-state actions
pagination or load-more controls
graph node focus targets and canvas controls
table row inspection controls
modal actions
~~~

Requirements:

- preserve the existing var(--touch-target-min) governance;
- do not add a new token or change the token value;
- do not shrink a target below the existing token to make a layout fit;
- do not use invisible padding that causes overlapping interactive hit areas;
- do not claim physical touch success from desktop mouse or keyboard testing;
- if a target cannot meet the existing token page-locally, report the exact route/control/viewport and stop rather than changing shared primitives or tokens.

## 8.7 Mobile/tablet interaction consistency

The same user intent must remain available across base, tablet, and desktop modes:

- navigation reaches the same routes;
- graph/table switching preserves the same query-backed behavior;
- card/node/table-row inspection reaches the same InspectorDrawer path;
- filters/search/empty/error/retry actions remain available;
- modal submit/cancel behavior remains the same;
- no mobile-only replacement silently changes authority, mastery, confidence, XP, or evidence meaning.

## 8.8 Physical touch-device boundary

If a real touch device is unavailable, report that boundary explicitly. Browser viewport emulation, mouse clicks, and keyboard events are not physical touch-device validation. Do not report physical touch as passed unless it was actually performed on a touch-capable device.

---

# 9. Required regression coverage

Tests must directly exercise behavior. Source-string scans alone are insufficient.

Add or strengthen tests only under tests/** and only for Round 2 behavior. At minimum cover:

## 9.1 Responsive route structure

Representative rendered tests must verify that each primary route keeps its page-level semantic structure, primary heading, primary controls, and existing loading/empty/error actions when responsive layout branches are active. Do not force identical markup across routes where the existing semantics legitimately differ.

## 9.2 Viewport-sensitive interaction behavior

Where the implementation uses viewport-aware behavior, test the actual rendered branch or state transition for representative base, tablet, and desktop conditions. Do not treat setting an arbitrary class string as proof of the branch's behavior.

## 9.3 Overflow ownership

Test the DOM ownership of intentional graph/table scroll regions and verify that the page-level container remains the shell owner. A test may inspect the rendered structure and overflow boundary, but a source-string assertion alone is not sufficient.

## 9.4 Drawer and modal regression

Retain direct behavior coverage for:

~~~
drawer opens from graph/table/card interaction
drawer close control remains operable
modal remains topmost for Escape
drawer remains open after modal Escape
second Escape follows existing drawer behavior
focus/selection state is cleared or restored according to existing implementation
~~~

## 9.5 Graph/table preservation

Rerun and preserve direct coverage for:

~~~
/skills?view=table
/knowledge?view=table
invalid view fallback
semantic table roles/headers/rows
relation columns and real endpoints
connected arrow traversal
Enter/Space selection
Skill aria-pressed synchronization
Knowledge authority/lifecycle/confidence separation
~~~

## 9.6 Touch-target governance

Retain or add direct checks that current page-local interactive controls use the existing touch-target token/class contract where the contract is already exposed by the implementation. Do not create a new token or replace a runtime behavior test with a broad grep.

## 9.7 Frozen-path gate

The diff audit must prove zero changes under:

~~~
src/app/api/**
src/lib/**
supabase/**
src/proxy.ts
src/components/**
src/styles/design-tokens.css
package.json
pnpm-lock.yaml
~~~

Any violation is a hard stop. Shared layout/UI changes are not allowed in this Round 2 PR.

---

# 10. Manual verification matrix

Automated tests do not prove actual responsive layout, clipping, scrollbar ownership, or physical touch behavior. Before requesting independent review, perform and report a manual browser pass for:

~~~
/
/login
/dashboard
/quests
/skills
/skills?view=table
/knowledge
/knowledge?view=table
/artifacts
~~~

At minimum inspect these widths:

~~~
320px, 375px, 768px, 1024px, 1440px
~~~

For every route/width combination that is actually tested, record:

~~~
viewport mode observed
page-level horizontal overflow: yes/no
intentional local graph/table overflow: yes/no and owner
visible clipping: yes/no
primary actions reachable: yes/no
focus ring clipped: yes/no/not tested
drawer behavior: observed result
modal behavior: observed result/not applicable
table/graph density: observed result/not applicable
touch-device validation: physical / emulated / unavailable
~~~

The minimum manual checks are:

- navigation mode transition is coherent;
- primary content and actions fit or use an intentional local scroll region;
- no page-level horizontal overflow is introduced;
- long labels and error/empty states remain readable;
- drawer and modal content/actions are reachable;
- graph workspace has usable height and controls are not clipped;
- table view is usable without canvas interaction;
- keyboard focus remains visible and Round 1 keyboard paths still work;
- existing reduced-motion behavior is not regressed;
- touch results are reported truthfully.

Do not claim VoiceOver, NVDA, JAWS, or physical touch-device validation unless those tools/devices were actually used.

---

# 11. Required local and remote quality gates

Before pushing the PR, run all existing project gates in the project-defined environment:

~~~
pnpm test
pnpm test:e2e
pnpm harness:deterministic
pnpm lint
pnpm tsc --noEmit
pnpm build
~~~

All executed gates must pass. Report exact file/test counts. A skipped test remains skipped and must never be reported as passed. If a gate is unavailable, failed, or skipped, report that exact boundary and do not request approval as if it were green.

Then:

1. Push the Round 2 branch.
2. Open or update the Round 2 PR.
3. Wait for a new PR-triggered GitHub Actions run for the new Exact Head SHA.
4. Verify both required jobs:

~~~
check: SUCCESS
supabase-integration: SUCCESS
~~~

The supabase-integration job must be inspected for actual execution of its DB-backed tests, deterministic harness, and E2E steps. Do not infer execution from a green job label when the steps were skipped. Do not reuse CI from Round 1, an earlier Round 2 head, or a synthetic merge head that does not correspond to the reported Exact Head.

---

# 12. Independent-review acceptance matrix

Round 2 is eligible for independent GO only when every applicable gate passes:

| Gate | Required state |
| --- | --- |
| Branch starts from verified current main | PASS |
| Round 1 merged content preserved | PASS |
| Backend/domain/Supabase delta | 0 |
| Shared UI/layout delta | 0 |
| Design-token delta | 0 |
| Dependency delta | 0 |
| 320px narrow-mobile stress | PASS or truthful blocker report |
| 375px mobile target | PASS |
| 768px tablet transition | PASS |
| 1024px desktop transition | PASS |
| 1440px wide desktop target | PASS |
| Navigation mode transitions | PASS |
| Page-level overflow/clipping audit | PASS |
| Intentional graph/table local overflow ownership | PASS |
| InspectorDrawer responsive behavior | PASS |
| BaseModal responsive sizing/scroll | PASS |
| Graph workspace density and usable height | PASS |
| /skills?view=table responsive usability | PASS |
| /knowledge?view=table responsive usability | PASS |
| Existing touch-target token governance | PASS |
| Mobile/tablet interaction consistency | PASS |
| Keyboard/semantic Round 1 regression | PASS |
| pnpm test | PASS |
| pnpm test:e2e | PASS or exact truthful result |
| deterministic harness | PASS |
| lint | PASS |
| TypeScript | PASS |
| production build | PASS |
| new Exact Head check CI | SUCCESS |
| new Exact Head supabase-integration CI | SUCCESS |
| Round 3 motion work absent | PASS |
| Round 4 final-freeze work absent | PASS |

Any P0 or P1 finding results in:

~~~
NO-GO → NEED_FIX
~~~

Do not merge without a subsequent independent-review authorization for the exact reviewed Head.

---

# 13. Required Round 2 completion report

When Round 2 is complete, return exactly this structure to the user/review AI:

~~~
PHASE 7 — ROUND 2 COMPLETE
→ REQUEST INDEPENDENT REVIEW

Repository: Daylily-Huang/AI-Personal-Growth-RPG
Branch: feature/phase7-responsive-stress
PR: #<number>
Phase 6 FINAL FROZEN baseline: 186e5bed71844ba274680b10ab939bc5169e669d
Phase 7 Round 1 merge commit: 533ab09ebeb8bb827401446f022cf9a83c7db89c
Actual branch-point SHA: <sha>
New Exact Head SHA: <sha>

Changed files:
- <all changed files>

Responsive stress matrix:
- 320px: <exact routes/result>
- 375px: <exact routes/result>
- 768px: <exact routes/result>
- 1024px: <exact routes/result>
- 1440px: <exact routes/result>

Round 2 deliverables:
- navigation mode transitions: <PASS/notes>
- workspace grid collapse/expansion: <PASS/notes>
- page-level overflow/clipping: <PASS/notes>
- graph workspace density/usable height: <PASS/notes>
- /skills?view=table responsive usability: <PASS/notes>
- /knowledge?view=table responsive usability: <PASS/notes>
- InspectorDrawer responsive behavior: <PASS/notes>
- BaseModal responsive sizing/scroll: <PASS/notes>
- touch-target governance: <PASS/notes>
- mobile/tablet interaction consistency: <PASS/notes>
- Round 1 keyboard/semantic regression: <PASS/notes>

Shared frozen-component changes:
- none

Local validation:
- pnpm test: <exact result; skipped remain skipped>
- pnpm test:e2e: <exact result; skipped remain skipped>
- pnpm harness:deterministic: <exact result>
- pnpm lint: <result>
- pnpm tsc --noEmit: <result>
- pnpm build: <result>

Manual responsive verification:
- tested routes: <routes>
- tested widths: <widths>
- page-level overflow result: <truthful result>
- intentional local overflow owners: <truthful result>
- unverified browser/device/AT boundaries: <truthful list>

GitHub Actions:
- run id: <id>
- exact head sha: <sha>
- check: <result>
- supabase-integration: <result>
- DB-backed tests: <actual execution result>
- deterministic harness: <actual execution result>
- E2E: <actual execution result>

No merge performed.
No Phase 7 Round 3 work started.
No Phase 7 Round 4 final-freeze work started.
Phase 7 is not FINAL FROZEN.
~~~

---

# 14. Prohibited shortcuts

~~~
Do not treat a screenshot or a source-string scan as proof of responsive behavior.
Do not hide clipping by applying broad overflow:hidden.
Do not let a local table/graph scroll become page-level horizontal overflow.
Do not shrink touch targets below var(--touch-target-min).
Do not change the touch-target token or add a replacement token.
Do not edit shared layout/UI to avoid a page-local investigation.
Do not duplicate InspectorDrawer or BaseModal.
Do not fabricate or remove domain/authority/mastery/confidence/XP values for layout.
Do not alter graph relation semantics or table read models.
Do not add motion, change motion durations, or begin reduced-motion polish.
Do not modify backend/domain/Supabase/API/dependencies/design tokens.
Do not count skipped tests as passed.
Do not reuse an older CI run for a new Exact Head.
Do not merge automatically.
Do not start Round 3 or Round 4.
Do not declare Phase 7 FINAL FROZEN.
~~~

---

# 15. Final execution directive

The goal of Round 2 is not to create a new layout system. The goal is to prove and surgically harden the existing frozen application across documented mobile, tablet, desktop, and wide-desktop constraints while preserving the existing accessibility, graph/table, drawer/modal, and domain-semantic contracts.

Implement only what the verified viewport evidence requires, keep every change page-local, report every unavailable device boundary, and request independent review only for the new Exact Head.
