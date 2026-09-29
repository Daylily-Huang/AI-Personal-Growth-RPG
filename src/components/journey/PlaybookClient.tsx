"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton, SecondaryButton, SectionCard } from "@/components/ui";
import { journeyInputClass, journeyLabelClass } from "@/components/journey/formStyles";
import type {
  Strategy, StrategyContext, StrategyMetrics, StrategyObservation, StrategySourceClass, StrategyStatus,
} from "@/lib/strategy/types";
import type { StrategyProposalPreview, StrategySourceOption } from "@/lib/strategy/discovery";

type ApiResult = Record<string, unknown>;
type ProposalDecision = "ACCEPTED" | "EDITED" | "REJECTED";
const statusText: Record<StrategyStatus, string> = {
  HYPOTHESIS: "待验证", TESTING: "验证中", SUPPORTED: "获支持",
  CONTEXTUAL: "适用情境受限", WEAKENED: "证据减弱", RETIRED: "已退役",
};
const confidenceText = { LOW: "低", MODERATE: "中", HIGH: "高", VERY_HIGH: "很高" };
const sourceText: Record<StrategySourceClass, string> = {
  SEASON_REVIEW: "赛季复盘", ACTIVITY: "活动", QUEST_OUTCOME: "任务结果",
  ARTIFACT: "产物", CORE_EVIDENCE_REFERENCE: "核心证据引用",
  JOURNAL_CONTEXT: "日志情境", MANUAL_OBSERVATION: "日志中的人工观察",
};
const cardClass = "rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 shadow-[var(--shadow-card)]";

async function request(path: string, method = "GET", body?: Record<string, unknown>): Promise<ApiResult> {
  const response = await fetch(path, {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({})) as ApiResult;
  if (!response.ok) {
    const message = typeof payload.error === "string" ? payload.error : `请求失败 (${response.status})`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return payload;
}

function key() { return crypto.randomUUID(); }

function candidateActivityIds(type: StrategyProposalPreview["proposalType"], payload: Record<string, unknown>): string[] {
  if (type === "STRATEGY_COUNTEREVIDENCE_ALERT") {
    return typeof payload.counter_evidence_activity_id === "string" ? [payload.counter_evidence_activity_id] : [];
  }
  return Array.isArray(payload.supporting_activity_ids)
    ? payload.supporting_activity_ids.filter((id): id is string => typeof id === "string") : [];
}

export default function PlaybookClient() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [context, setContext] = useState<StrategyContext | null>(null);
  const [metrics, setMetrics] = useState<StrategyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("");
  const [protocol, setProtocol] = useState("");
  const [outcome, setOutcome] = useState("");
  const [versionTrigger, setVersionTrigger] = useState("");
  const [versionProtocol, setVersionProtocol] = useState("");
  const [versionOutcome, setVersionOutcome] = useState("");
  const [boundaryNote, setBoundaryNote] = useState("");
  const [retirementReason, setRetirementReason] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [observationType, setObservationType] = useState<StrategyObservation>("SUPPORT");
  const [sourceClass, setSourceClass] = useState<StrategySourceClass>("JOURNAL_CONTEXT");
  const [sourceId, setSourceId] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [sourceOptions, setSourceOptions] = useState<StrategySourceOption[]>([]);
  const [sourcePreview, setSourcePreview] = useState<StrategySourceOption | null>(null);
  const [proposals, setProposals] = useState<StrategyProposalPreview[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState("");
  const [verifiedActivitySources, setVerifiedActivitySources] = useState<Record<string, StrategySourceOption>>({});
  const [proposalDecision, setProposalDecision] = useState<ProposalDecision>("REJECTED");
  const [proposalEditedPayload, setProposalEditedPayload] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const handleError = useCallback((cause: unknown) => {
    if (typeof cause === "object" && cause !== null && "status" in cause && cause.status === 401) {
      router.push("/login");
      return;
    }
    setError(cause instanceof Error ? cause.message : "操作失败，请重试");
  }, [router]);

  const refresh = useCallback(async (id: string | null = selectedId) => {
    const payload = await request("/api/strategies");
    const next = (payload.strategies ?? []) as Strategy[];
    setStrategies(next);
    const resolvedId = id && next.some((strategy) => strategy.id === id) ? id : next[0]?.id ?? null;
    setSelectedId(resolvedId);
    if (resolvedId) {
      const detail = await request(`/api/strategies/${resolvedId}`) as unknown as StrategyContext;
      setContext(detail);
      setVersionTrigger(detail.strategy.contextTrigger);
      setVersionProtocol(detail.strategy.actionProtocol);
      setVersionOutcome(detail.strategy.expectedOutcome);
    } else setContext(null);
  }, [selectedId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const payload = await request("/api/strategies");
        if (!active) return;
        const items = (payload.strategies ?? []) as Strategy[];
        setStrategies(items);
        if (items[0]) {
          const detail = await request(`/api/strategies/${items[0].id}`) as unknown as StrategyContext;
          if (active) {
            setSelectedId(items[0].id); setContext(detail);
            setVersionTrigger(detail.strategy.contextTrigger);
            setVersionProtocol(detail.strategy.actionProtocol);
            setVersionOutcome(detail.strategy.expectedOutcome);
          }
        }
      } catch (cause) { if (active) handleError(cause); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [handleError]);

  useEffect(() => {
    let active = true;
    void request("/api/strategies/proposals").then((payload) => {
      if (active) setProposals((payload.proposals ?? []) as StrategyProposalPreview[]);
    }).catch((cause) => { if (active) handleError(cause); });
    return () => { active = false; };
  }, [handleError]);

  async function choose(id: string) {
    setSelectedId(id); setContext(null); setMetrics(null); setError(null);
    try {
      const detail = await request(`/api/strategies/${id}`) as unknown as StrategyContext;
      setContext(detail);
      setVersionTrigger(detail.strategy.contextTrigger);
      setVersionProtocol(detail.strategy.actionProtocol);
      setVersionOutcome(detail.strategy.expectedOutcome);
    }
    catch (cause) { handleError(cause); }
  }

  async function perform(action: () => Promise<ApiResult>, success: string, id: string | null = selectedId) {
    setBusy(true); setError(null); setNotice(null);
    try { await action(); await refresh(id); setMetrics(null); setNotice(success); }
    catch (cause) { handleError(cause); }
    finally { setBusy(false); }
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    void (async () => {
      try {
        const result = await request("/api/strategies", "POST", {
        title, description, contextTrigger: trigger, actionProtocol: protocol, expectedOutcome: outcome,
        });
        const created = result.strategy as Strategy;
        await refresh(created.id);
        setVersionTrigger(created.contextTrigger); setVersionProtocol(created.actionProtocol); setVersionOutcome(created.expectedOutcome);
        setTitle(""); setDescription(""); setTrigger(""); setProtocol(""); setOutcome("");
        setNotice("策略假设已创建。");
      } catch (cause) { handleError(cause); }
      finally { setBusy(false); }
    })();
  }

  function transition(targetStatus: StrategyStatus, reason?: string) {
    if (!selectedId) return;
    void perform(() => request(`/api/strategies/${selectedId}/transition`, "POST", {
      targetStatus,
      ...(targetStatus === "CONTEXTUAL" ? { contextBoundaryNote: reason } : {}),
      ...(targetStatus === "RETIRED" ? { retirementReason: reason } : {}),
      requestIdempotencyKey: key(),
    }), `策略已转为${statusText[targetStatus]}。`);
  }

  async function evaluate(confirmPromotion: boolean) {
    if (!selectedId) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const payload = await request(`/api/strategies/${selectedId}/evaluate`, "POST", { confirmPromotion });
      await refresh(selectedId);
      setMetrics(payload.metrics as StrategyMetrics);
      setNotice(confirmPromotion ? "已按最新证据确认晋升。" : "已按当前版本证据重新评估；仅显示资格，不自动晋升。");
    } catch (cause) { handleError(cause); }
    finally { setBusy(false); }
  }

  function addSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    void perform(() => request(`/api/strategies/${selectedId}/supports`, "POST", {
      observationType, sourceClass, sourceId: sourceId.trim(), observedAt: observedAt.trim(),
      evaluatorVersion: "playbook-ui-v1", note: sourceNote,
    }), observationType === "SUPPORT" ? "支持记录已提交。" : "反证已单独提交；警报确认本身不会写入反证。",
    selectedId);
  }

  async function loadSources() {
    setError(null);
    try {
      const payload = await request(`/api/strategies/sources?sourceClass=${sourceClass}`);
      setSourceOptions((payload.sources ?? []) as StrategySourceOption[]);
    } catch (cause) { handleError(cause); }
  }

  async function locateSource(sourceClassToFind: StrategySourceClass, idToFind: string) {
    setError(null); setSourcePreview(null);
    try {
      const payload = await request(`/api/strategies/sources?sourceClass=${sourceClassToFind}&id=${idToFind}`);
      const source = ((payload.sources ?? []) as StrategySourceOption[])[0];
      if (!source) throw new Error("这条原始来源已不可访问或不属于当前用户");
      setSourcePreview(source);
      if (sourceClassToFind === "ACTIVITY") {
        setVerifiedActivitySources((previous) => ({ ...previous, [source.id]: source }));
      }
    } catch (cause) { handleError(cause); }
  }

  function createVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    void perform(() => request(`/api/strategies/${selectedId}/versions`, "POST", {
      contextTrigger: versionTrigger, actionProtocol: versionProtocol, expectedOutcome: versionOutcome,
      changeSummary, requestIdempotencyKey: key(),
    }), "新版本已建立。旧版本证据保留，但不计入当前版本。", selectedId);
  }

  function reviewProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const proposal = proposals.find((item) => item.id === selectedProposalId);
    if (!proposal) { setError("请先选择并阅读待审提案"); return; }
    if (Date.parse(proposal.expiresAt) <= Date.now()) { setError("提案已过期，不能审核"); return; }
    let editedPayload: Record<string, unknown> | undefined;
    if (proposalDecision === "EDITED") {
      try {
        const parsed: unknown = JSON.parse(proposalEditedPayload);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("编辑后的提案必须是 JSON 对象");
        editedPayload = parsed as Record<string, unknown>;
      } catch (cause) { handleError(cause); return; }
    }
    if (proposalDecision !== "REJECTED") {
      const reviewedPayload = editedPayload ?? proposal.payload;
      const candidateIds = candidateActivityIds(proposal.proposalType, reviewedPayload);
      if (proposal.proposalType === "STRATEGY_COUNTEREVIDENCE_ALERT" && candidateIds.length === 0) {
        setError("反证警报缺少可核对的原始活动 ID");
        return;
      }
      if (candidateIds.some((id) => !verifiedActivitySources[id])) {
        setError("请先按 ID 核对提案引用的每条原始活动，再确认审核");
        return;
      }
      if (proposal.proposalType === "STRATEGY_COUNTEREVIDENCE_ALERT" &&
          !strategies.some((item) => item.id === reviewedPayload.strategy_id)) {
        setError("请先核对警报关联的策略是否属于当前列表");
        return;
      }
    }
    setBusy(true); setError(null); setNotice(null);
    void (async () => {
      try {
        await request(`/api/outer-loop/proposals/${proposal.id}/review`, "POST", {
          decision: proposalDecision, reviewRequestIdempotencyKey: key(),
          ...(editedPayload ? { editedPayload } : {}),
          ...(proposalDecision === "REJECTED" ? { rejectionReason } : {}),
        });
        await refresh(selectedId);
        const next = await request("/api/strategies/proposals");
        setProposals((next.proposals ?? []) as StrategyProposalPreview[]);
        setSelectedProposalId("");
        setNotice(proposal.proposalType === "STRATEGY_COUNTEREVIDENCE_ALERT"
          ? "警报已审核；这不会记录反证或改变策略，请另行提交反证。"
          : "提案已审核；请查看策略列表确认结果。");
      } catch (cause) { handleError(cause); }
      finally { setBusy(false); }
    })();
  }

  const strategy = context?.strategy;
  const currentVersion = context?.versions.find((version) => version.versionNumber === strategy?.version);
  const currentSupports = context?.supports.filter((support) => support.strategyVersionId === currentVersion?.id) ?? [];
  const historicalSupports = context?.supports.filter((support) => support.strategyVersionId !== currentVersion?.id) ?? [];
  const selectedProposal = proposals.find((proposal) => proposal.id === selectedProposalId);
  let reviewPayload: Record<string, unknown> | null = selectedProposal?.payload ?? null;
  if (selectedProposal && proposalDecision === "EDITED") {
    try {
      const parsed: unknown = JSON.parse(proposalEditedPayload);
      reviewPayload = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown> : null;
    } catch { reviewPayload = null; }
  }
  const proposalActivityIds = selectedProposal && reviewPayload
    ? candidateActivityIds(selectedProposal.proposalType, reviewPayload) : [];

  return (
    <div className="space-y-5 text-[var(--text-primary)]" data-testid="playbook-page">
      <header className="space-y-1">
        <p className="text-xs tracking-[var(--tracking-wide)] text-[var(--text-muted)]">JOURNEY / STRATEGY</p>
        <h1 className="font-serif text-2xl font-[var(--font-weight-semibold)]">个人策略手册</h1>
        <p className="text-sm text-[var(--text-secondary)]">记录可检验的做法与适用边界。置信度由服务端证据计算，不等同于 XP、掌握度或个人价值。</p>
      </header>
      {error && <div role="alert" className="rounded-[var(--radius-md)] border border-[var(--status-superseded-border)] bg-[var(--status-superseded-bg)] p-3 text-sm">{error}</div>}
      {notice && <div role="status" className="rounded-[var(--radius-md)] border border-[var(--authority-verified-border)] bg-[var(--authority-verified-bg)] p-3 text-sm">{notice}</div>}
      <div className="grid gap-5 lg:grid-cols-[minmax(16rem,1fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <SectionCard title="策略列表">
            {loading ? <p role="status">加载中…</p> : strategies.length === 0 ? <p>尚无策略。先写下一个可验证的假设。</p> : (
              <ul className="space-y-2">{strategies.map((item) => <li key={item.id}>
                <button type="button" onClick={() => void choose(item.id)} aria-pressed={selectedId === item.id}
                  className={`w-full rounded-[var(--radius-md)] border p-3 text-left text-sm focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] ${selectedId === item.id ? "border-[var(--border-default)] bg-[var(--selection-neutral-bg)]" : "border-[var(--border-subtle)] bg-[var(--surface-ground)]"}`}>
                  <span className="block break-words font-[var(--font-weight-semibold)]">{item.title}</span>
                  <span className="mt-1 block text-xs text-[var(--text-secondary)]">{statusText[item.lifecycleStatus]} · 置信度{confidenceText[item.confidenceLevel]} · v{item.version}</span>
                </button>
              </li>)}</ul>
            )}
          </SectionCard>
          <SectionCard title="创建假设">
            <form className="space-y-3" onSubmit={create}>
              <label className={journeyLabelClass}>标题<input className={journeyInputClass} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} /></label>
              <label className={journeyLabelClass}>简述<textarea className={journeyInputClass} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></label>
              <label className={journeyLabelClass}>触发情境<textarea className={journeyInputClass} value={trigger} onChange={(e) => setTrigger(e.target.value)} required rows={2} /></label>
              <label className={journeyLabelClass}>行动方案<textarea className={journeyInputClass} value={protocol} onChange={(e) => setProtocol(e.target.value)} required rows={3} /></label>
              <label className={journeyLabelClass}>预期结果<textarea className={journeyInputClass} value={outcome} onChange={(e) => setOutcome(e.target.value)} required rows={2} /></label>
              <PrimaryButton type="submit" disabled={busy}>创建策略假设</PrimaryButton>
            </form>
          </SectionCard>
        </div>
        <div className="space-y-5">
          {selectedId && !context ? <div role="status" className={cardClass}>加载策略详情…</div> : strategy && context ? <>
            <SectionCard title={strategy.title}>
              <div className="space-y-3 text-sm">
                <p className="break-words text-[var(--text-secondary)]">{strategy.description || "暂无简述"}</p>
                <p>状态：{statusText[strategy.lifecycleStatus]}　·　派生置信度：{confidenceText[strategy.confidenceLevel]}　·　当前版本：v{strategy.version}</p>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <div><dt className="text-xs text-[var(--text-muted)]">触发情境</dt><dd className="whitespace-pre-wrap break-words">{strategy.contextTrigger}</dd></div>
                  <div><dt className="text-xs text-[var(--text-muted)]">行动方案</dt><dd className="whitespace-pre-wrap break-words">{strategy.actionProtocol}</dd></div>
                  <div><dt className="text-xs text-[var(--text-muted)]">预期结果</dt><dd className="whitespace-pre-wrap break-words">{strategy.expectedOutcome}</dd></div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  {strategy.lifecycleStatus === "HYPOTHESIS" && <SecondaryButton onClick={() => transition("TESTING")} disabled={busy}>开始验证</SecondaryButton>}
                  {strategy.lifecycleStatus === "WEAKENED" && <SecondaryButton onClick={() => transition("TESTING")} disabled={busy}>重新验证</SecondaryButton>}
                  {strategy.lifecycleStatus === "CONTEXTUAL" && <SecondaryButton onClick={() => transition("SUPPORTED")} disabled={busy}>恢复获支持状态</SecondaryButton>}
                  <SecondaryButton onClick={() => void evaluate(false)} disabled={busy}>重新评估证据</SecondaryButton>
                </div>
                {strategy.lifecycleStatus === "SUPPORTED" && <form onSubmit={(event) => { event.preventDefault(); transition("CONTEXTUAL", boundaryNote.trim()); }} className="flex flex-col gap-2 sm:flex-row">
                  <label className={`${journeyLabelClass} flex-1`}>情境边界说明<input className={journeyInputClass} value={boundaryNote} onChange={(e) => setBoundaryNote(e.target.value)} required /></label>
                  <SecondaryButton type="submit" disabled={busy}>标记情境受限</SecondaryButton>
                </form>}
                {(strategy.lifecycleStatus === "TESTING" || strategy.lifecycleStatus === "WEAKENED") && <form onSubmit={(event) => { event.preventDefault(); transition("RETIRED", retirementReason.trim()); }} className="flex flex-col gap-2 sm:flex-row">
                  <label className={`${journeyLabelClass} flex-1`}>退役原因<input className={journeyInputClass} value={retirementReason} onChange={(e) => setRetirementReason(e.target.value)} required /></label>
                  <SecondaryButton type="submit" disabled={busy}>退役策略</SecondaryButton>
                </form>}
              </div>
            </SectionCard>
            <SectionCard title="证据评估">
              <div className="space-y-3 text-sm">
                {metrics ? <>
                  <p>当前版本：支持 {metrics.supportCount} · 反证 {metrics.counterEvidenceCount} · 不同观察日 {metrics.distinctObservationDates} · 已完成赛季 {metrics.completedSeasons} · Core 链接 {metrics.coreLinks}</p>
                  <p>支持占比 {Math.round(metrics.supportRatio * 100)}% · 派生置信度 {confidenceText[metrics.confidenceLevel]}</p>
                  <p>{metrics.promotionEligible ? "当前满足晋升条件；须再次明确确认。" : "当前尚不满足晋升条件。"}</p>
                  {strategy.lifecycleStatus === "TESTING" && metrics.promotionEligible && <PrimaryButton onClick={() => void evaluate(true)} disabled={busy}>确认晋升为获支持</PrimaryButton>}
                </> : <p className="text-[var(--text-secondary)]">点击“重新评估证据”查看当前版本的服务端结果。不会自动晋升。</p>}
              </div>
            </SectionCard>
            <SectionCard title="支持与反证">
              <div className="space-y-4 text-sm">
                <p className="text-[var(--text-secondary)]">只有当前版本的记录参与置信度计算。来源 ID 与原始时间戳必须对应同一条属于你的记录；请从原始来源复制完整时间戳，勿用本地日期控件改写微秒。</p>
                <form onSubmit={addSupport} className="grid gap-3 sm:grid-cols-2">
                  <label className={journeyLabelClass}>观察类型<select className={journeyInputClass} value={observationType} onChange={(e) => setObservationType(e.target.value as StrategyObservation)}><option value="SUPPORT">支持</option><option value="COUNTER_EVIDENCE">反证</option></select></label>
                  <label className={journeyLabelClass}>来源类型<select className={journeyInputClass} value={sourceClass} onChange={(e) => { setSourceClass(e.target.value as StrategySourceClass); setSourceOptions([]); setSourceId(""); setObservedAt(""); }}>{Object.entries(sourceText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <div className="space-y-2 sm:col-span-2">
                    <SecondaryButton type="button" onClick={() => void loadSources()} disabled={busy}>读取我的近期{sourceText[sourceClass]}来源</SecondaryButton>
                    {sourceOptions.length > 0 && <label className={journeyLabelClass}>选择原始来源
                      <select className={journeyInputClass} value="" onChange={(e) => {
                        const source = sourceOptions.find((item) => item.id === e.target.value);
                        if (source) { setSourceId(source.id); setObservedAt(source.observedAt); setSourcePreview(source); }
                      }}>
                        <option value="">请选择一条来源</option>
                        {sourceOptions.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.id}</option>)}
                      </select>
                    </label>}
                  </div>
                  <label className={journeyLabelClass}>来源记录 UUID<input className={journeyInputClass} value={sourceId} onChange={(e) => { setSourceId(e.target.value); setSourcePreview(null); }} required pattern="[0-9a-fA-F-]{36}" /></label>
                  <label className={journeyLabelClass}>来源原始时间戳<input className={journeyInputClass} value={observedAt} onChange={(e) => { setObservedAt(e.target.value); setSourcePreview(null); }} required placeholder="2026-09-29T12:34:56.123456+00:00" /></label>
                  {sourcePreview && <p className="sm:col-span-2 break-words text-xs text-[var(--text-secondary)]">已核对来源：{sourcePreview.label} · {sourcePreview.observedAt}</p>}
                  <label className={`${journeyLabelClass} sm:col-span-2`}>说明<textarea className={journeyInputClass} value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} rows={2} /></label>
                  <div className="sm:col-span-2"><PrimaryButton type="submit" disabled={busy}>单独记录{observationType === "SUPPORT" ? "支持" : "反证"}</PrimaryButton></div>
                </form>
                <h3 className="font-[var(--font-weight-semibold)]">当前版本记录</h3>
                {currentSupports.length === 0 ? <p>当前版本暂无支持或反证记录。</p> : <ul className="space-y-2">{currentSupports.map((item) => <li key={item.id} className={cardClass}>
                  <p>{item.observationType === "SUPPORT" ? "支持" : "反证"} · {sourceText[item.sourceClass]}</p>
                  <p className="break-all text-xs text-[var(--text-muted)]">{item.sourceId} · {item.observedAt}</p>
                  <SecondaryButton type="button" onClick={() => void locateSource(item.sourceClass, item.sourceId)}>核对原始来源</SecondaryButton>
                  {sourcePreview?.id === item.sourceId && sourcePreview.sourceClass === item.sourceClass && <div className="break-words"><p>原始来源：{sourcePreview.label} · {sourcePreview.observedAt}</p>{sourcePreview.details && <p className="max-h-48 overflow-auto whitespace-pre-wrap">{sourcePreview.details}</p>}</div>}
                  {item.note && <p className="whitespace-pre-wrap break-words">{item.note}</p>}
                </li>)}</ul>}
                {historicalSupports.length > 0 && <details>
                  <summary className="cursor-pointer font-[var(--font-weight-semibold)]">查看历史版本证据（{historicalSupports.length}，不计入当前版本）</summary>
                  <ul className="mt-2 space-y-2">{historicalSupports.map((item) => <li key={item.id} className={cardClass}>
                    <p>{item.observationType === "SUPPORT" ? "支持" : "反证"} · {sourceText[item.sourceClass]}</p>
                    <p className="break-all text-xs text-[var(--text-muted)]">{item.sourceId} · {item.observedAt}</p>
                    <SecondaryButton type="button" onClick={() => void locateSource(item.sourceClass, item.sourceId)}>核对原始来源</SecondaryButton>
                    {sourcePreview?.id === item.sourceId && sourcePreview.sourceClass === item.sourceClass && <div className="break-words"><p>原始来源：{sourcePreview.label} · {sourcePreview.observedAt}</p>{sourcePreview.details && <p className="max-h-48 overflow-auto whitespace-pre-wrap">{sourcePreview.details}</p>}</div>}
                    {item.note && <p className="whitespace-pre-wrap break-words">{item.note}</p>}
                  </li>)}</ul>
                </details>}
              </div>
            </SectionCard>
            <SectionCard title="方案版本">
              <div className="space-y-4 text-sm">
                <p className="text-[var(--text-secondary)]">修改方案会创建不可变新版本；旧证据仍可查阅，但不计入新版本置信度。</p>
                <form onSubmit={createVersion} className="space-y-3">
                  <label className={journeyLabelClass}>新触发情境<textarea className={journeyInputClass} value={versionTrigger} onChange={(e) => setVersionTrigger(e.target.value)} required rows={2} /></label>
                  <label className={journeyLabelClass}>新行动方案<textarea className={journeyInputClass} value={versionProtocol} onChange={(e) => setVersionProtocol(e.target.value)} required rows={3} /></label>
                  <label className={journeyLabelClass}>新预期结果<textarea className={journeyInputClass} value={versionOutcome} onChange={(e) => setVersionOutcome(e.target.value)} required rows={2} /></label>
                  <label className={journeyLabelClass}>变更说明<input className={journeyInputClass} value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} /></label>
                  <SecondaryButton type="submit" disabled={busy}>创建新版本</SecondaryButton>
                </form>
                <ol className="space-y-2">{context.versions.map((version) => <li key={version.id} className={cardClass}>
                  <p className="font-[var(--font-weight-semibold)]">v{version.versionNumber}{version.versionNumber === strategy.version ? " · 当前" : " · 历史"}</p>
                  <p className="whitespace-pre-wrap break-words">{version.contextTrigger} → {version.actionProtocol} → {version.expectedOutcome}</p>
                </li>)}</ol>
              </div>
            </SectionCard>
          </> : !loading && <div className={cardClass}>选择左侧策略查看详情。</div>}
        </div>
      </div>
      <SectionCard title="AI 提案审核">
        <div className="space-y-3 text-sm">
          <p className="text-[var(--text-secondary)]">先阅读下方提案原文与来源，再决定接受、编辑或拒绝。接受反证警报只表示确认收到；必须另行提交反证记录才会影响策略。</p>
          {proposals.length === 0 ? <p>当前没有待审的策略提案。</p> : <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_minmax(0,2fr)]">
            <ul className="space-y-2">{proposals.map((proposal) => <li key={proposal.id}>
              <button type="button" onClick={() => { setSelectedProposalId(proposal.id); setProposalEditedPayload(JSON.stringify(proposal.payload, null, 2)); setProposalDecision("REJECTED"); setVerifiedActivitySources({}); }}
                aria-pressed={selectedProposalId === proposal.id} className={`${cardClass} w-full text-left focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)]`}>
                {proposal.proposalType === "STRATEGY_HYPOTHESIS" ? "策略假设" : "反证警报"}
                <span className="mt-1 block break-all text-xs text-[var(--text-muted)]">{proposal.id}</span>
              </button>
            </li>)}</ul>
            {selectedProposal && <div className="space-y-3">
              <p className="font-[var(--font-weight-semibold)]">{selectedProposal.proposalType === "STRATEGY_HYPOTHESIS" ? "待审策略假设" : "待审反证警报"}</p>
              <p className="text-xs text-[var(--text-secondary)]">创建：{selectedProposal.createdAt} · 到期：{selectedProposal.expiresAt}</p>
              <div><h3 className="font-[var(--font-weight-semibold)]">提案原文</h3><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] bg-[var(--surface-ground)] p-3">{JSON.stringify(selectedProposal.payload, null, 2)}</pre></div>
              <div><h3 className="font-[var(--font-weight-semibold)]">来源引用</h3><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] bg-[var(--surface-ground)] p-3">{JSON.stringify(selectedProposal.sourceRefs, null, 2)}</pre></div>
              {selectedProposal.proposalType === "STRATEGY_COUNTEREVIDENCE_ALERT" && <p>
                关联策略：{strategies.find((item) => item.id === reviewPayload?.strategy_id)?.title ?? "未在当前策略列表中找到"}
                <span className="ml-2 break-all text-xs text-[var(--text-muted)]">{String(reviewPayload?.strategy_id ?? "缺少 strategy_id")}</span>
              </p>}
              <div className="space-y-2">
                <h3 className="font-[var(--font-weight-semibold)]">提案引用的原始活动</h3>
                {proposalActivityIds.length === 0 ? <p>当前提案未列出活动来源。</p> : <ul className="space-y-2">{proposalActivityIds.map((activityId) => <li key={activityId} className={cardClass}>
                  <p className="break-all text-xs">{activityId}</p>
                  <SecondaryButton type="button" onClick={() => void locateSource("ACTIVITY", activityId)}>按 ID 核对原始活动</SecondaryButton>
                  {verifiedActivitySources[activityId] && <div className="break-words"><p>已核对：{verifiedActivitySources[activityId].label} · {verifiedActivitySources[activityId].observedAt}</p>{verifiedActivitySources[activityId].details && <p className="max-h-48 overflow-auto whitespace-pre-wrap">{verifiedActivitySources[activityId].details}</p>}</div>}
                </li>)}</ul>}
                <p className="text-xs text-[var(--text-secondary)]">接受或编辑后接受前须逐条核对；编辑后的来源 ID 也会重新检查。接受警报仍不会自动记录反证。</p>
              </div>
              <form onSubmit={reviewProposal} className="grid gap-3 sm:grid-cols-2">
                <label className={journeyLabelClass}>审核决定<select className={journeyInputClass} value={proposalDecision} onChange={(e) => setProposalDecision(e.target.value as ProposalDecision)}><option value="REJECTED">拒绝</option><option value="ACCEPTED">接受</option><option value="EDITED">编辑后接受</option></select></label>
                {proposalDecision === "REJECTED" && <label className={journeyLabelClass}>拒绝原因<input className={journeyInputClass} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} /></label>}
                {proposalDecision === "EDITED" && <label className={`${journeyLabelClass} sm:col-span-2`}>编辑后的完整提案 JSON<textarea className={journeyInputClass} value={proposalEditedPayload} onChange={(e) => setProposalEditedPayload(e.target.value)} required rows={7} /></label>}
                <div className="sm:col-span-2"><SecondaryButton type="submit" disabled={busy}>提交提案审核</SecondaryButton></div>
              </form>
            </div>}
          </div>}
        </div>
      </SectionCard>
    </div>
  );
}
