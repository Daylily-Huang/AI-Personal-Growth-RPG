# Motion, Transitions & Feedback System Specification

> **Document**: `06_MOTION_AND_FEEDBACK.md`  
> **Status**: DESIGN FREEZE CANDIDATE  
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
│   1. Restrained & Subtle (内敛微动) — Short durations (100ms - 300ms)    │
│   2. Causality-Driven (因果清晰) — Feedback directly tracks user action  │
│   3. Never Blocking (流畅无阻) — Non-modal animations never trap focus   │
│   4. Respects Accessibility (遵从减动) — Full prefers-reduced-motion     │
│   5. Zero Cutscenes (拒绝过场) — Routine actions complete instantaneously│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Interaction & State Transitions

### 2.1 Micro-Interactions

| Interaction | Duration | Easing | Visual Effect |
| :--- | :--- | :--- | :--- |
| **Card Hover** | `150ms` | `ease-out` | `translateY(-2px)` elevation, subtle gold border illumination (`border-gold-subtle`). |
| **Button Active/Press** | `100ms` | `ease-in-out` | `scale(0.985)` subtle depression, momentary brightness shift. |
| **Focus Ring** | `120ms` | `ease-out` | 2px gold focus ring with smooth alpha transition (`rgba(212, 175, 55, 0.6)`). |
| **Tab/Pill Selection** | `200ms` | `ease-out-gentle` | Sliding active indicator bar or soft background pill highlight. |

---

### 2.2 Structural Panel Transitions

#### 1. Contextual Inspector Drawer
- **Action**: Slide-in from right viewport edge upon entity selection.
- **Duration**: `250ms` on desktop, `200ms` on mobile.
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (Gentle deceleration curve).
- **Behavior**: Main workspace content smoothly compresses or darkens with a subtle backdrop veil.

#### 2. Modals & Dialog Overlays
- **Action**: Fade in backdrop (`rgba(5, 7, 10, 0.75)`) + slight upward scale (`scale(0.96) translateY(8px) -> scale(1) translateY(0)`).
- **Duration**: `200ms`.
- **Easing**: `cubic-bezier(0.0, 0.0, 0.2, 1.0)`.

#### 3. Accordion Expand/Collapse
- **Action**: Smooth CSS grid height transition (`grid-template-rows: 0fr -> 1fr`).
- **Duration**: `200ms`.
- **Easing**: `ease-in-out`.

---

## 3. RPG Milestone & Progression Feedback

### 3.1 XP Settlement & Numerical Counter
- **Trigger**: Confirmed assessment settlement or completed activity.
- **Animation**:
  - XP counter increments smoothly over `400ms` using tabular number ticker.
  - Global XP track flashes with a gentle gold pulse (`box-shadow: 0 0 16px rgba(212, 175, 55, 0.3)`).
  - Floating `+50 XP` indicator gently floats upward by `12px` and fades over `600ms`.

### 3.2 Level-Up Milestone
- **Trigger**: Player character achieves new progression level.
- **Animation**:
  - Octagonal level badge pulses with ancient gold halo over `500ms`.
  - Subtle environmental mist particles briefly converge toward the player status capsule.
  - Non-intrusive banner notification at top of screen (dismissible, never blocks interaction).

### 3.3 Skill Mastery & Evidence Grounding
- **Trigger**: Verified mastery increment (e.g. Level 2 $\rightarrow$ Level 3).
- **Animation**:
  - The newly mastered diamond pip (`◆`) transitions from hollow to solid gold with a crisp, discrete flash.
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
  - All sliding drawers and scale effects are replaced with instant alpha opacity fades ($0\text{ms} - 50\text{ms}$).
  - Background atmospheric mist animation is completely halted.
  - XP counter and progress meters update instantaneously without numerical ticking.
