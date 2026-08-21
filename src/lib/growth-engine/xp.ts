/**
 * Deterministic Growth Engine — XP calculation.
 *
 * This module is intentionally pure: same input always yields the same output.
 * It never touches the database, never calls an LLM, and never depends on wall-clock time.
 */

export const RULES_VERSION = "growth-engine-v0.1";

export type QuestSize =
  | "micro"
  | "minor"
  | "standard"
  | "major"
  | "epic"
  | "main";

export interface XpInput {
  /** Semantic base value chosen by the AI for the task scale (5–50). */
  baseValue: number;
  /** 0..1 semantic difficulty. Mapped into a bounded modifier. */
  difficulty: number;
  /** 0..1 semantic growth increment. */
  masteryGain: number;
  /** Evidence level E0..E6. */
  evidence: number;
  /** 0..1 novelty. Higher novelty reduces repetition penalty. */
  novelty: number;
  /** 0..1 goal alignment. */
  goalAlignment: number;
  /** Number of previous similar activities (for repetition penalty). */
  repetitionCount: number;
  /** Effective minutes; only used as a capped effort reference, never linear XP. */
  effectiveMinutes?: number;
  /** Quest size is used only for a hard sanity cap. */
  questSize?: QuestSize;
}

export interface XpModifiers {
  difficulty: number;
  masteryGain: number;
  evidence: number;
  novelty: number;
  goalAlignment: number;
  repetitionPenalty: number;
  timeFactor: number;
  questSize?: QuestSize;
  questCap?: number;
}

export interface XpResult {
  rawXp: number;
  finalXp: number;
  modifiers: XpModifiers;
  rulesVersion: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Map a 0..1 semantic difficulty to a bounded multiplier. */
export function difficultyModifier(difficulty: number): number {
  return 0.75 + clamp(difficulty, 0, 1) * 0.75; // 0.75 .. 1.50
}

/** Map a 0..1 mastery gain to a bounded multiplier. */
export function masteryGainModifier(masteryGain: number): number {
  return 0.5 + clamp(masteryGain, 0, 1) * 1.0; // 0.50 .. 1.50
}

/** Map evidence level E0..E6 to a bounded multiplier. */
export function evidenceModifier(evidence: number): number {
  const table: Record<number, number> = {
    0: 0.5,
    1: 0.7,
    2: 0.85,
    3: 1.0,
    4: 1.15,
    5: 1.25,
    6: 1.35,
  };
  return table[clamp(Math.round(evidence), 0, 6)] ?? 1;
}

/** Map a 0..1 novelty to a bounded multiplier. */
export function noveltyModifier(novelty: number): number {
  return 0.2 + clamp(novelty, 0, 1) * 1.0; // 0.20 .. 1.20
}

/** Map a 0..1 goal alignment to a bounded multiplier. */
export function goalAlignmentModifier(goalAlignment: number): number {
  return 0.8 + clamp(goalAlignment, 0, 1) * 0.4; // 0.80 .. 1.20
}

/**
 * Repetition penalty.
 *
 * The base curve follows the spec:
 *   first time 100%, 2–3 times 80%, 4–10 times 40%, mastered 15%.
 * High novelty / real breakthrough proportionally removes the penalty.
 */
export function repetitionModifier(repetitionCount: number, novelty: number): number {
  const count = Math.max(0, Math.floor(repetitionCount));
  let base: number;
  if (count === 0) base = 1;
  else if (count <= 2) base = 0.8;
  else if (count <= 9) base = 0.4;
  else base = 0.15;

  // A genuinely novel application is not "the same repetition".
  const noveltyRelief = clamp(novelty, 0, 1);
  return base + (1 - base) * noveltyRelief;
}

/**
 * Time is deliberately not a linear XP source.
 *
 * It only acknowledges a small amount of effort for short/medium sessions and
 * then saturates. Spending 300 minutes instead of 60 minutes cannot grant 5x XP.
 */
export function timeFactor(effectiveMinutes: number | undefined): number {
  if (!effectiveMinutes || effectiveMinutes <= 0) return 1;
  return 1 + Math.min(clamp(effectiveMinutes, 0, 180) / 180, 1) * 0.15; // 1.00 .. 1.15
}

/** Hard cap by quest size to prevent absurd single-activity XP. */
export function questSizeCap(questSize: QuestSize | undefined): number {
  switch (questSize) {
    case "micro":
      return 25;
    case "minor":
      return 60;
    case "standard":
      return 120;
    case "major":
      return 300;
    case "epic":
      return 800;
    case "main":
      return 2000;
    default:
      return 300;
  }
}

export function calculateXp(input: XpInput): XpResult {
  const base = Math.max(0, Number(input.baseValue) || 0);
  const difficulty = difficultyModifier(input.difficulty);
  const masteryGain = masteryGainModifier(input.masteryGain);
  const evidence = evidenceModifier(input.evidence);
  const novelty = noveltyModifier(input.novelty);
  const goalAlignment = goalAlignmentModifier(input.goalAlignment);
  const repetitionPenalty = repetitionModifier(input.repetitionCount, input.novelty);
  const time = timeFactor(input.effectiveMinutes);

  const rawXp = base * difficulty * masteryGain * evidence * novelty * goalAlignment * repetitionPenalty * time;
  const cap = questSizeCap(input.questSize);
  const capped = Math.min(rawXp, cap);
  const finalXp = Math.max(0, Math.round(capped));

  return {
    rawXp: Math.round(rawXp * 100) / 100,
    finalXp,
    modifiers: {
      difficulty: round3(difficulty),
      masteryGain: round3(masteryGain),
      evidence: round3(evidence),
      novelty: round3(novelty),
      goalAlignment: round3(goalAlignment),
      repetitionPenalty: round3(repetitionPenalty),
      timeFactor: round3(time),
      ...(input.questSize ? { questSize: input.questSize, questCap: cap } : {}),
    },
    rulesVersion: RULES_VERSION,
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
