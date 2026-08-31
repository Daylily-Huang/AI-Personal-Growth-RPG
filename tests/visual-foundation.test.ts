import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { compile } from 'tailwindcss';

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

  it('5. verifies Gold whitelist governance (Token Declaration vs Token Consumption)', () => {
    // 1. Declaration: Gold tokens are legitimately declared
    expect(tokensCss).toContain('--gold-400: #d4af37;');
    expect(tokensCss).toContain('--entity-skill-text: #e5c158;');

    // 2. Consumption: Activity uses Copper Ochre (#f0ad6b) and does not alias Gold
    expect(tokensCss).toContain('--entity-activity-text: #f0ad6b;');
    expect(tokensCss).not.toMatch(/--entity-activity-text:\s*#d4af37/);
    expect(tokensCss).not.toMatch(/--entity-activity-text:\s*var\(--gold/);

    // 3. Consumption: Generic selection is neutral white/translucent, never Gold
    expect(tokensCss).toContain('--selection-neutral-bg: rgba(255, 255, 255, 0.08);');
    expect(tokensCss).toContain('--selection-neutral-border: rgba(255, 255, 255, 0.35);');
    expect(tokensCss).toContain('--selection-neutral-text: #ffffff;');
    expect(tokensCss).not.toMatch(/--selection-neutral-[^:]+:\s*#d4af37/);

    // 4. Consumption: Functional confidence and danger states do not consume Gold
    expect(tokensCss).toContain('--confidence-medium-text: #e3b341;'); // Dedicated amber neutral, not gold
    expect(tokensCss).toContain('--state-danger-text: #f85149;');
    expect(tokensCss).not.toMatch(/--confidence-medium-text:\s*#d4af37/);

    // 5. Consumption in globals.css: ONLY :focus-visible consumes Gold
    expect(globalsCss).toContain('outline: var(--focus-ring-width) solid var(--focus-ring-color);');
    // Ensure ::selection does not consume Gold
    expect(globalsCss).toContain('background-color: var(--selection-neutral-bg);');
    expect(globalsCss).toContain('color: var(--selection-neutral-text);');
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

  it('9. verifies that environment SVG is pure geometry/silhouette with no private color palette authority', () => {
    expect(fs.existsSync(environmentAssetPath)).toBe(true);
    const svgContent = fs.readFileSync(environmentAssetPath, 'utf8');

    // Structural SVG integrity
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('aria-hidden="true"');

    // Accessibility cleanup: purely decorative, no role="img" when aria-hidden="true"
    expect(svgContent).not.toContain('role="img"');

    // No private color palettes or hex color declarations in SVG
    expect(svgContent).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(svgContent).not.toContain('<linearGradient');
    expect(svgContent).not.toContain('<stop');

    // Uses currentColor for CSS-driven styling
    expect(svgContent).toContain('fill="currentColor"');

    // No text or external font dependencies
    expect(svgContent).not.toContain('<text');
    expect(svgContent).not.toContain('@import');
  });

  it('10. verifies deterministic git path guard: zero frozen backend paths modified', () => {
    const frozenBackendPrefixes = [
      'src/app/api/',
      'supabase/',
      'src/lib/store/',
      'src/lib/ai/',
      'src/lib/growth-engine/',
      '0041_artifact_management_authority.sql',
      '0042_artifact_settlement_integration.sql',
    ];

    // Get list of changed files relative to main branch
    let changedFiles: string[] = [];
    try {
      const output = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' });
      changedFiles = output.split('\n').map((s) => s.trim()).filter(Boolean);
    } catch {
      try {
        const output = execSync('git diff --name-only main...HEAD', { encoding: 'utf8' });
        changedFiles = output.split('\n').map((s) => s.trim()).filter(Boolean);
      } catch {
        // Fallback to git status check
        const output = execSync('git status --porcelain', { encoding: 'utf8' });
        changedFiles = output.split('\n').map((s) => s.trim().slice(3)).filter(Boolean);
      }
    }

    const violatedFiles = changedFiles.filter((filePath) =>
      frozenBackendPrefixes.some((prefix) => filePath.startsWith(prefix) || filePath.includes(prefix))
    );

    expect(violatedFiles).toEqual([]);
  });
});
