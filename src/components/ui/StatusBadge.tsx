"use client";

import React, { forwardRef } from "react";
import {
  FileEdit,
  CheckCircle2,
  Archive,
  GitCompare,
  ShieldCheck,
  Sparkles,
  XCircle,
  ArrowUpRight,
} from "lucide-react";

export type ArtifactLifecycleState = "draft" | "active" | "archived" | "superseded";
export type KnowledgeAuthorityState = "verified" | "inferred" | "rejected" | "superseded";

export type StatusBadgeProps =
  | {
      type: "artifactLifecycle";
      state: ArtifactLifecycleState;
      size?: "sm" | "md";
      className?: string;
    }
  | {
      type: "knowledgeAuthority";
      state: KnowledgeAuthorityState;
      size?: "sm" | "md";
      className?: string;
    };

interface StatusConfig {
  label: string;
  classes: string;
  icon: React.ComponentType<{ className?: string }>;
}

const artifactLifecycleConfigs: Record<ArtifactLifecycleState, StatusConfig> = {
  draft: {
    label: "草稿",
    classes:
      "bg-[var(--status-draft-bg)] border-[var(--status-draft-border)] text-[var(--status-draft-text)]",
    icon: FileEdit,
  },
  active: {
    label: "生效中",
    classes:
      "bg-[var(--status-active-bg)] border-[var(--status-active-border)] text-[var(--status-active-text)]",
    icon: CheckCircle2,
  },
  archived: {
    label: "已归档",
    classes:
      "bg-[var(--status-archived-bg)] border-[var(--status-archived-border)] text-[var(--status-archived-text)]",
    icon: Archive,
  },
  superseded: {
    label: "已更替 (版本)",
    classes:
      "bg-[var(--status-superseded-bg)] border-[var(--status-superseded-border)] text-[var(--status-superseded-text)]",
    icon: GitCompare,
  },
};

const knowledgeAuthorityConfigs: Record<KnowledgeAuthorityState, StatusConfig> = {
  verified: {
    label: "已验证",
    classes:
      "bg-[var(--authority-verified-bg)] border-[var(--authority-verified-border)] text-[var(--authority-verified-text)]",
    icon: ShieldCheck,
  },
  inferred: {
    label: "AI推断",
    classes:
      "bg-[var(--authority-inferred-bg)] border-[var(--authority-inferred-border)] text-[var(--authority-inferred-text)] border-dashed",
    icon: Sparkles,
  },
  rejected: {
    label: "已驳回",
    classes:
      "bg-[var(--authority-rejected-bg)] border-[var(--authority-rejected-border)] text-[var(--authority-rejected-text)]",
    icon: XCircle,
  },
  superseded: {
    label: "已更替 (权威)",
    classes:
      "bg-[var(--authority-superseded-bg)] border-[var(--authority-superseded-border)] text-[var(--authority-superseded-text)]",
    icon: ArrowUpRight,
  },
};

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  (props, ref) => {
    const { type, state, size = "md", className = "" } = props;

    const config: StatusConfig =
      type === "artifactLifecycle"
        ? artifactLifecycleConfigs[state as ArtifactLifecycleState]
        : knowledgeAuthorityConfigs[state as KnowledgeAuthorityState];

    const Icon = config.icon;
    const sizeClasses =
      size === "sm"
        ? "px-1.5 py-0.5 text-[10px] gap-1"
        : "px-2 py-0.5 text-xs gap-1.5";

    return (
      <span
        ref={ref}
        data-testid="status-badge"
        data-namespace={type}
        data-state={state}
        aria-label={`${type === "artifactLifecycle" ? "造物生命周期" : "知识权威状态"}: ${config.label}`}
        title={config.label}
        className={`inline-flex items-center rounded-[var(--radius-sm)] border font-[var(--font-weight-medium)] select-none truncate ${config.classes} ${sizeClasses} ${className}`}
      >
        <Icon className="w-3 h-3 shrink-0" />
        <span data-testid="status-badge-label">{config.label}</span>
      </span>
    );
  }
);

StatusBadge.displayName = "StatusBadge";
