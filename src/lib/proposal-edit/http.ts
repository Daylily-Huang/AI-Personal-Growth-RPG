import { NextResponse } from "next/server";
import { PROPOSAL_EDIT_BODY_BYTES, PROPOSAL_EDIT_RESPONSE_BYTES, PROPOSAL_FACT_HISTORY_RESPONSE_BYTES,
  PROPOSAL_FACT_SKILL_RESPONSE_BYTES, ProposalEditError, type ProposalEditResult } from "./types";

export function proposalEditResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>) {
  return encodedResponse(body, status, PROPOSAL_EDIT_RESPONSE_BYTES, extraHeaders);
}

export function proposalFactSkillsResponse(body: unknown) {
  return encodedResponse(body, 200, PROPOSAL_FACT_SKILL_RESPONSE_BYTES);
}

export function proposalFactHistoryResponse(body: unknown) {
  return encodedResponse(body, 200, PROPOSAL_FACT_HISTORY_RESPONSE_BYTES);
}

function encodedResponse(body: unknown, status: number, budget: number, extraHeaders?: Record<string, string>) {
  const encoded = JSON.stringify(body);
  if (typeof encoded !== "string" || new TextEncoder().encode(encoded).byteLength > budget)
    throw new ProposalEditError("INVALID_PROPOSAL_EDIT_RECEIPT");
  return new NextResponse(encoded, { status, headers: {
    ...extraHeaders, "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store", Pragma: "no-cache", Vary: "Cookie",
  } });
}

const failures = new Map<string, { status: number; message: string }>([
  ["INVALID_PROPOSAL_EDIT_INPUT", { status: 400, message: "请检查修正内容、分钟数和相关技能线索" }],
  ["PROPOSAL_EDIT_AUTH_REQUIRED", { status: 401, message: "请先登录后修正活动事实" }],
  ["PROPOSAL_EDIT_NOT_FOUND", { status: 404, message: "这条建议不可用" }],
  ["PROPOSAL_EDIT_CONFLICT", { status: 409, message: "建议状态已变化或已有重评请求，请先核实结果" }],
  ["PROPOSAL_EDIT_PAYLOAD_TOO_LARGE", { status: 413, message: "修正内容过大，请缩短后重试" }],
  ["PROPOSAL_EDIT_UNSUPPORTED_MEDIA_TYPE", { status: 415, message: "事实修正需要使用 UTF8 JSON" }],
  ["PROPOSAL_EDIT_CROSS_ORIGIN", { status: 403, message: "请从本站修正活动事实" }],
  ["PROPOSAL_EDIT_AI_UNAVAILABLE", { status: 502, message: "AI 重新评估未完成，请核实请求结果后再决定是否新建尝试" }],
]);

export function proposalEditFailure(error: unknown) {
  const known = error instanceof ProposalEditError ? failures.get(error.code) : undefined;
  return proposalEditResponse({ error: known?.message ?? "修正服务暂不可用，请先核实请求结果" }, known?.status ?? 500);
}

/** Only completed receipts include a proposal; never expose the internal dispatch bit. */
export function proposalEditResultResponse(result: ProposalEditResult) {
  const { request } = result;
  if (request.status === "completed") return proposalEditResponse(result, result.replayed ? 200 : 201);
  if (request.status === "in_progress") return proposalEditResponse({ requestId: request.requestId, status: request.status }, 202, { "Retry-After": "3" });
  if (request.status === "failed") return proposalEditResponse({ requestId: request.requestId, status: request.status,
    error: "AI 重新评估未完成；原建议未因此被替换。请核实状态后再决定是否新建尝试。" }, 502);
  if (request.status === "expired" || request.status === "conflict") return proposalEditResponse({ requestId: request.requestId, status: request.status,
    error: "本次重评未产生新建议，请刷新核实当前建议后再决定是否新建尝试。" }, 409);
  return proposalEditFailure(new ProposalEditError("INVALID_PROPOSAL_EDIT_RECEIPT"));
}

/** Called only after authentication. Preserve contract16 Host/Origin semantics. */
export function validateProposalEditPostHeaders(request: Request) {
  const url = new URL(request.url);
  if (url.search) throw new ProposalEditError("INVALID_PROPOSAL_EDIT_INPUT");
  const target = `${url.protocol}//${request.headers.get("host") ?? url.host}`, origin = request.headers.get("origin");
  if ((origin !== null && origin !== target) || request.headers.get("sec-fetch-site") === "cross-site")
    throw new ProposalEditError("PROPOSAL_EDIT_CROSS_ORIGIN");
  if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-?8|"utf-?8"))?\s*$/i.test(request.headers.get("content-type") ?? ""))
    throw new ProposalEditError("PROPOSAL_EDIT_UNSUPPORTED_MEDIA_TYPE");
}

export async function readProposalEditBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new ProposalEditError("INVALID_PROPOSAL_EDIT_INPUT");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > PROPOSAL_EDIT_BODY_BYTES) throw new ProposalEditError("PROPOSAL_EDIT_PAYLOAD_TOO_LARGE");
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof ProposalEditError) throw error;
    throw new ProposalEditError("INVALID_PROPOSAL_EDIT_INPUT");
  } finally { reader.releaseLock(); }
}
