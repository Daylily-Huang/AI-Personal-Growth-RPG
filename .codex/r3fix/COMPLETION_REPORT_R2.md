PHASE 7 — ROUND 3 SECOND CORRECTIVE COMPLETE
→ REQUEST INDEPENDENT REVIEW

Repository: Daylily-Huang/AI-Personal-Growth-RPG
Branch: fix/phase7-round3-semantic-evidence
PR: #27 (open, unmerged, mergeable_state=clean)

Exact Head SHA:  bbb09ec4ae2121599f277a1aa41565ede79dbee7
Base SHA (main): a8256051319db4ce5eadc7bdf585f197ad1f99f6
Superseded prior head (re-reviewed): ff71b73a6055469a0c0091e3fb5a3d0e3adf19f2
Superseded CI run (NOT reused): 34581086465
New CI run: 34622336564

Reviewed re-review input:
docs/DesignSystem/PHASE7_ROUND3_REREVIEW_RESULT.md
(branch review/phase7-round3-rereview-20260911, commit 38dc509)
Verdict addressed: NO-GO → NEED_FIX (P0=0, P1=2, P2=0)

Changed files (cumulative delta vs base a825605):
- tests/phase7-round3-evidence.test.tsx        (new; 20 tests)
- tests/phase7-motion-reduced-motion.test.tsx  (+41 / -6)

Delta of THIS round only (ff71b73 → bbb09ec):
- tests/phase7-round3-evidence.test.tsx        (+253 / -8)

Production code changed: NONE.
Frozen paths touched: NONE.
Content identity proof: the file blob executed by CI is byte-identical to both the
local working file and the pushed Exact Head — blob 77ce1f3300b02332776a6391137f017353ba8012
(local disk = local HEAD = origin branch = CI head_commit bbb09ec).

==================================================================
P1-01 — §18.7 proof incomplete (three sub-defects) — CLOSED
==================================================================

Defect A — Knowledge ARIA role/name test did not exercise the production
interactive state.
CLOSED. Root cause confirmed: the fixture supplied no onSelect/onNavigate, and
RPGCard.tsx claims `role="button"` / `tabIndex` / `data-interactive` only when
onClick is supplied, so `visibleSemanticFacts().roles` was `[]` for Knowledge in
both preferences and `expect(reduced.roles).toEqual(normal.roles)` passed
vacuously.
Fix: `knowledgeData()` is now production-like (`onSelect` + `onNavigate`), and a
dedicated test asserts under BOTH preferences that the node is actionable with
  role="button", tabindex="0", data-interactive="true",
  data-testid="knowledge-node-<id>",
  aria-label="<title> · <authority label>",
  data-authority-status="<verificationStatus>",
  data-is-archived="<true|false>"
and that the role/name tuple is present in the deep comparator's `roles` output.
The test would fail if the production interactive path regressed.

Defect B — required vocabulary not explicitly present-tested in rendered DOM.
CLOSED.
- Derived state: asserted per state (learning / proficient / advanced / locked)
  against `getSkillStateVisual(state).label`, rendered under both preferences.
  Snapshot equality alone can no longer pass a missing state label.
- Relation labels: added a rendered read-model DOM path proving all labels —
  `SkillTableView` renders `"<relation>（<label>）"` for prerequisite, contains,
  supports; `KnowledgeTableView` renders `"<symbol> <relationType>"` for
  prerequisite, contains, supports, contradicts, relates_to; each asserted under
  both preferences, with cross-preference semantic equivalence. The §20.4
  `Edge.label` mapping assertions remain but are no longer the sole proof.

Defect C — clipPath normalization broader than the authorized exception.
CLOSED. The old helper returned `"[clipPath]"` for every clipPath / clip-path
value, which could mask a stable semantic reference. Normalization now replaces
only the React `useId()` auto-id substring wherever it occurs:
  `url(#_r_0_)` → `url(#[auto-id])`, while `url(#semantic-mask-A)` is compared
  verbatim.
A dedicated boundary-guard test pins this, including a positive control proving
the comparator still fails on a real authoritative difference (masteryLevel
changed between two renders must produce unequal semantic facts).

No other semantic field was weakened to make the revised tests pass.

==================================================================
P1-02 — mandatory §19 browser/manual acceptance matrix — EXECUTED,
        with one item still requiring human visual review
==================================================================

Execution method (no external dependency added, no production code touched):
a DEDICATED headless Chrome instance launched with its own `--user-data-dir`,
driven per cell by `--window-size`, `--virtual-time-budget`, `--dump-dom` and
`--screenshot`, plus `--force-prefers-reduced-motion` for the reduced preference.
No other browser process was enumerated, signalled or terminated by the capture
script.

Coverage: 9 routes × 4 widths × 2 preferences = 72 cells, all captured.

| Item | Result |
| --- | --- |
| Routes (§19.1) | `/`, `/login`, `/dashboard`, `/quests`, `/skills`, `/skills?view=table`, `/knowledge`, `/knowledge?view=table`, `/artifacts` |
| Widths (§19.2) | 375, 768, 1024, 1440 — screenshot dimensions verified exactly (375×900, 768×900, 1024×900, 1440×900) |
| Screenshots | 72 PNG, ~4.3 MB, under `.codex/r3fix/matrix/shots/` |
| DOM snapshots | 72 HTML, under `.codex/r3fix/matrix/dumps/` |
| Machine-readable index | `.codex/r3fix/matrix/results.tsv` (route, width, preference, HTTP, DOM bytes, DOM sha256, shot bytes) |
| Per-cell size analysis | 72/72 non-blank (inkRatio 0.030–0.295); zero empty captures |
| Reduced vs normal DOM | **35 of 36 route×width pairs byte-identical after normalizing only dev-server noise** (`?v=<mtime>`, `self.__next_r`, React ids). The single difference is `/skills@768`, where the only divergence is the React Flow viewport transform (`translate(221.563px, 50px) scale(1.36997)` vs `translate(0,0) scale(1)`) captured mid-camera-motion — a timing artefact of an animated fit, not a semantic difference. |
| Semantic preservation under reduced motion | VERIFIED at browser level: no text, role, label or attribute differs between preferences on any route/width. |

NOT VERIFIED (unchanged and not claimed as PASS):
- Human visual review of the 72 screenshots. The execution model in this session
  cannot accept image input, so the screenshots were analysed programmatically
  (non-blank, exact dimensions, per-column ink profiles) and are provided for
  human review; no visual-quality claim is made.
- Pixel-level edge measurement flagged content reaching the right edge in several
  cells (expected for full-bleed page chrome at mobile widths). Whether any of
  these is genuine clipping or overflow cannot be decided without human visual
  inspection. Reported as NOT VERIFIED, not as PASS.
- Physical touch device: NOT VERIFIED.
- VoiceOver: NOT VERIFIED.
- NVDA: NOT VERIFIED.
- JAWS: NOT VERIFIED.
- Authenticated session was NOT required: see the separate observation below.

==================================================================
SEPARATE OBSERVATION (pre-existing, NOT part of Round 3, NOT fixed here)
==================================================================

`src/proxy.ts` is not registered by Next.js at this HEAD. Evidence:
- `next build` / `next dev` manifests contain empty middleware:
  `.next/server/middleware-manifest.json` → `middleware: []`, `functions: []`
  and the dev-server equivalent `.next/dev/server/middleware-manifest.json`
  → `middleware: []`, `functions: []`, `sortedMiddleware: []`.
- Empirically, `GET /dashboard` and `GET /skills` return HTTP 200 with full page
  content when unauthenticated, while the proxy's own logic would redirect them
  (PROTECTED_PREFIXES = ["/dashboard", "/skills"]).
- `src/proxy.ts` exists at the correct location and exports a named `proxy`
  function, which Next 16 documents as the supported convention
  (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`).
Consequence for this review: the §19 matrix was captured WITHOUT a session
because the page-level protection did not run; the browser-level evidence is
therefore about rendering/motion, not about authorization.
This is outside the Round 3 frozen boundary (`src/proxy.ts` is a frozen path),
was NOT modified, and is reported for the user/governance to triage separately.

==================================================================
FROZEN-PATH AUDIT
==================================================================

git diff --name-only a8256051319db4ce5eadc7bdf585f197ad1f99f6...bbb09ec4ae2121599f277a1aa41565ede79dbee7

- src/app/api/**: 0
- src/lib/**: 0
- supabase/**: 0
- src/proxy.ts: 0
- src/styles/design-tokens.css: 0
- package.json / pnpm-lock.yaml: 0
- src/components/**: 0
Total: 2 files, both under tests/**.

==================================================================
LOCAL VALIDATION (exact accounting; skipped separated from passed)
==================================================================

| Gate | Result |
| --- | --- |
| full suite (`vitest run`) | **41 files passed / 19 skipped (60); 675 tests passed / 279 skipped (954); 0 failed** |
| `harness:deterministic` | 1 file / 11 tests passed |
| `eslint` | exit 0, 0 errors / 0 warnings |
| `tsc --noEmit` | exit 0, 0 errors (verified after clearing the gitignored `.next` dev artefact directory, whose generated route types fail independently of this change) |
| `test:e2e` | 1 file / 9 tests **skipped** (no local `XP_RPG_TEST_DB_URL`) — recorded as skipped, NOT passed |
| targeted: `tests/phase7-round3-evidence.test.tsx` | 20 tests passed |
| targeted: `tests/phase7-motion-reduced-motion.test.tsx` | 7 tests passed |

==================================================================
GITHUB ACTIONS — run 34622336564
==================================================================

- exact head sha: bbb09ec4ae2121599f277a1aa41565ede79dbee7 (matches pushed head)
- event pull_request, run_attempt 1, conclusion success

| Job | Result | Job ID |
| --- | --- | --- |
| `check` | SUCCESS | 103339091267 |
| `supabase-integration` | SUCCESS | 103339090770 |

Steps confirmed success in `supabase-integration`: Start local Supabase stack,
Export local Supabase credentials, Build production app, Run database-backed
tests, Deterministic growth-engine harness, Run E2E tests, Stop containers.
`check` ran Lint, Test, Build.

Raw job-log counts:

```
supabase-integration:
  Test Files  60 passed (60)      <- Run database-backed tests
    Tests  954 passed (954)
  Test Files  1 passed (1)        <- Deterministic growth-engine harness
    Tests  11 passed (11)
  Test Files  1 passed (1)        <- Run E2E tests
    Tests  9 passed (9)

check:
  Test Files  41 passed | 19 skipped (60)
    Tests  675 passed | 279 skipped (954)
```

- Zero skips in `supabase-integration`: the 19 files / 279 tests that skip
  locally all executed remotely.
- `check`'s green Test step is NOT cited as database-test proof.
- Local/remote reconciliation is exact: 675 + 279 = 954; 41 + 19 = 60.
- The 5 new tests added this round execute within
  `tests/phase7-round3-evidence.test.tsx` (20 tests in CI), which is the same
  file version as the Exact Head by verified blob identity
  (77ce1f3300b02332776a6391137f017353ba8012).

==================================================================
ACCEPTANCE AGAINST RE-REVIEW §15 MINIMUM CORRECTIVE ACTIONS
==================================================================

| # | Action | Status |
| --- | --- | --- |
| 1 | Production-like Knowledge fixture + direct rendered interactive role/name/attribute assertions under both preferences | DONE |
| 2 | Explicit rendered presence assertion for Skill derived-state label via `getSkillStateVisual(...).label` | DONE |
| 3 | Relation labels proven in rendered read-model DOM under both preferences | DONE |
| 4 | Narrow clipPath normalization to React auto-id substrings only | DONE (+ boundary guard with positive control) |
| 5 | Keep the deep text/attribute/class comparison; do not weaken other fields | DONE |
| 6 | Execute and record the §19 matrix at 375/768/1024/1440 under both preferences | DONE (72 cells, screenshots + DOM + index). Human visual review and edge-clipping judgement remain NOT VERIFIED. |
| 7 | Served-CSS runtime claim: attach replayable evidence or keep it NOT VERIFIED | DONE — the previous served-CSS claim is DROPPED from this report; the runtime claim now rests on the 72-cell DOM parity evidence instead. |
| 8 | New Exact Head + new CI run, raw logs inspected | DONE — bbb09ec, run 34622336564 |
| 9 | Do not merge before independent GO | DONE — PR #27 open/unmerged |
| 10 | Do not begin Round 4 | DONE |
| 11 | Do not declare Phase 7 FINAL FROZEN | DONE |

Evidence artefacts (execution workspace, not committed):
- `.codex/r3fix/REREVIEW_RESULT.md` (re-review input, 747 lines)
- `.codex/r3fix/matrix/results.tsv`, `matrix/shots/*.png` (72), `matrix/dumps/*.html` (72)
- `.codex/r3fix/shot-analysis.json`, `.codex/r3fix/edge-precise.json`
- `.codex/r3fix/run-matrix.sh`, `analyze-shots.mjs`, `edge-precise.mjs`
- `.codex/r3fix/{task_plan,progress,findings}.md`

No merge performed.
No Phase 7 Round 4 work started.
Phase 7 is not FINAL FROZEN.

Execution stopped. Awaiting the next independent review.
