import { isValidUuid } from "@/lib/http/validation";
import { AssessmentProposalSchema, type AssessmentProposal } from "@/lib/ai/schemas";
import {
  PROPOSAL_FACT_MINUTES_MAX, PROPOSAL_FACT_SKILLS_MAX, PROPOSAL_FACT_TEXT_BYTES,
  PROPOSAL_EDIT_MODEL_BYTES, PROPOSAL_EDIT_PROVENANCE_BYTES, PROPOSAL_EDIT_REQUEST_SECONDS,
  PROPOSAL_EDIT_RESPONSE_BYTES, PROPOSAL_FACT_PROMPT_VERSION,
  ProposalEditError, type ProposalEditInput, type ProposalEditQuery,
  type ProposalFactHistoryQuery, type ProposalFacts, type ProposalEditAssessment,
  type ProposalEditRequest, type ProposalEditBegin, type ProposalEditModelResult, type ProposalFactRevision,
  type ProposalFactSkill, type ProposalFactHistoryItem, PROPOSAL_FACT_SKILL_NAME_CODEPOINTS,
} from "./types";

const encoder = new TextEncoder();
function invalid(): never { throw new ProposalEditError("INVALID_PROPOSAL_EDIT_INPUT"); }

/** Validate data descriptors before reading: never execute a supplied accessor. */
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key))) return invalid();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return invalid();
  }
  return value as Record<string, unknown>;
}

export function proposalFactUuid(value: unknown): string {
  if (!isValidUuid(value)) return invalid();
  return value.toLowerCase();
}

export function wellFormedProposalFactText(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index);
    if (unit === 0) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}

export function proposalFactDescription(value: unknown): string {
  if (typeof value !== "string" || !wellFormedProposalFactText(value)) return invalid();
  const description = value.trim();
  if (!description || encoder.encode(description).byteLength > PROPOSAL_FACT_TEXT_BYTES) return invalid();
  return description;
}

function minutes(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > PROPOSAL_FACT_MINUTES_MAX) return invalid();
  return value === 0 ? 0 : value;
}

function skillClues(value: unknown): string[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > PROPOSAL_FACT_SKILLS_MAX) return invalid();
  // Sparse/inherited entries, extra properties and element getters are not JSON data.
  const actual = Reflect.ownKeys(value);
  const keys = ["length", ...Array.from({ length: value.length }, (_, index) => String(index))];
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key))) return invalid();
  const ids: string[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return invalid();
    ids.push(proposalFactUuid(descriptor.value));
  }
  if (new Set(ids).size !== ids.length) return invalid();
  return ids;
}

export function parseProposalFacts(value: unknown): ProposalFacts {
  const row = object(value, ["description", "totalMinutes", "effectiveMinutes", "relatedSkillIds"]);
  const totalMinutes = minutes(row.totalMinutes), effectiveMinutes = minutes(row.effectiveMinutes);
  if (totalMinutes !== null && effectiveMinutes !== null && effectiveMinutes > totalMinutes) return invalid();
  return { description: proposalFactDescription(row.description), totalMinutes, effectiveMinutes,
    relatedSkillIds: skillClues(row.relatedSkillIds) };
}

export function parseProposalEditInput(value: unknown): ProposalEditInput {
  const row = object(value, ["requestId", "facts"]);
  return { requestId: proposalFactUuid(row.requestId), facts: parseProposalFacts(row.facts) };
}

function uniqueQuery(params: URLSearchParams): string[] {
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) return invalid();
  return keys;
}

export function parseProposalEditQuery(params: URLSearchParams): ProposalEditQuery {
  const keys = uniqueQuery(params), view = params.get("view") ?? "facts";
  if (view === "facts" && keys.every(key => key === "view")) return { view };
  if (view === "skills" && keys.every(key => key === "view" || key === "after"))
    return { view, after: params.has("after") ? proposalFactUuid(params.get("after")) : null };
  if (view === "request" && params.has("requestId") && keys.every(key => key === "view" || key === "requestId"))
    return { view, requestId: proposalFactUuid(params.get("requestId")) };
  return invalid();
}

export function parseProposalFactHistoryQuery(params: URLSearchParams): ProposalFactHistoryQuery {
  if (uniqueQuery(params).some(key => key !== "after")) return invalid();
  return { after: params.has("after") ? proposalFactUuid(params.get("after")) : null };
}

function malformed(): never { throw new ProposalEditError("INVALID_PROPOSAL_EDIT_RECEIPT"); }

function receiptObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  try { return object(value, keys); } catch { return malformed(); }
}

function receiptUuid(value: unknown): string {
  try {
    const id = proposalFactUuid(value);
    if (value !== id) return malformed();
    return id;
  } catch { return malformed(); }
}

function nullableReceiptUuid(value: unknown): string | null { return value === null ? null : receiptUuid(value); }

function timestamp(value: unknown): string {
  if (typeof value !== "string" || encoder.encode(value).byteLength > 40) return malformed();
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return malformed();
  const [, y, m, d, h, min, s, , oh, om] = parts;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1] ||
      Number(h) > 23 || Number(min) > 59 || Number(s) > 59 ||
      (oh !== undefined && (Number(oh) > 23 || Number(om) > 59)) || !Number.isFinite(Date.parse(value))) return malformed();
  return value;
}

function provenance(value: unknown): string {
  if (typeof value !== "string" || !wellFormedProposalFactText(value) || !value.trim() ||
      encoder.encode(value).byteLength > PROPOSAL_EDIT_PROVENANCE_BYTES) return malformed();
  return value;
}

/** PostgreSQL keeps microseconds; Date.parse alone would collapse an expiry boundary. */
function instant(value: string): bigint {
  const fraction = /\.(\d{1,9})(?=Z|[+-]\d{2}:\d{2}$)/.exec(value);
  const seconds = value.replace(/\.\d{1,9}(?=Z|[+-]\d{2}:\d{2}$)/, "");
  return BigInt(Date.parse(seconds)) * BigInt(1000000) + BigInt((fraction?.[1] ?? "").padEnd(9, "0"));
}

/** Inspect descriptors before schema/stringify. No getters, toJSON, cycles or non-JSON numbers. */
function boundedJson(value: unknown): string {
  const pending: unknown[] = [value], seen = new Set<object>();
  let lowerBound = 0;
  while (pending.length) {
    const item = pending.pop();
    lowerBound++;
    if (typeof item === "string") {
      if (!wellFormedProposalFactText(item)) return malformed();
      lowerBound += encoder.encode(item).byteLength;
    } else if (typeof item === "number") {
      if (!Number.isFinite(item)) return malformed();
    } else if (item !== null && typeof item !== "boolean") {
      if (typeof item !== "object" || seen.has(item)) return malformed();
      seen.add(item);
      const array = Array.isArray(item), prototype = Object.getPrototypeOf(item);
      if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return malformed();
      const keys = Reflect.ownKeys(item);
      if (array && (keys.length !== item.length + 1 || keys.some(key =>
        key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= item.length)))) return malformed();
      for (const key of keys) {
        if (array && key === "length") continue;
        if (typeof key !== "string" || !wellFormedProposalFactText(key)) return malformed();
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return malformed();
        lowerBound += array ? 0 : encoder.encode(key).byteLength;
        pending.push(descriptor.value);
      }
    }
    if (lowerBound > PROPOSAL_EDIT_MODEL_BYTES || pending.length > PROPOSAL_EDIT_MODEL_BYTES) return malformed();
  }
  let encoded: string;
  try { encoded = JSON.stringify(value); } catch { return malformed(); }
  if (typeof encoded !== "string" || encoder.encode(encoded).byteLength > PROPOSAL_EDIT_MODEL_BYTES) return malformed();
  return encoded;
}

/** The old schema is intentionally unchanged; this adapter supplies its missing resource bound. */
export function parseProposalEditProposal(value: unknown): AssessmentProposal {
  const copy = JSON.parse(boundedJson(value)) as Record<string, unknown>;
  const parsed = AssessmentProposalSchema.safeParse(copy);
  if (!parsed.success) return malformed();
  // z.record drops a literal __proto__ key. Preserve the already-validated JSON
  // metadata from our detached copy, without changing the frozen old schema.
  const originals = copy.artifactProposals as Record<string, unknown>[] | undefined;
  parsed.data.artifactProposals?.forEach((artifact, index) => {
    if (originals && Object.hasOwn(originals[index], "metadata"))
      artifact.metadata = originals[index].metadata as Record<string, unknown>;
  });
  boundedJson(parsed.data);
  return parsed.data;
}

export function parseProposalEditModelResult(value: unknown): ProposalEditModelResult {
  const row = receiptObject(value, ["proposal", "modelName", "promptVersion"]);
  if (row.promptVersion !== PROPOSAL_FACT_PROMPT_VERSION) return malformed();
  return { proposal: parseProposalEditProposal(row.proposal), modelName: provenance(row.modelName),
    promptVersion: PROPOSAL_FACT_PROMPT_VERSION };
}

export function sameProposalFacts(left: ProposalFacts, right: ProposalFacts): boolean {
  return left.description === right.description && left.totalMinutes === right.totalMinutes &&
    left.effectiveMinutes === right.effectiveMinutes && left.relatedSkillIds.length === right.relatedSkillIds.length &&
    left.relatedSkillIds.every((id, index) => id === right.relatedSkillIds[index]);
}

function receiptFacts(value: unknown): ProposalFacts {
  let facts: ProposalFacts;
  try { facts = parseProposalFacts(value); } catch { return malformed(); }
  const row = value as Record<string, unknown>;
  if (row.description !== facts.description || (row.relatedSkillIds as unknown[]).some((id, index) => id !== facts.relatedSkillIds[index])) return malformed();
  return facts;
}

function assessment(value: unknown, owner: string | null, activityId: string, baseId: string): ProposalEditAssessment {
  const row = receiptObject(value, [...(owner === null ? [] : ["userId"]), "id", "activityId", "status", "proposal", "modelName", "promptVersion",
    "rulesVersion", "confidence", "createdAt", "confirmedAt"]);
  if ((owner !== null && receiptUuid(row.userId) !== owner) || receiptUuid(row.activityId) !== activityId) return malformed();
  const id = receiptUuid(row.id);
  if (id === baseId || !["pending", "confirmed", "edited", "rejected", "superseded"].includes(row.status as string) ||
      typeof row.confidence !== "number" || !Number.isFinite(row.confidence) || row.confidence < 0 || row.confidence > 1 ||
      row.promptVersion !== PROPOSAL_FACT_PROMPT_VERSION) return malformed();
  const confirmedAt = row.confirmedAt === null ? null : timestamp(row.confirmedAt);
  if ((row.status === "confirmed") !== (confirmedAt !== null)) return malformed();
  const proposal = parseProposalEditProposal(row.proposal);
  if (proposal.confidence !== row.confidence) return malformed();
  return { id, activityId, status: row.status as ProposalEditAssessment["status"], proposal,
    modelName: provenance(row.modelName), promptVersion: PROPOSAL_FACT_PROMPT_VERSION,
    rulesVersion: provenance(row.rulesVersion), confidence: row.confidence,
    createdAt: timestamp(row.createdAt), confirmedAt };
}

/** Check owner + route + immutable request tuple before removing private owner fields. */
export function parseProposalEditRequest(
  value: unknown, owner: string, baseAssessmentId: string, requestId: string, input?: ProposalEditInput,
): ProposalEditRequest {
  return requestReceipt(value, owner, baseAssessmentId, requestId, input);
}

/** Public DTO validation never fabricates an owner or claims to authenticate it. */
export function parsePublicProposalEditRequest(value: unknown, baseAssessmentId: string, activityId: string, input: ProposalEditInput): ProposalEditRequest {
  const result = requestReceipt(value, null, baseAssessmentId, input.requestId, input);
  if (result.activityId !== activityId) return malformed();
  return result;
}

function requestReceipt(value: unknown, owner: string | null, baseAssessmentId: string, requestId: string, input?: ProposalEditInput): ProposalEditRequest {
  const row = receiptObject(value, [...(owner === null ? [] : ["userId"]), "requestId", "activityId", "baseAssessmentId", "facts", "status", "createdAt", "expiresAt", "failure", "completion"]);
  if ((owner !== null && receiptUuid(row.userId) !== owner) || receiptUuid(row.baseAssessmentId) !== baseAssessmentId ||
      receiptUuid(row.requestId) !== requestId) return malformed();
  const activityId = receiptUuid(row.activityId), facts = receiptFacts(row.facts);
  if (input && (input.requestId !== requestId || !sameProposalFacts(facts, input.facts))) return malformed();
  const createdAt = timestamp(row.createdAt), expiresAt = timestamp(row.expiresAt);
  if (instant(expiresAt) - instant(createdAt) !== BigInt(PROPOSAL_EDIT_REQUEST_SECONDS) * BigInt(1000000000)) return malformed();
  const base = { requestId, activityId, baseAssessmentId, facts, createdAt, expiresAt };
  let result: ProposalEditRequest;
  if (row.status === "completed") {
    if (row.failure !== null) return malformed();
    const completion = receiptObject(row.completion, ["revisionId", "previousRevisionId", "createdAt", "assessment"]);
    const revisionId = receiptUuid(completion.revisionId), previousRevisionId = nullableReceiptUuid(completion.previousRevisionId);
    if (revisionId === previousRevisionId) return malformed();
    const completedAt = timestamp(completion.createdAt);
    if (instant(completedAt) < instant(createdAt) || instant(completedAt) >= instant(expiresAt)) return malformed();
    const next = assessment(completion.assessment, owner, activityId, baseAssessmentId);
    if (instant(next.createdAt) !== instant(completedAt) || (next.confirmedAt !== null && instant(next.confirmedAt) < instant(completedAt))) return malformed();
    result = { ...base, status: "completed", failure: null, completion: { revisionId, previousRevisionId, createdAt: completedAt, assessment: next } };
  } else {
    if (row.completion !== null) return malformed();
    if (row.status === "in_progress" && row.failure === null) result = { ...base, status: "in_progress", failure: null, completion: null };
    else if (row.status === "failed" && row.failure === "AI_UNAVAILABLE") result = { ...base, status: "failed", failure: "AI_UNAVAILABLE", completion: null };
    else if (row.status === "expired" && row.failure === "EXPIRED") result = { ...base, status: "expired", failure: "EXPIRED", completion: null };
    else if (row.status === "conflict" && row.failure === "CONFLICT") result = { ...base, status: "conflict", failure: "CONFLICT", completion: null };
    else return malformed();
  }
  if (encoder.encode(JSON.stringify(result)).byteLength > PROPOSAL_EDIT_RESPONSE_BYTES - 32) return malformed();
  return result;
}

export function parseProposalEditBegin(value: unknown, owner: string, assessmentId: string, input: ProposalEditInput): ProposalEditBegin {
  const row = receiptObject(value, ["dispatch", "request"]);
  if (typeof row.dispatch !== "boolean") return malformed();
  const request = parseProposalEditRequest(row.request, owner, assessmentId, input.requestId, input);
  if (row.dispatch && request.status !== "in_progress") return malformed();
  return { dispatch: row.dispatch, request };
}

export const PROPOSAL_FACT_REVISION_FIELDS = "id,user_id,request_id,activity_id,base_assessment_id,result_assessment_id,previous_revision_id,rules_version,prompt_version,created_at";
export const PROPOSAL_FACT_REQUEST_FIELDS = "user_id,request_id,activity_id,base_assessment_id,facts,status,failure,revision_id,created_at,expires_at";

/** No proposal JSON is needed to prove the immutable revision/request relation. */
export function parseProposalFactRevisionIdentity(value: unknown, owner: string, resultId?: string) {
  const row = receiptObject(value, PROPOSAL_FACT_REVISION_FIELDS.split(","));
  if (receiptUuid(row.user_id) !== owner) return malformed();
  const id = receiptUuid(row.id), requestId = receiptUuid(row.request_id), activityId = receiptUuid(row.activity_id);
  const baseAssessmentId = receiptUuid(row.base_assessment_id), resultAssessmentId = receiptUuid(row.result_assessment_id);
  const previousRevisionId = nullableReceiptUuid(row.previous_revision_id);
  if (baseAssessmentId === resultAssessmentId || previousRevisionId === id ||
      (resultId !== undefined && resultAssessmentId !== resultId) || row.prompt_version !== PROPOSAL_FACT_PROMPT_VERSION) return malformed();
  return { id, requestId, activityId, baseAssessmentId, resultAssessmentId, previousRevisionId,
    rulesVersion: provenance(row.rules_version), promptVersion: PROPOSAL_FACT_PROMPT_VERSION,
    createdAt: timestamp(row.created_at) } as const;
}

export function parseProposalFactRevision(revision: unknown, request: unknown, owner: string, resultId?: string): ProposalFactRevision {
  const identity = parseProposalFactRevisionIdentity(revision, owner, resultId);
  const row = receiptObject(request, PROPOSAL_FACT_REQUEST_FIELDS.split(","));
  if (receiptUuid(row.user_id) !== owner || receiptUuid(row.request_id) !== identity.requestId ||
      receiptUuid(row.activity_id) !== identity.activityId || receiptUuid(row.base_assessment_id) !== identity.baseAssessmentId ||
      row.status !== "completed" || row.failure !== null || receiptUuid(row.revision_id) !== identity.id) return malformed();
  const createdAt = timestamp(row.created_at), expiresAt = timestamp(row.expires_at);
  if (instant(expiresAt) - instant(createdAt) !== BigInt(PROPOSAL_EDIT_REQUEST_SECONDS) * BigInt(1000000000) ||
      instant(identity.createdAt) < instant(createdAt) || instant(identity.createdAt) >= instant(expiresAt)) return malformed();
  return { ...identity, facts: receiptFacts(row.facts) };
}

/** Validate even a custom storage port before its values can reach Growth Engine. */
export function validateProposalFactSettlementRevision(value: unknown, assessmentId: string, activityId: string, rulesVersion: string): ProposalFactRevision {
  const row = receiptObject(value, ["id", "requestId", "activityId", "baseAssessmentId", "resultAssessmentId", "previousRevisionId", "rulesVersion", "promptVersion", "createdAt", "facts"]);
  const id = receiptUuid(row.id), requestId = receiptUuid(row.requestId), baseAssessmentId = receiptUuid(row.baseAssessmentId);
  const previousRevisionId = nullableReceiptUuid(row.previousRevisionId);
  if (receiptUuid(row.resultAssessmentId) !== assessmentId || receiptUuid(row.activityId) !== activityId ||
      baseAssessmentId === assessmentId || previousRevisionId === id || provenance(row.rulesVersion) !== rulesVersion ||
      row.promptVersion !== PROPOSAL_FACT_PROMPT_VERSION) return malformed();
  return { id, requestId, baseAssessmentId, resultAssessmentId: assessmentId, activityId, previousRevisionId,
    rulesVersion, promptVersion: PROPOSAL_FACT_PROMPT_VERSION, createdAt: timestamp(row.createdAt), facts: receiptFacts(row.facts) };
}

export const PROPOSAL_FACT_ASSESSMENT_FIELDS = "id,user_id,activity_id,status,rules_version";
export const PROPOSAL_FACT_ACTIVITY_FIELDS = "id,user_id,raw_input,total_minutes,effective_minutes,status,rules_version";
export const PROPOSAL_FACT_SKILL_FIELDS = "id,user_id,name,status,mastery_level,mastery_confidence";
export const PROPOSAL_FACT_MODEL_FIELDS = "id,user_id,activity_id,status,model_name,prompt_version,rules_version,created_at";

function assessmentState(value: unknown): ProposalEditAssessment["status"] {
  if (value !== "pending" && value !== "confirmed" && value !== "edited" && value !== "rejected" && value !== "superseded") return malformed();
  return value;
}

/** Keep old Activity minute values intact; new 0..1440 limits apply only to edited facts. */
function originalMinutes(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647) return malformed();
  return value;
}

export function parseProposalFactAssessment(value: unknown, owner: string, id: string) {
  const row = receiptObject(value, PROPOSAL_FACT_ASSESSMENT_FIELDS.split(","));
  if (receiptUuid(row.id) !== id || receiptUuid(row.user_id) !== owner) return malformed();
  return { id, activityId: receiptUuid(row.activity_id), status: assessmentState(row.status), rulesVersion: provenance(row.rules_version) };
}

export function parseProposalFactActivity(value: unknown, owner: string, id: string) {
  const row = receiptObject(value, PROPOSAL_FACT_ACTIVITY_FIELDS.split(","));
  if (receiptUuid(row.id) !== id || receiptUuid(row.user_id) !== owner || typeof row.raw_input !== "string" ||
      !wellFormedProposalFactText(row.raw_input) || (row.status !== "pending_assessment" && row.status !== "assessed" && row.status !== "confirmed")) return malformed();
  return { id, rawInput: row.raw_input, totalMinutes: originalMinutes(row.total_minutes), effectiveMinutes: originalMinutes(row.effective_minutes),
    status: row.status, rulesVersion: provenance(row.rules_version) };
}

export function proposalFactOriginalProjection(value: string) {
  if (!wellFormedProposalFactText(value)) return malformed();
  if (encoder.encode(value).byteLength <= PROPOSAL_FACT_TEXT_BYTES) return { description: value, descriptionTruncated: false };
  let description = "", bytes = 0;
  for (const point of value) { const size = encoder.encode(point).byteLength; if (bytes + size > PROPOSAL_FACT_TEXT_BYTES) break; description += point; bytes += size; }
  return { description, descriptionTruncated: true };
}

export function parseProposalFactSkill(value: unknown, owner: string): ProposalFactSkill {
  const row = receiptObject(value, PROPOSAL_FACT_SKILL_FIELDS.split(","));
  if (receiptUuid(row.user_id) !== owner || row.status !== "active" || typeof row.name !== "string" || !row.name.trim() || !wellFormedProposalFactText(row.name) ||
      typeof row.mastery_level !== "number" || !Number.isInteger(row.mastery_level) || row.mastery_level < 0 || row.mastery_level > 10 ||
      typeof row.mastery_confidence !== "number" || !Number.isFinite(row.mastery_confidence) || row.mastery_confidence < 0 || row.mastery_confidence > 1) return malformed();
  const points = Array.from(row.name);
  return { id: receiptUuid(row.id), name: points.slice(0, PROPOSAL_FACT_SKILL_NAME_CODEPOINTS).join(""),
    nameTruncated: points.length > PROPOSAL_FACT_SKILL_NAME_CODEPOINTS, masteryLevel: row.mastery_level, masteryConfidence: row.mastery_confidence };
}

export function parseProposalFactHistoryModel(value: unknown, owner: string, revision: ProposalFactRevision): ProposalFactHistoryItem {
  const row = receiptObject(value, PROPOSAL_FACT_MODEL_FIELDS.split(","));
  if (receiptUuid(row.user_id) !== owner || receiptUuid(row.id) !== revision.resultAssessmentId ||
      receiptUuid(row.activity_id) !== revision.activityId || provenance(row.rules_version) !== revision.rulesVersion ||
      row.prompt_version !== revision.promptVersion || instant(timestamp(row.created_at)) !== instant(revision.createdAt)) return malformed();
  return { ...revision, modelName: provenance(row.model_name), assessmentStatus: assessmentState(row.status) };
}

export function boundedProposalFactView<T>(value: T, bytes: number): T {
  const text = JSON.stringify(value);
  if (typeof text !== "string" || encoder.encode(text).byteLength > bytes) return malformed();
  return value;
}

export function proposalFactRows(value: unknown, limit: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > limit) return malformed();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1 || keys.some(key => key !== "length" &&
      (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) return malformed();
  return Array.from({ length: value.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return malformed();
    return descriptor.value;
  });
}

export function parseProposalFactActiveRequest(value: unknown, owner: string, activityId: string, now: string): void {
  const row = receiptObject(value, ["request_id", "user_id", "activity_id", "status", "expires_at"]);
  receiptUuid(row.request_id);
  if (receiptUuid(row.user_id) !== owner || receiptUuid(row.activity_id) !== activityId || row.status !== "in_progress" ||
      instant(timestamp(row.expires_at)) <= instant(timestamp(now))) return malformed();
}
