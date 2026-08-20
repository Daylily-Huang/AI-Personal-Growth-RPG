import type { Assessment } from "./types";
import type { NewAssessmentInput } from "./types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapAssessment } from "./supabase-mapping";

/**
 * Server-only persistence for AI-authored proposals. Call only after the route
 * has authenticated the requester and read the Activity through its RLS client.
 * The RPC owns the insert + Activity state transition as one transaction.
 */
export class AssessmentPersistenceService {
  async recordForAuthenticatedActivity(userId: string, input: NewAssessmentInput): Promise<Assessment> {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("record_ai_assessment", {
      p_user_id: userId,
      p_activity_id: input.activityId,
      p_assessment_json: input.proposal,
      p_model_name: input.modelName,
      p_prompt_version: input.promptVersion,
      p_confidence: input.proposal.confidence ?? 0.85,
    });
    if (error) throw error;
    if (!data) throw new Error("record_ai_assessment returned no assessment");
    return mapAssessment(data);
  }
}
