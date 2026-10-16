import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

export const MONTHLY_BASE = "0398f69f8aeb7144e22b4011117b59525f068ca6";
const REVIEW_HEAD = "f2f847cf24671eaa8c610a61e1a468a5e3798e57";
const REVIEW_BASE = "69978e833bf0af7444f1eda92f573b0b479ba3e0";
// Subsequent authorized UI-only amendment: SiteReadiness25, QuestCard and its dedicated regression tests.
export const MONTHLY_ALLOWED = [
  // Explicit Image28 amendment; local Windows OCR, no cloud image upload or growth mutation.
  "docs/SiteReadiness/28_LOCAL_IMAGE_OCR.md", "src/lib/local-library/image.ts", "src/lib/local-library/ocr.ts", "scripts/local-image-ocr.ps1",
  "src/app/api/local-library/ocr/route.ts", "tests/local-library-images.test.ts", "tests/local-library-ocr.test.ts",
  // Explicit Office27 amendment; browser-only extraction, no growth or database changes.
  "docs/SiteReadiness/27_LOCAL_OFFICE_TEXT_IMPORT.md", "src/lib/local-library/office.ts", "tests/local-library-office.test.ts",
  // Explicit local-library26 amendment; no changes to historical guards or growth rules.
  "README.md", "CHANGELOG.md", "docs/MASTER_PROJECT_HANDOFF.md", "docs/SiteReadiness/26_LOCAL_FOLDER_LIBRARY.md", "src/app/artifacts/page.tsx",
  "src/app/local-library/page.tsx", "src/app/api/local-library/route.ts", "src/app/api/local-library/analyze/route.ts", "src/app/api/local-library/confirm/route.ts",
  "src/lib/local-library/schema.ts", "src/lib/local-library/files.ts", "src/lib/local-library/ai.ts", "src/lib/local-library/http.ts", "src/lib/local-library/store.ts",
  "tests/local-library.test.ts", "tests/local-library-ai.test.ts", "tests/local-library-ui.test.tsx", "tests/local-library-scope.test.ts",
  "docs/SiteReadiness/25_CUSTOM_QUEST_PROGRESS.md", "src/components/quests/QuestCard.tsx", "tests/quest-progress-custom.test.tsx",
  "docs/SiteReadiness/24_MONTHLY_REVIEW_AND_GAME_FEEDBACK.md", "task_plan.md", "progress.md", "findings.md",
  "src/lib/review-insights/types.ts", "src/lib/review-insights/validation.ts", "src/lib/review-insights/summary.ts", "src/lib/review-insights/client.ts", "src/lib/review-insights/ai.ts", "src/lib/review-insights/repository.ts", "src/lib/review-insights/monthly.ts",
  "src/components/journey/ReviewInsightsPanel.tsx", "src/components/journey/ReviewsClient.tsx", "src/components/journey/MonthlyGrowthReport.tsx",
  "src/app/dashboard/page.tsx", "src/components/dashboard/SettlementFeedback.tsx", "src/components/dashboard/SettlementFeedback.module.css",
  "tests/review-insights-validation.test.ts", "tests/monthly-review.test.ts", "tests/monthly-review-ui.test.tsx", "tests/settlement-feedback.test.tsx", "tests/monthly-scope.test.ts", "tests/helpers/monthly-scope.ts", "tests/helpers/governance-delta.ts",
  "tests/onboarding-governance.test.ts", "tests/review-insights-governance.test.ts",
] as const;
type Options = { cwd?: string; execute?: (command: string) => string; [key: string]: unknown };
type Git = (args: string[]) => string;
const gitAt = (cwd: string): Git => args => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 16e6 });
export const isMonthlyReviewCheckout = (cwd = process.cwd()) => existsSync(path.join(cwd, MONTHLY_ALLOWED[0]));

/** The only change outside old Review islands is the filter's 44px touch target. */
export function restoreMonthlyReviewClient(source: string): string {
  return source.replace('className={`${journeyInputClass} min-h-11 min-w-40`}', 'className={`${journeyInputClass} min-w-40`}');
}

/** Original onboarding freeze proves its accepted Dashboard; new behavior has
 * separate current-scope and settlement feedback tests. This cannot admit HEAD. */
export function monthlyOnboardingProtectedHash(file: string, original: () => string, cwd = process.cwd()): string {
  if (file !== "src/app/dashboard/page.tsx" || !isMonthlyReviewCheckout(cwd)) return original();
  assertMonthlyScope(cwd);
  return gitAt(cwd)(["rev-parse", `${MONTHLY_BASE}:${file}`]).trim();
}
export function restoreMonthlyOnboarding(source: string): string {
  return source.replace(/^\/\/ MONTHLY_ONBOARDING_HISTORY_BEGIN\r?\n[\s\S]*?^\/\/ MONTHLY_ONBOARDING_HISTORY_END\r?\n/m, "")
    .replace('monthlyOnboardingProtectedHash(protectedFile, () => execFileSync("git", ["hash-object", `--path=${protectedFile}`, protectedFile], { encoding: "utf8" }).trim())', 'execFileSync("git", ["hash-object", `--path=${protectedFile}`, protectedFile], { encoding: "utf8" }).trim()');
}

export function assertMonthlyScope(cwd = process.cwd(), git: Git = gitAt(cwd)): string[] {
  const revision = (name: string) => { const result = git(["rev-parse", name]).trim(); if (!/^[a-f0-9]{40}$/.test(result)) throw Error("FAIL-CLOSED: monthly revision"); return result; };
  const head = revision("HEAD"), remote = revision("origin/main");
  for (const endpoint of [head, remote]) if (git(["merge-base", MONTHLY_BASE, endpoint]).trim() !== MONTHLY_BASE) throw Error("FAIL-CLOSED: monthly ancestry");
  const read = () => {
    const raw = [git(["diff", "--no-renames", "--name-only", "-z", MONTHLY_BASE, "--"]), git(["ls-files", "--others", "--exclude-standard", "-z"])];
    if (raw.some(value => value && !value.endsWith("\0"))) throw Error("FAIL-CLOSED: monthly paths");
    const files = raw.flatMap(value => value.split("\0").filter(Boolean));
    if (new Set(files).size !== files.length || files.length !== MONTHLY_ALLOWED.length || files.some(file => !(MONTHLY_ALLOWED as readonly string[]).includes(file))) throw Error("FAIL-CLOSED: monthly scope");
    return files.sort();
  };
  const files = read();
  if (revision("HEAD") !== head || revision("origin/main") !== remote || read().join("\0") !== files.join("\0")) throw Error("FAIL-CLOSED: monthly drift");
  return files;
}

/** Current authorization first; prior Review tests still run against their real committed range. */
export function monthlyReviewHistoricalOptions<T extends { cwd?: string; execute?: (command: string) => string }>(options: T): T {
  if (["execute", "readControl", "readFixture", "readAmendment", "readUIFixture", "readAPIFixture"].some(key => Object.hasOwn(options, key))) return options;
  const cwd = options.cwd ?? process.cwd();
  if (!existsSync(path.join(cwd, MONTHLY_ALLOWED[0]))) return options;
  assertMonthlyScope(cwd);
  const git = gitAt(cwd);
  const result: Options = { cwd, execute(command) {
    if (command === "rev-parse HEAD") return git(["rev-parse", REVIEW_HEAD]);
    if (command === "rev-parse origin/main") return REVIEW_BASE;
    if (command === "ls-files --others --exclude-standard -z") return "";
    if (command === `merge-base ${REVIEW_BASE} HEAD`) return git(["merge-base", REVIEW_BASE, REVIEW_HEAD]);
    if (command === `merge-base ${REVIEW_BASE} origin/main`) return git(["merge-base", REVIEW_BASE, REVIEW_BASE]);
    if (command.startsWith(`diff --no-renames --name-only -z ${REVIEW_BASE}`)) return git(["diff", "--no-renames", "--name-only", "-z", REVIEW_BASE, REVIEW_HEAD, "--"]);
    // Only documented commands are mapped; unknown paths/commands stay rejected.
    if (command.startsWith(`show ${REVIEW_BASE}:`)) return git(["show", `${REVIEW_BASE}:${command.slice(`show ${REVIEW_BASE}:`.length).replace(/^"|"$/g, "")}`]);
    const blob = command.match(/^show ([a-f0-9]{40}):(?:"([^"]+)"|([A-Za-z0-9_./-]+))$/);
    if (blob && !(blob[2] ?? blob[3]).split("/").includes("..") && !(blob[2] ?? blob[3]).startsWith("/")) return git(["show", `${blob[1]}:${blob[2] ?? blob[3]}`]);
    if (/^rev-parse [a-f0-9]{40}$/.test(command)) return git(command.split(" "));
    if (/^merge-base [a-f0-9]{40} [a-f0-9]{40}$/.test(command)) return git(command.split(" "));
    if (/^diff --no-renames --name-only -z [a-f0-9]{40} [a-f0-9]{40}$/.test(command)) return git(command.split(" "));
    throw Error("FAIL-CLOSED: unknown Review historical command");
  } };
  return result as T;
}
