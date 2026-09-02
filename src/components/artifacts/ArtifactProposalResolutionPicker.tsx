"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ArtifactTypeBadge, ARTIFACT_TYPE_LABELS } from "./ArtifactTypeBadge";
import type {
  ArtifactProposal,
  ArtifactResolutionInput,
  ArtifactType,
  ArtifactWithCounts,
} from "@/types/artifact";
import { PlusCircle, Link as LinkIcon, EyeOff, Search, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export interface ArtifactProposalResolutionPickerProps {
  proposals: ArtifactProposal[];
  onChange: (resolutions: ArtifactResolutionInput[], isValid: boolean) => void;
  className?: string;
}

interface ProposalItemState {
  resolution: "create" | "existing" | "ignore" | null;
  titleOverride: string;
  typeOverride: ArtifactType;
  reusabilityOverride: number;
  existingArtifactId: string;
  selectedArtifactTitle?: string;
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

const RFC_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return RFC_UUID_REGEX.test(id.trim());
}

export function ArtifactProposalResolutionPicker({
  proposals,
  onChange,
  className = "",
}: ArtifactProposalResolutionPickerProps) {
  // Store manual overrides keyed by proposalIndex (initial resolution = null)
  const [overrides, setOverrides] = useState<Record<number, Partial<ProposalItemState>>>({});

  // Search state for Existing artifact lookup
  const [existingSearchQueries, setExistingSearchQueries] = useState<Record<number, string>>({});
  const [existingSearchResults, setExistingSearchResults] = useState<Record<number, ArtifactWithCounts[]>>({});
  const [isSearchingExisting, setIsSearchingExisting] = useState<Record<number, boolean>>({});

  // Ref-based state machine for timers, abort controllers, and sequence guards
  const timersRef = useRef<Record<number, NodeJS.Timeout>>({});
  const abortControllersRef = useRef<Record<number, AbortController>>({});
  const searchSeqRef = useRef<Record<number, number>>({});

  // Cleanup on unmount
  useEffect(() => {
    const currentTimers = timersRef.current;
    const currentControllers = abortControllersRef.current;
    return () => {
      Object.values(currentTimers).forEach((timer) => clearTimeout(timer));
      Object.values(currentControllers).forEach((ctrl) => ctrl.abort());
    };
  }, []);

  // Compute effective states (initial resolution is null unless user selected one)
  const states: ProposalItemState[] = useMemo(() => {
    return proposals.map((p, idx) => {
      const ov = overrides[idx] || {};
      return {
        resolution: ov.resolution !== undefined ? ov.resolution : null,
        titleOverride: ov.titleOverride !== undefined ? ov.titleOverride : p.title || "",
        typeOverride: ov.typeOverride || p.artifactType || "document",
        reusabilityOverride: ov.reusabilityOverride !== undefined ? ov.reusabilityOverride : p.reusabilityScore ?? 0.8,
        existingArtifactId: ov.existingArtifactId || "",
        selectedArtifactTitle: ov.selectedArtifactTitle,
        activityRole: ov.activityRole || "modified",
      };
    });
  }, [proposals, overrides]);

  // Compute resolutions and validity strictly based on explicit N-of-N resolution & UUID validation
  const { resolutions, isValid } = useMemo(() => {
    if (proposals.length === 0) {
      return { resolutions: [], isValid: true };
    }

    let allValid = true;
    const computedResolutions: ArtifactResolutionInput[] = [];

    for (let idx = 0; idx < proposals.length; idx++) {
      const original = proposals[idx];
      const s = states[idx];
      if (!s || s.resolution === null) {
        allValid = false;
        continue;
      }

      if (s.resolution === "create") {
        const titleClean = s.titleOverride.trim() || original.title;
        if (!titleClean) allValid = false;

        computedResolutions.push({
          proposalIndex: idx,
          resolution: "create",
          approvedOverrides: {
            title: titleClean,
            artifactType: s.typeOverride,
            reusabilityScore: Number(s.reusabilityOverride),
          },
        });
      } else if (s.resolution === "existing") {
        const artId = s.existingArtifactId.trim();
        // Strict RFC UUID check
        if (!isValidUuid(artId)) {
          allValid = false;
        }

        computedResolutions.push({
          proposalIndex: idx,
          resolution: "existing",
          artifactId: artId,
          activityRole: s.activityRole,
        });
      } else if (s.resolution === "ignore") {
        computedResolutions.push({
          proposalIndex: idx,
          resolution: "ignore",
        });
      }
    }

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

  // Existing Artifact Search with Ref-based Timer, AbortController, and Sequence Guard
  const handleExistingSearch = useCallback((idx: number, query: string) => {
    setExistingSearchQueries((prev) => ({ ...prev, [idx]: query }));

    // 1. Clear previous timer for this index
    if (timersRef.current[idx]) {
      clearTimeout(timersRef.current[idx]);
    }

    // 2. Abort previous in-flight request for this index
    if (abortControllersRef.current[idx]) {
      abortControllersRef.current[idx].abort();
    }

    if (!query.trim()) {
      setExistingSearchResults((prev) => ({ ...prev, [idx]: [] }));
      setIsSearchingExisting((prev) => ({ ...prev, [idx]: false }));
      return;
    }

    const currentSeq = (searchSeqRef.current[idx] || 0) + 1;
    searchSeqRef.current[idx] = currentSeq;

    const controller = new AbortController();
    abortControllersRef.current[idx] = controller;
    setIsSearchingExisting((prev) => ({ ...prev, [idx]: true }));

    timersRef.current[idx] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/artifacts?status=all&search=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          // Sequence guard: only accept result if it is still the latest request
          if (searchSeqRef.current[idx] === currentSeq) {
            setExistingSearchResults((prev) => ({ ...prev, [idx]: data.artifacts || [] }));
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
      } finally {
        if (searchSeqRef.current[idx] === currentSeq) {
          setIsSearchingExisting((prev) => ({ ...prev, [idx]: false }));
        }
      }
    }, 300);
  }, []);

  if (proposals.length === 0) return null;

  const updateState = (idx: number, updater: Partial<ProposalItemState>) => {
    setOverrides((prev) => ({
      ...prev,
      [idx]: {
        ...(prev[idx] || {}),
        ...updater,
      },
    }));
  };

  const allResolvedCount = states.filter((s) => s.resolution !== null).length;

  return (
    <div
      data-testid="artifact-proposal-resolution-picker"
      className={`space-y-4 text-left ${className}`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="space-y-0.5">
          <h4 className="font-serif font-[var(--font-weight-semibold)] text-sm text-[var(--text-primary)]">
            AI 建议交付的造物提案 (共 {proposals.length} 项)
          </h4>
          <p className="text-xs text-[var(--text-muted)]">
            确认结算前需逐项明确选定处理方式 ({allResolvedCount}/{proposals.length} 已选定)
          </p>
        </div>
        {!isValid && (
          <span
            data-testid="unresolved-proposals-warning"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] text-xs text-[var(--state-warning-text)] bg-[var(--state-warning-bg)] border border-[var(--state-warning-border)]"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>需完成全部 {proposals.length} 项有效选择后方可结算</span>
          </span>
        )}
      </div>

      <div className="space-y-3">
        {proposals.map((proposal, idx) => {
          const s = states[idx];
          const isResolved = s.resolution !== null;
          const isExistingInvalid = s.resolution === "existing" && s.existingArtifactId.trim() !== "" && !isValidUuid(s.existingArtifactId);

          return (
            <div
              key={idx}
              data-testid={`artifact-proposal-card-${idx}`}
              data-resolved={isResolved ? "true" : "false"}
              className={`p-4 rounded-[var(--radius-lg)] bg-[var(--surface-base)] border transition-colors space-y-3 ${
                !isResolved
                  ? "border-[var(--state-warning-border)] bg-[var(--state-warning-bg)]/20"
                  : "border-[var(--border-default)]"
              }`}
            >
              {/* Proposal Header */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono bg-[var(--surface-hover-neutral)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                      提案 #{idx + 1} (index: {idx})
                    </span>
                    <ArtifactTypeBadge type={proposal.artifactType} />
                  </div>
                  <div className="font-serif font-[var(--font-weight-semibold)] text-sm text-[var(--text-primary)]">
                    {proposal.title}
                  </div>
                  {proposal.summary && (
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {proposal.summary}
                    </p>
                  )}
                </div>

                {!isResolved ? (
                  <span className="text-xs text-[var(--state-warning-text)] font-[var(--font-weight-medium)]">
                    待选定处理方式
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--state-success-text)] font-[var(--font-weight-medium)]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    已选定
                  </span>
                )}
              </div>

              {/* Resolution Radio Group */}
              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                <div className="text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)]">
                  选定处理方式 (必选):
                </div>

                <div
                  role="radiogroup"
                  aria-label={`提案 ${idx + 1} 处理方式`}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                >
                  {/* Option 1: Create */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={s.resolution === "create"}
                    onClick={() => updateState(idx, { resolution: "create" })}
                    data-testid={`proposal-${idx}-resolution-create`}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-[var(--radius-md)] text-xs font-[var(--font-weight-medium)] transition-colors min-h-[var(--touch-target-min)] cursor-pointer ${
                      s.resolution === "create"
                        ? "bg-[var(--entity-artifact-bg)] text-[var(--entity-artifact-text)] border border-[var(--entity-artifact-border)] font-[var(--font-weight-semibold)] shadow-sm"
                        : "bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    <PlusCircle className="w-4 h-4 shrink-0" />
                    <span>新建造物 (Create)</span>
                  </button>

                  {/* Option 2: Existing */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={s.resolution === "existing"}
                    onClick={() => updateState(idx, { resolution: "existing" })}
                    data-testid={`proposal-${idx}-resolution-existing`}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-[var(--radius-md)] text-xs font-[var(--font-weight-medium)] transition-colors min-h-[var(--touch-target-min)] cursor-pointer ${
                      s.resolution === "existing"
                        ? "bg-[var(--selection-neutral-bg)] text-[var(--selection-neutral-text)] border border-[var(--selection-neutral-border)] font-[var(--font-weight-semibold)] shadow-sm"
                        : "bg-[var(--surface-ground)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover-neutral)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    <LinkIcon className="w-4 h-4 shrink-0" />
                    <span>关联已有 (Link)</span>
                  </button>

                  {/* Option 3: Ignore */}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={s.resolution === "ignore"}
                    onClick={() => updateState(idx, { resolution: "ignore" })}
                    data-testid={`proposal-${idx}-resolution-ignore`}
                    className={`flex items-center justify-center gap-1.5 p-2.5 rounded-[var(--radius-md)] text-xs font-[var(--font-weight-medium)] transition-colors min-h-[var(--touch-target-min)] cursor-pointer ${
                      s.resolution === "ignore"
                        ? "bg-[var(--surface-raised)] text-[var(--text-primary)] border border-[var(--border-raised)] font-[var(--font-weight-semibold)] shadow-sm"
                        : "bg-[var(--surface-ground)] text-[var(--text-muted)] hover:bg-[var(--surface-hover-neutral)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    <EyeOff className="w-4 h-4 shrink-0" />
                    <span>忽略提案 (Ignore)</span>
                  </button>
                </div>

                {/* Subform: Create Overrides */}
                {s.resolution === "create" && (
                  <div
                    data-testid={`proposal-${idx}-create-subform`}
                    className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] space-y-3 text-xs"
                  >
                    <div className="space-y-1">
                      <label
                        htmlFor={`proposal-${idx}-title-input`}
                        className="text-[var(--text-secondary)] block font-[var(--font-weight-medium)]"
                      >
                        造物名称 (Title) <span className="text-[var(--state-danger-text)]">*</span>
                      </label>
                      <input
                        id={`proposal-${idx}-title-input`}
                        type="text"
                        value={s.titleOverride}
                        onChange={(e) => updateState(idx, { titleOverride: e.target.value })}
                        data-testid={`proposal-${idx}-title-override`}
                        className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] min-h-[var(--touch-target-min)]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label
                          htmlFor={`proposal-${idx}-type-select`}
                          className="text-[var(--text-secondary)] block font-[var(--font-weight-medium)]"
                        >
                          成果类型 (Type)
                        </label>
                        <select
                          id={`proposal-${idx}-type-select`}
                          value={s.typeOverride}
                          onChange={(e) => updateState(idx, { typeOverride: e.target.value as ArtifactType })}
                          data-testid={`proposal-${idx}-type-override`}
                          className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer min-h-[var(--touch-target-min)]"
                        >
                          {CANONICAL_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {ARTIFACT_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor={`proposal-${idx}-reusability-slider`}
                          className="text-[var(--text-secondary)] block font-[var(--font-weight-medium)]"
                        >
                          可复用性: {Number(s.reusabilityOverride).toFixed(2)}
                        </label>
                        <input
                          id={`proposal-${idx}-reusability-slider`}
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={s.reusabilityOverride}
                          onChange={(e) => updateState(idx, { reusabilityOverride: parseFloat(e.target.value) })}
                          data-testid={`proposal-${idx}-reusability-override`}
                          className="w-full cursor-pointer accent-[var(--entity-artifact-text)] mt-1 min-h-[var(--touch-target-min)]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Subform: Existing Artifact Search & Picker */}
                {s.resolution === "existing" && (
                  <div
                    data-testid={`proposal-${idx}-existing-subform`}
                    className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] space-y-3 text-xs"
                  >
                    <div className="space-y-1">
                      <label
                        htmlFor={`proposal-${idx}-search-input`}
                        className="text-[var(--text-secondary)] block font-[var(--font-weight-medium)]"
                      >
                        搜索并选择已有造物 (Search & Select Artifact) <span className="text-[var(--state-danger-text)]">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id={`proposal-${idx}-search-input`}
                          type="text"
                          value={existingSearchQueries[idx] || ""}
                          onChange={(e) => handleExistingSearch(idx, e.target.value)}
                          placeholder="输入关键词搜索已有造物..."
                          data-testid={`proposal-${idx}-existing-search-input`}
                          className="w-full pl-8 pr-3 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] min-h-[var(--touch-target-min)]"
                        />
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                        {isSearchingExisting[idx] && (
                          <Loader2 className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-[var(--text-muted)]" />
                        )}
                      </div>

                      {/* Dropdown Results */}
                      {(existingSearchResults[idx] || []).length > 0 && (
                        <div
                          data-testid={`proposal-${idx}-search-results`}
                          className="max-h-36 overflow-y-auto border border-[var(--border-subtle)] rounded-[var(--radius-sm)] bg-[var(--surface-base)] divide-y divide-[var(--border-subtle)] mt-1"
                        >
                          {existingSearchResults[idx].map((art) => (
                            <button
                              key={art.id}
                              type="button"
                              onClick={() => {
                                updateState(idx, {
                                  existingArtifactId: art.id,
                                  selectedArtifactTitle: art.title,
                                });
                                setExistingSearchResults((prev) => ({ ...prev, [idx]: [] }));
                              }}
                              data-testid={`select-existing-artifact-${art.id}`}
                              className="w-full flex items-center justify-between p-2 text-left hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer min-h-[var(--touch-target-min)]"
                            >
                              <div className="flex items-center gap-2">
                                <ArtifactTypeBadge type={art.artifactType} />
                                <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)] truncate max-w-xs">
                                  {art.title}
                                </span>
                              </div>
                              <span className="font-mono text-xs text-[var(--text-muted)]">
                                {art.id.slice(0, 8)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Selected Artifact Confirmation / Fallback UUID */}
                    <div className="space-y-1">
                      <label
                        htmlFor={`proposal-${idx}-existing-id-input`}
                        className="text-[var(--text-secondary)] block font-[var(--font-weight-medium)]"
                      >
                        已选定造物 UUID (Selected Artifact UUID)
                      </label>
                      <input
                        id={`proposal-${idx}-existing-id-input`}
                        type="text"
                        value={s.existingArtifactId}
                        aria-invalid={isExistingInvalid ? "true" : undefined}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateState(idx, {
                            existingArtifactId: val,
                            selectedArtifactTitle: undefined,
                          });
                        }}
                        placeholder="选择上方搜索结果或直接输入有效 36 位 UUID"
                        data-testid={`proposal-${idx}-existing-artifact-id`}
                        className={`w-full px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border font-mono text-[var(--text-primary)] min-h-[var(--touch-target-min)] ${
                          isExistingInvalid
                            ? "border-[var(--state-danger-border)] focus:border-[var(--state-danger-border)] text-[var(--state-danger-text)]"
                            : "border-[var(--border-default)]"
                        }`}
                      />
                      {isExistingInvalid && (
                        <div
                          data-testid={`proposal-${idx}-uuid-error`}
                          className="text-xs text-[var(--state-danger-text)] flex items-center gap-1 pt-0.5"
                        >
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>请输入有效的 36 位 UUID 格式 (例如 11111111-1111-4111-8111-111111111111)</span>
                        </div>
                      )}
                      {s.selectedArtifactTitle && (
                        <div className="text-xs text-[var(--entity-artifact-text)] font-[var(--font-weight-medium)] pt-0.5">
                          ✓ 已关联：{s.selectedArtifactTitle}
                        </div>
                      )}
                    </div>

                    {/* Activity Role Select */}
                    <div className="space-y-1">
                      <label
                        htmlFor={`proposal-${idx}-activity-role-select`}
                        className="text-[var(--text-secondary)] block font-[var(--font-weight-medium)]"
                      >
                        本次活动与该造物的关系 (Activity Role)
                      </label>
                      <select
                        id={`proposal-${idx}-activity-role-select`}
                        value={s.activityRole}
                        onChange={(e) =>
                          updateState(idx, {
                            activityRole: e.target.value as "modified" | "referenced",
                          })
                        }
                        data-testid={`proposal-${idx}-activity-role`}
                        className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] cursor-pointer min-h-[var(--touch-target-min)]"
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
