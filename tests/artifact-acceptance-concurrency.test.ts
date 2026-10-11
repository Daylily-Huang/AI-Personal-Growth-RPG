import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Client, type QueryResult } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const dbUrl = process.env.XP_RPG_TEST_DB_URL;
const acceptSQL = "select public.rpc_accept_artifact_manual($1,$2,$3,$4) r";
const revokeSQL = "select public.rpc_revoke_artifact_manual($1,$2,$3) r";
type Outcome = { result: QueryResult; error?: never } | { error: { message: string; code: string }; result?: never };
const observed = (promise: Promise<QueryResult>): Promise<Outcome> => promise.then(result => ({ result }), error => ({ error }));
function ownership() {
  const endpoint = new URL(dbUrl!); if (!["localhost", "127.0.0.1"].includes(endpoint.hostname)) throw Error("Local synthetic endpoint required");
  if (process.env.GITHUB_ACTIONS === "true") return;
  if (endpoint.port !== "54332" || process.env.XP_RPG_DISPOSABLE_TEST_STACK !== "phase8f_test_artifact_20261012") throw Error("Artifact disposable stack required");
  const receipt = JSON.parse(readFileSync(process.env.XP_RPG_ARTIFACT_CREATION_RECEIPT!, "utf8")); expect(receipt.project).toBe(process.env.XP_RPG_DISPOSABLE_TEST_STACK);
  expect(receipt.containers).toHaveLength(4);
  for (const part of ["db", "auth", "rest", "kong"]) {
    const actual = JSON.parse(execFileSync("docker", ["inspect", `supabase_${part}_${receipt.project}`], { encoding: "utf8" }))[0], original = receipt.containers.find((x: { component: string }) => x.component === part);
    expect(actual.Id).toBe(original.id); expect(actual.Created).toBe(original.created); expect(actual.State.Running).toBe(true);
    expect(actual.Config.Labels["com.supabase.cli.project"]).toBe(receipt.project); expect(actual.Config.Labels["com.supabase.cli.workdir"]).toBe(receipt.stack);
    if (part === "db" || part === "kong") expect(actual.HostConfig.PortBindings[part === "db" ? "5432/tcp" : "8000/tcp"].every((p: { HostPort: string }) => p.HostPort === (part === "db" ? "54332" : "54331"))).toBe(true);
  }
}
describe.skipIf(!dbUrl)("0056 actual concurrent account/key/source locks (owned disposable fixtures)", () => {
  const pg = new Client({ connectionString: dbUrl }), clients: Client[] = [];
  let connected = false, owner: string, other: string, artifact: string, second: string, quest: string;
  let baseline: Record<string, unknown[]>;
  let stamp = "2026-10-12T01:02:03.123456Z";
  const args = (key = randomUUID(), target = artifact, note = "Manual race acceptance") => [target, stamp, note, key];
  async function peer(who = owner) {
    const client = new Client({ connectionString: dbUrl }); await client.connect(); clients.push(client);
    await client.query("begin"); await client.query("set local lock_timeout='4s'"); await client.query("set local role authenticated"); await client.query("select set_config('request.jwt.claim.sub',$1,true)", [who]);
    return { client, pid: (await client.query("select pg_backend_pid() id")).rows[0].id };
  }
  async function waiting(pid: number) {
    for (let n = 0; n < 100; n++) {
      if ((await pg.query("select exists(select 1 from pg_locks where pid=$1 and not granted) v", [pid])).rows[0].v) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw Error("Actual PostgreSQL lock waiter required");
  }
  async function core() {
    const value: Record<string, unknown[]> = {};
    for (const table of ["profiles", "player_states", "skills", "activities", "ai_assessments", "xp_transactions", "artifacts", "quests", "wishes", "reward_redemptions"])
      value[table] = (await pg.query(`select to_jsonb(t) r from public.${table} t where user_id=any($1::uuid[]) order by to_jsonb(t)::text`, [[owner, other]])).rows.map(x => x.r);
    return value;
  }
  async function ledger(expectedEarn: number, expectedCorrection: number) {
    expect((await pg.query("select count(*) filter(where event_kind='EARN')::int e,count(*) filter(where event_kind='CORRECTION')::int c from public.reward_transactions where user_id=$1 and canonical_source_type='ARTIFACT'", [owner])).rows[0]).toEqual({ e: expectedEarn, c: expectedCorrection });
    const cache = (await pg.query("select to_jsonb(a) r,public.phase8e_preview_reward_account(id,user_id,updated_at) f from public.reward_accounts a where user_id=$1", [owner])).rows[0];
    expect(cache.r).toEqual(cache.f); expect(await core()).toEqual(baseline);
  }
  beforeAll(async () => { ownership(); await pg.connect(); connected = true; });
  beforeEach(async () => {
    owner = randomUUID(); other = randomUUID(); artifact = randomUUID(); second = randomUUID(); quest = randomUUID();
    await pg.query("begin");
    try {
      for (const who of [owner, other]) {
        const activity = randomUUID(), assessment = randomUUID(), skill = randomUUID();
        await pg.query("insert into auth.users(id,email) values($1,$2)", [who, `${who}@example.test`]);
        await pg.query("insert into public.skills(id,user_id,name,xp,level,mastery_level,status) values($1,$2,'Existing race skill',500,4,0,'active')", [skill, who]);
        await pg.query("insert into public.activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Existing','Existing','confirmed','race-existing')", [activity, who]);
        await pg.query("insert into public.ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json) values($1,$2,$3,'confirmed','race-existing','{}')", [assessment, who, activity]);
        await pg.query("insert into public.xp_transactions(user_id,activity_id,assessment_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,500,500,'race-existing','Existing race skill')", [who, activity, assessment, skill]);
        await pg.query("update public.player_states set total_xp=500,player_level=4 where user_id=$1", [who]);
      }
      await pg.query("insert into public.artifacts(id,user_id,title,artifact_type,lifecycle_status,updated_at) values($1,$2,'Race first','document','active',$3),($4,$2,'Race second','document','active',$3)", [artifact, owner, stamp, second]);
      await pg.query("insert into public.quests(id,user_id,title,quest_type,quest_size,status) values($1,$2,'Existing main','learning','main','completed')", [quest, owner]);
      // The existing Artifact lifecycle trigger owns updated_at. Read its actual
      // six-decimal timestamp instead of assuming an INSERT fixture can override it.
      stamp = (await pg.query("select to_char(updated_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') v from public.artifacts where id=$1", [artifact])).rows[0].v;
      await pg.query("commit"); baseline = await core();
    } catch (error) { await pg.query("rollback"); throw error; }
  });
  afterEach(async () => {
    for (const client of clients.splice(0)) { try { await client.query("rollback"); } finally { await client.end(); } }
    expect(await core()).toEqual(baseline);
    // Immutable successful fixtures are deliberately retained for whole-owned-stack disposal.
  });
  afterAll(async () => { if (connected) await pg.end(); });

  it("same-key acceptance serializes actual wait then replays a single EARN/snapshot", async () => {
    const a = await peer(), b = await peer(), input = args();
    const first = (await a.client.query(acceptSQL, input)).rows[0].r;
    const pending = observed(b.client.query(acceptSQL, input)); await waiting(b.pid); await a.client.query("commit");
    const second = await pending; expect(second.error).toBeUndefined(); expect(second.result?.rows[0].r).toEqual({ ...first, replayed: true }); await b.client.query("commit"); await ledger(1, 0);
  });
  it.each(["note", "target", "revoke"])("same-key different %s waits then conflicts without second audit/EARN", async changed => {
    const a = await peer(), b = await peer(), key = randomUUID(); await a.client.query(acceptSQL, args(key));
    const pending = observed(changed === "revoke" ? b.client.query(revokeSQL, [artifact, "No", key]) : b.client.query(acceptSQL, args(key, changed === "target" ? second : artifact, changed === "note" ? "Different" : undefined)));
    await waiting(b.pid); await a.client.query("commit"); expect((await pending).error).toMatchObject({ code: "23505", message: "ARTIFACT_ACCEPTANCE_KEY_REUSED" }); await b.client.query("rollback"); await ledger(1, 0);
    expect((await pg.query("select count(*)::int n from public.outer_loop_audit_events where user_id=$1", [owner])).rows[0].n).toBe(1);
  });
  it("same Artifact different keys yields one winner, no second acceptance or EARN", async () => {
    const a = await peer(), b = await peer(); await a.client.query(acceptSQL, args()); const pending = observed(b.client.query(acceptSQL, args()));
    await waiting(b.pid); await a.client.query("commit"); expect((await pending).error).toMatchObject({ code: "23505", message: "ARTIFACT_ACCEPTANCE_ALREADY_ACCEPTED" }); await b.client.query("rollback"); await ledger(1, 0);
  });
  it("different Artifacts share the account lock and cannot lose an update", async () => {
    const a = await peer(), b = await peer(); await a.client.query(acceptSQL, args()); const pending = observed(b.client.query(acceptSQL, args(randomUUID(), second)));
    await waiting(b.pid); await a.client.query("commit"); expect((await pending).error).toBeUndefined(); await b.client.query("commit"); await ledger(2, 0);
    expect((await pg.query("select current_available from public.reward_accounts where user_id=$1", [owner])).rows[0].current_available).toBe(200);
  });
  it("accept/revoke share account order: revoke waits, then exact-100 with no deadlock", async () => {
    const a = await peer(), b = await peer(); await a.client.query(acceptSQL, args()); const pending = observed(b.client.query(revokeSQL, [artifact, "Rejected after review", randomUUID()]));
    await waiting(b.pid); await a.client.query("commit"); expect((await pending).result?.rows[0].r.acceptance.status).toBe("REVOKED"); await b.client.query("commit"); await ledger(1, 1);
  });
  it("simultaneous new revocations allow only one exact correction", async () => {
    const seed = await peer(); await seed.client.query(acceptSQL, args()); await seed.client.query("commit");
    const a = await peer(), b = await peer(); await a.client.query(revokeSQL, [artifact, "First", randomUUID()]);
    const pending = observed(b.client.query(revokeSQL, [artifact, "Second", randomUUID()])); await waiting(b.pid); await a.client.query("commit");
    expect((await pending).error).toMatchObject({ code: "23505", message: "ARTIFACT_ACCEPTANCE_ALREADY_REVOKED" }); await b.client.query("rollback"); await ledger(1, 1);
  });
  it("generic correction first then revoke reuses its exact ID with no second cache update", async () => {
    const seed = await peer(), earn = (await seed.client.query(acceptSQL, args())).rows[0].r.earn; await seed.client.query("commit");
    const a = await peer(), b = await peer(), correction = (await a.client.query("select public.rpc_correct_reward_transaction($1,'Generic first',$2) r", [earn.id, randomUUID()])).rows[0].r;
    const cache = (await a.client.query("select to_jsonb(t) r from public.reward_accounts t where user_id=$1", [owner])).rows[0].r;
    const pending = observed(b.client.query(revokeSQL, [artifact, "Explicit revoke", randomUUID()])); await waiting(b.pid); await a.client.query("commit");
    expect((await pending).result?.rows[0].r.correction.id).toBe(correction.transaction.id); await b.client.query("commit"); await ledger(1, 1);
    expect((await pg.query("select to_jsonb(t) r from public.reward_accounts t where user_id=$1", [owner])).rows[0].r).toEqual(cache);
  });
  it("revoke first then generic correction fails exactly once, never a double deduction", async () => {
    const seed = await peer(), earn = (await seed.client.query(acceptSQL, args())).rows[0].r.earn; await seed.client.query("commit");
    const a = await peer(), b = await peer(); await a.client.query(revokeSQL, [artifact, "First", randomUUID()]);
    const pending = observed(b.client.query("select public.rpc_correct_reward_transaction($1,'Second',$2)", [earn.id, randomUUID()])); await waiting(b.pid); await a.client.query("commit");
    expect((await pending).error).toMatchObject({ code: "23505", message: "REWARD_TRANSACTION_ALREADY_CORRECTED" }); await b.client.query("rollback"); await ledger(1, 1);
  });
  it("new and legacy grants share key lock and conflict, not two successful receipts", async () => {
    const a = await peer(), b = await peer(), key = randomUUID(); await a.client.query(acceptSQL, args(key));
    const pending = observed(b.client.query("select public.rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2)", [quest, key])); await waiting(b.pid); await a.client.query("commit");
    expect((await pending).error).toMatchObject({ code: "23505", message: "IDEMPOTENCY_KEY_REUSED" }); await b.client.query("rollback"); await ledger(1, 0);
  });
  it("different owners do not share an identity; foreign acceptance never waits into success", async () => {
    const a = await peer(), b = await peer(other); await a.client.query(acceptSQL, args());
    const result = await observed(b.client.query(acceptSQL, args())); expect(result.error).toMatchObject({ code: "P0002", message: "ARTIFACT_ACCEPTANCE_NOT_FOUND" });
    await b.client.query("rollback"); await a.client.query("commit"); await ledger(1, 0);
  });
});
