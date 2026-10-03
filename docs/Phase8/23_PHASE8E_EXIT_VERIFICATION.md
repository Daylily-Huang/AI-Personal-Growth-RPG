# Phase 8E Round 5 — Exit Verification

Date: 2026-10-03 (Asia/Shanghai). Status: independently accepted candidate; exact-head CI/final review pending, not Phase 8E FINAL FROZEN.

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
