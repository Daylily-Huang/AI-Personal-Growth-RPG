import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const BASE = "8fd9becf9e90242a43251d6bf628697de65295db";
const OFFICE_FILES = ["docs/SiteReadiness/27_LOCAL_OFFICE_TEXT_IMPORT.md", "src/lib/local-library/office.ts", "tests/local-library-office.test.ts"];
export const LIBRARY_FILES = ["README.md", "CHANGELOG.md", "docs/MASTER_PROJECT_HANDOFF.md", "docs/SiteReadiness/26_LOCAL_FOLDER_LIBRARY.md", "task_plan.md", "progress.md", "findings.md", "tests/helpers/monthly-scope.ts", "src/app/artifacts/page.tsx", "src/app/local-library/page.tsx", "src/app/api/local-library/route.ts", "src/app/api/local-library/analyze/route.ts", "src/app/api/local-library/confirm/route.ts", "src/lib/local-library/schema.ts", "src/lib/local-library/files.ts", "src/lib/local-library/ai.ts", "src/lib/local-library/http.ts", "src/lib/local-library/store.ts", "tests/local-library.test.ts", "tests/local-library-ai.test.ts", "tests/local-library-ui.test.tsx", "tests/local-library-scope.test.ts", ...OFFICE_FILES];
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16e6 });
const normalized = (s: string) => s.replace(/\r\n/g, "\n");
describe("local-library explicit authorization preserves prior freezes", () => {
  it("has exactly the authorized complete delta and no private inputs or migrations", () => {
    const actual = [...git("diff", "--no-renames", "--name-only", "-z", BASE, "--").split("\0"), ...git("ls-files", "--others", "--exclude-standard", "-z").split("\0")].filter(Boolean);
    expect(new Set(actual).size).toBe(actual.length); expect(actual.sort()).toEqual([...LIBRARY_FILES].sort());
    expect(actual.some(f => f.includes(".env") || f.includes(".data/") || f.startsWith("supabase/"))).toBe(false);
  });
  it("the artifacts page restores exactly after removing only its new import and entry link", () => {
    const file = "src/app/artifacts/page.tsx";
    const current = normalized(readFileSync(file, "utf8"));
    const restored = current.replace('import Link from "next/link";\n', "").replace(/^          <Link href="\/local-library"[^\n]*\n/m, "");
    expect(restored).toBe(normalized(git("show", `${BASE}:${file}`)));
  });
  it("the old monthly guard restores exactly after removing only the explicit new allowlist", () => {
    const file = "tests/helpers/monthly-scope.ts", current = normalized(readFileSync(file, "utf8"));
    const restored = current.replace(/^  \/\/ Explicit Office27 amendment[^\n]*\n  [^\n]*\n/m, "").replace(/^  \/\/ Explicit local-library26 amendment[^\n]*\n(?:  [^\n]*\n){4}/m, "");
    expect(restored).toBe(normalized(git("show", `${BASE}:${file}`)));
  });
  it("Office extension changes only its explicit paths and leaves API, AI, confirmation and dependencies intact", () => {
    const allowed = ["README.md", "CHANGELOG.md", "docs/MASTER_PROJECT_HANDOFF.md", "task_plan.md", "progress.md", "findings.md", "tests/helpers/monthly-scope.ts", "src/app/local-library/page.tsx", "src/lib/local-library/schema.ts", "src/lib/local-library/files.ts", "tests/local-library.test.ts", "tests/local-library-ui.test.tsx", "tests/local-library-scope.test.ts", ...OFFICE_FILES];
    const actual = [...git("diff", "--no-renames", "--name-only", "-z", "5037a69b9c0104032283a2f2b2c42991a441ceed", "--").split("\0"), ...git("ls-files", "--others", "--exclude-standard", "-z").split("\0")].filter(Boolean);
    expect(actual.sort()).toEqual(allowed.sort());
    for (const file of ["src/lib/local-library/ai.ts", "src/lib/local-library/http.ts", "src/lib/local-library/store.ts", "package.json", "pnpm-lock.yaml"]) expect(normalized(readFileSync(file, "utf8"))).toBe(normalized(git("show", `5037a69b9c0104032283a2f2b2c42991a441ceed:${file}`)));
  });
});
