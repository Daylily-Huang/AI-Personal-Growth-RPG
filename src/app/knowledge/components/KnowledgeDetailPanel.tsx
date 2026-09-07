import LinkedSkillSummary from "./LinkedSkillSummary";
import { BaseModal } from "@/components/ui/BaseModal";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import Link from "next/link";
// src/app/knowledge/components/KnowledgeDetailPanel.tsx
// Stage 6C Node Detail & Provenance Audit Panel (Right Drawer, 380px)

import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  Sparkles,
  Archive,
  BookOpen,
  Quote,
  FolderTree,
  ExternalLink,
  Activity,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  Network,
  Edit3,
  Check,
  ThumbsDown,
} from "lucide-react";
import type { KnowledgeNodeDetailResponse } from "@/lib/knowledge/types";
import {
  fetchNodeDetail,
  verifyKnowledgeNode,
  rejectKnowledgeNode,
} from "./controller";
import {
  getAuthorityVisual,
  getNodeTypeVisual,
  formatSourceType,
} from "./presentation";
import EditNodeMetadataModal from "./EditNodeMetadataModal";
import type { DomainItem } from "./KnowledgeFilterPanel";

export interface KnowledgeDetailPanelProps {
  nodeId: string;
  domains: DomainItem[];
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onFocusRoot: (nodeId: string) => void;
  onDataChanged: () => void;
}

export default function KnowledgeDetailPanel({
  nodeId,
  domains,
  onClose,
  onSelectNode,
  onFocusRoot,
  onDataChanged,
}: KnowledgeDetailPanelProps) {
  const [data, setData] = useState<KnowledgeNodeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Confirmation UX States (P1-3)
  const [confirmVerifyOpen, setConfirmVerifyOpen] = useState(false);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);

  // Authority Action States
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    fetchNodeDetail(nodeId).then((res) => {
      if (ignore) return;
      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        setData(res.data);
      }
    });

    return () => {
      ignore = true;
    };
  }, [nodeId]);

  async function handleVerify() {
    setVerifying(true);
    setActionError(null);
    setActionSuccess(null);
    setConfirmVerifyOpen(false);

    const res = await verifyKnowledgeNode(nodeId);
    setVerifying(false);

    if (!res.success) {
      if (res.status === 409) {
        setActionError("当前状态无法验证：节点可能已被他人验证或状态已变更 (409 Conflict)");
      } else {
        setActionError(res.error || "验证失败");
      }
      return;
    }

    setActionSuccess("已成功将节点晋级为已验证事实 [VERIFIED]！");
    onDataChanged();

    // Reload detail
    fetchNodeDetail(nodeId).then((r) => {
      if (r.data) setData(r.data);
    });
  }

  async function handleReject() {
    setRejecting(true);
    setActionError(null);
    setActionSuccess(null);
    setConfirmRejectOpen(false);

    const res = await rejectKnowledgeNode(nodeId);
    setRejecting(false);

    if (!res.success) {
      if (res.status === 409) {
        setActionError("当前状态无法否决：节点可能已变更 (409 Conflict)");
      } else {
        setActionError(res.error || "否决失败");
      }
      return;
    }

    setActionSuccess("已成功否决该 AI 提案节点 [REJECTED]");
    onDataChanged();

    // Reload detail
    fetchNodeDetail(nodeId).then((r) => {
      if (r.data) setData(r.data);
    });
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-[var(--text-secondary)]">
        <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none text-[var(--authority-verified-text)]" />
        <p className="mt-2 text-xs">正在加载节点详情与溯源审计…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-[var(--text-secondary)]">
        <AlertTriangle className="h-8 w-8 text-[var(--state-danger-text)]" />
        <p className="mt-2 text-xs text-[var(--state-danger-text)]">{error || "无法加载节点详情"}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-ground)]"
        >
          关闭面板
        </button>
      </div>
    );
  }

  const { node, provenance, connections } = data;
  const authority = getAuthorityVisual(
    node.verificationStatus,
    node.isArchived,
    node.confidence,
  );
  const typeVisual = getNodeTypeVisual(node.nodeType);

  const hasProvenance =
    provenance.sourceActivity !== null ||
    provenance.sourceArtifact !== null ||
    provenance.evidenceRecords.length > 0;

  return (
    <div
      data-testid="knowledge-detail-panel"
      className="flex h-full flex-col overflow-y-auto bg-[var(--surface-base)] text-[var(--text-primary)]"
    >
      {/* Header */}
      <div className="sticky top-0 z-[var(--z-canvas)] flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-base)] px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-1.5">
          <div
            className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium ${typeVisual.headerBgClass}`}
          >
            {node.nodeType === "concept" && <BookOpen className="h-3 w-3" />}
            {node.nodeType === "claim" && <Quote className="h-3 w-3" />}
            {node.nodeType === "topic" && <FolderTree className="h-3 w-3" />}
            <span>{typeVisual.label}</span>
          </div>

          <div
            data-testid="detail-authority-badge"
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${authority.badgeClass}`}
          >
            {authority.iconName === "CheckCircle2" && (
              <CheckCircle2 className="h-3 w-3 text-[var(--authority-verified-text)]" />
            )}
            {authority.iconName === "Sparkles" && (
              <Sparkles className="h-3 w-3 text-[var(--authority-inferred-text)]" />
            )}
            {authority.iconName === "Archive" && (
              <Archive className="h-3 w-3 text-[var(--text-secondary)]" />
            )}
            <span>{authority.label}</span>
          </div>
        </div>

        <button
          type="button"
          data-testid="close-detail-btn"
          onClick={onClose}
          aria-label="关闭详情面板"
          className="min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="space-y-6 p-4 text-xs">
        {/* Action Feedbacks */}
        {actionSuccess && (
          <div
            data-testid="action-success-alert"
            className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2.5 text-[var(--authority-verified-text)]"
          >
            <Check className="h-4 w-4 shrink-0 text-[var(--authority-verified-text)]" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div
            data-testid="action-error-alert"
            className="flex items-center gap-2 rounded-lg border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] p-2.5 text-[var(--state-danger-text)]"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--state-danger-text)]" />
            <span>{actionError}</span>
          </div>
        )}

        {/* 1. What is this? */}
        <div>
          <h2 data-testid="detail-title" className="text-base font-bold leading-snug text-[var(--text-primary)]">
            {node.title}
          </h2>
          <div className="mt-2 text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
            {node.description || <span className="italic text-[var(--text-secondary)]">暂无详细描述阐释</span>}
          </div>
        </div>

        {/* 2. Where does it belong? */}
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-ground)] p-3">
          <div className="mb-2 font-semibold uppercase tracking-wider text-[11px] text-[var(--text-secondary)]">
            知识归属与技能关联
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-[var(--entity-knowledge-text)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded px-2 py-1">
              <span>领域:</span>
              <span className="font-semibold">{node.domainName || "未指定领域"}</span>
            </div>
            {node.skillName && (
              <Link
                href="/skills"
                className="inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center gap-1 text-[var(--authority-verified-text)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] rounded px-2 py-1 hover:bg-[var(--surface-raised)]"
              >
                <span>技能:</span>
                <span className="font-semibold">{node.skillName}</span>
                <ExternalLink className="h-3 w-3 ml-0.5" />
              </Link>
            )}
          </div>
        </div>

        {node.skillId && <LinkedSkillSummary key={node.skillId} skillId={node.skillId} />}
        <ConfidenceBadge variant="knowledge" score={node.confidence} />

        {/* 3. Why does the system believe this? (Provenance Box) */}
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-ground)] p-3">
          <div className="mb-2 flex items-center justify-between font-semibold uppercase tracking-wider text-[11px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--entity-knowledge-text)]" />
              溯源证据审计 (Provenance & Evidence)
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] font-normal">
              {formatSourceType(node.sourceType)}
            </span>
          </div>

          {!hasProvenance ? (
            <div
              data-testid="empty-provenance-box"
              className="rounded border border-dashed border-[var(--border-subtle)] p-3 text-center text-[var(--text-secondary)] italic"
            >
              无直接关联的行为或产出物记录 (手动录入或无溯源)
            </div>
          ) : (
            <div className="space-y-2">
              {/* Linked Activity */}
              {provenance.sourceActivity && (
                <div
                  data-testid="provenance-activity-card"
                  className="flex items-start gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2.5"
                >
                  <Activity className="h-4 w-4 mt-0.5 shrink-0 text-[var(--entity-knowledge-text)]" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[var(--entity-knowledge-text)] truncate">
                      {provenance.sourceActivity.title}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      类型: {provenance.sourceActivity.activityType} • 完成时间:{" "}
                      {new Date(provenance.sourceActivity.completedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Linked Artifact */}
              {provenance.sourceArtifact && (
                <div
                  data-testid="provenance-artifact-card"
                  className="flex items-start gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-2.5"
                >
                  <FileCode className="h-4 w-4 mt-0.5 shrink-0 text-[var(--entity-artifact-text)]" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-[var(--entity-artifact-text)] truncate">
                      {provenance.sourceArtifact.title}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      产出物类型: {provenance.sourceArtifact.type}
                    </div>
                    <Link href="/artifacts" className="inline-flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center underline text-[var(--text-secondary)]">前往产物档案库</Link>
                  </div>
                </div>
              )}

              {/* Evidence Records (E0~E6) */}
              {provenance.evidenceRecords.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="text-[10px] font-semibold text-[var(--text-secondary)]">真实证据链:</div>
                  {provenance.evidenceRecords.map((ev) => (
                    <div
                      key={ev.id}
                      data-testid={`evidence-record-${ev.id}`}
                      className="flex items-start gap-2 rounded bg-[var(--surface-ground)] p-2 text-[11px] border border-[var(--border-subtle)]"
                    >
                      <span className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-[var(--authority-verified-text)] border border-[var(--border-subtle)]">
                        {ev.type}
                      </span>
                      <span className="flex-1 text-[var(--text-secondary)] leading-snug">{ev.content}<span className="block text-[var(--text-secondary)]">{ev.verified ? "已验证证据" : "未验证证据"}</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. What is connected? */}
        <div className="space-y-3">
          <div className="font-semibold uppercase tracking-wider text-[11px] text-[var(--text-secondary)]">
            图谱连接 (Connections)
          </div>

          {/* Inbound */}
          <div>
            <div className="text-[10px] text-[var(--text-secondary)] mb-1">
              前置 / 支撑来源 (Inbound: {connections.inbound.length})
            </div>
            {connections.inbound.length === 0 ? (
              <div className="text-[var(--text-secondary)] italic">暂无上游前置</div>
            ) : (
              <div className="space-y-1">
                {connections.inbound.map((conn) => (
                  <button
                    key={conn.edgeId}
                    type="button"
                    onClick={() => onSelectNode(conn.sourceNodeId)}
                    className="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] w-full items-center justify-between rounded bg-[var(--surface-ground)] px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-ground)] border border-[var(--border-subtle)]"
                  >
                    <span className="text-[var(--text-primary)] truncate">{conn.sourceNodeTitle}</span>
                    <span className="text-[9px] font-mono rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[var(--entity-knowledge-text)] border border-[var(--border-subtle)] shrink-0 ml-2">
                      {conn.relationType}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Outbound */}
          <div>
            <div className="text-[10px] text-[var(--text-secondary)] mb-1">
              下游延伸 / 包含 (Outbound: {connections.outbound.length})
            </div>
            {connections.outbound.length === 0 ? (
              <div className="text-[var(--text-secondary)] italic">暂无下游节点</div>
            ) : (
              <div className="space-y-1">
                {connections.outbound.map((conn) => (
                  <button
                    key={conn.edgeId}
                    type="button"
                    onClick={() => onSelectNode(conn.targetNodeId)}
                    className="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] w-full items-center justify-between rounded bg-[var(--surface-ground)] px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-ground)] border border-[var(--border-subtle)]"
                  >
                    <span className="text-[var(--text-primary)] truncate">{conn.targetNodeTitle}</span>
                    <span className="text-[9px] font-mono rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[var(--entity-artifact-text)] border border-[var(--border-subtle)] shrink-0 ml-2">
                      {conn.relationType}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 5. How can I manage it? (Authority & Management CTAs) */}
        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
          <div className="font-semibold uppercase tracking-wider text-[11px] text-[var(--text-secondary)]">
            节点管理与认识论决策
          </div>

          {/* If Inferred -> Show Verify / Reject Actions & Confirmation Modals */}
          {node.verificationStatus === "inferred" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="verify-node-btn"
                  onClick={() => {
                    setConfirmVerifyOpen(true);
                    setConfirmRejectOpen(false);
                  }}
                  disabled={verifying || rejecting}
                  className="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-lg bg-[var(--surface-raised)] py-2 font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-raised)] disabled:opacity-50"
                >
                  {verifying ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  验证该节点
                </button>

                <button
                  type="button"
                  data-testid="reject-node-btn"
                  onClick={() => {
                    setConfirmRejectOpen(true);
                    setConfirmVerifyOpen(false);
                  }}
                  disabled={verifying || rejecting}
                  className="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] items-center justify-center gap-1.5 rounded-lg border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] py-2 font-semibold text-[var(--state-danger-text)] hover:bg-[var(--state-danger-bg)] disabled:opacity-50"
                >
                  {rejecting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <ThumbsDown className="h-3.5 w-3.5" />
                  )}
                  否决提案
                </button>
              </div>

              {/* Node Verify Confirmation Modal */}
              <BaseModal open={confirmVerifyOpen} onClose={() => setConfirmVerifyOpen(false)} title="确认验证">
                <div
                  data-testid="node-verify-confirm-modal"
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3"
                >
                  <div className="font-semibold text-[var(--authority-verified-text)]">
                    确认将该 AI 提案节点晋级为已验证事实？
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    置信度将提升至 100% [VERIFIED]，此认识论决策将记入永久系统审计。
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      data-testid="cancel-verify-node-btn"
                      onClick={() => setConfirmVerifyOpen(false)}
                      className="min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] rounded border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      data-testid="confirm-verify-node-btn"
                      onClick={handleVerify}
                      className="min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] rounded bg-[var(--surface-raised)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                    >
                      确认验证
                    </button>
                  </div>
                </div>
              </BaseModal>

              {/* Node Reject Confirmation Modal */}
              <BaseModal open={confirmRejectOpen} onClose={() => setConfirmRejectOpen(false)} title="确认否决">
                <div
                  data-testid="node-reject-confirm-modal"
                  className="rounded-lg border border-[var(--state-danger-border)] bg-[var(--state-danger-bg)] p-3"
                >
                  <div className="font-semibold text-[var(--state-danger-text)]">
                    确认否决该 AI 提案节点？
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    否决后该节点将变更为 [REJECTED]，不再作为有效事实呈现在活跃图谱中。
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      data-testid="cancel-reject-node-btn"
                      onClick={() => setConfirmRejectOpen(false)}
                      className="min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] rounded border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      data-testid="confirm-reject-node-btn"
                      onClick={handleReject}
                      className="min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] rounded bg-[var(--state-danger-bg)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--state-danger-bg)]"
                    >
                      确认否决
                    </button>
                  </div>
                </div>
              </BaseModal>
            </div>
          )}

          {/* Progressive Ego-Graph Launch CTA */}
          <button
            type="button"
            data-testid="expand-as-root-btn"
            onClick={() => onFocusRoot(node.id)}
            className="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-2 text-xs font-semibold text-[var(--authority-verified-text)] hover:bg-[var(--surface-raised)]"
          >
            <Network className="h-3.5 w-3.5" />
            以此为焦点展开局部图谱 (Expand Ego Graph)
          </button>

          {/* Edit Metadata Modal Trigger */}
          <button
            type="button"
            data-testid="open-edit-modal-btn"
            onClick={() => setEditModalOpen(true)}
            className="flex min-h-[var(--touch-target-min)] min-w-[var(--touch-target-min)] w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-ground)] py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-ground)] hover:text-[var(--text-primary)]"
          >
            <Edit3 className="h-3.5 w-3.5" />
            编辑节点元数据
          </button>
        </div>
      </div>

      {/* Edit Metadata Modal */}
      <EditNodeMetadataModal
        nodeId={node.id}
        initialTitle={node.title}
        initialDescription={node.description}
        initialDomainId={node.domainId}
        initialIsArchived={node.isArchived}
        domains={domains}
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          onDataChanged();
          fetchNodeDetail(nodeId).then((r) => {
            if (r.data) setData(r.data);
          });
        }}
      />
    </div>
  );
}
