# Phase 7 — Round 4 Execution Manual

## Final Cross-Page Acceptance Audit & Phase 7 Freeze Candidate

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`  
**Execution stage:** Phase 7 — Round 4  
**Round 4 focus:** final cross-page acceptance, regression closure, evidence consolidation, and Phase 7 freeze candidate preparation  
**Planning branch:** `review/phase7-round4-planning`  
**Authoritative starting baseline:** `0e7591607507b3ac59519ab0dc656a3eed2512c4`  
**Baseline meaning:** merged PR #27; Phase 7 Round 3 `CLOSED / MERGED`; post-merge tree audit `PASS`  
**Round 3 approved Exact Head:** `bbb09ec4ae2121599f277a1aa41565ede79dbee7`  
**Round 3 approved CI anchor:** Run `34622336564`  
**Round 3 final independent closure review:** `review/phase7-round3-p1-closure-final-20260912` @ `a3fd7c3c6e8e07da573ca79a5907e16f8bb056bf`  
**Round 3 P1 closure evidence:** `evidence/phase7-round3-p1-closure` @ `3874cb172b1025afa0eb8a72a55dfbdfcff4bcb7`  
**Known main-push CI governance defect:** Phase 5 merge-base delta guards can fail on `push -> main` when `origin/main == HEAD`; this is not automatically a production regression.  

---

# 0. Executive directive

Round 4 is the **final Phase 7 acceptance round**.

It is **not** a feature-development round, visual-redesign round, architecture-refactor round, dependency-update round, or product-expansion round.

Its job is to answer one question:

> Does the merged Phase 7 product, as a whole, satisfy the frozen visual, responsive, accessibility, keyboard, graph/table-alternative, motion/reduced-motion, focus, overlay, semantic-authority, and regression contracts strongly enough to become a Phase 7 FINAL FROZEN candidate?

The target process is:

```text
AUDIT FIRST
  -> reproduce in a real browser
  -> classify evidence precisely
  -> identify only real defects
  -> apply only minimal proven fixes if required
  -> add regression coverage
  -> rerun full acceptance matrix
  -> obtain exact-head CI
  -> archive evidence separately
  -> submit for independent review
  -> DO NOT self-merge
  -> DO NOT self-declare FINAL FROZEN
```

Round 4 implementation begins only after the entry gate in this manual passes.

The existence of this document does not itself freeze Phase 7.

---

# 1. Hard entry gate — verify the authoritative baseline

Before creating any Round 4 implementation branch, the execution AI MUST independently verify current repository state.

## 1.1 Verify `main`

Expected authoritative baseline:

```text
main = 0e7591607507b3ac59519ab0dc656a3eed2512c4
```

Verify that this commit is the PR #27 merge commit and that its parents are exactly:

```text
Parent 1:
a8256051319db4ce5eadc7bdf585f197ad1f99f6

Parent 2:
bbb09ec4ae2121599f277a1aa41565ede79dbee7
```

Verify PR #27:

```text
state = closed
merged = true
approved merged head = bbb09ec4ae2121599f277a1aa41565ede79dbee7
merge commit = 0e7591607507b3ac59519ab0dc656a3eed2512c4
```

If current `main` is newer than `0e759160...`, do not assume the new commits are harmless.

Classify all later commits before proceeding:

```text
A. docs-only / evidence-only and does not alter Phase 7 authority
B. CI-governance-only and independently understood
C. production/test/dependency/design-token/backend change
```

If category C exists and was not independently reviewed as part of this Round 4 baseline:

```text
STOP
RETURN TO INDEPENDENT REVIEWER
DO NOT START ROUND 4 IMPLEMENTATION
```

## 1.2 Verify Round 3 closure anchors

Confirm these refs still exist and match exactly:

```text
review/phase7-round3-p1-closure-final-20260912
  a3fd7c3c6e8e07da573ca79a5907e16f8bb056bf

evidence/phase7-round3-p1-closure
  3874cb172b1025afa0eb8a72a55dfbdfcff4bcb7
```

Read the final review and closure evidence before Round 4 execution.

Do not reopen P1-01 or P1-02 merely because Round 4 retests them. Reopen only if new reproducible evidence contradicts the closed result.

## 1.3 Re-read current authoritative design/governance documents

Read from CURRENT `main`:

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
docs/DesignSystem/PHASE7_ROUND3_EXECUTION.md
```

Then read this manual from:

```text
review/phase7-round4-planning:docs/DesignSystem/PHASE7_ROUND4_EXECUTION.md
```

---

# 2. Round 4 authorization boundary

Round 4 is authorized to perform:

```text
1. final cross-page acceptance audit
2. real-browser responsive verification
3. keyboard/focus/overlay verification
4. graph + accessible table alternative verification
5. normal/reduced-motion parity verification
6. loading/feedback verification
7. semantic-authority visual parity verification
8. regression testing
9. minimal frontend correction ONLY when a defect is proven
10. final freeze-candidate documentation and evidence packaging
```

Round 4 is NOT authorized to perform:

```text
new product features
new routes
new data models
new API contracts
new database migrations
new dependencies
new animation systems
new design tokens
new navigation destinations
backend cleanup
architecture cleanup
opportunistic refactors
performance rewrites without a measured blocker
new reward/economy/XP/mastery mechanics
Round 5 planning
automatic merge
self-approval of FINAL FROZEN
```

---

# 3. Branch and PR protocol

After Section 1 passes, create exactly:

```text
feature/phase7-round4-final-acceptance
```

from the verified authoritative `main` baseline.

Record:

```text
branch-point SHA
current main SHA
Round 4 Exact Head SHA after every material code/test change
```

Suggested PR title:

```text
chore(phase7): final cross-page acceptance and freeze candidate
```

Rules:

1. Do not commit directly to `main`.
2. Do not append Round 4 code to old Round 3 branches.
3. Do not merge automatically.
4. Do not squash/rewrite previously reviewed Phase 7 history.
5. If production/test code changes after a CI run, that CI run becomes stale for final acceptance.
6. Final acceptance must reference CI whose `head_sha` is exactly the reviewed Round 4 Exact Head.

---

# 4. Frozen authority and product invariants

Phase 7 is visual/UI governance. The following are immutable during Round 4:

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

The final audit must detect visual regressions that blur these meanings.

The frontend must not:

```text
compute or redefine XP authority
compute or redefine Mastery authority
fabricate evidence
fabricate confidence
promote inferred Knowledge to verified authority
change settlement timing
change persistence timing
change relation ontology
change backend validation
change cross-tenant isolation
```

---

# 5. File-scope governance

## 5.1 Default mode: audit-only

Round 4 begins with **zero production modifications**.

Do not pre-emptively clean or refactor code before finding a defect.

## 5.2 Conditionally authorized frontend paths

Only after a defect is reproduced and root cause is established may the execution AI apply a minimal fix under:

```text
src/app/dashboard/**
src/app/quests/**
src/app/skills/**
src/app/knowledge/**
src/app/artifacts/**
src/app/login/**
src/components/layout/**
src/components/ui/**
src/components/quests/**
tests/**
```

A changed shared file must be explicitly justified in the completion report.

## 5.3 Frozen paths

Do not modify:

```text
src/app/api/**
src/lib/**
supabase/**
src/proxy.ts
src/styles/design-tokens.css
package.json
pnpm-lock.yaml
```

If a blocker appears to require any frozen path:

```text
STOP
DOCUMENT ROOT CAUSE
REQUEST INDEPENDENT SCOPE EXPANSION
```

Do not silently broaden scope.

---

# 6. Mandatory route × viewport × motion matrix

Round 4 final browser acceptance MUST cover these routes:

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

Mandatory viewport widths:

```text
375
768
1024
1440
```

Mandatory motion preferences:

```text
prefers-reduced-motion: no-preference
prefers-reduced-motion: reduce
```

This produces a minimum visual/runtime matrix of:

```text
9 routes × 4 widths × 2 preferences = 72 cells
```

For every cell record at minimum:

```text
route
resolved URL
HTTP/route outcome
viewport width/height
motion preference
auth state / fixture identity
page-level scrollWidth/clientWidth
key workspace bounds
console error count
uncaught runtime error count
screenshot path
notes / finding IDs
```

Do not summarize 72 cells as passed unless all 72 were actually executed or an explicitly documented redirect makes a cell non-applicable.

`skipped != passed`.

---

# 7. Real-browser methodology — mandatory

Round 4 acceptance evidence must be produced by a real frame-driven browser path.

## 7.1 Prohibited acceptance shortcut

Do NOT rely on the legacy Round 3 screenshot technique using only:

```text
Chrome --headless=new + --virtual-time-budget
```

for graph final-state acceptance.

Round 3 proved that a tested virtual-time capture path could produce non-representative React Flow compositing even while DOM dumps contained the expected nodes.

For final acceptance, use one of:

```text
Playwright / managed Chromium
Chrome DevTools Protocol with real frame progression
another browser harness that demonstrably drives rAF/compositor frames
```

Record exact browser version and command/harness version.

## 7.2 Screenshot evidence

Screenshots are evidence of pixels, not proof of causation.

When a screenshot appears wrong:

```text
1. inspect DOM
2. inspect computed styles
3. inspect geometry
4. inspect scroll ownership
5. inspect browser console
6. reproduce in frame-driven runtime
7. then classify defect vs capture artefact
```

Do not change production code based on screenshot appearance alone.

---

# 8. Workstream A — Cross-page visual consistency

Audit all mandatory routes against the frozen visual language.

Verify:

```text
one global AppShell
no duplicate page shell
consistent header hierarchy
consistent glass/surface hierarchy
consistent spacing rhythm
consistent focus treatment
consistent card semantics
no ad-hoc neon / cyberpunk drift
no page-specific hardcoded styling authority
no unexpected theme inversion
no new fantasy prop iconography
```

Check that entity semantics remain visually distinguishable:

```text
Domain != Skill
Skill != Knowledge
Level != Mastery
Mastery != Confidence
Knowledge authority != Confidence
Artifact != Evidence
Archived != Verified/Rejected authority state
```

Aesthetic preference differences that do not violate a frozen contract are not automatically defects.

---

# 9. Workstream B — Responsive and overflow acceptance

At all mandatory widths, verify:

```text
no unintended page-level horizontal overflow
no inaccessible controls beyond viewport
no destructive clipping
no content hidden by fixed navigation
no modal/drawer outside usable viewport
no overlapping header/navigation/workspace
no unscrollable long content region
```

For every route record:

```js
window.innerWidth
document.documentElement.clientWidth
document.documentElement.scrollWidth
document.body.clientWidth
document.body.scrollWidth
```

For suspicious containers record:

```text
clientWidth
scrollWidth
scrollLeft
maxScrollLeft
getBoundingClientRect()
computed overflow-x
nearest overflow owner
```

## 9.1 Table views

For:

```text
/skills?view=table
/knowledge?view=table
```

local horizontal scrolling is allowed.

Prove:

```text
page-level overflow remains false
local scroller owns horizontal overflow
scrollLeft can reach max
last header/cells are still present
last header/cells become visible at max scroll
critical controls remain operable
```

Do not report intentional local table overflow as a page overflow defect.

---

# 10. Workstream C — Keyboard, focus, overlay, and semantics

Verify with actual keyboard-event interaction, not source scan alone.

Mandatory checks:

```text
Tab order follows logical layout
focus ring visible on interactive controls
Enter/Space activates expected controls
Escape closes the topmost owned surface
modal focus trap works
focus restores to opener after close
InspectorDrawer does not create duplicate focus regions
drawer/modal semantics do not change under reduced motion
selected graph node state remains synchronized with ARIA state
```

Graph-specific keyboard checks:

```text
Arrow keys traverse connected nodes
Enter/Space selects/inspects focused node
reduced motion does not disable traversal
focus remains visible after camera recenter
```

Semantic landmarks to verify where applicable:

```text
header
nav
main
aside
dialog
status
aria-busy
aria-modal
aria-pressed / selected-state semantics
```

Source inspection may support the finding but may not be called runtime proof.

---

# 11. Workstream D — Graph and table-alternative parity

For `/skills` and `/knowledge`:

Verify canvas and table alternatives represent the same authoritative entities and critical status semantics.

Check at minimum:

```text
entity identity
level/mastery/confidence where applicable
authority/lifecycle labels
relation type
archive visibility policy
selection target
critical status labels
```

Do not require pixel-identical presentation between graph and table.

Require semantic parity.

Graph edges must remain static where the frozen UI expects static edges.

Do not introduce animated edge flows in Round 4.

---

# 12. Workstream E — Motion / reduced-motion regression

Round 3 is closed, but Round 4 must revalidate final integrated behavior.

Under `no-preference`:

```text
motion remains restrained
no animation blocks business actions
no long camera travel
no duplicate transition layers
loading feedback remains understandable
```

Under `reduce`:

```text
graph camera movement is effectively instant
persistent spinner/pulse motion is neutralized where required
structural travel is removed/effectively immediate
smooth scrolling is disabled
keyboard/focus behavior remains identical in meaning
DOM authority/data values remain identical
no clipping/overflow is introduced by reduced-motion CSS
```

For graph final states, use frame-driven capture.

Do not reopen the historical Round 3 capture artefact unless new frame-driven evidence reproduces a real user-visible failure.

---

# 13. Workstream F — Contrast and legibility

The frozen accessibility target is composited contrast, not raw token-to-token contrast.

Verify representative high-risk surfaces:

```text
primary text over glass + atmospheric background
secondary metadata over glass
selected states
focus rings
disabled states
badges over translucent surfaces
modal/drawer text over overlays
graph labels over canvas/background
```

Use computed colors/opacity/background composition where practical.

Targets from the frozen design specification:

```text
Primary text target: >= 7:1
Normal text target: >= 4.5:1
Large text target: >= 3:1
```

If exact automated composited contrast cannot be established for a surface, classify it honestly as `NOT VERIFIED` or provide a bounded manual/static verification. Do not fabricate a numeric ratio.

---

# 14. Workstream G — Loading, error, empty, and pending states

Cross-page final acceptance must include non-happy-path UI states where practical.

Verify:

```text
loading state has accessible meaning
reduced motion does not remove loading semantics
empty states remain actionable when expected
retry/error controls are keyboard accessible
raw SQL/database/internal error text does not leak into UI
pending/verification states are not visually promoted to confirmed authority
```

Do not alter backend error contracts in Round 4.

---

# 15. Assistive technology and physical-device evidence

Use the following exact vocabulary:

```text
SOURCE VERIFIED
UNIT VERIFIED
RUNTIME VERIFIED
STATIC VISUAL VERIFIED
INFERENCE
NOT VERIFIED
```

No substitutes and no invented hybrid categories.

If the environment does not actually provide:

```text
VoiceOver
NVDA
JAWS
physical touch device
```

then report each as:

```text
NOT VERIFIED
```

Do not convert browser emulation into physical-device verification.

Do not convert DOM/source scans into screen-reader verification.

---

# 16. Automated regression and build gates

Before final handoff, run the repository's established gates against the committed Round 4 Exact Head.

Minimum expected commands/gates:

```text
pnpm lint
pnpm test
pnpm build
pnpm harness:deterministic
pnpm test:e2e   # when the repository CI/test environment provides the required DB/runtime
```

Where the established GitHub workflow provisions Supabase, the final CI is the authoritative DB-backed gate.

Do not report a locally skipped DB/E2E suite as passed.

Record exact counts:

```text
files passed
files failed
files skipped
tests passed
tests failed
tests skipped
```

If a new regression test is added, it must fail against the defective behavior and pass after the minimal correction where technically feasible.

---

# 17. Exact-head CI rule

Final Round 4 acceptance requires a GitHub CI run triggered for the Round 4 PR whose:

```text
head_sha == reviewed Round 4 Exact Head
```

A green CI for an older commit is stale after any later production/test modification.

Evidence-only commits on a separate evidence branch do not invalidate the implementation Exact Head.

## 17.1 Known main-push Phase 5 delta-guard defect

The repository currently contains two historical governance tests:

```text
tests/phase5-quests-ui.test.tsx
tests/phase5-skills-ui.test.tsx
```

that compute a merge base against `origin/main` and require a non-empty:

```text
git diff --name-only <mergeBase>...HEAD
```

On `push -> main`, when checkout has `origin/main == HEAD`, this diff is empty and the guards can fail structurally.

Rules:

1. Do not hide or rewrite this fact.
2. Do not call a failing main-push run green.
3. If these are the ONLY failures and raw logs match the known `modifiedFiles.length > 0` condition, classify the failure as the known push-to-main governance incompatibility.
4. Do not automatically attribute the failure to the Round 4 product code.
5. A new unrelated failure is NOT covered by this exception.
6. Fixing the historical guard itself is outside Round 4 unless separately authorized.

PR exact-head CI remains the primary pre-merge acceptance anchor.

---

# 18. Severity model and stop conditions

Use:

```text
P0 — catastrophic authority/security/data integrity/regression
P1 — acceptance-blocking functional/accessibility/responsive/semantic defect
P2 — material quality defect that may or may not block freeze depending on independent review
```

Round 4 cannot become a freeze candidate with any active P0 or P1.

P2 rules:

```text
Execution AI may not self-waive a P2.
Every P2 must be fixed or explicitly presented to the independent reviewer for disposition.
```

Immediate STOP conditions:

```text
backend/domain/Supabase change appears required
new dependency appears required
new design token appears required
current main baseline is not the reviewed baseline and contains unreviewed production drift
security/cross-tenant regression appears
XP/Mastery/Knowledge authority semantics differ from frozen contracts
Round 4 scope would require architecture redesign
```

---

# 19. Evidence archive protocol

Do not bloat the implementation PR with the full screenshot/runtime evidence package unless a small text fixture is directly needed for a regression test.

After the Round 4 Exact Head is stable, create a separate evidence branch:

```text
evidence/phase7-round4-final-acceptance
```

Direct parent MUST be the final Round 4 Exact Head.

Recommended evidence directory:

```text
docs/evidence/phase7-round4-final-acceptance/
```

Archive at minimum:

```text
FINAL_ACCEPTANCE_REPORT.md
matrix/results.json or results.tsv
runtime/layout measurements
keyboard/focus results
graph/table parity results
motion normal/reduce results
browser version + harness metadata
screenshots/
known limitations / NOT VERIFIED matrix
```

Evidence branch must not modify production code or tests.

---

# 20. Freeze-candidate documentation

If and only if:

```text
P0 = 0
P1 = 0
all required gates have been executed
Exact-head PR CI is acceptable
mandatory 72-cell matrix is complete
all evidence gaps are honestly classified
```

then the execution AI may prepare a **Phase 7 FINAL FROZEN candidate report**.

The execution AI MUST NOT write:

```text
PHASE 7 FINAL FROZEN
```

as an authoritative final status.

It may write only:

```text
PHASE 7 FINAL FREEZE CANDIDATE
AWAITING INDEPENDENT REVIEW
```

Final freeze authority belongs to the independent review step after examining the Exact Head, evidence branch, CI, and any merge/post-merge state required by governance.

Do not update `MASTER_PROJECT_HANDOFF.md` to authoritative FINAL FROZEN unless the independent reviewer explicitly authorizes that status.

---

# 21. Required completion report to independent reviewer

Return one closure packet containing exactly these facts.

## 21.1 Repository anchors

```text
1. baseline main SHA
2. Round 4 branch point SHA
3. Round 4 Exact Head SHA
4. PR number and state
5. whether production code changed
6. complete changed-file list
7. frozen-path diff result
```

## 21.2 Acceptance matrix

Provide:

```text
8. 72-cell route × width × motion matrix status
9. browser/harness version
10. authenticated fixture description
11. page-level overflow summary
12. local table-scroller proof
13. graph node/render parity summary
14. keyboard traversal summary
15. modal/drawer focus + Escape + restoration summary
16. normal/reduced-motion parity summary
17. loading/error/empty-state summary
18. contrast/legibility evidence summary
```

## 21.3 Test / CI evidence

Provide:

```text
19. lint result
20. unit/integration test exact counts
21. deterministic harness result
22. production build result
23. E2E exact counts
24. Exact-head GitHub CI run ID
25. CI head SHA
26. every failing/skipped job or test, without hiding skips
27. whether any failure is the known Phase 5 main-push delta-guard issue
```

## 21.4 Evidence classification

Provide a table using ONLY:

```text
SOURCE VERIFIED
UNIT VERIFIED
RUNTIME VERIFIED
STATIC VISUAL VERIFIED
INFERENCE
NOT VERIFIED
```

Explicitly include:

```text
VoiceOver
NVDA
JAWS
physical touch device
```

## 21.5 Final execution-AI state

Provide:

```text
P0 = <n>
P1 = <n>
P2 = <n>

ROUND 4 IMPLEMENTATION: COMPLETE / INCOMPLETE
PHASE 7 FINAL FREEZE CANDIDATE: YES / NO
PHASE 7 FINAL FROZEN: NO — awaiting independent reviewer
MERGE PERFORMED BY EXECUTION AI: NO
```

---

# 22. Quality principle for this round

Round 4 is successful when the independent reviewer mainly verifies already-proven facts rather than discovering reality for the first time.

For every material claim, prefer this closure chain:

```text
Observation
  -> Stable reproduction
  -> Root cause when a defect exists
  -> Minimal correction
  -> Regression test
  -> Runtime verification
  -> Exact-head CI
  -> Evidence archive
  -> Independent review
```

Do not optimize for the appearance of completeness.

Optimize for reproducible acceptance evidence and zero unreviewed authority drift.

---

# 23. Final non-negotiable declarations

During execution, preserve all of the following until an independent reviewer explicitly changes them:

```text
Round 3 = CLOSED / MERGED
Round 4 = authorized only under this manual after entry-gate verification
PRs = never auto-merged by execution AI
Phase 7 = NOT FINAL FROZEN during execution
Frozen backend/domain/Supabase/design-token/dependency paths = unchanged
```

If the Round 4 Exact Head changes after review evidence or CI was collected, regenerate the affected evidence and obtain a new exact-head CI before asking for final freeze review.
