/**
 * Deterministic Growth Engine — Quest Progression Rule.
 *
 * Single shared calculation for quest progress advancement during activity settlement.
 * Pure function: same input always produces the same output.
 */

export interface QuestProgressInput {
  effectiveMinutes?: number | null;
  completion?: number | null;
}

/**
 * Calculates the authoritative progress delta for a linked quest during activity settlement.
 *
 * Rules:
 * 1. If explicit AI assessed completion is present (0..1), use round(completion * 100), clamped [5, 100].
 * 2. Otherwise proportional to effective minutes: clamp(round(effectiveMinutes / 2), 5, 100).
 * 3. Default fallback if no time is provided: 20%.
 */
export function calculateQuestProgressDelta(input: QuestProgressInput): number {
  if (typeof input.completion === "number" && input.completion > 0) {
    return Math.min(100, Math.max(5, Math.round(input.completion * 100)));
  }

  if (typeof input.effectiveMinutes === "number" && input.effectiveMinutes > 0) {
    return Math.min(100, Math.max(5, Math.round(input.effectiveMinutes / 2)));
  }

  return 20;
}
