import type { RewardAccount, RewardTransaction } from "@/lib/reward/types";

export type RecognitionClass = "CORE_VERIFIED" | "USER_CONFIRMED_REAL_WORLD";
export type CoreSource = "QUEST" | "SEASON" | "MASTERY";
export type MilestoneStatus = "ACTIVE" | "REVOKED";
export interface Milestone {
  id: string; user_id: string; milestone_key: string; title: string; description: string | null;
  recognition_class: RecognitionClass; source_type: CoreSource | "EXTERNAL_CREDENTIAL"; source_id: string;
  external_evidence_url: string | null; external_credential_id: string | null; status: MilestoneStatus;
  granted_reward_credit: boolean; reward_transaction_id: string | null;
  confirmation_request_idempotency_key: string; revocation_request_idempotency_key: string | null;
  recognized_at: string; revoked_at: string | null; revocation_reason: string | null;
  created_at: string; updated_at: string;
}
export interface SourceReward { transaction: RewardTransaction; correction: RewardTransaction | null }
export interface MilestoneView extends Milestone {
  selfAttested: boolean;
  reward: {
    status: "NOT_ISSUED" | "ISSUED" | "CORRECTED" | "NOT_AVAILABLE";
    transaction: RewardTransaction | null; correction: RewardTransaction | null;
    existingSourceReward: SourceReward | null;
  };
}
export interface Pagination { limit: number; offset: number }
export interface Page<T> { items: T[]; nextOffset: number | null }
export interface MilestoneFilter { status?: MilestoneStatus; recognitionClass?: RecognitionClass }
export interface ConfirmMilestone {
  milestoneKey: string; title: string; description: string | null;
  recognitionClass: string; sourceType: string; sourceId: string;
  externalEvidenceUrl: string | null; externalCredentialId: string | null;
  confirmationRequestIdempotencyKey: string;
}
export interface MilestoneResult {
  ok: true; replayed: boolean; milestone: Milestone;
  transaction?: RewardTransaction; correction?: RewardTransaction | null;
  correction_reused?: boolean; account?: RewardAccount | null;
}
export interface MilestoneSource {
  id: string; sourceType: CoreSource; sourceId: string; label: string;
  recognition: { id: string; status: MilestoneStatus } | null;
  existingSourceReward: SourceReward | null;
}
export type ProposalStatus = "PROPOSED" | "ACCEPTED" | "EDITED" | "REJECTED";
export type ProposalDecision = Exclude<ProposalStatus, "PROPOSED">;
export interface MilestoneProposal {
  id: string; schema_version: number; proposal_type: "MILESTONE_CANDIDATE"; status: ProposalStatus;
  payload: Record<string, unknown>; source_refs: unknown; expires_at: string; created_at: string;
  reviewed_at: string | null; decision: string | null; rejection_reason: string | null;
  resulting_entity_type: string | null; resulting_entity_id: string | null;
  supportedSchema: boolean; availableDecisions: ProposalDecision[];
}
