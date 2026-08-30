# Global Visual Acceptance Gates & Quality Matrix

> **Document**: `09_GLOBAL_VISUAL_ACCEPTANCE_GATES.md`  
> **Status**: DESIGN FREEZE CANDIDATE — REVIEW PENDING  
> **Milestone**: Global Visual Design Freeze  
> **Dependencies**: Stage 0–6 (FROZEN), Stage 7A/7B (FROZEN), `01_GLOBAL_VISUAL_DIRECTION.md` to `08_PAGE_MIGRATION_PLAN.md`

---

## 1. Acceptance Gates Matrix

| Gate | Gate Name | Verification Criteria | Review Status |
| :--- | :--- | :--- | :--- |
| **Gate V1** | **Visual Identity & Philosophy** | Aesthetic Triad defined (Eastern Growth × Modern AI × Calm RPG); 6 forbidden anti-patterns codified; atmospheric ink-wash baseline specified. | `[x]` SPECIFIED — REVIEW PENDING |
| **Gate V2** | **Formal Design Tokens** | Sole style-numeric authority established in `02_DESIGN_TOKENS.md`; 4-tier surface opacities, 5 glass blur presets, Ancient Gold whitelist, Copper Ochre Activity tokens, functional state tokens, spatial/layout dimensions. | `[x]` SPECIFIED — REVIEW PENDING |
| **Gate V3** | **Global App Shell** | 6 shell zones specified (`AppEnvironment`, `AppSidebar`, `AppHeader`, `AppWorkspace`, `InspectorDrawer`, `ModalLayer`); Tailwind v4 mobile-first layout matrix locked; no unbacked realm titles. | `[x]` SPECIFIED — REVIEW PENDING |
| **Gate V4** | **Shared UI Primitives** | Universal component catalog specified (`GlassPanel`, `RPGCard`, `StatCard`, `LevelBadge`, `MasteryBadge` [M0–M10 5-diamond meter], `ConfidenceBadge` [3 variants], `XPProgress`, `PrimaryButton`, etc.); anti-duplication rule enforced. | `[x]` SPECIFIED — REVIEW PENDING |
| **Gate V5** | **Entity Visual Semantics** | Invariants enforced: Domain $\ne$ Skill, Skill $\ne$ Knowledge, Level $\ne$ Mastery (M0–M10), Mastery $\ne$ Confidence, Confidence $\ne$ Truth, Artifact $\ne$ Evidence, Authority Status $\ne$ Archive; 5 Knowledge edge types vs. 4 Artifact relation types separated. | `[x]` SPECIFIED — REVIEW PENDING |
| **Gate V6** | **Responsive Viewport Model** | Mobile-first breakpoint behavior locked (Base, `md`, `lg`, `xl` defined in `02_DESIGN_TOKENS.md`); mobile bottom bar, full-screen drawer sheet, and graph LOD rendering codified. | `[x]` SPECIFIED — REVIEW PENDING |
| **Gate V7** | **Accessibility & Composited Contrast** | Composited contrast methodology locked ($\ge 7:1$ primary, $\ge 4.5:1$ normal); atmospheric veil protection; focus ring (`var(--focus-ring-width)` solid `var(--focus-ring-color)`); `@media (prefers-reduced-motion)` protocol locked. | `[x]` SPECIFIED — REVIEW PENDING |
| **Gate V8** | **Layered Migration Plan** | 7-phase implementation roadmap defined; Tailwind v4 `@theme` architecture specified; frontend allowlist and strict backend denylist (`src/app/api/**`, `supabase/**`, `src/lib/store/**`, `src/lib/ai/**`, `src/lib/growth-engine/**`, `0041`, `0042`) codified. | `[x]` SPECIFIED — REVIEW PENDING |

---

## 2. Explicit Prohibitions & Governance Invariants

During all subsequent visual and UI implementation phases, the following practices are strictly prohibited and will cause immediate review failure:

1. **PROHIBITION 1: Page-Specific Ad-Hoc Tokens**: No component may declare private hex codes, arbitrary blur values, or uncalibrated opacity values outside `02_DESIGN_TOKENS.md`.
2. **PROHIBITION 2: Unreviewed Gradients & Neon Styling**: Cyberpunk cyan/magenta neons, generic SaaS purple gradients, and high-saturation rainbow colors are forbidden.
3. **PROHIBITION 3: Duplicated Structural Components**: No page may implement a custom slide-over drawer, custom modal backdrop, or custom card wrapper. All must reuse `InspectorDrawer`, `BaseModal`, and `RPGCard`.
4. **PROHIBITION 4: Business Logic in Visual Primitives**: Shared UI components must be pure presentational elements. Settlement transactions, state commits, and authority checks must remain in domain services.
5. **PROHIBITION 5: Backend & Domain Denylist Mutation**: No modifications are permitted under `src/app/api/**`, `supabase/**`, `src/lib/store/**`, `src/lib/ai/**`, `src/lib/growth-engine/**`, `0041_artifact_management_authority.sql`, or `0042_artifact_settlement_integration.sql`.
6. **PROHIBITION 6: Sacrificing Contrast for Artwork**: Background decorative landscapes must never render text unreadable. Atmospheric tint veils must maintain composited contrast compliance.
