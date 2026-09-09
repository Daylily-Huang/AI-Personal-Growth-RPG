// src/app/knowledge/components/KnowledgeGraphCanvas.tsx
// Stage 6C ReactFlow Knowledge Graph Canvas with 4-Channel Visuals

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
  type Node,
  type NodeProps,
} from "@xyflow/react";
import type { KnowledgeCluster } from "./canvas-layout";
import "@xyflow/react/dist/style.css";
import KnowledgeNodeView, { type KnowledgeFlowNodeType } from "./KnowledgeNodeView";
import { getEdgeVisual } from "./presentation";
import type {
  KnowledgeRelationType,
  KnowledgeVerificationStatus,
  KnowledgeSourceType,
} from "@/lib/knowledge/types";
import type { KnowledgeGraphDirection } from "./keyboard-navigation";

const NODE_TYPES = {
  knowledgeNode: KnowledgeNodeView,
  cluster: ({ data }: NodeProps<Node<{ label: string; count: number }, "cluster">>) => (
    <div className="h-full w-full rounded-[var(--radius-xl)] border border-dashed border-[var(--border-default)] bg-[var(--entity-knowledge-bg)] p-3 text-sm text-[var(--text-secondary)]">
      {data.label} <span className="font-mono">{data.count}</span>
    </div>
  ),
};

export interface RawGraphEdge {
  id: string;
  source: string;
  target: string;
  relationType: KnowledgeRelationType;
  verificationStatus: KnowledgeVerificationStatus;
  isArchived: boolean;
  confidence: number;
  sourceType: KnowledgeSourceType;
  sourceId: string | null;
  provenanceNote: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

/** Pure mapping from API edge items to ReactFlow Edge config, exported for tests */
export function toFlowEdges(
  edges: RawGraphEdge[],
  selectedEdgeId: string | null = null,
): Edge[] {
  return edges.map((edge) => {
    const visual = getEdgeVisual(
      edge.relationType,
      edge.verificationStatus,
      edge.confidence,
      edge.isArchived,
    );

    let markerEnd: Edge["markerEnd"];
    if (visual.marker === "circle") {
      markerEnd = "url(#knowledge-marker-circle)";
    } else if (visual.marker === "hollow-arrow") {
      markerEnd = "url(#knowledge-marker-hollow-arrow)";
    } else if (visual.marker === "none") {
      markerEnd = undefined;
    } else {
      markerEnd = {
        type: MarkerType.ArrowClosed,
        color: visual.color,
        width: 14,
        height: 14,
      };
    }

    const isSelected = selectedEdgeId === edge.id;

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: visual.label,
      labelShowBg: true,
      labelBgPadding: [4, 2] as [number, number],
      labelBgStyle: {
        fill: "var(--surface-raised)",
        fillOpacity: 0.9,
        stroke: isSelected ? "var(--selection-neutral-indicator)" : visual.color,
        strokeWidth: isSelected ? 1.5 : 0.5,
      },
      labelStyle: {
        fill: isSelected ? "var(--text-primary)" : visual.color,
        fontSize: 11,
        fontWeight: isSelected ? 700 : 500,
      },
      animated: visual.animated,
      style: {
        stroke: isSelected ? "var(--selection-neutral-indicator)" : visual.color,
        strokeWidth: isSelected ? 2.5 : 1.5,
        ...(visual.strokeDasharray ? { strokeDasharray: visual.strokeDasharray } : {}),
      },
      markerEnd,
    } satisfies Edge;
  });
}

function CustomEdgeMarkerDefs() {
  return (
    <svg aria-hidden="true" focusable="false" className="absolute h-0 w-0">
      <defs>
        {/* Contains Circle Marker */}
        <marker
          id="knowledge-marker-circle"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <circle cx="5" cy="5" r="3.5" fill="var(--entity-knowledge-text)" />
        </marker>

        {/* Hollow Arrow Marker for AI Inferred Relations */}
        <marker
          id="knowledge-marker-hollow-arrow"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <polygon
            points="0 1, 8 5, 0 9, 3 5"
            fill="none"
            stroke="var(--authority-inferred-text)"
            strokeWidth="1.5"
          />
        </marker>
      </defs>
    </svg>
  );
}

export interface CanvasFocusTarget {
  x: number;
  y: number;
  nonce: number;
}

function CanvasInner({
  nodes,
  clusters = [],
  rawEdges,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onNavigate,
  onClearSelection,
  focusTarget,
  fitKey,
}: {
  nodes: KnowledgeFlowNodeType[];
  clusters?: KnowledgeCluster[];
  rawEdges: RawGraphEdge[];
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onNavigate: (nodeId: string, direction: KnowledgeGraphDirection) => void;
  onClearSelection: () => void;
  focusTarget: CanvasFocusTarget | null;
  fitKey: string;
}) {
  const rf = useReactFlow();
  const edges = useMemo(
    () => toFlowEdges(rawEdges, selectedEdgeId),
    [rawEdges, selectedEdgeId],
  );

  useEffect(() => {
    if (!focusTarget) return;
    void rf.setCenter(focusTarget.x + 140, focusTarget.y + 92, {
      zoom: 1.1,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500,
    });
  }, [focusTarget, rf]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void rf.fitView({ padding: 0.25, duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 400 });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [fitKey, rf]);

  return (
    <>
      <style>{`.knowledge-graph-controls .react-flow__controls-button { min-height: var(--touch-target-min); min-width: var(--touch-target-min); }`}</style>
      <ReactFlow
      nodes={[
        ...clusters.map((cluster): Node => ({
          id: `cluster-${cluster.id}`, type: "cluster", position: { x: cluster.x, y: cluster.y },
          data: { label: cluster.label, count: cluster.count },
          style: { width: cluster.width, height: cluster.height, zIndex: "var(--z-bg-env)", pointerEvents: "none" },
          selectable: false, focusable: false, draggable: false,
        })),
         ...nodes.map((node) => ({
           ...node,
           // React Flow's wrapper must not compete with the semantic node control
           // below for keyboard focus; the custom node is the sole graph target.
           focusable: false,
           domAttributes: { tabIndex: -1, role: "presentation" },
           data: { ...node.data, onSelect: onSelectNode, onNavigate },
         })),
      ]}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodeClick={(_, node) => { if (node.type !== "cluster") onSelectNode(node.id); }}
      onEdgeClick={(_, edge) => onSelectEdge(edge.id)}
      onPaneClick={onClearSelection}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      minZoom={0.1}
      maxZoom={2.0}
      nodesDraggable={false}
      nodesFocusable={false}
      nodesConnectable={false}
      elementsSelectable
      deleteKeyCode={null}
      proOptions={{ hideAttribution: true }}
      colorMode="light"
      className="h-full w-full bg-[var(--surface-base)]"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border-default)" />
      <Controls
        position="bottom-right"
        showInteractive={false}
        className="knowledge-graph-controls !bg-[var(--surface-raised)] !border !border-[var(--border-subtle)] !rounded-[var(--radius-md)]"
      />
      <MiniMap
        pannable
        zoomable
        position="bottom-left"
        className="!bg-[var(--surface-raised)] !border !border-[var(--border-subtle)]"
        nodeColor={(n) => {
          const status = (n.data as { verificationStatus?: string }).verificationStatus;
          if (n.type === "cluster") return "var(--surface-ground)";
          if (status === "verified") return "var(--authority-verified-text)";
          if (status === "inferred") return "var(--authority-inferred-text)";
          return "var(--text-secondary)";
        }}
        maskColor="var(--surface-base)"
      />
      </ReactFlow>
    </>
  );
}

export interface KnowledgeGraphCanvasProps {
  nodes: KnowledgeFlowNodeType[];
  clusters?: KnowledgeCluster[];
  rawEdges: RawGraphEdge[];
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
  onNavigate: (nodeId: string, direction: KnowledgeGraphDirection) => void;
  onClearSelection: () => void;
  focusTarget: CanvasFocusTarget | null;
  fitKey: string;
}

export default function KnowledgeGraphCanvas(props: KnowledgeGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <CustomEdgeMarkerDefs />
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
