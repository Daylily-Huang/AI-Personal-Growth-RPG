import { describe, expect, test } from "vitest";
import { countRecentSimilar, type SimilarTransactionLike } from "@/lib/store/similarity";

const now = "2026-08-17T12:00:00.000Z";

function tx(overrides: Partial<SimilarTransactionLike> = {}): SimilarTransactionLike {
  return {
    skillId: "skill-stats",
    activityType: "learning",
    createdAt: "2026-08-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("countRecentSimilar (MVP repetition similarity)", () => {
  test("different skill never counts", () => {
    const transactions = [tx({ skillId: "skill-bio" }), tx({ skillId: "skill-prog" })];
    expect(
      countRecentSimilar(transactions, { skillId: "skill-stats", activityType: "learning", refTime: now }),
    ).toBe(0);
  });

  test("different activity type does not trigger repetition", () => {
    // Same skill, but one was learning and this one is production.
    const transactions = [tx({ activityType: "learning" }), tx({ activityType: "physical" })];
    expect(
      countRecentSimilar(transactions, { skillId: "skill-stats", activityType: "production", refTime: now }),
    ).toBe(0);
  });

  test("same skill + same type inside the 30-day window counts", () => {
    const transactions = [
      tx({ createdAt: "2026-08-01T00:00:00.000Z" }),
      tx({ createdAt: "2026-08-16T00:00:00.000Z" }),
    ];
    expect(
      countRecentSimilar(transactions, { skillId: "skill-stats", activityType: "learning", refTime: now }),
    ).toBe(2);
  });

  test("older than 30 days is ignored", () => {
    const transactions = [tx({ createdAt: "2026-07-10T00:00:00.000Z" })];
    expect(
      countRecentSimilar(transactions, { skillId: "skill-stats", activityType: "learning", refTime: now }),
    ).toBe(0);
  });

  test("a transaction after refTime never counts", () => {
    const transactions = [tx({ createdAt: "2026-08-18T00:00:00.000Z" })];
    expect(
      countRecentSimilar(transactions, { skillId: "skill-stats", activityType: "learning", refTime: now }),
    ).toBe(0);
  });

  test("legacy transactions without activityType never match a typed activity", () => {
    const transactions = [tx({ activityType: null })];
    expect(
      countRecentSimilar(transactions, { skillId: "skill-stats", activityType: "learning", refTime: now }),
    ).toBe(0);
  });

  test("custom window works", () => {
    const transactions = [tx({ createdAt: "2026-08-15T00:00:00.000Z" })];
    expect(
      countRecentSimilar(transactions, {
        skillId: "skill-stats",
        activityType: "learning",
        refTime: now,
        windowDays: 7,
      }),
    ).toBe(1);
    const older = [tx({ createdAt: "2026-08-01T00:00:00.000Z" })];
    expect(
      countRecentSimilar(older, {
        skillId: "skill-stats",
        activityType: "learning",
        refTime: now,
        windowDays: 7,
      }),
    ).toBe(0);
  });
});
