"use client";

import { useEffect, useState } from "react";
import { PrimaryButton, SecondaryButton, SectionCard } from "@/components/ui";
import type { Wish } from "@/lib/reward/types";
import type { RewardIntent } from "./RewardConfirmation";
import { ErrorNotice, dateText, errorOf, fieldClass, labelClass, MoreButton, rewardRequest, rowClass, useRewardPage } from "./client";

interface CostProposal {
  id: string; status: string; payload: Record<string, unknown>; source_refs: unknown;
  expires_at: string | null; created_at: string; resulting_entity_id: string | null;
}
function ProposalCard({ proposal, wish, onConfirm }: { proposal: CostProposal; wish: Wish; onConfirm: (intent: RewardIntent) => void }) {
  const [checked, setChecked] = useState(false);
  const [cost, setCost] = useState(String(proposal.payload.suggested_credits ?? ""));
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30000); return () => clearInterval(timer); }, []);
  const expired = proposal.expires_at !== null && !(Date.parse(proposal.expires_at) > clock);
  const editable = wish.status === "IDEA" || wish.status === "ACTIVE";
  const eligible = proposal.status === "PROPOSED" && !expired && editable;
  const costValid = Number.isInteger(Number(cost)) && Number(cost) > 0 && Number(cost) <= 2147483647;
  const suggested = proposal.payload.suggested_credits;
  const suggestionValid = typeof suggested === "number" && Number.isInteger(suggested) && suggested > 0 && suggested <= 2147483647;
  function review(decision: "ACCEPTED" | "EDITED" | "REJECTED") {
    onConfirm({ id: crypto.randomUUID(), keyName: "reviewRequestIdempotencyKey", path: `/api/outer-loop/proposals/${proposal.id}/review`,
      title: decision === "REJECTED" ? "拒绝定价建议" : "确认心愿定价",
      explanation: `${wish.title} · 提案 ${proposal.id}。${decision === "REJECTED" ? "只记录拒绝，不改变心愿或积分。" : `预算设为 ${decision === "EDITED" ? cost : suggested} 奖励积分。只修改预算，不领取、不预留、不兑换。`}`,
      body: { decision, ...(decision === "EDITED" ? { editedPayload: { ...proposal.payload, suggested_credits: Number(cost) } } : {}) },
      ...(decision === "REJECTED" ? { note: "rejectionReason" as const } : {}),
    });
  }
  return <article className={`${rowClass} space-y-3`} aria-label={`定价提案 ${proposal.id}`}>
    <p className="text-sm text-[var(--text-primary)]">建议成本：{String(suggested ?? "未提供")} 积分 · {proposal.status}</p>
    <p className="text-xs text-[var(--text-secondary)]">创建于 {dateText(proposal.created_at)}；{proposal.expires_at ? `到期 ${dateText(proposal.expires_at)}` : "未设到期时间"}</p>
    <details><summary className="min-h-[var(--touch-target-min)] cursor-pointer py-2 text-sm">查看原始提案与来源</summary>
      <pre tabIndex={0} className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-[var(--radius-sm)] bg-[var(--surface-ground)] p-3 text-xs text-[var(--text-primary)]">{JSON.stringify({ payload: proposal.payload, source_refs: proposal.source_refs, resulting_entity_id: proposal.resulting_entity_id }, null, 2)}</pre>
    </details>
    {proposal.status === "PROPOSED" && <>
      {!eligible && <p className="text-sm text-[var(--text-secondary)]">{expired ? "提案已过期，不能接受或拒绝。" : "心愿已锁定预算，当前不能接受或编辑定价。"}</p>}
      <label className="flex items-start gap-2 py-2 text-sm text-[var(--text-primary)]"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} />我已核对心愿、建议成本及提案原文</label>
      <label className={labelClass}>调整后的积分预算<input className={fieldClass} type="number" min={1} max={2147483647} step={1} value={cost} onChange={event => { setCost(event.target.value); setChecked(false); }} /></label>
      <div className="flex flex-wrap gap-2">
        <PrimaryButton size="sm" disabled={!eligible || !checked || !suggestionValid} onClick={() => review("ACCEPTED")}>接受建议</PrimaryButton>
        <SecondaryButton size="sm" disabled={!eligible || !checked || !costValid} onClick={() => review("EDITED")}>调整后接受</SecondaryButton>
        <SecondaryButton size="sm" disabled={expired} onClick={() => review("REJECTED")}>拒绝建议</SecondaryButton>
      </div>
    </>}
  </article>;
}
export function WishProposals({ id, revision, onConfirm, onClose }: {
  id: string; revision: number; onConfirm: (intent: RewardIntent) => void; onClose: () => void;
}) {
  const [detail, setDetail] = useState<{ revision: number; wish?: Wish; error?: Error } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const proposals = useRewardPage<CostProposal>(`/api/rewards/wishes/${id}/proposals`, "proposals", revision);
  useEffect(() => {
    const controller = new AbortController();
    void rewardRequest<{ wish: Wish }>(`/api/rewards/wishes/${id}`, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setDetail({ revision, wish: result.wish });
    }).catch(error => { if (!controller.signal.aborted) setDetail({ revision, error: errorOf(error) }); });
    return () => controller.abort();
  }, [id, revision, attempt]);
  const current = detail?.revision === revision ? detail : null;
  return <SectionCard title="心愿定价建议" action={<SecondaryButton size="sm" onClick={onClose}>收起建议</SecondaryButton>}>
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">AI 只提供提案。请先核对原文，再明确接受、调整或拒绝；这里不会生成新提案。</p>
      <ErrorNotice error={current?.error ?? proposals.error} retry={() => { setDetail(null); setAttempt(value => value + 1); proposals.retry(); }} />
      {!current && <p role="status">正在核对心愿状态…</p>}
      {current?.wish && <p className="font-medium [overflow-wrap:anywhere]">关联心愿：{current.wish.title} · {current.wish.id}</p>}
      {proposals.loading ? <p role="status">正在读取提案…</p> : !proposals.error && !proposals.items.length && <p className="text-sm text-[var(--text-secondary)]">这条心愿暂无定价建议，可以自行设置预算。</p>}
      {current?.wish && proposals.items.map(proposal => <ProposalCard key={`${proposal.id}:${revision}`} proposal={proposal} wish={current.wish!} onConfirm={onConfirm} />)}
      <MoreButton next={proposals.next} busy={proposals.moreBusy} onClick={() => void proposals.more()} />
    </div>
  </SectionCard>;
}
