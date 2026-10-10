import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { loadAssessmentContext } from "@/lib/store/assessment-context.repository";
import { AssessmentContextError, serializeAssessmentContext } from "@/lib/ai/assessment-context";
import { ActivityAlreadySettledError } from "@/lib/store/errors";
import { playerLevelFromXp } from "@/lib/growth-engine/levels";

const dbUrl=process.env.XP_RPG_TEST_DB_URL;
type Actor={id:string;client:SupabaseClient<Database>;activity:string;confirmed:string;skill:string;skillName:string;raw:string;quest:string};
describe.skipIf(!dbUrl)("minimal context real PostgreSQL/RLS three-owner read-only authority",()=>{
  const pg=new Client({connectionString:dbUrl}),actors:Actor[]=[],clients:SupabaseClient<Database>[]=[];let connected=false,tables:string[]=[];
  function bind(){
    const api=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!),db=new URL(dbUrl!);
    if(![api.hostname,db.hostname].every(host=>["127.0.0.1","localhost"].includes(host)))throw Error("Only disposable local context fixtures");
    if(process.env.GITHUB_ACTIONS==="true")return;
    const project=process.env.XP_RPG_DISPOSABLE_TEST_STACK,path=process.env.XP_RPG_CONTEXT_CREATION_RECEIPT;
    if(!project||!/^phase8f_test_[a-z0-9_]+$/.test(project)||api.port!=="54331"||db.port!=="54332"||!path)throw Error("Exact owned context stack required");
    const receipt=JSON.parse(readFileSync(path,"utf8"));expect(receipt.project).toBe(project);expect(receipt.containers).toHaveLength(4);
    for(const component of ["db","auth","rest","kong"]){
      const row=JSON.parse(execFileSync("docker",["inspect",`supabase_${component}_${project}`],{encoding:"utf8"}))[0],original=receipt.containers.find((item:{component:string})=>item.component===component);
      expect(row.Id).toBe(original.id);expect(row.Created).toBe(original.created);expect(row.State.Status).toBe("running");
      expect(row.Config.Labels["com.supabase.cli.project"]).toBe(project);expect(row.Config.Labels["com.supabase.cli.workdir"]).toBe(receipt.stack);
      if(component==="db"||component==="kong")expect(row.HostConfig.PortBindings[component==="db"?"5432/tcp":"8000/tcp"].every((port:{HostPort:string})=>port.HostPort===(component==="db"?"54332":"54331"))).toBe(true);
    }
  }
  async function actor():Promise<Actor>{
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,admin=createClient<Database>(url,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(admin);
    const credentials={email:`context-db-${randomUUID()}@example.test`,password:`Synthetic!${randomUUID()}x`};
    const created=await admin.auth.admin.createUser({...credentials,email_confirm:true});if(created.error||!created.data.user)throw Error("Synthetic context actor create failed");
    const client=createClient<Database>(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(client);
    if((await client.auth.signInWithPassword(credentials)).error)throw Error("Synthetic context actor signin failed");client.auth.stopAutoRefresh();
    const id=created.data.user.id,activity=randomUUID(),confirmed=randomUUID(),assessment=randomUUID(),skill=randomUUID(),quest=randomUUID(),skillName=`00-context-${randomUUID()}`,raw=`只练习 ${skillName}，本次没有独立验证。🙂`;
    await pg.query("insert into skills(id,user_id,name,xp,level,mastery_level,mastery_confidence,status,aliases) values($1,$2,$3,500,$4,3,0.7,'active',$5)",[skill,id,skillName,playerLevelFromXp(500),Array.from({length:21},(_,n)=>`alias-${n}`)]);
    await pg.query("insert into quests(id,user_id,title,quest_type,quest_size,status,is_main_quest) values($1,$2,$3,'learning','main','active',true)",[quest,id,`Own main ${skillName}`]);
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version,quest_id) values($1,$2,'Synthetic context',$3,'pending_assessment','context-frozen-rule',$4)",[activity,id,raw,quest]);
    await pg.query("insert into activities(id,user_id,title,raw_input,status,rules_version) values($1,$2,'Existing XP','PRIVATE_OLD_HISTORY','confirmed','context-history-rule')",[confirmed,id]);
    await pg.query("insert into ai_assessments(id,user_id,activity_id,status,rules_version,assessment_json) values($1,$2,$3,'confirmed','context-history-rule','{}')",[assessment,id,confirmed]);
    await pg.query("insert into xp_transactions(user_id,activity_id,assessment_id,skill_id,amount,base_amount,rules_version,skill_name_snapshot,activity_type) values($1,$2,$3,$4,500,500,'context-history-rule',$5,'learning')",[id,confirmed,assessment,skill,skillName]);
    await pg.query("update player_states set total_xp=500,player_level=$2 where user_id=$1",[id,playerLevelFromXp(500)]);
    await pg.query("insert into evidence_records(user_id,activity_id,skill_id,evidence_level,description,verified) values($1,$2,$3,3,'PRIVATE_EXISTING_EVIDENCE',true)",[id,confirmed,skill]);
    await pg.query("insert into artifacts(user_id,title,artifact_type,summary) values($1,'PRIVATE_EXISTING_ARTIFACT','document','Do not send')",[id]);
    return{id,client,activity,confirmed,skill,skillName,raw,quest};
  }
  async function snapshot(){
    const value:Record<string,unknown>={};for(const table of tables)for(const who of actors)value[`${table}/${who.id}`]=(await pg.query(`select to_jsonb(t) as r from public.${table} t where user_id=$1`,[who.id])).rows.map(row=>row.r).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    value.rules=(await pg.query("select to_jsonb(t) as r from public.rules_versions t order by to_jsonb(t)::text")).rows;return value;
  }
  beforeAll(async()=>{
    bind();await pg.connect();connected=true;for(let index=0;index<3;index++)actors.push(await actor());
    for(let index=0;index<200;index++)await pg.query("insert into skills(user_id,name,status) values($1,$2,'active')",[actors[0].id,`zz-UNRELATED-PRIVATE-${index}`]);
    tables=(await pg.query("select table_name from information_schema.columns where table_schema='public' and column_name='user_id' order by table_name")).rows.map(row=>row.table_name);
    expect(tables.every(table=>/^[a-z_]+$/.test(table))).toBe(true);expect(tables.length).toBeGreaterThan(10);
  },60000);
  afterAll(async()=>{for(const client of clients)client.auth.stopAutoRefresh();if(connected)await pg.end();});
  test("own current metadata is minimal and all three owner/private Core tables remain byte-equal",async()=>{
    const before=await snapshot();
    for(const who of actors){
      const result=await loadAssessmentContext(who.client,who.id,who.activity),sent=serializeAssessmentContext(result);
      expect(result.rawInput).toBe(who.raw);expect(result.context.rulesVersion).toBe("context-frozen-rule");expect(result.context.mainQuest?.source).toBe("bound");
      expect(result.context.relatedSkills).toEqual([{name:who.skillName,masteryLevel:3,masteryConfidence:0.7}]);expect(result.context.coverage.aliasesTruncated).toBe(true);
      expect(result.context.recentSamples).toHaveLength(1);expect(result.context.recentSamples[0].skillName).toBe(who.skillName);
      for(const privateValue of [who.id,who.skill,who.activity,"PRIVATE_OLD_HISTORY","PRIVATE_EXISTING_EVIDENCE","PRIVATE_EXISTING_ARTIFACT","zz-UNRELATED"] )expect(sent).not.toContain(privateValue);
      for(const other of actors.filter(actor=>actor!==who))expect(sent).not.toContain(other.skillName);
    }
    expect(await snapshot()).toEqual(before);
  });
  test("201st candidate marks incomplete scan without broadening relevant output",async()=>{
    const result=await loadAssessmentContext(actors[0].client,actors[0].id,actors[0].activity);expect(result.context.coverage.candidateScanTruncated).toBe(true);expect(result.context.relatedSkills).toHaveLength(1);
  });
  test("cross-owner activities and forged account scope are filtered by real RLS",async()=>{
    const before=await snapshot();for(const [reader,target] of [[actors[0],actors[1]],[actors[1],actors[0]],[actors[2],actors[0]]]){
      await expect(loadAssessmentContext(reader.client,reader.id,target.activity)).rejects.toThrow(AssessmentContextError);
      await expect(loadAssessmentContext(reader.client,target.id,target.activity)).rejects.toThrow(AssessmentContextError);
    }
    expect(await snapshot()).toEqual(before);
  });
  test("anonymous cannot read a real own-looking activity and confirmed cannot be reassessed",async()=>{
    const anon=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});clients.push(anon);
    const before=await snapshot();await expect(loadAssessmentContext(anon,actors[0].id,actors[0].activity)).rejects.toThrow(AssessmentContextError);
    await expect(loadAssessmentContext(actors[0].client,actors[0].id,actors[0].confirmed)).rejects.toThrow(ActivityAlreadySettledError);expect(await snapshot()).toEqual(before);
  });
  test("XP/cache/mastery/Evidence and original frozen input are unchanged on every context read",async()=>{
    for(const who of actors){
      await loadAssessmentContext(who.client,who.id,who.activity);
      expect((await pg.query("select xp,level,mastery_level,mastery_confidence from skills where id=$1",[who.skill])).rows[0]).toMatchObject({xp:"500",level:playerLevelFromXp(500),mastery_level:3,mastery_confidence:"0.7"});
      expect((await pg.query("select total_xp,player_level from player_states where user_id=$1",[who.id])).rows[0]).toEqual({total_xp:"500",player_level:playerLevelFromXp(500)});
      expect((await pg.query("select sum(amount)::text as amount from xp_transactions where user_id=$1",[who.id])).rows[0].amount).toBe("500");
      expect((await pg.query("select raw_input,rules_version,status from activities where id=$1",[who.activity])).rows[0]).toEqual({raw_input:who.raw,rules_version:"context-frozen-rule",status:"pending_assessment"});
      expect((await pg.query("select count(*)::int as n from ai_assessments where activity_id=$1",[who.activity])).rows[0].n).toBe(0);
    }
  });
});
