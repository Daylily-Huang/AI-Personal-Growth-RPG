import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getMilestoneRepository } from "@/lib/milestone/request";
import { MilestoneRepository } from "@/lib/milestone/repository";
import { AuthRequiredError } from "@/lib/store/request-repository";

type Reply = { data: unknown; error: { message: string; code?: string } | null };
const ok = (data: unknown): Reply => ({ data, error: null });
function client(replies: Reply[] = [], rpcReply = ok(null)) {
  const chains: Record<string, ReturnType<typeof vi.fn>>[] = [];
  const from = vi.fn(() => {
    const reply = replies.shift(); if (!reply) throw Error("Unexpected read/prefetch");
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const key of ["select","eq","in","or","order","range","limit","maybeSingle"]) chain[key] = vi.fn(() => chain);
    chain.then = vi.fn((resolve: (value: Reply) => unknown) => Promise.resolve(reply).then(resolve));
    chains.push(chain); return chain;
  });
  const db = { from, rpc: vi.fn().mockResolvedValue(rpcReply), auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } }, error: null }) } };
  return { db, chains, typed: db as unknown as SupabaseClient };
}
const id = randomUUID(), source = randomUUID();
const milestone = { id, user_id:"owner", recognition_class:"CORE_VERIFIED", source_type:"QUEST", source_id:source,
  granted_reward_credit:false, reward_transaction_id:null, status:"ACTIVE", revocation_reason:null };
const earn = { id:"earn",user_id:"owner",event_kind:"EARN",canonical_source_type:"QUEST",canonical_source_id:source,amount:150,policy_version:"reward-v1" };
const correction = { id:"correction",correction_for_id:"earn",event_kind:"CORRECTION",amount:-150 };

beforeEach(() => vi.clearAllMocks());
describe("8F request-scoped authentication and read projections", () => {
  test.each([
    {data:{user:null},error:null},
    {data:{user:null},error:{message:"expired"}},
    {data:{user:{id:"not-authorized"}},error:{message:"invalid"}},
  ])("auth failure never falls back to demo or service role: %j", async result => {
    const c=client(); c.db.auth.getUser.mockResolvedValue(result as never);
    vi.mocked(getSupabaseServerClient).mockResolvedValue(c.typed as never);
    await expect(getMilestoneRepository()).rejects.toBeInstanceOf(AuthRequiredError);
    expect(c.db.from).not.toHaveBeenCalled(); expect(c.db.rpc).not.toHaveBeenCalled();
  });
  test("client setup exception propagates without fallback", async () => {
    vi.mocked(getSupabaseServerClient).mockRejectedValueOnce(new Error("unavailable"));
    await expect(getMilestoneRepository()).rejects.toThrow("unavailable");
  });
  test("two requests use fresh authenticated clients and distinct tenant filters", async () => {
    const a=client([ok([])]), b=client([ok([])]);
    a.db.auth.getUser.mockResolvedValue({data:{user:{id:"A"}},error:null});
    b.db.auth.getUser.mockResolvedValue({data:{user:{id:"B"}},error:null});
    vi.mocked(getSupabaseServerClient).mockResolvedValueOnce(a.typed as never).mockResolvedValueOnce(b.typed as never);
    const ra=await getMilestoneRepository(), rb=await getMilestoneRepository();
    expect(ra).not.toBe(rb); await ra.list({limit:50,offset:0},{}); await rb.list({limit:50,offset:0},{});
    expect(a.chains[0].eq).toHaveBeenCalledWith("user_id","A"); expect(b.chains[0].eq).toHaveBeenCalledWith("user_id","B");
    expect(getSupabaseServerClient).toHaveBeenCalledTimes(2);
  });
  test.each([false,true])("ledger correction determines reward status, not lifecycle revoked=%s", async revoked => {
    const c=client([ok({...milestone,granted_reward_credit:true,reward_transaction_id:"earn",status:revoked?"REVOKED":"ACTIVE"}),ok([earn]),ok([correction])]);
    const view=await new MilestoneRepository(c.typed,"owner").detail(id);
    expect(view.reward).toEqual({status:"CORRECTED",transaction:earn,correction,existingSourceReward:null});
    for (const chain of c.chains) expect(chain.eq).toHaveBeenCalledWith("user_id","owner");
  });
  test("unfunded record shows independent source reward, never attaches it", async () => {
    const c=client([ok(milestone),ok([earn]),ok([correction])]);
    const view=await new MilestoneRepository(c.typed,"owner").detail(id);
    expect(view.reward).toEqual({status:"NOT_ISSUED",transaction:null,correction:null,existingSourceReward:{transaction:earn,correction}});
    expect(view.reward_transaction_id).toBeNull(); expect(c.db.rpc).not.toHaveBeenCalled();
  });
  test("funded record with inconsistent ledger link fails closed", async () => {
    const c=client([ok({...milestone,granted_reward_credit:true,reward_transaction_id:"different"}),ok([earn]),ok([])]);
    await expect(new MilestoneRepository(c.typed,"owner").detail(id)).rejects.toThrow("Invalid milestone reward projection");
  });
  test("reality read never queries rewards or invents verified status", async () => {
    const c=client([ok({...milestone,recognition_class:"USER_CONFIRMED_REAL_WORLD",source_type:"EXTERNAL_CREDENTIAL"})]);
    expect(await new MilestoneRepository(c.typed,"owner").detail(id)).toMatchObject({selfAttested:true,reward:{status:"NOT_AVAILABLE",transaction:null,correction:null,existingSourceReward:null}});
    expect(c.db.from).toHaveBeenCalledExactlyOnceWith("milestones");
  });
  test("missing owned detail fails with a domain error", async () => {
    const c=client([ok(null)]);
    await expect(new MilestoneRepository(c.typed,"owner").detail(id)).rejects.toThrow("MILESTONE_NOT_FOUND");
  });
  test("stable pagination queries limit plus one and does not enrich the sentinel", async () => {
    const c=client([ok([milestone,{...milestone,id:"sentinel",source_id:"sentinel-source"}]),ok([])]);
    const page=await new MilestoneRepository(c.typed,"owner").list({limit:1,offset:1000},{status:"REVOKED"});
    expect(page.nextOffset).toBe(1001); expect(page.items.map(m=>m.id)).toEqual([id]);
    expect(c.chains[0].range).toHaveBeenCalledWith(1000,1001);
    expect(c.chains[0].order.mock.calls).toEqual([["created_at",{ascending:false}],["id",{ascending:false}]]);
    expect(c.chains[1].in).toHaveBeenCalledWith("canonical_source_id",[source]);
  });
});

describe("8F repository writes only through bound RPC without prefetch", () => {
  const input={milestoneKey:"m",title:"Title",description:null,recognitionClass:"CORE_VERIFIED",sourceType:"QUEST",sourceId:source,
    externalEvidenceUrl:null,externalCredentialId:null,confirmationRequestIdempotencyKey:"key"};
  test("confirm forwards exact tuple including explicit nulls and returns the original replay", async () => {
    const snapshot={ok:true,replayed:true,milestone:{...milestone,status:"ACTIVE"}};
    const c=client([],ok(snapshot)); const result=await new MilestoneRepository(c.typed,"owner").confirm(input);
    expect(result).toBe(snapshot); expect(c.db.from).not.toHaveBeenCalled();
    expect(c.db.rpc).toHaveBeenCalledExactlyOnceWith("rpc_confirm_milestone",{
      p_milestone_key:"m",p_title:"Title",p_description:null,p_recognition_class:"CORE_VERIFIED",p_source_type:"QUEST",p_source_id:source,
      p_external_evidence_url:null,p_external_credential_id:null,p_confirmation_request_idempotency_key:"key"});
  });
  test.each(["settle","revoke"] as const)("%s invokes only its accepted RPC", async kind => {
    const c=client([],ok({ok:true,replayed:false,milestone})); const repo=new MilestoneRepository(c.typed,"owner");
    await repo[kind](id,"value","key"); expect(c.db.from).not.toHaveBeenCalled();
    expect(c.db.rpc).toHaveBeenCalledExactlyOnceWith(kind==="settle"?"rpc_settle_milestone_reward":"rpc_revoke_milestone",kind==="settle"
      ? {p_milestone_id:id,p_policy_version:"value",p_request_idempotency_key:"key"}
      : {p_milestone_id:id,p_revocation_reason:"value",p_revocation_request_idempotency_key:"key"});
  });
  test.each([null,{}, {ok:false,replayed:false,milestone}, {ok:true,milestone}, {ok:true,replayed:true}])("malformed authority response fails closed: %j", async data => {
    const c=client([],ok(data));
    await expect(new MilestoneRepository(c.typed,"owner").confirm(input)).rejects.toThrow("Invalid milestone authority response");
  });
});
