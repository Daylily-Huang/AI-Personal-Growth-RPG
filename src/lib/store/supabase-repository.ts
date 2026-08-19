import type { SupabaseClient } from "@supabase/supabase-js";
import { RULES_VERSION } from "@/lib/growth-engine/xp";
import type { Database } from "@/lib/supabase/database.types";
import type { Repository, SettlementResult } from "./repository";
import type { Activity, Assessment, MasteryVerification, NewActivityInput, NewAssessmentInput, PlayerState, SettlementToApply, SkillEdge, SkillState, XpTransaction } from "./types";
import { mapActivity, mapAssessment, mapMasteryVerification, mapPlayer, mapSkill, mapTransaction } from "./supabase-mapping";

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
type Client = SupabaseClient<Database>;

/** Stage2-A: RLS-scoped data mapping. Permanent settlement remains Stage2-B RPC. */
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
      .select("*, skills!fk_xp_transactions_skill(name)")
      .eq("user_id", this.userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => {
      const skill = row.skills;
      const skillName = Array.isArray(skill) ? skill[0]?.name : skill?.name;
      return mapTransaction(row, skillName);
    });
  }

  async getSkill(name: string): Promise<SkillState | null> {
    const skills = await this.listSkills();
    const key = normalize(name);
    return skills.find((skill) => normalize(skill.name) === key || skill.aliases.some((alias) => normalize(alias) === key)) ?? null;
  }

  async listSkills(): Promise<SkillState[]> {
    const { data, error } = await this.client.from("skills").select("*").eq("user_id", this.userId).order("name");
    if (error) throw error;
    return (data ?? []).map(mapSkill);
  }

  async listSkillEdges(): Promise<SkillEdge[]> {
    // The Demo model has edges, but no relational skill_edges table exists yet.
    // Keep this read empty until the graph schema is added deliberately.
    return [];
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

  async addActivity(input: NewActivityInput): Promise<Activity> {
    const rawInput = input.rawInput.trim();
    const { data, error } = await this.client.from("activities").insert({
      user_id: this.userId,
      raw_input: rawInput,
      title: rawInput.slice(0, 80) || "未命名 Activity",
      total_minutes: input.totalMinutes ?? null,
      effective_minutes: input.effectiveMinutes ?? null,
      rules_version: RULES_VERSION,
    }).select("*").single();
    if (error) throw error;
    return mapActivity(data);
  }

  async addAssessment(_input: NewAssessmentInput): Promise<Assessment> {
    throw new Error(
      "AI assessments are server-authored. Use AssessmentPersistenceService after authenticating and reading the Activity through this RLS-scoped repository.",
    );
  }

  async lookupSkillId(label: string): Promise<string | null> {
    return (await this.getSkill(label))?.id ?? null;
  }

  async applySettlement(_settlement: SettlementToApply): Promise<SettlementResult> {
    throw new Error("SupabaseRepository.applySettlement is reserved for the Stage2-B settle_activity RPC");
  }

  async reset(): Promise<void> {
    throw new Error("SupabaseRepository.reset is disabled; use explicit user-scoped test fixtures");
  }
}
