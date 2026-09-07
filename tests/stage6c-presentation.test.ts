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
    expect(verified.badgeClass).toContain("text-[var(--authority-verified-text)]");

    // 1.2 Inferred Node -> Dashed border, Amber, Sparkles, [AI PROPOSED 85%]
    const inferred = getAuthorityVisual("inferred", false, 0.85);
    expect(inferred.label).toBe("[AI PROPOSED 85%]");
    expect(inferred.borderClass).toContain("border-dashed");
    expect(inferred.iconName).toBe("Sparkles");
    expect(inferred.badgeClass).toContain("text-[var(--authority-inferred-text)]");

    // 1.3 Archived Node -> Dotted border, Zinc, Archive, [ARCHIVED]
    const archived = getAuthorityVisual("verified", true, 1.0);
    expect(archived.label).toBe("[ARCHIVED]");
    expect(archived.borderClass).toContain("border-dotted");
    expect(archived.iconName).toBe("Archive");
    expect(archived.badgeClass).toContain("text-[var(--text-secondary)]");

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
    // 3.1 Verified Prerequisite -> Solid Sky line, Arrow marker, Directed
    const prereqVerified = getEdgeVisual("prerequisite", "verified", 1.0);
    expect(prereqVerified.label).toBe("PREREQUISITE");
    expect(prereqVerified.color).toBe("var(--authority-verified-text)");
    expect(prereqVerified.marker).toBe("arrow");
    expect(prereqVerified.animated).toBe(false);
    expect(prereqVerified.isSymmetric).toBe(false);

    // 3.2 Inferred Prerequisite -> Dashed Amber line, Animated, Hollow-Arrow marker, Directed
    const prereqInferred = getEdgeVisual("prerequisite", "inferred", 0.78);
    expect(prereqInferred.label).toBe("PRE-REQ (AI 78%)");
    expect(prereqInferred.color).toBe("var(--authority-inferred-text)");
    expect(prereqInferred.marker).toBe("hollow-arrow");
    expect(prereqInferred.animated).toBe(false);
    expect(prereqInferred.isSymmetric).toBe(false);

    // 3.3 Contains -> Purple, Circle marker, Directed
    const contains = getEdgeVisual("contains", "verified", 1.0);
    expect(contains.label).toBe("CONTAINS");
    expect(contains.marker).toBe("arrow");
    expect(contains.isSymmetric).toBe(false);

    // 3.4 Supports -> Emerald, Arrow marker, Directed
    const supports = getEdgeVisual("supports", "verified", 1.0);
    expect(supports.label).toBe("SUPPORTS");
    expect(supports.marker).toBe("arrow");
    expect(supports.isSymmetric).toBe(false);

    // 3.5 P1-1 & P1-2: Inferred vs Verified Contradicts multi-channel distinction
    const contradictsVerified = getEdgeVisual("contradicts", "verified", 1.0);
    expect(contradictsVerified.label).toBe("CONTRADICTS [VERIFIED]");
    expect(contradictsVerified.color).toBe("var(--state-danger-text)");
    expect(contradictsVerified.strokeDasharray).toBeUndefined(); // Solid
    expect(contradictsVerified.animated).toBe(false);
    expect(contradictsVerified.marker).toBe("none");
    expect(contradictsVerified.isSymmetric).toBe(true);

    const contradictsInferred = getEdgeVisual("contradicts", "inferred", 0.82);
    expect(contradictsInferred.label).toBe("CONTRADICTS · AI 82%");
    expect(contradictsInferred.color).toBe("var(--authority-inferred-text)");
    expect(contradictsInferred.strokeDasharray).toBe("4 3"); // Dashed
    expect(contradictsInferred.animated).toBe(false);
    expect(contradictsInferred.marker).toBe("none");
    expect(contradictsInferred.isSymmetric).toBe(true);

    // 3.6 P1-2: Symmetric relates_to has NO directional arrow
    const relatesVerified = getEdgeVisual("relates_to", "verified", 1.0);
    expect(relatesVerified.label).toBe("RELATES TO");
    expect(relatesVerified.marker).toBe("none");
    expect(relatesVerified.isSymmetric).toBe(true);

    const relatesInferred = getEdgeVisual("relates_to", "inferred", 0.65);
    expect(relatesInferred.label).toBe("RELATES (AI 65%)");
    expect(relatesInferred.marker).toBe("none");
    expect(relatesInferred.isSymmetric).toBe(true);
  });

  test("4. Provenance Source Type Formatting", () => {
    expect(formatSourceType("activity")).toBe("Activity Record");
    expect(formatSourceType("artifact")).toBe("Project Artifact");
    expect(formatSourceType("ai_proposal")).toBe("AI Proposal (backed by Activity)");
    expect(formatSourceType("user_created")).toBe("User Manual Entry");
    expect(formatSourceType("imported")).toBe("External Import");
  });
});
