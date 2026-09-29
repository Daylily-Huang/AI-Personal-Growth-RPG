import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AuthRequiredError } from "@/lib/store/request-repository";
import type { StrategySourceClass } from "./types";

export interface StrategySourceOption {
  id: string;
  sourceClass: StrategySourceClass;
  label: string;
  observedAt: string;
}

export interface StrategyProposalPreview {
  id: string;
  proposalType: "STRATEGY_HYPOTHESIS" | "STRATEGY_COUNTEREVIDENCE_ALERT";
  status: string;
  payload: Record<string, unknown>;
  sourceRefs: unknown[];
  createdAt: string;
  expiresAt: string;
}

const SOURCE_TABLE: Record<StrategySourceClass, { table: string; columns: string; order: string }> = {
  SEASON_REVIEW: { table: "season_reviews", columns: "id,review_type,period_end,created_at", order: "created_at" },
  ACTIVITY: { table: "activities", columns: "id,title,created_at", order: "created_at" },
  QUEST_OUTCOME: { table: "quests", columns: "id,title,completed_at,created_at", order: "created_at" },
  ARTIFACT: { table: "artifacts", columns: "id,title,created_at", order: "created_at" },
  CORE_EVIDENCE_REFERENCE: { table: "evidence_records", columns: "id,description,created_at", order: "created_at" },
  JOURNAL_CONTEXT: { table: "journal_entries", columns: "id,title,created_at", order: "created_at" },
  MANUAL_OBSERVATION: { table: "journal_entries", columns: "id,title,created_at", order: "created_at" },
};

export async function getStrategyReadContext(): Promise<{ db: SupabaseClient; userId: string }> {
  const db = await getSupabaseServerClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return { db, userId: data.user.id };
}

export async function listStrategyProposals(db: SupabaseClient, userId: string): Promise<StrategyProposalPreview[]> {
  const { data, error } = await db.from("outer_loop_proposals")
    .select("id,proposal_type,status,payload,source_refs,created_at,expires_at")
    .eq("user_id", userId)
    .in("proposal_type", ["STRATEGY_HYPOTHESIS", "STRATEGY_COUNTEREVIDENCE_ALERT"])
    .eq("status", "PROPOSED")
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id, proposalType: row.proposal_type, status: row.status,
    payload: row.payload, sourceRefs: row.source_refs,
    createdAt: row.created_at, expiresAt: row.expires_at,
  }));
}

export async function listStrategySources(
  db: SupabaseClient, userId: string, sourceClass: StrategySourceClass, id?: string,
): Promise<StrategySourceOption[]> {
  const config = SOURCE_TABLE[sourceClass];
  let query = db.from(config.table).select(config.columns).eq("user_id", userId);
  if (id) query = query.eq("id", id);
  const { data, error } = await query.order(config.order, { ascending: false }).limit(id ? 1 : 50);
  if (error) throw error;
  return (data ?? []).map((raw) => {
    const row = raw as unknown as Record<string, unknown>;
    const label = typeof row.title === "string" ? row.title
      : typeof row.description === "string" && row.description.trim() ? row.description
      : sourceClass === "SEASON_REVIEW" ? `${String(row.review_type)} · ${String(row.period_end)}`
      : "核心证据记录";
    return {
      id: String(row.id), sourceClass, label,
      // Preserve PostgREST's full timestamp precision. Never round-trip through JS Date.
      observedAt: String(sourceClass === "QUEST_OUTCOME" ? row.completed_at ?? row.created_at : row.created_at),
    };
  });
}
