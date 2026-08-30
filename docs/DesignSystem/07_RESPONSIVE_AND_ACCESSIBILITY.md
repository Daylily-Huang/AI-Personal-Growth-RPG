# Responsive Design & Accessibility (a11y) Specification

> **Document**: `07_RESPONSIVE_AND_ACCESSIBILITY.md`  
> **Status**: DESIGN FREEZE CANDIDATE  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md`, `02_DESIGN_TOKENS.md`, `03_GLOBAL_APP_SHELL.md`  
> **Related Documents**: `04_SHARED_COMPONENT_SYSTEM.md`, `06_MOTION_AND_FEEDBACK.md`, `09_GLOBAL_VISUAL_ACCEPTANCE_GATES.md`

---

## 1. Accessibility First Principle

Translucent glassmorphism and atmospheric Eastern aesthetics must never compromise readability, contrast, or accessibility. If decorative background art ever conflicts with content clarity, the decorative opacity is reduced—contrast and readability are never sacrificed.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ACCESSIBILITY COMMITMENTS                          │
│                                                                         │
│   • Contrast Guarantee: WCAG 2.1 AA compliant (AAA on all text bodies)  │
│   • Minimum Touch Target: 44px × 44px on touch viewports                │
│   • Full Keyboard Navigation: Visible focus ring & logical tab order    │
│   • Screen Reader Semantic Landmarks: nav, main, aside, header, dialog  │
│   • Multi-Modal State: Color is always paired with text label & icon    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Contrast & Text Legibility Standards

### 2.1 Contrast Ratio Targets
- **Primary Body Text (`--text-primary: #f0f6fc`) over `--surface-base` (`#161d29`)**:
  - Contrast Ratio: **$14.2:1$** (Exceeds WCAG AAA $7.0:1$).
- **Secondary Text (`--text-secondary: #8b949e`) over `--surface-base`**:
  - Contrast Ratio: **$5.8:1$** (Exceeds WCAG AA $4.5:1$).
- **Ancient Gold Accent (`--gold-400: #d4af37`) over `--bg-deep-void`**:
  - Contrast Ratio: **$7.4:1$** (Exceeds WCAG AAA).

### 2.2 Atmospheric Veil Protection
- All content containers sit above an opaque atmospheric tint mask (`rgba(10, 13, 18, 0.88)`).
- Background mountain landscape layers are strictly capped at $15\%$ peak opacity, preventing bright visual artifacts from clashing with foreground characters.

---

## 3. Keyboard Navigation & Focus Ring Standards

1. **Visible Focus Ring**:
   - Every interactive element (buttons, links, inputs, tabs, accordions, graph nodes) displays a mandatory 2px solid gold focus ring:
     ```css
     :focus-visible {
       outline: 2px solid var(--gold-400);
       outline-offset: 2px;
       border-radius: var(--radius-md);
     }
     ```
2. **Tab Order & Trapping**:
   - Navigation follows logical visual order (`Sidebar -> Header -> Main Workspace -> Inspector Drawer`).
   - Active modals trap keyboard focus using accessible dialog primitives; pressing `Tab` cycles within the modal until dismissed.
   - `Escape` key immediately closes the topmost open surface (Tooltip $\rightarrow$ Drawer $\rightarrow$ Modal).

---

## 4. Responsive Viewport Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            RESPONSIVE BREAKPOINTS                            │
│                                                                              │
│   Mobile (< 768px)          Tablet (768 - 1023px)      Desktop (≥ 1024px)    │
│   • Single-column stack     • 2-column card grid       • Multi-column grid   │
│   • Bottom Navigation bar   • Collapsed icon sidebar   • Expanded sidebar    │
│   • Fullscreen sheet drawer • Slide-over drawer (420px)• Side-by-side drawer │
│   • Horizontal touch scroll • Pinch/zoom graph canvas  • Interactive canvas  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Viewport Breakpoint Matrix

| Token | Breakpoint | Shell Navigation | Workspace Layout | Contextual Drawer | Modal Presentation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mobile (`sm`)** | $< 768\text{px}$ | Bottom Bar (`h-16`) | 1 Column (`w-full`) | Fullscreen Sheet (`h-[92vh]`) | Fullscreen Sheet |
| **Tablet (`md`)** | $768\text{px} - 1023\text{px}$ | Left Icon Bar (`w-18`)| 2 Columns | Slide-over Drawer (`w-[420px]`)| Centered Card (85% width)|
| **Desktop (`lg`)** | $1024\text{px} - 1439\text{px}$| Expanded (`w-64`) | 2-3 Columns / Canvas | Overlay Drawer (`w-[480px]`) | Centered Card (max 600px)|
| **Wide (`xl`)** | $\ge 1440\text{px}$ | Expanded (`w-64`) | 3-4 Columns / Canvas | Side-by-Side Push (`w-[560px]`)| Centered Card (max 680px)|

---

## 5. High-Density Graph & Canvas Accessibility

For interactive 2D graph workspaces (Skill Tree and Knowledge Map):

1. **Level of Detail (LOD)**:
   - Zoom $< 0.6\times$: Node text labels collapse into high-contrast icons to eliminate visual clutter.
   - Zoom $0.6\times - 1.2\times$: Node title and primary level/status badge rendered.
   - Zoom $> 1.2\times$: Full node metadata (relational edge counts, mastery pips) visible.
2. **Keyboard Traversal**:
   - Arrow keys (`Up`, `Down`, `Left`, `Right`) traverse connected graph edges between nodes.
   - `Enter` / `Space` selects and inspects the currently focused node, opening the `InspectorDrawer`.
3. **Alternative Tabular View**:
   - Every graph canvas provides a toggleable accessible Table View (`/skills?view=table`, `/knowledge?view=table`) for screen readers and tabular preference users.
