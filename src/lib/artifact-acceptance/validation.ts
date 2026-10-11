import {
  ARTIFACT_MANUAL_CREDITS, ARTIFACT_MANUAL_POLICY, ArtifactAcceptanceError,
  type AcceptArtifactInput, type RevokeArtifactInput, type AcceptanceArtifact,
  type ArtifactAcceptance, type ArtifactCredit, type ArtifactAcceptanceReceipt, type ArtifactAcceptanceView,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (): never => { throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_INVALID_INPUT"); };
const malformed = (): never => { throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_INVALID_RECEIPT"); };

function object(value: unknown, keys: readonly string[], fail: () => never): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return fail();
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some(k => typeof k !== "string" || !keys.includes(k))) return fail();
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) return fail();
  }
  return value as Record<string, unknown>;
}
export function artifactAcceptanceUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) return invalid();
  return value.toLowerCase();
}
function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value) || value !== value.toLowerCase()) return malformed();
  return value;
}
function wellFormed(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const n = value.charCodeAt(i);
    if (n === 0) return false;
    if (n >= 0xd800 && n <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (n >= 0xdc00 && n <= 0xdfff) return false;
  }
  return true;
}
function text(value: unknown, max: number, fail: () => never): string {
  if (typeof value !== "string" || !wellFormed(value)) return fail();
  const result = value.trim();
  if (!result || Array.from(result).length > max) return fail();
  return result;
}
/** Retain the original microsecond-bearing text; Date.parse is only a validity check. */
function timestamp(value: unknown, fail: () => never): string {
  if (typeof value !== "string" || value.length > 128 || /[^\x20-\x7e]/.test(value)) return fail();
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!m) return fail();
  const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1] ||
      Number(m[4]) > 23 || Number(m[5]) > 59 || Number(m[6]) > 59 ||
      (m[8] !== undefined && (Number(m[8]) > 23 || Number(m[9]) > 59)) || !Number.isFinite(Date.parse(value))) return fail();
  return value;
}
export function parseAcceptArtifactInput(value: unknown): AcceptArtifactInput {
  const r = object(value, ["requestKey", "expectedUpdatedAt", "acceptanceNote"], invalid);
  return { requestKey: text(r.requestKey, 200, invalid), expectedUpdatedAt: timestamp(r.expectedUpdatedAt, invalid), acceptanceNote: text(r.acceptanceNote, 2000, invalid) };
}
export function parseRevokeArtifactInput(value: unknown): RevokeArtifactInput {
  const r = object(value, ["requestKey", "reason"], invalid);
  return { requestKey: text(r.requestKey, 200, invalid), reason: text(r.reason, 2000, invalid) };
}
function sourceText(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || !wellFormed(value)) return malformed();
  return value;
}
function nullableText(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !wellFormed(value)) return malformed();
  return value;
}
function artifact(value: unknown, id: string, owner?: string): AcceptanceArtifact {
  const r = object(value, ["id", "userId", "title", "version", "lifecycleStatus", "isArchived", "updatedAt"], malformed);
  const userId = uuid(r.userId);
  if (uuid(r.id) !== id || (owner !== undefined && userId !== owner) ||
      typeof r.lifecycleStatus !== "string" || !["draft", "active", "archived", "superseded"].includes(r.lifecycleStatus) || typeof r.isArchived !== "boolean" ||
      r.isArchived !== (r.lifecycleStatus === "archived")) return malformed();
  return { id, userId, title: sourceText(r.title), version: nullableText(r.version),
    lifecycleStatus: r.lifecycleStatus as AcceptanceArtifact["lifecycleStatus"], isArchived: r.isArchived, updatedAt: timestamp(r.updatedAt, malformed) };
}
function acceptance(value: unknown, id: string, owner?: string): ArtifactAcceptance {
  const r = object(value, ["id", "userId", "artifactId", "recognitionClass", "status", "acceptedTitle", "acceptedVersion", "acceptedUpdatedAt",
    "acceptanceNote", "acceptedAt", "earnTransactionId", "policyVersion", "revokedAt", "revocationReason", "correctionTransactionId"], malformed);
  const userId = uuid(r.userId);
  if (uuid(r.artifactId) !== id || (owner !== undefined && userId !== owner) || r.recognitionClass !== "USER_CONFIRMED_ARTIFACT" ||
      (r.status !== "ACTIVE" && r.status !== "REVOKED") || r.policyVersion !== ARTIFACT_MANUAL_POLICY) return malformed();
  const acceptanceNote = text(r.acceptanceNote, 2000, malformed);
  if (acceptanceNote !== r.acceptanceNote) return malformed();
  let revokedAt: string | null = null, revocationReason: string | null = null, correctionTransactionId: string | null = null;
  if (r.status === "ACTIVE") {
    if (r.revokedAt !== null || r.revocationReason !== null || r.correctionTransactionId !== null) return malformed();
  } else {
    revokedAt = timestamp(r.revokedAt, malformed); revocationReason = text(r.revocationReason, 2000, malformed);
    correctionTransactionId = uuid(r.correctionTransactionId);
    if (revocationReason !== r.revocationReason) return malformed();
  }
  return { id: uuid(r.id), userId, artifactId: id, recognitionClass: "USER_CONFIRMED_ARTIFACT", status: r.status,
    acceptedTitle: sourceText(r.acceptedTitle), acceptedVersion: nullableText(r.acceptedVersion), acceptedUpdatedAt: timestamp(r.acceptedUpdatedAt, malformed),
    acceptanceNote, acceptedAt: timestamp(r.acceptedAt, malformed), earnTransactionId: uuid(r.earnTransactionId),
    policyVersion: ARTIFACT_MANUAL_POLICY, revokedAt, revocationReason, correctionTransactionId };
}
function credit(value: unknown, a: ArtifactAcceptance, kind: "EARN" | "CORRECTION", earn?: ArtifactCredit): ArtifactCredit {
  const r = object(value, ["id", "userId", "accountId", "eventKind", "amount", "sourceType", "sourceId", "policyVersion", "correctionForId", "createdAt"], malformed);
  const id = uuid(r.id), accountId = uuid(r.accountId);
  if (uuid(r.userId) !== a.userId || r.eventKind !== kind || r.amount !== (kind === "EARN" ? ARTIFACT_MANUAL_CREDITS : -ARTIFACT_MANUAL_CREDITS) ||
      r.sourceType !== "ARTIFACT" || uuid(r.sourceId) !== a.artifactId || r.policyVersion !== ARTIFACT_MANUAL_POLICY) return malformed();
  if (kind === "EARN" ? id !== a.earnTransactionId || r.correctionForId !== null
    : !earn || accountId !== earn.accountId || uuid(r.correctionForId) !== earn.id || id === earn.id) return malformed();
  return { id, userId: a.userId, accountId, eventKind: kind, amount: r.amount as number, sourceType: "ARTIFACT", sourceId: a.artifactId,
    policyVersion: ARTIFACT_MANUAL_POLICY, correctionForId: kind === "EARN" ? null : earn!.id, createdAt: timestamp(r.createdAt, malformed) };
}
function provenance(r: Record<string, unknown>, id: string, owner?: string) {
  const a = acceptance(r.acceptance, id, owner), earn = credit(r.earn, a, "EARN");
  const correction = r.correction === null ? null : credit(r.correction, a, "CORRECTION", earn);
  if (a.status === "REVOKED" && (!correction || a.correctionTransactionId !== correction.id)) return malformed();
  return { acceptance: a, earn, correction };
}
export function parseArtifactAcceptanceReceipt(value: unknown, id: string, owner?: string): ArtifactAcceptanceReceipt {
  const r = object(value, ["acceptance", "earn", "correction", "replayed"], malformed);
  if (typeof r.replayed !== "boolean") return malformed();
  return { ...provenance(r, id, owner), replayed: r.replayed };
}
export function parseArtifactAcceptanceRecord(value: unknown, id: string, owner: string): ArtifactAcceptance {
  return acceptance(value, id, owner);
}
export function parseArtifactAcceptanceView(value: unknown, id: string, owner?: string): ArtifactAcceptanceView {
  const r = object(value, ["artifact", "acceptance", "earn", "correction"], malformed), source = artifact(r.artifact, id, owner);
  if (r.acceptance === null) {
    if (r.earn !== null || r.correction !== null) return malformed();
    return { artifact: source, acceptance: null, earn: null, correction: null };
  }
  return { artifact: source, ...provenance(r, id, source.userId) };
}

export const ARTIFACT_ACCEPTANCE_SOURCE_COLUMNS = "id,user_id,title,version,lifecycle_status,is_archived,updated_at";
export const ARTIFACT_ACCEPTANCE_COLUMNS = "id,user_id,artifact_id,recognition_class,status,accepted_title,accepted_version,accepted_updated_at,acceptance_note,accepted_at,earn_transaction_id,policy_version,revoked_at,revocation_reason,correction_transaction_id";
export const ARTIFACT_CREDIT_COLUMNS = "id,user_id,account_id,event_kind,amount,canonical_source_type,canonical_source_id,policy_version,correction_for_id,created_at";
function rawMap(value: unknown, columns: string, names: readonly string[]): Record<string, unknown> {
  const keys = columns.split(","), r = object(value, keys, malformed);
  return Object.fromEntries(keys.map((key, i) => [names[i], r[key]]));
}
export const artifactSourceFromRaw = (v: unknown) => rawMap(v, ARTIFACT_ACCEPTANCE_SOURCE_COLUMNS, ["id", "userId", "title", "version", "lifecycleStatus", "isArchived", "updatedAt"]);
export const artifactAcceptanceFromRaw = (v: unknown) => rawMap(v, ARTIFACT_ACCEPTANCE_COLUMNS, ["id", "userId", "artifactId", "recognitionClass", "status", "acceptedTitle", "acceptedVersion", "acceptedUpdatedAt", "acceptanceNote", "acceptedAt", "earnTransactionId", "policyVersion", "revokedAt", "revocationReason", "correctionTransactionId"]);
export const artifactCreditFromRaw = (v: unknown) => rawMap(v, ARTIFACT_CREDIT_COLUMNS, ["id", "userId", "accountId", "eventKind", "amount", "sourceType", "sourceId", "policyVersion", "correctionForId", "createdAt"]);
