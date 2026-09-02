"use client";

import React from "react";
import {
  FileText,
  FolderGit2,
  PenTool,
  BarChart3,
  Presentation,
  StickyNote,
  Palette,
  Box,
  type LucideIcon,
} from "lucide-react";
import type { ArtifactType } from "@/types/artifact";

export interface ArtifactTypeBadgeProps {
  type: ArtifactType;
  showIcon?: boolean;
  className?: string;
}

export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  document: "文档",
  code_repository: "代码仓库",
  design_spec: "设计规范",
  data_analysis: "数据分析",
  presentation: "演示文稿",
  synthesis_note: "综合笔记",
  creative_work: "创意作品",
  other: "其他造物",
};

export const ARTIFACT_TYPE_ICONS: Record<ArtifactType, LucideIcon> = {
  document: FileText,
  code_repository: FolderGit2,
  design_spec: PenTool,
  data_analysis: BarChart3,
  presentation: Presentation,
  synthesis_note: StickyNote,
  creative_work: Palette,
  other: Box,
};

export function ArtifactTypeBadge({
  type,
  showIcon = true,
  className = "",
}: ArtifactTypeBadgeProps) {
  const label = ARTIFACT_TYPE_LABELS[type] || ARTIFACT_TYPE_LABELS.other;
  const Icon = ARTIFACT_TYPE_ICONS[type] || ARTIFACT_TYPE_ICONS.other;

  return (
    <span
      data-testid="artifact-type-badge"
      data-artifact-type={type}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-[var(--font-weight-medium)] bg-[var(--entity-artifact-bg)] border border-[var(--entity-artifact-border)] text-[var(--entity-artifact-text)] select-none ${className}`}
    >
      {showIcon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}
