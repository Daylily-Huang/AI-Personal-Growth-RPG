import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";

const base = "f18855df297fa1a8f42e5fa3574453ef9b67d76b";
const control = "docs/Phase8/27_PHASE8F_UI_CONTRACT.md";
const uiPaths = new Set([
  "src/app/rewards/layout.tsx", "src/app/rewards/milestones/page.tsx", "src/components/rewards/RewardsNav.tsx",
  "src/components/milestones/client.tsx", "src/components/milestones/MilestoneCommand.tsx",
  "src/components/milestones/MilestoneDetails.tsx", "src/components/milestones/MilestonesClient.tsx",
]);
function violations(files: string[]) {
  return files.filter(file => /^(src\/|supabase\/|\.github\/)/.test(file) || ["package.json", "pnpm-lock.yaml", "next.config.ts", "tsconfig.json", "vitest.config.ts"].includes(file))
    .filter(file => !files.includes(control) || !uiPaths.has(file));
}
describe("8F Round4 exact UI scope under27", () => {
  test("working candidate and eventual full branch retain frozen server, SQL, Core, Wishes and navigation", () => {
    const tracked = execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", base, "--"], { encoding: "utf8" }).split("\0").filter(Boolean);
    const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
    expect(violations([...tracked, ...untracked])).toEqual([]);
  });
  test("exact controller-bound paths only, no blanket milestone/backend exception", () => {
    expect(violations([control, ...uiPaths])).toEqual([]);
    expect(violations([...uiPaths])).toHaveLength(uiPaths.size);
    for (const path of ["src/lib/milestone/types.ts", "src/app/api/milestones/route.ts", "supabase/migrations/0052_phase8f_milestones_rpc_authority.sql", "src/components/rewards/WishesClient.tsx", "src/components/layout/AppSidebar.tsx", "src/components/ui/BaseModal.tsx", "src/components/milestones/unsafe.tsx", ".github/workflows/ci.yml", "package.json"]) {
      expect(violations([control, ...uiPaths, path])).toEqual([path]);
    }
  });
  test("UI has no server authority imports, RPC calls, new amount calculator or fetching proof URLs", () => {
    for (const file of readdirSync("src/components/milestones")) {
      const source = readFileSync(`src/components/milestones/${file}`, "utf8");
      expect(source, file).not.toMatch(/from ["']@\/lib\/(?:supabase|store|growth-engine|ai|milestone\/(?:repository|request|http|proposal-review)|reward\/)/);
      expect(source, file).not.toMatch(/\.rpc\(|SERVICE_ROLE|SECRET_KEY|localStorage|sessionStorage|dangerouslySetInnerHTML|window\.open\(|href=\{.*(?:evidence|credential)/);
    }
  });
  test("Rewards wrapper adds local links only; AppShell and main navigation remain accepted blobs", () => {
    for (const file of ["src/components/layout/AppShell.tsx", "src/components/layout/AppSidebar.tsx", "src/components/layout/MobileNav.tsx", "src/components/ui/BaseModal.tsx", "src/components/rewards/client.tsx", "src/components/rewards/RewardConfirmation.tsx", "src/app/rewards/wishes/page.tsx"]) {
      expect(execFileSync("git", ["hash-object", `--path=${file}`, file], { encoding: "utf8" }).trim(), file)
        .toBe(execFileSync("git", ["rev-parse", `${base}:${file}`], { encoding: "utf8" }).trim());
    }
  });
});
