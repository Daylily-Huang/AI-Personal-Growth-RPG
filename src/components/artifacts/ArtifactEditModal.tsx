"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BaseModal } from "@/components/ui/BaseModal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { ARTIFACT_TYPE_LABELS } from "./ArtifactTypeBadge";
import type { Artifact, ArtifactType, ArtifactLifecycleStatus, UpdateArtifactInput } from "@/types/artifact";
import { AlertCircle, Save } from "lucide-react";

export interface ArtifactEditModalProps {
  open: boolean;
  artifact: Artifact | null;
  onClose: () => void;
  onUpdated: (updatedArtifact: Artifact) => void;
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

const LIFECYCLE_STATUSES: ArtifactLifecycleStatus[] = [
  "active",
  "draft",
  "superseded",
  "archived",
];

function ArtifactEditModalInner({
  open,
  artifact,
  onClose,
  onUpdated,
}: {
  open: boolean;
  artifact: Artifact;
  onClose: () => void;
  onUpdated: (updatedArtifact: Artifact) => void;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(artifact.title || "");
  const [artifactType, setArtifactType] = useState<ArtifactType>(artifact.artifactType || "document");
  const [summary, setSummary] = useState(artifact.summary || "");
  const [description, setDescription] = useState(artifact.description || "");
  const [version, setVersion] = useState(artifact.version || "1.0");
  const [externalUrl, setExternalUrl] = useState(artifact.externalUrl || "");
  const [reusabilityScore, setReusabilityScore] = useState(artifact.reusabilityScore ?? 0.8);
  const [lifecycleStatus, setLifecycleStatus] = useState<ArtifactLifecycleStatus>(artifact.lifecycleStatus || "active");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMessage("造物标题为必填项");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const payload: UpdateArtifactInput = {
      title: cleanTitle,
      artifactType,
      summary: summary.trim() || null,
      description: description.trim() || null,
      version: version.trim() || "1.0",
      externalUrl: externalUrl.trim() || null,
      reusabilityScore: Number(reusabilityScore),
      lifecycleStatus,
      isArchived: lifecycleStatus === "archived",
    };

    try {
      const res = await fetch(`/api/artifacts/${artifact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (res.status === 409) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(errData.error || "存在同名造物冲突，请修改标题");
        return;
      }

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(errData.error || `保存修改失败 (${res.status})`);
        return;
      }

      const data = (await res.json()) as { artifact?: Artifact };
      if (data.artifact) {
        onUpdated(data.artifact);
        onClose();
      } else {
        throw new Error("服务端未返回更新后的造物数据");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <>
      <SecondaryButton
        type="button"
        onClick={onClose}
        disabled={submitting}
        data-testid="edit-artifact-cancel"
      >
        取消
      </SecondaryButton>
      <PrimaryButton
        type="button"
        onClick={handleSubmit}
        loading={submitting}
        disabled={submitting || !title.trim()}
        icon={<Save className="w-4 h-4" />}
        data-testid="edit-artifact-submit"
      >
        保存修改
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      open={open}
      onClose={() => !submitting && onClose()}
      title="编辑造物详情 (Edit Artifact)"
      footer={footer}
    >
      <form
        data-testid="edit-artifact-form"
        onSubmit={handleSubmit}
        className="space-y-4 text-left"
      >
        {errorMessage && (
          <div
            data-testid="edit-artifact-error"
            className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-border)] text-[var(--state-danger-text)] text-xs leading-relaxed"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Title */}
        <div className="space-y-1.5">
          <label
            htmlFor="artifact-edit-title"
            className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
          >
            造物名称 (Title) <span className="text-[var(--state-danger-text)]">*</span>
          </label>
          <input
            id="artifact-edit-title"
            data-testid="edit-artifact-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          />
        </div>

        {/* 2. Type & Version */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="artifact-edit-type"
              className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
            >
              成果类型 (Artifact Type)
            </label>
            <select
              id="artifact-edit-type"
              data-testid="edit-artifact-type"
              value={artifactType}
              onChange={(e) => setArtifactType(e.target.value as ArtifactType)}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] cursor-pointer"
            >
              {CANONICAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ARTIFACT_TYPE_LABELS[t]} ({t})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="artifact-edit-version"
              className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
            >
              版本标识 (Version)
            </label>
            <input
              id="artifact-edit-version"
              data-testid="edit-artifact-version"
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] font-mono focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
            />
          </div>
        </div>

        {/* 3. Summary */}
        <div className="space-y-1.5">
          <label
            htmlFor="artifact-edit-summary"
            className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
          >
            成果简述 (Summary)
          </label>
          <input
            id="artifact-edit-summary"
            data-testid="edit-artifact-summary"
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          />
        </div>

        {/* 4. Description */}
        <div className="space-y-1.5">
          <label
            htmlFor="artifact-edit-description"
            className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
          >
            详细描述 (Description)
          </label>
          <textarea
            id="artifact-edit-description"
            data-testid="edit-artifact-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] resize-y font-sans"
          />
        </div>

        {/* 5. URL & Lifecycle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="artifact-edit-url"
              className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
            >
              外部链接 (External URL)
            </label>
            <input
              id="artifact-edit-url"
              data-testid="edit-artifact-url"
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="artifact-edit-status"
              className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
            >
              生命周期状态 (Lifecycle)
            </label>
            <select
              id="artifact-edit-status"
              data-testid="edit-artifact-status"
              value={lifecycleStatus}
              onChange={(e) => setLifecycleStatus(e.target.value as ArtifactLifecycleStatus)}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] cursor-pointer"
            >
              {LIFECYCLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 6. Reusability Slider */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="artifact-edit-reusability"
              className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
            >
              可复用性评分
            </label>
            <span className="font-mono text-xs text-[var(--text-secondary)]">
              {Number(reusabilityScore).toFixed(2)}
            </span>
          </div>
          <input
            id="artifact-edit-reusability"
            data-testid="edit-artifact-reusability"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={reusabilityScore}
            onChange={(e) => setReusabilityScore(parseFloat(e.target.value))}
            className="w-full cursor-pointer accent-[var(--entity-artifact-text)]"
          />
        </div>
      </form>
    </BaseModal>
  );
}

export function ArtifactEditModal({
  open,
  artifact,
  onClose,
  onUpdated,
}: ArtifactEditModalProps) {
  if (!artifact) return null;

  return (
    <ArtifactEditModalInner
      key={artifact.id}
      open={open}
      artifact={artifact}
      onClose={onClose}
      onUpdated={onUpdated}
    />
  );
}
