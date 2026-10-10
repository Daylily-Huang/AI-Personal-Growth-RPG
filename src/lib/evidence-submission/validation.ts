import {
  EvidenceSubmissionError, EVIDENCE_TEXT_BYTES, SKILL_NAME_CODEPOINTS,
  SKILL_PAGE_SIZE, SKILL_RESPONSE_BYTES, SUBMISSION_PAGE_SIZE, SUBMISSION_RESPONSE_BYTES,
  type EvidenceList, type EvidenceQuery, type EvidenceSkillOption, type EvidenceSubmission,
  type EvidenceSubmissionInput, type EvidenceSubmissionResult,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
function invalid(): never { throw new EvidenceSubmissionError("INVALID_EVIDENCE_INPUT"); }
function malformed(): never { throw new EvidenceSubmissionError("INVALID_EVIDENCE_RECEIPT"); }

/** No inherited keys, symbols, accessors or class instances at this boundary. */
function object(value: unknown, keys: readonly string[], fail: () => never): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return fail();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return fail();
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some(key => typeof key !== "string" || !keys.includes(key))) return fail();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) return fail();
  }
  return value as Record<string, unknown>;
}

export function evidenceUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) return invalid();
  return value.toLowerCase();
}
function receiptUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value) || value !== value.toLowerCase()) return malformed();
  return value;
}
function nullableUuid(value: unknown, receipt = false): string | null {
  return value === null ? null : receipt ? receiptUuid(value) : evidenceUuid(value);
}

export function wellFormedEvidenceText(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit === 0) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}
export function evidenceText(value: unknown): string {
  if (typeof value !== "string" || !wellFormedEvidenceText(value)) return invalid();
  const text = value.trim();
  if (!text || encoder.encode(text).byteLength > EVIDENCE_TEXT_BYTES) return invalid();
  return text;
}
export function parseEvidenceInput(value: unknown): EvidenceSubmissionInput {
  const row = object(value, ["requestId", "skillId", "description"], invalid);
  return { requestId: evidenceUuid(row.requestId), skillId: nullableUuid(row.skillId), description: evidenceText(row.description) };
}
export function parseEvidenceQuery(params: URLSearchParams): EvidenceQuery {
  const keys = [...params.keys()];
  if (keys.some(key => key !== "view" && key !== "after") || new Set(keys).size !== keys.length) return invalid();
  const view = params.get("view") ?? "submissions";
  if (view !== "submissions" && view !== "skills") return invalid();
  return { view, after: params.has("after") ? evidenceUuid(params.get("after")) : null };
}

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

function submission(value: unknown, activityId: string, owner: string | undefined): EvidenceSubmission {
  const row = object(value, ["requestId", "activityId", "requestedSkillId", "evidence"], malformed);
  const requestId = receiptUuid(row.requestId);
  if (receiptUuid(row.activityId) !== activityId) return malformed();
  const requestedSkillId = nullableUuid(row.requestedSkillId, true);
  const keys = ["id", "activityId", "skillId", "evidenceLevel", "evidenceType", "description", "verified", "createdAt"];
  const evidence = object(row.evidence, owner === undefined ? keys : [...keys, "userId"], malformed);
  if (owner !== undefined && receiptUuid(evidence.userId) !== owner) return malformed();
  const id = receiptUuid(evidence.id);
  if (receiptUuid(evidence.activityId) !== activityId) return malformed();
  const skillId = nullableUuid(evidence.skillId, true);
  if (skillId !== null && skillId !== requestedSkillId) return malformed();
  if (evidence.evidenceLevel !== 0 || evidence.evidenceType !== "user_submission" || evidence.verified !== false) return malformed();
  let description: string;
  try { description = evidenceText(evidence.description); } catch { return malformed(); }
  if (description !== evidence.description) return malformed();
  return { requestId, activityId, requestedSkillId, evidence: {
    id, activityId, skillId, evidenceLevel: 0, evidenceType: "user_submission", description,
    verified: false, createdAt: timestamp(evidence.createdAt),
  } };
}

export function parseEvidenceResult(
  value: unknown, activityId: string, input: EvidenceSubmissionInput, owner?: string,
): EvidenceSubmissionResult {
  const row = object(value, owner === undefined ? ["replayed", "submission"] : ["userId", "replayed", "submission"], malformed);
  if (owner !== undefined && receiptUuid(row.userId) !== owner) return malformed();
  if (typeof row.replayed !== "boolean") return malformed();
  const item = submission(row.submission, activityId, owner);
  if (item.requestId !== input.requestId || item.requestedSkillId !== input.skillId || item.evidence.description !== input.description) return malformed();
  const result = { replayed: row.replayed, submission: item };
  if (encoder.encode(JSON.stringify(result)).byteLength > SUBMISSION_RESPONSE_BYTES) return malformed();
  return result;
}

function skill(value: unknown, owner?: string): EvidenceSkillOption {
  const keys = ["id", "name", "status", "nameTruncated"];
  const row = object(value, owner === undefined ? keys : [...keys, "userId"], malformed);
  if (owner !== undefined && receiptUuid(row.userId) !== owner) return malformed();
  const id = receiptUuid(row.id);
  if (row.status !== "active" || typeof row.name !== "string" || !wellFormedEvidenceText(row.name) ||
      [...row.name].length > SKILL_NAME_CODEPOINTS || typeof row.nameTruncated !== "boolean") return malformed();
  return { id, name: row.name, status: "active", nameTruncated: row.nameTruncated };
}
export function parseEvidenceList(value: unknown, activityId: string, query: EvidenceQuery, owner?: string): EvidenceList {
  const keys = ["view", "items", "nextCursor"];
  const row = object(value, owner === undefined ? keys : [...keys, "userId", "activityId"], malformed);
  if (owner !== undefined && (receiptUuid(row.userId) !== owner || receiptUuid(row.activityId) !== activityId)) return malformed();
  if (row.view !== query.view || !Array.isArray(row.items)) return malformed();
  const nextCursor = nullableUuid(row.nextCursor, true);
  const limit = query.view === "skills" ? SKILL_PAGE_SIZE : SUBMISSION_PAGE_SIZE;
  if (row.items.length > limit) return malformed();
  const items = query.view === "skills"
    ? row.items.map(item => skill(item, owner))
    : row.items.map(item => submission(item, activityId, owner));
  const ids = items.map(item => "requestId" in item ? item.requestId : item.id);
  if (query.view === "submissions" && new Set(items.map(item => "evidence" in item ? item.evidence.id : "")).size !== items.length) return malformed();
  if (ids.some((id, index) => id <= (index === 0 ? query.after ?? "" : ids[index - 1])) ||
      (nextCursor !== null && (items.length !== limit || nextCursor !== ids.at(-1)))) return malformed();
  const result = { view: query.view, items, nextCursor };
  const cap = query.view === "skills" ? SKILL_RESPONSE_BYTES : SUBMISSION_RESPONSE_BYTES;
  if (encoder.encode(JSON.stringify(result)).byteLength > cap) return malformed();
  return result as EvidenceList;
}
