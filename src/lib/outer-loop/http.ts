import { NextResponse } from "next/server";
import { isValidUuid } from "@/lib/http/validation";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { Phase8BRepositoryError } from "./repository";

export type JsonObject = Record<string, unknown>;

export class Phase8BHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "Phase8BHttpError";
  }
}

export async function readJsonObject(request: Request): Promise<JsonObject> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Phase8BHttpError("Malformed JSON body", 400, "MALFORMED_JSON");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Phase8BHttpError("JSON body must be an object", 400, "INVALID_JSON_BODY");
  }
  return body as JsonObject;
}

export function requireUuid(value: unknown, field: string): string {
  if (!isValidUuid(value)) {
    throw new Phase8BHttpError(`${field} must be a valid UUID`, 400, "INVALID_UUID");
  }
  return value;
}

export function requireNonBlankString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Phase8BHttpError(`${field} is required`, 400, "INVALID_INPUT");
  }
  return value.trim();
}

export function optionalNullableString(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Phase8BHttpError(`${field} must be a string or null`, 400, "INVALID_INPUT");
  }
  return value.trim() || null;
}

function extractDomainCode(message: string): string | null {
  const match = message.match(/\b([A-Z][A-Z0-9_]{2,})\b/);
  return match?.[1] ?? null;
}

export function phase8BErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof Phase8BHttpError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ error: error.message, code: "UNAUTHORIZED" }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : "";
  const dbCode = error instanceof Phase8BRepositoryError ? error.code : null;
  const domainCode = extractDomainCode(message);
  const signal = `${dbCode ?? ""} ${domainCode ?? ""} ${message}`;

  if (dbCode === "P0002" || signal.includes("_NOT_FOUND")) {
    return NextResponse.json({ error: message || fallback, code: domainCode ?? "NOT_FOUND" }, { status: 404 });
  }
  if (dbCode === "42501" || signal.includes("TENANT_MISMATCH") || /permission denied/i.test(message)) {
    return NextResponse.json({ error: message || fallback, code: domainCode ?? "FORBIDDEN" }, { status: 403 });
  }
  if (
    dbCode === "23505" ||
    dbCode === "23514" ||
    signal.includes("INVALID_STATE_TRANSITION") ||
    signal.includes("ACTIVE_SEASON_EXISTS") ||
    signal.includes("SEASON_NOT_ACTIVE") ||
    signal.includes("SEASON_NOT_TERMINAL") ||
    signal.includes("SEASON_TERMINATED") ||
    signal.includes("CANNOT_CANCEL_ACTIVE_OR_TERMINAL_SEASON") ||
    signal.includes("PROPOSAL_ALREADY_REVIEWED") ||
    /reached ACTIVE|only while DRAFT|cannot be hard-deleted/i.test(message)
  ) {
    return NextResponse.json({ error: message || fallback, code: domainCode ?? "CONFLICT" }, { status: 409 });
  }
  if (
    signal.includes("PROPOSAL_EXPIRED") ||
    signal.includes("PAYLOAD_VALIDATION_FAILED") ||
    signal.includes("SCHEMA_VALIDATION_FAILED")
  ) {
    return NextResponse.json({ error: message || fallback, code: domainCode ?? "UNPROCESSABLE_ENTITY" }, { status: 422 });
  }
  if (dbCode === "22023" || signal.includes("INVALID_") || signal.includes("MISSING_")) {
    return NextResponse.json({ error: message || fallback, code: domainCode ?? "INVALID_INPUT" }, { status: 400 });
  }

  console.error(fallback, error);
  return NextResponse.json({ error: fallback, code: "INTERNAL_ERROR" }, { status: 500 });
}
