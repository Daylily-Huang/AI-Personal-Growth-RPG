# Phase 8F — Milestones Implementation Controlling Draft

Date: 2026-10-04 (Asia/Shanghai). **DRAFT / NOT ADMITTED / NO PRODUCTION AUTHORIZATION.**

## 1. Baseline, user decision and entry gate

Accepted Phase 8E implementation is `ff36ac72d0f0f2c3f58054835e07f5d769740ce7`, merged by the user as `b6af5a84fa3e13cdba729d4d00059e3d9b30fc84`. Its final review and post-merge CI are recorded in document 24. Archive PR #41 at `8a0444ff69affeabfbdc4e478e59a289ce19fd85` has green CI `37111895573` and fresh Popper exact-head `P0=0/P1=0/P2=0 + GO`. The user merged it at 2026-10-03T14:09:14Z as `7a671bb2cf750fd8958135812026a0f2e1dbad91`; its tree equals the reviewed head and post-merge CI `37128640371` completed successfully, with all 31 job steps successful. This draft was excluded from PR #41; that CI does not test or admit this later document.

The immutable admission baseline is **`7a671bb2cf750fd8958135812026a0f2e1dbad91`**, verified after the archive's user merge and green post-merge CI, not a moving `main` alias. Baseline readiness is not admission: R1's user scope decision is now recorded, R2–R6 remain proposed, and this draft has no committed admission head or its own CI. A fresh independent exact-head admission review must accept the resolutions below before any migration or production file is created. Phase 1–8E authority remains frozen except for the explicitly proposed additive surfaces in this draft.

User decision on 2026-10-03: first complete milestone recognition, existing Core-source anti-double-mint reward settlement and revocation; **real-world achievements record recognition only and mint zero credits; Artifact rewards remain deferred**. This does not authorize a verifier, new reward tier, AI-issued award, or changes to immutable `reward-v1`.

Explicit user follow-up on 2026-10-04: **defer Artifact verified-achievement recognition as well; complete the other milestones first**. Both Artifact recognition and minting are excluded from this release. This resolves R1's product choice only, not the independent technical/admission gates. Existing Artifact records and Evidence workflows are unchanged.

Controlling sources: Design ChatGPT 01–09 in their established priority, Phase8 `00`, `01`, `02`, `06`, `07`, `08`, `09`, `10`, `11`, `12`, and accepted 8E controller `21` / freeze `24`. The explicit reconciliations below are proposals for admission, not silent edits to those frozen sources.

## 2. Scope and frozen boundaries

Proposed implementation: one private `milestones` table; three RPCs (`rpc_confirm_milestone`, `rpc_settle_milestone_reward`, `rpc_revoke_milestone`); one narrow extension of the existing proposal-review dispatcher for `MILESTONE_CANDIDATE`; authenticated server adapters; `/rewards/milestones` and local Rewards navigation; exit/security/real-DB/HTTP/UI verification.

Out of scope: XP/Mastery/Evidence/Quest/Season mutation; editing old migrations `0001..0050`; changing the ten reward RPC contracts, fold or `reward-v1`; external credential fetching/verification; Artifact recognition and minting; real-world minting; new financial event kinds, policy tables or reward amounts; background recognition/automatic reward grants; a second proposal-review endpoint; auth/launcher cleanup; 8G, public deployment and payments.

Confirmation and reward settlement are separate user actions. Accepting a proposal creates recognition only. Revocation is explicit, reasoned and irreversible within v1; it never changes the underlying Core fact or deletes recognition/history.

## 3. Recognition source contract — proposed v1

| Class / source | Deterministic recognition prerequisite | Reward behavior |
| --- | --- | --- |
| CORE_VERIFIED / QUEST | Owned completed Quest with `quest_size IN ('epic','main') OR is_boss = true` | Separate settlement may use its existing canonical QUEST source and unchanged reward-v1 |
| CORE_VERIFIED / MASTERY | Owned verified `mastery_verifications` entry for the exact skill / M6, M8 or M10 threshold | Separate settlement uses `${skill_id}:M${threshold}`, never current cached Mastery alone |
| CORE_VERIFIED / SEASON | Owned COMPLETED Season and its owned immutable FINAL review | Separate settlement uses the Season UUID under existing reward-v1 |
| USER_CONFIRMED_REAL_WORLD / EXTERNAL_CREDENTIAL | User's explicit self-attestation with optional descriptive evidence URL / credential text | Always zero credits in this phase, even when a URL, DOI or credential ID exists |
| CORE_VERIFIED / ARTIFACT | **Explicitly deferred by user on 2026-10-04:** no verified milestone recognition in this release | Reward remains zero under user D2; see resolution R1 |

The Quest recognition predicate follows spec 07 and is deliberately narrower than the existing reward faucet: non-Boss Major Quests may still earn under 8E, but are not automatically promoted to milestone recognition. Source type is a closed allowlist, not inferred from titles or LLM prose. Login/time/streak/count categories are rejected.

SEASON/QUEST UUIDs normalize through PostgreSQL UUID text; MASTERY uses the accepted exact threshold grammar and canonical skill UUID. There must be no alias-based second recognition or EARN. The server rechecks owned prerequisite facts at confirmation and rechecks reward eligibility at settlement. Discovery is only a candidate list, not proof or automatic commitment.

For real-world records, `source_id` is an opaque UUID for the user's attested event, supplied once and retained across retries; it does not assert an external database row or third-party verification. The API/UI must label this as self-attestation. Reusing that identity is deduplicated; the system does not claim it can detect two distinct identifiers describing the same offline event. No server fetch of submitted links (including redirects or private-network addresses) is introduced.

## 4. Schema and ownership — proposed resolution

Use the fields in schema plan 09 §3.6: identity/tenant, milestone key, immutable title/description/class/source/proof metadata, ACTIVE/REVOKED lifecycle, immutable confirmation key, separate revocation key, reward-link flag/id, and timestamps/revocation reason.

- Authenticated users can SELECT only their own rows; all direct INSERT/UPDATE/DELETE are denied for anon, authenticated and service-role application paths. Private SECURITY DEFINER authority is not exposed as a client helper. Database tenant/field guards backstop grants and RLS.
- Preserve `UNIQUE(user_id,milestone_key,source_type,source_id)`, the confirmation-key unique constraint, and the non-null revocation-key partial unique constraint across ACTIVE and REVOKED history.
- R2 proposes `UNIQUE(user_id,source_type,source_id)` for every recognition class and across all statuses, in addition to the old four-column constraint. `milestone_key` is presentation/classification, not a second source identity. Add class/source-pair and canonical-source CHECKs: CORE_VERIFIED allows only the admitted Core source types; USER_CONFIRMED_REAL_WORLD allows only EXTERNAL_CREDENTIAL. SEASON/QUEST/EXTERNAL_CREDENTIAL use canonical UUID text; MASTERY uses canonical `${skill_id}:M${threshold}` with the existing M6/M8/M10 grammar. Distinct thresholds stay distinct. The 0050 normalizer intentionally returns some malformed strings unchanged; equality with its output alone is therefore insufficient as a format CHECK. Reject malformed identity after request-key conflict resolution, before domain access. No automatic merge/rewrite of historical rows, including REVOKED ones, is allowed.
- Identity, source, title, description, external proof metadata and recognized/created timestamps remain immutable. Only the three RPCs can set the narrow lifecycle/reward-link fields; confirmation inserts ACTIVE with `granted_reward_credit=false`, null reward link and null revocation fields. `granted_reward_credit` agrees with non-null reward link; REVOKED requires non-empty reason and populated revocation timestamp/key.
- A non-null reward reference must be an owned EARN with the exact canonical source, supported policy, and correct account owner. It can only be attached as the result of this milestone's successful settlement. Direct cross-tenant or wrong-kind links fail even under an application service role.
- Schema 09's `ON DELETE SET NULL` must not erase settlement provenance. R3 proposes `ON DELETE RESTRICT` for `reward_transaction_id`, consistent with the already immutable ledger; no change to existing reward tables is required. Milestone hard deletion remains prohibited through application paths, including attempts via owned-reference manipulation.
- The generic authority paragraph saying milestone rows never update is interpreted by the specific ACTIVE→REVOKED and false→true settlement contracts, not as permission for arbitrary metadata updates or a reason to omit those RPC-only transitions.

## 5. Durable request identity and lock discipline

Each of the three public RPCs binds `(auth.uid(),request_key)` to RPC, canonical target and all normalized semantic input, including edited content/reason/policy. Reject unknown fields at the API boundary. A cryptographic fingerprint and complete deterministic result snapshot are committed in the immutable audit event.

An existing same-key identical tuple returns its original snapshot before probing current ownership/lifecycle. The same key with different RPC/target/payload fails 409 `IDEMPOTENCY_KEY_REUSED` without discovering a foreign target. A first-seen absent/foreign target fails uniform 404; malformed input is 400, eligibility 422, lifecycle/duplicate conflicts 409, unauthenticated 401. SQL exceptions must map without exposing raw SQL or secrets. Trimmed key validation and the existing 200-character bound are transport limits inherited from 8E, not reward-policy constants.

Milestone confirmation and revocation keys remain separate persisted columns; settlement replay authority lives in the audit table, not a second request registry. Same-key conflicts must also be safe across existing reward RPCs. Transactional failure leaves no milestone/link/audit/cache/ledger residue. A committed business rejection, if used, needs a bound stored snapshot and zero financial mutation; it cannot be confused with a rollback exception.

R4 proposes bounded private-helper composition, **not nested calls to public reward/confirmation RPCs**. The new settle/revoke bodies append authorized ledger rows themselves, reusing the unchanged `phase8e_verified_reward_amount`, account-lock, ledger-preview/apply helpers and existing ledger guards. They do not introduce a second amount calculator, replace any accepted reward RPC, or modify old migrations. This is the explicit proposed interpretation of plan 10's internal grant call; it requires admission review.

New private `phase8f_begin_request` uses the exact existing shared advisory-key identity `hashtextextended(user_id::text || E'\x1f' || trimmed_key, 0)`, with the same user/key audit lookup and full identity comparison. Its fingerprint is SHA-256 over UTF-8 `phase8f-request-v1:` plus the normalized identity JSONB text; no source lookup is needed to construct that identity. New private `phase8f_write_audit` records policy namespace `phase8f-milestone-v1`, schema `1`; ledger policy stays `reward-v1`. Both helpers, and the internal confirmation helper, revoke EXECUTE from PUBLIC/anon/authenticated/service_role. SECURITY DEFINER public entrypoints must derive the tenant from `auth.uid()`, never accept an authoritative caller user ID.

Each operation acquires **one** public request-key lock before domain row locks. There are no derived child keys, nested public-RPC locks or separate financial/milestone audit inserts: existing `outer_loop_audit_events UNIQUE(user_id,request_idempotency_key)` permits only **one combined audit** per request. That audit includes RPC/target/full fingerprint and the complete result snapshot: milestone, any created EARN/correction, any reused correction ID, and account preview when applicable. Reusing a key already owned by any other audit event fails closed; no prefix-reservation protocol is needed.

| Entrypoint | Lock and mutation order after request-key replay/conflict check |
| --- | --- |
| Confirm | Owned source predicate/read locks → insert one milestone under canonical uniqueness → combined confirmation audit; no account access/mutation |
| Settle | Existing account advisory + account row via `phase8e_lock_reward_account` → milestone FOR UPDATE → canonical source validation/read locks → EARN append → link milestone → preview → combined audit → apply cache and assert parity |
| Revoke | Existing `phase8e_lock_reward_account_key` advisory → existing account row FOR UPDATE **if present, without creating one** → milestone FOR UPDATE → linked EARN/correction validation → lifecycle transition and optional correction append → preview/audit/apply only as specified in §6.3 |
| MILESTONE_CANDIDATE review | Owned type-routing read described in §7 → request-key lock → proposal FOR UPDATE/recheck → source predicate/read locks → internal recognition insert → proposal transition + one combined review audit; no account or second request lock |

The internal confirmation helper validates/inserts recognition but owns neither a request lock nor an audit; only the authenticated outer confirm/proposal entrypoint owns those. Never acquire a new request-key lock while holding an account, milestone, source or proposal row. Public confirm/settle/revoke never lock a proposal, so a proposal review waiting for canonical recognition uniqueness cannot create a reverse proposal-lock edge. Source checks do not mutate Core state. This is a proposed ordering argument, **not runtime deadlock proof**: Round 2 requires actual two-session direct-grant/settle, direct-correct/revoke, competing milestone and proposal/confirmation races, lock-timeout bounds and zero-residue checks.

## 6. Three RPC behaviors

### 6.1 Confirm

Use the input inventory from RPC plan 10 §20: key/title/description/class/source, optional external evidence URL/credential, and confirmation key. Validate ownership and the §3 predicate; atomically insert recognition and audit. Confirmation must create **zero** reward transactions/accounts and zero Core mutations. Audit snapshot is the replay result even if the record is revoked later. Same canonical fact with another key fails 409 without partial writes.

### 6.2 Settle reward

Accept only milestone ID, supported policy version and request key, never an amount, user ID or arbitrary transaction link. Require owned ACTIVE and un-settled CORE_VERIFIED milestone. Reject every real-world/Artifact request with a clear not-available/ineligible result and zero financial/link change.

Canonical reward identity is the underlying SEASON/QUEST/MASTERY source, not milestone ID/key/title. Reuse the accepted deterministic amount verification and ledger/cache discipline. Frozen v1 remains Season 150; Quest Major 100/Epic 150/Main-or-Boss 200; Mastery M6/M8/M10 100/150/250. The narrower milestone Quest predicate does not change the existing Major reward rule. These are user-approved project constants, not external standards.

An already minted source (including a subsequently corrected EARN) causes 409 and no new reward link, audit success or second EARN for a fresh settlement. UI may show the existing source reward read-only, but may not silently attach it as if this milestone issued it. A winning settlement appends exactly one EARN, attaches it to the milestone, writes **one combined** `MILESTONE_REWARD_SETTLED` audit covering both mutations, and updates account cache with verified fold parity in the **same** transaction. A later failure rolls everything back. Concurrent direct-grant and milestone-settle requests have one winner only.

### 6.3 Revoke

Require owned ACTIVE record and non-empty reason; bind/replay the full reason. Change only status, revocation reason/timestamp/key and updated timestamp; retain all original identity/provenance and reward-link fields.

- Without a funded link: revoke + audit only; do not create an empty account or infer/correct a separate underlying-source reward. Recognition revocation is not a Core invalidation command.
- With a funded link and no prior correction: require the original owned account, append exactly `-original_EARN.amount`, referencing `correction_for_id`; preserve original EARN, receipt and Wish state. Fold/cache parity must hold; any deficit is absorbed by later valid EARNs, never XP deductions or history deletion. Commit milestone transition, correction, one combined `MILESTONE_REVOKED` audit and cache atomically. A missing account for a linked EARN is an invariant failure, not permission to fabricate financial history.
- R5 proposes that an already corrected linked EARN may still have its milestone revoked. Under the account lock validate the existing correction's tenant/account, CORRECTION kind, original `correction_for_id`, exact negative amount, canonical source pair and unchanged policy. Reuse it as evidence; append **no** second correction and do not rewrite an unchanged account cache/timestamp. The single milestone audit includes `correction_reused=true` and its ID/snapshot, and existing fold/cache parity is checked. Never catch arbitrary errors and pretend a correction exists. The original milestone reward link and `granted_reward_credit=true` remain provenance; the UI derives corrected status from the ledger, not by clearing that flag.
- Same revoke key/same input returns the original snapshot. Another key on REVOKED fails 409 `MILESTONE_ALREADY_REVOKED`; changed reason on the same key conflicts. Direct correction versus revocation, and two revocations, must prove exactly one financial reversal with no partial lifecycle state.

## 7. Proposal-only AI integration

Retain the single existing `POST /api/outer-loop/proposals/[id]/review` and its CAS/replay/expiration semantics; add only the MILESTONE_CANDIDATE branch, delegating every older type without changed behavior. Source ownership/eligibility is rechecked in the committing transaction. ACCEPTED/EDITED confirms recognition only; REJECTED creates none; no decision grants credits. A stale or invalid proposal never commits a partial recognition.

R6 proposes envelope `schema_version=2` for MILESTONE_CANDIDATE only; earlier types keep their versions. The strict payload has required nonblank `milestone_key`, `title`, `recognition_class`, `source_type`, `source_id`; `description` is required text or null, and optional `external_evidence_url` / `external_credential_id` are text or null. Use the same class/source predicates and normalization as manual confirmation. Reject every other payload key, specifically `reward_credit_value`, amount/reward flags, user IDs and arbitrary reward links. The frozen example's `qualifying_evidence_refs` are non-authoritative context in envelope `source_refs`, never a pick-first source rule. No AI-generated value reaches the ledger.

Legacy v1 MILESTONE_CANDIDATE cannot be ACCEPTED or EDITED into a recognition. The UI explains the unsupported version; REJECTED remains available only before expiration and creates no milestone. Do not modify immutable payload/schema/provenance to upgrade it. A user may independently perform normal manual confirmation; do not auto-clone/review a legacy proposal. For v2 EDITED, require a complete replacement payload under the strict schema, preserve the immutable original, and record the normalized accepted payload in the audit. ACCEPTED/REJECTED require absent edited payload; bind decision, edited payload and rejection reason into request identity. Same-key changed decision/content/reason conflicts even when the target has since changed state. Replay precedes expiry/CAS checks; a fresh key requires PROPOSED and unexpired status. Unsupported schema/payload rejection uses a 422-mapped domain error compatible with the existing review adapter, not a 23514 that its older conflict handler maps to 409.

Dispatcher design is deliberately narrow: preserve the accepted review implementation as private `phase8e_review_outer_loop_proposal` (unchanged body/signature, revoke all application EXECUTE), and install the existing public signature as a wrapper. It performs a **non-locking owned proposal-type routing read**; non-MILESTONE, absent and foreign proposals delegate unchanged to that prior implementation. For an owned MILESTONE_CANDIDATE only, acquire the shared request-key lock before FOR UPDATE, then recheck immutable type, replay/CAS/expiry and invoke the private recognition helper. One `PROPOSAL_REVIEWED` audit snapshots both proposal transition and any milestone; it is the sole replay authority for this operation. This routing read neither exposes foreign metadata nor mutates data. The strong no-target-read-before-key guarantee applies to the three new milestone RPCs; do not falsely extend it to all historical proposal branches. Tests must prove unchanged older branch results/errors and no nested public-confirm request/audit.

The initial phase provides informed proposal read/review plumbing, not an unrequested background LLM job. If a new live AI producer/prompt is later proposed, list it separately, apply the required golden harness and obtain scope review; do not conflate a service-role proposal fixture with live AI acceptance.

## 8. Proposed HTTP/UI inventory and narrow edit boundary

Freeze exact schemas/status mapping before Round 3. Proposed minimal routes:

| Method / path | Purpose |
| --- | --- |
| GET `/api/milestones` | Paginated owned ACTIVE/REVOKED records and truthful derived reward status |
| POST `/api/milestones` | Explicit recognition confirmation via confirm RPC |
| GET `/api/milestones/[id]` | Owned detail; absent/foreign 404 |
| POST `/api/milestones/[id]/settle` | Explicit existing-source reward settlement |
| POST `/api/milestones/[id]/revoke` | Explicit reasoned revocation |
| GET `/api/milestones/sources` | Paginated owned eligible candidates, read-only/non-authoritative |
| GET `/api/milestones/proposals` | Paginated owned MILESTONE_CANDIDATE proposals for informed review |
| Existing outer-loop proposal review | Sole AI proposal commit path |

Request-scoped authenticated clients and RLS; `Cache-Control: private, no-store`; authenticate before parsing. No browser authority client, service-role/demo fallback, new review endpoint or server-side URL fetching. No prefetch of a mutation target before the RPC's replay/conflict check. Read paths do not create records/accounts. Pagination must not silently cap history; malformed bodies, unknown authority fields and unsupported categories fail closed.

The page distinguishes verified Core recognition, self-attested real-world recognition, ACTIVE/REVOKED, issued/corrected/not-issued reward and read-only existing-source reward. All originals and revocation reasons remain visible. Confirmation, financial settlement and revocation have distinct informed dialogs. Preserve one request key and immutable submitted payload through uncertain retries; do not repeat a successful mutation because its refresh failed.

Local Rewards tabs may be added through `src/app/rewards/layout.tsx` plus a reward-local navigation component; preserve the existing Wishes workflow and accessible navigation. No new top-level mobile destination, AppShell/primitive restyling, or modifications to frozen reward backend blobs. New milestone code stays under its own `src/lib/milestone`, API and UI files. Any governance-test allowlist change must be exact-path, controller-bound, and negatively tested, never a blanket backend exemption.

## 9. Acceptance burdens and execution rounds

Admission reviewer must attack the source predicates and every frozen numeric constant, canonical identity, global request-key conflicts, account/target lock graph, correction-once semantics, user decision, and narrow scope. A draft review alone is not exact-head admission.

**Universal round gate:** no implementation round may start before the preceding round's exact committed head has all required CI jobs/steps successful and a fresh independent Gatekeeper verdict **P0=0/P1=0/P2=0 + GO**. Local passes, candidate reviews, skipped database cases or a prior round's GO cannot substitute. Any corrective head requires new exact-head CI and fresh review; unresolved findings block advancement. This applies to every transition below, including Round 2→3, Round 3→4 and Round 4→5, not just final acceptance.

1. Admission: close R1–R6 with explicit designs; pin post-archive main SHA; independent exact-head P0=0/P1=0/P2=0 + GO and required CI.
2. Round 1 foundation: proposed next migration `0051` for one table, grants/RLS/tenant/immutability/identity guards; no public RPC/API/UI. Verify latest migration numbering first. Exact-head CI and fresh Gatekeeper before Round 2.
3. Round 2 authority: proposed `0052`, three RPCs and narrow proposal dispatcher extension; actual local PostgreSQL + disposable CI, all concurrency cases unskipped. Old migration bytes unchanged. Fresh exact-head review required.
4. Round 3 server boundary: exact route/request inventory, auth/RLS/error/replay tests and real Next+Auth+PostgreSQL HTTP evidence. No UI authority. Exact-head CI and fresh zero-finding GO before Round 4.
5. Round 4 UI: milestone page/local tabs, full pagination, confirmation/retry, loading/empty/error/401, long text, keyboard/focus, reduced-motion and responsive browser verification; do not label emulation physical-device evidence. Exact-head CI and fresh zero-finding GO before Round 5.
6. Round 5 exit: O012 and O021 plus 8F completion of O005/O020, O001/O002 isolation, O004 wrapper anti-double-mint and O018 tenancy. Full suite/lint/typecheck/build/deterministic harness, exact-head CI/fresh final GO; user merge, post-merge CI and final archive.

Mandatory counterexamples: unauthenticated/cross-tenant/direct role writes; UUID spellings/key aliases and malformed strings unchanged by the 0050 normalizer; duplicate recognition after revoke; mismatched reward-link tenant/kind/source/policy; keys preclaimed by other RPCs and proof of no hidden child key/duplicate audit; same-key concurrent replay and different-input conflict for all three RPCs; direct grant vs settle; direct correction vs revoke; prior corrected EARN with exact/mismatched provenance; replay after lifecycle changes; unfunded confirm/revoke creates no account; proposal accept/edit/reject/expiry and same/different-key concurrent CAS; legacy-version reject versus prohibited accept/edit; unknown AI amount fields; unchanged older proposal branches; URL/credential with zero real-world credits; cached Mastery without exact verification; incomplete/non-FINAL Season; non-Boss Major and lower Quests; client amount forgery; no failed-write residue; populated Core snapshots unchanged after every successful and failed workflow.

Run rollback-only SQL fixtures without disabling guards; HTTP fixtures create/clean only their own random users. Preserve real data and recovery backups. Local skipped DB tests are not runtime evidence; dirty-login full-suite failure remains separately disclosed until its independent integration is completed. No test-weakening to obtain a green report.

## 10. Draft reconciliation register — must close before admission

| ID | Proposed interpretation / unresolved design | Gate |
| --- | --- | --- |
| R1 | User explicitly chose on 2026-10-04 to defer CORE_VERIFIED Artifact recognition too. Existing Artifact/Evidence-link metadata supplies no independent verifier. Exclude ARTIFACT from this release's permitted milestone source pairs; confirm/proposal acceptance/settlement reject it with no milestone, link, financial or audit residue from a failed transaction. Existing Artifact/Evidence product remains unchanged. | User scope decision resolved; implementation contract still requires independent admission |
| R2 | §4 proposes exact all-class/all-status source UNIQUE plus format/class-source CHECKs, preserving the old key; M6/M8/M10 remain separate. | Concrete proposal, pending independent admission |
| R3 | Milestone→EARN RESTRICT preserves provenance instead of schema sketch's SET NULL; ledger immutability remains unchanged. | Independent admission accepts narrow schema resolution |
| R4 | §5 proposes private helper composition, one shared request-key lock, one combined audit, no nested public RPC/child key, honest 8F audit namespace, explicit lock graph. | Concrete proposal; independent admission and later real two-session tests required |
| R5 | Previously corrected linked EARN does not strand ACTIVE recognition: revoke using prior correction evidence, never issue another reversal. | Independent admission accepts atomic state/result/audit semantics |
| R6 | §7 proposes strict v2 source-bearing payload with no AI amount, v1 reject-only, immutable history, narrow type-routing wrapper and one review audit. | Concrete proposal, pending independent admission and older-branch regression |

No production files, migrations or tests are authorized by this draft. No unresolved row may be silently marked complete from a prior phase's CI or GO.
