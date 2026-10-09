import { isValidUuid } from "@/lib/http/validation";

export type PreparedItem = Readonly<{ id: string; label: string }>;
export type OnboardingProgress = Readonly<{
  mainQuest: PreparedItem | null;
  skill: PreparedItem | null;
  activity: PreparedItem | null;
}>;

function invalid(): never {
  throw new Error("INVALID_ONBOARDING_RECEIPT");
}

function record(value: unknown): object {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  return value;
}

/** Only own data fields from a JSON receipt; never inherited defaults or getters. */
function own(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, "value")) return invalid();
  return descriptor.value;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return invalid();
  return value.trim();
}

function rows(value: unknown): object[] {
  if (!Array.isArray(value)) return invalid();
  const result: object[] = [];
  for (let index = 0; index < value.length; index++) result.push(record(own(value, String(index))));
  return result;
}

function identity(row: object, seen: Set<string>): string {
  const id = own(row, "id");
  if (!isValidUuid(id) || seen.has(id.toLowerCase())) return invalid();
  seen.add(id.toLowerCase());
  return id;
}

const questStatuses = new Set(["locked", "available", "active", "paused", "completed", "failed", "archived"]);
const activityStatuses = new Set(["pending_assessment", "assessed", "confirmed"]);

/** Read-only preparation facts. No XP/Mastery/reward arithmetic or resource writes. */
export function readOnboardingProgress(receipt: unknown): OnboardingProgress {
  const dashboard = record(own(record(receipt), "dashboard"));
  const quests = rows(own(dashboard, "quests"));
  const skills = rows(own(dashboard, "skills"));
  const activities = rows(own(dashboard, "activities"));
  let mainQuest: PreparedItem | null = null;
  let skill: PreparedItem | null = null;
  let activity: PreparedItem | null = null;
  const questIds = new Set<string>(), skillIds = new Set<string>(), activityIds = new Set<string>();

  for (const row of quests) {
    const id = identity(row, questIds), label = text(own(row, "title"));
    const status = own(row, "status"), isMainQuest = own(row, "isMainQuest");
    if (typeof status !== "string" || !questStatuses.has(status) || typeof isMainQuest !== "boolean") return invalid();
    if (isMainQuest && status === "active" && !mainQuest) mainQuest = { id, label };
  }
  for (const row of skills) {
    const id = identity(row, skillIds), label = text(own(row, "name")), status = own(row, "status");
    if (status !== "active" && status !== "archived") return invalid();
    if (status === "active" && !skill) skill = { id, label };
  }
  for (const row of activities) {
    const id = identity(row, activityIds), label = text(own(row, "title")), status = own(row, "status");
    text(own(row, "rawInput"));
    if (typeof status !== "string" || !activityStatuses.has(status)) return invalid();
    if (!activity) activity = { id, label };
  }
  return { mainQuest, skill, activity };
}
