# Formal Design Tokens Specification

> **Document**: `02_DESIGN_TOKENS.md`  
> **Status**: DESIGN FREEZE CANDIDATE — REVIEW PENDING  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md`  
> **Related Documents**: `03_GLOBAL_APP_SHELL.md`, `04_SHARED_COMPONENT_SYSTEM.md`, `05_ENTITY_VISUAL_LANGUAGE.md`

---

## 1. Single Style-Numeric Authority Rule & Exception Taxonomy

This document (`02_DESIGN_TOKENS.md`) serves as the **SOLE STYLE-NUMERIC VISUAL AUTHORITY** for all CSS and visual styling implementation values across the AI Personal Growth RPG.

### 1.1 Enforcement Principle
- **Zero Style Literals in UI Components**: No raw CSS style literals (`#hex`, `rgb(...)`, `rgba(...)`, raw `px`, raw `rem`, raw `ms`, raw `s`, `bg-white/*`, etc.) are permitted inside React components, page files, or auxiliary design specification documents. All UI code must consume semantic CSS custom properties (`var(--...)`) or Tailwind v4 theme utilities.
- **Canonical Definition Layer Exception**: This specification and its corresponding runtime stylesheets (`src/app/globals.css` / `src/styles/design-tokens.css`) constitute the intentional definition layer where raw style values are formally declared.

### 1.2 Allowed Non-Style Numeric Categories
The following numeric categories represent domain semantics, structural counts, or accessibility standards and are explicitly **NOT** style literals:
1. **Domain & Gamification Metrics**: Skill Mastery discrete ratings (`M0` to `M10`), Epistemic/Assessment confidence scores ($0.00$ to $1.00$, inferred $\le 0.95$), Quest progress percentages ($0$ to $100$), Artifact reusability scores ($0.00$ to $1.00$).
2. **Structural & Taxonomy Counts**: 5 Mastery diamond symbols, 5 Knowledge edge types, 5 Artifact relation accordions, 8 canonical Artifact taxonomy types, 4 Knowledge authority states, 6 AppShell zones.
3. **Engineering & Network Metadata**: HTTP status codes (200, 201, 400, 404, 409), test file counts, assertion totals, and Git commit references.
4. **Standards-Defined Accessibility Thresholds**: WCAG 2.1 contrast targets (e.g. $\ge 7:1$ AAA, $\ge 4.5:1$ AA, $\ge 3:1$ large text) and WCAG large text dimensional definitions ($18\text{pt} / 24\text{px}$ normal or $14\text{pt}$ bold).
5. **Standards-Driven Reduced-Motion Overrides**: Standard `@media (prefers-reduced-motion)` CSS reset directives ($0.01\text{ms}$).

---

## 2. Environmental, Surface & Structural Palette

### 2.1 Environmental Background & Veil
```css
:root {
  /* Environmental Backgrounds */
  --bg-deep-void: #0a0d12;
  --bg-ink-wash: #0f141c;
  --bg-veil-overlay: rgba(10, 13, 18, 0.88);

  /* Modal Backdrop Visual Surface (Separate from z-index) */
  --surface-modal-backdrop: rgba(5, 7, 10, 0.75);

  /* Translucent Glass Surfaces (4-Tier Opacity Hierarchy) */
  --surface-ground: rgba(15, 20, 28, 0.72);
  --surface-base: rgba(22, 29, 41, 0.82);
  --surface-raised: rgba(28, 37, 51, 0.90);
  --surface-overlay: rgba(34, 45, 62, 0.96);

  /* Glass Blur Presets */
  --glass-blur-sm: 4px;
  --glass-blur-md: 8px;
  --glass-blur-lg: 16px;
  --glass-blur-xl: 24px;
  --glass-blur-2xl: 40px;

  /* Neutral Borders & Surface Highlights */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-default: rgba(255, 255, 255, 0.14);
  --border-raised: rgba(255, 255, 255, 0.20);
  --border-highlight-top: rgba(255, 255, 255, 0.06);

  /* Interactive Neutral States (For generic cards/buttons/lists) */
  --surface-hover-neutral: rgba(255, 255, 255, 0.04);
  --border-hover-neutral: rgba(255, 255, 255, 0.24);

  /* Generic Selection States (Neutral, Non-Gold) */
  --selection-neutral-bg: rgba(255, 255, 255, 0.08);
  --selection-neutral-border: rgba(255, 255, 255, 0.35);
  --selection-neutral-text: #ffffff;
  --selection-neutral-indicator: #ffffff;
}
```

---

## 3. Accent, Progression Gold & Functional Colors

### 3.1 Ancient Gold Hierarchy (Strict Whitelist Usage)
*Ancient Gold is strictly reserved for: (1) Player Level, (2) XP progression milestones, (3) Skill Mastery on M0–M10 scale, (4) Primary affirmative actions, and (5) Global keyboard focus ring.*

```css
:root {
  /* Gold Progression Tiers */
  --gold-50: #fbf7ec;
  --gold-100: #f4ecce;
  --gold-200: #e8d79b;
  --gold-300: #e5c158;  /* High-tier Achievement / Accent Text */
  --gold-400: #d4af37;  /* Primary Ancient Gold Base */
  --gold-500: #c5a059;  /* Muted Antique Amber */
  --gold-600: #a3823c;
  --gold-700: #7b6228;
  --gold-800: #524018;
  --gold-900: #2d220a;

  /* Gold Luminescence & Focus */
  --border-gold-subtle: rgba(212, 175, 55, 0.20);
  --border-gold-strong: rgba(212, 175, 55, 0.50);
  --glow-gold-subtle: 0 0 12px rgba(212, 175, 55, 0.12);
  --glow-gold-focus: 0 0 20px rgba(212, 175, 55, 0.22);
  --glow-gold-breakthrough: 0 0 32px rgba(229, 193, 88, 0.35);
  --focus-ring-color: #d4af37;
}
```

### 3.2 Typography & Text Neutrals (Calibrated for Composited Contrast)
```css
:root {
  --text-primary: #f0f6fc;      /* 95% White - Target >= 7:1 on composited base */
  --text-secondary: #8b949e;    /* 75% Slate - Target >= 4.5:1 on composited base */
  --text-muted: #949ba4;        /* Adjusted neutral for metadata >= 4.5:1 */
  --text-disabled: #586069;     /* 38% Muted - Disabled actions (exempt) */
  --text-gold-accent: #e5c158;  /* High-tier Achievement Text */
  --text-inverse: #0d1117;      /* On Solid Gold/Accent Badges */
}
```

### 3.3 Functional Feedback States (Distinct from Entity Colors)
```css
:root {
  /* Functional Success */
  --state-success-bg: rgba(46, 160, 67, 0.12);
  --state-success-border: rgba(46, 160, 67, 0.35);
  --state-success-text: #3fb950;

  /* Functional Info */
  --state-info-bg: rgba(56, 139, 253, 0.12);
  --state-info-border: rgba(56, 139, 253, 0.35);
  --state-info-text: #58a6ff;

  /* Functional Warning */
  --state-warning-bg: rgba(210, 153, 34, 0.12);
  --state-warning-border: rgba(210, 153, 34, 0.35);
  --state-warning-text: #d29922;

  /* Functional Danger / Destructive Action */
  --state-danger-bg: rgba(248, 81, 73, 0.12);
  --state-danger-border: rgba(248, 81, 73, 0.35);
  --state-danger-text: #f85149;
  --state-danger-hover: rgba(248, 81, 73, 0.22);
}
```

### 3.4 Epistemic & Assessment Confidence Tokens (Dedicated Scale, Non-Gold)
```css
:root {
  /* High Confidence (>= 0.80) */
  --confidence-high-bg: rgba(46, 160, 67, 0.10);
  --confidence-high-border: rgba(46, 160, 67, 0.30);
  --confidence-high-text: #3fb950;

  /* Medium Confidence (0.50 - 0.79) - Dedicated Amber Neutral, NOT progression Gold */
  --confidence-medium-bg: rgba(219, 171, 9, 0.10);
  --confidence-medium-border: rgba(219, 171, 9, 0.30);
  --confidence-medium-text: #e3b341;

  /* Low Confidence (< 0.50) */
  --confidence-low-bg: rgba(139, 148, 158, 0.10);
  --confidence-low-border: rgba(139, 148, 158, 0.30);
  --confidence-low-text: #8b949e;
}
```

### 3.5 Knowledge Authority State Tokens
```css
:root {
  /* Verified Authority */
  --authority-verified-bg: rgba(63, 185, 80, 0.12);
  --authority-verified-border: rgba(63, 185, 80, 0.40);
  --authority-verified-text: #56d364;

  /* Inferred Authority */
  --authority-inferred-bg: rgba(63, 185, 80, 0.06);
  --authority-inferred-border: rgba(63, 185, 80, 0.25);
  --authority-inferred-text: #3fb950;

  /* Rejected Authority */
  --authority-rejected-bg: rgba(248, 81, 73, 0.08);
  --authority-rejected-border: rgba(248, 81, 73, 0.25);
  --authority-rejected-text: #f85149;

  /* Superseded Authority (Knowledge Domain) */
  --authority-superseded-bg: rgba(139, 148, 158, 0.08);
  --authority-superseded-border: rgba(139, 148, 158, 0.25);
  --authority-superseded-text: #8b949e;
}
```

### 3.6 Lifecycle Status Presentation Tokens (Complete 4-State Artifact & Global Coverage)
```css
:root {
  /* Active State */
  --status-active-bg: rgba(56, 139, 253, 0.10);
  --status-active-border: rgba(56, 139, 253, 0.30);
  --status-active-text: #58a6ff;

  /* Draft State */
  --status-draft-bg: rgba(139, 148, 158, 0.10);
  --status-draft-border: rgba(139, 148, 158, 0.30);
  --status-draft-text: #8b949e;

  /* Archived State (Separate from Superseded) */
  --status-archived-bg: rgba(110, 118, 129, 0.10);
  --status-archived-border: rgba(110, 118, 129, 0.25);
  --status-archived-text: #949ba4;

  /* Superseded State (Artifact Lifecycle - Separate from Knowledge Authority) */
  --status-superseded-bg: rgba(148, 155, 164, 0.10);
  --status-superseded-border: rgba(148, 155, 164, 0.30);
  --status-superseded-text: #949ba4;

  /* Pending State */
  --status-pending-bg: rgba(210, 153, 34, 0.10);
  --status-pending-border: rgba(210, 153, 34, 0.30);
  --status-pending-text: #d29922;

  /* Confirmed State */
  --status-confirmed-bg: rgba(46, 160, 67, 0.10);
  --status-confirmed-border: rgba(46, 160, 67, 0.30);
  --status-confirmed-text: #3fb950;
}
```

### 3.7 Domain Entity Tokens (6 Isolated Entity Palettes)
```css
:root {
  /* 1. Activity (Copper Ochre / 赭石暖铜) */
  --entity-activity-bg: rgba(224, 159, 86, 0.10);
  --entity-activity-border: rgba(224, 159, 86, 0.30);
  --entity-activity-text: #f0ad6b;

  /* 2. Skill (Ancient Gold / 墨金) - M0-M10 Mastery */
  --entity-skill-bg: rgba(212, 175, 55, 0.10);
  --entity-skill-border: rgba(212, 175, 55, 0.30);
  --entity-skill-text: #e5c158;

  /* 3. Knowledge (Emerald Celadon / 青瓷青绿) */
  --entity-knowledge-bg: rgba(63, 185, 80, 0.10);
  --entity-knowledge-border: rgba(63, 185, 80, 0.30);
  --entity-knowledge-text: #56d364;

  /* 4. Quest (Azure Horizon / 天青苍蓝) */
  --entity-quest-bg: rgba(88, 166, 255, 0.10);
  --entity-quest-border: rgba(88, 166, 255, 0.30);
  --entity-quest-text: #79c0ff;

  /* 5. Artifact (Amethyst Scholar / 紫霄玉简) */
  --entity-artifact-bg: rgba(188, 140, 255, 0.10);
  --entity-artifact-border: rgba(188, 140, 255, 0.30);
  --entity-artifact-text: #d2a8ff;

  /* 6. Evidence (Vermilion Seal / 朱砂朱印) */
  --entity-evidence-bg: rgba(248, 81, 73, 0.10);
  --entity-evidence-border: rgba(248, 81, 73, 0.30);
  --entity-evidence-text: #ff7b72;
}
```

---

## 4. Structural, Spatial, Shape & Typography Tokens

### 4.1 Layout Dimensions & Shell Sizing
```css
:root {
  /* Shell Dimensions */
  --sidebar-width-expanded: 260px;
  --sidebar-width-collapsed: 72px;
  --mobile-nav-height: 64px;
  --header-height: 64px;

  /* Drawer Widths */
  --drawer-width-tablet: 420px;
  --drawer-width-desktop: 480px;
  --drawer-width-wide: 560px;
  --drawer-sheet-mobile-height: 92vh;

  /* Modal Constraints */
  --modal-max-width-sm: 480px;
  --modal-max-width-default: 600px;
  --modal-max-width-wide: 680px;
  --workspace-max-width: 1280px;

  /* Touch & Controls Sizing */
  --touch-target-min: 44px;
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
  --border-width-default: 1px;
  --indicator-width-active: 3px;
  --progress-track-height: 6px;

  /* Canvas Graph LOD Zoom Thresholds */
  --lod-zoom-compact: 0.6;
  --lod-zoom-standard: 1.2;
}
```

### 4.2 Spacing & Radius Scales
```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
}
```

### 4.3 Typography Scale & Font Weights
```css
:root {
  /* Font Families */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-serif: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', 'STSong', serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;

  /* Type Scale */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1.000rem; /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.250rem;   /* 20px */
  --text-2xl: 1.500rem;  /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.250rem;  /* 36px */

  /* Font Weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Leading & Tracking */
  --leading-tight: 1.25;
  --leading-normal: 1.50;
  --leading-relaxed: 1.75;
  --tracking-wide: 0.04em;
  --tracking-wider: 0.08em;
}
```

---

## 5. Layering & Elevation Tokens

```css
:root {
  --z-bg-env: 0;
  --z-bg-mask: 5;
  --z-canvas: 10;
  --z-card: 20;
  --z-app-shell: 50;
  --z-header: 60;
  --z-drawer: 80;
  --z-modal-backdrop: 90;
  --z-modal: 100;
  --z-toast: 120;
  --z-tooltip: 150;

  --shadow-card: 0 4px 20px rgba(0, 0, 0, 0.35);
  --shadow-raised: 0 8px 32px rgba(0, 0, 0, 0.45);
  --shadow-overlay: 0 16px 48px rgba(0, 0, 0, 0.65);
}
```

---

## 6. Interaction & Motion Tokens

```css
:root {
  /* Durations */
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-drawer: 250ms;
  --duration-drawer-mobile: 200ms;
  --duration-modal: 200ms;
  --duration-accordion: 200ms;
  --duration-xp-float: 600ms;
  --cycle-environment-mist: 60s;

  /* Motion Distances & Transforms */
  --distance-xp-float: -12px;
  --distance-modal-offset: 8px;
  --scale-modal-initial: 0.96;
  --hover-surface-elevation: translateY(-2px);
  --active-surface-depression: scale(0.985);

  /* Easing Curves */
  --ease-in-out-subtle: cubic-bezier(0.4, 0.0, 0.2, 1.0);
  --ease-out-gentle: cubic-bezier(0.0, 0.0, 0.2, 1.0);
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --ease-drawer: cubic-bezier(0.16, 1.0, 0.3, 1.0);
}
```

---

## 7. Tailwind CSS v4 Theme Architecture

```css
/* In src/app/globals.css */
@import "tailwindcss";

@theme {
  --breakpoint-md: 48rem;   /* 768px */
  --breakpoint-lg: 64rem;   /* 1024px */
  --breakpoint-xl: 90rem;   /* 1440px */

  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-serif: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', 'STSong', serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
}

@theme inline {
  --color-background: var(--bg-deep-void);
  --color-foreground: var(--text-primary);
}
```
