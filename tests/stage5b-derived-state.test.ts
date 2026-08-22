import { describe, it, expect } from "vitest";
import {
  computeSkillDerivedState,
  isPrereqFulfilled,
  evaluatePrerequisites,
  computeNextUnlocks,
  assembleSkillDetail,
} from "@/lib/skills/derived-state";
import { computeSkillGraph } from "@/lib/skills/layout";
import type { Domain, SkillEdge, SkillState } from "@/lib/store/types";

describe("Stage 5B — Skill Derived State & Layout Pure Logic", () => {
  describe("Hard Prerequisite Invariant (Mastery + Confidence only)", () => {
    it("fulfills prerequisite when mastery >= 2 and confidence >= 0.5", () => {
      expect(isPrereqFulfilled({ masteryLevel: 2, masteryConfidence: 0.5 })).toBe(true);
      expect(isPrereqFulfilled({ masteryLevel: 3, masteryConfidence: 0.8 })).toBe(true);
      expect(isPrereqFulfilled({ masteryLevel: 6, masteryConfidence: 0.95 })).toBe(true);
    });

    it("rejects prerequisite when mastery < 2 regardless of confidence", () => {
      expect(isPrereqFulfilled({ masteryLevel: 1, masteryConfidence: 1.0 })).toBe(false);
      expect(isPrereqFulfilled({ masteryLevel: 0, masteryConfidence: 1.0 })).toBe(false);
    });

    it("rejects prerequisite when confidence < 0.5 regardless of mastery", () => {
      expect(isPrereqFulfilled({ masteryLevel: 5, masteryConfidence: 0.49 })).toBe(false);
      expect(isPrereqFulfilled({ masteryLevel: 10, masteryConfidence: 0.2 })).toBe(false);
    });
  });

  describe("Total Truth Table (All 12 Boundary Cases from 03_SKILL_TREE_API_AND_STATE.md)", () => {
    // Row 1: Archived
    it("Row 1: skill.status == 'archived' => 'archived'", () => {
      const state = computeSkillDerivedState(
        { status: "archived", xp: 1000, masteryLevel: 8, masteryConfidence: 0.9 },
        [{ masteryLevel: 1, masteryConfidence: 0.1 }],
      );
      expect(state).toBe("archived");
    });

    // Row 2: Active, unfulfilled prerequisites => 'locked'
    it("Row 2: active, unfulfilled prereqs => 'locked'", () => {
      const state = computeSkillDerivedState(
        { status: "active", xp: 500, masteryLevel: 3, masteryConfidence: 0.8 },
        [
          { masteryLevel: 2, masteryConfidence: 0.6 },
          { masteryLevel: 1, masteryConfidence: 0.9 }, // unfulfilled!
        ],
      );
      expect(state).toBe("locked");
    });

    // Row 3: Active, prereqs met, xp = 0, M = 0 => 'available'
    it("Row 3: active, prereqs met, xp = 0, M = 0 => 'available'", () => {
      const state = computeSkillDerivedState(
        { status: "active", xp: 0, masteryLevel: 0, masteryConfidence: 0.0 },
        [{ masteryLevel: 2, masteryConfidence: 0.5 }],
      );
      expect(state).toBe("available");
    });

    // Row 4: Active, prereqs met, xp = 0, M = 1 => 'available'
    it("Row 4: active, prereqs met, xp = 0, M = 1 => 'available'", () => {
      const state = computeSkillDerivedState(
        { status: "active", xp: 0, masteryLevel: 1, masteryConfidence: 0.3 },
        [],
      );
      expect(state).toBe("available");
    });

    // Row 5: Active, prereqs met, xp = 0, M = 2 => 'learning'
    it("Row 5: active, prereqs met, xp = 0, M = 2 => 'learning'", () => {
      const state = computeSkillDerivedState(
        { status: "active", xp: 0, masteryLevel: 2, masteryConfidence: 0.6 },
        [],
      );
      expect(state).toBe("learning");
    });

    // Row 6: Active, prereqs met, xp > 0, M = 0 => 'learning'
    it("Row 6: active, prereqs met, xp > 0, M = 0 => 'learning'", () => {
      const state = computeSkillDerivedState(
        { status: "active", xp: 50, masteryLevel: 0, masteryConfidence: 0.0 },
        [],
      );
      expect(state).toBe("learning");
    });

    // Row 7: Active, prereqs met, xp > 0, M = 1 => 'learning'
    it("Row 7: active, prereqs met, xp > 0, M = 1 => 'learning'", () => {
      const state = computeSkillDerivedState(
        { status: "active", xp: 120, masteryLevel: 1, masteryConfidence: 0.4 },
        [],
      );
      expect(state).toBe("learning");
    });

    // Row 8: Active, prereqs met, xp >= 0, M = 2 => 'learning'
    it("Row 8: active, prereqs met, xp >= 0, M = 2 => 'learning'", () => {
      const state = computeSkillDerivedState(
        { status: "active", xp: 300, masteryLevel: 2, masteryConfidence: 0.8 },
        [],
      );
      expect(state).toBe("learning");
    });

    // Row 9: Active, prereqs met, 3 <= M < 6, conf < 0.5 => 'learning'
    it("Row 9: active, prereqs met, 3 <= M < 6, conf < 0.5 => 'learning'", () => {
      const state = computeSkillDerivedState(
        { status: "active", xp: 500, masteryLevel: 4, masteryConfidence: 0.45 },
        [],
      );
      expect(state).toBe("learning");
    });

    // Row 10: Active, prereqs met, 3 <= M < 6, conf >= 0.5 => 'proficient'
    it("Row 10: active, prereqs met, 3 <= M < 6, conf >= 0.5 => 'proficient'", () => {
      const state = computeSkillDerivedState(
        { status: "active", xp: 600, masteryLevel: 4, masteryConfidence: 0.85 },
        [],
      );
      expect(state).toBe("proficient");
    });

    // Row 11: Active, prereqs met, M >= 6, conf < 0.5 => 'learning'
    it("Row 11: active, prereqs met, M >= 6, conf < 0.5 => 'learning'", () => {
      const state = computeSkillDerivedState(
        { status: "active", xp: 1500, masteryLevel: 7, masteryConfidence: 0.35 },
        [],
      );
      expect(state).toBe("learning");
    });

    // Row 12: Active, prereqs met, M >= 6, conf >= 0.5 => 'advanced'
    it("Row 12: active, prereqs met, M >= 6, conf >= 0.5 => 'advanced'", () => {
      const state = computeSkillDerivedState(
        { status: "active", xp: 2000, masteryLevel: 8, masteryConfidence: 0.95 },
        [],
      );
      expect(state).toBe("advanced");
    });
  });

  describe("Prerequisites Evaluation and Next Unlocks", () => {
    const s1: SkillState = {
      id: "s-1",
      name: "JavaScript",
      aliases: ["JS"],
      xp: 400,
      level: 4,
      masteryLevel: 3,
      masteryConfidence: 0.8,
      lastUsedAt: "2026-08-20T10:00:00Z",
    };

    const s2: SkillState = {
      id: "s-2",
      name: "TypeScript",
      aliases: ["TS"],
      xp: 0,
      level: 1,
      masteryLevel: 0,
      masteryConfidence: 0.0,
      lastUsedAt: null,
    };

    const s3: SkillState = {
      id: "s-3",
      name: "Fullstack Architecture",
      aliases: [],
      xp: 0,
      level: 1,
      masteryLevel: 0,
      masteryConfidence: 0.0,
      lastUsedAt: null,
    };

    const edges: SkillEdge[] = [
      { id: "e-1", sourceId: "s-1", targetId: "s-2", relation: "prerequisite" },
      { id: "e-2", sourceId: "s-2", targetId: "s-3", relation: "prerequisite" },
    ];

    it("evaluates prerequisites for TypeScript (fulfilled JS parent)", () => {
      const skillsMap = new Map<string, SkillState>([
        [s1.id, s1],
        [s2.id, s2],
        [s3.id, s3],
      ]);
      const { prerequisites, allPrereqsMet } = evaluatePrerequisites("s-2", skillsMap, edges);

      expect(allPrereqsMet).toBe(true);
      expect(prerequisites).toHaveLength(1);
      expect(prerequisites[0]).toEqual({
        id: "s-1",
        name: "JavaScript",
        masteryLevel: 3,
        masteryConfidence: 0.8,
        isFulfilled: true,
      });
    });

    it("evaluates next unlocks for JavaScript (identifies TypeScript as available)", () => {
      const skillsMap = new Map<string, SkillState>([
        [s1.id, s1],
        [s2.id, s2],
        [s3.id, s3],
      ]);
      const nextUnlocks = computeNextUnlocks("s-1", skillsMap, edges);

      expect(nextUnlocks).toHaveLength(1);
      expect(nextUnlocks[0]).toEqual({
        id: "s-2",
        name: "TypeScript",
        derivedState: "available",
      });
    });

    it("evaluates next unlocks for TypeScript (identifies Fullstack as locked because TS is not M>=2)", () => {
      const skillsMap = new Map<string, SkillState>([
        [s1.id, s1],
        [s2.id, s2],
        [s3.id, s3],
      ]);
      const nextUnlocks = computeNextUnlocks("s-2", skillsMap, edges);

      expect(nextUnlocks).toHaveLength(1);
      expect(nextUnlocks[0]).toEqual({
        id: "s-3",
        name: "Fullstack Architecture",
        derivedState: "locked",
      });
    });
  });

  describe("assembleSkillDetail Snapshot Assembly", () => {
    it("assembles complete skill detail with timeline and nextLevelXp", () => {
      const skill: SkillState = {
        id: "s-ts",
        name: "TypeScript",
        aliases: ["TS"],
        description: "Typed superset of JavaScript",
        domainId: "d-cs",
        xp: 350,
        level: 4,
        masteryLevel: 3,
        masteryConfidence: 0.85,
        lastUsedAt: "2026-08-20T10:00:00Z",
      };

      const result = assembleSkillDetail({
        skill,
        domainName: "Computer Science",
        allSkills: [skill],
        allEdges: [],
        evidenceRecords: [
          {
            id: "ev-1",
            userId: "u-1",
            activityId: "act-1",
            skillId: "s-ts",
            evidenceLevel: 3,
            evidenceType: "code",
            description: "Refactored types",
            verified: true,
            createdAt: "2026-08-20T10:00:00Z",
          },
        ],
        masteryEvents: [
          {
            id: "me-1",
            userId: "u-1",
            skillId: "s-ts",
            fromLevel: 2,
            toLevel: 3,
            confidence: 0.85,
            eventType: "upgrade",
            reason: "Verified refactoring",
            createdAt: "2026-08-20T10:00:00Z",
          },
        ],
        transactions: [
          {
            id: "tx-1",
            activityId: "act-1",
            assessmentId: "as-1",
            xpType: "activity",
            skillId: "s-ts",
            skillName: "TypeScript",
            activityType: "code",
            repetitionCount: 0,
            repetitionPenalty: 1,
            amount: 50,
            baseAmount: 50,
            modifierJson: {},
            reason: "Practice",
            rulesVersion: "test",
            createdAt: "2026-08-20T10:00:00Z",
          },
        ],
        activityTitlesMap: new Map([["act-1", "Refactor Types"]]),
      });

      expect(result.skill.id).toBe("s-ts");
      expect(result.skill.name).toBe("TypeScript");
      expect(result.skill.domainName).toBe("Computer Science");
      expect(result.skill.derivedState).toBe("proficient");
      expect(result.skill.nextLevelXp).toBeGreaterThan(350);
      expect(result.evidenceTimeline).toHaveLength(1);
      expect(result.evidenceTimeline[0].activityTitle).toBe("Refactor Types");
      expect(result.masteryHistory).toHaveLength(1);
      expect(result.recentTransactions).toHaveLength(1);
    });

    it("is 100% pure and produces identical deep output on repeated calls with unchanged input", () => {
      const skill: SkillState = {
        id: "s-stable",
        name: "Stable Skill",
        aliases: [],
        domainId: null,
        status: "active",
        xp: 100,
        level: 2,
        masteryLevel: 2,
        masteryConfidence: 0.8,
        lastUsedAt: "2026-08-20T10:00:00.000Z",
        createdAt: "2026-08-01T00:00:00.000Z",
      };

      const params = {
        skill,
        domainName: null,
        allSkills: [skill],
        allEdges: [],
        evidenceRecords: [],
        masteryEvents: [],
        transactions: [],
      };

      const res1 = assembleSkillDetail(params);
      const res2 = assembleSkillDetail(params);

      expect(res1).toEqual(res2);
      expect(res1.skill.createdAt).toBe("2026-08-01T00:00:00.000Z");
      expect(res2.skill.createdAt).toBe("2026-08-01T00:00:00.000Z");
    });
  });

  describe("computeSkillGraph Layout Generation", () => {
    it("positions nodes in topological layers and filters by domain/status", () => {
      const domains: Domain[] = [
        { id: "d-1", name: "CS", slug: "cs", parentId: null, sortOrder: 0 },
        { id: "d-2", name: "Math", slug: "math", parentId: null, sortOrder: 1 },
      ];

      const s1: SkillState = {
        id: "s-1",
        name: "Python",
        aliases: [],
        domainId: "d-1",
        status: "active",
        xp: 100,
        level: 2,
        masteryLevel: 3,
        masteryConfidence: 0.9,
        lastUsedAt: null,
      };

      const s2: SkillState = {
        id: "s-2",
        name: "Data Science",
        aliases: [],
        domainId: "d-1",
        status: "active",
        xp: 0,
        level: 1,
        masteryLevel: 0,
        masteryConfidence: 0.0,
        lastUsedAt: null,
      };

      const s3: SkillState = {
        id: "s-3",
        name: "Archived Skill",
        aliases: [],
        domainId: "d-2",
        status: "archived",
        xp: 0,
        level: 1,
        masteryLevel: 0,
        masteryConfidence: 0.0,
        lastUsedAt: null,
      };

      const edges: SkillEdge[] = [
        { id: "e-1", sourceId: "s-1", targetId: "s-2", relation: "prerequisite" },
      ];

      // Default active filter
      const graph = computeSkillGraph(domains, [s1, s2, s3], edges);
      expect(graph.nodes).toHaveLength(2); // s3 excluded
      expect(graph.edges).toHaveLength(1);

      const node1 = graph.nodes.find((n) => n.id === "s-1")!;
      const node2 = graph.nodes.find((n) => n.id === "s-2")!;

      expect(node1.position.x).toBe(0);
      expect(node2.position.x).toBe(280);
      expect(node1.data.derivedState).toBe("proficient");
      expect(node2.data.derivedState).toBe("available");

      // Filter by domain
      const mathGraph = computeSkillGraph(domains, [s1, s2, s3], edges, {
        domainId: "d-2",
        status: "all",
      });
      expect(mathGraph.nodes).toHaveLength(1);
      expect(mathGraph.nodes[0].id).toBe("s-3");
      expect(mathGraph.nodes[0].data.derivedState).toBe("archived");
    });

    it("handles mixed relations without cycles or hanging (P2 Mixed-Relation Topology)", () => {
      // sA has prerequisite sB, but sB has contains sA
      const sA: SkillState = {
        id: "s-a",
        name: "Skill A",
        aliases: [],
        domainId: null,
        status: "active",
        xp: 100,
        level: 2,
        masteryLevel: 2,
        masteryConfidence: 0.8,
        lastUsedAt: null,
      };

      const sB: SkillState = {
        id: "s-b",
        name: "Skill B",
        aliases: [],
        domainId: null,
        status: "active",
        xp: 0,
        level: 1,
        masteryLevel: 0,
        masteryConfidence: 0.0,
        lastUsedAt: null,
      };

      const mixedEdges: SkillEdge[] = [
        { id: "e-1", sourceId: "s-a", targetId: "s-b", relation: "prerequisite" },
        { id: "e-2", sourceId: "s-b", targetId: "s-a", relation: "contains" },
      ];

      const graph = computeSkillGraph([], [sA, sB], mixedEdges);
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(2);

      const nodeA = graph.nodes.find((n) => n.id === "s-a")!;
      const nodeB = graph.nodes.find((n) => n.id === "s-b")!;

      expect(nodeA.position.x).toBe(0);
      expect(nodeB.position.x).toBe(280); // prerequisite places sB at layer 1
    });
  });
});
