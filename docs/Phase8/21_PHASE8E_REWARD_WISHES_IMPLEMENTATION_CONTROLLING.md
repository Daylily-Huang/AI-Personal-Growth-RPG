# Phase 8E Reward Economy + Wishes Implementation Controlling

## 1. Governance Boundary

Status: **ADMISSION CANDIDATE — production implementation remains BLOCKED pending fresh exact-head Gatekeeper GO**

Baseline:

- Immutable main baseline: `a1da765e492b8d93e6350ac32865d8e0018faa91`.
- Phase 8D is FINAL FROZEN. This document cannot reopen or modify its schema, RPC, API, UI, tests, or evidence.
- This document does not authorize migrations, RPCs, server routes, UI, or reward settlement.
- User decisions D1 and D2 in §13 are frozen as of 2026-09-30. Admission still requires a committed exact head, green deterministic documentation/governance checks, and a fresh independent Gatekeeper verdict `P0=0 / P1=0 / P2=0 + GO` explicitly accepting D3.

The following frozen documents remain controlling unless this document explicitly identifies a contradiction and records the proposed narrow resolution:

- `00_PHASE8_MASTER_ROADMAP.md`
- `01_OUTER_LOOP_DOMAIN_MODEL.md`
- `02_OUTER_LOOP_AUTHORITY_RULES.md`
- `06_REWARD_ECONOMY_AND_WISHES_SPEC.md`
- `08_AI_GM_OUTER_LOOP_CONTRACT.md`
- `09_DATABASE_SCHEMA_PLAN.md`
- `10_API_AND_RPC_CONTRACT_PLAN.md`
- `11_TESTING_SECURITY_AND_HARNESS_PLAN.md`
- `12_INFORMATION_ARCHITECTURE_AND_PHASE_PLAN.md`

## 2. Scope

### In Scope

- `reward_accounts`, `reward_transactions`, `wishes`, and `reward_redemptions`.
- A physically isolated append-only reward ledger with `EARN`, `CORRECTION`, `RESERVE`, `UNRESERVE`, `REDEEM`, and `REFUND` events.
- A pure deterministic `foldRewardLedger` implementation and parity checks against cached account balances.
- Server-authoritative earning eligibility, amount derivation, canonical source identity, and replay handling.
- Wish lifecycle and `/rewards/wishes` UI.
- `WISH_COST_SUGGESTION` as proposal-only AI output.
- Canonical exit tests O001, O002, O003, O004, O005, O019, and O020.

### Out of Scope

- Any XP spending, XP conversion, Mastery mutation, Evidence mutation, or Growth Core write.
- `milestones` or any Phase 8F production table/RPC/UI.
- `ARTIFACT` minting until a separately governed deterministic verification contract exists.
- `REAL_WORLD_VERIFIED` minting before Phase 8F supplies an independently verified authority record.
- Bank, payment, cash-out, voucher, gift-card, gifting, transfer, trading, gambling, random-drop, streak, or leaderboard mechanics.
- Automatic AI minting, cost commitment, reservation, redemption, correction, or refund.

## 3. Non-Negotiable Invariants

1. `XP != reward credit`; no reward operation may insert, update, delete, or settle `xp_transactions`.
2. Reward truth is the append-only `reward_transactions` ledger. `reward_accounts` is only a transactionally maintained cache of the deterministic fold.
3. Historical reward rows and redemption receipts are immutable. Corrections and refunds are compensating events, never edits or deletes.
4. Every financial mutation and every Wish lifecycle transition is tenant-bound, idempotent, auditable, and committed through an authenticated database authority RPC. User-authored Wish creation and title/description/`credit_cost` edits in `IDEA` or `ACTIVE` may use field-scoped grants plus RLS/trigger enforcement; they cannot change lifecycle, ledger, account, receipt, ownership, or system timestamps.
5. Client and AI payloads never supply an authoritative EARN amount.
6. Repetition, micro-activities, daily login, journal volume, focus time, and self-attested claims mint zero credits.
7. Impossible negative reserved or redeemed fold states fail closed; only `current_available` and `correction_deficit` use the frozen clamp semantics.
8. A user may have at most one selected celebration target across `PRIMARY` and `RESERVED` combined.

## 4. Phase Boundary and Frozen-Spec Resolutions

### 4.1 `REAL_WORLD_VERIFIED` is Phase 8F-gated

The frozen reward spec names `REAL_WORLD_VERIFIED`, but the verified authority record is the Phase 8F `milestones` subsystem. Phase 8E must not create a shadow verification table or implement Phase 8F early.

Phase 8E source whitelist is therefore limited to `SEASON`, `QUEST`, and `MASTERY`. Per user Decision D2, both `ARTIFACT` and `REAL_WORLD_VERIFIED` remain reserved enum values rejected with `SOURCE_CLASS_NOT_YET_AVAILABLE`; neither may append a ledger row in Phase 8E.

### 4.2 O005 does not pull Phase 8F into Phase 8E

Phase 8E proves the append-only correction primitive by correcting a previously minted EARN with `rpc_correct_reward_transaction`. The test must assert that both rows remain, the correction is exactly once, account parity is preserved, and no ledger row is deleted.

Phase 8F must add the milestone-revocation integration case using the same correction primitive. This is a sequencing interpretation of O005, not authority for Phase 8E to create milestones.

### 4.3 Canonical Wish cost field

The schema plan says `cost_credits_estimate`; the RPC plan reads `wish.credit_cost`. Phase 8E uses one canonical column:

```text
credit_cost integer NULL CHECK (credit_cost IS NULL OR credit_cost > 0)
```

`IDEA` may have `credit_cost = NULL`. Transition to `ACTIVE` requires a positive `credit_cost`. Reservation, unreservation, redemption, and refund use the immutable cost snapshot established before `PRIMARY`; direct edits while `PRIMARY`, `RESERVED`, or `REDEEMED` fail closed. No second estimate column is created.

### 4.4 One selected target includes a reserved target

The frozen `WHERE status = 'PRIMARY'` index permits one `RESERVED` wish plus a second `PRIMARY` wish. Phase 8E closes that gap with:

```sql
CREATE UNIQUE INDEX uq_wishes_single_selected
ON wishes (user_id)
WHERE status IN ('PRIMARY', 'RESERVED');
```

All target-selection and reservation RPCs lock the account and the caller's selected-wish rows in a fixed order.

### 4.5 Cooldown must be enforced, not merely stored

The frozen RPC contract supplies a seven-day cooldown after redemption. `rpc_reserve_wish_credits` must reject reservation while any caller-owned redeemed wish has `cooldown_until > clock_timestamp()`. The seven-day value is treated as the frozen v1 constant; changing it requires a later governed policy revision.

### 4.6 `IDEA -> ACTIVE` requires an authority path

The frozen lifecycle requires `IDEA -> ACTIVE`, while the schema plan limits direct client updates to editable content and the frozen RPC inventory omits an activation RPC. Without a narrow authority path, an IDEA Wish cannot legally become ACTIVE.

Phase 8E therefore adds `rpc_activate_wish` as the tenth RPC. It authenticates ownership, locks the Wish row, requires `status = 'IDEA'` and positive `credit_cost`, transitions exactly `IDEA -> ACTIVE`, writes `WISH_ACTIVATED` audit evidence, and is idempotent by the bound replay contract in §9. It performs no ledger or reward-account mutation. Direct client status updates remain forbidden.

## 5. Domain Model

### 5.1 Reward transaction taxonomy

| Event | Amount | Required reference | Effect |
| --- | ---: | --- | --- |
| `EARN` | positive | canonical Core source + policy version | increases gross and net earned |
| `CORRECTION` | signed; v1 correction is negative exact reversal | one prior EARN | changes net earned without deleting history |
| `RESERVE` | positive | wish | moves available to reserved |
| `UNRESERVE` | positive | wish | releases reserved credits |
| `REDEEM` | positive | wish | consumes reserved credits and creates receipt |
| `REFUND` | positive | redemption receipt | restores redeemed credits; receipt and wish stay terminal |

Ledger order is `created_at ASC, id ASC`. The pure TypeScript fold and the PostgreSQL settlement calculation must share the same fixtures and produce byte-for-byte equivalent integer fields.

### 5.2 Wish lifecycle

```text
IDEA -> ACTIVE -> PRIMARY -> RESERVED -> REDEEMED
RESERVED -> PRIMARY
IDEA | ACTIVE | PRIMARY -> ARCHIVED | CANCELLED
```

- `REDEEMED`, `ARCHIVED`, and `CANCELLED` are terminal in Phase 8E.
- `REDEEMED` never returns to `ACTIVE`, including after refund.
- `RESERVED` must be explicitly unreserved before archive/cancel.
- A user edit may change title, description, and `credit_cost` only while status is `IDEA` or `ACTIVE`.

## 6. Earning Source Contract

### 6.1 Season

- Source type: `SEASON`.
- Canonical ID: season UUID as text.
- Eligibility: caller-owned `seasons.status = 'COMPLETED'` and a caller-owned immutable `season_reviews.review_type = 'FINAL'` linked to that season.
- Season settlement is pull-based in Phase 8E; no trigger is added to the frozen Phase 8B conclusion RPC.

### 6.2 Quest

- Source type: `QUEST`.
- Canonical ID: quest UUID as text.
- Eligibility: caller-owned `quests.status = 'completed'` and (`quest_size IN ('major', 'epic', 'main')` or `is_boss = true`).
- If multiple categories apply, one deterministic highest policy tier is selected; a source still mints once per policy version.

### 6.3 Mastery

- Source type: `MASTERY`.
- Canonical ID: `${skill_id}:M${threshold}` where threshold is exactly 6, 8, or 10.
- Eligibility comes from a caller-owned verified `mastery_verifications` record for that exact skill and threshold, not from a cached current mastery number alone.
- Each skill/threshold pair can mint once per policy version.

### 6.4 Artifact

Per user Decision D2 on 2026-09-30, Artifact minting is deferred beyond Phase 8E until a separately governed, deterministic verification contract exists. `lifecycle_status`, user-controlled metadata, or a numeric reusability score alone is not independent verification and cannot silently become a reward faucet. Phase 8E rejects `ARTIFACT` with `SOURCE_CLASS_NOT_YET_AVAILABLE` and appends no ledger row.

### 6.5 Rejected sources

`MICRO_ACTIVITY`, `DAILY_LOGIN`, `HABIT_CHECKIN`, `JOURNAL`, `FOCUS_TIME`, `STREAK`, `SELF_ATTESTED`, `ARTIFACT`, and `REAL_WORLD_VERIFIED` in Phase 8E fail before account mutation and append an audit rejection event without a ledger row.

## 7. Reward Policy Contract

The frozen architecture requires a versioned deterministic server policy but does not include a policy table among the four authorized Phase 8E tables. User Decision D1 on 2026-09-30 freezes the v1 carrier and exact amounts below.

Phase 8E uses a versioned immutable PostgreSQL policy function rather than a fifth mutable production table:

```text
calculate_reward_grant_v1(source_type, verified_source_attributes) -> positive integer
policy_version = 'reward-v1'
```

Frozen `reward-v1` grants:

| Eligible canonical source | Credits |
| --- | ---: |
| Confirmed completed Season | 150 |
| Completed Major Quest | 100 |
| Completed Epic Quest | 150 |
| Completed Main Quest or any Boss Quest | 200 |
| Verified Mastery M6 threshold | 100 |
| Verified Mastery M8 threshold | 150 |
| Verified Mastery M10 threshold | 250 |

Quest precedence is deterministic: `is_boss = true` or `quest_size = 'main'` selects 200; otherwise `epic` selects 150; otherwise eligible `major` selects 100. A Quest matching multiple conditions receives only the single highest tier and retains one canonical EARN identity per policy version.

Requirements:

- unknown policy versions fail closed;
- policy version is persisted on every EARN;
- changing values creates a new function/version and never rewrites historical transactions;
- client, AI, and API payloads cannot supply or override the amount;
- policy lookup and source verification occur in the same transaction as EARN.

No client, AI payload, mutable table row, or runtime configuration may alter `reward-v1`. Any future amount change requires a new immutable policy version and governed migration; historical EARN rows retain their original policy version and amount.

## 8. Database Authority Contract

### 8.1 Migration order

Proposed numbering after `0047`:

1. `0048_phase8e_reward_wishes_foundation.sql` creates accounts, transactions without the redemption refund FK, wishes, redemptions, then adds the circular `refund_for_redemption_id` FK by `ALTER TABLE`.
2. `0049_phase8e_reward_wishes_rpc_authority.sql` adds policy, fold/parity helpers, RPC authority, proposal settlement extension, grants, and revokes.

The circular references do not authorize deferred constraint bypass: REDEEM inserts its transaction before its receipt in one transaction; REFUND references an already committed receipt.

### 8.2 Table authority

- `reward_accounts`: user SELECT only; all writes RPC-only; exactly one row per user.
- `reward_transactions`: user SELECT only; append-only and RPC-only; UPDATE/DELETE denied to authenticated, anon, and service-role application paths.
- `wishes`: user SELECT/INSERT; constrained metadata UPDATE only in `IDEA`/`ACTIVE`; lifecycle transitions RPC-only; hard DELETE denied.
- `reward_redemptions`: user SELECT only; inserts only inside redeem RPC; UPDATE/DELETE denied.

Every cross-table reference must assert matching `user_id`. RLS visibility is not a substitute for tenant guard triggers and RPC ownership checks.

### 8.3 Schema-backed uniqueness

- `UNIQUE (user_id, request_idempotency_key)` on reward transactions.
- existing `outer_loop_audit_events.UNIQUE (user_id, request_idempotency_key)` is the cross-RPC durable replay identity for all ten RPCs.
- partial canonical EARN identity from the frozen spec.
- one correction per `correction_for_id`.
- one refund per `refund_for_redemption_id`.
- one receipt per redemption transaction.
- one selected wish across `PRIMARY` and `RESERVED`.

## 9. RPC Authority Contract

Authorized RPCs:

- `rpc_grant_reward_credit`
- `rpc_correct_reward_transaction`
- `rpc_activate_wish`
- `rpc_set_primary_wish`
- `rpc_reserve_wish_credits`
- `rpc_unreserve_wish_credits`
- `rpc_redeem_wish`
- `rpc_refund_wish_redemption`
- `rpc_archive_wish`
- `rpc_cancel_wish`

All ten RPCs must:

1. authenticate `auth.uid()`;
2. validate owned source/wish/account/receipt rows;
3. before locking any target/domain row, acquire a transaction-scoped PostgreSQL advisory lock derived from the exact `(auth.uid(), request_idempotency_key)` pair; hash collisions may serialize unrelated requests but must never weaken correctness;
4. under that key lock, query `outer_loop_audit_events` by its existing unique `(user_id, request_idempotency_key)` identity before current-state precondition checks;
5. bind each key to `(user_id, rpc_name, target_entity_type, target_entity_id, canonical_request_fingerprint)` in the immutable audit event;
6. resolve replay under the key lock: the same key and identical bound tuple returns the audit event's stored `result_snapshot`; the same key with any different RPC, target, or normalized payload fails closed with `409 IDEMPOTENCY_KEY_REUSED`;
7. compute `canonical_request_fingerprint` as SHA-256 over a versioned canonical JSON representation of RPC name, target identity, and normalized semantic payload; timestamps generated by the server and non-semantic presentation fields are excluded by the per-RPC schema;
8. lock every mutated domain row in that RPC's documented deterministic order;
9. append an immutable audit event containing the fingerprint, normalized request identity, and deterministic `result_snapshot` in the same transaction as the mutation; any failure rolls back the domain change, ledger/account change, and audit insert together, leaving no key placeholder or partial residue;
10. map cross-tenant identifiers to fail-closed 404 behavior;
11. reject direct service-role domain mutation while still allowing proposal creation through the governed proposal path.

The six financial/ledger RPCs—`rpc_grant_reward_credit`, `rpc_correct_reward_transaction`, `rpc_reserve_wish_credits`, `rpc_unreserve_wish_credits`, `rpc_redeem_wish`, and `rpc_refund_wish_redemption`—must additionally:

1. lock rows in deterministic `reward_account -> wish/source/receipt -> reward_transaction` order;
2. validate canonical source and policy inside the transaction where applicable;
3. append the ledger event and audit event, then update the account cache atomically;
4. recompute or prove parity with `foldRewardLedger` before commit.

The four non-ledger Wish lifecycle RPCs—`rpc_activate_wish`, `rpc_set_primary_wish`, `rpc_archive_wish`, and `rpc_cancel_wish`—must not insert `reward_transactions` or mutate `reward_accounts`. Their immutable audit event is their replay authority.

Concurrent different-key duplicate mint, reserve, redeem, correction, and refund tests must prove exactly one winner and no failed-write residue. All ten RPCs additionally require same-key/same-tuple concurrent replay and same-key/different-tuple concurrent conflict coverage; non-ledger lifecycle failures must leave Wish state and audit rows unchanged.

## 10. AI Proposal, API, and UI Boundary

### 10.1 AI proposal

`WISH_COST_SUGGESTION` may contain `wish_id`, `suggested_credits`, and rationale. It is non-authoritative until explicit user accept/edit/reject through the existing proposal CAS pipeline. Acceptance may update `credit_cost` only while the owned Wish is `IDEA` or `ACTIVE`; it never mints, reserves, redeems, or changes Growth Core state.

### 10.2 Server boundary

Phase 8E follows the existing repository -> service/request -> HTTP adapter -> authenticated Next route layering. Browser code never imports Supabase authority clients and never calls reward RPCs directly.

The exact route inventory must be frozen before Round 3. At minimum it must support account/ledger read, wish CRUD metadata, lifecycle actions, grant/correct authority actions, and proposal review without creating a second proposal review endpoint.

### 10.3 UI

`/rewards/wishes` must show:

- available, reserved, net earned, redeemed, and correction deficit as distinct values;
- clear separation from XP and Mastery;
- wish backlog, selected target, reserved target, immutable redemption history, and refund-derived status;
- explicit confirmation for reserve, unreserve, redeem, correction, and refund;
- no random rewards, urgency pressure, streak framing, shame, public ranking, or celebratory dark pattern.

## 11. Required Validation

### Static and pure tests

- exact migration order and four-table inventory;
- no FK or trigger path from reward tables to `xp_transactions`;
- immutable ledger/receipt guards and grants;
- Wish creation pinned to `IDEA`, direct status mutation rejected, and `IDEA -> ACTIVE` available only through `rpc_activate_wish`;
- same-key identical activation replay returns the stored result snapshot, while same-key reuse for a different Wish/RPC/payload fails `409 IDEMPOTENCY_KEY_REUSED` before lifecycle evaluation;
- pure `foldRewardLedger` examples A/B/C plus impossible-state throws;
- TypeScript/PostgreSQL fold parity fixtures;
- canonical source and policy-version validation;
- proposal-only AI boundary.

### Real database tests

- RLS and explicit cross-tenant guards for all four tables and every RPC;
- anon and service-role application-path direct writes rejected on all four tables;
- authenticated direct writes rejected except caller-owned Wish INSERT pinned to `IDEA` and exact title/description/`credit_cost` UPDATE grants while the Wish remains `IDEA` or `ACTIVE`; positive tests must prove those two allowed paths, while lifecycle, financial, ownership, system timestamp, ledger, account, and receipt direct writes still fail closed;
- same-key idempotent replay and different-key duplicate conflict;
- concurrent mint/reserve/redeem/correct/refund winner/loser behavior;
- concurrent same-key/same-tuple replay and same-key/different-tuple conflict for financial and non-ledger lifecycle RPCs, with key advisory lock acquired before target-row locks;
- failed operations leave ledger, account cache, wish, receipt, and audit state consistent;
- account cache equals a fresh full ledger fold after every mutation;
- single selected wish across `PRIMARY` and `RESERVED`;
- cooldown enforcement and terminal redemption/refund semantics;
- XP tables and Core facts remain byte-for-byte unchanged.

### Canonical exit set

- O001: XP never spendable.
- O002: reward ledger physically isolated.
- O003: farming sources rejected.
- O004: duplicate reward blocked/idempotent.
- O005: append-only correction primitive; Phase 8F later adds milestone-revocation integration.
- O019: atomic idempotent wish redemption.
- O020: correction deficit preserves full history.

Local skipped database tests are not acceptance evidence. Exact-head CI must run a disposable Supabase instance with database and concurrency suites unskipped.

## 12. Implementation Sequence

No round may begin before the prior round has an exact-head green CI result and independent Gatekeeper `P0=0 / P1=0 / P2=0 + GO`.

1. **Admission**: resolve §13, freeze this document, exact-head independent review.
2. **Round 1 — DB foundation**: `0048`, four tables, constraints, RLS, field authority, immutable guards, pure fold implementation/tests. No production RPCs.
3. **Round 2 — RPC authority**: `0049`, policy/source validation, ten RPCs, proposal settlement extension, real DB/concurrency tests. No API/UI.
4. **Round 3 — Server boundary**: repository/service/request/http/routes plus real authenticated HTTP tests. No UI.
5. **Round 4 — Wishes UI**: `/rewards/wishes`, accessibility/responsive tests, no new authority.
6. **Round 5 — Exit verification**: O001–O005/O019/O020, full suite, deterministic harness, lint, production build, real DB/E2E, final exact-head Gatekeeper.
7. **Freeze**: user-controlled PR merge, post-merge CI, final archive. Phase 8F remains blocked until this is complete.

## 13. Decision Register and Remaining Admission Gate

### D1 — Reward policy carrier and exact v1 amounts — RESOLVED BY USER

Decision date: 2026-09-30. Use immutable versioned PostgreSQL function `reward-v1`, with no fifth Phase 8E table. Frozen amounts are Season 150; Quest Major 100, Epic 150, Main or Boss 200; Mastery M6/M8/M10 100/150/250.

### D2 — Deterministic Artifact eligibility — RESOLVED BY USER

Decision date: 2026-09-30. Defer `ARTIFACT` EARN until a separately governed deterministic verification contract exists. Phase 8E must reject it without ledger mutation. User-controlled lifecycle status, title/type, or reusability score alone is insufficient.

### D3 — Frozen-spec sequencing interpretation — GATEKEEPER MUST ACCEPT

Admission review must explicitly accept both narrow interpretations: `REAL_WORLD_VERIFIED` remains Phase 8F-gated, and Phase 8E O005 proves the correction primitive while Phase 8F adds milestone-revocation integration.

## 14. Definition of Done

Phase 8E is complete only when:

- D1 and D2 remain implemented exactly as the recorded user decisions, and admission Gatekeeper explicitly accepts D3;
- all four tables and ten RPCs match this authority contract;
- every account cache equals deterministic ledger fold;
- direct and cross-tenant writes fail closed;
- all exit tests and full project gates pass without relevant skips in exact-head CI;
- independent final Gatekeeper returns `P0=0 / P1=0 / P2=0 + GO` on the exact implementation head;
- the user manually merges the accepted PR and post-merge main CI is green;
- a final freeze archive records exact head, CI run, Gatekeeper verdict, merge SHA, residual risks, and Phase 8F remains separately gated.
