import { NextResponse } from "next/server";
import { isValidUuid } from "@/lib/http/validation";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { Phase8BRepositoryError } from "@/lib/outer-loop/repository";
import { MilestoneHttpError, MilestoneRepositoryError } from "./errors";
import { getMilestoneRepository } from "./request";
import type { MilestoneRepository } from "./repository";
import type { ConfirmMilestone, Pagination } from "./types";

export function milestoneJson(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}
const STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  MILESTONE_NOT_FOUND: 404, MILESTONE_SOURCE_NOT_FOUND: 404, PROPOSAL_NOT_FOUND: 404,
  IDEMPOTENCY_KEY_REUSED: 409, MILESTONE_ALREADY_EXISTS: 409, MILESTONE_NOT_SETTLEABLE: 409,
  MILESTONE_ALREADY_REVOKED: 409, REWARD_ALREADY_MINTED_FOR_SOURCE: 409, PROPOSAL_ALREADY_REVIEWED: 409,
  MILESTONE_SOURCE_NOT_ELIGIBLE: 422, INELIGIBLE_FOR_REWARD: 422,
  REWARD_SOURCE_NOT_ELIGIBLE: 422, PAYLOAD_VALIDATION_FAILED: 422,
  SCHEMA_VALIDATION_FAILED: 422, PROPOSAL_EXPIRED: 422,
  INVALID_IDEMPOTENCY_KEY: 400, INVALID_MILESTONE_PAYLOAD: 400, INVALID_RECOGNITION_SOURCE_CLASS: 400,
  INVALID_MILESTONE_SOURCE_ID: 400, INVALID_MILESTONE_ID: 400, MISSING_REVOCATION_REASON: 400,
  UNKNOWN_REWARD_POLICY_VERSION: 400, INVALID_PROPOSAL_DECISION: 400,
};
export function milestoneErrorResponse(error: unknown) {
  if (error instanceof AuthRequiredError) return milestoneJson({ error: "UNAUTHORIZED", code: "UNAUTHORIZED" }, 401);
  if (error instanceof MilestoneHttpError) return milestoneJson({ error: error.code, code: error.code }, error.status);
  if (error instanceof MilestoneRepositoryError || error instanceof Phase8BRepositoryError) {
    // Exact allowlist only: never echo a raw SQL/constraint/arbitrary exception message.
    if (Object.hasOwn(STATUS, error.message)) return milestoneJson({ error: error.message, code: error.message }, STATUS[error.message]);
    if (error.code === "42501") return milestoneJson({ error: "FORBIDDEN", code: "FORBIDDEN" }, 403);
  }
  return milestoneJson({ error: "Milestone request failed", code: "INTERNAL_ERROR" }, 500);
}
export async function milestoneRoute(work: (repo: MilestoneRepository) => Promise<NextResponse>) {
  try { return await work(await getMilestoneRepository()); }
  catch (error) { return milestoneErrorResponse(error); }
}
export async function bodyObject(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new MilestoneHttpError("MALFORMED_JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new MilestoneHttpError("INVALID_JSON_BODY");
  return body as Record<string, unknown>;
}
export function onlyFields(body: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(body).some(key => !allowed.includes(key))) throw new MilestoneHttpError("UNEXPECTED_FIELD");
}
export function text(value: unknown, max = 10000): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new MilestoneHttpError("INVALID_INPUT");
  return value.trim();
}
export function nullableText(value: unknown, required = false): string | null {
  if (value === null || (value === undefined && !required)) return null;
  if (typeof value !== "string" || value.length > 10000) throw new MilestoneHttpError("INVALID_INPUT");
  return value.trim() || null;
}
export function requestKey(value: unknown) { return text(value, 200); }
export function uuid(value: unknown) {
  if (!isValidUuid(value)) throw new MilestoneHttpError("INVALID_UUID");
  return value.toLowerCase();
}
export function confirmInput(body: Record<string, unknown>): ConfirmMilestone {
  onlyFields(body, ["milestoneKey", "title", "description", "recognitionClass", "sourceType", "sourceId",
    "externalEvidenceUrl", "externalCredentialId", "confirmationRequestIdempotencyKey"]);
  return {
    milestoneKey: text(body.milestoneKey, 300), title: text(body.title, 300), description: nullableText(body.description, true),
    recognitionClass: text(body.recognitionClass, 200).toUpperCase(), sourceType: text(body.sourceType, 200).toUpperCase(),
    sourceId: text(body.sourceId, 200), externalEvidenceUrl: nullableText(body.externalEvidenceUrl),
    externalCredentialId: nullableText(body.externalCredentialId), confirmationRequestIdempotencyKey: requestKey(body.confirmationRequestIdempotencyKey),
  };
}
export function pagination(request: Request, extra: readonly string[] = []): Pagination {
  const query = new URL(request.url).searchParams;
  for (const key of query.keys()) if (!["limit", "offset", ...extra].includes(key) || query.getAll(key).length !== 1) {
    throw new MilestoneHttpError("INVALID_QUERY");
  }
  function integer(key: string, fallback: number, minimum: number, maximum: number) {
    const raw = query.get(key); if (raw === null) return fallback;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < minimum || value > maximum) throw new MilestoneHttpError("INVALID_PAGINATION");
    return value;
  }
  return { limit: integer("limit", 50, 1, 100), offset: integer("offset", 0, 0, 2147483547) };
}
export function optionalEnum<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (value === null) return undefined;
  if (!(allowed as readonly string[]).includes(value)) throw new MilestoneHttpError("INVALID_QUERY");
  return value as T;
}
export function noQuery(request: Request) {
  if (new URL(request.url).searchParams.size) throw new MilestoneHttpError("INVALID_QUERY");
}
