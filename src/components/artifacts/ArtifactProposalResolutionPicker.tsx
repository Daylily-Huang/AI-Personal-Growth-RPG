"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ArtifactTypeBadge, ARTIFACT_TYPE_LABELS } from "./ArtifactTypeBadge";
import type {
  ArtifactProposal,
  ArtifactResolutionInput,
  ArtifactType,
} from "@/types/artifact";
import { PlusCircle, Link, EyeOff } from "lucide-react";

export interface ArtifactProposalResolutionPickerProps {
  proposals: ArtifactProposal[];
  onChange: (resolutions: ArtifactResolutionInput[], isValid: boolean) => void;
  className?: string;
}

interface ProposalState {
  resolution: "create" | "existing" | "ignore";
  titleOverride: string;
  typeOverride: ArtifactType;
  reusabilityOverride: number;
  existingArtifactId: string;
  activityRole: "modified" | "referenced";
}

const CANONICAL_TYPES: ArtifactType[] = [
  "document",
  "code_repository",
  "design_spec",
  "data_analysis",
  "presentation",
  "synthesis_note",
  "creative_work",
  "other",
];

export function ArtifactProposalResolutionPicker({
  proposals,
  onChange,
  className = "",
}: ArtifactProposalResolutionPickerProps) {
  // Store manual overrides keyed by proposalIndex
  const [overrides, setOverrides] = useState<Record<number, Partial<ProposalState>>>({});

  // Compute effective states
  const states: ProposalState[] = useMemo(() => {
    return proposals.map((p, idx) => {
      const ov = overrides[idx] || {};
      return {
        resolution: ov.resolution || "create",
        titleOverride: ov.titleOverride !== undefined ? ov.titleOverride : p.title || "",
        typeOverride: ov.typeOverride || p.artifactType || "document",
        reusabilityOverride: ov.reusabilityOverride !== undefined ? ov.reusabilityOverride : p.reusabilityScore ?? 0.8,
        existingArtifactId: ov.existingArtifactId || "",
        activityRole: ov.activityRole || "modified",
      };
    });
  }, [proposals, overrides]);

  // Compute resolutions and validity
  const { resolutions, isValid } = useMemo(() => {
    if (proposals.length === 0) {
      return { resolutions: [], isValid: true };
    }

    let allValid = true;
    const computedResolutions: ArtifactResolutionInput[] = states.map((s, idx) => {
      const original = proposals[idx];
      if (!original) return { proposalIndex: idx, resolution: "ignore" };

      if (s.resolution === "create") {
        const titleClean = s.titleOverride.trim() || original.title;
        if (!titleClean) allValid = false;

        return {
          proposalIndex: idx,
          resolution: "create",
          approvedOverrides: {
            title: titleClean,
            artifactType: s.typeOverride,
            reusabilityScore: Number(s.reusabilityOverride),
          },
        };
      } else if (s.resolution === "existing") {
        const artId = s.existingArtifactId.trim();
        if (!artId) allValid = false;

        return {
          proposalIndex: idx,
          resolution: "existing",
          artifactId: artId,
          activityRole: s.activityRole,
        };
      } else {
        return {
          proposalIndex: idx,
          resolution: "ignore",
        };
      }
    });

    return {
      resolutions: computedResolutions,
      isValid: allValid && computedResolutions.length === proposals.length,
    };
  }, [proposals, states]);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current(resolutions, isValid);
  }, [resolutions, isValid]);

  if (proposals.length === 0) return null;

  const updateState = (idx: number, updater: Partial<ProposalState>) => {
    setOverrides((prev) => ({
      ...prev,
      [idx]: {
        ...(prev[idx] || {}),
        ...updater,
      },
    }));
  };

  return (
    <div
      data-testid="artifact-proposal-resolution-picker"
      className={`space-y-4 text-left ${className}`}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-serif font-[var(--font-weight-semibold)] text-sm text-[var(--text-primary)]">
          AI 建议交付的造物提案 (共 {proposals.length} 项)
        </h4>
        <span className="text-[11px] text-[var(--text-muted)]">
          确认结算前需逐项选定处理方式
        </span>
      </div>

      <div className="space-y-3">
        {proposals.map((proposal, idx) => {
          const s = states[idx];

          return (
            <div
              key={idx}
              data-testid={`artifact-proposal-card-${idx}`}
              className="p-4 rounded-[var(--radius-lg)] bg-[var(--surface-base)] border border-[var(--border-default)] space-y-3"
            >
              {/* Proposal Header info */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-mono bg-[var(--surface-hover-neutral)] text-[var(--text-muted)]">
                      提案 #{idx + 1} (index: {idx})
                    </span>
                    <ArtifactTypeBadge type={proposal.artifactType} />
                  </div>
                  <div className="font-serif font-[var(--font-weight-semibold)] text-sm text-[var(--text-primary)]">
                    {proposal.title}
                  </div>
                  {proposal.summary ? (
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {proposal.summary}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Resolution Action Selector */}
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                <div className="text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)]">
                  结算处理方式:
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => updateState(idx, { resolution: "create" })}
                    data-testid={`proposal-${idx}-resolution-create`}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-[var(--radius-md)] text-xs font-[var(--font-weight-medium)] transition-colors cursor-pointer ${
                      s.resolution === "create"
                        ? "bg-[var(--gold-400)] text-[var(--text-inverse)] shadow-[var(--glow-gold-subtle)] font-[var(--font-weight-semibold)]"
                        : "bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>新建造物 (Create)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateState(idx, { resolution: "existing" })}
                    data-testid={`proposal-${idx}-resolution-existing`}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-[var(--radius-md)] text-xs font-[var(--font-weight-medium)] transition-colors cursor-pointer ${
                      s.resolution === "existing"
                        ? "bg-[var(--selection-neutral-bg)] text-[var(--selection-neutral-text)] border border-[var(--selection-neutral-border)] font-[var(--font-weight-semibold)]"
                        : "bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    <Link className="w-3.5 h-3.5 shrink-0" />
                    <span>关联已有 (Link)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateState(idx, { resolution: "ignore" })}
                    data-testid={`proposal-${idx}-resolution-ignore`}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-[var(--radius-md)] text-xs font-[var(--font-weight-medium)] transition-colors cursor-pointer ${
                      s.resolution === "ignore"
                        ? "bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-raised)] font-[var(--font-weight-semibold)]"
                        : "bg-[var(--surface-ground)] text-[var(--text-muted)] hover:bg-[var(--surface-hover-neutral)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    <span>忽略提案 (Ignore)</span>
                  </button>
                </div>

                {/* Sub-form: Create Resolution Overrides */}
                {s.resolution === "create" && (
                  <div
                    data-testid={`proposal-${idx}-create-subform`}
                    className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] space-y-2.5 text-xs"
                  >
                    <div className="space-y-1">
                      <label className="text-[var(--text-secondary)]">造物名称</label>
                      <input
                        type="text"
                        value={s.titleOverride}
                        onChange={(e) => updateState(idx, { titleOverride: e.target.value })}
                        data-testid={`proposal-${idx}-title-override`}
                        className="w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[var(--text-secondary)]">造物类型</label>
                        <select
                          value={s.typeOverride}
                          onChange={(e) => updateState(idx, { typeOverride: e.target.value as ArtifactType })}
                          data-testid={`proposal-${idx}-type-override`}
                          className="w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
                        >
                          {CANONICAL_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {ARTIFACT_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[var(--text-secondary)]">
                          可复用性: {Number(s.reusabilityOverride).toFixed(2)}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={s.reusabilityOverride}
                          onChange={(e) => updateState(idx, { reusabilityOverride: parseFloat(e.target.value) })}
                          data-testid={`proposal-${idx}-reusability-override`}
                          className="w-full cursor-pointer accent-[var(--entity-artifact-text)]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-form: Existing Resolution Picker */}
                {s.resolution === "existing" && (
                  <div
                    data-testid={`proposal-${idx}-existing-subform`}
                    className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] space-y-2.5 text-xs"
                  >
                    <div className="space-y-1">
                      <label className="text-[var(--text-secondary)]">已有造物 UUID (artifactId)</label>
                      <input
                        type="text"
                        value={s.existingArtifactId}
                        onChange={(e) => updateState(idx, { existingArtifactId: e.target.value })}
                        placeholder="输入已有造物 UUID"
                        data-testid={`proposal-${idx}-existing-artifact-id`}
                        className="w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-default)] font-mono text-[var(--text-primary)]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[var(--text-secondary)]">关联活动角色 (activityRole)</label>
                      <select
                        value={s.activityRole}
                        onChange={(e) =>
                          updateState(idx, {
                            activityRole: e.target.value as "modified" | "referenced",
                          })
                        }
                        data-testid={`proposal-${idx}-activity-role`}
                        className="w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer"
                      >
                        <option value="modified">modified (本次活动修改/迭代了该造物)</option>
                        <option value="referenced">referenced (本次活动引用/参考了该造物)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
