# Phase 8E Round 4 — Wishes UI Verification

Date: 2026-10-03 (Asia/Shanghai). Status: Round 4 accepted at `a2614d2`; Round 5 and final merge gates remain, not Phase 8E final acceptance.

## Scope and frozen baseline

- Accepted Round 3: `de08a89be28a58c471b6417f94504030d5cde145`, CI `37041522823`, fresh independent `P0=0/P1=0/P2=0 + GO`.
- Controller: `21_PHASE8E_REWARD_WISHES_IMPLEMENTATION_CONTROLLING.md` §17. UI consumes existing authenticated HTTP only; twenty accepted backend Git blobs remain identical. No SQL, reward policy, XP or AI authority change.
- `/rewards/wishes`: six distinct server balances, all Wish lifecycle operations, paginated backlog/sources/ledger/receipts/proposals, selected target across all pages, explicit financial confirmation and informed proposal review. AppSidebar/MobileNav only add Journey/Rewards destinations and narrow mobile spacing.

## Automated local evidence

Commands run in WSL at `/mnt/d/AI_Personal_Growth_RPG`; the ignored `.data/run-rewards.cjs` injects local Supabase test configuration without printing credentials.

| Gate | Observed result |
| --- | --- |
| `pnpm test` with real database enabled, initial UI candidate | 82 files: 1313 passed, 1 failed, 0 skipped; sole failure `phase7-round3-evidence.test.tsx:736` is preexisting uncommitted server-login work, excluded from this round |
| Corrective Wishes UI + exact backend/navigation governance | 39/39, including A→B→A late-page rejection, pending double-click lock, stable success focus and expired review rejection |
| Independent UI + governance + navigation + visual suite | 154/154, no skips; final independent verdict tracked separately below |
| `pnpm exec tsc --noEmit`, reward-targeted ESLint, production build | Passed on corrective UI |
| `pnpm harness:deterministic` | 11/11 |
| Whole-workspace ESLint | 0 errors, 6 existing warnings in uncommitted login page |

Do not describe the dirty local full suite as all-green. Exact committed-head CI must separately validate the selected changes, excluding other AI's login/auth/package/launcher work.

## Real browser + real PostgreSQL

Chrome, cached Playwright CLI 0.1.19, real production Next build and local Supabase; isolated random `phase8e-browser-…@example.test` account. No daily/demo account was used. A temporary Windows loopback TCP forwarding process made the WSL test server on port 3018 reachable; no system proxy, firewall, production deployment or existing port-3000 process was changed.

1. Eligible completed Major Quest granted 100 credits. Create priced Wish 75 → activate → primary did not spend credits.
2. Reserve: available 25 / reserved 75. Redeem: available 25 / reserved 0 / redeemed 75.
3. Refund with required explanation: available 100 / redeemed 0. Original receipt `196d0f41-0e93-4245-8694-a051f89d3e41`, redeemed state and seven-day cooldown remained. XP stayed 0.
4. Corrective build: widths 320/375/768/1440 had document width equal to viewport; mobile navigation had seven 44×46-pixel targets. Reduced-motion preference matched; no continuing animation after settling. Transient transitions during viewport resizing are not claimed absent.
5. Twelve Tabs and reverse Tab remained in the modal; Escape restored opener focus. Creating and activating a long-title Wish placed focus on the stable completion status. A 240-character unbroken title and the full operation effect remained visible and wrapped in the 320px modal body.
6. Real fault injection forwarded a correction to PostgreSQL, then deliberately aborted its HTTP response. Retry preserved the exact request body/key and returned `replayed:true`. The helper's subsequent read assertion first failed because the CLI request context requires absolute URLs, then because its sandbox lacks a global `URL`; neither error resubmitted the mutation. A corrected **read-only** follow-up verified exactly one CORRECTION (-100), net/available 0 and five retained ledger events (EARN/RESERVE/REDEEM/REFUND/CORRECTION).

Screenshots remain local at `output/playwright/phase8e-round4/`, not portable CI artifacts. SHA-256:

| File | SHA-256 |
| --- | --- |
| `viewport-320.png` | `4422e43e0bbe0363f8c22dbf2ae120b521398b579d7c6df264642f5e1b6abd82` |
| `viewport-1440.png` | `a0fe7f67e8c9ca7166e646e186e9687a1fc861b77ad52841ef1e3cf27a3a0444` |
| `long-confirm-320.png` | `fedd60a38b4ebd51f63bf92e2dc784d212c40ba2b4cb9191d6c9f85605250afc` |

## Independent findings and gate boundary

- Ramanujan (`01a0fdd6-212f-75c1-8b3d-a2b8ebad8c7f`): candidate `P0=0/P1=0/P2=3 + NO-GO`. Independently reproduced stale A→B→A pagination, success focus loss and expired proposal rejection affordance. Fixed respectively with per-generation object identity/locks, stable completion-status focus and disabled expired rejection. Added regression cases; no backend change.
- Fresh Nietzsche (`01a0fde4-81f2-75c3-a365-d0a19ba7d8d7`) independently passed 154 tests and extra late-success/late-failure pagination lock probes. Initial completion was interrupted by host/WSL unavailability; **no GO was issued at that point**. A bounded helper reproduced its focus/expiry scenarios with safe DOM diagnostics. Its original synchronous lookup of the retry button failed once while balance was still loading (session `62584`, exit 1); the reviewer independently changed only that lookup to await `findByRole` in memory, verified the helper hash, and retained every focus/write-count/expiry assertion. Session `50651` exited 0 with both focus checks, failed-read/no-repeat-write and expired accept/edit/reject checks passing. Final candidate verdict: **P0=0/P1=0/P2=0 + GO**. The original silent exits remain unexplained; they are not counted as passing evidence. No further production change was needed.
- These are independent execution sessions of the same provider/model family, not external third-party certification. Browser results above were run by the implementing agent, not independently repeated.
- Cleanup completed after PostgreSQL recovered: ownership-checked temporary user `f2ba5d1d-5a64-4529-a6c7-c6a0503c49b9` and only its fixture rows removed; remaining auth user count for that ID is 0. Named browser closed, temporary loopback process stopped. Existing project users, database volumes, migration backups and port-3000 service preserved.
- At candidate review, final verdict and exact-head CI remained separate required gates. Their subsequent completion is recorded below; user-controlled merge and post-merge CI are still required before Phase 8E FINAL FROZEN / Phase 8F admission.

## Final exact-head Round 4 acceptance

- Head: `a2614d23e0c0fd2f23d28aee8096a46dd25aee92`, PR #40. CI Run `37051182337` completed/success: `check` job `110984690962` (12/12 steps success), `supabase-integration` job `110984690660` (19/19 success), including real database-backed full tests, deterministic harness and E2E.
- Fresh Avicenna (`01a0fdfd-8769-7402-a6f7-9936af247ce5`) independently verified exact CI/head binding, ran 154/154 tests without skips, two extra stale A→B→A success/failure probes and the bounded focus/read-failure/expiry probes. Twenty accepted backend blobs remained identical. Verdict: **P0=0/P1=0/P2=0 + GO**.
- Screenshots and hashes were inspected, not independently captured again. This acceptance unlocks Round 5 only, not PR merge, Phase 8E freeze or Phase 8F implementation.
