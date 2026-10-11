import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProposalEditModelContext } from "./context";
import {
  ProposalEditError, type ProposalEditInput, type ProposalEditModelResult, type ProposalEditRequestPort,
  type ProposalEditFactsView, type ProposalFactSkillsView, type ProposalFactHistoryView,
  PROPOSAL_EDIT_RESPONSE_BYTES, PROPOSAL_FACT_SKILL_PAGE_SIZE, PROPOSAL_FACT_SKILL_RESPONSE_BYTES,
  PROPOSAL_FACT_HISTORY_PAGE_SIZE, PROPOSAL_FACT_HISTORY_RESPONSE_BYTES,
} from "./types";
import {
  parseProposalEditBegin, parseProposalEditInput, parseProposalEditModelResult,
  parseProposalEditRequest, proposalFactUuid,
  PROPOSAL_FACT_REVISION_FIELDS, PROPOSAL_FACT_REQUEST_FIELDS,
  parseProposalFactRevisionIdentity, parseProposalFactRevision,
  PROPOSAL_FACT_ASSESSMENT_FIELDS, PROPOSAL_FACT_ACTIVITY_FIELDS, PROPOSAL_FACT_SKILL_FIELDS, PROPOSAL_FACT_MODEL_FIELDS,
  parseProposalFactAssessment, parseProposalFactActivity, parseProposalFactSkill, parseProposalFactHistoryModel,
  proposalFactOriginalProjection, boundedProposalFactView, proposalFactRows, parseProposalFactActiveRequest,
} from "./validation";

const safeErrors = new Map<string, ConstructorParameters<typeof ProposalEditError>[0]>([
  ["INVALID_PROPOSAL_EDIT_INPUT", "INVALID_PROPOSAL_EDIT_INPUT"],
  ["PROPOSAL_EDIT_AUTH_REQUIRED", "PROPOSAL_EDIT_AUTH_REQUIRED"],
  ["PROPOSAL_EDIT_NOT_FOUND", "PROPOSAL_EDIT_NOT_FOUND"],
  ["PROPOSAL_EDIT_CONFLICT", "PROPOSAL_EDIT_CONFLICT"],
]);

function rpcError(value: unknown): ProposalEditError {
  const descriptor = value !== null && typeof value === "object" ? Object.getOwnPropertyDescriptor(value, "message") : undefined;
  const message = descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
  return new ProposalEditError(typeof message === "string" ? safeErrors.get(message) ?? "PROPOSAL_EDIT_UNAVAILABLE" : "PROPOSAL_EDIT_UNAVAILABLE");
}

/** Authenticated RLS reads only. Missing relation/schema never means no revision. */
export async function loadProposalFactRevision(db: SupabaseClient, owner: string, assessment: string) {
  const userId = proposalFactUuid(owner), assessmentId = proposalFactUuid(assessment);
  let revision;
  try {
    const response = await db.from("proposal_fact_revisions").select(PROPOSAL_FACT_REVISION_FIELDS)
      .eq("user_id", userId).eq("result_assessment_id", assessmentId).limit(2).retry(false);
    if (response.error) throw rpcError(response.error);
    const revisions = proposalFactRows(response.data, 1);
    if (!revisions.length) return null;
    revision = parseProposalFactRevisionIdentity(revisions[0], userId, assessmentId);
    const request = await db.from("proposal_fact_edit_requests").select(PROPOSAL_FACT_REQUEST_FIELDS)
      .eq("user_id", userId).eq("request_id", revision.requestId).eq("activity_id", revision.activityId).limit(2).retry(false);
    if (request.error) throw rpcError(request.error);
    const requests = proposalFactRows(request.data, 1);
    return parseProposalFactRevision(revisions[0], requests[0], userId, assessmentId);
  } catch (error) {
    if (error instanceof ProposalEditError) throw error;
    throw new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE");
  }
}

async function read<T>(query: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  try { const result = await query; if (result.error) throw rpcError(result.error); return result.data; }
  catch (error) { if (error instanceof ProposalEditError) throw error; throw new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE"); }
}

function malformed(): never { throw new ProposalEditError("INVALID_PROPOSAL_EDIT_RECEIPT"); }
async function one(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<unknown | null> {
  const rows = proposalFactRows(await read(query), 1);
  if (!rows.length) return null;
  if (rows[0] === null) return malformed();
  return rows[0];
}
function rawKey(row: unknown, key: string): unknown {
  if (!row || typeof row !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(row, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

/** Cheap read-only legacy model preflight. The locked SQL guard is the authority. */
export async function hasProposalFactEdit(db: SupabaseClient, owner: string, activity: string): Promise<boolean> {
  const userId = proposalFactUuid(owner), activityId = proposalFactUuid(activity), now = new Date().toISOString();
  const revisions = proposalFactRows(await read(db.from("proposal_fact_revisions").select(PROPOSAL_FACT_REVISION_FIELDS)
    .eq("user_id", userId).eq("activity_id", activityId).limit(1).retry(false)), 1);
  if (revisions.length) { if (parseProposalFactRevisionIdentity(revisions[0], userId).activityId !== activityId) return malformed(); return true; }
  const requests = proposalFactRows(await read(db.from("proposal_fact_edit_requests").select("request_id,user_id,activity_id,status,expires_at")
    .eq("user_id", userId).eq("activity_id", activityId).eq("status", "in_progress").gt("expires_at", now).limit(1).retry(false)), 1);
  if (requests.length) parseProposalFactActiveRequest(requests[0], userId, activityId, now);
  return requests.length === 1;
}

export function isProposalFactEditConflict(error: unknown): boolean {
  return (error instanceof ProposalEditError && error.code === "PROPOSAL_EDIT_CONFLICT") || rawKey(error, "message") === "PROPOSAL_EDIT_CONFLICT";
}

/**
 * Request-scoped RLS client for begin/read. The lazy service client is supplied
 * only by request.ts after auth.getUser; it is never used for a read or prefetch.
 * Atomic state and lock ordering belong to 0055, not to this adapter.
 */
export class ProposalEditRepository implements ProposalEditRequestPort {
  private readonly userId: string;
  constructor(
    private readonly db: SupabaseClient,
    userId: string,
    private readonly authority: () => SupabaseClient,
  ) { this.userId = proposalFactUuid(userId); }

  private async activity(activityId: string) {
    const value = await one(this.db.from("activities").select(PROPOSAL_FACT_ACTIVITY_FIELDS)
      .eq("user_id", this.userId).eq("id", activityId).limit(2).retry(false));
    if (value === null) throw new ProposalEditError("PROPOSAL_EDIT_NOT_FOUND");
    return parseProposalFactActivity(value, this.userId, activityId);
  }

  async readModelContext(request: { baseAssessmentId: string; activityId: string; facts: ProposalEditInput["facts"] }) {
    return loadProposalEditModelContext(this.db, this.userId, request.baseAssessmentId, request.activityId, request.facts);
  }

  private async pending(assessmentId: string) {
    const value = await one(this.db.from("ai_assessments").select(PROPOSAL_FACT_ASSESSMENT_FIELDS)
      .eq("user_id", this.userId).eq("id", assessmentId).limit(2).retry(false));
    if (value === null) throw new ProposalEditError("PROPOSAL_EDIT_NOT_FOUND");
    const assessment = parseProposalFactAssessment(value, this.userId, assessmentId);
    if (assessment.status !== "pending") throw new ProposalEditError("PROPOSAL_EDIT_CONFLICT");
    const activity = await this.activity(assessment.activityId);
    if (activity.rulesVersion !== assessment.rulesVersion) return malformed();
    if (activity.status === "confirmed") throw new ProposalEditError("PROPOSAL_EDIT_CONFLICT");
    return { assessment, activity };
  }

  async readFacts(assessment: string): Promise<ProposalEditFactsView> {
    const assessmentId = proposalFactUuid(assessment), { activity } = await this.pending(assessmentId);
    const currentRevision = await loadProposalFactRevision(this.db, this.userId, assessmentId);
    if (currentRevision && (currentRevision.activityId !== activity.id || currentRevision.rulesVersion !== activity.rulesVersion)) return malformed();
    return boundedProposalFactView({ assessmentId, activityId: activity.id, rulesVersion: activity.rulesVersion,
      original: { ...proposalFactOriginalProjection(activity.rawInput), totalMinutes: activity.totalMinutes, effectiveMinutes: activity.effectiveMinutes }, currentRevision }, PROPOSAL_EDIT_RESPONSE_BYTES);
  }

  async readSkills(assessment: string, after: string | null): Promise<ProposalFactSkillsView> {
    const assessmentId = proposalFactUuid(assessment), cursor = after === null ? null : proposalFactUuid(after);
    const { activity } = await this.pending(assessmentId);
    if (cursor) {
      const item = await one(this.db.from("skills").select(PROPOSAL_FACT_SKILL_FIELDS).eq("user_id", this.userId)
        .eq("id", cursor).eq("status", "active").limit(2).retry(false));
      if (item === null) throw new ProposalEditError("PROPOSAL_EDIT_NOT_FOUND");
      if (parseProposalFactSkill(item, this.userId).id !== cursor) return malformed();
    }
    let query = this.db.from("skills").select(PROPOSAL_FACT_SKILL_FIELDS).eq("user_id", this.userId).eq("status", "active")
      .order("id", { ascending: true }).limit(PROPOSAL_FACT_SKILL_PAGE_SIZE + 1);
    if (cursor) query = query.gt("id", cursor);
    const rows = proposalFactRows(await read(query.retry(false)), PROPOSAL_FACT_SKILL_PAGE_SIZE + 1).map(row => parseProposalFactSkill(row, this.userId));
    if (rows.some((row, index) => row.id <= (index ? rows[index - 1].id : cursor ?? ""))) return malformed();
    const items = rows.slice(0, PROPOSAL_FACT_SKILL_PAGE_SIZE);
    return boundedProposalFactView({ assessmentId, activityId: activity.id, items,
      nextCursor: rows.length > PROPOSAL_FACT_SKILL_PAGE_SIZE ? items[items.length - 1].id : null }, PROPOSAL_FACT_SKILL_RESPONSE_BYTES);
  }

  async readHistory(activity: string, after: string | null): Promise<ProposalFactHistoryView> {
    const activityId = proposalFactUuid(activity), cursor = after === null ? null : proposalFactUuid(after);
    await this.activity(activityId);
    if (cursor) {
      const row = await one(this.db.from("proposal_fact_revisions").select(PROPOSAL_FACT_REVISION_FIELDS)
        .eq("user_id", this.userId).eq("activity_id", activityId).eq("id", cursor).limit(2).retry(false));
      if (row === null) throw new ProposalEditError("PROPOSAL_EDIT_NOT_FOUND");
      const identity = parseProposalFactRevisionIdentity(row, this.userId);
      if (identity.id !== cursor || identity.activityId !== activityId) return malformed();
    }
    let query = this.db.from("proposal_fact_revisions").select(PROPOSAL_FACT_REVISION_FIELDS)
      .eq("user_id", this.userId).eq("activity_id", activityId).order("id", { ascending: true }).limit(PROPOSAL_FACT_HISTORY_PAGE_SIZE + 1);
    if (cursor) query = query.gt("id", cursor);
    const raw = proposalFactRows(await read(query.retry(false)), PROPOSAL_FACT_HISTORY_PAGE_SIZE + 1);
    const identities = raw.map(row => parseProposalFactRevisionIdentity(row, this.userId));
    if (identities.some((row, index) => row.activityId !== activityId || row.id <= (index ? identities[index - 1].id : cursor ?? "")) ||
        new Set(identities.map(row => row.requestId)).size !== identities.length || new Set(identities.map(row => row.resultAssessmentId)).size !== identities.length) return malformed();
    if (!identities.length) return { activityId, items: [], nextCursor: null };
    const requests = proposalFactRows(await read(this.db.from("proposal_fact_edit_requests").select(PROPOSAL_FACT_REQUEST_FIELDS)
      .eq("user_id", this.userId).eq("activity_id", activityId).in("request_id", identities.map(row => row.requestId))
      .limit(PROPOSAL_FACT_HISTORY_PAGE_SIZE + 1).retry(false)), identities.length);
    const models = proposalFactRows(await read(this.db.from("ai_assessments").select(PROPOSAL_FACT_MODEL_FIELDS)
      .eq("user_id", this.userId).eq("activity_id", activityId).in("id", identities.map(row => row.resultAssessmentId))
      .limit(PROPOSAL_FACT_HISTORY_PAGE_SIZE + 1).retry(false)), identities.length);
    if (requests.length !== identities.length || models.length !== identities.length) return malformed();
    const all = raw.map((row, index) => {
      const identity = identities[index];
      const revision = parseProposalFactRevision(row, requests.find(value => rawKey(value, "request_id") === identity.requestId), this.userId);
      return parseProposalFactHistoryModel(models.find(value => rawKey(value, "id") === identity.resultAssessmentId), this.userId, revision);
    });
    const items = all.slice(0, PROPOSAL_FACT_HISTORY_PAGE_SIZE);
    return boundedProposalFactView({ activityId, items, nextCursor: all.length > PROPOSAL_FACT_HISTORY_PAGE_SIZE ? items[items.length - 1].id : null }, PROPOSAL_FACT_HISTORY_RESPONSE_BYTES);
  }

  async begin(assessment: string, value: ProposalEditInput) {
    const assessmentId = proposalFactUuid(assessment), input = parseProposalEditInput(value);
    let response;
    try {
      response = await this.db.rpc("rpc_begin_proposal_fact_edit", {
        p_assessment_id: assessmentId, p_request_id: input.requestId, p_facts: input.facts,
      }).retry(false);
    } catch { throw new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE"); }
    if (response.error) throw rpcError(response.error);
    return parseProposalEditBegin(response.data, this.userId, assessmentId, input);
  }

  async readRequest(assessment: string, request: string) {
    const assessmentId = proposalFactUuid(assessment), requestId = proposalFactUuid(request);
    let response;
    try {
      response = await this.db.rpc("rpc_read_proposal_fact_edit", {
        p_assessment_id: assessmentId, p_request_id: requestId,
      }).retry(false);
    } catch { throw new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE"); }
    if (response.error) throw rpcError(response.error);
    return parseProposalEditRequest(response.data, this.userId, assessmentId, requestId);
  }

  async complete(assessment: string, value: ProposalEditInput, result: ProposalEditModelResult) {
    const assessmentId = proposalFactUuid(assessment), input = parseProposalEditInput(value);
    const model = parseProposalEditModelResult(result);
    let response;
    try {
      response = await this.authority().rpc("rpc_complete_proposal_fact_edit", {
        p_user_id: this.userId, p_assessment_id: assessmentId, p_request_id: input.requestId,
        p_proposal: model.proposal, p_model_name: model.modelName, p_prompt_version: model.promptVersion,
      }).retry(false);
    } catch { throw new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE"); }
    if (response.error) throw rpcError(response.error);
    return parseProposalEditRequest(response.data, this.userId, assessmentId, input.requestId, input);
  }

  async fail(assessment: string, value: ProposalEditInput) {
    const assessmentId = proposalFactUuid(assessment), input = parseProposalEditInput(value);
    let response;
    try {
      response = await this.authority().rpc("rpc_fail_proposal_fact_edit", {
        p_user_id: this.userId, p_assessment_id: assessmentId, p_request_id: input.requestId,
        p_failure: "AI_UNAVAILABLE",
      }).retry(false);
    } catch { throw new ProposalEditError("PROPOSAL_EDIT_UNAVAILABLE"); }
    if (response.error) throw rpcError(response.error);
    return parseProposalEditRequest(response.data, this.userId, assessmentId, input.requestId, input);
  }
}
