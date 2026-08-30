# Global Visual Acceptance Gates & Quality Matrix

> **Document**: `09_GLOBAL_VISUAL_ACCEPTANCE_GATES.md`  
> **Status**: DESIGN FREEZE CANDIDATE  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md` to `08_PAGE_MIGRATION_PLAN.md`

---

## 1. Acceptance Gates Matrix

| Gate | Gate Name | Verification Criteria | Status |
| :--- | :--- | :--- | :--- |
| **Gate V1** | **Visual Identity & Philosophy** | Aesthetic Triad defined (Eastern Growth × Modern AI × Calm RPG); 6 forbidden anti-patterns codified; atmospheric ink-wash baseline specified. | `[x]` FROZEN |
| **Gate V2** | **Formal Design Tokens** | Complete token inventory defined: CSS variables, 4-tier surface opacities, 5 glass blur presets, Ancient Gold tier scale, semantic colors, spatial scales. | `[x]` FROZEN |
| **Gate V3** | **Global App Shell** | 6 shell zones specified (`AppEnvironment`, `AppSidebar`, `AppHeader`, `AppWorkspace`, `InspectorDrawer`, `ModalLayer`); responsive layout matrix locked. | `[x]` FROZEN |
| **Gate V4** | **Shared UI Primitives** | Universal component catalog specified (`GlassPanel`, `RPGCard`, `StatCard`, `LevelBadge`, `MasteryBadge`, `XPProgress`, `PrimaryButton`, etc.); anti-duplication rule enforced. | `[x]` FROZEN |
| **Gate V5** | **Entity Visual Semantics** | Invariants enforced: Domain $\ne$ Skill, Skill $\ne$ Knowledge, Level $\ne$ Mastery, Mastery $\ne$ Confidence, Artifact $\ne$ Evidence; unique icon/shape/color/badge per entity. | `[x]` FROZEN |
| **Gate V6** | **Responsive Viewport Model** | 4-tier breakpoint behavior locked (Mobile, Tablet, Desktop, Wide); mobile bottom bar, full-screen drawer sheet, and graph LOD rendering codified. | `[x]` FROZEN |
| **Gate V7** | **Accessibility & Contrast** | WCAG 2.1 AAA/AA contrast verified over glass; atmospheric veil guarantee; mandatory 2px gold focus ring; `@media (prefers-reduced-motion)` protocol locked. | `[x]` FROZEN |
| **Gate V8** | **Layered Migration Plan** | 7-phase implementation roadmap defined; Stage 7C UI gated on Design Freeze approval; strict zero-backend-mutation rule during UI migration. | `[x]` FROZEN |

---

## 2. Explicit Prohibitions & Governance Invariants

During all subsequent visual and UI implementation phases, the following practices are strictly prohibited and will cause immediate review failure:

1. **PROHIBITION 1: Page-Specific Ad-Hoc Tokens**: No component may declare private hex codes, arbitrary blur values, or uncalibrated opacity values outside `02_DESIGN_TOKENS.md`.
2. **PROHIBITION 2: Unreviewed Gradients & Neon Styling**: Cyberpunk cyan/magenta neons, generic SaaS purple gradients, and high-saturation rainbow colors are forbidden.
3. **PROHIBITION 3: Duplicated Structural Components**: No page may implement a custom slide-over drawer, custom modal backdrop, or custom card wrapper. All must reuse `InspectorDrawer`, `BaseModal`, and `RPGCard`.
4. **PROHIBITION 4: Business Logic in Visual Primitives**: Shared UI components must be pure presentational elements. Settlement transactions, state commits, and authority checks must remain in domain services.
5. **PROHIBITION 5: API / DB Alteration for UI Convenience**: No database migration or backend API route change may be made merely to simplify visual rendering.
6. **PROHIBITION 6: Sacrificing Contrast for Artwork**: Background decorative landscapes must never render text unreadable. Atmospheric tint veils must maintain WCAG AAA compliance.
