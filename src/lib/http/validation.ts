const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(val: unknown): val is string {
  return typeof val === "string" && UUID_REGEX.test(val);
}

const SKILL_STATUS_FILTERS = ["active", "archived", "all"] as const;

export type SkillStatusFilter = (typeof SKILL_STATUS_FILTERS)[number];

export function isValidSkillStatusFilter(val: unknown): val is SkillStatusFilter {
  return (
    typeof val === "string" && (SKILL_STATUS_FILTERS as readonly string[]).includes(val)
  );
}

