import type { RewardLedgerState, RewardLedgerTransaction } from "./fold";

export type WishStatus = "IDEA" | "ACTIVE" | "PRIMARY" | "RESERVED" | "REDEEMED" | "ARCHIVED" | "CANCELLED";
export interface Wish {
  id: string;
  user_id: string;
  title: string;
  description: string;
  credit_cost: number | null;
  status: WishStatus;
  cooldown_until: string | null;
  created_at: string;
  updated_at: string;
}
export interface RewardAccount extends RewardLedgerState {
  id: string;
  user_id: string;
  updated_at: string;
}
export interface RewardTransaction extends RewardLedgerTransaction {
  id: string;
  account_id: string;
  user_id: string;
  canonical_source_type: string;
  canonical_source_id: string;
  policy_version: string | null;
  request_idempotency_key: string;
  correction_for_id: string | null;
  refund_for_redemption_id: string | null;
  note: string | null;
  created_at: string;
}
export interface RewardRedemption {
  id: string;
  user_id: string;
  wish_id: string;
  transaction_id: string;
  credits_spent: number;
  celebration_note: string | null;
  redeemed_at: string;
}
export interface WishMetadata {
  title?: string;
  description?: string;
  creditCost?: number | null;
}
export interface Pagination { offset: number; limit: number }
export interface Page<T> { items: T[]; nextOffset: number | null }
export type RewardSourceType = "SEASON" | "QUEST" | "MASTERY";
export interface RewardSourceCandidate {
  id: string;
  sourceType: RewardSourceType;
  sourceId: string;
  label: string;
  alreadyGranted: boolean;
}
export const WISH_ACTIONS = ["activate", "set-primary", "reserve", "unreserve", "redeem", "archive", "cancel"] as const;
export type WishAction = typeof WISH_ACTIONS[number];
export interface RewardResult {
  ok: boolean;
  replayed: boolean;
  error_code?: string;
  wish?: Wish;
  account?: RewardAccount;
  transaction?: RewardTransaction;
  redemption?: RewardRedemption;
}
export interface RewardGrantInput {
  sourceType: string;
  sourceId: string;
  policyVersion: string;
  requestIdempotencyKey: string;
}
