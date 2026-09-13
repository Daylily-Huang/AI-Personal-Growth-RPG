# Main Push Governance Guard Fix — Execution & Acceptance Manual

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`  
**Planning role:** Independent Review AI  
**Date:** 2026-09-13  
**Authoritative starting main:** `0abdfa48825c43113ccaad090d8315aabb3f1a37`  
**Phase 7 status:** `FINAL FROZEN — DO NOT REOPEN`

---

# 0. Objective

Repair the repository's two historical Phase 5 fail-closed delta guards so that they preserve their governance purpose in both:

1. pull-request CI, where `origin/main` is the PR base and `merge-base...HEAD` is a meaningful non-empty branch delta; and
2. push-to-main CI, where checkout refreshes `origin/main` to the same commit as `HEAD`, making the current implementation's `git diff <HEAD>...HEAD` empty by construction.

This is a **test/governance infrastructure correction only**. It is not Phase 7 product work and it does not authorize Phase 8.

---

# 1. Established failure signature

Post-merge main push runs repeatedly show exactly two failures:

```text
tests/phase5-quests-ui.test.tsx:259
tests/phase5-skills-ui.test.tsx:482
```

Current algorithm in both tests:

```text
mergeBase = git merge-base origin/main HEAD
diff = git diff --name-only <mergeBase>...HEAD
expect(modifiedFiles.length).toBeGreaterThan(0)
```

On current-main push:

```text
origin/main == HEAD
mergeBase == HEAD
git diff HEAD...HEAD == empty
```

The failure is therefore a comparison-context defect, not evidence of forbidden drift.

Search at planning time found this exact `expect(modifiedFiles.length).toBeGreaterThan(0)` pattern only in the two files above.

---

# 2. Required behavioral contract

The corrected guard must remain **fail closed**.

It must never solve the problem by any of the following:

```text
- deleting the governance test
- skipping the test on push
- returning early when diff is empty
- changing the assertion to allow zero changed files
- broadly catching git errors and treating them as PASS
- weakening forbiddenPrefixes
- broadly expanding authorizedBugfixes
- hard-coding a historical commit SHA as the comparison base
- using an unconditional HEAD~1 fallback for every execution context
```

The guard must identify a meaningful changed-file range and inspect every changed path in that range against the existing forbidden/authorized rules.

---

# 3. Authorized implementation scope

Default authorized files:

```text
tests/phase5-quests-ui.test.tsx
tests/phase5-skills-ui.test.tsx
```

A small shared helper under `tests/**` is authorized if and only if it reduces duplicated range-resolution logic and carries dedicated unit coverage.

No production file is authorized.

Forbidden in this task:

```text
src/**
supabase/**
scripts/**
.github/**
package.json
pnpm-lock.yaml
docs/DesignSystem/design-tokens.css or src/styles/design-tokens.css
```

If a production/workflow/dependency change appears necessary, stop and return to the independent reviewer for scope expansion.

---

# 4. Recommended range-resolution design

Prefer a small deterministic resolver with two explicit modes.

## 4.1 PR / branch mode

When:

```text
mergeBase != HEAD
```

retain the existing full branch-delta behavior:

```text
git diff --name-only <mergeBase>...HEAD
```

This preserves multi-commit PR coverage and is why an unconditional `HEAD~1` fallback remains forbidden.

## 4.2 Current-main push mode

When:

```text
mergeBase == HEAD
```

resolve the pushed commit's first parent and inspect the actual pushed tree delta:

```text
parent = git rev-parse HEAD^1
git diff --name-only <parent>..HEAD
```

This is permitted only after positively establishing `mergeBase == HEAD`; it is not a generic branch fallback.

For the current merge-commit main baseline, this range represents exactly the files introduced by the merge commit relative to previous main.

For a future ordinary single-parent direct push to main, it represents that pushed commit's delta.

If `HEAD^1` cannot be resolved in current-main mode, the guard must fail closed with an explicit error; it must not silently PASS.

Alternative implementation using reliable GitHub push-event `before` metadata is acceptable only if it also has a deterministic local/non-GitHub fallback and dedicated tests. Simpler first-parent current-main handling is preferred unless execution evidence shows a flaw.

---

# 5. Do not mutate the governance policy itself

The purpose of this task is range resolution, not policy redesign.

Unless independently justified and re-authorized, keep unchanged:

```text
forbiddenPrefixes
authorizedBugfixes
per-file forbidden-path assertions
```

In particular, do not remove the existing approved `PrimaryButton.tsx` / `LevelBadge.tsx` entries merely because Phase 7 is frozen; that would be unrelated policy churn.

---

# 6. Required regression tests

The implementation must prove the resolver semantics rather than merely making the current CI green.

At minimum add deterministic coverage for:

### Case A — PR multi-commit delta

Model a history where:

```text
base --- A --- B   (feature HEAD)
```

and prove the chosen range contains all branch changes from the merge base through B, not only B's last commit.

### Case B — current-main merge push

Model:

```text
old-main ----- M   (HEAD == origin/main)
              /\
          feature
```

and prove the chosen range is `M^1..M`, non-empty, and includes the merge delta.

### Case C — current-main ordinary single-parent push

Prove `HEAD^1..HEAD` produces the direct pushed commit delta.

### Case D — forbidden path still fails

Provide a changed-file list containing at least one forbidden path not in the authorized list and prove the guard fails.

### Case E — authorized exception still passes

Provide an authorized exception and prove it is not rejected solely by a matching forbidden prefix.

### Case F — unresolved git ancestry fails closed

If neither a valid merge base nor a required parent can be resolved, prove the resolver throws an explicit fail-closed error.

Tests may be implemented by extracting pure range-selection logic plus small git integration fixtures, or by spawning temporary git repositories. Do not use mocks that merely restate the implementation without exercising git semantics.

---

# 7. Mandatory local gates

Run from the corrective Exact Head:

```text
pnpm lint
pnpm test
pnpm build
pnpm harness:deterministic
pnpm test:e2e
```

Record exact counts and skipped status honestly.

Because the guard itself is git-context-sensitive, additionally execute both relevant test files in two repository states if practical:

```text
1. feature branch / PR-like state where mergeBase != HEAD
2. clean current-main-like temporary git state where mergeBase == HEAD
```

The second proof is mandatory in some form; source inspection alone is insufficient.

---

# 8. PR and CI procedure

Create an implementation branch from exactly:

```text
0abdfa48825c43113ccaad090d8315aabb3f1a37
```

Suggested branch:

```text
fix/main-push-governance-delta-guards
```

Open a separate PR to `main`.

Do not mix Phase 8 planning, product code, or other cleanup.

The PR-triggered Exact-Head CI must be green and its `head_sha` must equal the reviewed corrective Exact Head.

Because this defect specifically occurs after merge, PR CI alone is not the final closure proof. The independent reviewer must review the PR and authorize merge first. After merge, the new main push CI must then be observed.

Final closure requires the post-merge main push CI to demonstrate that the two historical guards no longer fail merely because `origin/main == HEAD`.

If any new failure appears, classify it independently; do not blanket-waive it under the historical exception.

---

# 9. Evidence package

Before independent review, provide:

```text
branch
Exact Head SHA
base SHA
full changed-file list
full diff stat
implementation explanation
range resolver behavior for PR mode
range resolver behavior for current-main mode
regression test evidence
local gate exact counts
PR number/state
PR Exact-Head CI run ID / head SHA / jobs
```

No merge by execution AI.

After independent review authorizes merge, the reviewer will merge and inspect the main push CI.

---

# 10. Acceptance criteria

Pre-merge GO requires:

```text
P0 = 0
P1 = 0
P2 = 0
production drift = 0
workflow/dependency drift = 0
both governance guards retain fail-closed semantics
PR-mode full delta preserved
current-main mode resolves a meaningful non-empty range
forbidden drift still causes failure
Exact-Head PR CI = success
```

Post-merge final closure additionally requires:

```text
main push CI no longer fails at:
tests/phase5-quests-ui.test.tsx:259
tests/phase5-skills-ui.test.tsx:482
because of empty merge-base...HEAD range
```

Only then is the historical `KNOWN PUSH-TO-MAIN GOVERNANCE GUARD INCOMPATIBILITY` considered repaired.

Phase 7 remains `FINAL FROZEN` throughout this governance task.
