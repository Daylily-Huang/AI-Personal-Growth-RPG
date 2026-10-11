import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Client, type QueryResult } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PROPOSAL_FACT_PROMPT_VERSION } from "@/lib/proposal-edit/types";

const dbUrl = process.env.XP_RPG_TEST_DB_URL;
const beginSQL = "select public.rpc_begin_proposal_fact_edit($1,$2,$3) r";
const completeSQL = "select public.rpc_complete_proposal_fact_edit($1,$2,$3,$4,'synthetic-concurrency',$5) r";
const facts = { description: "Explicit corrected facts", totalMinutes: 40, effectiveMinutes: 15, relatedSkillIds: [] };
const proposal = { activity: { type: "learning", completion: 0.5 }, difficulty: { complexity: 0.2, uncertainty: 0.3, expertise_gap: 0.4, resistance: 0.1 }, growth: { effort: 0.5, learning: 0.6, performance: 0.2, outcome: 0.3, artifact_value: 0, character_evidence: 0 }, evidence: { level: 0, explanation: "self-report" }, affected_skills: [], knowledge_updates: { proposed_nodes: [], proposed_edges: [] }, mastery_changes: [], xp_semantics: { base_value: 50, difficulty: 0.4, mastery_gain: 0.3, novelty: 0.6, goal_alignment: 0.7, repetition_risk: "low" }, next_quest: null, confidence: 0.7, uncertainty_notes: [], artifacts: [] };

function assertOwnedStack() {
  const url = new URL(dbUrl!);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw Error("Local synthetic DB required");
  if (process.env.GITHUB_ACTIONS === "true") return;
  const project = process.env.XP_RPG_DISPOSABLE_TEST_STACK, receiptFile = process.env.XP_RPG_PROPOSAL_EDIT_CREATION_RECEIPT;
  if (!project || !/^phase8f_test_[a-z0-9_]+$/.test(project) || url.port !== "54332" || !receiptFile) throw Error("Exact disposable stack required");
  const receipt = JSON.parse(readFileSync(receiptFile, "utf8")); expect(receipt.project).toBe(project); expect(receipt.containers).toHaveLength(4);
  for (const component of ["db", "auth", "rest", "kong"]) {
    const actual = JSON.parse(execFileSync("docker", ["inspect", `supabase_${component}_${project}`], { encoding: "utf8" }))[0];
    const original = receipt.containers.find((row: { component: string }) => row.component === component);
    expect(actual.Id).toBe(original.id); expect(actual.Created).toBe(original.created); expect(actual.State.Status).toBe("running");
    expect(actual.Config.Labels["com.supabase.cli.project"]).toBe(project); expect(actual.Config.Labels["com.supabase.cli.workdir"]).toBe(receipt.stack);
    if (component === "db" || component === "kong") { const bindings = actual.HostConfig.PortBindings[component === "db" ? "5432/tcp" : "8000/tcp"]; expect(bindings.length).toBeGreaterThan(0); expect(bindings.every((p: { HostPort: string }) => p.HostPort === (component === "db" ? "54332" : "54331"))).toBe(true); }
  }
}

type Outcome = { result: QueryResult; error?: never } | { error: { message: string; code: string }; result?: never };
// Attach both handlers immediately: losing contenders must never become unhandled rejections.
function observed(promise: Promise<QueryResult>): Promise<Outcome> { return promise.then(result => ({ result }), error => ({ error })); }

describe.skipIf(!dbUrl)("0055 real concurrent lock order and exactly-once terminal transitions", () => {
  const pg = new Client({ connectionString: dbUrl }); const peers: Client[] = [];
  let connected = false, owner: string, activity: string, base: string, otherBase: string;
  async function peer(role: "authenticated" | "service_role" = "authenticated") {
    const client = new Client({ connectionString: dbUrl }); await client.connect(); peers.push(client);
    await client.query("begin"); await client.query("set local lock_timeout='4s'"); await client.query(`set local role ${role}`);
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]); return client;
  }
  async function blocked(client: Client) {
    const pid = (await client.query("select pg_backend_pid() pid")).rows[0].pid;
    return pid;
  }
  async function waiting(pid: number) {
    for (let n = 0; n < 80; n++) {
      if ((await pg.query("select exists(select 1 from pg_locks where pid=$1 and not granted) v", [pid])).rows[0].v) return;
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    throw Error("A real PostgreSQL waiter must be observed, not inferred from timing");
  }
  const beginArgs = (key: string, target = base, body = facts) => [target, key, JSON.stringify(body)];
  const completeArgs = (key: string) => [owner, base, key, JSON.stringify(proposal), PROPOSAL_FACT_PROMPT_VERSION];
  function settledPayload() { return { assessmentId: base, xpDelta: 0,
    transaction: { id: randomUUID(), activityId: activity, assessmentId: base, amount: 0, baseAmount: 0, xpType: "activity", skillName: "Race skill", activityType: "learning", repetitionCount: 0, modifierJson: {}, repetitionPenalty: 1 },
    primarySkill: { skill: { resolution: "create", proposedName: "Race skill" }, name: "Race skill", xpDelta: 0, masteryAction: { action: "none" } },
    relatedSkillResolutions: [], player: { xpDelta: 0 }, evidence: { level: 0, explanation: "self-report" },
  }; }
  beforeAll(async () => { assertOwnedStack(); await pg.connect(); connected = true; });
  beforeEach(async () => {
    owner = randomUUID(); activity = randomUUID(); base = randomUUID(); otherBase = randomUUID(); const otherActivity = randomUUID();
    await pg.query("begin");
    try {
      await pg.query("insert into auth.users(id,email) values($1,$2)", [owner, `${owner}@example.test`]);
      await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Race','Original','assessed','race-frozen'),($3,$2,'Other','Original other','assessed','race-frozen')", [activity, owner, otherActivity]);
      await pg.query("insert into ai_assessments(id,user_id,activity_id,rules_version,assessment_json,confidence) values($1,$2,$3,'race-frozen',$4,0.7),($5,$2,$6,'race-frozen',$4,0.7)", [base, owner, activity, JSON.stringify(proposal), otherBase, otherActivity]);
      await pg.query("commit");
    } catch (error) { await pg.query("rollback"); throw error; }
  });
  afterEach(async () => { for (const client of peers.splice(0)) { try { await client.query("rollback"); } finally { await client.end(); } } });
  afterAll(async () => { if (connected) await pg.end(); });

  it("same key replay waits for key namespace and returns dispatch=false exactly once", async () => {
    const key = randomUUID(), first = await peer(), second = await peer(), pid = await blocked(second);
    expect((await first.query(beginSQL, beginArgs(key))).rows[0].r.dispatch).toBe(true);
    const pending = observed(second.query(beginSQL, beginArgs(key))); await waiting(pid); await first.query("commit");
    const outcome = await pending; expect(outcome.error).toBeUndefined(); expect(outcome.result!.rows[0].r.dispatch).toBe(false); await second.query("commit");
    expect((await pg.query("select * from proposal_fact_edit_requests where user_id=$1", [owner])).rowCount).toBe(1);
  });
  it("same key different facts waits then rejects rather than dispatching twice", async () => {
    const key = randomUUID(), first = await peer(), second = await peer(), pid = await blocked(second);
    await first.query(beginSQL, beginArgs(key)); const pending = observed(second.query(beginSQL, beginArgs(key, base, { ...facts, description: "Different tuple" })));
    await waiting(pid); await first.query("commit"); expect((await pending).error).toMatchObject({ message: "PROPOSAL_EDIT_CONFLICT", code: "23505" });
  });
  it("same request key across different Activities serializes in the owner/key namespace first", async () => {
    const key = randomUUID(), first = await peer(), second = await peer(), pid = await blocked(second);
    await first.query(beginSQL, beginArgs(key)); const pending = observed(second.query(beginSQL, beginArgs(key, otherBase)));
    await waiting(pid); await first.query("commit"); expect((await pending).error).toMatchObject({ message: "PROPOSAL_EDIT_CONFLICT", code: "23505" });
    expect((await pg.query("select activity_id from proposal_fact_edit_requests where user_id=$1", [owner])).rows).toEqual([{ activity_id: activity }]);
  });
  it("different keys on same Activity wait at gate and allow one effective in-progress request", async () => {
    const first = await peer(), second = await peer(), pid = await blocked(second);
    await first.query(beginSQL, beginArgs(randomUUID())); const pending = observed(second.query(beginSQL, beginArgs(randomUUID())));
    await waiting(pid); await first.query("commit"); expect((await pending).error).toMatchObject({ message: "PROPOSAL_EDIT_CONFLICT", code: "55000" });
  });
  it("duplicate finalize returns the same one revision/result after first commit", async () => {
    const key = randomUUID(), starter = await peer(); await starter.query(beginSQL, beginArgs(key)); await starter.query("commit");
    const first = await peer("service_role"), second = await peer("service_role"), pid = await blocked(second);
    const completed = (await first.query(completeSQL, completeArgs(key))).rows[0].r; expect(completed.status).toBe("completed");
    const pending = observed(second.query(completeSQL, completeArgs(key))); await waiting(pid); await first.query("commit");
    const outcome = await pending; expect(outcome.error).toBeUndefined(); expect(outcome.result!.rows[0].r).toEqual(completed); await second.query("commit");
    expect((await pg.query("select * from proposal_fact_revisions where user_id=$1", [owner])).rowCount).toBe(1);
    expect((await pg.query("select * from ai_assessments where activity_id=$1", [activity])).rowCount).toBe(2);
    expect((await pg.query("select * from xp_transactions where activity_id=$1", [activity])).rowCount).toBe(0);
  });
  it("legacy record shares Activity gate and cannot bypass a newly committed request", async () => {
    const first = await peer(), second = await peer("service_role"), pid = await blocked(second);
    await first.query(beginSQL, beginArgs(randomUUID()));
    const pending = observed(second.query("select public.record_ai_assessment($1,$2,$3,'legacy','legacy',0.7)", [owner, activity, JSON.stringify(proposal)]));
    await waiting(pid); await first.query("commit"); expect((await pending).error).toMatchObject({ message: "PROPOSAL_EDIT_CONFLICT", code: "55000" });
  });
  it("ordinary Confirm can win after begin: exactly one ledger, later finalize closes conflict", async () => {
    const key = randomUUID(), first = await peer(), second = await peer("service_role"), pid = await blocked(second);
    await first.query(beginSQL, beginArgs(key));
    const pending = observed(second.query("select public.settle_activity($1,$2) r", [owner, JSON.stringify(settledPayload())]));
    await waiting(pid); await first.query("commit"); const outcome = await pending; expect(outcome.error).toBeUndefined(); expect(outcome.result!.rows[0].r).toMatchObject({ ok: true }); await second.query("commit");
    const finalizer = await peer("service_role"); expect((await finalizer.query(completeSQL, completeArgs(key))).rows[0].r.status).toBe("conflict"); await finalizer.query("commit");
    expect((await pg.query("select * from xp_transactions where activity_id=$1", [activity])).rowCount).toBe(1); expect((await pg.query("select * from proposal_fact_revisions where activity_id=$1", [activity])).rowCount).toBe(0);
  });
  it("finalize can win: ordinary old Confirm waits then cannot create a ledger", async () => {
    const key = randomUUID(), starter = await peer(); await starter.query(beginSQL, beginArgs(key)); await starter.query("commit");
    const first = await peer("service_role"), second = await peer("service_role"), pid = await blocked(second);
    expect((await first.query(completeSQL, completeArgs(key))).rows[0].r.status).toBe("completed");
    const pending = observed(second.query("select public.settle_activity($1,$2) r", [owner, JSON.stringify(settledPayload())]));
    await waiting(pid); await first.query("commit"); const outcome = await pending; expect(outcome.error).toBeUndefined(); expect(outcome.result!.rows[0].r).toEqual({ ok: false, reason: "already_confirmed" }); await second.query("commit");
    expect((await pg.query("select * from xp_transactions where activity_id=$1", [activity])).rowCount).toBe(0);
  });
  it("legacy single-row Reject CAS can win without lock inversion and closes pending Edit", async () => {
    const key = randomUUID(), starter = await peer(); await starter.query(beginSQL, beginArgs(key)); await starter.query("commit");
    const rejecter = await peer("service_role"), finalizer = await peer("service_role"), pid = await blocked(finalizer);
    expect((await rejecter.query("update ai_assessments set status='rejected' where id=$1 and user_id=$2 and activity_id=$3 and status='pending'", [base, owner, activity])).rowCount).toBe(1);
    const pending = observed(finalizer.query(completeSQL, completeArgs(key))); await waiting(pid); await rejecter.query("commit");
    const outcome = await pending; expect(outcome.error).toBeUndefined(); expect(outcome.result!.rows[0].r.status).toBe("conflict"); await finalizer.query("commit");
    expect((await pg.query("select * from proposal_fact_revisions where activity_id=$1", [activity])).rowCount).toBe(0);
  });
});
