"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Assessment } from "@/lib/store/types";
import type { ArtifactResolutionInput } from "@/types/artifact";
import { Check, Sparkles } from "lucide-react";
import { SectionCard, PrimaryButton, SecondaryButton, ConfidenceBadge } from "@/components/ui";
import { ArtifactProposalResolutionPicker } from "@/components/artifacts/ArtifactProposalResolutionPicker";
import { useOptionalAppShell } from "@/components/layout/AppShellContext";
import { ProposalRejectionError, rejectProposal } from "@/lib/assessments/rejection-client";

export interface PendingProposalsProps {
  assessments: Assessment[];
  confirmingId: string | null;
  onConfirm: (id: string, resolutions?: ArtifactResolutionInput[]) => void | Promise<void>;
}

export function PendingProposals({
  assessments,
  confirmingId,
  onConfirm,
}: PendingProposalsProps) {
  const router = useRouter();
  const shell = useOptionalAppShell();
  const mounted = useRef(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const visible = assessments.filter(assessment => !dismissed.has(assessment.id));

  async function handleReject(assessment: Assessment, signal: AbortSignal) {
    try {
      await rejectProposal(assessment.id, assessment.activityId, signal);
      if (!mounted.current || signal.aborted) return;
      setDismissed(previous => new Set([...previous, assessment.id]));
      setNotice("评估已拒绝。原活动和评估历史保留，未发放或扣除 XP。");
      if (shell) {
        try {
          const result = await shell.refreshDashboard();
          if (!mounted.current) return;
          if (result.status === 401) router.push("/login");
          if (!result.ok) setNotice("评估已拒绝，原活动保留且未结算 XP；列表刷新未完成，请刷新页面。");
        } catch {
          if (mounted.current) setNotice("评估已拒绝，原活动保留且未结算 XP；列表刷新未完成，请刷新页面。");
        }
      }
    } catch (error) {
      if (!mounted.current || signal.aborted) return;
      if (error instanceof ProposalRejectionError && error.code === "auth_required") router.push("/login");
      if (error instanceof ProposalRejectionError && error.code === "conflict" && shell) {
        setNotice("评估状态已变更，未执行拒绝；已尝试刷新列表。");
        try { await shell.refreshDashboard(); } catch { /* Keep the conflict visible, never claim rejection. */ }
      }
      throw error;
    }
  }

  if (visible.length === 0 && !notice) return null;

  return (
    <SectionCard
      title="待确认的 AI 评估"
      icon={<Sparkles className="h-5 w-5 text-[var(--text-secondary)] shrink-0" />}
      action={
        <span className="rounded-full bg-[var(--surface-raised)] border border-[var(--border-subtle)] px-2.5 py-0.5 text-xs font-mono text-[var(--text-muted)]">
          共 {visible.length} 项
        </span>
      }
      className="p-5 space-y-5"
    >
      {notice && <p role="status" className="text-sm text-[var(--text-secondary)]">{notice}</p>}
      <div className="space-y-4">
        {visible.map((assessment) => (
          <PendingAssessmentItem
            key={assessment.id}
            assessment={assessment}
            confirmingId={confirmingId}
            onConfirm={onConfirm}
            onReject={handleReject}
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
  onReject,
}: {
  assessment: Assessment;
  confirmingId: string | null;
  onConfirm: (id: string, resolutions?: ArtifactResolutionInput[]) => void | Promise<void>;
  onReject: (assessment: Assessment, signal: AbortSignal) => Promise<void>;
}) {
  const artifactProposals = assessment.proposal?.artifactProposals || [];
  const hasProposals = artifactProposals.length > 0;

  const [resolutions, setResolutions] = useState<ArtifactResolutionInput[]>([]);
  const [resolutionsValid, setResolutionsValid] = useState<boolean>(!hasProposals);
  const [askingToReject, setAskingToReject] = useState(false);
  const [operation, setOperation] = useState<"confirm" | "reject" | null>(null);
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const rejectionRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; rejectionRequest.current?.abort(); };
  }, [assessment.id, assessment.activityId]);

  const handleResolutionsChange = useCallback(
    (newResolutions: ArtifactResolutionInput[], isValid: boolean) => {
      setResolutions(newResolutions);
      setResolutionsValid(isValid);
    },
    []
  );

  const isConfirming = confirmingId === assessment.id || operation === "confirm";
  const isBusy = isConfirming || operation === "reject";

  async function confirm() {
    if (busy.current || isBusy || askingToReject || !resolutionsValid) return;
    busy.current = true; setOperation("confirm");
    try { await onConfirm(assessment.id, hasProposals ? resolutions : undefined); }
    catch { if (mounted.current) setRejectionError("确认未完成，请刷新后核实或重试。"); }
    finally { busy.current = false; if (mounted.current) setOperation(null); }
  }

  async function reject() {
    if (busy.current || isBusy || !askingToReject) return;
    busy.current = true; setOperation("reject"); setRejectionError(null);
    const controller = new AbortController(); rejectionRequest.current = controller;
    try { await onReject(assessment, controller.signal); }
    catch (error) {
      if (mounted.current && !controller.signal.aborted) setRejectionError(error instanceof ProposalRejectionError
        ? error.message : "拒绝未完成，请重试；原活动和评估仍保留。");
    } finally {
      busy.current = false;
      if (rejectionRequest.current === controller) rejectionRequest.current = null;
      if (mounted.current) setOperation(null);
    }
  }

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
      <div className="flex flex-wrap justify-end gap-3 pt-2">
        {!askingToReject && <SecondaryButton
          onClick={() => { setAskingToReject(true); setRejectionError(null); }}
          disabled={isBusy}
          className="min-h-[var(--touch-target-min)]"
          aria-controls={`reject-assessment-${assessment.id}`}
        >拒绝提案</SecondaryButton>}
        <PrimaryButton
          onClick={() => { void confirm(); }}
          disabled={!resolutionsValid || isBusy || askingToReject}
          loading={isConfirming}
          data-testid={`confirm-assessment-btn-${assessment.id}`}
          icon={<Check className="h-4 w-4" />}
          className="min-h-[var(--touch-target-min)]"
        >
          {isConfirming ? "结算中…" : "确认并结算"}
        </PrimaryButton>
      </div>
      {askingToReject && <div id={`reject-assessment-${assessment.id}`} className="rounded-lg border border-[var(--border-subtle)] p-3 space-y-3">
        <p className="text-sm text-[var(--text-secondary)]">仅拒绝这份 AI 评估，不删除原活动，不发放或扣除 XP。确定拒绝吗？</p>
        <div className="flex flex-wrap justify-end gap-3">
          <SecondaryButton disabled={isBusy} onClick={() => { setAskingToReject(false); setRejectionError(null); }} className="min-h-[var(--touch-target-min)]">取消拒绝</SecondaryButton>
          <SecondaryButton disabled={isBusy} onClick={() => { void reject(); }} className="min-h-[var(--touch-target-min)]">{operation === "reject" ? "拒绝中…" : "确定拒绝"}</SecondaryButton>
        </div>
      </div>}
      {rejectionError && <p role="alert" className="text-sm text-[var(--state-danger-text)]">{rejectionError}</p>}
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
