import type { SupabaseClient } from "@supabase/supabase-js";
import type { RewardTransaction } from "@/lib/reward/types";
import { MilestoneRepositoryError } from "./errors";
import type {
  ConfirmMilestone, CoreSource, Milestone, MilestoneFilter, MilestoneProposal, MilestoneResult,
  MilestoneSource, MilestoneView, Page, Pagination, ProposalDecision, ProposalStatus, SourceReward,
} from "./types";

function checked<T>(data: T, error: { message: string; code?: string } | null): T {
  if (error) throw new MilestoneRepositoryError(error.message, error.code);
  return data;
}
function page<T>(rows: T[], p: Pagination): Page<T> {
  return { items: rows.slice(0, p.limit), nextOffset: rows.length > p.limit ? p.offset + p.limit : null };
}
function sourceKey(type: string, id: string) { return `${type}:${id}`; }

/** Request-authenticated, tenant-scoped reads; only the three accepted RPCs write. */
export class MilestoneRepository {
  constructor(private readonly db: SupabaseClient, private readonly userId: string) {}

  private async rewards(sources: Array<{ source_type: string; source_id: string }>) {
    const result = new Map<string, SourceReward>();
    const earns: RewardTransaction[] = [];
    for (const type of ["QUEST", "SEASON", "MASTERY"]) {
      const ids = [...new Set(sources.filter(row => row.source_type === type).map(row => row.source_id))];
      if (!ids.length) continue;
      const response = await this.db.from("reward_transactions").select("*").eq("user_id", this.userId)
        .eq("event_kind", "EARN").eq("policy_version", "reward-v1").eq("canonical_source_type", type).in("canonical_source_id", ids);
      earns.push(...checked<RewardTransaction[]>(response.data ?? [], response.error));
    }
    if (!earns.length) return result;
    const response = await this.db.from("reward_transactions").select("*").eq("user_id", this.userId)
      .eq("event_kind", "CORRECTION").in("correction_for_id", earns.map(row => row.id));
    const corrections = checked<RewardTransaction[]>(response.data ?? [], response.error);
    for (const transaction of earns) result.set(sourceKey(transaction.canonical_source_type, transaction.canonical_source_id), {
      transaction, correction: corrections.find(row => row.correction_for_id === transaction.id) ?? null,
    });
    return result;
  }
  private async enrich(rows: Milestone[]): Promise<MilestoneView[]> {
    const rewards = await this.rewards(rows);
    return rows.map(row => {
      const known = rewards.get(sourceKey(row.source_type, row.source_id)) ?? null;
      const issued = row.granted_reward_credit;
      if (issued && known?.transaction.id !== row.reward_transaction_id) throw new MilestoneRepositoryError("Invalid milestone reward projection");
      const selfAttested = row.recognition_class === "USER_CONFIRMED_REAL_WORLD";
      return { ...row, selfAttested, reward: {
        status: selfAttested ? "NOT_AVAILABLE" : issued ? (known?.correction ? "CORRECTED" : "ISSUED") : "NOT_ISSUED",
        transaction: issued ? known!.transaction : null, correction: issued ? known!.correction : null,
        existingSourceReward: issued ? null : known,
      } };
    });
  }
  async list(p: Pagination, filter: MilestoneFilter): Promise<Page<MilestoneView>> {
    let query = this.db.from("milestones").select("*").eq("user_id", this.userId);
    if (filter.status) query = query.eq("status", filter.status);
    if (filter.recognitionClass) query = query.eq("recognition_class", filter.recognitionClass);
    const response = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(p.offset, p.offset + p.limit);
    const current = page<Milestone>(checked(response.data ?? [], response.error), p);
    return { ...current, items: await this.enrich(current.items) };
  }
  async detail(id: string): Promise<MilestoneView> {
    const response = await this.db.from("milestones").select("*").eq("user_id", this.userId).eq("id", id).maybeSingle();
    const row = checked<Milestone | null>(response.data, response.error);
    if (!row) throw new MilestoneRepositoryError("MILESTONE_NOT_FOUND", "P0002");
    return (await this.enrich([row]))[0];
  }
  async sources(type: CoreSource, p: Pagination, threshold?: 6 | 8 | 10): Promise<Page<MilestoneSource>> {
    let candidates: Page<{ id: string; sourceId: string; label: string }>;
    if (type === "QUEST") {
      const response = await this.db.from("quests").select("id,title,created_at").eq("user_id", this.userId)
        .eq("status", "completed").or("quest_size.in.(epic,main),is_boss.eq.true")
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(p.offset, p.offset + p.limit);
      candidates = page(checked(response.data ?? [], response.error).map(row => ({ id: row.id, sourceId: row.id, label: row.title })), p);
    } else if (type === "SEASON") {
      // Page parents, not review rows: amendments cannot duplicate a source or hide another season.
      const response = await this.db.from("seasons").select("id,name,created_at,season_reviews!inner(id)")
        .eq("user_id", this.userId).eq("status", "COMPLETED").eq("season_reviews.user_id", this.userId)
        .eq("season_reviews.review_type", "FINAL").limit(1, { referencedTable: "season_reviews" })
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(p.offset, p.offset + p.limit);
      candidates = page(checked(response.data ?? [], response.error).map(row => ({ id: row.id, sourceId: row.id, label: row.name })), p);
    } else {
      if (![6, 8, 10].includes(threshold ?? 0)) throw new MilestoneRepositoryError("Invalid discovery threshold");
      // The parent skill is unique, even if there are many verified records for the same threshold.
      const response = await this.db.from("skills").select("id,name,created_at,mastery_verifications!inner(id)")
        .eq("user_id", this.userId).eq("mastery_verifications.user_id", this.userId)
        .eq("mastery_verifications.status", "verified").eq("mastery_verifications.to_level", threshold!)
        .limit(1, { referencedTable: "mastery_verifications" })
        .order("created_at", { ascending: false }).order("id", { ascending: false }).range(p.offset, p.offset + p.limit);
      candidates = page(checked(response.data ?? [], response.error).map(row => ({ id: `${row.id}:M${threshold}`, sourceId: `${row.id}:M${threshold}`, label: `${row.name} · M${threshold}` })), p);
    }
    if (!candidates.items.length) return { items: [], nextOffset: null };
    const ids = candidates.items.map(row => row.sourceId);
    const response = await this.db.from("milestones").select("id,status,source_id").eq("user_id", this.userId)
      .eq("source_type", type).in("source_id", ids);
    const recognized = checked(response.data ?? [], response.error);
    const rewards = await this.rewards(ids.map(id => ({ source_type: type, source_id: id })));
    return { ...candidates, items: candidates.items.map(row => {
      const recognition = recognized.find(m => m.source_id === row.sourceId);
      return { ...row, sourceType: type, recognition: recognition ? { id: recognition.id, status: recognition.status } : null,
        existingSourceReward: rewards.get(sourceKey(type, row.sourceId)) ?? null };
    }) };
  }
  async proposals(p: Pagination, status?: ProposalStatus): Promise<Page<MilestoneProposal>> {
    let query = this.db.from("outer_loop_proposals").select("id,proposal_type,schema_version,status,payload,source_refs,expires_at,created_at,reviewed_at,decision,rejection_reason,resulting_entity_type,resulting_entity_id")
      .eq("user_id", this.userId).eq("proposal_type", "MILESTONE_CANDIDATE");
    if (status) query = query.eq("status", status);
    const response = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(p.offset, p.offset + p.limit);
    const current = page(checked(response.data ?? [], response.error), p);
    const now = Date.now();
    return { ...current, items: current.items.map(row => {
      const availableDecisions: ProposalDecision[] = row.status !== "PROPOSED" || Date.parse(row.expires_at) <= now ? []
        : row.schema_version === 2 ? ["ACCEPTED", "EDITED", "REJECTED"] : ["REJECTED"];
      return { ...row, supportedSchema: row.schema_version === 2, availableDecisions } as MilestoneProposal;
    }) };
  }
  private async rpc(name: string, args: Record<string, unknown>): Promise<MilestoneResult> {
    const response = await this.db.rpc(name, args);
    const data = checked(response.data, response.error);
    if (!data || data.ok !== true || typeof data.replayed !== "boolean" || !data.milestone?.id) throw new MilestoneRepositoryError("Invalid milestone authority response");
    return data;
  }
  // No ownership/lifecycle prefetch: immutable RPC replay precedes current state.
  confirm(input: ConfirmMilestone) {
    return this.rpc("rpc_confirm_milestone", {
      p_milestone_key: input.milestoneKey, p_title: input.title, p_description: input.description,
      p_recognition_class: input.recognitionClass, p_source_type: input.sourceType, p_source_id: input.sourceId,
      p_external_evidence_url: input.externalEvidenceUrl, p_external_credential_id: input.externalCredentialId,
      p_confirmation_request_idempotency_key: input.confirmationRequestIdempotencyKey,
    });
  }
  settle(id: string, policy: string, key: string) {
    return this.rpc("rpc_settle_milestone_reward", { p_milestone_id: id, p_policy_version: policy, p_request_idempotency_key: key });
  }
  revoke(id: string, reason: string, key: string) {
    return this.rpc("rpc_revoke_milestone", { p_milestone_id: id, p_revocation_reason: reason, p_revocation_request_idempotency_key: key });
  }
}
