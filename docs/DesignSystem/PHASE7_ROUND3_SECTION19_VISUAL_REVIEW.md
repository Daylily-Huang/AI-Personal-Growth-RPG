# Phase 7 — Round 3 §19 Browser / Manual Visual Review (Evidence Supplement)

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`
**PR:** #27 (open, unmerged)
**Exact Head reviewed:** `bbb09ec4ae2121599f277a1aa41565ede79dbee7`
**Base (main):** `a8256051319db4ce5eadc7bdf585f197ad1f99f6`
**Review date:** 2026-09-12
**Reviewer role:** execution AI, performing the §19 static visual pass over the existing matrix
**Governing manual:** `docs/DesignSystem/PHASE7_ROUND3_EXECUTION.md` §19.1–§19.5, §21, §23, §26

> This document **adds evidence only**. It does not modify production code, tests, authoritative
> rule documents, or any existing independent-review verdict. No merge was performed. Round 4 was
> not started. Phase 7 is not declared FINAL FROZEN.

---

## 1. Environment precondition (required first step)

| Check | Result |
| --- | --- |
| Files present | 72/72 in `.codex/r3fix/matrix/shots/` |
| Permissions | readable |
| PNG signature + IHDR dims | **72/72 valid**; every file is `(375\|768\|1024\|1440) × 900` |
| Damaged / truncated | 0 |
| `read_image` on a real matrix PNG | **SUCCESS** — image returned and rendered |

**The execution environment can read these images.** An earlier session report that the images were
unreadable is **superseded**: that failure was a model-routing condition (`model "deepseek-flash"
does not declare image input`) and no longer applies.

A first pass was stopped after 22 reads for context-budget reasons. That was an execution-side
shortfall, not an environment limitation, and it has been corrected: **the pass was completed.**

---

## 2. Evidence paths (authoritative; not re-collected)

```
.codex/r3fix/matrix/shots/    72 PNG screenshots  <idx>-<route>__<width>__<preference>.png
.codex/r3fix/matrix/dumps/    72 DOM snapshots
.codex/r3fix/matrix/results.tsv          per-cell index (route,width,pref,http,dom bytes,dom sha256,shot bytes)
.codex/r3fix/matrix/shot-analysis.json   programmatic non-blank / dimension analysis
.codex/r3fix/matrix/edge-precise.json    pixel-level left/right edge measurement
.codex/r3fix/run-matrix.sh               capture script (contains no process-enumeration or kill commands)
```

Preference labels as actually written: `no-preference` and `reduce`.
**No screenshots were re-collected.** One attempted confirmation capture was invalid and was deleted (§11).

---

## 3. Review method

1. **Direct visual pass — 72/72 files opened with `read_image` and inspected.**
2. **Byte-level pass — all 72 files hashed**, giving cross-preference identity per `route × width`
   and exposing intra-matrix duplication (§4).
3. **Cross-evidence** against `results.tsv`, the DOM dumps and `edge-precise.json` for every flagged cell.
4. **Semantic-equivalence judgement** per route × width: title, values, XP, Mastery, authority,
   confidence, status/archive, graph node and edge labels, table rows, loading/empty/error states.

Evidence classes:

- **VERIFIED BY STATIC VISUAL** — the screenshot alone is sufficient.
- **SUPPORTED BY EXISTING RUNTIME EVIDENCE** — not visible in a still frame, established by DOM
  dumps / index / existing automated suites.
- **NOT VERIFIED** — neither establishes it.

---

## 4. Coverage accounting

**72/72 screenshots visually reviewed.**

The matrix contains **57 unique images**; **15 files are byte-identical duplicates** within it
(verified by SHA-256). All 72 files were nonetheless opened, so the stated requirement is met.

Duplication groups (each group is one unique image):

| Copies | Files |
| --- | --- |
| 4 | `001-root@375-normal`, `005-root@375-reduce`, `017-dashboard@375-normal`, `021-dashboard@375-reduce` |
| 4 | `002-root@768-normal`, `006-root@768-reduce`, `018-dashboard@768-normal`, `022-dashboard@768-reduce` |
| 2 | `003-root@1024-normal`, `019-dashboard@1024-normal` |
| 2 | `004-root@1440-normal`, `020-dashboard@1440-normal` |
| 2 | `007-root@1024-reduce`, `023-dashboard@1024-reduce` |
| 2 | `008-root@1440-reduce`, `024-dashboard@1440-reduce` |
| 2 | `026-quests@768-normal`, `030-quests@768-reduce` |
| 2 | `041-skills-table@375-normal`, `045-skills-table@375-reduce` |
| 2 | `042-skills-table@768-normal`, `046-skills-table@768-reduce` |
| 2 | `065-artifacts@375-normal`, `069-artifacts@375-reduce` |
| 2 | `066-artifacts@768-normal`, `070-artifacts@768-reduce` |

Note for acceptance scope: `/` and `/dashboard` render identically (same bytes across all four
widths and both preferences), so the two routes contribute one visual surface each width, not two.

---

## 5. route × width × preference matrix (visual result)

| Route | 375 normal | 375 reduce | 768 normal | 768 reduce | 1024 normal | 1024 reduce | 1440 normal | 1440 reduce |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | clipping | clipping | OK | OK | OK | OK | OK | OK |
| `/login` | clipping | clipping | OK | OK | OK | OK | OK | OK |
| `/dashboard` | clipping | clipping | OK | OK | OK | OK | OK | OK |
| `/quests` | clipping | clipping | OK | OK | OK | OK | OK | OK |
| `/skills` | clipping + **empty graph** | **empty graph** | OK | **empty graph** | OK | **empty graph** | OK | **empty graph** |
| `/skills?view=table` | clipping | clipping | OK | OK | OK | OK | OK | OK |
| `/knowledge` | clipping (control row) | clipping (control row) | OK | OK | OK | OK | OK | OK |
| `/knowledge?view=table` | clipping (control row) | clipping (control row) | OK | OK | OK | OK | OK | OK |
| `/artifacts` | clipping | clipping | OK | OK | OK | OK | OK | OK |

"OK" = rendered correctly, no clipping, preference-equivalent content.
All 72 cells returned HTTP 200 and produced a non-empty render.

---

## 6. §19.3 normal-motion results

| # | Item | Class | Finding |
| --- | --- | --- | --- |
| 1 | Shell transition does not block controls | NOT VERIFIED | Time-series; a still frame cannot show blocking. |
| 2 | Graph recenter / fit restrained | SUPPORTED BY EXISTING RUNTIME EVIDENCE | Normal camera durations are token-governed (250 ms), directly asserted in `tests/phase7-motion-reduced-motion.test.tsx`. Frames show settled viewports only. |
| 3 | Drawer / modal no focus flicker | NOT VERIFIED | Time-series + focus behaviour; no overlay is open in any capture. |
| 4 | Loading feedback understandable | VERIFIED BY STATIC VISUAL | Legible, self-explanatory states: `/quests` empty state with CTA, `/artifacts` error state with `重新尝试`, `/knowledge` empty state with CTA, `/skills` node list. |
| 5 | No animated graph edges | SUPPORTED BY EXISTING RUNTIME EVIDENCE | `toFlowEdges` returns `animated: false` on every relation branch, asserted in the suite. No edge exists in the captured fixture data, so a frame cannot demonstrate this either way. |
| 6 | No page-level horizontal overflow / clipping regression | **FAIL** | Right-edge clipping at 375 px on all nine routes (§8). |
| 7 | Table view readable and operable | VERIFIED BY STATIC VISUAL at 768/1024/1440 | `/skills?view=table` renders all 8 columns (`技能/领域/等级/Mastery/Mastery 置信度/XP/状态/前置关系`) with correct values; `/knowledge?view=table` renders its full control set and empty-state tables. At 375 the tables are clipped. |
| 8 | Layout has no new anomaly at 375/768/1024/1440 | **FAIL** | 375 px clipping; 768/1024/1440 are clean. |

Positive layout findings at ≥768: dashboard hero row (`成长等级` + `任务目标概览`), stat trio
(`ENERGY 70 / FOCUS 70 / MOMENTUM 30`), Quick Log row, sidebar navigation with active-state marker,
header XP meter (`90 / 100 XP`), and the bottom navigation bar all render correctly and consistently
across 768/1024/1440.

---

## 7. §19.4 reduced-motion results

| Requirement | Class | Finding |
| --- | --- | --- |
| Data content unchanged | VERIFIED BY STATIC VISUAL | On every one of the 36 route × width pairs, normal and reduce present the same text and values. |
| XP / Mastery / confidence / authority unchanged | VERIFIED BY STATIC VISUAL | e.g. `/skills@1024`: `LV.1`, `90 / 100 XP`, `M1`/`M2`, `20 XP · 置信 50%`, `40 XP · 置信 50%`, `30 XP · 置信 90%` identical in both. |
| selected / focus semantics not preference-dependent | NOT VERIFIED | No selected or focused element exists in the captured fixtures. |
| No new clipping | **FAIL** | Reduce reproduces the same 375 px clipping as normal. |
| No new horizontal overflow | **FAIL** | Same as above. |
| Loader static fallback reasonable | VERIFIED BY STATIC VISUAL | `/artifacts` (error + retry) and `/knowledge` (empty + CTA) render sensibly under reduce. |
| Graph / table layout has no semantic change | **FAIL for the graph** | `/skills` graph renders an empty canvas under reduce at all four widths (§9). Tables are unaffected. |
| graph camera snaps instantly | SUPPORTED BY EXISTING RUNTIME EVIDENCE | `setCenter`/`fitView` `duration = 0` under reduce is directly asserted in the suite. Not a static-visual claim. |
| loader does not continually spin | SUPPORTED BY EXISTING RUNTIME EVIDENCE | `motion-reduce:animate-none` pairing and the global reset are asserted and present in compiled CSS. A frame cannot show absence of spinning. |
| structural travel eliminated | NOT VERIFIED | Time-series. |
| smooth scrolling disabled | SUPPORTED BY EXISTING RUNTIME EVIDENCE | `scroll-behavior: auto !important` in the global reset; no programmatic smooth-scroll call exists. |
| modal / drawer transition semantics | NOT VERIFIED | No overlay open in any capture. |
| keyboard / focus runtime behaviour | SUPPORTED BY EXISTING RUNTIME EVIDENCE | Asserted in `tests/phase7-round3-evidence.test.tsx` §18.2 and `tests/phase7-a11y-keyboard.test.tsx`. |

---

## 8. edge-precise flagged cells — manual classification

The `≤2 px` flag was treated as a review signal, not a verdict.

| Flagged cell | Classification | Basis |
| --- | --- | --- |
| `root@375` (both) | **B. TRUE CLIPPING** | Stat trio cut at right edge: `ENERGY`, `FOCUS` visible, `MOM…` truncated; `任务目标概览` card shows left border but no right border. |
| `login@375` (both) | **B. TRUE CLIPPING** | `AI Personal Growth RPG` heading, `注册新玩家` tab, card right border, input right edges, primary button and the RLS footer line all cut. |
| `dashboard@375` (both) | **B. TRUE CLIPPING** | Byte-identical to `root@375`; identical truncation. |
| `quests@375` (both) | **B. TRUE CLIPPING** | Stat grid cut (`进行中 · Active` loses its right border; `主线状态 · Main` card cut mid-word); the tab row shows a further clipped chip at the right. |
| `skills@375` (both) | **B. TRUE CLIPPING** + graph issue | Node cards lose their right side (the `学习中` state badge is cut) and the canvas has no right inset; plus the §9 empty-graph defect under reduce. |
| `skills-table@375` (both) | **B. TRUE CLIPPING** | Headers end at `M…`; rows end mid-value (`5…`, `9…`); the `Mastery 置信度 / XP / 状态 / 前置关系` columns lie outside the viewport. |
| `knowledge@375` (both) | **A + B mixed** | Empty-state block and CTA complete and unclipped (A); the control row (`切换列表 / 切换表格 / 0…`) is cut at the right edge (B). |
| `knowledge-table@375` (both) | **B. TRUE CLIPPING** | Same control-row truncation; the table region itself renders as a complete empty state. |
| `artifacts@375` (both) | **B. TRUE CLIPPING** | Action row cut: `刷新` visible, adjacent primary button truncated to a sliver; `成果分类与筛选` panel loses its right border. The error state renders completely. |
| `skills-table@1024` (both) | **A. NORMAL FULL-BLEED / CHROME CONTACT** | Reviewed directly at 1024 and 1440: table fully readable, all 8 columns present, trailing column at the panel edge with no text loss. Flag is a measurement artefact of a full-width panel. |
| `root` / `dashboard` @768/1024/1440; `skills@768`; `artifacts@1024/1440` | **A. NORMAL FULL-BLEED / CHROME CONTACT** | Shell background and full-width panels legitimately reach the viewport edge; no text or control is cut. |

No cell was classified **C. TRUE HORIZONTAL OVERFLOW** as a separate category: the observed symptom
at 375 px is content extending past the visible width and being truncated at the right edge, reported
as clipping above. Whether the document is additionally scrollable cannot be measured from a still
frame (`--hide-scrollbars` was used at capture time) — that specific question is **NOT VERIFIED**.

---

## 9. Blocking finding — `/skills` graph canvas is empty under reduced motion

**Classification: VERIFIED BY STATIC VISUAL.**

| Width | Normal | Reduce |
| --- | --- | --- |
| 375 | 3 skill nodes rendered | **empty canvas** |
| 768 | 3 skill nodes rendered | **empty canvas** |
| 1024 | 3 skill nodes rendered (`SkillNone`, `SkillReqVerif`, `SkillUpgrade` with `LV.1`, `M1`/`M2`, XP, 置信) | **empty canvas** |
| 1440 | 3 skill nodes rendered | **empty canvas** |

The reduced frames still render the page chrome including `技能节点: 3`, so the client-side fetch
succeeded; only the canvas fails to present the nodes. A clipped node fragment is visible near the
lower-left of the canvas, consistent with the viewport transform not being applied.

**INFERENCE (not instrumented):** Round 3 changed this code path —
`resolveGraphCameraDuration()` returns `0` under reduced motion and now feeds both `setCenter` and
`fitView`. A zero-duration fit that does not apply a viewport transform would leave nodes outside the
visible camera, matching the observation.

**Impact:** the manual requires that reduced motion must not change authoritative rendered content.
A reduced-motion user sees none of the route's primary content. The automated §18.7 equivalence suite
cannot detect this, because it mocks React Flow and renders node components in isolation.

**NOT VERIFIED:** reproducibility across a second capture (§11).

---

## 10. normal vs reduce semantic visual equivalence

**VERIFIED VISUAL EQUIVALENCE — all 36 route × width pairs**, with the single exception of the
`/skills` graph noted in §9. In every other pair the rendered title, filter controls, counts,
empty/error copy, CTA buttons, table rows and values are identical.

**Byte-identical PNG pairs (9 route × width pairs)** — strongest possible static equivalence:
`root@375`, `root@768`, `dashboard@375`, `dashboard@768`, `quests@768`, `artifacts@375`,
`artifacts@768`, `skills-table@375`, `skills-table@768`.

**Non-semantic rendering differences observed in the remaining pairs** (not defects): the auth
page's dark background extends to the bottom edge in some reduce captures; `/knowledge@1024` and
`/knowledge-table@1024` differ by a visible scrollbar in the filter panel; minor anti-aliasing.
No text, value, label or control differs in these pairs.

---

## 11. Discarded confirmation attempt (disclosed)

A separate confirmation capture of `/skills` under reduce was attempted to test §9's reproducibility.
It is **invalid and was discarded**:

- The temporary dev server was started detached from a subshell and was reaped before the captures
  ran; the PNGs show Chrome's `ERR_CONNECTION_REFUSED` page (confirmed by opening one).
- A `curl` check had returned HTTP 200 for that port before the captures, so the failure occurred
  between the check and the captures.
- The artefacts were deleted; they are excluded from all counts and support no conclusion.

Consequence: §9 rests on the original matrix cells alone and its **reproducibility is NOT VERIFIED**.

---

## 12. Verification boundary

```
Browser:
  headless Chrome (dedicated --user-data-dir; no other browser process touched)
  Next.js 16.3.1 dev server, webpack mode, port 3124, at Exact Head bbb09ec
Reduced-motion mechanism:
  --force-prefers-reduced-motion
Classification:
  EMULATED — VERIFIED (as an emulation, not as a physical device)
```

Must remain as stated and are **not** converted to PASS:

```
Physical touch device:  NOT VERIFIED
VoiceOver:              NOT VERIFIED
NVDA:                   NOT VERIFIED
JAWS:                   NOT VERIFIED
```

`emulated != physical device`.

---

## 13. Final conclusion

**§19 static visual matrix: NOT PASS.**

1. **Blocking — reduced-motion semantic loss.** `/skills` graph renders an empty canvas under
   `prefers-reduced-motion: reduce` at 375/768/1024/1440 while the page reports `技能节点: 3`.
   Round 3's own subject area (graph camera motion) is implicated. VERIFIED BY STATIC VISUAL;
   reproducibility NOT VERIFIED; root cause INFERENCE.
2. **Blocking — 375 px right-edge clipping** on `/`, `/login`, `/dashboard`, `/quests`, `/skills`,
   `/skills?view=table`, `/knowledge`, `/knowledge?view=table`, `/artifacts`: text, cards, table
   columns and action buttons truncated at the right viewport edge. VERIFIED BY STATIC VISUAL.
3. **Time-series items remain NOT VERIFIED** (shell transition non-blocking, focus-flicker absence,
   drawer/modal transition semantics, structural-travel elimination, selected/focus semantics).
4. Physical device, VoiceOver, NVDA and JAWS remain **NOT VERIFIED**.

Coverage is now complete — **72/72 screenshots visually reviewed** — so the matrix is no longer
limited by coverage; it fails on findings 1 and 2.

Positively verified: rendering and preference-invariance at 768/1024/1440 across all nine routes;
table readability at ≥768; loading/empty/error state legibility; and preference-invariance of
authoritative values (`XP`, Mastery, confidence, counts, labels) on every pair.

**No merge performed. Round 4 not started. Phase 7 not declared FINAL FROZEN.**

This supplement reports evidence only; the verdict for Exact Head
`bbb09ec4ae2121599f277a1aa41565ede79dbee7` belongs to the independent reviewer.
