# Responsive Design & Accessibility (a11y) Specification

> **Document**: `07_RESPONSIVE_AND_ACCESSIBILITY.md`  
> **Status**: DESIGN FREEZE CANDIDATE — REVIEW PENDING  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md`, `02_DESIGN_TOKENS.md`, `03_GLOBAL_APP_SHELL.md`  
> **Related Documents**: `04_SHARED_COMPONENT_SYSTEM.md`, `06_MOTION_AND_FEEDBACK.md`, `09_GLOBAL_VISUAL_ACCEPTANCE_GATES.md`

---

## 1. Accessibility-First Architecture

Translucent glass surfaces and atmospheric ink aesthetics must never compromise readability, contrast, or assistive technology navigation. If decorative background art ever conflicts with text legibility, decorative opacity must be subdued—contrast and readability are never compromised.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ACCESSIBILITY COMMITMENTS                          │
│                                                                         │
│   • Composited Contrast Target: >= 7:1 on Primary, >= 4.5:1 on Normal   │
│   • Minimum Touch Target: var(--touch-target-min) on touch viewports    │
│   • Full Keyboard Navigation: Visible focus ring & logical tab order    │
│   • Screen Reader Semantic Landmarks: nav, main, aside, header, dialog  │
│   • Multi-Modal State: Color is always paired with text label & icon    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Composited Contrast & Text Legibility Standards

### 2.1 Composited Contrast Evaluation Methodology
Contrast ratios must **NEVER** be calculated assuming glass surfaces are opaque hex colors. Ratios must be evaluated strictly **AFTER COMPOSITING**:

$$\text{Foreground Text} \longrightarrow \text{Translucent Glass Surface} \longrightarrow \text{Atmospheric Veil Mask} \longrightarrow \text{Worst-Case Permitted Background}$$

### 2.2 Contrast Ratio Thresholds
1. **Primary Body Text (`var(--text-primary)`)**: Target $\ge 7:1$ (WCAG AAA) across all standard glass cards under worst-case background conditions.
2. **Normal Secondary & Metadata Text (`var(--text-secondary)`, `var(--text-muted)`)**: Target $\ge 4.5:1$ (WCAG AA).
3. **Large Text ($\ge 18\text{pt}$ / $24\text{px}$ normal or $\ge 14\text{pt}$ bold)**: Target $\ge 3:1$ (WCAG AA).
4. **Disabled / Inactive Controls (`var(--text-disabled)`)**: Visually subdued and exempt from $4.5:1$ requirement per WCAG 2.1.

---

## 3. Keyboard Navigation & Focus Ring Standards

1. **Mandatory Visible Focus Ring**:
   ```css
   :focus-visible {
     outline: var(--focus-ring-width) solid var(--focus-ring-color);
     outline-offset: var(--focus-ring-offset);
     border-radius: var(--radius-md);
   }
   ```
2. **Tab Order & Focus Trapping**:
   - Navigation follows logical visual order (`Sidebar -> Header -> Main Workspace -> Inspector Drawer`).
   - Active modals trap keyboard focus using accessible dialog primitives; pressing `Tab` cycles within the modal until dismissed.
   - `Escape` key immediately closes the topmost open surface (Tooltip $\rightarrow$ Drawer $\rightarrow$ Modal).

---

## 4. Responsive Viewport Architecture (Tailwind v4 Mobile-First)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            RESPONSIVE BREAKPOINTS                            │
│                                                                              │
│   Base (< md)               md (≥ md breakpoint)       lg (≥ lg breakpoint)  │
│   • Single-column stack     • 2-column card grid       • Multi-column grid   │
│   • Bottom Navigation bar   • Collapsed icon sidebar   • Expanded sidebar    │
│   • Fullscreen sheet drawer • Slide-over drawer        • Side-by-side drawer │
│   • Horizontal touch scroll • Pinch/zoom graph canvas  • Interactive canvas  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Viewport Breakpoint Matrix

| Breakpoint Tier (per `02_DESIGN_TOKENS.md`) | Shell Navigation | Workspace Layout | Contextual Drawer | Modal Presentation |
| :--- | :--- | :--- | :--- | :--- |
| **Base (Mobile)** | Bottom Bar (`var(--mobile-nav-height)`) | 1 Column (`w-full`) | Fullscreen Sheet (`height: var(--drawer-sheet-mobile-height)`) | Fullscreen Sheet |
| **`md` (Tablet)** | Left Icon Bar (`var(--sidebar-width-collapsed)`)| 2 Columns | Slide-over Drawer (`width: var(--drawer-width-tablet)`)| Centered Card (`max-width: var(--modal-max-width-sm)`)|
| **`lg` (Desktop)** | Expanded (`var(--sidebar-width-expanded)`) | 2-3 Columns / Canvas | Overlay Drawer (`width: var(--drawer-width-desktop)`) | Centered Card (`max-width: var(--modal-max-width-default)`)|
| **`xl` (Wide)** | Expanded (`var(--sidebar-width-expanded)`) | 3-4 Columns / Canvas | Side-by-Side Push (`width: var(--drawer-width-wide)`)| Centered Card (`max-width: var(--modal-max-width-wide)`)|

---

## 5. High-Density Graph & Canvas Accessibility

For interactive 2D graph workspaces (Skill Tree and Knowledge Map):

1. **Level of Detail (LOD)**:
   - Zoom $< \text{var(--lod-zoom-compact)}$: Node text labels collapse into high-contrast icons to eliminate visual clutter.
   - Zoom $\text{var(--lod-zoom-compact)} - \text{var(--lod-zoom-standard)}$: Node title and primary level/status badge rendered.
   - Zoom $> \text{var(--lod-zoom-standard)}$: Full node metadata (relational edge counts, M0–M10 mastery badge, confidence badge) visible.
2. **Keyboard Traversal**:
   - Arrow keys (`Up`, `Down`, `Left`, `Right`) traverse connected graph edges between nodes.
   - `Enter` / `Space` selects and inspects the currently focused node, opening the `InspectorDrawer`.
3. **Alternative Tabular View**:
   - Every graph canvas provides a toggleable accessible Table View (`/skills?view=table`, `/knowledge?view=table`) for screen readers and tabular preference users.
