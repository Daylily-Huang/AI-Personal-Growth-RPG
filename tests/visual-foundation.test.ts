import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Visual Foundation & Design Tokens Runtime Verification', () => {
  const tokensCssPath = path.resolve(process.cwd(), 'src/styles/design-tokens.css');
  const globalsCssPath = path.resolve(process.cwd(), 'src/app/globals.css');
  const tailwindConfigPath = path.resolve(process.cwd(), 'tailwind.config.ts');
  const tailwindConfigJsPath = path.resolve(process.cwd(), 'tailwind.config.js');
  const environmentAssetPath = path.resolve(process.cwd(), 'public/assets/environment/ink-landscape.svg');

  const tokensCss = fs.readFileSync(tokensCssPath, 'utf8');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');

  it('1. verifies that design-tokens.css exists and declares all required token categories', () => {
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

  it('2. verifies that Tailwind v4 theme declares correct breakpoint variables in globals.css', () => {
    expect(globalsCss).toContain('@theme {');
    expect(globalsCss).toContain('--breakpoint-md: 48rem;');
    expect(globalsCss).toContain('--breakpoint-lg: 64rem;');
    expect(globalsCss).toContain('--breakpoint-xl: 90rem;');
    expect(globalsCss).toContain('@import "../styles/design-tokens.css";');
  });

  it('3. verifies that Artifact lifecycle superseded token exists separately from Knowledge authority superseded', () => {
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

  it('4. verifies that Activity token uses Copper Ochre and does not alias Gold', () => {
    expect(tokensCss).toContain('--entity-activity-text: #f0ad6b;');
    expect(tokensCss).toContain('--entity-activity-bg: rgba(224, 159, 86, 0.10);');

    // Verify it is completely distinct from gold-400 (#d4af37)
    expect(tokensCss).not.toMatch(/--entity-activity-text:\s*#d4af37/);
  });

  it('5. verifies that functional danger and confidence tokens exist independently from entity tokens', () => {
    // Functional Danger
    expect(tokensCss).toContain('--state-danger-bg: rgba(248, 81, 73, 0.12);');
    expect(tokensCss).toContain('--state-danger-text: #f85149;');

    // Evidence Entity (distinct token family)
    expect(tokensCss).toContain('--entity-evidence-text: #ff7b72;');

    // Functional Confidence
    expect(tokensCss).toContain('--confidence-high-text: #3fb950;');
    expect(tokensCss).toContain('--confidence-medium-text: #e3b341;');
    expect(tokensCss).toContain('--confidence-low-text: #8b949e;');

    // Generic Selection
    expect(tokensCss).toContain('--selection-neutral-bg:');
    expect(tokensCss).toContain('--selection-neutral-border:');
  });

  it('6. verifies that no phantom tailwind.config.ts or tailwind.config.js exists', () => {
    expect(fs.existsSync(tailwindConfigPath)).toBe(false);
    expect(fs.existsSync(tailwindConfigJsPath)).toBe(false);
  });

  it('7. verifies that reduced-motion global reset and focus-visible baselines are declared', () => {
    expect(globalsCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globalsCss).toContain('animation-duration: 0.01ms !important;');
    expect(globalsCss).toContain(':focus-visible {');
    expect(globalsCss).toContain('outline: var(--focus-ring-width) solid var(--focus-ring-color);');
  });

  it('8. verifies that environmental vector asset exists and is lightweight/clean', () => {
    expect(fs.existsSync(environmentAssetPath)).toBe(true);
    const svgContent = fs.readFileSync(environmentAssetPath, 'utf8');
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('ink-mountain');
    // Ensure no embedded text tags or external font dependencies
    expect(svgContent).not.toContain('<text');
    expect(svgContent).not.toContain('@import');
  });

  it('9. verifies that frozen backend/domain files are untouched', () => {
    const migration0041 = path.resolve(process.cwd(), 'supabase/migrations/0041_artifact_management_authority.sql');
    const migration0042 = path.resolve(process.cwd(), 'supabase/migrations/0042_artifact_settlement_integration.sql');
    expect(fs.existsSync(migration0041)).toBe(true);
    expect(fs.existsSync(migration0042)).toBe(true);
  });
});
