# Phase 8E concurrency-test observation corrective

Status: LOCAL CORRECTIVE CANDIDATE; no release GO or 8F implementation authority.

## Scope and evidence

- Baseline: main `05192283da58afe346fb40dd2c440373cf876b31`, after user merge of PR42. Remote run `37140889037`, integration job `111254915727`, failed database-backed tests despite 83 files / 1332 assertions passing: one unhandled `23505 / IDEMPOTENCY_KEY_REUSED` rejection from the refund path in the ten-RPC same-key matrix. The user supplied the job excerpt; unauthenticated detailed-log access was denied.
- A clean local baseline build and real-PostgreSQL/HTTP full run passed 83 files / 1332 tests, exit0, with no skips. This does not invalidate the remote failure: the receiver was attached only after advisory-lock observation / first transaction commit, leaving a timing window.
- Corrective scope is exactly this document, `tests/phase8e-rpc-authority.test.ts`, and `tests/phase8e-concurrency-observation.test.ts`. No runtime code, SQL, reward-v1 amount, dependency, CI setting, auth candidate, or migration changes.
- Immediately wrap each of the four concurrently launched second-client queries in `Promise.allSettled`. Later assertions still require the expected failure code/message or the successful replay, and unexpected rejection on replay is rethrown. Lock observation, committed-state snapshots, failed-key audit checks and cleanup are preserved.

## Load-bearing acceptance claims

1. Each actual query launch installs a rejection receiver before any intervening wait. Child-process regression evaluates the source AST's four real launch expressions with an early rejected query and two deferred event-loop turns. The unhandled-rejection listener is isolated from Vitest; the raw-query negative control must detect one event.
2. Observation does not swallow evidence: exact error identity/code/message and successful result identity survive delayed consumption. The real DB matrix still requires all ten RPCs to serialize replay/conflict with one mutation, including the refund route from the remote log.
3. This is a test-harness repair only; no SQL authority or immutable reward policy changes. `23505` and `IDEMPOTENCY_KEY_REUSED` are existing assertions from the installed migrations, not newly invented policies; 75ms delays and the existing advisory-lock probe are unchanged. Regression's two event-loop turns model late consumption, not a DB latency guarantee.

## Validation so far

- Baseline full: `.data/main-05192283-full-20261004.json` in the owning root workspace, 1332/1332, 449.60s, exit0.
- New deterministic regression against the old code: 6 pass / 4 fail, all four failures are one unexpected unhandled rejection. Negative control passed.
- After correction: regression 10/10 and real DB authority 13/13, total 23/23, zero skips, exit0.
- Stable full corrective run: **84 files / 1342 tests passed / zero failed / zero skipped**, exit0; `.data/main-concurrency-corrected-20261004.json` in the owning root workspace, JSON `success=true`. Deterministic harness11/11, lint and `tsc --noEmit` exit0, `git diff --check` passed. Existing expected negative-fixture stderr and pg/Vite deprecation warnings remain disclosed.
- Runtime code, migrations, workflow and lockfile have no delta from the successfully built baseline. Independent review and remote committed-head CI are still separate gates.
- Local Node24.21.0 / pnpm11.7.0 differ from CI Node22. Local green alone is not exact-head CI evidence. No remote rerun or manual merge has been performed.

## Required closure

Independent bounded risk1 candidate review, own committed-head CI and fresh exact-head final review, then user-controlled PR/merge and post-merge CI. PR43 remains separate and currently NO-GO; 8F Round1 must wait for the main baseline repair to close.
