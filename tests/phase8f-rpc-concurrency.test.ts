import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

const databaseUrl = process.env.XP_RPG_TEST_DB_URL;
type Call = { sql: string; args: unknown[] };
const call = (sql: string, args: unknown[]): Call => ({ sql, args });

// Committed two-session races require their own disposable database: milestone
// history cannot be deleted, and application guards must never be disabled.
// This tests real PostgreSQL locks/DDL with the installed auth.uid() function and
// a minimal auth.users fixture table, NOT the external HTTP authentication flow.
describe.skipIf(!databaseUrl)("8F Round2 isolated PostgreSQL concurrency", () => {
  const name = `phase8f_round2_${randomUUID().replaceAll("-", "")}`;
  const admin = new Client({ connectionString: databaseUrl });
  let created = false; let observer: Client; let first: Client; let second: Client; let secondPid: number;
  const clients: Client[] = [];
  let user: string; let source: string; let core: unknown;
  async function execute(client: Client, request: Call) { return (await client.query(request.sql, request.args)).rows[0].r; }
  const confirm = (key = randomUUID(), title = "Concurrent", id = source) => call(
    "select rpc_confirm_milestone('epic',$1,null,'CORE_VERIFIED','QUEST',$2,null,null,$3) as r", [title,id,key]);
  const settle = (id: string, key = randomUUID(), policy = "reward-v1") => call(
    "select rpc_settle_milestone_reward($1,$2,$3) as r", [id,policy,key]);
  const revoke = (id: string, key = randomUUID(), reason = "Withdraw") => call(
    "select rpc_revoke_milestone($1,$2,$3) as r", [id,reason,key]);
  const grant = (key = randomUUID()) => call("select rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2) as r", [source,key]);
  const correct = (id: string) => call("select rpc_correct_reward_transaction($1,'Direct',$2) as r", [id,randomUUID()]);
  const review = (id: string, key = randomUUID(), decision = "ACCEPTED") => call(
    "select rpc_review_outer_loop_proposal($1,$2,null,null,$3) as r", [id,decision,key]);
  async function begin(client: Client) {
    await client.query("begin; set local lock_timeout='5s'; set local statement_timeout='8s'; set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
  }
  async function once(request: Call) {
    await begin(first);
    try { const result = await execute(first,request); await first.query("commit"); return result; }
    catch (error) { await first.query("rollback"); throw error; }
  }
  async function counts() {
    return (await observer.query(`select
      (select count(*)::int from milestones where user_id=$1) as milestones,
      (select count(*)::int from reward_transactions where user_id=$1 and event_kind='EARN') as earns,
      (select count(*)::int from reward_transactions where user_id=$1 and event_kind='CORRECTION') as corrections,
      (select count(*)::int from outer_loop_audit_events where user_id=$1) as audits,
      (select count(*)::int from reward_accounts where user_id=$1) as accounts`,[user])).rows[0];
  }
  async function coreSnapshot() {
    const result: Record<string, unknown> = {};
    for (const table of ["player_states","domains","quests","skills","activities","ai_assessments","xp_transactions","mastery_events",
      "mastery_verifications","evidence_records","knowledge_nodes","artifacts","seasons","season_reviews"])
      result[table]=(await observer.query(`select to_jsonb(t) as row from public.${table} t where user_id=$1 order by to_jsonb(t)::text`,[user])).rows;
    return result;
  }
  async function waiting() {
    const until=Date.now()+3500;
    while (Date.now()<until) {
      const row=(await observer.query("select wait_event_type,wait_event from pg_stat_activity where pid=$1",[secondPid])).rows[0];
      if (row?.wait_event_type==="Lock") return row.wait_event as string;
      await new Promise(resolve=>setTimeout(resolve,15));
    }
    throw Error("Second session never reached a real PostgreSQL lock wait");
  }
  async function race(a: Call,b: Call, expectedLock = "advisory") {
    await begin(first); await begin(second);
    try {
      const winner=await execute(first,a);
      // Attach the rejection observer in the same tick; expected conflicts must
      // never become Vitest unhandled rejections (PR44 regression boundary).
      const pending=Promise.allSettled([execute(second,b)]);
      expect(await waiting()).toBe(expectedLock);
      await first.query("commit");
      const loser=(await pending)[0];
      await second.query(loser.status==="fulfilled" ? "commit" : "rollback");
      return {winner,loser};
    } finally { await first.query("rollback"); await second.query("rollback"); }
  }
  function conflict(result: PromiseSettledResult<unknown>, message: string) {
    expect(result.status).toBe("rejected");
    if (result.status==="rejected") expect(result.reason).toMatchObject({code:"23505",message});
  }
  async function proposal() {
    const id=randomUUID();
    await observer.query(`insert into outer_loop_proposals(id,user_id,proposal_type,schema_version,payload)
      values($1,$2,'MILESTONE_CANDIDATE',2,$3)`,[id,user,{milestone_key:"epic",title:"Concurrent",description:null,
      recognition_class:"CORE_VERIFIED",source_type:"QUEST",source_id:source}]);
    return id;
  }
  beforeAll(async () => {
    const url=new URL(databaseUrl!);
    if (!["localhost","127.0.0.1","[::1]"].includes(url.hostname)) throw Error("Disposable DB races require a local PostgreSQL test server");
    await admin.connect();
    const authUid=(await admin.query("select pg_get_functiondef('auth.uid()'::regprocedure) as sql")).rows[0].sql;
    if (!/^phase8f_round2_[0-9a-f]{32}$/.test(name)) throw Error("Unsafe scratch database identifier");
    await admin.query(`create database "${name}" template template0`); created=true;
    url.pathname=`/${name}`;
    for (let i=0;i<3;i++) { const client=new Client({connectionString:url.toString()}); clients.push(client); await client.connect(); }
    [observer,first,second]=clients;
    await observer.query(`create schema auth; create schema extensions;
      create extension pgcrypto with schema extensions;
      create table auth.users(id uuid primary key,email text);
      grant usage on schema public,auth to anon,authenticated,service_role;`);
    await observer.query(authUid);
    await observer.query("grant execute on function auth.uid() to anon,authenticated,service_role");
    for (const file of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort()) {
      await observer.query("begin");
      try { await observer.query(readFileSync(`supabase/migrations/${file}`,"utf8")); await observer.query("commit"); }
      catch (error) { await observer.query("rollback"); throw new Error(`Scratch migration ${file} failed`,{cause:error}); }
    }
    secondPid=(await second.query("select pg_backend_pid() as pid")).rows[0].pid;
  },30000);
  beforeEach(async () => {
    user=randomUUID(); source=randomUUID();
    await observer.query("insert into auth.users(id,email) values($1,$2)",[user,`${user}@example.test`]);
    await observer.query(`insert into quests(id,user_id,title,quest_type,quest_size,status)
      values($1,$2,'Concurrent Epic','skill','epic','completed')`,[source,user]);
    const domain=randomUUID(),skill=randomUUID(),activity=randomUUID(),assessment=randomUUID();
    await observer.query("insert into domains(id,user_id,name,slug) values($1,$2,'Existing Core',$3)",[domain,user,domain]);
    await observer.query("insert into skills(id,user_id,domain_id,name,xp,mastery_level) values($1,$2,$3,'Existing',500,3)",[skill,user,domain]);
    await observer.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Existing','Verified','confirmed','8f-race')",[activity,user]);
    await observer.query("insert into ai_assessments(id,user_id,activity_id,rules_version,status,assessment_json) values($1,$2,$3,'8f-race','confirmed','{}')",[assessment,user,activity]);
    await observer.query(`insert into xp_transactions(user_id,activity_id,assessment_id,domain_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot)
      values($1,$2,$3,$4,$5,500,500,'8f-race','Existing')`,[user,activity,assessment,domain,skill]);
    await observer.query("update player_states set total_xp=500 where user_id=$1",[user]);
    await observer.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'Existing',true)",[user,activity,skill]);
    core=await coreSnapshot();
  });
  afterEach(async () => {
    await first.query("rollback"); await second.query("rollback");
    expect(await coreSnapshot()).toEqual(core);
  });
  afterAll(async () => {
    for (const client of clients) await client.end();
    if (created) {
      // Only our cryptographically random, newly-created scratch DB; never the
      // supplied connection database, no FORCE or connection termination.
      if (!/^phase8f_round2_[0-9a-f]{32}$/.test(name)) throw Error("Unsafe scratch database identifier");
      await admin.query(`drop database "${name}"`);
      expect((await admin.query("select 1 from pg_database where datname=$1",[name])).rowCount).toBe(0);
    }
    await admin.end();
  });

  test.each(["confirm","settle","revoke"])("%s same-key replay serializes and creates one mutation",async operation=>{
    const key=randomUUID(); let request: Call;
    if (operation==="confirm") request=confirm(key);
    else { const m=await once(confirm()); if (operation==="revoke") await once(settle(m.milestone.id));
      request=operation==="settle" ? settle(m.milestone.id,key) : revoke(m.milestone.id,key); }
    const {winner,loser}=await race(request,request);
    expect(loser).toMatchObject({status:"fulfilled",value:{...winner,replayed:true}});
    expect(await counts()).toEqual({milestones:1,earns:operation==="confirm" ? 0 : 1,
      corrections:operation==="revoke" ? 1 : 0,audits:operation==="confirm" ? 1 : operation==="settle" ? 2 : 3,
      accounts:operation==="confirm" ? 0 : 1});
  });
  test.each(["confirm","settle","revoke"])("%s same-key changed input conflicts without partial writes",async operation=>{
    const key=randomUUID(); let a: Call; let b: Call;
    if(operation==="confirm") {a=confirm(key);b=confirm(key,"Different");}
    else {const m=await once(confirm()); if(operation==="revoke") await once(settle(m.milestone.id));
      a=operation==="settle" ? settle(m.milestone.id,key) : revoke(m.milestone.id,key);
      b=operation==="settle" ? settle(m.milestone.id,key,"future") : revoke(m.milestone.id,key,"Changed");}
    conflict((await race(a,b)).loser,"IDEMPOTENCY_KEY_REUSED");
    expect((await counts()).audits).toBe(operation==="confirm" ? 1 : operation==="settle" ? 2 : 3);
  });
  test.each([true,false])("direct grant versus settle, direct-first=%s",async directFirst=>{
    const m=await once(confirm()); const a=grant(),b=settle(m.milestone.id);
    const result=await race(directFirst ? a : b,directFirst ? b : a);
    conflict(result.loser,directFirst ? "REWARD_ALREADY_MINTED_FOR_SOURCE" : "REWARD_SOURCE_ALREADY_GRANTED");
    expect(await counts()).toEqual({milestones:1,earns:1,corrections:0,audits:2,accounts:1});
    const row=(await observer.query("select granted_reward_credit from milestones where id=$1",[m.milestone.id])).rows[0];
    expect(row.granted_reward_credit).toBe(!directFirst);
  });
  test.each([true,false])("direct correction versus revoke, direct-first=%s",async directFirst=>{
    const m=await once(confirm()); const earned=await once(settle(m.milestone.id));
    const a=correct(earned.transaction.id),b=revoke(m.milestone.id);
    const result=await race(directFirst ? a : b,directFirst ? b : a);
    if(directFirst) expect(result.loser).toMatchObject({status:"fulfilled",value:{correction_reused:true}});
    else conflict(result.loser,"REWARD_TRANSACTION_ALREADY_CORRECTED");
    expect((await counts()).corrections).toBe(1);
    expect((await counts()).audits).toBe(directFirst ? 4 : 3);
    expect((await observer.query("select status from milestones where id=$1",[m.milestone.id])).rows[0].status).toBe("REVOKED");
  });
  test("two different-key revokes reverse a funded milestone exactly once",async()=>{
    const m=await once(confirm()); await once(settle(m.milestone.id));
    conflict((await race(revoke(m.milestone.id),revoke(m.milestone.id))).loser,"MILESTONE_ALREADY_REVOKED");
    expect(await counts()).toEqual({milestones:1,earns:1,corrections:1,audits:3,accounts:1});
  });
  test("competing milestone keys for one canonical source block on actual unique-index transaction",async()=>{
    conflict((await race(confirm(),confirm(randomUUID(),"Other key"),"transactionid")).loser,"MILESTONE_ALREADY_EXISTS");
    expect(await counts()).toEqual({milestones:1,earns:0,corrections:0,audits:1,accounts:0});
  });
  test.each([true,false])("proposal versus direct confirm, proposal-first=%s",async proposalFirst=>{
    const id=await proposal(); const a=review(id),b=confirm();
    conflict((await race(proposalFirst ? a : b,proposalFirst ? b : a,"transactionid")).loser,"MILESTONE_ALREADY_EXISTS");
    expect((await observer.query("select status from outer_loop_proposals where id=$1",[id])).rows[0].status)
      .toBe(proposalFirst ? "ACCEPTED" : "PROPOSED");
    expect(await counts()).toEqual({milestones:1,earns:0,corrections:0,audits:1,accounts:0});
  });
  test.each(["same","different-key","different-decision"])("proposal CAS %s",async kind=>{
    const id=await proposal(); const key=randomUUID();
    const result=await race(review(id,key),review(id,kind==="different-key" ? randomUUID() : key,kind==="different-decision" ? "REJECTED" : "ACCEPTED"),
      kind==="different-key" ? "transactionid" : "advisory");
    if(kind==="same") expect(result.loser).toMatchObject({status:"fulfilled",value:{...result.winner,replayed:true}});
    else conflict(result.loser,kind==="different-key" ? "PROPOSAL_ALREADY_REVIEWED" : "IDEMPOTENCY_KEY_REUSED");
    expect((await counts()).audits).toBe(1); expect((await counts()).milestones).toBe(1);
  });
  test.each([true,false])("shared global key with 8E, grant-first=%s",async grantFirst=>{
    const key=randomUUID(); const a=grant(key),b=confirm(key);
    conflict((await race(grantFirst ? a : b,grantFirst ? b : a)).loser,"IDEMPOTENCY_KEY_REUSED");
    expect(await counts()).toEqual({milestones:grantFirst ? 0 : 1,earns:grantFirst ? 1 : 0,corrections:0,audits:1,accounts:grantFirst ? 1 : 0});
  });
  test("bounded account-lock timeout rolls back all attempted settlement writes",async()=>{
    const m=await once(confirm());
    await first.query("begin"); await first.query("select phase8e_lock_reward_account_key($1)",[user]);
    await begin(second); await second.query("set local lock_timeout='400ms'");
    const pending=Promise.allSettled([execute(second,settle(m.milestone.id))]);
    expect(await waiting()).toBe("advisory");
    const result=(await pending)[0];
    expect(result).toMatchObject({status:"rejected",reason:{code:"55P03"}});
    await second.query("rollback"); await first.query("rollback");
    expect(await counts()).toEqual({milestones:1,earns:0,corrections:0,audits:1,accounts:0});
  });
});
