"use client";

import { useRef, useState, type FormEvent } from "react";
import { BaseModal, PrimaryButton, SecondaryButton } from "@/components/ui";
import type { Wish } from "@/lib/reward/types";
import { ErrorNotice, errorOf, fieldClass, labelClass, rewardRequest } from "./client";

export function WishEditor({ wish, onClose, onSaved }: { wish: Wish | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(wish?.title ?? "");
  const [description, setDescription] = useState(wish?.description ?? "");
  const [cost, setCost] = useState(wish?.credit_cost?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lock = useRef(false);
  const price = cost.trim() ? Number(cost) : null;
  const valid = Boolean(title.trim()) && (price === null || (Number.isInteger(price) && price > 0 && price <= 2147483647));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current || !valid) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      await rewardRequest(wish ? `/api/rewards/wishes/${wish.id}` : "/api/rewards/wishes", {
        method: wish ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), creditCost: price }),
      });
      onSaved();
    } catch (cause) { setError(errorOf(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <BaseModal open onClose={() => { if (!busy) onClose(); }} closeOnEscape={!busy} closeOnBackdropClick={!busy}
    title={wish ? "编辑心愿" : "记录新心愿"} description="心愿预算以奖励积分计价，与经验值无关；创建不会扣除积分。">
    <form className="space-y-4" onSubmit={event => void save(event)}>
      <label className={labelClass}>心愿名称<input className={fieldClass} required maxLength={300} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} /></label>
      <label className={labelClass}>心愿描述<textarea className={fieldClass} rows={3} maxLength={10000} value={description} disabled={busy} onChange={event => setDescription(event.target.value)} /></label>
      <label className={labelClass}>积分预算（可暂不填写）<input className={fieldClass} type="number" min={1} max={2147483647} step={1} value={cost} disabled={busy} onChange={event => setCost(event.target.value)} /></label>
      <p className="text-sm text-[var(--text-secondary)]">设置正整数预算后才能激活、选择和预留。成为当前目标后不能直接改价。</p>
      <ErrorNotice error={error} />
      <div className="flex flex-wrap justify-end gap-2"><SecondaryButton disabled={busy} onClick={onClose}>取消编辑</SecondaryButton><PrimaryButton type="submit" disabled={!valid} loading={busy}>保存心愿</PrimaryButton></div>
    </form>
  </BaseModal>;
}
