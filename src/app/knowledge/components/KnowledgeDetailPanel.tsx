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
      <div className="flex h-full flex-col items-center justify-center p-6 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        <p className="mt-2 text-xs">正在加载节点详情与溯源审计…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-zinc-400">
        <AlertTriangle className="h-8 w-8 text-rose-400" />
        <p className="mt-2 text-xs text-rose-300">{error || "无法加载节点详情"}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
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
      className="flex h-full flex-col overflow-y-auto bg-[#0d1320] text-zinc-200"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0d1320]/95 px-4 py-3 backdrop-blur">
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
              <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            )}
            {authority.iconName === "Sparkles" && (
              <Sparkles className="h-3 w-3 text-amber-400" />
            )}
            {authority.iconName === "Archive" && (
              <Archive className="h-3 w-3 text-zinc-400" />
            )}
            <span>{authority.label}</span>
          </div>
        </div>

        <button
          type="button"
          data-testid="close-detail-btn"
          onClick={onClose}
          aria-label="关闭详情面板"
          className="rounded p-1 text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
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
            className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-2.5 text-emerald-300"
          >
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div
            data-testid="action-error-alert"
            className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 p-2.5 text-rose-300"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
        )}

        {/* 1. What is this? */}
        <div>
          <h2 data-testid="detail-title" className="text-base font-bold leading-snug text-zinc-100">
            {node.title}
          </h2>
          <div className="mt-2 text-zinc-400 whitespace-pre-wrap leading-relaxed">
            {node.description || <span className="italic text-zinc-600">暂无详细描述阐释</span>}
          </div>
        </div>

        {/* 2. Where does it belong? */}
        <div className="rounded-lg border border-white/5 bg-black/20 p-3">
          <div className="mb-2 font-semibold uppercase tracking-wider text-[11px] text-zinc-400">
            知识归属与技能关联
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-sky-300 bg-sky-950/50 border border-sky-800/40 rounded px-2 py-1">
              <span>领域:</span>
              <span className="font-semibold">{node.domainName || "未指定领域"}</span>
            </div>
            {node.skillName && (
              <a
                href="/skills"
                className="flex items-center gap-1 text-emerald-300 bg-emerald-950/50 border border-emerald-800/40 rounded px-2 py-1 hover:bg-emerald-900/60"
              >
                <span>技能:</span>
                <span className="font-semibold">{node.skillName}</span>
                <ExternalLink className="h-3 w-3 ml-0.5" />
              </a>
            )}
          </div>
        </div>

        {/* 3. Why does the system believe this? (Provenance Box) */}
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="mb-2 flex items-center justify-between font-semibold uppercase tracking-wider text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
              溯源证据审计 (Provenance & Evidence)
            </span>
            <span className="text-[10px] text-zinc-500 font-normal">
              {formatSourceType(node.sourceType)}
            </span>
          </div>

          {!hasProvenance ? (
            <div
              data-testid="empty-provenance-box"
              className="rounded border border-dashed border-zinc-700/60 p-3 text-center text-zinc-500 italic"
            >
              无直接关联的行为或产出物记录 (手动录入或无溯源)
            </div>
          ) : (
            <div className="space-y-2">
              {/* Linked Activity */}
              {provenance.sourceActivity && (
                <div
                  data-testid="provenance-activity-card"
                  className="flex items-start gap-2.5 rounded-lg border border-sky-500/20 bg-sky-950/20 p-2.5"
                >
                  <Activity className="h-4 w-4 mt-0.5 shrink-0 text-sky-400" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sky-200 truncate">
                      {provenance.sourceActivity.title}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
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
                  className="flex items-start gap-2.5 rounded-lg border border-purple-500/20 bg-purple-950/20 p-2.5"
                >
                  <FileCode className="h-4 w-4 mt-0.5 shrink-0 text-purple-400" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-purple-200 truncate">
                      {provenance.sourceArtifact.title}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      产出物类型: {provenance.sourceArtifact.type}
                    </div>
                  </div>
                </div>
              )}

              {/* Evidence Records (E0~E6) */}
              {provenance.evidenceRecords.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <div className="text-[10px] font-semibold text-zinc-400">真实证据链:</div>
                  {provenance.evidenceRecords.map((ev) => (
                    <div
                      key={ev.id}
                      data-testid={`evidence-record-${ev.id}`}
                      className="flex items-start gap-2 rounded bg-black/40 p-2 text-[11px] border border-white/5"
                    >
                      <span className="rounded bg-emerald-950 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400 border border-emerald-600/40">
                        {ev.type}
                      </span>
                      <span className="flex-1 text-zinc-300 leading-snug">{ev.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. What is connected? */}
        <div className="space-y-3">
          <div className="font-semibold uppercase tracking-wider text-[11px] text-zinc-400">
            图谱连接 (Connections)
          </div>

          {/* Inbound */}
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">
              前置 / 支撑来源 (Inbound: {connections.inbound.length})
            </div>
            {connections.inbound.length === 0 ? (
              <div className="text-zinc-600 italic">暂无上游前置</div>
            ) : (
              <div className="space-y-1">
                {connections.inbound.map((conn) => (
                  <button
                    key={conn.edgeId}
                    type="button"
                    onClick={() => onSelectNode(conn.sourceNodeId)}
                    className="flex w-full items-center justify-between rounded bg-black/20 px-2.5 py-1.5 text-left text-xs hover:bg-white/5 border border-white/5"
                  >
                    <span className="text-zinc-200 truncate">{conn.sourceNodeTitle}</span>
                    <span className="text-[9px] font-mono rounded bg-sky-950 px-1.5 py-0.5 text-sky-400 border border-sky-800/40 shrink-0 ml-2">
                      {conn.relationType}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Outbound */}
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">
              下游延伸 / 包含 (Outbound: {connections.outbound.length})
            </div>
            {connections.outbound.length === 0 ? (
              <div className="text-zinc-600 italic">暂无下游节点</div>
            ) : (
              <div className="space-y-1">
                {connections.outbound.map((conn) => (
                  <button
                    key={conn.edgeId}
                    type="button"
                    onClick={() => onSelectNode(conn.targetNodeId)}
                    className="flex w-full items-center justify-between rounded bg-black/20 px-2.5 py-1.5 text-left text-xs hover:bg-white/5 border border-white/5"
                  >
                    <span className="text-zinc-200 truncate">{conn.targetNodeTitle}</span>
                    <span className="text-[9px] font-mono rounded bg-purple-950 px-1.5 py-0.5 text-purple-400 border border-purple-800/40 shrink-0 ml-2">
                      {conn.relationType}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 5. How can I manage it? (Authority & Management CTAs) */}
        <div className="space-y-2 border-t border-white/10 pt-4">
          <div className="font-semibold uppercase tracking-wider text-[11px] text-zinc-400">
            节点管理与认识论决策
          </div>

          {/* If Inferred -> Show Verify / Reject Actions */}
          {node.verificationStatus === "inferred" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="verify-node-btn"
                onClick={handleVerify}
                disabled={verifying || rejecting}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {verifying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                验证该节点
              </button>

              <button
                type="button"
                data-testid="reject-node-btn"
                onClick={handleReject}
                disabled={verifying || rejecting}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/40 py-2 font-semibold text-rose-300 hover:bg-rose-900/60 disabled:opacity-50"
              >
                {rejecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ThumbsDown className="h-3.5 w-3.5" />
                )}
                否决提案
              </button>
            </div>
          )}

          {/* Progressive Ego-Graph Launch CTA */}
          <button
            type="button"
            data-testid="expand-as-root-btn"
            onClick={() => onFocusRoot(node.id)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/40"
          >
            <Network className="h-3.5 w-3.5" />
            以此为焦点展开局部图谱 (Expand Ego Graph)
          </button>

          {/* Edit Metadata Modal Trigger */}
          <button
            type="button"
            data-testid="open-edit-modal-btn"
            onClick={() => setEditModalOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-black/20 py-2 text-xs text-zinc-300 hover:bg-white/5 hover:text-zinc-100"
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
