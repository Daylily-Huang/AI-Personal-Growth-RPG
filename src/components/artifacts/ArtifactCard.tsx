"use client";

import React from "react";
import { RPGCard } from "@/components/ui/RPGCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ReusabilityMeter } from "@/components/ui/ReusabilityMeter";
import { ArtifactTypeBadge } from "./ArtifactTypeBadge";
import type { ArtifactWithCounts } from "@/types/artifact";
import { Sparkles, Network, Scroll, Zap, ShieldCheck } from "lucide-react";

export interface ArtifactCardProps {
  artifact: ArtifactWithCounts;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ArtifactCard({
  artifact,
  selected = false,
  onClick,
  className = "",
}: ArtifactCardProps) {
  const { counts } = artifact;

  return (
    <RPGCard
      entityType="artifact"
      selected={selected}
      onClick={onClick}
      data-testid={`artifact-card-${artifact.id}`}
      className={`flex flex-col justify-between gap-3 text-left transition-all ${className}`}
    >
      {/* 1. Header: Type Badge, Version, and Lifecycle Status */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ArtifactTypeBadge type={artifact.artifactType} />
          {artifact.version ? (
            <span
              data-testid="artifact-version"
              className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-mono text-[var(--text-muted)] bg-[var(--surface-hover-neutral)] border border-[var(--border-subtle)]"
            >
              v{artifact.version.replace(/^v/i, "")}
            </span>
          ) : null}
        </div>
        <StatusBadge
          type="artifactLifecycle"
          state={artifact.lifecycleStatus}
          className="shrink-0"
        />
      </div>

      {/* 2. Title & Summary Preview */}
      <div className="space-y-1.5 flex-1">
        <h3
          data-testid="artifact-title"
          className="font-serif font-[var(--font-weight-semibold)] text-base text-[var(--text-primary)] tracking-[var(--tracking-wide)] line-clamp-1"
        >
          {artifact.title}
        </h3>
        {artifact.summary ? (
          <p
            data-testid="artifact-summary-preview"
            className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2"
          >
            {artifact.summary}
          </p>
        ) : (
          <p className="text-xs text-[var(--text-muted)] italic">
            无摘要说明
          </p>
        )}
      </div>

      {/* 3. Reusability Meter */}
      <div className="pt-1">
        <ReusabilityMeter score={artifact.reusabilityScore} size="sm" />
      </div>

      {/* 4. Relationship Counts Footer */}
      {counts ? (
        <div
          data-testid="artifact-relation-counts"
          className="flex items-center gap-3 pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] flex-wrap"
        >
          {counts.skills > 0 && (
            <span className="flex items-center gap-1" title={`${counts.skills} 个关联技能`}>
              <Sparkles className="w-3 h-3 text-[var(--entity-skill-text)]" aria-hidden="true" />
              <span>{counts.skills} 技能</span>
            </span>
          )}
          {counts.knowledgeNodes > 0 && (
            <span className="flex items-center gap-1" title={`${counts.knowledgeNodes} 个关联知识节点`}>
              <Network className="w-3 h-3 text-[var(--entity-knowledge-text)]" aria-hidden="true" />
              <span>{counts.knowledgeNodes} 知识</span>
            </span>
          )}
          {counts.quests > 0 && (
            <span className="flex items-center gap-1" title={`${counts.quests} 个关联任务`}>
              <Scroll className="w-3 h-3 text-[var(--entity-quest-text)]" aria-hidden="true" />
              <span>{counts.quests} 任务</span>
            </span>
          )}
          {counts.activities > 0 && (
            <span className="flex items-center gap-1" title={`${counts.activities} 次活动产出/引用`}>
              <Zap className="w-3 h-3 text-[var(--entity-activity-text)]" aria-hidden="true" />
              <span>{counts.activities} 活动</span>
            </span>
          )}
          {counts.evidence > 0 && (
            <span className="flex items-center gap-1" title={`${counts.evidence} 项佐证实证`}>
              <ShieldCheck className="w-3 h-3 text-[var(--entity-evidence-text)]" aria-hidden="true" />
              <span>{counts.evidence} 实证</span>
            </span>
          )}
          {counts.skills === 0 &&
            counts.knowledgeNodes === 0 &&
            counts.quests === 0 &&
            counts.activities === 0 &&
            counts.evidence === 0 && (
              <span className="text-[var(--text-disabled)]">暂无关联项</span>
            )}
        </div>
      ) : null}
    </RPGCard>
  );
}
