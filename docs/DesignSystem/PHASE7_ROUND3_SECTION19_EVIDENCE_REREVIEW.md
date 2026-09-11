# Phase 7 Round 3 — §19 Evidence Independent Re-review

## 0. Verdict

**NO-GO → NEED_FIX**

Severity summary:

- **P0 = 0**
- **P1 = 2**
- **P2 = 2**

This review is against PR #27 Exact Head:

`bbb09ec4ae2121599f277a1aa41565ede79dbee7`

Base/main:

`a8256051319db4ce5eadc7bdf585f197ad1f99f6`

Evidence branch reviewed independently:

`evidence/phase7-round3-section19-visual-review`

Evidence commit:

`336ad1888eca1764e3ce23cda529a9c6e3e865b8`

Evidence commit parent:

`bbb09ec4ae2121599f277a1aa41565ede79dbee7`

Exact-head CI:

`34622336564`

No PR was merged by this reviewer. No Round 4 work was started. Phase 7 is **not** declared FINAL FROZEN.

---

## 1. Evidence vocabulary used in this review

This document uses four deliberately distinct labels:

- **VERIFIED FACT** — independently established from Git/GitHub metadata, archived DOM/index data, raw CI logs, source, or deterministic content identity.
- **SUPPORTED BY ARCHIVED STATIC EVIDENCE** — the archived screenshots plus derived pixel/index evidence are mutually consistent with the stated visual finding, but this review environment did not obtain a native image-viewer handoff from the GitHub connector for all 72 PNGs.
- **INFERENCE** — plausible causal interpretation not directly instrumented.
- **NOT VERIFIED** — evidence is insufficient for the specific claim.

The distinction is required by `docs/DesignSystem/PHASE7_ROUND3_EXECUTION.md:1048-1055` (`skipped != passed`, `unavailable != passed`, `emulated != physical device`, `source scan != runtime proof`).

Important reviewer limitation: GitHub exposes every PNG byte-for-byte on the evidence branch, including base64 content and content-addressed blob IDs, but the current connector path does not materialize those binaries into this reviewer's native image viewer. Therefore this reviewer does **not** falsely claim an independent human-style 72/72 visual replay. The execution AI's statement that it directly opened 72/72 is instead audited for consistency against the complete 72-file inventory, duplicate identities, `results.tsv`, DOM dumps, `shot-analysis.json`, `edge-precise.json`, and its own disclosed process history.

---

## 2. Evidence branch integrity — PASS

### VERIFIED FACT

The evidence commit is a single child of the reviewed Exact Head:

- evidence head `336ad1888eca1764e3ce23cda529a9c6e3e865b8`
- parent `bbb09ec4ae2121599f277a1aa41565ede79dbee7`

The evidence branch contains the review report and evidence under `docs/**`; it does not modify production code, tests, package metadata, Supabase, API/domain code, shared components, or design tokens.

The CI workflow itself is configured for `push` only on `main` plus `pull_request` (`.github/workflows/ci.yml:1-7`). The evidence branch has no PR, and no PR-triggered workflow run is associated with the evidence commit. This is consistent with the stated intent: archive evidence without changing PR #27's Exact Head or invalidating CI 34622336564.

PR #27 remains:

- state: **OPEN**
- merged: **false**
- head: `bbb09ec4ae2121599f277a1aa41565ede79dbee7`
- base: `a8256051319db4ce5eadc7bdf585f197ad1f99f6`

### Frozen-path drift

Base `a8256051...` → Exact Head `bbb09ec4...` changes only:

- `tests/phase7-motion-reduced-motion.test.tsx`
- `tests/phase7-round3-evidence.test.tsx`

Therefore drift remains zero for:

- `src/app/api/**`
- `src/lib/**`
- `supabase/**`
- `src/proxy.ts`
- `src/styles/design-tokens.css`
- `package.json`
- `pnpm-lock.yaml`
- `src/components/**`

No authority manual or historical review document is modified by PR #27 to manufacture a PASS.

---

## 3. Coverage and duplicate accounting

### 3.1 Matrix inventory — VERIFIED FACT

`docs/evidence/phase7-round3-section19/results.tsv` contains the complete 72-cell matrix:

- 9 route variants
- 4 widths: 375 / 768 / 1024 / 1440
- 2 preferences: `no-preference` / `reduce`
- 72 screenshot files and 72 DOM dumps are present.

The execution report explicitly discloses the earlier process correction at `docs/DesignSystem/PHASE7_ROUND3_SECTION19_VISUAL_REVIEW.md:20-56`: the first visual pass stopped after 22 reads due to context budget, then the pass was resumed and reported as completed 72/72. The invalid later confirmation attempt is separately disclosed and excluded at `...VISUAL_REVIEW.md:226-241`.

There is no evidence in the archive of concealment or substitution. However, whether an AI literally visually attended to every individual PNG is an execution-act claim that cannot be reconstructed from static repository artifacts alone. Accordingly:

- **72 files exist / complete matrix: VERIFIED FACT**
- **22-read pause and later 72/72 completion are explicitly disclosed: VERIFIED FACT**
- **the internal act "each of 72 was visually attended to": NOT independently reconstructible**

This does not erase the visual findings because the raw files and cross-evidence are archived and independently auditable.

### 3.2 57 unique / 15 duplicate files — VERIFIED FACT

The GitHub contents listing for all 72 PNGs provides content-addressed blob IDs. The eleven duplicate groups stated in `...VISUAL_REVIEW.md:57-85` are independently confirmed by identical blob IDs and sizes:

1. `001/005/017/021` share blob `fc35a713...`
2. `002/006/018/022` share `c4f7a60b...`
3. `003/019` share `3fba0620...`
4. `004/020` share `42921086...`
5. `007/023` share `83e4b2fc...`
6. `008/024` share `439c6fe4...`
7. `026/030` share `8674ee4b...`
8. `041/045` share `1fddfbd4...`
9. `042/046` share `bb749a82...`
10. `065/069` share `4669a88f...`
11. `066/070` share `fc3ee997...`

Excess duplicate copies = `3 + 3 + 9 = 15`, hence unique images = `72 - 15 = 57`.

The report says the files were SHA-256 hashed. A separate PNG SHA-256 manifest is not archived in `results.tsv`; nevertheless byte identity of the duplicate groups is independently established by Git's content-addressed blob identity. This is sufficient for duplicate accounting, but not a substitute for an absent SHA-256 manifest if the literal SHA-256 values themselves are later required.

---

## 4. P1-01 — `/skills` reduced-motion graph disappears in the mandatory archived matrix

**Severity: P1 — merge/phase acceptance blocker**

**Status: SUPPORTED BY ARCHIVED STATIC EVIDENCE for the captured failure; stable live reproduction NOT VERIFIED; root cause INFERENCE.**

### Evidence paths

Normal:

- `docs/evidence/phase7-round3-section19/shots/033-skills__375__no-preference.png`
- `.../034-skills__768__no-preference.png`
- `.../035-skills__1024__no-preference.png`
- `.../036-skills__1440__no-preference.png`

Reduced:

- `.../037-skills__375__reduce.png`
- `.../038-skills__768__reduce.png`
- `.../039-skills__1024__reduce.png`
- `.../040-skills__1440__reduce.png`

Cross-evidence:

- `docs/evidence/phase7-round3-section19/shot-analysis.json`
- `docs/evidence/phase7-round3-section19/edge-precise.json:390-470`
- `docs/evidence/phase7-round3-section19/dumps/035-skills__1024__no-preference.html`
- `docs/evidence/phase7-round3-section19/dumps/039-skills__1024__reduce.html`
- execution report `docs/DesignSystem/PHASE7_ROUND3_SECTION19_VISUAL_REVIEW.md:172-225`

### Independently established facts

1. All four normal PNGs and all four reduce PNGs are distinct Git blobs. Reduce screenshots are substantially smaller than their normal partners, consistent with major visible-content loss.
2. `shot-analysis.json` shows a large normal→reduce ink-ratio drop at every width, including approximately:
   - 375: `0.1484 → 0.0761`
   - 768: `0.0798 → 0.0392`
   - 1024: `0.0969 → 0.0549`
   - 1440: `0.0886 → 0.0584`
3. The reduced DOM dump still contains `技能节点：3` and all three React Flow nodes (`SkillNone`, `SkillReqVerif`, `SkillUpgrade`) with XP/Mastery/confidence text.
4. The 1024 normal and reduce DOM dumps contain the same settled React Flow viewport transform (`translate(297.949px, 56px) scale(1.50938)`). This proves that authoritative node data was present in the DOM and weakens any claim that the causal mechanism has already been proven.

Therefore the archived mandatory §19 matrix contains a real **presentation-level normal/reduce discrepancy** while the semantic DOM still has the data. It must not be converted into a PASS merely because unit tests render node components in isolation.

### Manual clauses

`docs/DesignSystem/PHASE7_ROUND3_EXECUTION.md:935-946` requires reduced motion to preserve interaction/semantic behavior and have no new clipping/overflow. The acceptance matrix at `...PHASE7_ROUND3_EXECUTION.md:1107-1158` requires Skill reduced camera motion and reduced-motion semantic equivalence to PASS. `§24` classifies reduced-motion graph/semantic regressions as P1-class blockers.

### Minimal reproduction required for closure

Use a managed dev server at Exact Head, then for each width 375/768/1024/1440 run separate independent Chrome profiles:

- normal: headless Chrome + `--window-size=<w>,900` + Windows screenshot path
- reduced: same plus `--force-prefers-reduced-motion`

Repeat independently at least twice after route settlement. Record screenshot + DOM each time.

### Stable reproducibility

**NOT VERIFIED.** The execution report explicitly states its one secondary confirmation attempt was invalid because the detached dev server was reaped and screenshots became `ERR_CONNECTION_REFUSED` (`...VISUAL_REVIEW.md:226-241`). Those discarded files support no conclusion.

### Root cause

`src/app/skills/components/SkillGraphCanvas.tsx:23-32` makes `resolveGraphCameraDuration(true)` return `0`; lines `132-148` feed the result to `setCenter` and `fitView`.

This code path is relevant, but the statement that zero-duration camera application **causes** the blank captured canvas is **INFERENCE, NOT VERIFIED**. The archived reduce DOM already contains the same final viewport transform as normal, so the causal chain is not established by the present evidence.

### Closure criterion

Either:

1. reproduce the failure reliably, fix the presentation path without changing semantics, and provide a new exact-head matrix/CI; or
2. independently demonstrate that the archived frames were a capture-settlement artifact, with repeated clean reduced captures proving all three nodes visible at all four widths.

Until then this gate is not PASS.

---

## 5. P1-02 — 375px right-edge clipping across the mandatory route matrix

**Severity: P1 — responsive/overflow acceptance blocker**

**Status: SUPPORTED BY ARCHIVED STATIC EVIDENCE and independently corroborated by pixel-edge metrics. Horizontal scrollability remains NOT VERIFIED.**

### Evidence paths

- `docs/DesignSystem/PHASE7_ROUND3_SECTION19_VISUAL_REVIEW.md:116-171`
- `docs/evidence/phase7-round3-section19/edge-precise.json`
- `docs/evidence/phase7-round3-section19/gap-analysis.json`
- all `@375` screenshots in `docs/evidence/phase7-round3-section19/shots/`

The execution report classifies the following 375 cells as true right-edge clipping in both preferences:

- `/`
- `/login`
- `/dashboard`
- `/quests`
- `/skills`
- `/skills?view=table`
- `/knowledge` control row
- `/knowledge?view=table` control row
- `/artifacts`

The descriptions are specific (truncated card borders, headings, buttons, status chips, and table columns), not merely generated from a `rightGap <= 2` heuristic. `edge-precise.json` independently corroborates edge contact at 375 for the flagged surfaces; for example Skills and Skills-table have `lastSig=374/rightGap=0` at 375, while wider layouts recover positive right gaps or present legitimate full-width panel contact.

### Wider widths

The archived metrics and report support no equivalent content-clipping classification at 768/1024/1440.

`skills-table@1024` has `rightGap=0`, but the report's **A — NORMAL FULL-BLEED / CHROME CONTACT** classification is consistent with the surrounding evidence: all eight columns are reported present and the same route at 1440 has a positive right gap. No evidence was found that contradicts the A classification for `skills-table@1024` or `@1440`.

### Important route nuance

`/` rows in `results.tsv:2-9` are HTTP **307**, and the root screenshots are byte-identical to `/dashboard` at corresponding widths/preferences. Thus “nine route cells fail at 375” is correct as a required-route matrix statement, but `/` is not an independent visual surface defect; it is the redirected dashboard surface.

### Horizontal scrollability

**NOT VERIFIED.** Captures used `--hide-scrollbars`; a still frame cannot prove whether off-viewport content remains reachable by horizontal scrolling. The execution report correctly leaves this specific question NOT VERIFIED.

### Manual clauses

`docs/DesignSystem/PHASE7_ROUND3_EXECUTION.md:923-946` explicitly requires no page-level overflow regression in normal motion and no new clipping/overflow under reduced motion. The acceptance matrix at `...PHASE7_ROUND3_EXECUTION.md:1107-1158` requires the Round 2 responsive/overflow regression gate and table routes to PASS. Any P1 means `NO-GO → NEED_FIX`.

### Minimal reproduction required for closure

At 375×900, capture every required route in both preferences with a managed server and independent Chrome profiles. For table routes also test actual horizontal keyboard/pointer/touch-scroll access separately rather than inferring it from hidden-scrollbar screenshots.

### Provenance

Whether every clipping issue was introduced by Round 3 rather than pre-existing is **NOT VERIFIED** here. Provenance does not change the acceptance result: the mandatory Round 3 matrix currently does not establish the required responsive/overflow PASS.

---

## 6. Time-series evidence discipline — PASS

No new P1 was found for “single-frame pretending to prove animation”.

At `docs/DesignSystem/PHASE7_ROUND3_SECTION19_VISUAL_REVIEW.md:116-160` the report explicitly distinguishes:

- shell transition non-blocking — **NOT VERIFIED**
- drawer/modal focus flicker — **NOT VERIFIED**
- selected/focus semantics — **NOT VERIFIED**
- structural travel — **NOT VERIFIED**
- modal/drawer temporal semantics — **NOT VERIFIED**
- graph recenter/fit — **SUPPORTED BY EXISTING RUNTIME EVIDENCE**
- graph edge animation — **SUPPORTED BY EXISTING RUNTIME EVIDENCE**
- keyboard/focus runtime behavior — **SUPPORTED BY EXISTING RUNTIME EVIDENCE**

The report does not promote these temporal properties to static-visual PASS merely from one settled frame.

This handling is consistent with `docs/DesignSystem/PHASE7_ROUND3_EXECUTION.md:923-946` and the evidence rules in §21.

---

## 7. Physical device and assistive technology boundaries — PASS AS DISCLOSURE

At `docs/DesignSystem/PHASE7_ROUND3_SECTION19_VISUAL_REVIEW.md:251-264`:

- headless Chrome + forced reduced-motion is labelled **EMULATED**
- Physical touch device — **NOT VERIFIED**
- VoiceOver — **NOT VERIFIED**
- NVDA — **NOT VERIFIED**
- JAWS — **NOT VERIFIED**

This exactly follows `docs/DesignSystem/PHASE7_ROUND3_EXECUTION.md:948-969`: unavailable device/AT checks must remain NOT VERIFIED, and viewport/browser emulation must not be converted to a physical-device PASS.

---

## 8. Exact-head CI — PASS, with exact skipped accounting

CI Run `34622336564` is associated with Exact Head `bbb09ec4ae2121599f277a1aa41565ede79dbee7`.

Raw job logs independently prove:

### `supabase-integration`

- job conclusion: SUCCESS
- local Supabase stack actually started
- production build actually ran
- database-backed tests actually ran
- deterministic growth-engine harness actually ran
- E2E actually ran
- containers actually stopped/cleaned up

Database-enabled full suite:

- **60/60 files passed**
- **954/954 tests passed**
- **0 skipped**

Deterministic harness:

- **11/11 passed**

E2E:

- **9/9 passed**

### `check`

- **41 files passed / 19 files skipped (60 total)**
- **675 tests passed / 279 tests skipped (954 total)**
- lint/build success

The 19/279 skipped items are not counted as passed. This follows §21's explicit `skipped != passed` rule.

The workflow checkout log also establishes the synthetic merge as:

`Merge bbb09ec4ae2121599f277a1aa41565ede79dbee7 into a8256051319db4ce5eadc7bdf585f197ad1f99f6`

Therefore CI is not the reason for NO-GO.

---

## 9. P2-01 — evidence report incorrectly says all 72 HTTP responses were 200

**Severity: P2 — evidence/report accuracy**

**Status: VERIFIED FACT**

Path:

- `docs/DesignSystem/PHASE7_ROUND3_SECTION19_VISUAL_REVIEW.md:87-115`
- `docs/evidence/phase7-round3-section19/results.tsv:2-9`

The report says:

> All 72 cells returned HTTP 200

But all eight `/` matrix rows in `results.tsv` are HTTP **307**. Their screenshots are byte-identical to `/dashboard`, consistent with redirect behavior.

This does not invalidate the two P1 findings, but the statement should be corrected to distinguish successful captures from HTTP 200 status.

Closure: amend the evidence report wording on an evidence/docs branch; do not alter the reviewed PR Head merely to correct evidence prose.

---

## 10. P2-02 — `/skills@375 normal` matrix row contradicts the detailed §9 finding

**Severity: P2 — evidence/report internal consistency**

**Status: VERIFIED FACT**

Path:

- `docs/DesignSystem/PHASE7_ROUND3_SECTION19_VISUAL_REVIEW.md:87-115`
- same document `:172-225`
- `docs/evidence/phase7-round3-section19/shots/033-skills__375__no-preference.png`
- `shot-analysis.json`

The summary matrix labels `/skills`, 375 normal as:

`clipping + empty graph`

But §9 says normal at **all four widths** renders 3 skill nodes and only reduce is empty. The normal 375 screenshot also has much higher ink than reduce and is a distinct, substantially larger blob.

The detailed §9 statement is the one consistent with the cross-evidence. The summary-table phrase is therefore a documentation error, not an additional product defect.

Closure: correct the summary cell to `clipping` (without `empty graph`) in the evidence document.

---

## 11. Ancillary governance diagnosis — main push CI guard failures

This section is **not** part of the PR #27 acceptance verdict.

The supplied diagnosis is substantially correct but needs one exception recorded.

Runs independently checked:

- `34570545925`
- `34570527142`
- `34384701029`
- `34225832310`
- `34190052185`
- `34182091728`

For the later five runs, both:

- `check / Test`
- `supabase-integration / Run database-backed tests`

fail on the same two merge-base delta guards.

The raw latest logs show failures at:

- `tests/phase5-quests-ui.test.tsx:244-259`
- `tests/phase5-skills-ui.test.tsx:467-482`

Both compute a merge base against `origin/main`, run `git diff --name-only <mergeBase>...HEAD`, then require `modifiedFiles.length > 0`. On a push workflow where checked-out `HEAD == origin/main`, merge base equals HEAD and the three-dot diff is empty by construction. The guard therefore fails even though the main tree itself may be valid.

### Exception

Run `34182091728` is not identical on the Supabase side: its `supabase-integration` job fails earlier at **Start local Supabase stack**; `Run database-backed tests` is skipped and therefore cannot be attributed to the merge-base guard. Its `check / Test` failure still follows the guard pattern.

Conclusion:

- systemic main-push incompatibility of the two delta guards: **VERIFIED FACT**
- statement that all six Supabase jobs failed at DB tests because of those guards: **FALSE for 34182091728**

Governance recommendation: fix these guards separately so they distinguish PR/delta contexts from `push`-to-main validation. Do not fold that repair into this §19 review branch or use it to change the current PR #27 verdict.

---

## 12. Final acceptance decision

The evidence branch successfully removes the previous “evidence unavailable” uncertainty: the complete matrix, DOM dumps, analysis JSON, and execution report are now archived without altering the reviewed Exact Head.

It does **not** convert Round 3 to GO.

Current blockers:

1. **P1-01:** the mandatory archived `/skills` reduced-motion matrix shows primary graph content disappearing at all four widths while node data remains present in DOM. Stable live reproduction is still NOT VERIFIED and zero-duration camera code is only an INFERENCE for root cause.
2. **P1-02:** the mandatory 375px matrix contains broad right-edge clipping and therefore does not satisfy the responsive/overflow acceptance gate. Horizontal scrollability is separately NOT VERIFIED.

Non-blocking evidence corrections:

3. **P2-01:** “all 72 HTTP 200” is false; `/` cells are 307 redirects.
4. **P2-02:** summary table mistakenly marks `/skills@375 normal` as empty although detailed evidence says normal renders 3 nodes.

According to `docs/DesignSystem/PHASE7_ROUND3_EXECUTION.md:1107-1185`, any P0 or P1 finding requires:

**NO-GO → NEED_FIX**

Required next action is a narrowly scoped corrective execution round for the two P1s, followed by new exact-head tests/CI and a replacement §19 browser matrix. Do not merge PR #27 while these blockers remain. Do not start Round 4. Do not declare Phase 7 FINAL FROZEN.
