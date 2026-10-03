import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { evaluateScopedPolicy, phase8eNavigationPolicy, PHASE8E_ACCEPTED_BACKEND, PHASE8E_ACCEPTED_HEAD, PHASE8E_CONTROL } from "./helpers/governance-delta";

const navigation = [PHASE8E_CONTROL, "src/app/rewards/wishes/page.tsx", "src/components/layout/AppSidebar.tsx", "src/components/layout/MobileNav.tsx"];
const evaluate = (files: string[]) => evaluateScopedPolicy(files, phase8eNavigationPolicy(files));
describe("Phase 8E Round 4 narrow navigation integration", () => {
  test("only exact accepted backend identities are allowed with the navigation contract", () => {
    expect(evaluate([...navigation, ...PHASE8E_ACCEPTED_BACKEND]).violations).toEqual([]);
    for (const unknown of ["src/app/api/rewards/unsafe/route.ts", "src/lib/reward/unsafe.ts", "supabase/migrations/9999.sql", "src/lib/growth-engine/engine.ts"]) {
      expect(evaluate([...navigation, ...PHASE8E_ACCEPTED_BACKEND, unknown]).violations.some(value => value.includes(unknown))).toBe(true);
    }
  });
  test("missing controller, missing UI, and other shell edits fail closed", () => {
    for (const files of [navigation.filter(file => file !== PHASE8E_CONTROL), navigation.filter(file => file !== "src/app/rewards/wishes/page.tsx"), [...navigation, "src/components/layout/AppShell.tsx"]]) {
      expect(evaluate([...files, ...PHASE8E_ACCEPTED_BACKEND]).violations.length).toBeGreaterThan(0);
    }
  });
  test("every accepted backend Git blob remains identical to the Round 3 head", () => {
    for (const file of PHASE8E_ACCEPTED_BACKEND) {
      const accepted = execFileSync("git", ["rev-parse", `${PHASE8E_ACCEPTED_HEAD}:${file}`], { encoding: "utf8" }).trim();
      const current = execFileSync("git", ["hash-object", `--path=${file}`, file], { encoding: "utf8" }).trim();
      expect(current, file).toBe(accepted);
    }
  });
  test("UI imports no server authority, bypass or unscoped visual primitive", () => {
    for (const file of readdirSync("src/components/rewards")) {
      const text = readFileSync(`src/components/rewards/${file}`, "utf8");
      expect(text, file).not.toMatch(/from ["']@\/lib\/(?:supabase|store|reward\/(?:repository|request|http|service))/);
      expect(text, file).not.toMatch(/\.rpc\(|SERVICE_ROLE|SECRET_KEY|--gold-|z-(?:40|50)\b/);
    }
  });
});
