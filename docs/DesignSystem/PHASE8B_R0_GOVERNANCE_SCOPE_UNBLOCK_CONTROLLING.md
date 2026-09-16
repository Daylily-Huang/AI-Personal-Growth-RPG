# Phase 8B — Round 0 Governance Scope Unblock
## Independent Gatekeeper Controlling Document

> **Status**: REQUIRED PRECONDITION — AUTHORIZED  
> **Parent Phase 8B control**: `docs/DesignSystem/PHASE8B_SEASON_REVIEW_CONTROLLING.md`  
> **Immutable starting baseline**: `main@0dffb9d706c3c941c46078c89bf3ae6e70d65d5f`  
> **R0 purpose**: remove accidental global reach of historical phase-scoped frozen-delta UI guards without weakening their original protection  
> **Production feature implementation**: FORBIDDEN  
> **Phase 8B R1 database implementation**: BLOCKED until R0 independently accepted + merged

---

# 0. Why R0 Exists

Independent Gatekeeper preflight found that multiple historical UI modernization tests still evaluate the **entire current PR delta** and globally reject backend/domain paths such as:

```text
src/app/api/**
supabase/**
src/lib/store/**
src/lib/ai/**
src/lib/supabase/**
```

Those rules were correct for their original UI-only Phase 5/6/7 PRs, but they are not a valid permanent repository-wide prohibition on future authorized backend phases.

Known examples include at least:

```text
tests/phase5-dashboard-ui.test.tsx
tests/phase5-quests-ui.test.tsx
tests/phase5-skills-ui.test.tsx
tests/phase6-knowledge-ui.test.tsx
tests/stage7c-ui.test.tsx
tests/shared-ui-primitives.test.tsx
tests/global-app-shell.test.tsx
```

`tests/visual-foundation.test.ts` already contains an explicit visual-scope applicability concept and should not be weakened.

Without R0, the first legitimate Phase 8B migration under `supabase/migrations/**` would be rejected by historical UI-only guards even when no historical UI surface is touched.

This is a **governance scope bug**, not an authorization to relax frozen Core rules.

---

# 1. R0 Governing Principle

Historical frozen-delta guard means:

```text
IF this PR modifies the historical phase's protected UI/presentation surface,
THEN that PR must still contain zero unauthorized backend/domain/dependency drift.
```

It must NOT mean:

```text
No future project phase may ever modify backend/domain files.
```

Canonical evaluation:

```text
resolve real non-empty committed delta FAIL-CLOSED
↓
determine whether historical guard's owned scope is touched
↓
if not touched:
    historical policy = NOT APPLICABLE, explicit pass
if touched:
    evaluate FULL delta against the historical frozen backend policy
    any forbidden mixed drift = FAIL
```

Important: applicability is determined by **changed paths**, never by branch name, PR title, commit message, environment-provided phase label, or user-controlled marker.

---

# 2. Fail-Closed Range Resolution Must Remain Intact

R0 must preserve the already-correct dual-mode delta resolver semantics:

```text
PR / feature branch:
mergeBase != HEAD
→ git diff --name-only <mergeBase>...HEAD

current-main push:
mergeBase == HEAD
→ resolve HEAD^1
→ git diff --name-only <parent>..HEAD
```

Unresolvable:

```text
origin/main/main ancestry
HEAD
HEAD^1 when required
```

must fail closed.

Empty ranges must fail closed.

R0 must not reintroduce:

```text
HEAD~1 generic fallback
allow empty
catch error -> PASS
skip on push
hard-coded base SHA
```

---

# 3. Authorized R0 Change Scope

R0 is test/governance-only.

Allowed:

```text
tests/helpers/governance-delta.ts
tests/governance-delta-guard.test.ts
tests/phase5-dashboard-ui.test.tsx
tests/phase5-quests-ui.test.tsx
tests/phase5-skills-ui.test.tsx
tests/phase6-knowledge-ui.test.tsx
tests/stage7c-ui.test.tsx
tests/shared-ui-primitives.test.tsx
tests/global-app-shell.test.tsx
tests/visual-foundation.test.ts   # only if needed to share helper semantics; no weakening
```

No other file is authorized unless Gatekeeper explicitly expands R0.

Forbidden:

```text
src/**
supabase/**
.github/**
package.json
pnpm-lock.yaml
README.md
docs/Phase8/**
production code
migration
API
repository
AI
UI implementation
```

Do not start Phase 8B feature implementation in this PR.

---

# 4. Required Scoped-Guard Helper

Prefer centralizing policy applicability in `tests/helpers/governance-delta.ts` or a sibling test helper.

A suitable pure interface is conceptually:

```ts
interface ScopedPolicy {
  scopeTriggers: string[];
  forbiddenPrefixes: string[];
  forbiddenExactFiles?: string[];
  authorizedExceptions?: string[];
}

interface ScopedPolicyResult {
  applicable: boolean;
  violations: string[];
}

evaluateScopedPolicy(files, policy): ScopedPolicyResult
```

Semantics:

```text
applicable = ANY changed file belongs to historical scope trigger

if applicable == false:
violations = []

if applicable == true:
violations = evaluate FULL changed-file delta against unchanged historical forbidden policy
```

Do not filter the changed file list down to only historical UI files before policy evaluation. Mixed PRs must remain catchable.

---

# 5. Historical Scope Triggers

Exact paths should be derived from each test's real owned surfaces, but the minimum intended ownership is:

## Phase 5 Dashboard Guard

Trigger when delta touches Dashboard presentation owned by that phase, such as:

```text
src/app/dashboard/**
src/components/dashboard/**
```

When triggered, retain its original backend/domain/dependency denylist semantics.

## Phase 5 Quests Guard

Trigger on:

```text
src/app/quests/**
src/components/quests/**
```

When triggered, retain original forbidden prefixes and authorized historical bugfix exceptions.

## Phase 5 Skills Guard

Trigger on:

```text
src/app/skills/**
src/components/skills/**
```

When triggered, retain original forbidden prefixes and authorized historical bugfix exceptions.

## Phase 6 Knowledge Guard

Trigger on the actual Knowledge UI/presentation surfaces owned by Phase 6, e.g.:

```text
src/app/knowledge/**
src/components/knowledge/**
```

Do not make a new Phase 8 backend-only PR compare forever against a historical Phase 6 baseline as a repository-wide prohibition.

## Stage 7C Artifact UI Guard

Trigger on:

```text
src/app/artifacts/**
src/components/artifacts/**
```

When triggered, preserve the Stage 7C frozen backend rule.

## Shared UI Primitive Guard

Trigger on the actual shared-primitive/design surfaces, including:

```text
src/components/ui/**
src/styles/design-tokens.css
src/app/globals.css
```

Do not let a future backend-only PR trip this UI migration policy.

## Global AppShell Guard

Trigger on the global shell surfaces it protects, including:

```text
src/components/layout/**
```

A future Round 3 AppSidebar change will therefore still be subject to zero backend drift in that UI-only PR.

## Visual Foundation Guard

Preserve its existing explicit visual-scope detection.

If refactoring to the shared helper, behavior must remain equivalent or stricter within visual scope.

---

# 6. Explicitly Forbidden R0 Designs

R0 must NOT solve the issue by:

```text
adding Phase 8B paths to a global authorizedExceptions list
allowing all supabase/**
allowing all src/app/api/**
allowing all src/lib/store/**
branch-name checks
PR-title checks
commit-message checks
GITHUB_HEAD_REF == feature/phase8b...
disabling historical tests
it.skip / describe.skip
catching git errors and returning []
returning early before delta resolution
removing synthetic forbidden-path assertions
```

There must be no blanket Phase 8 exception.

The goal is **scope correctness**, not weaker policy.

---

# 7. Required Regression Matrix

R0 must add real unit tests for scoped policy evaluation.

At minimum:

```text
G-R0-01 backend-only future migration
  changed: supabase/migrations/0043_phase8b_outer_loop_foundation.sql
  Phase5 Quests guard: applicable=false, PASS

G-R0-02 backend + Quests UI
  changed: supabase/... + src/app/quests/page.tsx
  Quests guard: applicable=true, forbidden backend violation FAIL

G-R0-03 backend + Skills UI
  Skills guard must FAIL

G-R0-04 backend + Dashboard UI
  Dashboard guard must FAIL

G-R0-05 backend + Knowledge UI
  Knowledge guard must FAIL

G-R0-06 backend + Artifact UI
  Stage7C guard must FAIL

G-R0-07 backend + shared UI primitive
  Shared UI guard must FAIL

G-R0-08 backend + AppShell layout
  Global AppShell guard must FAIL when its historical policy forbids backend drift

G-R0-09 unrelated docs-only delta
  historical UI guards explicit applicable=false

G-R0-10 empty delta
  resolver FAIL-CLOSED

G-R0-11 unresolved merge-base
  resolver FAIL-CLOSED

G-R0-12 current-main merge/push backend-only future phase
  first-parent range resolves correctly;
  historical UI guards applicable=false rather than falsely blocking

G-R0-13 current-main push containing historical UI + forbidden backend
  corresponding scoped guard applicable=true and FAILS

G-R0-14 original authorized historical bugfix exception
  behavior remains unchanged when corresponding historical scope is triggered
```

Tests should exercise pure policy helpers and real temporary Git repositories where ancestry/range behavior matters.

---

# 8. Required Proof Before R0 Acceptance

Execution AI must show:

```text
1. Exact base = 0dffb9d706c3c941c46078c89bf3ae6e70d65d5f
2. Changed files are test/governance-only allowlist
3. No Phase 8 implementation files
4. Shared resolver still fail-closed
5. Full existing test suite green
6. New scoped-policy regressions green
7. PR Exact-Head CI check = success
8. PR Exact-Head CI supabase-integration = success
9. No test skips added
10. No historical forbidden policy weakened inside its own scope
```

Independent Gatekeeper will inspect actual patch and CI; execution report is not authoritative evidence.

---

# 9. R0 Merge / Release Rule

R0 execution AI:

```text
implement
open PR
wait Exact-Head CI
DO NOT MERGE
return to Gatekeeper
```

Only independent Gatekeeper may authorize R0 merge.

After post-merge main-push CI is green, Gatekeeper will pin the new R0 merge SHA as the Phase 8B Round 1 implementation baseline and then release Round 1.

Until then:

```text
PHASE 8B R0 = AUTHORIZED
PHASE 8B R1 = BLOCKED
PHASE 8B R2 = BLOCKED
PHASE 8B R3 = BLOCKED
PHASE 8B R4 = BLOCKED
PHASE 8C+ = BLOCKED
```

This document supersedes the immediate Round-1 authorization wording in `PHASE8B_SEASON_REVIEW_CONTROLLING.md`; the full Round-1 specification remains valid, but its start is conditional on R0 closure.

---

# 10. Execution Return Contract

Return exactly:

```text
PHASE 8B R0 GOVERNANCE SCOPE UNBLOCK:
COMPLETE / INCOMPLETE

BASE SHA:
<sha>

PR:
<number / OPEN>

EXACT HEAD SHA:
<sha>

CHANGED FILES:
<complete list>

TEST/GOVERNANCE-ONLY SCOPE:
PASS / FAIL

PRODUCTION FILES MODIFIED:
NO / YES

PHASE8 IMPLEMENTATION STARTED:
NO / YES

SCOPED POLICY HELPER:
IMPLEMENTED / NOT IMPLEMENTED

PR RANGE FAIL-CLOSED:
PASS / FAIL

CURRENT-MAIN FIRST-PARENT RANGE:
PASS / FAIL

BACKEND-ONLY FUTURE PHASE DELTA:
HISTORICAL GUARDS NOT APPLICABLE / OTHER

MIXED HISTORICAL UI + BACKEND DELTA:
FAIL-CLOSED / OTHER

NEW REGRESSION MATRIX:
<passed>/<total>

EXISTING TEST SUITE:
PASS / FAIL

EXACT-HEAD CI:
<run id>
<status>
<conclusion>

MERGE PERFORMED:
NO
```

Then stop.