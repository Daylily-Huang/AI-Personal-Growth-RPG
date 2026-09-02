"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BaseModal } from "@/components/ui/BaseModal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { ARTIFACT_TYPE_LABELS } from "./ArtifactTypeBadge";
import { isValidUuid } from "./ArtifactProposalResolutionPicker";
import type {
  Artifact,
  ArtifactType,
  ArtifactLifecycleStatus,
  CreateArtifactInput,
} from "@/types/artifact";
import {
  AlertCircle,
  Plus,
  Sparkles,
  Network,
  Scroll,
  Zap,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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

const INITIAL_LIFECYCLE_STATUSES: Array<{ id: "active" | "draft"; label: string }> = [
  { id: "active", label: "活跃生效 (Active)" },
  { id: "draft", label: "草稿暂存 (Draft)" },
];

function ArtifactCreateModalInner({
  open,
  onClose,
  onCreated,
}: ArtifactCreateModalProps) {
  const router = useRouter();

  // Basic Form States
  const [title, setTitle] = useState("");
  const [artifactType, setArtifactType] = useState<ArtifactType>("document");
  const [lifecycleStatus, setLifecycleStatus] = useState<"active" | "draft">("active");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("1.0");
  const [externalUrl, setExternalUrl] = useState("");
  const [reusabilityScore, setReusabilityScore] = useState(0.8);

  // Initial Relationship Selection
  const [initialLinksExpanded, setInitialLinksExpanded] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [selectedKnowledgeNodeIds, setSelectedKnowledgeNodeIds] = useState<string[]>([]);
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [activityIdInput, setActivityIdInput] = useState("");
  const [evidenceIdInput, setEvidenceIdInput] = useState("");

  // Available options
  const [availableSkills, setAvailableSkills] = useState<Array<{ id: string; name: string }>>([]);
  const [availableKnowledge, setAvailableKnowledge] = useState<Array<{ id: string; title: string }>>([]);
  const [availableQuests, setAvailableQuests] = useState<Array<{ id: string; title: string }>>([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load available entities on mount with robust graph data parsing
  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d: { nodes?: Array<{ id: string; name?: string; title?: string; data?: { name?: string } }> }) => {
        if (d.nodes) {
          setAvailableSkills(
            d.nodes.map((n) => ({
              id: n.id,
              name: n.data?.name || n.name || n.title || n.id,
            }))
          );
        }
      })
      .catch(() => {});

    fetch("/api/knowledge")
      .then((r) => r.json())
      .then((d: { nodes?: Array<{ id: string; title?: string; nodeType?: string; node_type?: string }> }) => {
        if (d.nodes) {
          setAvailableKnowledge(
            d.nodes.map((n) => ({
              id: n.id,
              title: n.title || n.id,
            }))
          );
        }
      })
      .catch(() => {});

    fetch("/api/quests")
      .then((r) => r.json())
      .then((d: { quests?: Array<{ id: string; title?: string }> }) => {
        if (d.quests) {
          setAvailableQuests(
            d.quests.map((q) => ({
              id: q.id,
              title: q.title || q.id,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const isActivityInvalid = activityIdInput.trim() !== "" && !isValidUuid(activityIdInput);
  const isEvidenceInvalid = evidenceIdInput.trim() !== "" && !isValidUuid(evidenceIdInput);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMessage("造物名称为必填项");
      return;
    }

    if (isActivityInvalid) {
      setErrorMessage("活动 UUID 格式无效，请输入有效的 36 位 RFC UUID");
      return;
    }

    if (isEvidenceInvalid) {
      setErrorMessage("实证 UUID 格式无效，请输入有效的 36 位 RFC UUID");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const payload: CreateArtifactInput & { lifecycleStatus?: ArtifactLifecycleStatus } = {
      title: cleanTitle,
      artifactType,
      lifecycleStatus,
      summary: summary.trim() || undefined,
      description: description.trim() || undefined,
      version: version.trim() || "1.0",
      externalUrl: externalUrl.trim() || undefined,
      reusabilityScore: Number(reusabilityScore),
      skillIds: selectedSkillIds.length > 0 ? selectedSkillIds : undefined,
      knowledgeNodeIds: selectedKnowledgeNodeIds.length > 0 ? selectedKnowledgeNodeIds : undefined,
      questIds: selectedQuestIds.length > 0 ? selectedQuestIds : undefined,
      activityIds: activityIdInput.trim() ? [activityIdInput.trim()] : undefined,
      evidenceIds: evidenceIdInput.trim() ? [evidenceIdInput.trim()] : undefined,
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
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(errData.error || "已存在同名造物标题，请使用唯一的标题命名");
        return;
      }

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(errData.error || `创建造物失败 (${res.status})`);
        return;
      }

      const data = (await res.json()) as { artifact?: Artifact };
      if (data.artifact) {
        onCreated(data.artifact);
        onClose();
      } else {
        throw new Error("服务端未返回创建后的造物数据");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "网络连接异常，请重试");
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
        data-testid="create-artifact-cancel"
      >
        取消 (Discard)
      </SecondaryButton>
      <PrimaryButton
        type="button"
        onClick={handleSubmit}
        loading={submitting}
        disabled={submitting || !title.trim() || isActivityInvalid || isEvidenceInvalid}
        icon={<Plus className="w-4 h-4" />}
        data-testid="create-artifact-submit"
      >
        确认创建造物
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      open={open}
      onClose={() => !submitting && onClose()}
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
            htmlFor="artifact-title-input"
            className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
          >
            造物名称 (Title) <span className="text-[var(--state-danger-text)]">*</span>
          </label>
          <input
            id="artifact-title-input"
            data-testid="create-artifact-title"
            type="text"
            required
            placeholder="例如：系统架构设计 RFC、神经科学调研笔记"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] min-h-[var(--touch-target-min)]"
          />
        </div>

        {/* 2. Type, Initial Lifecycle Status, and Version */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="artifact-type-select"
              className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
            >
              成果类型 (Artifact Type)
            </label>
            <select
              id="artifact-type-select"
              data-testid="create-artifact-type"
              value={artifactType}
              onChange={(e) => setArtifactType(e.target.value as ArtifactType)}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] cursor-pointer min-h-[var(--touch-target-min)]"
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
              htmlFor="artifact-status-select"
              className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
            >
              初始状态 (Initial Status)
            </label>
            <select
              id="artifact-status-select"
              data-testid="create-artifact-status"
              value={lifecycleStatus}
              onChange={(e) => setLifecycleStatus(e.target.value as "active" | "draft")}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] cursor-pointer min-h-[var(--touch-target-min)]"
            >
              {INITIAL_LIFECYCLE_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="artifact-version-input"
              className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
            >
              版本标识 (Version)
            </label>
            <input
              id="artifact-version-input"
              data-testid="create-artifact-version"
              type="text"
              placeholder="1.0"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] font-mono focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] min-h-[var(--touch-target-min)]"
            />
          </div>
        </div>

        {/* 3. Summary */}
        <div className="space-y-1.5">
          <label
            htmlFor="artifact-summary-input"
            className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
          >
            成果简述 (Summary)
          </label>
          <input
            id="artifact-summary-input"
            data-testid="create-artifact-summary"
            type="text"
            placeholder="一两句话概括该造物的核心价值与内容"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] min-h-[var(--touch-target-min)]"
          />
        </div>

        {/* 4. Description */}
        <div className="space-y-1.5">
          <label
            htmlFor="artifact-description-input"
            className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
          >
            详细描述 / Markdown (Description)
          </label>
          <textarea
            id="artifact-description-input"
            data-testid="create-artifact-description"
            rows={3}
            placeholder="支持 Markdown 格式：记录关键推导、架构决策、代码段或参考链接"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] resize-y"
          />
        </div>

        {/* 5. External URL & Reusability */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="artifact-url-input"
              className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
            >
              外部链接 (External URL)
            </label>
            <input
              id="artifact-url-input"
              data-testid="create-artifact-url"
              type="url"
              placeholder="https://github.com/..."
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] min-h-[var(--touch-target-min)]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="artifact-reusability-slider"
                className="block text-xs font-[var(--font-weight-semibold)] text-[var(--text-primary)]"
              >
                可复用性: {Number(reusabilityScore).toFixed(2)}
              </label>
            </div>
            <input
              id="artifact-reusability-slider"
              data-testid="create-artifact-reusability"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={reusabilityScore}
              onChange={(e) => setReusabilityScore(parseFloat(e.target.value))}
              className="w-full cursor-pointer accent-[var(--entity-artifact-text)] mt-2 min-h-[var(--touch-target-min)]"
            />
          </div>
        </div>

        {/* 6. Initial Relationships Section (Optional) */}
        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setInitialLinksExpanded(!initialLinksExpanded)}
            data-testid="create-initial-links-toggle"
            className="flex items-center justify-between w-full text-xs font-[var(--font-weight-semibold)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-1 cursor-pointer min-h-[var(--touch-target-min)]"
          >
            <span>设置初始拓扑关联 (Optional Initial Relationships)</span>
            {initialLinksExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {initialLinksExpanded && (
            <div className="p-3 mt-2 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] space-y-3 text-xs">
              {/* Skills */}
              <div className="space-y-1">
                <label className="text-[var(--text-secondary)] flex items-center gap-1.5 font-[var(--font-weight-medium)]">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--entity-skill-text)]" />
                  <span>关联技能 (Skills)</span>
                </label>
                <select
                  multiple
                  value={selectedSkillIds}
                  onChange={(e) =>
                    setSelectedSkillIds(Array.from(e.target.selectedOptions, (o) => o.value))
                  }
                  data-testid="create-skill-ids-select"
                  className="w-full p-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] max-h-24"
                >
                  {availableSkills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Knowledge */}
              <div className="space-y-1">
                <label className="text-[var(--text-secondary)] flex items-center gap-1.5 font-[var(--font-weight-medium)]">
                  <Network className="w-3.5 h-3.5 text-[var(--entity-knowledge-text)]" />
                  <span>知识节点 (Knowledge Nodes)</span>
                </label>
                <select
                  multiple
                  value={selectedKnowledgeNodeIds}
                  onChange={(e) =>
                    setSelectedKnowledgeNodeIds(Array.from(e.target.selectedOptions, (o) => o.value))
                  }
                  data-testid="create-knowledge-ids-select"
                  className="w-full p-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] max-h-24"
                >
                  {availableKnowledge.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quests */}
              <div className="space-y-1">
                <label className="text-[var(--text-secondary)] flex items-center gap-1.5 font-[var(--font-weight-medium)]">
                  <Scroll className="w-3.5 h-3.5 text-[var(--entity-quest-text)]" />
                  <span>关联任务 (Quests)</span>
                </label>
                <select
                  multiple
                  value={selectedQuestIds}
                  onChange={(e) =>
                    setSelectedQuestIds(Array.from(e.target.selectedOptions, (o) => o.value))
                  }
                  data-testid="create-quest-ids-select"
                  className="w-full p-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-default)] text-[var(--text-primary)] max-h-24"
                >
                  {availableQuests.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Activities (Advanced UUID fallback) */}
              <div className="space-y-1">
                <label
                  htmlFor="create-activity-id-input"
                  className="text-[var(--text-secondary)] flex items-center gap-1.5 font-[var(--font-weight-medium)]"
                >
                  <Zap className="w-3.5 h-3.5 text-[var(--entity-activity-text)]" />
                  <span>高级关联: 活动 UUID (Activity UUID)</span>
                </label>
                <input
                  id="create-activity-id-input"
                  type="text"
                  value={activityIdInput}
                  aria-invalid={isActivityInvalid ? "true" : undefined}
                  onChange={(e) => setActivityIdInput(e.target.value)}
                  placeholder="输入活动记录 36 位 UUID (可选)"
                  data-testid="create-activity-id-input"
                  className={`w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border font-mono text-[var(--text-primary)] min-h-[var(--touch-target-min)] ${
                    isActivityInvalid
                      ? "border-[var(--state-danger-border)] text-[var(--state-danger-text)]"
                      : "border-[var(--border-default)]"
                  }`}
                />
                {isActivityInvalid && (
                  <div className="text-xs text-[var(--state-danger-text)] flex items-center gap-1 pt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>请输入有效的 36 位 UUID 格式</span>
                  </div>
                )}
              </div>

              {/* Evidence (Strict UUID) */}
              <div className="space-y-1">
                <label
                  htmlFor="create-evidence-id-input"
                  className="text-[var(--text-secondary)] flex items-center gap-1.5 font-[var(--font-weight-medium)]"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--authority-verified-text)]" />
                  <span>实证记录 UUID (Evidence Record UUID)</span>
                </label>
                <input
                  id="create-evidence-id-input"
                  type="text"
                  value={evidenceIdInput}
                  aria-invalid={isEvidenceInvalid ? "true" : undefined}
                  onChange={(e) => setEvidenceIdInput(e.target.value)}
                  placeholder="输入实证 36 位 UUID (可选)"
                  data-testid="create-evidence-id-input"
                  className={`w-full px-2.5 py-1.5 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border font-mono text-[var(--text-primary)] min-h-[var(--touch-target-min)] ${
                    isEvidenceInvalid
                      ? "border-[var(--state-danger-border)] text-[var(--state-danger-text)]"
                      : "border-[var(--border-default)]"
                  }`}
                />
                {isEvidenceInvalid && (
                  <div className="text-xs text-[var(--state-danger-text)] flex items-center gap-1 pt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>请输入有效的 36 位 UUID 格式</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </form>
    </BaseModal>
  );
}

export function ArtifactCreateModal(props: ArtifactCreateModalProps) {
  if (!props.open) return null;
  return <ArtifactCreateModalInner key="modal-open" {...props} />;
}
