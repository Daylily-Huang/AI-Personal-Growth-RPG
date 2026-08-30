# Formal Design Tokens Specification

> **Document**: `02_DESIGN_TOKENS.md`  
> **Status**: DESIGN FREEZE CANDIDATE (ROUND 2 REVIEW PENDING)  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md`  
> **Related Documents**: `03_GLOBAL_APP_SHELL.md`, `04_SHARED_COMPONENT_SYSTEM.md`, `05_ENTITY_VISUAL_LANGUAGE.md`

---

## 1. Single Numeric Authority Rule

This document (`02_DESIGN_TOKENS.md`) serves as the **SOLE NUMERIC VISUAL AUTHORITY** for all colors, opacities, blurs, spacings, radii, shadows, typography, and motion across the AI Personal Growth RPG.

- **Component Implementation Rule**: Zero arbitrary literal values (`#hex`, `rgb(...)`, `px`, etc.) inside React UI components or stylesheets. All components must reference semantic token variables or Tailwind v4 theme utility classes.
- **Single Source of Truth**: Any change to visual values must be performed exclusively in this document and mirrored directly into `src/app/globals.css` (or `src/styles/design-tokens.css`).

---

## 2. Color & Surface Tokens

### 2.1 Environmental & Surface Palette

```css
:root {
  /* Environmental Backgrounds */
  --bg-deep-void: #0a0d12;
  --bg-ink-wash: #0f141c;
  --bg-veil-overlay: rgba(10, 13, 18, 0.88);

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

  /* Interactive Neutral States (For generic cards/buttons) */
  --surface-hover-neutral: rgba(255, 255, 255, 0.04);
  --border-hover-neutral: rgba(255, 255, 255, 0.24);
}
```

### 2.2 Accent & Gold Hierarchy (Ancient Gold / 墨金体系)
*Strictly reserved for: Player Level, XP progression milestones, Skill Mastery (M0–M10), primary affirmative actions, and global focus ring.*

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

  /* Gold Borders & Luminescence */
  --border-gold-subtle: rgba(212, 175, 55, 0.20);
  --border-gold-strong: rgba(212, 175, 55, 0.50);
  --glow-gold-subtle: 0 0 12px rgba(212, 175, 55, 0.12);
  --glow-gold-focus: 0 0 20px rgba(212, 175, 55, 0.22);
  --glow-gold-breakthrough: 0 0 32px rgba(229, 193, 88, 0.35);
}
```

### 2.3 Typography & Text Neutrals (Calibrated for Composited Contrast)

```css
:root {
  --text-primary: #f0f6fc;      /* 95% White - Target >= 7:1 on composited base */
  --text-secondary: #8b949e;    /* 75% Slate - Target >= 4.5:1 on composited base */
  --text-muted: #949ba4;        /* Adjusted neutral for small metadata >= 4.5:1 */
  --text-disabled: #586069;     /* 38% Muted - Disabled actions (exempt from 4.5:1) */
  --text-gold-accent: #e5c158;  /* High-tier Achievement Text */
  --text-inverse: #0d1117;      /* On Solid Gold/Accent Badges */
}
```

### 2.4 Semantic Entity Tokens (Explicit Non-Overlapping Palette)

```css
:root {
  /* 1. Activity (Copper Ochre / 赭石暖铜) - Strictly distinct from Gold */
  --entity-activity-bg: rgba(224, 159, 86, 0.10);
  --entity-activity-border: rgba(224, 159, 86, 0.30);
  --entity-activity-text: #f0ad6b;

  /* 2. Skill (Ancient Gold / 墨金) - Capability & M0-M10 Mastery */
  --entity-skill-bg: rgba(212, 175, 55, 0.10);
  --entity-skill-border: rgba(212, 175, 55, 0.30);
  --entity-skill-text: #e5c158;

  /* 3. Knowledge (Emerald Celadon / 青瓷青绿) - Concept & Mental Models */
  --entity-knowledge-bg: rgba(63, 185, 80, 0.10);
  --entity-knowledge-border: rgba(63, 185, 80, 0.30);
  --entity-knowledge-text: #56d364;

  /* 4. Quest (Azure Horizon / 天青苍蓝) - Missions & Objectives */
  --entity-quest-bg: rgba(88, 166, 255, 0.10);
  --entity-quest-border: rgba(88, 166, 255, 0.30);
  --entity-quest-text: #79c0ff;

  /* 5. Artifact (Amethyst Scholar / 紫霄玉简) - Permanent Deliverables */
  --entity-artifact-bg: rgba(188, 140, 255, 0.10);
  --entity-artifact-border: rgba(188, 140, 255, 0.30);
  --entity-artifact-text: #d2a8ff;

  /* 6. Evidence (Vermilion Seal / 朱砂朱印) - Grounding Proof Records */
  --entity-evidence-bg: rgba(248, 81, 73, 0.10);
  --entity-evidence-border: rgba(248, 81, 73, 0.30);
  --entity-evidence-text: #ff7b72;
}
```

---

## 3. Spatial, Shape & Typography Tokens

### 3.1 Spacing & Radius Scales

| Token | CSS Variable | Value | Usage |
| :--- | :--- | :--- | :--- |
| `space-1` | `--space-1` | `4px` | Micro badge padding, icon gap |
| `space-2` | `--space-2` | `8px` | Inline tag gaps, tight margins |
| `space-3` | `--space-3` | `12px` | Compact button/card padding |
| `space-4` | `--space-4` | `16px` | Standard card internal padding |
| `space-6` | `--space-6` | `24px` | Section gutters, header padding |
| `space-8` | `--space-8` | `32px` | Page container padding, modal inset |
| `space-12` | `--space-12` | `48px` | Canvas outer margins |
| `radius-sm` | `--radius-sm` | `4px` | Small badges, sub-tags |
| `radius-md` | `--radius-md` | `8px` | Buttons, inputs, chips |
| `radius-lg` | `--radius-lg` | `12px` | Content cards, list items |
| `radius-xl` | `--radius-xl` | `16px` | Section panels, drawer containers |
| `radius-2xl`| `--radius-2xl`| `24px` | Modals, floating islands |

### 3.2 Typography Scale & Fallback Policy

```css
:root {
  /* Resilient font stack with mandatory system fallbacks */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-serif: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', 'STSong', serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;

  /* Scale */
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1.000rem; /* 16px */
  --text-lg: 1.125rem;   /* 18px */
  --text-xl: 1.250rem;   /* 20px */
  --text-2xl: 1.500rem;  /* 24px */
  --text-3xl: 1.875rem;  /* 30px */
  --text-4xl: 2.250rem;  /* 36px */

  /* Leading & Tracking */
  --leading-tight: 1.25;
  --leading-normal: 1.50;
  --leading-relaxed: 1.75;
  --tracking-wide: 0.04em;
  --tracking-wider: 0.08em;
}
```

---

## 4. Layering & Elevation Tokens

```css
:root {
  /* Z-Index Hierarchy */
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

  /* Box Shadows */
  --shadow-card: 0 4px 20px rgba(0, 0, 0, 0.35);
  --shadow-raised: 0 8px 32px rgba(0, 0, 0, 0.45);
  --shadow-overlay: 0 16px 48px rgba(0, 0, 0, 0.65);
}
```

---

## 5. Interaction & Motion Tokens

```css
:root {
  /* Transition Durations */
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;

  /* Easing Curves */
  --ease-in-out-subtle: cubic-bezier(0.4, 0.0, 0.2, 1.0);
  --ease-out-gentle: cubic-bezier(0.0, 0.0, 0.2, 1.0);
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);

  /* Interactive States */
  --focus-ring: 0 0 0 2px var(--gold-400);
  --hover-surface-elevation: translateY(-2px);
  --active-surface-depression: scale(0.985);
}
```

---

## 6. Responsive Breakpoint Contract (Tailwind v4 Mobile-First)

```css
/* Mobile-First Breakpoint Definitions */
/* Base (Mobile): < 768px */
/* md (Tablet): >= 768px */
/* lg (Desktop / Laptop): >= 1024px */
/* xl (Wide Desktop): >= 1440px */

@theme inline {
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1440px;
}
```
