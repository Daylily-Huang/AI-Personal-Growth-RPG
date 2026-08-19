import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Empty-DB migration smoke test (M3 Stage1.1 — Round8 item 5).
 *
 * This is the test Round8 demanded: "真正执行一次 empty DB migration" instead of
 * only static string checks. It is SKIPPED unless XP_RPG_TEST_DB_URL points at a
 * SUPABASE database (it needs the `auth` schema for the 0017 trigger), and `pg`
 * (a declared devDependency) is installed. In WSL / CI:
 *
 *   pnpm add -D pg
 *   XP_RPG_TEST_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres \
 *     pnpm vitest run tests/empty-db-migration.smoke.test.ts
 *
 * Gating: no XP_RPG_TEST_DB_URL -> skipped. URL set but `pg` missing or the DB
 * unreachable -> the test FAILS (never silently passes), forcing the operator to
 * provide a real DB + installed driver.
 *
 * It runs the full migration chain (0001..0021) against a FRESH database and then
 * asserts the bootstrapped schema is internally consistent:
 *   - all 16 private tables + xp_transactions exist and have RLS enabled;
 *   - xp_transactions is read-only for `authenticated` (SELECT policy only);
 *   - evidence_records evidence_level CHECK is `between 0 and 6`.
 *
 * WHAT IT STILL DOES NOT COVER (needs two real sessions / cloud secrets):
 *   - "User A cannot read User B" runtime isolation;
 *   - concurrency / idempotency of the settlement RPC (Stage2).
 */

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

// Gated: only runs when a Supabase DB URL is provided. If `pg` is missing while a
// URL is set, the test FAILS loudly (it must not silently pass) — install it with
// `pnpm add -D pg`.
describe.skipIf(!DATABASE_URL)("M3 Stage1.2 — empty-DB migration smoke", () => {
  test("full migration chain bootstraps on an empty Supabase DB and is consistent", async () => {
    let Client: typeof import("pg").Client;
    try {
      ({ Client } = await import("pg"));
    } catch {
      throw new Error(
        "[empty-db-migration.smoke] XP_RPG_TEST_DB_URL is set but `pg` is not installed. " +
        "Run `pnpm add -D pg` before running this migration smoke test.",
      );
    }
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const files = fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith(".sql"))
        .sort();
      for (const file of files) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
        await client.query(sql);
      }

      const tables = [
        "profiles", "player_states", "domains", "skills", "quests", "activities",
        "ai_assessments", "evidence_records", "xp_transactions",
        "mastery_verifications", "mastery_events", "knowledge_nodes",
        "knowledge_edges", "artifacts", "artifact_links", "reviews",
      ];

      // All private tables exist and have RLS enabled.
      for (const t of tables) {
        const rls = await client.query<{ relname: string; relrowsecurity: boolean }>(
          `select relname, relrowsecurity
             from pg_class where relname = $1 and relnamespace = 'public'::regnamespace`,
          [t],
        );
        expect(rls.rows.length, `table ${t} missing after bootstrap`).toBe(1);
        expect(rls.rows[0].relrowsecurity, `RLS not enabled on ${t}`).toBe(true);
      }

      // xp_transactions: authenticated may only SELECT (the ledger is server-written).
      const xpPolicies = await client.query<{ cmd: string }>(
        `select cmd from pg_policies
          where schemaname = 'public' and tablename = 'xp_transactions'
            and (roles::text[] && array['authenticated'] or 'authenticated' = any(roles))`,
      );
      const cmds = new Set(xpPolicies.rows.map((r) => r.cmd));
      expect(cmds.has("SELECT"), "xp_transactions missing SELECT policy").toBe(true);
      expect(cmds.has("INSERT"), "xp_transactions must NOT grant INSERT").toBe(false);
      expect(cmds.has("UPDATE"), "xp_transactions must NOT grant UPDATE").toBe(false);
      expect(cmds.has("DELETE"), "xp_transactions must NOT grant DELETE").toBe(false);

      // Evidence range is E0..E6 end-to-end.
      const ev = await client.query<{ consrc: string }>(
        `select pg_get_constraintdef(oid) as consrc
           from pg_constraint
          where conrelid = 'public.evidence_records'::regclass
            and contype = 'c'`,
      );
      expect(
        ev.rows.some((r) =>
          /evidence_level\s+between\s+0\s+and\s+6/i.test(r.consrc) ||
          /evidence_level\s*>=\s*0.*evidence_level\s*<=\s*6/i.test(r.consrc),
        ),
        "evidence CHECK not 0..6",
      ).toBe(true);

      // xp_transactions FKs actually exist.
      const fks = await client.query<{ conname: string }>(
        `select conname from pg_constraint
          where conrelid = 'public.xp_transactions'::regclass and contype = 'f'`,
      );
      const fkNames = fks.rows.map((r) => r.conname);
      expect(fkNames.some((n) => n.includes("activity")), "xp_transactions→activities FK missing").toBe(true);
      expect(fkNames.some((n) => n.includes("assessment")), "xp_transactions→ai_assessments FK missing").toBe(true);
      expect(fkNames.some((n) => n.includes("skill")), "xp_transactions→skills FK missing").toBe(true);

      // skills normalized identity is unique per user.
      const uniq = await client.query<{ conname: string }>(
        `select conname from pg_constraint
          where conrelid = 'public.skills'::regclass and contype = 'u'`,
      );
      expect(uniq.rows.some((r) => r.conname === "skills_user_normalized_unique"), "skills normalized unique missing").toBe(true);
    } finally {
      await client.end();
    }
  });
});
