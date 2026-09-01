import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { compile } from 'tailwindcss';

export const FROZEN_BACKEND_DENYLIST = [
  'src/app/api/',
  'supabase/',
  'src/lib/store/',
  'src/lib/ai/',
  'src/lib/growth-engine/',
  'src/lib/supabase/',
  'src/lib/http/',
  'src/lib/auth/',
  'src/proxy.ts',
  'src/types/artifact.ts',
  'src/lib/knowledge/authority-service.ts',
  'src/lib/knowledge/types.ts',
  'src/lib/skills/derived-state.ts',
  '0041_artifact_management_authority.sql',
  '0042_artifact_settlement_integration.sql',
];

export const VISUAL_PRESENTATION_HELPERS = [
  'src/lib/knowledge/graph-layout.ts',
  'src/lib/skills/layout.ts',
  'src/lib/ui-utils.ts',
];

export const VISUAL_MIGRATION_SURFACES = [
  'src/styles/',
  'src/components/',
  'public/assets/environment/',
  'docs/DesignSystem/',
  'tests/visual-foundation.test.ts',
  'tests/global-app-shell.test.tsx',
];

export function isVisualMigrationPath(filePath: string): boolean {
  // Explicitly approved presentation-only helpers
  if (VISUAL_PRESENTATION_HELPERS.some((helper) => filePath === helper || filePath.endsWith(helper))) {
    return true;
  }
  // src/app/** EXCEPT src/app/api/** is a visual/page presentation surface
  if (filePath.startsWith('src/app/') && !filePath.startsWith('src/app/api/')) {
    return true;
  }
  return VISUAL_MIGRATION_SURFACES.some(
    (prefix) => filePath.startsWith(prefix) || filePath.includes(prefix)
  );
}

export function isFrozenBackendViolation(filePath: string): boolean {
  return FROZEN_BACKEND_DENYLIST.some(
    (prefix) => filePath.startsWith(prefix) || filePath.includes(prefix)
  );
}

export interface VisualMigrationValidationResult {
  isVisualPR: boolean;
  violations: string[];
}

export function validateVisualMigrationDelta(changedFiles: string[]): VisualMigrationValidationResult {
  const isVisualPR = changedFiles.some((f) => isVisualMigrationPath(f));
  if (!isVisualPR) {
    return { isVisualPR: false, violations: [] };
  }
  const violations = changedFiles.filter((f) => isFrozenBackendViolation(f));
  return { isVisualPR: true, violations };
}

describe('Visual Foundation & Design Tokens Runtime Verification', () => {
  const rootDir = process.cwd();
  const tokensCssPath = path.resolve(rootDir, 'src/styles/design-tokens.css');
  const globalsCssPath = path.resolve(rootDir, 'src/app/globals.css');
  const tailwindConfigPath = path.resolve(rootDir, 'tailwind.config.ts');
  const tailwindConfigJsPath = path.resolve(rootDir, 'tailwind.config.js');
  const environmentAssetPath = path.resolve(rootDir, 'public/assets/environment/ink-landscape.svg');

  const tokensCss = fs.readFileSync(tokensCssPath, 'utf8');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');

  it('1. verifies that Tailwind v4 compiles non-circular font utilities (.font-sans, .font-serif, .font-mono)', async () => {
    // Assert globals.css does not contain circular same-name self references
    expect(globalsCss).not.toContain('--font-sans: var(--font-sans)');
    expect(globalsCss).not.toContain('--font-serif: var(--font-serif)');
    expect(globalsCss).not.toContain('--font-mono: var(--font-mono)');

    // Compile CSS through Tailwind v4 runtime compiler
    const compiler = await compile(globalsCss, {
      base: path.resolve(rootDir, 'src/app'),
      loadStylesheet: async (id, base) => {
        const fullPath = id.startsWith('.') ? path.resolve(base, id) : path.resolve(rootDir, 'node_modules', id, 'index.css');
        return {
          path: fullPath,
          content: fs.readFileSync(fullPath, 'utf8'),
          base: path.dirname(fullPath),
        };
      },
    });

    const compiledCss = compiler.build(['font-sans', 'font-serif', 'font-mono']);

    // Verify compiled utility classes exist
    expect(compiledCss).toContain('.font-sans');
    expect(compiledCss).toContain('.font-serif');
    expect(compiledCss).toContain('.font-mono');

    // Verify non-circular root/theme variable definitions exist in compiled output
    expect(compiledCss).toContain("--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif");
    expect(compiledCss).toContain("--font-serif: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', 'STSong', serif");
    expect(compiledCss).toContain("--font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace");
  });

  it('2. verifies that design-tokens.css exists and declares all required token categories', () => {
    // Environmental
    expect(tokensCss).toContain('--bg-deep-void: #0a0d12;');
    expect(tokensCss).toContain('--bg-ink-wash: #0f141c;');
    expect(tokensCss).toContain('--bg-veil-overlay: rgba(10, 13, 18, 0.88);');
    expect(tokensCss).toContain('--surface-modal-backdrop: rgba(5, 7, 10, 0.75);');

    // Surfaces & Glass blur
    expect(tokensCss).toContain('--surface-ground: rgba(15, 20, 28, 0.72);');
    expect(tokensCss).toContain('--surface-base: rgba(22, 29, 41, 0.82);');
    expect(tokensCss).toContain('--surface-raised: rgba(28, 37, 51, 0.90);');
    expect(tokensCss).toContain('--surface-overlay: rgba(34, 45, 62, 0.96);');
    expect(tokensCss).toContain('--glass-blur-sm: 4px;');
    expect(tokensCss).toContain('--glass-blur-2xl: 40px;');

    // Gold scale
    expect(tokensCss).toContain('--gold-400: #d4af37;');
    expect(tokensCss).toContain('--gold-300: #e5c158;');
    expect(tokensCss).toContain('--gold-500: #c5a059;');
    expect(tokensCss).toContain('--focus-ring-color: #d4af37;');

    // Typography
    expect(tokensCss).toContain('--text-primary: #f0f6fc;');
    expect(tokensCss).toContain('--text-secondary: #8b949e;');
    expect(tokensCss).toContain('--text-muted: #949ba4;');
    expect(tokensCss).toContain('--font-weight-semibold: 600;');
  });

  it('3. verifies that Tailwind v4 theme declares correct breakpoint variables in globals.css', () => {
    expect(globalsCss).toContain('@theme {');
    expect(globalsCss).toContain('--breakpoint-md: 48rem;');
    expect(globalsCss).toContain('--breakpoint-lg: 64rem;');
    expect(globalsCss).toContain('--breakpoint-xl: 90rem;');
    expect(globalsCss).toContain('@import "../styles/design-tokens.css";');
  });

  it('4. verifies that Artifact lifecycle superseded token exists separately from Knowledge authority superseded', () => {
    // Artifact lifecycle superseded
    expect(tokensCss).toContain('--status-superseded-bg:');
    expect(tokensCss).toContain('--status-superseded-border:');
    expect(tokensCss).toContain('--status-superseded-text: #949ba4;');

    // Knowledge authority superseded
    expect(tokensCss).toContain('--authority-superseded-bg:');
    expect(tokensCss).toContain('--authority-superseded-border:');
    expect(tokensCss).toContain('--authority-superseded-text: #8b949e;');

    // Assert they are distinct token identifiers
    expect(tokensCss).toMatch(/--status-superseded-text/);
    expect(tokensCss).toMatch(/--authority-superseded-text/);
  });

  it('5. verifies Gold whitelist governance and strictly asserts ONLY :focus-visible consumes Gold in global styles', () => {
    // 1. Declaration: Gold tokens are legitimately declared in design-tokens.css
    expect(tokensCss).toContain('--gold-400: #d4af37;');
    expect(tokensCss).toContain('--entity-skill-text: #e5c158;');

    // 2. Non-gold tokens do not alias or consume Gold
    expect(tokensCss).toContain('--entity-activity-text: #f0ad6b;');
    expect(tokensCss).not.toMatch(/--entity-activity-text:\s*#d4af37/);
    expect(tokensCss).not.toMatch(/--entity-activity-text:\s*var\(--gold/);

    expect(tokensCss).toContain('--selection-neutral-bg: rgba(255, 255, 255, 0.08);');
    expect(tokensCss).toContain('--selection-neutral-border: rgba(255, 255, 255, 0.35);');
    expect(tokensCss).toContain('--selection-neutral-text: #ffffff;');
    expect(tokensCss).not.toMatch(/--selection-neutral-[^:]+:\s*#d4af37/);

    expect(tokensCss).toContain('--confidence-medium-text: #e3b341;'); // Dedicated amber neutral, not gold
    expect(tokensCss).toContain('--state-danger-text: #f85149;');
    expect(tokensCss).not.toMatch(/--confidence-medium-text:\s*#d4af37/);

    // 3. Scan globals.css rules: verify that ONLY :focus-visible consumes Gold variables/colors
    const rulesOnly = globalsCss
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/@theme\s+inline\s*\{[\s\S]*?\}/g, '')
      .replace(/@theme\s*\{[\s\S]*?\}/g, '');

    const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
    let match;
    const goldConsumingSelectors: string[] = [];

    while ((match = ruleRegex.exec(rulesOnly)) !== null) {
      const selector = match[1].trim();
      const declarations = match[2].trim();
      if (
        declarations.includes('--gold') ||
        declarations.includes('--focus-ring-color') ||
        declarations.includes('#d4af37')
      ) {
        goldConsumingSelectors.push(selector);
      }
    }

    // Strictly assert ONLY :focus-visible consumes Gold in globals.css
    expect(goldConsumingSelectors).toEqual([':focus-visible']);
  });

  it('6. verifies that global focus-visible baseline does not force border-radius on components', () => {
    const focusBlockMatch = globalsCss.match(/:focus-visible\s*\{([^}]+)\}/);
    expect(focusBlockMatch).not.toBeNull();
    const focusBlock = focusBlockMatch![1];
    expect(focusBlock).toContain('outline: var(--focus-ring-width) solid var(--focus-ring-color);');
    expect(focusBlock).toContain('outline-offset: var(--focus-ring-offset);');
    expect(focusBlock).not.toContain('border-radius');
  });

  it('7. verifies that no phantom tailwind.config.ts or tailwind.config.js exists', () => {
    expect(fs.existsSync(tailwindConfigPath)).toBe(false);
    expect(fs.existsSync(tailwindConfigJsPath)).toBe(false);
  });

  it('8. verifies that reduced-motion global reset is declared in globals.css', () => {
    expect(globalsCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globalsCss).toContain('animation-duration: 0.01ms !important;');
    expect(globalsCss).toContain('transition-duration: 0.01ms !important;');
  });

  it('9. verifies that environment SVG is pure geometry/silhouette with ZERO private color, gradient, or opacity constants', () => {
    expect(fs.existsSync(environmentAssetPath)).toBe(true);
    const svgContent = fs.readFileSync(environmentAssetPath, 'utf8');

    // Structural SVG integrity
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('aria-hidden="true"');

    // Accessibility cleanup: purely decorative, no role="img" when aria-hidden="true"
    expect(svgContent).not.toContain('role="img"');

    // Zero hex color codes (#xxx, #xxxxxx, #xxxxxxxx)
    expect(svgContent).not.toMatch(/#[0-9a-fA-F]{3,8}/);

    // Zero rgb or rgba values
    expect(svgContent).not.toMatch(/rgba?\(/);

    // Zero gradient definitions or stops
    expect(svgContent).not.toContain('<linearGradient');
    expect(svgContent).not.toContain('<radialGradient');
    expect(svgContent).not.toContain('<stop');

    // Zero raw opacity attributes
    expect(svgContent).not.toMatch(/\s+opacity\s*=/);
    expect(svgContent).not.toMatch(/\s+fill-opacity\s*=/);
    expect(svgContent).not.toMatch(/\s+stroke-opacity\s*=/);

    // Zero inline style attributes or <style> blocks
    expect(svgContent).not.toMatch(/\s+style\s*=/);
    expect(svgContent).not.toContain('<style');

    // Uses currentColor for CSS-driven styling
    expect(svgContent).toContain('fill="currentColor"');

    // Zero embedded text or external font/network imports
    expect(svgContent).not.toContain('<text');
    expect(svgContent).not.toContain('@import');
  });

  it('10. verifies live PR delta in pull_request CI: visual migration contains zero frozen backend violations', () => {
    const isPullRequest =
      process.env.GITHUB_EVENT_NAME === 'pull_request' ||
      Boolean(process.env.GITHUB_BASE_REF);

    if (!isPullRequest) {
      // In push-to-main or non-PR event, PR delta assertion is not applicable
      // Post-merge push-to-main CI will NOT fail because changedFiles is empty
      expect(true).toBe(true);
      return;
    }

    const baseRef = process.env.GITHUB_BASE_REF || 'main';
    let changedFiles: string[] = [];

    const diffCommands = [
      `git diff --name-only origin/${baseRef}...HEAD`,
      `git diff --name-only ${baseRef}...HEAD`,
      `git diff --name-only origin/${baseRef} HEAD`,
      `git diff --name-only ${baseRef} HEAD`,
    ];

    let diffSucceeded = false;
    let lastError: Error | null = null;

    for (const cmd of diffCommands) {
      try {
        const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        changedFiles = output.split('\n').map((s) => s.trim()).filter(Boolean);
        diffSucceeded = true;
        break;
      } catch (err) {
        lastError = err as Error;
      }
    }

    // In an actual pull_request event, diff resolution MUST fail closed if base comparison fails
    if (!diffSucceeded) {
      throw new Error(`[Fail-Closed] Failed to resolve PR changed files against base '${baseRef}': ${lastError?.message}`);
    }

    const result = validateVisualMigrationDelta(changedFiles);
    if (result.isVisualPR) {
      expect(result.violations).toEqual([]);
    }
  });

  it('11. verifies unit correctness of visual migration delta validation for visual-only PRs', () => {
    const visualOnlyDelta = [
      'src/styles/design-tokens.css',
      'src/app/globals.css',
      'public/assets/environment/ink-landscape.svg',
      'tests/visual-foundation.test.ts',
    ];
    const result = validateVisualMigrationDelta(visualOnlyDelta);
    expect(result.isVisualPR).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('12. verifies unit rejection when visual PR delta contains frozen backend API or DB files', () => {
    const visualPlusBackendDelta = [
      'src/components/AppShell.tsx',
      'src/app/globals.css',
      'src/app/api/activities/route.ts',
      'supabase/migrations/0041_artifact_management_authority.sql',
    ];
    const result = validateVisualMigrationDelta(visualPlusBackendDelta);
    expect(result.isVisualPR).toBe(true);
    expect(result.violations).toEqual([
      'src/app/api/activities/route.ts',
      'supabase/migrations/0041_artifact_management_authority.sql',
    ]);
  });

  it('13. verifies unit rejection when visual PR delta contains frozen Knowledge or Skill domain authority modules', () => {
    const visualPlusDomainAuthorityDelta = [
      'src/styles/design-tokens.css',
      'src/lib/knowledge/authority-service.ts',
      'src/lib/knowledge/types.ts',
      'src/lib/skills/derived-state.ts',
    ];
    const result = validateVisualMigrationDelta(visualPlusDomainAuthorityDelta);
    expect(result.isVisualPR).toBe(true);
    expect(result.violations).toEqual([
      'src/lib/knowledge/authority-service.ts',
      'src/lib/knowledge/types.ts',
      'src/lib/skills/derived-state.ts',
    ]);
  });

  it('14. verifies unit rejection when visual PR delta contains frozen Artifact domain types or proxy auth middleware', () => {
    const visualPlusArtifactProxyDelta = [
      'src/components/layout/AppShell.tsx',
      'src/types/artifact.ts',
      'src/proxy.ts',
    ];
    const result = validateVisualMigrationDelta(visualPlusArtifactProxyDelta);
    expect(result.isVisualPR).toBe(true);
    expect(result.violations).toEqual([
      'src/types/artifact.ts',
      'src/proxy.ts',
    ]);
  });

  it('15. verifies that approved presentation helpers alone are classified as visual migration without violations', () => {
    const graphLayoutDelta = ['src/lib/knowledge/graph-layout.ts'];
    const graphResult = validateVisualMigrationDelta(graphLayoutDelta);
    expect(graphResult.isVisualPR).toBe(true);
    expect(graphResult.violations).toEqual([]);

    const skillLayoutDelta = ['src/lib/skills/layout.ts'];
    const skillResult = validateVisualMigrationDelta(skillLayoutDelta);
    expect(skillResult.isVisualPR).toBe(true);
    expect(skillResult.violations).toEqual([]);
  });

  it('16. verifies unit rejection when presentation helper is combined with frozen backend or domain authority', () => {
    const helperPlusApiDelta = [
      'src/lib/knowledge/graph-layout.ts',
      'src/app/api/knowledge/route.ts',
    ];
    const helperApiResult = validateVisualMigrationDelta(helperPlusApiDelta);
    expect(helperApiResult.isVisualPR).toBe(true);
    expect(helperApiResult.violations).toEqual(['src/app/api/knowledge/route.ts']);

    const helperPlusDerivedStateDelta = [
      'src/lib/skills/layout.ts',
      'src/lib/skills/derived-state.ts',
    ];
    const helperDerivedResult = validateVisualMigrationDelta(helperPlusDerivedStateDelta);
    expect(helperDerivedResult.isVisualPR).toBe(true);
    expect(helperDerivedResult.violations).toEqual(['src/lib/skills/derived-state.ts']);
  });

  it('17. verifies that future visual PRs without design-tokens.css/globals.css pass cleanly', () => {
    const futureVisualPRDelta = [
      'src/components/AppShell.tsx',
      'src/components/Sidebar.tsx',
      'src/app/dashboard/page.tsx',
    ];
    const result = validateVisualMigrationDelta(futureVisualPRDelta);
    expect(result.isVisualPR).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('18. verifies that backend-only PRs are not misclassified as visual migration PRs', () => {
    const backendOnlyDelta = [
      'src/app/api/activities/route.ts',
      'supabase/migrations/0041_artifact_management_authority.sql',
    ];
    const result = validateVisualMigrationDelta(backendOnlyDelta);
    expect(result.isVisualPR).toBe(false);
    expect(result.violations).toEqual([]);
  });

  it('19. verifies that push-to-main or empty delta is not misclassified or failed', () => {
    const emptyDelta: string[] = [];
    const result = validateVisualMigrationDelta(emptyDelta);
    expect(result.isVisualPR).toBe(false);
    expect(result.violations).toEqual([]);
  });
});
