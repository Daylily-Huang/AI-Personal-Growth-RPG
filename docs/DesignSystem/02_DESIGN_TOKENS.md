# Formal Design Tokens Specification

> **Document**: `02_DESIGN_TOKENS.md`  
> **Status**: DESIGN FREEZE CANDIDATE — REVIEW PENDING  
> **Milestone**: Global Visual Design Freeze  
> **Visual North Star**: Light-first Modern Eastern Ink-Wash (现代东方水墨)  
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

### 2.1 Environmental Background & Veil (Light Warm White & Mist Landscape)
```css
:root {
  /* Environmental Backgrounds */
  --bg-deep-void: #f7f6f2;
  --bg-ink-wash: #efece4;
  --bg-veil-overlay: rgba(247, 246, 242, 0.90);

  /* Modal Backdrop Visual Surface (Separate from z-index) */
  --surface-modal-backdrop: rgba(20, 24, 30, 0.45);

  /* Translucent Glass Surfaces (4-Tier Opacity Hierarchy) */
  --surface-ground: rgba(239, 236, 228, 0.70);
  --surface-base: rgba(255, 255, 255, 0.82);
  --surface-raised: rgba(255, 255, 255, 0.92);
  --surface-overlay: rgba(255, 255, 255, 0.98);

  /* Glass Blur Presets */
  --glass-blur-sm: 4px;
  --glass-blur-md: 8px;
  --glass-blur-lg: 16px;
  --glass-blur-xl: 24px;
  --glass-blur-2xl: 40px;

  /* Neutral Borders & Surface Highlights */
  --border-subtle: rgba(30, 36, 43, 0.07);
  --border-default: rgba(30, 36, 43, 0.12);
  --border-raised: rgba(30, 36, 43, 0.18);
  --border-highlight-top: rgba(255, 255, 255, 0.85);

  /* Interactive Neutral States (For generic cards/buttons/lists) */
  --surface-hover-neutral: rgba(30, 36, 43, 0.04);
  --border-hover-neutral: rgba(30, 36, 43, 0.25);

  /* Generic Selection States (Neutral, Non-Gold) */
  --selection-neutral-bg: rgba(71, 84, 103, 0.08);
  --selection-neutral-border: rgba(71, 84, 103, 0.45);
  --selection-neutral-text: #1c2127;
  --selection-neutral-indicator: #1c2127;
}
```

---

## 3. Accent, Progression Gold & Functional Colors

### 3.1 Ancient Gold Hierarchy (Strict Whitelist Usage)
*Ancient Gold is strictly reserved for: (1) Player Level, (2) XP progression milestones, (3) Skill Mastery on M0–M10 scale, (4) Primary affirmative actions, and (5) Global keyboard focus ring.*

```css
:root {
  /* Gold Progression Tiers */
  --gold-50: #fffdf5;
  --gold-100: #fef8e2;
  --gold-200: #faebba;
  --gold-300: #f2d87e;  /* High-tier Achievement / Accent Text */
  --gold-400: #d49a26;  /* Primary Ancient Warm Gold Base */
  --gold-500: #b88218;  /* Muted Antique Amber */
  --gold-600: #94660e;
  --gold-700: #734d08;
  --gold-800: #523504;
  --gold-900: #331f01;

  /* Gold Luminescence & Focus */
  --border-gold-subtle: rgba(184, 130, 24, 0.25);
  --border-gold-strong: rgba(184, 130, 24, 0.55);
  --glow-gold-subtle: 0 1px 3px rgba(184, 130, 24, 0.15);
  --glow-gold-focus: 0 0 0 3px rgba(212, 154, 38, 0.25);
  --glow-gold-breakthrough: 0 4px 16px rgba(184, 130, 24, 0.30);
  --focus-ring-color: #d49a26;
}
```

### 3.2 Typography & Text Neutrals (Calibrated for Composited Contrast)
```css
:root {
  --text-primary: #1c2127;      /* Deep Ink Charcoal - Target >= 7:1 on composited base */
  --text-secondary: #475467;    /* Slate Charcoal - Target >= 4.5:1 on composited base */
  --text-muted: #667085;        /* Muted Ink Wash for metadata >= 4.5:1 */
  --text-disabled: #98a2b3;     /* Muted disabled actions */
  --text-gold-accent: #9a6700;  /* Restrained Achievement / Accent Text */
  --text-inverse: #ffffff;      /* On Solid Gold/Dark Badges */
}
```

### 3.3 Functional Feedback States (Distinct from Entity Colors)
```css
:root {
  /* Functional Success */
  --state-success-bg: rgba(38, 128, 86, 0.08);
  --state-success-border: rgba(38, 128, 86, 0.30);
  --state-success-text: #166442;

  /* Functional Info */
  --state-info-bg: rgba(43, 114, 186, 0.08);
  --state-info-border: rgba(43, 114, 186, 0.30);
  --state-info-text: #185694;

  /* Functional Warning */
  --state-warning-bg: rgba(184, 120, 20, 0.08);
  --state-warning-border: rgba(184, 120, 20, 0.30);
  --state-warning-text: #8c5506;

  /* Functional Danger / Destructive Action */
  --state-danger-bg: rgba(204, 53, 41, 0.08);
  --state-danger-border: rgba(204, 53, 41, 0.30);
  --state-danger-text: #b32619;
  --state-danger-hover: rgba(204, 53, 41, 0.15);
}
```

### 3.4 Epistemic & Assessment Confidence Tokens (Dedicated Scale, Non-Gold)
```css
:root {
  /* High Confidence (>= 0.80) */
  --confidence-high-bg: rgba(38, 128, 86, 0.08);
  --confidence-high-border: rgba(38, 128, 86, 0.28);
  --confidence-high-text: #166442;

  /* Medium Confidence (0.50 - 0.79) - Dedicated Amber Neutral, NOT progression Gold */
  --confidence-medium-bg: rgba(184, 120, 20, 0.08);
  --confidence-medium-border: rgba(184, 120, 20, 0.28);
  --confidence-medium-text: #8c5506;

  /* Low Confidence (< 0.50) */
  --confidence-low-bg: rgba(102, 112, 133, 0.08);
  --confidence-low-border: rgba(102, 112, 133, 0.25);
  --confidence-low-text: #667085;
}
```

### 3.5 Knowledge Authority State Tokens
```css
:root {
  /* Verified Authority */
  --authority-verified-bg: rgba(38, 128, 86, 0.08);
  --authority-verified-border: rgba(38, 128, 86, 0.35);
  --authority-verified-text: #166442;

  /* Inferred Authority */
  --authority-inferred-bg: rgba(38, 128, 86, 0.04);
  --authority-inferred-border: rgba(38, 128, 86, 0.20);
  --authority-inferred-text: #1e7850;

  /* Rejected Authority */
  --authority-rejected-bg: rgba(204, 53, 41, 0.06);
  --authority-rejected-border: rgba(204, 53, 41, 0.22);
  --authority-rejected-text: #b32619;

  /* Superseded Authority (Knowledge Domain) */
  --authority-superseded-bg: rgba(102, 112, 133, 0.06);
  --authority-superseded-border: rgba(102, 112, 133, 0.22);
  --authority-superseded-text: #667085;
}
```

### 3.6 Lifecycle Status Presentation Tokens (Complete 4-State Artifact & Global Coverage)
```css
:root {
  /* Active State */
  --status-active-bg: rgba(43, 114, 186, 0.08);
  --status-active-border: rgba(43, 114, 186, 0.28);
  --status-active-text: #185694;

  /* Draft State */
  --status-draft-bg: rgba(102, 112, 133, 0.08);
  --status-draft-border: rgba(102, 112, 133, 0.25);
  --status-draft-text: #667085;

  /* Archived State (Separate from Superseded) */
  --status-archived-bg: rgba(102, 112, 133, 0.06);
  --status-archived-border: rgba(102, 112, 133, 0.20);
  --status-archived-text: #667085;

  /* Superseded State (Artifact Lifecycle - Separate from Knowledge Authority) */
  --status-superseded-bg: rgba(102, 112, 133, 0.08);
  --status-superseded-border: rgba(102, 112, 133, 0.25);
  --status-superseded-text: #667085;

  /* Pending State */
  --status-pending-bg: rgba(184, 120, 20, 0.08);
  --status-pending-border: rgba(184, 120, 20, 0.28);
  --status-pending-text: #8c5506;

  /* Confirmed State */
  --status-confirmed-bg: rgba(38, 128, 86, 0.08);
  --status-confirmed-border: rgba(38, 128, 86, 0.28);
  --status-confirmed-text: #166442;
}
```

### 3.7 Domain Entity Tokens (6 Isolated Low-Saturation Ink-Wash Palettes)
```css
:root {
  /* 1. Activity (Copper Ochre / 赭石暖铜) */
  --entity-activity-bg: rgba(196, 92, 46, 0.08);
  --entity-activity-border: rgba(196, 92, 46, 0.28);
  --entity-activity-text: #9c3d18;

  /* 2. Skill (Ancient Bronze Gold / 墨金) - M0-M10 Mastery */
  --entity-skill-bg: rgba(184, 130, 24, 0.08);
  --entity-skill-border: rgba(184, 130, 24, 0.28);
  --entity-skill-text: #8c5e08;

  /* 3. Knowledge (Emerald Celadon / 青瓷青绿) */
  --entity-knowledge-bg: rgba(38, 128, 86, 0.08);
  --entity-knowledge-border: rgba(38, 128, 86, 0.28);
  --entity-knowledge-text: #166442;

  /* 4. Quest (Azure Horizon / 天青苍蓝) */
  --entity-quest-bg: rgba(43, 114, 186, 0.08);
  --entity-quest-border: rgba(43, 114, 186, 0.28);
  --entity-quest-text: #185694;

  /* 5. Artifact (Amethyst Scholar / 紫霄玉简) */
  --entity-artifact-bg: rgba(122, 78, 179, 0.08);
  --entity-artifact-border: rgba(122, 78, 179, 0.28);
  --entity-artifact-text: #5c348f;

  /* 6. Evidence (Vermilion Seal / 朱砂朱印) */
  --entity-evidence-bg: rgba(194, 59, 39, 0.08);
  --entity-evidence-border: rgba(194, 59, 39, 0.28);
  --entity-evidence-text: #992615;
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

  --shadow-card: 0 1px 3px rgba(30, 36, 43, 0.06), 0 1px 2px rgba(30, 36, 43, 0.04);
  --shadow-raised: 0 4px 16px rgba(30, 36, 43, 0.08), 0 2px 4px rgba(30, 36, 43, 0.04);
  --shadow-overlay: 0 12px 32px rgba(30, 36, 43, 0.12), 0 4px 8px rgba(30, 36, 43, 0.06);
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
@import "../styles/design-tokens.css";

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
