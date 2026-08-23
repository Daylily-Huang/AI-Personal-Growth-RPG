"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { SkillFlowEdge } from "@/lib/store/types";
import SkillNodeView, { type SkillFlowNodeType } from "./SkillNode";
import { getRelationVisual } from "./presentation";

const NODE_TYPES = { skillNode: SkillNodeView };

function toFlowEdges(edges: SkillFlowEdge[]): Edge[] {
  return edges.map((edge, index) => {
    const visual = getRelationVisual(edge.relation);
    // MarkerType in @xyflow/react v12 only ships Arrow/ArrowClosed; the frozen
    // UI spec requires a circle marker for `contains`, so we reference the
    // custom SVG marker rendered by <ContainsCircleMarkerDefs /> below.
    const markerEnd: Edge["markerEnd"] =
      visual.marker === "arrow"
        ? { type: MarkerType.ArrowClosed, color: visual.color, width: 16, height: 16 }
        : visual.marker === "circle"
          ? "url(#skill-edge-contains-circle)"
          : undefined;
    return {
      id: edge.id || `${edge.source}-${edge.target}-${edge.relation}-${index}`,
      source: edge.source,
      target: edge.target,
      label: visual.label,
      labelShowBg: true,
      labelBgPadding: [4, 1] as [number, number],
      labelBgStyle: { fill: "#0b0f17", fillOpacity: 0.85 },
      labelStyle: { fill: visual.color, fontSize: 10 },
      animated: visual.animated,
      style: {
        stroke: visual.color,
        strokeWidth: 1.5,
        ...(visual.strokeDasharray ? { strokeDasharray: visual.strokeDasharray } : {}),
      },
      markerEnd,
    } satisfies Edge;
  });
}

/** Custom marker defs for relation visuals not covered by MarkerType. */
function ContainsCircleMarkerDefs() {
  return (
    <svg aria-hidden="true" focusable="false" className="absolute h-0 w-0">
      <defs>
        <marker
          id="skill-edge-contains-circle"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <circle cx="5" cy="5" r="3" fill="#a855f7" />
        </marker>
      </defs>
    </svg>
  );
}

export interface CanvasFocusTarget {
  x: number;
  y: number;
  /** changing nonce re-triggers the camera animation */
  nonce: number;
}

function CanvasInner({
  nodes,
  rawEdges,
  onSelect,
  focusTarget,
  fitKey,
}: {
  nodes: SkillFlowNodeType[];
  rawEdges: SkillFlowEdge[];
  onSelect: (skillId: string | null) => void;
  focusTarget: CanvasFocusTarget | null;
  fitKey: string;
}) {
  const rf = useReactFlow();
  const edges = useMemo(() => toFlowEdges(rawEdges), [rawEdges]);

  useEffect(() => {
    if (!focusTarget) return;
    void rf.setCenter(focusTarget.x + 112, focusTarget.y + 56, {
      zoom: 1.15,
      duration: 600,
    });
  }, [focusTarget, rf]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void rf.fitView({ padding: 0.2, duration: 450 });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [fitKey, rf]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.15}
      maxZoom={1.75}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      deleteKeyCode={null}
      proOptions={{ hideAttribution: false }}
      colorMode="dark"
      className="h-full w-full"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
      <Controls position="bottom-right" showInteractive={false} />
      <MiniMap pannable zoomable position="bottom-left" className="!bg-slate-900" />
    </ReactFlow>
  );
}

export default function SkillGraphCanvas(props: {
  nodes: SkillFlowNodeType[];
  rawEdges: SkillFlowEdge[];
  onSelect: (skillId: string | null) => void;
  focusTarget: CanvasFocusTarget | null;
  fitKey: string;
}) {
  return (
    <ReactFlowProvider>
      <ContainsCircleMarkerDefs />
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
