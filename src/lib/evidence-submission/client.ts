import {
  EvidenceSubmissionError, SKILL_RESPONSE_BYTES, SUBMISSION_RESPONSE_BYTES,
  type EvidenceQuery, type EvidenceSubmissionInput,
} from "./types";
import { evidenceUuid, parseEvidenceInput, parseEvidenceList, parseEvidenceResult } from "./validation";

async function readResponse(response: Response, cap: number): Promise<unknown> {
  if (!response.ok) {
    // Do not consume arbitrary server/proxy error bodies or display their text.
    void response.body?.cancel().catch(() => undefined);
    throw new EvidenceSubmissionError("EVIDENCE_HTTP_FAILURE", String(response.status));
  }
  const reader = response.body?.getReader();
  if (!reader) throw new EvidenceSubmissionError("INVALID_EVIDENCE_RECEIPT");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0, text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > cap) throw new EvidenceSubmissionError("INVALID_EVIDENCE_RECEIPT");
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
}
export async function loadEvidence(activity: string, query: EvidenceQuery, signal: AbortSignal) {
  const activityId = evidenceUuid(activity);
  const params = new URLSearchParams({ view: query.view });
  if (query.after !== null) params.set("after", evidenceUuid(query.after));
  const response = await fetch(`/api/activities/${activityId}/evidence?${params}`, { signal, cache: "no-store" });
  const raw = await readResponse(response, query.view === "skills" ? SKILL_RESPONSE_BYTES : SUBMISSION_RESPONSE_BYTES);
  return parseEvidenceList(raw, activityId, query);
}
export async function submitEvidence(activity: string, value: EvidenceSubmissionInput, signal: AbortSignal) {
  const activityId = evidenceUuid(activity), input = parseEvidenceInput(value);
  const response = await fetch(`/api/activities/${activityId}/evidence`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input), signal, cache: "no-store",
  });
  const raw = await readResponse(response, SUBMISSION_RESPONSE_BYTES);
  const result = parseEvidenceResult(raw, activityId, input);
  if (response.status !== (result.replayed ? 200 : 201)) throw new EvidenceSubmissionError("INVALID_EVIDENCE_RECEIPT");
  return result;
}
export function evidenceClientMessage(error: unknown): string {
  if (error instanceof EvidenceSubmissionError && error.message === "EVIDENCE_HTTP_FAILURE") {
    const messages = new Map([
      ["401", "登录已过期，请重新登录后重试"], ["404", "活动或所选技能不可用，请重新选择"],
      ["409", "该编号已用于另一份材料，请明确新建提交"], ["400", "请检查材料与技能选择"],
      ["413", "请求过大，请缩短材料"], ["415", "请求格式不受支持，请刷新页面"],
      ["403", "请从本站活动页面重新打开补证面板"],
    ]);
    return messages.get(error.code ?? "") ?? "材料服务暂不可用，请稍后重试";
  }
  return "未能确认请求结果；提交时请用相同编号重试，读取时可重新加载";
}
