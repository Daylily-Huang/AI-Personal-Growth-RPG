import { execSync } from "node:child_process";

/**
 * Shared fail-closed range resolution + policy evaluation for the committed
 * delta governance guards (phase5-quests-ui / phase5-skills-ui).
 *
 * Behavioral contract (docs/DesignSystem/MAIN_PUSH_GOVERNANCE_GUARD_FIX_EXECUTION.md):
 * - PR / feature-branch context (mergeBase != HEAD): inspect the FULL branch
 *   delta `git diff --name-only <mergeBase>...HEAD`, never a HEAD~1 shortcut,
 *   so multi-commit PRs keep complete coverage.
 * - current-main push context (mergeBase == HEAD, i.e. origin/main == HEAD):
 *   `mergeBase...HEAD` is empty by construction, so inspect the pushed
 *   commit's first-parent delta `git diff --name-only HEAD^1..HEAD`. This
 *   mode is entered only after positively establishing mergeBase == HEAD;
 *   it is never a generic branch fallback.
 * - Unresolvable ancestry and empty changed-file ranges fail closed with an
 *   explicit error. Git failures are never swallowed into a PASS.
 */

export type GovernanceDeltaMode = "pr-branch" | "current-main-push";

export interface GovernanceDelta {
  mode: GovernanceDeltaMode;
  /** Git range expression the changed-file list was computed from. */
  range: string;
  mergeBase: string;
  files: string[];
}

export interface DeltaGuardPolicy {
  forbiddenPrefixes: readonly string[];
  authorizedExceptions: readonly string[];
  forbiddenExactFiles?: readonly string[];
}

export interface ScopedPolicy {
  scopeTriggers: readonly string[];
  forbiddenPrefixes: readonly string[];
  forbiddenExactFiles?: readonly string[];
  authorizedExceptions?: readonly string[];
}

export interface ScopedPolicyResult {
  applicable: boolean;
  violations: string[];
}

export interface ResolveGovernanceChangedFilesOptions {
  /** Repository root to run git in; defaults to the current working directory. */
  cwd?: string;
}

function git(args: string, cwd?: string): string {
  return execSync(`git ${args}`, { encoding: "utf8", cwd }).trim();
}

function diffNameOnly(rangeExpr: string, cwd?: string): string[] {
  // `-z` makes Git emit raw path bytes instead of C-style quoted pathnames,
  // so non-ASCII paths remain matchable by scoped governance policies.
  // `--no-renames` intentionally represents a rename as delete(old)+add(new),
  // preserving BOTH path identities. Otherwise `--name-only` reports only the
  // destination of a detected rename and a protected historical source path
  // could disappear from scope applicability checks.
  const diff = execSync(`git diff --no-renames --name-only -z ${rangeExpr}`, {
    encoding: "utf8",
    cwd,
  });
  return diff.split("\0").filter(Boolean);
}

export function resolveGovernanceChangedFiles(
  options: ResolveGovernanceChangedFilesOptions = {},
): GovernanceDelta {
  const { cwd } = options;

  let mergeBase = "";
  try {
    mergeBase = git("merge-base origin/main HEAD", cwd);
  } catch {
    try {
      mergeBase = git("merge-base main HEAD", cwd);
    } catch (err) {
      throw new Error(`FAIL-CLOSED: Unable to resolve merge-base against origin/main or main: ${err}`);
    }
  }
  if (!mergeBase) {
    throw new Error("FAIL-CLOSED: merge-base resolved to an empty value");
  }

  const head = git("rev-parse HEAD", cwd);
  if (mergeBase !== head) {
    // PR / feature-branch context: full committed branch delta.
    const range = `${mergeBase}...HEAD`;
    const files = diffNameOnly(range, cwd);
    if (files.length === 0) {
      throw new Error(`FAIL-CLOSED: PR delta guard produced an empty changed-file range for ${range}`);
    }
    return { mode: "pr-branch", range, mergeBase, files };
  }

  // current-main push context: origin/main == HEAD.
  let parent: string;
  try {
    // Quote the revision so Windows cmd.exe does not consume `^` as its
    // escape character before Git receives the first-parent expression.
    parent = git('rev-parse "HEAD^1"', cwd);
  } catch (err) {
    throw new Error(
      `FAIL-CLOSED: current-main push mode could not resolve HEAD^1 (no resolvable ancestry): ${err}`,
    );
  }
  const range = `${parent}..HEAD`;
  const files = diffNameOnly(range, cwd);
  if (files.length === 0) {
    throw new Error(
      `FAIL-CLOSED: current-main push delta guard produced an empty changed-file range for ${range}`,
    );
  }
  return { mode: "current-main-push", range, mergeBase, files };
}

/**
 * Pure policy evaluation. A file is compliant only if it is explicitly listed
 * as an authorized exception; otherwise it must match no forbidden prefix and
 * no forbidden exact file. Returns human-readable violations (empty = pass).
 */
export function findPolicyViolations(
  files: readonly string[],
  policy: DeltaGuardPolicy,
): string[] {
  const violations: string[] = [];
  const authorizedExceptions = policy.authorizedExceptions.map(normalizeGovernancePath);
  const forbiddenPrefixes = policy.forbiddenPrefixes.map(normalizeGovernancePath);
  const forbiddenExactFiles = (policy.forbiddenExactFiles ?? []).map(normalizeGovernancePath);

  for (const rawFile of files) {
    const file = normalizeGovernancePath(rawFile);
    if (authorizedExceptions.includes(file)) continue;
    for (const prefix of forbiddenPrefixes) {
      if (file.startsWith(prefix)) {
        violations.push(`${file} matches forbidden prefix "${prefix}"`);
      }
    }
    for (const exact of forbiddenExactFiles) {
      if (file === exact) {
        violations.push(`${file} is a forbidden file`);
      }
    }
  }
  return violations;
}

function normalizeGovernancePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function matchesScopeTrigger(filePath: string, trigger: string): boolean {
  const normalizedFile = normalizeGovernancePath(filePath);
  const normalizedTrigger = normalizeGovernancePath(trigger);

  if (normalizedTrigger.endsWith("/**")) {
    const base = normalizedTrigger.slice(0, -2);
    return normalizedFile.startsWith(base);
  }
  if (normalizedTrigger.endsWith("/*")) {
    const base = normalizedTrigger.slice(0, -1);
    return normalizedFile.startsWith(base);
  }
  if (normalizedTrigger.endsWith("/")) {
    return normalizedFile.startsWith(normalizedTrigger);
  }
  return (
    normalizedFile === normalizedTrigger ||
    normalizedFile.startsWith(`${normalizedTrigger}/`)
  );
}

/**
 * Evaluates a scoped governance policy against a list of changed files.
 *
 * Contract:
 * 1. Checks if ANY file in `files` matches `policy.scopeTriggers`.
 * 2. If no file matches, returns `{ applicable: false, violations: [] }`.
 * 3. If applicable, evaluates the FULL `files` array against the forbidden policy.
 *    (Files are NEVER filtered down to UI-only before evaluation, ensuring mixed
 *    UI + backend modifications fail closed).
 */
export function evaluateScopedPolicy(
  files: readonly string[],
  policy: ScopedPolicy,
): ScopedPolicyResult {
  const isApplicable = files.some((file) =>
    policy.scopeTriggers.some((trigger) => matchesScopeTrigger(file, trigger)),
  );

  if (!isApplicable) {
    return { applicable: false, violations: [] };
  }

  const violations = findPolicyViolations(files, {
    forbiddenPrefixes: policy.forbiddenPrefixes,
    authorizedExceptions: policy.authorizedExceptions ?? [],
    forbiddenExactFiles: policy.forbiddenExactFiles ?? [],
  });

  return { applicable: true, violations };
}

// =============================================================================
// Standardized Historical Phase Policy Specifications
// =============================================================================

export const COMMON_AUTHORIZED_CORE_BUGFIXES: readonly string[] = [
  "src/app/api/activities/[id]/assess/route.ts",
  "src/lib/ai/assess.ts",
  "src/lib/store/demo-repository.ts",
  "src/lib/store/repository.ts",
  "src/lib/store/settlement.service.ts",
  "src/lib/store/supabase-repository.ts",
];

export const PHASE5_DASHBOARD_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/app/dashboard/",
    "src/components/dashboard/",
  ],
  forbiddenPrefixes: [
    "src/app/api/",
    "supabase/",
    "src/lib/store/",
    "src/lib/ai/",
    "src/lib/growth-engine/",
    "src/lib/supabase/",
    "src/lib/auth/",
    "src/lib/http/",
    "src/proxy.ts",
  ],
  authorizedExceptions: COMMON_AUTHORIZED_CORE_BUGFIXES,
};

export const PHASE5_QUESTS_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/app/quests/",
    "src/components/quests/",
  ],
  forbiddenPrefixes: [
    "src/app/api/",
    "supabase/",
    "src/lib/store/",
    "src/lib/growth-engine/",
    "src/lib/ai/",
    "src/lib/supabase/",
    "src/lib/auth/",
    "src/lib/http/",
    "src/proxy.ts",
    "src/components/ui/",
  ],
  authorizedExceptions: [
    ...COMMON_AUTHORIZED_CORE_BUGFIXES,
    "src/components/ui/PrimaryButton.tsx",
    "src/components/ui/LevelBadge.tsx",
  ],
  forbiddenExactFiles: ["package.json", "pnpm-lock.yaml"],
};

export const PHASE5_SKILLS_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/app/skills/",
    "src/components/skills/",
  ],
  forbiddenPrefixes: [
    "src/app/api/",
    "supabase/",
    "src/lib/store/",
    "src/lib/growth-engine/",
    "src/lib/ai/",
    "src/lib/supabase/",
    "src/lib/auth/",
    "src/lib/http/",
    "src/proxy.ts",
    "src/components/ui/",
  ],
  authorizedExceptions: [
    ...COMMON_AUTHORIZED_CORE_BUGFIXES,
    "src/components/ui/PrimaryButton.tsx",
    "src/components/ui/LevelBadge.tsx",
  ],
  forbiddenExactFiles: ["package.json", "pnpm-lock.yaml"],
};

// User-approved L1 directory bootstrap. No directory-wide or generic bugfix exemptions.
export const SKILL_BOOTSTRAP_CONTROL = "docs/SiteReadiness/01_ZERO_XP_MANUAL_SKILL_CONTRACT.md";
export const SKILL_BOOTSTRAP_MIGRATION = "supabase/migrations/0053_zero_xp_manual_skill_authority.sql";
export const SKILL_BOOTSTRAP_MARKERS = [SKILL_BOOTSTRAP_CONTROL, SKILL_BOOTSTRAP_MIGRATION,
  "src/app/skills/components/SkillCreateForm.tsx", "src/app/skills/page.tsx"] as const;
export const SKILL_BOOTSTRAP_PRODUCTION = [SKILL_BOOTSTRAP_MIGRATION, "src/app/api/skills/route.ts",
  "src/app/skills/page.tsx", "src/app/skills/components/SkillCreateForm.tsx",
  "src/lib/skills/bootstrap.ts", "src/lib/skills/bootstrap-request.ts"] as const;
export function hasSkillBootstrapScope(files: readonly string[]): boolean {
  return SKILL_BOOTSTRAP_MARKERS.every(file => files.includes(file));
}

// SiteReadiness02: standalone UI repair, never composes old Core/backend grants.
export const GRAPH_CANVAS_CONTROL = "docs/SiteReadiness/02_GRAPH_CANVAS_READINESS_AND_RESIZE_CONTRACT.md";
export const GRAPH_CANVAS_PRODUCTION = [
  "src/components/graph/useGraphCameraFit.ts", "src/app/skills/components/SkillGraphCanvas.tsx",
  "src/app/knowledge/components/KnowledgeGraphCanvas.tsx", "src/app/skills/page.tsx",
] as const;
export const GRAPH_CANVAS_MARKERS = [GRAPH_CANVAS_CONTROL, ...GRAPH_CANVAS_PRODUCTION,
  "tests/graph-camera-fit.test.tsx", "tests/graph-canvas-governance.test.ts"] as const;
export const GRAPH_CANVAS_ALLOWED = [...GRAPH_CANVAS_MARKERS,
  "docs/MASTER_PROJECT_HANDOFF.md", "docs/SiteReadiness/03_GRAPH_CANVAS_READINESS_VERIFICATION.md",
  "task_plan.md", "findings.md", "progress.md", "tests/helpers/governance-delta.ts",
  "tests/phase5-skills-ui.test.tsx", "tests/phase6-knowledge-ui.test.tsx",
  "tests/phase7-motion-reduced-motion.test.tsx", "tests/visual-foundation.test.ts",
  "tests/phase8f-ui-governance.test.ts",
] as const;
export function hasGraphCanvasScope(files: readonly string[]): boolean {
  return GRAPH_CANVAS_MARKERS.every(file => files.includes(file));
}
export function graphCanvasScopeViolations(files: readonly string[]): string[] {
  const allowed = new Set<string>(hasGraphCanvasScope(files) ? GRAPH_CANVAS_ALLOWED : []);
  return files.filter(file => !allowed.has(file));
}
export function graphCanvasKnowledgePolicy(files: readonly string[]): ScopedPolicy {
  if (!hasGraphCanvasScope(files)) return PHASE6_KNOWLEDGE_POLICY;
  return { scopeTriggers: GRAPH_CANVAS_PRODUCTION,
    forbiddenPrefixes: ["src/", "supabase/", "public/", "scripts/", ".github/"],
    forbiddenExactFiles: ["package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json", "vitest.config.ts"],
    authorizedExceptions: GRAPH_CANVAS_PRODUCTION };
}

export function skillBootstrapPolicy(files: readonly string[]): ScopedPolicy {
  if (!hasSkillBootstrapScope(files)) return PHASE5_SKILLS_POLICY;
  return { ...PHASE5_SKILLS_POLICY, authorizedExceptions: ["src/app/api/skills/route.ts", SKILL_BOOTSTRAP_MIGRATION] };
}

// SiteReadiness04: standalone two-class mobile scope; old policies stay immutable.
export const MOBILE_GRAPH_BASE = "f100d1fe10583d1b228e5ad23b0e9fded2730b25";
export const MOBILE_GRAPH_CONTROL = "docs/SiteReadiness/04_GRAPH_MOBILE_OVERLAY_AND_CONNECTED_NAV_CONTRACT.md";
export const MOBILE_GRAPH_PRODUCTION = [
  "src/app/skills/components/SkillGraphCanvas.tsx", "src/app/knowledge/components/KnowledgeGraphCanvas.tsx",
] as const;
export const MOBILE_GRAPH_MARKERS = [MOBILE_GRAPH_CONTROL, ...MOBILE_GRAPH_PRODUCTION,
  "tests/graph-mobile-overlay.test.tsx", "tests/graph-mobile-governance.test.ts"] as const;
export const MOBILE_GRAPH_AUDIT_ADDITIONS = [MOBILE_GRAPH_CONTROL,
  "docs/SiteReadiness/05_GRAPH_MOBILE_VERIFICATION.md",
  "tests/graph-mobile-overlay.test.tsx", "tests/graph-mobile-governance.test.ts"] as const;
export const MOBILE_GRAPH_ALLOWED = [...MOBILE_GRAPH_MARKERS,
  "docs/SiteReadiness/05_GRAPH_MOBILE_VERIFICATION.md", "docs/MASTER_PROJECT_HANDOFF.md",
  "task_plan.md", "findings.md", "progress.md", "tests/helpers/governance-delta.ts",
  "tests/visual-foundation.test.ts", "tests/phase6-knowledge-ui.test.tsx", "tests/graph-canvas-governance.test.ts",
] as const;
export function hasMobileGraphScope(files: readonly string[]): boolean {
  return MOBILE_GRAPH_MARKERS.every(file => files.includes(file));
}
export function mobileGraphScopeViolations(files: readonly string[]): string[] {
  const allowed = new Set<string>(hasMobileGraphScope(files) ? MOBILE_GRAPH_ALLOWED : []);
  return files.filter(file => !allowed.has(file));
}
export function mobileGraphKnowledgePolicy(files: readonly string[]): ScopedPolicy {
  if (!hasMobileGraphScope(files)) return graphCanvasKnowledgePolicy(files);
  return { scopeTriggers: MOBILE_GRAPH_PRODUCTION,
    forbiddenPrefixes: ["src/", "supabase/", "public/", "scripts/", ".github/"],
    forbiddenExactFiles: ["package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json", "vitest.config.ts"],
    authorizedExceptions: MOBILE_GRAPH_PRODUCTION };
}

// SiteReadiness06 successor: old MOBILE_GRAPH/GRAPH_CANVAS policies above stay unchanged.
export const CONNECTED_FOCUS_CONTROL = "docs/SiteReadiness/06_CONNECTED_KEYBOARD_FOCUS_CORRECTIVE_CONTRACT.md";
export const CONNECTED_FOCUS_PAGES = ["src/app/skills/page.tsx", "src/app/knowledge/page.tsx"] as const;
export const CONNECTED_FOCUS_PRODUCTION = [...MOBILE_GRAPH_PRODUCTION, ...CONNECTED_FOCUS_PAGES] as const;
export const CONNECTED_FOCUS_MARKERS = [...MOBILE_GRAPH_MARKERS, CONNECTED_FOCUS_CONTROL,
  ...CONNECTED_FOCUS_PAGES, "tests/graph-connected-focus.test.tsx"] as const;
export const CONNECTED_FOCUS_AUDIT_ADDITIONS = [...MOBILE_GRAPH_AUDIT_ADDITIONS,
  CONNECTED_FOCUS_CONTROL, "tests/graph-connected-focus.test.tsx"] as const;
export const CONNECTED_FOCUS_ALLOWED = [...MOBILE_GRAPH_ALLOWED, CONNECTED_FOCUS_CONTROL,
  ...CONNECTED_FOCUS_PAGES, "tests/graph-connected-focus.test.tsx", "tests/phase8f-ui-governance.test.ts"] as const;
export function hasConnectedFocusScope(files: readonly string[]): boolean {
  return CONNECTED_FOCUS_MARKERS.every(file => files.includes(file));
}
export function graphInteractionScopeViolations(files: readonly string[]): string[] {
  if (!hasConnectedFocusScope(files)) return mobileGraphScopeViolations(files);
  const allowed = new Set<string>(CONNECTED_FOCUS_ALLOWED);
  return files.filter(file => !allowed.has(file));
}
export function graphInteractionKnowledgePolicy(files: readonly string[]): ScopedPolicy {
  if (!hasConnectedFocusScope(files)) return mobileGraphKnowledgePolicy(files);
  return { scopeTriggers: CONNECTED_FOCUS_PRODUCTION,
    forbiddenPrefixes: ["src/", "supabase/", "public/", "scripts/", ".github/"],
    forbiddenExactFiles: ["package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json", "vitest.config.ts"],
    authorizedExceptions: CONNECTED_FOCUS_PRODUCTION };
}

export const PHASE6_KNOWLEDGE_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/app/knowledge/",
    "src/components/knowledge/",
  ],
  forbiddenPrefixes: [
    "src/lib/",
    "src/app/api/",
    "supabase/",
    "src/components/",
    "src/proxy.ts",
    "src/styles/design-tokens.css",
  ],
  authorizedExceptions: [
    "src/components/ui/PrimaryButton.tsx",
    "src/components/ui/LevelBadge.tsx",
  ],
  forbiddenExactFiles: ["package.json", "pnpm-lock.yaml"],
};

export const STAGE7C_ARTIFACT_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/app/artifacts/",
    "src/components/artifacts/",
  ],
  forbiddenPrefixes: [
    "src/app/api/",
    "supabase/",
    "src/lib/store/",
    "src/lib/ai/",
    "src/lib/growth-engine/",
    "src/lib/supabase/",
    "src/lib/http/",
    "src/lib/auth/",
    "src/proxy.ts",
    "src/types/artifact.ts",
  ],
  authorizedExceptions: COMMON_AUTHORIZED_CORE_BUGFIXES,
};

export const SHARED_UI_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/components/ui/",
    "src/styles/design-tokens.css",
    "src/app/globals.css",
  ],
  forbiddenPrefixes: [
    "src/app/api/",
    "supabase/",
    "src/lib/store/",
    "src/lib/ai/",
    "src/lib/growth-engine/",
    "src/lib/supabase/",
    "src/lib/http/",
    "src/lib/auth/",
    "src/proxy.ts",
    "src/types/artifact.ts",
    "src/lib/knowledge/authority-service.ts",
    "src/lib/knowledge/types.ts",
    "src/lib/skills/derived-state.ts",
  ],
  authorizedExceptions: COMMON_AUTHORIZED_CORE_BUGFIXES,
};

export const GLOBAL_APPSHELL_POLICY: ScopedPolicy = {
  scopeTriggers: [
    "src/components/layout/",
  ],
  forbiddenPrefixes: [
    "src/app/api/",
    "supabase/",
    "src/lib/reward/",
    "src/lib/store/",
    "src/lib/ai/",
    "src/lib/growth-engine/",
    "src/lib/supabase/",
    "src/lib/http/",
    "src/lib/auth/",
    "src/proxy.ts",
    "src/types/artifact.ts",
    "src/lib/knowledge/authority-service.ts",
    "src/lib/knowledge/types.ts",
    "src/lib/skills/derived-state.ts",
  ],
  authorizedExceptions: COMMON_AUTHORIZED_CORE_BUGFIXES,
};

// Phase 8E §17: accepted backend identities, not a directory-wide permission.
export const PHASE8E_CONTROL = "docs/Phase8/21_PHASE8E_REWARD_WISHES_IMPLEMENTATION_CONTROLLING.md";
export const PHASE8E_ACCEPTED_HEAD = "de08a89be28a58c471b6417f94504030d5cde145";
export const PHASE8E_ACCEPTED_BACKEND = [
  "src/lib/reward/fold.ts", "src/lib/reward/types.ts", "src/lib/reward/http.ts",
  "src/lib/reward/repository.ts", "src/lib/reward/request.ts", "src/lib/reward/service.ts",
  "src/app/api/rewards/account/route.ts", "src/app/api/rewards/grants/route.ts",
  "src/app/api/rewards/redemptions/route.ts", "src/app/api/rewards/redemptions/[id]/refund/route.ts",
  "src/app/api/rewards/sources/route.ts", "src/app/api/rewards/transactions/route.ts",
  "src/app/api/rewards/transactions/[id]/correct/route.ts", "src/app/api/rewards/wishes/route.ts",
  "src/app/api/rewards/wishes/[id]/route.ts", "src/app/api/rewards/wishes/[id]/[action]/route.ts",
  "src/app/api/rewards/wishes/[id]/proposals/route.ts",
  "supabase/migrations/0048_phase8e_reward_wishes_foundation.sql",
  "supabase/migrations/0049_phase8e_reward_wishes_rpc_authority.sql",
  "supabase/migrations/0050_phase8e_reward_canonical_source_fix.sql",
] as const;
export function phase8eNavigationPolicy(files: readonly string[]): ScopedPolicy {
  const navOnly = files.filter(file => file.startsWith("src/components/layout/"))
    .every(file => ["src/components/layout/AppSidebar.tsx", "src/components/layout/MobileNav.tsx"].includes(file));
  if (!navOnly || !files.includes(PHASE8E_CONTROL) || !files.includes("src/app/rewards/wishes/page.tsx")) return GLOBAL_APPSHELL_POLICY;
  return { ...GLOBAL_APPSHELL_POLICY, authorizedExceptions: [...(GLOBAL_APPSHELL_POLICY.authorizedExceptions ?? []), ...PHASE8E_ACCEPTED_BACKEND] };
}

// SiteReadiness07: current strict scope, independent of every historical Core grant.
export const NEW_USER_GUIDE_BASE = "ee48b84ce989f1d2904e94116d300513d77ef3e4";
export const NEW_USER_GUIDE_CONTROL = "docs/SiteReadiness/07_NEW_USER_GUIDE_CONTRACT.md";
export const NEW_USER_GUIDE_PRODUCTION = [
  "src/app/onboarding/page.tsx", "src/components/onboarding/GettingStartedGuide.tsx",
  "src/lib/onboarding/progress.ts", "src/components/dashboard/DashboardHeader.tsx",
  "src/components/dashboard/DashboardStates.tsx",
] as const;
export const NEW_USER_GUIDE_TESTS = ["tests/onboarding-progress.test.ts", "tests/onboarding-guide.test.tsx",
  "tests/onboarding-governance.test.ts", "tests/onboarding-http.test.ts"] as const;
export const NEW_USER_GUIDE_MARKERS = [NEW_USER_GUIDE_CONTROL, "docs/Design ChatGPT/02_PRODUCT_DESIGN.md",
  ...NEW_USER_GUIDE_PRODUCTION, ...NEW_USER_GUIDE_TESTS] as const;
export const NEW_USER_GUIDE_ADDITIONS = [...NEW_USER_GUIDE_MARKERS,
  "docs/SiteReadiness/08_NEW_USER_GUIDE_VERIFICATION.md"] as const;
export const NEW_USER_GUIDE_ALLOWED = [...NEW_USER_GUIDE_ADDITIONS,
  "tests/helpers/governance-delta.ts", "tests/visual-foundation.test.ts", "tests/graph-canvas-governance.test.ts",
  "tests/phase8f-ui-governance.test.ts", "tests/graph-mobile-governance.test.ts",
  "docs/MASTER_PROJECT_HANDOFF.md", "task_plan.md", "findings.md", "progress.md"] as const;
export function hasNewUserGuideScope(files: readonly string[]): boolean {
  return NEW_USER_GUIDE_MARKERS.every(file => files.includes(file));
}
export function newUserGuideScopeViolations(files: readonly string[]): string[] {
  const allowed = new Set<string>(hasNewUserGuideScope(files) ? NEW_USER_GUIDE_ALLOWED : []);
  return files.filter(file => !allowed.has(file));
}
export type NewUserGuideGitOptions = { cwd?: string; execute?: (command: string) => string };
function newUserGuideGit(options: NewUserGuideGitOptions, args: string): string {
  try {
    return options.execute ? options.execute(args) : execSync(`git ${args}`, { encoding: "utf8", cwd: options.cwd });
  } catch {
    throw new Error("FAIL-CLOSED: new-user guide Git query failed");
  }
}
export function resolveNewUserGuideWorkingFiles(options: NewUserGuideGitOptions = {}): string[] {
  const tracked = newUserGuideGit(options, `diff --no-renames --name-only -z ${NEW_USER_GUIDE_BASE} --`).split("\0").filter(Boolean);
  const untracked = newUserGuideGit(options, "ls-files --others --exclude-standard -z").split("\0").filter(Boolean);
  return [...tracked, ...untracked];
}
/** Positive remote HEAD equality, not the weaker merge-base==HEAD ancestor assumption. */
export function resolveNewUserGuideChangedFiles(options: NewUserGuideGitOptions = {}): GovernanceDelta {
  const revision = (command: string) => {
    const value = newUserGuideGit(options, command).trim();
    if (!/^[a-f0-9]{40}$/.test(value)) throw new Error("FAIL-CLOSED: invalid new-user guide Git revision");
    return value;
  };
  const head = revision("rev-parse HEAD"), remote = revision("rev-parse origin/main");
  const mergeBase = revision(`merge-base ${NEW_USER_GUIDE_BASE} HEAD`);
  if (mergeBase !== NEW_USER_GUIDE_BASE) throw new Error("FAIL-CLOSED: new-user guide accepted base is not an ancestor");
  const mode = remote === head ? "current-main-push" : "pr-branch";
  const range = mode === "current-main-push" ? `${revision('rev-parse "HEAD^1"')}..${head}` : `${NEW_USER_GUIDE_BASE}...${head}`;
  const files = newUserGuideGit(options, `diff --no-renames --name-only -z ${range}`).split("\0").filter(Boolean);
  if (!files.length) throw new Error("FAIL-CLOSED: empty new-user guide changed-file range");
  return { mode, range, mergeBase, files };
}

// SiteReadiness09: a strict present-day scope before cumulative historical filters.
export const ACTIVITY_DETAIL_BASE = "c06ab0b692045557d550a3e8eb2b9dd8aed61645";
export const ACTIVITY_DETAIL_CONTROL = "docs/SiteReadiness/09_ACTIVITY_DETAIL_CONTRACT.md";
export const ACTIVITY_DETAIL_PRODUCTION = ["src/app/activities/[id]/page.tsx", "src/app/api/activities/[id]/route.ts",
  "src/components/dashboard/ActivityHistoryList.tsx", "src/components/dashboard/RecentGrowthFeed.tsx"] as const;
export const ACTIVITY_DETAIL_TESTS = ["tests/activity-detail-api.test.ts", "tests/activity-detail-ui.test.tsx",
  "tests/activity-detail-http.test.ts", "tests/activity-detail-governance.test.ts"] as const;
export const ACTIVITY_DETAIL_MARKERS = [ACTIVITY_DETAIL_CONTROL, "docs/Design ChatGPT/02_PRODUCT_DESIGN.md",
  ...ACTIVITY_DETAIL_PRODUCTION, ...ACTIVITY_DETAIL_TESTS] as const;
export const ACTIVITY_DETAIL_ADDITIONS = [ACTIVITY_DETAIL_CONTROL, "docs/SiteReadiness/10_ACTIVITY_DETAIL_VERIFICATION.md",
  ...ACTIVITY_DETAIL_PRODUCTION, ...ACTIVITY_DETAIL_TESTS, "tests/phase5-dashboard-ui.test.tsx"] as const;
export const ACTIVITY_DETAIL_ALLOWED = [...ACTIVITY_DETAIL_ADDITIONS, "docs/Design ChatGPT/02_PRODUCT_DESIGN.md",
  "tests/helpers/governance-delta.ts", "tests/visual-foundation.test.ts", "tests/graph-canvas-governance.test.ts",
  "tests/graph-mobile-governance.test.ts", "tests/phase8f-ui-governance.test.ts", "tests/onboarding-governance.test.ts",
  "docs/MASTER_PROJECT_HANDOFF.md", "task_plan.md", "findings.md", "progress.md"] as const;
export function hasActivityDetailScope(files: readonly string[]): boolean {
  return ACTIVITY_DETAIL_MARKERS.every(file => files.includes(file));
}
export function activityDetailScopeViolations(files: readonly string[]): string[] {
  const allowed = new Set<string>(hasActivityDetailScope(files) ? ACTIVITY_DETAIL_ALLOWED : []);
  return files.filter(file => !allowed.has(file));
}
function activityDetailGit(options: NewUserGuideGitOptions, command: string): string {
  try { return options.execute ? options.execute(command) : execSync(`git ${command}`, { encoding: "utf8", cwd: options.cwd }); }
  catch { throw new Error("FAIL-CLOSED: activity detail Git query failed"); }
}
function activityDetailRevision(options: NewUserGuideGitOptions, command: string): string {
  const value = activityDetailGit(options, command).trim();
  if (!/^[a-f0-9]{40}$/.test(value)) throw new Error("FAIL-CLOSED: invalid activity detail Git revision");
  return value;
}
function activityDetailAcceptedBase(options: NewUserGuideGitOptions): string {
  const head = activityDetailRevision(options, "rev-parse HEAD");
  if (activityDetailRevision(options, `merge-base ${ACTIVITY_DETAIL_BASE} HEAD`) !== ACTIVITY_DETAIL_BASE)
    throw new Error("FAIL-CLOSED: activity detail accepted base is not an ancestor");
  return head;
}
export function resolveActivityDetailWorkingFiles(options: NewUserGuideGitOptions = {}): string[] {
  activityDetailAcceptedBase(options);
  const tracked = activityDetailGit(options, `diff --no-renames --name-only -z ${ACTIVITY_DETAIL_BASE} --`).split("\0").filter(Boolean);
  const untracked = activityDetailGit(options, "ls-files --others --exclude-standard -z").split("\0").filter(Boolean);
  const files = [...new Set([...tracked, ...untracked])];
  if (!files.length) throw new Error("FAIL-CLOSED: empty activity detail working range");
  return files;
}
export function resolveActivityDetailChangedFiles(options: NewUserGuideGitOptions = {}): GovernanceDelta {
  const head = activityDetailAcceptedBase(options), remote = activityDetailRevision(options, "rev-parse origin/main");
  const mode = remote === head ? "current-main-push" : "pr-branch";
  const range = mode === "current-main-push" ? `${activityDetailRevision(options, 'rev-parse "HEAD^1"')}..${head}` : `${ACTIVITY_DETAIL_BASE}...${head}`;
  const files = activityDetailGit(options, `diff --no-renames --name-only -z ${range}`).split("\0").filter(Boolean);
  if (!files.length) throw new Error("FAIL-CLOSED: empty activity detail changed-file range");
  return { mode, range, mergeBase: ACTIVITY_DETAIL_BASE, files };
}
/** Call only after the present-day scope passes; retain 02 and every old authorization. */
export function withoutActivityDetailAdditions(files: readonly string[]): string[] {
  const additions = new Set<string>(ACTIVITY_DETAIL_ADDITIONS);
  return files.filter(file => !additions.has(file));
}
export function activityDetailDashboardFiles(files: string[]): string[] {
  if (!hasActivityDetailScope(files)) return files;
  if (activityDetailScopeViolations(files).length) throw new Error("FAIL-CLOSED: activity detail scope extra");
  return files.filter(file => file !== "src/app/api/activities/[id]/route.ts");
}

// Post-main corrective admission in SiteReadiness10. Every earlier helper byte stays above.
import { readFileSync as readActivityMainControl } from "node:fs";
import { createHash as activityMainHash } from "node:crypto";
import { resolve as activityMainPath } from "node:path";
export const ACTIVITY_MAIN_BASE = "b9cef589cec7834344b88850937503df7cd687c0";
export const ACTIVITY_MAIN_CONTROL = "docs/SiteReadiness/10_ACTIVITY_DETAIL_VERIFICATION.md";
export const ACTIVITY_MAIN_ADMISSION_SHA = "785DC37337DC1A37C8EE7B1FD929EDBD474771A62903949E95DA9AD039514079";
export const ACTIVITY_MAIN_MARKERS = [ACTIVITY_MAIN_CONTROL, "tests/helpers/governance-delta.ts", "tests/onboarding-governance.test.ts"] as const;
export const ACTIVITY_MAIN_ALLOWED = ["docs/MASTER_PROJECT_HANDOFF.md", ACTIVITY_MAIN_CONTROL,
  "findings.md", "progress.md", "task_plan.md", "tests/helpers/governance-delta.ts", "tests/onboarding-governance.test.ts"] as const;
export function activityMainScopeViolations(files: readonly string[]): string[] {
  const violations = ACTIVITY_MAIN_MARKERS.every(file => files.includes(file)) ? [] : ["missing corrective markers"];
  if (new Set(files).size !== files.length) violations.push("duplicate corrective paths");
  return [...violations, ...files.filter(file => !(ACTIVITY_MAIN_ALLOWED as readonly string[]).includes(file))];
}
export function verifyActivityMainAdmission(document: string): void {
  const blocks = document.replace(/\r\n/g, "\n").match(/<!-- BEGIN:ACTIVITY_MAIN_GUARD_CORRECTIVE_ADMISSION -->[\s\S]*?<!-- END:ACTIVITY_MAIN_GUARD_CORRECTIVE_ADMISSION -->/g);
  if (blocks?.length !== 1 || activityMainHash("sha256").update(blocks[0]).digest("hex").toUpperCase() !== ACTIVITY_MAIN_ADMISSION_SHA)
    throw new Error("FAIL-CLOSED: corrective admission content is unbound");
}
function assertActivityMainAdmission(options: NewUserGuideGitOptions): void {
  let document: string;
  try { document = readActivityMainControl(activityMainPath(options.cwd ?? process.cwd(), ACTIVITY_MAIN_CONTROL), "utf8"); }
  catch { throw new Error("FAIL-CLOSED: corrective admission could not be read"); }
  verifyActivityMainAdmission(document);
}
function activityMainAcceptedHead(options: NewUserGuideGitOptions): string {
  const head = activityDetailRevision(options, "rev-parse HEAD");
  if (activityDetailRevision(options, `merge-base ${ACTIVITY_MAIN_BASE} HEAD`) !== ACTIVITY_MAIN_BASE)
    throw new Error("FAIL-CLOSED: corrective accepted base is not an ancestor");
  return head;
}
export function resolveActivityMainWorkingFiles(options: NewUserGuideGitOptions = {}): string[] {
  activityMainAcceptedHead(options);
  const tracked = activityDetailGit(options, `diff --no-renames --name-only -z ${ACTIVITY_MAIN_BASE} --`).split("\0").filter(Boolean);
  const untracked = activityDetailGit(options, "ls-files --others --exclude-standard -z").split("\0").filter(Boolean);
  const files = [...new Set([...tracked, ...untracked])];
  if (!files.length) throw new Error("FAIL-CLOSED: empty corrective working delta");
  return files;
}
export function resolveActivityMainChangedFiles(options: NewUserGuideGitOptions = {}): GovernanceDelta {
  const head = activityMainAcceptedHead(options), remote = activityDetailRevision(options, "rev-parse origin/main");
  const mode = head === remote ? "current-main-push" : "pr-branch";
  const range = mode === "current-main-push" ? `${activityDetailRevision(options, 'rev-parse "HEAD^1"')}..${head}` : `${ACTIVITY_MAIN_BASE}...${head}`;
  const files = activityDetailGit(options, `diff --no-renames --name-only -z ${range}`).split("\0").filter(Boolean);
  if (!files.length) throw new Error("FAIL-CLOSED: empty corrective changed delta");
  return { mode, range, mergeBase: ACTIVITY_MAIN_BASE, files };
}
function assertSameActivityRange(left: GovernanceDelta, right: GovernanceDelta, sameAcceptedBase: boolean): void {
  if (left.mode !== right.mode || left.range !== right.range ||
      (sameAcceptedBase && left.mergeBase !== right.mergeBase) ||
      !/^[a-f0-9]{40}\.{2,3}[a-f0-9]{40}$/.test(left.range) ||
      new Set(left.files).size !== left.files.length || new Set(right.files).size !== right.files.length ||
      JSON.stringify([...left.files].sort()) !== JSON.stringify([...right.files].sort()))
    throw new Error("FAIL-CLOSED: corrective mode/range/files binding mismatch");
}
function assertCompleteActivityScope(files: readonly string[], allowed: readonly string[], violations: readonly string[]): void {
  if (violations.length || JSON.stringify([...files].sort()) !== JSON.stringify([...allowed].sort()))
    throw new Error("FAIL-CLOSED: incomplete or extra current-main scope");
}
/** Only a freshly resolved, fully bound main delta may avoid unrelated historical full-scope checks. */
export function classifyActivityGuideCommittedRange(entire: GovernanceDelta, options: NewUserGuideGitOptions = {}): "historical" | "activity-main" | "corrective-main" {
  assertActivityMainAdmission(options);
  assertSameActivityRange(entire, resolveNewUserGuideChangedFiles(options), true);
  if (entire.mode !== "current-main-push") return "historical";
  if (entire.files.includes(ACTIVITY_DETAIL_CONTROL)) {
    const current = resolveActivityDetailChangedFiles(options);
    assertSameActivityRange(entire, current, false);
    assertCompleteActivityScope(current.files, ACTIVITY_DETAIL_ALLOWED, activityDetailScopeViolations(current.files));
    return "activity-main";
  }
  if (entire.files.includes(ACTIVITY_MAIN_CONTROL)) {
    const current = resolveActivityMainChangedFiles(options);
    assertSameActivityRange(entire, current, false);
    assertCompleteActivityScope(current.files, ACTIVITY_MAIN_ALLOWED, activityMainScopeViolations(current.files));
    return "corrective-main";
  }
  return "historical";
}

// SiteReadiness11: reject-only present-day gate. All accepted78d helper text stays above.
import { existsSync as proposalControlExists } from "node:fs";
export const PROPOSAL_REJECTION_BASE = "78d2036af19e55ea59f40cdc8a3358c3bab3cae4";
export const PROPOSAL_REJECTION_CONTROL = "docs/SiteReadiness/11_PROPOSAL_REJECTION_CONTRACT.md";
export const PROPOSAL_REJECTION_ADMISSION_SHA = "BB98D531957762DFA112FCE6BF8E46D0EA7798710A7CB430C2E9B93C938F69AB";
export const PROPOSAL_REJECTION_PRODUCTION = ["src/app/api/assessments/[id]/reject/route.ts",
  "src/components/dashboard/PendingProposals.tsx", "src/lib/assessments/rejection-client.ts",
  "src/lib/store/assessment-rejection.service.ts"] as const;
export const PROPOSAL_REJECTION_TESTS = ["tests/proposal-rejection-api.test.ts", "tests/proposal-rejection-authority.test.ts",
  "tests/proposal-rejection-governance.test.ts", "tests/proposal-rejection-http.test.ts",
  "tests/proposal-rejection-service.test.ts", "tests/proposal-rejection-ui.test.tsx"] as const;
export const PROPOSAL_REJECTION_MARKERS = [PROPOSAL_REJECTION_CONTROL, "docs/Design ChatGPT/02_PRODUCT_DESIGN.md",
  ...PROPOSAL_REJECTION_PRODUCTION, ...PROPOSAL_REJECTION_TESTS] as const;
export const PROPOSAL_REJECTION_ALLOWED = [...PROPOSAL_REJECTION_MARKERS,
  "docs/MASTER_PROJECT_HANDOFF.md", "docs/SiteReadiness/12_PROPOSAL_REJECTION_VERIFICATION.md",
  "findings.md", "progress.md", "task_plan.md", "tests/activity-detail-governance.test.ts",
  "tests/graph-canvas-governance.test.ts", "tests/graph-mobile-governance.test.ts", "tests/helpers/governance-delta.ts",
  "tests/onboarding-governance.test.ts", "tests/phase5-dashboard-ui.test.tsx", "tests/phase8f-ui-governance.test.ts",
  "tests/visual-foundation.test.ts"] as const;
export const PROPOSAL_REJECTION_HISTORICAL_CONTENT = ["docs/Design ChatGPT/02_PRODUCT_DESIGN.md",
  "tests/activity-detail-governance.test.ts", "tests/phase5-dashboard-ui.test.tsx", "tests/visual-foundation.test.ts",
  "tests/graph-canvas-governance.test.ts", "tests/graph-mobile-governance.test.ts", "tests/phase8f-ui-governance.test.ts"] as const;
export type ProposalRejectionGitOptions = NewUserGuideGitOptions & { readControl?: () => string };
export function hasProposalRejectionScope(files: readonly string[]): boolean {
  return PROPOSAL_REJECTION_MARKERS.every(file => files.includes(file));
}
export function proposalRejectionScopeViolations(files: readonly string[]): string[] {
  const allowed = new Set<string>(hasProposalRejectionScope(files) ? PROPOSAL_REJECTION_ALLOWED : []);
  return [...(new Set(files).size === files.length ? [] : ["duplicate proposal paths"]), ...files.filter(file => !allowed.has(file))];
}
export function verifyProposalRejectionAdmission(document: string): void {
  if (activityMainHash("sha256").update(document.replace(/\r\n/g, "\n")).digest("hex").toUpperCase() !== PROPOSAL_REJECTION_ADMISSION_SHA)
    throw new Error("FAIL-CLOSED: proposal rejection admission content is unbound");
}
function proposalAdmission(options: ProposalRejectionGitOptions): void {
  let document: string;
  try { document = options.readControl ? options.readControl() : readActivityMainControl(activityMainPath(options.cwd ?? process.cwd(), PROPOSAL_REJECTION_CONTROL), "utf8"); }
  catch { throw new Error("FAIL-CLOSED: proposal rejection admission could not be read"); }
  verifyProposalRejectionAdmission(document);
}
function proposalPaths(raw: string, allowEmpty = false): string[] {
  if (raw && !raw.endsWith("\0")) throw new Error("FAIL-CLOSED: unterminated proposal Git paths");
  const files = raw ? raw.slice(0, -1).split("\0") : [];
  if ((!allowEmpty && !files.length) || files.some(file => !file || file.includes("\n") || file.includes("\r")) || new Set(files).size !== files.length)
    throw new Error("FAIL-CLOSED: empty, malformed or duplicate proposal Git paths");
  return files;
}
function proposalAcceptedHead(options: ProposalRejectionGitOptions): string {
  proposalAdmission(options);
  const head = activityDetailRevision(options, "rev-parse HEAD");
  if (activityDetailRevision(options, `merge-base ${PROPOSAL_REJECTION_BASE} HEAD`) !== PROPOSAL_REJECTION_BASE)
    throw new Error("FAIL-CLOSED: proposal rejection accepted base is not an ancestor");
  return head;
}
export function resolveProposalRejectionWorkingFiles(options: ProposalRejectionGitOptions = {}): string[] {
  proposalAcceptedHead(options);
  const files = [...proposalPaths(activityDetailGit(options, `diff --no-renames --name-only -z ${PROPOSAL_REJECTION_BASE} --`), true),
    ...proposalPaths(activityDetailGit(options, "ls-files --others --exclude-standard -z"), true)];
  if (!files.length || new Set(files).size !== files.length) throw new Error("FAIL-CLOSED: empty or duplicate proposal working range");
  return files;
}
export function resolveProposalRejectionChangedFiles(options: ProposalRejectionGitOptions = {}): GovernanceDelta {
  const head = proposalAcceptedHead(options), remote = activityDetailRevision(options, "rev-parse origin/main");
  const mode = remote === head ? "current-main-push" : "pr-branch";
  const range = mode === "current-main-push" ? `${activityDetailRevision(options, 'rev-parse "HEAD^1"')}..${head}` : `${PROPOSAL_REJECTION_BASE}...${head}`;
  return { mode, range, mergeBase: PROPOSAL_REJECTION_BASE,
    files: proposalPaths(activityDetailGit(options, `diff --no-renames --name-only -z ${range}`)) };
}
export function assertProposalRejectionChangedScope(entire: GovernanceDelta, options: ProposalRejectionGitOptions = {}): void {
  assertSameActivityRange(entire, resolveProposalRejectionChangedFiles(options), true);
  assertCompleteActivityScope(entire.files, PROPOSAL_REJECTION_ALLOWED, proposalRejectionScopeViolations(entire.files));
}
/** Only real filesystem detection selects this new entry; old synthetic/default callers stay unchanged. */
export function isProposalRejectionCheckout(cwd = process.cwd()): boolean {
  return proposalControlExists(activityMainPath(cwd, PROPOSAL_REJECTION_CONTROL));
}
export function assertProposalRejectionActualScope(options: ProposalRejectionGitOptions = {}): string[] {
  const files = resolveProposalRejectionWorkingFiles(options);
  assertCompleteActivityScope(files, PROPOSAL_REJECTION_ALLOWED, proposalRejectionScopeViolations(files));
  if (activityDetailRevision(options, "rev-parse HEAD") !== PROPOSAL_REJECTION_BASE)
    assertProposalRejectionChangedScope(resolveProposalRejectionChangedFiles(options), options);
  return files;
}
/** Explicit fixed historical diff, NEVER the current working/PR/main range. */
export function proposalRejectionHistoricalFiles(base: string, options: ProposalRejectionGitOptions = {}): string[] {
  assertProposalRejectionActualScope(options);
  if (!["ab84df35319d08247388051c451be523afe3c7a7", "f18855df297fa1a8f42e5fa3574453ef9b67d76b", MOBILE_GRAPH_BASE, NEW_USER_GUIDE_BASE, ACTIVITY_DETAIL_BASE, ACTIVITY_MAIN_BASE].includes(base))
    throw new Error("FAIL-CLOSED: unapproved proposal historical anchor");
  if (activityDetailRevision(options, `merge-base ${base} ${PROPOSAL_REJECTION_BASE}`) !== base)
    throw new Error("FAIL-CLOSED: proposal historical anchor is not an ancestor");
  return proposalPaths(activityDetailGit(options, `diff --no-renames --name-only -z ${base} ${PROPOSAL_REJECTION_BASE}`));
}
/** Used only for the seven overlapping members of the original nonselected15 content assertion. */
export function proposalRejectionHistoricalContent(file: string, options: ProposalRejectionGitOptions = {}): string {
  assertProposalRejectionActualScope(options);
  if (!(PROPOSAL_REJECTION_HISTORICAL_CONTENT as readonly string[]).includes(file))
    throw new Error("FAIL-CLOSED: unapproved proposal historical content path");
  const content = activityDetailGit(options, `show ${PROPOSAL_REJECTION_BASE}:"${file}"`);
  if (!content) throw new Error("FAIL-CLOSED: empty proposal historical content");
  return content;
}
export function proposalRejectionDashboardFiles(files: string[]): string[] {
  if (!hasProposalRejectionScope(files)) return files;
  if (proposalRejectionScopeViolations(files).length) throw new Error("FAIL-CLOSED: proposal rejection Dashboard scope extra");
  return files.filter(file => file !== PROPOSAL_REJECTION_PRODUCTION[0] && file !== PROPOSAL_REJECTION_PRODUCTION[3]);
}

// SiteReadiness13: a separately bound current scope; all accepted15f helper bytes remain above.
export const ASSESSMENT_CONTEXT_BASE = "15f6287cd53d9049a2d6e60958cab40f75911405";
export const ASSESSMENT_CONTEXT_CONTROL = "docs/SiteReadiness/13_ASSESSMENT_CONTEXT_CONTRACT.md";
export const ASSESSMENT_CONTEXT_ADMISSION_SHA = "EB4EDD946D269D3050C93D56F97C29C0C7DEA5D8847D5FB2AA1E80B5C5063E48";
export const ASSESSMENT_CONTEXT_PRODUCTION = ["src/app/api/activities/[id]/assess/route.ts", "src/lib/ai/assessment-context.ts",
  "src/lib/ai/assess.ts", "src/lib/ai/prompts.ts", "src/lib/store/assessment-context.repository.ts",
  "src/lib/store/repository.ts", "src/lib/store/supabase-repository.ts"] as const;
export const ASSESSMENT_CONTEXT_TESTS = ["tests/assessment-context-api.test.ts", "tests/assessment-context-authority.test.ts",
  "tests/assessment-context-golden.test.ts", "tests/assessment-context-governance.test.ts", "tests/assessment-context-http.test.ts",
  "tests/assessment-context-repository.test.ts", "tests/assessment-context.test.ts"] as const;
export const ASSESSMENT_CONTEXT_MARKERS = [ASSESSMENT_CONTEXT_CONTROL, "docs/Design ChatGPT/02_PRODUCT_DESIGN.md",
  ...ASSESSMENT_CONTEXT_PRODUCTION, ...ASSESSMENT_CONTEXT_TESTS] as const;
export const ASSESSMENT_CONTEXT_ALLOWED = [...ASSESSMENT_CONTEXT_MARKERS, "docs/MASTER_PROJECT_HANDOFF.md",
  "docs/SiteReadiness/14_ASSESSMENT_CONTEXT_VERIFICATION.md", "findings.md", "progress.md", "task_plan.md",
  "tests/activity-detail-governance.test.ts", "tests/graph-canvas-governance.test.ts", "tests/graph-mobile-governance.test.ts",
  "tests/helpers/governance-delta.ts", "tests/onboarding-governance.test.ts", "tests/phase5-dashboard-ui.test.tsx",
  "tests/phase8f-ui-governance.test.ts", "tests/proposal-rejection-governance.test.ts", "tests/visual-foundation.test.ts"] as const;
export const ASSESSMENT_CONTEXT_ACTIVITY_CONTENT = ["src/lib/store/supabase-repository.ts", "src/lib/ai/assess.ts", "src/lib/ai/prompts.ts"] as const;
export const ASSESSMENT_CONTEXT_COMPATIBILITY_CONTROL = "docs/SiteReadiness/15_ASSESSMENT_CONTEXT_COMPATIBILITY_CONTRACT.md";
export const ASSESSMENT_CONTEXT_COMPATIBILITY_SHA = "5ECB571DE51CDFC201DF63826EAD5250D383820E56B0B259AC2D4BCEAC9935FD";
export const ASSESSMENT_CONTEXT_DEMO_FIXTURE = "tests/ai-assessment-failure.test.ts";
export const ASSESSMENT_CONTEXT_COMPATIBILITY_MARKERS = [...ASSESSMENT_CONTEXT_MARKERS, ASSESSMENT_CONTEXT_COMPATIBILITY_CONTROL] as const;
export const ASSESSMENT_CONTEXT_COMPATIBILITY_ALLOWED = [...ASSESSMENT_CONTEXT_ALLOWED, ASSESSMENT_CONTEXT_COMPATIBILITY_CONTROL, ASSESSMENT_CONTEXT_DEMO_FIXTURE] as const;
export type AssessmentContextGitOptions = ProposalRejectionGitOptions & { readCompatibilityControl?: () => string };
function wantsContextCompatibility(files: readonly string[]): boolean {
  return files.includes(ASSESSMENT_CONTEXT_COMPATIBILITY_CONTROL) || files.includes(ASSESSMENT_CONTEXT_DEMO_FIXTURE);
}
export function hasAssessmentContextScope(files: readonly string[]): boolean {
  return ASSESSMENT_CONTEXT_MARKERS.every(file => files.includes(file)) && (!wantsContextCompatibility(files)
    || (ASSESSMENT_CONTEXT_COMPATIBILITY_MARKERS.every(file => files.includes(file)) && files.includes(ASSESSMENT_CONTEXT_DEMO_FIXTURE)));
}
export function assessmentContextScopeViolations(files: readonly string[]): string[] {
  const allowed = new Set<string>(hasAssessmentContextScope(files) ? (wantsContextCompatibility(files) ? ASSESSMENT_CONTEXT_COMPATIBILITY_ALLOWED : ASSESSMENT_CONTEXT_ALLOWED) : []);
  return [...(new Set(files).size === files.length ? [] : ["duplicate context paths"]), ...files.filter(file => !allowed.has(file))];
}
export function verifyAssessmentContextCompatibility(text: string): void {
  if (activityMainHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex").toUpperCase() !== ASSESSMENT_CONTEXT_COMPATIBILITY_SHA)
    throw new Error("FAIL-CLOSED: assessment context compatibility admission content is unbound");
}
function contextAllowed(files: readonly string[], options: AssessmentContextGitOptions): readonly string[] {
  if (!wantsContextCompatibility(files)) return ASSESSMENT_CONTEXT_ALLOWED;
  let text: string;
  try { text = options.readCompatibilityControl ? options.readCompatibilityControl()
    : readActivityMainControl(activityMainPath(options.cwd ?? process.cwd(), ASSESSMENT_CONTEXT_COMPATIBILITY_CONTROL), "utf8"); }
  catch { throw new Error("FAIL-CLOSED: assessment context compatibility admission could not be read"); }
  verifyAssessmentContextCompatibility(text); return ASSESSMENT_CONTEXT_COMPATIBILITY_ALLOWED;
}
export function verifyAssessmentContextAdmission(text: string): void {
  if (activityMainHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex").toUpperCase() !== ASSESSMENT_CONTEXT_ADMISSION_SHA)
    throw new Error("FAIL-CLOSED: assessment context admission content is unbound");
}
function contextAdmission(options: AssessmentContextGitOptions): void {
  let text: string;
  try { text = options.readControl ? options.readControl() : readActivityMainControl(activityMainPath(options.cwd ?? process.cwd(), ASSESSMENT_CONTEXT_CONTROL), "utf8"); }
  catch { throw new Error("FAIL-CLOSED: assessment context admission could not be read"); }
  verifyAssessmentContextAdmission(text);
}
function contextPaths(raw: string, empty = false): string[] {
  const files = proposalPaths(raw, empty);
  if (files.some(file => file.startsWith("/") || file.includes("\\") || file.split("/").some(part => !part || part === "." || part === "..") || /[\x00-\x1f]/.test(file)))
    throw new Error("FAIL-CLOSED: malformed context Git path");
  return files;
}
function contextAcceptedHead(options: AssessmentContextGitOptions): string {
  contextAdmission(options); const head = activityDetailRevision(options, "rev-parse HEAD");
  if (activityDetailRevision(options, `merge-base ${ASSESSMENT_CONTEXT_BASE} HEAD`) !== ASSESSMENT_CONTEXT_BASE)
    throw new Error("FAIL-CLOSED: context accepted base is not an ancestor");
  return head;
}
export function resolveAssessmentContextWorkingFiles(options: AssessmentContextGitOptions = {}): string[] {
  contextAcceptedHead(options);
  const files = [...contextPaths(activityDetailGit(options, `diff --no-renames --name-only -z ${ASSESSMENT_CONTEXT_BASE} --`), true),
    ...contextPaths(activityDetailGit(options, "ls-files --others --exclude-standard -z"), true)];
  if (!files.length || new Set(files).size !== files.length) throw new Error("FAIL-CLOSED: empty or duplicate context working range");
  return files;
}
export function resolveAssessmentContextChangedFiles(options: AssessmentContextGitOptions = {}): GovernanceDelta {
  const head = contextAcceptedHead(options), remote = activityDetailRevision(options, "rev-parse origin/main");
  const mode = head === remote ? "current-main-push" : "pr-branch";
  const range = mode === "current-main-push" ? `${activityDetailRevision(options, 'rev-parse "HEAD^1"')}..${head}` : `${ASSESSMENT_CONTEXT_BASE}...${head}`;
  return { mode, range, mergeBase: ASSESSMENT_CONTEXT_BASE, files: contextPaths(activityDetailGit(options, `diff --no-renames --name-only -z ${range}`)) };
}
export function assertAssessmentContextChangedScope(delta: GovernanceDelta, options: AssessmentContextGitOptions = {}): void {
  assertSameActivityRange(delta, resolveAssessmentContextChangedFiles(options), true);
  assertCompleteActivityScope(delta.files, contextAllowed(delta.files, options), assessmentContextScopeViolations(delta.files));
}
export function isAssessmentContextCheckout(cwd = process.cwd()): boolean {
  return proposalControlExists(activityMainPath(cwd, ASSESSMENT_CONTEXT_CONTROL));
}
export function assertAssessmentContextActualScope(options: AssessmentContextGitOptions = {}): string[] {
  const files = resolveAssessmentContextWorkingFiles(options);
  assertCompleteActivityScope(files, contextAllowed(files, options), assessmentContextScopeViolations(files));
  if (activityDetailRevision(options, "rev-parse HEAD") !== ASSESSMENT_CONTEXT_BASE)
    assertAssessmentContextChangedScope(resolveAssessmentContextChangedFiles(options), options);
  return files;
}
/** Old preReject contracts only: an explicit real fixed-endpoint diff after the strict current gate. */
export function assessmentContextHistoricalFiles(anchor: string, options: AssessmentContextGitOptions = {}): string[] {
  assertAssessmentContextActualScope(options);
  if (!["ab84df35319d08247388051c451be523afe3c7a7", "f18855df297fa1a8f42e5fa3574453ef9b67d76b", MOBILE_GRAPH_BASE,
    NEW_USER_GUIDE_BASE, ACTIVITY_DETAIL_BASE, ACTIVITY_MAIN_BASE].includes(anchor)) throw new Error("FAIL-CLOSED: unapproved context historical anchor");
  if (activityDetailRevision(options, `merge-base ${anchor} ${PROPOSAL_REJECTION_BASE}`) !== anchor)
    throw new Error("FAIL-CLOSED: context historical anchor is not an ancestor");
  return contextPaths(activityDetailGit(options, `diff --no-renames --name-only -z ${anchor} ${PROPOSAL_REJECTION_BASE}`));
}
/** Reject's own exact25 history has a different accepted endpoint, never a cumulative old/current range. */
export function assessmentContextRejectionHistoricalFiles(options: AssessmentContextGitOptions = {}): string[] {
  assertAssessmentContextActualScope(options);
  if (activityDetailRevision(options, `merge-base ${PROPOSAL_REJECTION_BASE} ${ASSESSMENT_CONTEXT_BASE}`) !== PROPOSAL_REJECTION_BASE)
    throw new Error("FAIL-CLOSED: context rejection endpoint is not descended from accepted78d");
  const files = contextPaths(activityDetailGit(options, `diff --no-renames --name-only -z ${PROPOSAL_REJECTION_BASE} ${ASSESSMENT_CONTEXT_BASE}`));
  assertCompleteActivityScope(files, PROPOSAL_REJECTION_ALLOWED, proposalRejectionScopeViolations(files));
  return files;
}
/** No blanket source/docs fallback: three independently named assertion groups and ten exact paths. */
export function assessmentContextHistoricalContent(file: string, group: "onboarding" | "activity" | "rejection", options: AssessmentContextGitOptions = {}): string {
  assertAssessmentContextActualScope(options);
  const accepted = group === "onboarding" ? (PROPOSAL_REJECTION_HISTORICAL_CONTENT as readonly string[])
    : group === "activity" ? (ASSESSMENT_CONTEXT_ACTIVITY_CONTENT as readonly string[])
    : group === "rejection" ? ["src/lib/ai/prompts.ts"] : [];
  if (!accepted.includes(file)) throw new Error("FAIL-CLOSED: unapproved context historical content group/path");
  const endpoint = group === "onboarding" ? PROPOSAL_REJECTION_BASE : ASSESSMENT_CONTEXT_BASE;
  if (activityDetailRevision(options, `merge-base ${endpoint} ${ASSESSMENT_CONTEXT_BASE}`) !== endpoint)
    throw new Error("FAIL-CLOSED: context content endpoint is not an ancestor");
  const content = activityDetailGit(options, `show ${endpoint}:"${file}"`);
  if (!content) throw new Error("FAIL-CLOSED: empty context historical content");
  return content;
}

