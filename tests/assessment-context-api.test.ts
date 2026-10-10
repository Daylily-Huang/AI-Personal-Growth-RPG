import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { AssessmentContextSnapshot } from "@/lib/ai/assessment-context";
const state=vi.hoisted(()=>({configured:true,repository:vi.fn(),dispatch:vi.fn()}));
vi.mock("@/lib/supabase/env",()=>({isSupabaseConfigured:()=>state.configured}));
vi.mock("@/lib/store/request-repository",()=>({getRequestRepository:()=>state.repository(),AuthRequiredError:class AuthRequiredError extends Error{constructor(){super("PRIVATE_AUTH_SENTINEL");}}}));
vi.mock("@/lib/ai/assess",async importOriginal=>({...await importOriginal<typeof import("@/lib/ai/assess")>(),assessActivity:state.dispatch}));
import { POST } from "@/app/api/activities/[id]/assess/route";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { AIAssessmentError } from "@/lib/ai/assess";
import { ActivityAlreadySettledError } from "@/lib/store/errors";
function fixture(): AssessmentContextSnapshot {
  return {activityId:randomUUID(),rawInput:"本人活动原文",context:{version:"activity-context-v1",asOf:"2026-10-10T12:00:00.000Z",rulesVersion:"activity-frozen-rule",
    mainQuest:null,relatedSkills:[],recentSamples:[],temporaryState:{energy:70,focus:60,momentum:30,stress:10},coverage:{candidateScanTruncated:false,aliasesTruncated:false,skillNamesOmitted:false,relatedSkillsTruncated:false,recentSamplesTruncated:false,questChainIncomplete:false,budgetReduced:false}}};
}
describe("actual assessment route auth/context ordering and safe pending-only boundary",()=>{
  let context:AssessmentContextSnapshot,activity:Record<string,unknown>,repo:{getActivity:ReturnType<typeof vi.fn>;getAssessmentContext?:ReturnType<typeof vi.fn>;addAssessment:ReturnType<typeof vi.fn>};
  beforeEach(()=>{
    vi.clearAllMocks();state.configured=true;context=fixture();activity={id:context.activityId,rawInput:context.rawInput,rulesVersion:context.context.rulesVersion,status:"pending_assessment",totalMinutes:30,effectiveMinutes:20};
    repo={getActivity:vi.fn(async()=>activity),getAssessmentContext:vi.fn(async()=>context),addAssessment:vi.fn(async(input)=>({id:randomUUID(),status:"pending",...input}))};
    state.repository.mockResolvedValue(repo);state.dispatch.mockResolvedValue({proposal:{synthetic:"proposal-not-final-XP"},modelName:"synthetic-model"});
  });
  afterEach(()=>vi.restoreAllMocks());
  const request=(body?:unknown)=>POST(new Request(`http://127.0.0.1/api/activities/${context.activityId}/assess`,{method:"POST",...(body?{body:JSON.stringify(body),headers:{"Content-Type":"application/json"}}:{})}),{params:Promise.resolve({id:context.activityId})});
  function privateResponse(response:Response,status:number){expect(response.status).toBe(status);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("vary")).toBe("Cookie");}
  test("own valid context is loaded before actual adapter call and persists actual v0.3 provenance only",async()=>{
    const result=await request();privateResponse(result,200);expect(repo.getAssessmentContext).toHaveBeenCalledWith(context.activityId);
    expect(state.dispatch).toHaveBeenCalledWith(expect.objectContaining({activityId:context.activityId,rawInput:context.rawInput,authenticatedSnapshot:context}),{allowDemoFallback:false});
    expect(repo.addAssessment).toHaveBeenCalledWith({activityId:context.activityId,proposal:{synthetic:"proposal-not-final-XP"},modelName:"synthetic-model",promptVersion:"activity-evaluator-v0.3-context"});
    expect(repo.getActivity.mock.invocationCallOrder[0]).toBeLessThan(repo.getAssessmentContext!.mock.invocationCallOrder[0]);
    expect(repo.getAssessmentContext!.mock.invocationCallOrder[0]).toBeLessThan(state.dispatch.mock.invocationCallOrder[0]);
    expect(state.dispatch.mock.invocationCallOrder[0]).toBeLessThan(repo.addAssessment.mock.invocationCallOrder[0]);
  });
  test("forged client owner/context/mastery/rules/score are ignored rather than authoritative",async()=>{
    const response=await request({user_id:randomUUID(),context:{relatedSkills:[{name:"Foreign",masteryLevel:10}]},rules_version:"forged",base_value:999});privateResponse(response,200);
    const sent=state.dispatch.mock.calls[0][0];expect(sent.authenticatedSnapshot).toEqual(context);expect(sent).not.toHaveProperty("user_id");expect(JSON.stringify(sent)).not.toMatch(/Foreign|forged|999/);
  });
  test("confirmed409/missing-or-foreign404/auth401 stop before context/AI/persistence",async()=>{
    for(const kind of ["confirmed","missing","auth"]) {
      vi.clearAllMocks();state.repository.mockResolvedValue(repo);repo.getActivity.mockResolvedValue(kind==="missing"?null:kind==="confirmed"?{...activity,status:"confirmed"}:activity);
      if(kind==="auth")state.repository.mockRejectedValue(new AuthRequiredError());
      const response=await request();privateResponse(response,kind==="confirmed"?409:kind==="missing"?404:401);
      expect(repo.getAssessmentContext).not.toHaveBeenCalled();expect(state.dispatch).not.toHaveBeenCalled();expect(repo.addAssessment).not.toHaveBeenCalled();
      const text=await response.text();expect(text).not.toContain("PRIVATE_AUTH_SENTINEL");
      if(kind==="auth")expect(JSON.parse(text)).toEqual({error:"An authenticated Supabase session is required"});
    }
  });
  test.each(["missing-port","null","missing-field","unknown-field","activity-id","raw","rules","state-null","state-NaN"])("auth %s fails closed before SDK/write",async kind=>{
    if(kind==="missing-port")delete repo.getAssessmentContext;
    if(kind==="null")repo.getAssessmentContext!.mockResolvedValue(null);
    if(kind==="missing-field")delete (context.context as unknown as Record<string,unknown>).coverage;
    if(kind==="unknown-field")Object.assign(context.context,{private_note:"PRIVATE_CONTEXT_SENTINEL"});
    if(kind==="activity-id")context.activityId=randomUUID();if(kind==="raw")context.rawInput="FOREIGN_RAW_SENTINEL";
    if(kind==="rules")context.context.rulesVersion="forged";if(kind==="state-null")Object.assign(context.context,{temporaryState:null});
    if(kind==="state-NaN")context.context.temporaryState.focus=NaN;
    const response=await request();privateResponse(response,500);expect(await response.text()).not.toMatch(/PRIVATE_|FOREIGN_|forged/);
    expect(state.dispatch).not.toHaveBeenCalled();expect(repo.addAssessment).not.toHaveBeenCalled();
  });
  test.each(["activity","context","persistence"])("private raw %s error is not reflected/logged or downgraded to Demo",async point=>{
    const log=vi.spyOn(console,"error").mockImplementation(()=>{}),error=Error("PRIVATE_ROW_SENTINEL");
    if(point==="activity")repo.getActivity.mockRejectedValue(error);if(point==="context")repo.getAssessmentContext!.mockRejectedValue(error);if(point==="persistence")repo.addAssessment.mockRejectedValue(error);
    const response=await request();privateResponse(response,500);expect(await response.text()).not.toContain("PRIVATE_ROW_SENTINEL");expect(log).not.toHaveBeenCalled();
    if(point!=="persistence")expect(state.dispatch).not.toHaveBeenCalled();else expect(state.dispatch.mock.calls[0][1]).toEqual({allowDemoFallback:false});
  });
  test.each(["ai_request_failed","ai_invalid_schema","constructor","__proto__"])("SDK safe status/code %s never exposes original private message",async code=>{
    state.dispatch.mockRejectedValue(new AIAssessmentError("PRIVATE_UPSTREAM_SENTINEL",code,true));const response=await request();privateResponse(response,502);
    const body=await response.json();expect(body.code).toBe(code);expect(body.retryable).toBe(true);expect(body.error).not.toContain("PRIVATE_");expect(repo.addAssessment).not.toHaveBeenCalled();
  });
  test("settlement race during context/persist remains409 without fake revisions",async()=>{
    repo.getAssessmentContext!.mockRejectedValue(new ActivityAlreadySettledError(context.activityId));let response=await request();privateResponse(response,409);
    expect(state.dispatch).not.toHaveBeenCalled();expect(repo.addAssessment).not.toHaveBeenCalled();
    repo.getAssessmentContext!.mockResolvedValue(context);repo.addAssessment.mockRejectedValue(new ActivityAlreadySettledError(context.activityId));
    response=await request();privateResponse(response,409);expect((await response.json()).code).toBe("activity_already_settled");
  });
  test("explicit no-public-config Demo retains legacy input/version and never reads personal context",async()=>{
    state.configured=false;const response=await request();privateResponse(response,200);expect(repo.getAssessmentContext).not.toHaveBeenCalled();
    expect(state.dispatch.mock.calls[0]).toEqual([{rawInput:activity.rawInput,totalMinutes:30,effectiveMinutes:20,recentSimilarCount:0,activeMainQuest:null},{allowDemoFallback:true}]);
    expect(repo.addAssessment.mock.calls[0][0].promptVersion).toBe("activity-evaluator-v0.2");
  });
});
