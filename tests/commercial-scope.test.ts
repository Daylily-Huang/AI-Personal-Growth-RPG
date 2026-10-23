import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { COMMERCIAL_BASE, COMMERCIAL_FILES, assertCommercialFiles, assertCommercialScope, restoreCommercialMonthly, restoreCommercialGuard, COMMERCIAL_GUARD_PATCHES, commercialFrozenUIContent, commercialFrozenUIHash } from "./helpers/commercial-scope";
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16e6 }).replace(/\r\n/g, "\n");
describe("Commercial foundation explicit authorization", () => {
  test("binds the current complete change set independently of archived ranges", () => expect(assertCommercialScope().sort()).toEqual([...COMMERCIAL_FILES].sort()));
  test.each(COMMERCIAL_FILES)("missing %s refuses authorization", file => expect(() => assertCommercialFiles(COMMERCIAL_FILES.filter(p => p !== file))).toThrow("FAIL-CLOSED"));
  test.each(["src/app/api/activities/route.ts", "src/lib/growth-engine/xp.ts", "src/lib/ai/config.ts", "src/lib/auth/login-http.ts", "supabase/migrations/0057.sql", "package.json", ".env.local", "src/components/unapproved.tsx"])("extra path %s refuses authorization", file => expect(() => assertCommercialFiles([...COMMERCIAL_FILES, file])).toThrow("FAIL-CLOSED"));
  test("duplicate paths refuse authorization", () => expect(() => assertCommercialFiles([...COMMERCIAL_FILES, COMMERCIAL_FILES[0]])).toThrow("FAIL-CLOSED"));
  test("monthly guard has only an invertible current-scope adapter; every old assertion remains", () => { const current = readFileSync("tests/helpers/monthly-scope.ts", "utf8").replace(/\r\n/g, "\n"); expect(restoreCommercialMonthly(current)).toBe(git("show", COMMERCIAL_BASE + ":tests/helpers/monthly-scope.ts")); });
  test("no current production mutation touches backend, credentials, migrations or dependencies", () => { const actual = assertCommercialScope(); expect(actual.some(p => p.startsWith("src/app/api/") || p.startsWith("supabase/") || /^src\/lib\/(auth|supabase|store|growth-engine|ai)\//.test(p) || ["package.json", "pnpm-lock.yaml", ".env.local"].includes(p))).toBe(false); });
});

describe("Explicit compatibility repair preserves whole accepted guards", () => {
  test.each(Object.keys(COMMERCIAL_GUARD_PATCHES))("legacy guard %s restores in full to the accepted base", file => {
    const current = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    expect(restoreCommercialGuard(file, current)).toBe(git("show", COMMERCIAL_BASE + ":" + file));
  });
  test("non-navigation files never receive historical content or hash substitution", () => {
    for (const file of ["src/lib/ai/assess.ts", "src/lib/store/request-repository.ts", "src/app/api/activities/route.ts", "src/components/layout/unapproved.tsx", "package.json"]) {
      expect(commercialFrozenUIContent(file, "current-source")).toBe("current-source");
      expect(commercialFrozenUIHash(file, "current-hash")).toBe("current-hash");
    }
  });
  test("an unrelated edit in a legacy guard is still visible after exact wiring inversion", () => {
    const file = "tests/phase8f-ui-governance.test.ts", current = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    expect(restoreCommercialGuard(file, current + "\n// unrelated mutation\n")).not.toBe(git("show", COMMERCIAL_BASE + ":" + file));
    expect(() => restoreCommercialGuard(file, current.replace("commercialFrozenUIHash(file,", "unapprovedHash(file,"))).toThrow("FAIL-CLOSED");
  });
});
