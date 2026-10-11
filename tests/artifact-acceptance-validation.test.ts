import { describe, expect, it } from "vitest";
import { parseAcceptArtifactInput, parseRevokeArtifactInput, parseArtifactAcceptanceReceipt, parseArtifactAcceptanceView, artifactAcceptanceFromRaw, artifactAcceptanceUuid } from "@/lib/artifact-acceptance/validation";

const id = "11111111-1111-4111-8111-111111111111", owner = "22222222-2222-4222-8222-222222222222";
const earnId = "33333333-3333-4333-8333-333333333333", accountId = "44444444-4444-4444-8444-444444444444";
const correctionId = "55555555-5555-4555-8555-555555555555", stamp = "2026-10-12T00:00:00.123456+00:00";
function receipt(revoked = false) {
  return { acceptance: { id: "66666666-6666-4666-8666-666666666666", userId: owner, artifactId: id,
    recognitionClass: "USER_CONFIRMED_ARTIFACT", status: revoked ? "REVOKED" : "ACTIVE", acceptedTitle: "可复用分析", acceptedVersion: "1.0",
    acceptedUpdatedAt: stamp, acceptanceNote: "通过我的交付清单", acceptedAt: stamp, earnTransactionId: earnId, policyVersion: "artifact-manual-v1",
    revokedAt: revoked ? stamp : null, revocationReason: revoked ? "交付有误" : null, correctionTransactionId: revoked ? correctionId : null },
  earn: { id: earnId, userId: owner, accountId, eventKind: "EARN", amount: 100, sourceType: "ARTIFACT", sourceId: id,
    policyVersion: "artifact-manual-v1", correctionForId: null, createdAt: stamp },
  correction: revoked ? { id: correctionId, userId: owner, accountId, eventKind: "CORRECTION", amount: -100, sourceType: "ARTIFACT", sourceId: id,
    policyVersion: "artifact-manual-v1", correctionForId: earnId, createdAt: stamp } : null, replayed: false };
}
const input = () => ({ requestKey: "first-acceptance", expectedUpdatedAt: stamp, acceptanceNote: "通过我的交付清单" });

describe("Artifact manual boundary: no defaults, exact100, stable identity and raw timestamp", () => {
  it("requires a primitive lifecycle string without coercion or invoking user code", () => {
    let coerced = 0;
    const base = { id, userId: owner, title: "作品", version: null, isArchived: false, updatedAt: stamp };
    for (const lifecycleStatus of [["active"], ["draft"], ["superseded"], new String("active"), null, undefined, 1, true,
      { toString() { coerced++; return "active"; } }, { [Symbol.toPrimitive]() { coerced++; return "active"; } }]) {
      expect(() => parseArtifactAcceptanceView({ artifact: { ...base, lifecycleStatus }, acceptance: null, earn: null, correction: null }, id, owner)).toThrow("ARTIFACT_ACCEPTANCE_INVALID_RECEIPT");
    }
    expect(coerced).toBe(0);
  });
  it("normalizes only user text/key and UUID; retains six timestamp decimals", () => {
    expect(parseAcceptArtifactInput({ ...input(), requestKey: "\u000b first \uFEFF", acceptanceNote: "\u3000交付\t" }))
      .toEqual({ requestKey: "first", expectedUpdatedAt: stamp, acceptanceNote: "交付" });
    expect(artifactAcceptanceUuid(id.toUpperCase())).toBe(id);
    expect(parseRevokeArtifactInput({ requestKey: " r ", reason: " 更正 " })).toEqual({ requestKey: "r", reason: "更正" });
  });
  for (const field of ["requestKey", "expectedUpdatedAt", "acceptanceNote"]) {
    for (const bad of [null, undefined, 1, false, {}, [], "", " ", "\u0000", "\ud800", "\udc00"]) {
      it(`rejects invalid required ${field} ${String(bad)}`, () => {
        expect(() => parseAcceptArtifactInput({ ...input(), [field]: bad })).toThrow("ARTIFACT_ACCEPTANCE_INVALID_INPUT");
      });
    }
  }
  it("counts Unicode codepoints rather than UTF16 units", () => {
    expect(parseAcceptArtifactInput({ ...input(), acceptanceNote: "🧬".repeat(2000), requestKey: "🧬".repeat(200) }).acceptanceNote).toHaveLength(4000);
    expect(() => parseAcceptArtifactInput({ ...input(), acceptanceNote: "🧬".repeat(2001) })).toThrow();
    expect(() => parseAcceptArtifactInput({ ...input(), requestKey: "x".repeat(201) })).toThrow();
    expect(() => parseRevokeArtifactInput({ requestKey: "r", reason: "x".repeat(2001) })).toThrow();
  });
  it.each(["2026-02-30T00:00:00Z", "2025-02-29T00:00:00Z", "0000-01-01T00:00:00Z", "2026-10-12", "2026-10-12T00:00:00", "2026-10-12T24:00:00Z", "2026-10-12T00:00:00+25:00"])("rejects invalid timestamp %s", value => {
    expect(() => parseAcceptArtifactInput({ ...input(), expectedUpdatedAt: value })).toThrow();
  });
  it("rejects extra/inherited/accessor/symbol authority and prototype fields without invoking getters", () => {
    for (const key of ["amount", "policy", "userId", "status", "recognitionClass", "__proto__", "constructor"]) {
      const v = Object.defineProperty(input(), key, { value: 100, enumerable: true });
      expect(() => parseAcceptArtifactInput(v)).toThrow();
    }
    expect(() => parseAcceptArtifactInput(Object.assign(Object.create({ amount: 100 }), input()))).toThrow();
    expect(() => parseAcceptArtifactInput(Object.defineProperty(input(), Symbol("owner"), { value: owner }))).toThrow();
    let calls = 0;
    const getter = Object.defineProperty(input(), "acceptanceNote", { get() { calls++; throw Error("unsafe getter"); } });
    expect(() => parseAcceptArtifactInput(getter)).toThrow("ARTIFACT_ACCEPTANCE_INVALID_INPUT"); expect(calls).toBe(0);
  });
  it("accepts exact original/revoked receipts and an ACTIVE recognition corrected by the old generic RPC", () => {
    expect(parseArtifactAcceptanceReceipt(receipt(), id, owner).earn.amount).toBe(100);
    expect(parseArtifactAcceptanceReceipt(receipt(true), id, owner).correction?.amount).toBe(-100);
    const corrected = receipt(); corrected.correction = receipt(true).correction;
    expect(parseArtifactAcceptanceReceipt(corrected, id, owner).acceptance.status).toBe("ACTIVE");
    expect(parseArtifactAcceptanceReceipt({ ...receipt(), replayed: true }, id, owner).replayed).toBe(true);
  });
  for (const field of Object.keys(receipt().acceptance)) {
    it(`rejects missing required acceptance ${field}`, () => {
      const r = structuredClone(receipt()), value = r.acceptance as Record<string, unknown>; delete value[field];
      expect(() => parseArtifactAcceptanceReceipt(r, id, owner)).toThrow("ARTIFACT_ACCEPTANCE_INVALID_RECEIPT");
    });
  }
  it.each([null, undefined, "active", "", "constructor", "RETIRED"])("never defaults malformed status %s to ACTIVE", status => {
    expect(() => parseArtifactAcceptanceReceipt({ ...receipt(), acceptance: { ...receipt().acceptance, status } }, id, owner)).toThrow();
  });
  for (const [field, bad] of [["userId", id], ["accountId", earnId], ["eventKind", "EARN"], ["amount", -99], ["sourceType", "QUEST"], ["sourceId", owner], ["policyVersion", "reward-v1"], ["correctionForId", id], ["id", earnId]] as const) {
    it(`rejects wrong correction ${field}`, () => {
      const r = receipt(true); expect(() => parseArtifactAcceptanceReceipt({ ...r, correction: { ...r.correction, [field]: bad } }, id, owner)).toThrow();
    });
  }
  for (const [field, bad] of [["userId", id], ["eventKind", "CORRECTION"], ["amount", 99], ["sourceType", "QUEST"], ["sourceId", owner], ["policyVersion", "reward-v1"], ["correctionForId", id], ["id", id]] as const) {
    it(`rejects wrong original EARN ${field}`, () => {
      const r = receipt(); expect(() => parseArtifactAcceptanceReceipt({ ...r, earn: { ...r.earn, [field]: bad } }, id, owner)).toThrow();
    });
  }
  it("requires a revoked link to match the actual correction and nullable fields to be explicit", () => {
    expect(() => parseArtifactAcceptanceReceipt({ ...receipt(true), correction: null }, id, owner)).toThrow();
    const r = receipt(true); r.acceptance.correctionTransactionId = id;
    expect(() => parseArtifactAcceptanceReceipt(r, id, owner)).toThrow();
    expect(() => parseArtifactAcceptanceReceipt({ ...receipt(), acceptance: { ...receipt().acceptance, revokedAt: stamp } }, id, owner)).toThrow();
  });
  it("NONE is explicit, owned and readonly; missing/malformed rows are never converted to NONE", () => {
    const artifact = { id, userId: owner, title: "作品", version: null, lifecycleStatus: "active", isArchived: false, updatedAt: stamp };
    expect(parseArtifactAcceptanceView({ artifact, acceptance: null, earn: null, correction: null }, id, owner).acceptance).toBeNull();
    expect(() => parseArtifactAcceptanceView({ artifact, acceptance: undefined, earn: null, correction: null }, id, owner)).toThrow();
    expect(() => parseArtifactAcceptanceView({ artifact, acceptance: null, earn: receipt().earn, correction: null }, id, owner)).toThrow();
    expect(() => parseArtifactAcceptanceView({ artifact: { ...artifact, userId: id }, acceptance: null, earn: null, correction: null }, id, owner)).toThrow();
    expect(() => parseArtifactAcceptanceView({ artifact: { ...artifact, isArchived: true }, acceptance: null, earn: null, correction: null }, id, owner)).toThrow();
    expect(() => artifactAcceptanceFromRaw({ status: "ACTIVE" })).toThrow();
  });
});
