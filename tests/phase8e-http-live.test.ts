import http from "node:http";
import { randomUUID } from "node:crypto";
import next from "next";
import { createServerClient } from "@supabase/ssr";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { foldRewardLedger, type RewardLedgerState } from "@/lib/reward/fold";
import type { RewardAccount, RewardRedemption, RewardResult, RewardSourceCandidate, RewardTransaction, Wish } from "@/lib/reward/types";

const databaseUrl = process.env.XP_RPG_TEST_DB_URL;
type Actor = { id: string; cookie: string };
type Payload = RewardResult & {
  wish: Wish; transaction: RewardTransaction; redemption: RewardRedemption;
  account: RewardAccount | null; balance: RewardLedgerState; code: string;
  wishes: Wish[]; transactions: RewardTransaction[]; sources: RewardSourceCandidate[];
  proposals: Array<{ id: string; status: string }>;
  redemptions: Array<RewardRedemption & { refunded: boolean }>; nextOffset: number | null;
};

describe.skipIf(!databaseUrl)("Phase 8E Round 3 — real Next/Auth/PostgreSQL HTTP", () => {
  const pg = new Client({ connectionString: databaseUrl });
  let app: ReturnType<typeof next>;
  let server: http.Server;
  let base: string;
  let a: Actor;
  let b: Actor;
  let foreignWish: string;
  let foreignQuest: string;
  let foreignTransaction: string;
  let foreignReceipt: string;
  const users: string[] = [];

  async function actor(): Promise<Actor> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Real HTTP tests require Supabase URL and publishable key");
    const jar = new Map<string, string>();
    const client = createServerClient(url, key, { cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: cookies => {
        for (const c of cookies) {
          if (c.value) jar.set(c.name, c.value);
          else jar.delete(c.name);
        }
      },
    } });
    const credentials = { email: `phase8e-http-${randomUUID()}@example.test`, password: `R3-test-${randomUUID()}!` };
    const { data, error } = await client.auth.signUp(credentials);
    expect(error).toBeNull();
    if (!data.user) throw new Error("Test user creation failed");
    users.push(data.user.id);
    if (!data.session) expect((await client.auth.signInWithPassword(credentials)).error).toBeNull();
    expect(jar.size).toBeGreaterThan(0);
    return { id: data.user.id, cookie: [...jar].map(([n, v]) => `${n}=${v}`).join("; ") };
  }
  async function call(who: Actor | null, path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
    const response = await fetch(`${base}${path}`, {
      method, redirect: "manual",
      headers: { ...(who ? { Cookie: who.cookie } : {}), "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json() as Payload;
    return { response, status: response.status, body: payload };
  }
  async function quest(who: Actor, size = "major", boss = false) {
    const id = randomUUID();
    await pg.query(`insert into public.quests (id,user_id,title,quest_type,quest_size,status,is_boss,completed_at)
      values ($1,$2,'HTTP source','skill',$3,'completed',$4,clock_timestamp())`, [id, who.id, size, boss]);
    return id;
  }
  async function earn(who: Actor, sourceId?: string) {
    const result = await call(who, "/api/rewards/grants", {
      sourceType: "QUEST", sourceId: sourceId ?? await quest(who), policyVersion: "reward-v1", requestIdempotencyKey: randomUUID(),
    });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    return result.body.transaction;
  }
  async function newWish(who: Actor, cost: number | null = 50) {
    const result = await call(who, "/api/rewards/wishes", { title: "HTTP 心愿", creditCost: cost });
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    return result.body.wish;
  }
  async function transition(who: Actor, id: string, action: string) {
    const result = await call(who, `/api/rewards/wishes/${id}/${action}`, { requestIdempotencyKey: randomUUID() });
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    return result.body;
  }
  async function prepareWish(who: Actor, status: "IDEA" | "ACTIVE" | "PRIMARY" | "RESERVED" | "REDEEMED" = "IDEA") {
    const wish = await newWish(who);
    let result: RewardResult = { ok: true, replayed: false, wish };
    const states = ["IDEA", "ACTIVE", "PRIMARY", "RESERVED", "REDEEMED"];
    const actions = ["activate", "set-primary", "reserve", "redeem"];
    for (let i = 0; i < states.indexOf(status); i++) result = await transition(who, wish.id, actions[i]);
    return result;
  }
  async function snapshot(who: Actor) {
    const result: Record<string, unknown> = {};
    for (const table of ["wishes", "reward_accounts", "reward_transactions", "reward_redemptions", "outer_loop_audit_events", "xp_transactions", "player_states"]) {
      const rows = await pg.query(`select to_jsonb(t) as row from public.${table} t where user_id=$1 order by to_jsonb(t)::text`, [who.id]);
      result[table] = rows.rows.map(r => r.row);
    }
    return result;
  }
  async function parity(who: Actor) {
    const ledger = await pg.query("select * from reward_transactions where user_id=$1 order by created_at,id", [who.id]);
    const actual = await call(who, "/api/rewards/account");
    expect(actual.status).toBe(200);
    expect(actual.body.balance).toEqual(foldRewardLedger(ledger.rows));
  }

  beforeAll(async () => {
    await pg.connect();
    app = next({ dev: false, hostname: "127.0.0.1", dir: process.cwd() });
    await app.prepare();
    const handle = app.getRequestHandler();
    server = http.createServer((req, res) => handle(req, res));
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");
    base = `http://127.0.0.1:${address.port}`;
    b = await actor();
    foreignQuest = await quest(b);
    foreignTransaction = (await earn(b, foreignQuest)).id;
    const result = await prepareWish(b, "REDEEMED");
    foreignWish = result.wish!.id;
    foreignReceipt = result.redemption!.id;
  }, 60000);
  beforeEach(async () => { a = await actor(); });
  afterAll(async () => {
    if (server) {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
    if (app) await app.close();
    // Remove ONLY this run's random test users and rows. No persistent trigger changes.
    if (users.length) {
      await pg.query("begin");
      try {
        await pg.query("set local session_replication_role = replica");
        for (const table of ["reward_redemptions", "reward_transactions", "reward_accounts", "wishes", "outer_loop_audit_events", "outer_loop_proposals", "season_reviews", "seasons", "mastery_verifications", "skills", "domains", "quests"]) {
          await pg.query(`delete from public.${table} where user_id = any($1::uuid[])`, [users]);
        }
        await pg.query("set local session_replication_role = origin");
        await pg.query("delete from auth.users where id = any($1::uuid[]) and email like 'phase8e-http-%@example.test'", [users]);
        await pg.query("commit");
      } catch (error) { await pg.query("rollback"); throw error; }
    }
    await pg.end();
  }, 30000);

  test("anonymous endpoints reject, tenant reads are isolated, reads never create accounts", async () => {
    const before = await snapshot(a);
    for (const path of ["account", "transactions", "redemptions", "wishes", "sources?sourceType=QUEST", `wishes/${foreignWish}`, `wishes/${foreignWish}/proposals`]) {
      expect((await call(null, `/api/rewards/${path}`)).status).toBe(401);
    }
    for (const path of ["grants", "wishes", ...["activate", "set-primary", "reserve", "unreserve", "redeem", "archive", "cancel"].map(x => `wishes/${foreignWish}/${x}`), `transactions/${foreignTransaction}/correct`, `redemptions/${foreignReceipt}/refund`]) {
      expect((await call(null, `/api/rewards/${path}`, {})).status).toBe(401);
    }
    const account = await call(a, "/api/rewards/account");
    expect(account.body.account).toBeNull();
    expect(account.body.balance).toEqual(foldRewardLedger([]));
    expect(account.response.headers.get("cache-control")).toBe("private, no-store");
    for (const collection of ["wishes", "transactions", "redemptions"]) {
      expect((await call(a, `/api/rewards/${collection}`)).body[collection as "wishes"]).toEqual([]);
      expect((await call(b, `/api/rewards/${collection}`)).body[collection as "wishes"].length).toBeGreaterThan(0);
    }
    expect((await call(a, `/api/rewards/wishes/${foreignWish}`)).status).toBe(404);
    expect((await call(a, `/api/rewards/wishes/${foreignWish}/proposals`)).status).toBe(404);
    expect(await snapshot(a)).toEqual(before);
  });

  test("metadata is field-scoped, priced activation and lifecycle immutability enforced", async () => {
    const wish = await newWish(a, null);
    const before = await snapshot(a);
    for (const body of [{ status: "ACTIVE" }, { user_id: b.id }, { creditCost: -1 }, { created_at: "2020-01-01" }]) {
      expect((await call(a, `/api/rewards/wishes/${wish.id}`, body, "PATCH")).status).toBe(400);
    }
    expect((await call(a, `/api/rewards/wishes/${wish.id}/activate`, { requestIdempotencyKey: randomUUID() })).status).toBe(400);
    expect((await call(a, `/api/rewards/wishes/${foreignWish}`, { title: "forged" }, "PATCH")).status).toBe(404);
    expect(await snapshot(a)).toEqual(before);
    expect((await call(a, `/api/rewards/wishes/${wish.id}`, { title: "  校准  ", creditCost: 75 }, "PATCH")).body.wish.title).toBe("校准");
    await transition(a, wish.id, "activate");
    expect((await call(a, `/api/rewards/wishes/${wish.id}`, { creditCost: 50 }, "PATCH")).status).toBe(200);
    await transition(a, wish.id, "set-primary");
    const primary = await snapshot(a);
    expect((await call(a, `/api/rewards/wishes/${wish.id}`, { creditCost: 1 }, "PATCH")).status).toBe(403);
    expect(await snapshot(a)).toEqual(primary);
    await parity(a);
  });

  test("farming and deferred sources commit only one durable rejection; forged amount commits nothing", async () => {
    const empty = await snapshot(a);
    expect((await call(a, "/api/rewards/grants", { sourceType: "QUEST", sourceId: foreignQuest, policyVersion: "reward-v1", amount: 999, requestIdempotencyKey: randomUUID() })).status).toBe(400);
    expect(await snapshot(a)).toEqual(empty);
    for (const type of ["MICRO_ACTIVITY", "DAILY_LOGIN", "ARTIFACT", "REAL_WORLD_VERIFIED"]) {
      const body = { sourceType: type, sourceId: "unsupported", policyVersion: "reward-v1", requestIdempotencyKey: randomUUID() };
      const first = await call(a, "/api/rewards/grants", body);
      const snap = await snapshot(a);
      const replay = await call(a, "/api/rewards/grants", body);
      expect(first.status).toBe(type === "ARTIFACT" || type === "REAL_WORLD_VERIFIED" ? 422 : 400);
      expect(replay.status).toBe(first.status);
      expect(replay.body).toEqual({ ...first.body, replayed: true });
      expect(await snapshot(a)).toEqual(snap);
    }
    const after = await snapshot(a);
    expect(after.reward_transactions).toEqual([]); expect(after.reward_accounts).toEqual([]);
    expect(after.outer_loop_audit_events).toHaveLength(4);
  });

  test.each(["grant", "correct", "activate", "set-primary", "reserve", "unreserve", "redeem", "refund", "archive", "cancel"])("%s HTTP replay/conflict/foreign-target authority", async name => {
    let target: string;
    let foreignTarget: string;
    let path: (id: string) => string;
    let body: Record<string, unknown> = { requestIdempotencyKey: randomUUID() };
    if (name === "grant") {
      target = await quest(a); foreignTarget = foreignQuest;
      path = () => "/api/rewards/grants";
      body = { ...body, sourceType: "QUEST", sourceId: target, policyVersion: "reward-v1" };
    } else if (name === "correct") {
      target = (await earn(a)).id; foreignTarget = foreignTransaction;
      path = id => `/api/rewards/transactions/${id}/correct`; body.note = "错误来源纠正";
    } else if (name === "refund") {
      await earn(a);
      target = (await prepareWish(a, "REDEEMED")).redemption!.id; foreignTarget = foreignReceipt;
      path = id => `/api/rewards/redemptions/${id}/refund`; body.note = "未实际消费";
    } else {
      if (["reserve", "unreserve", "redeem"].includes(name)) await earn(a);
      const state = name === "set-primary" ? "ACTIVE" : name === "reserve" ? "PRIMARY"
        : ["unreserve", "redeem"].includes(name) ? "RESERVED" : ["archive", "cancel"].includes(name) ? "PRIMARY" : "IDEA";
      target = (await prepareWish(a, state)).wish!.id; foreignTarget = foreignWish;
      path = id => `/api/rewards/wishes/${id}/${name}`;
    }
    const start = await snapshot(a);
    const otherBefore = await snapshot(b);
    const cross = { ...body, requestIdempotencyKey: randomUUID(), ...(name === "grant" ? { sourceId: foreignTarget } : {}) };
    expect((await call(a, path(foreignTarget), cross)).status).toBe(404);
    expect(await snapshot(a)).toEqual(start); expect(await snapshot(b)).toEqual(otherBefore);
    const first = await call(a, path(target), body);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const settled = await snapshot(a);
    const repeats = await Promise.all([call(a, path(target), body), call(a, path(target), body)]);
    for (const replay of repeats) {
      expect(replay.status).toBe(200); expect(replay.body).toEqual({ ...first.body, replayed: true });
    }
    const conflict = await call(a, path(foreignTarget), { ...body, ...(name === "grant" ? { sourceId: foreignTarget } : {}) });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect((await call(a, path(target), { ...body, requestIdempotencyKey: randomUUID() })).status).toBe(409);
    expect(await snapshot(a)).toEqual(settled); expect(await snapshot(b)).toEqual(otherBefore);
    expect((settled.outer_loop_audit_events as unknown[]).length).toBe((start.outer_loop_audit_events as unknown[]).length + 1);
    const financial = ["grant", "correct", "reserve", "unreserve", "redeem", "refund"].includes(name);
    expect((settled.reward_transactions as unknown[]).length).toBe((start.reward_transactions as unknown[]).length + Number(financial));
    expect(settled.xp_transactions).toEqual(start.xp_transactions); expect(settled.player_states).toEqual(start.player_states);
    if (!financial) expect(settled.reward_accounts).toEqual(start.reward_accounts);
    await parity(a);
  });

  test("redemption/correction/refund preserve receipt, deficit, cooldown and history", async () => {
    const earned = await earn(a);
    const redeemed = await prepareWish(a, "REDEEMED");
    const receipt = redeemed.redemption!;
    expect((await call(a, `/api/rewards/transactions/${earned.id}/correct`, { note: "纠错", requestIdempotencyKey: randomUUID() })).status).toBe(200);
    expect((await call(a, "/api/rewards/account")).body.balance).toMatchObject({ current_available: 0, correction_deficit: 50, net_earned: 0 });
    await parity(a);
    const beforeRefund = await call(a, "/api/rewards/redemptions");
    expect(beforeRefund.body.redemptions[0].refunded).toBe(false);
    expect((await call(a, `/api/rewards/redemptions/${receipt.id}/refund`, { note: "返还", requestIdempotencyKey: randomUUID() })).status).toBe(200);
    const afterRefund = (await call(a, "/api/rewards/redemptions")).body.redemptions[0];
    expect(afterRefund).toEqual({ ...beforeRefund.body.redemptions[0], refunded: true });
    expect((await call(a, `/api/rewards/wishes/${redeemed.wish!.id}`)).body.wish.status).toBe("REDEEMED");
    await earn(a);
    const primary = (await prepareWish(a, "PRIMARY")).wish!;
    const before = await snapshot(a);
    const cooldown = await call(a, `/api/rewards/wishes/${primary.id}/reserve`, { requestIdempotencyKey: randomUUID() });
    expect(cooldown.status).toBe(422); expect(cooldown.body.code).toBe("REDEMPTION_COOLDOWN_ACTIVE");
    expect(await snapshot(a)).toEqual(before);
    const pages = await call(a, "/api/rewards/transactions?limit=2");
    const page2 = await call(a, `/api/rewards/transactions?limit=2&offset=${pages.body.nextOffset}`);
    expect(pages.body.transactions).toHaveLength(2); expect(page2.body.transactions).toHaveLength(2);
    expect(new Set([...pages.body.transactions, ...page2.body.transactions].map(r => r.id)).size).toBe(4);
    await parity(a);
  });

  test("source discovery is tenant-bound and all frozen v1 tiers are decided by SQL", async () => {
    const expectedQuests: string[] = [];
    for (const [size, boss, amount] of [["major", false, 100], ["epic", false, 150], ["main", false, 200], ["major", true, 200]] as const) {
      const id = await quest(a, size, boss);
      expectedQuests.push(id);
      expect((await earn(a, id)).amount).toBe(amount);
    }
    const sources = await call(a, "/api/rewards/sources?sourceType=QUEST&limit=2");
    expect(sources.status, JSON.stringify(sources.body)).toBe(200);
    expect(sources.body.sources).toHaveLength(2);
    expect(sources.body.sources.every(s => s.alreadyGranted && s.sourceId !== foreignQuest)).toBe(true);
    const nextPage = await call(a, `/api/rewards/sources?sourceType=QUEST&limit=2&offset=${sources.body.nextOffset}`);
    expect(nextPage.status).toBe(200);
    expect(nextPage.body.nextOffset).toBeNull();
    expect([...sources.body.sources, ...nextPage.body.sources].map(s => s.sourceId).sort()).toEqual(expectedQuests.sort());
    const seasonId = randomUUID();
    await pg.query("insert into seasons(id,user_id,name,status,started_at,ended_at) values($1,$2,'HTTP Season','COMPLETED',now()-interval '10 days',now())", [seasonId, a.id]);
    await pg.query(`insert into season_reviews(user_id,season_id,review_type,version,commit_key,period_start,period_end,objective_summary,qualitative_reflection,criteria_evaluation)
      values($1,$2,'FINAL',1,gen_random_uuid(),now()-interval '10 days',now(),'{}','verified','{}')`, [a.id, seasonId]);
    expect((await call(a, "/api/rewards/sources?sourceType=SEASON")).body.sources[0].sourceId).toBe(seasonId);
    expect((await call(a, "/api/rewards/grants", { sourceType: "SEASON", sourceId: seasonId, policyVersion: "reward-v1", requestIdempotencyKey: randomUUID() })).body.transaction.amount).toBe(150);
    const domain = randomUUID(); const skill = randomUUID();
    await pg.query("insert into domains(id,user_id,name,slug) values($1,$2,'HTTP Domain',$3)", [domain, a.id, domain]);
    await pg.query("insert into skills(id,user_id,domain_id,name) values($1,$2,$3,'HTTP Skill')", [skill, a.id, domain]);
    for (const [threshold, amount] of [[6, 100], [8, 150], [10, 250]]) {
      await pg.query(`insert into mastery_verifications(user_id,skill_id,skill_name,from_level,to_level,evidence_level,status,resolved_at)
        values($1,$2,'HTTP Skill',$3-1,$3,6,'verified',now())`, [a.id, skill, threshold]);
      const result = await call(a, "/api/rewards/grants", { sourceType: "MASTERY", sourceId: `${skill}:M${threshold}`, policyVersion: "reward-v1", requestIdempotencyKey: randomUUID() });
      expect(result.status, JSON.stringify(result.body)).toBe(200); expect(result.body.transaction.amount).toBe(amount);
    }
    expect((await call(a, "/api/rewards/sources?sourceType=MASTERY")).body.sources).toHaveLength(3);
    await parity(a);
  });

  test("Wish cost proposals use the existing review endpoint without earning or growth mutation", async () => {
    const wish = await newWish(a, null); const proposal = randomUUID();
    await pg.query(`insert into outer_loop_proposals(id,user_id,proposal_type,schema_version,payload)
      values($1,$2,'WISH_COST_SUGGESTION',1,jsonb_build_object('wish_id',$3::text,'suggested_credits',75,'rationale','test'))`, [proposal, a.id, wish.id]);
    const listed = await call(a, `/api/rewards/wishes/${wish.id}/proposals`);
    expect(listed.status, JSON.stringify(listed.body)).toBe(200);
    expect(listed.body).toMatchObject({ proposals: [{ id: proposal, status: "PROPOSED" }] });
    const upperListed = await call(a, `/api/rewards/wishes/${wish.id.toUpperCase()}/proposals`);
    expect(upperListed.status).toBe(200);
    expect(upperListed.body).toEqual(listed.body);
    // JSON proposals may retain uppercase UUID text; tenant/target scoping still holds.
    const uppercaseProposal = randomUUID();
    await pg.query(`insert into outer_loop_proposals(id,user_id,proposal_type,schema_version,payload)
      values($1,$2,'WISH_COST_SUGGESTION',1,jsonb_build_object('wish_id',$3::text,'suggested_credits',75,'rationale','uppercase fixture'))`, [uppercaseProposal, a.id, wish.id.toUpperCase()]);
    const payloadUpper = await call(a, `/api/rewards/wishes/${wish.id}/proposals`);
    expect(payloadUpper.status).toBe(200);
    expect(payloadUpper.body.proposals.map(p => p.id).sort()).toEqual([proposal, uppercaseProposal].sort());
    expect((await call(b, `/api/rewards/wishes/${wish.id.toUpperCase()}/proposals`)).status).toBe(404);
    const before = await snapshot(a);
    expect((await call(b, `/api/outer-loop/proposals/${proposal}/review`, { decision: "ACCEPTED", reviewRequestIdempotencyKey: randomUUID() })).status).toBe(404);
    const review = { decision: "ACCEPTED", reviewRequestIdempotencyKey: randomUUID() };
    expect((await call(a, `/api/outer-loop/proposals/${proposal}/review`, review)).status).toBe(200);
    expect((await call(a, `/api/outer-loop/proposals/${proposal}/review`, review)).status).toBe(200);
    expect((await call(a, `/api/outer-loop/proposals/${uppercaseProposal}/review`, {
      decision: "ACCEPTED", reviewRequestIdempotencyKey: randomUUID(),
    })).status).toBe(200);
    expect((await call(a, `/api/rewards/wishes/${wish.id}`)).body.wish).toMatchObject({ status: "IDEA", credit_cost: 75 });
    const after = await snapshot(a);
    for (const table of ["reward_accounts", "reward_transactions", "reward_redemptions", "xp_transactions", "player_states"]) expect(after[table]).toEqual(before[table]);
  });

  test("equivalent UUID source spellings cannot mint twice and replay the same normalized request", async () => {
    const sourceId = await quest(a);
    const body = { sourceType: "QUEST", sourceId, policyVersion: "reward-v1", requestIdempotencyKey: randomUUID() };
    const first = await call(a, "/api/rewards/grants", body);
    expect(first.status).toBe(200);
    const settled = await snapshot(a);
    for (const variant of [sourceId.toUpperCase(), sourceId.replaceAll("-", ""), `{${sourceId.toUpperCase()}}`]) {
      const replay = await call(a, "/api/rewards/grants", { ...body, sourceId: variant });
      expect(replay.status, variant).toBe(200);
      expect(replay.body).toEqual({ ...first.body, replayed: true });
      const duplicate = await call(a, "/api/rewards/grants", { ...body, sourceId: variant, requestIdempotencyKey: randomUUID() });
      expect(duplicate.status, variant).toBe(409);
      expect(duplicate.body.code).toBe("REWARD_SOURCE_ALREADY_GRANTED");
      expect(await snapshot(a)).toEqual(settled);
    }
  });
});
