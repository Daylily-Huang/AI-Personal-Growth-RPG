import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { assembleSkillDetail } from "@/lib/skills/derived-state";
import { AssessmentPersistenceService } from "./assessment-persistence.service";
import type { Repository, SettlementResult } from "./repository";
import type {
  Activity,
  Assessment,
  Domain,
  EvidenceRecord,
  MasteryEvent,
  MasteryVerification,
  NewActivityInput,
  NewAssessmentInput,
  NewQuestInput,
  NewSkillEdgeInput,
  PlayerState,
  Quest,
  QuestStatus,
  SettlementToApply,
  SkillDetailResponse,
  SkillEdge,
  SkillState,
  UpdateQuestInput,
  UpdateSkillMetadataInput,
  XpTransaction,
} from "./types";
import {
  mapActivity,
  mapAssessment,
  mapDomain,
  mapEvidenceRecord,
  mapMasteryEvent,
  mapMasteryVerification,
  mapPlayer,
  mapQuest,
  mapSkill,
  mapSkillEdge,
  mapTransaction,
} from "./supabase-mapping";

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
type Client = SupabaseClient<Database>;

/** Stage 5A: RLS-scoped data mapping & graph/evidence repository */
export class SupabaseRepository implements Repository {
  constructor(private readonly client: Client, private readonly userId: string) {
    if (!userId) throw new Error("SupabaseRepository requires an authenticated user id");
  }

  async getActivity(id: string): Promise<Activity | null> {
    const { data, error } = await this.client.from("activities").select("*").eq("id", id).eq("user_id", this.userId).maybeSingle();
    if (error) throw error;
    return data ? mapActivity(data) : null;
  }

  async listActivities(): Promise<Activity[]> {
    const { data, error } = await this.client.from("activities").select("*").eq("user_id", this.userId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapActivity);
  }

  async getAssessment(id: string): Promise<Assessment | null> {
    const { data, error } = await this.client.from("ai_assessments").select("*").eq("id", id).eq("user_id", this.userId).maybeSingle();
    if (error) throw error;
    return data ? mapAssessment(data) : null;
  }

  async listPendingAssessments(): Promise<Assessment[]> {
    const { data, error } = await this.client.from("ai_assessments").select("*").eq("user_id", this.userId).eq("status", "pending").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapAssessment);
  }

  async listTransactions(): Promise<XpTransaction[]> {
    const { data, error } = await this.client
      .from("xp_transactions")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => {
      return mapTransaction(row, row.skill_name_snapshot);
    });
  }

  async countRecentSimilarTransactions(params: {
    skillId: string;
    activityType: string;
    windowDays: number;
  }): Promise<number> {
    // P1-A Fix: brand new skill without a persistent UUID has 0 prior transactions.
    // Querying PostgREST with an empty string causes a UUID syntax error.
    if (!params.skillId || !params.skillId.trim()) {
      return 0;
    }

    const since = new Date(Date.now() - params.windowDays * 86400000).toISOString();
    const { count, error } = await this.client
      .from("xp_transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", this.userId)
      .eq("skill_id", params.skillId)
      .eq("activity_type", params.activityType)
      .gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
  }

  async getSkill(name: string): Promise<SkillState | null> {
    const skills = await this.listSkills();
    const key = normalize(name);
    return skills.find((skill) => normalize(skill.name) === key || skill.aliases.some((alias) => normalize(alias) === key)) ?? null;
  }

  async getSkillById(id: string): Promise<SkillState | null> {
    const { data, error } = await this.client
      .from("skills")
      .select("*")
      .eq("id", id)
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSkill(data) : null;
  }

  async listDomains(): Promise<Domain[]> {
    const { data, error } = await this.client
      .from("domains")
      .select("*")
      .eq("user_id", this.userId)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapDomain);
  }

  async listMasteryEvents(skillId?: string): Promise<MasteryEvent[]> {
    let query = this.client
      .from("mastery_events")
      .select("*")
      .eq("user_id", this.userId);
    if (skillId) {
      query = query.eq("skill_id", skillId);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapMasteryEvent);
  }

  async getSkillDetails(id: string): Promise<SkillDetailResponse | null> {
    const skill = await this.getSkillById(id);
    if (!skill) return null;

    const [domains, allSkills, allEdges, evidenceRecords, masteryEvents, transactions, activities] = await Promise.all([
      this.listDomains(),
      this.listSkills(),
      this.listSkillEdges(),
      this.listEvidenceRecords(id),
      this.listMasteryEvents(id),
      this.listTransactions(),
      this.listActivities(),
    ]);

    const domainName = skill.domainId
      ? domains.find((d) => d.id === skill.domainId)?.name ?? null
      : null;

    const activityTitlesMap = new Map<string, string>();
    for (const act of activities) {
      activityTitlesMap.set(act.id, act.title);
    }

    return assembleSkillDetail({
      skill,
      domainName,
      allSkills,
      allEdges,
      evidenceRecords,
      masteryEvents,
      transactions,
      activityTitlesMap,
    });
  }

  async listSkills(): Promise<SkillState[]> {
    const { data, error } = await this.client.from("skills").select("*").eq("user_id", this.userId).order("name");
    if (error) throw error;
    return (data ?? []).map(mapSkill);
  }

  async listSkillEdges(): Promise<SkillEdge[]> {
    const { data, error } = await this.client
      .from("skill_edges")
      .select("*")
      .eq("user_id", this.userId)
      .order("created_at");
    if (error) throw error;
    return (data ?? []).map(mapSkillEdge);
  }

  async listEvidenceRecords(skillId?: string): Promise<EvidenceRecord[]> {
    let query = this.client
      .from("evidence_records")
      .select("*")
      .eq("user_id", this.userId);
    if (skillId) {
      query = query.eq("skill_id", skillId);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapEvidenceRecord);
  }

  async addEdge(input: NewSkillEdgeInput): Promise<SkillEdge> {
    const { data, error } = await this.client
      .from("skill_edges")
      .insert({
        user_id: this.userId,
        source_skill_id: input.sourceSkillId,
        target_skill_id: input.targetSkillId,
        relation_type: input.relationType,
      })
      .select()
      .single();
    if (error) throw error;
    return mapSkillEdge(data);
  }

  async deleteEdge(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("skill_edges")
      .delete()
      .eq("id", id)
      .eq("user_id", this.userId)
      .select("id");
    if (error) throw error;
    return Boolean(data && data.length > 0);
  }

  async updateSkillMetadata(id: string, updates: UpdateSkillMetadataInput): Promise<SkillState> {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.aliases !== undefined) payload.aliases = updates.aliases;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.domainId !== undefined) payload.domain_id = updates.domainId;
    if (updates.status !== undefined) payload.status = updates.status;

    const { data, error } = await this.client.rpc("update_skill_metadata", {
      p_skill_id: id,
      p_updates: payload as unknown as Json,
    });
    if (error) throw error;
    if (!data) throw new Error("update_skill_metadata returned no skill");
    return mapSkill(data as unknown as Database["public"]["Tables"]["skills"]["Row"]);
  }

  async getPlayer(): Promise<PlayerState> {
    const { data, error } = await this.client.from("player_states").select("*").eq("user_id", this.userId).maybeSingle();
    if (error) throw error;
    return mapPlayer(data);
  }

  async listMasteryVerifications(): Promise<MasteryVerification[]> {
    const { data, error } = await this.client.from("mastery_verifications").select("*").eq("user_id", this.userId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapMasteryVerification);
  }

  // ---- quests ----

  async getQuest(id: string): Promise<Quest | null> {
    const { data, error } = await this.client
      .from("quests")
      .select("*")
      .eq("id", id)
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapQuest(data) : null;
  }

  async listQuests(filter?: { status?: QuestStatus; isMain?: boolean; parentQuestId?: string | null }): Promise<Quest[]> {
    let query = this.client.from("quests").select("*").eq("user_id", this.userId);
    if (filter?.status) {
      query = query.eq("status", filter.status);
    }
    if (typeof filter?.isMain === "boolean") {
      query = query.eq("is_main_quest", filter.isMain);
    }
    if (filter?.parentQuestId !== undefined) {
      if (filter.parentQuestId === null) {
        query = query.is("parent_quest_id", null);
      } else {
        query = query.eq("parent_quest_id", filter.parentQuestId);
      }
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapQuest);
  }

  async addQuest(input: NewQuestInput): Promise<Quest> {
    const { data, error } = await this.client
      .from("quests")
      .insert({
        user_id: this.userId,
        parent_quest_id: input.parentQuestId ?? null,
        title: input.title.trim(),
        description: input.description?.trim() ?? null,
        quest_type: input.questType,
        quest_size: input.questSize ?? "standard",
        status: input.status ?? "available",
        difficulty: input.difficulty ?? 0.5,
        goal_alignment: input.goalAlignment ?? 0.5,
        progress: input.progress ?? 0,
        deadline: input.deadline ?? null,
        is_main_quest: Boolean(input.isMainQuest),
        is_boss: Boolean(input.isBoss),
        completed_at: input.status === "completed" ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (error) throw error;
    return mapQuest(data);
  }

  async updateQuest(id: string, updates: UpdateQuestInput): Promise<Quest> {
    const payload: Partial<Database["public"]["Tables"]["quests"]["Update"]> = {};
    if (updates.parentQuestId !== undefined) payload.parent_quest_id = updates.parentQuestId;
    if (updates.title !== undefined) payload.title = updates.title.trim();
    if (updates.description !== undefined) payload.description = updates.description?.trim() ?? null;
    if (updates.questType !== undefined) payload.quest_type = updates.questType;
    if (updates.questSize !== undefined) payload.quest_size = updates.questSize;
    if (updates.status !== undefined) {
      payload.status = updates.status;
      if (updates.status === "completed") {
        payload.completed_at = new Date().toISOString();
      } else {
        payload.completed_at = null;
      }
    }
    if (updates.difficulty !== undefined) payload.difficulty = updates.difficulty;
    if (updates.goalAlignment !== undefined) payload.goal_alignment = updates.goalAlignment;
    if (updates.progress !== undefined) payload.progress = updates.progress;
    if (updates.deadline !== undefined) payload.deadline = updates.deadline;
    if (updates.isMainQuest !== undefined) payload.is_main_quest = updates.isMainQuest;
    if (updates.isBoss !== undefined) payload.is_boss = updates.isBoss;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await this.client
      .from("quests")
      .update(payload)
      .eq("id", id)
      .eq("user_id", this.userId)
      .select()
      .single();
    if (error) throw error;
    return mapQuest(data);
  }

  async deleteQuest(id: string): Promise<void> {
    const { error } = await this.client
      .from("quests")
      .delete()
      .eq("id", id)
      .eq("user_id", this.userId);
    if (error) throw error;
  }

  async addActivity(input: NewActivityInput): Promise<Activity> {
    const rawInput = input.rawInput.trim();
    const title = rawInput.slice(0, 80) || "未命名 Activity";
    const { data, error } = await this.client.rpc("create_activity", {
      p_title: title,
      p_raw_input: rawInput,
      p_quest_id: input.questId ?? undefined,
      p_total_minutes: input.totalMinutes ?? undefined,
      p_effective_minutes: input.effectiveMinutes ?? undefined,
    });
    if (error) throw error;
    if (!data) throw new Error("create_activity returned no activity");
    return mapActivity(data);
  }

  async addAssessment(input: NewAssessmentInput): Promise<Assessment> {
    return new AssessmentPersistenceService().recordForAuthenticatedActivity(this.userId, input);
  }

  async lookupSkillId(label: string): Promise<string | null> {
    return (await this.getSkill(label))?.id ?? null;
  }

  async applySettlement(settlement: SettlementToApply): Promise<SettlementResult> {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("settle_activity", {
      p_user_id: this.userId,
      p_settlement: settlement as unknown as Json,
    });
    if (error) throw error;
    return mapSettlementRpcResult(data);
  }

  async reset(): Promise<void> {
    throw new Error("SupabaseRepository.reset is disabled; use explicit user-scoped test fixtures");
  }
}

interface SettlementRpcTx {
  id: string;
  userId: string;
  activityId: string;
  assessmentId: string;
  skillId: string;
  skillName: string;
  activityType: string | null;
  xpType: "activity" | "adjustment" | "correction";
  repetitionCount: number;
  repetitionPenalty: number;
  amount: number;
  baseAmount: number;
  modifierJson: Record<string, unknown>;
  reason: string | null;
  rulesVersion: string;
  createdAt: string;
}

interface SettlementRpcVerification {
  id: string;
  skillId: string;
  skillName: string;
  fromLevel: number;
  toLevel: number;
  evidenceLevel: number;
  status: "pending" | "verified" | "rejected";
  proposalAssessmentId: string;
  createdAt: string;
  resolvedAt: string | null;
}

type SettlementRpcResult =
  | { ok: true; skillId: string; transaction: SettlementRpcTx; masteryVerification: SettlementRpcVerification | null }
  | { ok: false; reason: string; actualRepetitionCount?: number };

/** Map the settle_activity RPC's jsonb result to the Repository contract. */
function mapSettlementRpcResult(data: unknown): SettlementResult {
  if (!data || typeof data !== "object") {
    throw new Error("settle_activity returned no result");
  }
  const result = data as SettlementRpcResult;

  if (result.ok !== true) {
    return {
      ok: false,
      reason: result.reason,
      actualRepetitionCount: result.actualRepetitionCount,
    };
  }

  const tx = result.transaction;
  return {
    ok: true,
    skillId: result.skillId,
    transaction: {
      id: tx.id,
      activityId: tx.activityId,
      assessmentId: tx.assessmentId,
      xpType: tx.xpType,
      skillId: tx.skillId,
      skillName: tx.skillName,
      activityType: tx.activityType ?? null,
      repetitionCount: tx.repetitionCount,
      repetitionPenalty: tx.repetitionPenalty,
      amount: tx.amount,
      baseAmount: tx.baseAmount,
      modifierJson: tx.modifierJson ?? {},
      reason: tx.reason ?? "",
      rulesVersion: tx.rulesVersion,
      createdAt: tx.createdAt,
    },
    masteryVerification: result.masteryVerification ?? null,
  };
}
