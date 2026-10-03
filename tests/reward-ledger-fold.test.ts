import { describe, expect, test } from "vitest";
import {
  foldRewardLedger,
  type RewardLedgerTransaction,
} from "../src/lib/reward/fold";

const tx = (
  event_kind: RewardLedgerTransaction["event_kind"],
  amount: number,
): RewardLedgerTransaction => ({ event_kind, amount });

describe("Phase 8E Round 1 — foldRewardLedger", () => {
  test("Trace A: a negative correction preserves gross earnings and reduces available", () => {
    expect(foldRewardLedger([tx("EARN", 100), tx("CORRECTION", -20)])).toEqual({
      lifetime_earned: 100,
      net_earned: 80,
      lifetime_redeemed: 0,
      current_reserved: 0,
      correction_deficit: 0,
      current_available: 80,
    });
  });

  test("Trace B: reserve, redeem, and refund restore available credits", () => {
    expect(
      foldRewardLedger([
        tx("EARN", 100),
        tx("RESERVE", 100),
        tx("REDEEM", 100),
        tx("REFUND", 100),
      ]),
    ).toEqual({
      lifetime_earned: 100,
      net_earned: 100,
      lifetime_redeemed: 0,
      current_reserved: 0,
      correction_deficit: 0,
      current_available: 100,
    });
  });

  test("Trace C: correction deficit absorbs later legitimate earnings", () => {
    const beforeRecovery = foldRewardLedger([
      tx("EARN", 100),
      tx("RESERVE", 100),
      tx("REDEEM", 100),
      tx("CORRECTION", -50),
    ]);
    expect(beforeRecovery).toMatchObject({
      lifetime_earned: 100,
      net_earned: 50,
      lifetime_redeemed: 100,
      correction_deficit: 50,
      current_available: 0,
    });

    expect(
      foldRewardLedger([
        tx("EARN", 100),
        tx("RESERVE", 100),
        tx("REDEEM", 100),
        tx("CORRECTION", -50),
        tx("EARN", 60),
      ]),
    ).toMatchObject({
      net_earned: 110,
      correction_deficit: 0,
      current_available: 10,
    });
  });

  test.each([
    ["zero earn", [tx("EARN", 0)]],
    ["zero correction", [tx("CORRECTION", 0)]],
    ["negative reserve", [tx("RESERVE", -1)]],
    ["over-unreserve", [tx("RESERVE", 10), tx("UNRESERVE", 11)]],
    ["redeem without reserve", [tx("EARN", 10), tx("REDEEM", 10)]],
    ["over-refund", [tx("RESERVE", 10), tx("REDEEM", 10), tx("REFUND", 11)]],
    ["fractional amount", [tx("EARN", 1.5)]],
    ["unsafe amount", [tx("EARN", Number.MAX_SAFE_INTEGER), tx("EARN", 1)]],
  ] satisfies Array<[string, RewardLedgerTransaction[]]>) (
    "fails closed for %s",
    (_label, transactions) => {
      expect(() => foldRewardLedger(transactions)).toThrow();
    },
  );
});
