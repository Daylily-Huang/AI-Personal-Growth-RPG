"use client";

import React, { useState } from "react";
import { ArtifactTypeBadge } from "./ArtifactTypeBadge";
import { StatusBadge, type KnowledgeAuthorityState } from "@/components/ui/StatusBadge";
import { ReusabilityMeter } from "@/components/ui/ReusabilityMeter";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { DangerButton } from "@/components/ui/DangerButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  onEdit?: () => void;
  onManageLinks?: () => void;
  onStatusChange?: (newStatus: ArtifactLifecycleStatus, isArchived: boolean) => Promise<void>;
  onDelete?: () => Promise<{ ok: boolean; error?: string; code?: string }>;
  loading?: boolean;
  className?: string;
}

export function ArtifactInspectorContent({
  detail,
  onEdit,
  onManageLinks,
  onStatusChange,
  onDelete,
  loading = false,
  className = "",
}: ArtifactInspectorContentProps) {
  const { artifact, links } = detail;

  // Accordion open/collapse states
  const [skillsOpen, setSkillsOpen] = useState(true);
  const [knowledgeOpen, setKnowledgeOpen] = useState(true);
  const [questsOpen, setQuestsOpen] = useState(true);
  const [activitiesOpen, setActivitiesOpen] = useState(true);
  const [evidenceOpen, setEvidenceOpen] = useState(true);

  // Dialog states
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<{ message: string; isProvenance: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isArchived = artifact.isArchived || artifact.lifecycleStatus === "archived";
  const isSuperseded = artifact.lifecycleStatus === "superseded";

  const handleToggleArchive = async () => {
    if (!onStatusChange || actionLoading) return;
    setActionLoading(true);
    try {
      if (isArchived) {
        await onStatusChange("active", false);
      } else {
        await onStatusChange("archived", true);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestoreSuperseded = async () => {
    if (!onStatusChange || actionLoading) return;
    setActionLoading(true);
    try {
      await onStatusChange("active", false);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDelete || actionLoading) return;
    setActionLoading(true);
    setDeleteError(null);
    try {
      const res = await onDelete();
      if (!res.ok) {
        const isProvenance = res.code === "referenced_by_provenance";
        setDeleteError({
          message: res.error || "删除失败，该造物可能已被其他记录引用",
          isProvenance,
        });
      } else {
        setDeleteConfirmOpen(false);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const metadataKeys = artifact.metadata ? Object.keys(artifact.metadata) : [];

  return (
    <div
      data-testid="artifact-inspector-content"
      className={`space-y-6 text-left ${className}`}
    >
      {/* 1. Header & Badges */}
      <div className="space-y-3 pb-4 border-b border-[var(--border-subtle)]">
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

        {artifact.externalUrl ? (
          <div className="pt-1">
            <a
              href={artifact.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="inspector-external-url"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--entity-artifact-text)] hover:underline focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] rounded-[var(--radius-sm)]"
              aria-label={`在新标签页中打开外部链接: ${artifact.externalUrl}`}
            >
              <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-[280px]">{artifact.externalUrl}</span>
            </a>
          </div>
        ) : null}
      </div>

      {/* 2. Reusability & Dates Meta */}
      <div className="space-y-3 p-4 rounded-[var(--radius-lg)] bg-[var(--surface-base)] border border-[var(--border-subtle)]">
        <div>
          <div className="text-xs font-[var(--font-weight-medium)] text-[var(--text-secondary)] mb-1.5">
            可复用性评级 (Reusability Score)
          </div>
          <ReusabilityMeter score={artifact.reusabilityScore} size="md" />
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
          <div>
            <span className="text-[var(--text-secondary)]">创建时间: </span>
            <span>{formatDate(artifact.createdAt)}</span>
          </div>
          <div>
            <span className="text-[var(--text-secondary)]">最后更新: </span>
            <span>{formatDate(artifact.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* 3. Summary & Description */}
      <div className="space-y-4">
        {artifact.summary ? (
          <div className="space-y-1.5">
            <h4 className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-secondary)] uppercase tracking-wider">
              成果摘要 (Summary)
            </h4>
            <div
              data-testid="inspector-artifact-summary"
              className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] leading-relaxed"
            >
              {artifact.summary}
            </div>
          </div>
        ) : null}

        {artifact.description ? (
          <div className="space-y-1.5">
            <h4 className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-secondary)] uppercase tracking-wider">
              详细描述与构件记录 (Description)
            </h4>
            <div
              data-testid="inspector-artifact-description"
              className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap"
            >
              {artifact.description}
            </div>
          </div>
        ) : null}

        {metadataKeys.length > 0 ? (
          <div className="space-y-1.5">
            <h4 className="text-xs font-[var(--font-weight-semibold)] text-[var(--text-secondary)] uppercase tracking-wider">
              元数据 (Metadata)
            </h4>
            <div
              data-testid="inspector-artifact-metadata"
              className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-ground)] border border-[var(--border-subtle)] space-y-1 text-xs"
            >
              {metadataKeys.map((k) => (
                <div key={k} className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[var(--text-secondary)]">{k}:</span>
                  <span className="font-mono text-[var(--text-primary)] text-right break-all">
                    {typeof artifact.metadata[k] === "object"
                      ? JSON.stringify(artifact.metadata[k])
                      : String(artifact.metadata[k])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* 4. 5 Relational Accordions */}
      <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <h4 className="font-serif font-[var(--font-weight-semibold)] text-sm text-[var(--text-primary)]">
            关联拓扑 (Relationships)
          </h4>
          {onManageLinks ? (
            <button
              type="button"
              onClick={onManageLinks}
              data-testid="inspector-manage-links-btn"
              className="inline-flex items-center gap-1 text-xs text-[var(--entity-artifact-text)] hover:underline cursor-pointer focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] rounded-[var(--radius-sm)]"
            >
              <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>管理关联</span>
            </button>
          ) : null}
        </div>

        {/* 4.1 Linked Skills Accordion */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-ground)]">
          <button
            type="button"
            onClick={() => setSkillsOpen((prev) => !prev)}
            data-testid="accordion-skills-toggle"
            className="w-full flex items-center justify-between p-3 text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[var(--entity-skill-text)]" aria-hidden="true" />
              <span>关联技能 ({links?.skills?.length || 0})</span>
            </span>
            {skillsOpen ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
          </button>
          {skillsOpen && (
            <div data-testid="accordion-skills-content" className="p-3 pt-0 space-y-2 border-t border-[var(--border-subtle)]">
              {links?.skills && links.skills.length > 0 ? (
                links.skills.map((skill) => (
                  <div
                    key={skill.id}
                    data-testid={`linked-skill-${skill.id}`}
                    className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{skill.name}</span>
                      <span className="text-[var(--text-muted)]">Lvl {skill.level}</span>
                    </div>
                    {/* Invariant: Demonstration Level (1..5) != M0-M10 Mastery */}
                    <span
                      data-testid="demonstration-level"
                      className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-mono bg-[var(--entity-skill-bg)] border border-[var(--entity-skill-border)] text-[var(--entity-skill-text)]"
                    >
                      示范等级 {skill.demonstrationLevel}/5
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-disabled)] italic py-1">暂无关联技能</div>
              )}
            </div>
          )}
        </div>

        {/* 4.2 Linked Knowledge Nodes Accordion */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-ground)]">
          <button
            type="button"
            onClick={() => setKnowledgeOpen((prev) => !prev)}
            data-testid="accordion-knowledge-toggle"
            className="w-full flex items-center justify-between p-3 text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Network className="w-3.5 h-3.5 text-[var(--entity-knowledge-text)]" aria-hidden="true" />
              <span>知识节点 ({links?.knowledgeNodes?.length || 0})</span>
            </span>
            {knowledgeOpen ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
          </button>
          {knowledgeOpen && (
            <div data-testid="accordion-knowledge-content" className="p-3 pt-0 space-y-2 border-t border-[var(--border-subtle)]">
              {links?.knowledgeNodes && links.knowledgeNodes.length > 0 ? (
                links.knowledgeNodes.map((node) => (
                  <div
                    key={node.id}
                    data-testid={`linked-knowledge-${node.id}`}
                    className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{node.title}</span>
                      <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-mono text-[var(--text-muted)] bg-[var(--surface-hover-neutral)]">
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

        {/* 4.3 Linked Quests Accordion */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-ground)]">
          <button
            type="button"
            onClick={() => setQuestsOpen((prev) => !prev)}
            data-testid="accordion-quests-toggle"
            className="w-full flex items-center justify-between p-3 text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Scroll className="w-3.5 h-3.5 text-[var(--entity-quest-text)]" aria-hidden="true" />
              <span>关联任务 ({links?.quests?.length || 0})</span>
            </span>
            {questsOpen ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
          </button>
          {questsOpen && (
            <div data-testid="accordion-quests-content" className="p-3 pt-0 space-y-2 border-t border-[var(--border-subtle)]">
              {links?.quests && links.quests.length > 0 ? (
                links.quests.map((quest) => (
                  <div
                    key={quest.id}
                    data-testid={`linked-quest-${quest.id}`}
                    className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs"
                  >
                    <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{quest.title}</span>
                    <div className="flex items-center gap-1.5">
                      {quest.isPrimaryDeliverable && (
                        <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-[var(--font-weight-semibold)] bg-[var(--entity-quest-bg)] border border-[var(--entity-quest-border)] text-[var(--entity-quest-text)]">
                          主交付物
                        </span>
                      )}
                      <span className="text-[var(--text-muted)] text-[11px]">{quest.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-disabled)] italic py-1">暂无关联任务</div>
              )}
            </div>
          )}
        </div>

        {/* 4.4 Linked Activities Accordion */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-ground)]">
          <button
            type="button"
            onClick={() => setActivitiesOpen((prev) => !prev)}
            data-testid="accordion-activities-toggle"
            className="w-full flex items-center justify-between p-3 text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[var(--entity-activity-text)]" aria-hidden="true" />
              <span>产出活动 ({links?.activities?.length || 0})</span>
            </span>
            {activitiesOpen ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
          </button>
          {activitiesOpen && (
            <div data-testid="accordion-activities-content" className="p-3 pt-0 space-y-2 border-t border-[var(--border-subtle)]">
              {links?.activities && links.activities.length > 0 ? (
                links.activities.map((act) => (
                  <div
                    key={act.id}
                    data-testid={`linked-activity-${act.id}`}
                    className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs"
                  >
                    <span className="font-[var(--font-weight-medium)] text-[var(--text-primary)]">{act.title}</span>
                    <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-mono text-[var(--entity-activity-text)] bg-[var(--entity-activity-bg)] border border-[var(--entity-activity-border)]">
                      {act.activityRole}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-disabled)] italic py-1">暂无产出活动记录</div>
              )}
            </div>
          )}
        </div>

        {/* 4.5 Linked Evidence Accordion */}
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-ground)]">
          <button
            type="button"
            onClick={() => setEvidenceOpen((prev) => !prev)}
            data-testid="accordion-evidence-toggle"
            className="w-full flex items-center justify-between p-3 text-xs font-[var(--font-weight-medium)] text-[var(--text-primary)] hover:bg-[var(--surface-hover-neutral)] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--entity-evidence-text)]" aria-hidden="true" />
              <span>佐证实证 ({links?.evidence?.length || 0})</span>
            </span>
            {evidenceOpen ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />}
          </button>
          {evidenceOpen && (
            <div data-testid="accordion-evidence-content" className="p-3 pt-0 space-y-2 border-t border-[var(--border-subtle)]">
              {links?.evidence && links.evidence.length > 0 ? (
                links.evidence.map((ev) => (
                  <div
                    key={ev.id}
                    data-testid={`linked-evidence-${ev.id}`}
                    className="flex items-center justify-between p-2 rounded-[var(--radius-sm)] bg-[var(--surface-base)] border border-[var(--border-subtle)] text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-mono font-bold bg-[var(--entity-evidence-bg)] border border-[var(--entity-evidence-border)] text-[var(--entity-evidence-text)]">
                        E{ev.evidenceLevel}
                      </span>
                      <span className="truncate text-[var(--text-secondary)]">{ev.description || "实证证据"}</span>
                    </div>
                    {ev.verified && (
                      <span className="px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[10px] text-[var(--state-success-text)] bg-[var(--state-success-bg)]">
                        已验证
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--text-disabled)] italic py-1">暂无实证记录关联</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 5. Action Controls Footer */}
      <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {onEdit && (
            <SecondaryButton
              onClick={onEdit}
              icon={<Edit3 className="w-4 h-4" />}
              data-testid="inspector-edit-btn"
              disabled={loading || actionLoading}
            >
              编辑详情
            </SecondaryButton>
          )}

          {onStatusChange && (
            <SecondaryButton
              onClick={handleToggleArchive}
              icon={<Archive className="w-4 h-4" />}
              data-testid="inspector-archive-toggle-btn"
              disabled={loading || actionLoading}
              loading={actionLoading}
            >
              {isArchived ? "恢复造物 (Unarchive)" : "归档造物 (Archive)"}
            </SecondaryButton>
          )}

          {isSuperseded && onStatusChange && (
            <SecondaryButton
              onClick={handleRestoreSuperseded}
              icon={<RotateCcw className="w-4 h-4" />}
              data-testid="inspector-restore-superseded-btn"
              disabled={loading || actionLoading}
              loading={actionLoading}
            >
              恢复为生效 (Restore)
            </SecondaryButton>
          )}
        </div>

        {onDelete && (
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <DangerButton
              onClick={() => {
                setDeleteError(null);
                setDeleteConfirmOpen(true);
              }}
              icon={<Trash2 className="w-4 h-4" />}
              data-testid="inspector-delete-btn"
              disabled={loading || actionLoading}
            >
              删除造物 (Delete)
            </DangerButton>
          </div>
        )}
      </div>

      {/* 6. Delete Confirmation Dialog with Provenance Check */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="确认删除造物"
        destructive={true}
        loading={actionLoading}
        confirmLabel="确认删除"
        cancelLabel="取消"
        description={
          deleteError ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--state-danger-bg)] border border-[var(--state-danger-border)] text-[var(--state-danger-text)] text-xs leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <div className="font-[var(--font-weight-semibold)]">无法物理删除此造物</div>
                  <div className="mt-1">{deleteError.message}</div>
                </div>
              </div>
              {deleteError.isProvenance && (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  💡 提示：该造物已作为底层知识谱系证据或实证凭据，强行删除将破坏证据链完整性。建议使用<strong>“归档造物”</strong>将其移出活跃工作区。
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p>
                您确定要删除造物 <strong>“{artifact.title}”</strong> 吗？
              </p>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                此操作将物理清除该造物及其非主权关联关系。如果造物被知识库实证直接引用，系统将拒绝删除以保护证据链完整性。
              </p>
            </div>
          )
        }
      />
    </div>
  );
}
