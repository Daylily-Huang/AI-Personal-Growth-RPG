import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { ArtifactAcceptanceRepository } from "@/lib/artifact-acceptance/repository";

const id = "11111111-1111-4111-8111-111111111111", owner = "22222222-2222-4222-8222-222222222222";
const earnId = "33333333-3333-4333-8333-333333333333", accountId = "44444444-4444-4444-8444-444444444444";
const correctionId = "55555555-5555-4555-8555-555555555555", stamp = "2026-10-12T00:00:00.123456+00:00";
const source = () => ({ id, user_id: owner, title: "交付作品", version: "1.0", lifecycle_status: "active", is_archived: false, updated_at: stamp });
const acceptance = () => ({ id: "66666666-6666-4666-8666-666666666666", user_id: owner, artifact_id: id,
  recognition_class: "USER_CONFIRMED_ARTIFACT", status: "ACTIVE", accepted_title: "验收时旧标题", accepted_version: null,
  accepted_updated_at: stamp, acceptance_note: "完成我的清单", accepted_at: stamp, earn_transaction_id: earnId, policy_version: "artifact-manual-v1",
  revoked_at: null, revocation_reason: null, correction_transaction_id: null });
const earn = () => ({ id: earnId, user_id: owner, account_id: accountId, event_kind: "EARN", amount: 100,
  canonical_source_type: "ARTIFACT", canonical_source_id: id, policy_version: "artifact-manual-v1", correction_for_id: null, created_at: stamp });
const correction = () => ({ ...earn(), id: correctionId, event_kind: "CORRECTION", amount: -100, correction_for_id: earnId });
function harness(rows: unknown[]) {
  const calls: Array<{ table: string; columns: string; filters: Array<[string, unknown]> }> = [];
  const client = { rpc: vi.fn(), from: vi.fn((table: string) => {
    const entry = { table, columns: "", filters: [] as Array<[string, unknown]> }; calls.push(entry);
    const query = { select(columns: string) { entry.columns = columns; return query; },
      eq(column: string, value: unknown) { entry.filters.push([column, value]); return query; },
      maybeSingle: vi.fn(async () => ({ data: rows.shift(), error: null })) };
    return query;
  }) };
  return { client, calls, repo: new ArtifactAcceptanceRepository(client as unknown as SupabaseClient, owner) };
}
describe("Artifact repository: owned readonly projection, strict raw provenance, no mutation prefetch", () => {
  it("a truly absent acceptance is NONE after an owned source lookup and performs no account creation", async () => {
    const h = harness([source(), null]), view = await h.repo.get(id);
    expect(view.acceptance).toBeNull(); expect(h.calls.map(x => x.table)).toEqual(["artifacts", "artifact_acceptances"]);
    expect(h.client.rpc).not.toHaveBeenCalled();
    for (const call of h.calls) expect(call.filters).toContainEqual(["user_id", owner]);
  });
  it("foreign/missing source is404 without querying recognition or account", async () => {
    const h = harness([null]); await expect(h.repo.get(id)).rejects.toThrow("ARTIFACT_ACCEPTANCE_NOT_FOUND");
    expect(h.calls).toHaveLength(1); expect(h.client.rpc).not.toHaveBeenCalled();
  });
  it("preserves nullable version, old title and raw microseconds without replacing the accepted snapshot", async () => {
    const h = harness([source(), acceptance(), earn(), null, { id: accountId, user_id: owner }]), view = await h.repo.get(id);
    expect(view.artifact.title).toBe("交付作品"); expect(view.acceptance?.acceptedTitle).toBe("验收时旧标题");
    expect(view.acceptance?.acceptedVersion).toBeNull(); expect(view.acceptance?.acceptedUpdatedAt).toBe(stamp);
    expect(view.earn?.amount).toBe(100); expect(h.calls).toHaveLength(5); expect(h.client.rpc).not.toHaveBeenCalled();
    for (const call of h.calls) expect(call.filters).toContainEqual(["user_id", owner]);
  });
  it("discovers a prior generic correction even while recognition is ACTIVE and never repairs a cache", async () => {
    const h = harness([source(), acceptance(), earn(), correction(), { id: accountId, user_id: owner }]), view = await h.repo.get(id);
    expect(view.acceptance?.status).toBe("ACTIVE"); expect(view.correction?.amount).toBe(-100);
    expect(h.calls[3].filters).toContainEqual(["correction_for_id", earnId]); expect(h.client.rpc).not.toHaveBeenCalled();
  });
  it.each([undefined, null, "active", "RETIRED"])("raw malformed status %s is not defaulted", async status => {
    const h = harness([source(), { ...acceptance(), status }]); await expect(h.repo.get(id)).rejects.toThrow("ARTIFACT_ACCEPTANCE_INVALID_RECEIPT");
  });
  it("requires status to have actually been projected, not guessed by a mapper", async () => {
    const row: Record<string, unknown> = acceptance(); delete row.status;
    const h = harness([source(), row]); await expect(h.repo.get(id)).rejects.toThrow("ARTIFACT_ACCEPTANCE_INVALID_RECEIPT");
    expect(h.calls[1].columns.split(",")).toContain("status");
  });
  it.each([null, { id: accountId, user_id: id }, { id: earnId, user_id: owner }])("fails closed when ledger account provenance is unavailable %s", async account => {
    const h = harness([source(), acceptance(), earn(), null, account]); await expect(h.repo.get(id)).rejects.toThrow("ARTIFACT_ACCEPTANCE_INVALID_RECEIPT");
    expect(h.client.rpc).not.toHaveBeenCalled();
  });
  it.each([null, { ...earn(), amount: 200 }, { ...earn(), user_id: id }, { ...earn(), canonical_source_type: "QUEST" }, { ...earn(), policy_version: "reward-v1" }])("rejects corrupt or missing EARN %s", async value => {
    const h = harness([source(), acceptance(), value, null]); await expect(h.repo.get(id)).rejects.toThrow("ARTIFACT_ACCEPTANCE_INVALID_RECEIPT");
  });
  it("a renamed/archived current source can still expose the original acceptance and revoke provenance", async () => {
    const row = { ...acceptance(), status: "REVOKED", revoked_at: stamp, revocation_reason: "交付有误", correction_transaction_id: correctionId };
    const h = harness([{ ...source(), title: "后改名", version: "2.0", lifecycle_status: "archived", is_archived: true }, row, earn(), correction(), { id: accountId, user_id: owner }]);
    const view = await h.repo.get(id); expect(view.artifact.title).toBe("后改名"); expect(view.acceptance?.status).toBe("REVOKED"); expect(view.correction?.id).toBe(correctionId);
  });
  it("mutation issues only its exact RPC, and rejects a malformed receipt rather than checking current source first", async () => {
    const h = harness([]); h.client.rpc.mockResolvedValue({ data: { replayed: true }, error: null });
    await expect(h.repo.accept(id, { requestKey: "same", expectedUpdatedAt: stamp, acceptanceNote: "交付" })).rejects.toThrow("ARTIFACT_ACCEPTANCE_INVALID_RECEIPT");
    expect(h.client.from).not.toHaveBeenCalled(); expect(h.client.rpc).toHaveBeenCalledExactlyOnceWith("rpc_accept_artifact_manual", {
      p_artifact_id: id, p_expected_updated_at: stamp, p_acceptance_note: "交付", p_request_key: "same",
    });
    h.client.rpc.mockClear(); h.client.rpc.mockResolvedValue({ data: null, error: { message: "ARTIFACT_ACCEPTANCE_KEY_REUSED", code: "23505" } });
    await expect(h.repo.revoke(id, { requestKey: "same", reason: "更正" })).rejects.toMatchObject({ message: "ARTIFACT_ACCEPTANCE_KEY_REUSED", sqlState: "23505" });
    expect(h.client.from).not.toHaveBeenCalled();
  });
});
