# Phase8F Round3 server boundary contract

Implementation contract under admitted document25; candidate, not acceptance. Base `637ca18c070c9ebd18cb1dac390c18de5474e4c8` (PR46). Round2 exact f2694f48 has own CI37579281003, fresh Cicero FINAL zero-finding GO, identical merge tree and post-merge CI37580177574 all31 steps successful. No Round4/UI authority from this document.

## Frozen transport inventory (before implementation)

Every new route authenticates a request-scoped cookie client before reading params/query/body, uses owned RLS reads, and returns `Cache-Control: private, no-store` on success and error. No service-role/demo fallback, URL fetching, Core writes, automatic recognition or reward calculation. Mutations do not prefetch their target; the existing RPC performs full-tuple replay/conflict first.

| Method/path | Request | Success |
|---|---|---|
| GET /api/milestones | limit/offset; optional status ACTIVE/REVOKED, recognitionClass CORE_VERIFIED/USER_CONFIRMED_REAL_WORLD | 200 `{milestones,nextOffset}` |
| POST /api/milestones | milestoneKey,title,description(string/null),recognitionClass,sourceType,sourceId,confirmationRequestIdempotencyKey; optional externalEvidenceUrl/externalCredentialId(string/null) | 200 original confirm RPC result, including replayed |
| GET /api/milestones/[id] | canonical-form UUID path (case-insensitive) | 200 `{milestone}`; absent/foreign identical404 |
| POST /api/milestones/[id]/settle | policyVersion,requestIdempotencyKey | 200 original settle RPC result |
| POST /api/milestones/[id]/revoke | revocationReason,revocationRequestIdempotencyKey | 200 original revoke RPC result |
| GET /api/milestones/sources | limit/offset,sourceType QUEST/SEASON/MASTERY; threshold=6/8/10 required only for MASTERY | 200 `{sources,nextOffset,authoritative:false}` |
| GET /api/milestones/proposals | limit/offset; optional status PROPOSED/ACCEPTED/EDITED/REJECTED | 200 `{proposals,nextOffset,recognitionOnly:true}` |
| POST existing /api/outer-loop/proposals/[id]/review | existing envelope decision,reviewRequestIdempotencyKey,editedPayload,rejectionReason; milestone branch rejects other envelope keys | existing 200 `{result}` shape; no second review endpoint |

Pagination defaults limit50/offset0, limit1..100, offset0..2147483547; reject duplicate/unknown query names, nondecimal/unsafe numbers, unknown enum values. Fetch limit+1 using stable order `(created_at DESC,id DESC)` and return explicit nextOffset; no history-wide fixed cap. Source lists page unique parent facts: eligible Quests, completed Seasons with an owned FINAL review, or owned Skills with a verified exact threshold. Separate Mastery threshold filters preserve all three admitted tiers without duplicate verification rows becoming duplicate sources. Discovery is not authority; SQL rechecks before commitment.

Confirm requires all six semantic fields plus its key. Transport strings are trimmed; nonblank key max200, short key/title max300, source/class/policy identifiers max200, descriptions/proof/reason max10000. These are transport size limits, not reward-policy constants. Nullable descriptions/proofs normalize blank to null; description is required, optional proof omission equals null. Classes/source types uppercase; source IDs remain text for the accepted SQL normalizer (UUID aliases supported). Eligibility, class/source pairs, canonical identity, supported policy and request conflicts remain SQL-owned; do not fetch sources or targets first. Path UUID syntax and malformed transport data are400 before invoking SQL. Reject every unknown/authority field rather than stripping it. Confirmation always responds200, including replay, to preserve the raw immutable RPC snapshot.

Read milestones retain every original/provenance/revocation field. Add `reward` with status NOT_ISSUED/ISSUED/CORRECTED/NOT_AVAILABLE, issued transaction/correction (or null), and `existingSourceReward` (an independently minted source EARN/correction, read-only; never attached). Funded links remain recorded after correction/revoke. Derive correction only from ledger references, not lifecycle flags; do not invent points or write account caches. Reality is explicitly self-attested, NOT_AVAILABLE for settlement, zero credits; Artifact stays excluded. Batch enrichment is scoped to the current page and tenant.

Proposal reads include original schema_version/payload/source_refs, state, expiry and provenance, plus supportedSchema and availableDecisions. V2 supports A/E/R while PROPOSED/unexpired, all other schema versions only REJECTED. Complete v2 snake_case payload is validated by0052; unknown AI amounts/authority fields produce422, not dropped fields. The existing endpoint may perform a nonlocking owned type-routing read after auth/path validation; only the milestone branch adds strict envelope validation and sanitized error handling. Older branch result/body/domain mapping stays unchanged; all responses gain private/no-store. Original payload/version is never upgraded. No live LLM producer is introduced.

## Errors and scope

New error bodies contain only safe `{error,code}`. 401 UNAUTHORIZED; 400 malformed JSON/query/UUID/input/key, invalid class/source identity and unsupported policy; 404 MILESTONE_NOT_FOUND/MILESTONE_SOURCE_NOT_FOUND or proposal absence; 409 request-key reuse, duplicate recognition, not-settleable/already-revoked, existing source EARN and reviewed proposal; 422 ineligible source/reward or invalid/unsupported/expired milestone proposal; 403 generic forbidden for SQL42501; generic500 for unknown failures/invariants. No SQL text, constraint detail, secrets or raw arbitrary exception message in milestone responses.

Allowed production delta: new `src/lib/milestone/*`, six new route files (seven method/path pairs), narrow existing proposal route and owned-type read helper in outer-loop repository. No old0001..0052, reward backend, Growth/Core, UI/shared primitives/auth/dependencies/workflow changes. Exact-path governance exceptions only if a real guard requires them, with negative tests; do not add blanket exemptions.

Risk2 review burdens: auth-before-parse and tenant isolation; full-tuple replay precedence and no mutation prefetch; exact v2 payload/legacy delegation; unique/page-complete eligible source discovery including >1000 histories and repeated verification rows; truthful issued/corrected/existing-source status; zero account/Core writes on reads/recognition. Source thresholds6/8/10 and narrower Quest predicate are admitted project rules, not newly chosen constants. Reward-v1 amounts remain solely in immutable SQL.

HTTP fixtures must run in a dedicated disposable real Supabase environment because milestone history cannot be deleted, even through auth-user cascade. Never disable its guards for cleanup or write fixtures into the user's persistent development database. Preserve exact environment ownership and teardown evidence; ordinary no-DB skips cannot count as HTTP acceptance.
