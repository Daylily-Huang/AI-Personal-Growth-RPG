import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, test } from "vitest";
import { Client, type QueryResult, type QueryResultRow } from "pg";
import { randomUUID } from "node:crypto";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "8f111111-aaaa-4000-a000-000000000001";
const USER_B = "8f222222-bbbb-4000-b000-000000000002";
const SEASON_A = "8f111111-0001-4000-a000-000000000001";
const REVIEW_A = "8f111111-0002-4000-a000-000000000001";
const QUEST_A = "8f111111-0003-4000-a000-000000000001";
const QUEST_CONCURRENT = "8f111111-0004-4000-a000-000000000001";
const DOMAIN_A = "8f111111-0005-4000-a000-000000000001";
const SKILL_A = "8f111111-0006-4000-a000-000000000001";
const VERIFY_A = "8f111111-0007-4000-a000-000000000001";
const WISH_A = "8f111111-0010-4000-a000-000000000001";
const WISH_B = "8f111111-0011-4000-a000-000000000001";
const WISH_NULL = "8f111111-0012-4000-a000-000000000001";
const WISH_CONCURRENT = "8f111111-0013-4000-a000-000000000001";
const WISH_OTHER = "8f222222-0010-4000-b000-000000000002";
const QUEST_OTHER = "8f222222-0003-4000-b000-000000000002";
const PROPOSAL_A = "8f111111-0020-4000-a000-000000000001";
const USER_RESERVE = "8f333333-cccc-4000-a000-000000000003";
const USER_REDEEM = "8f444444-dddd-4000-a000-000000000004";
const USER_CORRECT = "8f555555-eeee-4000-a000-000000000005";
const USER_REFUND = "8f666666-ffff-4000-a000-000000000006";
const WISH_RESERVE = "8f333333-0010-4000-a000-000000000003";
const WISH_REDEEM = "8f444444-0010-4000-a000-000000000004";
const WISH_REFUND = "8f666666-0010-4000-a000-000000000006";
const TX_CORRECT = "8f555555-0030-4000-a000-000000000005";
const RECEIPT_REFUND = "8f666666-0040-4000-a000-000000000006";
const ALL_USERS = [USER_A, USER_B, USER_RESERVE, USER_REDEEM, USER_CORRECT, USER_REFUND];

type PgError = Error & { code?: string };

async function setAuthenticated(client: Client, userId: string): Promise<void> {
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
}

async function rpc<T extends QueryResultRow = Record<string, unknown>>(
  client: Client,
  userId: string,
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  await setAuthenticated(client, userId);
  return client.query<T>(sql, params);
}

async function expectRpcError(
  client: Client,
  userId: string,
  sql: string,
  params: unknown[],
  code: string,
  message: RegExp,
): Promise<void> {
  await client.query("savepoint expected_rpc_failure");
  try {
    await rpc(client, userId, sql, params);
    throw new Error("Expected RPC to fail");
  } catch (error) {
    const pgError = error as PgError;
    expect(pgError.code).toBe(code);
    expect(pgError.message).toMatch(message);
  } finally {
    await client.query("rollback to savepoint expected_rpc_failure");
    await client.query("release savepoint expected_rpc_failure");
  }
}

async function seedFinancialFixture(
  client: Client,
  fixture: {
    userId: string;
    email: string;
    accountId: string;
    earnTxId: string;
    wishId?: string;
    wishStatus?: "PRIMARY" | "RESERVED" | "REDEEMED";
    reserveTxId?: string;
    redeemTxId?: string;
    receiptId?: string;
  },
): Promise<void> {
  await client.query("insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing", [
    fixture.userId,
    fixture.email,
  ]);
  await client.query(
    "insert into public.reward_accounts (id, user_id) values ($1, $2) on conflict (id) do nothing",
    [fixture.accountId, fixture.userId],
  );
  if (fixture.wishId) {
    await client.query(
      "insert into public.wishes (id, user_id, title, credit_cost) values ($1, $2, 'Concurrency fixture', 100) on conflict (id) do nothing",
      [fixture.wishId, fixture.userId],
    );
  }
  await client.query(
    `insert into public.reward_transactions
       (id, account_id, user_id, event_kind, amount, canonical_source_type,
        canonical_source_id, policy_version, request_idempotency_key)
     values ($1, $2, $3, 'EARN', 100, 'QUEST', $4, 'reward-v1', $5)
     on conflict (id) do nothing`,
    [fixture.earnTxId, fixture.accountId, fixture.userId, `fixture:${fixture.userId}`, `fixture-earn:${fixture.userId}`],
  );
  if (fixture.wishStatus === "RESERVED" || fixture.wishStatus === "REDEEMED") {
    await client.query(
      `insert into public.reward_transactions
         (id, account_id, user_id, event_kind, amount, canonical_source_type,
          canonical_source_id, policy_version, request_idempotency_key)
       values ($1, $2, $3, 'RESERVE', 100, 'WISH', $4, null, $5)
       on conflict (id) do nothing`,
      [fixture.reserveTxId, fixture.accountId, fixture.userId, fixture.wishId, `fixture-reserve:${fixture.userId}`],
    );
  }
  if (fixture.wishStatus === "REDEEMED") {
    await client.query(
      `insert into public.reward_transactions
         (id, account_id, user_id, event_kind, amount, canonical_source_type,
          canonical_source_id, policy_version, request_idempotency_key)
       values ($1, $2, $3, 'REDEEM', 100, 'WISH', $4, null, $5)
       on conflict (id) do nothing`,
      [fixture.redeemTxId, fixture.accountId, fixture.userId, fixture.wishId, `fixture-redeem:${fixture.userId}`],
    );
  }
  if (fixture.wishId && fixture.wishStatus) {
    await client.query("update public.wishes set status = $2 where id = $1", [fixture.wishId, fixture.wishStatus]);
  }
  if (fixture.wishStatus === "REDEEMED") {
    await client.query(
      `insert into public.reward_redemptions
         (id, user_id, wish_id, transaction_id, credits_spent)
       values ($1, $2, $3, $4, 100) on conflict (id) do nothing`,
      [fixture.receiptId, fixture.userId, fixture.wishId, fixture.redeemTxId],
    );
  }
  await client.query("select public.phase8e_sync_reward_account($1, $2)", [fixture.accountId, fixture.userId]);
}

async function raceDifferentKeys(
  connectionString: string,
  userId: string,
  sql: string,
  firstParams: unknown[],
  secondParams: unknown[],
): Promise<void> {
  const first = new Client({ connectionString });
  const second = new Client({ connectionString });
  await Promise.all([first.connect(), second.connect()]);
  try {
    await first.query("begin");
    await second.query("begin");
    await setAuthenticated(first, userId);
    await setAuthenticated(second, userId);
    await first.query(sql, firstParams);
    const loser = second.query(sql, secondParams);
    await new Promise((resolve) => setTimeout(resolve, 75));
    await first.query("commit");
    await expect(loser).rejects.toMatchObject({ code: expect.stringMatching(/23505|23514/) });
    await second.query("rollback");
  } finally {
    await first.query("rollback").catch(() => undefined);
    await second.query("rollback").catch(() => undefined);
    await Promise.all([first.end(), second.end()]);
  }
}

type RpcMatrixKind =
  | "grant" | "correct" | "activate" | "primary" | "reserve"
  | "unreserve" | "redeem" | "refund" | "archive" | "cancel";

async function setupRpcMatrixFixture(
  client: Client,
  kind: RpcMatrixKind,
): Promise<{
  kind: RpcMatrixKind;
  userId: string;
  targetId: string;
  wishId?: string;
  sql: string;
  params: (targetId: string, key: string) => unknown[];
}> {
  const userId = randomUUID();
  const targetId = randomUUID();
  const accountId = randomUUID();
  const earnTxId = randomUUID();
  const wishId = targetId;
  await client.query("insert into auth.users (id, email) values ($1, $2)", [userId, `phase8e-matrix-${userId}@example.test`]);

  if (kind === "grant") {
    await client.query(
      `insert into public.quests
         (id, user_id, title, quest_type, quest_size, status, is_boss, completed_at)
       values ($1, $2, 'Matrix quest', 'skill', 'major', 'completed', false, clock_timestamp())`,
      [targetId, userId],
    );
    return {
      kind, userId, targetId,
      sql: "select public.rpc_grant_reward_credit('QUEST', $1, 'reward-v1', $2) as result",
      params: (target, key) => [target, key],
    };
  }

  if (kind === "correct") {
    await seedFinancialFixture(client, { userId, email: `unused-${userId}@example.test`, accountId, earnTxId });
    return {
      kind, userId, targetId: earnTxId,
      sql: "select public.rpc_correct_reward_transaction($1, null, $2) as result",
      params: (target, key) => [target, key],
    };
  }

  const status = kind === "reserve" ? "PRIMARY"
    : kind === "unreserve" || kind === "redeem" ? "RESERVED"
      : kind === "refund" ? "REDEEMED" : undefined;
  if (status) {
    await seedFinancialFixture(client, {
      userId, email: `unused-${userId}@example.test`, accountId, earnTxId,
      wishId, wishStatus: status, reserveTxId: randomUUID(), redeemTxId: randomUUID(), receiptId: kind === "refund" ? targetId : randomUUID(),
    });
  } else {
    await client.query(
      "insert into public.wishes (id, user_id, title, credit_cost) values ($1, $2, 'Matrix wish', 100)",
      [wishId, userId],
    );
    if (kind !== "activate") {
      await client.query("update public.wishes set status = $2 where id = $1", [wishId, kind === "primary" ? "ACTIVE" : "ACTIVE"]);
    }
  }

  const specs: Record<Exclude<RpcMatrixKind, "grant" | "correct">, { sql: string; receipt?: boolean }> = {
    activate: { sql: "select public.rpc_activate_wish($1, $2) as result" },
    primary: { sql: "select public.rpc_set_primary_wish($1, $2) as result" },
    reserve: { sql: "select public.rpc_reserve_wish_credits($1, $2) as result" },
    unreserve: { sql: "select public.rpc_unreserve_wish_credits($1, $2) as result" },
    redeem: { sql: "select public.rpc_redeem_wish($1, null, $2) as result" },
    refund: { sql: "select public.rpc_refund_wish_redemption($1, null, $2) as result", receipt: true },
    archive: { sql: "select public.rpc_archive_wish($1, $2) as result" },
    cancel: { sql: "select public.rpc_cancel_wish($1, $2) as result" },
  };
  const spec = specs[kind as Exclude<RpcMatrixKind, "grant" | "correct">];
  return {
    kind,
    userId,
    targetId: spec.receipt ? targetId : wishId,
    wishId,
    sql: spec.sql,
    params: (target, key) => [target, key],
  };
}

type RpcMutationSnapshot = {
  accounts: number;
  transactions: number;
  redemptions: number;
  audits: number;
  wish_status: string | null;
};

async function rpcMutationSnapshot(
  client: Client,
  fixture: Awaited<ReturnType<typeof setupRpcMatrixFixture>>,
  key: string,
): Promise<RpcMutationSnapshot> {
  const result = await client.query<RpcMutationSnapshot>(
    `select
       (select count(*)::int from public.reward_accounts where user_id = $1) as accounts,
       (select count(*)::int from public.reward_transactions where user_id = $1) as transactions,
       (select count(*)::int from public.reward_redemptions where user_id = $1) as redemptions,
       (select count(*)::int from public.outer_loop_audit_events
        where user_id = $1 and request_idempotency_key = $2) as audits,
       (select status::text from public.wishes where id = $3) as wish_status`,
    [fixture.userId, key, fixture.wishId ?? null],
  );
  return result.rows[0]!;
}

async function waitForAdvisoryLockWait(observer: Client, backendPid: number): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = await observer.query<{ waiting: boolean }>(
      `select exists (
         select 1 from pg_catalog.pg_stat_activity
         where pid = $1 and state = 'active'
           and wait_event_type = 'Lock' and wait_event = 'advisory'
       ) as waiting`,
      [backendPid],
    );
    if (result.rows[0]?.waiting) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`backend ${backendPid} never reached the advisory-lock wait`);
}

function expectSingleRpcMutation(
  kind: RpcMatrixKind,
  before: RpcMutationSnapshot,
  after: RpcMutationSnapshot,
): void {
  const transactionDelta = ["grant", "correct", "reserve", "unreserve", "redeem", "refund"].includes(kind) ? 1 : 0;
  const accountDelta = kind === "grant" ? 1 : 0;
  const redemptionDelta = kind === "redeem" ? 1 : 0;
  const expectedStatus: Partial<Record<RpcMatrixKind, string>> = {
    activate: "ACTIVE",
    primary: "PRIMARY",
    reserve: "RESERVED",
    unreserve: "PRIMARY",
    redeem: "REDEEMED",
    refund: "REDEEMED",
    archive: "ARCHIVED",
    cancel: "CANCELLED",
  };

  expect(after.accounts).toBe(before.accounts + accountDelta);
  expect(after.transactions).toBe(before.transactions + transactionDelta);
  expect(after.redemptions).toBe(before.redemptions + redemptionDelta);
  expect(after.audits).toBe(1);
  if (expectedStatus[kind]) expect(after.wish_status).toBe(expectedStatus[kind]);
}

async function runSameKeyConcurrency(
  connectionString: string,
  fixture: Awaited<ReturnType<typeof setupRpcMatrixFixture>>,
  key: string,
  alternateTarget?: string,
): Promise<void> {
  const first = new Client({ connectionString });
  const second = new Client({ connectionString });
  const observer = new Client({ connectionString });
  let before: RpcMutationSnapshot | undefined;
  await Promise.all([first.connect(), second.connect(), observer.connect()]);
  try {
    before = await rpcMutationSnapshot(observer, fixture, key);
    const secondPid = Number((await second.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]?.pid);
    await first.query("begin");
    await second.query("begin");
    await setAuthenticated(first, fixture.userId);
    await setAuthenticated(second, fixture.userId);
    const firstResult = await first.query(fixture.sql, fixture.params(fixture.targetId, key));
    const secondPending = second.query(
      fixture.sql,
      fixture.params(alternateTarget ?? fixture.targetId, key),
    );
    await waitForAdvisoryLockWait(observer, secondPid);
    await first.query("commit");
    expect((firstResult.rows[0]?.result as { replayed: boolean }).replayed).toBe(false);
    if (alternateTarget) {
      await expect(secondPending).rejects.toMatchObject({ code: "23505", message: expect.stringMatching(/IDEMPOTENCY_KEY_REUSED/) });
      await second.query("rollback");
    } else {
      const secondResult = await secondPending;
      await second.query("commit");
      expect((secondResult.rows[0]?.result as { replayed: boolean }).replayed).toBe(true);
    }
  } finally {
    await first.query("rollback").catch(() => undefined);
    await second.query("rollback").catch(() => undefined);
    await Promise.all([first.end(), second.end(), observer.end()]);
  }
  const verifier = new Client({ connectionString });
  await verifier.connect();
  try {
    const after = await rpcMutationSnapshot(verifier, fixture, key);
    expect(before).toBeDefined();
    expectSingleRpcMutation(fixture.kind, before!, after);
  } finally {
    await verifier.end();
  }
}

async function cleanupMatrixUsers(client: Client, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await client.query("set session_replication_role = replica");
  try {
    for (const table of [
      "reward_redemptions", "reward_transactions", "reward_accounts", "outer_loop_audit_events",
      "outer_loop_proposals", "mastery_verifications", "wishes", "quests",
    ]) {
      await client.query(`delete from public.${table} where user_id = any($1::uuid[])`, [userIds]);
    }
  } finally {
    await client.query("set session_replication_role = origin");
  }
  await client.query("delete from auth.users where id = any($1::uuid[])", [userIds]);
}

describe.skipIf(!DATABASE_URL)("Phase 8E Round 2 — Reward/Wish RPC authority", () => {
  let pg: Client;

  beforeAll(async () => {
    pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();
    const installed = await pg.query<{ present: boolean }>(
      "select to_regprocedure('public.rpc_grant_reward_credit(text,text,text,text)') is not null as present",
    );
    expect(installed.rows[0]?.present).toBe(true);

    await pg.query(
      `insert into auth.users (id, email) values
         ($1, 'phase8e-rpc-a@example.test'),
         ($2, 'phase8e-rpc-b@example.test')
       on conflict (id) do nothing`,
      [USER_A, USER_B],
    );
    await pg.query(
      `insert into public.seasons
         (id, user_id, name, status, started_at, ended_at)
       values ($1, $2, 'Verified Season', 'COMPLETED', clock_timestamp() - interval '30 days', clock_timestamp())
       on conflict (id) do nothing`,
      [SEASON_A, USER_A],
    );
    await pg.query(
      `insert into public.season_reviews
         (id, user_id, season_id, review_type, version, commit_key,
          period_start, period_end, objective_summary, qualitative_reflection, criteria_evaluation)
       values ($1, $2, $3, 'FINAL', 1, gen_random_uuid(),
         clock_timestamp() - interval '30 days', clock_timestamp(), '{}'::jsonb, 'verified', '{}'::jsonb)
       on conflict (id) do nothing`,
      [REVIEW_A, USER_A, SEASON_A],
    );
    await pg.query(
      `insert into public.quests
         (id, user_id, title, quest_type, quest_size, status, is_boss, completed_at)
       values
         ($1, $3, 'Boss quest', 'skill', 'major', 'completed', true, clock_timestamp()),
         ($2, $3, 'Concurrent quest', 'skill', 'epic', 'completed', false, clock_timestamp())
       on conflict (id) do nothing`,
      [QUEST_A, QUEST_CONCURRENT, USER_A],
    );
    await pg.query(
      `insert into public.quests
         (id, user_id, title, quest_type, quest_size, status, is_boss, completed_at)
       values ($1, $2, 'Other tenant quest', 'skill', 'major', 'completed', false, clock_timestamp())
       on conflict (id) do nothing`,
      [QUEST_OTHER, USER_B],
    );
    await pg.query(
      `insert into public.domains (id, user_id, name, slug)
       values ($1, $2, 'RPC Domain', 'phase8e-rpc-domain') on conflict (id) do nothing`,
      [DOMAIN_A, USER_A],
    );
    await pg.query(
      `insert into public.skills (id, user_id, domain_id, name, mastery_level)
       values ($1, $2, $3, 'Verified Skill', 6) on conflict (id) do nothing`,
      [SKILL_A, USER_A, DOMAIN_A],
    );
    await pg.query(
      `insert into public.mastery_verifications
         (id, user_id, skill_id, skill_name, from_level, to_level, evidence_level, status, resolved_at)
       values ($1, $2, $3, 'Verified Skill', 5, 6, 4, 'verified', clock_timestamp())
       on conflict (id) do nothing`,
      [VERIFY_A, USER_A, SKILL_A],
    );
    await pg.query(
      `insert into public.wishes (id, user_id, title, credit_cost) values
         ($1, $6, 'Primary wish', 100),
         ($2, $6, 'Second wish', 50),
         ($3, $6, 'Nullable wish', 10),
         ($4, $6, 'Concurrent wish', 25),
         ($5, $7, 'Other tenant wish', 10)
       on conflict (id) do nothing`,
      [WISH_A, WISH_B, WISH_NULL, WISH_CONCURRENT, WISH_OTHER, USER_A, USER_B],
    );
    await seedFinancialFixture(pg, {
      userId: USER_RESERVE, email: "phase8e-reserve@example.test",
      accountId: "8f333333-0100-4000-a000-000000000003",
      earnTxId: "8f333333-0030-4000-a000-000000000003",
      wishId: WISH_RESERVE, wishStatus: "PRIMARY",
    });
    await seedFinancialFixture(pg, {
      userId: USER_REDEEM, email: "phase8e-redeem@example.test",
      accountId: "8f444444-0100-4000-a000-000000000004",
      earnTxId: "8f444444-0030-4000-a000-000000000004",
      wishId: WISH_REDEEM, wishStatus: "RESERVED",
      reserveTxId: "8f444444-0031-4000-a000-000000000004",
    });
    await seedFinancialFixture(pg, {
      userId: USER_CORRECT, email: "phase8e-correct@example.test",
      accountId: "8f555555-0100-4000-a000-000000000005",
      earnTxId: TX_CORRECT,
    });
    await seedFinancialFixture(pg, {
      userId: USER_REFUND, email: "phase8e-refund@example.test",
      accountId: "8f666666-0100-4000-a000-000000000006",
      earnTxId: "8f666666-0030-4000-a000-000000000006",
      wishId: WISH_REFUND, wishStatus: "REDEEMED",
      reserveTxId: "8f666666-0031-4000-a000-000000000006",
      redeemTxId: "8f666666-0032-4000-a000-000000000006",
      receiptId: RECEIPT_REFUND,
    });
  }, 45_000);

  beforeEach(async () => {
    await pg.query("begin");
  });

  afterEach(async () => {
    await pg.query("rollback");
    await pg.query("reset role");
  });

  afterAll(async () => {
    if (!pg) return;
    await pg.query("rollback").catch(() => undefined);
    await pg.query("set session_replication_role = replica");
    await pg.query("delete from public.reward_redemptions where user_id = any($1::uuid[])", [ALL_USERS]);
    await pg.query("delete from public.reward_transactions where user_id = any($1::uuid[])", [ALL_USERS]);
    await pg.query("delete from public.reward_accounts where user_id = any($1::uuid[])", [ALL_USERS]);
    await pg.query("delete from public.outer_loop_audit_events where user_id = any($1::uuid[])", [ALL_USERS]);
    await pg.query("delete from public.outer_loop_proposals where user_id = any($1::uuid[])", [ALL_USERS]);
    await pg.query("delete from public.mastery_verifications where user_id = any($1::uuid[])", [ALL_USERS]);
    await pg.query("set session_replication_role = origin");
    await pg.query("delete from auth.users where id = any($1::uuid[])", [ALL_USERS]);
    await pg.end();
  });

  test("reward-v1 freezes exact Season, Quest, and Mastery amounts", async () => {
    const result = await pg.query<{ season: number; major: number; epic: number; boss: number; m6: number; m8: number; m10: number }>(
      `select
         public.calculate_reward_grant_v1('SEASON', '{}'::jsonb) as season,
         public.calculate_reward_grant_v1('QUEST', '{"quest_size":"major","is_boss":false}'::jsonb) as major,
         public.calculate_reward_grant_v1('QUEST', '{"quest_size":"epic","is_boss":false}'::jsonb) as epic,
         public.calculate_reward_grant_v1('QUEST', '{"quest_size":"major","is_boss":true}'::jsonb) as boss,
         public.calculate_reward_grant_v1('MASTERY', '{"threshold":6}'::jsonb) as m6,
         public.calculate_reward_grant_v1('MASTERY', '{"threshold":8}'::jsonb) as m8,
         public.calculate_reward_grant_v1('MASTERY', '{"threshold":10}'::jsonb) as m10`,
    );
    expect(result.rows[0]).toEqual({ season: 150, major: 100, epic: 150, boss: 200, m6: 100, m8: 150, m10: 250 });
  });

  test("only authenticated callers can execute the ten public mutation RPCs", async () => {
    const signatures = [
      "rpc_grant_reward_credit(text,text,text,text)",
      "rpc_correct_reward_transaction(uuid,text,text)",
      "rpc_activate_wish(uuid,text)",
      "rpc_set_primary_wish(uuid,text)",
      "rpc_reserve_wish_credits(uuid,text)",
      "rpc_unreserve_wish_credits(uuid,text)",
      "rpc_redeem_wish(uuid,text,text)",
      "rpc_refund_wish_redemption(uuid,text,text)",
      "rpc_archive_wish(uuid,text)",
      "rpc_cancel_wish(uuid,text)",
    ];
    for (const signature of signatures) {
      const privilege = await pg.query<{ authenticated: boolean; anon: boolean; service_role: boolean }>(
        `select
           has_function_privilege('authenticated', 'public.' || $1, 'EXECUTE') as authenticated,
           has_function_privilege('anon', 'public.' || $1, 'EXECUTE') as anon,
           has_function_privilege('service_role', 'public.' || $1, 'EXECUTE') as service_role`,
        [signature],
      );
      expect(privilege.rows[0], signature).toEqual({ authenticated: true, anon: false, service_role: false });
    }
  });

  test("grants only verified sources, replays exactly, and rejects Artifact without ledger mutation", async () => {
    const season = await rpc<{ result: Record<string, unknown> }>(pg, USER_A,
      "select public.rpc_grant_reward_credit('SEASON', $1, 'reward-v1', 'grant-season') as result", [SEASON_A]);
    const quest = await rpc<{ result: Record<string, unknown> }>(pg, USER_A,
      "select public.rpc_grant_reward_credit('QUEST', $1, 'reward-v1', 'grant-quest') as result", [QUEST_A]);
    await rpc(pg, USER_A,
      "select public.rpc_grant_reward_credit('MASTERY', $1, 'reward-v1', 'grant-mastery') as result", [`${SKILL_A}:M6`]);
    expect((season.rows[0]?.result as { transaction: { amount: number } }).transaction.amount).toBe(150);
    expect((quest.rows[0]?.result as { transaction: { amount: number } }).transaction.amount).toBe(200);

    const replay = await rpc<{ result: { replayed: boolean } }>(pg, USER_A,
      "select public.rpc_grant_reward_credit('QUEST', $1, 'reward-v1', 'grant-quest') as result", [QUEST_A]);
    expect(replay.rows[0]?.result.replayed).toBe(true);

    const rejected = await rpc<{ result: { error_code: string; replayed: boolean } }>(pg, USER_A,
      "select public.rpc_grant_reward_credit('ARTIFACT', 'not-authorized', 'reward-v1', 'grant-artifact') as result");
    expect(rejected.rows[0]?.result).toMatchObject({ error_code: "SOURCE_CLASS_NOT_YET_AVAILABLE", replayed: false });
    const rejectedReplay = await rpc<{ result: { error_code: string; replayed: boolean } }>(pg, USER_A,
      "select public.rpc_grant_reward_credit('ARTIFACT', 'not-authorized', 'reward-v1', 'grant-artifact') as result");
    expect(rejectedReplay.rows[0]?.result).toMatchObject({ error_code: "SOURCE_CLASS_NOT_YET_AVAILABLE", replayed: true });

    const state = await pg.query<{ count: string; current_available: number; audit_rejections: string }>(
      `select
         (select count(*)::text from public.reward_transactions where user_id = $1) as count,
         (select current_available from public.reward_accounts where user_id = $1) as current_available,
         (select count(*)::text from public.outer_loop_audit_events where user_id = $1 and event_type = 'REWARD_GRANT_REJECTED') as audit_rejections`,
      [USER_A],
    );
    expect(state.rows[0]).toEqual({ count: "3", current_available: 450, audit_rejections: "1" });
  });

  test("correction is append-only, exact, replayable, and preserves account parity", async () => {
    const grant = await rpc<{ result: { transaction: { id: string } } }>(pg, USER_A,
      "select public.rpc_grant_reward_credit('SEASON', $1, 'reward-v1', 'correct-grant') as result", [SEASON_A]);
    const originalId = grant.rows[0]!.result.transaction.id;
    const corrected = await rpc<{ result: { transaction: { amount: number }; account: { net_earned: number } } }>(pg, USER_A,
      "select public.rpc_correct_reward_transaction($1, 'revoked', 'correct-once') as result", [originalId]);
    expect(corrected.rows[0]?.result.transaction.amount).toBe(-150);
    expect(corrected.rows[0]?.result.account.net_earned).toBe(0);
    const replay = await rpc<{ result: { replayed: boolean } }>(pg, USER_A,
      "select public.rpc_correct_reward_transaction($1, 'revoked', 'correct-once') as result", [originalId]);
    expect(replay.rows[0]?.result.replayed).toBe(true);
    await pg.query("reset role");
    const parity = await pg.query<{ equal: boolean; count: string }>(
      `select (to_jsonb(a) - 'id' - 'user_id' - 'updated_at') = public.phase8e_fold_reward_ledger($1) as equal,
              (select count(*)::text from public.reward_transactions where user_id = $1) as count
       from public.reward_accounts a where user_id = $1`, [USER_A]);
    expect(parity.rows[0]).toEqual({ equal: true, count: "2" });
  });

  test("Wish reserve/redeem/refund is atomic and cooldown blocks another reservation", async () => {
    await rpc(pg, USER_A,
      "select public.rpc_grant_reward_credit('QUEST', $1, 'reward-v1', 'wish-funds')", [QUEST_A]);
    await rpc(pg, USER_A, "select public.rpc_activate_wish($1, 'wish-activate')", [WISH_A]);
    await rpc(pg, USER_A, "select public.rpc_set_primary_wish($1, 'wish-primary')", [WISH_A]);
    const primaryReplay = await rpc<{ result: { replayed: boolean } }>(pg, USER_A,
      "select public.rpc_set_primary_wish($1, 'wish-primary') as result", [WISH_A]);
    expect(primaryReplay.rows[0]?.result.replayed).toBe(true);
    await rpc(pg, USER_A, "select public.rpc_reserve_wish_credits($1, 'wish-reserve')", [WISH_A]);
    const reserveReplay = await rpc<{ result: { replayed: boolean } }>(pg, USER_A,
      "select public.rpc_reserve_wish_credits($1, 'wish-reserve') as result", [WISH_A]);
    expect(reserveReplay.rows[0]?.result.replayed).toBe(true);
    const redeemed = await rpc<{ result: { redemption: { id: string }; account: { current_available: number; lifetime_redeemed: number } } }>(
      pg, USER_A, "select public.rpc_redeem_wish($1, 'earned', 'wish-redeem') as result", [WISH_A]);
    expect(redeemed.rows[0]?.result.account).toMatchObject({ current_available: 100, lifetime_redeemed: 100 });
    const redemptionId = redeemed.rows[0]!.result.redemption.id;
    const refunded = await rpc<{ result: { account: { current_available: number; lifetime_redeemed: number } } }>(
      pg, USER_A, "select public.rpc_refund_wish_redemption($1, 'merchant refund', 'wish-refund') as result", [redemptionId]);
    expect(refunded.rows[0]?.result.account).toMatchObject({ current_available: 200, lifetime_redeemed: 0 });
    const redeemReplay = await rpc<{ result: { replayed: boolean } }>(pg, USER_A,
      "select public.rpc_redeem_wish($1, 'earned', 'wish-redeem') as result", [WISH_A]);
    const refundReplay = await rpc<{ result: { replayed: boolean } }>(pg, USER_A,
      "select public.rpc_refund_wish_redemption($1, 'merchant refund', 'wish-refund') as result", [redemptionId]);
    expect(redeemReplay.rows[0]?.result.replayed).toBe(true);
    expect(refundReplay.rows[0]?.result.replayed).toBe(true);

    await rpc(pg, USER_A, "select public.rpc_activate_wish($1, 'second-activate')", [WISH_B]);
    await rpc(pg, USER_A, "select public.rpc_set_primary_wish($1, 'second-primary')", [WISH_B]);
    await expectRpcError(pg, USER_A,
      "select public.rpc_reserve_wish_credits($1, 'second-reserve')", [WISH_B], "23514", /REDEMPTION_COOLDOWN_ACTIVE/);

    const receipt = await pg.query<{ tx_count: string; receipt_count: string; status: string; cooldown: boolean }>(
      `select
         (select count(*)::text from public.reward_transactions where user_id = $1 and event_kind in ('RESERVE','REDEEM','REFUND')) as tx_count,
         (select count(*)::text from public.reward_redemptions where user_id = $1) as receipt_count,
         (select status from public.wishes where id = $2) as status,
         (select cooldown_until > clock_timestamp() from public.wishes where id = $2) as cooldown`,
      [USER_A, WISH_A]);
    expect(receipt.rows[0]).toEqual({ tx_count: "3", receipt_count: "1", status: "REDEEMED", cooldown: true });
  });

  test("unreserve, archive, and cancel are replayable and do not bypass ledger rules", async () => {
    await rpc(pg, USER_A,
      "select public.rpc_grant_reward_credit('QUEST', $1, 'reward-v1', 'unreserve-funds')", [QUEST_A]);
    await rpc(pg, USER_A, "select public.rpc_activate_wish($1, 'unreserve-activate')", [WISH_A]);
    await rpc(pg, USER_A, "select public.rpc_set_primary_wish($1, 'unreserve-primary')", [WISH_A]);
    await rpc(pg, USER_A, "select public.rpc_reserve_wish_credits($1, 'unreserve-reserve')", [WISH_A]);
    const unreserved = await rpc<{ result: { wish: { status: string }; account: { current_reserved: number } } }>(pg, USER_A,
      "select public.rpc_unreserve_wish_credits($1, 'unreserve-once') as result", [WISH_A]);
    expect(unreserved.rows[0]?.result).toMatchObject({ wish: { status: "PRIMARY" }, account: { current_reserved: 0 } });
    const unreserveReplay = await rpc<{ result: { replayed: boolean } }>(pg, USER_A,
      "select public.rpc_unreserve_wish_credits($1, 'unreserve-once') as result", [WISH_A]);
    expect(unreserveReplay.rows[0]?.result.replayed).toBe(true);
    await rpc(pg, USER_A, "select public.rpc_cancel_wish($1, 'cancel-primary')", [WISH_A]);
    const cancelReplay = await rpc<{ result: { replayed: boolean } }>(pg, USER_A,
      "select public.rpc_cancel_wish($1, 'cancel-primary') as result", [WISH_A]);
    expect(cancelReplay.rows[0]?.result.replayed).toBe(true);
    await rpc(pg, USER_A, "select public.rpc_activate_wish($1, 'archive-activate')", [WISH_B]);
    await rpc(pg, USER_A, "select public.rpc_set_primary_wish($1, 'archive-primary')", [WISH_B]);
    await rpc(pg, USER_A, "select public.rpc_archive_wish($1, 'archive-once')", [WISH_B]);
    const archiveReplay = await rpc<{ result: { replayed: boolean } }>(pg, USER_A,
      "select public.rpc_archive_wish($1, 'archive-once') as result", [WISH_B]);
    expect(archiveReplay.rows[0]?.result.replayed).toBe(true);
  });

  test("every target-bearing RPC maps cross-tenant identifiers to 404 with zero audit residue", async () => {
    const cases: Array<[string, string, unknown[]]> = [
      ["grant", "select public.rpc_grant_reward_credit('QUEST', $1, 'reward-v1', $2)", [QUEST_OTHER]],
      ["correct", "select public.rpc_correct_reward_transaction($1, null, $2)", [TX_CORRECT]],
      ["activate", "select public.rpc_activate_wish($1, $2)", [WISH_OTHER]],
      ["primary", "select public.rpc_set_primary_wish($1, $2)", [WISH_OTHER]],
      ["reserve", "select public.rpc_reserve_wish_credits($1, $2)", [WISH_RESERVE]],
      ["unreserve", "select public.rpc_unreserve_wish_credits($1, $2)", [WISH_REDEEM]],
      ["redeem", "select public.rpc_redeem_wish($1, null, $2)", [WISH_REDEEM]],
      ["refund", "select public.rpc_refund_wish_redemption($1, null, $2)", [RECEIPT_REFUND]],
      ["archive", "select public.rpc_archive_wish($1, $2)", [WISH_OTHER]],
      ["cancel", "select public.rpc_cancel_wish($1, $2)", [WISH_OTHER]],
    ];
    for (const [label, sql, targetParams] of cases) {
      const key = `cross-tenant-${label}`;
      await expectRpcError(pg, USER_A, sql, [...targetParams, key], "P0002", /NOT_FOUND/);
      const residue = await pg.query<{ count: string }>(
        "select count(*)::text as count from public.outer_loop_audit_events where user_id = $1 and request_idempotency_key = $2",
        [USER_A, key]);
      expect(residue.rows[0]?.count, label).toBe("0");
    }
  });

  test("NULL cost and cross-tenant targets fail closed; key conflict wins before ownership probing", async () => {
    await rpc(pg, USER_A, "select public.rpc_activate_wish($1, 'null-activate')", [WISH_NULL]);
    await pg.query("update public.wishes set credit_cost = null where id = $1", [WISH_NULL]);
    await expectRpcError(pg, USER_A,
      "select public.rpc_set_primary_wish($1, 'null-primary')", [WISH_NULL], "22023", /WISH_COST_REQUIRED/);

    await rpc(pg, USER_A, "select public.rpc_activate_wish($1, 'bound-key')", [WISH_A]);
    await expectRpcError(pg, USER_A,
      "select public.rpc_archive_wish($1, 'bound-key')", [WISH_OTHER], "23505", /IDEMPOTENCY_KEY_REUSED/);
    await expectRpcError(pg, USER_A,
      "select public.rpc_archive_wish($1, 'first-seen-cross-tenant')", [WISH_OTHER], "P0002", /WISH_NOT_FOUND/);
    const residue = await pg.query<{ count: string }>(
      "select count(*)::text as count from public.outer_loop_audit_events where user_id = $1 and request_idempotency_key = 'first-seen-cross-tenant'",
      [USER_A]);
    expect(residue.rows[0]?.count).toBe("0");
  });

  test("WISH_COST_SUGGESTION changes only editable cost through proposal CAS", async () => {
    await pg.query(
      `insert into public.outer_loop_proposals
         (id, user_id, proposal_type, schema_version, payload)
       values ($1, $2, 'WISH_COST_SUGGESTION', 1,
         jsonb_build_object('wish_id', $3::text, 'suggested_credits', 75, 'rationale', 'bounded'))`,
      [PROPOSAL_A, USER_A, WISH_A],
    );
    const settled = await rpc<{ result: { replayed: boolean; result: { wish_id: string } } }>(pg, USER_A,
      "select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'proposal-wish-cost') as result",
      [PROPOSAL_A]);
    expect(settled.rows[0]?.result).toMatchObject({ replayed: false, result: { wish_id: WISH_A } });
    const wish = await pg.query<{ credit_cost: number; status: string }>(
      "select credit_cost, status from public.wishes where id = $1", [WISH_A]);
    expect(wish.rows[0]).toEqual({ credit_cost: 75, status: "IDEA" });
    const replay = await rpc<{ result: { replayed: boolean } }>(pg, USER_A,
      "select public.rpc_review_outer_loop_proposal($1, 'ACCEPTED', null, null, 'proposal-wish-cost') as result",
      [PROPOSAL_A]);
    expect(replay.rows[0]?.result.replayed).toBe(true);
  });

  test("different-key concurrent duplicate mint has one winner and no failed-key residue", async () => {
    await pg.query("rollback");
    const first = new Client({ connectionString: DATABASE_URL });
    const second = new Client({ connectionString: DATABASE_URL });
    await Promise.all([first.connect(), second.connect()]);
    try {
      await first.query("begin");
      await second.query("begin");
      await setAuthenticated(first, USER_A);
      await setAuthenticated(second, USER_A);
      const firstResult = await first.query(
        "select public.rpc_grant_reward_credit('QUEST', $1, 'reward-v1', 'concurrent-grant-a') as result",
        [QUEST_CONCURRENT],
      );
      const secondPending = second.query(
        "select public.rpc_grant_reward_credit('QUEST', $1, 'reward-v1', 'concurrent-grant-b') as result",
        [QUEST_CONCURRENT],
      );
      await new Promise((resolve) => setTimeout(resolve, 75));
      await first.query("commit");
      expect((firstResult.rows[0]?.result as { replayed: boolean }).replayed).toBe(false);
      await expect(secondPending).rejects.toMatchObject({ code: "23505" });
      await second.query("rollback");
      const check = await pg.query<{ earns: string; failed_audit: string }>(
        `select
           count(*) filter (where event_kind = 'EARN')::text as earns,
           (select count(*)::text from public.outer_loop_audit_events
            where user_id = $1 and request_idempotency_key = 'concurrent-grant-b') as failed_audit
         from public.reward_transactions where user_id = $1 and canonical_source_id = $2`,
        [USER_A, QUEST_CONCURRENT],
      );
      expect(check.rows[0]).toEqual({ earns: "1", failed_audit: "0" });
    } finally {
      await first.query("rollback").catch(() => undefined);
      await second.query("rollback").catch(() => undefined);
      await Promise.all([first.end(), second.end()]);
      await pg.query("begin");
    }
  }, 20_000);

  test("same-key concurrent activation returns one mutation and one stored replay", async () => {
    await pg.query("rollback");
    const first = new Client({ connectionString: DATABASE_URL });
    const second = new Client({ connectionString: DATABASE_URL });
    await Promise.all([first.connect(), second.connect()]);
    try {
      await first.query("begin");
      await second.query("begin");
      await setAuthenticated(first, USER_A);
      await setAuthenticated(second, USER_A);
      const firstResult = await first.query(
        "select public.rpc_activate_wish($1, 'concurrent-activate') as result", [WISH_CONCURRENT]);
      const secondPending = second.query(
        "select public.rpc_activate_wish($1, 'concurrent-activate') as result", [WISH_CONCURRENT]);
      await new Promise((resolve) => setTimeout(resolve, 75));
      await first.query("commit");
      const secondResult = await secondPending;
      await second.query("commit");
      expect((firstResult.rows[0]?.result as { replayed: boolean }).replayed).toBe(false);
      expect((secondResult.rows[0]?.result as { replayed: boolean }).replayed).toBe(true);
      const check = await pg.query<{ audits: string; status: string }>(
        `select
           (select count(*)::text from public.outer_loop_audit_events
            where user_id = $1 and request_idempotency_key = 'concurrent-activate') as audits,
           (select status from public.wishes where id = $2) as status`,
        [USER_A, WISH_CONCURRENT]);
      expect(check.rows[0]).toEqual({ audits: "1", status: "ACTIVE" });
    } finally {
      await first.query("rollback").catch(() => undefined);
      await second.query("rollback").catch(() => undefined);
      await Promise.all([first.end(), second.end()]);
      await pg.query("begin");
    }
  }, 20_000);

  test("all ten RPCs serialize same-key replay and same-key different-tuple conflict", async () => {
    await pg.query("rollback");
    const users: string[] = [];
    const kinds: RpcMatrixKind[] = [
      "grant", "correct", "activate", "primary", "reserve",
      "unreserve", "redeem", "refund", "archive", "cancel",
    ];
    try {
      for (const kind of kinds) {
        const replayFixture = await setupRpcMatrixFixture(pg, kind);
        users.push(replayFixture.userId);
        await runSameKeyConcurrency(DATABASE_URL!, replayFixture, `matrix-${kind}-replay`);

        const conflictFixture = await setupRpcMatrixFixture(pg, kind);
        users.push(conflictFixture.userId);
        await runSameKeyConcurrency(
          DATABASE_URL!, conflictFixture, `matrix-${kind}-conflict`, randomUUID(),
        );
      }
    } finally {
      await cleanupMatrixUsers(pg, users);
      await pg.query("begin");
    }
  }, 90_000);

  test("reserve, redeem, correction, and refund different-key races have one winner and no loser audit", async () => {
    await pg.query("rollback");
    try {
      await raceDifferentKeys(DATABASE_URL!, USER_RESERVE,
        "select public.rpc_reserve_wish_credits($1, $2)",
        [WISH_RESERVE, "race-reserve-a"], [WISH_RESERVE, "race-reserve-b"]);
      await raceDifferentKeys(DATABASE_URL!, USER_REDEEM,
        "select public.rpc_redeem_wish($1, null, $2)",
        [WISH_REDEEM, "race-redeem-a"], [WISH_REDEEM, "race-redeem-b"]);
      await raceDifferentKeys(DATABASE_URL!, USER_CORRECT,
        "select public.rpc_correct_reward_transaction($1, null, $2)",
        [TX_CORRECT, "race-correct-a"], [TX_CORRECT, "race-correct-b"]);
      await raceDifferentKeys(DATABASE_URL!, USER_REFUND,
        "select public.rpc_refund_wish_redemption($1, null, $2)",
        [RECEIPT_REFUND, "race-refund-a"], [RECEIPT_REFUND, "race-refund-b"]);
      const residue = await pg.query<{ count: string }>(
        `select count(*)::text as count from public.outer_loop_audit_events
         where request_idempotency_key in ('race-reserve-b','race-redeem-b','race-correct-b','race-refund-b')`);
      expect(residue.rows[0]?.count).toBe("0");
    } finally {
      await pg.query("begin");
    }
  }, 30_000);
});
