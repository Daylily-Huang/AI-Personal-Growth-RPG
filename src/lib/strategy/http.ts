import { NextResponse } from "next/server";
import { isValidUuid } from "@/lib/http/validation";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { StrategyRepositoryError } from "./repository";

export class StrategyHttpError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
    this.name = "StrategyHttpError";
  }
}

export async function readStrategyBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await request.json(); } catch {
    throw new StrategyHttpError("Malformed JSON body", 400, "MALFORMED_JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new StrategyHttpError("JSON body must be an object", 400, "INVALID_JSON_BODY");
  }
  return body as Record<string, unknown>;
}

export function onlyFields(body: Record<string, unknown>, allowed: readonly string[]): void {
  const extra = Object.keys(body).find((key) => !allowed.includes(key));
  if (extra) throw new StrategyHttpError(`Unexpected field: ${extra}`, 400, "INVALID_INPUT");
}

export function uuid(value: unknown, field: string): string {
  if (!isValidUuid(value)) throw new StrategyHttpError(`${field} must be a UUID`, 400, "INVALID_UUID");
  return value;
}

export function nonBlank(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new StrategyHttpError(`${field} is required`, 400, "INVALID_INPUT");
  }
  return value.trim();
}

export function optionalText(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new StrategyHttpError(`${field} must be text or null`, 400, "INVALID_INPUT");
  return value.trim() || null;
}

export function boolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new StrategyHttpError(`${field} must be boolean`, 400, "INVALID_INPUT");
  return value;
}

export function oneOf<T extends string>(value: unknown, field: string, choices: readonly T[]): T {
  if (typeof value !== "string" || !choices.includes(value as T)) {
    throw new StrategyHttpError(`${field} has an invalid value`, 400, "INVALID_INPUT");
  }
  return value as T;
}

export function observedAt(value: unknown): string {
  const text = nonBlank(value, "observedAt");
  if (!Number.isFinite(Date.parse(text)) || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(text)) {
    throw new StrategyHttpError("observedAt must include a time zone", 400, "INVALID_INPUT");
  }
  // Preserve the caller's microseconds; this is an assertion, not authority.
  return text;
}

function domainCode(message: string): string | null {
  return message.match(/\b([A-Z][A-Z0-9_]{2,})\b/)?.[1] ?? null;
}

export function strategyErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof StrategyHttpError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ error: error.message, code: "UNAUTHORIZED" }, { status: 401 });
  }
  const message = error instanceof Error ? error.message : "";
  const sqlstate = error instanceof StrategyRepositoryError ? error.code : null;
  const code = domainCode(message);
  let status: number;
  if (sqlstate === "P0002" || code?.endsWith("_NOT_FOUND")) status = 404;
  else if (sqlstate === "42501") status = 403;
  else if (sqlstate === "28000") status = 401;
  else if (code === "INSUFFICIENT_SUPPORT_FOR_PROMOTION") status = 422;
  else if (sqlstate === "23505" || sqlstate === "23514") status = 409;
  else if (sqlstate === "22023") status = 400;
  else {
    console.error(fallback, error);
    return NextResponse.json({ error: fallback, code: "INTERNAL_ERROR" }, { status: 500 });
  }
  return NextResponse.json({ error: message || fallback, code: code ?? "STRATEGY_ERROR" }, { status });
}
