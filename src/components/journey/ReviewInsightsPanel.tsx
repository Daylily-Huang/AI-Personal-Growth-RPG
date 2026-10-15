"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PrimaryButton, SecondaryButton, SectionCard } from "@/components/ui";
import { journeyInputClass, journeyLabelClass } from "./formStyles";
import { loadReviewSummary, localReviewDate, localReviewPeriod, requestReviewAnalysis, reviewClientError, reviewDraft, REVIEW_SECTION_LABELS } from "@/lib/review-insights/client";
import { REVIEW_SECTIONS, type ReviewAnalysisReceipt, type ReviewDraft, type ReviewPeriod, type ReviewSummary } from "@/lib/review-insights/types";
import MonthlyGrowthReport from "./MonthlyGrowthReport";

interface Props { canAdopt: boolean; onAdopt: (draft: ReviewDraft) => void }
const samePeriod = (a: ReviewPeriod, b: ReviewPeriod) => a.mode === b.mode && a.start === b.start && a.end === b.end && a.timezone === b.timezone;
const dateTime = (value: string) => new Date(value).toLocaleString("zh-CN");
export default function ReviewInsightsPanel({ canAdopt, onAdopt }: Props) {
  // The browser owns local dates and timezone. Keep SSR and first hydration
  // identical even across timezone differences or a clock tick.
  const [date, setDate] = useState(""), [mode, setMode] = useState<ReviewPeriod["mode"]>("DAILY");
  const [refresh, setRefresh] = useState(0), [summary, setSummary] = useState<ReviewSummary | null>(null), [receipt, setReceipt] = useState<ReviewAnalysisReceipt | null>(null);
  const [loading, setLoading] = useState(true), [analyzing, setAnalyzing] = useState(false), [error, setError] = useState<string | null>(null);
  const generation = useRef(0), analysisController = useRef<AbortController | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setDate(localReviewDate()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const selection = useMemo(() => {
    void refresh;
    if (!date) return { period: null, error: null };
    try { return { period: localReviewPeriod(date, mode), error: null }; }
    catch (e) { return { period: null, error: reviewClientError(e) }; }
  }, [date, mode, refresh]);
  useEffect(() => {
    const current = ++generation.current, controller = new AbortController();
    analysisController.current?.abort();
    const timer = window.setTimeout(() => {
      setSummary(null); setReceipt(null); setError(selection.error); setAnalyzing(false); setLoading(Boolean(selection.period));
      if (!selection.period) return;
      void loadReviewSummary(selection.period, controller.signal).then(value => {
        if (generation.current === current && !controller.signal.aborted) setSummary(value);
      }).catch(e => { if (generation.current === current && !controller.signal.aborted) setError(reviewClientError(e)); })
        .finally(() => { if (generation.current === current && !controller.signal.aborted) setLoading(false); });
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); analysisController.current?.abort(); generation.current = current + 1; };
  }, [selection]);
  const visibleSummary = summary && selection.period && samePeriod(summary.period, selection.period) ? summary : null;
  const visibleReceipt = receipt && selection.period && samePeriod(receipt.summary.period, selection.period) ? receipt : null;
  async function analyze() {
    if (!selection.period || !visibleSummary?.complete || visibleSummary.comparison?.previous.complete === false || loading || analyzing) return;
    const current = generation.current, controller = new AbortController();
    analysisController.current?.abort(); analysisController.current = controller;
    setAnalyzing(true); setReceipt(null); setError(null);
    try {
      const value = await requestReviewAnalysis(selection.period, controller.signal);
      if (generation.current === current && !controller.signal.aborted) { setSummary(value.summary); setReceipt(value); }
    } catch (e) { if (generation.current === current && !controller.signal.aborted) setError(reviewClientError(e)); }
    finally { if (generation.current === current && !controller.signal.aborted) setAnalyzing(false); }
  }
  return (
    <SectionCard title="每日汇总 · 每周复盘 · 月度成长" subtitle="先看客观记录，再由你决定是否请求AI分析。" data-testid="review-insights">
      <div className="flex min-w-0 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className={journeyLabelClass}>复盘类型<select aria-label="复盘类型" className={`${journeyInputClass} min-h-11`} value={mode} onChange={e => setMode(e.target.value as ReviewPeriod["mode"])}><option value="DAILY">每日</option><option value="WEEKLY">每周（周一开始）</option><option value="MONTHLY">月度（含上月对照）</option></select></label>
          <label className={journeyLabelClass}>日期<input aria-label="复盘日期" type="date" max={date ? localReviewDate() : undefined} value={date} onChange={e => setDate(e.target.value)} className={`${journeyInputClass} min-h-11`} /></label>
          <SecondaryButton onClick={() => setRefresh(v => v + 1)} disabled={loading}>刷新客观汇总</SecondaryButton>
          <PrimaryButton onClick={() => void analyze()} disabled={loading || analyzing || !visibleSummary?.complete || visibleSummary.comparison?.previous.complete === false || [visibleSummary, ...(visibleSummary.comparison ? [visibleSummary.comparison.previous] : [])].every(s => !Object.values(s.counts).some(n => n > 0) && s.state === null)}>{analyzing ? "AI分析中（最长约60秒）…" : "生成AI复盘"}</PrimaryButton>
        </div>
        {selection.period ? <p className="break-words text-xs text-[var(--text-muted)]">{dateTime(selection.period.start)} 至 {dateTime(selection.period.end)}（不含结束时刻）；时区 {selection.period.timezone}。今日/本周/本月只统计到本次刷新时刻。</p> : null}
        <p className="text-xs text-[var(--text-muted)]">点击生成后才发送本期精简摘要；不发送活动原文、日记正文或密钥。分析不授予XP、Mastery、Evidence或愿望积分。</p>
        {loading ? <p role="status">正在读取本人记录…</p> : null}
        {error ? <div role="alert" className="break-words text-sm text-[var(--state-danger-text)]">{error}{error.includes("登录") ? <Link href="/login" className="ml-2 inline-flex min-h-11 items-center underline">去登录</Link> : null}</div> : null}
        {visibleSummary ? <>
          <MonthlyGrowthReport summary={visibleSummary} />
          {!visibleSummary.complete ? <p role="status" className="text-sm text-[var(--state-warning-text)]">部分来源超过10000行读取上限；以下只是已读记录，不能代表本期总量，AI分析已禁用。</p> : null}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="客观账本汇总">
            {[["账本净XP", visibleSummary.xp.net], ["活动 / 已确认", `${visibleSummary.counts.activities} / ${visibleSummary.counts.confirmedActivities}`], ["新技能 / 知识节点", `${visibleSummary.counts.newSkills} / ${visibleSummary.counts.newKnowledgeNodes}`], ["新作品 / Mastery事件", `${visibleSummary.counts.newArtifacts} / ${visibleSummary.counts.masteryEvents}`]].map(([label, value]) => <div key={label} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3"><p className="text-xs text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words text-xl text-[var(--text-primary)]">{value}</p></div>)}
          </div>
          {Object.values(visibleSummary.counts).every(v => v === 0) && visibleSummary.state === null ? <p data-testid="review-empty" className="text-sm">本期暂无活动或成长记录。先记录真实活动，不需要为了填满复盘而刷分。</p> : null}
          <p className="text-sm">活动入账 {visibleSummary.xp.activity} · 调整 {visibleSummary.xp.adjustment} · 更正 {visibleSummary.xp.correction} XP；重复记录 {visibleSummary.xp.repeatedSettlements} 笔，已有折减 {visibleSummary.xp.penalizedSettlements} 笔。作品验收100愿望积分不属于XP。</p>
          <details className="min-w-0 text-sm"><summary className="flex min-h-11 cursor-pointer items-center">查看来源、分布与本期记录</summary><div className="mt-3 flex min-w-0 flex-col gap-4 break-words">
            <p>{visibleSummary.snapshotWarning}</p>
            <p>汇总时刻 {dateTime(visibleSummary.asOf)}。每类最多展示20条、标题最多160字；AI可进一步减少样本。精确计数与账本总额不采样。</p>
            <ul>{visibleSummary.coverage.map(c => <li key={c.source}>{c.source}：已读 {c.scanned}，{c.complete ? "该次查询未截断" : "已截断/非全量"}</li>)}</ul>
            <p>技能XP分布（当前名称）：{visibleSummary.xp.bySkill.map(g => `${g.name ?? "未知/无关联技能"} ${g.amount}`).join("；") || "无入账"}；省略分组 {visibleSummary.xp.omittedSkillGroups}</p>
            <p>领域XP分布（当前名称）：{visibleSummary.xp.byDomain.map(g => `${g.name ?? "未知/无关联领域"} ${g.amount}`).join("；") || "无入账"}；省略分组 {visibleSummary.xp.omittedDomainGroups}</p>
            <ul>{visibleSummary.activities.map(a => <li key={a.id}><Link href={`/activities/${a.id}`} className="inline-flex min-h-11 items-center underline">{a.title}</Link> · {a.status} · 总分钟 {a.totalMinutes ?? "未记录"} / 有效分钟 {a.effectiveMinutes ?? "未记录"}（不能据此认定低价值）</li>)}</ul>
            <p>新技能：{visibleSummary.newSkills.map(s => `${s.name}（${s.status}）`).join("；") || "无"}</p>
            <ul>{visibleSummary.masteryChanges.map(m => <li key={m.id}>Mastery {m.from} → {m.to} · {m.kind} · Evidence {m.evidenceId ?? "无关联记录"}</li>)}</ul>
            <p>新知识节点：{visibleSummary.knowledge.map(k => `${k.title}（${k.status}${k.archived ? "，已归档" : ""}）`).join("；") || "无"}</p>
            <p>新作品：{visibleSummary.artifacts.map(a => `${a.title}（${a.status}，创建不等于验收）`).join("；") || "无"}</p>
            <ul>{visibleSummary.mainQuests.map(q => <li key={q.id}>{q.title} · 当前 {q.currentProgress}% / {q.status}；本期增量未知</li>)}</ul>
            {!visibleSummary.mainQuests.length ? <p>当前没有可见主线，不能推算本期进度。</p> : null}
            {visibleSummary.state ? <p>本期最近一次用户自评（{dateTime(visibleSummary.state.loggedAt)}，非实时状态）：Energy {visibleSummary.state.energy ?? "未知"} / Focus {visibleSummary.state.focus ?? "未知"} / Stress {visibleSummary.state.stress ?? "未知"} / Recovery {visibleSummary.state.recovery ?? "未知"}；不是永久能力或医学结论。</p> : <p>本期状态自评未知；不推断你是否疲劳。</p>}
            <p>省略展示：{visibleSummary.sampling.omitted.map(s => `${s.category} ${s.count}`).join("；")}</p>
          </div></details>
        </> : null}
        {visibleReceipt ? <div className="flex min-w-0 flex-col gap-4 border-t border-[var(--border-subtle)] pt-4" data-testid="review-ai-analysis">
          <h4 className="font-serif text-lg">AI分析（推断，不是认证事实）</h4>
          <p className="break-words text-sm">{visibleReceipt.analysis.overview}</p>
          <p className="break-all text-xs text-[var(--text-muted)]">模型 {visibleReceipt.model} · {visibleReceipt.version} · 推断置信度 {visibleReceipt.analysis.confidence}（非Core置信度）</p>
          <div className="grid min-w-0 gap-3 md:grid-cols-2">{REVIEW_SECTIONS.map(key => <div key={key} className="min-w-0 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3"><h5 className="text-sm font-semibold">{REVIEW_SECTION_LABELS[key]}</h5><p className="mt-1 whitespace-pre-wrap break-words text-sm">{visibleReceipt.analysis[key].text}</p><p className="mt-1 break-all text-xs text-[var(--text-muted)]">{visibleReceipt.analysis[key].certainty === "supported" ? "有摘要引用，仍需判断" : "资料不足 / 推断"} · {visibleReceipt.analysis[key].supportingIds.join("，") || "无直接引用"}</p></div>)}</div>
          <div><h5 className="text-sm font-semibold">可检验的机制调整（1–3项）</h5><ol className="ml-5 list-decimal text-sm">{visibleReceipt.analysis.adjustments.map((a, i) => <li key={i} className="whitespace-pre-wrap break-words">{a.text}</li>)}</ol></div>
          <p className="break-words text-sm">不确定性：{visibleReceipt.analysis.uncertainties.join("；")}</p>
          <div><SecondaryButton disabled={!canAdopt || analyzing} onClick={() => { if (visibleReceipt && selection.period && samePeriod(visibleReceipt.summary.period, selection.period)) onAdopt(reviewDraft(visibleReceipt)); }}>采用为手动复盘草稿（不保存）</SecondaryButton><p className="mt-2 text-xs text-[var(--text-muted)]">{canAdopt ? "采用后仍须检查内容、选择赛季并明确保存；每日和月度使用手动复盘类型，保留原周期标签。" : "当前没有ACTIVE赛季，暂不能保存周期草稿；查看汇总和AI分析不受影响。"}</p></div>
        </div> : null}
      </div>
    </SectionCard>
  );
}
