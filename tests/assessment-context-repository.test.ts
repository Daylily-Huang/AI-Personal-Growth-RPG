import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { describe, expect, test } from "vitest";
import { loadAssessmentContext } from "@/lib/store/assessment-context.repository";
import { SupabaseRepository } from "@/lib/store/supabase-repository";
import { AssessmentContextError, serializeAssessmentContext } from "@/lib/ai/assessment-context";
import { ActivityAlreadySettledError } from "@/lib/store/errors";

const OWNER="56a9063f-0bda-4f1e-8b8e-e0ca6f08b9a0", OTHER="9f368393-ec05-4464-b12c-76852c6226be",
  ACTIVITY="c09b5160-3fb1-48f1-aa23-9b23468a247b", SKILL="4778b7da-8cfe-4383-a4cd-3c71d9558d7d", NOW="2026-10-10T12:00:00.000Z";
type Row = Record<string, unknown>;
function fixture() {
  return { activities: [{id:ACTIVITY,user_id:OWNER,raw_input:"用R学习统计",rules_version:"frozen-rule-context",quest_id:null,activity_type:null,status:"pending_assessment"}],
    quests: [{id:randomUUID(),user_id:OWNER,title:"当前论文主线",parent_quest_id:null,is_main_quest:true,status:"active"}],
    skills: [{id:SKILL,user_id:OWNER,name:"R",aliases:[],mastery_level:3,mastery_confidence:0.7,status:"active"},
      {id:randomUUID(),user_id:OWNER,name:"UNRELATED_PRIVATE_SKILL",aliases:[],mastery_level:8,mastery_confidence:0.8,status:"active"}],
    player_states:[{user_id:OWNER,energy:70,focus:60,momentum:30,stress:10}],
    xp_transactions:Array.from({length:6},(_, index)=>({id:randomUUID(),user_id:OWNER,skill_id:SKILL,xp_type:"activity",activity_type:"learning",created_at:`2026-10-0${index+1}T00:00:00.000Z`})) } as Record<string,Row[]>;
}
function installedSdk(rows=fixture(), failTable?: string, custom?: (table:string,url:URL)=>Row[] | undefined) {
  const requests:{url:URL;method:string}[]=[];
  const client=createClient<Database>("http://context.invalid","synthetic-public-key",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
    const url=new URL(input instanceof Request?input.url:String(input)), table=url.pathname.split("/").at(-1)!;
    requests.push({url,method:init?.method??"GET"});
    if(table===failTable)return new Response(JSON.stringify({message:"PRIVATE_CONTEXT_SENTINEL",code:"42501"}),{status:500,headers:{"Content-Type":"application/json"}});
    return new Response(JSON.stringify(custom?.(table,url)??rows[table]??[]),{status:200,headers:{"Content-Type":"application/json"}});
  }}});
  return {client,requests,rows};
}
const read = (sdk:ReturnType<typeof installedSdk>) => loadAssessmentContext(sdk.client,OWNER,ACTIVITY,()=>new Date(NOW));
describe("minimal context actual installed Supabase SDK query and raw receipt boundary",()=>{
  test("actual minimal GET projections bind own owner/status/ordering/limits, no write or arbitrary table",async()=>{
    const sdk=installedSdk(), result=await read(sdk), byTable=new Map(sdk.requests.map(item=>[item.url.pathname.split("/").at(-1)!,item.url]));
    expect(sdk.requests.every(item=>item.method==="GET")).toBe(true);
    expect([...byTable.keys()].sort()).toEqual(["activities","quests","skills","player_states","xp_transactions"].sort());
    for(const {url} of sdk.requests)expect(url.searchParams.get("user_id")).toBe(`eq.${OWNER}`);
    expect(byTable.get("activities")!.searchParams.get("select")).toBe("id,user_id,raw_input,rules_version,quest_id,activity_type,status");
    expect(byTable.get("skills")!.searchParams.get("select")).toBe("id,user_id,name,aliases,mastery_level,mastery_confidence,status");
    expect(byTable.get("skills")!.searchParams.get("limit")).toBe("201"); expect(byTable.get("skills")!.searchParams.get("status")).toBe("eq.active");
    expect(byTable.get("skills")!.searchParams.get("order")).toBe("name.asc,id.asc");
    const quests=byTable.get("quests")!; expect(quests.searchParams.get("status")).toBe("eq.active");expect(quests.searchParams.get("is_main_quest")).toBe("eq.true");
    expect(quests.searchParams.get("order")).toBe("created_at.desc,id.asc");expect(quests.searchParams.get("limit")).toBe("1");
    const recent=byTable.get("xp_transactions")!; expect(recent.searchParams.get("select")).toBe("id,user_id,skill_id,xp_type,activity_type,created_at");
    expect(recent.searchParams.get("limit")).toBe("6");expect(recent.searchParams.get("xp_type")).toBe("eq.activity");expect(recent.searchParams.get("skill_id")).toContain(SKILL);
    expect(recent.searchParams.getAll("created_at")).toEqual(["gte.2026-09-10T12:00:00.000Z",`lte.${NOW}`]);
    expect(recent.searchParams.get("order")).toBe("created_at.desc,id.asc");expect(result.context.recentSamples).toHaveLength(5);
    expect(result.context.coverage.recentSamplesTruncated).toBe(true); expect(result.context.mainQuest?.source).toBe("latest");
    const serialized=serializeAssessmentContext(result);
    for(const privateValue of [OWNER,OTHER,ACTIVITY,SKILL,"UNRELATED_PRIVATE_SKILL"])expect(serialized).not.toContain(privateValue);
  });
  test("real SupabaseRepository port delegates to the same request-scoped client/owner",async()=>{
    const rows=fixture(); rows.xp_transactions=[]; // This port test uses the real clock without date-expiring historical fixtures.
    const sdk=installedSdk(rows); const repo=new SupabaseRepository(sdk.client,OWNER), result=await repo.getAssessmentContext(ACTIVITY);
    expect(result.activityId).toBe(ACTIVITY);expect(sdk.requests.every(item=>item.url.searchParams.get("user_id")===`eq.${OWNER}`)).toBe(true);
    sdk.client.auth.stopAutoRefresh();
  });
  test.each(["activities","quests","skills","player_states","xp_transactions"])("%s query failure is fixed/safe, never partial success",async table=>{
    const sdk=installedSdk(fixture(),table);await expect(read(sdk)).rejects.toThrow(AssessmentContextError);
    await expect(read(sdk)).rejects.not.toThrow("PRIVATE_CONTEXT_SENTINEL");
  });
  test.each(["activities","quests","skills","player_states","xp_transactions"])("wrong owner in raw %s receipt fails even if RLS was assumed",async table=>{
    const rows=fixture();rows[table][0].user_id=OTHER;await expect(read(installedSdk(rows))).rejects.toThrow(AssessmentContextError);
  });
  test.each([undefined,null,"archived"])("missing/null/wrong raw skill status %s is not defaulted active",async status=>{
    const rows=fixture();if(status===undefined)delete rows.skills[0].status;else rows.skills[0].status=status;
    await expect(read(installedSdk(rows))).rejects.toThrow(AssessmentContextError);
  });
  test("confirmed/missing/mismatched Activity stop before auxiliary queries",async()=>{
    for(const mutate of [(rows:Record<string,Row[]>)=>{rows.activities[0].status="confirmed";},
      (rows:Record<string,Row[]>)=>{rows.activities=[];},(rows:Record<string,Row[]>)=>{rows.activities[0].id=randomUUID();}]) {
      const rows=fixture();mutate(rows);const sdk=installedSdk(rows);await expect(read(sdk)).rejects.toThrow();expect(sdk.requests).toHaveLength(1);
      if(rows.activities[0]?.status==="confirmed")await expect(read(sdk)).rejects.toThrow(ActivityAlreadySettledError);
    }
  });
  test("bad input identity and invalid clock dispatch no queries",async()=>{
    const sdk=installedSdk();await expect(loadAssessmentContext(sdk.client,"",ACTIVITY)).rejects.toThrow(AssessmentContextError);
    await expect(loadAssessmentContext(sdk.client,OWNER,"not-uuid")).rejects.toThrow(AssessmentContextError);
    await expect(loadAssessmentContext(sdk.client,OWNER,ACTIVITY,()=>new Date(NaN))).rejects.toThrow(AssessmentContextError);expect(sdk.requests).toEqual([]);
  });
  test("empty own directory/goal/history is honest; no recent table scan when no related skills",async()=>{
    const rows=fixture();rows.skills=[];rows.quests=[];const sdk=installedSdk(rows),result=await read(sdk);
    expect(result.context.relatedSkills).toEqual([]);expect(result.context.mainQuest).toBeNull();expect(result.context.recentSamples).toEqual([]);
    expect(sdk.requests.some(item=>item.url.pathname.endsWith("xp_transactions"))).toBe(false);
  });
  test("active bound main takes precedence over latest unrelated main",async()=>{
    const rows=fixture(), leaf=randomUUID(),parent=randomUUID();rows.activities[0].quest_id=leaf;
    const sdk=installedSdk(rows,undefined,(table,url)=>table!=="quests"?undefined:url.searchParams.get("id")===`eq.${leaf}`?
      [{id:leaf,user_id:OWNER,title:"child",parent_quest_id:parent,is_main_quest:false,status:"active"}]:
      [{id:parent,user_id:OWNER,title:"Bound Main",parent_quest_id:null,is_main_quest:true,status:"active"}]);
    const result=await read(sdk);expect(result.context.mainQuest?.title).toBe("Bound Main");expect(result.context.mainQuest?.source).toBe("bound");
    expect(sdk.requests.filter(item=>item.url.pathname.endsWith("quests")).every(item=>item.url.searchParams.has("id"))).toBe(true);
  });
  test.each(["cycle","depth","missing"])("Quest %s is bounded and explicitly incomplete before latest fallback",async kind=>{
    const rows=fixture(),ids:string[]=Array.from({length:9},()=>randomUUID());rows.activities[0].quest_id=ids[0];
    const sdk=installedSdk(rows,undefined,(table,url)=>{
      if(table!=="quests"||!url.searchParams.has("id"))return undefined;
      if(kind==="missing")return [];
      const current=url.searchParams.get("id")!.slice(3),index=ids.indexOf(current);
      return [{id:current,user_id:OWNER,title:"child",parent_quest_id:kind==="cycle"?ids[0]:ids[index+1],is_main_quest:false,status:"active"}];
    });
    const result=await read(sdk);expect(result.context.coverage.questChainIncomplete).toBe(true);expect(result.context.mainQuest?.source).toBe("latest");
    expect(sdk.requests.filter(item=>item.url.pathname.endsWith("quests")&&item.url.searchParams.has("id")).length).toBeLessThanOrEqual(8);
  });
  test.each(["future","too-old","foreign-skill","unknown-field","duplicate"])("raw recent %s cannot become trustworthy metadata",async kind=>{
    const rows=fixture();if(kind==="future")rows.xp_transactions[0].created_at="2026-10-10T12:00:00.001Z";
    if(kind==="too-old")rows.xp_transactions[0].created_at="2026-09-10T11:59:59.999Z";
    if(kind==="foreign-skill")rows.xp_transactions[0].skill_id=randomUUID();if(kind==="unknown-field")rows.xp_transactions[0].reason="PRIVATE_HISTORY";
    if(kind==="duplicate")rows.xp_transactions[1]={...rows.xp_transactions[0]};await expect(read(installedSdk(rows))).rejects.toThrow(AssessmentContextError);
  });
  test.each(["missing","null","NaN","unknown-field"])("temporary state %s fails closed, never invented/defaulted",async kind=>{
    const rows=fixture();if(kind==="missing")rows.player_states=[];if(kind==="null")rows.player_states[0].focus=null;
    if(kind==="NaN")rows.player_states[0].stress=NaN;if(kind==="unknown-field")rows.player_states[0].private_note="PRIVATE_STATE";
    await expect(read(installedSdk(rows))).rejects.toThrow(AssessmentContextError);
  });
});
