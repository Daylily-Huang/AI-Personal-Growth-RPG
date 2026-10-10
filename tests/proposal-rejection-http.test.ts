import http from "node:http";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import next from "next";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { AssessmentProposalSchema } from "@/lib/ai/schemas";
import { playerLevelFromXp } from "@/lib/growth-engine/levels";
import { PROPOSAL_REJECTION_ALLOWED, PROPOSAL_REJECTION_PRODUCTION } from "./helpers/governance-delta";

export function normalizedRejectionConfig(value: unknown): { url: string; publishableKey: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("REJECTION_CONFIG_UNBOUND");
  const url = Object.getOwnPropertyDescriptor(value, "url"), key = Object.getOwnPropertyDescriptor(value, "publishableKey");
  if (!url || !key || !Object.hasOwn(url, "value") || !Object.hasOwn(key, "value") || typeof url.value !== "string" || typeof key.value !== "string" || !url.value.trim() || !key.value.trim())
    throw Error("REJECTION_CONFIG_UNBOUND");
  return { url: url.value.trim(), publishableKey: key.value.trim() };
}
export function assertRejectionBuildBinding(build: unknown, runtime: unknown) {
  const compiled = normalizedRejectionConfig(build), current = normalizedRejectionConfig(runtime);
  if (compiled.url !== current.url || compiled.publishableKey !== current.publishableKey) throw Error("REJECTION_CONFIG_UNBOUND");
  return current;
}
describe("Reject startup public tuple before dispatch", () => {
  const compiled = { url: "http://127.0.0.1:54331", publishableKey: "synthetic-public-key" };
  test.each([{ ...compiled, url: undefined }, { ...compiled, publishableKey: undefined }, { ...compiled, url: " \t" },
    { ...compiled, publishableKey: " \n" }, { ...compiled, url: "http://127.0.0.1:54321" }, { ...compiled, publishableKey: "other" }])("bad tuple %# dispatches nothing", runtime => {
    let calls = 0; expect(() => { assertRejectionBuildBinding(compiled, runtime); calls++; }).toThrow("REJECTION_CONFIG_UNBOUND"); expect(calls).toBe(0);
  });
  test("matching normalized tuple permits dispatch", () => { expect(assertRejectionBuildBinding(compiled, { url: ` ${compiled.url}\n`, publishableKey: ` ${compiled.publishableKey}\t` })).toEqual(compiled); });
  test.each([null, [], {}, Object.create(compiled)])("malformed/inherited tuple %# fails closed", value => { expect(() => normalizedRejectionConfig(value)).toThrow("REJECTION_CONFIG_UNBOUND"); });
  test("accessor config is rejected without invoking it", () => {
    let calls = 0; const value = Object.defineProperty({ publishableKey: compiled.publishableKey }, "url", { get: () => { calls++; return compiled.url; } });
    expect(() => normalizedRejectionConfig(value)).toThrow("REJECTION_CONFIG_UNBOUND"); expect(calls).toBe(0);
  });
});

const dbUrl = process.env.XP_RPG_TEST_DB_URL;
type Row = Record<string, unknown>;
type Snapshot = Record<string, Row[]>;
type Actor = { id: string; cookie: string };
type Proposal = { id: string; activityId: string; owner: string; skill: string; raw: string };
describe.skipIf(!dbUrl)("completed-build Reject real session/HTTP/PostgreSQL", () => {
  const pg = new Client({ connectionString: dbUrl });
  let connected = false, app: ReturnType<typeof next> | undefined, server: http.Server | undefined, base: string;
  const actors: Actor[] = [], clients: SupabaseClient[] = [];
  let tables: string[] = [], expected: Snapshot | undefined, own: Proposal, sibling: Proposal, foreign: Proposal;
  const sorted = (rows: Row[]) => rows.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  function chunks(directory: string): string { return readdirSync(directory, { withFileTypes: true }).map(item => item.isDirectory() ? chunks(path.join(directory,item.name)) : item.isFile() && item.name.endsWith(".js") ? readFileSync(path.join(directory,item.name),"utf8") : "").join("\n"); }
  function binding() {
    const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!), db = new URL(dbUrl!);
    if (![api.hostname, db.hostname].every(host => ["127.0.0.1","localhost"].includes(host))) throw Error("Disposable local rejection fixtures only");
    const buildId = readFileSync(".next/BUILD_ID","utf8").trim(); expect(buildId).not.toBe("");
    const runtime = normalizedRejectionConfig({ url: api.origin, publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY });
    const compiled = chunks(".next/static"); if (!compiled.includes(runtime.url) || !compiled.includes(runtime.publishableKey)) throw Error("REJECTION_CONFIG_UNBOUND");
    if (process.env.GITHUB_ACTIONS === "true") { assertRejectionBuildBinding(runtime,runtime); return; }
    const project = process.env.XP_RPG_DISPOSABLE_TEST_STACK, creationPath = process.env.XP_RPG_PROPOSAL_REJECTION_CREATION_RECEIPT,
      buildPath = process.env.XP_RPG_PROPOSAL_REJECTION_BUILD_RECEIPT;
    if (!project || !/^phase8f_(?:r3|test)_[a-z0-9_]+$/.test(project) || api.port !== "54331" || db.port !== "54332" || !creationPath || !buildPath)
      throw Error("Owned Reject stack/completed-build receipts required");
    const creation = JSON.parse(readFileSync(creationPath,"utf8")); expect(creation.project).toBe(project); expect(creation.containers).toHaveLength(4);
    for (const component of ["db","auth","rest","kong"]) {
      const format = '{"id":{{json .Id}},"created":{{json .Created}},"labels":{{json .Config.Labels}},"state":{{json .State.Status}},"ports":{{json .HostConfig.PortBindings}}}';
      const actual = JSON.parse(execFileSync("docker",["inspect","--format",format,`supabase_${component}_${project}`],{encoding:"utf8"}));
      const original = creation.containers.find((row: {component:string}) => row.component === component);
      expect(actual.id).toBe(original.id); expect(actual.created).toBe(original.created); expect(actual.state).toBe("running");
      expect(actual.labels["com.supabase.cli.project"]).toBe(project); expect(actual.labels["com.supabase.cli.workdir"]).toBe(creation.stack);
      if (component === "db" || component === "kong") {
        const ports = actual.ports[component === "db" ? "5432/tcp" : "8000/tcp"]; expect(ports.length).toBeGreaterThan(0);
        expect(ports.every((port: {HostPort:string}) => port.HostPort === (component === "db" ? "54332" : "54331"))).toBe(true);
      }
    }
    const receipt = JSON.parse(readFileSync(buildPath,"utf8")); expect(receipt.cwd).toBe(process.cwd()); expect(receipt.buildId).toBe(buildId);
    for (const [field,revision] of [["head","HEAD"],["tree","HEAD^{tree}"]]) expect(receipt[field]).toBe(execFileSync("git",["rev-parse",revision],{encoding:"utf8"}).trim());
    const sourceFiles = PROPOSAL_REJECTION_ALLOWED.filter(file => /^(src|tests)\//.test(file));
    expect(Object.keys(receipt.sourceHashes).sort()).toEqual([...sourceFiles].sort());
    for (const file of sourceFiles) expect(receipt.sourceHashes[file]).toBe(createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase());
    for (const file of PROPOSAL_REJECTION_PRODUCTION) expect(receipt.productionHashes[file]).toBe(receipt.sourceHashes[file]);
    assertRejectionBuildBinding(receipt.publicConfig,runtime);
  }
  async function actor(): Promise<Actor> {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}}); clients.push(admin);
    const credentials = { email:`reject-http-${randomUUID()}@example.test`,password:`Synthetic!${randomUUID()}x` };
    const created = await admin.auth.admin.createUser({...credentials,email_confirm:true}); if(created.error || !created.data.user) throw Error("Synthetic Reject actor failed");
    const jar = new Map<string,string>();
    const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>{for(const cookie of values)jar.set(cookie.name,cookie.value);}}});
    try { if((await client.auth.signInWithPassword(credentials)).error) throw Error("Synthetic Reject sign-in failed"); }
    finally { client.auth.stopAutoRefresh(); }
    return {id:created.data.user.id,cookie:[...jar].map(([name,value])=>`${name}=${value}`).join("; ")};
  }
  function proposalFixture(skill: string) {
    return AssessmentProposalSchema.parse({activity:{type:"learning",completion:0.7},difficulty:{complexity:0.5,uncertainty:0.4,expertise_gap:0.5,resistance:0.4},
      growth:{effort:0.6,learning:0.7,performance:0.3,outcome:0.5,artifact_value:0,character_evidence:0},evidence:{level:2,explanation:"Explicit synthetic fixture"},
      affected_skills:[{name:skill,reason:"Explicit synthetic primary skill"}],knowledge_updates:{proposed_nodes:[],proposed_edges:[]},mastery_changes:[],
      xp_semantics:{base_value:20,difficulty:0.5,mastery_gain:0.5,novelty:0.5,goal_alignment:0.6,repetition_risk:"low"},artifactProposals:[],artifacts:[],
      next_quest:null,confidence:0.7,uncertainty_notes:["Authored fixture; no AI request"]});
  }
  async function createProposal(who: Actor, existing?: Proposal): Promise<Proposal> {
    const raw = existing?.raw ?? `  Explicit private synthetic original ${randomUUID()}\r\n<script>literal only</script>🙂  `, skill = existing?.skill ?? `Synthetic Reject skill ${randomUUID()}`;
    await pg.query("begin");
    try {
      await pg.query("set local role authenticated"); await pg.query("select set_config('request.jwt.claim.sub',$1,true)",[who.id]);
      const activityId = existing?.activityId ?? (await pg.query("select id from create_activity($1,$2)",["Synthetic Reject HTTP",raw])).rows[0].id;
      await pg.query("set local role service_role");
      const id = (await pg.query("select (record_ai_assessment($1,$2,$3::jsonb,'synthetic-http','synthetic-http',0.7)).id as id",[who.id,activityId,JSON.stringify(proposalFixture(skill))])).rows[0].id;
      await pg.query("commit"); return {id,activityId,owner:who.id,skill,raw};
    } catch(error) {await pg.query("rollback");throw error;}
  }
  async function populate(who: Actor) {
    const skill=randomUUID(),activity=randomUUID(),assessment=randomUUID(),quest=randomUUID();
    await pg.query("insert into skills(id,user_id,name,xp,level,mastery_level,mastery_confidence,status) values($1,$2,'Existing Core',500,$3,8,0.8,'active')",[skill,who.id,playerLevelFromXp(500)]);
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Existing Core','Preserved original','confirmed','reject-http-history')",[activity,who.id]);
    await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json) values($1,$2,$3,'confirmed','reject-http-history',$4)",[assessment,who.id,activity,proposalFixture("Existing Core")]);
    await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot) values($1,$2,$3,$4,500,500,'reject-http-history','Existing Core')",[who.id,activity,assessment,skill]);
    await pg.query("update player_states set total_xp=500,player_level=$2 where user_id=$1",[who.id,playerLevelFromXp(500)]);
    await pg.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'Preserved evidence',true)",[who.id,activity,skill]);
    await pg.query("insert into artifacts(user_id,title,artifact_type,summary) values($1,'Preserved synthetic artifact','document','Synthetic history')",[who.id]);
    await pg.query("insert into quests(id,user_id,title,quest_type,quest_size,status) values($1,$2,'Preserved Major','learning','major','completed')",[quest,who.id]);
    await pg.query("begin");
    try {await pg.query("set local role authenticated");await pg.query("select set_config('request.jwt.claim.sub',$1,true)",[who.id]);
      expect((await pg.query("select rpc_grant_reward_credit('QUEST',$1,'reward-v1',$2) as r",[quest,randomUUID()])).rows[0].r).toMatchObject({ok:true,transaction:{amount:100}});await pg.query("commit");
    }catch(error){await pg.query("rollback");throw error;}
  }
  async function snapshot(): Promise<Snapshot> {
    const result: Snapshot={}; for(const table of tables)for(const who of actors)result[`${table}/${who.id}`]=sorted((await pg.query(`select to_jsonb(t) as r from public.${table} t where user_id=$1`,[who.id])).rows.map(row=>row.r)); return result;
  }
  function statusOnly(before: Snapshot,item: Proposal,status="rejected") {
    const next=structuredClone(before),key=`ai_assessments/${item.owner}`,row=next[key].find(row=>row.id===item.id);expect(row).toBeDefined();row!.status=status;sorted(next[key]);return next;
  }
  async function request(who: Actor|null,id=own.id,options: {method?:string;body?:string;headers?:Record<string,string>;path?:string}={}) {
    const method=options.method??"POST",response=await fetch(base+(options.path??`/api/assessments/${id}/reject`),{method,headers:{...(who?{Cookie:who.cookie}:{}),...(method==="POST"?{"Content-Type":"application/json"}:{}),...options.headers},
      ...(method==="POST"?{body:options.body??"{}"}:{}),redirect:"manual",cache:"no-store"});
    const text=await response.text();let body:unknown;try{body=JSON.parse(text);}catch{body=null;}
    if(method==="POST"&&(!options.path||options.path.includes("/reject"))){expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("vary")).toContain("Cookie");}
    return {status:response.status,body,text};
  }
  const receipt=(item:Proposal)=>({assessment:{id:item.id,activityId:item.activityId,status:"rejected"}});
  async function confirmedDelta(before:Snapshot,item:Proposal,superseded:Proposal[],amount:number) {
    const after=await snapshot();expect(Number.isInteger(amount)&&amount>0).toBe(true);
    for(const key of Object.keys(before)) {
      if(!key.endsWith(`/${item.owner}`)){expect(after[key]).toEqual(before[key]);continue;}
      const table=key.split("/")[0];
      if(table==="activities"||table==="ai_assessments") {
        const ids=table==="activities"?[item.activityId]:[item.id,...superseded.map(row=>row.id)];
        expect(after[key].filter(row=>!ids.includes(String(row.id)))).toEqual(before[key].filter(row=>!ids.includes(String(row.id))));
        for(const id of ids){const old=before[key].find(row=>row.id===id)!,current=after[key].find(row=>row.id===id)!;
          const omit=({status:_s,updated_at:_u,confirmed_at:_c,...rest}:Row)=>{void _s;void _u;void _c;return rest;};
          expect(omit(current)).toEqual(omit(old));expect(current.status).toBe(table==="activities"||id===item.id?"confirmed":"superseded");}
      }else if(table==="player_states") {
        expect(after[key]).toHaveLength(1);expect(after[key][0]).toMatchObject({total_xp:Number(before[key][0].total_xp)+amount,player_level:playerLevelFromXp(Number(before[key][0].total_xp)+amount)});
        const omit=({total_xp:_x,player_level:_l,updated_at:_u,...rest}:Row)=>{void _x;void _l;void _u;return rest;};expect(omit(after[key][0])).toEqual(omit(before[key][0]));
      }else if(["skills","xp_transactions","evidence_records"].includes(table)) {
        const ids=new Set(before[key].map(row=>row.id));expect(after[key].filter(row=>ids.has(row.id))).toEqual(before[key]);
        const added=after[key].filter(row=>!ids.has(row.id));expect(added).toHaveLength(1);
        if(table==="skills")expect(added[0]).toMatchObject({name:item.skill,xp:amount,level:playerLevelFromXp(amount)});
        if(table==="xp_transactions")expect(added[0]).toMatchObject({activity_id:item.activityId,assessment_id:item.id,amount});
        if(table==="evidence_records")expect(added[0]).toMatchObject({activity_id:item.activityId,evidence_level:2});
      }else expect(after[key]).toEqual(before[key]);
    }
    expected=after;
  }
  beforeAll(async()=>{
    binding();await pg.connect();connected=true;
    for(let n=0;n<3;n++){const who=await actor();actors.push(who);await populate(who);}
    tables=(await pg.query("select distinct c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r' and a.attname='user_id' and not a.attisdropped order by c.relname")).rows.map(row=>row.relname as string);
    expect(tables.every(table=>/^[a-z_]+$/.test(table))).toBe(true);expect(tables).toEqual(expect.arrayContaining(["activities","ai_assessments","skills","player_states","xp_transactions","evidence_records","artifacts","quests","reward_accounts","reward_transactions","milestones"]));
    for(const who of actors)for(const table of ["activities","ai_assessments","skills","player_states","xp_transactions","evidence_records","artifacts","quests","reward_accounts","reward_transactions"])
      expect(Number((await pg.query(`select count(*) as n from public.${table} where user_id=$1`,[who.id])).rows[0].n)).toBeGreaterThan(0);
    await new Promise(resolve=>setTimeout(resolve,1500));
    // Next16 constructs Request.url from its configured hostname AND port.
    // Reserve the real ephemeral port first; never suppress Origin to hide a bad harness tuple.
    let ready=false;server=http.createServer((request,response)=>{if(!ready||!app){response.writeHead(503);response.end();return;}void app.getRequestHandler()(request,response);});
    await new Promise<void>(resolve=>server!.listen(0,"127.0.0.1",resolve));const address=server.address();if(!address||typeof address==="string")throw Error("No Reject-owned HTTP port");base=`http://127.0.0.1:${address.port}`;
    app=next({dev:false,hostname:"127.0.0.1",port:address.port,httpServer:server,dir:process.cwd()});await app.prepare();ready=true;
  },90000);
  beforeEach(async()=>{expected=undefined;own=await createProposal(actors[0]);sibling=await createProposal(actors[0],own);foreign=await createProposal(actors[1]);expected=await snapshot();});
  afterEach(async()=>{if(expected)expect(await snapshot()).toEqual(expected);});
  afterAll(async()=>{try{for(const client of clients)client.auth.stopAutoRefresh();if(server){server.closeAllConnections();await new Promise<void>(resolve=>server!.close(()=>resolve()));}if(app)await app.close();}finally{if(connected)await pg.end();}});
  test.each(["own","invalid","foreign"])("anonymous %s is401 before UUID and lookup",async shape=>{const r=await request(null,shape==="invalid"?"constructor":shape==="foreign"?foreign.id:own.id);expect(r.status).toBe(401);expect(r.body).toEqual({error:"Authentication required",code:"auth_required"});});
  test("authenticated invalid UUID is400",async()=>{expect((await request(actors[0],"constructor")).status).toBe(400);});
  test("foreign/missing are indistinguishable and owner query cannot broaden RLS",async()=>{
    const a=await request(actors[0],foreign.id,{path:`/api/assessments/${foreign.id}/reject?user_id=${actors[1].id}&owner=${actors[1].id}`}),b=await request(actors[0],randomUUID());
    expect(a.status).toBe(404);expect(b.status).toBe(404);expect(a.body).toEqual(b.body);expect(a.text).not.toContain(foreign.raw);
  });
  test.each(["null","[]","{","{\"status\":\"rejected\"}","{\"user_id\":\"forged\"}","{\"__proto__\":{}}"])("bad payload %s cannot write",async body=>{expect((await request(actors[0],own.id,{body})).status).toBe(400);});
  test("simple form is400",async()=>{expect((await request(actors[0],own.id,{body:"x=1",headers:{"Content-Type":"application/x-www-form-urlencoded"}})).status).toBe(400);});
  test.each([{Origin:"https://foreign.invalid"},{"Sec-Fetch-Site":"cross-site"}] as Record<string,string>[])("cross-site browser-shaped request %# is403",async headers=>{expect((await request(actors[0],own.id,{headers})).status).toBe(403);});
  test("actual1025 bytes is413, never trusts a client growth/owner field",async()=>{expect((await request(actors[0],own.id,{body:" ".repeat(1023)+"{}"})).status).toBe(413);});
  test.each(["GET","PUT","PATCH","DELETE"])("%s has no write entry and is405",async method=>{expect((await request(actors[0],own.id,{method})).status).toBe(405);});
  test("actual1024-byte same-origin JSON rejects, persists, replays and keeps original readable",async()=>{
    const r=await request(actors[0],own.id,{body:" ".repeat(1022)+"{}",headers:{Origin:base,"Sec-Fetch-Site":"same-origin"}});expect(r.status).toBe(200);expect(r.body).toEqual(receipt(own));expected=statusOnly(expected!,own);
    expect((await request(actors[0],own.id.toUpperCase())).body).toEqual(receipt(own));
    const detail=await request(actors[0],own.id,{method:"GET",path:`/api/activities/${own.activityId}`});expect(detail.status).toBe(200);expect(detail.body).toMatchObject({activity:{rawInput:own.raw,status:"assessed"}});
    const dashboard=await request(actors[0],own.id,{method:"GET",path:"/api/dashboard"});expect(dashboard.status).toBe(200);
    const pending=(dashboard.body as {dashboard:{pendingAssessments:{id:string}[]}}).dashboard.pendingAssessments;expect(pending.some(row=>row.id===own.id)).toBe(false);expect(pending.some(row=>row.id===sibling.id)).toBe(true);
    expect((await request(actors[0],own.id,{path:`/api/assessments/${own.id}/confirm`})).status).toBe(409);
  });
  test.each(["confirmed","edited","superseded"])("persisted terminal %s cannot be rejected",async status=>{await pg.query("update ai_assessments set status=$2 where id=$1",[own.id,status]);expected=statusOnly(expected!,own,status);expect((await request(actors[0])).status).toBe(409);});
  test("real Confirm wins: Reject409 preserves actual XP, original proposal and all other owner rows",async()=>{
    const before=expected!,r=await request(actors[0],own.id,{path:`/api/assessments/${own.id}/confirm`});expect(r.status).toBe(200);
    await confirmedDelta(before,own,[sibling],(r.body as {transaction:{amount:number}}).transaction.amount);expect((await request(actors[0])).status).toBe(409);
  });
  test("Reject never prevents another independent Activity's real Confirm",async()=>{
    const independent=await createProposal(actors[0]);expected=await snapshot();expect((await request(actors[0])).status).toBe(200);expected=statusOnly(expected,own);const before=expected;
    const r=await request(actors[0],independent.id,{path:`/api/assessments/${independent.id}/confirm`});expect(r.status).toBe(200);
    await confirmedDelta(before,independent,[],(r.body as {transaction:{amount:number}}).transaction.amount);expect((await request(actors[0])).body).toEqual(receipt(own));
  });
});
