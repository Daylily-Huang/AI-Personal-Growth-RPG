import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { EvidenceSubmissionRepository } from "@/lib/evidence-submission/repository";
const id = (n: number) => `10000000-0000-0000-0000-${n.toString(16).padStart(12, "0")}`;
const uid = id(1), activityId = id(2), requestId = id(3), skillId = id(4);
const input = { requestId, skillId, description: "正文 literal <script> / https://example.invalid" };
function raw() { return { userId: uid, replayed: false, submission: { requestId, activityId, requestedSkillId: skillId,
  evidence: { userId: uid, id: id(5), activityId, skillId, evidenceLevel: 0, evidenceType: "user_submission", description: input.description, verified: false, createdAt: "2026-10-11T00:00:00Z" } } }; }
function sdk(response: unknown = raw(), status = 200) {
  const calls: { url: URL; method: string; body: unknown }[] = [];
  const client = createClient("http://evidence.invalid", "synthetic-public-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (request, init) => {
    const url = new URL(request instanceof Request ? request.url : String(request));
    calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify(response), { status, headers: { "Content-Type": "application/json" } });
  } } });
  return { calls, repo: new EvidenceSubmissionRepository(client, uid) };
}
describe("actual installed Supabase SDK evidence RPC adapter", () => {
  it("dispatches exactly one create RPC with normalized immutable tuple", async () => {
    const { calls, repo } = sdk(); const result = await repo.submit(activityId, { ...input, description: `　${input.description}\u000b` });
    expect(calls).toHaveLength(1); expect(calls[0].method).toBe("POST");
    expect(calls[0].url.pathname).toBe("/rest/v1/rpc/rpc_submit_activity_evidence");
    expect(calls[0].body).toEqual({ p_activity_id: activityId, p_request_id: requestId, p_input: { skillId, description: input.description } });
    expect(result.submission.evidence.verified).toBe(false); expect(JSON.stringify(result)).not.toContain(uid);
  });
  it("replay uses sameRPC without Activity/Skill prefetch", async () => {
    const { calls, repo } = sdk({ ...raw(), replayed: true });
    expect((await repo.submit(activityId, input)).replayed).toBe(true); expect(calls).toHaveLength(1);
  });
  it.each(["submissions", "skills"] as const)("read %s only dispatches bounded list RPC", async view => {
    const { calls, repo } = sdk({ userId: uid, activityId, view, items: [], nextCursor: null });
    expect(await repo.list(activityId, { view, after: requestId })).toEqual({ view, items: [], nextCursor: null });
    expect(calls).toHaveLength(1); expect(calls[0].url.pathname).toBe("/rest/v1/rpc/rpc_list_activity_evidence_submissions");
    expect(calls[0].body).toEqual({ p_activity_id: activityId, p_view: view, p_after: requestId });
  });
  it("invalid direct callers dispatch no SDK request", async () => {
    const { calls, repo } = sdk();
    await expect(repo.submit("invalid", input)).rejects.toThrow();
    await expect(repo.submit(activityId, { ...input, description: "" })).rejects.toThrow();
    await expect(repo.list(activityId, { view: "all", after: null } as never)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
  it.each([null, [], {}, { ...raw(), userId: id(999) }, { ...raw(), replayed: "false" }])("wrong raw response %# never succeeds or performs fallback write", async response => {
    const { calls, repo } = sdk(response); await expect(repo.submit(activityId, input)).rejects.toThrow("INVALID_EVIDENCE_RECEIPT"); expect(calls).toHaveLength(1);
  });
  it("SQL conflict remains typed, no retry/new ID hidden in repository", async () => {
    const { calls, repo } = sdk({ code: "23505", message: "EVIDENCE_REQUEST_REUSED" }, 409);
    await expect(repo.submit(activityId, input)).rejects.toMatchObject({ code: "23505", message: "EVIDENCE_REQUEST_REUSED" }); expect(calls).toHaveLength(1);
  });
  it("raw read owners must match both top-level and every Core row", async () => {
    const data = { userId: uid, activityId, view: "submissions", items: [raw().submission], nextCursor: null };
    Object.assign(data.items[0].evidence, { userId: id(999) });
    await expect(sdk(data).repo.list(activityId, { view: "submissions", after: null })).rejects.toThrow("INVALID_EVIDENCE_RECEIPT");
  });
});
