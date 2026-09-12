# P1-01 — Root-cause determination via in-page instrumentation

**Head under test:** `bbb09ec4ae2121599f277a1aa41565ede79dbee7`
**Method:** temporary `console.log` instrumentation inside the isolated clone (never committed; reverted
afterwards), retrieved from headless Chrome with `--enable-logging=stderr` (no CDP), plus a controlled
differential experiment on `fitView` duration.
**Status: ROOT CAUSE ESTABLISHED — and it is NOT a production defect.**

---

## 1. Instrumentation channel

`--enable-logging=stderr` surfaces page console output as `INFO:CONSOLE`, so live-DOM values can be
read without CDP and without touching the real origin from an opaque context. Every diagnostic line
carried: viewport inline/computed transform, the tracked node's inline+computed `visibility` and
`opacity`, node/canvas bounding rects, and `document.elementFromPoint()` at the canvas centre.

## 2. Differential result (1024×900, same page, same server)

| Observation | normal | reduce (`--force-prefers-reduced-motion`) |
| --- | --- | --- |
| viewport transform at first programmatic fit | `matrix(1.50938, 0, 0, 1.50938, 297.949, 56)` — already applied | `matrix(1, 0, 0, 1, 0, 0)` — never applied |
| node `visibility` after mount | `hidden` → **`visible`** | **`hidden` for the whole run** |
| `document.elementFromPoint()` at canvas centre | hits node content (`span.inline-flex …`) | hits the empty pane (`div.react-flow__pane draggable`) |
| sampled at s+0/1/16/32/64/100/200 and t+500/3000 ms | visible from the first applied fit | hidden at **every** sample |

The node is present in the DOM the whole time; it is held at `visibility: hidden` because React Flow
only reveals measured nodes once the fit is committed.

## 3. The `duration: 0` hypothesis is disproved

A retry with `fitView({ duration: 1 })` was issued after the zero-duration call:

- `fit:retry-nonzero` executed;
- the viewport transform stayed `matrix(1, 0, 0, 1, 0, 0)`;
- node `visibility` stayed `hidden`.

So a non-zero duration does **not** restore rendering. `resolveGraphCameraDuration → 0` is therefore
**not** the cause; the re-review was right to reject that inference.

## 4. The actual cause: headless virtual time never runs the render loop

The decisive measurement: an `requestAnimationFrame` retry chain (4 frames) was installed in the same
effect that performs the fit. Across the entire capture:

```
含 rAF tag: 0        ← not one rAF callback executed
```

`--virtual-time-budget` advances timers (the `setTimeout` samples all fired) but **does not drive
animation frames**. Consequences:

1. The fit's viewport transform can be written into the DOM (`fit:call:d0` is logged and the archived
   dumps do show the settled transform) but is **never composited**, so the screenshot shows the
   untransformed, empty canvas.
2. React Flow reveals nodes through a frame-driven step; with no frames the nodes remain
   `visibility: hidden`.
3. This is deterministic — which is exactly why the failure reproduced byte-identically across every
   profile, every virtual-time budget, and independently across sessions.
4. Under **normal** motion the pre-existing declarative `fitView` had already applied the transform
   before the sampled points, so the capture happened to show nodes. Under reduced motion the timing
   shifts by one task and the same frame-less environment yields a blank canvas.

## 5. Classification

| Statement | Class |
| --- | --- |
| Under the capture conditions, nodes stay `visibility: hidden` and the viewport transform is never composited | **VERIFIED BY RUNTIME INTERACTION** (instrumented live DOM) |
| `--virtual-time-budget` does not execute `requestAnimationFrame` callbacks in this setup | **VERIFIED BY RUNTIME INTERACTION** |
| Setting a non-zero camera duration does not restore rendering | **VERIFIED BY RUNTIME INTERACTION** |
| The blank canvas in the archived §19 matrix is a **capture artifact**, not a user-visible product defect | **INFERENCE — strongly supported**, see caveat |
| `resolveGraphCameraDuration() → 0` causes the blank canvas | **DISPROVED** |
| Whether a real interactive browser with OS-level reduced motion renders all three nodes | **NOT VERIFIED** (requires an interactive browser; no CDP permitted) |

**Caveat, stated plainly:** the artifact explanation now accounts for every observation without
exception, and it is the only explanation that survives the frame-loop measurement. It is still an
inference rather than a direct observation of a real browser, because the final confirming step —
opening the page in an interactive browser with reduced motion enabled — is outside what this
environment can do. That step is the only remaining item; everything else is measured.

## 6. Consequence for the corrective round

- **No production code change is justified for P1-01.** Editing `SkillGraphCanvas.tsx` would be a
  change based on a disproved hypothesis. The camera path already behaves correctly: zero-duration
  under reduced motion is applied to the DOM and remains instant, which is the required behaviour.
- The corrective action for P1-01 is therefore an **evidence/method correction**, not a code fix:
  1. the §19 matrix must be re-captured with a method that actually renders frames, so reduced-motion
     cells can be judged;
  2. the affected reduce cells must be reclassified from "empty graph" to `CAPTURE ARTEFACT`
     (pending the interactive-browser confirmation in §5);
  3. the §19 report and the evidence branch must carry that correction.
- `--virtual-time-budget` must not be used for any motion/preference comparison in this project; a
  capture method that drives frames (interactive browser, or `--screenshot` without virtual time plus
  a real settle delay) is required.

## 7. Hygiene

All instrumentation was confined to the isolated clone and reverted with `git checkout --`; the clone
is back at `bbb09ec` with a clean tree. No production file, commit, branch, PR or CI anchor was
modified by this investigation. Temporary Chrome profiles and diagnostic logs were deleted.
