"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { BaseModal } from "@/components/ui/BaseModal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { ARTIFACT_TYPE_LABELS } from "./ArtifactTypeBadge";
import type { ArtifactType, ArtifactLifecycleStatus, CreateArtifactInput, Artifact } from "@/types/artifact";
import { AlertCircle, Plus } from "lucide-react";

export interface ArtifactCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (newArtifact: Artifact) => void;
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

export function ArtifactCreateModal({
  open,
  onClose,
  onCreated,
}: ArtifactCreateModalProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [artifactType, setArtifactType] = useState<ArtifactType>("document");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("1.0");
  const [externalUrl, setExternalUrl] = useState("");
  const [reusabilityScore, setReusabilityScore] = useState(0.8);
  const [lifecycleStatus, setLifecycleStatus] = useState<ArtifactLifecycleStatus>("active");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setTitle("");
    setArtifactType("document");
    setSummary("");
    setDescription("");
    setVersion("1.0");
    setExternalUrl("");
    setReusabilityScore(0.8);
    setLifecycleStatus("active");
    setErrorMessage(null);
  };

  const handleClose = () => {
    if (!submitting) {
      resetForm();
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMessage("造物标题为必填项");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const payload: CreateArtifactInput = {
      title: cleanTitle,
      artifactType,
      summary: summary.trim() || null,
      description: description.trim() || null,
      version: version.trim() || "1.0",
      externalUrl: externalUrl.trim() || null,
      reusabilityScore: Number(reusabilityScore),
      lifecycleStatus,
    };

    try {
      const res = await fetch("/api/artifacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        router.push("/login");
        return;
      }

      if (res.status === 409) {
        const errorData = await res.json().catch(() => ({}));
        setErrorMessage(errorData.error || "已存在同名造物标题，请使用唯一的标题命名");
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        setErrorMessage(errorData.error || `创建造物失败 (${res.status})`);
        return;
      }

      const data = await res.json();
      if (data.artifact) {
        onCreated(data.artifact);
        resetForm();
        onClose();
      } else {
        throw new Error("服务端未返回有效造物数据");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "网络请求异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <>
      <SecondaryButton
        type="button"
        onClick={handleClose}
        disabled={submitting}
        data-testid="create-artifact-cancel"
      >
        取消
      </SecondaryButton>
      <PrimaryButton
        type="button"
        onClick={handleSubmit}
        loading={submitting}
        disabled={submitting || !title.trim()}
        icon={<Plus className="w-4 h-4" />}
        data-testid="create-artifact-submit"
      >
        创建造物
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      open={open}
      onClose={handleClose}
      title="新建成果造物 (Create Artifact)"
      footer={footer}
    >
      <form
        data-testid="create-artifact-form"
        onSubmit={handleSubmit}
        className="space-y-4 text-left"
      >
        {errorMessage && (
          <div
            data-testid="create-artifact-error"
            className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-border)] text-[var(--state-danger-text)] text-xs leading-relaxed"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. Title */}
        <div className="space-y-1.5">
          <label
            htmlFor="artifact-create-title"
            className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
          >
            造物名称 (Title) <span className="text-[var(--state-danger-text)]">*</span>
          </label>
          <input
            id="artifact-create-title"
            data-testid="create-artifact-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：ReactFlow 架构设计规范 RFC"
            className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          />
        </div>

        {/* 2. Type & Version */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="artifact-create-type"
              className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
            >
              成果类型 (Artifact Type)
            </label>
            <select
              id="artifact-create-type"
              data-testid="create-artifact-type"
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
              htmlFor="artifact-create-version"
              className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
            >
              版本标识 (Version)
            </label>
            <input
              id="artifact-create-version"
              data-testid="create-artifact-version"
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0"
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] font-mono"
            />
          </div>
        </div>

        {/* 3. Summary */}
        <div className="space-y-1.5">
          <label
            htmlFor="artifact-create-summary"
            className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
          >
            成果简述 (Summary)
          </label>
          <input
            id="artifact-create-summary"
            data-testid="create-artifact-summary"
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="一两句话概括该产出的核心价值"
            className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
          />
        </div>

        {/* 4. Description */}
        <div className="space-y-1.5">
          <label
            htmlFor="artifact-create-description"
            className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
          >
            详细说明与构件记录 (Description)
          </label>
          <textarea
            id="artifact-create-description"
            data-testid="create-artifact-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="详细的技术方案、实施要点或成果正文..."
            className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] resize-y font-sans"
          />
        </div>

        {/* 5. External URL & Reusability */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="artifact-create-url"
              className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
            >
              外部引用链接 (External URL)
            </label>
            <input
              id="artifact-create-url"
              data-testid="create-artifact-url"
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="artifact-create-reusability"
                className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
              >
                可复用性评分
              </label>
              <span className="font-mono text-xs text-[var(--text-secondary)]">
                {Number(reusabilityScore).toFixed(2)}
              </span>
            </div>
            <input
              id="artifact-create-reusability"
              data-testid="create-artifact-reusability"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={reusabilityScore}
              onChange={(e) => setReusabilityScore(parseFloat(e.target.value))}
              className="w-full cursor-pointer accent-[var(--entity-artifact-text)]"
            />
          </div>
        </div>

        {/* 6. Initial Lifecycle Status */}
        <div className="space-y-1.5 pt-1">
          <label className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]">
            初始生命周期状态
          </label>
          <div className="flex items-center gap-4 text-xs">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="lifecycleStatus"
                value="active"
                checked={lifecycleStatus === "active"}
                onChange={() => setLifecycleStatus("active")}
                className="accent-[var(--gold-400)]"
              />
              <span>活跃生效 (Active)</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="lifecycleStatus"
                value="draft"
                checked={lifecycleStatus === "draft"}
                onChange={() => setLifecycleStatus("draft")}
                className="accent-[var(--gold-400)]"
              />
              <span>草稿 (Draft)</span>
            </label>
          </div>
        </div>
      </form>
    </BaseModal>
  );
}
