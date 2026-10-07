"use client";

import { useEffect, useState } from "react";
import { BaseModal, SecondaryButton } from "@/components/ui";
import type { MilestoneView, SourceReward } from "@/lib/milestone/types";
import { dateText, ErrorNotice, errorOf, isObject, JsonText, milestoneRequest } from "./client";

const rewardLabels = new Map([
  ["NOT_ISSUED", "本成就未结算奖励"], ["ISSUED", "关联奖励已发放"],
  ["CORRECTED", "关联奖励已修正"], ["NOT_AVAILABLE", "现实自述 · 不发积分"],
]);
export function SourceRewardNotice({ reward, candidate = false }: { reward: SourceReward | null; candidate?: boolean }) {
  if (!reward) return null;
  return <div className="space-y-1 text-sm text-[var(--text-secondary)]">
    <p>{candidate ? "来源已有奖励（只读；关联情况请查看成就详情）" : "独立来源奖励（只读，未关联本成就）"}：原发放 {reward.transaction.amount} 积分{reward.correction ? "，已经修正" : "，不可重复发放"}。</p>
    <p>原始交易：{reward.transaction.id}{reward.correction ? `；冲正：${reward.correction.id}（${reward.correction.amount}）` : ""}</p>
  </div>;
}
export function RewardFacts({ milestone }: { milestone: MilestoneView }) {
  const reward = milestone.reward;
  return <div className="space-y-2 text-sm">
    <p>{rewardLabels.get(reward.status) ?? "奖励状态待核对"}</p>
    {reward.transaction && <p>原始发放：{reward.transaction.amount} 积分 · {reward.transaction.id}</p>}
    {reward.correction && <p>已冲正：{reward.correction.amount} 积分 · {reward.correction.id}。保留原始发放与关联信息，不会重新发奖。</p>}
    <SourceRewardNotice reward={reward.existingSourceReward} />
  </div>;
}
export function MilestoneFacts({ milestone: m }: { milestone: MilestoneView }) {
  return <div className="min-w-0 space-y-4 text-sm [overflow-wrap:anywhere]">
    <h3 className="whitespace-pre-wrap font-serif text-xl">{m.title}</h3>
    <p>{m.recognition_class === "USER_CONFIRMED_REAL_WORLD" ? "现实成就 · 用户自述，未经独立验证" : "Core 成就 · 系统规则核验"} · {m.status === "REVOKED" ? "已撤销" : "有效"}</p>
    <p className="whitespace-pre-wrap">{m.description || "未填写说明。"}</p>
    <dl className="space-y-2">
      <div><dt>成就编号 / 分类标识</dt><dd>{m.id} / {m.milestone_key}</dd></div>
      <div><dt>原始来源</dt><dd>{m.source_type} / {m.source_id}</dd></div>
      <div><dt>认定时间</dt><dd>{dateText(m.recognized_at)}</dd></div>
      <div><dt>证据链接（仅文本，不访问或验证）</dt><dd className="whitespace-pre-wrap">{m.external_evidence_url ?? "未填写"}</dd></div>
      <div><dt>外部凭据说明（未验证）</dt><dd className="whitespace-pre-wrap">{m.external_credential_id ?? "未填写"}</dd></div>
      {m.status === "REVOKED" && <><div><dt>撤销时间</dt><dd>{dateText(m.revoked_at)}</dd></div><div><dt>撤销原因</dt><dd className="whitespace-pre-wrap">{m.revocation_reason}</dd></div></>}
    </dl>
    <RewardFacts milestone={m} />
    <details><summary className="cursor-pointer py-2">完整原始记录与奖励来源</summary><JsonText value={m} /></details>
  </div>;
}
export function MilestoneDetails({ id, onClose }: { id: string; onClose: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ attempt: number; milestone?: MilestoneView; error?: Error } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void milestoneRequest<{ milestone: MilestoneView }>(`/api/milestones/${id}`, { signal: controller.signal }).then(body => {
      if (!isObject(body.milestone) || body.milestone.id !== id || !isObject(body.milestone.reward)) throw new Error("详情响应无效，请重新读取。");
      if (!controller.signal.aborted) setState({ attempt, milestone: body.milestone });
    }).catch(cause => { if (!controller.signal.aborted) setState({ attempt, error: errorOf(cause) }); });
    return () => controller.abort();
  }, [id, attempt]);
  const current = state?.attempt === attempt ? state : null;
  return <BaseModal open title="成就详情" onClose={onClose} footer={<SecondaryButton onClick={onClose}>关闭</SecondaryButton>}>
    {!current && <p role="status">正在读取成就详情…</p>}
    <ErrorNotice error={current?.error ?? null} retry={() => setAttempt(value => value + 1)} />
    {current?.milestone && <MilestoneFacts milestone={current.milestone} />}
  </BaseModal>;
}
