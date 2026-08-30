# Formal Design Tokens Specification

> **Document**: `02_DESIGN_TOKENS.md`  
> **Status**: DESIGN FREEZE CANDIDATE  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md`  
> **Related Documents**: `03_GLOBAL_APP_SHELL.md`, `04_SHARED_COMPONENT_SYSTEM.md`, `05_ENTITY_VISUAL_LANGUAGE.md`

---

## 1. Token Architecture & Principles

All visual styling in **AI Personal Growth RPG** is strictly governed by design tokens mapped to CSS custom properties and Tailwind utility classes. Direct arbitrary hex codes, arbitrary margins/paddings, and uncalibrated blur values are forbidden in component files.

---

## 2. Color & Surface Tokens

### 2.1 Environmental & Surface Palette

```css
:root {
  /* Environmental Backgrounds */
  --bg-deep-void: #0a0d12;
  --bg-ink-wash: #0f141c;
  --bg-veil-overlay: rgba(10, 13, 18, 0.88);

  /* Translucent Glass Surfaces */
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

  /* Borders & Highlights */
  --border-subtle: rgba(255, 255, 255, 0.07);
  --border-default: rgba(255, 255, 255, 0.12);
  --border-gold-subtle: rgba(212, 175, 55, 0.18);
  --border-gold-strong: rgba(212, 175, 55, 0.45);
  --border-highlight-top: rgba(255, 255, 255, 0.06);
}
```

### 2.2 Accent & Gold Hierarchy (Ancient Gold / 墨金体系)

```css
:root {
  /* Gold Progression Tiers */
  --gold-50: #fbf7ec;
  --gold-100: #f4ecce;
  --gold-200: #e8d79b;
  --gold-300: #dbc268;
  --gold-400: #d4af37;  /* Primary Ancient Gold Base */
  --gold-500: #c5a059;  /* Muted Antique Amber */
  --gold-600: #a3823c;
  --gold-700: #7b6228;
  --gold-800: #524018;
  --gold-900: #2d220a;

  /* Restrained Gold Glows */
  --glow-gold-subtle: 0 0 12px rgba(212, 175, 55, 0.12);
  --glow-gold-focus: 0 0 20px rgba(212, 175, 55, 0.22);
  --glow-gold-breakthrough: 0 0 32px rgba(229, 193, 88, 0.35);
}
```

### 2.3 Typography & Text Neutrals

```css
:root {
  --text-primary: #f0f6fc;      /* 95% White - High Contrast Body & Headings */
  --text-secondary: #8b949e;    /* 75% Gray - Secondary Context & Labels */
  --text-muted: #6e7681;        /* 50% Slate - Subdued Timestamps & Metadata */
  --text-disabled: #484f58;     /* 35% Muted - Disabled Actions */
  --text-gold-accent: #e5c158;  /* High-tier Achievement Text */
  --text-inverse: #0d1117;      /* On Solid Gold/Accent Badges */
}
```

### 2.4 Semantic Entity Colors

```css
:root {
  /* 1. Skill / Capability (Ancient Gold) */
  --entity-skill-bg: rgba(212, 175, 55, 0.10);
  --entity-skill-border: rgba(212, 175, 55, 0.28);
  --entity-skill-text: #e5c158;

  /* 2. Knowledge / Concept (Emerald Celadon / 青瓷青绿) */
  --entity-knowledge-bg: rgba(63, 185, 80, 0.10);
  --entity-knowledge-border: rgba(63, 185, 80, 0.28);
  --entity-knowledge-text: #56d364;

  /* 3. Quest / Milestone (Azure Horizon / 天青苍蓝) */
  --entity-quest-bg: rgba(88, 166, 255, 0.10);
  --entity-quest-border: rgba(88, 166, 255, 0.28);
  --entity-quest-text: #79c0ff;

  /* 4. Artifact / Deliverable (Amethyst Scholar / 紫霄玉简) */
  --entity-artifact-bg: rgba(188, 140, 255, 0.10);
  --entity-artifact-border: rgba(188, 140, 255, 0.28);
  --entity-artifact-text: #d2a8ff;

  /* 5. Evidence / Grounding (Vermilion Seal / 朱砂朱印) */
  --entity-evidence-bg: rgba(248, 81, 73, 0.10);
  --entity-evidence-border: rgba(248, 81, 73, 0.28);
  --entity-evidence-text: #ff7b72;
}
```

---

## 3. Spatial, Typography & Shape Tokens

### 3.1 Spacing & Radius Scales

| Token | CSS Variable | Value | Purpose |
| :--- | :--- | :--- | :--- |
| `space-1` | `--space-1` | `4px` | Micro badge padding, icon gap |
| `space-2` | `--space-2` | `8px` | Tight inline grouping, tag margin |
| `space-3` | `--space-3` | `12px` | Compact card padding, button gap |
| `space-4` | `--space-4` | `16px` | Standard card internal padding |
| `space-6` | `--space-6` | `24px` | Section gutter, header margins |
| `space-8` | `--space-8` | `32px` | Page container padding, modal inset |
| `space-12` | `--space-12` | `48px` | Canvas outer margins |
| `radius-sm` | `--radius-sm` | `4px` | Small badges, sub-tags |
| `radius-md` | `--radius-md` | `8px` | Buttons, inputs, chips |
| `radius-lg` | `--radius-lg` | `12px` | Content cards, list items |
| `radius-xl` | `--radius-xl` | `16px` | Major section panels, drawers |
| `radius-2xl`| `--radius-2xl`| `24px` | Global modals, floating islands |

### 3.2 Typography Scale

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-serif: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;

  /* Type Scale */
  --text-xs: 0.75rem;    /* 12px - Footnotes, micro badges */
  --text-sm: 0.875rem;   /* 14px - UI labels, secondary metadata */
  --text-base: 1.000rem; /* 16px - Standard body text */
  --text-lg: 1.125rem;   /* 18px - Sub-section headers, card titles */
  --text-xl: 1.250rem;   /* 20px - Section headers */
  --text-2xl: 1.500rem;  /* 24px - Page titles */
  --text-3xl: 1.875rem;  /* 30px - Major feature headers */
  --text-4xl: 2.250rem;  /* 36px - Milestone / Hero statistics */

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
  --focus-ring: 0 0 0 2px rgba(212, 175, 55, 0.6);
  --hover-surface-elevation: translateY(-2px);
  --active-surface-depression: scale(0.985);
}
```
