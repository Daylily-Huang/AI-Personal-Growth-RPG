import { describe, expect, test } from "vitest";
import { calculateXp } from "@/lib/growth-engine/xp";
import { isPrereqFulfilled, computeSkillDerivedState } from "@/lib/skills/derived-state";
import { computeSkillGraph } from "@/lib/skills/layout";
import { maxMasteryForEvidence, requiresMasteryVerification } from "@/lib/growth-engine/mastery";
import type { Domain, SkillEdge, SkillState } from "@/lib/store/types";

/**
 * Stage 5D Gate — frozen system invariants as executable regression.
 * These are documentation-grade assertions: the authoritative coverage lives in
 * growth-engine.test.ts (XP/mastery engine), stage5b-derived-state.test.ts
 * (12-row truth table), stage5a-*.test.ts (evidence.verified parity, live DB).
 */

describe("Stage 5D invariant — hard prerequisite = M>=2 AND confidence>=0.5", () => {
  test("each side alone is never sufficient; XP/level can never substitute", () => {
    expect(isPrereqFulfilled({ masteryLevel: 1, masteryConfidence: 0.99 })).toBe(false);
    expect(isPrereqFulfilled({ masteryLevel: 2, masteryConfidence: 0.5 })).toBe(true);
    expect(isPrereqFulfilled({ masteryLevel: 2, masteryConfidence: 0.49 })).toBe(false);
    expect(isPrereqFulfilled({ masteryLevel: 3, masteryConfidence: 0 })).toBe(false);
  });

  test("massive XP / level with low mastery stays non-proficient (XP is not Mastery)", () => {
    const richButUnmastered: Parameters<typeof computeSkillDerivedState>[0] = {
      status: "active",
      xp: 1_000_000,
      masteryLevel: 1,
      masteryConfidence: 0.2,
    };
    expect(computeSkillDerivedState(richButUnmastered)).toBe("learning");

    const highLevelLowConfidence: Parameters<typeof computeSkillDerivedState>[0] = {
      status: "active",
      xp: 999,
      masteryLevel: 6,
      masteryConfidence: 0.4,
    };
    expect(computeSkillDerivedState(highLevelLowConfidence)).toBe("learning");
  });

  test("high mastery is capped by evidence level (high mastery requires evidence)", () => {
    expect(maxMasteryForEvidence(0)).toBe(2);
    expect(maxMasteryForEvidence(4)).toBe(6);
    expect(requiresMasteryVerification(4, 5)).toBe(true);
    expect(requiresMasteryVerification(2, 3)).toBe(false);
  });
});

describe("Stage 5D invariant — time is not XP (deterministic, sub-linear)", () => {
  const baseInput = {
    baseValue: 100,
    difficulty: 0.5,
    masteryGain: 0.5,
    evidence: 3,
    novelty: 0.5,
    goalAlignment: 0.6,
    repetitionCount: 0,
  };

  test("more time changes XP but never linearly; same input is fully deterministic", () => {
    const short = calculateXp({ ...baseInput, effectiveMinutes: 10 });
    const long = calculateXp({ ...baseInput, effectiveMinutes: 600 });
    expect(long.finalXp).toBeGreaterThan(short.finalXp);
    expect(long.finalXp).toBeLessThan(short.finalXp * 60);
    expect(calculateXp({ ...baseInput, effectiveMinutes: 600 }).finalXp).toBe(long.finalXp);
  });

  test("failure (low completion) still produces Learning XP — never zero-or-negative grind", () => {
    const failed = calculateXp({
      baseValue: 50,
      difficulty: 0.5,
      masteryGain: 0.3,
      evidence: 1,
      novelty: 0.4,
      goalAlignment: 0.3,
      repetitionCount: 0,
      effectiveMinutes: 30,
    });
    expect(failed.finalXp).toBeGreaterThan(0);
  });
});

describe("Stage 5D robustness — dense graph layout is deterministic and bounded", () => {
  function buildDenseGraph(nodeCount: number, edgeCount: number): {
    domains: Domain[];
    skills: SkillState[];
    edges: SkillEdge[];
  } {
    const skills: SkillState[] = Array.from({ length: nodeCount }, (_, i) => ({
      id: `s-${i}`,
      name: `Skill ${i}`,
      aliases: [],
      status: "active" as const,
      xp: i % 7 === 0 ? 0 : 10 * i,
      level: 1,
      masteryLevel: i % 8,
      masteryConfidence: i % 3 === 0 ? 0.2 : 0.8,
      lastUsedAt: null,
    }));
    // chain edges keep prerequisite relation acyclic: s[i] -> s[i+1]
    const edges: SkillEdge[] = Array.from({ length: nodeCount - 1 }, (_, i) => ({
      id: `e-p-${i}`,
      sourceId: `s-${i}`,
      targetId: `s-${i + 1}`,
      relation: "prerequisite",
    }));
    // extra supports edges (cycle-tolerant relation) up to requested density
    let extra = edgeCount - edges.length;
    let i = 0;
    while (extra > 0 && i < nodeCount) {
      const j = (i + 5) % nodeCount;
      if (j !== i) {
        edges.push({ id: `e-s-${i}-${j}`, sourceId: `s-${i}`, targetId: `s-${j}`, relation: "supports" });
        extra -= 1;
      }
      i += 1;
    }
    return { domains: [], skills, edges };
  }

  const dense = buildDenseGraph(200, 500);

  test("200-node/500-edge graph lays out deterministically and fast", () => {
    const started = Date.now();
    const run1 = computeSkillGraph(dense.domains, dense.skills, dense.edges);
    const elapsed = Date.now() - started;
    const run2 = computeSkillGraph(dense.domains, dense.skills, dense.edges);

    expect(run1.nodes).toHaveLength(200);
    expect(run1.edges.length).toBeGreaterThan(0);
    expect(run1.nodes).toEqual(run2.nodes);
    expect(run1.edges).toEqual(run2.edges);
    expect(elapsed).toBeLessThan(2000);
  });

  test("status/domain filters stay coherent on the dense graph", () => {
    const archived = dense.skills.map((s, i) => (i % 10 === 0 ? { ...s, status: "archived" as const } : s));
    const out = computeSkillGraph(dense.domains, archived, dense.edges, { status: "active" });
    expect(out.nodes.every((n) => n.data.derivedState !== "archived")).toBe(true);

    const withDomains = dense.skills.map((s, i) => ({ ...s, domainId: i % 2 === 0 ? "d-even" : "d-odd" }));
    const scoped = computeSkillGraph(
      [{ id: "d-even", name: "Even", slug: "even", parentId: null }],
      withDomains,
      dense.edges,
      { domainId: "d-even" },
    );
    expect(scoped.nodes.length).toBe(100);
    const ids = new Set(scoped.nodes.map((n) => n.id));
    expect(scoped.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
  });
});
