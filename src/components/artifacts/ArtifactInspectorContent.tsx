"use client";

import React, { useState, useId } from "react";
import { ArtifactTypeBadge } from "./ArtifactTypeBadge";
import { StatusBadge, type KnowledgeAuthorityState } from "@/components/ui/StatusBadge";
import { ReusabilityMeter } from "@/components/ui/ReusabilityMeter";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { DangerButton } from "@/components/ui/DangerButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
  ExternalLink,
  Edit3,
  Link2,
  Archive,
  RotateCcw,
  Trash2,
  Sparkles,
  Network,
  Scroll,
  Zap,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import type {
  ArtifactDetail,
  ArtifactLifecycleStatus,
} from "@/types/artifact";

export interface ArtifactInspectorContentProps {
  detail: ArtifactDetail;
  onEdit?: (artifactId: string) => void;
  onManageLinks?: (artifactId: string) => void;
  onStatusChange?: (
    artifactId: string,
    newStatus: ArtifactLifecycleStatus,
    isArchived: boolean
  ) => Promise<void>;
  onDelete?: (artifactId: string) => Promise<{
    ok: boolean;
    error?: string;
    code?: string;
  }>;
  className?: string;
}

export function ArtifactInspectorContent({
  detail,
  onEdit,
  onManageLinks,
  onStatusChange,
  onDelete,
  className = "",
}: ArtifactInspectorContentProps) {
  const { artifact, links } = detail;
  const artifactId = artifact.id;

  // Accordion open states
  const [skillsOpen, setSkillsOpen] = useState(true);
  const [knowledgeOpen, setKnowledgeOpen] = useState(true);
  const [questsOpen, setQuestsOpen] = useState(true);
  const [activitiesOpen, setActivitiesOpen] = useState(true);
  const [evidenceOpen, setEvidenceOpen] = useState(true);

  // Dialog & Action States
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<{
    message: string;
    code?: string;
  } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const skillsRegionId = useId();
  const knowledgeRegionId = useId();
  const questsRegionId = useId();
  const activitiesRegionId = useId();
  const evidenceRegionId = useId();

  const handleConfirmArchive = async () => {
    if (!onStatusChange) return;
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      await onStatusChange(artifactId, "archived", true);
      setArchiveDialogOpen(false);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "归档操作失败");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRestore = async () => {
    if (!onStatusChange) return;
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      await onStatusChange(artifactId, "active", false);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "恢复操作失败");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await onDelete(artifactId);
      if (!res.ok) {
        setDeleteError({
          message: res.error || "删除操作失败",
          code: res.code,
        });
      } else {
        setDeleteDialogOpen(false);
      }
    } catch (err) {
      setDeleteError({
        message: err instanceof Error ? err.message : "网络错误，删除失败",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      data-testid="artifact-inspector-content"
      data-artifact-id={artifactId}
      className={`space-y-6 text-left ${className}`}
    >
      {/* Error feedback banner */}
      {statusError && (
        <div
          data-testid="inspector-status-error"
          className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-border)] text-[var(--state-danger-text)] text-xs"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{statusError}</span>
        </div>
      )}

      {/* 1. Header: Type, Version & Status */}
      <div className="space-y-3 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ArtifactTypeBadge type={artifact.artifactType} />
            {artifact.version ? (
              <span
                data-testid="inspector-artifact-version"
                className="px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-hover-neutral)] border border-[var(--border-subtle)]"
              >
                v{artifact.version.replace(/^v/i, "")}
              </span>
            ) : null}
          </div>
          <StatusBadge type="artifactLifecycle" state={artifact.lifecycleStatus} />
        </div>

        <h2
          data-testid="inspector-artifact-title"
          className="font-serif font-[var(--font-weight-bold)] text-xl text-[var(--text-primary)] tracking-[var(--tracking-wide)] leading-snug"
        >
          {artifact.title}
        </h2>

        {artifact.externalUrl && (
          <a
            href={artifact.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="inspector-external-url"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--entity-artifact-text)] hover:underline break-all"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            <span>{artifact.externalUrl}</span>
          </a>
        )}
      </div>

      {/* 2. Reusability Meter */}
      <div className="space-y-2 p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface-ground)] border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)]">
            可复用性评分 (Reusability Score)
          </span>
          <span className="font-mono text-xs text-[var(--text-primary)] font-[var(--font-weight-semibold)]">
            {Number(artifact.reusabilityScore).toFixed(2)}
          </span>
        </div>
        <ReusabilityMeter score={artifact.reusabilityScore} showLabel={false} />
      </div>

      {/* 3. Summary & Description with Safe Markdown Rendering */}
      {artifact.summary && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-muted)] uppercase tracking-wider">
            成果摘要 (Summary)
          </h4>
          <div
            data-testid="inspector-artifact-summary"
            className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
          >
            <MarkdownRenderer content={artifact.summary} />
          </div>
        </div>
      )}

      {artifact.description && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-muted)] uppercase tracking-wider">
            详细记录 (Description / Markdown)
          </h4>
          <div
            data-testid="inspector-artifact-description"
            className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
          >
            <MarkdownRenderer content={artifact.description} />
          </div>
        </div>
      )}

      {/* 4. Action Toolbar */}
      <div className="flex items-center flex-wrap gap-2.5 pt-2 border-t border-[var(--border-subtle)]">
        {onEdit && (
          <SecondaryButton
            size="sm"
            onClick={() => onEdit(artifactId)}
            icon={<Edit3 className="w-3.5 h-3.5" />}
            data-testid="inspector-edit-btn"
          >
            编辑造物
          </SecondaryButton>
        )}

        {onManageLinks && (
          <SecondaryButton
            size="sm"
            onClick={() => onManageLinks(artifactId)}
            icon={<Link2 className="w-3.5 h-3.5" />}
            data-testid="inspector-manage-links-btn"
          >
            管理关联拓扑
          </SecondaryButton>
        )}

        {onStatusChange && (
          artifact.lifecycleStatus === "archived" ? (
            <SecondaryButton
              size="sm"
              onClick={handleRestore}
              disabled={isUpdatingStatus}
              loading={isUpdatingStatus}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              data-testid="inspector-restore-btn"
            >
              恢复生效
            </SecondaryButton>
          ) : (
            <SecondaryButton
              size="sm"
              onClick={() => setArchiveDialogOpen(true)}
              disabled={isUpdatingStatus}
              loading={isUpdatingStatus}
              icon={<Archive className="w-3.5 h-3.5" />}
              data-testid="inspector-archive-toggle-btn"
            >
              归档造物
            </SecondaryButton>
          )
        )}

        {onDelete && (
          <DangerButton
            size="sm"
            onClick={() => {
              setDeleteError(null);
              setDeleteDialogOpen(true);
            }}
            icon={<Trash2 className="w-3.5 h-3.5" />}
            data-testid="inspector-delete-btn"
          >
            删除
          </DangerButton>
        )}
      </div>

      {/* 5. Relational Accordions */}
      <div className="space-y-3 pt-2">
        <h3 className="font-serif font-[var(--font-weight-semibold)] text-sm text-[var(--text-primary)]">
          关联拓扑 (Relational Topology)
        </h3>

        {/* Accordion 1: Skills */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-base)]">
          <button
            type="button"
            onClick={() => setSkillsOpen(!skillsOpen)}
            aria-expanded={skillsOpen}
            aria-controls={skillsRegionId}
            data-testid="accordion-skills-toggle"
            className="w-full flex items-center justify-between p-3 text-left hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--entity-skill-text)]" />
              <span className="text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                关联技能 (Skills: {links.skills.length})
              </span>
            </div>
            {skillsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {skillsOpen && (
            <div
              id={skillsRegionId}
              role="region"
              aria-label="关联技能列表"
              data-testid="accordion-skills-content"
              className="p-3 pt-0 border-t border-[var(--border-subtle)] space-y-2"
            >
              {links.skills.length > 0 ? (
                links.skills.map((skill) => (
                  <div
                    key={skill.id}
                    className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--surface-ground)] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                        {skill.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-hover-neutral)]">
                        Lv.{skill.level}
                      </span>
                    </div>
                    <span
                      data-testid="demonstration-level"
                      className="px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono text-[var(--entity-skill-text)] bg-[var(--entity-skill-bg)] border border-[var(--entity-skill-border)]"
                    >
                      示范等级 {skill.demonstrationLevel}/5
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-disabled)] italic py-1">暂无技能关联</div>
              )}
            </div>
          )}
        </div>

        {/* Accordion 2: Knowledge Nodes */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-base)]">
          <button
            type="button"
            onClick={() => setKnowledgeOpen(!knowledgeOpen)}
            aria-expanded={knowledgeOpen}
            aria-controls={knowledgeRegionId}
            data-testid="accordion-knowledge-toggle"
            className="w-full flex items-center justify-between p-3 text-left hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 text-[var(--entity-knowledge-text)]" />
              <span className="text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                知识节点 (Knowledge Nodes: {links.knowledgeNodes.length})
              </span>
            </div>
            {knowledgeOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {knowledgeOpen && (
            <div
              id={knowledgeRegionId}
              role="region"
              aria-label="知识节点列表"
              data-testid="accordion-knowledge-content"
              className="p-3 pt-0 border-t border-[var(--border-subtle)] space-y-2"
            >
              {links.knowledgeNodes.length > 0 ? (
                links.knowledgeNodes.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--surface-ground)] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{node.title}</span>
                      <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-hover-neutral)]">
                        {node.relationType}
                      </span>
                    </div>
                    <StatusBadge
                      type="knowledgeAuthority"
                      state={
                        (node.verificationStatus === "verified" ||
                        node.verificationStatus === "inferred" ||
                        node.verificationStatus === "rejected" ||
                        node.verificationStatus === "superseded"
                          ? node.verificationStatus
                          : "verified") as KnowledgeAuthorityState
                      }
                    />
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-disabled)] italic py-1">暂无知识节点关联</div>
              )}
            </div>
          )}
        </div>

        {/* Accordion 3: Quests */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-base)]">
          <button
            type="button"
            onClick={() => setQuestsOpen(!questsOpen)}
            aria-expanded={questsOpen}
            aria-controls={questsRegionId}
            data-testid="accordion-quests-toggle"
            className="w-full flex items-center justify-between p-3 text-left hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Scroll className="w-4 h-4 text-[var(--entity-quest-text)]" />
              <span className="text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                关联任务 (Quests: {links.quests.length})
              </span>
            </div>
            {questsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {questsOpen && (
            <div
              id={questsRegionId}
              role="region"
              aria-label="关联任务列表"
              data-testid="accordion-quests-content"
              className="p-3 pt-0 border-t border-[var(--border-subtle)] space-y-2"
            >
              {links.quests.length > 0 ? (
                links.quests.map((quest) => (
                  <div
                    key={quest.id}
                    className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--surface-ground)] text-xs"
                  >
                    <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                      {quest.title}
                    </span>
                    {quest.isPrimaryDeliverable && (
                      <span className="px-2 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono text-[var(--entity-quest-text)] bg-[var(--entity-quest-bg)] border border-[var(--entity-quest-border)]">
                        主交付物
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-disabled)] italic py-1">暂无任务关联</div>
              )}
            </div>
          )}
        </div>

        {/* Accordion 4: Activities */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-base)]">
          <button
            type="button"
            onClick={() => setActivitiesOpen(!activitiesOpen)}
            aria-expanded={activitiesOpen}
            aria-controls={activitiesRegionId}
            data-testid="accordion-activities-toggle"
            className="w-full flex items-center justify-between p-3 text-left hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--entity-activity-text)]" />
              <span className="text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                沉淀活动 (Activities: {links.activities.length})
              </span>
            </div>
            {activitiesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {activitiesOpen && (
            <div
              id={activitiesRegionId}
              role="region"
              aria-label="沉淀活动列表"
              data-testid="accordion-activities-content"
              className="p-3 pt-0 border-t border-[var(--border-subtle)] space-y-2"
            >
              {links.activities.length > 0 ? (
                links.activities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--surface-ground)] text-xs"
                  >
                    <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                      {act.title}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono text-[var(--text-muted)] bg-[var(--surface-hover-neutral)]">
                      {act.activityRole}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-disabled)] italic py-1">暂无活动关联</div>
              )}
            </div>
          )}
        </div>

        {/* Accordion 5: Evidence */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-base)]">
          <button
            type="button"
            onClick={() => setEvidenceOpen(!evidenceOpen)}
            aria-expanded={evidenceOpen}
            aria-controls={evidenceRegionId}
            data-testid="accordion-evidence-toggle"
            className="w-full flex items-center justify-between p-3 text-left hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--authority-verified-text)]" />
              <span className="text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)]">
                实证记录 (Evidence Records: {links.evidence.length})
              </span>
            </div>
            {evidenceOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {evidenceOpen && (
            <div
              id={evidenceRegionId}
              role="region"
              aria-label="实证记录列表"
              data-testid="accordion-evidence-content"
              className="p-3 pt-0 border-t border-[var(--border-subtle)] space-y-2"
            >
              {links.evidence.length > 0 ? (
                links.evidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--surface-ground)] text-xs gap-2"
                  >
                    <span className="text-[var(--text-primary)] line-clamp-2">
                      {ev.description}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-xs font-mono text-[var(--authority-verified-text)] bg-[var(--authority-verified-bg)] border border-[var(--authority-verified-border)] shrink-0">
                      E{ev.evidenceLevel}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-disabled)] italic py-1">暂无实证关联</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 6. Archive Confirmation Dialog */}
      <ConfirmDialog
        open={archiveDialogOpen}
        onClose={() => {
          if (!isUpdatingStatus) setArchiveDialogOpen(false);
        }}
        onConfirm={handleConfirmArchive}
        title="确认归档造物"
        description="归档后该造物将移至历史成果档案库，但保留所有关联拓扑数据。您可以随时将其恢复为生效状态。"
        confirmLabel="确认归档"
        cancelLabel="取消"
        loading={isUpdatingStatus}
      />

      {/* 7. Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!isDeleting) setDeleteDialogOpen(false);
        }}
        onConfirm={handleConfirmDelete}
        title="确认删除造物"
        description={
          <div className="space-y-3">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              您确定要物理删除该造物吗？此操作不可逆。如果该造物已被知识图谱证据链或实证记录引用，出于系统可审计原则将禁止删除。
            </p>

            {deleteError && (
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-border)] text-[var(--state-danger-text)] text-xs space-y-1">
                <div className="font-[var(--font-weight-semibold)] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {deleteError.code === "referenced_by_provenance"
                    ? "无法物理删除此造物"
                    : "删除失败"}
                </div>
                <div>{deleteError.message}</div>
                {deleteError.code === "referenced_by_provenance" && (
                  <div className="text-[var(--text-muted)] pt-1 text-xs">
                    建议使用「归档造物」功能将其移至历史库，同时保留证据链审计。
                  </div>
                )}
              </div>
            )}
          </div>
        }
        confirmLabel="确认删除"
        cancelLabel="取消"
        destructive={true}
        loading={isDeleting}
      />
    </div>
  );
}
