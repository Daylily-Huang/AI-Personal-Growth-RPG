"use client";

import { useRef, useState } from "react";
import { BaseModal, PrimaryButton, SecondaryButton } from "@/components/ui";
import { ErrorNotice, errorOf, fieldClass, labelClass, rewardRequest } from "./client";

export interface RewardIntent {
  id: string;
  path: string;
  title: string;
  explanation: string;
  body: Record<string, unknown>;
  keyName?: "requestIdempotencyKey" | "reviewRequestIdempotencyKey";
  note?: "note" | "celebrationNote" | "rejectionReason";
}
export function RewardConfirmation({ intent, onClose, onSuccess }: {
  intent: RewardIntent; onClose: () => void; onSuccess: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const lock = useRef(false);
  const snapshot = useRef<string | null>(null);
  const required = intent.note === "note" || intent.note === "rejectionReason";
  async function confirm() {
    if (lock.current || (required && !note.trim())) return;
    lock.current = true; setBusy(true); setError(null);
    if (!snapshot.current) {
      snapshot.current = JSON.stringify({ ...intent.body,
        [intent.keyName ?? "requestIdempotencyKey"]: intent.id,
        ...(intent.note ? { [intent.note]: note.trim() || null } : {}),
      });
      setSubmitted(true);
    }
    try {
      await rewardRequest(intent.path, { method: "POST", headers: { "Content-Type": "application/json" }, body: snapshot.current });
      // Refresh is a separate read operation: never retry a confirmed mutation because it failed.
      onSuccess();
    } catch (cause) { setError(errorOf(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <BaseModal open onClose={() => { if (!busy) onClose(); }} title={intent.title}
    closeOnEscape={!busy} closeOnBackdropClick={!busy}
    footer={<><SecondaryButton disabled={busy} onClick={onClose}>关闭</SecondaryButton>
      <PrimaryButton loading={busy} disabled={required && !note.trim()} onClick={() => void confirm()}>{submitted ? "重试同一请求" : "确认操作"}</PrimaryButton></>}>
    <div className="space-y-4 [overflow-wrap:anywhere]">
      <p className="whitespace-pre-wrap text-sm">{intent.explanation}</p>
      <p className="text-sm text-[var(--text-secondary)]">只有确认后才会提交。所有金额与状态由服务器核验，XP 和掌握度不会被消费。</p>
      {intent.note && <label className={labelClass}>{required ? "操作说明（必填）" : "兑换备注（选填）"}
        <textarea className={fieldClass} rows={3} maxLength={10000} value={note} disabled={submitted} onChange={event => setNote(event.target.value)} />
      </label>}
      {submitted && error && <p className="text-sm text-[var(--text-secondary)]">重试将沿用相同请求标识和原始内容，不会重复结算。也可关闭后刷新核对。</p>}
      <ErrorNotice error={error} />
    </div>
  </BaseModal>;
}
