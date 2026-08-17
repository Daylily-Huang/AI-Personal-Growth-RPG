import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Offline (no live DB) static checks for the M3 schema bootstrap + RLS wiring.
 *
 * WHAT IT PROVES:
 *   - the full migration chain (0001..0017) exists in the docs/06 order;
 *   - every private table is created before 0017 and is handed to the RLS block
 *     in 0017 (enabled + auth.uid() policies + auth bootstrap trigger);
 *   - the hard DB invariants reviewers demanded are literally present
 *     (xp_type CHECK, one-activity-settlement partial unique idx,
 *     assessment unique, one-confirmed per activity, one pending verification);
 *   - .env.example follows the new key model (no leaked old naming).
 *
 * WHAT IT DOES *NOT* PROVE (needs a provisioned project → integration suite):
 *   - migrations actually run on an empty DB;
 *   - "User A cannot read User B's rows" at runtime (two real sessions).
 *   Those are M3-stage-2/CI integration tests with cloud secrets.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const EXPECTED_ORDER = [
  "0001_profiles",
  "0002_player_states",
  "0003_domains",
  "0004_skills",
  "0005_quests",
  "0006_activities",
  "0007_ai_assessments",
  "0008_evidence_records",
  "0009_xp_transactions",
  "0010_mastery_verifications",
  "0011_mastery_events",
  "0012_knowledge_graph",
  "0013_artifacts",
  "0014_reviews",
  "0015_rules_versions",
  "0016_indexes",
  "0017_rls",
];

const PRIVATE_TABLES = [
  "profiles",
  "player_states",
  "domains",
  "skills",
  "quests",
  "activities",
  "ai_assessments",
  "evidence_records",
  "xp_transactions",
  "mastery_verifications",
  "mastery_events",
  "knowledge_nodes",
  "knowledge_edges",
  "artifacts",
  "artifact_links",
  "reviews",
];

function readMigrations(): Map<string, string> {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  const map = new Map<string, string>();
  for (const file of files) {
    map.set(file.replace(/\.sql$/, ""), fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  return map;
}

describe("M3 Stage1 — migration chain completeness & order", () => {
  const migrations = readMigrations();

  test("every expected migration file exists (0001..0017)", () => {
    for (const name of EXPECTED_ORDER) {
      expect(migrations.has(name), `missing migration ${name}`).toBe(true);
    }
  });

  test("no unknown migration files beyond the expected chain", () => {
    const names = Array.from(migrations.keys()).sort();
    expect(names).toEqual([...EXPECTED_ORDER].sort());
  });

  test("migration numbers are strictly increasing in docs order", () => {
    const numbers = EXPECTED_ORDER.map((n) => Number(n.slice(0, 4)));
    for (let i = 1; i < numbers.length; i++) expect(numbers[i]).toBeGreaterThan(numbers[i - 1]);
  });

  test("every private table is created before the RLS migration", () => {
    const seq = [...EXPECTED_ORDER];
    const rlsIndex = seq.indexOf("0017_rls");
    for (const table of PRIVATE_TABLES) {
      const createdIn = seq.findIndex((name) =>
        (migrations.get(name) ?? "").includes(`create table if not exists public.${table}`),
      );
      expect(createdIn, `table ${table} never created`).toBeGreaterThanOrEqual(0);
      expect(createdIn, `table ${table} created after RLS migration`).toBeLessThan(rlsIndex);
    }
  });
});

describe("M3 Stage1 — DB invariants demanded by reviewers", () => {
  const migrations = readMigrations();

  test("0009 xp_transactions: xp_type CHECK + assessment unique + one activity settlement", () => {
    const sql = migrations.get("0009_xp_transactions") ?? "";
    expect(sql).toContain("check (xp_type in ('activity', 'adjustment', 'correction'))");
    expect(sql).toContain("constraint xp_transactions_assessment_id_key unique (assessment_id)");
    expect(sql).toContain("xp_transactions_one_activity_settlement_idx");
    expect(sql).toContain("where xp_type = 'activity'");
  });

  test("0007 ai_assessments: status includes superseded + one confirmed per activity", () => {
    const sql = migrations.get("0007_ai_assessments") ?? "";
    expect(sql).toContain("'superseded'");
    expect(sql).toContain("ai_assessments_one_confirmed_idx");
    expect(sql).toContain("where status = 'confirmed'");
  });

  test("0010 mastery_verifications: skill_id not null + one pending per skill", () => {
    const sql = migrations.get("0010_mastery_verifications") ?? "";
    expect(sql).toContain("skill_id uuid not null references skills(id)");
    expect(sql).toContain("mastery_verifications_one_pending_idx");
    expect(sql).toContain("where status = 'pending'");
  });

  test("0017 rls: auth.uid() policies + auth bootstrap trigger exist", () => {
    const sql = migrations.get("0017_rls") ?? "";
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("handle_new_user");
    expect(sql).toContain("on_auth_user_created");
    expect(sql).toContain("security definer");
  });

  test("0017 rls: every private table is wired to RLS (referenced in policy arrays)", () => {
    const sql = migrations.get("0017_rls") ?? "";
    for (const table of PRIVATE_TABLES) {
      expect(sql, `table ${table} missing from RLS wiring`).toContain(`'${table}'`);
    }
  });

  test("auth tables reference auth.users and trigger backfills profiles+player_states", () => {
    const one = migrations.get("0001_profiles") ?? "";
    const two = migrations.get("0002_player_states") ?? "";
    expect(one).toContain("references auth.users(id)");
    expect(two).toContain("references auth.users(id)");
    const rls = migrations.get("0017_rls") ?? "";
    expect(rls).toContain("insert into public.profiles (user_id) values (new.id)");
    expect(rls).toContain("insert into public.player_states (user_id) values (new.id)");
  });
});

describe("M3 Stage1 — env key model (.env.example)", () => {
  test("uses new Supabase naming, no retired ANON/SERVICE_ROLE names", () => {
    const example = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    expect(example).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(example).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(example).toContain("SUPABASE_SECRET_KEY");
    expect(example).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(example).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  test("SUPABASE_SECRET_KEY appears nowhere under a NEXT_PUBLIC_ prefix", () => {
    const example = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    expect(example).not.toContain("NEXT_PUBLIC_SUPABASE_SECRET");
  });
});
