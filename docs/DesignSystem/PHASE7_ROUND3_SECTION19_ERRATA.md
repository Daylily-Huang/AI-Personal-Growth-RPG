# Errata — §19 Visual Review evidence package

**Date:** 2026-09-12
**Applies to:** `docs/DesignSystem/PHASE7_ROUND3_SECTION19_VISUAL_REVIEW.md` (first published in commit
`336ad1888eca1764e3ce23cda529a9c6e3e865b8` on `evidence/phase7-round3-section19-visual-review`)
**Raised by:** independent re-review
`review/phase7-round3-section19-evidence-rereview-20260912`
(`docs/DesignSystem/PHASE7_ROUND3_SECTION19_EVIDENCE_REREVIEW.md`, commit `961a0878…`), findings P2-01 and P2-02.

Both corrections are applied in this branch only. No production code, test, CI anchor, or review
verdict is touched. The reviewed Exact Head `bbb09ec4ae2121599f277a1aa41565ede79dbee7` is unchanged.

---

## P2-01 — incorrect blanket HTTP-200 claim

**Was:** “All 72 cells returned HTTP 200 and produced a non-empty render.”

**Why it was wrong:** `/` is not served directly. Every `/` cell answers **HTTP 307** with
`Location: /dashboard`, and the captured page is the dashboard surface. `results.tsv` already
records the correct per-cell status; the prose contradicted it.

**Corrected statement:**

> Response status per cell is recorded in `results.tsv`. **Eight cells are HTTP 307, not 200**: all
> eight `/` cells redirect to `/dashboard` (`001`–`008`). Every other route cell is HTTP 200. All 72
> cells produced a non-empty render.

Re-measured at the reviewed head during the follow-up reproduction work:

| Route | Status |
| --- | --- |
| `/` | **307** → `/dashboard` |
| `/login`, `/dashboard`, `/quests`, `/skills`, `/skills?view=table`, `/knowledge`, `/knowledge?view=table`, `/artifacts` | 200 |

**Route-accounting consequence:** `/` remains a mandatory matrix **cell**, but it is not an
independent visual surface — its screenshots are byte-identical to `/dashboard` at the same
width/preference (confirmed again in the follow-up work: `001/005/017/021` share one blob at 375,
and likewise at each wider width).

---

## P2-02 — `/skills@375 normal` matrix row contradicted the detailed finding

**Was:** the summary matrix row read `/skills @375 normal = clipping + empty graph`.

**Why it was wrong:** the detailed §9 finding and every captured normal frame show **three skill
nodes rendered** at all four widths; only the reduced-motion cells are empty. The row conflated the
preference-specific defect with the clipping defect.

**Corrected statement:** `/skills @375 normal = clipping (3 nodes present)`. The full corrected row is:

| Route | 375 normal | 375 reduce | 768 normal | 768 reduce | 1024 normal | 1024 reduce | 1440 normal | 1440 reduce |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/skills` | clipping (3 nodes present) | **empty graph** | OK (3 nodes) | **empty graph** | OK (3 nodes) | **empty graph** | OK (3 nodes) | **empty graph** |

---

## Scope of this errata

- Corrected in place: `docs/DesignSystem/PHASE7_ROUND3_SECTION19_VISUAL_REVIEW.md` (both passages,
  plus an errata pointer at the top of the document).
- The underlying evidence files (`shots/`, `dumps/`, `results.tsv`, `shot-analysis.json`,
  `edge-precise.json`, `gap-analysis.json`, `run-matrix.sh`) are **unchanged**. They were always
  correct; only the prose derived from them was wrong.
- No claim in the §19 report about the two P1 findings is altered by this errata. P1-01 and P1-02
  remain open on their own terms.
