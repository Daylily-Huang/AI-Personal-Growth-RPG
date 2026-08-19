import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Activity immutability migration", () => {
  const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/0020_activity_immutability.sql"), "utf8");

  test("freezes confirmed rows and immutable facts", () => {
    expect(migration).toContain("old.status = 'confirmed'");
    expect(migration).toContain("new.raw_input is distinct from old.raw_input");
    expect(migration).toContain("new.rules_version is distinct from old.rules_version");
    expect(migration).toContain("set search_path = public");
    expect(migration).toContain("trg_activity_immutability");
  });
});
