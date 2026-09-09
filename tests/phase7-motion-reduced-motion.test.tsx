// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { SkillFlowEdge } from "@/lib/store/types";
import type { KnowledgeGraphResponse } from "@/lib/knowledge/types";
import SkillGraphCanvas, { toFlowEdges as toSkillFlowEdges } from "@/app/skills/components/SkillGraphCanvas";
import KnowledgeGraphCanvas, { toFlowEdges as toKnowledgeFlowEdges } from "@/app/knowledge/components/KnowledgeGraphCanvas";
import type { SkillFlowNodeType } from "@/app/skills/components/SkillNode";
import type { KnowledgeFlowNodeType } from "@/app/knowledge/components/KnowledgeNodeView";

const camera = vi.hoisted(() => ({
  setCenter: vi.fn(() => Promise.resolve()),
  fitView: vi.fn(() => Promise.resolve()),
}));

vi.mock("@xyflow/react", () => ({
  BackgroundVariant: { Dots: "dots" },
  MarkerType: { ArrowClosed: "arrowclosed" },
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  ReactFlow: ({ children }: { children: React.ReactNode }) => <div data-testid="mock-react-flow">{children}</div>,
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => camera,
}));

vi.mock("@/app/skills/components/SkillNode", () => ({
  default: () => null,
}));

vi.mock("@/app/knowledge/components/KnowledgeNodeView", () => ({
  default: () => null,
}));

const skillNode = {
  id: "skill-a",
  position: { x: 12, y: 24 },
  type: "skillNode",
  data: {
    name: "技能 A",
    aliases: [],
    domainId: "domain-a",
    level: 3,
    xp: 120,
    masteryLevel: 2,
    masteryConfidence: 0.7,
    derivedState: "learning",
    lastUsedAt: null,
    prerequisiteCount: 0,
    unfulfilledPrerequisiteCount: 0,
  },
} as unknown as SkillFlowNodeType;

const knowledgeNode = {
  id: "knowledge-a",
  position: { x: 12, y: 24 },
  type: "knowledgeNode",
  data: {
    id: "knowledge-a",
    title: "知识 A",
    nodeType: "concept",
    domainId: "domain-a",
    domainName: "科研",
    skillId: null,
    skillName: null,
    verificationStatus: "verified",
    isArchived: false,
    confidence: 0.9,
    sourceType: "user_created",
    sourceId: null,
    inboundEdgeCount: 0,
    outboundEdgeCount: 0,
    position: { x: 12, y: 24 },
  },
} as unknown as KnowledgeFlowNodeType;

function setMotionPreference(reduced: boolean, duration = "250ms") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((media: string) => ({
      matches: reduced && media === "(prefers-reduced-motion: reduce)",
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  vi.spyOn(window, "getComputedStyle").mockImplementation(() => ({
    getPropertyValue: (property: string) => property === "--duration-normal" ? duration : "",
  }) as CSSStyleDeclaration);
}

async function flushGraphEffects() {
  await act(async () => {
    vi.advanceTimersByTime(60);
    await Promise.resolve();
  });
}

function renderSkillsGraph(focusNonce: number) {
  return render(
    <SkillGraphCanvas
      nodes={[skillNode]}
      rawEdges={[]}
      onSelect={vi.fn()}
      onNavigate={vi.fn()}
      focusTarget={{ x: 12, y: 24, nonce: focusNonce }}
      fitKey={`fit-${focusNonce}`}
    />,
  );
}

function renderKnowledgeGraph(focusNonce: number) {
  return render(
    <KnowledgeGraphCanvas
      nodes={[knowledgeNode]}
      clusters={[]}
      rawEdges={[]}
      selectedEdgeId={null}
      onSelectNode={vi.fn()}
      onSelectEdge={vi.fn()}
      onNavigate={vi.fn()}
      onClearSelection={vi.fn()}
      focusTarget={{ x: 12, y: 24, nonce: focusNonce }}
      fitKey={`fit-${focusNonce}`}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  camera.setCenter.mockClear();
  camera.fitView.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Phase 7 Round 3 motion and reduced-motion contract", () => {
  it("uses zero-duration Skills camera movement under reduced motion", async () => {
    setMotionPreference(true);
    renderSkillsGraph(1);
    await flushGraphEffects();

    expect(camera.setCenter).toHaveBeenCalledWith(124, 80, expect.objectContaining({ duration: 0 }));
    expect(camera.fitView).toHaveBeenCalledWith(expect.objectContaining({ duration: 0 }));
  });

  it("uses zero-duration Knowledge camera movement under reduced motion", async () => {
    setMotionPreference(true);
    renderKnowledgeGraph(1);
    await flushGraphEffects();

    expect(camera.setCenter).toHaveBeenCalledWith(152, 116, expect.objectContaining({ duration: 0 }));
    expect(camera.fitView).toHaveBeenCalledWith(expect.objectContaining({ duration: 0 }));
  });

  it("keeps normal graph camera movement short and token-governed", async () => {
    setMotionPreference(false);
    renderSkillsGraph(1);
    await flushGraphEffects();

    expect(camera.setCenter).toHaveBeenCalledWith(124, 80, expect.objectContaining({ duration: 250 }));
    expect(camera.fitView).toHaveBeenCalledWith(expect.objectContaining({ duration: 250 }));

    cleanup();
    camera.setCenter.mockClear();
    camera.fitView.mockClear();
    renderKnowledgeGraph(2);
    await flushGraphEffects();

    expect(camera.setCenter).toHaveBeenCalledWith(152, 116, expect.objectContaining({ duration: 250 }));
    expect(camera.fitView).toHaveBeenCalledWith(expect.objectContaining({ duration: 250 }));
  });

  it("fails safely with zero-duration graph movement when the motion token is unavailable", async () => {
    setMotionPreference(false, "");
    renderSkillsGraph(3);
    await flushGraphEffects();

    expect(camera.setCenter).toHaveBeenCalledWith(124, 80, expect.objectContaining({ duration: 0 }));
    expect(camera.fitView).toHaveBeenCalledWith(expect.objectContaining({ duration: 0 }));
  });

  it("preserves static graph-edge presentation for Skill and Knowledge", () => {
    const skillEdges = toSkillFlowEdges([
      { id: "skill-edge", source: "skill-a", target: "skill-b", relation: "prerequisite" },
    ] as unknown as SkillFlowEdge[]);
    const knowledgeEdges = toKnowledgeFlowEdges([
      {
        id: "knowledge-edge",
        source: "knowledge-a",
        target: "knowledge-b",
        relationType: "supports",
        verificationStatus: "verified",
        isArchived: false,
        confidence: 0.9,
        sourceType: "user_created",
        sourceId: null,
        provenanceNote: null,
        verifiedAt: null,
        verifiedBy: null,
      },
    ] as unknown as KnowledgeGraphResponse["edges"]);

    expect(skillEdges.every((edge) => edge.animated === false)).toBe(true);
    expect(knowledgeEdges.every((edge) => edge.animated === false)).toBe(true);
  });

  it("keeps the global reduced-motion reset and page loading indicators paired", () => {
    const globals = fs.readFileSync(path.resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(globals).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globals).toContain("animation-duration: 0.01ms !important;");
    expect(globals).toContain("transition-duration: 0.01ms !important;");
    expect(globals).toContain("scroll-behavior: auto !important;");

    for (const relativePath of ["src/app/login/page.tsx", "src/app/artifacts/page.tsx"]) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
      const animatedLoaders = source.match(/animate-spin/g) ?? [];
      const reducedLoaders = source.match(/motion-reduce:animate-none/g) ?? [];
      expect(reducedLoaders.length, `${relativePath} loader motion contract`).toBeGreaterThanOrEqual(animatedLoaders.length);
    }
  });
});
