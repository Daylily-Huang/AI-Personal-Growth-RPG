"use client";

import { useEffect, useRef, useState } from "react";
import { PrimaryButton, SecondaryButton, SectionCard } from "@/components/ui";
import type { CoreSource, MilestoneProposal, MilestoneSource, MilestoneView, ProposalDecision } from "@/lib/milestone/types";
import { cardClass, dateText, ErrorNotice, fieldClass, JsonText, labelClass, MoreButton, useMilestonePage } from "./client";
import { MilestoneCommand, type MilestoneIntent, proposalReviewable } from "./MilestoneCommand";
import { MilestoneDetails, RewardFacts, SourceRewardNotice } from "./MilestoneDetails";

const proposalLabels = new Map([["PROPOSED", "待审核"], ["ACCEPTED", "已接受"], ["EDITED", "编辑后接受"], ["REJECTED", "已拒绝"]]);
const decisionLabels: Record<ProposalDecision, string> = { ACCEPTED: "接受提案", EDITED: "编辑后接受", REJECTED: "拒绝提案" };

export default function MilestonesClient() {
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState("");
  const [recognitionClass, setRecognitionClass] = useState("");
  const [sourceType, setSourceType] = useState<CoreSource>("QUEST");
  const [threshold, setThreshold] = useState("6");
  const [proposalStatus, setProposalStatus] = useState("");
  const [intent, setIntent] = useState<MilestoneIntent | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const focusNotice = useRef(false);
  const resumeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const dismissFocus = useRef<"resume" | "opener" | null>(null);
  const records = useMilestonePage<MilestoneView>(`/api/milestones?${new URLSearchParams({ ...(status ? { status } : {}), ...(recognitionClass ? { recognitionClass } : {}) })}`, "milestones", revision);
  const sources = useMilestonePage<MilestoneSource>(`/api/milestones/sources?sourceType=${sourceType}${sourceType === "MASTERY" ? `&threshold=${threshold}` : ""}`, "sources", revision);
  const proposals = useMilestonePage<MilestoneProposal>(`/api/milestones/proposals${proposalStatus ? `?status=${proposalStatus}` : ""}`, "proposals", revision);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (focusNotice.current) { noticeRef.current?.focus(); focusNotice.current = false; } }, [revision]);
  useEffect(() => {
    if (!commandOpen && dismissFocus.current) {
      if (dismissFocus.current === "resume") resumeRef.current?.focus();
      else if (openerRef.current && document.body.contains(openerRef.current)) openerRef.current.focus();
      dismissFocus.current = null;
    }
  }, [commandOpen, intent]);
  function refresh() { setRevision(value => value + 1); }
  function start(next: MilestoneIntent) {
    if (intent) return;
    setNotice("");
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIntent(next); setPending(false); setCommandOpen(true);
  }
  function completed() {
    setIntent(null); setCommandOpen(false); setPending(false);
    setNotice("操作已完成。正在重新读取成就与历史；读取失败请只重试读取，不必再次提交操作。");
    focusNotice.current = true; refresh();
  }
  function endRejected() {
    setIntent(null); setCommandOpen(false); setPending(false);
    setNotice("本次尝试已结束。请先核对最新记录，再决定是否发起新操作。");
    focusNotice.current = true; refresh();
  }
  return <div className="flex min-w-0 flex-col gap-6 text-[var(--text-primary)]" data-testid="milestones-workspace">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-2"><p className="text-xs tracking-widest text-[var(--text-secondary)]">REWARDS · MILESTONES</p>
        <h1 className="font-serif text-3xl">让值得记住的成长，留下记录</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">认定是一份记录，不等于领取奖励。Core 成就按规则核验；现实成就是你的自述，暂不发积分。撤销保留历史，不改变 XP、掌握度或原始成长事实。</p>
        <p className="text-sm text-[var(--text-secondary)]">Artifact（作品与产物）的成就认定和奖励均暂缓，原有作品与证据仍然保留。</p>
      </div>
      <div className="flex flex-wrap gap-2"><SecondaryButton onClick={refresh}>刷新数据</SecondaryButton>
        <PrimaryButton disabled={Boolean(intent)} onClick={() => start({ id: crypto.randomUUID(), kind: "confirm", source: null, realitySourceId: crypto.randomUUID() })}>记录现实成就</PrimaryButton></div>
    </header>
    {notice && <p ref={noticeRef} role="status" tabIndex={-1} className="rounded-[var(--radius-sm)] text-sm focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]">{notice}</p>}
    {pending && !commandOpen && <div role="status" className={cardClass}>
      <p>有一项已提交的操作尚待核对。原请求保留在当前页面，不会通过新请求重复执行。</p>
      <SecondaryButton ref={resumeRef} onClick={() => setCommandOpen(true)}>继续核对原请求</SecondaryButton>
    </div>}
    <SectionCard title="成就记录" subtitle="有效与撤销历史 · 不修改原始认定">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>记录状态<select className={fieldClass} value={status} onChange={event => setStatus(event.target.value)}><option value="">全部状态</option><option value="ACTIVE">有效</option><option value="REVOKED">已撤销</option></select></label>
          <label className={labelClass}>认定类别<select className={fieldClass} value={recognitionClass} onChange={event => setRecognitionClass(event.target.value)}><option value="">全部类别</option><option value="CORE_VERIFIED">Core 规则核验</option><option value="USER_CONFIRMED_REAL_WORLD">现实自述</option></select></label>
        </div>
        <ErrorNotice error={records.error} retry={records.retry} />
        {records.loading && <p role="status">正在读取成就记录…</p>}
        {!records.loading && !records.error && !records.items.length && <p className="text-sm text-[var(--text-secondary)]">当前筛选下还没有成就。你可以核对下方 Core 候选，或记录一项现实经历。</p>}
        {records.items.map(m => <article key={m.id} aria-label={`成就 ${m.title}`} className={cardClass}>
          <div className="space-y-2"><p className="text-xs text-[var(--text-secondary)]">{m.recognition_class === "CORE_VERIFIED" ? "Core 规则核验" : "现实自述 · 未经独立验证"} · {m.status === "REVOKED" ? "已撤销" : "有效"}</p>
            <h2 className="whitespace-pre-wrap font-serif text-xl">{m.title}</h2><p className="whitespace-pre-wrap text-sm">{m.description || "未填写说明。"}</p>
            <p className="text-xs text-[var(--text-secondary)]">{m.source_type} / {m.source_id} · {dateText(m.recognized_at)}</p>
          </div>
          <RewardFacts milestone={m} />
          {m.status === "REVOKED" && <p className="whitespace-pre-wrap text-sm">撤销原因：{m.revocation_reason} · {dateText(m.revoked_at)}</p>}
          <div className="flex flex-wrap gap-2">
            <SecondaryButton size="sm" onClick={() => setDetailId(m.id)}>查看详情</SecondaryButton>
            {m.status === "ACTIVE" && m.recognition_class === "CORE_VERIFIED" && m.reward.status === "NOT_ISSUED" && !m.reward.existingSourceReward && <SecondaryButton size="sm" disabled={Boolean(intent)} onClick={() => start({ id: crypto.randomUUID(), kind: "settle", milestone: m })}>结算奖励</SecondaryButton>}
            {m.status === "ACTIVE" && <SecondaryButton size="sm" disabled={Boolean(intent)} onClick={() => start({ id: crypto.randomUUID(), kind: "revoke", milestone: m })}>撤销认定</SecondaryButton>}
          </div>
        </article>)}
        <MoreButton next={records.next} busy={records.moreBusy} onClick={records.more} />
      </div>
    </SectionCard>
    <SectionCard title="Core 成就候选" subtitle="仅供发现 · 确认时由服务器重新核验">
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">任务需已完成且属于 Epic / Main 或 Boss；赛季需完成并有 FINAL 复盘；掌握度需对应阈值的已验证证据，不能只凭当前等级。确认不会自动发奖。</p>
        <div className="grid gap-3 sm:grid-cols-2"><label className={labelClass}>候选来源<select className={fieldClass} value={sourceType} onChange={event => setSourceType(event.target.value as CoreSource)}><option value="QUEST">合格任务</option><option value="SEASON">已完成赛季</option><option value="MASTERY">已验证掌握度</option></select></label>
          {sourceType === "MASTERY" && <label className={labelClass}>验证阈值<select className={fieldClass} value={threshold} onChange={event => setThreshold(event.target.value)}>{[6, 8, 10].map(value => <option key={value} value={value}>M{value}</option>)}</select></label>}</div>
        <ErrorNotice error={sources.error} retry={sources.retry} />
        {sources.loading && <p role="status">正在读取候选来源…</p>}
        {!sources.loading && !sources.error && !sources.items.length && <p className="text-sm text-[var(--text-secondary)]">该类别暂无符合条件的来源。不必为了成就重复打卡或补做无意义任务。</p>}
        {sources.items.map(source => <article key={source.id} aria-label={`候选 ${source.label}`} className={cardClass}>
          <h2 className="whitespace-pre-wrap font-serif text-lg">{source.label}</h2>
          <p className="text-xs text-[var(--text-secondary)]">{source.sourceType} / {source.sourceId}</p>
          <SourceRewardNotice reward={source.existingSourceReward} candidate />
          {source.recognition ? <><p className="text-sm">该来源已有{source.recognition.status === "REVOKED" ? "撤销的" : "有效的"}成就，不会重复认定。</p><SecondaryButton size="sm" onClick={() => setDetailId(source.recognition!.id)}>查看已有成就</SecondaryButton></>
            : <SecondaryButton size="sm" disabled={Boolean(intent)} onClick={() => start({ id: crypto.randomUUID(), kind: "confirm", source })}>核对并认定</SecondaryButton>}
        </article>)}
        <MoreButton next={sources.next} busy={sources.moreBusy} onClick={sources.more} />
      </div>
    </SectionCard>
    <SectionCard title="成就提案与历史" subtitle="AI 仅提议 · 你的明确确认才会认定">
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">本页读取已有提案，不会自动生成或审核。模型信息与原始来源是追溯材料，不代表独立验证；接受或编辑后接受也不会发积分。</p>
        <label className={labelClass}>提案状态<select className={fieldClass} value={proposalStatus} onChange={event => setProposalStatus(event.target.value)}><option value="">全部历史</option>{Array.from(proposalLabels, ([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <ErrorNotice error={proposals.error} retry={proposals.retry} />
        {proposals.loading && <p role="status">正在读取成就提案…</p>}
        {!proposals.loading && !proposals.error && !proposals.items.length && <p className="text-sm text-[var(--text-secondary)]">当前没有此类提案。仍可手动核对 Core 候选或记录现实成就。</p>}
        {proposals.items.map(proposal => <article key={proposal.id} aria-label={`成就提案 ${proposal.id}`} className={cardClass}>
          <p className="text-xs text-[var(--text-secondary)]">v{proposal.schema_version} · {proposalLabels.get(proposal.status) ?? proposal.status} · {proposal.id}</p>
          <h2 className="whitespace-pre-wrap font-serif text-lg">{typeof proposal.payload.title === "string" ? proposal.payload.title : "待核对成就提案"}</h2>
          <p className="text-sm">创建：{dateText(proposal.created_at)} · 有效期截至：{dateText(proposal.expires_at)}</p>
          {proposal.status === "PROPOSED" && !(new Date(proposal.expires_at).valueOf() > now) && <p className="text-sm">提案已过期或有效期不可确认，仅供查看。</p>}
          {proposal.schema_version !== 2 && <p className="text-sm">此版本不支持接受或编辑；在有效期内可拒绝，不会升级或改写原始内容。</p>}
          <details><summary className="cursor-pointer py-2 text-sm">原始内容、来源与模型信息</summary>
            <div className="space-y-3"><h3>原始内容</h3><JsonText value={proposal.payload} /><h3>来源引用</h3><JsonText value={proposal.source_refs} /><h3>模型来源信息</h3><JsonText value={proposal.model_metadata} /></div>
          </details>
          {proposal.reviewed_at && <p className="text-sm">审核：{dateText(proposal.reviewed_at)} · {proposal.decision}</p>}
          {proposal.rejection_reason && <p className="whitespace-pre-wrap text-sm">拒绝原因：{proposal.rejection_reason}</p>}
          {proposal.resulting_entity_id && <p className="text-xs">认定结果：{proposal.resulting_entity_type} / {proposal.resulting_entity_id}</p>}
          {proposal.resulting_entity_type === "milestones" && proposal.resulting_entity_id && <SecondaryButton size="sm" onClick={() => setDetailId(proposal.resulting_entity_id)}>查看认定结果</SecondaryButton>}
          <div className="flex flex-wrap gap-2">{(["ACCEPTED", "EDITED", "REJECTED"] as const).filter(decision => proposalReviewable(proposal, decision, now)).map(decision =>
            <SecondaryButton key={decision} size="sm" disabled={Boolean(intent)} onClick={() => start({ id: crypto.randomUUID(), kind: "review", proposal, decision })}>{decisionLabels[decision]}</SecondaryButton>)}</div>
        </article>)}
        <MoreButton next={proposals.next} busy={proposals.moreBusy} onClick={proposals.more} />
      </div>
    </SectionCard>
    {intent && <MilestoneCommand key={intent.id} intent={intent} open={commandOpen} onPending={() => setPending(true)}
      onDismiss={submitted => { dismissFocus.current = submitted ? "resume" : "opener"; setCommandOpen(false); if (!submitted) { setIntent(null); setPending(false); } }} onSuccess={completed} onEnd={endRejected} />}
    {detailId && <MilestoneDetails key={detailId} id={detailId} onClose={() => setDetailId(null)} />}
  </div>;
}
