# Phase 7 Round 3 — P1 Closure Final Independent Review

Date: 2026-09-12

Reviewer role: Independent review AI

## 1. Review scope

This review is limited to the two remaining §19 P1 blockers from the prior independent re-review (`S19_REREVIEW.md`):

- P1-01 — `/skills` reduced-motion graph appeared blank in the original screenshot matrix.
- P1-02 — apparent 375 px clipping / horizontal overflow and table reachability concerns.

This review does **not** merge PR #27, does **not** start Round 4, and does **not** declare Phase 7 `FINAL FROZEN`.

## 2. Anchors independently re-verified

### Target PR

- Repository: `Daylily-Huang/AI-Personal-Growth-RPG`
- PR: `#27`
- PR branch: `fix/phase7-round3-semantic-evidence`
- PR state at review time: **OPEN / UNMERGED**
- Exact Head: `bbb09ec4ae2121599f277a1aa41565ede79dbee7`
- Base SHA: `a8256051319db4ce5eadc7bdf585f197ad1f99f6`

PR #27 still changes exactly two files:

- `tests/phase7-motion-reduced-motion.test.tsx`
- `tests/phase7-round3-evidence.test.tsx`

No production path is modified by PR #27.

### Exact-head CI

- Workflow Run: `34622336564`
- Head SHA: `bbb09ec4ae2121599f277a1aa41565ede79dbee7`
- Conclusion: **success**
- `supabase-integration`: success
- `check`: success

The evidence-only closure commit does not change the PR Exact Head, therefore this exact-head CI remains the relevant CI anchor.

### Closure evidence branch

- Branch: `evidence/phase7-round3-p1-closure`
- Evidence commit: `3874cb172b1025afa0eb8a72a55dfbdfcff4bcb7`
- Direct parent: `bbb09ec4ae2121599f277a1aa41565ede79dbee7`

The compare from Exact Head to the evidence commit contains evidence/documentation additions only. There is no production-code or test-code drift in the closure evidence commit.

Primary evidence reviewed:

- `docs/evidence/phase7-round3-p1-closure/P1_CLOSURE_REPORT.md`
- `docs/evidence/phase7-round3-p1-closure/ROOTCAUSE_P1-01.md`
- `docs/evidence/phase7-round3-p1-closure/p1_01_frame_driven_results.json`
- `docs/evidence/phase7-round3-p1-closure/p1_02_layout_measurements.json`
- `docs/evidence/phase7-round3-p1-closure/p1_02_verified_table_scrollability.json`
- `docs/evidence/phase7-round3-p1-closure/shots/`

The screenshot inventory contains 56 images, matching the archived closure package structure.

---

# 3. P1-01 final review — reduced-motion `/skills` graph

## 3.1 What the original evidence proved

The original §19 matrix contained a real static visual discrepancy:

- normal-preference `/skills`: 3 graph nodes visible;
- reduced-motion `/skills`: graph appeared blank in the archived screenshots.

That observation remains **STATIC VISUAL VERIFIED**. It was correct to block acceptance until runtime causation was investigated.

However, the original screenshot alone did not prove that production reduced-motion logic removed the nodes.

## 3.2 Root-cause experiment now archived

`ROOTCAUSE_P1-01.md` records the Exact Head, Chrome version, environment, command lines, reduced-motion mode and experiment results.

For the original virtual-time capture path, the archived measurements show that, in the tested Chrome 140 headless invocation:

- timers advanced;
- the measured `requestAnimationFrame` callback count was `0`;
- React Flow camera/compositor progression did not behave like the real frame-driven browser path;
- changing the camera duration from `0` to `1` did not restore correct rendering under that same capture path.

This review accepts these results as **RUNTIME VERIFIED for this exact tested capture path**.

Important scope correction: this must **not** be generalized into a universal statement that Chrome `--virtual-time-budget` can never generate animation frames. The verified statement is narrower: the archived command/environment used for this acceptance capture produced a zero-rAF / non-representative rendering path.

## 3.3 Frame-driven A/B evidence

`p1_01_frame_driven_results.json` contains all 8 required cells:

- widths: 375 / 768 / 1024 / 1440;
- preferences: `no-preference` / `reduce`.

Across all 8 cells:

- authoritative graph node count = 3;
- visible node count = 3;
- node identities = `SkillNone`, `SkillReqVerif`, `SkillUpgrade`;
- node computed visibility = `visible`;
- frame progression is present, with approximately 286–290 rAF callbacks;
- normal and reduced-motion viewport matrices match at each width.

Examples:

- 375 px normal/reduce: `matrix(1.39732, 0, 0, 1.39732, 31, 92.8996)`;
- 1024 px normal/reduce: `matrix(1.75, 0, 0, 1.75, 56, 91.625)`.

The P1-01 normal/reduce screenshot files at each corresponding width are also byte-identical Git blobs, providing static corroboration that the frame-driven capture produces the same final visual state for both preferences.

## 3.4 Causation decision

The production source intentionally resolves graph camera duration to `0` for reduced motion, consistent with the Round 3 acceptance contract. The new frame-driven runtime evidence demonstrates that this production behavior renders all 3 nodes correctly at all four mandatory widths.

Therefore the hypothesis:

> `duration: 0` is a production rendering defect causing the reduced-motion graph to be blank

is not supported by the runtime evidence.

The best causal classification is:

- original blank screenshot: **STATIC VISUAL VERIFIED**;
- zero-rAF behavior of the archived legacy capture command: **RUNTIME VERIFIED** for that tested environment;
- real frame-driven 3/3 node rendering under reduced motion: **RUNTIME VERIFIED**;
- attribution of the original discrepancy to the legacy capture path rather than production graph behavior: **INFERENCE**, strongly supported by the paired runtime evidence;
- production reduced-motion graph defect: **NOT VERIFIED** and no longer an acceptance blocker.

### P1-01 final verdict

**CLOSED — PASS**

Disposition:

`CAPTURE ARTEFACT — CLOSED; production code change NOT REQUIRED.`

No production-code modification is authorized or necessary for P1-01.

---

# 4. P1-02 final review — 375 px overflow / clipping / table usability

## 4.1 Page-level overflow measurement

`p1_02_layout_measurements.json` contains 36 runtime measurement rows covering:

- 9 mandatory routes;
- widths 375 and 768;
- both `no-preference` and `reduce`.

Mandatory routes:

- `/`
- `/login`
- `/dashboard`
- `/quests`
- `/skills`
- `/skills?view=table`
- `/knowledge`
- `/knowledge?view=table`
- `/artifacts`

Across all rows:

- `pageLevelOverflow = false`;
- `overflowDiff = 0`;
- `document.documentElement.scrollWidth == document.documentElement.clientWidth`.

At 375 px the document client/scroll width is 375 px for every route/preference cell.

No raw measurement row reports `pageLevelOverflow: true`.

This closes the earlier uncertainty about whether the static screenshots reflected an unintended document-level horizontal overflow.

Classification:

- absence of document-level horizontal overflow at 375/768 in the measured matrix: **RUNTIME VERIFIED**.

## 4.2 Table-local overflow ownership

The two table views intentionally exceed narrow mobile widths and are wrapped in native local overflow containers.

### `/skills?view=table`

At 375 px:

- table min-width class: `min-w-[820px]`;
- overflow owner: `<div class="h-full overflow-auto p-4 space-y-6">`;
- local `clientWidth = 375`;
- local `scrollWidth = 776`;
- maximum horizontal scroll = `401`;
- setting `scrollLeft` to maximum succeeds (`401`);
- after scrolling, trailing header `前置关系` and trailing row cells have right bounds within the 375 px viewport.

### `/knowledge?view=table`

At 375 px:

- table min width = 880 px;
- same class of local `overflow-auto` owner;
- local `clientWidth = 375`;
- local `scrollWidth = 836`;
- maximum horizontal scroll = `461`;
- setting `scrollLeft` to maximum succeeds (`461`);
- after scrolling, trailing header `连接数` and trailing row cells have right bounds within the viewport (approximately `right = 375`).

Both preference modes show the same behavior.

The final `TABLE_initial...` and `TABLE_scrolled_right...` screenshot pairs are distinct Git blobs, which is consistent with the measured change in horizontal scroll position.

## 4.3 Acceptance-contract interpretation

The controlling Round 3 manual explicitly allows table-level horizontal scrolling at 375/768 when compact density would otherwise drop critical columns, provided the table remains usable and critical columns are not lost.

The runtime evidence proves:

- no document-level horizontal overflow;
- overflow is owned by a local table container;
- the local scroller has real horizontal range;
- the maximum scroll position is reachable programmatically;
- trailing critical columns remain present in the DOM and become geometrically visible after horizontal scrolling.

This is sufficient to reject the earlier interpretation that the screenshots proved destructive clipping or inaccessible dropped columns.

### Input-modality scope correction

The closure report uses language suggesting that pointer / keyboard / gesture reachability was verified. The raw decisive dataset reviewed here proves scrollability and final column visibility by runtime `scrollLeft` manipulation; it does **not**, by itself, independently prove a physical touch gesture or an actual keyboard-input event.

Therefore:

- local horizontal scroll structure / range: **RUNTIME VERIFIED**;
- trailing-column visibility after scroll: **RUNTIME VERIFIED**;
- actual physical touch gesture: **NOT VERIFIED**;
- actual keyboard scroll input event: **NOT VERIFIED** unless separately archived;
- physical-device validation: **NOT VERIFIED**.

These unverified input modalities do not keep P1-02 open because the §19 responsive-table gate permits table-local horizontal scrolling and the critical issue under review was destructive page clipping / lost table content. The runtime geometry shows neither condition.

### P1-02 final verdict

**CLOSED — PASS**

No production responsive fix is required on the current evidence.

---

# 5. Evidence-level classification

| Claim | Classification | Independent decision |
|---|---|---|
| PR #27 remains at `bbb09ec...` and is OPEN / UNMERGED | SOURCE VERIFIED | PASS |
| PR #27 changes only two test files | SOURCE VERIFIED | PASS |
| Evidence commit `3874cb1...` is directly based on Exact Head | SOURCE VERIFIED | PASS |
| Evidence commit introduces no production/test drift | SOURCE VERIFIED | PASS |
| Exact-head CI Run `34622336564` is green | SOURCE VERIFIED | PASS |
| Original reduced-motion screenshot showed an empty graph | STATIC VISUAL VERIFIED | Historical observation retained |
| Legacy capture experiment measured rAF = 0 in that tested path | RUNTIME VERIFIED | PASS |
| Frame-driven reduced-motion graph renders 3/3 nodes at all mandatory widths | RUNTIME VERIFIED | PASS |
| Normal/reduce final viewport matrices match per width | RUNTIME VERIFIED | PASS |
| Original P1-01 discrepancy is attributable to capture-path behavior rather than a production graph defect | INFERENCE | Accepted; supported by paired runtime evidence |
| 375/768 mandatory-route matrix has no page-level horizontal overflow | RUNTIME VERIFIED | PASS |
| Skills/knowledge tables own overflow locally and expose a valid horizontal scroll range | RUNTIME VERIFIED | PASS |
| Trailing critical table columns become visible at max local scroll | RUNTIME VERIFIED | PASS |
| Actual keyboard-input scrolling | NOT VERIFIED | Non-blocking for this P1 closure |
| Actual physical touch gesture | NOT VERIFIED | Non-blocking for this P1 closure |
| VoiceOver | NOT VERIFIED | Unchanged |
| NVDA | NOT VERIFIED | Unchanged |
| JAWS | NOT VERIFIED | Unchanged |
| Physical device | NOT VERIFIED | Unchanged |

No evidence is promoted from `NOT VERIFIED` or `INFERENCE` into a stronger category without corresponding runtime/source proof.

---

# 6. Frozen-path and drift decision

Independent comparison of Exact Head → closure evidence commit confirms that the closure branch is evidence-only.

PR #27 itself still modifies only the two known Phase 7 test files.

Production paths remain unchanged for this closure round.

**Frozen-path decision: ZERO DRIFT — PASS.**

Because the PR Exact Head did not change, a new PR CI run is not required solely for the evidence branch.

---

# 7. Updated severity count

Active findings after this review:

- **P0 = 0**
- **P1 = 0**
- **P2 = 0**

P1-01: CLOSED / PASS.

P1-02: CLOSED / PASS.

The previously closed P2-01 and P2-02 remain closed.

---

# 8. Final independent decision

## Round 3 §19 acceptance

**GO**

The prior `NO-GO → NEED_EVIDENCE / THEN FIX IF PROVEN` state is **lifted**.

Both remaining P1 blockers now have sufficient closure evidence, and neither requires a production-code change.

## Governance boundary

This `GO` means the project may proceed to the **next controlled governance step** in its Phase 7 workflow.

It does **not** mean this reviewer has merged PR #27.

At the time of this review:

- PR #27 remains **OPEN / UNMERGED**;
- no merge was performed by this review;
- Round 4 was **not** started by this review;
- Phase 7 was **not** declared `FINAL FROZEN` by this review.

Before any later merge action, the actor performing the merge must re-check that:

1. PR #27 Head is still exactly `bbb09ec4ae2121599f277a1aa41565ede79dbee7`;
2. no new unreviewed commits or changed files have appeared;
3. Exact-Head CI Run `34622336564` remains the valid green CI anchor, or a newer required exact-head run is independently reviewed if the Head changes;
4. repository governance explicitly authorizes the merge.

If the PR Head changes, this final GO must not be blindly reused; the new Head requires renewed exact-head review.

---

# 9. Final status

`P0=0 / P1=0 / P2=0`

`NO-GO LIFTED`

`ROUND 3 §19: GO`

`PR #27: OPEN / UNMERGED`

`PRODUCTION CHANGE REQUIRED FOR P1 CLOSURE: NO`

`ROUND 4 STARTED BY REVIEWER: NO`

`PHASE 7 FINAL FROZEN: NO`
