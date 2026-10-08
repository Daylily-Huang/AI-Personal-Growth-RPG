import type { MilestoneProposal, MilestoneSource, MilestoneView } from "@/lib/milestone/types";
import type { RewardTransaction } from "@/lib/reward/types";

export const milestoneId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const sourceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const proposalId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const transactionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const ownerId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const stamp = "2026-10-01T12:00:00.000Z";
export function milestoneFixture(patch: Partial<MilestoneView> = {}): MilestoneView {
  return { id: milestoneId, user_id: ownerId, milestone_key: "core.quest", title: "完成研究计划", description: "可追溯的进展",
    recognition_class: "CORE_VERIFIED", source_type: "QUEST", source_id: sourceId, external_evidence_url: null, external_credential_id: null,
    status: "ACTIVE", granted_reward_credit: false, reward_transaction_id: null, confirmation_request_idempotency_key: "confirm-key",
    revocation_request_idempotency_key: null, recognized_at: stamp, revoked_at: null, revocation_reason: null, created_at: stamp, updated_at: stamp,
    selfAttested: false, reward: { status: "NOT_ISSUED", transaction: null, correction: null, existingSourceReward: null }, ...patch };
}
export function transactionFixture(patch: Partial<RewardTransaction> = {}): RewardTransaction {
  return { id: transactionId, account_id: ownerId, user_id: ownerId, event_kind: "EARN", amount: 150, canonical_source_type: "QUEST", canonical_source_id: sourceId,
    policy_version: "reward-v1", request_idempotency_key: "earn-key", correction_for_id: null, refund_for_redemption_id: null, note: null, created_at: stamp, ...patch };
}
/** Match the accepted 0052 mutation receipt, not a generic success-shaped object. */
export function mutationReceipt(path: string, body: Record<string, unknown>, replayed = false, original = milestoneFixture()) {
  if (path.endsWith("/settle")) {
    const transaction = transactionFixture({ request_idempotency_key: String(body.requestIdempotencyKey) });
    return { ok: true, replayed, milestone: { ...original, granted_reward_credit: true, reward_transaction_id: transaction.id }, transaction };
  }
  if (path.endsWith("/revoke")) return { ok: true, replayed, milestone: { ...original, status: "REVOKED", revoked_at: stamp,
    revocation_reason: String(body.revocationReason), revocation_request_idempotency_key: String(body.revocationRequestIdempotencyKey) } };
  return { ok: true, replayed, milestone: milestoneFixture({ milestone_key: String(body.milestoneKey), title: String(body.title),
    description: body.description as string | null, recognition_class: body.recognitionClass as MilestoneView["recognition_class"],
    source_type: body.sourceType as MilestoneView["source_type"], source_id: String(body.sourceId),
    external_evidence_url: body.externalEvidenceUrl as string | null, external_credential_id: body.externalCredentialId as string | null,
    confirmation_request_idempotency_key: String(body.confirmationRequestIdempotencyKey) }) };
}
export function sourceFixture(patch: Partial<MilestoneSource> = {}): MilestoneSource {
  return { id: sourceId, sourceId, sourceType: "QUEST", label: "已完成的 Epic", recognition: null, existingSourceReward: null, ...patch };
}
export function proposalFixture(patch: Partial<MilestoneProposal> = {}): MilestoneProposal {
  return { id: proposalId, schema_version: 2, proposal_type: "MILESTONE_CANDIDATE", status: "PROPOSED",
    payload: { milestone_key: "core.quest", title: "提案标题", description: null, recognition_class: "CORE_VERIFIED", source_type: "QUEST", source_id: sourceId },
    source_refs: [{ type: "Quest", id: sourceId, note: "来源原文" }], model_metadata: { model: "fixture-model", prompt_contract: "milestone-fixture", temperature: 0.3, trace: { ids: ["嵌套来源"] } },
    expires_at: "2099-01-01T00:00:00Z", created_at: stamp, reviewed_at: null, decision: null, rejection_reason: null, resulting_entity_type: null, resulting_entity_id: null,
    supportedSchema: true, availableDecisions: ["ACCEPTED", "EDITED", "REJECTED"], ...patch };
}
export function reviewReceipt(body: Record<string, unknown>, proposal = proposalFixture(), replayed = false,
  normalizedPayload = (body.editedPayload ?? proposal.payload) as Record<string, unknown>) {
  const rejected = body.decision === "REJECTED";
  const payload = { external_evidence_url: null, external_credential_id: null, ...normalizedPayload };
  const milestone = rejected ? null : milestoneFixture({ ...payload, confirmation_request_idempotency_key: String(body.reviewRequestIdempotencyKey) } as Partial<MilestoneView>);
  return { result: { proposal: { ...proposal, user_id: ownerId, status: body.decision, decision: body.decision,
    review_request_idempotency_key: body.reviewRequestIdempotencyKey, reviewed_at: stamp,
    rejection_reason: rejected ? body.rejectionReason : null, resulting_entity_type: rejected ? null : "milestones", resulting_entity_id: milestone?.id ?? null },
    milestone, reviewed_payload: rejected ? null : payload, result: milestone ? { milestone_id: milestone.id } : null, replayed } };
}
