"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { checkProposalFacts, loadProposalFacts, loadProposalSkills, proposalEditClientMessage, ProposalEditClientError,
  submitProposalFacts, type ProposalEditClientResult } from "@/lib/proposal-edit/client";
import { parseProposalEditInput } from "@/lib/proposal-edit/validation";
import type { ProposalEditInput, ProposalEditFactsView, ProposalFactSkillsView } from "@/lib/proposal-edit/types";

export interface ProposalEditMemory { input: ProposalEditInput | null; result: ProposalEditClientResult | null }
export interface ProposalEditStore {
  read: () => ProposalEditMemory;
  write: (snapshot: ProposalEditMemory) => void;
  subscribe: (listener: () => void) => () => void;
}
export function createProposalEditMemory(initial: ProposalEditMemory = { input: null, result: null }): ProposalEditStore {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return { read: () => snapshot,
    write: next => { snapshot = next; for (const listener of listeners) listener(); },
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}
const control = "min-h-[var(--touch-target-min)] min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring-color)] disabled:opacity-50";

export function ProposalFactsEditor({ assessmentId, activityId, memory: store, onClose, onCompleted }: {
  assessmentId: string; activityId: string; memory: ProposalEditStore; onClose: () => void;
  onCompleted: (result: Extract<ProposalEditClientResult, { status: "completed" }>, signal: AbortSignal) => Promise<boolean>;
}) {
  const memory = useSyncExternalStore(store.subscribe, store.read, store.read);
  const [initial, setInitial] = useState<ProposalEditFactsView | null>(null);
  const [skills, setSkills] = useState<ProposalFactSkillsView | null>(null);
  const [description, setDescription] = useState(memory.input?.facts.description ?? "");
  const [total, setTotal] = useState(memory.input?.facts.totalMinutes?.toString() ?? "");
  const [effective, setEffective] = useState(memory.input?.facts.effectiveMinutes?.toString() ?? "");
  const [selected, setSelected] = useState<string[]>(memory.input?.facts.relatedSkillIds ?? []);
  const [result, setResult] = useState(memory.result);
  const [loading, setLoading] = useState(memory.result?.status !== "completed");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [paging, setPaging] = useState(false);
  const alive = useRef(false), lock = useRef(false), owned = useRef(new Set<AbortController>());
  const title = useRef<HTMLHeadingElement>(null);
  const lockedFacts = memory.input !== null;
  function controller() { const value = new AbortController(); owned.current.add(value); return value; }
  useEffect(() => {
    const requests = owned.current;
    alive.current = true;
    return () => { alive.current = false; for (const value of requests) value.abort(); requests.clear(); };
  }, [assessmentId, activityId]);
  useEffect(() => { title.current?.focus(); }, []);
  useEffect(() => {
    if (store.read().result?.status === "completed") return;
    const requests = owned.current, request = new AbortController(); requests.add(request); let current = true;
    async function initialize() {
      try {
        const [facts, page] = await Promise.all([loadProposalFacts(assessmentId, activityId, request.signal), loadProposalSkills(assessmentId, activityId, null, request.signal)]);
        if (!current || request.signal.aborted) return;
        setInitial(facts); setSkills(page);
        if (!store.read().input) {
          const value = facts.currentRevision?.facts ?? facts.original;
          setDescription(value.description); setTotal(value.totalMinutes?.toString() ?? ""); setEffective(value.effectiveMinutes?.toString() ?? "");
          setSelected(facts.currentRevision?.facts.relatedSkillIds ?? []);
        }
      } catch (cause) { if (current && !request.signal.aborted) setError(proposalEditClientMessage(cause)); }
      finally {
        // One initialization failure must also release its still-running sibling read.
        request.abort(); requests.delete(request); if (current) setLoading(false);
      }
    }
    void initialize(); return () => { current = false; request.abort(); requests.delete(request); };
  }, [assessmentId, activityId, reload, store]);

  async function consume(value: ProposalEditClientResult, signal: AbortSignal) {
    store.write({ ...store.read(), result: value });
    if (!alive.current) return;
    setResult(value);
    if (value.status === "completed") {
      // Keep the durable receipt even when the subsequent dashboard refresh fails.
      let ok = false; try { ok = await onCompleted(value, signal); } catch { /* A refresh error must never become another POST. */ }
      if (alive.current) setRefreshFailed(!ok);
    }
  }
  async function wait(delay: number, signal: AbortSignal) {
    await new Promise<void>((resolve, reject) => {
      const finish = () => { signal.removeEventListener("abort", abort); resolve(); };
      const timer = setTimeout(finish, delay);
      const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(new DOMException("Aborted", "AbortError")); };
      if (signal.aborted) abort(); else signal.addEventListener("abort", abort, { once: true });
    });
  }
  async function poll(input: ProposalEditInput, request: AbortController) {
    const deadline = Date.now() + 60000;
    // Each GET also has a bounded wait: no stalled read can exceed the60s budget.
    const timeout = setTimeout(() => request.abort(), 60000);
    try {
      for (let count = 0; count < 20 && Date.now() < deadline; count++) {
        await wait(Math.min(3000, Math.max(0, deadline - Date.now())), request.signal);
        if (Date.now() >= deadline) break;
        const value = await checkProposalFacts(assessmentId, activityId, input, request.signal);
        await consume(value, request.signal); if (value.status !== "in_progress") return;
      }
      if (alive.current) setError("等待已结束，请手动核实原编号；没有重新调用 AI。");
    } finally { clearTimeout(timeout); }
  }
  async function act(mode: "submit" | "check") {
    if (lock.current || running) return;
    lock.current = true; setRunning(true); setError(null);
    const request = controller();
    try {
      let input = store.read().input;
      if (mode === "submit") {
        if (input || !initial) return;
        const number = (value: string) => value === "" ? null : /^\d+$/.test(value) ? Number(value) : Number.NaN;
        input = parseProposalEditInput({ requestId: crypto.randomUUID(), facts: { description, totalMinutes: number(total), effectiveMinutes: number(effective), relatedSkillIds: selected } });
        store.write({ input, result: null });
        const value = await submitProposalFacts(assessmentId, activityId, input, request.signal);
        await consume(value, request.signal); if (value.status === "in_progress") await poll(input, request);
      } else if (input) {
        const value = await checkProposalFacts(assessmentId, activityId, input, request.signal); await consume(value, request.signal);
        // Manual reconciliation is deliberately one GET, never a new POST or auto-poll restart.
      }
    } catch (cause) {
      if (mode === "submit" && cause instanceof ProposalEditClientError && cause.code === "invalid") store.write({ input: null, result: null });
      if (alive.current) setError(request.signal.aborted ? "等待已取消或超时，服务器可能仍在处理；请核实原编号。" : proposalEditClientMessage(cause));
    } finally { request.abort(); owned.current.delete(request); lock.current = false; if (alive.current) setRunning(false); }
  }
  async function moreSkills() {
    if (paging || !skills?.nextCursor || lockedFacts || lock.current) return;
    lock.current = true; setPaging(true); const request = controller();
    try {
      const page = await loadProposalSkills(assessmentId, activityId, skills.nextCursor, request.signal);
      if (alive.current && !request.signal.aborted) setSkills(page);
    } catch (cause) { if (alive.current && !request.signal.aborted) setError(proposalEditClientMessage(cause)); }
    finally { request.abort(); owned.current.delete(request); lock.current = false; if (alive.current) setPaging(false); }
  }
  const completed = result?.status === "completed" ? result : null;
  return <section aria-labelledby={`facts-editor-${assessmentId}`} className="min-w-0 space-y-4 rounded-xl border border-[var(--border-subtle)] p-4">
    <h3 id={`facts-editor-${assessmentId}`} ref={title} tabIndex={-1} className="font-semibold">修正事实后由 AI 重新评估</h3>
    <p className="text-sm text-[var(--text-secondary)]">只修改活动事实与相关技能线索，不直接修改评分、Evidence、Mastery 或 XP。原始记录保留；最终 XP 仍由成长引擎计算。</p>
    {loading && <p role="status">正在读取原始事实与技能…</p>}
    {initial && <details className="min-w-0 text-sm"><summary className={control}>查看原始事实</summary>
      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{initial.original.description}</p>
      {initial.original.descriptionTruncated && <p>原文显示已截断，请核对并补全本次事实，不会改写原文。</p>}
      <p>原总分钟：{initial.original.totalMinutes ?? "未知"}；原有效分钟：{initial.original.effectiveMinutes ?? "未知"}</p></details>}
    {!completed && <form onSubmit={event => { event.preventDefault(); void act("submit"); }} className="min-w-0 space-y-3">
      <fieldset disabled={loading || lockedFacts || running || paging} className="min-w-0 space-y-3">
        <legend className="text-sm">活动事实与相关技能线索</legend>
        <label className="block space-y-1"><span>本次完整事实描述</span><textarea required value={description} onChange={event => setDescription(event.target.value)} rows={5} className={`${control} w-full`} /></label>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <label className="block space-y-1"><span>总分钟（留空为未知）</span><input type="number" min={0} max={1440} step={1} value={total} onChange={event => setTotal(event.target.value)} className={`${control} w-full`} /></label>
          <label className="block space-y-1"><span>有效分钟（留空为未知）</span><input type="number" min={0} max={1440} step={1} value={effective} onChange={event => setEffective(event.target.value)} className={`${control} w-full`} /></label>
        </div>
        <p className="text-sm">相关技能线索（AI 会重新判断，最多5项）</p>
        <p className="text-sm">已选 {selected.length}/5；线索不直接指定永久成长目标。</p>
        {selected.map(id => <button key={id} type="button" className={`${control} max-w-full [overflow-wrap:anywhere]`} onClick={() => setSelected(value => value.filter(item => item !== id))}>移除线索 {id}</button>)}
        <div className="flex min-w-0 flex-col gap-2">{skills?.items.map(skill => <label key={skill.id} className={`${control} flex items-center gap-2 [overflow-wrap:anywhere]`}>
          <input type="checkbox" className="h-[var(--touch-target-min)] w-[var(--touch-target-min)] shrink-0" checked={selected.includes(skill.id)} disabled={!selected.includes(skill.id) && selected.length >= 5}
            onChange={event => setSelected(value => event.target.checked ? [...value, skill.id] : value.filter(id => id !== skill.id))} />
          <span>{skill.name}{skill.nameTruncated ? "（名称已截断）" : ""} · 已有 M{skill.masteryLevel}</span></label>)}</div>
        {!skills?.items.length && <p className="text-sm">本页没有可选技能；可以不选线索。</p>}
      </fieldset>
      {skills?.nextCursor && !lockedFacts && <button type="button" className={control} disabled={loading || paging || running} onClick={() => { void moreSkills(); }}>下一页技能</button>}
      {!lockedFacts && <button type="submit" className={control} disabled={loading || !initial || running || paging}>确认事实并请求 AI 重评</button>}
    </form>}
    {memory.input && <p className="text-xs [overflow-wrap:anywhere]">请求编号：{memory.input.requestId}</p>}
    {running && <p role="status">正在提交或核实；取消等待不代表服务器回滚。</p>}
    {result?.status === "in_progress" && <p role="status">服务器正在重评，最多等待60秒；已有编号不会再次派发 AI。</p>}
    {completed && <div role="status" className="min-w-0 space-y-2 text-sm [overflow-wrap:anywhere]"><p>新建议已保存，尚未结算 XP。请查看新建议后自行确认。</p>
      <p>新建议：{completed.request.completion.assessment.id}</p><p>版本：{completed.request.completion.revisionId}</p>
      {refreshFailed && <p>重评已成功，但列表刷新未完成。回执已保留；请刷新页面，不要再次提交重评。</p>}</div>}
    {result && ["failed", "expired", "conflict"].includes(result.status) && <p role="status">本次未生成新建议。请先核实当前建议；新尝试可能再次产生模型费用。</p>}
    {error && <p role="alert" className="text-sm">{error}</p>}
    <div className="flex flex-wrap gap-2">
      {memory.input && !completed && <button type="button" className={control} disabled={running || paging} onClick={() => { void act("check"); }}>用原编号核实结果</button>}
      {!memory.input && !loading && !initial && <button type="button" className={control} onClick={() => { setError(null); setLoading(true); setReload(value => value + 1); }}>重新读取表单</button>}
      {result && (result.status === "failed" || result.status === "expired") && <button type="button" className={control} disabled={running} onClick={() => { store.write({ input: null, result: null }); setResult(null); setError(null); }}>明确新建一次尝试</button>}
      <button type="button" className={control} onClick={onClose}>{completed ? "关闭重评结果" : "取消并关闭（不保证服务器回滚）"}</button>
    </div>
  </section>;
}
