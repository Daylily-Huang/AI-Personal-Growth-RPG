import { isValidUuid } from "@/lib/http/validation";
import type { SkillState } from "@/lib/store/types";

export class SkillBootstrapError extends Error {
  constructor(message: string, readonly code?: string) { super(message); }
}
export type ZeroXpSkillInput = { name: string };

/** The sole writable field. Codepoint length matches PostgreSQL char_length. */
export function parseZeroXpSkillInput(value: unknown): ZeroXpSkillInput {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== 1 || !Object.hasOwn(value, "name")) {
    throw new SkillBootstrapError("INVALID_SKILL_INPUT", "22023");
  }
  const name = (value as Record<string, unknown>).name;
  if (typeof name !== "string") throw new SkillBootstrapError("INVALID_SKILL_INPUT", "22023");
  const trimmed = name.trim();
  if (!trimmed || Array.from(trimmed).length > 200 || /[\u0000\uD800-\uDFFF]/u.test(trimmed)) {
    throw new SkillBootstrapError("INVALID_SKILL_INPUT", "22023");
  }
  return { name: trimmed };
}

/** A growth-bearing, wrong-name or incomplete response can never signal success. */
export function isZeroXpSkillReceipt(value: unknown, name: string): value is SkillState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return isValidUuid(s.id) && s.name === name && s.xp === 0 && s.level === 1
    && s.masteryLevel === 0 && s.masteryConfidence === 0 && s.status === "active"
    && s.domainId === null && s.description === null && s.lastUsedAt === null
    && Array.isArray(s.aliases) && s.aliases.length === 0
    && typeof s.createdAt === "string" && Number.isFinite(Date.parse(s.createdAt))
    && typeof s.updatedAt === "string" && Number.isFinite(Date.parse(s.updatedAt));
}
