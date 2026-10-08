// @vitest-environment jsdom
// Actual pages, React effects, semantic node components and nearest-connected helpers.
// Canvas/network substitutes isolate orchestration; synthetic focus moves are NOT native-browser Tab evidence.
import React from "react";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SkillsPage from "@/app/skills/page";
import KnowledgeMapPage from "@/app/knowledge/page";
import type SkillGraphCanvas from "@/app/skills/components/SkillGraphCanvas";
import type { KnowledgeGraphCanvasProps } from "@/app/knowledge/components/KnowledgeGraphCanvas";
import type { SkillTreeGraphResponse } from "@/lib/store/types";
import type { KnowledgeGraphResponse } from "@/lib/knowledge/types";

type SkillGraphCanvasProps = React.ComponentProps<typeof SkillGraphCanvas>;

const { router, params } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }, params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => params }));
vi.mock("@xyflow/react", async original => ({ ...await original<typeof import("@xyflow/react")>(), Handle: () => null }));
vi.mock("@/app/skills/components/SkillGraphCanvas", async () => {
  const { default: NodeView } = await import("@/app/skills/components/SkillNode");
  return { default: (props: SkillGraphCanvasProps) => <div data-testid="focus-canvas">
    {props.nodes.map(node => <NodeView key={node.id} {...({ id: node.id, data: { ...node.data, onSelect: props.onSelect, onNavigate: props.onNavigate }, selected: false } as React.ComponentProps<typeof NodeView>)} />)}
  </div> };
});
vi.mock("@/app/knowledge/components/KnowledgeGraphCanvas", async () => {
  const { default: NodeView } = await import("@/app/knowledge/components/KnowledgeNodeView");
  return { default: (props: KnowledgeGraphCanvasProps) => <div data-testid="focus-canvas">
    {props.nodes.map(node => <NodeView key={node.id} {...({ id: node.id, data: { ...node.data, onSelect: props.onSelectNode, onNavigate: props.onNavigate }, selected: false } as React.ComponentProps<typeof NodeView>)} />)}
  </div> };
});
vi.mock("@/app/skills/components/SkillDetailPanel", () => ({ default: () => <div>Detail stub</div> }));
vi.mock("@/app/knowledge/components/KnowledgeDetailPanel", () => ({ default: () => <div>Detail stub</div> }));

const ids = ["a", "b", "c", "d"];
const skillGraph: SkillTreeGraphResponse = {
  domains: [], nodes: ids.map((id, i) => ({ id, domainId: null, position: { x: 0, y: i * 200 },
    data: { name: `Focus Skill ${id}`, aliases: [], level: 1, xp: 0, masteryLevel: 0, masteryConfidence: 0,
      derivedState: "available", lastUsedAt: null, prerequisiteCount: 0, unfulfilledPrerequisiteCount: 0 } })),
  edges: [["a", "b"], ["b", "c"], ["b", "d"]].map(([source, target], i) => ({ id: `s${i}`, source, target, relation: "supports" })),
};
const knowledgeGraph: KnowledgeGraphResponse = {
  domains: [], nodes: ids.map((id, i) => ({ id, title: `Focus Knowledge ${id}`, nodeType: "concept", domainId: null, domainName: null,
    skillId: null, skillName: null, verificationStatus: "verified", isArchived: false, confidence: 1,
    sourceType: "user_created", sourceId: null, inboundEdgeCount: 0, outboundEdgeCount: 0, position: { x: 0, y: i * 200 } })),
  edges: [["a", "c"], ["c", "d"], ["c", "b"]].map(([source, target], i) => ({ id: `k${i}`, source, target,
    relationType: "supports", verificationStatus: "verified", isArchived: false, confidence: 1,
    sourceType: "user_created", sourceId: null, provenanceNote: "Synthetic focus test", verifiedAt: null, verifiedBy: null })),
  stats: { totalNodes: 4, verifiedNodes: 4, inferredNodes: 0, totalEdges: 3, verifiedEdges: 3, inferredEdges: 0, isTruncated: false },
};
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, value: (media: string) => ({ matches: false, media, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("connected navigation creates a fresh focus request even for the same destination", () => {
  for (const route of ["skills", "knowledge"] as const) {
    const prefix = route === "skills" ? "skill" : "knowledge";
    async function mount() {
      const graph = route === "skills" ? skillGraph : knowledgeGraph;
      const snapshot = JSON.stringify(graph);
      const fetcher = vi.fn<(input: string | URL | Request) => Promise<Response>>(async () => new Response(JSON.stringify(graph), { status: 200 }));
      vi.stubGlobal("fetch", fetcher);
      render(route === "skills" ? <SkillsPage /> : <KnowledgeMapPage />);
      await screen.findByTestId("focus-canvas");
      return { graph, snapshot, fetcher, node: (id: string) => document.getElementById(`${prefix}-graph-node-${id}`)! };
    }
    test(`${route}: repeated destination survives an intervening external focus move`, async () => {
      const { graph, snapshot, fetcher, node } = await mount();
      const destination = route === "skills" ? "b" : "c";
      node("a").focus(); fireEvent.keyDown(node("a"), { key: "ArrowDown" });
      await waitFor(() => expect(document.activeElement).toBe(node(destination)));
      // jsdom has no browser Tab default; explicitly model the independently observed real Tab focus move.
      const other = route === "skills" ? "c" : "d", reverse = route === "skills" ? "ArrowUp" : "ArrowLeft";
      for (let i = 0; i < 3; i++) {
        node(other).focus(); expect(document.activeElement).toBe(node(other));
        fireEvent.keyDown(node(other), { key: reverse });
        await waitFor(() => expect(document.activeElement).toBe(node(destination)));
      }
      expect(JSON.stringify(graph)).toBe(snapshot);
      expect(fetcher.mock.calls.every(call => call.length === 1)).toBe(true);
    });
    test(`${route}: arrow without a directional connected neighbor leaves focus and facts alone`, async () => {
      const { graph, snapshot, node } = await mount();
      const leaf = route === "skills" ? "d" : "c";
      node(leaf).focus(); fireEvent.keyDown(node(leaf), { key: "ArrowDown" });
      expect(document.activeElement).toBe(node(leaf)); expect(JSON.stringify(graph)).toBe(snapshot);
    });
    test(`${route}: removing only the three admitted focus additions reconstructs accepted page`, () => {
      const file = `src/app/${route}/page.tsx`;
      const current = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
      const old = execFileSync("git", ["show", `f100d1fe10583d1b228e5ad23b0e9fded2730b25:${file}`], { encoding: "utf8" }).replace(/\r\n/g, "\n");
      expect(current.match(/const \[keyboardFocusNonce, setKeyboardFocusNonce\] = useState\(0\);/g)).toHaveLength(1);
      expect(current.match(/setKeyboardFocusNonce\(\(value\) => value \+ 1\);/g)).toHaveLength(1);
      expect(current.match(/keyboardFocusId, keyboardFocusNonce, viewMode/g)).toHaveLength(1);
      const restored = current.replace(/^  const \[keyboardFocusNonce, setKeyboardFocusNonce\] = useState\(0\);\n/m, "")
        .replace(/^      setKeyboardFocusNonce\(\(value\) => value \+ 1\);\n/m, "")
        .replace("keyboardFocusId, keyboardFocusNonce, viewMode", "keyboardFocusId, viewMode");
      expect(restored).toBe(old);
    });
  }
});
