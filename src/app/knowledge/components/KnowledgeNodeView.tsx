// src/app/knowledge/components/KnowledgeNodeView.tsx
// Stage 6C Custom ReactFlow Node View with 4-Channel Epistemic Encoding

import { RPGCard } from "@/components/ui/RPGCard";
import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import {
  CheckCircle2,
  Sparkles,
  Archive,
  BookOpen,
  Quote,
  FolderTree,
  HelpCircle,
  XCircle,
} from "lucide-react";
import type {
  KnowledgeNodeType,
  KnowledgeVerificationStatus,
  KnowledgeSourceType,
} from "@/lib/knowledge/types";
import {
  getAuthorityVisual,
  getNodeTypeVisual,
} from "./presentation";

export interface KnowledgeNodeData extends Record<string, unknown> {
  id: string;
  title: string;
  nodeType: KnowledgeNodeType;
  domainId: string | null;
  domainName: string | null;
  skillId: string | null;
  skillName: string | null;
  verificationStatus: KnowledgeVerificationStatus;
  isArchived: boolean;
  confidence: number;
  sourceType: KnowledgeSourceType;
  sourceId: string | null;
  inboundEdgeCount: number;
  outboundEdgeCount: number;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export type KnowledgeFlowNodeType = Node<KnowledgeNodeData, "knowledgeNode">;

function KnowledgeNodeView({ data, selected }: NodeProps<KnowledgeFlowNodeType>) {
  const authority = getAuthorityVisual(
    data.verificationStatus,
    data.isArchived,
    data.confidence,
  );
  const typeVisual = getNodeTypeVisual(data.nodeType);

  const isSelected = selected || data.isSelected;

  return (
    <RPGCard
      entityType="knowledge"
      selected={Boolean(isSelected)}
      onClick={data.onSelect ? (event) => { event.stopPropagation(); data.onSelect?.(data.id); } : undefined}
      aria-label={`${data.title} · ${authority.label}`}
      data-testid={`knowledge-node-${data.id}`}
      data-node-type={data.nodeType}
      data-authority-status={data.verificationStatus}
      data-is-archived={data.isArchived ? "true" : "false"}
      className={`relative w-[280px] h-[184px] overflow-hidden select-none p-3 transition-colors duration-[var(--duration-fast)] motion-reduce:transition-none ${typeVisual.shapeClass} ${authority.borderClass} ${authority.bgClass} ${
        isSelected
          ? "ring-2 ring-[var(--focus-ring-color)] ring-offset-2 ring-offset-[var(--surface-ground)] shadow-lg shadow-[var(--shadow-card)]"
          : "hover:border-[var(--border-subtle)] shadow-md"
      }`}
    >
      {/* Top and Bottom Connection Handles for Graph Edges */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-[var(--border-subtle)] !bg-[var(--surface-raised)]"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-[var(--border-subtle)] !bg-[var(--surface-raised)]"
      />

      {/* Header: Entity Type & 4-Channel Authority Badge */}
      <div className="flex items-center justify-between gap-1.5 pb-2">
        <div
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${typeVisual.headerBgClass}`}
        >
          {data.nodeType === "concept" && <BookOpen className="h-3 w-3" aria-hidden="true" />}
          {data.nodeType === "claim" && <Quote className="h-3 w-3" aria-hidden="true" />}
          {data.nodeType === "topic" && <FolderTree className="h-3 w-3" aria-hidden="true" />}
          <span>{typeVisual.label}</span>
        </div>

        {/* 4-Channel Epistemic Authority Badge */}
        <div
          data-testid={`authority-badge-${data.id}`}
          className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide ${authority.badgeClass}`}
        >
          {authority.iconName === "CheckCircle2" && (
            <CheckCircle2 className="h-2.5 w-2.5 text-[var(--authority-verified-text)]" aria-hidden="true" />
          )}
          {authority.iconName === "Sparkles" && (
            <Sparkles className="h-2.5 w-2.5 text-[var(--authority-inferred-text)]" aria-hidden="true" />
          )}
          {authority.iconName === "Archive" && (
            <Archive className="h-2.5 w-2.5 text-[var(--text-secondary)]" aria-hidden="true" />
          )}
          {authority.iconName === "XCircle" && (
            <XCircle className="h-2.5 w-2.5 text-[var(--state-danger-text)]" aria-hidden="true" />
          )}
          {authority.iconName === "HelpCircle" && (
            <HelpCircle className="h-2.5 w-2.5 text-[var(--text-secondary)]" aria-hidden="true" />
          )}
          <span>{authority.label}</span>
        </div>
      </div>

      {/* Node Title */}
      {data.isArchived && <span className="text-[10px] text-[var(--text-secondary)]">{data.verificationStatus.toUpperCase()}</span>}
      <div className="text-xs font-semibold leading-snug text-[var(--text-primary)] line-clamp-2">
        {data.title}
      </div>

      {/* Footer Meta: Domain & Linked Skill Tags */}
      <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
        {data.domainName && (
          <span className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[var(--entity-knowledge-text)] border border-[var(--border-subtle)]">
            {data.domainName}
          </span>
        )}
        {data.skillName && (
          <span className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[var(--authority-verified-text)] border border-[var(--border-subtle)]">
            {data.skillName}
          </span>
        )}
      </div>

      {/* Subtle In/Out Degree Indicator */}
      {(data.inboundEdgeCount > 0 || data.outboundEdgeCount > 0) && (
        <div className="mt-1.5 text-[9px] text-[var(--text-secondary)] flex items-center justify-between">
          <span>入: {data.inboundEdgeCount}</span>
          <span>出: {data.outboundEdgeCount}</span>
        </div>
      )}
    </RPGCard>
  );
}

export default memo(KnowledgeNodeView);
