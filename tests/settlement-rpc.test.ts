import { describe, expect, test, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { levelFromXp } from "@/lib/growth-engine/levels";

/**
 * Stage2-B — settle_activity authoritative settlement (live PostgreSQL).
 *
 * Runs only when XP_RPG_TEST_DB_URL is set (CI provisions via `supabase db
 * start`; locally via `supabase db reset`). Proves the RPC behaves as the
 * Repository.applySettlement contract requires:
 *   - one atomic settlement: ledger row + player delta + skill delta + level
 *     recompute + assessment/activity confirmation;
 *   - idempotency: one `activity` ledger row per Activity, one confirmation per
 *     Assessment;
 *   - repetition snapshot: authoritative count derived inside the transaction;
 *     a stale client count returns repetition_conflict + the fresh count, and
 *     the caller can retry with it;
 *   - mastery: request_verification creates ONE pending verification per skill
 *     and does NOT auto-upgrade mastery;
 *   - dual-user isolation: settle_activity refuses a foreign user's assessment;
 *   - concurrency: parallel settle of the same assessment — exactly one wins;
 *   - level-curve parity: SQL player_level_from_xp === TS levelFromXp.
 */

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const USERS = {
  a: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  b: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  c: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
  d: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
  e: "eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee",
};

async function schemaExists(client: Client): Promise<boolean> {
  const r = await client.query<{ n: number }>(
    `select count(*)::int as n from pg_class
      where relname = 'activities' and relnamespace = 'public'::regnamespace`,
  );
  return r.rows[0].n > 0;
}

interface CreatedAssessment {
  activityId: string;
  assessmentId: string;
  rulesVersion: string;
}

/** Create an Activity (authenticated) + Assessment (service_role) for a user. */
async function createActivityAndAssessment(
  client: Client,
  userId: string,
  rawInput: string,
): Promise<CreatedAssessment> {
  await client.query("set role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  const activity = await client.query<{ id: string; rules_version: string }>(
    `select id, rules_version from public.create_activity($1, $2)`,
    [rawInput.slice(0, 80), rawInput],
  );
  const activityId = activity.rows[0].id;

  await client.query("set role service_role");
  const assessment = await client.query<{ id: string }>(
    `select (public.record_ai_assessment($1, $2, $3::jsonb, 'test-model', 'test-prompt', 0.9)).id as id`,
    [userId, activityId, JSON.stringify({ rawInput, proposal: "minimal" })],
  );
  await client.query("reset role");
  return {
    activityId,
    assessmentId: assessment.rows[0].id,
    rulesVersion: activity.rows[0].rules_version,
  };
}

type MasteryActionJson =
  | { action: "none" }
  | { action: "upgrade"; proposedLevel: number; confidence: number }
  | { action: "request_verification"; fromLevel: number; toLevel: number; confidence: number };

function buildSettlement(input: {
  assessmentId: string;
  activityId: string;
  skillName?: string;
  activityType?: string | null;
  repetitionCount?: number;
  xpDelta?: number;
  masteryAction?: MasteryActionJson;
  masteryVerification?: Record<string, unknown> | null;
  relatedSkillLabels?: string[];
}): Record<string, unknown> {
  const xpDelta = input.xpDelta ?? 50;
  const activityType = input.activityType ?? "study";
  const masteryAction = input.masteryAction ?? { action: "none" };
  return {
    assessmentId: input.assessmentId,
    xpDelta,
    transaction: {
      id: crypto.randomUUID(),
      activityId: input.activityId,
      assessmentId: input.assessmentId,
      xpType: "activity",
      skillId: "",
      skillName: input.skillName ?? "Statistics",
      activityType,
      repetitionCount: input.repetitionCount ?? 0,
      repetitionPenalty: 1,
      amount: xpDelta,
      baseAmount: xpDelta,
      modifierJson: {},
      reason: "settlement-rpc test",
      rulesVersion: "ignored-by-rpc",
      createdAt: new Date().toISOString(),
    },
    primarySkill: {
      name: input.skillName ?? "Statistics",
      xpDelta,
      masteryAction,
    },
    relatedSkillLabels: input.relatedSkillLabels ?? [],
    player: { xpDelta },
    ...(input.masteryVerification ? { masteryVerification: input.masteryVerification } : {}),
  };
}

async function settle(
  client: Client,
  userId: string,
  settlement: Record<string, unknown>,
): Promise<{
  ok: boolean;
  reason?: string;
  actualRepetitionCount?: number;
  skillId?: string;
  transaction?: Record<string, unknown>;
  masteryVerification?: Record<string, unknown> | null;
}> {
  const r = await client.query<{ result: unknown }>(
    `select public.settle_activity($1, $2::jsonb) as result`,
    [userId, JSON.stringify(settlement)],
  );
  return r.rows[0].result as unknown as {
    ok: boolean;
    reason?: string;
    actualRepetitionCount?: number;
    skillId?: string;
    transaction?: Record<string, unknown>;
    masteryVerification?: Record<string, unknown> | null;
  };
}

async function insertUsers(client: Client): Promise<void> {
  for (const id of Object.values(USERS)) {
    await client.query(
      `insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
       values ($1, 'authenticated', 'authenticated', $2, '', now(), now(), now())
       on conflict (id) do nothing`,
      [id, `settlement-${id.slice(0, 8)}@example.com`],
    );
  }
}

async function cleanupUsers(client: Client): Promise<void> {
  // node-postgres cannot bind $1 params inside a multi-statement string, so run
  // each statement separately (FK-safe order: children before parents).
  const statements = [
    `delete from public.xp_transactions where user_id = $1`,
    `delete from public.mastery_events where user_id = $1`,
    `delete from public.mastery_verifications where user_id = $1`,
    `delete from public.player_states where user_id = $1`,
    `delete from public.ai_assessments where user_id = $1`,
    `delete from public.skills where user_id = $1`,
    `delete from public.activities where user_id = $1`,
    `delete from auth.users where id = $1`,
  ];
  for (const id of Object.values(USERS)) {
    for (const stmt of statements) {
      await client.query(stmt, [id]).catch(() => {});
    }
  }
}

describe.skipIf(!DATABASE_URL)("Stage2-B — settle_activity (live DB)", () => {
  let client: Client;

  beforeAll(async () => {
    if (!DATABASE_URL) throw new Error("XP_RPG_TEST_DB_URL not set");
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    if (!(await schemaExists(client))) {
      const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
      for (const file of files) {
        await client.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
      }
    }
    // Fresh slate every run: remove any residue a previous aborted run left
    // (repetition counts are derived from the ledger, so stale rows would break
    // the assertions). Force superuser role so RLS/privileges cannot block it.
    await client.query("set role postgres").catch(() => {});
    await cleanupUsers(client);
    await insertUsers(client);
  }, 60_000);

  afterAll(async () => {
    if (!client) return;
    await client.query("set role postgres").catch(() => {});
    await cleanupUsers(client);
    await client.end().catch(() => {});
  });

  test("atomic settlement: ledger + player + skill + assessment + activity", async () => {
    const { activityId, assessmentId, rulesVersion } = await createActivityAndAssessment(
      client,
      USERS.a,
      "studied linear regression for an hour",
    );
    const settlement = buildSettlement({ assessmentId, activityId });

    const result = await settle(client, USERS.a, settlement);
    expect(result.ok).toBe(true);
    expect(result.skillId).toBeTruthy();
    expect(result.transaction).toBeTruthy();
    const tx = result.transaction as Record<string, unknown>;
    expect(tx.skillId).toBe(result.skillId);
    expect(tx.rulesVersion).toBe(rulesVersion); // frozen activity version, not payload
    expect(tx.amount).toBe(50);

    // ledger row
    const ledger = await client.query<{ n: number }>(
      `select count(*)::int as n from public.xp_transactions
        where user_id = $1 and activity_id = $2 and xp_type = 'activity'`,
      [USERS.a, activityId],
    );
    expect(ledger.rows[0].n).toBe(1);

    // player delta
    const player = await client.query<{ total_xp: string; player_level: number }>(
      `select total_xp, player_level from public.player_states where user_id = $1`,
      [USERS.a],
    );
    expect(Number(player.rows[0].total_xp)).toBe(50);

    // skill created with xp
    const skill = await client.query<{ xp: string; level: number; name: string }>(
      `select xp, level, name from public.skills where id = $1`,
      [result.skillId as string],
    );
    expect(skill.rows[0].name).toBe("Statistics");
    expect(Number(skill.rows[0].xp)).toBe(50);
    expect(skill.rows[0].level).toBe(1);

    // assessment + activity confirmed
    const assessment = await client.query<{ status: string }>(
      `select status from public.ai_assessments where id = $1`,
      [assessmentId],
    );
    expect(assessment.rows[0].status).toBe("confirmed");
    const activity = await client.query<{ status: string }>(
      `select status from public.activities where id = $1`,
      [activityId],
    );
    expect(activity.rows[0].status).toBe("confirmed");
  });

  test("idempotency: settling the same assessment again fails and adds no ledger row", async () => {
    const { activityId, assessmentId } = await createActivityAndAssessment(
      client,
      USERS.a,
      "second activity for idempotency check",
    );
    // Fresh skill so the repetition count for this activity is 0.
    const settlement = buildSettlement({ assessmentId, activityId, skillName: "Idempotency Skill" });
    const first = await settle(client, USERS.a, settlement);
    expect(first.ok).toBe(true);

    const second = await settle(client, USERS.a, settlement);
    expect(second.ok).toBe(false);
    expect(["already_confirmed", "already_settled"]).toContain(second.reason);

    const ledger = await client.query<{ n: number }>(
      `select count(*)::int as n from public.xp_transactions
        where user_id = $1 and activity_id = $2 and xp_type = 'activity'`,
      [USERS.a, activityId],
    );
    expect(ledger.rows[0].n).toBe(1);
  });

  test("repetition snapshot: stale client count -> repetition_conflict; retry with fresh count succeeds", async () => {
    // First settlement establishes 1 prior similar (skill Statistics / type study).
    const first = await createActivityAndAssessment(client, USERS.c, "first stats study");
    const s1 = buildSettlement({ assessmentId: first.assessmentId, activityId: first.activityId, repetitionCount: 0 });
    expect((await settle(client, USERS.c, s1)).ok).toBe(true);

    // Second activity claims 0, but the authoritative count is 1.
    const second = await createActivityAndAssessment(client, USERS.c, "second stats study");
    const s2 = buildSettlement({ assessmentId: second.assessmentId, activityId: second.activityId, repetitionCount: 0 });
    const conflict = await settle(client, USERS.c, s2);
    expect(conflict.ok).toBe(false);
    expect(conflict.reason).toBe("repetition_conflict");
    expect(conflict.actualRepetitionCount).toBe(1);

    // Optimistic retry with the fresh authoritative count succeeds.
    const s2retry = buildSettlement({ assessmentId: second.assessmentId, activityId: second.activityId, repetitionCount: 1 });
    const retry = await settle(client, USERS.c, s2retry);
    expect(retry.ok).toBe(true);
  });

  test("mastery: request_verification creates ONE pending verification and does not auto-upgrade", async () => {
    const first = await createActivityAndAssessment(client, USERS.d, "mastery candidate activity");
    const mv = { evidenceLevel: 4 };
    const s1 = buildSettlement({
      assessmentId: first.assessmentId,
      activityId: first.activityId,
      skillName: "Machine Learning",
      masteryAction: { action: "request_verification", fromLevel: 1, toLevel: 5, confidence: 0.8 },
      masteryVerification: mv,
    });
    const r1 = await settle(client, USERS.d, s1);
    expect(r1.ok).toBe(true);
    expect(r1.masteryVerification?.status).toBe("pending");

    // Skill mastery must NOT have been auto-upgraded.
    const skill = await client.query<{ mastery_level: number }>(
      `select mastery_level from public.skills where id = $1`,
      [r1.skillId as string],
    );
    expect(skill.rows[0].mastery_level).toBe(1);

    // A second verification-required settlement on the same skill dedupes.
    // One prior Machine Learning settlement exists -> authoritative count is 1.
    const second = await createActivityAndAssessment(client, USERS.d, "another mastery candidate");
    const s2 = buildSettlement({
      assessmentId: second.assessmentId,
      activityId: second.activityId,
      skillName: "Machine Learning",
      repetitionCount: 1,
      masteryAction: { action: "request_verification", fromLevel: 1, toLevel: 6, confidence: 0.9 },
      masteryVerification: { evidenceLevel: 5 },
    });
    const r2 = await settle(client, USERS.d, s2);
    expect(r2.ok).toBe(true);
    expect(r2.masteryVerification?.id).toBe(r1.masteryVerification?.id);

    const pendings = await client.query<{ n: number }>(
      `select count(*)::int as n from public.mastery_verifications
        where user_id = $1 and skill_id = $2 and status = 'pending'`,
      [USERS.d, r1.skillId as string],
    );
    expect(pendings.rows[0].n).toBe(1);
  });

  test("dual-user isolation: settling another user's assessment is refused and no cross-user rows", async () => {
    const { activityId, assessmentId } = await createActivityAndAssessment(client, USERS.a, "a-owned activity");
    const settlement = buildSettlement({ assessmentId, activityId, skillName: "Isolated Skill" });

    // User B tries to settle A's assessment.
    const stolen = await settle(client, USERS.b, settlement);
    expect(stolen.ok).toBe(false);
    expect(stolen.reason).toBe("not_owned");

    // Nothing was written for A (no ledger, no skill, no confirmation).
    const ledgerA = await client.query<{ n: number }>(
      `select count(*)::int as n from public.xp_transactions where user_id = $1 and activity_id = $2`,
      [USERS.a, activityId],
    );
    expect(ledgerA.rows[0].n).toBe(0);
    const skillB = await client.query<{ n: number }>(
      `select count(*)::int as n from public.skills where user_id = $1 and name = 'Isolated Skill'`,
      [USERS.b],
    );
    expect(skillB.rows[0].n).toBe(0);
    const assessment = await client.query<{ status: string }>(
      `select status from public.ai_assessments where id = $1`,
      [assessmentId],
    );
    expect(assessment.rows[0].status).toBe("pending");
  });

  test("concurrency: parallel settle of the same assessment — exactly one wins", async () => {
    const { activityId, assessmentId } = await createActivityAndAssessment(client, USERS.e, "concurrent activity");
    const settlement = buildSettlement({ assessmentId, activityId, skillName: "Concurrent Skill" });

    const c1 = new Client({ connectionString: DATABASE_URL });
    const c2 = new Client({ connectionString: DATABASE_URL });
    await c1.connect();
    await c2.connect();

    const [r1, r2] = await Promise.all([
      c1.query<{ result: unknown }>(`select public.settle_activity($1, $2::jsonb) as result`, [
        USERS.e,
        JSON.stringify(settlement),
      ]),
      c2.query<{ result: unknown }>(`select public.settle_activity($1, $2::jsonb) as result`, [
        USERS.e,
        JSON.stringify(settlement),
      ]),
    ]);

    await c1.end().catch(() => {});
    await c2.end().catch(() => {});

    const a = r1.rows[0].result as { ok: boolean };
    const b = r2.rows[0].result as { ok: boolean };
    const wins = [a, b].filter((r) => r.ok === true).length;
    expect(wins).toBe(1);

    const ledger = await client.query<{ n: number }>(
      `select count(*)::int as n from public.xp_transactions
        where user_id = $1 and activity_id = $2 and xp_type = 'activity'`,
      [USERS.e, activityId],
    );
    expect(ledger.rows[0].n).toBe(1);
  });

  test("level-curve parity: SQL player_level_from_xp matches TS levelFromXp", async () => {
    const samples = [0, 49, 50, 99, 100, 130, 230, 460, 500, 800, 1000, 3000, 5000, 12000];
    for (const xp of samples) {
      const sql = await client.query<{ level: number }>(
        `select public.player_level_from_xp($1) as level`,
        [xp],
      );
      const ts = levelFromXp(xp).level;
      expect(sql.rows[0].level, `XP ${xp}: SQL ${sql.rows[0].level} != TS ${ts}`).toBe(ts);
    }
  });
});
