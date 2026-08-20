import { describe, expect, test, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

/**
 * Round13 P1-3 / P2-1 / P2-2 — REAL final-state authority test.
 *
 * The static migration-grep tests (supabase-schema.test.ts) can only prove the
 * SQL text contains certain strings. They cannot prove the final PostgreSQL
 * policy matrix or function privileges actually behave that way after the full
 * 0001..0022 chain is applied.
 *
 * This test runs against a LIVE Supabase/Postgres DB (the same one
 * `supabase db reset` provisions). It:
 *   1. queries pg_policies for the FINAL activity/assessment policy matrix;
 *   2. queries function EXECUTE privileges for both RPCs;
 *   3. simulates an authenticated session and proves:
 *        - direct INSERT of a confirmed Activity is DENIED;
 *        - create_activity RPC forces status=pending_assessment, user_id=auth.uid(),
 *          authoritative rules_version;
 *        - authenticated cannot call the service-role-only record_ai_assessment RPC.
 *
 * Gated: only runs when XP_RPG_TEST_DB_URL is set AND the schema exists.
 * CI provisions the DB via `supabase db start`; locally run `supabase db reset`.
 */

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const USER_A = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const ACTIVITY_A = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

async function schemaExists(client: Client): Promise<boolean> {
  const r = await client.query<{ n: number }>(
    `select count(*)::int as n from pg_class
      where relname = 'activities' and relnamespace = 'public'::regnamespace`,
  );
  return r.rows[0].n > 0;
}

async function hasExec(client: Client, role: string, proc: string): Promise<boolean> {
  const r = await client.query<{ has: boolean }>(
    `select has_function_privilege($1, $2::regprocedure, 'EXECUTE') as has`,
    [role, proc],
  );
  return r.rows[0].has;
}

describe.skipIf(!DATABASE_URL)("Round13 — final-state authority matrix (live DB)", () => {
  let client: Client;

  beforeAll(async () => {
    if (!DATABASE_URL) throw new Error("XP_RPG_TEST_DB_URL not set");
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    if (!(await schemaExists(client))) {
      // Apply the full chain so the test is self-contained in CI/local.
      const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
      for (const file of files) {
        await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
      }
    }
    await client.query(
      `insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
       values ($1, 'authenticated', 'authenticated', 'authority-test-a@example.com', '', now(), now(), now())
       on conflict (id) do nothing`,
      [USER_A],
    );
  }, 60_000);

  afterAll(async () => {
    if (!client) return;
    await client.query("delete from public.activities where user_id = $1", [USER_A]).catch(() => {});
    await client.query("delete from public.ai_assessments where user_id = $1", [USER_A]).catch(() => {});
    await client.query("delete from auth.users where id = $1", [USER_A]).catch(() => {});
    await client.end().catch(() => {});
  });

  test("activities: no direct INSERT/UPDATE policy; DELETE only for pending", async () => {
    const r = await client.query<{ cmd: string; policyname: string; qual: string | null }>(
      `select cmd, policyname, qual from pg_policies
        where schemaname = 'public' and tablename = 'activities'`,
    );
    const cmds = r.rows.map((x) => x.cmd);
    const names = r.rows.map((x) => x.policyname);
    expect(cmds, "activities must not grant INSERT via RLS").not.toContain("INSERT");
    expect(cmds, "activities must not grant UPDATE via RLS").not.toContain("UPDATE");
    expect(cmds).toContain("SELECT");
    expect(cmds).toContain("DELETE");
    expect(names).toContain("activities_delete_pending");
    expect(r.rows.find((x) => x.policyname === "activities_delete_pending")?.qual ?? "").toContain(
      "status = 'pending_assessment'",
    );
  });

  test("ai_assessments: SELECT only — no client INSERT/UPDATE/DELETE", async () => {
    const r = await client.query<{ cmd: string }>(
      `select cmd from pg_policies
        where schemaname = 'public' and tablename = 'ai_assessments'`,
    );
    const cmds = new Set(r.rows.map((x) => x.cmd));
    expect(cmds.has("SELECT")).toBe(true);
    expect(cmds.has("INSERT")).toBe(false);
    expect(cmds.has("UPDATE")).toBe(false);
    expect(cmds.has("DELETE")).toBe(false);
  });

  test("record_ai_assessment: EXECUTE only for service_role, not authenticated/anon/public", async () => {
    const proc = "public.record_ai_assessment(uuid,uuid,jsonb,text,text,numeric)";
    expect(await hasExec(client, "service_role", proc)).toBe(true);
    expect(await hasExec(client, "authenticated", proc)).toBe(false);
    expect(await hasExec(client, "anon", proc)).toBe(false);
    expect(await hasExec(client, "public", proc)).toBe(false);
  });

  test("create_activity: EXECUTE granted to authenticated, not anon/public", async () => {
    const proc =
      "public.create_activity(text,text,text,uuid,integer,integer,timestamptz,timestamptz,numeric)";
    expect(await hasExec(client, "authenticated", proc)).toBe(true);
    expect(await hasExec(client, "anon", proc)).toBe(false);
    expect(await hasExec(client, "public", proc)).toBe(false);
  });

  test("settle_activity: EXECUTE only for service_role, not authenticated/anon/public", async () => {
    const proc = "public.settle_activity(uuid,jsonb)";
    expect(await hasExec(client, "service_role", proc)).toBe(true);
    expect(await hasExec(client, "authenticated", proc)).toBe(false);
    expect(await hasExec(client, "anon", proc)).toBe(false);
    expect(await hasExec(client, "public", proc)).toBe(false);
  });

  test("authenticated direct INSERT of a confirmed Activity is denied", async () => {
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [USER_A]);
    let denied = false;
    try {
      await client.query(
        `insert into public.activities (id, user_id, title, raw_input, status, rules_version, created_at, updated_at)
         values ($1, $2, 'forged', 'forged', 'confirmed', 'evil-v9', now(), now())`,
        [ACTIVITY_A, USER_A],
      );
    } catch {
      denied = true;
    }
    expect(denied, "authenticated must NOT be able to INSERT a confirmed Activity").toBe(true);
    await client.query("reset role");
  });

  test("create_activity RPC forces pending_assessment and auth.uid() ownership", async () => {
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [USER_A]);
    const r = await client.query<{
      user_id: string;
      status: string;
      rules_version: string;
    }>(
      `select user_id, status, rules_version from public.create_activity($1, $2)`,
      ["Round13 activity", "real raw input"],
    );
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].user_id).toBe(USER_A);
    expect(r.rows[0].status).toBe("pending_assessment");
    // rules_version is the authoritative ACTIVE version, frozen at creation.
    expect(r.rows[0].rules_version).toBe("growth-engine-v0.1");
    expect(r.rows[0].rules_version).not.toBe("evil-v9");
    await client.query("reset role");
  });

  test("authenticated cannot invoke the service-role record_ai_assessment RPC", async () => {
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [USER_A]);
    let denied = false;
    try {
      await client.query(
        `select public.record_ai_assessment($1, $2, '{}'::jsonb, 'm', 'v', 0.5)`,
        [USER_A, ACTIVITY_A],
      );
    } catch {
      denied = true;
    }
    expect(denied, "authenticated must not EXECUTE record_ai_assessment").toBe(true);
    await client.query("reset role");
  });

  test("create_activity selects the ACTIVE rules version and ignores drafts (no string-sort, no v1 fallback)", async () => {
    // The active seed (growth-engine-v0.1) already exists from migration 0023.
    // Add drafts, including one whose TEXT sort would win under the OLD
    // `order by version desc` bug ('v999' > 'v0.1' as strings).
    await client.query(
      `insert into public.rules_versions (version, status, activated_at) values
         ('growth-engine-v999', 'draft', now()),
         ('growth-engine-v0.2', 'draft', now())`,
    );
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [USER_A]);
    const r = await client.query<{ rules_version: string }>(
      `select rules_version from public.create_activity($1, $2)`,
      ["Round14 activity", "real raw input"],
    );
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].rules_version, "must freeze the ACTIVE version, not a draft").toBe(
      "growth-engine-v0.1",
    );
    await client.query("reset role");
    await client.query(
      "delete from public.rules_versions where version in ('growth-engine-v999', 'growth-engine-v0.2')",
    );
  });

  test("create_activity fails closed when no active rules version exists", async () => {
    // Remove the active version so the registry has no active row.
    await client.query("update public.rules_versions set status = 'archived' where status = 'active'");
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [USER_A]);
    let failed = false;
    let message = "";
    try {
      await client.query(`select public.create_activity($1, $2)`, ["x", "y"]);
    } catch (e) {
      failed = true;
      message = String(e);
    }
    expect(failed, "create_activity must FAIL CLOSED when no active rules version exists").toBe(true);
    expect(message.toLowerCase()).toContain("no_active_rules_version");
    await client.query("reset role");
    // Restore the seed active version for subsequent tests / runs.
    await client.query(
      "update public.rules_versions set status = 'active' where version = 'growth-engine-v0.1'",
    );
  });
});
