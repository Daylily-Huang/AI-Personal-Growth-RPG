import { NextResponse } from "next/server";
import { isValidUuid } from "@/lib/http/validation";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { RewardRepositoryError } from "./repository";
import { getRewardService, type RewardService } from "./service";
import type { Pagination, RewardResult, WishMetadata } from "./types";

export class RewardHttpError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
export function rewardJson(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
}
const DOMAIN_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  REWARD_SOURCE_NOT_FOUND: 404, REWARD_TRANSACTION_NOT_FOUND: 404, WISH_NOT_FOUND: 404, REDEMPTION_NOT_FOUND: 404,
  IDEMPOTENCY_KEY_REUSED: 409, REWARD_SOURCE_ALREADY_GRANTED: 409, REWARD_TRANSACTION_ALREADY_CORRECTED: 409,
  SELECTED_WISH_ALREADY_EXISTS: 409, INVALID_WISH_TRANSITION: 409, REDEMPTION_ALREADY_REFUNDED: 409,
  INVALID_REFUND_STATE: 409, ONLY_EARN_CAN_BE_CORRECTED: 409,
  REWARD_SOURCE_NOT_ELIGIBLE: 422, INSUFFICIENT_REWARD_CREDITS: 422, REDEMPTION_COOLDOWN_ACTIVE: 422,
  INVALID_IDEMPOTENCY_KEY: 400, INVALID_REQUEST_IDENTITY: 400, WISH_COST_REQUIRED: 400,
  UNKNOWN_REWARD_POLICY_VERSION: 400, UNSUPPORTED_REWARD_SOURCE: 400,
};
export function rewardErrorResponse(error: unknown) {
  if (error instanceof AuthRequiredError) return rewardJson({ error: "UNAUTHORIZED", code: "UNAUTHORIZED" }, 401);
  if (error instanceof RewardHttpError) return rewardJson({ error: error.code, code: error.code }, error.status);
  if (error instanceof RewardRepositoryError) {
    const status = DOMAIN_STATUS[error.message];
    if (status) return rewardJson({ error: error.message, code: error.message }, status);
    if (error.code === "42501") return rewardJson({ error: "FORBIDDEN", code: "FORBIDDEN" }, 403);
    if (error.code === "23505" || error.code === "23514") return rewardJson({ error: "CONFLICT", code: "CONFLICT" }, 409);
  }
  // Do not expose PostgREST details, SQL, constraint names, or internal exception messages.
  return rewardJson({ error: "Reward request failed", code: "INTERNAL_ERROR" }, 500);
}
export async function rewardRoute(work: (service: RewardService) => Promise<NextResponse>) {
  try { return await work(await getRewardService()); }
  catch (error) { return rewardErrorResponse(error); }
}
export function authorityResult(result: RewardResult) {
  if (result.ok) return rewardJson(result);
  const status = result.error_code === "FARMING_SOURCE_REJECTED" ? 400
    : result.error_code === "SOURCE_CLASS_NOT_YET_AVAILABLE" ? 422 : 500;
  if (status === 500) return rewardErrorResponse(new Error("Unknown business rejection"));
  return rewardJson({ ...result, code: result.error_code, error: result.error_code }, status);
}
export async function rewardBody(request: Request): Promise<Record<string, unknown>> {
  let value: unknown;
  try { value = await request.json(); } catch { throw new RewardHttpError("MALFORMED_JSON"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RewardHttpError("INVALID_JSON_BODY");
  return value as Record<string, unknown>;
}
export function onlyFields(body: Record<string, unknown>, fields: readonly string[]) {
  if (Object.keys(body).some(k => !fields.includes(k))) throw new RewardHttpError("UNEXPECTED_FIELD");
}
export function uuid(value: unknown): string {
  if (!isValidUuid(value)) throw new RewardHttpError("INVALID_UUID");
  return value.toLowerCase();
}
export function text(value: unknown, max = 10000): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new RewardHttpError("INVALID_INPUT");
  return value.trim();
}
export function optionalText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string" || value.length > 10000) throw new RewardHttpError("INVALID_INPUT");
  return value.trim() || null;
}
export function requestKey(value: unknown) { return text(value, 200); }
export function wishMetadata(body: Record<string, unknown>, create: boolean): WishMetadata {
  onlyFields(body, ["title", "description", "creditCost"]);
  if (!create && !Object.keys(body).length) throw new RewardHttpError("EMPTY_PATCH");
  const value: WishMetadata = {};
  if (create || body.title !== undefined) value.title = text(body.title, 300);
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > 10000) throw new RewardHttpError("INVALID_INPUT");
    value.description = body.description.trim();
  }
  if (body.creditCost !== undefined) {
    if (body.creditCost !== null && (typeof body.creditCost !== "number" || !Number.isInteger(body.creditCost)
      || body.creditCost < 1 || body.creditCost > 2147483647)) throw new RewardHttpError("INVALID_CREDIT_COST");
    value.creditCost = body.creditCost as number | null;
  }
  return value;
}
export function pagination(request: Request, extra: readonly string[] = []): Pagination {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys()) {
    if (!["limit", "offset", ...extra].includes(key) || params.getAll(key).length !== 1) throw new RewardHttpError("INVALID_QUERY");
  }
  function integer(name: string, fallback: number, minimum: number, maximum: number) {
    const raw = params.get(name);
    if (raw === null) return fallback;
    if (!/^\d+$/.test(raw)) throw new RewardHttpError("INVALID_PAGINATION");
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new RewardHttpError("INVALID_PAGINATION");
    return value;
  }
  return { limit: integer("limit", 50, 1, 100), offset: integer("offset", 0, 0, 2147483547) };
}
