import { NextResponse } from "next/server";
import { AuthRequiredError } from "@/lib/store/request-repository";
import { EVIDENCE_BODY_BYTES, EvidenceSubmissionError } from "./types";

export function evidenceResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control": "private, no-store", Pragma: "no-cache", Vary: "Cookie",
  } });
}

const FAILURES = new Map<string, { status: number; message: string }>([
  ["INVALID_EVIDENCE_INPUT:", { status: 400, message: "请检查材料、技能选择和请求格式" }],
  ["INVALID_EVIDENCE_INPUT:22023", { status: 400, message: "请检查材料、技能选择和请求格式" }],
  ["EVIDENCE_TARGET_NOT_FOUND:P0002", { status: 404, message: "活动或所选技能不可用" }],
  ["EVIDENCE_REQUEST_REUSED:23505", { status: 409, message: "该提交编号已用于另一份材料，请明确新建提交" }],
  ["EVIDENCE_AUTH_REQUIRED:42501", { status: 401, message: "登录已过期，请重新登录" }],
  ["EVIDENCE_BODY_TOO_LARGE:", { status: 413, message: "请求过大，请缩短材料后重试" }],
  ["EVIDENCE_MEDIA_TYPE:", { status: 415, message: "材料提交必须使用 UTF8 JSON" }],
  ["EVIDENCE_ORIGIN:", { status: 403, message: "请从本站活动页面提交材料" }],
]);
export function evidenceFailure(error: unknown) {
  if (error instanceof AuthRequiredError) return evidenceResponse({ error: "请先登录后查看或提交材料" }, 401);
  const known = error instanceof EvidenceSubmissionError ? FAILURES.get(`${error.message}:${error.code ?? ""}`) : undefined;
  return evidenceResponse({ error: known?.message ?? "材料服务暂不可用，请稍后重试" }, known?.status ?? 500);
}

/** Called only after auth. Match the real Host, not an internal Next bind host. */
export function validateEvidencePostHeaders(request: Request) {
  const url = new URL(request.url);
  const target = `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  const origin = request.headers.get("origin");
  if ((origin !== null && origin !== target) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new EvidenceSubmissionError("EVIDENCE_ORIGIN");
  }
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-?8|"utf-?8"))?\s*$/i.test(request.headers.get("content-type") ?? "")) {
    throw new EvidenceSubmissionError("EVIDENCE_MEDIA_TYPE");
  }
}
export async function readEvidenceBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new EvidenceSubmissionError("INVALID_EVIDENCE_INPUT");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > EVIDENCE_BODY_BYTES) throw new EvidenceSubmissionError("EVIDENCE_BODY_TOO_LARGE");
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof EvidenceSubmissionError) throw error;
    throw new EvidenceSubmissionError("INVALID_EVIDENCE_INPUT");
  } finally { reader.releaseLock(); }
}
