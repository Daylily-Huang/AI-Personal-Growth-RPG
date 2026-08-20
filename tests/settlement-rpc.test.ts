import { describe, expect, test, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { levelFromXp } from "@/lib/growth-engine/levels";

/**
 * Stage2-B + Stage2-B.1 — settle_activity authoritative settlement (live PostgreSQL).
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
 *
 * Stage2-B.1 additions (Round16 review):
 *   - canonical XP: transaction.amount is the single source of truth; mismatch
 *     between settlement.xpDelta / primarySkill.xpDelta / transaction.amount is
 *     rejected; negative XP rejected; xpType forced to 'activity';
 *   - mastery monotonic: stale upgrade proposal (proposed ≤ current) is silently
 *     demoted to 'none'; no downgrade, no spurious mastery event;
 *   - repetition serialization: clock_timestamp() after skill lock; cross-activity
 *     same-skill concurrent settlement produces N and N+1 repetition counts;
 *   - tenant composite integrity: create_activity rejects foreign quest;
 *   - repetition_conflict has zero side effects (no skill XP / updated_at change);
 *   - pending MasteryVerification returns actual persisted row values;
 *   - skill_name_snapshot persisted on xp_transactions.
 */

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

const USERS = {
  a: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  b: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
  c: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
  d: "dddddddd-dddd-4ddd-dddd-dddddddddddd",
  e: "eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee",
  f: "ffffffff-ffff-4fff-ffff-ffffffffffff",
  g: "11111111-1111-4111-8111-111111111111",
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
  /** Override transaction.amount independently (for mismatch tests). */
  txAmount?: number;
  /** Override primarySkill.xpDelta independently (for mismatch tests). */
  skillXpDelta?: number;
  /** Override transaction.xpType (for xpType enforcement tests). */
  xpType?: string;
  masteryAction?: MasteryActionJson;
  masteryVerification?: Record<string, unknown> | null;
  relatedSkillLabels?: string[];
}): Record<string, unknown> {
  const xpDelta = input.xpDelta ?? 50;
  const txAmount = input.txAmount ?? xpDelta;
  const skillXpDelta = input.skillXpDelta ?? xpDelta;
  const activityType = input.activityType ?? "study";
  const masteryAction = input.masteryAction ?? { action: "none" };
  return {
    assessmentId: input.assessmentId,
    xpDelta,
    transaction: {
      id: crypto.randomUUID(),
      activityId: input.activityId,
      assessmentId: input.assessmentId,
      xpType: input.xpType ?? "activity",
      skillId: "",
      skillName: input.skillName ?? "Statistics",
      activityType,
      repetitionCount: input.repetitionCount ?? 0,
      repetitionPenalty: 1,
      amount: txAmount,
      baseAmount: txAmount,
      modifierJson: {},
      reason: "settlement-rpc test",
      rulesVersion: "ignored-by-rpc",
      createdAt: new Date().toISOString(),
    },
    primarySkill: {
      name: input.skillName ?? "Statistics",
      xpDelta: skillXpDelta,
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
    `delete from public.quests where user_id = $1`,
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

  // ── Stage2-B original tests ───────────────────────────────────────

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

    // Stage2-B.1 (P2-B): returned verification must match the ACTUAL persisted row,
    // not the second request's proposed values.
    expect(r2.masteryVerification?.fromLevel).toBe(1);
    expect(r2.masteryVerification?.toLevel).toBe(5); // first's toLevel, not second's 6
    expect(r2.masteryVerification?.evidenceLevel).toBe(4); // first's evidence, not second's 5

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

  // ── Stage2-B.1 integrity tests (Round16 review) ──────────────────

  test("P1-1: stale mastery proposal cannot downgrade mastery", async () => {
    // First: directly set skill mastery to M3 via a legitimate upgrade settlement.
    const act1 = await createActivityAndAssessment(client, USERS.f, "mastery baseline");
    const s1 = buildSettlement({
      assessmentId: act1.assessmentId,
      activityId: act1.activityId,
      skillName: "Stale Mastery Skill",
      masteryAction: { action: "upgrade", proposedLevel: 3, confidence: 0.9 },
    });
    const r1 = await settle(client, USERS.f, s1);
    expect(r1.ok).toBe(true);

    // Verify mastery is now 3.
    const skillAfterUpgrade = await client.query<{ mastery_level: number }>(
      `select mastery_level from public.skills where id = $1`,
      [r1.skillId as string],
    );
    expect(skillAfterUpgrade.rows[0].mastery_level).toBe(3);

    // Now try to settle another activity with a STALE proposal to upgrade to M2.
    const act2 = await createActivityAndAssessment(client, USERS.f, "stale mastery attempt");
    const s2 = buildSettlement({
      assessmentId: act2.assessmentId,
      activityId: act2.activityId,
      skillName: "Stale Mastery Skill",
      repetitionCount: 1,
      masteryAction: { action: "upgrade", proposedLevel: 2, confidence: 0.7 },
    });
    const r2 = await settle(client, USERS.f, s2);
    expect(r2.ok).toBe(true);

    // Mastery must still be 3 — no downgrade.
    const skillAfterStale = await client.query<{ mastery_level: number }>(
      `select mastery_level from public.skills where id = $1`,
      [r1.skillId as string],
    );
    expect(skillAfterStale.rows[0].mastery_level).toBe(3);

    // No spurious "upgrade" event from M3 to M2.
    const events = await client.query<{ from_level: number; to_level: number; event_type: string }>(
      `select from_level, to_level, event_type from public.mastery_events
        where user_id = $1 and skill_id = $2
        order by created_at`,
      [USERS.f, r1.skillId as string],
    );
    // Only the first legitimate upgrade event should exist.
    expect(events.rows.length).toBe(1);
    expect(events.rows[0].from_level).toBe(1);
    expect(events.rows[0].to_level).toBe(3);
    expect(events.rows[0].event_type).toBe("upgrade");
  });

  test("P1-2: canonical XP — mismatched settlement.xpDelta vs transaction.amount rejected", async () => {
    const act = await createActivityAndAssessment(client, USERS.f, "xp mismatch test");
    const settlement = buildSettlement({
      assessmentId: act.assessmentId,
      activityId: act.activityId,
      skillName: "XP Mismatch Skill",
      xpDelta: 100,
      txAmount: 50, // mismatch!
    });
    const result = await settle(client, USERS.f, settlement);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("xp_delta_mismatch");

    // Nothing written.
    const ledger = await client.query<{ n: number }>(
      `select count(*)::int as n from public.xp_transactions
        where user_id = $1 and activity_id = $2`,
      [USERS.f, act.activityId],
    );
    expect(ledger.rows[0].n).toBe(0);
  });

  test("P1-2: canonical XP — mismatched primarySkill.xpDelta rejected", async () => {
    const act = await createActivityAndAssessment(client, USERS.f, "skill xp mismatch test");
    const settlement = buildSettlement({
      assessmentId: act.assessmentId,
      activityId: act.activityId,
      skillName: "Skill XP Mismatch Skill",
      xpDelta: 50,
      skillXpDelta: 200, // mismatch!
    });
    const result = await settle(client, USERS.f, settlement);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("skill_xp_delta_mismatch");
  });

  test("P1-2: negative XP rejected", async () => {
    const act = await createActivityAndAssessment(client, USERS.f, "negative xp test");
    const settlement = buildSettlement({
      assessmentId: act.assessmentId,
      activityId: act.activityId,
      skillName: "Negative XP Skill",
      xpDelta: -100,
      txAmount: -100,
    });
    const result = await settle(client, USERS.f, settlement);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("negative_xp");
  });

  test("P1-2: xpType must be 'activity' — correction/adjustment rejected", async () => {
    const act = await createActivityAndAssessment(client, USERS.f, "xpType test");
    const settlement = buildSettlement({
      assessmentId: act.assessmentId,
      activityId: act.activityId,
      skillName: "XpType Skill",
      xpType: "correction",
    });
    const result = await settle(client, USERS.f, settlement);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid_xp_type_for_settle");
  });

  test("P1-3: cross-activity same-skill concurrent settlement — repetition counts must be N and N+1", async () => {
    // Two different activities targeting the same skill, settled concurrently.
    // The first should get repetition_count=0, the second repetition_count=1.
    const act1 = await createActivityAndAssessment(client, USERS.g, "cross-activity A");
    const act2 = await createActivityAndAssessment(client, USERS.g, "cross-activity B");

    const s1 = buildSettlement({
      assessmentId: act1.assessmentId,
      activityId: act1.activityId,
      skillName: "Shared Skill",
      activityType: "study",
      repetitionCount: 0,
    });
    const s2 = buildSettlement({
      assessmentId: act2.assessmentId,
      activityId: act2.activityId,
      skillName: "Shared Skill",
      activityType: "study",
      repetitionCount: 0, // also claims 0 — but one must be wrong
    });

    const c1 = new Client({ connectionString: DATABASE_URL });
    const c2 = new Client({ connectionString: DATABASE_URL });
    await c1.connect();
    await c2.connect();

    const [r1, r2] = await Promise.all([
      c1.query<{ result: unknown }>(`select public.settle_activity($1, $2::jsonb) as result`, [
        USERS.g,
        JSON.stringify(s1),
      ]),
      c2.query<{ result: unknown }>(`select public.settle_activity($1, $2::jsonb) as result`, [
        USERS.g,
        JSON.stringify(s2),
      ]),
    ]);

    await c1.end().catch(() => {});
    await c2.end().catch(() => {});

    const a = r1.rows[0].result as { ok: boolean; reason?: string; actualRepetitionCount?: number };
    const b = r2.rows[0].result as { ok: boolean; reason?: string; actualRepetitionCount?: number };

    // At least one must succeed. If one gets repetition_conflict, retry with the
    // authoritative count returned by the DB.
    const results = [a, b];
    const acts = [act1, act2];
    const successes = results.filter((r) => r.ok);
    const conflicts = results.filter((r) => !r.ok && r.reason === "repetition_conflict");

    // Either both succeed (one got 0, other got 1 via serialization) or one conflicts.
    expect(successes.length + conflicts.length).toBe(2);

    if (conflicts.length > 0) {
      // P1-2 fix: retry the ACTUAL conflicting activity (not the other one),
      // using the authoritative actualRepetitionCount from the DB response.
      const conflictIdx = results.findIndex((r) => !r.ok);
      const conflictAct = acts[conflictIdx];
      const authoritativeCount = results[conflictIdx].actualRepetitionCount ?? 1;
      const retrySettlement = buildSettlement({
        assessmentId: conflictAct.assessmentId,
        activityId: conflictAct.activityId,
        skillName: "Shared Skill",
        activityType: "study",
        repetitionCount: authoritativeCount,
      });
      const retryResult = await settle(client, USERS.g, retrySettlement);
      expect(retryResult.ok).toBe(true);
    }

    // Verify: one ledger row has repetition_count=0, the other has repetition_count=1.
    const ledger = await client.query<{ repetition_count: number }>(
      `select repetition_count from public.xp_transactions
        where user_id = $1 and skill_id = (select id from public.skills where user_id = $1 and name = 'Shared Skill')
        and xp_type = 'activity'
        order by repetition_count`,
      [USERS.g],
    );
    expect(ledger.rows.length).toBe(2);
    expect(ledger.rows[0].repetition_count).toBe(0);
    expect(ledger.rows[1].repetition_count).toBe(1);
  });

  test("P1-4: create_activity rejects foreign quest (tenant composite integrity)", async () => {
    // Create a quest owned by user A.
    await client.query("set role postgres");
    const quest = await client.query<{ id: string }>(
      `insert into public.quests (user_id, title, quest_type)
        values ($1, 'A quest', 'learning') returning id`,
      [USERS.a],
    );
    const questId = quest.rows[0].id;

    // User B tries to create an activity referencing A's quest.
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [USERS.b]);

    let error: Error | null = null;
    try {
      await client.query(`select public.create_activity($1, $2, null, $3)`, [
        "B's activity",
        "some input",
        questId,
      ]);
    } catch (e) {
      error = e as Error;
    }

    await client.query("reset role");
    expect(error).not.toBeNull();
    expect(error!.message).toContain("quest_not_owned");
  });

  test("P2-A: repetition_conflict has zero side effects on skill", async () => {
    // Set up: one settlement creates the skill with known XP.
    const act1 = await createActivityAndAssessment(client, USERS.c, "side-effect baseline");
    const s1 = buildSettlement({
      assessmentId: act1.assessmentId,
      activityId: act1.activityId,
      skillName: "SideEffect Skill",
      repetitionCount: 0,
    });
    const r1 = await settle(client, USERS.c, s1);
    expect(r1.ok).toBe(true);

    // Record skill state before the conflicting settlement.
    const skillBefore = await client.query<{ xp: string; updated_at: string }>(
      `select xp, updated_at from public.skills where id = $1`,
      [r1.skillId as string],
    );

    // Second settlement with wrong repetition count → conflict.
    const act2 = await createActivityAndAssessment(client, USERS.c, "side-effect conflict");
    const s2 = buildSettlement({
      assessmentId: act2.assessmentId,
      activityId: act2.activityId,
      skillName: "SideEffect Skill",
      repetitionCount: 0, // wrong — should be 1
    });
    const conflict = await settle(client, USERS.c, s2);
    expect(conflict.ok).toBe(false);
    expect(conflict.reason).toBe("repetition_conflict");

    // Skill XP and updated_at must be unchanged.
    const skillAfter = await client.query<{ xp: string; updated_at: string }>(
      `select xp, updated_at from public.skills where id = $1`,
      [r1.skillId as string],
    );
    expect(Number(skillAfter.rows[0].xp)).toBe(Number(skillBefore.rows[0].xp));
    // updated_at should also be unchanged (no mutation occurred).
    expect(new Date(skillAfter.rows[0].updated_at).getTime()).toBe(
      new Date(skillBefore.rows[0].updated_at).getTime(),
    );
  });

  test("P2-C: skill_name_snapshot persisted on xp_transactions", async () => {
    const act = await createActivityAndAssessment(client, USERS.a, "snapshot test");
    const settlement = buildSettlement({
      assessmentId: act.assessmentId,
      activityId: act.activityId,
      skillName: "Snapshot Skill",
    });
    const result = await settle(client, USERS.a, settlement);
    expect(result.ok).toBe(true);

    // The ledger row must have skill_name_snapshot = 'Snapshot Skill'.
    const tx = await client.query<{ skill_name_snapshot: string }>(
      `select skill_name_snapshot from public.xp_transactions
        where user_id = $1 and activity_id = $2`,
      [USERS.a, act.activityId],
    );
    expect(tx.rows[0].skill_name_snapshot).toBe("Snapshot Skill");

    // The returned transaction JSON also uses the snapshot.
    const txJson = result.transaction as Record<string, unknown>;
    expect(txJson.skillName).toBe("Snapshot Skill");
  });

  // ── Stage2-B.2 integrity tests (Round17 review) ──────────────────

  test("P2-1: new Skill + repetition_conflict creates no orphan Skill row", async () => {
    // Use a fresh user to ensure the skill does not exist yet.
    const act1 = await createActivityAndAssessment(client, USERS.f, "orphan baseline");
    const s1 = buildSettlement({
      assessmentId: act1.assessmentId,
      activityId: act1.activityId,
      skillName: "Brand New Orphan Skill",
      repetitionCount: 0,
    });
    expect((await settle(client, USERS.f, s1)).ok).toBe(true);

    // Now try a second activity with a BRAND NEW skill name and wrong repetition count.
    // Since the skill doesn't exist yet, authoritative count = 0, but client claims 5.
    const act2 = await createActivityAndAssessment(client, USERS.f, "orphan conflict test");
    const s2 = buildSettlement({
      assessmentId: act2.assessmentId,
      activityId: act2.activityId,
      skillName: "Never Before Seen Skill",
      repetitionCount: 5, // wrong — authoritative is 0 for a new skill
    });
    const conflict = await settle(client, USERS.f, s2);
    expect(conflict.ok).toBe(false);
    expect(conflict.reason).toBe("repetition_conflict");
    expect(conflict.actualRepetitionCount).toBe(0);

    // The brand new skill must NOT have been created (no orphan row).
    const orphanCheck = await client.query<{ n: number }>(
      `select count(*)::int as n from public.skills
        where user_id = $1 and normalized_name = 'never before seen skill'`,
      [USERS.f],
    );
    expect(orphanCheck.rows[0].n).toBe(0);
  });

  test("P2-3: skill_name mismatch between transaction and primarySkill rejected", async () => {
    const act = await createActivityAndAssessment(client, USERS.a, "name mismatch test");
    // Build a settlement where transaction.skillName ≠ primarySkill.name.
    const settlement = {
      ...buildSettlement({
        assessmentId: act.assessmentId,
        activityId: act.activityId,
        skillName: "Statistics",
      }),
      // Override primarySkill.name to differ from transaction.skillName.
      primarySkill: {
        name: "Programming",
        xpDelta: 50,
        masteryAction: { action: "none" },
      },
    };
    const result = await settle(client, USERS.a, settlement);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("skill_name_mismatch");
  });

  test("P2-4: stale request_verification (toLevel ≤ currentMastery) demoted to none", async () => {
    // First: upgrade mastery to M3 via a legitimate upgrade settlement.
    const act1 = await createActivityAndAssessment(client, USERS.f, "stale RV baseline");
    const s1 = buildSettlement({
      assessmentId: act1.assessmentId,
      activityId: act1.activityId,
      skillName: "Stale RV Skill",
      masteryAction: { action: "upgrade", proposedLevel: 3, confidence: 0.9 },
    });
    const r1 = await settle(client, USERS.f, s1);
    expect(r1.ok).toBe(true);

    // Now try request_verification with toLevel=2 (stale — already at M3).
    const act2 = await createActivityAndAssessment(client, USERS.f, "stale RV attempt");
    const s2 = buildSettlement({
      assessmentId: act2.assessmentId,
      activityId: act2.activityId,
      skillName: "Stale RV Skill",
      repetitionCount: 1,
      masteryAction: { action: "request_verification", fromLevel: 1, toLevel: 2, confidence: 0.8 },
      masteryVerification: { evidenceLevel: 4 },
    });
    const r2 = await settle(client, USERS.f, s2);
    expect(r2.ok).toBe(true);
    // Verification should NOT have been created (toLevel ≤ currentMastery → none).
    expect(r2.masteryVerification).toBeUndefined();

    // No pending verification should exist for this skill.
    const pendings = await client.query<{ n: number }>(
      `select count(*)::int as n from public.mastery_verifications
        where user_id = $1 and skill_id = $2 and status = 'pending'`,
      [USERS.f, r1.skillId as string],
    );
    expect(pendings.rows[0].n).toBe(0);
  });
});
