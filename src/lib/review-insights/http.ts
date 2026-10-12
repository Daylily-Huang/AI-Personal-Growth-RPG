import { NextResponse } from "next/server";
import { REVIEW_BODY_BYTES, ReviewError } from "./types";
import { getReviewInsightsRepository } from "./request";
import type { ReviewInsightsRepository } from "./repository";

export function reviewJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Pragma: "no-cache", Vary: "Cookie" } });
}
const STATUS = new Map<string, number>([
  ["REVIEW_AUTH_REQUIRED", 401], ["REVIEW_INVALID_INPUT", 400], ["REVIEW_ORIGIN", 403], ["REVIEW_MEDIA_TYPE", 415], ["REVIEW_BODY_TOO_LARGE", 413],
  ["REVIEW_EMPTY", 422], ["REVIEW_INCOMPLETE", 422], ["REVIEW_PROMPT_TOO_LARGE", 422], ["REVIEW_AI_NOT_CONFIGURED", 503], ["REVIEW_AI_UNAVAILABLE", 503], ["REVIEW_AI_INVALID", 502], ["REVIEW_CANCELLED", 408],
]);
export function reviewFailure(error: unknown) {
  const status = error instanceof ReviewError ? STATUS.get(error.code) : undefined;
  return reviewJson({ code: status !== undefined && error instanceof ReviewError ? error.code : "REVIEW_UNAVAILABLE" }, status ?? 500);
}
export async function reviewRoute(work: (repository: ReviewInsightsRepository) => Promise<NextResponse>) {
  try { return await work(await getReviewInsightsRepository()); } catch (error) { return reviewFailure(error); }
}
export async function reviewBody(request: Request): Promise<unknown> {
  const url = new URL(request.url), origin = request.headers.get("origin");
  if (url.searchParams.size) throw new ReviewError("REVIEW_INVALID_INPUT");
  if (origin !== null && origin !== `${url.protocol}//${request.headers.get("host") ?? url.host}` || request.headers.get("sec-fetch-site") === "cross-site") throw new ReviewError("REVIEW_ORIGIN");
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-?8|"utf-?8"))?\s*$/i.test(request.headers.get("content-type") ?? "")) throw new ReviewError("REVIEW_MEDIA_TYPE");
  const reader = request.body?.getReader();
  if (!reader) throw new ReviewError("REVIEW_INVALID_INPUT");
  const decoder = new TextDecoder("utf-8", { fatal: true }); let bytes = 0, text = "";
  try {
    for (;;) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > REVIEW_BODY_BYTES) throw new ReviewError("REVIEW_BODY_TOO_LARGE"); text += decoder.decode(chunk.value, { stream: true }); }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) { void reader.cancel().catch(() => undefined); if (error instanceof ReviewError) throw error; throw new ReviewError("REVIEW_INVALID_INPUT"); }
  finally { reader.releaseLock(); }
}
