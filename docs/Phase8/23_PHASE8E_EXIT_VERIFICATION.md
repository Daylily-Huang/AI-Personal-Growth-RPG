# Phase 8E Round 5 — Exit Verification

Date: 2026-10-03 (Asia/Shanghai). Current status: Round 5 accepted at `ff36ac7`, PR #40 merged by the user as `b6af5a8`, post-merge CI `37109984608` all steps success. Implementation FINAL FROZEN; archive and limits in `24_PHASE8E_GATEKEEPER_REREVIEW_AND_FINAL_FREEZE.md`. Archive publication is a separate review/CI/user-merge gate, not already completed by PR #40.

## Scope and acceptance baseline

- Accepted production: `a2614d23e0c0fd2f23d28aee8096a46dd25aee92`; CI `37051182337`, fresh Avicenna `P0=0/P1=0/P2=0 + GO`. Detailed UI evidence and limitations: `22_PHASE8E_ROUND4_UI_VERIFICATION.md`.
- Controller §18 limits this round to tests and evidence/status documents. Round 5 committed `src/` and `supabase/` delta must be empty. Other AI's uncommitted login/auth/package/launcher work is not part of PR #40.
- Frozen D1: immutable `reward-v1`; Season 150, Quest Major 100/Epic 150/Main or Boss 200, Mastery M6/M8/M10 100/150/250. D2 Artifact and Phase-8F-gated REAL_WORLD_VERIFIED remain unavailable. No partial-correction RPC or milestone integration is admitted.

## Canonical exit matrix

| Case | Executable evidence and burden |
| --- | --- |
| O001 XP never spendable | `phase8e-exit-verification`: populated 500-XP fixture; byte-stable snapshots of player state, XP ledger, skills, domains, activities, assessments and evidence after every reward operation |
| O002 isolated ledger | Bidirectional reward/wishes ↔ XP foreign-key absence and RLS enabled on all four reward tables; earlier DB foundation suite retains actual unauthorized/cross-tenant tests |
| O003 no farming | Seven farming sources plus Artifact and REAL_WORLD_VERIFIED produce one durable rejected audit per key, replay without additional writes, and no financial rows |
| O004 no duplicate mint | Same-key semantic-source replay; new-key uppercase equivalent source fails without financial/audit residue; canonical-source suite adds compact/braced UUID and migration constraints |
| O005 append-only correction | Exact full EARN reversal, immutable original row, one compensating row, same-key replay, new-key duplicate blocked, direct authenticated UPDATE/DELETE blocked; deferred milestone revocation is not claimed |
| O019 atomic redemption | Two concurrent real HTTP requests, same key (200 + replayed 200) and distinct keys (200 + 409), exactly one REDEEM/receipt/audit, stable replay; accepted SQL authority suite independently covers database locking/concurrency |
| O020 history and deficit | Pure-fold catalogue -50 example; real v1 full -100 reversal after redeem preserves wish/receipt, subsequent EARN absorbs deficit, refund retains receipt/cooldown, blocked reserve leaves no writes; SQL/TypeScript/cache parity after each successful event |

Catalogue names remain stable; accepted runtime errors are O003 `FARMING_SOURCE_REJECTED`, O004 `REWARD_SOURCE_ALREADY_GRANTED`, O019 `INVALID_WISH_TRANSITION`. These are not production contract changes. HTTP concurrency dispatch uses `Promise.all`; it does not claim a forced internal scheduling interleaving.

## Verification record

- Initial targeted run: HTTP 19/19 passed; six exit DB tests failed during fixture setup due to a UUID/text parameter collision, not counted as passing. Typed/separate parameters fixed the fixture; subsequent exit run 8/8 passed. One temporary historical-head production-diff test was then removed: this is a round-specific release inspection, not a permanent prohibition on future phases. Final exit file has seven tests (six DB plus pure fold).
- Final-file full local DB-enabled suite: **83 files, 1331 passed / 1 failed / 0 skipped**, 382.81s, exit 1. Sole failure `phase7-round3-evidence.test.tsx:736` is the preserved uncommitted server-login mock mismatch. Exit 7/7 and HTTP 19/19 passed, as did existing database authority and real HTTP E2E suites. Typecheck and targeted ESLint passed before this run. Do not describe the full local suite as green.
- Whole-workspace lint: zero errors, six warnings in the preserved dirty login page. Deterministic harness: 11/11. Read-only PostgreSQL follow-up after the full suite: `phase8e-exit-%@example.test` users = 0, `phase8e-http-%@example.test` users = 0, disabled public triggers = 0.
- Production build completed successfully (compile, TypeScript, 38 static pages); this local build includes the preserved dirty login/auth files, so it does not replace clean exact-head CI.
- Candidate review attempt Pauli (`01a0fe14-1428-7ee2-8a73-c7fdc5499876`) did not execute due to a reported usage limit; no verdict. Fresh McClintock (`01a100a8-1fe0-7ce0-b635-43d37009adb2`) returned **P0=0/P1=0/P2=0 + GO** after independent 57/57, zero-skip execution (exit/HTTP/RPC/canonical-source/fold, 29.01s). Additional rollback probes covered deficit 150→50→0, full history preservation, exact seven-day cooldown, four-table owner/cross-tenant RLS, eleven invalid direct INSERTs and two history DELETEs without residue. Independent pure-fold exploration checked 6,692 valid prefixes, 2,117 invalid prefixes and four numeric boundaries. Test/extra-probe users and disabled public triggers were all zero at completion.
- Candidate test SHA256: exit `5C17DC7AD52D8D78273BC70DED73732E54A27DE473324D226B0618ADF7AE359A`; HTTP `BDACA8DEC4BB157941F95FF05E3BCAACE43CF878A307E5C9CADC9A54E32E45DE` (unchanged before/after review). Reviewer independently checked all D1 amounts/Boss precedence, D2 exclusions and the full-reversal boundary; seven days is sourced from frozen `10_API_AND_RPC_CONTRACT_PLAN.md` line 594. Database initially reported starting up, then tests succeeded after recovery. Reviewer did not independently rerun full-suite/lint/harness/build; local HTTP used the dirty-worktree build. This candidate GO does not replace clean exact-head CI or fresh final review.
- Reproduction on a provisioned local Supabase stack: `pnpm exec vitest run tests/phase8e-exit-verification.test.ts tests/phase8e-http-live.test.ts`; set `XP_RPG_TEST_DB_URL` and the same local Supabase configuration used by the project's integration CI. Without the DB URL, real DB cases skip and cannot satisfy this gate.
- Release delta check: `git diff --exit-code a2614d23e0c0fd2f23d28aee8096a46dd25aee92 HEAD -- src supabase`. Inspect the selected index separately before commit; do not overwrite unrelated uncommitted login files to obtain a clean result.

## Data safety, limits and final gates

- New SQL fixtures are random users in BEGIN/ROLLBACK; they disable no triggers and leave no persistent fixture rows. Existing real HTTP fixtures own and clean their randomly generated users only. Never broadly delete users or prune project volumes/backups.
- The dirty-worktree full suite has a known login test mismatch from separate server-auth work, excluded from this round. Clean exact-head CI must independently validate the submitted tree; local failures/skips cannot be called green.
- Independent reviewers are separate execution contexts in the same provider/model family, not external third-party certification. Record their actual reproduction and limitations.
- Required sequence: candidate GO → selected commit/push → exact-head CI and fresh final GO → **user manual merge** → post-merge CI → final freeze archive. Phase 8F, optional 8G and any public deployment remain separate gates.

## Final exact-head acceptance (historical pre-merge handoff)

This section records results obtained after the reviewed commit; it is not included in that commit's CI tree and is intentionally left for the subsequent freeze/archive workflow. No test or production code changed after the reviewed head.

- Exact head: `ff36ac72d0f0f2c3f58054835e07f5d769740ce7`; nine tests/docs files, 304 insertions/13 deletions; `src/` and `supabase/` delta against accepted `a2614d2` is zero.
- CI Run `37106817366` completed/success: check `111156857282` 12/12 steps, supabase-integration `111156857110` 19/19 steps, all success. Real DB full-suite, deterministic harness and E2E steps ran successfully. Separate post-commit local governance/navigation/visual set: 119/119.
- Fresh Ampere (`01a100b0-d142-7e32-b873-c2e661d09e17`) independently checked head/diff and GitHub CI, ran seven files / 96 tests without skips (46.45s), and constructed rollback probes with 48 checks including 14 rejections. D1, deficit recovery, seven-day cooldown, RLS and immutable history passed; thirteen table fingerprints matched before/after, temporary users and disabled triggers were zero. Final verdict: **P0=0/P1=0/P2=0 + GO**, only for user-controlled merge candidacy.
- Final reviewer did not independently rerun full-suite/lint/tsc/harness/build or browser acceptance; local HTTP used the existing dirty-login build. Earlier GO and implementing-agent evidence were not used as substitutes for independent execution. Clean committed-head CI is separately bound above.
- PR #40 remains unmerged at handoff. Do not implement 8F or label 8E frozen until user merge, post-merge CI and archive are complete. Dirty login/auth work remains a separate pending integration/fix.

## Post-merge closure

The preceding unmerged status is the historical Round 5 handoff, superseded on 2026-10-03. User merge `b6af5a84fa3e13cdba729d4d00059e3d9b30fc84` has parents `be949deb67f62269d58a0e21865580d0e67204e0` and reviewed `ff36ac72d0f0f2c3f58054835e07f5d769740ce7`; `git diff ff36ac7 b6af5a8` is empty. Main push CI `37109984608` completed/success, check job `111165834063` 12/12 and integration job `111165834214` 19/19 steps success. The freeze archive binds these independently queryable facts to the prior exact-head GO without reclassifying the dirty local full-suite failure as a pass. No Phase 8F implementation, public deployment or archive-branch merge is asserted.
