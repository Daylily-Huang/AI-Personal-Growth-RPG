# Phase 6 Round 3 Execution Manual

## Status

**Purpose:** surgical closure of the remaining independent-review blocker on PR #21.

**Repository:** `Daylily-Huang/AI-Personal-Growth-RPG`  
**PR:** `#21`  
**Branch:** `feature/phase6-knowledge-canvas`  
**Base SHA:** `a93e2bcada3eca63c3d69ecc633fd50df0f54e94`  
**Reviewed Head:** `e75db75c92683d006e7a651ea76c1bf679cb4a4b`

This is a **surgical Round 3**. Do not expand scope beyond the single remaining blocker and its regression coverage.

---

## 1. Remaining blocker

The Round 2 implementation closed the prior P1/P2 findings, but one governance violation remains:

```tsx
// src/app/knowledge/components/KnowledgeGraphCanvas.tsx
style: {
  width: cluster.width,
  height: cluster.height,
  zIndex: -1,
  pointerEvents: "none",
}
```

The frozen Phase 6 governance requires:

```text
Raw z-index in Phase 6 = 0
```

The current regression gate only catches Tailwind-like classes such as `z-10` and does **not** catch inline React style values such as `zIndex: -1`.

Therefore the current exact Head is **NO-GO** until both the production violation and the scanner blind spot are closed.

---

## 2. Required code fix

### 2.1 Remove the raw z-index value

File:

```text
src/app/knowledge/components/KnowledgeGraphCanvas.tsx
```

Requirement:

- eliminate the literal numeric `zIndex: -1` from Phase 6 production code;
- preserve cluster-background layering behavior;
- use an existing frozen design-system token or another governance-compliant implementation;
- do **not** introduce a new design token;
- do **not** edit `src/styles/design-tokens.css`;
- do **not** move the layering problem into another raw numeric `zIndex` location.

Preferred resolution:

- use an already-existing frozen z-layer token if ReactFlow accepts the value safely;
- otherwise restructure node/layer ordering so no raw numeric z-index is required.

Do not change graph semantics, clustering semantics, selection behavior, or node/edge authority behavior.

---

## 3. Required regression-gate fix

File:

```text
tests/phase6-knowledge-ui.test.tsx
```

Strengthen the existing Phase 6 source scanner so it rejects **both**:

```text
Tailwind/raw class z-index forms
z-10
-z-10
z-[999]

Inline/object numeric z-index forms
zIndex: -1
zIndex: 10
"zIndex": 10
'zIndex': -1
```

The test must fail if a raw numeric z-index is reintroduced anywhere under:

```text
src/app/knowledge/**
```

It must continue allowing tokenized z-index usage such as:

```text
z-[var(--z-canvas)]
```

Do not weaken the existing raw-hex, direct-gold, internal-link, dark-class, or frozen-path gates.

---

## 4. Scope boundary

### Authorized paths

Round 3 should normally modify only:

```text
src/app/knowledge/components/KnowledgeGraphCanvas.tsx
tests/phase6-knowledge-ui.test.tsx
docs/DesignSystem/PHASE6_ROUND3_EXECUTION.md
```

If implementation requires any other file, stop and prove why before changing it.

### Forbidden paths

Do not modify:

```text
src/app/api/**
src/lib/**
supabase/**
src/components/ui/**
src/components/layout/**
src/styles/design-tokens.css
src/app/dashboard/**
src/app/quests/**
src/app/skills/**
src/app/artifacts/**
src/proxy.ts
package.json
pnpm-lock.yaml
```

No dependency changes.

---

## 5. Invariants that must remain unchanged

```text
Knowledge authority ≠ Skill mastery
Knowledge confidence ≠ truth
XP ≠ mastery
Linked Skill Summary remains read-only and isolated
No fabricated Skill mastery / XP / confidence fallback
No backend or authority mutation in frontend presentation
No raw hex colors in Phase 6 production code
No raw z-index values in Phase 6 production code
No direct gold token misuse
No dark/neon/cyberpunk classes
No internal raw anchors
No Zap/Lightning visual
All knowledge edges remain static
contradicts and relates_to remain symmetric and non-directional
Single InspectorDrawer remains intact
BaseModal reuse remains intact
No shared primitive drift
No new dependency
```

---

## 6. Required tests and validation

After the surgical fix, run all of the following:

```bash
pnpm test
pnpm harness:deterministic
pnpm lint
pnpm tsc --noEmit
pnpm build
```

Then push the new commit to:

```text
feature/phase6-knowledge-canvas
```

Wait for the PR-triggered GitHub Actions run on the **new exact Head SHA**.

Required CI state:

```text
check: success
supabase-integration: success
```

For reporting:

- do not reuse CI from `e75db75c92683d006e7a651ea76c1bf679cb4a4b`;
- do not report skipped DB/E2E tests as passed;
- if the Supabase integration job actually executes DB-backed and E2E suites, report their real execution result separately.

---

## 7. Acceptance criteria

Round 3 is complete only when all of the following are true:

| Gate | Required state |
| --- | --- |
| Raw numeric `zIndex` under `src/app/knowledge/**` | 0 |
| Raw Tailwind/arbitrary z-index under `src/app/knowledge/**` | 0 |
| Tokenized frozen z-layer usage | allowed |
| Regression scanner catches inline numeric `zIndex` | PASS |
| Regression scanner still catches raw z classes | PASS |
| Raw hex | 0 |
| Direct gold misuse | 0 |
| Dark classes | 0 |
| Internal raw anchors | 0 |
| Zap/Lightning | 0 |
| Backend/domain/shared primitive delta | 0 |
| Dependency delta | 0 |
| `pnpm test` | PASS |
| deterministic harness | PASS |
| lint | PASS |
| TypeScript | PASS |
| production build | PASS |
| GitHub Actions on new exact Head | PASS |

---

## 8. Required completion report

Return only this concise report to the user/review AI:

```text
PHASE 6 — ROUND 3 COMPLETE
→ REQUEST INDEPENDENT REVIEW

Repository: Daylily-Huang/AI-Personal-Growth-RPG
PR: #21
Branch: feature/phase6-knowledge-canvas
Base SHA: a93e2bcada3eca63c3d69ecc633fd50df0f54e94
New Exact Head SHA: <sha>

Changed files:
- <file>
- <file>

Closure:
- raw z-index production violation: CLOSED
- raw z-index scanner blind spot: CLOSED

Local validation:
- pnpm test: <result>
- pnpm harness:deterministic: <result>
- pnpm lint: <result>
- pnpm tsc --noEmit: <result>
- pnpm build: <result>

GitHub Actions:
- run id: <id>
- exact head sha: <sha>
- check: <result>
- supabase-integration: <result>
- DB-backed tests: <executed/pass/skip accurately>
- E2E: <executed/pass/skip accurately>

No merge performed.
```

---

## 9. Prohibited shortcuts

```text
Do not hardcode another numeric zIndex.
Do not add a new z-index token.
Do not edit design-tokens.css.
Do not simply relax/remove the scanner.
Do not special-case KnowledgeGraphCanvas out of the scanner.
Do not touch backend/domain/shared UI code.
Do not add dependencies.
Do not merge PR #21 automatically.
Do not claim old CI as current CI.
```
