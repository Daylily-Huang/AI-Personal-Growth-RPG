# Phase8F Round4 milestone UI contract

Base `f18855df297fa1a8f42e5fa3574453ef9b67d76b` (PR47 merge; tree equals reviewed bf6ccf88). Round3 own CI37590548364, fresh independent Linnaeus FINAL P0/P1/P2=0 GO and post-merge CI37591775959 all31 steps/1687 tests passed. This is an implementation contract, **not Round4 acceptance**. Admitted25 controls;26 transport and0001..0052 are unchanged.

## Scope

Add `/rewards/milestones`, local Rewards links through existing rewards layout, and milestone-local client components. Preserve Wishes behavior and all server/SQL/Core/auth/shared primitives/design tokens/main navigation/dependencies/workflow bytes. No live AI producer, external verification, credential fetch, migration deployment or public hosting. Artifact recognition/rewards deferred; real-world recognition self-attested and zero credits.

## Read and presentation contract

- Records: ACTIVE/REVOKED and recognition-class filters, complete pagination, original detail/proof/source/identity, recognition/revocation dates and reason. Read server `reward` projection, not `granted_reward_credit` alone: issued, corrected, not issued or not available. Separate underlying-source EARN/correction stays visibly read-only and unattached. Never calculate reward amounts in UI or equate recognition with minting.
- Sources: QUEST/SEASON/MASTERY and exact Mastery threshold6/8/10, paginated unique facts from26. Show existing recognition (including revoked) and independently issued rewards. Candidate visibility is not authority; server rechecks. Major non-Boss is not promoted, no cached Mastery inference. No mount/refresh POST.
- Proposals: paginated current/history, original version/payload/source_refs/model_metadata, status/expiry/review/rejection/result. V2 A/E/R only when offered and unexpired; older versions reject-only. No immutable upgrade or auto-clone. All unknown/nested provenance remains visible as inert text, never HTML or fetched links.
- GET generation includes URL/filter/revision/retry identity, abort old initial reads, ignore stale pagination successes/errors (including A→B→A). Invalid/nonadvancing nextOffset errors are visible. Empty, loading, failure, pagination retry and401 login have explicit accessible states. No fixed history cap.

## Commands and uncertainty

One pending command at a time. Recognition composer (Core or self-attested reality), reward settlement and reasoned revocation have distinct informed dialogs. Confirm/review-recognition never auto-settle. Reality's opaque source UUID is created once per intent and retained; it does not deduplicate different UUIDs describing the same offline event. External URL/credential are optional unverified metadata, rendered inert.

Before the first POST, show full target and semantic payload and allow cancellation/editing. At submission freeze exact serialized JSON plus one key: confirmationRequestIdempotencyKey, requestIdempotencyKey, revocationRequestIdempotencyKey, or reviewRequestIdempotencyKey as26 specifies. Block double clicks and busy dismissals. No optimistic permanent success. Invalid/network/uncertain responses keep the frozen request for same-key retry; closing only hides a submitted unresolved command, with a resume notice and no new command until resolved. Current-page session only; do not store private drafts across reload/login or claim reload persistence.

A confirmed success is terminal for that command: refresh is separate GET work, never another POST if rendering/read refresh fails. Explicit4xx rejection permits ending the attempt after checking the error; never silently mutate/reuse its frozen payload. Use safe known error messages with an own-key/Map lookup; unknown errors cannot inject SQL/messages into UI.

V2 EDITED sends a complete replacement snake_case payload after explicit user inspection. Reject unknown/authority keys rather than silently stripping them; required description may be null and optional proof fields null/text. ACCEPTED/REJECTED omit editedPayload. No amount/user/transaction authority added. Original proposal remains visible next to the replacement. Rejection reason and revoke reason bind to the snapshot. Revocation clearly states irreversible recognition transition, history retained, no Core/XP changes, and only a linked EARN is reversed at most once; prior correction reused, unrelated source reward untouched; consumed credit deficit absorbed by future valid earnings, Wishes/receipts preserved.

## Acceptance

Risk2 independent review attacks every preceding promise, the frozen SQL reward-v1 constants (Season150, Quest Major100/Epic150/Main-or-Boss200, Mastery6/8/10=100/150/250), source07 predicates,26 field contracts, prototype-key error fallback, metadata completeness, stale reads, request replay and confirmed-success/failed-refresh separation. Test exact emitted tuples and absence of mutations on reads, uncertainty/double-click/cancel/reopen, three paginations/filter races, all lifecycle/reward distinctions, strict v2/legacy/expiry and frozen backend/navigation blobs.

Run unit/UI plus whole real PostgreSQL+HTTP suite, lint/typecheck/build/harness, real-browser responsive/long-text/keyboard/focus/reduced-motion and authenticated workflow checks against an exact-owned disposable stack. Browser emulation is not physical-device evidence. No guard disabling or user-data fixtures. Candidate risk2 GO before commit; own exact-head CI and a different fresh FINAL zero-finding GO before delegated ordinary PR merge, exact merge tree/post-CI check. Round5 exit/final8F freeze remains separate; no completion/deployment claim from this contract.
