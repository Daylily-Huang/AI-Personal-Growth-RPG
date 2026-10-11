import { NextResponse } from "next/server";
import { ARTIFACT_ACCEPTANCE_BODY_BYTES, ArtifactAcceptanceError } from "./types";
import { getArtifactAcceptanceRepository } from "./request";
import type { ArtifactAcceptanceRepository } from "./repository";

export function artifactAcceptanceJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Pragma: "no-cache", Vary: "Cookie" } });
}
const FAILURES = new Map<string, number>([
  ["ARTIFACT_ACCEPTANCE_AUTH_REQUIRED", 401], ["ARTIFACT_ACCEPTANCE_NOT_FOUND", 404],
  ["ARTIFACT_ACCEPTANCE_INVALID_INPUT", 400], ["ARTIFACT_ACCEPTANCE_KEY_REUSED", 409],
  ["ARTIFACT_ACCEPTANCE_ALREADY_ACCEPTED", 409], ["ARTIFACT_ACCEPTANCE_ALREADY_REVOKED", 409],
  ["ARTIFACT_ACCEPTANCE_SOURCE_INELIGIBLE", 409], ["ARTIFACT_ACCEPTANCE_STALE_SOURCE", 409],
  ["ARTIFACT_ACCEPTANCE_ORIGIN", 403], ["ARTIFACT_ACCEPTANCE_MEDIA_TYPE", 415], ["ARTIFACT_ACCEPTANCE_BODY_TOO_LARGE", 413],
]);
export function artifactAcceptanceFailure(error: unknown) {
  if (error instanceof ArtifactAcceptanceError) {
    const status = FAILURES.get(error.message);
    if (status !== undefined) return artifactAcceptanceJson({ code: error.message }, status);
    if (error.sqlState === "42501") return artifactAcceptanceJson({ code: "FORBIDDEN" }, 403);
  }
  return artifactAcceptanceJson({ code: "ARTIFACT_ACCEPTANCE_UNAVAILABLE" }, 500);
}
export async function artifactAcceptanceRoute(work: (repo: ArtifactAcceptanceRepository) => Promise<NextResponse>) {
  try { return await work(await getArtifactAcceptanceRepository()); }
  catch (error) { return artifactAcceptanceFailure(error); }
}
export function artifactAcceptanceNoQuery(request: Request) {
  if (new URL(request.url).searchParams.size) throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_INVALID_INPUT");
}
/** Auth is resolved by the route before this header/body boundary. */
export async function artifactAcceptanceBody(request: Request): Promise<unknown> {
  artifactAcceptanceNoQuery(request);
  const url = new URL(request.url), target = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  const origin = request.headers.get("origin");
  if ((origin !== null && origin !== target) || request.headers.get("sec-fetch-site") === "cross-site")
    throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_ORIGIN");
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-?8|"utf-?8"))?\s*$/i.test(request.headers.get("content-type") ?? ""))
    throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_MEDIA_TYPE");
  const reader = request.body?.getReader();
  if (!reader) throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_INVALID_INPUT");
  const decoder = new TextDecoder("utf-8", { fatal: true }); let bytes = 0, result = "";
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > ARTIFACT_ACCEPTANCE_BODY_BYTES) throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_BODY_TOO_LARGE");
      result += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(result + decoder.decode()) as unknown;
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof ArtifactAcceptanceError) throw error;
    throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_INVALID_INPUT");
  } finally { reader.releaseLock(); }
}
