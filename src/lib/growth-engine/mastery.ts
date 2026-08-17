/**
 * Mastery eligibility rules.
 *
 * Mastery is deliberately NOT derived from XP. It is based on evidence,
 * independence, depth and stability. These pure functions enforce the
 * conservative direction of the spec: high mastery must require strong evidence.
 */

export const MASTERY_LABELS = [
  "Unknown",
  "Exposure",
  "Understand",
  "Recall",
  "Explain",
  "Apply",
  "Independent",
  "Transfer",
  "Systemize",
  "Teach",
  "Create",
] as const;

export type MasteryLevel = (typeof MASTERY_LABELS)[number];

export function masteryLabel(level: number): string {
  const index = Math.max(0, Math.min(10, Math.round(level)));
  return MASTERY_LABELS[index];
}

/**
 * Maximum mastery a user can reasonably be proposed based solely on evidence.
 * This is intentionally conservative.
 */
export function maxMasteryForEvidence(evidenceLevel: number): number {
  const evidence = Math.max(0, Math.min(6, Math.round(evidenceLevel)));
  const table: Record<number, number> = {
    0: 2, // self-report can at most suggest exposure/understanding
    1: 3, // summary -> recall
    2: 4, // correct explanation -> explain
    3: 5, // reproduction -> guided apply
    4: 6, // real-world application -> independent
    5: 8, // repeated independent use -> transfer/systemize candidate
    6: 10, // systemized/created -> teach/create candidate
  };
  return table[evidence];
}

export function requiresMasteryVerification(fromLevel: number, toLevel: number): boolean {
  const from = Math.max(0, Math.min(10, Math.round(fromLevel)));
  const to = Math.max(0, Math.min(10, Math.round(toLevel)));
  return to >= 5 || to - from >= 2;
}

export interface MasteryProposalCheck {
  allowed: boolean;
  maxAllowed: number;
  verificationRequired: boolean;
  reason: string;
}

export function checkMasteryProposal(
  currentMastery: number,
  proposedMastery: number,
  evidenceLevel: number,
): MasteryProposalCheck {
  const current = Math.max(0, Math.min(10, Math.round(currentMastery)));
  const proposed = Math.max(0, Math.min(10, Math.round(proposedMastery)));
  const maxAllowed = maxMasteryForEvidence(evidenceLevel);

  if (proposed > maxAllowed) {
    return {
      allowed: false,
      maxAllowed,
      verificationRequired: true,
      reason: `Evidence E${evidenceLevel} does not support M${proposed} (max M${maxAllowed}).`,
    };
  }

  if (proposed <= current) {
    return {
      allowed: true,
      maxAllowed,
      verificationRequired: false,
      reason: "No upgrade proposed.",
    };
  }

  return {
    allowed: true,
    maxAllowed,
    verificationRequired: requiresMasteryVerification(current, proposed),
    reason: requiresMasteryVerification(current, proposed)
      ? `Upgrade M${current} → M${proposed} requires verification.`
      : `Upgrade M${current} → M${proposed} is allowed by evidence.`,
  };
}
