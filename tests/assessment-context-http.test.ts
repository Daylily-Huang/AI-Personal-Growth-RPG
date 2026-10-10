import http from "node:http";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import next from "next";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { AssessmentProposalSchema } from "@/lib/ai/schemas";
import { playerLevelFromXp } from "@/lib/growth-engine/levels";
import { ASSESSMENT_CONTEXT_COMPATIBILITY_ALLOWED } from "./helpers/governance-delta";

export function assertContextPublicConfig(compiled: unknown, runtime: unknown) {
  function tuple(value:unknown){
    if(!value||typeof value!=="object"||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error("CONTEXT_BUILD_UNBOUND");
    const url=Object.getOwnPropertyDescriptor(value,"url"),key=Object.getOwnPropertyDescriptor(value,"publishableKey");
    if(!url||!key||!Object.hasOwn(url,"value")||!Object.hasOwn(key,"value")||typeof url.value!=="string"||typeof key.value!=="string"||!url.value.trim()||!key.value.trim())throw Error("CONTEXT_BUILD_UNBOUND");
    return{url:url.value.trim(),publishableKey:key.value.trim()};
  }
  const left=tuple(compiled),right=tuple(runtime);if(left.url!==right.url||left.publishableKey!==right.publishableKey)throw Error("CONTEXT_BUILD_UNBOUND");return right;
}
describe("context startup binding before any HTTP/DB dispatch",()=>{
  const compiled={url:"http://127.0.0.1:54331",publishableKey:"synthetic-public"};
  test.each([null,{},Object.create(compiled),{...compiled,url:" "},{...compiled,publishableKey:undefined},
    {...compiled,url:"http://127.0.0.1:54321"},{...compiled,publishableKey:"different"}])("bad runtime %# has zero dispatch",value=>{
    let dispatch=0;expect(()=>{assertContextPublicConfig(compiled,value);dispatch++;}).toThrow("CONTEXT_BUILD_UNBOUND");expect(dispatch).toBe(0);
  });
  test("matching tuple permits dispatch; getters are not invoked",()=>{
    expect(assertContextPublicConfig(compiled,{url:` ${compiled.url} `,publishableKey:compiled.publishableKey})).toEqual(compiled);
    let calls=0;const value=Object.defineProperty({publishableKey:compiled.publishableKey},"url",{enumerable:true,get:()=>{calls++;return compiled.url;}});
    expect(()=>assertContextPublicConfig(compiled,value)).toThrow("CONTEXT_BUILD_UNBOUND");expect(calls).toBe(0);
  });
});
const dbUrl=process.env.XP_RPG_TEST_DB_URL;
type Actor={id:string;cookie:string;skill:string;skillName:string;confirmed:string};type Row=Record<string,unknown>;type Snapshot=Record<string,Row[]>;
describe.skipIf(!dbUrl)("completed-build assessment context real session/SDK/HTTP/PG",()=>{
  const pg=new Client({connectionString:dbUrl}),actors:Actor[]=[],clients:SupabaseClient[]=[];
  let connected=false,app:ReturnType<typeof next>|undefined,server:http.Server|undefined,upstream:http.Server|undefined,base:string,tables:string[]=[],failure=false;
  const captured: {messages:{role:string;content:string}[];model:string;temperature:number}[]=[],original={AI_BASE_URL:process.env.AI_BASE_URL,AI_API_KEY:process.env.AI_API_KEY,AI_MODEL:process.env.AI_MODEL};
  const sha=(value:Buffer)=>createHash("sha256").update(value).digest("hex").toUpperCase();
  function chunks(dir:string):string{return readdirSync(dir,{withFileTypes:true}).map(item=>item.isDirectory()?chunks(path.join(dir,item.name)):item.isFile()&&item.name.endsWith(".js")?readFileSync(path.join(dir,item.name),"utf8"):"").join("\n");}
  function binding(){
    const api=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!),db=new URL(dbUrl!);if(![api.hostname,db.hostname].every(host=>["127.0.0.1","localhost"].includes(host)))throw Error("Disposable local context HTTP only");
    const runtime={url:api.origin,publishableKey:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY},compiled=chunks(".next/static"),buildId=readFileSync(".next/BUILD_ID","utf8").trim();
    assertContextPublicConfig(runtime,runtime);expect(buildId).not.toBe("");if(!compiled.includes(runtime.url)||!compiled.includes(runtime.publishableKey!))throw Error("CONTEXT_BUILD_UNBOUND");
    if(process.env.GITHUB_ACTIONS==="true")return;
    const project=process.env.XP_RPG_DISPOSABLE_TEST_STACK,creationPath=process.env.XP_RPG_CONTEXT_CREATION_RECEIPT,buildPath=process.env.XP_RPG_CONTEXT_BUILD_RECEIPT;
    if(!project||!/^phase8f_test_[a-z0-9_]+$/.test(project)||!creationPath||!buildPath||api.port!=="54331"||db.port!=="54332")throw Error("Exact new owned context HTTP stack/build required");
    const creation=JSON.parse(readFileSync(creationPath,"utf8"));expect(creation.project).toBe(project);expect(creation.containers).toHaveLength(4);
    for(const component of ["db","auth","rest","kong"]){
      const row=JSON.parse(execFileSync("docker",["inspect",`supabase_${component}_${project}`],{encoding:"utf8"}))[0],old=creation.containers.find((item:{component:string})=>item.component===component);
      expect(row.Id).toBe(old.id);expect(row.Created).toBe(old.created);expect(row.State.Status).toBe("running");expect(row.Config.Labels["com.supabase.cli.project"]).toBe(project);expect(row.Config.Labels["com.supabase.cli.workdir"]).toBe(creation.stack);
      if(component==="db"||component==="kong")expect(row.HostConfig.PortBindings[component==="db"?"5432/tcp":"8000/tcp"].every((port:{HostPort:string})=>port.HostPort===(component==="db"?"54332":"54331"))).toBe(true);
    }
    const receipt=JSON.parse(readFileSync(buildPath,"utf8"));expect(receipt.cwd).toBe(process.cwd());expect(receipt.buildId).toBe(buildId);
    expect(receipt.head).toBe(execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim());expect(receipt.tree).toBe(execFileSync("git",["rev-parse","HEAD^{tree}"],{encoding:"utf8"}).trim());
    const source=ASSESSMENT_CONTEXT_COMPATIBILITY_ALLOWED.filter(file=>/^(src|tests)\//.test(file));expect(source).toHaveLength(24);expect(Object.keys(receipt.sourceHashes).sort()).toEqual([...source].sort());
    for(const file of source)expect(receipt.sourceHashes[file]).toBe(sha(readFileSync(file)));assertContextPublicConfig(receipt.publicConfig,runtime);
  }
  async function actor():Promise<Actor>{
    const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(admin);
    const credentials={email:`context-http-${randomUUID()}@example.test`,password:`Synthetic!${randomUUID()}x`};const created=await admin.auth.admin.createUser({...credentials,email_confirm:true});if(created.error||!created.data.user)throw Error("Synthetic HTTP actor create failed");
    const jar=new Map<string,string>(),client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>{for(const cookie of values)jar.set(cookie.name,cookie.value);}}});
    try{if((await client.auth.signInWithPassword(credentials)).error)throw Error("Synthetic HTTP signin failed");}finally{client.auth.stopAutoRefresh();}
    const id=created.data.user.id,skill=randomUUID(),skillName=`CtxSkill-${randomUUID()}`,confirmed=randomUUID(),assessment=randomUUID();
    await pg.query("insert into skills(id,user_id,name,xp,level,mastery_level,mastery_confidence,status) values($1,$2,$3,500,$4,3,0.7,'active')",[skill,id,skillName,playerLevelFromXp(500)]);
    await pg.query("insert into quests(user_id,title,quest_type,quest_size,status,is_main_quest) values($1,'Current synthetic main','learning','main','active',true)",[id]);
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Existing Core','PRIVATE_HISTORICAL_RAW','confirmed','context-http-history')",[confirmed,id]);
    await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json) values($1,$2,$3,'confirmed','context-http-history','{}')",[assessment,id,confirmed]);
    await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot,activity_type) values($1,$2,$3,$4,500,500,'context-http-history',$5,'learning')",[id,confirmed,assessment,skill,skillName]);
    await pg.query("update player_states set total_xp=500,player_level=$2 where user_id=$1",[id,playerLevelFromXp(500)]);
    await pg.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'PRIVATE_EVIDENCE',true)",[id,confirmed,skill]);
    return{id,cookie:[...jar].map(([name,value])=>`${name}=${value}`).join("; "),skill,skillName,confirmed};
  }
  function proposal(skillName:string){return AssessmentProposalSchema.parse({activity:{type:"learning",completion:0.7},difficulty:{complexity:0.4,uncertainty:0.3,expertise_gap:0.4,resistance:0.3},
    growth:{effort:0.5,learning:0.6,performance:0.2,outcome:0.5,artifact_value:0,character_evidence:0},evidence:{level:2,explanation:"Synthetic user_claim, not independent verification"},affected_skills:[{name:skillName,reason:"Synthetic primary"}],
    knowledge_updates:{proposed_nodes:[],proposed_edges:[]},mastery_changes:[],xp_semantics:{base_value:20,difficulty:0.4,mastery_gain:0.4,novelty:0.5,goal_alignment:0.6,repetition_risk:"low"},artifactProposals:[],artifacts:[],next_quest:null,confidence:0.7,uncertainty_notes:["Authored mock upstream, not model quality"]});}
  function privateResponse(response:Response,status:number){expect(response.status).toBe(status);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("vary")?.split(",").map(value=>value.trim().toLowerCase())).toContain("cookie");}
  async function request(who:Actor|null,route:string,method="POST",body?:unknown){return fetch(base+route,{method,redirect:"manual",headers:{...(who?{Cookie:who.cookie}:{}),...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});}
  async function newActivity(who:Actor){const raw=`练习 ${who.skillName}\n只是一份合成自述🙂`,response=await request(who,"/api/activities","POST",{rawInput:raw});expect(response.status).toBe(201);const item=(await response.json()).activity;expect(item.rawInput).toBe(raw);return item as {id:string;rawInput:string;rulesVersion:string};}
  async function snapshot(){const result:Snapshot={};for(const table of tables)for(const who of actors)result[`${table}/${who.id}`]=(await pg.query(`select to_jsonb(t) as r from public.${table} t where user_id=$1`,[who.id])).rows.map(row=>row.r).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return result;}
  beforeAll(async()=>{
    binding();await pg.connect();connected=true;for(let index=0;index<3;index++)actors.push(await actor());
    tables=(await pg.query("select table_name from information_schema.columns where table_schema='public' and column_name='user_id' order by table_name")).rows.map(row=>row.table_name);expect(tables.every(table=>/^[a-z_]+$/.test(table))).toBe(true);
    upstream=http.createServer((req,res)=>{let text="";req.on("data",chunk=>text+=chunk);req.on("end",()=>{
      const body=JSON.parse(text);captured.push(body);if(failure){res.writeHead(400,{"Content-Type":"application/json"});res.end(JSON.stringify({error:{message:"PRIVATE_CONTEXT_UPSTREAM_ERROR",type:"bad_request"}}));return;}
      const user=body.messages.find((item:{role:string})=>item.role==="user").content,block=user.match(/\n\n上下文：\n([\s\S]*?)\n\n资料与权限边界：/),context=JSON.parse(block[1]);
      const output=proposal(context.relatedSkills[0].name);res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({id:"synthetic-context-http",object:"chat.completion",model:"synthetic-http-model",choices:[{index:0,message:{role:"assistant",content:JSON.stringify(output)},finish_reason:"stop"}]}));
    });});
    await new Promise<void>(resolve=>upstream!.listen(0,"127.0.0.1",resolve));const address=upstream.address();if(!address||typeof address==="string")throw Error("No owned upstream port");
    process.env.AI_BASE_URL=`http://127.0.0.1:${address.port}/v1`;process.env.AI_API_KEY="synthetic-http-key";process.env.AI_MODEL="synthetic-http-model";
    app=next({dev:false,hostname:"127.0.0.1",dir:process.cwd()});await app.prepare();server=http.createServer(app.getRequestHandler());await new Promise<void>(resolve=>server!.listen(0,"127.0.0.1",resolve));const bound=server.address();if(!bound||typeof bound==="string")throw Error("No owned Next port");base=`http://127.0.0.1:${bound.port}`;
  },60000);
  beforeEach(()=>{failure=false;captured.length=0;});
  afterAll(async()=>{try{for(const client of clients)client.auth.stopAutoRefresh();if(server){server.closeAllConnections();await new Promise<void>(resolve=>server!.close(()=>resolve()));}if(app)await app.close();if(upstream){upstream.closeAllConnections();await new Promise<void>(resolve=>upstream!.close(()=>resolve()));}}finally{for(const [key,value]of Object.entries(original))if(value===undefined)delete process.env[key];else process.env[key]=value;if(connected)await pg.end();}});
  test("anonymous401 and wrong method405 spend zero upstream calls",async()=>{
    const before=await snapshot();privateResponse(await request(null,`/api/activities/${actors[0].confirmed}/assess`),401);
    expect((await request(actors[0],`/api/activities/${actors[0].confirmed}/assess`,"GET")).status).toBe(405);expect(captured).toEqual([]);expect(await snapshot()).toEqual(before);
  });
  test("foreign404, missing404 and alreadyconfirmed409 preserve all three owner tables",async()=>{
    const before=await snapshot();privateResponse(await request(actors[0],`/api/activities/${actors[1].confirmed}/assess`),404);
    privateResponse(await request(actors[0],`/api/activities/${randomUUID()}/assess`),404);privateResponse(await request(actors[0],`/api/activities/${actors[0].confirmed}/assess`),409);
    expect(captured).toEqual([]);expect(await snapshot()).toEqual(before);
  });
  test("real own request sends only relevant bounded context, preserves all Core and persists exact v0.3",async()=>{
    const who=actors[0],activity=await newActivity(who),before=await snapshot();const response=await request(who,`/api/activities/${activity.id}/assess`,"POST",{user_id:actors[1].id,context:{private:"FORGED_PRIVATE_CONTEXT"},rules_version:"FORGED_RULE"});privateResponse(response,200);
    const assessment=(await response.json()).assessment;expect(assessment.promptVersion).toBe("activity-evaluator-v0.3-context");expect(assessment.status).toBe("pending");expect(captured).toHaveLength(1);
    const user=captured[0].messages.find(item=>item.role==="user")!.content,context=JSON.parse(user.match(/\n\n上下文：\n([\s\S]*?)\n\n资料与权限边界：/)![1]);
    expect(context.relatedSkills).toEqual([{name:who.skillName,masteryLevel:3,masteryConfidence:0.7}]);expect(context.mainQuest.source).toBe("latest");expect(context.rulesVersion).toBe(activity.rulesVersion);
    expect(Buffer.byteLength(JSON.stringify(context))).toBeLessThanOrEqual(4096);for(const sentinel of [who.id,who.skill,actors[1].skillName,actors[2].skillName,"FORGED_PRIVATE_CONTEXT","FORGED_RULE","PRIVATE_HISTORICAL_RAW","PRIVATE_EVIDENCE"])expect(user).not.toContain(sentinel);
    const after=await snapshot();for(const key of Object.keys(before).filter(key=>!key.startsWith("activities/")&&!key.startsWith("ai_assessments/")))expect(after[key],key).toEqual(before[key]);
    for(const other of actors.slice(1))for(const table of ["activities","ai_assessments"])expect(after[`${table}/${other.id}`]).toEqual(before[`${table}/${other.id}`]);
    expect((await pg.query("select raw_input,rules_version,status from activities where id=$1",[activity.id])).rows[0]).toEqual({raw_input:activity.rawInput,rules_version:activity.rulesVersion,status:"assessed"});
    expect((await pg.query("select prompt_version,model_name,status from ai_assessments where id=$1",[assessment.id])).rows[0]).toEqual({prompt_version:"activity-evaluator-v0.3-context",model_name:"synthetic-http-model",status:"pending"});
  });
  test("paid upstream failure is safe502 and leaves Activity/assessment/Core byte-equal",async()=>{
    const activity=await newActivity(actors[0]),before=await snapshot();failure=true;const response=await request(actors[0],`/api/activities/${activity.id}/assess`);privateResponse(response,502);
    expect(await response.text()).not.toMatch(/PRIVATE_|synthetic-http-key/);expect(captured).toHaveLength(1);expect(await snapshot()).toEqual(before);
  });
  test("confirm remains one original primary XP, no context-read growth, and raw details/Reject work",async()=>{
    const who=actors[0],activity=await newActivity(who),response=await request(who,`/api/activities/${activity.id}/assess`);expect(response.status).toBe(200);const assessment=(await response.json()).assessment;
    const before=(await pg.query("select total_xp::text as xp from player_states where user_id=$1",[who.id])).rows[0].xp;
    expect((await request(who,`/api/assessments/${assessment.id}/confirm`,"POST",{})).status).toBe(200);
    expect((await request(who,`/api/assessments/${assessment.id}/confirm`,"POST",{})).status).toBe(409);
    const rows=(await pg.query("select amount,skill_id,xp_type from xp_transactions where activity_id=$1",[activity.id])).rows;expect(rows).toHaveLength(1);expect(rows[0].skill_id).toBe(who.skill);expect(rows[0].xp_type).toBe("activity");
    expect(Number((await pg.query("select total_xp from player_states where user_id=$1",[who.id])).rows[0].total_xp)).toBe(Number(before)+Number(rows[0].amount));
    expect((await pg.query("select mastery_level from skills where id=$1",[who.skill])).rows[0].mastery_level).toBe(3);
    const detail=await request(who,`/api/activities/${activity.id}`,"GET");expect(detail.status).toBe(200);expect((await detail.json()).activity.rawInput).toBe(activity.rawInput);
    const rejectActivity=await newActivity(who),proposed=await request(who,`/api/activities/${rejectActivity.id}/assess`);expect(proposed.status).toBe(200);const reject=(await proposed.json()).assessment;
    const xpBefore=(await pg.query("select total_xp::text as xp from player_states where user_id=$1",[who.id])).rows[0].xp;
    const rejected=await request(who,`/api/assessments/${reject.id}/reject`,"POST",{});expect(rejected.status).toBe(200);expect((await rejected.json()).assessment.status).toBe("rejected");
    expect((await pg.query("select total_xp::text as xp from player_states where user_id=$1",[who.id])).rows[0].xp).toBe(xpBefore);
    expect((await pg.query("select count(*)::int as n from xp_transactions where activity_id=$1",[rejectActivity.id])).rows[0].n).toBe(0);
  });
});
