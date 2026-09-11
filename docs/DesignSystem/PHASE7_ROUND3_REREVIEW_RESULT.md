# Phase 7 — Round 3 Corrective Re-review Result

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`  
**Review target:** PR #27 `test(phase7-r3): close Round 3 P1 semantic-evidence gaps (corrective)`  
**Reviewed Exact Head:** `ff71b73a6055469a0c0091e3fb5a3d0e3adf19f2`  
**Verified base/main:** `a8256051319db4ce5eadc7bdf585f197ad1f99f6`  
**Reviewed CI run:** `34581086465`  
**Review date:** 2026-09-11  
**Reviewer role:** independent review AI  

> This is a fresh review of PR #27. The prior file `docs/DesignSystem/PHASE7_ROUND3_REVIEW_RESULT.md` is used only as a closure checklist for the old findings on head `6b31a72a137b8217af70687af1daacc8c7d0e121`; none of its old verdicts are reused as evidence for this head.

---

## 1. Final verdict

# **NO-GO → NEED_FIX**

PR #27 materially improves the Round 3 evidence suite and closes most of the old corrective checklist. There is no P0 production/authority/security drift. Exact-Head CI is valid and, from raw Actions logs, the database-backed job genuinely ran all 60 files / 949 tests with zero skips.

However, the mandatory §18.7 semantic-equivalence closure is still incomplete under the stricter requirement supplied for this re-review. In particular, the new test can still pass without proving the production Knowledge node's interactive ARIA role/name, does not explicitly prove the Skill derived-state label or graph relation labels in rendered DOM, and normalizes all `clipPath` values rather than only React auto-id-derived references. In addition, the mandatory §19 authenticated browser matrix remains explicitly `NOT VERIFIED`; therefore the §23 GO matrix is not complete.

Under `PHASE7_ROUND3_EXECUTION.md` §23–§24, any remaining P1 means `NO-GO → NEED_FIX`.

No merge was performed by this reviewer. Round 4 remains unauthorized. Phase 7 is not FINAL FROZEN.

---

## 2. Evidence vocabulary

- **VERIFIED FACT** — independently established from PR #27 metadata, the exact compare range, exact-head source files, or raw GitHub Actions job logs.
- **INFERENCE** — a conclusion derived from verified facts and explicitly labelled as such.
- **NOT VERIFIED** — the requested evidence could not be independently reproduced from the available repository/CI/browser surface; it is not counted as PASS.

---

## 3. Exact target integrity

### VERIFIED FACT — PR identity and base/head match

GitHub metadata for PR #27 reports:

```text
state: open
merged: false
base_sha: a8256051319db4ce5eadc7bdf585f197ad1f99f6
head_sha: ff71b73a6055469a0c0091e3fb5a3d0e3adf19f2
changed_files: 2
additions: 667
deletions: 6
```

At re-review time, `main` still resolves to:

```text
a8256051319db4ce5eadc7bdf585f197ad1f99f6
```

Therefore PR #27 is still unmerged and is based on the exact requested `main`.

### VERIFIED FACT — exact compare range

Independent compare:

```text
a8256051319db4ce5eadc7bdf585f197ad1f99f6
...
ff71b73a6055469a0c0091e3fb5a3d0e3adf19f2
```

contains exactly:

```text
tests/phase7-round3-evidence.test.tsx        new, +632/-0
tests/phase7-motion-reduced-motion.test.tsx  modified, +35/-6
```

No production file is changed.

---

## 4. P0 findings

### P0: none

**VERIFIED FACT.** The corrective delta is test-only. There is zero change under:

```text
src/app/api/**
src/lib/**
supabase/**
src/proxy.ts
src/styles/design-tokens.css
package.json
pnpm-lock.yaml
src/components/**
```

No XP/Mastery/Evidence authority, RLS, database schema, API, deterministic growth calculation, service-role handling, dependency, design-token, shared-component, or permanent-state code is changed by PR #27.

**Authority:** `PHASE7_ROUND3_EXECUTION.md` §6.3, §17, §20.1–§20.3, §23–§24; `01_SYSTEM_RULES.md` Rule 1–Rule 7 and higher-order system invariants.

---

## 5. P1 findings

## P1-01 — old P1-01 is only partially closed: §18.7 still does not prove the full required rendered semantic contract

**Primary file:** `tests/phase7-round3-evidence.test.tsx`  
**Relevant lines:** 116–133, 218–224, 243–278, 326–395, 565–617  
**Production references:** `src/app/knowledge/components/KnowledgeNodeView.tsx` lines 53–78; `src/components/ui/RPGCard.tsx` lines 38–87; `src/app/knowledge/components/KnowledgeGraphCanvas.tsx` lines 221–234  
**Severity:** P1 — required Round 3 acceptance evidence can still report PASS without proving the requested production semantics.

### What is genuinely fixed

**VERIFIED FACT.** The corrective suite now imports and renders the real `SkillNodeView` and `KnowledgeNodeView`; it no longer replaces those two semantic node views with `null` in the new evidence suite. This is a substantial correction relative to the old head.

**VERIFIED FACT.** `visibleSemanticFacts()` captures rendered text, descendant attributes, classes, and explicit `[role]` + `aria-label` pairs, then compares independent renders under `no-preference` and `reduce`.

**VERIFIED FACT.** The allowed motion-class filter itself is narrow and matches the requested class families:

```text
motion-reduce:*
motion-safe:*
animate-*
transition-*
duration-*
ease-*
delay-*
```

### Remaining defect A — Knowledge ARIA role/name test does not exercise the production interactive state

At `tests/phase7-round3-evidence.test.tsx` lines 116–133, the default `knowledgeData()` fixture does **not** provide `onSelect` or `onNavigate`.

At `src/app/knowledge/components/KnowledgeNodeView.tsx` lines 53–78, `KnowledgeNodeView` only passes an `onClick` to `RPGCard` when `data.onSelect` exists:

```tsx
onClick={data.onSelect ? (...) : undefined}
```

At `src/components/ui/RPGCard.tsx` lines 47–87, role ownership is conditional:

```tsx
const isActionable = Boolean(onClick) && interactive !== false;
...
role={isActionable ? "button" : undefined}
tabIndex={isActionable ? 0 : undefined}
```

By contrast, the real Knowledge canvas enriches production node data with `onSelect` and `onNavigate` before passing it into React Flow (`KnowledgeGraphCanvas.tsx` lines 221–234).

Therefore the corrective §18.7 Knowledge fixture renders a **non-actionable** RPGCard. `visibleSemanticFacts().roles` can be an empty array for Knowledge in both preference modes, and:

```tsx
expect(reduced.roles).toEqual(normal.roles)
```

still passes.

#### Minimal reproduction

1. Keep the current corrective test fixture unchanged (no `onSelect`).
2. Break or remove the production interactive `role="button"` path in `RPGCard` / Knowledge node integration.
3. The §18.7 Knowledge test still compares `[]` to `[]` for `[role]` entries and may pass.
4. Production keyboard/read-model semantics are no longer proven by this test.

This does not mean production is currently broken; it means the required test is still structurally unable to prove the requested production ARIA role/name contract.

### Remaining defect B — required vocabulary is not explicitly present-tested in rendered DOM

At `tests/phase7-round3-evidence.test.tsx` lines 326–343, the Skill test explicitly presence-checks:

```text
name
level (as String(data.level))
XP
Mastery label
mastery confidence
```

but it does **not** explicitly assert the derived-state label, despite the test title saying `state`.

The current default fixture uses:

```text
derivedState: "proficient"
```

but there is no rendered assertion equivalent to:

```tsx
expect(text).toContain(getSkillStateVisual(data.derivedState).label)
```

A semantic snapshot equality test only proves that both preferences render the same thing; it does not prove that the required fact is present at all.

Likewise, relation labels are not tested as rendered DOM under §18.7. They are checked later only as mapped `Edge.label` values at lines 565–617 in the §20.4 mapping test. That is appropriate for static-edge mapping, but it is not the requested rendered-DOM proof of relation labels.

#### Minimal reproduction

- Remove the visible derived-state label from `SkillNodeView` in both preferences while retaining level/XP/Mastery/confidence. The current explicit presence assertions can still pass, and semantic equality still passes because both renders are equally incomplete.
- Keep `toFlowEdges().label` correct but fail to surface an edge label in the actual rendered graph. The §20.4 mapping assertions still pass because they never render the relation label DOM.

The re-review request explicitly requires rendered DOM coverage for:

```text
Mastery label
XP value
derived state
level
mastery confidence
Knowledge authority labels, including [AI PROPOSED n%] and [ARCHIVED]
archive lifecycle
relation labels
```

Current coverage is strong for Mastery/XP/level/confidence and Knowledge authority/archive labels, but incomplete for derived-state and rendered relation labels.

### Remaining defect C — `clipPath` normalization is broader than the authorized exception

At `tests/phase7-round3-evidence.test.tsx` lines 218–224:

```tsx
function stableAttributeValue(name: string, value: string): string {
  if (name === "clippath" || name === "clip-path") return "[clipPath]";
  ...
}
```

The allowed exception in this re-review is narrower: normalize React auto IDs matching `_r_*_` **and references derived from those IDs**.

The implementation normalizes **every** `clipPath` / `clip-path` value, even a stable semantic reference unrelated to React `useId()`.

The current `MasteryBadge` does use `React.useId()` for its half-diamond clip path, so an auto-id-derived normalization is justified. The implementation should therefore normalize the `_r_*_` substring inside the reference rather than discard the entire `clipPath` value.

#### Minimal reproduction

Suppose two independent preference renders produce:

```text
no-preference: clip-path="url(#semantic-mask-A)"
reduce:        clip-path="url(#semantic-mask-B)"
```

where neither value is React auto-generated. The current helper converts both to:

```text
[clipPath]
```

and hides the difference.

This is precisely a standard-lowering path: the normalization scope is wider than the documented/legal independent-render difference.

### Classification

**VERIFIED FACT:** the new suite is much deeper than the old prop snapshot and the 15-test file passes in exact-head CI.  
**VERIFIED FACT:** the three structural gaps above remain in the test design.  
**INFERENCE:** because §18.7 is a mandatory acceptance test and the requested proof remains bypassable, old P1-01 is **not fully closed**.

**Manual basis:** §18 opening rule, §18.2, §18.3, §18.7, §21, §23, §24, §26.

---

## P1-02 — mandatory §19 browser/manual acceptance matrix remains NOT VERIFIED

**Governing file:** `docs/DesignSystem/PHASE7_ROUND3_EXECUTION.md` lines 856–967 (manual verification matrix) and §23 acceptance matrix  
**Evidence location:** PR #27 completion description explicitly reports the authenticated 375/768/1024/1440 matrix, physical device, VoiceOver, NVDA and JAWS as `NOT VERIFIED`  
**Severity:** P1 acceptance-evidence blocker; this is not a production-code defect.

### VERIFIED FACT

The execution manual says:

```text
Manual verification must cover BOTH motion preferences.
```

and requires the listed routes at widths:

```text
375
768
1024
1440
```

It separately requires honest reporting for physical device and AT boundaries. §23 says Round 3 is eligible for GO only when every applicable gate passes.

### VERIFIED FACT

PR #27 does **not** falsely claim the unavailable checks as PASS. The execution side correctly labels the authenticated viewport matrix and physical-device/AT checks as `NOT VERIFIED`.

This satisfies the honesty rule:

```text
unavailable != passed
emulated != physical device
```

but it does not convert a mandatory unperformed matrix into PASS.

### Minimal reproduction / evidence gap

There is no independently reviewable artifact in this PR/CI proving the required authenticated route matrix at 375/768/1024/1440 under both `no-preference` and `reduce`. CI is unit/integration/build coverage; it does not execute the §19 viewport/browser matrix.

The prior corrective acceptance checklist also required the §19 matrix before a GO re-review.

### Classification

**NOT VERIFIED:** authenticated route matrix across the four required widths and both preferences.  
**NOT VERIFIED:** physical touch device.  
**NOT VERIFIED:** VoiceOver.  
**NOT VERIFIED:** NVDA.  
**NOT VERIFIED:** JAWS.

The physical-device/AT items may legitimately remain `NOT VERIFIED` if unavailable, as the manual explicitly allows honest reporting. The required browser/emulation matrix itself, however, is stated as mandatory and remains incomplete.

**Manual basis:** §19.1–§19.5, §21, §23, §25, §26.

---

## 6. Old finding closure matrix

| Prior item | Re-review result | Evidence |
| --- | --- | --- |
| P1-01 — rendered §18.7 semantic equivalence | **PARTIAL / NOT CLOSED** | real node views now render, but production Knowledge role/name, explicit derived-state DOM, rendered relation-label DOM, and legal normalization boundary remain incomplete |
| P1-02 — six-route loading motion behavior | **CLOSED** | six real pages are rendered at runtime; source scan is supplementary and expanded across all six route roots |
| P1-03 — merge-before-review governance | **CLOSED FOR PR #27** | PR #27 remains open/unmerged; current main is still its exact base |
| P2-01 — exhaustive static edge coverage | **CLOSED** | all required Skills and Knowledge relation mappings are asserted `animated === false` with expected labels |

---

## 7. Detailed verification of old P1-02 (§18.4)

**Files:**

- `tests/phase7-round3-evidence.test.tsx` lines 470–563
- `tests/phase7-motion-reduced-motion.test.tsx` lines 322–374

### VERIFIED FACT — runtime page rendering now exists for all six routes

The corrective suite renders actual page components for:

```text
/login
/dashboard
/quests
/skills
/knowledge
/artifacts
```

It holds network/Supabase operations pending so loading branches stay mounted and observable.

Verified examples:

- `/login`: real form interaction enters `loading=true`, button becomes disabled and receives the loading accessible name; spinner contains both `animate-spin` and `motion-reduce:animate-none`.
- `/dashboard`: asserts `role=status`, `aria-busy=true`, accessible label and pulse pairing.
- `/quests`: asserts `role=status`, `aria-busy=true`, accessible label and pulse pairing.
- `/skills`: asserts `role=status`, `aria-busy=true`, accessible label/text and animation pairing.
- `/knowledge`: asserts real loading indicator + loading text + animation pairing.
- `/artifacts`: asserts real list loading state + text + animation pairing.

The generic runtime helper fails if an element containing `animate-*` lacks any `motion-reduce:*` counterpart.

### VERIFIED FACT — the old source scan is now supplementary

`tests/phase7-motion-reduced-motion.test.tsx` explicitly labels the source scan as supplementary governance evidence and recursively scans all `.tsx` files under the six route roots, requiring `motion-reduce:animate-none` count to be at least the local `animate-spin|animate-pulse` count.

This resolves the old defect where only `/login` and `/artifacts` were source-scanned and no six-route behavior proof existed.

### Caveat, non-blocking relative to old P1-02

The `/knowledge` and `/artifacts` runtime assertions primarily prove text + loader existence + motion pairing rather than asserting the same `role=status` / `aria-busy` tuple used by Dashboard/Quests/Skills. PR #27 does not change those production loading semantics, so there is no corrective regression. If a future accessibility phase wants every loading surface standardized to an identical status pattern, that is a separate production change and not justified inside this test-only corrective PR.

**Result:** old P1-02 **CLOSED**.

---

## 8. Detailed verification of §18.2 keyboard + selection

**File:** `tests/phase7-round3-evidence.test.tsx` lines 411–468

### VERIFIED FACT — PASS

Under `prefers-reduced-motion: reduce`:

```text
ArrowRight -> onNavigate("skill-a", "right")
Enter      -> onSelect("skill-a")
Space      -> onSelect("skill-a")
```

The selected-state test also proves:

1. selected rendering is semantically equal between normal and reduced preferences;
2. selected remains distinct from unselected;
3. the exact selection utility token `ring-2` exists only on selected;
4. the assertion does not confuse it with the always-present `focus-visible:ring-2` token.

This directly closes the requested §18.2 corrective requirement.

---

## 9. Detailed verification of old P2-01 / §20.4 static edges

**File:** `tests/phase7-round3-evidence.test.tsx` lines 565–617

### VERIFIED FACT — PASS

Skills coverage now includes every requested mapping branch:

```text
prerequisite
contains
supports
unknown/default
```

For every mapped edge:

```text
animated === false
label === getRelationVisual(relation).label
```

Knowledge coverage now includes:

```text
prerequisite
contains
supports
contradicts
relates_to
```

For every mapped edge:

```text
animated === false
label === getEdgeVisual(...).label
```

This fully closes the old P2-01 mapping breadth gap.

Important distinction: this §20.4 mapping coverage does **not** substitute for the missing §18.7 rendered-DOM relation-label assertion described in P1-01.

---

## 10. Frozen-path / shortcut audit

### VERIFIED FACT — frozen paths all zero

Exact compare contains only the two `tests/**` files.

Therefore:

```text
src/app/api/**                 0
src/lib/**                     0
supabase/**                    0
src/proxy.ts                   0
src/styles/design-tokens.css   0
package.json                   0
pnpm-lock.yaml                 0
src/components/**              0
```

### VERIFIED FACT — no authority-document modification to manufacture PASS

No file under `docs/Design ChatGPT/**`, `docs/DesignSystem/**`, or `docs/MASTER_PROJECT_HANDOFF.md` is changed by PR #27.

The prior review result is also not modified by PR #27.

### VERIFIED FACT — no Round 4 / final-freeze work

No Round 4 file or production change appears in the exact delta. PR #27 remains a Round 3 corrective test-only PR and does not declare Phase 7 FINAL FROZEN.

### VERIFIED FACT — no prohibited dependency/token/backend shortcut

No dependency, lockfile, design token, API/domain, Supabase, shared-component or production-motion change exists.

**Manual basis:** §6, §20, §23, §26.

---

## 11. Exact-Head CI and raw-log audit

### 11.1 Run identity

**VERIFIED FACT.** Commit `ff71b73a6055469a0c0091e3fb5a3d0e3adf19f2` is associated with CI run:

```text
34581086465
```

Run conclusion:

```text
success
```

Jobs:

```text
check                SUCCESS
supabase-integration SUCCESS
```

### 11.2 Synthetic merge parent verification

Both jobs checked out GitHub synthetic merge commit:

```text
6d9d33b6b4f1ec1fc1a0bdbb4dee6145c9ba4571
```

Raw log states exactly:

```text
Merge ff71b73a6055469a0c0091e3fb5a3d0e3adf19f2 into a8256051319db4ce5eadc7bdf585f197ad1f99f6
```

This satisfies §22's synthetic-merge parent requirement.

### 11.3 `check` job — skipped is not passed

**VERIFIED FACT from raw job log** (`job 103204546284`):

```text
Test Files  41 passed | 19 skipped (60)
Tests       670 passed | 279 skipped (949)
```

Therefore the ordinary `check` test step does **not** prove DB-backed coverage. The 19 skipped files / 279 skipped tests are independently confirmed.

### 11.4 `supabase-integration` job — full execution

**VERIFIED FACT from raw job log** (`job 103204546082`):

After local Supabase startup and sanitized environment export, the log shows `XP_RPG_TEST_DB_URL` present as a masked environment value for subsequent commands.

`Run database-backed tests` executes `pnpm test` and reports:

```text
Test Files  60 passed (60)
Tests       949 passed (949)
```

No skipped files/tests are reported in this run.

The corrective evidence suite itself appears in the raw log as:

```text
tests/phase7-round3-evidence.test.tsx (15 tests) PASS
tests/phase7-motion-reduced-motion.test.tsx (7 tests) PASS
```

### 11.5 deterministic harness

**VERIFIED FACT:**

```text
Test Files 1 passed (1)
Tests      11 passed (11)
```

### 11.6 E2E

**VERIFIED FACT:**

```text
Test Files 1 passed (1)
Tests      9 passed (9)
```

### 11.7 Stop containers

**VERIFIED FACT.** `Stop containers` concludes success in job metadata, and raw logs show container/network cleanup executing after tests.

### CI conclusion

Exact-Head CI is **fully valid** for the reviewed source and the execution side's `60/60 files, 949/949 tests, zero skipped` database-job claim is independently confirmed rather than accepted from a summary.

**Manual basis:** §21, §22, §23, §26.

---

## 12. Global reduced-motion CSS runtime claim

**Source file:** `src/app/globals.css` lines 52–61

### VERIFIED FACT — source contract is present

Exact head retains:

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

The page/test sources also contain `motion-reduce:animate-none` utilities, and exact-head CI successfully builds the production application.

### NOT VERIFIED — independently served compiled stylesheet body

The execution side reports that a running browser received `/_next/static/css/app/layout.css` containing both the global reset and a generated `.motion-reduce\:animate-none { animation: none }` rule.

This reviewer can independently inspect repository source and raw CI logs, but the Actions run does not publish the built `.next` CSS as an artifact and the available GitHub surface does not expose the prior local dev server. Therefore the exact HTTP-served stylesheet-body claim could not be independently replayed here.

It is intentionally recorded as:

```text
NOT VERIFIED
```

—not as FAIL, and not as independent PASS.

This does not negate the verified source-level reset; it preserves the required distinction between authored source/build success and browser-runtime proof.

---

## 13. Manual/device/AT evidence boundary

### Correctly NOT VERIFIED, not falsely passed

The corrective execution report does **not** misrepresent the following as PASS:

```text
authenticated 375 / 768 / 1024 / 1440 matrix under both preferences
physical touch device
VoiceOver
NVDA
JAWS
```

This is good evidence discipline and complies with §19.5 / §21 wording.

However, as described in P1-02, the required browser matrix still prevents final GO until completed or an authoritative scope decision explicitly changes that requirement.

---

## 14. Acceptance matrix for this re-review

| Gate | Result | Evidence classification |
| --- | --- | --- |
| Exact Head = `ff71b73a...` | PASS | VERIFIED FACT |
| base/main = `a8256051...` | PASS | VERIFIED FACT |
| PR remains unmerged | PASS | VERIFIED FACT |
| production-code delta | 0 | VERIFIED FACT |
| backend/API/domain drift | 0 | VERIFIED FACT |
| Supabase drift | 0 | VERIFIED FACT |
| dependency/lock drift | 0 | VERIFIED FACT |
| design-token drift | 0 | VERIFIED FACT |
| shared-component drift | 0 | VERIFIED FACT |
| authority/review docs modified to manufacture PASS | NO | VERIFIED FACT |
| §18.2 reduced keyboard navigation | PASS | VERIFIED FACT |
| §18.2 selected-state equivalence / exact `ring-2` | PASS | VERIFIED FACT |
| §18.4 six-route runtime loading coverage | PASS | VERIFIED FACT |
| six-route supplementary governance scan | PASS | VERIFIED FACT |
| §18.7 real SkillNodeView rendering | PASS | VERIFIED FACT |
| §18.7 real KnowledgeNodeView rendering | PASS | VERIFIED FACT |
| §18.7 production Knowledge role/name state | **FAIL / incomplete proof** | VERIFIED FACT |
| §18.7 Skill derived-state presence in DOM | **FAIL / incomplete proof** | VERIFIED FACT |
| §18.7 Knowledge authority `[AI PROPOSED n%]` | PASS | VERIFIED FACT |
| §18.7 Knowledge `[ARCHIVED]` lifecycle label | PASS | VERIFIED FACT |
| §18.7 rendered graph relation labels | **FAIL / incomplete proof** | VERIFIED FACT |
| §18.7 normalization limited to legal auto-id artifacts | **FAIL** | VERIFIED FACT |
| §20.4 all Skills relation mappings static | PASS | VERIFIED FACT |
| §20.4 all Knowledge relation mappings static | PASS | VERIFIED FACT |
| CI run belongs to exact head | PASS | VERIFIED FACT |
| synthetic merge parents exact | PASS | VERIFIED FACT |
| `check` | SUCCESS | VERIFIED FACT |
| `check` skipped accounting | 19 files / 279 tests skipped | VERIFIED FACT |
| `supabase-integration` | SUCCESS | VERIFIED FACT |
| DB-backed full test | 60/60 files; 949/949 tests; 0 skipped | VERIFIED FACT |
| deterministic harness | 11/11 | VERIFIED FACT |
| E2E | 9/9 | VERIFIED FACT |
| Stop containers | PASS | VERIFIED FACT |
| global reset source | PASS | VERIFIED FACT |
| served compiled CSS body | NOT VERIFIED | NOT VERIFIED |
| required authenticated viewport matrix | NOT VERIFIED | NOT VERIFIED / blocker |
| physical device | NOT VERIFIED | NOT VERIFIED |
| VoiceOver | NOT VERIFIED | NOT VERIFIED |
| NVDA | NOT VERIFIED | NOT VERIFIED |
| JAWS | NOT VERIFIED | NOT VERIFIED |
| Round 4 started | NO | VERIFIED FACT |
| Phase 7 FINAL FROZEN declared | NO | VERIFIED FACT |

---

## 15. Minimum corrective actions before another independent review

### Required for P1-01

1. Make the Knowledge §18.7 fixture production-like by supplying `onSelect` / `onNavigate`, then directly assert its rendered interactive role, accessible name, relevant semantic attributes and class equivalence under both preferences.
2. Add explicit rendered presence assertion for the Skill derived-state label, preferably against `getSkillStateVisual(data.derivedState).label`, not merely generic snapshot equality.
3. Prove relation labels in a rendered/read-model DOM path under both preferences. A pure `Edge.label` mapping assertion remains useful for §20.4 but cannot be the sole §18.7 proof.
4. Narrow `clipPath` normalization: only replace React `_r_*_` auto-id substrings and references derived from those IDs; do not replace arbitrary `clipPath` values wholesale.
5. Keep the current deep comparison of text/attributes/classes; do not weaken other semantic fields to make the revised test pass.

### Required for the §19 acceptance gap

6. Execute and record the required authenticated browser/emulation matrix at 375/768/1024/1440 under both `no-preference` and `reduce`, covering the manual's required routes/checks. Do not relabel physical device or AT checks as PASS if they remain unavailable.
7. If the served CSS runtime proof is used in the next completion report, attach independently replayable evidence or reproduce it in the next reviewable environment; otherwise continue to label that particular claim `NOT VERIFIED`.

### Governance

8. Push a new Exact Head, obtain a new exact-head CI run, and again inspect raw logs rather than reusing `34581086465` after any commit change.
9. Do not merge before independent GO.
10. Do not begin Round 4.
11. Do not declare Phase 7 FINAL FROZEN.

---

## 16. Final severity summary

| Severity | Count | Result |
| --- | ---: | --- |
| P0 | 0 | no security/authority/domain drift |
| P1 | 2 | §18.7 proof remains incomplete; mandatory §19 browser matrix remains unverified |
| P2 | 0 | old P2-01 is closed; runtime CSS bundle claim is recorded as NOT VERIFIED rather than promoted to a defect |

# **FINAL: NO-GO → NEED_FIX**

This verdict applies only to Exact Head:

```text
ff71b73a6055469a0c0091e3fb5a3d0e3adf19f2
```

on base:

```text
a8256051319db4ce5eadc7bdf585f197ad1f99f6
```

Do not modify this review result to manufacture acceptance. Correct the evidence gaps in a new commit on the corrective PR (or a replacement corrective PR if governance requires it), then request another independent review of the new Exact Head.
