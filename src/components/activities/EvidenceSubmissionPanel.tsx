"use client";

import React, { useEffect, useRef, useState } from "react";
import { evidenceClientMessage, loadEvidence, submitEvidence } from "@/lib/evidence-submission/client";
import { parseEvidenceInput } from "@/lib/evidence-submission/validation";
import type { EvidenceSkillOption, EvidenceSubmission, EvidenceSubmissionInput } from "@/lib/evidence-submission/types";

const control = "min-h-[var(--touch-target-min)] rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-2 text-sm text-[var(--text-primary)] focus-visible:outline-[var(--focus-ring-width)] focus-visible:outline-[var(--focus-ring-color)] disabled:opacity-50";
type Ticket = { input: EvidenceSubmissionInput; phase: "confirm" | "unknown" | "saved" };

function Panel({ activityId }: { activityId: string }) {
  const [open, setOpen] = useState(false), [reload, setReload] = useState(0);
  const [description, setDescription] = useState(""), [skillId, setSkillId] = useState("");
  const [skills, setSkills] = useState<EvidenceSkillOption[]>([]), [items, setItems] = useState<EvidenceSubmission[]>([]);
  const [saved, setSaved] = useState<EvidenceSubmission[]>([]);
  const [skillCursor, setSkillCursor] = useState<string | null>(null), [itemCursor, setItemCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false), [more, setMore] = useState(false), [posting, setPosting] = useState(false);
  const [readError, setReadError] = useState(""), [writeMessage, setWriteMessage] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const generation = useRef(0), clients = useRef(new Set<AbortController>());

  useEffect(() => {
    if (!open) return;
    const current = ++generation.current, controller = new AbortController();
    const owned = clients.current; owned.add(controller);
    async function read() {
      try {
        const [submissions, options] = await Promise.all([
          loadEvidence(activityId, { view: "submissions", after: null }, controller.signal),
          loadEvidence(activityId, { view: "skills", after: null }, controller.signal),
        ]);
        if (controller.signal.aborted || generation.current !== current) return;
        if (submissions.view !== "submissions" || options.view !== "skills") throw new Error("Unexpected evidence view");
        setItems(submissions.items); setItemCursor(submissions.nextCursor);
        setSkills(options.items); setSkillCursor(options.nextCursor); setReadError("");
      } catch (error) {
        if (!controller.signal.aborted && generation.current === current) setReadError(evidenceClientMessage(error));
      } finally {
        const currentRead = !controller.signal.aborted && generation.current === current;
        // Promise.all can reject while its sibling is pending; cancel before unregistering.
        controller.abort();
        owned.delete(controller);
        if (currentRead) setLoading(false);
      }
    }
    void read();
    return () => {
      for (const client of owned) client.abort();
      owned.clear();
    };
  }, [activityId, open, reload]);

  function toggle() {
    if (open) {
      generation.current++;
      for (const client of clients.current) client.abort();
      clients.current.clear(); setPosting(false); setMore(false);
      if (!ticket) setSkillId("");
      setItems([]); setSkills([]); setReadError(""); setOpen(false);
    } else { setLoading(true); setOpen(true); }
  }
  function refresh() { setLoading(true); setMore(false); setReadError(""); setReload(value => value + 1); }
  async function next(view: "submissions" | "skills") {
    const after = view === "skills" ? skillCursor : itemCursor;
    if (!after || more || loading) return;
    const current = generation.current, controller = new AbortController();
    clients.current.add(controller); setMore(true);
    try {
      const page = await loadEvidence(activityId, { view, after }, controller.signal);
      if (controller.signal.aborted || current !== generation.current) return;
      if (page.view === "skills") { setSkills(old => [...old, ...page.items]); setSkillCursor(page.nextCursor); }
      else { setItems(old => [...old, ...page.items]); setItemCursor(page.nextCursor); }
      setReadError("");
    } catch (error) {
      if (!controller.signal.aborted && current === generation.current) setReadError(evidenceClientMessage(error));
    } finally { clients.current.delete(controller); if (!controller.signal.aborted && current === generation.current) setMore(false); }
  }
  function prepare() {
    try {
      const input = parseEvidenceInput({ requestId: crypto.randomUUID(), skillId: skillId || null, description });
      setTicket({ input, phase: "confirm" }); setWriteMessage("");
    } catch { setWriteMessage("请输入非空、有效的文字材料，最多 8192 UTF8 bytes"); }
  }
  async function write() {
    if (!ticket || ticket.phase === "saved" || posting) return;
    const input = ticket.input, current = generation.current, controller = new AbortController();
    clients.current.add(controller); setPosting(true); setWriteMessage("");
    // Until an exact receipt arrives the result is unknown, even after cancellation.
    setTicket({ input, phase: "unknown" });
    try {
      const result = await submitEvidence(activityId, input, controller.signal);
      if (controller.signal.aborted || generation.current !== current) return;
      setTicket({ input, phase: "saved" }); setWriteMessage("材料已保存，待核实。XP、Mastery 和奖励未改变。");
      setSaved(old => [result.submission, ...old.filter(row => row.requestId !== input.requestId)]);
      // Refresh is a separate read. It must never re-submit a successful write.
      setPosting(false); refresh();
    } catch (error) {
      if (!controller.signal.aborted && generation.current === current) setWriteMessage(evidenceClientMessage(error));
    } finally { clients.current.delete(controller); if (!controller.signal.aborted && generation.current === current) setPosting(false); }
  }
  function newDraft() {
    setTicket(null); setSkillId(""); setWriteMessage("已新建草稿。若上一请求结果未知，它可能已经保存；请先重新读取材料，避免重复提交。");
  }
  const frozen = ticket !== null;
  const displayed = [...saved, ...items.filter(row => !saved.some(done => done.requestId === row.requestId))];
  return <section aria-labelledby={`evidence-panel-${activityId}`} className="min-w-0 space-y-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-4 sm:p-6">
    <h2 id={`evidence-panel-${activityId}`} className="font-serif text-lg font-semibold">补充材料（待核实）</h2>
    <p className="text-sm leading-relaxed text-[var(--text-secondary)]">上方原文区只读；这里可以由你明确追加文字材料，不修改原文，不自动评估或验证，不改变 XP、Mastery 或奖励。链接只按文字保存。</p>
    <button type="button" aria-expanded={open} onClick={toggle} className={control}>{open ? "关闭补证面板" : "展开补证面板"}</button>
    {open && <div className="min-w-0 space-y-4">
      {loading && <p role="status">正在读取材料与技能选项…</p>}
      {readError && <div className="space-y-2"><p role="alert">{ticket?.phase === "saved" ? "材料保存成功，但重新读取失败。" : "读取失败。"}{readError}</p><button type="button" onClick={refresh} disabled={posting || loading} className={control}>重新读取材料与技能</button></div>}
      <div className="space-y-2">
        <label htmlFor={`evidence-skill-${activityId}`} className="block text-sm">关联技能（可选，仅本人未归档技能）</label>
        <select id={`evidence-skill-${activityId}`} value={skillId} disabled={frozen || posting} onChange={event => setSkillId(event.target.value)} className={`${control} w-full min-w-0 max-w-full`}>
          <option value="">不关联技能，仅补充此活动</option>
          {skillId && !skills.some(skill => skill.id === skillId) && <option value={skillId}>上次选择的技能（不在当前页；重试仍保留原关联）</option>}
          {skills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}{skill.nameTruncated ? "…（标签已截断）" : ""}</option>)}
        </select>
        {skillCursor && <button type="button" onClick={() => void next("skills")} disabled={more || loading || posting} className={control}>加载下一页技能</button>}
      </div>
      <div className="space-y-2">
        <label htmlFor={`evidence-text-${activityId}`} className="block text-sm">文字材料（可含纯文本链接）</label>
        <textarea id={`evidence-text-${activityId}`} rows={6} value={description} disabled={frozen || posting} onChange={event => { setDescription(event.target.value); setWriteMessage(""); }} aria-describedby={`evidence-bytes-${activityId}`} className={`${control} w-full min-w-0 resize-y [overflow-wrap:anywhere]`} />
        <p id={`evidence-bytes-${activityId}`} className="text-sm text-[var(--text-muted)]">{new TextEncoder().encode(description.trim()).byteLength} / 8192 UTF8 bytes；只去除首尾空白。E0 表示来源尚待独立核实。</p>
      </div>
      {!ticket && <button type="button" onClick={prepare} disabled={posting} className={control}>检查并准备提交</button>}
      {ticket?.phase === "confirm" && <section aria-label="确认补证" className="min-w-0 space-y-3">
        <p>确认把以下材料追加到此活动？这不是 Mastery 验证。</p>
        <pre className="min-w-0 whitespace-pre-wrap break-words font-sans [overflow-wrap:anywhere]">{ticket.input.description}</pre>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void write()} disabled={posting} className={control}>确认保存材料</button><button type="button" onClick={() => setTicket(null)} disabled={posting} className={control}>取消提交，继续编辑</button></div>
      </section>}
      {ticket?.phase === "unknown" && <div className="space-y-2"><p>结果尚未确认。重试将使用相同编号和原材料；不会换正文重用旧编号。</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void write()} disabled={posting || loading} className={control}>{posting ? "正在保存…" : "用相同编号重试"}</button><button type="button" onClick={newDraft} disabled={posting} className={control}>明确新建另一提交</button></div></div>}
      {ticket?.phase === "saved" && <button type="button" onClick={newDraft} className={control}>新建另一份材料</button>}
      {writeMessage && <p role="status" className="break-words text-sm [overflow-wrap:anywhere]">{writeMessage}</p>}
      <section aria-label="已补充的材料" className="min-w-0 space-y-3">
        <h3 className="font-semibold">本入口已保存的材料</h3>
        <p className="text-sm text-[var(--text-secondary)]">刚保存的回执置顶，其余列表按提交编号分页；不包含旧结算材料，也不表示验证通过或成长进度。</p>
        {!loading && !readError && displayed.length === 0 && <p>尚无本入口的补充材料。</p>}
        {displayed.map(row => <article key={row.requestId} className="min-w-0 space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
          <p className="text-sm">待核实 · E0 · {row.evidence.skillId ? "关联技能材料" : "活动通用材料"}</p>
          <pre data-testid="submitted-evidence-text" className="min-w-0 whitespace-pre-wrap break-words font-sans text-sm [overflow-wrap:anywhere]">{row.evidence.description}</pre>
          <p className="break-all text-xs text-[var(--text-muted)]">提交编号：{row.requestId}</p>
        </article>)}
        {itemCursor && <button type="button" onClick={() => void next("submissions")} disabled={more || loading || posting} className={control}>加载下一页材料</button>}
      </section>
    </div>}
  </section>;
}

export function EvidenceSubmissionPanel({ activityId }: { activityId: string }) {
  return <Panel key={activityId} activityId={activityId} />;
}
