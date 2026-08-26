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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import KnowledgeNodeView, { type KnowledgeFlowNodeType } from "./KnowledgeNodeView";
import { getEdgeVisual } from "./presentation";
import type {
  KnowledgeRelationType,
  KnowledgeVerificationStatus,
  KnowledgeSourceType,
} from "@/lib/knowledge/types";

const NODE_TYPES = {
  knowledgeNode: KnowledgeNodeView,
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
    );

    let markerEnd: Edge["markerEnd"];
    if (visual.marker === "circle") {
      markerEnd = "url(#knowledge-marker-circle)";
    } else if (visual.marker === "lightning") {
      markerEnd = "url(#knowledge-marker-lightning)";
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
        fill: "#0b0f17",
        fillOpacity: 0.9,
        stroke: isSelected ? "#10b981" : visual.color,
        strokeWidth: isSelected ? 1.5 : 0.5,
      },
      labelStyle: {
        fill: isSelected ? "#34d399" : visual.color,
        fontSize: 9,
        fontWeight: isSelected ? 700 : 500,
      },
      animated: visual.animated,
      style: {
        stroke: isSelected ? "#10b981" : visual.color,
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
          <circle cx="5" cy="5" r="3.5" fill="#c084fc" />
        </marker>

        {/* Contradicts Lightning Marker */}
        <marker
          id="knowledge-marker-lightning"
          viewBox="0 0 12 12"
          refX="6"
          refY="6"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path
            d="M7 1L2 7h4l-1 5 6-7H7l1-4z"
            fill="#f43f5e"
            stroke="#9f1239"
            strokeWidth="0.5"
          />
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
            stroke="#f59e0b"
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
  rawEdges,
  selectedEdgeId,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
  focusTarget,
  fitKey,
}: {
  nodes: KnowledgeFlowNodeType[];
  rawEdges: RawGraphEdge[];
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
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
    void rf.setCenter(focusTarget.x + 100, focusTarget.y + 40, {
      zoom: 1.1,
      duration: 500,
    });
  }, [focusTarget, rf]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void rf.fitView({ padding: 0.25, duration: 400 });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [fitKey, rf]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodeClick={(_, node) => onSelectNode(node.id)}
      onEdgeClick={(_, edge) => onSelectEdge(edge.id)}
      onPaneClick={onClearSelection}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      minZoom={0.1}
      maxZoom={2.0}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      deleteKeyCode={null}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
      className="h-full w-full bg-[#0b0f17]"
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#334155" />
      <Controls position="bottom-right" showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        position="bottom-left"
        className="!bg-slate-900 !border !border-white/10"
        nodeColor={(n) => {
          const status = (n.data as { verificationStatus?: string }).verificationStatus;
          if (status === "verified") return "#0ea5e9";
          if (status === "inferred") return "#f59e0b";
          return "#71717a";
        }}
      />
    </ReactFlow>
  );
}

export interface KnowledgeGraphCanvasProps {
  nodes: KnowledgeFlowNodeType[];
  rawEdges: RawGraphEdge[];
  selectedEdgeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onSelectEdge: (edgeId: string) => void;
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
