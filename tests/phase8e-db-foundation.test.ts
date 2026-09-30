import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { Client } from "pg";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;

const USER_A = "8e111111-aaaa-4000-a000-000000000001";
const USER_B = "8e222222-bbbb-4000-b000-000000000002";

describe.skipIf(!DATABASE_URL)("Phase 8E Round 1 — Reward/Wish DB foundation", () => {
  let pg: Client;
  let failureSequence = 0;

  async function asRole<T>(role: "anon" | "authenticated" | "service_role", userId: string | null, run: () => Promise<T>): Promise<T> {
    await pg.query(`set role ${role}`);
    await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
    try {
      return await run();
    } finally {
      await pg.query("reset role");
    }
  }

  async function asUser<T>(userId: string, run: () => Promise<T>): Promise<T> {
    return asRole("authenticated", userId, run);
  }

  async function expectDbFailure(run: () => Promise<unknown>): Promise<void> {
    failureSequence += 1;
    const savepoint = `phase8e_expected_failure_${failureSequence}`;
    await pg.query(`savepoint ${savepoint}`);
    let caught: unknown;
    try {
      await run();
    } catch (error) {
      caught = error;
    }
    await pg.query(`rollback to savepoint ${savepoint}`);
    await pg.query(`release savepoint ${savepoint}`);
    expect(caught).toBeDefined();
  }

  async function createAccount(userId: string): Promise<{ id: string }> {
    const result = await pg.query<{ id: string }>(
      "insert into public.reward_accounts (user_id) values ($1) returning id",
      [userId],
    );
    return result.rows[0]!;
  }

  async function createWish(userId: string, title: string): Promise<{ id: string }> {
    return asUser(userId, async () => {
      const result = await pg.query<{ id: string }>(
        `insert into public.wishes (user_id, title, description, credit_cost)
         values ($1, $2, 'round-1 wish', 100)
         returning id`,
        [userId, title],
      );
      return result.rows[0]!;
    });
  }

  beforeAll(async () => {
    pg = new Client({ connectionString: DATABASE_URL });
    await pg.connect();
    await pg.query("delete from auth.users where id in ($1, $2)", [USER_A, USER_B]);
    await pg.query(
      `insert into auth.users (id, email) values
         ($1, 'phase8e-a@example.test'),
         ($2, 'phase8e-b@example.test')`,
      [USER_A, USER_B],
    );
  }, 45000);

  beforeEach(async () => {
    failureSequence = 0;
    await pg.query("begin");
  });

  afterEach(async () => {
    await pg.query("rollback");
    await pg.query("reset role");
  });

  afterAll(async () => {
    if (!pg) return;
    await pg.query("delete from auth.users where id in ($1, $2)", [USER_A, USER_B]);
    await pg.end();
  });

  test("authenticated Wish creation is owner-bound and pinned to IDEA", async () => {
    const wish = await createWish(USER_A, "A wish");
    const ownRows = await asUser(USER_A, () =>
      pg.query<{ id: string; status: string; cooldown_until: Date | null }>(
        "select id, status, cooldown_until from public.wishes where id = $1",
        [wish.id],
      ),
    );
    expect(ownRows.rows).toEqual([{ id: wish.id, status: "IDEA", cooldown_until: null }]);

    await expectDbFailure(() =>
      asUser(USER_A, () =>
        pg.query(
          "insert into public.wishes (user_id, title, description, credit_cost) values ($1, 'forged owner', '', 10)",
          [USER_B],
        ),
      ),
    );
    await expectDbFailure(() =>
      asUser(USER_A, () =>
        pg.query(
          "insert into public.wishes (user_id, title, description, credit_cost, status) values ($1, 'forged state', '', 10, 'ACTIVE')",
          [USER_A],
        ),
      ),
    );
  });

  test("authenticated metadata edits are narrow and stop after ACTIVE", async () => {
    const wish = await createWish(USER_A, "Editable wish");
    await asUser(USER_A, () =>
      pg.query("update public.wishes set title = 'Edited', description = 'Allowed', credit_cost = 125 where id = $1", [wish.id]),
    );
    const edited = await pg.query(
      "select title, description, credit_cost, status from public.wishes where id = $1",
      [wish.id],
    );
    expect(edited.rows[0]).toMatchObject({
      title: "Edited",
      description: "Allowed",
      credit_cost: 125,
      status: "IDEA",
    });

    await expectDbFailure(() =>
      asUser(USER_A, () => pg.query("update public.wishes set status = 'ACTIVE' where id = $1", [wish.id])),
    );
    await pg.query("update public.wishes set status = 'PRIMARY' where id = $1", [wish.id]);
    await expectDbFailure(() =>
      asUser(USER_A, () => pg.query("update public.wishes set title = 'Too late' where id = $1", [wish.id])),
    );
    await expectDbFailure(() =>
      asUser(USER_A, () => pg.query("delete from public.wishes where id = $1", [wish.id])),
    );
  });

  test("RLS isolates owner reads and anon/service-role direct writes stay denied", async () => {
    const wish = await createWish(USER_A, "Private wish");
    const otherView = await asUser(USER_B, () =>
      pg.query("select id from public.wishes where id = $1", [wish.id]),
    );
    expect(otherView.rows).toEqual([]);

    const directWrites = [
      "insert into public.reward_accounts (user_id) values ($1)",
      "insert into public.reward_transactions (user_id) values ($1)",
      "insert into public.wishes (user_id, title) values ($1, 'forbidden wish')",
      "insert into public.reward_redemptions (user_id) values ($1)",
    ];
    for (const role of ["anon", "service_role"] as const) {
      for (const statement of directWrites) {
        await expectDbFailure(() =>
          asRole(role, role === "anon" ? null : USER_A, () => pg.query(statement, [USER_A])),
        );
      }
    }

    for (const statement of [directWrites[0], directWrites[1], directWrites[3]]) {
      await expectDbFailure(() => asUser(USER_A, () => pg.query(statement, [USER_A])));
    }
  });

  test("ledger constraints and tenant triggers reject malformed or cross-tenant rows", async () => {
    const accountA = await createAccount(USER_A);
    const accountB = await createAccount(USER_B);
    const wishB = await createWish(USER_B, "B wish");

    await expectDbFailure(() =>
      pg.query(
        `insert into public.reward_transactions
           (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
            policy_version, request_idempotency_key)
         values ($1, $2, 'EARN', 100, 'SEASON', 'season-a', 'reward-v1', 'cross-tenant')`,
        [accountB.id, USER_A],
      ),
    );
    await expectDbFailure(() =>
      pg.query(
        `insert into public.reward_transactions
           (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
            request_idempotency_key)
         values ($1, $2, 'RESERVE', 10, 'WISH', $3, 'cross-tenant-wish')`,
        [accountA.id, USER_A, wishB.id],
      ),
    );
    await expectDbFailure(() =>
      pg.query(
        `insert into public.reward_transactions
           (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
            policy_version, request_idempotency_key)
         values ($1, $2, 'EARN', 0, 'SEASON', 'season-a', 'reward-v1', 'zero-earn')`,
        [accountA.id, USER_A],
      ),
    );

    const earn = await pg.query<{ id: string }>(
      `insert into public.reward_transactions
         (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
          policy_version, request_idempotency_key)
       values ($1, $2, 'EARN', 100, 'SEASON', 'season-a', 'reward-v1', 'earn-a')
       returning id`,
      [accountA.id, USER_A],
    );
    await expectDbFailure(() =>
      pg.query(
        `insert into public.reward_transactions
           (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
            policy_version, request_idempotency_key, correction_for_id)
         values ($1, $2, 'CORRECTION', -100, 'SEASON', 'season-a', 'reward-v1', 'wrong-account-correction', $3)`,
        [accountB.id, USER_B, earn.rows[0]!.id],
      ),
    );
  });

  test("ledger and redemption rows are immutable and redemption references must agree", async () => {
    const account = await createAccount(USER_A);
    const wish = await createWish(USER_A, "Redeem me");
    await pg.query("update public.wishes set status = 'REDEEMED' where id = $1", [wish.id]);
    const redeem = await pg.query<{ id: string }>(
      `insert into public.reward_transactions
         (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
          request_idempotency_key)
       values ($1, $2, 'REDEEM', 100, 'WISH', $3, 'redeem-a')
       returning id`,
      [account.id, USER_A, wish.id],
    );
    const receipt = await pg.query<{ id: string }>(
      `insert into public.reward_redemptions
         (user_id, wish_id, transaction_id, credits_spent, celebration_note)
       values ($1, $2, $3, 100, 'done')
       returning id`,
      [USER_A, wish.id, redeem.rows[0]!.id],
    );

    await expectDbFailure(() =>
      pg.query(
        `insert into public.reward_transactions
           (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
            request_idempotency_key, refund_for_redemption_id)
         values ($1, $2, 'REFUND', 1, 'WISH', $3, 'partial-refund', $4)`,
        [account.id, USER_A, wish.id, receipt.rows[0]!.id],
      ),
    );
    await pg.query(
      `insert into public.reward_transactions
         (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
          request_idempotency_key, refund_for_redemption_id)
       values ($1, $2, 'REFUND', 100, 'WISH', $3, 'exact-refund', $4)`,
      [account.id, USER_A, wish.id, receipt.rows[0]!.id],
    );
    await expectDbFailure(() =>
      pg.query(
        `insert into public.reward_transactions
           (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
            request_idempotency_key, refund_for_redemption_id)
         values ($1, $2, 'REFUND', 100, 'WISH', $3, 'duplicate-refund', $4)`,
        [account.id, USER_A, wish.id, receipt.rows[0]!.id],
      ),
    );

    await expectDbFailure(() =>
      pg.query("update public.reward_transactions set note = 'rewrite' where id = $1", [redeem.rows[0]!.id]),
    );
    await expectDbFailure(() =>
      pg.query("delete from public.reward_transactions where id = $1", [redeem.rows[0]!.id]),
    );
    await expectDbFailure(() =>
      pg.query("update public.reward_redemptions set celebration_note = 'rewrite' where id = $1", [receipt.rows[0]!.id]),
    );
    await expectDbFailure(() =>
      pg.query("delete from public.reward_redemptions where id = $1", [receipt.rows[0]!.id]),
    );
  });

  test("one account, one selected Wish, canonical EARN, and exact correction identities are unique", async () => {
    const account = await createAccount(USER_A);
    await expectDbFailure(() => createAccount(USER_A));

    const first = await createWish(USER_A, "Primary one");
    const second = await createWish(USER_A, "Primary two");
    await pg.query("update public.wishes set status = 'PRIMARY' where id = $1", [first.id]);
    await expectDbFailure(() =>
      pg.query("update public.wishes set status = 'RESERVED' where id = $1", [second.id]),
    );

    const earn = await pg.query<{ id: string }>(
      `insert into public.reward_transactions
         (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
          policy_version, request_idempotency_key)
       values ($1, $2, 'EARN', 100, 'QUEST', 'quest-a', 'reward-v1', 'earn-one')
       returning id`,
      [account.id, USER_A],
    );
    await expectDbFailure(() =>
      pg.query(
        `insert into public.reward_transactions
           (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
            policy_version, request_idempotency_key)
         values ($1, $2, 'EARN', 100, 'QUEST', 'quest-a', 'reward-v1', 'earn-two')`,
        [account.id, USER_A],
      ),
    );
    await expectDbFailure(() =>
      pg.query(
        `insert into public.reward_transactions
           (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
            policy_version, request_idempotency_key, correction_for_id)
         values ($1, $2, 'CORRECTION', -1, 'QUEST', 'quest-a', 'reward-v1', 'partial-correction', $3)`,
        [account.id, USER_A, earn.rows[0]!.id],
      ),
    );
    await pg.query(
      `insert into public.reward_transactions
         (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
          policy_version, request_idempotency_key, correction_for_id)
       values ($1, $2, 'CORRECTION', -100, 'QUEST', 'quest-a', 'reward-v1', 'exact-correction', $3)`,
      [account.id, USER_A, earn.rows[0]!.id],
    );
    await expectDbFailure(() =>
      pg.query(
        `insert into public.reward_transactions
           (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
            policy_version, request_idempotency_key, correction_for_id)
         values ($1, $2, 'CORRECTION', -100, 'QUEST', 'quest-a', 'reward-v1', 'duplicate-correction', $3)`,
        [account.id, USER_A, earn.rows[0]!.id],
      ),
    );
  });
});
