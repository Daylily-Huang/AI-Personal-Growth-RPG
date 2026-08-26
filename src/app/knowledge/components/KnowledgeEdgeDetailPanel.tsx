// src/app/knowledge/components/KnowledgeEdgeDetailPanel.tsx
// Stage 6C Edge Detail & Epistemic Rationale Drawer (Right Drawer, 380px)

import { useEffect, useState } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  Sparkles,
  Archive,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Check,
  ThumbsDown,
  Activity,
  FileCode,
} from "lucide-react";
import type { KnowledgeEdgeDetailResponse } from "@/lib/knowledge/types";
import {
  fetchEdgeDetail,
  verifyKnowledgeEdge,
  rejectKnowledgeEdge,
} from "./controller";
import {
  getAuthorityVisual,
  formatSourceType,
} from "./presentation";

export interface KnowledgeEdgeDetailPanelProps {
  edgeId: string;
  onClose: () => void;
  onSelectNode: (nodeId: string) => void;
  onDataChanged: () => void;
}

export default function KnowledgeEdgeDetailPanel({
  edgeId,
  onClose,
  onSelectNode,
  onDataChanged,
}: KnowledgeEdgeDetailPanelProps) {
  const [data, setData] = useState<KnowledgeEdgeDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authority Actions
  const [verifying, setVerifying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetchEdgeDetail(edgeId).then((res) => {
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
  }, [edgeId]);

  async function handleVerify() {
    setVerifying(true);
    setActionError(null);
    setActionSuccess(null);

    const res = await verifyKnowledgeEdge(edgeId);
    setVerifying(false);

    if (!res.success) {
      if (res.status === 409) {
        setActionError("当前状态无法验证：关系可能已被验证或状态已变更 (409 Conflict)");
      } else {
        setActionError(res.error || "验证失败");
      }
      return;
    }

    setActionSuccess("已成功将关系晋级为已验证事实 [VERIFIED]！");
    onDataChanged();

    fetchEdgeDetail(edgeId).then((r) => {
      if (r.data) setData(r.data);
    });
  }

  async function handleReject() {
    setRejecting(true);
    setActionError(null);
    setActionSuccess(null);

    const res = await rejectKnowledgeEdge(edgeId);
    setRejecting(false);

    if (!res.success) {
      if (res.status === 409) {
        setActionError("当前状态无法否决：关系状态已变更 (409 Conflict)");
      } else {
        setActionError(res.error || "否决失败");
      }
      return;
    }

    setActionSuccess("已成功否决该 AI 提案关系 [REJECTED]");
    onDataChanged();

    fetchEdgeDetail(edgeId).then((r) => {
      if (r.data) setData(r.data);
    });
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        <p className="mt-2 text-xs">正在加载关系详情与认知审计…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-zinc-400">
        <AlertTriangle className="h-8 w-8 text-rose-400" />
        <p className="mt-2 text-xs text-rose-300">{error || "无法加载连边详情"}</p>
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

  const { edge, provenance } = data;
  const authority = getAuthorityVisual(
    edge.verificationStatus,
    edge.isArchived,
    edge.confidence,
  );

  return (
    <div
      data-testid="knowledge-edge-detail-panel"
      className="flex h-full flex-col overflow-y-auto bg-[#0d1320] text-zinc-200"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0d1320]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
            知识关联 (Edge)
          </span>

          <div
            data-testid="edge-authority-badge"
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
          data-testid="close-edge-detail-btn"
          onClick={onClose}
          aria-label="关闭连边详情"
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
            data-testid="edge-action-success"
            className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-2.5 text-emerald-300"
          >
            <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div
            data-testid="edge-action-error"
            className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 p-2.5 text-rose-300"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Source -> Relation -> Target Display */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
            关联两端节点
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => onSelectNode(edge.sourceNodeId)}
              className="flex items-center justify-between rounded-lg bg-sky-950/30 p-2.5 text-left border border-sky-500/20 hover:bg-sky-900/30 transition-colors"
            >
              <span className="font-semibold text-sky-200 truncate">
                {edge.sourceNodeTitle}
              </span>
              <span className="text-[9px] font-mono text-zinc-500 ml-2 shrink-0">起点 (Source)</span>
            </button>

            <div className="flex items-center justify-center gap-2 py-1">
              <span className="rounded-full bg-purple-950 px-3 py-1 font-mono text-[10px] font-bold text-purple-300 border border-purple-500/30">
                {edge.relationType.toUpperCase()}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-zinc-500" />
            </div>

            <button
              type="button"
              onClick={() => onSelectNode(edge.targetNodeId)}
              className="flex items-center justify-between rounded-lg bg-emerald-950/30 p-2.5 text-left border border-emerald-500/20 hover:bg-emerald-900/30 transition-colors"
            >
              <span className="font-semibold text-emerald-200 truncate">
                {edge.targetNodeTitle}
              </span>
              <span className="text-[9px] font-mono text-zinc-500 ml-2 shrink-0">终点 (Target)</span>
            </button>
          </div>
        </div>

        {/* Epistemic Provenance Rationale Note */}
        <div className="rounded-lg border border-white/10 bg-black/30 p-3">
          <div className="mb-2 flex items-center justify-between font-semibold uppercase tracking-wider text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
              关系推论与依据 (Epistemic Rationale)
            </span>
            <span className="text-[10px] text-zinc-500 font-normal">
              {formatSourceType(edge.sourceType)}
            </span>
          </div>

          <div className="rounded bg-black/50 p-2.5 text-zinc-300 leading-relaxed border border-white/5 whitespace-pre-wrap">
            {edge.provenanceNote || (
              <span className="italic text-zinc-600">无直接推论依据记录</span>
            )}
          </div>
        </div>

        {/* Provenance Activities & Artifacts (if any) */}
        {(provenance.sourceActivity || provenance.sourceArtifact) && (
          <div className="rounded-lg border border-white/5 bg-black/20 p-3 space-y-2">
            <div className="font-semibold uppercase tracking-wider text-[11px] text-zinc-400">
              关联来源记录
            </div>
            {provenance.sourceActivity && (
              <div className="flex items-center gap-2 rounded bg-sky-950/20 p-2 border border-sky-500/10 text-sky-200">
                <Activity className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                <span className="truncate">{provenance.sourceActivity.title}</span>
              </div>
            )}
            {provenance.sourceArtifact && (
              <div className="flex items-center gap-2 rounded bg-purple-950/20 p-2 border border-purple-500/10 text-purple-200">
                <FileCode className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                <span className="truncate">{provenance.sourceArtifact.title}</span>
              </div>
            )}
          </div>
        )}

        {/* Verify / Reject Actions for Inferred Edge */}
        {edge.verificationStatus === "inferred" && (
          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="font-semibold uppercase tracking-wider text-[11px] text-zinc-400 mb-2">
              关系认识论决策
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="verify-edge-btn"
                onClick={handleVerify}
                disabled={verifying || rejecting}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {verifying ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                验证该关系
              </button>

              <button
                type="button"
                data-testid="reject-edge-btn"
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
          </div>
        )}
      </div>
    </div>
  );
}
