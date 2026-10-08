"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SkillState } from "@/lib/store/types";
import { isZeroXpSkillReceipt, parseZeroXpSkillInput } from "@/lib/skills/bootstrap";

const buttonClass = "min-h-[var(--touch-target-min)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)] disabled:opacity-50";

export default function SkillCreateForm({ onCreated, onCancel, onUnauthorized }: {
  onCreated: (skill: SkillState) => void; onCancel: () => void; onUnauthorized: () => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    let input: { name: string };
    try { input = parseZeroXpSkillInput({ name }); }
    catch { setError("请输入1–200个字符的技能名称。"); return; }
    busy.current = true; setPending(true); setError(null);
    try {
      const res = await fetch("/api/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!alive.current) return;
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.status === 409) { setError("该技能名称已存在，请先查看技能列表（包括已归档技能）。"); return; }
      if (res.status === 400) { setError("请输入1–200个字符的技能名称。"); return; }
      if (res.status !== 201) throw Error("Uncertain response");
      const result = await res.json();
      if (!alive.current) return;
      if (!isZeroXpSkillReceipt(result?.skill, input.name)) throw Error("Invalid receipt");
      onCreated(result.skill);
    } catch {
      if (alive.current) setError("未能确认创建结果。请先刷新技能列表确认是否已保存，再重试；不会自动重复提交。");
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }

  return <form onSubmit={submit} aria-label="新建零XP技能" aria-busy={pending}
    className="max-h-[50dvh] shrink-0 space-y-3 overflow-y-auto border-b border-[var(--border-subtle)] bg-[var(--surface-base)] p-4">
    <h3 className="text-sm font-semibold text-[var(--text-primary)]">新建技能目录</h3>
    <p className="text-sm text-[var(--text-muted)]">初始 XP=0、等级1、Mastery=M0、置信度0。建档不代表能力提升，不发放积分或奖励。</p>
    <label htmlFor="manual-skill-name" className="block text-sm text-[var(--text-primary)]">技能名称</label>
    <input id="manual-skill-name" value={name} onChange={e => setName(e.target.value)} required disabled={pending}
      aria-describedby="manual-skill-help" autoFocus
      className="min-h-[var(--touch-target-min)] w-full max-w-md rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-ground)] px-3 py-2 text-sm text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]" />
    <p id="manual-skill-help" className="text-xs text-[var(--text-muted)]">例如 Molecular Ecology，最多200个字符。创建后可通过技能档案修改描述或归类。</p>
    {error ? <p role="alert" className="text-sm text-[var(--state-danger-text)]">{error}</p> : null}
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={pending} className={buttonClass}>{pending ? "正在建档…" : "确认建档（零XP）"}</button>
      <button type="button" onClick={onCancel} className={buttonClass}>取消</button>
    </div>
  </form>;
}
