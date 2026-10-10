import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { z } from "zod";
import { ASSESSMENT_CONTEXT_LIMITS as LIMIT, ASSESSMENT_CONTEXT_VERSION, AssessmentContextError,
  contextSkillRowSchema, parseContextData, selectRelatedContextSkills, clipContextText, fitAssessmentContextBudget,
  type AssessmentContextSnapshot, type AssessmentPrivateContext } from "@/lib/ai/assessment-context";
import { ActivityAlreadySettledError } from "./errors";

const uuid = z.uuid(), text = z.string().refine(value => value.trim().length > 0);
const activitySchema = z.object({ id: uuid, user_id: uuid, raw_input: z.string(), rules_version: text,
  quest_id: uuid.nullable(), activity_type: text.nullable(), status: z.enum(["pending_assessment", "assessed", "confirmed"]) }).strict();
const questSchema = z.object({ id: uuid, user_id: uuid, title: text, parent_quest_id: uuid.nullable(), is_main_quest: z.boolean(),
  status: z.enum(["locked", "available", "active", "paused", "completed", "failed", "archived"]) }).strict();
const stateSchema = z.object({ user_id: uuid, energy: z.number().min(0).max(100), focus: z.number().min(0).max(100),
  momentum: z.number().min(0).max(100), stress: z.number().min(0).max(100) }).strict();
const recentSchema = z.object({ id: uuid, user_id: uuid, skill_id: uuid, xp_type: z.literal("activity"),
  activity_type: text.nullable(), created_at: z.iso.datetime({ offset: true }) }).strict();
const ACTIVITY_COLUMNS = "id,user_id,raw_input,rules_version,quest_id,activity_type,status";
const QUEST_COLUMNS = "id,user_id,title,parent_quest_id,is_main_quest,status";
const SKILL_COLUMNS = "id,user_id,name,aliases,mastery_level,mastery_confidence,status";
const RECENT_COLUMNS = "id,user_id,skill_id,xp_type,activity_type,created_at";

async function data<T>(query: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  const result = await query;
  if (result.error) throw new AssessmentContextError();
  return result.data;
}
function owner<T extends { user_id: string }>(row: T, userId: string): T {
  if (row.user_id !== userId) throw new AssessmentContextError(); return row;
}

/** Same request's RLS client, bounded minimal SELECTs only; no admin, RPC, mutation or cache. */
export async function loadAssessmentContext(client: SupabaseClient<Database>, userId: string, activityId: string,
  clock: () => Date = () => new Date()): Promise<AssessmentContextSnapshot> {
  try {
    parseContextData(uuid, userId); parseContextData(uuid, activityId);
    const now = clock(), asOf = now.toISOString(), since = new Date(now.getTime() - LIMIT.recentDays * 86400000).toISOString();
    const activity = owner(parseContextData(activitySchema, await data(client.from("activities").select(ACTIVITY_COLUMNS)
      .eq("user_id", userId).eq("id", activityId).maybeSingle())), userId);
    if (activity.id !== activityId) throw new AssessmentContextError();
    if (activity.status === "confirmed") throw new ActivityAlreadySettledError(activityId);

    let mainQuest: AssessmentPrivateContext["mainQuest"] = null, questChainIncomplete = false;
    let questId = activity.quest_id;
    const visited = new Set<string>();
    while (questId && visited.size < LIMIT.questDepth) {
      if (visited.has(questId)) { questChainIncomplete = true; break; }
      visited.add(questId);
      const raw = await data(client.from("quests").select(QUEST_COLUMNS).eq("user_id", userId).eq("id", questId).maybeSingle());
      if (!raw) { questChainIncomplete = true; break; }
      const quest = owner(parseContextData(questSchema, raw), userId);
      if (quest.id !== questId) throw new AssessmentContextError();
      if (quest.is_main_quest && quest.status === "active") {
        const title = clipContextText(quest.title, LIMIT.titleBytes);
        mainQuest = { title, titleTruncated: title !== quest.title, source: "bound" }; break;
      }
      questId = quest.parent_quest_id;
    }
    if (!mainQuest && questId && visited.size === LIMIT.questDepth) questChainIncomplete = true;
    if (!mainQuest) {
      const rows = parseContextData(z.array(questSchema).max(1), await data(client.from("quests").select(QUEST_COLUMNS)
        .eq("user_id", userId).eq("status", "active").eq("is_main_quest", true)
        .order("created_at", { ascending: false }).order("id", { ascending: true }).limit(1)));
      if (rows[0]) {
        const quest = owner(rows[0], userId);
        if (!quest.is_main_quest || quest.status !== "active") throw new AssessmentContextError();
        const title = clipContextText(quest.title, LIMIT.titleBytes);
        mainQuest = { title, titleTruncated: title !== quest.title, source: "latest" };
      }
    }
    const candidates = parseContextData(z.array(contextSkillRowSchema).max(LIMIT.candidateQuery),
      await data(client.from("skills").select(SKILL_COLUMNS).eq("user_id", userId).eq("status", "active")
        .order("name", { ascending: true }).order("id", { ascending: true }).limit(LIMIT.candidateQuery)));
    for (const row of candidates) owner(row, userId);
    if (new Set(candidates.map(row => row.id)).size !== candidates.length) throw new AssessmentContextError();
    const selected = selectRelatedContextSkills(activity.raw_input, candidates);
    const state = owner(parseContextData(stateSchema, await data(client.from("player_states")
      .select("user_id,energy,focus,momentum,stress").eq("user_id", userId).maybeSingle())), userId);
    let recentSamples: AssessmentPrivateContext["recentSamples"] = [], recentSamplesTruncated = false;
    if (selected.skills.length) {
      const rows = parseContextData(z.array(recentSchema).max(LIMIT.recentQuery), await data(client.from("xp_transactions")
        .select(RECENT_COLUMNS).eq("user_id", userId).eq("xp_type", "activity").in("skill_id", selected.skills.map(skill => skill.id))
        .gte("created_at", since).lte("created_at", asOf).order("created_at", { ascending: false })
        .order("id", { ascending: true }).limit(LIMIT.recentQuery)));
      const byId = new Map(selected.skills.map(skill => [skill.id, skill.name]));
      if (new Set(rows.map(row => row.id)).size !== rows.length) throw new AssessmentContextError();
      for (const row of rows) {
        owner(row, userId);
        if (!byId.has(row.skill_id) || Date.parse(row.created_at) > now.getTime() || Date.parse(row.created_at) < Date.parse(since))
          throw new AssessmentContextError();
      }
      rows.sort((a,b) => Date.parse(b.created_at) - Date.parse(a.created_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      recentSamplesTruncated = rows.length > LIMIT.recent;
      recentSamples = rows.slice(0, LIMIT.recent).map(row => ({ skillName: byId.get(row.skill_id)!, activityType: row.activity_type, createdAt: row.created_at }));
    }
    return fitAssessmentContextBudget({ activityId, rawInput: activity.raw_input, context: {
      version: ASSESSMENT_CONTEXT_VERSION, asOf, rulesVersion: activity.rules_version, mainQuest,
      relatedSkills: selected.skills.map(skill => ({ name: skill.name, masteryLevel: skill.mastery_level, masteryConfidence: skill.mastery_confidence })),
      recentSamples, temporaryState: { energy: state.energy, focus: state.focus, momentum: state.momentum, stress: state.stress },
      coverage: { ...selected.coverage, recentSamplesTruncated, questChainIncomplete, budgetReduced: false },
    } });
  } catch (error) {
    if (error instanceof ActivityAlreadySettledError) throw error;
    throw new AssessmentContextError();
  }
}
