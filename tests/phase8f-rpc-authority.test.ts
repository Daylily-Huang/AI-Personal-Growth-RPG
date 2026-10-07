import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

const url = process.env.XP_RPG_TEST_DB_URL;
const foundation = readFileSync("supabase/migrations/0051_phase8f_milestones_foundation.sql", "utf8");
const authority = readFileSync("supabase/migrations/0052_phase8f_milestones_rpc_authority.sql", "utf8");
type Payload = Record<string, unknown>;
const confirmSql = "select public.rpc_confirm_milestone($1,$2,$3,$4,$5,$6,$7,$8,$9) as r";
const privateSignatures = ["phase8f_trim_text(text)", "phase8f_normalize_payload(jsonb)", "phase8f_begin_request(uuid,text,text,text,jsonb,text)",
  "phase8f_write_audit(uuid,text,text,uuid,text,text,text,text,jsonb,text,jsonb)", "phase8f_validate_source(uuid,text,text,text)",
  "phase8f_confirm_record(uuid,jsonb,text)", "phase8e_review_outer_loop_proposal(uuid,text,jsonb,text,text)"];

test("0052 scope has no Core mutations, table DDL or nested public financial/confirm RPC", () => {
  expect(authority).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE) public\.(?:quests|skills|seasons|season_reviews|mastery_verifications|xp_transactions|mastery_events|evidence_records)\b/i);
  expect(authority).not.toMatch(/CREATE TABLE|ALTER TABLE|DROP TABLE/i);
  expect(authority).not.toMatch(/(?:PERFORM|SELECT|:=) public\.rpc_(?:grant_reward_credit|correct_reward_transaction|confirm_milestone)\(/i);
  expect(authority.match(/CREATE FUNCTION public\.rpc_/g)).toHaveLength(4);
});

describe.skipIf(!url)("8F Round2 rollback-only authority", () => {
  const pg = new Client({ connectionString: url });
  let hasFoundation: boolean; let hasAuthority: boolean;
  let u: string; let foreign: string; let quest: string; let foreignQuest: string; let skill: string; let season: string;
  let core: unknown; let oldDispatcher: string;
  async function rpc(sql: string, args: unknown[]) { return (await pg.query(sql, args)).rows[0].r; }
  function input(overrides: Payload = {}): Payload {
    return { milestone_key: "epic", title: "Real achievement", description: null, recognition_class: "CORE_VERIFIED",
      source_type: "QUEST", source_id: quest, external_evidence_url: null, external_credential_id: null, ...overrides };
  }
  async function confirm(overrides: Payload = {}, key: string = randomUUID()) {
    const p = input(overrides);
    return rpc(confirmSql, [p.milestone_key,p.title,p.description,p.recognition_class,p.source_type,p.source_id,
      p.external_evidence_url,p.external_credential_id,key]);
  }
  const settle = (id: string | null, key: string = randomUUID(), policy: string | null = "reward-v1") =>
    rpc("select public.rpc_settle_milestone_reward($1,$2,$3) as r", [id,policy,key]);
  const revoke = (id: string | null, key: string = randomUUID(), reason: string | null = "Withdraw") =>
    rpc("select public.rpc_revoke_milestone($1,$2,$3) as r", [id,reason,key]);
  async function denied(run: () => Promise<unknown>, message: string, code?: string) {
    await pg.query("savepoint expected_denial");
    let error: unknown;
    try { await run(); } catch (caught) { error = caught; }
    await pg.query("rollback to savepoint expected_denial");
    await pg.query("release savepoint expected_denial");
    expect(error).toMatchObject({ message: expect.stringContaining(message), ...(code ? { code } : {}) });
  }
  async function as(id = u, name = "authenticated") {
    await pg.query(`set local role ${name}`);
    await pg.query("select set_config('request.jwt.claim.sub',$1,true)", [id]);
  }
  async function snapshot(tables: string[]) {
    const result: Record<string, unknown> = {};
    for (const table of tables) result[table] = (await pg.query(`select to_jsonb(t) as row from public.${table} t
      where user_id=any($1::uuid[]) order by to_jsonb(t)::text`, [[u,foreign]])).rows;
    return result;
  }
  const coreTables = ["player_states","domains","quests","skills","activities","ai_assessments","xp_transactions","mastery_events",
    "mastery_verifications","evidence_records","knowledge_nodes","artifacts","seasons","season_reviews"];
  const financialTables = ["reward_accounts","reward_transactions","reward_redemptions","wishes"];
  async function proposal(payload = input(), version = 2, expired = false, type = "MILESTONE_CANDIDATE") {
    await pg.query("reset role");
    const id = randomUUID();
    await pg.query(`insert into outer_loop_proposals(id,user_id,proposal_type,schema_version,payload,created_at,expires_at)
      values($1,$2,$3,$4,$5,clock_timestamp()-interval '2 days',clock_timestamp()+$6::interval)`,
    [id,u,type,version,payload,expired ? "-1 day" : "1 day"]);
    await as(); return id;
  }
  const review = (id: string, decision = "ACCEPTED", edited: Payload | null = null, key: string = randomUUID(), reason: string | null = null) =>
    rpc("select public.rpc_review_outer_loop_proposal($1,$2,$3,$4,$5) as r", [id,decision,edited,reason,key]);

  beforeAll(async () => {
    await pg.connect();
    hasFoundation = (await pg.query("select to_regclass('public.milestones') is not null as v")).rows[0].v;
    hasAuthority = (await pg.query("select to_regprocedure('public.rpc_settle_milestone_reward(uuid,text,text)') is not null as v")).rows[0].v;
    oldDispatcher = (await pg.query(`select prosrc from pg_proc where oid=
      coalesce(to_regprocedure('public.phase8e_review_outer_loop_proposal(uuid,text,jsonb,text,text)'),
      to_regprocedure('public.rpc_review_outer_loop_proposal(uuid,text,jsonb,text,text)'))`)).rows[0].prosrc;
  });
  beforeEach(async () => {
    await pg.query("begin");
    await pg.query("set local lock_timeout='3s'");
    if (!hasFoundation) await pg.query(foundation);
    if (!hasAuthority) await pg.query(authority);
    u=randomUUID(); foreign=randomUUID(); quest=randomUUID(); foreignQuest=randomUUID(); skill=randomUUID(); season=randomUUID();
    await pg.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [u,`${u}@example.test`,foreign,`${foreign}@example.test`]);
    await pg.query(`insert into quests(id,user_id,title,quest_type,quest_size,status) values
      ($1,$2,'Epic','skill','epic','completed'),($3,$4,'Foreign','skill','epic','completed')`, [quest,u,foreignQuest,foreign]);
    const domain=randomUUID();
    await pg.query("insert into domains(id,user_id,name,slug) values($1,$2,'Milestone',$3)", [domain,u,domain]);
    await pg.query("insert into skills(id,user_id,domain_id,name,xp,mastery_level) values($1,$2,$3,'Verified',500,10)", [skill,u,domain]);
    const activity=randomUUID(), assessment=randomUUID();
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Existing Core','Verified fixture','confirmed','8f-fixture')",[activity,u]);
    await pg.query("insert into ai_assessments(id,user_id,activity_id,rules_version,status,assessment_json) values($1,$2,$3,'8f-fixture','confirmed','{}')",[assessment,u,activity]);
    await pg.query(`insert into xp_transactions(user_id,activity_id,assessment_id,domain_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot)
      values($1,$2,$3,$4,$5,500,500,'8f-fixture','Verified')`,[u,activity,assessment,domain,skill]);
    await pg.query("update player_states set total_xp=500 where user_id=$1",[u]);
    await pg.query(`insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified)
      values($1,$2,$3,3,'Existing verified evidence',true)`,[u,activity,skill]);
    for (const level of [6,8,10]) await pg.query(`insert into mastery_verifications
      (user_id,skill_id,skill_name,from_level,to_level,evidence_level,status,resolved_at)
      values($1,$2,'Verified',$3,$4,6,'verified',clock_timestamp())`, [u,skill,level-1,level]);
    await pg.query(`insert into seasons(id,user_id,name,status,started_at,ended_at)
      values($1,$2,'Completed','COMPLETED',clock_timestamp()-interval '30 days',clock_timestamp())`, [season,u]);
    await pg.query(`insert into season_reviews(user_id,season_id,review_type,version,commit_key,period_start,period_end,
      objective_summary,qualitative_reflection,criteria_evaluation) values
      ($1,$2,'FINAL',1,gen_random_uuid(),clock_timestamp()-interval '30 days',clock_timestamp(),'{}','Final','{}')`, [u,season]);
    core=await snapshot(coreTables); await as();
  });
  afterEach(async () => {
    try { await pg.query("reset role"); expect(await snapshot(coreTables)).toEqual(core); }
    finally { await pg.query("rollback"); }
  });
  afterAll(async () => { await pg.end(); });

  test("exact private execution grants and old dispatcher body preserved", async () => {
    await pg.query("reset role");
    for (const name of ["anon","authenticated","service_role"]) for (const sig of privateSignatures)
      expect((await pg.query("select has_function_privilege($1,$2,'EXECUTE') as v",[name,sig])).rows[0].v).toBe(false);
    expect((await pg.query("select prosrc from pg_proc where oid='public.phase8e_review_outer_loop_proposal(uuid,text,jsonb,text,text)'::regprocedure")).rows[0].prosrc).toBe(oldDispatcher);
  });
  test("confirm, settle, revoke and replay preserve original snapshots and one audit each", async () => {
    const c=randomUUID(),s=randomUUID(),r=randomUUID();
    const first=await confirm({},c); const funded=await settle(first.milestone.id,s); const revoked=await revoke(first.milestone.id,r);
    expect(funded.transaction.amount).toBe(150); expect(revoked.correction.amount).toBe(-150);
    expect(revoked.milestone).toMatchObject({status:"REVOKED",granted_reward_credit:true,reward_transaction_id:funded.transaction.id});
    expect(revoked.account).toMatchObject({lifetime_earned:150,net_earned:0,current_available:0});
    expect(await confirm({},c)).toEqual({...first,replayed:true});
    expect(await settle(first.milestone.id,s)).toEqual({...funded,replayed:true});
    expect(await revoke(first.milestone.id,r)).toEqual({...revoked,replayed:true});
    await pg.query("reset role");
    expect((await pg.query("select event_type from outer_loop_audit_events where user_id=$1 order by created_at",[u])).rows)
      .toEqual(["MILESTONE_CONFIRMED","MILESTONE_REWARD_SETTLED","MILESTONE_REVOKED"].map(event_type=>({event_type})));
  });
  test.each(["title","description","milestone_key","source_id","external_evidence_url","external_credential_id"])("confirmation key binds changed %s before lookup", async field => {
    const key=randomUUID(); await confirm({},key);
    await denied(()=>confirm({[field]:field==="source_id" ? foreignQuest : "changed"},key),"IDEMPOTENCY_KEY_REUSED","23505");
  });
  test.each(["QUEST","SEASON"])("%s UUID aliases normalize without second recognition", async type => {
    const id=type==="QUEST" ? quest : season; const key=randomUUID();
    const a=await confirm({source_type:type,source_id:id},key);
    expect(await confirm({source_type:type.toLowerCase(),source_id:id.replaceAll("-","").toUpperCase()},key)).toEqual({...a,replayed:true});
    await denied(()=>confirm({milestone_key:"different",source_type:type,source_id:`{${id}}`}),"MILESTONE_ALREADY_EXISTS","23505");
    await revoke(a.milestone.id);
    await denied(()=>confirm({source_type:type,source_id:id}),"MILESTONE_ALREADY_EXISTS","23505");
  });
  test.each([6,8,10])("exact verified Mastery M%s uses frozen reward amount", async level => {
    const row=await confirm({source_type:"MASTERY",source_id:`${skill.toUpperCase()}:M${level}`});
    expect((await settle(row.milestone.id)).transaction.amount).toBe(({6:100,8:150,10:250} as Record<number,number>)[level]);
  });
  test("completed Season with FINAL review settles frozen 150", async () => {
    const row=await confirm({source_type:"SEASON",source_id:season});
    expect((await settle(row.milestone.id)).transaction.amount).toBe(150);
  });
  test.each(["", "malformed", "00000000-0000-0000-0000-000000000000:M6", "M6", "bad:M06"])("malformed identity %s denied without residue", async id => {
    await denied(()=>confirm({source_type:"MASTERY",source_id:id}),"INVALID_","22023");
    expect((await pg.query("select count(*)::int as n from milestones")).rows[0].n).toBe(0);
  });
  test.each(["ARTIFACT","DAILY_LOGIN","STREAK","FOCUS_TIME"])("%s recognition stays unavailable", async type => {
    await denied(()=>confirm({source_type:type}),"INVALID_RECOGNITION_SOURCE_CLASS","22023");
  });
  test("foreign and absent source are uniform 404; blank auth rejected", async () => {
    for (const id of [foreignQuest,randomUUID()]) await denied(()=>confirm({source_id:id}),"MILESTONE_SOURCE_NOT_FOUND","P0002");
    await as(""); await denied(()=>confirm(),"UNAUTHORIZED","28000");
  });
  test("real-world links are descriptive, no account even after revoke", async () => {
    const a=await confirm({recognition_class:"USER_CONFIRMED_REAL_WORLD",source_type:"EXTERNAL_CREDENTIAL",
      source_id:randomUUID(),external_evidence_url:"http://127.0.0.1/private",external_credential_id:"self-attested"});
    await denied(()=>settle(a.milestone.id),"INELIGIBLE_FOR_REWARD","P0001");
    expect((await revoke(a.milestone.id)).correction).toBeNull();
    await pg.query("reset role");
    expect(await snapshot(financialTables)).toEqual(Object.fromEntries(financialTables.map(t=>[t,[]])));
  });
  test("manual EARN including corrected EARN cannot be attached or minted again", async () => {
    const a=await confirm();
    const earn=await rpc("select rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2) as r",[quest,randomUUID()]);
    await denied(()=>settle(a.milestone.id),"REWARD_ALREADY_MINTED_FOR_SOURCE","23505");
    await rpc("select rpc_correct_reward_transaction($1,'manual',$2) as r",[earn.transaction.id,randomUUID()]);
    await denied(()=>settle(a.milestone.id),"REWARD_ALREADY_MINTED_FOR_SOURCE","23505");
    const result=await revoke(a.milestone.id);
    expect(result.correction).toBeNull(); expect(result.milestone.granted_reward_credit).toBe(false);
  });
  test("prior correction is reused, original funded provenance and account timestamp unchanged", async () => {
    const a=await confirm(); const funded=await settle(a.milestone.id);
    const corrected=await rpc("select rpc_correct_reward_transaction($1,'manual',$2) as r",[funded.transaction.id,randomUUID()]);
    const result=await revoke(a.milestone.id);
    expect(result.correction_reused).toBe(true); expect(result.correction).toEqual(corrected.transaction);
    expect(result.account).toEqual(corrected.account);
    expect(result.milestone.reward_transaction_id).toBe(funded.transaction.id);
    await denied(()=>revoke(a.milestone.id),"MILESTONE_ALREADY_REVOKED","23505");
  });
  test("global key collision and changed policy/reason precede missing target or lifecycle", async () => {
    const a=await confirm(); const s=randomUUID(),r=randomUUID(); await settle(a.milestone.id,s); await revoke(a.milestone.id,r);
    await denied(()=>settle(randomUUID(),s),"IDEMPOTENCY_KEY_REUSED","23505");
    await denied(()=>settle(a.milestone.id,s,"future"),"IDEMPOTENCY_KEY_REUSED","23505");
    await denied(()=>revoke(a.milestone.id,r,"different"),"IDEMPOTENCY_KEY_REUSED","23505");
    await denied(()=>revoke(null,s),"IDEMPOTENCY_KEY_REUSED","23505");
    await denied(()=>rpc("select rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2) as r",[quest,s]),"IDEMPOTENCY_KEY_REUSED","23505");
  });
  test.each(["ACCEPTED","EDITED","REJECTED"])("v2 proposal %s is atomic, replayable and never funds", async decision => {
    const original=input(); const id=await proposal(original); const key=randomUUID();
    const edited=decision==="EDITED" ? input({title:"Edited"}) : null;
    const first=await review(id,decision,edited,key);
    expect(first.proposal.status).toBe(decision); expect(first.proposal.payload).toEqual(original);
    expect(first.milestone===null).toBe(decision==="REJECTED");
    expect(await review(id,decision,edited,key)).toEqual({...first,replayed:true});
    await denied(()=>review(id,decision,edited,key,"changed"),"IDEMPOTENCY_KEY_REUSED","23505");
    await denied(()=>review(id,decision,edited),"PROPOSAL_ALREADY_REVIEWED","23505");
    await pg.query("reset role");
    expect(await snapshot(financialTables)).toEqual(Object.fromEntries(financialTables.map(t=>[t,[]])));
    expect((await pg.query("select count(*)::int as n from outer_loop_audit_events where user_id=$1",[u])).rows[0].n).toBe(1);
  });
  test.each(["amount","reward_credit_value","user_id","granted_reward_credit","reward_transaction_id"])("proposal rejects unknown authority key %s", async field => {
    const id=await proposal(input({[field]:150}));
    await denied(()=>review(id),"PAYLOAD_VALIDATION_FAILED","22023");
    expect((await pg.query("select status from outer_loop_proposals where id=$1",[id])).rows[0].status).toBe("PROPOSED");
  });
  test("v1 reject-only and expiry fail closed", async () => {
    const id=await proposal(input(),1);
    for (const decision of ["ACCEPTED","EDITED"]) await denied(()=>review(id,decision,decision==="EDITED" ? input() : null),"SCHEMA_VALIDATION_FAILED","22023");
    expect((await review(id,"REJECTED")).milestone).toBeNull();
    const expired=await proposal(input(),1,true);
    await denied(()=>review(expired,"REJECTED"),"PROPOSAL_EXPIRED","22023");
  });
  test("proposal partial EDIT and ACCEPT with edited data fail closed", async () => {
    const id=await proposal();
    await denied(()=>review(id,"EDITED",{title:"partial"}),"PAYLOAD_VALIDATION_FAILED","22023");
    await denied(()=>review(id,"ACCEPTED",input()),"PAYLOAD_VALIDATION_FAILED","22023");
  });

  async function seed(sql: string, args: unknown[]) {
    await pg.query("reset role");
    expect(await snapshot(coreTables)).toEqual(core);
    await pg.query(sql,args); core=await snapshot(coreTables); await as();
  }
  test.each([
    ["major",false,false], ["minor",false,false], ["epic",false,true], ["main",false,true], ["major",true,true],
  ] as const)("Quest size=%s boss=%s meets independent recognition predicate=%s",async(size,boss,eligible)=>{
    await seed("update quests set quest_size=$2,is_boss=$3 where id=$1",[quest,size,boss]);
    if(!eligible) await denied(()=>confirm(),"MILESTONE_SOURCE_NOT_ELIGIBLE","P0001");
    else {const m=await confirm(); expect((await settle(m.milestone.id)).transaction.amount).toBe(size==="epic" ? 150 : 200);}
  });
  test("cached M10 without exact verification cannot recognize M6",async()=>{
    const id=randomUUID();
    await seed(`insert into skills(id,user_id,domain_id,name,mastery_level)
      select $1,$2,domain_id,'Cached only',10 from skills where id=$3`,[id,u,skill]);
    await denied(()=>confirm({source_type:"MASTERY",source_id:`${id}:M6`}),"MILESTONE_SOURCE_NOT_ELIGIBLE","P0001");
  });
  test.each(["DRAFT","COMPLETED"])("Season %s without FINAL review is ineligible",async status=>{
    const id=randomUUID();
    await seed(`insert into seasons(id,user_id,name,status,started_at,ended_at)
      values($1,$2,'No final',$3,case when $3='COMPLETED' then clock_timestamp()-interval '1 day' end,
        case when $3='COMPLETED' then clock_timestamp() end)`,[id,u,status]);
    await denied(()=>confirm({source_type:"SEASON",source_id:id}),"MILESTONE_SOURCE_NOT_ELIGIBLE","P0001");
  });
  test("settlement rechecks source after recognition and failed write creates no account",async()=>{
    const m=await confirm();
    await seed("update quests set quest_size='major',is_boss=false where id=$1",[quest]);
    await denied(()=>settle(m.milestone.id),"MILESTONE_SOURCE_NOT_ELIGIBLE","P0001");
    await pg.query("reset role");
    expect(await snapshot(financialTables)).toEqual(Object.fromEntries(financialTables.map(t=>[t,[]])));
  });
  test.each(["confirm","settle","revoke"])("%s RPC execution denied to anon and service_role",async operation=>{
    const m=await confirm();
    for(const name of ["anon","service_role"]) {
      await as(u,name);
      await denied(()=>operation==="confirm" ? confirm() : operation==="settle" ? settle(m.milestone.id) : revoke(m.milestone.id),"permission denied","42501");
      await pg.query("reset role");
    }
  });
  test.each(["settle","revoke"])("%s target foreign/missing uniform and zero residue",async operation=>{
    const row=await confirm(); await as(foreign);
    for(const id of [row.milestone.id,randomUUID()])
      await denied(()=>operation==="settle" ? settle(id) : revoke(id),"MILESTONE_NOT_FOUND","P0002");
    await pg.query("reset role");
    expect(await snapshot(financialTables)).toEqual(Object.fromEntries(financialTables.map(t=>[t,[]])));
  });
  test.each(["confirm","settle","revoke","proposal"])("audit failure rolls back the complete %s transaction",async operation=>{
    let id: string | undefined;
    if(operation==="settle" || operation==="revoke") {id=(await confirm()).milestone.id; if(operation==="revoke") await settle(id!);}
    if(operation==="proposal") id=await proposal();
    await pg.query("reset role");
    const tables=[...financialTables,"milestones","outer_loop_audit_events","outer_loop_proposals"];
    const before=await snapshot(tables);
    // Additional failure injection only; never disable existing integrity guards.
    await pg.query(`create function pg_temp.phase8f_audit_failure() returns trigger language plpgsql as $$
      begin raise exception 'TEST_AUDIT_FAILURE' using errcode='P0001'; end; $$;
      create trigger phase8f_test_audit_failure before insert on outer_loop_audit_events
      for each row execute function pg_temp.phase8f_audit_failure()`);
    await as();
    await denied(()=>operation==="confirm" ? confirm() : operation==="settle" ? settle(id!) : operation==="revoke" ? revoke(id!) : review(id!),
      "TEST_AUDIT_FAILURE","P0001");
    await pg.query("reset role"); expect(await snapshot(tables)).toEqual(before);
  });
  test("old WISH branch result and historical errors remain delegated",async()=>{
    await pg.query("reset role"); const wish=randomUUID();
    await pg.query("insert into wishes(id,user_id,title,credit_cost) values($1,$2,'Existing',10)",[wish,u]);
    const id=await proposal({wish_id:wish,suggested_credits:25},1,false,"WISH_COST_SUGGESTION");
    const key=randomUUID(); const result=await review(id,"ACCEPTED",null,key);
    expect(result).toMatchObject({proposal:{status:"ACCEPTED"},result:{wish_id:wish},replayed:false});
    expect(await review(id,"ACCEPTED",null,key)).toMatchObject({result:{wish_id:wish},replayed:true});
    await denied(()=>review(id,"ACCEPTED"),"PROPOSAL_ALREADY_REVIEWED","23514");
    expect((await pg.query("select count(*)::int as n from milestones")).rows[0].n).toBe(0);
  });
  test.each(["\t","\n","\r\n"," \t\n ","\u00a0","\u3000","\u2000","\ufeff"])("nonblank fields reject whitespace-only %j",async blank=>{
    expect(blank.trim()).toBe("");
    await denied(()=>confirm({title:blank}),"INVALID_MILESTONE_PAYLOAD","22023");
    await denied(()=>confirm({milestone_key:blank}),"INVALID_MILESTONE_PAYLOAD","22023");
    await denied(()=>confirm({},blank),"INVALID_IDEMPOTENCY_KEY","22023");
    const p=await proposal(input({title:blank}));
    await denied(()=>review(p),"PAYLOAD_VALIDATION_FAILED","22023");
    await denied(()=>review(p,"EDITED",input({milestone_key:blank})),"PAYLOAD_VALIDATION_FAILED","22023");
    const m=await confirm();
    await denied(()=>revoke(m.milestone.id,randomUUID(),blank),"MISSING_REVOCATION_REASON","22023");
  });
  test("revoke after spending creates deficit without changing XP, receipts or Wishes; next EARN repays it",async()=>{
    const m=await confirm(); await settle(m.milestone.id);
    const wish=(await pg.query("insert into wishes(user_id,title,credit_cost) values($1,'Earned celebration',150) returning id",[u])).rows[0].id;
    for(const name of ["rpc_activate_wish","rpc_set_primary_wish","rpc_reserve_wish_credits"])
      await rpc(`select ${name}($1,$2) as r`,[wish,randomUUID()]);
    await rpc("select rpc_redeem_wish($1,'Celebrate',$2) as r",[wish,randomUUID()]);
    await pg.query("reset role"); const receipts=await snapshot(["reward_redemptions","wishes"]); await as();
    const result=await revoke(m.milestone.id);
    expect(result.account).toMatchObject({lifetime_earned:150,net_earned:0,current_available:0,
      lifetime_redeemed:150,current_reserved:0,correction_deficit:150});
    await pg.query("reset role"); expect(await snapshot(["reward_redemptions","wishes"])).toEqual(receipts); await as();
    const next=randomUUID();
    await seed("insert into quests(id,user_id,title,quest_type,quest_size,status) values($1,$2,'Next','skill','main','completed')",[next,u]);
    const credit=await rpc("select rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2) as r",[next,randomUUID()]);
    expect(credit.account).toMatchObject({lifetime_earned:350,net_earned:200,current_available:50,correction_deficit:0});
    await pg.query("reset role"); expect(await snapshot(["reward_redemptions","wishes"])).toEqual(receipts);
    expect((await pg.query("select sum(amount)::int as xp from xp_transactions where user_id=$1",[u])).rows[0].xp).toBe(500);
  });
});
