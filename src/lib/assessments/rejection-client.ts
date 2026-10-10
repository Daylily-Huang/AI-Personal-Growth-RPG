import { isValidUuid } from "@/lib/http/validation";

export class ProposalRejectionError extends Error {
  constructor(readonly code: "auth_required" | "conflict" | "failed", message: string) { super(message); }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

/** Client-only transport: never imports a server client, admin module, or secret. */
export async function rejectProposal(id: string, activityId: string, signal: AbortSignal) {
  if (!isValidUuid(id) || !isValidUuid(activityId)) throw new ProposalRejectionError("failed", "提案标识无效，请刷新页面。");
  const response = await fetch(`/api/assessments/${encodeURIComponent(id)}/reject`, {
    method: "POST", credentials: "same-origin", cache: "no-store", signal,
    headers: { "Content-Type": "application/json" }, body: "{}",
  });
  if (response.status === 401) throw new ProposalRejectionError("auth_required", "登录已失效，请重新登录。");
  if (response.status === 409) throw new ProposalRejectionError("conflict", "评估状态已变更，请刷新后查看。");
  if (!response.ok) throw new ProposalRejectionError("failed", "拒绝未完成；原活动和评估仍保留，请重试。");
  const value: unknown = await response.json().catch(() => null);
  const receipt = record(value) && Object.hasOwn(value, "assessment") ? value.assessment : null;
  if (!record(receipt) || Object.keys(receipt).length !== 3
      || !["id", "activityId", "status"].every(key => Object.hasOwn(receipt, key))
      || !isValidUuid(receipt.id) || receipt.id.toLowerCase() !== id.toLowerCase()
      || !isValidUuid(receipt.activityId) || receipt.activityId.toLowerCase() !== activityId.toLowerCase()
      || receipt.status !== "rejected") throw new ProposalRejectionError("failed", "未取得有效拒绝回执，请刷新后核实。");
  return { id: receipt.id, activityId: receipt.activityId, status: "rejected" as const };
}
