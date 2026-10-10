import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { AssessmentProposalSchema, type AssessmentProposal } from "@/lib/ai/schemas";
import { playerLevelFromXp } from "@/lib/growth-engine/levels";

// Only the Next request/session factory is replaced. Both clients' query builders,
// Auth, PostgREST, RLS, the admin factory and the rejection service are real.
const request = vi.hoisted(() => ({ server: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: request.server }));
import { getAssessmentRejectionSession } from "@/lib/store/assessment-rejection.service";
import { AuthRequiredError } from "@/lib/store/request-repository";

const databaseUrl = process.env.XP_RPG_TEST_DB_URL;
type Row = Record<string, unknown>;
type Snapshot = Record<string, Row[]>;
type Actor = { id: string; client: SupabaseClient };
type Proposal = { id: string; activityId: string; owner: string; skill: string };
type Settlement = { ok: boolean; reason?: string; transaction?: { amount: number } };

// Same schema and primary-skill shape as confirm.test.ts/read-path-integration;
// these are explicitly authored fixtures, never represented as an AI response.
function proposalFixture(skill: string): AssessmentProposal {
  return AssessmentProposalSchema.parse({
    activity: { type: "learning", completion: 0.7 },
    difficulty: { complexity: 0.5, uncertainty: 0.4, expertise_gap: 0.5, resistance: 0.4 },
    growth: { effort: 0.6, learning: 0.7, performance: 0.3, outcome: 0.5, artifact_value: 0, character_evidence: 0 },
    evidence: { level: 2, explanation: "Synthetic explanation, not independently verified" },
    affected_skills: [{ name: skill, reason: "Synthetic primary skill" }],
    knowledge_updates: { proposed_nodes: [], proposed_edges: [] }, mastery_changes: [],
    xp_semantics: { base_value: 20, difficulty: 0.5, mastery_gain: 0.5, novelty: 0.5, goal_alignment: 0.6, repetition_risk: "low" },
    artifactProposals: [], artifacts: [], next_quest: null, confidence: 0.7,
    uncertainty_notes: ["Authored test fixture; no AI request"],
  });
}

describe.skipIf(!databaseUrl)("proposal rejection real SDK/service/PostgreSQL authority", () => {
  const pg = new Client({ connectionString: databaseUrl });
  const locker = new Client({ connectionString: databaseUrl });
  const confirmer = new Client({ connectionString: databaseUrl });
  const connected: Client[] = [];
  const actors: Actor[] = [];
  const clients: SupabaseClient[] = [];
  let tables: string[] = [], expected: Snapshot | undefined;
  let own: Proposal, sibling: Proposal, foreign: Proposal;
  let lockerPid: number, confirmPid: number;
  let pending: Promise<unknown>[] = [];

  function disposable() {
    const db = new URL(databaseUrl!), api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (![db.hostname, api.hostname].every(h => ["127.0.0.1", "localhost"].includes(h))) throw Error("Disposable local rejection stack required");
    if (process.env.GITHUB_ACTIONS === "true") return;
    const project = process.env.XP_RPG_DISPOSABLE_TEST_STACK;
    const receiptPath = process.env.XP_RPG_PROPOSAL_REJECTION_CREATION_RECEIPT;
    if (!project || !/^phase8f_(?:r3|test)_[a-z0-9_]+$/.test(project) || db.port !== "54332" || api.port !== "54331" || !receiptPath)
      throw Error("Owned rejection stack creation receipt required");
    const creation = JSON.parse(readFileSync(receiptPath, "utf8"));
    expect(creation.project).toBe(project); expect(creation.containers).toHaveLength(4);
    for (const component of ["db", "auth", "rest", "kong"]) {
      // Deliberately exclude container Env and all credentials from inspection.
      const format = '{"id":{{json .Id}},"created":{{json .Created}},"labels":{{json .Config.Labels}},"state":{{json .State.Status}},"ports":{{json .HostConfig.PortBindings}}}';
      const actual = JSON.parse(execFileSync("docker", ["inspect", "--format", format, `supabase_${component}_${project}`], { encoding: "utf8" }));
      const original = creation.containers.find((r: { component: string }) => r.component === component);
      expect(actual.id).toBe(original.id); expect(actual.created).toBe(original.created); expect(actual.state).toBe("running");
      expect(actual.labels["com.supabase.cli.project"]).toBe(project); expect(actual.labels["com.supabase.cli.workdir"]).toBe(creation.stack);
      if (component === "db" || component === "kong") {
        const bindings = actual.ports[component === "db" ? "5432/tcp" : "8000/tcp"];
        expect(bindings.length).toBeGreaterThan(0);
        expect(bindings.every((p: { HostPort: string }) => p.HostPort === (component === "db" ? "54332" : "54331"))).toBe(true);
      }
    }
  }

  async function actor(): Promise<Actor> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    clients.push(admin);
    const credentials = { email: `rejection-authority-${randomUUID()}@example.test`, password: `Synthetic!${randomUUID()}x` };
    const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
    if (created.error || !created.data.user) throw Error("Synthetic rejection actor creation failed");
    const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    clients.push(client);
    if ((await client.auth.signInWithPassword(credentials)).error) throw Error("Synthetic rejection actor sign-in failed");
    return { id: created.data.user.id, client };
  }

  // Reuses settlement-rpc.test.ts's create_activity -> record_ai_assessment
  // fixture protocol; no guessed activity status, rules version or owner.
  async function createProposal(who: Actor, existing?: Proposal): Promise<Proposal> {
    const skill = existing?.skill ?? `Rejection skill ${randomUUID()}`;
    await pg.query("begin");
    try {
      await pg.query("set local role authenticated");
      await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [who.id]);
      const activityId = existing?.activityId ?? (await pg.query("select id from public.create_activity($1,$2)",
        ["Synthetic proposal rejection", `  Original private fixture ${randomUUID()}\r\n完整原文🙂  `])).rows[0].id;
      await pg.query("set local role service_role");
      const id = (await pg.query("select (public.record_ai_assessment($1,$2,$3::jsonb,'synthetic-rejection-model','synthetic-rejection-prompt',0.7)).id as id",
        [who.id, activityId, JSON.stringify(proposalFixture(skill))])).rows[0].id;
      await pg.query("commit"); return { id, activityId, owner: who.id, skill };
    } catch (error) { await pg.query("rollback"); throw error; }
  }

  async function populate(who: Actor) {
    const skill = randomUUID(), activity = randomUUID(), assessment = randomUUID(), quest = randomUUID();
    await pg.query("insert into skills(id,user_id,name,xp,level,mastery_level,mastery_confidence,status) values($1,$2,'Existing Core',500,$3,8,0.8,'active')", [skill, who.id, playerLevelFromXp(500)]);
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Existing Core','Original confirmed input','confirmed','rejection-history-fixture')", [activity, who.id]);
    await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json,model_name,prompt_version,confidence) values($1,$2,$3,'confirmed','rejection-history-fixture',$4,'synthetic-history','synthetic-history',0.7)", [assessment, who.id, activity, proposalFixture("Existing Core")]);
    await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,500,500,'rejection-history-fixture','Existing Core')", [who.id, activity, assessment, skill]);
    await pg.query("update player_states set total_xp=500,player_level=$2 where user_id=$1", [who.id, playerLevelFromXp(500)]);
    await pg.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'Existing evidence',true)", [who.id, activity, skill]);
    await pg.query("insert into artifacts(user_id,title,artifact_type,summary) values($1,'Existing artifact','document','Synthetic historical artifact')", [who.id]);
    await pg.query("insert into quests(id,user_id,title,quest_type,quest_size,status) values($1,$2,'Existing completed Major','learning','major','completed')", [quest, who.id]);
    await pg.query("begin");
    try {
      await pg.query("set local role authenticated"); await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [who.id]);
      expect((await pg.query("select rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2) as r", [quest, randomUUID()])).rows[0].r).toMatchObject({ ok: true, transaction: { amount: 100 } });
      await pg.query("commit");
    } catch (error) { await pg.query("rollback"); throw error; }
  }

  const ordered = (rows: Row[]) => rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  async function snapshot(): Promise<Snapshot> {
    const result: Snapshot = {};
    for (const table of tables) for (const who of actors) result[`${table}/${who.id}`] = ordered((await pg.query(
      `select to_jsonb(t) as r from public.${table} t where user_id=$1`, [who.id])).rows.map(r => r.r));
    return result;
  }
  function statusOnly(before: Snapshot, item: Proposal, status = "rejected") {
    const next = structuredClone(before), key = `ai_assessments/${item.owner}`;
    const row = next[key].find(r => r.id === item.id); expect(row).toBeDefined(); row!.status = status; ordered(next[key]); return next;
  }
  async function unchanged() { expect(await snapshot()).toEqual(expected); }
  async function reject(item = own) { return (await getAssessmentRejectionSession()).reject(item.id); }
  const receipt = (item: Proposal) => ({ assessment: { id: item.id, activityId: item.activityId, status: "rejected" } });

  // Matches the existing buildSettlement factory and calls the *installed* 0042
  // RPC. The synthetic 20 XP here is a lock/atomicity fixture, not an AI award.
  function settlementFixture(item: Proposal) {
    return { assessmentId: item.id, xpDelta: 20,
      transaction: { id: randomUUID(), activityId: item.activityId, assessmentId: item.id, xpType: "activity", skillId: "", skillName: item.skill,
        activityType: "learning", repetitionCount: 0, repetitionPenalty: 1, amount: 20, baseAmount: 20, modifierJson: {}, reason: "Synthetic lock fixture", rulesVersion: "ignored-by-rpc", createdAt: new Date().toISOString() },
      primarySkill: { skill: { resolution: "create", proposedName: item.skill }, name: item.skill, xpDelta: 20, masteryAction: { action: "none" } },
      relatedSkillResolutions: [], player: { xpDelta: 20 }, evidence: { level: 2, explanation: "Synthetic explanation", type: "learning" }, artifactResolutions: [],
    };
  }
  async function settle(item = own): Promise<Settlement> {
    return (await confirmer.query("select public.settle_activity($1,$2::jsonb) as r", [item.owner, JSON.stringify(settlementFixture(item))])).rows[0].r;
  }
  async function beginConfirm() {
    await confirmer.query("begin; set local role service_role; set local lock_timeout='8s'; set local statement_timeout='12s'");
  }
  async function hold(item = own) {
    await locker.query("begin; set local lock_timeout='8s'; set local statement_timeout='12s'");
    await locker.query("select id from public.ai_assessments where id=$1 for update", [item.id]);
  }
  function observe<T>(work: Promise<T>) {
    // Observe failures immediately, before any lock polling or other await.
    const result = Promise.allSettled([work]); pending.push(result); return result;
  }
  function fulfilled<T>(result: PromiseSettledResult<T>): T {
    expect(result.status).toBe("fulfilled"); if (result.status !== "fulfilled") throw Error("Expected completed lock participant"); return result.value;
  }
  async function waitingFor(blocker: number, minimum = 1, requiredPid?: number) {
    const deadline = Date.now() + 3500;
    while (Date.now() < deadline) {
      const rows = (await pg.query("select pid,pg_blocking_pids(pid) as blockers from pg_stat_activity where datname=current_database() and wait_event_type='Lock'"))
        .rows as { pid: number; blockers: number[] }[];
      const reaches = (pid: number, seen = new Set<number>()): boolean => {
        if (pid === blocker) return true; if (seen.has(pid)) return false; seen.add(pid);
        return rows.find(r => r.pid === pid)?.blockers.some(p => reaches(p, seen)) ?? false;
      };
      const blocked = rows.filter(r => reaches(r.pid));
      if (blocked.length >= minimum && (requiredPid === undefined || blocked.some(r => r.pid === requiredPid))) return;
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    throw Error("Competing operation did not enter the actual PostgreSQL row-lock queue");
  }

  // All tables/all owners remain compared, with only the successful Confirm's
  // explicit rows removed from comparison. Pre-existing ledger/evidence/skills
  // stay byte-for-byte equal; new rows and player parity are checked separately.
  async function confirmedDelta(before: Snapshot, item: Proposal, superseded: Proposal[] = []) {
    const after = await snapshot(), owner = item.owner;
    const mutableAssessments = [item.id, ...superseded.map(p => p.id)];
    for (const key of Object.keys(before)) {
      if (!key.endsWith(`/${owner}`)) { expect(after[key]).toEqual(before[key]); continue; }
      const table = key.split("/")[0];
      if (table === "player_states") {
        expect(after[key]).toHaveLength(1);
        expect(after[key][0]).toMatchObject({ total_xp: Number(before[key][0].total_xp) + 20, player_level: playerLevelFromXp(Number(before[key][0].total_xp) + 20) });
        const omit = ({ total_xp: _xp, player_level: _level, updated_at: _updated, ...row }: Row) => { void _xp; void _level; void _updated; return row; };
        expect(omit(after[key][0])).toEqual(omit(before[key][0]));
      } else if (table === "activities" || table === "ai_assessments") {
        const ids = table === "activities" ? [item.activityId] : mutableAssessments;
        expect(after[key].filter(r => !ids.includes(String(r.id)))).toEqual(before[key].filter(r => !ids.includes(String(r.id))));
        for (const id of ids) {
          const original = before[key].find(r => r.id === id)!, actual = after[key].find(r => r.id === id)!;
          expect(actual).toBeDefined();
          const omit = ({ status: _status, updated_at: _updated, confirmed_at: _confirmed, ...row }: Row) => { void _status; void _updated; void _confirmed; return row; };
          expect(omit(actual)).toEqual(omit(original));
          expect(actual.status).toBe(table === "activities" || id === item.id ? "confirmed" : "superseded");
          if (table === "ai_assessments" && id === item.id) expect(actual.confirmed_at).not.toBeNull();
        }
      } else if (["skills", "xp_transactions", "evidence_records"].includes(table)) {
        const oldIds = new Set(before[key].map(r => r.id));
        expect(after[key].filter(r => oldIds.has(r.id))).toEqual(before[key]);
        const added = after[key].filter(r => !oldIds.has(r.id)); expect(added).toHaveLength(1);
        if (table === "skills") expect(added[0]).toMatchObject({ name: item.skill, xp: 20, level: playerLevelFromXp(20) });
        if (table === "xp_transactions") expect(added[0]).toMatchObject({ assessment_id: item.id, activity_id: item.activityId, amount: 20, xp_type: "activity" });
        if (table === "evidence_records") expect(added[0]).toMatchObject({ activity_id: item.activityId, evidence_level: 2 });
      } else expect(after[key]).toEqual(before[key]);
    }
    expected = after;
  }

  beforeAll(async () => {
    disposable();
    for (const connection of [pg, locker, confirmer]) { await connection.connect(); connected.push(connection); }
    lockerPid = (await locker.query("select pg_backend_pid() as pid")).rows[0].pid;
    confirmPid = (await confirmer.query("select pg_backend_pid() as pid")).rows[0].pid;
    expect((await pg.query("select to_regprocedure('public.settle_activity(uuid,jsonb)') is not null as v")).rows[0].v).toBe(true);
    for (let n = 0; n < 3; n++) { const who = await actor(); actors.push(who); await populate(who); }
    tables = (await pg.query("select distinct c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r' and a.attname='user_id' and not a.attisdropped order by c.relname")).rows.map(r => r.relname as string);
    expect(tables.every(t => /^[a-z_]+$/.test(t))).toBe(true);
    expect(tables).toEqual(expect.arrayContaining(["activities", "ai_assessments", "skills", "player_states", "xp_transactions", "mastery_events", "mastery_verifications", "evidence_records", "artifacts", "quests", "reward_accounts", "reward_transactions", "milestones"]));
    for (const who of actors) for (const table of ["activities", "ai_assessments", "skills", "player_states", "xp_transactions", "evidence_records", "artifacts", "quests", "reward_accounts", "reward_transactions"])
      expect(Number((await pg.query(`select count(*) as n from public.${table} where user_id=$1`, [who.id])).rows[0].n)).toBeGreaterThan(0);
  }, 90000);
  beforeEach(async () => {
    expected = undefined; pending = []; request.server.mockReset(); request.server.mockResolvedValue(actors[0].client);
    own = await createProposal(actors[0]); sibling = await createProposal(actors[0], own); foreign = await createProposal(actors[1]);
    expect((await pg.query("select id,status from ai_assessments where id=any($1::uuid[]) order by id", [[own.id,sibling.id]])).rows)
      .toEqual([own.id,sibling.id].sort().map(id => ({ id, status: "pending" })));
    expected = await snapshot();
  });
  afterEach(async () => {
    // Release only our transactions, even on a failed queue assertion. Never
    // terminate PostgREST sessions, kill processes or disable database guards.
    await locker.query("rollback"); await confirmer.query("rollback"); await Promise.allSettled(pending);
    if (expected) await unchanged();
  });
  afterAll(async () => {
    try { for (const client of clients) client.auth.stopAutoRefresh(); }
    finally { for (const connection of connected.reverse()) await connection.end(); }
    // Auth and immutable reward history belong to the disposable stack. Its
    // owner disposes it later; no user deletion/cascade/trigger disabling here.
  });

  test("real authenticated/anon RLS SELECT cannot discover either other owner", async () => {
    for (const who of actors) for (const other of actors.filter(a => a.id !== who.id)) {
      const result = await who.client.from("ai_assessments").select("id,user_id").eq("user_id", other.id);
      expect(result.error).toBeNull(); expect(result.data).toEqual([]);
    }
    const ownRead = await actors[0].client.from("ai_assessments").select("id").eq("id", own.id).single();
    expect(ownRead.error).toBeNull(); expect(ownRead.data).toEqual({ id: own.id });
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }); clients.push(anon);
    const result = await anon.from("ai_assessments").select("id").eq("id", own.id); expect(result.error).toBeNull(); expect(result.data).toEqual([]);
  });
  test("authenticated direct UPDATE of even an owned assessment has no write authority", async () => {
    const result = await actors[0].client.from("ai_assessments").update({ status: "rejected" }).eq("id", own.id).select("id");
    if (result.error) expect(result.error.code).toBe("42501"); else expect(result.data).toEqual([]);
    await unchanged();
  });
  test("actual service changes only status, returns minimal bound receipt and replays without growth", async () => {
    expect(await reject()).toEqual(receipt(own)); expected = statusOnly(expected!, own); await unchanged();
    expect(await reject()).toEqual(receipt(own)); await unchanged();
    expect(await (await getAssessmentRejectionSession()).reject(own.id.toUpperCase())).toEqual(receipt(own));
  });
  test("missing and RLS-invisible foreign rows have the same not_found result", async () => {
    for (const id of [foreign.id, randomUUID()]) await expect((await getAssessmentRejectionSession()).reject(id)).rejects.toMatchObject({ code: "not_found" });
    await unchanged();
  });
  test.each(["confirmed", "edited", "superseded"])("terminal %s cannot be rewritten", async status => {
    await pg.query("update ai_assessments set status=$2 where id=$1", [own.id, status]); expected = statusOnly(expected!, own, status);
    await expect(reject()).rejects.toMatchObject({ code: "assessment_conflict" }); await unchanged();
  });
  test("missing session and invalid identifiers cannot mutate any owner", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }); clients.push(anon);
    request.server.mockResolvedValueOnce(anon); await expect(getAssessmentRejectionSession()).rejects.toBeInstanceOf(AuthRequiredError);
    await expect((await getAssessmentRejectionSession()).reject("constructor")).rejects.toMatchObject({ code: "invalid_receipt" }); await unchanged();
  });
  test("same assessment: queued rejection wins before real 0042 Confirm, zero XP delta", async () => {
    await hold(); const rejection = observe(reject()); await waitingFor(lockerPid);
    await beginConfirm(); const confirmation = observe(settle()); await waitingFor(lockerPid, 2, confirmPid);
    await locker.query("commit"); expect(fulfilled((await rejection)[0])).toEqual(receipt(own));
    expect(fulfilled((await confirmation)[0])).toMatchObject({ ok: false, reason: "already_confirmed" }); await confirmer.query("commit");
    expected = statusOnly(expected!, own); await unchanged();
  }, 20000);
  test("same assessment: uncommitted real Confirm holds the row, rejection CAS loses and preserves settlement", async () => {
    const before = expected!; await beginConfirm(); expect(await settle()).toMatchObject({ ok: true });
    const rejection = observe(reject()); await waitingFor(confirmPid); await confirmer.query("commit");
    expect((await rejection)[0]).toMatchObject({ status: "rejected", reason: { code: "assessment_conflict" } });
    await confirmedDelta(before, own, [sibling]); await unchanged();
    await expect(reject()).rejects.toMatchObject({ code: "assessment_conflict" }); await unchanged();
  }, 20000);
  test("two rejections really queue on the same row and produce one durable status transition", async () => {
    await hold(); const first = observe(reject()); await waitingFor(lockerPid);
    const second = observe(reject()); await waitingFor(lockerPid, 2); await locker.query("commit");
    expect(fulfilled((await first)[0])).toEqual(receipt(own)); expect(fulfilled((await second)[0])).toEqual(receipt(own));
    expected = statusOnly(expected!, own); await unchanged(); expect(await reject()).toEqual(receipt(own));
  }, 20000);
  test("sibling Confirm overlaps queued rejection at 0042's final superseding UPDATE without deadlock", async () => {
    await hold(); const rejection = observe(reject()); await waitingFor(lockerPid);
    await beginConfirm(); const confirmation = observe(settle(sibling)); await waitingFor(lockerPid, 2, confirmPid);
    await locker.query("commit"); expect(fulfilled((await rejection)[0])).toEqual(receipt(own));
    expect(fulfilled((await confirmation)[0])).toMatchObject({ ok: true }); await confirmer.query("commit");
    await confirmedDelta(statusOnly(expected!, own), sibling); await unchanged();
    expect(await reject()).toEqual(receipt(own)); await unchanged();
  }, 20000);
  test("sibling Confirm wins: pending read cannot resurrect the now superseded assessment", async () => {
    const before = expected!; await beginConfirm(); expect(await settle(sibling)).toMatchObject({ ok: true });
    const rejection = observe(reject()); await waitingFor(confirmPid); await confirmer.query("commit");
    expect((await rejection)[0]).toMatchObject({ status: "rejected", reason: { code: "assessment_conflict" } });
    await confirmedDelta(before, sibling, [own]); await unchanged();
  }, 20000);
  test("rejecting one activity leaves another independent activity eligible for legitimate Confirm", async () => {
    const independent = await createProposal(actors[0]); expected = await snapshot();
    expect(await reject()).toEqual(receipt(own)); expected = statusOnly(expected!, own); await unchanged();
    const before = expected; await beginConfirm(); expect(await settle(independent)).toMatchObject({ ok: true }); await confirmer.query("commit");
    await confirmedDelta(before, independent); await unchanged();
  });
});
