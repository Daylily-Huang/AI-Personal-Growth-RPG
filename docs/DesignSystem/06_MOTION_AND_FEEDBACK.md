# Motion, Transitions & Feedback System Specification

> **Document**: `06_MOTION_AND_FEEDBACK.md`  
> **Status**: DESIGN FREEZE CANDIDATE (ROUND 3 FINAL REVIEW)  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md`, `02_DESIGN_TOKENS.md`  
> **Related Documents**: `03_GLOBAL_APP_SHELL.md`, `04_SHARED_COMPONENT_SYSTEM.md`, `07_RESPONSIVE_AND_ACCESSIBILITY.md`

---

## 1. Motion Philosophy: Restrained & Causality-Driven

In the **AI Personal Growth RPG**, animation and motion serve strictly functional purposes: communicating causality, spatial orientation, state transitions, and milestone progression.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MOTION PRINCIPLES                             │
│                                                                         │
│   1. Restrained & Subtle (内敛微动) — Short tokenized durations         │
│   2. Causality-Driven (因果清晰) — Feedback directly tracks user action  │
│   3. Never Blocking (流畅无阻) — Non-modal animations never trap focus   │
│   4. Respects Accessibility (遵从减动) — Full prefers-reduced-motion     │
│   5. Zero Cutscenes (拒绝过场) — Routine actions complete instantaneously│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Interaction & State Transitions

### 2.1 Micro-Interactions

| Interaction | Duration Token | Easing Token | Visual Effect |
| :--- | :--- | :--- | :--- |
| **Card Hover** | `var(--duration-fast)` | `var(--ease-out-gentle)` | Elevation (`var(--hover-surface-elevation)`), entity-specific or neutral border illumination. |
| **Button Active/Press** | `var(--duration-instant)`| `var(--ease-in-out-subtle)`| Subtle depression (`var(--active-surface-depression)`), momentary brightness shift. |
| **Focus Ring** | `var(--duration-fast)` | `var(--ease-out-gentle)` | Focus ring (`var(--focus-ring-width)` solid `var(--focus-ring-color)`) with smooth alpha transition. |
| **Tab/Pill Selection** | `var(--duration-normal)`| `var(--ease-out-gentle)` | Sliding active indicator bar or neutral background pill highlight (`var(--selection-neutral-bg)`). |

---

### 2.2 Structural Panel Transitions

#### 1. Contextual Inspector Drawer
- **Action**: Slide-in from right viewport edge upon entity selection.
- **Duration**: `var(--duration-drawer)` on desktop, `var(--duration-drawer-mobile)` on mobile.
- **Easing**: `var(--ease-drawer)`.
- **Behavior**: Main workspace content smoothly compresses or darkens with a subtle backdrop veil.

#### 2. Modals & Dialog Overlays
- **Action**: Fade in backdrop (`var(--surface-modal-backdrop)`) + upward scale (`scale(var(--scale-modal-initial)) translateY(var(--distance-modal-offset)) -> scale(1) translateY(0)`).
- **Duration**: `var(--duration-modal)`.
- **Easing**: `var(--ease-out-gentle)`.

#### 3. Accordion Expand/Collapse
- **Action**: Smooth CSS grid height transition (`grid-template-rows: 0fr -> 1fr`).
- **Duration**: `var(--duration-accordion)`.
- **Easing**: `var(--ease-in-out-subtle)`.

---

## 3. RPG Milestone & Progression Feedback

### 3.1 XP Settlement & Numerical Counter
- **Trigger**: Confirmed assessment settlement or completed activity.
- **Animation**:
  - XP counter increments smoothly over `var(--duration-slow)` using tabular number ticker.
  - Global XP track flashes with a gentle gold pulse (`var(--glow-gold-subtle)`).
  - Floating `+XP` indicator gently floats upward by `var(--distance-xp-float)` and fades over `var(--duration-xp-float)`.

### 3.2 Level-Up Milestone
- **Trigger**: Player character achieves new progression level.
- **Animation**:
  - Octagonal level badge pulses with Ancient Gold halo (`var(--glow-gold-breakthrough)`).
  - Non-intrusive banner notification at top of screen (dismissible, never blocks interaction).

### 3.3 Skill Mastery & Evidence Grounding
- **Trigger**: Verified mastery progression on M0–M10 scale (e.g. `M2 -> M3`).
- **Animation**:
  - The newly mastered diamond pip transitions to solid gold (`var(--gold-400)`) with a discrete flash.
  - Graph node emits an interconnected edge pulse to adjacent dependent skills.

---

## 4. Accessibility & Reduced Motion Protocol

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- When `prefers-reduced-motion` is active:
  - All sliding drawers and scale effects are replaced with instant alpha opacity fades.
  - Background atmospheric mist animation is completely halted.
  - XP counter and progress meters update instantaneously without numerical ticking.
