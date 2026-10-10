import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { AssessmentRejectionError, getAssessmentRejectionSession } from "@/lib/store/assessment-rejection.service";
import { isValidUuid } from "@/lib/http/validation";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const reply = (status: number, code: string, error: string) => NextResponse.json({ error, code }, { status, headers });

/** Bounded body read; Content-Length is neither required nor trusted. */
async function emptyJsonBody(request: Request): Promise<"ok" | "invalid" | "large"> {
  const reader = request.body?.getReader();
  if (!reader) return "invalid";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1024) { try { await reader.cancel(); } catch { /* The measured size already proves oversize. */ } return "large"; }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0 ? "ok" : "invalid";
  } catch { return "invalid"; }
  finally { reader.releaseLock(); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return reply(503, "not_configured", "Assessment connection is not configured");
  try {
    const session = await getAssessmentRejectionSession();
    const { id } = await context.params;
    if (!isValidUuid(id)) return reply(400, "invalid_uuid", "Invalid assessment ID");
    const origin = request.headers.get("origin");
    let crossOrigin = request.headers.get("sec-fetch-site") === "cross-site";
    if (origin) {
      try {
        const url = new URL(request.url);
        // Next's internal URL can use its bind address rather than the browser's Host.
        // As in the login boundary, never accept forwarded host/proto as authority.
        crossOrigin ||= origin !== `${url.protocol}//${request.headers.get("host") ?? url.host}`;
      }
      catch { crossOrigin = true; }
    }
    if (crossOrigin) return reply(403, "cross_origin", "Same-origin request required");
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
      return reply(400, "invalid_payload", "An empty JSON object is required");
    const body = await emptyJsonBody(request);
    if (body === "large") return reply(413, "payload_too_large", "Request body is too large");
    if (body !== "ok") return reply(400, "invalid_payload", "An empty JSON object is required");
    return NextResponse.json(await session.reject(id), { status: 200, headers });
  } catch (error) {
    if (error instanceof AuthRequiredError) return reply(401, "auth_required", "Authentication required");
    if (error instanceof AssessmentRejectionError) {
      if (error.code === "not_found") return reply(404, "not_found", "Assessment not found");
      if (error.code === "assessment_conflict") return reply(409, "assessment_conflict", "Assessment is no longer pending");
    }
    return reply(500, "rejection_failed", "Unable to reject assessment");
  }
}
