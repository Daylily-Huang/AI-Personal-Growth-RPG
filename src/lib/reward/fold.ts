export const REWARD_EVENT_KINDS = [
  "EARN",
  "CORRECTION",
  "RESERVE",
  "UNRESERVE",
  "REDEEM",
  "REFUND",
] as const;

export type RewardEventKind = (typeof REWARD_EVENT_KINDS)[number];

export interface RewardLedgerTransaction {
  event_kind: RewardEventKind;
  amount: number;
}

export interface RewardLedgerState {
  lifetime_earned: number;
  net_earned: number;
  lifetime_redeemed: number;
  current_reserved: number;
  correction_deficit: number;
  current_available: number;
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer`);
  }
}

function addSafe(left: number, right: number, label: string): number {
  const result = left + right;
  assertSafeInteger(result, label);
  return result;
}

/**
 * Deterministically folds transactions supplied in canonical ledger order
 * (`created_at ASC, id ASC`). The caller owns ordering; this function owns
 * amount validation and fail-closed accounting invariants.
 */
export function foldRewardLedger(
  transactions: readonly RewardLedgerTransaction[],
): RewardLedgerState {
  let lifetime_earned = 0;
  let net_earned = 0;
  let lifetime_redeemed = 0;
  let current_reserved = 0;

  for (const transaction of transactions) {
    const { event_kind, amount } = transaction;
    assertSafeInteger(amount, `${event_kind} amount`);

    switch (event_kind) {
      case "EARN":
        if (amount <= 0) throw new Error("EARN amount must be strictly positive");
        lifetime_earned = addSafe(lifetime_earned, amount, "lifetime_earned");
        net_earned = addSafe(net_earned, amount, "net_earned");
        break;

      case "CORRECTION":
        if (amount === 0) throw new Error("CORRECTION amount must be non-zero");
        if (amount > 0) {
          lifetime_earned = addSafe(lifetime_earned, amount, "lifetime_earned");
        }
        net_earned = addSafe(net_earned, amount, "net_earned");
        break;

      case "RESERVE":
        if (amount <= 0) throw new Error("RESERVE amount must be strictly positive");
        current_reserved = addSafe(current_reserved, amount, "current_reserved");
        break;

      case "UNRESERVE":
        if (amount <= 0) throw new Error("UNRESERVE amount must be strictly positive");
        current_reserved = addSafe(current_reserved, -amount, "current_reserved");
        if (current_reserved < 0) {
          throw new Error(
            `Impossible ledger state: current_reserved (${current_reserved}) dropped below 0 on UNRESERVE`,
          );
        }
        break;

      case "REDEEM":
        if (amount <= 0) throw new Error("REDEEM amount must be strictly positive");
        current_reserved = addSafe(current_reserved, -amount, "current_reserved");
        if (current_reserved < 0) {
          throw new Error(
            `Impossible ledger state: current_reserved (${current_reserved}) dropped below 0 on REDEEM`,
          );
        }
        lifetime_redeemed = addSafe(lifetime_redeemed, amount, "lifetime_redeemed");
        break;

      case "REFUND":
        if (amount <= 0) throw new Error("REFUND amount must be strictly positive");
        lifetime_redeemed = addSafe(lifetime_redeemed, -amount, "lifetime_redeemed");
        if (lifetime_redeemed < 0) {
          throw new Error(
            `Impossible ledger state: lifetime_redeemed (${lifetime_redeemed}) dropped below 0 on REFUND`,
          );
        }
        break;

      default: {
        const exhaustive: never = event_kind;
        throw new Error(`Unknown event_kind: ${String(exhaustive)}`);
      }
    }
  }

  const totalCommitted = addSafe(
    lifetime_redeemed,
    current_reserved,
    "total_committed",
  );
  const committedMinusEarned = addSafe(totalCommitted, -net_earned, "correction_deficit");
  const earnedMinusCommitted = addSafe(net_earned, -totalCommitted, "current_available");

  return {
    lifetime_earned,
    net_earned,
    lifetime_redeemed,
    current_reserved,
    correction_deficit: Math.max(0, committedMinusEarned),
    current_available: Math.max(0, earnedMinusCommitted),
  };
}
