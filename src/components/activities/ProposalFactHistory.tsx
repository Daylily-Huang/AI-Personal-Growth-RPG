"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { loadProposalHistory, proposalEditClientMessage } from "@/lib/proposal-edit/client";
import type { ProposalFactHistoryView } from "@/lib/proposal-edit/types";
const control = "min-h-[var(--touch-target-min)] rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring-color)] disabled:opacity-50";
const statusLabels = { pending: "待确认", confirmed: "已确认", edited: "已编辑", rejected: "已拒绝", superseded: "已被替换" };
function HistoryPage({ activityId }: { activityId: string }) {
  const [page, setPage] = useState<ProposalFactHistoryView | null>(null), [error, setError] = useState<string | null>(null), [loading, setLoading] = useState(true);
  const controller = useRef<AbortController | null>(null), alive = useRef(false), lock = useRef(false);
  const load = useCallback(async (after: string | null) => {
    if (lock.current) return; lock.current = true;
    const request = new AbortController(); controller.current = request; setLoading(true); setError(null);
    try { const value = await loadProposalHistory(activityId, after, request.signal); if (alive.current && !request.signal.aborted) setPage(value); }
    catch (cause) { if (alive.current && !request.signal.aborted) setError(proposalEditClientMessage(cause)); }
    finally { request.abort(); lock.current = false; if (alive.current) setLoading(false); }
  }, [activityId]);
  useEffect(() => {
    alive.current = true;
    // Async entry keeps the read lifetime owned by this explicitly-open panel.
    void Promise.resolve().then(() => { if (alive.current) void load(null); });
    return () => { alive.current = false; controller.current?.abort(); };
  }, [load]);
  return <div className="min-w-0 space-y-3">
    {loading && <p role="status">正在读取修正历史…</p>}
    {error && <div><p role="alert">{error}</p><button type="button" className={control} disabled={loading} onClick={() => { void load(null); }}>重新读取修正历史</button></div>}
    {page?.items.length === 0 && <p>尚无成功的事实修正版本。原始记录仍保留。</p>}
    {page?.items.map(item => <article key={item.id} className="min-w-0 space-y-2 rounded-lg border border-[var(--border-subtle)] p-3 text-sm [overflow-wrap:anywhere]">
      <h3>修正版本 {item.id}</h3><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
      <p className="whitespace-pre-wrap">{item.facts.description}</p>
      <p>总分钟：{item.facts.totalMinutes ?? "未知"}；有效分钟：{item.facts.effectiveMinutes ?? "未知"}</p>
      <p>技能线索：{item.facts.relatedSkillIds.join("、") || "未指定"}</p>
      <p>原建议：{item.baseAssessmentId}；新建议：{item.resultAssessmentId}；状态：{statusLabels[item.assessmentStatus]}</p>
      <p>来源模型：{item.modelName}；提示词：{item.promptVersion}；规则：{item.rulesVersion}</p>
      <p>请求：{item.requestId}；前版本：{item.previousRevisionId ?? "首版"}</p>
    </article>)}
    {page?.nextCursor && <button type="button" className={control} disabled={loading} onClick={() => { void load(page.nextCursor); }}>下一页修正历史</button>}
  </div>;
}
export function ProposalFactHistory({ activityId }: { activityId: string }) {
  const [open, setOpen] = useState(false);
  return <section aria-label="修正与重新评估历史" className="min-w-0 space-y-3 rounded-xl border border-[var(--border-subtle)] p-4">
    <h2 className="font-serif text-lg font-semibold">修正与重新评估历史</h2>
    <p className="text-sm">原始事实不覆盖；历史版本仅记录重新评估，不代表已确认 XP。</p>
    <button type="button" className={control} aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? "关闭修正历史" : "查看修正历史"}</button>
    {open && <HistoryPage key={activityId} activityId={activityId} />}
  </section>;
}
