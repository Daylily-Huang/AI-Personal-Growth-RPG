import { z } from "zod";

/** Privacy/resource budgets, not Growth Engine coefficients or Evidence thresholds. */
export const ASSESSMENT_CONTEXT_LIMITS = Object.freeze({ candidates: 200, candidateQuery: 201, aliases: 20,
  skills: 5, recent: 5, recentQuery: 6, questDepth: 8, recentDays: 30, titleBytes: 512, nameBytes: 160, jsonBytes: 4096 });
export const ASSESSMENT_CONTEXT_VERSION = "activity-context-v1";
export const AUTHENTICATED_ASSESSMENT_PROMPT_VERSION = "activity-evaluator-v0.3-context";

export class AssessmentContextError extends Error {
  readonly code = "assessment_context_unavailable";
  constructor() { super("Assessment context is unavailable; please retry"); this.name = "AssessmentContextError"; }
}
export const utf8Bytes = (value: string) => new TextEncoder().encode(value).byteLength;
const nonblank = z.string().refine(value => value.trim().length > 0);
const timestamp = z.iso.datetime({ offset: true });
const boundedName = nonblank.refine(value => utf8Bytes(value) <= ASSESSMENT_CONTEXT_LIMITS.nameBytes);
const temporarySchema = z.object({ energy: z.number().min(0).max(100), focus: z.number().min(0).max(100),
  momentum: z.number().min(0).max(100), stress: z.number().min(0).max(100) }).strict();
const coverageSchema = z.object({ candidateScanTruncated: z.boolean(), aliasesTruncated: z.boolean(),
  skillNamesOmitted: z.boolean(), relatedSkillsTruncated: z.boolean(), recentSamplesTruncated: z.boolean(),
  questChainIncomplete: z.boolean(), budgetReduced: z.boolean() }).strict();
const contextSchema = z.object({
  version: z.literal(ASSESSMENT_CONTEXT_VERSION), asOf: timestamp, rulesVersion: nonblank,
  mainQuest: z.object({ title: nonblank.refine(value => utf8Bytes(value) <= ASSESSMENT_CONTEXT_LIMITS.titleBytes),
    titleTruncated: z.boolean(), source: z.enum(["bound", "latest"]) }).strict().nullable(),
  relatedSkills: z.array(z.object({ name: boundedName, masteryLevel: z.number().int().min(0).max(10),
    masteryConfidence: z.number().min(0).max(1) }).strict()).max(ASSESSMENT_CONTEXT_LIMITS.skills),
  recentSamples: z.array(z.object({ skillName: boundedName, activityType: nonblank.nullable(), createdAt: timestamp }).strict())
    .max(ASSESSMENT_CONTEXT_LIMITS.recent),
  temporaryState: temporarySchema, coverage: coverageSchema,
}).strict();
const snapshotSchema = z.object({ activityId: z.uuid(), rawInput: z.string(), context: contextSchema }).strict();
export type AssessmentContextSnapshot = z.infer<typeof snapshotSchema>;
export type AssessmentPrivateContext = z.infer<typeof contextSchema>;
export type ContextCoverage = AssessmentPrivateContext["coverage"];

/** Reject inherited/accessor/unknown data without invoking a getter or a toJSON hook. */
function plainData(value: unknown, seen = new Set<object>(), depth = 0): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value !== "object" || depth > 12 || seen.has(value)) throw new AssessmentContextError();
  seen.add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) throw new AssessmentContextError();
    for (let index = 0; index < value.length; index++) {
      const field = Object.getOwnPropertyDescriptor(value, String(index));
      if (!field || !Object.hasOwn(field, "value") || !field.enumerable) throw new AssessmentContextError();
      plainData(field.value, seen, depth + 1);
    }
  } else {
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new AssessmentContextError();
    for (const key of Reflect.ownKeys(value)) {
      const field = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key) || !field || !field.enumerable || !Object.hasOwn(field, "value"))
        throw new AssessmentContextError();
      plainData(field.value, seen, depth + 1);
    }
  }
  seen.delete(value);
}
export function parseContextData<T>(schema: z.ZodType<T>, value: unknown): T {
  try { plainData(value); const parsed = schema.safeParse(value); if (parsed.success) return parsed.data; }
  catch { /* Never expose a private row or Zod's input-bearing details. */ }
  throw new AssessmentContextError();
}

export function validateAssessmentContextSnapshot(value: unknown): AssessmentContextSnapshot {
  const snapshot = parseContextData(snapshotSchema, value), context = snapshot.context;
  const names = new Set(context.relatedSkills.map(skill => skill.name));
  const now = Date.parse(context.asOf), earliest = now - ASSESSMENT_CONTEXT_LIMITS.recentDays * 86400000;
  if (names.size !== context.relatedSkills.length || context.recentSamples.some(sample => !names.has(sample.skillName)
    || Date.parse(sample.createdAt) > now || Date.parse(sample.createdAt) < earliest)
    || utf8Bytes(JSON.stringify(context)) > ASSESSMENT_CONTEXT_LIMITS.jsonBytes) throw new AssessmentContextError();
  return snapshot;
}
/** Explicit serialization: internal Activity IDs and unrelated DB fields cannot cross this boundary. */
export function serializeAssessmentContext(value: unknown): string {
  return JSON.stringify(validateAssessmentContextSnapshot(value).context);
}

export const contextSkillRowSchema = z.object({ id: z.uuid(), user_id: z.uuid(), name: nonblank,
  aliases: z.array(z.string()), mastery_level: z.number().int().min(0).max(10),
  mastery_confidence: z.number().min(0).max(1), status: z.literal("active") }).strict();
export type ContextSkillRow = z.infer<typeof contextSkillRowSchema>;

function labelMatch(raw: string, label: string): { length: number; position: number } | null {
  const word = label.trim().toLowerCase(); if (!word) return null;
  const text = raw.toLowerCase(), startsWord = /^[a-z0-9_]/i.test(word), endsWord = /[a-z0-9_]$/i.test(word);
  let from = 0;
  while (from <= text.length) {
    const position = text.indexOf(word, from); if (position < 0) return null;
    const before = text[position - 1] ?? "", after = text[position + word.length] ?? "";
    if ((!startsWord || !/[a-z0-9_]/i.test(before)) && (!endsWord || !/[a-z0-9_]/i.test(after))) return { length: [...word].length, position };
    from = position + 1;
  }
  return null;
}
export function selectRelatedContextSkills(raw: string, rows: ContextSkillRow[]): {
  skills: ContextSkillRow[]; coverage: Pick<ContextCoverage, "candidateScanTruncated" | "aliasesTruncated" | "skillNamesOmitted" | "relatedSkillsTruncated">;
} {
  const candidate = rows.slice(0, ASSESSMENT_CONTEXT_LIMITS.candidates), ranked: { row: ContextSkillRow; length: number; position: number }[] = [];
  let skillNamesOmitted = false;
  for (const row of candidate) {
    if (utf8Bytes(row.name) > ASSESSMENT_CONTEXT_LIMITS.nameBytes) { skillNamesOmitted = true; continue; }
    const matches = [row.name, ...row.aliases.slice(0, ASSESSMENT_CONTEXT_LIMITS.aliases)].map(label => labelMatch(raw, label))
      .filter((match): match is { length: number; position: number } => match !== null)
      .sort((a,b) => b.length - a.length || a.position - b.position);
    if (matches[0]) ranked.push({ row, ...matches[0] });
  }
  ranked.sort((a,b) => b.length - a.length || a.position - b.position || (a.row.id < b.row.id ? -1 : a.row.id > b.row.id ? 1 : 0));
  return { skills: ranked.slice(0, ASSESSMENT_CONTEXT_LIMITS.skills).map(item => item.row), coverage: {
    candidateScanTruncated: rows.length > ASSESSMENT_CONTEXT_LIMITS.candidates,
    aliasesTruncated: candidate.some(row => row.aliases.length > ASSESSMENT_CONTEXT_LIMITS.aliases),
    skillNamesOmitted, relatedSkillsTruncated: ranked.length > ASSESSMENT_CONTEXT_LIMITS.skills } };
}
export function clipContextText(value: string, bytes: number): string {
  let result = "";
  for (const codepoint of value) { if (utf8Bytes(result + codepoint) > bytes) break; result += codepoint; }
  return result;
}

/** Remove optional information deterministically, and label every reduced coverage boundary. */
export function fitAssessmentContextBudget(snapshot: AssessmentContextSnapshot): AssessmentContextSnapshot {
  // Validate shape before reducing, but allow the unbudgeted builder's optional payload.
  const result = parseContextData(snapshotSchema, snapshot), context = result.context;
  const over = () => utf8Bytes(JSON.stringify(context)) > ASSESSMENT_CONTEXT_LIMITS.jsonBytes;
  while (over() && context.recentSamples.length) { context.recentSamples.pop(); context.coverage.recentSamplesTruncated = true; context.coverage.budgetReduced = true; }
  while (over() && context.relatedSkills.length) {
    context.relatedSkills.pop(); const names = new Set(context.relatedSkills.map(skill => skill.name));
    context.recentSamples = context.recentSamples.filter(sample => names.has(sample.skillName));
    context.coverage.relatedSkillsTruncated = true; context.coverage.budgetReduced = true;
  }
  while (over() && context.mainQuest) {
    const points = [...context.mainQuest.title]; points.pop();
    context.mainQuest.title = points.join(""); context.mainQuest.titleTruncated = true; context.coverage.budgetReduced = true;
    if (!context.mainQuest.title.trim()) context.mainQuest = null;
  }
  if (over()) throw new AssessmentContextError();
  return validateAssessmentContextSnapshot(result);
}
