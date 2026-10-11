import {
  PROPOSAL_EDIT_BODY_BYTES, PROPOSAL_EDIT_RESPONSE_BYTES, PROPOSAL_FACT_HISTORY_RESPONSE_BYTES,
  PROPOSAL_FACT_SKILL_RESPONSE_BYTES, PROPOSAL_FACT_TEXT_BYTES, PROPOSAL_EDIT_PROVENANCE_BYTES,
  ProposalEditError,
  type ProposalEditInput, type ProposalEditRequest, type ProposalEditFactsView, type ProposalFactSkill,
  type ProposalFactSkillsView, type ProposalFactHistoryView, type ProposalFactHistoryItem,
} from "./types";
import { parseProposalEditInput, parsePublicProposalEditRequest, proposalFactUuid, wellFormedProposalFactText,
  validateProposalFactSettlementRevision } from "./validation";

export class ProposalEditClientError extends Error {
  constructor(readonly code: "auth" | "not_found" | "conflict" | "invalid" | "unavailable" | "unknown") { super(code); }
}
export type ProposalEditClientResult =
  | { status: "completed"; replayed: boolean; request: Extract<ProposalEditRequest, { status: "completed" }> }
  | { status: "in_progress" | "failed" | "expired" | "conflict"; requestId: string };
const bytes = (value: string) => new TextEncoder().encode(value).byteLength;
function invalid(): never { throw new ProposalEditClientError("unavailable"); }
function record(value: unknown, keys: readonly string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return invalid();
  if (Reflect.ownKeys(value).length !== keys.length || Reflect.ownKeys(value).some(key => typeof key !== "string" || !keys.includes(key))) return invalid();
  for (const key of keys) { const descriptor = Object.getOwnPropertyDescriptor(value, key); if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return invalid(); }
  return value as Record<string, unknown>;
}
function uuid(value: unknown): string { try { const id = proposalFactUuid(value); if (id !== value) return invalid(); return id; } catch { return invalid(); } }
function label(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || !wellFormedProposalFactText(value) || bytes(value) > PROPOSAL_EDIT_PROVENANCE_BYTES) return invalid(); return value;
}
function array(value: unknown, cap: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > cap || Reflect.ownKeys(value).length !== value.length + 1) return invalid();
  for (let index = 0; index < value.length; index++) { const descriptor = Object.getOwnPropertyDescriptor(value, String(index)); if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return invalid(); }
  return value;
}
function page(items: { id: string }[], next: unknown, after: string | null, size: number): string | null {
  if (items.some((item, index) => item.id <= (index ? items[index - 1].id : after ?? ""))) return invalid();
  if (next === null) return null;
  if (items.length !== size || uuid(next) !== items[items.length - 1].id) return invalid(); return next as string;
}
function oldMinutes(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < -2147483648 || value > 2147483647) return invalid(); return value;
}
async function read(response: Response, cap: number): Promise<unknown> {
  const reader = response.body?.getReader(); if (!reader) return invalid();
  const decoder = new TextDecoder("utf-8", { fatal: true }); let size = 0, text = "";
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > cap) return invalid(); text += decoder.decode(value, { stream: true }); }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch { void reader.cancel().catch(() => undefined); return invalid(); }
  finally { reader.releaseLock(); }
}
function httpFailure(response: Response): never {
  void response.body?.cancel().catch(() => undefined);
  const codes = new Map<number, ProposalEditClientError["code"]>([[401, "auth"], [404, "not_found"], [409, "conflict"], [400, "invalid"], [403, "invalid"], [413, "invalid"], [415, "invalid"]]);
  throw new ProposalEditClientError(codes.get(response.status) ?? "unavailable");
}
async function get(path: string, signal: AbortSignal, cap: number) {
  const response = await fetch(path, { method: "GET", credentials: "same-origin", cache: "no-store", signal });
  if (response.status !== 200) return httpFailure(response); return read(response, cap);
}
export async function loadProposalFacts(base: string, activity: string, signal: AbortSignal): Promise<ProposalEditFactsView> {
  const assessmentId = proposalFactUuid(base), activityId = proposalFactUuid(activity);
  const value = record(await get(`/api/assessments/${assessmentId}/edit`, signal, PROPOSAL_EDIT_RESPONSE_BYTES), ["assessmentId", "activityId", "rulesVersion", "original", "currentRevision"]);
  if (uuid(value.assessmentId) !== assessmentId || uuid(value.activityId) !== activityId) return invalid();
  const rulesVersion = label(value.rulesVersion), original = record(value.original, ["description", "descriptionTruncated", "totalMinutes", "effectiveMinutes"]);
  if (typeof original.description !== "string" || !wellFormedProposalFactText(original.description) || bytes(original.description) > PROPOSAL_FACT_TEXT_BYTES || typeof original.descriptionTruncated !== "boolean") return invalid();
  const currentRevision = value.currentRevision === null ? null : validateProposalFactSettlementRevision(value.currentRevision, assessmentId, activityId, rulesVersion);
  return { assessmentId, activityId, rulesVersion, currentRevision, original: { description: original.description, descriptionTruncated: original.descriptionTruncated,
    totalMinutes: oldMinutes(original.totalMinutes), effectiveMinutes: oldMinutes(original.effectiveMinutes) } };
}
export async function loadProposalSkills(base: string, activity: string, after: string | null, signal: AbortSignal): Promise<ProposalFactSkillsView> {
  const assessmentId = proposalFactUuid(base), activityId = proposalFactUuid(activity), cursor = after === null ? null : proposalFactUuid(after);
  const params = new URLSearchParams({ view: "skills" }); if (cursor) params.set("after", cursor);
  const value = record(await get(`/api/assessments/${assessmentId}/edit?${params}`, signal, PROPOSAL_FACT_SKILL_RESPONSE_BYTES), ["assessmentId", "activityId", "items", "nextCursor"]);
  if (uuid(value.assessmentId) !== assessmentId || uuid(value.activityId) !== activityId) return invalid();
  const items = array(value.items, 50).map(item => {
    const row = record(item, ["id", "name", "nameTruncated", "masteryLevel", "masteryConfidence"]);
    if (typeof row.name !== "string" || !row.name.trim() || !wellFormedProposalFactText(row.name) || [...row.name].length > 200 || typeof row.nameTruncated !== "boolean" ||
      typeof row.masteryLevel !== "number" || !Number.isInteger(row.masteryLevel) || row.masteryLevel < 0 || row.masteryLevel > 10 ||
      typeof row.masteryConfidence !== "number" || !Number.isFinite(row.masteryConfidence) || row.masteryConfidence < 0 || row.masteryConfidence > 1) return invalid();
    return { id: uuid(row.id), name: row.name, nameTruncated: row.nameTruncated, masteryLevel: row.masteryLevel, masteryConfidence: row.masteryConfidence } satisfies ProposalFactSkill;
  });
  return { assessmentId, activityId, items, nextCursor: page(items, value.nextCursor, cursor, 50) };
}
export async function loadProposalHistory(activity: string, after: string | null, signal: AbortSignal): Promise<ProposalFactHistoryView> {
  const activityId = proposalFactUuid(activity), cursor = after === null ? null : proposalFactUuid(after);
  const value = record(await get(`/api/activities/${activityId}/fact-revisions${cursor ? `?after=${cursor}` : ""}`, signal, PROPOSAL_FACT_HISTORY_RESPONSE_BYTES), ["activityId", "items", "nextCursor"]);
  if (uuid(value.activityId) !== activityId) return invalid();
  const items = array(value.items, 25).map(item => {
    const keys = ["id", "requestId", "activityId", "baseAssessmentId", "resultAssessmentId", "previousRevisionId", "rulesVersion", "promptVersion", "createdAt", "facts"];
    const row = record(item, [...keys, "modelName", "assessmentStatus"]);
    if (!["pending", "confirmed", "edited", "rejected", "superseded"].includes(row.assessmentStatus as string)) return invalid();
    const revision = validateProposalFactSettlementRevision(Object.fromEntries(keys.map(key => [key, row[key]])), uuid(row.resultAssessmentId), activityId, label(row.rulesVersion));
    return { ...revision, modelName: label(row.modelName), assessmentStatus: row.assessmentStatus } as ProposalFactHistoryItem;
  });
  if (new Set(items.map(item => item.requestId)).size !== items.length || new Set(items.map(item => item.resultAssessmentId)).size !== items.length) return invalid();
  return { activityId, items, nextCursor: page(items, value.nextCursor, cursor, 25) };
}
async function result(response: Response, base: string, activity: string, input: ProposalEditInput, lookup: boolean): Promise<ProposalEditClientResult> {
  if (![200, 201, 202, 409, 502].includes(response.status)) return httpFailure(response);
  const raw = await read(response, PROPOSAL_EDIT_RESPONSE_BYTES);
  if (response.status === 200 || response.status === 201) {
    const value = record(raw, ["replayed", "request"]);
    if (typeof value.replayed !== "boolean" || response.status !== (value.replayed ? 200 : 201) || (lookup && !value.replayed)) return invalid();
    const request = parsePublicProposalEditRequest(value.request, base, activity, input);
    if (request.status !== "completed") return invalid(); return { status: "completed", replayed: value.replayed, request };
  }
  if (response.status === 202) {
    const value = record(raw, ["requestId", "status"]);
    if (uuid(value.requestId) !== input.requestId || value.status !== "in_progress") return invalid(); return { status: "in_progress", requestId: input.requestId };
  }
  // A generic409/502 is not proof that this request reached a terminal state.
  if (!raw || typeof raw !== "object" || !Object.hasOwn(raw, "requestId")) return httpFailure(response);
  const value = record(raw, ["requestId", "status", "error"]);
  if (uuid(value.requestId) !== input.requestId || typeof value.error !== "string" || bytes(value.error) > 1024 ||
    (response.status === 502 ? value.status !== "failed" : value.status !== "expired" && value.status !== "conflict")) return invalid();
  return { status: value.status as "failed" | "expired" | "conflict", requestId: input.requestId };
}
export async function submitProposalFacts(base: string, activity: string, value: ProposalEditInput, signal: AbortSignal) {
  const assessmentId = proposalFactUuid(base), activityId = proposalFactUuid(activity), input = parseProposalEditInput(value), body = JSON.stringify(input);
  if (bytes(body) > PROPOSAL_EDIT_BODY_BYTES) throw new ProposalEditClientError("invalid");
  try {
    const response = await fetch(`/api/assessments/${assessmentId}/edit`, { method: "POST", credentials: "same-origin", cache: "no-store", signal,
      headers: { "Content-Type": "application/json" }, body });
    return await result(response, assessmentId, activityId, input, false);
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof ProposalEditClientError && ["auth", "not_found", "conflict", "invalid"].includes(error.code)) throw error;
    throw new ProposalEditClientError("unknown");
  }
}
export async function checkProposalFacts(base: string, activity: string, value: ProposalEditInput, signal: AbortSignal) {
  const assessmentId = proposalFactUuid(base), activityId = proposalFactUuid(activity), input = parseProposalEditInput(value);
  const params = new URLSearchParams({ view: "request", requestId: input.requestId });
  const response = await fetch(`/api/assessments/${assessmentId}/edit?${params}`, { method: "GET", credentials: "same-origin", cache: "no-store", signal });
  return result(response, assessmentId, activityId, input, true);
}
export function proposalEditClientMessage(error: unknown) {
  if (error instanceof ProposalEditError && (error.code === "INVALID_PROPOSAL_EDIT_INPUT" || error.code === "PROPOSAL_EDIT_PAYLOAD_TOO_LARGE"))
    return "请检查事实描述、0到1440整数分钟（有效分钟不超过总分钟）及最多5项技能线索";
  const messages = new Map<ProposalEditClientError["code"], string>([["auth", "登录已过期，请重新登录"], ["not_found", "该活动或建议不可用，请刷新核实"],
    ["conflict", "建议状态已变化，请先核实已有请求和当前建议"], ["invalid", "请检查事实、分钟数和技能线索，或从本站重新打开"],
    ["unknown", "提交结果尚不明确，请用原编号核实；不要重复发起 AI 重评"], ["unavailable", "暂未取得有效结果，请重新读取或核实原请求"]]);
  return (error instanceof ProposalEditClientError ? messages.get(error.code) : undefined) ?? "暂未取得有效结果，请重新读取或核实原请求";
}
