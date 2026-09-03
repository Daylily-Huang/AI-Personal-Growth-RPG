"use client";

import React, { useState, useCallback } from "react";
import type { Assessment } from "@/lib/store/types";
import type { ArtifactResolutionInput } from "@/types/artifact";
import { Check, Sparkles } from "lucide-react";
import { SectionCard, PrimaryButton, ConfidenceBadge } from "@/components/ui";
import { ArtifactProposalResolutionPicker } from "@/components/artifacts/ArtifactProposalResolutionPicker";

export interface PendingProposalsProps {
  assessments: Assessment[];
  confirmingId: string | null;
  onConfirm: (id: string, resolutions?: ArtifactResolutionInput[]) => void;
}

export function PendingProposals({
  assessments,
  confirmingId,
  onConfirm,
}: PendingProposalsProps) {
  if (assessments.length === 0) return null;

  return (
    <SectionCard
      title="待确认的 AI 评估"
      icon={<Sparkles className="h-5 w-5 text-[var(--text-secondary)] shrink-0" />}
      action={
        <span className="rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-2.5 py-0.5 text-xs font-mono text-[var(--text-muted)]">
          共 {assessments.length} 项
        </span>
      }
      className="p-5 space-y-5"
    >
      <div className="space-y-4">
        {assessments.map((assessment) => (
          <PendingAssessmentItem
            key={assessment.id}
            assessment={assessment}
            confirmingId={confirmingId}
            onConfirm={onConfirm}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function PendingAssessmentItem({
  assessment,
  confirmingId,
  onConfirm,
}: {
  assessment: Assessment;
  confirmingId: string | null;
  onConfirm: (id: string, resolutions?: ArtifactResolutionInput[]) => void;
}) {
  const artifactProposals = assessment.proposal?.artifactProposals || [];
  const hasProposals = artifactProposals.length > 0;

  const [resolutions, setResolutions] = useState<ArtifactResolutionInput[]>([]);
  const [resolutionsValid, setResolutionsValid] = useState<boolean>(!hasProposals);

  const handleResolutionsChange = useCallback(
    (newResolutions: ArtifactResolutionInput[], isValid: boolean) => {
      setResolutions(newResolutions);
      setResolutionsValid(isValid);
    },
    []
  );

  const isConfirming = confirmingId === assessment.id;

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 space-y-4 shadow-sm">
      {/* Top Bar: Activity Type & AI Confidence */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-[var(--font-weight-medium)] uppercase tracking-wider text-[var(--text-muted)]">
            Activity Type
          </div>
          <div className="font-[var(--font-weight-semibold)] text-base text-[var(--text-primary)] capitalize">
            {assessment.proposal.activity.type}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ConfidenceBadge variant="assessment" score={assessment.confidence} size="sm" />
          <span className="text-xs font-mono text-[var(--text-muted)]">
            {assessment.modelName}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <InfoBox
          label="Evidence"
          value={`E${assessment.proposal.evidence.level}`}
          detail={assessment.proposal.evidence.explanation}
        />
        <InfoBox
          label="Mastery"
          value={
            assessment.proposal.mastery_changes[0]
              ? `M${assessment.proposal.mastery_changes[0].from_level} → M${assessment.proposal.mastery_changes[0].proposed_level}`
              : "—"
          }
          detail={assessment.proposal.mastery_changes[0]?.reason}
        />
        <InfoBox
          label="Affected Skill"
          value={assessment.proposal.affected_skills[0]?.name ?? "—"}
          detail={assessment.proposal.affected_skills[0]?.reason}
        />
        <InfoBox
          label="XP Semantics"
          value={`base ${assessment.proposal.xp_semantics.base_value}`}
          detail={`difficulty ${Math.round(
            assessment.proposal.xp_semantics.difficulty * 100
          )}% · novelty ${Math.round(
            assessment.proposal.xp_semantics.novelty * 100
          )}%`}
        />
        <InfoBox
          label="重复风险（AI 估算）"
          value={assessment.proposal.xp_semantics.repetition_risk}
          detail="非最终判定；服务器确认时重新计算"
        />
      </div>

      {/* Uncertainty Notes */}
      {assessment.proposal.uncertainty_notes.length > 0 && (
        <div className="text-xs text-[var(--text-muted)] bg-[var(--surface-base)] border border-[var(--border-subtle)] rounded-lg p-3">
          {assessment.proposal.uncertainty_notes.join(" ")}
        </div>
      )}

      {/* Artifact Deliverable Proposals Resolution */}
      {hasProposals && (
        <div className="pt-3 border-t border-[var(--border-subtle)]">
          <ArtifactProposalResolutionPicker
            proposals={artifactProposals}
            onChange={handleResolutionsChange}
          />
        </div>
      )}

      {/* Confirmation CTA */}
      <div className="flex justify-end pt-2">
        <PrimaryButton
          onClick={() =>
            onConfirm(assessment.id, hasProposals ? resolutions : undefined)
          }
          disabled={!resolutionsValid}
          loading={isConfirming}
          data-testid={`confirm-assessment-btn-${assessment.id}`}
          icon={<Check className="h-4 w-4" />}
          className="min-h-[var(--touch-target-min)]"
        >
          {isConfirming ? "结算中…" : "确认并结算"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function InfoBox({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 shadow-xs">
      <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-[var(--font-weight-medium)]">
        {label}
      </div>
      <div className="mt-1 font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
        {value}
      </div>
      {detail ? (
        <div className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
          {detail}
        </div>
      ) : null}
    </div>
  );
}
