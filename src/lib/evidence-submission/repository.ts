import type { SupabaseClient } from "@supabase/supabase-js";
import { EvidenceSubmissionError, type EvidenceQuery, type EvidenceSubmissionInput } from "./types";
import { evidenceUuid, parseEvidenceInput, parseEvidenceList, parseEvidenceResult } from "./validation";

/** Every operation uses the authenticated request client and one sanctioned RPC. */
export class EvidenceSubmissionRepository {
  private readonly userId: string;
  constructor(private readonly db: SupabaseClient, userId: string) {
    this.userId = evidenceUuid(userId);
  }
  async submit(activity: string, value: EvidenceSubmissionInput) {
    const activityId = evidenceUuid(activity);
    const input = parseEvidenceInput(value);
    const { data, error } = await this.db.rpc("rpc_submit_activity_evidence", {
      p_activity_id: activityId,
      p_request_id: input.requestId,
      p_input: { skillId: input.skillId, description: input.description },
    });
    if (error) throw new EvidenceSubmissionError(error.message, error.code);
    return parseEvidenceResult(data, activityId, input, this.userId);
  }
  async list(activity: string, query: EvidenceQuery) {
    const activityId = evidenceUuid(activity);
    if ((query.view !== "submissions" && query.view !== "skills") ||
        (query.after !== null && evidenceUuid(query.after) !== query.after)) {
      throw new EvidenceSubmissionError("INVALID_EVIDENCE_INPUT");
    }
    const { data, error } = await this.db.rpc("rpc_list_activity_evidence_submissions", {
      p_activity_id: activityId, p_view: query.view, p_after: query.after,
    });
    if (error) throw new EvidenceSubmissionError(error.message, error.code);
    return parseEvidenceList(data, activityId, query, this.userId);
  }
}
