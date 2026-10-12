import { REVIEW_SECTIONS, ReviewError, type ReviewAnalysisReceipt, type ReviewDraft, type ReviewPeriod } from "./types";

export function reviewDraftInputTime(iso: string): string {
  const value = new Date(iso); return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, -1);
}
export function matchingReviewDraftPeriod(note: ReviewDraft["objectiveSummary"] | null, startInput: string, endInput: string, reviewType: "AD_HOC" | "WEEKLY"): ReviewPeriod | null {
  if (!note || reviewType !== (note.reviewMode === "DAILY" ? "AD_HOC" : "WEEKLY")) return null;
  const period = note.summary.period;
  // A local datetime during a DST fold is ambiguous. Keep the original instant
  // while the displayed fields remain unchanged; manual changes clear the note.
  return startInput === reviewDraftInputTime(period.start) && endInput === reviewDraftInputTime(period.end) ? period : null;
}
import { parseReviewPeriod, parseReviewReceipt, parseReviewSummary, plainReviewData } from "./validation";

export const REVIEW_SECTION_LABELS = { growth: "最大成长", breakthrough: "能力突破", artifact: "现实产物", knowledge: "知识链", problem: "主要问题", imbalance: "领域平衡", efficiency: "任务效率", xpRisk: "XP膨胀与重复风险", masteryRisk: "Mastery可信度", rest: "休息与状态", nextAction: "下一步行动" } as const;
const ERRORS = new Map<string, string>([
  ["REVIEW_AUTH_REQUIRED", "请先登录后查看复盘。"], ["REVIEW_INVALID_INPUT", "请选择有效的日期与复盘区间。"], ["REVIEW_EMPTY", "本期暂无活动或成长记录；不生成虚构分析。"], ["REVIEW_INCOMPLETE", "数据超过读取上限，摘要不完整；请缩小日期范围后再分析。"],
  ["REVIEW_PROMPT_TOO_LARGE", "本期摘要过大，暂时无法分析。"], ["REVIEW_AI_NOT_CONFIGURED", "AI接口尚未配置，客观汇总仍可使用。"], ["REVIEW_AI_UNAVAILABLE", "AI服务暂不可用，客观汇总已保留，可稍后重试。"], ["REVIEW_AI_INVALID", "AI返回未通过结构与引用校验，未采用任何建议。"], ["REVIEW_CANCELLED", "分析已取消。"],
]);
export function reviewClientError(error: unknown): string { return error instanceof ReviewError ? ERRORS.get(error.code) ?? "复盘暂不可用，请稍后重试。" : "复盘暂不可用，请稍后重试。"; }
export function localReviewDate(now = new Date()) { const pad = (n: number) => String(n).padStart(2, "0"); return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; }
export function localReviewPeriod(date: string, mode: ReviewPeriod["mode"], now = new Date()): ReviewPeriod {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ReviewError("REVIEW_INVALID_INPUT");
  const start = new Date(`${date}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || localReviewDate(start) !== date) throw new ReviewError("REVIEW_INVALID_INPUT");
  if (mode === "WEEKLY") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const end = new Date(start); end.setDate(end.getDate() + (mode === "DAILY" ? 1 : 7));
  return parseReviewPeriod({ mode, start: start.toISOString(), end: new Date(Math.min(end.getTime(), now.getTime())).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, now);
}
async function payload(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (body && typeof body === "object" && Object.hasOwn(body, "code") && typeof (body as { code: unknown }).code === "string") throw new ReviewError((body as { code: string }).code);
    throw new ReviewError("REVIEW_UNAVAILABLE");
  }
  return body;
}
export async function loadReviewSummary(period: ReviewPeriod, signal: AbortSignal) {
  const body = await payload(await fetch(`/api/reviews/summary?${new URLSearchParams({ ...period })}`, { signal, cache: "no-store" }));
  plainReviewData(body);
  if (!body || typeof body !== "object" || Object.keys(body).length !== 1 || !Object.hasOwn(body, "summary")) throw new ReviewError("REVIEW_MALFORMED_DATA");
  const summary = parseReviewSummary((body as { summary: unknown }).summary);
  if (JSON.stringify(summary.period) !== JSON.stringify(period)) throw new ReviewError("REVIEW_MALFORMED_DATA");
  return summary;
}
export async function requestReviewAnalysis(period: ReviewPeriod, signal: AbortSignal) {
  const result = parseReviewReceipt(await payload(await fetch("/api/reviews/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(period), signal, cache: "no-store" })));
  if (JSON.stringify(result.summary.period) !== JSON.stringify(period)) throw new ReviewError("REVIEW_AI_INVALID");
  return result;
}
export function reviewDraft(receipt: ReviewAnalysisReceipt): ReviewDraft {
  const r = parseReviewReceipt(receipt), a = r.analysis;
  return { period: r.summary.period, reflection: [`【${r.summary.period.mode === "DAILY" ? "每日" : "每周"}复盘草稿：AI推断，待用户确认】`, a.overview, ...REVIEW_SECTIONS.map(key => `${REVIEW_SECTION_LABELS[key]}：${a[key].text}（${a[key].certainty === "supported" ? "有摘要引用，仍为推断" : "资料不足/推断"}）`), `不确定性：${a.uncertainties.join("；")}`].join("\n"), adjustments: a.adjustments.map((v, i) => `${i + 1}. ${v.text}`).join("\n"), objectiveSummary: { provenance: "USER_CONFIRMED_NOTE", reviewMode: r.summary.period.mode, summary: r.summary } };
}
