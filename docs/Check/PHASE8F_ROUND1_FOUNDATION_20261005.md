# Phase 8F Round 1 — milestone database foundation

Date: 2026-10-05. Status: implementation candidate, NOT accepted, no Round 2 authorization.

## Admission and scope

- Admitted controller: `docs/Phase8/25_PHASE8F_MILESTONES_IMPLEMENTATION_CONTROLLING_DRAFT.md`, reviewed admission head `7614a517e936da8d3ed32326b48af5f3a92362f8`, own CI `37138706181`, fresh Aristotle `01a102b9-0b16-7a91-b3fc-c051a677bd64` zero-finding FINAL ADMISSION GO. The controller's DRAFT header preserves its submission snapshot, not a later revocation of that admission.
- Implementation baseline: `ea344a05d9e9b4566d50c77c585884a82f4d4ce5`. PR44 merged the independently reviewed concurrency observation repair; post-merge CI `37281711918` completed successfully, all 31 steps across both jobs. PR43's separate auth repair was already merged and verified.
- Only migration `0051_phase8f_milestones_foundation.sql`, its tests, the exact migration inventory entry, and this evidence note. Old migrations `0001..0050`, application runtime, dependencies, workflows, AI prompts and reward policy remain unchanged.
- User scope: real-world achievements are self-attested recognition with zero credits; Artifact recognition AND rewards are deferred. No public RPC/API/UI is introduced. Future source eligibility, audit/replay, financial mutations, and proposal review belong to Round 2, not this foundation.

## Authority and integrity

- One private `milestones` table. Authenticated SELECT is owner-filtered; all application direct writes and service-role SELECT are denied. An invoker trigger rejects non-owner mutations even if a service-role table grant is accidentally broadened. No executable helper is exposed.
- Canonical UUID/threshold format checks plus all-status/all-class source uniqueness prevent key aliases and revoked-history replacement. M6/M8/M10 remain separate, matching frozen 0050 grammar; no reward amounts are copied into the new SQL.
- Confirmation storage starts ACTIVE/unfunded. Identity, source, title/description, evidence metadata, confirmation key, recognized/created timestamps cannot change. Only narrow owner-authority reward linkage and ACTIVE→REVOKED transitions exist; future bounded RPCs must impose full business/audit semantics.
- Reward links require the same tenant, account owner, EARN kind, underlying canonical source, and existing `reward-v1` policy. FK uses RESTRICT. Revocation retains original settlement provenance, including after correction; no history deletion. This trigger does not itself issue or reverse credits.
- The insert source guard checks ownership/existence only. It intentionally does not advertise Round 2 eligibility enforcement or re-read an invalidated/deleted Core source during revocation. Application roles cannot use this internal fixture/owner path.

## Validation evidence and limits

- WSL Ubuntu Node24.21.0/pnpm11.7.0; real local PostgreSQL17.6. Dependencies installed from the frozen lockfile offline; no dependency changes.
- New suite: 60 tests, including static scope plus live PostgreSQL role writes, service-role grant escalation, source/class identity, immutable fields, revocation, invalid/owned reward links, and before/after Core snapshots. Schema suite49: combined109/109 pass, zero skipped. lint and TypeScript pass.
- The first fixture attempted to use one SQL parameter as both uuid and text (domain id/slug), failed with `inconsistent types deduced for parameter $1`; separate bound parameters fixed it, followed by complete109-case rerun. No production guard was weakened.
- On an existing pre-0051 local DB, every new test creates the migration and random fixtures inside BEGIN and rolls them all back. On CI's newly migrated DB it tests the installed table. No Docker reset, permanent local milestone migration, production data cleanup or guard disabling is required.
- Production build and deterministic growth harness11/11 pass. Full live-DB/HTTP suite:88 files/1477 tests pass, zero skipped/unhandled errors, exit0,454.61s (16:29:45 start); includes the new60 cases and existing auth/concurrency repairs. Intentional negative-test logs and existing pg/Vite deprecation warnings are not hidden or recast as new failures.
- Independent Laplace (`01a10b2a-ea77-73b3-9694-eff60475c7fb`) reran109/109 with zero skips:1 static+59 live-DB foundation cases and49 static schema checks. Additional rollback-only probes covered NULLs, invalid0050 identities, account-owner backstop, corrected-EARN provenance and broadened application-role grants/forged authority flags; final verdict must bind this note's final bytes. The reviewer did not independently rerun the1477-case suite/build or verify remote CI.
- Candidate final verdict, committed exact-head CI and fresh FINAL release review remain pending at this evidence snapshot. Real browser UI, physical devices and public deployment are not new claims of this round.

## Release gate

No commit/push before candidate validation and independent zero-finding GO. No Round 2 before exact committed-head required CI and fresh independent P0/P1/P2=0 GO. The user's 2026-10-04 delegation permits the agent to create/merge PRs beginning with #44 after gates pass; it does not permit admin bypass, force push, branch deletion or public deployment. Verify merged content and post-merge CI separately.

Recovery: if migration application fails, roll back the containing transaction. Round 1 exposes no creation endpoint, so no user milestone backfill is needed. Do not delete populated milestone history to roll back a later release; preserve provenance and use a reviewed additive correction migration.
