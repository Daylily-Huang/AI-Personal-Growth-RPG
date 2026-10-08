// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Node } from "@xyflow/react";
import { useGraphCameraFit } from "@/components/graph/useGraphCameraFit";

const flow = vi.hoisted(() => ({
  measurementsReady: true,
  width: 224,
  height: 112,
  missingIds: new Set<string>(),
  viewportInitialized: true,
  fitView: vi.fn(() => Promise.resolve(true)),
}));
vi.mock("@xyflow/react", () => ({
  useStore: (selector: (state: unknown) => unknown) => selector({
    nodesInitialized: false,
    nodeLookup: { get: (id: string) => !flow.measurementsReady || flow.missingIds.has(id) ? undefined : {
      measured: { width: flow.width, height: flow.height },
    } },
  }),
  useReactFlow: () => flow,
}));

const frames = new Map<number, FrameRequestCallback>();
let frameId = 0;
let width = 920;
let height = 875;
let reduced = false;
const observers: TestResizeObserver[] = [];
class TestResizeObserver {
  disconnected = false;
  target: Element | null = null;
  constructor(readonly callback: ResizeObserverCallback) { observers.push(this); }
  observe(target: Element) { this.target = target; }
  disconnect() { this.disconnected = true; }
  notify() { this.callback([], this as unknown as ResizeObserver); }
}
const duration = (isReduced: boolean) => isReduced ? 0 : 250;
const baseline: Node[] = [{ id: "a", position: { x: 12, y: 24 }, data: { xp: 0 } }];

function Canvas({ nodes = baseline, fitKey = "loaded", padding = 0.2 }: {
  nodes?: Node[]; fitKey?: string; padding?: number;
}) {
  const ref = useGraphCameraFit({ nodes, fitKey, padding, resolveDuration: duration });
  return <div ref={ref} data-testid="canvas" />;
}
function resize(nextWidth: number, nextHeight: number) {
  width = nextWidth; height = nextHeight;
  act(() => observers.filter((observer) => !observer.disconnected).forEach((observer) => observer.notify()));
}
async function flushFrame() {
  await act(async () => {
    const pending = [...frames.values()]; frames.clear();
    pending.forEach((callback) => callback(16));
    await Promise.resolve();
  });
}

beforeEach(() => {
  flow.measurementsReady = true; flow.width = 224; flow.height = 112; flow.missingIds.clear();
  flow.viewportInitialized = true; flow.fitView.mockClear();
  frames.clear(); observers.length = 0; frameId = 0; width = 920; height = 875; reduced = false;
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++frameId; frames.set(id, callback); return id;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => { frames.delete(id); });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, width, height, toJSON: () => ({}),
  }));
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("measured graph camera readiness and container resize", () => {
  it("waits for actual node measurements instead of a fixed timer", async () => {
    flow.measurementsReady = false;
    const view = render(<Canvas />);
    await flushFrame(); expect(flow.fitView).not.toHaveBeenCalled();
    flow.measurementsReady = true; view.rerender(<Canvas />);
    expect(flow.fitView).not.toHaveBeenCalled();
    await flushFrame();
    expect(flow.fitView).toHaveBeenCalledExactlyOnceWith({ padding: 0.2, duration: 250 });
  });
  it("waits for the actual viewport to initialize", async () => {
    flow.viewportInitialized = false;
    const view = render(<Canvas />);
    await flushFrame(); expect(flow.fitView).not.toHaveBeenCalled();
    flow.viewportInitialized = true; view.rerender(<Canvas />);
    await flushFrame(); expect(flow.fitView).toHaveBeenCalledTimes(1);
  });
  it("uses actual measured sizes even when the installed library flag stays false", async () => {
    render(<Canvas />); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(1);
  });
  it("waits for every visible node and fits after a delayed new node measurement", async () => {
    const view = render(<Canvas />); await flushFrame();
    flow.missingIds.add("b");
    const nodes = [...baseline, { id: "b", position: { x: 0, y: 1000 }, data: {} }];
    view.rerender(<Canvas nodes={nodes} />); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(1);
    flow.missingIds.clear(); view.rerender(<Canvas nodes={nodes} />); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(2);
  });
  it("does not reset a manually moved camera after same-size selection remeasurement", async () => {
    const view = render(<Canvas />); await flushFrame();
    flow.measurementsReady = false; view.rerender(<Canvas />); await flushFrame();
    flow.measurementsReady = true; view.rerender(<Canvas />); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(1);
  });
  it("refits when real node dimensions change, but never fits zero node dimensions", async () => {
    const view = render(<Canvas />); await flushFrame();
    flow.width = 0; view.rerender(<Canvas />); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(1);
    flow.width = 300; view.rerender(<Canvas />); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(2);
  });
  it("observes the actual canvas and refits desktop-to-mobile-to-desktop", async () => {
    const view = render(<Canvas />); await flushFrame();
    expect(observers[0].target).toBe(view.getByTestId("canvas"));
    resize(390, 590); await flushFrame();
    resize(920, 875); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(3);
  });
  it("refits on canvas height changes without relying on a window resize", async () => {
    render(<Canvas />); await flushFrame();
    resize(920, 498); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(2);
  });
  it("coalesces resize bursts and reads the final measured size on the next frame", async () => {
    render(<Canvas />); await flushFrame();
    resize(800, 700); resize(500, 650); resize(390, 590);
    expect(frames.size).toBe(1); expect(flow.fitView).toHaveBeenCalledTimes(1);
    await flushFrame(); expect(flow.fitView).toHaveBeenCalledTimes(2);
  });
  it("does not undo manual pan/zoom on unchanged observer notifications or selection data", async () => {
    const view = render(<Canvas />); await flushFrame();
    resize(920, 875); await flushFrame();
    view.rerender(<Canvas nodes={[{ ...baseline[0], data: { xp: 0, selected: true, onSelect: () => {} } }]} />);
    await flushFrame(); expect(flow.fitView).toHaveBeenCalledTimes(1);
  });
  it("fits new nodes even when the Skills loaded fitKey stays unchanged", async () => {
    const view = render(<Canvas />); await flushFrame();
    view.rerender(<Canvas nodes={[...baseline, { id: "b", position: { x: 0, y: 1000 }, data: {} }]} />);
    await flushFrame(); expect(flow.fitView).toHaveBeenCalledTimes(2);
  });
  it("fits a new layout/filter and preserves the Knowledge padding", async () => {
    const view = render(<Canvas padding={0.25} />); await flushFrame();
    view.rerender(<Canvas padding={0.25} fitKey="filtered" />); await flushFrame();
    view.rerender(<Canvas padding={0.25} fitKey="filtered" nodes={[{ ...baseline[0], position: { x: 680, y: 100 } }]} />);
    await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(3);
    expect(flow.fitView).toHaveBeenLastCalledWith({ padding: 0.25, duration: 250 });
  });
  it("includes cluster width/height and visibility in the layout key", async () => {
    const node = { ...baseline[0], width: 640, height: 280 };
    const anchor = { id: "anchor", position: { x: 680, y: 0 }, data: {} };
    const view = render(<Canvas nodes={[node, anchor]} />); await flushFrame();
    view.rerender(<Canvas nodes={[{ ...node, height: 904 }, anchor]} />); await flushFrame();
    view.rerender(<Canvas nodes={[{ ...node, height: 904, hidden: true }, anchor]} />); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(3);
  });
  it("does not fit an all-hidden graph or negative/nonfinite measured sizes", async () => {
    const view = render(<Canvas nodes={[{ ...baseline[0], hidden: true }]} />); await flushFrame();
    expect(flow.fitView).not.toHaveBeenCalled();
    for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      flow.width = invalid; view.rerender(<Canvas />); await flushFrame();
      expect(flow.fitView).not.toHaveBeenCalled();
    }
    flow.width = 224; view.rerender(<Canvas />); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(1);
  });
  it("does not fit a zero-sized canvas and fits it once it becomes visible", async () => {
    width = 0; height = 0;
    render(<Canvas />); await flushFrame(); expect(flow.fitView).not.toHaveBeenCalled();
    resize(390, 590); await flushFrame(); expect(flow.fitView).toHaveBeenCalledTimes(1);
    resize(0, 0); await flushFrame();
    resize(390, 590); await flushFrame(); expect(flow.fitView).toHaveBeenCalledTimes(2);
  });
  it("handles an empty graph and repopulation without reusing a stale fit", async () => {
    const view = render(<Canvas />); await flushFrame();
    view.rerender(<Canvas nodes={[]} />); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(1);
    view.rerender(<Canvas />); await flushFrame(); expect(flow.fitView).toHaveBeenCalledTimes(2);
  });
  it("refits after visible nodes become all hidden and the same graph returns", async () => {
    const view = render(<Canvas />); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(1);
    view.rerender(<Canvas nodes={baseline.map((node) => ({ ...node, hidden: true }))} />);
    await flushFrame(); expect(flow.fitView).toHaveBeenCalledTimes(1);
    view.rerender(<Canvas />); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(2);
  });
  it("reads reduced motion at the actual fit frame, including on resize", async () => {
    render(<Canvas />); reduced = true; await flushFrame();
    expect(flow.fitView).toHaveBeenLastCalledWith({ padding: 0.2, duration: 0 });
    reduced = false; resize(390, 590); reduced = true; await flushFrame();
    expect(flow.fitView).toHaveBeenLastCalledWith({ padding: 0.2, duration: 0 });
  });
  it("cancels stale layout frames and disconnects on unmount", async () => {
    const view = render(<Canvas />);
    view.rerender(<Canvas fitKey="new-layout" />);
    expect(observers[0].disconnected).toBe(true); expect(frames.size).toBe(1);
    view.unmount(); expect(frames.size).toBe(0);
    // A late observer delivery cannot fit a disposed canvas.
    act(() => observers.forEach((observer) => observer.notify())); await flushFrame();
    expect(flow.fitView).not.toHaveBeenCalled();
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
  });
  it("fits once with React StrictMode setup/cleanup replay", async () => {
    render(<React.StrictMode><Canvas /></React.StrictMode>); await flushFrame();
    expect(flow.fitView).toHaveBeenCalledTimes(1);
  });
});
