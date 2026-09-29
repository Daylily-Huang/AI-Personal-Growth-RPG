# Phase 8D — Independent Gatekeeper Review Record

> **Review type**: Independent read-only adversarial review and Gatekeeper review record
> **Final reviewed implementation head**: `8b33cca8e994ba45862194d5588642e9e76626ba`
> **Freeze archive head**: `597e3f8b69f413fd81be5ff7f643783f25fe4a59`
> **PRs**: #37 (`codex/phase8d-strategy-playbook` → `main`), #38 (`codex/phase8d-final-freeze` → `main`)
> **Merge commits**: `b93273cd87d39e04a66ed0ebfd76fa95ebd2e643` (PR #37), `a1da765e492b8d93e6350ac32865d8e0018faa91` (PR #38)
> **Record date**: 2026-09-29
> **Final verdict**: **P0 = 0 / P1 = 0 / P2 = 0 — GO**
> **Phase state**: **FINAL FROZEN**

---

## 1. Purpose and attestation boundary

Phase 8B records its final review as `14_PHASE8B_GATEKEEPER_FINAL_REVIEW.md`. Phase 8D previously recorded its review chain only inside `19_PHASE8D_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`, `progress.md`, and `task_plan.md`. The freeze-archive Gatekeeper flagged that gap. This document closes it.

**What is externally reproducible here.** Every exact head, pull request, merge commit, and CI run ID below was checked against the public repository and the public GitHub API. The committed test suite can be re-run by anyone against a local Supabase/PostgreSQL instance, and the independent reviewers did exactly that.

**What is an attestation, not a reproducible artifact.** The GO / NO-GO verdicts themselves are human-readable judgements produced by agent reviewers, not signed artifacts. All three reviewers below were subagents spawned by the executing agent in one session and ran on the same provider/model family; none is a human auditor or a cross-vendor reviewer. Their independence comes from three properties only: a separate context with no seed from the execution conversation, a read-only constraint, and explicit instructions to falsify rather than confirm. A third party can verify the CI bindings and re-run the tests; a third party cannot independently recompute the verdicts. This limitation is stated rather than papered over.

An additional asymmetry: Phase 8B preserved its NO-GO review as a committed document (`14_...`), whereas most Phase 8D round verdicts exist only as session attestations recorded in the progress log. The Round 1–4 verdicts below are therefore marked **attested**, and only the Round 5 chain has the review evidence reproduced in writing here.

## 2. Review chain

| Stage | Head | Verdict | Provenance |
| --- | --- | --- | --- |
| Admission (controlling document) | `b4c26079e5532cc1c02238f70de95f3e4694e554` | `P0=0 / P1=0 / P2=0 + GO` | attested |
| Round 1 — DB foundation | `400cf1536e86412e6183e45289d87cb21bd56ba1` | GO | attested |
| Round 2 — RPC authority | `1910af870fc82ffde35bf76da93d4bac50a5effb` | GO | attested |
| Round 3 — server boundary | `2b0796e66fc900344a1571f39ebd771fe64abe47` | GO | attested |
| Round 4 — Playbook UI | `6fea360adffc4f7d9cde7a159797d246ca55f592` | GO | attested |
| Round 5 — adversarial review (reviewer A) | uncommitted tree → `3c09f8a` | `P0=0 / P1=4 / P2=6 + NO-GO` → `P0=0 / P1=0 / P2=0 + GO` | reproduced in §4 |
| Round 5 — final exact-head Gatekeeper (reviewer B) | `3c09f8a` → `8b33cca` | `P0=0 / P1=0 / P2=3 + NO-GO` → `P0=0 / P1=0 / P2=0 + GO` | reproduced in §4 |
| Freeze archive — fresh Gatekeeper (reviewer C) | `597e3f8` | `P0=0 / P1=0 / P2=0 + GO` | reproduced in §4 |

Reviewer instances (session-scoped subagent handles):

- Reviewer A — `e4d3ab4b-a081-4478-a4bc-2e78167348e2`, "Adversarial review Round 5 exit tests"
- Reviewer B — `7bae83b5-f979-4d19-a431-0325c7b2a23b`, "Final exact-head Gatekeeper Round 5"
- Reviewer C — `696420ae-a517-45e6-b122-0f78706f3bbc`, "Fresh Gatekeeper for freeze archive"

Two process deviations are recorded rather than hidden:

1. The re-review after each corrective head reused the reviewer that raised the findings. The controlling document §11.7 asks for a "corrective head and fresh exact-head review"; a strictly fresh reviewer per corrective head was not used. Reuse weakens, but does not eliminate, the independence of the re-review — the same agent was still asked to re-falsify, and it did re-measure rather than accept the fix.
2. Only the first review (reviewer A, turn 1) and the first exact-head Gatekeeper review (reviewer B, turn 1) ran against a head before the fix; reviewer C is the only reviewer that saw the final archive head without having authored any of the changes under review.

## 3. Findings raised and their closure

### 3.1 Reviewer A — Round 5 exit set, first pass

Verdict `P0=0 / P1=4 / P2=6 + NO-GO` on the pre-commit working tree. The four P1 findings were genuine coverage gaps, not false positives:

| ID | Finding | Closure |
| --- | --- | --- |
| P1-1 | No assertion that `rpc_evaluate_strategy_status(confirm=false)` leaves an *eligible* Strategy at `TESTING`; deleting the `IF p_confirm_promotion` branch in `0047` would still pass every test | Closed: O009 now asserts real DB state `TESTING`/`HIGH` after the `confirm=false` evaluation on the 4-date eligible Strategy, before the `confirm=true` promotion |
| P1-2 | `CONTEXTUAL` lifecycle entirely untested | Closed: new test covers blank context note (`22023`), `SUPPORTED → CONTEXTUAL → SUPPORTED`, and deterministic weakening below 60% |
| P1-3 | Retirement never exercised; "historical rows remain queryable through retirement" half of §10 was unproven | Closed: blank retirement reason (`22023`), `RETIRED`, version creation on `RETIRED` (`23514`), retired row plus support/version history still queryable |
| P1-4 | No concurrent `STRATEGY_HYPOTHESIS` review CAS; the existing CAS test routes through `phase8b_review_outer_loop_proposal`, a different function | Closed: CI-gated two-session test; winner commits, loser gets `23514 PROPOSAL_ALREADY_REVIEWED`, exactly one Strategy and one `resulting_entity_id` |

Actionable P2s closed in the same corrective: exact SQLSTATE assertions instead of "any error" (`42501`, `22023`, `23514`, `P0002`); `VERY_HIGH` derivation asserted; the exact `0.75` inclusive ratio gate asserted; `CORE_EVIDENCE_REFERENCE` proven to contribute zero Core links; O008 documented as authority-level because Phase 8D exposes no AI generation HTTP endpoint.

Left open by reviewer A and accepted as non-blocking: the imprecise error label for confirmation on an eligible `CONTEXTUAL` (see §6). It was the last of reviewer A's six P2 items and carried the label "P2-9" in that reviewer's combined P1/P2 list; the P2 count in the verdict is six.

### 3.2 Reviewer B — final exact-head Gatekeeper

Verdict `P0=0 / P1=0 / P2=3 + NO-GO` at `3c09f8a`, with every substantive claim confirmed and the NO-GO driven only by three non-blocking coverage refinements:

| ID | Finding | Closure |
| --- | --- | --- |
| P2-1 | The AI's real role (`service_role`) and `anon` were never tested against Strategy truth; a future blanket `GRANT … TO service_role` would reopen AI direct commit and no test would fail | Closed: both roles asserted to fail `42501` on Strategy INSERT/UPDATE/DELETE, version INSERT, support INSERT; `service_role` may still file a proposal and the Strategy count is unchanged |
| P2-2 | §9.1 `supporting_activity_ids` non-materialization and the §5.1 canonical-timestamp premise had no DB-level assertion | Closed: accepted hypothesis with two owned `supporting_activity_ids` yields zero `strategy_supports` and stays `HYPOTHESIS`/`LOW`/v1; authenticated direct INSERT into `activities`/`journal_entries` fails `42501` |
| P2-3 | Exact `0.65` / `0.85` ratio gates and the `CONTEXTUAL` confirmation decision untested | Closed: `13/7 = 0.65 → MODERATE` (promotion `22023`), `17/3 = 0.85 → VERY_HIGH`, and eligible `CONTEXTUAL` + `confirm=true` pinned as fail-closed `22023` with lifecycle unchanged, promoted only through `rpc_transition_strategy_status` |

Reviewer B's re-review at `8b33cca` returned `P0=0 / P1=0 / P2=0 + GO` and found no new P0/P1/P2. It also caught a genuine fixture defect: the `insertActivities` helper emitted seven fractional digits for the 10th and later activities, which the new 13- and 15-activity tests would have hit; the corrective uses six-digit microseconds.

### 3.3 Reviewer C — fresh freeze-archive Gatekeeper

Verdict `P0=0 / P1=0 / P2=0 + GO` at `597e3f8`, with two non-counted observations:

- `docs/MASTER_PROJECT_HANDOFF.md` still contains "Phase 8D 未启动 / BLOCKED" inside the historical Phase 8C freeze-conclusion section. It was accurate when written and sits inside a clearly historical block; an optional clarification, not a stale current claim.
- The Round 3 documentation-sync row in `19_...FREEZE.md` cites no CI run ID. Reviewer C located it: Run `36453547266` — success. This record adds it; the author did not re-query it due to the anonymous API rate limit, so it is attributed to reviewer C.

## 4. Independently reproduced evidence

Each reviewer ran the committed tests against a real local Supabase PostgreSQL instance (migrations `0001..0047`), not against mocks, and probed the database read-only with `begin`/`rollback`.

| Evidence | Value | Reproduced by |
| --- | --- | --- |
| Exit file, without `CI=true` | `10 passed / 1 skipped` (skip = CI-gated concurrency) | reviewer B, reviewer C |
| Exit file, with `CI=true` | `11 passed / 0 skipped`, concurrent proposal CAS observed waiting on the row lock | reviewer B |
| Full Phase-8D six-file set | `69 passed / 2 skipped` (both skips are the CI-gated concurrency tests) | reviewer B, reviewer C |
| Full local suite, with `CI=true` and the Supabase key variables set | `1151 passed / 1 failed / 0 skipped`; the single failed test is `stage5b-db-repository` case 1, root-caused to a hardcoded domain UUID already owned by the pre-existing `demo_player@growth-rpg.dev` account, and does not reproduce on CI's disposable database | reviewer C reproduced the same failure and root cause |

Environment note for the full-suite row: the figures above require `CI=true` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. Run with only `XP_RPG_TEST_DB_URL` set, the same suite reports `1121 passed / 1 failed / 30 skipped` with 3 failed files: the two CI-gated Phase-8D concurrency tests skip, and `tests/stage7d-artifact-e2e.test.ts` and `tests/stage7d-artifact-security.test.ts` fail in `beforeAll` because the Supabase keys are absent, which accounts for the remaining 28 skips. Those two file-level failures are missing-environment artifacts, not Phase 8D regressions; only `stage5b-db-repository` case 1 is the pre-existing local-data collision.

Falsification attempts that did **not** find a defect (all returned contract-compliant behavior):

- duplicate canonical source identity deduplicates and does not inflate `support_count`;
- `COUNTER_EVIDENCE` rows never contribute observation dates or Core links (1 SUPPORT + 4 COUNTER still reports one date and one Core link);
- the `<60%` weakening boundary is not off by one (ratio exactly `0.60` stays `SUPPORTED`, `0.545` weakens);
- cross-tenant RPC access returns `P0002`, anonymous access `28000`, cross-tenant reads return zero rows;
- a caller-supplied timestamp that differs from the canonical source timestamp is rejected with `22023 SOURCE_TIMESTAMP_MISMATCH`;
- direct UPDATE/DELETE of Strategy, versions, or supports fails `42501`.

Reviewer C additionally verified that all nine Phase-8D CI runs are bound by `head_sha` to the SHA each document cites, with both jobs green, and that reviewer A's O009 fixture boundary is load-bearing (moving the Season Review timestamp onto a fourth distinct date flips the derived confidence from `MODERATE` to `HIGH`, which would fail the assertion).

## 5. CI evidence

| Run | Bound head | Event | Result |
| --- | --- | --- | --- |
| `36338180207` | `400cf153…` | pull_request | success |
| `36438563584` | `1910af87…` | pull_request | success |
| `36452011311` | `2b0796e6…` | pull_request | success |
| `36453547266` | `7895693…` | pull_request | success (located by reviewer C) |
| `36559214448` | `6fea360a…` | pull_request | success |
| `36587173704` | `3c09f8a8…` | pull_request | success |
| `36590521018` | `8b33cca8…` | pull_request | success |
| `36592178536` | `f5dd59d…` | pull_request | success |
| `36593720889` | `b93273cd…` | push / main | success |
| `36596794622` | `597e3f8b…` | pull_request (#38) | success |
| `36599144119` | `a1da765e…` | push / main (PR #38 post-merge) | success |

Each green run covers lint, test, production build, Supabase startup, database-backed tests, the deterministic Growth Engine harness, and E2E. CI step **logs** are not retrievable without authentication (the logs API returns 403 anonymously), so reviewers relied on step conclusions plus verified environment wiring (`scripts/export-supabase-ci-env.cjs` exports `XP_RPG_TEST_DB_URL`, and Actions sets `CI=true`, so the database-backed and concurrency tests execute rather than skip).

## 6. Residual backlog (not a gate item)

`rpc_evaluate_strategy_status(confirm=true)` on an eligible `CONTEXTUAL` Strategy raises `INSUFFICIENT_SUPPORT_FOR_PROMOTION`. Reviewer B examined this and explicitly declined to treat it as a Phase 8D gate item: the behavior is fail-closed, leaves the lifecycle unchanged, is consistent with §7 (which scopes evaluation promotion to `TESTING -> SUPPORTED`, with `CONTEXTUAL -> SUPPORTED` transition-only), and is now pinned by a test. Only the error label is imprecise when the evidence is sufficient but the state is not `TESTING`; changing it requires a migration and therefore a separate governed change.

## 7. Final decision

```text
P0 = 0
P1 = 0
P2 = 0

VERDICT = GO
IMPLEMENTATION MERGE = DONE (PR #37 -> b93273cd)
FREEZE ARCHIVE MERGE = DONE (PR #38 -> a1da765)
PHASE 8D = FINAL FROZEN
```

The archive head `597e3f8` was confirmed docs-only (`git diff b93273cd..597e3f8 -- src supabase tests` empty, and `git diff 8b33cca..597e3f8 -- src supabase tests` empty), based on the then-current `main`, with PR CI green. PR #38 merged as `a1da765e492b8d93e6350ac32865d8e0018faa91`; the post-merge main push Run is `36599144119` — success, with both `check` and `supabase-integration` green. The public CI workflow badge for `main` also reported **passing** at record time.
