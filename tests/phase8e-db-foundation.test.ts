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
    let completed = false;
    try {
      const result = await run();
      completed = true;
      return result;
    } finally {
      // A failed SQL statement leaves the transaction aborted until the
      // surrounding savepoint rollback. Reset only on success; the failure
      // helper rolls back SET ROLE and then explicitly resets the role.
      if (completed) await pg.query("reset role");
    }
  }

  async function asUser<T>(userId: string, run: () => Promise<T>): Promise<T> {
    return asRole("authenticated", userId, run);
  }

  async function expectDbFailure(
    run: () => Promise<unknown>,
    expectedCode?: string,
  ): Promise<void> {
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
    await pg.query("reset role");
    await pg.query(`release savepoint ${savepoint}`);
    expect(caught).toBeDefined();
    if (expectedCode) {
      expect(caught).toMatchObject({ code: expectedCode });
    }
  }

  async function expectDirectWriteDenied(args: {
    role: "anon" | "authenticated" | "service_role";
    userId: string | null;
    sql: string;
    params: unknown[];
  }): Promise<void> {
    // Role setup is deliberately outside the expected-failure savepoint. A
    // connection that cannot enter the requested role must fail the test here,
    // rather than letting SET ROLE's 42501 impersonate a table/RLS denial.
    await pg.query(`set role ${args.role}`);
    await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [args.userId ?? ""]);
    const identity = await pg.query<{ current_role: string; uid: string | null }>(
      "select current_user::text as current_role, auth.uid()::text as uid",
    );
    expect(identity.rows[0]).toEqual({
      current_role: args.role,
      uid: args.userId,
    });

    failureSequence += 1;
    const savepoint = `phase8e_direct_denial_${failureSequence}`;
    await pg.query(`savepoint ${savepoint}`);
    let caught: unknown;
    try {
      await pg.query(args.sql, args.params);
    } catch (error) {
      caught = error;
    }
    await pg.query(`rollback to savepoint ${savepoint}`);
    await pg.query(`release savepoint ${savepoint}`);
    await pg.query("reset role");

    expect(caught).toMatchObject({ code: "42501" });
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

    await expectDbFailure(
      () => asUser(USER_A, () => pg.query("update public.wishes set status = 'ACTIVE' where id = $1", [wish.id])),
      "42501",
    );

    // ACTIVE is the second positive path named by the controlling contract:
    // title/description/credit_cost stay editable while the Wish is IDEA or ACTIVE.
    await pg.query("update public.wishes set status = 'ACTIVE' where id = $1", [wish.id]);
    await asUser(USER_A, () =>
      pg.query("update public.wishes set title = 'Active edit', description = 'Still editable', credit_cost = 150 where id = $1", [wish.id]),
    );
    const activeEdited = await pg.query(
      "select title, description, credit_cost, status from public.wishes where id = $1",
      [wish.id],
    );
    expect(activeEdited.rows[0]).toMatchObject({
      title: "Active edit",
      description: "Still editable",
      credit_cost: 150,
      status: "ACTIVE",
    });

    // System timestamps are never client-writable, including in the otherwise
    // editable ACTIVE state, so the denial cannot be attributed to lifecycle.
    for (const column of ["created_at", "updated_at"]) {
      await expectDbFailure(
        () => asUser(USER_A, () =>
          pg.query(`update public.wishes set ${column} = clock_timestamp() where id = $1`, [wish.id])),
        "42501",
      );
    }

    // Known Round 2 precondition, recorded rather than endorsed: the frozen
    // contract allows exact credit_cost edits while IDEA/ACTIVE and the column is
    // nullable, so an owner can currently clear the cost on an ACTIVE Wish.
    // rpc_reserve_wish_credits / rpc_set_primary_wish must fail closed on a NULL
    // credit_cost instead of assuming "ACTIVE implies a positive cost".
    await asUser(USER_A, () =>
      pg.query("update public.wishes set credit_cost = null where id = $1", [wish.id]),
    );
    const clearedCost = await pg.query(
      "select credit_cost, status from public.wishes where id = $1",
      [wish.id],
    );
    expect(clearedCost.rows[0]).toEqual({ credit_cost: null, status: "ACTIVE" });
    await asUser(USER_A, () =>
      pg.query("update public.wishes set credit_cost = 150 where id = $1", [wish.id]),
    );

    // Past ACTIVE the same statement must fail loudly (SQLSTATE 42501) instead of
    // silently matching zero rows through the RLS USING clause, which would leave
    // the field-authority trigger unreachable and hand clients a no-op success.
    await pg.query("update public.wishes set status = 'PRIMARY' where id = $1", [wish.id]);
    await expectDbFailure(
      () => asUser(USER_A, () => pg.query("update public.wishes set title = 'Too late' where id = $1", [wish.id])),
      "42501",
    );
    const afterDenial = await pg.query(
      "select title, description, credit_cost, status from public.wishes where id = $1",
      [wish.id],
    );
    expect(afterDenial.rows[0]).toMatchObject({
      title: "Active edit",
      description: "Still editable",
      credit_cost: 150,
      status: "PRIMARY",
    });

    await expectDbFailure(
      () => asUser(USER_A, () =>
        pg.query("update public.wishes set cooldown_until = clock_timestamp() where id = $1", [wish.id])),
      "42501",
    );
    await expectDbFailure(
      () => asUser(USER_A, () => pg.query("delete from public.wishes where id = $1", [wish.id])),
      "42501",
    );
  });

  test("RLS isolates owner reads and anon/service-role direct writes stay denied", async () => {
    const account = await createAccount(USER_A);
    const wish = await createWish(USER_A, "Private wish");
    const otherView = await asUser(USER_B, () =>
      pg.query("select id from public.wishes where id = $1", [wish.id]),
    );
    expect(otherView.rows).toEqual([]);

    await pg.query("update public.wishes set status = 'REDEEMED' where id = $1", [wish.id]);
    const redeem = await pg.query<{ id: string }>(
      `insert into public.reward_transactions
         (account_id, user_id, event_kind, amount, canonical_source_type, canonical_source_id,
          request_idempotency_key)
       values ($1, $2, 'REDEEM', 100, 'WISH', $3, 'authority-fixture-redeem')
       returning id`,
      [account.id, USER_A, wish.id],
    );
    // Isolation fixture: an owner-side receipt must exist before the cross-tenant
    // read assertions below, otherwise "USER_B sees nothing" would be vacuous.
    const redemption = await pg.query<{ id: string }>(
      `insert into public.reward_redemptions
         (user_id, wish_id, transaction_id, credits_spent, celebration_note)
       values ($1, $2, $3, 100, 'isolation fixture')
       returning id`,
      [USER_A, wish.id, redeem.rows[0]!.id],
    );

    const countRows = async (): Promise<Record<string, number>> => {
      const result = await pg.query<{ table_name: string; row_count: number }>(
        `select 'reward_accounts'::text as table_name, count(*)::int as row_count
           from public.reward_accounts where user_id in ($1, $2)
         union all
         select 'reward_transactions', count(*)::int
           from public.reward_transactions where user_id in ($1, $2)
         union all
         select 'wishes', count(*)::int
           from public.wishes where user_id in ($1, $2)
         union all
         select 'reward_redemptions', count(*)::int
           from public.reward_redemptions where user_id in ($1, $2)`,
        [USER_A, USER_B],
      );
      return Object.fromEntries(result.rows.map((row) => [row.table_name, row.row_count]));
    };

    const before = await countRows();
    const directWrites = [
      {
        table: "reward_accounts",
        sql: "insert into public.reward_accounts (user_id) values ($1)",
        params: [USER_B],
      },
      {
        table: "reward_transactions",
        sql: `insert into public.reward_transactions
                (account_id, user_id, event_kind, amount, canonical_source_type,
                 canonical_source_id, policy_version, request_idempotency_key)
              values ($1, $2, 'EARN', 100, 'SEASON', 'authority-season',
                      'reward-v1', 'authority-direct-earn')`,
        params: [account.id, USER_A],
      },
      {
        table: "wishes",
        sql: "insert into public.wishes (user_id, title, description, credit_cost) values ($1, 'forbidden wish', '', 50)",
        params: [USER_A],
      },
      {
        table: "reward_redemptions",
        sql: `insert into public.reward_redemptions
                (user_id, wish_id, transaction_id, credits_spent, celebration_note)
              values ($1, $2, $3, 100, 'authority probe')`,
        params: [USER_A, wish.id, redeem.rows[0]!.id],
      },
    ];
    for (const role of ["anon", "service_role"] as const) {
      for (const write of directWrites) {
        await expectDirectWriteDenied({
          role,
          userId: role === "anon" ? null : USER_A,
          sql: write.sql,
          params: write.params,
        });
      }
    }

    for (const write of directWrites.filter((candidate) => candidate.table !== "wishes")) {
      await expectDirectWriteDenied({
        role: "authenticated",
        userId: USER_A,
        sql: write.sql,
        params: write.params,
      });
    }
    // Controlling §11 requires "RLS and explicit cross-tenant guards for all four
    // tables", so prove the isolation on the ledger and receipt tables too, not
    // only on the Wish read asserted at the top of this test.
    const crossTenantReads = [
      { table: "reward_accounts", sql: "select id from public.reward_accounts where id = $1", params: [account.id] },
      { table: "reward_transactions", sql: "select id from public.reward_transactions where id = $1", params: [redeem.rows[0]!.id] },
      { table: "wishes", sql: "select id from public.wishes where id = $1", params: [wish.id] },
      { table: "reward_redemptions", sql: "select id from public.reward_redemptions where id = $1", params: [redemption.rows[0]!.id] },
    ];
    for (const read of crossTenantReads) {
      // Positive control first: without it, "USER_B sees nothing" could pass
      // vacuously if the projection itself were broken.
      const ownRows = await asUser(USER_A, () => pg.query(read.sql, read.params));
      expect({ table: read.table, ownRows: ownRows.rows.length }).toEqual({ table: read.table, ownRows: 1 });
      const rows = await asUser(USER_B, () => pg.query(read.sql, read.params));
      expect({ table: read.table, visibleRows: rows.rows }).toEqual({ table: read.table, visibleRows: [] });
    }

    expect(await countRows()).toEqual(before);
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
