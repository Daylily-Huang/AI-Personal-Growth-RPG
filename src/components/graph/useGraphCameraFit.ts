"use client";

import { useEffect, useRef } from "react";
import { useReactFlow, useStore, type Node } from "@xyflow/react";

/** Fit only for measured graph/layout changes or a real canvas resize, not pan/selection. */
export function useGraphCameraFit({
  nodes,
  fitKey,
  padding,
  resolveDuration,
}: {
  nodes: Node[];
  fitKey: string;
  padding: number;
  resolveDuration: (reducedMotion: boolean) => number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFit = useRef<string | null>(null);
  // In 12.11.3 a controlled read-only graph's nodesInitialized flag can remain
  // false after DOM measurement. Subscribe to measured sizes, without writing nodes.
  const measuredKey = useStore((state) => {
    const sizes: [string, number, number][] = [];
    for (const node of nodes) {
      if (node.hidden) continue;
      const measured = state.nodeLookup.get(node.id)?.measured;
      if (!measured || !Number.isFinite(measured.width) || !Number.isFinite(measured.height)
        || !measured.width || measured.width < 0 || !measured.height || measured.height < 0) return null;
      sizes.push([node.id, measured.width, measured.height]);
    }
    return sizes.length ? JSON.stringify(sizes) : null;
  });
  const { fitView, viewportInitialized } = useReactFlow();
  const hasVisibleNodes = nodes.some((node) => !node.hidden);
  // Node callbacks/data identities change on selection; they must not reset the camera.
  const layoutKey = JSON.stringify(nodes.map((node) => [
    node.id, node.position.x, node.position.y, node.hidden === true,
    node.width, node.height, node.style?.width, node.style?.height,
  ]));

  useEffect(() => {
    const container = containerRef.current;
    if (!hasVisibleNodes) {
      lastFit.current = null;
      return;
    }
    if (!container || !measuredKey || !viewportInitialized) return;

    let frame: number | null = null;
    let disposed = false;
    const schedule = () => {
      if (disposed) return;
      if (frame !== null) window.cancelAnimationFrame(frame);
      // React Flow's own observer updates its dimensions first; fit on the next frame.
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (disposed) return;
        const { width, height } = container.getBoundingClientRect();
        if (width <= 0 || height <= 0) {
          lastFit.current = null;
          return;
        }
        const key = JSON.stringify([fitKey, layoutKey, measuredKey, width, height, padding]);
        if (lastFit.current === key) return;
        lastFit.current = key;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        void fitView({ padding, duration: resolveDuration(reducedMotion) });
      });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    schedule();
    return () => {
      disposed = true;
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [fitKey, layoutKey, measuredKey, hasVisibleNodes, viewportInitialized, fitView, padding, resolveDuration]);

  return containerRef;
}
