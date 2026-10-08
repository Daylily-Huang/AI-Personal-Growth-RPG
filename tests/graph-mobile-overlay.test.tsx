// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { compile } from "tailwindcss";
import SkillGraphCanvas from "@/app/skills/components/SkillGraphCanvas";
import KnowledgeGraphCanvas from "@/app/knowledge/components/KnowledgeGraphCanvas";

const flow = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock("@/components/graph/useGraphCameraFit", () => ({ useGraphCameraFit: () => ({ current: null }) }));
vi.mock("@xyflow/react", () => ({
  BackgroundVariant: { Dots: "dots" }, MarkerType: { ArrowClosed: "arrowclosed" },
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReactFlow: () => ({ setCenter: vi.fn() }),
  ReactFlow: (props: Record<string, unknown> & { children: React.ReactNode }) => {
    flow.props.push(props); return <div>{props.children}</div>;
  },
  Background: () => null,
  Controls: (props: { position: string; showInteractive: boolean; className: string }) => (
    <div data-testid="controls" data-position={props.position} data-interactive={String(props.showInteractive)} className={props.className} />
  ),
  MiniMap: (props: { className: string; pannable: boolean; zoomable: boolean; position: string }) => (
    <div data-testid="minimap" className={props.className} data-pannable={String(props.pannable)} data-zoomable={String(props.zoomable)} data-position={props.position} />
  ),
}));

const select = vi.fn();
const canvases = [
  { name: "skills", file: "src/app/skills/components/SkillGraphCanvas.tsx", padding: .2, min: .15, max: 1.75,
    render: () => render(<SkillGraphCanvas nodes={[]} rawEdges={[]} onSelect={select} onNavigate={select} focusTarget={null} fitKey="test" />) },
  { name: "knowledge", file: "src/app/knowledge/components/KnowledgeGraphCanvas.tsx", padding: .25, min: .1, max: 2,
    render: () => render(<KnowledgeGraphCanvas nodes={[]} rawEdges={[]} selectedEdgeId={null} onSelectNode={select} onSelectEdge={select} onNavigate={select} onClearSelection={select} focusTarget={null} fitKey="test" />) },
];
beforeEach(() => { flow.props.length = 0; select.mockClear(); });
afterEach(cleanup);

describe("SiteReadiness04 mobile minimap classes and exact preservation (not browser visibility proof)", () => {
  for (const canvas of canvases) {
    test(`${canvas.name}: applies responsive visibility to the actual MiniMap prop`, () => {
      canvas.render();
      const map = screen.getByTestId("minimap");
      expect(map.classList.contains("hidden")).toBe(true);
      expect(map.classList.contains("md:block")).toBe(true);
      expect(map.dataset.pannable).toBe("true"); expect(map.dataset.zoomable).toBe("true");
      expect(map.dataset.position).toBe("bottom-left");
    });
    test(`${canvas.name}: retains ReactFlow, camera gates, manual Controls and read-only graph`, () => {
      canvas.render();
      const props = flow.props.at(-1)!;
      expect(props.fitView).toBeUndefined(); expect(props.fitViewOptions).toEqual({ padding: canvas.padding });
      expect(props.minZoom).toBe(canvas.min); expect(props.maxZoom).toBe(canvas.max);
      expect(props.nodesDraggable).toBe(false); expect(props.nodesConnectable).toBe(false);
      expect(props.deleteKeyCode).toBeNull(); expect(props.colorMode).toBe("light");
      const controls = screen.getByTestId("controls");
      expect(controls.dataset.position).toBe("bottom-right"); expect(controls.dataset.interactive).toBe("false");
      expect(select).not.toHaveBeenCalled();
    });
    test(`${canvas.name}: only the two CSS utilities differ from accepted production bytes`, () => {
      const baseline = execFileSync("git", ["show", `f100d1fe10583d1b228e5ad23b0e9fded2730b25:${canvas.file}`], { encoding: "utf8" }).replace(/\r\n/g, "\n");
      const current = readFileSync(canvas.file, "utf8").replace(/\r\n/g, "\n");
      expect(current.match(/hidden md:block /g)).toHaveLength(1);
      expect(current.replace('className="hidden md:block ', 'className="')).toBe(baseline);
    });
  }
  test("reuses the existing md authority and mobile-navigation breakpoint without changing globals", () => {
    const globals = readFileSync("src/app/globals.css", "utf8");
    expect(globals).toMatch(/--breakpoint-md:\s*48rem;/);
    expect(readFileSync("src/components/layout/MobileNav.tsx", "utf8")).toContain("md:hidden");
    const baseline = execFileSync("git", ["show", "f100d1fe10583d1b228e5ad23b0e9fded2730b25:src/app/globals.css"], { encoding: "utf8" });
    expect(globals.replace(/\r\n/g, "\n")).toBe(baseline.replace(/\r\n/g, "\n"));
  });
  test("installed Tailwind emits both display rules and a 48rem md query (not production CSS ordering proof)", async () => {
    const globals = readFileSync("src/app/globals.css", "utf8");
    const breakpoint = globals.match(/--breakpoint-md:\s*([^;]+);/)![1];
    const compiler = await compile(`@theme { --breakpoint-md: ${breakpoint}; } @tailwind utilities;`);
    const css = compiler.build(["hidden", "md:block"]);
    expect(css).toContain("display: none"); expect(css).toContain("display: block");
    expect(css).toContain(".md\\:block"); expect(css).toMatch(/@media\s*\(width\s*>=\s*48rem\)/);
  });
});
