import { ArtifactAcceptanceError, type AcceptArtifactInput, type RevokeArtifactInput, type ArtifactAcceptanceMemory, type ArtifactAcceptanceSession } from "./types";
import { parseArtifactAcceptanceView, parseArtifactAcceptanceReceipt, parseAcceptArtifactInput, parseRevokeArtifactInput } from "./validation";

const MESSAGES = new Map<string, string>([
  ["ARTIFACT_ACCEPTANCE_AUTH_REQUIRED", "登录已过期，请重新登录"],
  ["ARTIFACT_ACCEPTANCE_NOT_FOUND", "作品或验收记录不可用"],
  ["ARTIFACT_ACCEPTANCE_INVALID_INPUT", "请检查验收说明、撤销原因和请求格式"],
  ["ARTIFACT_ACCEPTANCE_ALREADY_ACCEPTED", "该作品已领取首次积分，请核对现有验收记录"],
  ["ARTIFACT_ACCEPTANCE_ALREADY_REVOKED", "验收已撤销，不能重新领取积分"],
  ["ARTIFACT_ACCEPTANCE_SOURCE_INELIGIBLE", "请先将作品设为活跃且未归档，再明确验收"],
  ["ARTIFACT_ACCEPTANCE_STALE_SOURCE", "作品已变更，请重新读取当前版本后再验收"],
  ["ARTIFACT_ACCEPTANCE_KEY_REUSED", "该请求编号已用于另一项操作，请先核对原请求"],
]);
/** An external page-session store, not mutable React props or render-time refs. */
export function createArtifactAcceptanceMemory(initial: ArtifactAcceptanceSession): ArtifactAcceptanceMemory {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return { getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    update(next) { snapshot = next; for (const listener of listeners) listener(); } };
}
export function createArtifactAcceptancePageMemory() {
  const records = new Map<string, ArtifactAcceptanceMemory>();
  return { forArtifact(owner: string, id: string) {
    const key = `${owner}:${id}`;
    let record = records.get(key);
    if (!record) { record = createArtifactAcceptanceMemory({ owner, pending: null, receipt: null }); records.set(key, record); }
    return record;
  } };
}
export function artifactAcceptanceMessage(error: unknown): string {
  return error instanceof ArtifactAcceptanceError ? MESSAGES.get(error.message) ?? "验收服务暂不可用；提交结果不明时请保留原请求核对" : "网络异常，提交结果可能不明，请保留原请求核对";
}
async function response(request: Promise<Response>): Promise<unknown> {
  const result = await request; let body: unknown;
  try { body = await result.json(); } catch { throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_UNAVAILABLE"); }
  if (!result.ok) {
    const code = body && typeof body === "object" && "code" in body && typeof body.code === "string" ? body.code : "ARTIFACT_ACCEPTANCE_UNAVAILABLE";
    throw new ArtifactAcceptanceError(code);
  }
  return body;
}
export async function getArtifactAcceptance(id: string, signal?: AbortSignal) {
  return parseArtifactAcceptanceView(await response(fetch(`/api/artifacts/${id}/acceptance`, {
    credentials: "same-origin", cache: "no-store", signal: signal ?? AbortSignal.timeout(30000),
  })), id);
}
export async function acceptArtifact(id: string, value: AcceptArtifactInput) {
  const input = parseAcceptArtifactInput(value);
  return parseArtifactAcceptanceReceipt(await response(fetch(`/api/artifacts/${id}/acceptance`, {
    method: "POST", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(30000), headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  })), id);
}
export async function revokeArtifactAcceptance(id: string, value: RevokeArtifactInput) {
  const input = parseRevokeArtifactInput(value);
  return parseArtifactAcceptanceReceipt(await response(fetch(`/api/artifacts/${id}/acceptance/revoke`, {
    method: "POST", credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(30000), headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  })), id);
}
