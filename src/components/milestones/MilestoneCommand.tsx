"use client";

import { useRef, useState } from "react";
import { BaseModal, PrimaryButton, SecondaryButton } from "@/components/ui";
import type { MilestoneProposal, MilestoneSource, MilestoneView, ProposalDecision } from "@/lib/milestone/types";
import { ErrorNotice, errorOf, fieldClass, isObject, JsonText, labelClass, MilestoneClientError, milestoneRequest } from "./client";

export type MilestoneIntent = { id: string } & (
  | { kind: "confirm"; source: MilestoneSource | null; realitySourceId?: string }
  | { kind: "settle"; milestone: MilestoneView }
  | { kind: "revoke"; milestone: MilestoneView }
  | { kind: "review"; proposal: MilestoneProposal; decision: ProposalDecision }
);
type Command = { path: string; body: Record<string, unknown>; keyName: string };
const payloadFields = new Set(["milestone_key", "title", "description", "recognition_class", "source_type", "source_id", "external_evidence_url", "external_credential_id"]);
/** Presentation validation only. The existing RPC remains the recognition authority. */
export function parseEditedMilestone(text: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("替换内容必须是完整的 JSON 对象。"); }
  if (!isObject(value) || Object.keys(value).some(key => !payloadFields.has(key))) throw new Error("提案含未知字段或金额等权限字段，请明确移除；不会静默裁剪后提交。");
  for (const [field, max] of [["milestone_key", 300], ["title", 300], ["recognition_class", 200], ["source_type", 200], ["source_id", 200]] as const) {
    const item = value[field];
    if (typeof item !== "string" || !item.trim() || item.trim().length > max) throw new Error(`请完整填写 ${field}（最多 ${max} 字符）。`);
  }
  if (!Object.hasOwn(value, "description")) throw new Error("替换内容必须包含 description，可设为 null。");
  for (const field of ["description", "external_evidence_url", "external_credential_id"]) {
    if (!Object.hasOwn(value, field)) continue;
    if (!(value[field] === null || (typeof value[field] === "string" && value[field].trim().length <= 10000))) throw new Error(`${field} 必须是文本或 null（最多 10000 字符）。`);
  }
  return value;
}
export function proposalReviewable(proposal: MilestoneProposal, decision: ProposalDecision, now = Date.now()) {
  return proposal.status === "PROPOSED" && new Date(proposal.expires_at).valueOf() > now &&
    proposal.availableDecisions.includes(decision) && (proposal.schema_version === 2 || decision === "REJECTED");
}

/** Verify the RPC's original receipt against this intent, never against a later GET. */
function validMutationReceipt(result: Record<string, unknown>, intent: Exclude<MilestoneIntent, { kind: "review" }>, body: Record<string, unknown>) {
  const m = result.milestone;
  if (result.ok !== true || !isObject(m) || typeof m.id !== "string" || !m.id.trim()) return false;
  if (intent.kind === "confirm") {
    return m.status === "ACTIVE" && m.granted_reward_credit === false && m.reward_transaction_id === null &&
      m.confirmation_request_idempotency_key === intent.id &&
      [["milestone_key", "milestoneKey"], ["title", "title"], ["description", "description"],
        ["recognition_class", "recognitionClass"], ["source_type", "sourceType"], ["source_id", "sourceId"],
        ["external_evidence_url", "externalEvidenceUrl"], ["external_credential_id", "externalCredentialId"]]
        .every(([field, input]) => m[field] === body[input]);
  }
  const original = intent.milestone;
  const immutableFields = ["id", "user_id", "milestone_key", "title", "description", "recognition_class", "source_type", "source_id",
    "external_evidence_url", "external_credential_id", "confirmation_request_idempotency_key", "recognized_at", "created_at"] as const;
  if (!immutableFields.every(field => m[field] === original[field])) return false;
  // A different session may settle after the preview; an already known link can never disappear/change.
  const rewardShape = m.granted_reward_credit === false ? m.reward_transaction_id === null
    : m.granted_reward_credit === true && m.recognition_class === "CORE_VERIFIED" && typeof m.reward_transaction_id === "string" && Boolean(m.reward_transaction_id.trim());
  if (!rewardShape || (original.granted_reward_credit &&
    (m.granted_reward_credit !== true || m.reward_transaction_id !== original.reward_transaction_id))) return false;
  if (intent.kind === "revoke") return m.status === "REVOKED" &&
    typeof m.revoked_at === "string" && Number.isFinite(Date.parse(m.revoked_at)) &&
    m.revocation_request_idempotency_key === intent.id && m.revocation_reason === body.revocationReason;
  const tx = result.transaction;
  return m.status === "ACTIVE" && m.granted_reward_credit === true && isObject(tx) &&
    typeof tx.id === "string" && Boolean(tx.id.trim()) && m.reward_transaction_id === tx.id &&
    tx.event_kind === "EARN" && tx.user_id === m.user_id && tx.canonical_source_type === m.source_type &&
    tx.canonical_source_id === m.source_id && tx.policy_version === body.policyVersion && tx.request_idempotency_key === intent.id;
}

// Comparison only: the outgoing payload is untouched and SQL remains the authority.
function receiptPayload(value: unknown): Record<string, unknown> | null {
  if (!isObject(value) || Object.keys(value).some(key => !payloadFields.has(key)) ||
    ["milestone_key", "title", "description", "recognition_class", "source_type", "source_id"].some(key => !Object.hasOwn(value, key))) return null;
  const normalized: Record<string, unknown> = { external_evidence_url: null, external_credential_id: null, ...value };
  for (const key of payloadFields) {
    if (typeof normalized[key] !== "string") continue;
    const text = normalized[key].trim();
    normalized[key] = ["recognition_class", "source_type"].includes(key) ? text.toUpperCase()
      : ["description", "external_evidence_url", "external_credential_id"].includes(key) ? text || null : text;
  }
  if (typeof normalized.source_id === "string") {
    const id = normalized.source_id;
    if (normalized.source_type === "MASTERY") {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:M(6|8|10)$/i.test(id) && /:M(6|8|10)$/.test(id)) {
        normalized.source_id = id.slice(0, 36).toLowerCase() + id.slice(36);
      }
    } else if (["QUEST", "SEASON", "EXTERNAL_CREDENTIAL"].includes(String(normalized.source_type))) {
      const bare = id.replace(/^\{(.+)\}$/, "$1");
      if (/^[0-9a-f]{4}(?:-?[0-9a-f]{4}){7}$/i.test(bare)) {
        const hex = bare.replaceAll("-", "").toLowerCase();
        normalized.source_id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
    }
  }
  return normalized;
}
/** JSONB object order is immaterial; array order, own keys and every nested value are not. */
function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left)) return Array.isArray(right) && left.length === right.length && left.every((value, index) => sameJson(value, right[index]));
  if (!isObject(left) || !isObject(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameJson(left[key], right[key]));
}
function validReviewReceipt(result: Record<string, unknown>, intent: Extract<MilestoneIntent, { kind: "review" }>, body: Record<string, unknown>) {
  const proposal = result.proposal;
  if (!isObject(proposal) || proposal.id !== intent.proposal.id || proposal.status !== intent.decision ||
    proposal.decision !== intent.decision || proposal.proposal_type !== "MILESTONE_CANDIDATE" ||
    proposal.schema_version !== intent.proposal.schema_version || proposal.review_request_idempotency_key !== intent.id ||
    !["payload", "source_refs", "model_metadata", "created_at", "expires_at"].every(field =>
      sameJson(proposal[field], intent.proposal[field as keyof MilestoneProposal])) ||
    typeof proposal.reviewed_at !== "string" || !Number.isFinite(Date.parse(proposal.reviewed_at))) return false;
  if (intent.decision === "REJECTED") return proposal.rejection_reason === body.rejectionReason &&
    proposal.resulting_entity_type === null && proposal.resulting_entity_id === null &&
    result.milestone === null && result.result === null && result.reviewed_payload === null;
  const expected = receiptPayload(intent.decision === "EDITED" ? body.editedPayload : intent.proposal.payload);
  const m = result.milestone;
  if (!expected || !isObject(result.reviewed_payload) || Object.keys(result.reviewed_payload).some(key => !payloadFields.has(key)) ||
    !Array.from(payloadFields).every(key => (result.reviewed_payload as Record<string, unknown>)[key] === expected[key]) ||
    !isObject(m) || proposal.rejection_reason !== null || proposal.resulting_entity_type !== "milestones" ||
    proposal.resulting_entity_id !== m.id || !isObject(result.result) || result.result.milestone_id !== m.id ||
    typeof proposal.user_id !== "string" || proposal.user_id !== m.user_id) return false;
  return validMutationReceipt({ ok: true, milestone: m }, { id: intent.id, kind: "confirm", source: null }, {
    milestoneKey: expected.milestone_key, title: expected.title, description: expected.description,
    recognitionClass: expected.recognition_class, sourceType: expected.source_type, sourceId: expected.source_id,
    externalEvidenceUrl: expected.external_evidence_url, externalCredentialId: expected.external_credential_id,
  });
}

export function MilestoneCommand({ intent, open, onDismiss, onSuccess, onPending, onEnd }: {
  intent: MilestoneIntent; open: boolean; onDismiss: (submitted: boolean) => void;
  onSuccess: () => void; onPending: () => void; onEnd: () => void;
}) {
  const [title, setTitle] = useState(intent.kind === "confirm" ? intent.source?.label ?? "" : "");
  const [classification, setClassification] = useState(intent.kind === "confirm" && intent.source ? `core.${intent.source.sourceType.toLowerCase()}` : "reality.event");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [credential, setCredential] = useState("");
  const [reason, setReason] = useState("");
  const [replacement, setReplacement] = useState(intent.kind === "review" ? JSON.stringify(intent.proposal.payload, null, 2) : "");
  const [command, setCommand] = useState<Command | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const snapshot = useRef<string | null>(null);
  const lock = useRef(false);
  const completed = useRef(false);
  const heading = intent.kind === "confirm" ? (intent.source ? "确认 Core 成就" : "记录现实成就")
    : intent.kind === "settle" ? "单独结算奖励" : intent.kind === "revoke" ? "撤销成就认定"
    : intent.decision === "ACCEPTED" ? "接受成就提案" : intent.decision === "EDITED" ? "编辑后认定" : "拒绝成就提案";
  const needsReason = intent.kind === "revoke" || (intent.kind === "review" && intent.decision === "REJECTED");
  function prepare() {
    setError(null);
    try {
      if (needsReason && !reason.trim()) throw new Error("请填写操作原因。");
      if (intent.kind === "confirm") {
        if (!title.trim() || !classification.trim()) throw new Error("请填写成就名称与分类标识。");
        if (!intent.source && !intent.realitySourceId) throw new Error("事件标识缺失，请重新打开记录表单。");
        setCommand({ path: "/api/milestones", keyName: "confirmationRequestIdempotencyKey", body: {
          milestoneKey: classification.trim(), title: title.trim(), description: description.trim() || null,
          recognitionClass: intent.source ? "CORE_VERIFIED" : "USER_CONFIRMED_REAL_WORLD",
          sourceType: intent.source?.sourceType ?? "EXTERNAL_CREDENTIAL", sourceId: intent.source?.sourceId ?? intent.realitySourceId,
          externalEvidenceUrl: url.trim() || null, externalCredentialId: credential.trim() || null,
        } });
      } else if (intent.kind === "settle") {
        setCommand({ path: `/api/milestones/${intent.milestone.id}/settle`, keyName: "requestIdempotencyKey", body: { policyVersion: "reward-v1" } });
      } else if (intent.kind === "revoke") {
        setCommand({ path: `/api/milestones/${intent.milestone.id}/revoke`, keyName: "revocationRequestIdempotencyKey", body: { revocationReason: reason.trim() } });
      } else {
        if (!proposalReviewable(intent.proposal, intent.decision)) throw new Error("该提案已过期或不支持本次决定，请重新读取。");
        setCommand({ path: `/api/outer-loop/proposals/${intent.proposal.id}/review`, keyName: "reviewRequestIdempotencyKey", body: {
          decision: intent.decision,
          ...(intent.decision === "EDITED" ? { editedPayload: parseEditedMilestone(replacement) } : {}),
          ...(intent.decision === "REJECTED" ? { rejectionReason: reason.trim() } : {}),
        } });
      }
    } catch (cause) { setError(errorOf(cause)); }
  }
  async function confirm() {
    if (!command || lock.current || completed.current) return;
    // Uncertain retries may replay even after expiry; only a new submission is gated here.
    if (!snapshot.current && intent.kind === "review" && !proposalReviewable(intent.proposal, intent.decision)) {
      setError(new Error("提案已经过期，请重新读取；未提交本次决定。")); return;
    }
    lock.current = true; setBusy(true); setError(null);
    if (snapshot.current === null) {
      snapshot.current = JSON.stringify({ ...command.body, [command.keyName]: intent.id });
      setSubmitted(true); onPending();
    }
    try {
      const response = await milestoneRequest<Record<string, unknown>>(command.path, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: snapshot.current,
      });
      const result = intent.kind === "review" ? response.result : response;
      const valid = isObject(result) && typeof result.replayed === "boolean" && (intent.kind === "review"
        ? validReviewReceipt(result, intent, JSON.parse(snapshot.current))
        : validMutationReceipt(result, intent, JSON.parse(snapshot.current)));
      if (!valid) throw new MilestoneClientError("未收到有效成功回执，请保留原请求重试。");
      completed.current = true;
    } catch (cause) { setError(errorOf(cause)); }
    finally { lock.current = false; setBusy(false); }
    // Read refresh/callback errors are never caught as a failed mutation.
    if (completed.current) onSuccess();
  }
  function dismiss() { if (!lock.current) onDismiss(submitted); }
  const definiteRejection = error instanceof MilestoneClientError && [400, 401, 403, 404, 409, 422].includes(error.status);
  return <BaseModal open={open} onClose={dismiss} title={heading} closeOnEscape={!busy} closeOnBackdropClick={!busy}
    footer={<div className="flex flex-wrap justify-end gap-2">
      <SecondaryButton disabled={busy} onClick={dismiss}>{submitted ? "暂时关闭" : "取消"}</SecondaryButton>
      {definiteRejection && <SecondaryButton disabled={busy} onClick={onEnd}>结束本次尝试</SecondaryButton>}
      {command && !submitted && <SecondaryButton onClick={() => { setCommand(null); setError(null); }}>返回编辑</SecondaryButton>}
      <PrimaryButton loading={busy} disabled={needsReason && !reason.trim()} onClick={() => command ? void confirm() : prepare()}>
        {submitted ? "重试同一请求" : command ? "确认提交" : "核对内容"}
      </PrimaryButton>
    </div>}>
    <div className="min-w-0 space-y-4 text-sm [overflow-wrap:anywhere]">
      {intent.kind === "confirm" && <p>{intent.source
        ? "候选来源由服务器再次核验。此操作只认定成就，不发放积分，也不改变任务、赛季、XP 或掌握度。"
        : "这是你的现实经历自述，不是系统或第三方验证。本阶段只记录，奖励积分为 0；链接与证书编号不会被访问或验证。"}</p>}
      {(intent.kind === "settle" || intent.kind === "revoke") && <>
        <p className="whitespace-pre-wrap">{intent.milestone.title} · {intent.milestone.id}</p>
        <p>来源：{intent.milestone.source_type} / {intent.milestone.source_id}</p>
        {intent.kind === "settle" ? <p>只结算该 Core 来源在 reward-v1 下尚未发放的奖励，金额由服务器确定。已有或已修正的来源奖励不能再次发放，也不会被自动关联；不消费 XP 或掌握度。</p>
          : <><p>撤销后不能恢复认定或为同一事实再次认定。保留原始内容、账本和撤销原因，不更改底层任务、证据、赛季、XP 或掌握度。</p>
            <p>{intent.milestone.reward.transaction
              ? `本成就关联的原始发放为 ${intent.milestone.reward.transaction.amount} 积分。未修正时将等额冲正；已经修正时只复用原冲正，不会再扣一次。`
              : "本成就没有关联发放，只撤销认定；单独存在的来源奖励保持不变。"}</p>
            <p>若关联积分已经使用，形成的缺口由后续有效奖励抵补，不扣 XP，也不撤回已兑换心愿或删除凭证。服务器在事务中核验最终状态。</p></>}
      </>}
      {intent.kind === "review" && <>
        <p>提案 {intent.proposal.id} · 原始版本 v{intent.proposal.schema_version}。接受或编辑后接受只认定成就，不发放积分；拒绝不创建成就。</p>
        {!intent.proposal.supportedSchema && <p>旧版本不支持接受或编辑认定，只能在有效期内拒绝。不会升级、克隆或重写原提案。</p>}
        <details><summary className="cursor-pointer py-2">原始提案及来源（只读）</summary><JsonText value={{ payload: intent.proposal.payload, source_refs: intent.proposal.source_refs, model_metadata: intent.proposal.model_metadata }} /></details>
      </>}
      {!command && intent.kind === "confirm" && <div className="space-y-3">
        <label className={labelClass}>成就名称<input className={fieldClass} maxLength={300} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label className={labelClass}>分类标识<input className={fieldClass} maxLength={300} value={classification} onChange={event => setClassification(event.target.value)} /></label>
        <label className={labelClass}>成就说明（选填）<textarea className={fieldClass} rows={3} maxLength={10000} value={description} onChange={event => setDescription(event.target.value)} /></label>
        {!intent.source && <><label className={labelClass}>证据链接（仅记录，不验证）<textarea className={fieldClass} rows={2} maxLength={10000} value={url} onChange={event => setUrl(event.target.value)} /></label>
          <label className={labelClass}>证书或凭据说明（选填）<textarea className={fieldClass} rows={2} maxLength={10000} value={credential} onChange={event => setCredential(event.target.value)} /></label>
          <p>事件标识：{intent.realitySourceId}。不同标识是否描述同一现实经历，需要你自行核对。</p></>}
      </div>}
      {!command && intent.kind === "review" && intent.decision === "EDITED" && <label className={labelClass}>完整替换内容（JSON）
        <span>必须包含 milestone_key、title、description、recognition_class、source_type、source_id；可选 external_evidence_url / external_credential_id。不得包含积分或权限字段。</span>
        <textarea className={`${fieldClass} font-mono`} rows={12} value={replacement} onChange={event => setReplacement(event.target.value)} />
      </label>}
      {!command && needsReason && <label className={labelClass}>操作原因（必填）<textarea className={fieldClass} rows={3} maxLength={10000} value={reason} onChange={event => setReason(event.target.value)} /></label>}
      {command && <div className="space-y-2"><p>请核对将提交的完整内容。{intent.kind === "confirm" ? "认定后的名称、说明及来源不可修改。" : ""}</p><JsonText value={command.body} /></div>}
      {submitted && <p>请求已固定，重试保持同一标识与内容。暂时关闭后可在当前页面继续核对；不要刷新或离开页面来发起另一次操作。请求标识：{intent.id}</p>}
      <ErrorNotice error={error} />
    </div>
  </BaseModal>;
}
