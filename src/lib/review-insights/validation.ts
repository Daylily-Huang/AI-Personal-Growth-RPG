import { z } from "zod";
import { REVIEW_SECTIONS, REVIEW_SOURCES, REVIEW_VERSION, MONTHLY_REVIEW_VERSION, ReviewAnalysisSchema, ReviewError, ReviewSummarySchema, type ReviewAnalysis, type ReviewAnalysisReceipt, type ReviewPeriod, type ReviewRow, type ReviewSource, type ReviewSummary } from "./types";
import { previousReviewMonth, withMonthlyComparison } from "./monthly";

export function plainReviewData(value: unknown): void {
  let nodes = 0;
  const seen = new Set<object>();
  function walk(v: unknown, depth: number) {
    if (++nodes > 100000 || depth > 24) throw new ReviewError("REVIEW_MALFORMED_DATA");
    if (typeof v === "string") { if (!v.isWellFormed() || v.includes("\0")) throw new ReviewError("REVIEW_MALFORMED_DATA"); return; }
    if (v === null || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v)) return;
    if (!v || typeof v !== "object" || seen.has(v)) throw new ReviewError("REVIEW_MALFORMED_DATA");
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) throw new ReviewError("REVIEW_MALFORMED_DATA");
    seen.add(v);
    for (const key of Reflect.ownKeys(v)) {
      if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key)) throw new ReviewError("REVIEW_MALFORMED_DATA");
      const d = Object.getOwnPropertyDescriptor(v, key);
      if (!d || !("value" in d)) throw new ReviewError("REVIEW_MALFORMED_DATA");
      if (array && key === "length") continue;
      walk(d.value, depth + 1);
    }
    if (array && Object.keys(v).length !== v.length) throw new ReviewError("REVIEW_MALFORMED_DATA");
    seen.delete(v);
  }
  walk(value, 0);
}
export function reviewTimestamp(value: unknown): string {
  if (typeof value !== "string") throw new ReviewError("REVIEW_MALFORMED_DATA");
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!m) throw new ReviewError("REVIEW_MALFORMED_DATA");
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number), leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] || hour > 23 || minute > 59 || second > 59 || m[7] !== undefined && (Number(m[7]) > 23 || Number(m[8]) > 59) || !Number.isFinite(Date.parse(value))) throw new ReviewError("REVIEW_MALFORMED_DATA");
  return value;
}
/** Exact nanosecond key: PostgreSQL fractions must not collapse to JS milliseconds. */
export function compareReviewTimestamps(a: string, b: string): number {
  const key = (value: string) => {
    const valid = reviewTimestamp(value), fraction = /\.(\d{1,9})(?=Z|[+-]\d{2}:\d{2}$)/.exec(valid)?.[1] ?? "";
    const whole = Date.parse(valid.replace(/\.\d{1,9}(?=Z|[+-]\d{2}:\d{2}$)/, ""));
    return BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(9, "0"));
  };
  const left = key(a), right = key(b); return left < right ? -1 : left > right ? 1 : 0;
}
const uuid = z.string().uuid().refine(v => v === v.toLowerCase()), time = z.string().superRefine((v, ctx) => { try { reviewTimestamp(v); } catch { ctx.addIssue({ code: "custom", message: "timestamp" }); } });
export function parseReviewPeriod(value: unknown, now = new Date()): ReviewPeriod {
  try {
    plainReviewData(value);
    const p = z.strictObject({ mode: z.enum(["DAILY", "WEEKLY", "MONTHLY"]), start: time, end: time, timezone: z.string().min(1).max(100) }).parse(value);
    const a = Date.parse(p.start), b = Date.parse(p.end);
    if (new Date(a).toISOString() !== p.start || new Date(b).toISOString() !== p.end || a >= b || b > now.getTime() || b - a > (p.mode === "DAILY" ? 26 : p.mode === "WEEKLY" ? 8 * 24 : 32 * 24) * 3600000) throw Error();
    new Intl.DateTimeFormat("en", { timeZone: p.timezone }).format(now);
    if (p.mode === "MONTHLY") previousReviewMonth(p);
    return p;
  } catch { throw new ReviewError("REVIEW_INVALID_INPUT"); }
}
export function parseReviewQuery(request: Request): ReviewPeriod {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(k => !["mode", "start", "end", "timezone"].includes(k) || params.getAll(k).length !== 1)) throw new ReviewError("REVIEW_INVALID_INPUT");
  return parseReviewPeriod(Object.fromEntries(params));
}
const base = { id: uuid, user_id: uuid, created_at: time }, name = z.string().min(1).max(100000), nullableId = uuid.nullable(), minutes = z.number().int().nonnegative().safe().nullable();
export const REVIEW_ROW_SCHEMAS = {
  activities: z.strictObject({ ...base, title: name, status: z.enum(["pending_assessment", "assessed", "confirmed"]), total_minutes: minutes, effective_minutes: minutes }),
  xp_transactions: z.strictObject({ ...base, activity_id: uuid, skill_id: nullableId, domain_id: nullableId, amount: z.number().int().safe(), xp_type: z.enum(["activity", "adjustment", "correction"]), repetition_count: z.number().int().nonnegative().safe(), repetition_penalty: z.number().min(0).max(1) }),
  mastery_events: z.strictObject({ ...base, skill_id: nullableId, from_level: z.number().int().min(0).max(10), to_level: z.number().int().min(0).max(10), event_type: z.enum(["upgrade", "confidence_refresh", "confidence_decay", "correction"]), evidence_id: nullableId }),
  skills: z.strictObject({ ...base, name, domain_id: nullableId, mastery_level: z.number().int().min(0).max(10), status: z.enum(["active", "archived"]) }),
  knowledge_nodes: z.strictObject({ ...base, title: name, verification_status: z.enum(["inferred", "verified", "rejected", "superseded"]), is_archived: z.boolean() }),
  artifacts: z.strictObject({ ...base, title: name, lifecycle_status: z.enum(["draft", "active", "archived", "superseded"]) }),
  quests: z.strictObject({ ...base, title: name, status: z.enum(["locked", "available", "active", "paused", "completed", "failed", "archived"]), progress: z.number().min(0).max(100), is_main_quest: z.boolean() }),
  domains: z.strictObject({ ...base, name }),
  journal_entries: z.strictObject({ ...base, logged_at: time, is_archived: z.boolean(), energy: z.number().int().min(1).max(5).nullable(), focus: z.number().int().min(1).max(5).nullable(), stress: z.number().int().min(1).max(5).nullable(), resistance: z.number().int().min(1).max(5).nullable(), recovery: z.number().int().min(1).max(5).nullable(), mood_valence: z.number().int().min(-2).max(2).nullable(), self_confidence: z.number().int().min(1).max(5).nullable() }),
};
export function parseReviewRow(source: ReviewSource, value: unknown, owner: string): ReviewRow {
  try {
    plainReviewData(value); const row = REVIEW_ROW_SCHEMAS[source].parse(value);
    if (row.user_id !== owner) throw Error();
    return row;
  } catch { throw new ReviewError("REVIEW_MALFORMED_DATA"); }
}
export function parseReviewSummary(value: unknown): ReviewSummary {
  try {
    plainReviewData(value); const result = ReviewSummarySchema.parse(value);
    parseReviewPeriod(result.period, new Date(result.asOf)); reviewTimestamp(result.asOf);
    if (result.version !== (result.period.mode === "MONTHLY" ? MONTHLY_REVIEW_VERSION : REVIEW_VERSION)) throw Error();
    if (new Set(result.coverage.map(c => c.source)).size !== REVIEW_SOURCES.length || result.complete !== result.coverage.every(c => c.complete) || new Set(result.sourceRefs.map(s => s.ref)).size !== result.sourceRefs.length || result.sourceRefs.some(s => s.ref !== `${s.source}:${s.id}`)) throw Error();
    if (result.comparison) {
      const previous = parseReviewSummary(result.comparison.previous);
      if (result.period.mode !== "MONTHLY" || previous.period.mode !== "MONTHLY" || previous.period.end !== result.period.start || previous.period.timezone !== result.period.timezone) throw Error();
      if (withMonthlyComparison(result, previous).comparison!.partialCurrent !== result.comparison.partialCurrent) throw Error();
    }
    return result;
  } catch { throw new ReviewError("REVIEW_MALFORMED_DATA"); }
}
export function parseReviewAnalysis(value: unknown, summary: ReviewSummary): ReviewAnalysis {
  try {
    plainReviewData(value); const result = ReviewAnalysisSchema.parse(value), refs = new Set([...summary.sourceRefs, ...(summary.comparison?.previous.sourceRefs ?? [])].map(r => r.ref));
    for (const item of [...REVIEW_SECTIONS.map(k => result[k]), ...result.adjustments]) {
      if (new Set(item.supportingIds).size !== item.supportingIds.length || item.supportingIds.some(id => !refs.has(id)) || item.certainty === "supported" && !item.supportingIds.length) throw Error();
    }
    // Recommendations describe real behavior, never direct authority bookkeeping.
    // Risk sections may still discuss XP/Mastery; this conservative guard is actions-only.
    for (const item of [result.nextAction, ...result.adjustments]) {
      const normalized = item.text.normalize("NFKC").replace(/\p{Cf}/gu, ""), words = normalized.toLowerCase(), compact = words.replace(/\p{White_Space}/gu, "");
      const joined = normalized.replace(/([a-z]*x)\p{White_Space}+p/giu, (pair, left: string) =>
        /^(?:six|box|fox|index|prefix|suffix|complex|relax|fix|mix|flux|matrix|syntax|linux|unix|latex|phoenix|helix|regex|ajax|codex|vertex|convex|climax|annex|tax|wax|max|crux|inbox|outbox|affix)$/i.test(left) ? pair : `${left}p`);
      const latinWords = joined.toLowerCase().match(/[a-z]+/g) ?? [];
      // Natural exp... words are not XP, but another XP occurrence is never hidden.
      const mentionsXp = latinWords.some(word => word.includes("xp")
        && (!/^(?:re|un|in|over|out)?exp(?:ort|lain|lor|erienc|eriment|and|ress|ect|os|ir|licit|ert|ens|end|onen|edit|iat)[a-z]*$/.test(word) || word.indexOf("xp") !== word.lastIndexOf("xp")));
      if (mentionsXp
        || /mastery|evidence|经验值|经验点|积分|experiencepoints|rewardpoints|wishpoints/u.test(compact)) throw Error();
    }
    return result;
  } catch { throw new ReviewError("REVIEW_AI_INVALID"); }
}
export function parseReviewReceipt(value: unknown): ReviewAnalysisReceipt {
  try {
    plainReviewData(value);
    const r = z.strictObject({ version: z.enum([REVIEW_VERSION, MONTHLY_REVIEW_VERSION]), model: z.string().min(1).max(200), analyzedAt: time, summary: z.unknown(), analysis: z.unknown() }).parse(value);
    const summary = parseReviewSummary(r.summary);
    if (r.version !== summary.version || !summary.complete || summary.comparison?.previous.complete === false || summary.period.mode === "MONTHLY" && !summary.comparison || Date.parse(r.analyzedAt) < Date.parse(summary.asOf)) throw Error();
    if (summary.comparison && Date.parse(r.analyzedAt) < Date.parse(summary.comparison.previous.asOf)) throw Error();
    return { ...r, summary, analysis: parseReviewAnalysis(r.analysis, summary) };
  } catch { throw new ReviewError("REVIEW_AI_INVALID"); }
}
