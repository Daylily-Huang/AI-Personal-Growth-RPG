"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { DangerButton } from "@/components/ui/DangerButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { acceptArtifact, artifactAcceptanceMessage, getArtifactAcceptance, revokeArtifactAcceptance } from "@/lib/artifact-acceptance/client";
import { parseAcceptArtifactInput, parseRevokeArtifactInput } from "@/lib/artifact-acceptance/validation";
import { ArtifactAcceptanceError, type AcceptArtifactInput, type ArtifactAcceptanceMemory, type ArtifactAcceptancePending, type ArtifactAcceptanceSession, type ArtifactAcceptanceView, type RevokeArtifactInput } from "@/lib/artifact-acceptance/types";

const definitive = new Set(["ARTIFACT_ACCEPTANCE_INVALID_INPUT", "ARTIFACT_ACCEPTANCE_AUTH_REQUIRED", "ARTIFACT_ACCEPTANCE_FORBIDDEN", "ARTIFACT_ACCEPTANCE_NOT_FOUND", "ARTIFACT_ACCEPTANCE_SOURCE_INELIGIBLE", "ARTIFACT_ACCEPTANCE_STALE_SOURCE", "ARTIFACT_ACCEPTANCE_KEY_REUSED"]);
const fieldClass = "w-full min-h-[var(--touch-target-min)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3 text-sm text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]";

export function ArtifactAcceptancePanel({ artifactId, ownerId, session: memory }: {
  artifactId: string; ownerId: string; session: ArtifactAcceptanceMemory;
}) {
  const session = useSyncExternalStore(memory.subscribe, memory.getSnapshot, memory.getSnapshot);
  const [open, setOpen] = useState(false), [view, setView] = useState<ArtifactAcceptanceView | null>(null);
  const [reading, setReading] = useState(false), [busy, setBusy] = useState(false);
  const [readError, setReadError] = useState(""), [notice, setNotice] = useState("");
  const [note, setNote] = useState(""), [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState<"accept" | "revoke" | null>(null);
  const alive = useRef(true), reads = useRef(0), submitting = useRef(false), noticeRef = useRef<HTMLParagraphElement>(null);
  const region = useId(), noteId = useId(), reasonId = useId();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function patch(next: Partial<ArtifactAcceptanceSession>) { memory.update({ ...memory.getSnapshot(), ...next }); }
  function assertOwner(value: string) {
    const owner = memory.getSnapshot().owner;
    if (value !== ownerId || (owner !== null && owner !== ownerId)) {
      patch({ pending: null, receipt: null, owner: null });
      throw new ArtifactAcceptanceError("ARTIFACT_ACCEPTANCE_AUTH_REQUIRED");
    }
    patch({ owner: ownerId });
  }
  async function read() {
    const sequence = ++reads.current; setReading(true); setReadError("");
    try {
      const next = await getArtifactAcceptance(artifactId);
      if (!alive.current || sequence !== reads.current) return;
      assertOwner(next.artifact.userId); setView(next);
      // NONE is not proof that an unknown POST failed. Never clear a pending tuple here.
    } catch (error) {
      if (!alive.current || sequence !== reads.current) return;
      setView(null); setReadError(artifactAcceptanceMessage(error));
      if (error instanceof ArtifactAcceptanceError && error.message === "ARTIFACT_ACCEPTANCE_AUTH_REQUIRED") {
        patch({ pending: null, receipt: null, owner: null });
      }
    } finally { if (alive.current && sequence === reads.current) setReading(false); }
  }
  async function submit(pending: ArtifactAcceptancePending) {
    if (submitting.current || memory.getSnapshot().owner !== ownerId) return;
    submitting.current = true; patch({ pending: { ...pending, unknown: true } });
    setBusy(true); setNotice("");
    try {
      const result = pending.operation === "accept" ? await acceptArtifact(artifactId, pending.input as AcceptArtifactInput)
        : await revokeArtifactAcceptance(artifactId, pending.input as RevokeArtifactInput);
      assertOwner(result.acceptance.userId);
      // The page-session receipt survives panel unmounts and subsequent refresh failures.
      patch({ receipt: result, pending: null });
      if (alive.current) {
        setConfirmation(null); setNotice(result.acceptance.status === "REVOKED" ? "撤销回执已保存；原奖励与纠正历史均保留。" : "验收回执已保存：首次100愿望积分，不增加XP。正在核对当前记录。关键回执不会因刷新失败丢失。");
        setView(null); await read();
      }
    } catch (error) {
      const current = memory.getSnapshot();
      if (current.owner === ownerId && current.pending?.input.requestKey === pending.input.requestKey)
        patch({ pending: { ...pending, unknown: !(error instanceof ArtifactAcceptanceError && definitive.has(error.message)) } });
      if (alive.current) { setConfirmation(null); setNotice(artifactAcceptanceMessage(error)); }
    } finally {
      submitting.current = false;
      if (alive.current) { setBusy(false); noticeRef.current?.focus(); }
    }
  }
  function confirm() {
    if (!view || memory.getSnapshot().pending || submitting.current || !confirmation) return;
    try {
      const input = confirmation === "accept" ? parseAcceptArtifactInput({ requestKey: crypto.randomUUID(), expectedUpdatedAt: view.artifact.updatedAt, acceptanceNote: note })
        : parseRevokeArtifactInput({ requestKey: crypto.randomUUID(), reason });
      void submit({ operation: confirmation, input, unknown: true });
    } catch (error) { setConfirmation(null); setNotice(artifactAcceptanceMessage(error)); }
  }
  const pending = session.pending, saved = session.receipt;
  const eligible = view?.artifact.lifecycleStatus === "active" && view.artifact.isArchived === false;
  return <section className="space-y-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3" aria-label="作品用户验收">
    <SecondaryButton aria-expanded={open} aria-controls={region} onClick={() => {
      const next = !open; setOpen(next); if (next) void read();
    }}>{open ? "收起验收记录" : "查看／办理用户验收"}</SecondaryButton>
    {open && <div id={region} className="space-y-3 break-words">
      <h3 className="font-serif text-lg">用户验收 · 每件首次100愿望积分</h3>
      <p className="text-sm text-[var(--text-secondary)]">这是你对作品的手动验收，不是独立验证或Core核验；不增加XP、掌握度，也不把作品变为已验证Evidence。同一作品只奖励一次，改名、更新版本或恢复归档都不能再次领取。</p>
      {notice && <p role="status" tabIndex={-1} ref={noticeRef} className="text-sm focus-visible:outline-2 focus-visible:outline-[var(--focus-ring-color)]">{notice}</p>}
      {saved && <div data-testid="artifact-acceptance-saved-receipt" className="space-y-1 text-sm">
        <p>已保存的操作回执：{saved.acceptance.status === "REVOKED" ? "撤销成功" : "验收成功"}{saved.replayed ? "（原请求重放）" : ""}。当前状态以重新读取记录为准。</p>
        <p className="break-all">验收ID：{saved.acceptance.id}；原奖励ID：{saved.earn.id}</p>
      </div>}
      {reading && <p role="status">正在读取验收记录…</p>}
      {readError && <p role="alert">读取失败：{readError}{saved ? " 已保存的成功回执不受影响；请只重试读取。" : ""}</p>}
      <SecondaryButton disabled={reading || busy} onClick={() => void read()}>重新读取记录</SecondaryButton>
      {pending && <div role="status" className="space-y-2 text-sm">
        <p>{pending.unknown ? "提交结果不明。保留原请求和原输入；即使读取显示未验收，也不能换编号重复提交。" : "原请求明确未执行。核对当前记录后可结束本次尝试。"}</p>
        <p className="break-all">原请求编号：{pending.input.requestKey}</p>
        <SecondaryButton disabled={busy || reading || session.owner !== ownerId} onClick={() => void submit(pending)}>重放原请求核对</SecondaryButton>
        {!pending.unknown && <SecondaryButton disabled={busy || reading} onClick={() => {
          patch({ pending: null }); setView(null); setNotice("已结束未执行的尝试，请重新读取当前版本后再操作。");
        }}>结束本次未执行的尝试</SecondaryButton>}
      </div>}
      {view && <>
        <p className="text-sm">当前作品：{view.artifact.title}；当前版本：{view.artifact.version ?? "未标版本"}；状态：{view.artifact.lifecycleStatus}</p>
        {view.acceptance ? <div className="space-y-2 text-sm">
          <p>认定类型：用户验收（USER_CONFIRMED_ARTIFACT）</p>
          <p>验收时作品：{view.acceptance.acceptedTitle}；验收时版本：{view.acceptance.acceptedVersion ?? "未标版本"}</p>
          <p>验收说明：{view.acceptance.acceptanceNote}</p>
          <p>验收时间：{view.acceptance.acceptedAt}</p>
          <p className="break-all">原奖励：100愿望积分；EARN：{view.earn!.id}</p>
          <p>当前认定：{view.acceptance.status === "REVOKED" ? "已撤销，不能重新领奖" : "有效用户验收"}；积分状态：{view.correction ? "已纠正扣回（CORRECTED），不再有效" : "已记入愿望积分账本"}</p>
          {view.correction && <p className="break-all">纠正：-100；CORRECTION：{view.correction.id}</p>}
          {view.acceptance.revocationReason && <p>撤销原因：{view.acceptance.revocationReason}</p>}
          {view.acceptance.status === "ACTIVE" && !pending && <>
            <label htmlFor={reasonId}>撤销原因（必填）</label>
            <textarea id={reasonId} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} className={fieldClass} rows={3} />
            <DangerButton disabled={busy || reading || !reason.trim()} onClick={() => setConfirmation("revoke")}>撤销用户验收</DangerButton>
          </>}
        </div> : <div className="space-y-2 text-sm">
          <p>尚无验收记录（NONE）。浏览、创建或编辑作品不会自动发放积分。</p>
          {!eligible && <p>只有活跃且未归档的作品可以首次验收；请通过原编辑／恢复功能调整后重新读取。</p>}
          {!pending && !saved && <>
            <label htmlFor={noteId}>验收说明（必填）</label>
            <textarea id={noteId} value={note} onChange={event => setNote(event.target.value)} disabled={!eligible || busy} className={fieldClass} rows={3} />
            <PrimaryButton disabled={!eligible || busy || reading || !note.trim()} onClick={() => setConfirmation("accept")}>用户验收并领取100积分</PrimaryButton>
          </>}
          {saved && <p role="alert">读取结果与已保存的成功回执不一致，请继续核对记录；不会再次发起首次领取。</p>}
        </div>}
      </>}
      <ConfirmDialog open={confirmation !== null} onClose={() => { if (!busy) setConfirmation(null); }} onConfirm={confirm}
        title={confirmation === "revoke" ? "确认撤销用户验收" : "确认用户验收"}
        description={confirmation === "revoke" ? "保留验收与奖励历史，精确纠正100愿望积分。已消费部分可能成为待抵扣额度，不扣XP，也不能重新领取。" : "我已手动检查此作品及当前版本。同一作品首次奖励100愿望积分；这不表示独立核验，不增加XP。"}
        confirmLabel={confirmation === "revoke" ? "确认撤销" : "确认验收并领取"} destructive={confirmation === "revoke"} loading={busy} />
    </div>}
  </section>;
}
