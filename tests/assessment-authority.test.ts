import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/0021_assessment_authority.sql"),
  "utf8",
);

describe("Round12 assessment and Activity authority migration", () => {
  test("removes client Activity updates and only permits pending deletes", () => {
    expect(migration).toContain("drop policy if exists activities_update");
    expect(migration).toContain("activities_delete_pending");
    expect(migration).toContain("status = 'pending_assessment'");
  });

  test("keeps assessment persistence server-only and atomic", () => {
    expect(migration).toContain("create or replace function public.record_ai_assessment");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public");
    expect(migration).toContain("for update");
    expect(migration).toContain("v_activity.rules_version");
    expect(migration).toContain("set status = 'assessed'");
    expect(migration).toContain("revoke all on function public.record_ai_assessment");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("to service_role");
  });
});
