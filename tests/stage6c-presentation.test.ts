import { describe, expect, test } from "vitest";
import {
  getAuthorityVisual,
  getNodeTypeVisual,
  getEdgeVisual,
  formatSourceType,
} from "@/app/knowledge/components/presentation";

describe("Stage 6C — 4-Channel Visual Presentation Helpers (Unit Tests)", () => {
  test("1. Node 4-Channel Authority Matrix: Verified, Inferred, Archived, Rejected", () => {
    // 1.1 Verified Node -> Solid border, Emerald/Sky, CheckCircle2, [VERIFIED]
    const verified = getAuthorityVisual("verified", false, 1.0);
    expect(verified.label).toBe("[VERIFIED]");
    expect(verified.borderClass).toContain("border-solid");
    expect(verified.iconName).toBe("CheckCircle2");
    expect(verified.badgeClass).toContain("text-emerald-300");

    // 1.2 Inferred Node -> Dashed border, Amber, Sparkles, [AI PROPOSED 85%]
    const inferred = getAuthorityVisual("inferred", false, 0.85);
    expect(inferred.label).toBe("[AI PROPOSED 85%]");
    expect(inferred.borderClass).toContain("border-dashed");
    expect(inferred.iconName).toBe("Sparkles");
    expect(inferred.badgeClass).toContain("text-amber-300");

    // 1.3 Archived Node -> Dotted border, Zinc, Archive, [ARCHIVED]
    const archived = getAuthorityVisual("verified", true, 1.0);
    expect(archived.label).toBe("[ARCHIVED]");
    expect(archived.borderClass).toContain("border-dotted");
    expect(archived.iconName).toBe("Archive");
    expect(archived.badgeClass).toContain("text-zinc-400");

    // 1.4 Rejected Node -> Border rose, XCircle, [REJECTED]
    const rejected = getAuthorityVisual("rejected", false, 0.0);
    expect(rejected.label).toBe("[REJECTED]");
    expect(rejected.iconName).toBe("XCircle");
  });

  test("2. Node Type Visual Shapes & Icons: Concept, Claim, Topic", () => {
    const concept = getNodeTypeVisual("concept");
    expect(concept.label).toBe("Concept");
    expect(concept.iconName).toBe("BookOpen");
    expect(concept.shapeClass).toContain("rounded-xl");

    const claim = getNodeTypeVisual("claim");
    expect(claim.label).toBe("Claim");
    expect(claim.iconName).toBe("Quote");
    expect(claim.shapeClass).toContain("rounded-2xl");

    const topic = getNodeTypeVisual("topic");
    expect(topic.label).toBe("Topic");
    expect(topic.iconName).toBe("FolderTree");
    expect(topic.shapeClass).toContain("border-double");
  });

  test("3. Edge Visual Encoding & Custom Markers", () => {
    // 3.1 Verified Prerequisite -> Solid Sky line, Arrow marker
    const prereqVerified = getEdgeVisual("prerequisite", "verified", 1.0);
    expect(prereqVerified.label).toBe("PREREQUISITE");
    expect(prereqVerified.color).toBe("#38bdf8");
    expect(prereqVerified.marker).toBe("arrow");
    expect(prereqVerified.animated).toBe(false);

    // 3.2 Inferred Prerequisite -> Dashed Amber line, Animated, Hollow-Arrow marker
    const prereqInferred = getEdgeVisual("prerequisite", "inferred", 0.78);
    expect(prereqInferred.label).toBe("PRE-REQ (AI 78%)");
    expect(prereqInferred.color).toBe("#f59e0b");
    expect(prereqInferred.marker).toBe("hollow-arrow");
    expect(prereqInferred.animated).toBe(true);

    // 3.3 Contains -> Purple, Circle marker
    const contains = getEdgeVisual("contains", "verified", 1.0);
    expect(contains.label).toBe("CONTAINS");
    expect(contains.marker).toBe("circle");

    // 3.4 Contradicts -> Rose-500, Lightning marker
    const contradicts = getEdgeVisual("contradicts", "verified", 1.0);
    expect(contradicts.label).toBe("CONTRADICTS");
    expect(contradicts.marker).toBe("lightning");
  });

  test("4. Source Type Formatting", () => {
    expect(formatSourceType("activity")).toBe("Activity Record");
    expect(formatSourceType("artifact")).toBe("Project Artifact");
    expect(formatSourceType("ai_proposal")).toBe("AI Growth Assessment");
    expect(formatSourceType("user_created")).toBe("User Manual Entry");
    expect(formatSourceType("imported")).toBe("External Import");
  });
});
