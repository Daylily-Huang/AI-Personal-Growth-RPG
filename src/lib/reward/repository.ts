import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Page, Pagination, RewardAccount, RewardGrantInput, RewardRedemption,
  RewardResult, RewardSourceCandidate, RewardSourceType, RewardTransaction,
  Wish, WishAction, WishMetadata,
} from "./types";

export class RewardRepositoryError extends Error {
  constructor(message: string, readonly code: string | null = null) {
    super(message);
    this.name = "RewardRepositoryError";
  }
}
function checked<T>(data: T, error: { message: string; code?: string } | null): T {
  if (error) throw new RewardRepositoryError(error.message, error.code);
  return data;
}
function page<T>(rows: T[], p: Pagination): Page<T> {
  return { items: rows.slice(0, p.limit), nextOffset: rows.length > p.limit ? p.offset + p.limit : null };
}
function metadata(input: WishMetadata) {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.creditCost !== undefined ? { credit_cost: input.creditCost } : {}),
  };
}
const WISH_RPC: Record<WishAction, string> = {
  activate: "rpc_activate_wish",
  "set-primary": "rpc_set_primary_wish",
  reserve: "rpc_reserve_wish_credits",
  unreserve: "rpc_unreserve_wish_credits",
  redeem: "rpc_redeem_wish",
  archive: "rpc_archive_wish",
  cancel: "rpc_cancel_wish",
};

/** User-scoped client only. No service-role fallback and no Core writes. */
export class RewardRepository {
  constructor(private readonly db: SupabaseClient, private readonly userId: string) {}

  async account(): Promise<RewardAccount | null> {
    const { data, error } = await this.db.from("reward_accounts").select("*").eq("user_id", this.userId).maybeSingle();
    return checked(data, error);
  }
  async transactions(p: Pagination): Promise<Page<RewardTransaction>> {
    const { data, error } = await this.db.from("reward_transactions").select("*").eq("user_id", this.userId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(p.offset, p.offset + p.limit);
    return page(checked(data ?? [], error), p);
  }
  async redemptions(p: Pagination): Promise<Page<RewardRedemption & { refunded: boolean }>> {
    const { data, error } = await this.db.from("reward_redemptions").select("*").eq("user_id", this.userId)
      .order("redeemed_at", { ascending: false }).order("id", { ascending: false }).range(p.offset, p.offset + p.limit);
    const receipts = page<RewardRedemption>(checked(data ?? [], error), p);
    if (!receipts.items.length) return { items: [], nextOffset: null };
    const refunds = await this.db.from("reward_transactions").select("refund_for_redemption_id")
      .eq("user_id", this.userId).eq("event_kind", "REFUND").in("refund_for_redemption_id", receipts.items.map(r => r.id));
    const refunded = new Set(checked(refunds.data ?? [], refunds.error).map(r => r.refund_for_redemption_id));
    return { ...receipts, items: receipts.items.map(r => ({ ...r, refunded: refunded.has(r.id) })) };
  }
  async wishes(p: Pagination): Promise<Page<Wish>> {
    const { data, error } = await this.db.from("wishes").select("*").eq("user_id", this.userId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(p.offset, p.offset + p.limit);
    return page(checked(data ?? [], error), p);
  }
  async wish(id: string): Promise<Wish | null> {
    const { data, error } = await this.db.from("wishes").select("*").eq("user_id", this.userId).eq("id", id).maybeSingle();
    return checked(data, error);
  }
  async createWish(input: WishMetadata & { title: string }): Promise<Wish> {
    const { data, error } = await this.db.from("wishes").insert({ user_id: this.userId, ...metadata(input) }).select("*").single();
    return checked(data, error);
  }
  async editWish(id: string, input: WishMetadata): Promise<Wish | null> {
    // Do not filter status: the DB trigger must reject an illegal edit, not silently update zero rows.
    const { data, error } = await this.db.from("wishes").update(metadata(input))
      .eq("user_id", this.userId).eq("id", id).select("*").maybeSingle();
    return checked(data, error);
  }
  async proposals(id: string, p: Pagination): Promise<Page<Record<string, unknown>>> {
    const { data, error } = await this.db.from("outer_loop_proposals")
      .select("id,proposal_type,status,payload,source_refs,expires_at,created_at,resulting_entity_id")
      // Route IDs are validated UUIDs (no wildcard syntax); JSON UUID case is not identity.
      .eq("user_id", this.userId).eq("proposal_type", "WISH_COST_SUGGESTION").ilike("payload->>wish_id", id)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(p.offset, p.offset + p.limit);
    return page(checked(data ?? [], error), p);
  }
  async sources(type: RewardSourceType, p: Pagination): Promise<Page<RewardSourceCandidate>> {
    let candidates: Page<Omit<RewardSourceCandidate, "alreadyGranted">>;
    if (type === "MASTERY") {
      const { data, error } = await this.db.from("mastery_verifications").select("id,skill_id,skill_name,to_level,created_at")
        .eq("user_id", this.userId).eq("status", "verified").in("to_level", [6, 8, 10])
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(p.offset, p.offset + p.limit);
      candidates = page(checked(data ?? [], error).map(r => ({
        id: r.id, sourceType: type, sourceId: `${r.skill_id}:M${r.to_level}`, label: `${r.skill_name} · M${r.to_level}`,
      })), p);
    } else if (type === "SEASON") {
      const { data, error } = await this.db.from("seasons").select("id,name,created_at")
        .eq("user_id", this.userId).eq("status", "COMPLETED")
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(p.offset, p.offset + p.limit);
      candidates = page(checked(data ?? [], error).map(r => ({ id: r.id, sourceType: type, sourceId: r.id, label: r.name })), p);
    } else {
      const { data, error } = await this.db.from("quests").select("id,title,created_at")
        .eq("user_id", this.userId).eq("status", "completed").or("quest_size.in.(major,epic,main),is_boss.eq.true")
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(p.offset, p.offset + p.limit);
      candidates = page(checked(data ?? [], error).map(r => ({ id: r.id, sourceType: type, sourceId: r.id, label: r.title })), p);
    }
    if (!candidates.items.length) return { items: [], nextOffset: null };
    const grants = await this.db.from("reward_transactions").select("canonical_source_id")
      .eq("user_id", this.userId).eq("event_kind", "EARN").eq("policy_version", "reward-v1")
      .eq("canonical_source_type", type).in("canonical_source_id", candidates.items.map(r => r.sourceId));
    const granted = new Set(checked(grants.data ?? [], grants.error).map(r => r.canonical_source_id));
    return { ...candidates, items: candidates.items.map(r => ({ ...r, alreadyGranted: granted.has(r.sourceId) })) };
  }
  private async rpc(name: string, args: Record<string, unknown>): Promise<RewardResult> {
    const { data, error } = await this.db.rpc(name, args);
    checked(data, error);
    if (!data || typeof data.ok !== "boolean" || typeof data.replayed !== "boolean") {
      throw new RewardRepositoryError("Invalid reward authority response");
    }
    return data;
  }
  grant(input: RewardGrantInput) {
    return this.rpc("rpc_grant_reward_credit", {
      p_source_type: input.sourceType, p_source_id: input.sourceId,
      p_policy_version: input.policyVersion, p_request_idempotency_key: input.requestIdempotencyKey,
    });
  }
  wishAction(id: string, action: WishAction, key: string, celebrationNote?: string | null) {
    return this.rpc(WISH_RPC[action], {
      p_wish_id: id, p_request_idempotency_key: key,
      ...(action === "redeem" ? { p_celebration_note: celebrationNote ?? null } : {}),
    });
  }
  correct(id: string, note: string, key: string) {
    return this.rpc("rpc_correct_reward_transaction", { p_transaction_id: id, p_note: note, p_request_idempotency_key: key });
  }
  refund(id: string, note: string, key: string) {
    return this.rpc("rpc_refund_wish_redemption", { p_redemption_id: id, p_note: note, p_request_idempotency_key: key });
  }
}
