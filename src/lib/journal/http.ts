import { NextResponse } from "next/server";
import { isValidUuid } from "@/lib/http/validation";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { JournalRepositoryError } from "./repository";
import { JOURNAL_ENTRY_TYPES, type JournalEntryType, type JournalUpdateInput } from "./types";

type JsonObject = Record<string, unknown>;

export class JournalHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "JournalHttpError";
  }
}

export async function readJsonObject(request: Request): Promise<JsonObject> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new JournalHttpError("Malformed JSON body", 400, "MALFORMED_JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new JournalHttpError("JSON body must be an object", 400, "INVALID_JSON_BODY");
  }
  return body as JsonObject;
}

export function requireUuid(value: unknown, field: string): string {
  if (!isValidUuid(value)) throw new JournalHttpError(`${field} must be a valid UUID`, 400, "INVALID_UUID");
  return value;
}

export function optionalUuid(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return requireUuid(value, field);
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new JournalHttpError(`${field} must be a string`, 400, "INVALID_INPUT");
  return value;
}

export function requireEntryType(value: unknown): JournalEntryType {
  if (typeof value !== "string" || !(JOURNAL_ENTRY_TYPES as readonly string[]).includes(value)) {
    throw new JournalHttpError("entryType is invalid", 400, "INVALID_ENTRY_TYPE");
  }
  return value as JournalEntryType;
}

export function optionalEntryType(value: unknown): JournalEntryType | undefined {
  return value === undefined ? undefined : requireEntryType(value);
}

export function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new JournalHttpError(`${field} must be boolean`, 400, "INVALID_INPUT");
  return value;
}

export function optionalInteger(value: unknown, field: string, min: number, max: number): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new JournalHttpError(`${field} must be an integer from ${min} to ${max}`, 400, "INVALID_STATE_VALUE");
  }
  return Number(value);
}

export function parseUpdate(body: JsonObject): JournalUpdateInput {
  const input: JournalUpdateInput = {};
  if ("entryType" in body) input.entryType = optionalEntryType(body.entryType);
  if ("title" in body) input.title = requireString(body.title, "title");
  if ("contentMarkdown" in body) input.contentMarkdown = requireString(body.contentMarkdown, "contentMarkdown");
  if ("energy" in body) input.energy = optionalInteger(body.energy, "energy", 1, 5);
  if ("focus" in body) input.focus = optionalInteger(body.focus, "focus", 1, 5);
  if ("stress" in body) input.stress = optionalInteger(body.stress, "stress", 1, 5);
  if ("resistance" in body) input.resistance = optionalInteger(body.resistance, "resistance", 1, 5);
  if ("recovery" in body) input.recovery = optionalInteger(body.recovery, "recovery", 1, 5);
  if ("moodValence" in body) input.moodValence = optionalInteger(body.moodValence, "moodValence", -2, 2);
  if ("selfConfidence" in body) input.selfConfidence = optionalInteger(body.selfConfidence, "selfConfidence", 1, 5);
  if ("seasonId" in body) input.seasonId = optionalUuid(body.seasonId, "seasonId");
  if ("questId" in body) input.questId = optionalUuid(body.questId, "questId");
  if ("activityId" in body) input.activityId = optionalUuid(body.activityId, "activityId");
  if ("isArchived" in body) input.isArchived = optionalBoolean(body.isArchived, "isArchived");
  if ("loggedAt" in body) input.loggedAt = requireString(body.loggedAt, "loggedAt");
  return input;
}

function extractDomainCode(message: string): string | null {
  return message.match(/\b([A-Z][A-Z0-9_]{2,})\b/)?.[1] ?? null;
}

export function journalErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof JournalHttpError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ error: error.message, code: "UNAUTHORIZED" }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : "";
  const dbCode = error instanceof JournalRepositoryError ? error.code : null;
  const domainCode = extractDomainCode(message);

  if (dbCode === "P0002" || domainCode === "JOURNAL_NOT_FOUND") {
    return NextResponse.json({ error: message || fallback, code: "JOURNAL_NOT_FOUND" }, { status: 404 });
  }
  if (dbCode === "42501" || /tenant mismatch|permission denied/i.test(message)) {
    return NextResponse.json({ error: message || fallback, code: domainCode ?? "FORBIDDEN" }, { status: 403 });
  }
  if (dbCode === "23505") {
    return NextResponse.json({ error: message || fallback, code: "JOURNAL_ID_CONFLICT" }, { status: 409 });
  }
  if (
    dbCode === "22023" ||
    dbCode === "22007" ||
    dbCode === "22008" ||
    dbCode === "22009" ||
    dbCode === "23514" ||
    domainCode?.startsWith("MISSING_") ||
    domainCode === "NO_FIELDS_TO_UPDATE"
  ) {
    return NextResponse.json({ error: message || fallback, code: domainCode ?? "INVALID_INPUT" }, { status: 400 });
  }

  console.error(fallback, error);
  return NextResponse.json({ error: fallback, code: "INTERNAL_ERROR" }, { status: 500 });
}
