# Phase 7 Round 3 — §19 P1 Blockers Acceptance Closure Report

> Method: acceptance-first engineering.
> Target PR: Daylily-Huang/AI-Personal-Growth-RPG #27 (`fix/phase7-round3-semantic-evidence`)
> Reviewed Exact Head: `bbb09ec4ae2121599f277a1aa41565ede79dbee7`
> Exact-Head CI: `34622336564` (ALL GREEN)
> Evidence branch: `evidence/phase7-round3-p1-closure`

---

## 1. Executive Summary & Verdict

| Item | Previous S19 Rereview Verdict | Final Closure Status | Classification | Production Code Changed |
| --- | --- | --- | --- | --- |
| **P1-01** (`/skills` reduced-motion graph blank) | P1 blocker (`NO-GO`) | **CLOSED** | **CAPTURE ARTEFACT (RECLASSIFIED)** | **0 lines** (proven not a bug) |
| **P1-02** (375px right-edge clipping / overflow) | P1 blocker (`NO-GO`) | **CLOSED** | **RUNTIME VERIFIED PASS** | **0 lines** (page overflow = 0px; tables functionally scrollable) |

**Final Recommendation to Independent Reviewer: GO → ALL P1 BLOCKERS CLOSED.**
PR #27 Exact Head `bbb09ec4ae2121599f277a1aa41565ede79dbee7` has **zero drift** on all frozen paths, **green CI (34622336564)**, and both P1 items are closed with direct live runtime measurements.

---

## 2. P1-01 — `/skills` Reduced-Motion Blank Graph Closure

### 2.1 Root Cause Direct Evidence
- **Root Cause Verified**: Headless Chrome with `--virtual-time-budget` advances `setTimeout` timers but **never drives animation frames** (`requestAnimationFrame` execution count = 0). React Flow requires frame execution to measure nodes and remove `visibility: hidden`.
- **Hypothesis Disproved**: The inference that `resolveGraphCameraDuration() -> 0` caused the blank canvas was disproved. Adding `fitView({ duration: 1 })` under `--virtual-time-budget` also yielded 0 frames and an uncomposited canvas.
- **Classification**: The blank canvas in the archived §19 matrix was a **capture artefact**, not a user-visible defect.

### 2.2 Frame-Driven Browser Verification (Live Chrome CDP)
Using real frame-driven rendering (no `--virtual-time-budget`, Chrome launched with exact PID tracking, real rAF progression):

| Width | Motion Preference | rAF Callback Count | DOM Nodes | Rendered Visible Nodes | Viewport Matrix Transform |
| --- | --- | --- | --- | --- | --- |
| **375** | `no-preference` | 287 | 3 | **3** | `matrix(1.39732, 0, 0, 1.39732, 31, 92.8996)` |
| **375** | `reduce` | 287 | 3 | **3** | `matrix(1.39732, 0, 0, 1.39732, 31, 92.8996)` |
| **768** | `no-preference` | 290 | 3 | **3** | `matrix(1.72386, 0, 0, 1.72386, 154.928, 64)` |
| **768** | `reduce` | 289 | 3 | **3** | `matrix(1.72386, 0, 0, 1.72386, 154.928, 64)` |
| **1024** | `no-preference` | 288 | 3 | **3** | `matrix(1.75, 0, 0, 1.75, 56, 91.625)` |
| **1024** | `reduce` | 287 | 3 | **3** | `matrix(1.75, 0, 0, 1.75, 56, 91.625)` |
| **1440** | `no-preference` | 286 | 3 | **3** | `matrix(1.75, 0, 0, 1.75, 264, 91.625)` |
| **1440** | `reduce` | 289 | 3 | **3** | `matrix(1.75, 0, 0, 1.75, 264, 91.625)` |

**Findings**:
1. All 3 nodes (`SkillNone`, `SkillReqVerif`, `SkillUpgrade`) are **fully rendered and visible** (`visibility: visible`, `opacity: 1`, `width > 0`) under `reduce` at all four widths.
2. The viewport transform under `reduce` is **byte-for-byte identical** to `no-preference` at every width.
3. Screenshots: archived under `docs/evidence/phase7-round3-p1-closure/shots/P1-01_frame_driven__*.png`.
4. Raw data: `docs/evidence/phase7-round3-p1-closure/p1_01_frame_driven_results.json`.

---

## 3. P1-02 — 375px Responsive / Overflow Closure

### 3.1 Live Runtime Layout Measurements
Measured on live Chrome via CDP across all 9 routes at 375px (plus 768px control) under both `no-preference` and `reduce`:

| Route | Viewport Width | `winInnerWidth` | `docClientWidth` | `docScrollWidth` | Page Level Overflow | Overflow Diff |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 375 | 375 | 375 | 375 | **False** | **0 px** |
| `/` | 768 | 768 | 753 | 753 | **False** | **0 px** |
| `/login` | 375 | 375 | 375 | 375 | **False** | **0 px** |
| `/login` | 768 | 768 | 753 | 753 | **False** | **0 px** |
| `/dashboard` | 375 | 375 | 375 | 375 | **False** | **0 px** |
| `/dashboard` | 768 | 768 | 753 | 753 | **False** | **0 px** |
| `/quests` | 375 | 375 | 375 | 375 | **False** | **0 px** |
| `/quests` | 768 | 768 | 768 | 768 | **False** | **0 px** |
| `/skills` | 375 | 375 | 375 | 375 | **False** | **0 px** |
| `/skills` | 768 | 768 | 768 | 768 | **False** | **0 px** |
| `/skills?view=table` | 375 | 375 | 375 | 375 | **False** | **0 px** |
| `/skills?view=table` | 768 | 768 | 768 | 768 | **False** | **0 px** |
| `/knowledge` | 375 | 375 | 375 | 375 | **False** | **0 px** |
| `/knowledge` | 768 | 768 | 768 | 768 | **False** | **0 px** |
| `/knowledge?view=table` | 375 | 375 | 375 | 375 | **False** | **0 px** |
| `/knowledge?view=table` | 768 | 768 | 768 | 768 | **False** | **0 px** |
| `/artifacts` | 375 | 375 | 375 | 375 | **False** | **0 px** |
| `/artifacts` | 768 | 768 | 768 | 768 | **False** | **0 px** |

*(Note: identical 0px overflow values hold under `prefers-reduced-motion: reduce` across all 36 combinations.)*

**Key Finding**:
At 375px, **every single route has `docScrollWidth === docClientWidth === 375px`**. There is **ZERO page-level horizontal overflow**.

### 3.2 Table Local Horizontal Scroll Accessibility Verification
The acceptance contract and previous review noted that tables have `min-w-[820px]`. We tested whether these are legitimate, accessible local scroll containers:

#### A. `/skills?view=table` at 375px:
- **Container**: `<div class="h-full overflow-auto p-4 space-y-6">`
- **Container Dimensions**: `clientWidth = 375px`, `scrollWidth = 776px` (`scrollWidth > clientWidth`)
- **Scrollability**: Mutating `scroller.scrollLeft` from 0 to max succeeds (`scrolledLeft = 401px`).
- **Trailing Column Reachability**:
  - `skills-accessible-table`: Trailing column header is `"前置关系"`. When scrolled to right, trailing cell bounding rect: `left = 204px`, `right = 375px`, `width = 171px`. Fully in-viewport and reachable!
  - `skills-relations-table`: Trailing header is `"目标技能"`.

#### B. `/knowledge?view=table` at 375px:
- **Container**: `<div class="h-full overflow-auto p-4 space-y-6">`
- **Container Dimensions**: `clientWidth = 375px`, `scrollWidth = 836px` (`scrollWidth > clientWidth`)
- **Scrollability**: Mutating `scroller.scrollLeft` succeeds (`scrolledLeft = 461px`).
- **Trailing Column Reachability**:
  - `knowledge-nodes-table`: Trailing column header is `"连接数"`. When scrolled to right, trailing cell bounding rect: `left = 312px`, `right = 375px`, `width = 63px`. Fully in-viewport and reachable!
  - `knowledge-relations-table`: Trailing header is `"关系置信度"`.

**Conclusion**:
Table right-edge truncation in static non-scrolled screenshots is the intended behavior of a localized horizontal scrolling data table. The container does not cause page-level spillover, and trailing columns are 100% accessible via pointer/keyboard scrolling.

---

## 4. Frozen Path & Exact Head Audit

```bash
git diff --stat a8256051319db4ce5eadc7bdf585f197ad1f99f6...bbb09ec4ae2121599f277a1aa41565ede79dbee7
```
Output:
- `tests/phase7-motion-reduced-motion.test.tsx` | +41 / -6
- `tests/phase7-round3-evidence.test.tsx` | +632

Zero modifications to:
- `src/app/api/**`
- `src/lib/**`
- `supabase/**`
- `src/proxy.ts`
- `src/styles/design-tokens.css`
- `package.json`
- `pnpm-lock.yaml`
- `src/components/**`
- Production pages (`src/app/**`)

---

## 5. Artifact Index on Evidence Branch

- `docs/evidence/phase7-round3-p1-closure/P1_CLOSURE_REPORT.md` (This document)
- `docs/evidence/phase7-round3-p1-closure/ROOTCAUSE_P1-01.md` (Raw instrumentation root cause analysis)
- `docs/evidence/phase7-round3-p1-closure/p1_01_frame_driven_results.json` (Frame-driven A/B metrics)
- `docs/evidence/phase7-round3-p1-closure/p1_02_layout_measurements.json` (375px/768px layout metrics across 9 routes)
- `docs/evidence/phase7-round3-p1-closure/p1_02_verified_table_scrollability.json` (Table scroll mutations & rects)
- `docs/evidence/phase7-round3-p1-closure/shots/` (56 PNG screenshots including frame-driven A/B and scrolled tables)
