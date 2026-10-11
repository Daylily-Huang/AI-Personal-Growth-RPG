import type { AssessmentProposal } from "@/lib/ai/schemas";

/** SiteReadiness18 resource budgets, not Growth Engine coefficients. */
export const PROPOSAL_FACT_TEXT_BYTES = 8192;
export const PROPOSAL_FACT_MINUTES_MAX = 1440;
export const PROPOSAL_FACT_SKILLS_MAX = 5;
export const PROPOSAL_EDIT_BODY_BYTES = 16384;
export const PROPOSAL_EDIT_MODEL_BYTES = 65536;
export const PROPOSAL_EDIT_PROMPT_BYTES = 131072;
export const PROPOSAL_EDIT_RESPONSE_BYTES = 131072;
export const PROPOSAL_EDIT_PROVENANCE_BYTES = 256;
export const PROPOSAL_EDIT_MODEL_TIMEOUT_MS = 60000;
export const PROPOSAL_EDIT_REQUEST_SECONDS = 180;
export const PROPOSAL_FACT_HISTORY_PAGE_SIZE = 25;
export const PROPOSAL_FACT_HISTORY_RESPONSE_BYTES = 1572864;
export const PROPOSAL_FACT_SKILL_PAGE_SIZE = 50;
export const PROPOSAL_FACT_SKILL_NAME_CODEPOINTS = 200;
export const PROPOSAL_FACT_SKILL_RESPONSE_BYTES = 81920;
export const PROPOSAL_FACT_PROMPT_VERSION = "activity-evaluator-v0.4-facts";

export interface ProposalFacts {
  description: string;
  totalMinutes: number | null;
  effectiveMinutes: number | null;
  /** User-supplied clues, never permanent Skill identity/XP authority. */
  relatedSkillIds: string[];
}

export interface ProposalEditInput {
  requestId: string;
  facts: ProposalFacts;
}

export type ProposalEditStatus = "in_progress" | "completed" | "failed" | "expired" | "conflict";
export type ProposalEditQuery =
  | { view: "facts" }
  | { view: "skills"; after: string | null }
  | { view: "request"; requestId: string };

export interface ProposalFactHistoryQuery { after: string | null }

/** Owner-checked immutable revision joined to its one completed request. */
export interface ProposalFactRevision {
  id: string;
  requestId: string;
  activityId: string;
  baseAssessmentId: string;
  resultAssessmentId: string;
  previousRevisionId: string | null;
  rulesVersion: string;
  promptVersion: typeof PROPOSAL_FACT_PROMPT_VERSION;
  createdAt: string;
  facts: ProposalFacts;
}

export interface ProposalFactOriginal {
  description: string;
  descriptionTruncated: boolean;
  totalMinutes: number | null;
  effectiveMinutes: number | null;
}
export interface ProposalEditFactsView {
  assessmentId: string;
  activityId: string;
  rulesVersion: string;
  original: ProposalFactOriginal;
  currentRevision: ProposalFactRevision | null;
}
export interface ProposalFactSkill {
  id: string;
  name: string;
  nameTruncated: boolean;
  masteryLevel: number;
  masteryConfidence: number;
}
export interface ProposalFactSkillsView {
  assessmentId: string;
  activityId: string;
  items: ProposalFactSkill[];
  nextCursor: string | null;
}
export interface ProposalFactHistoryItem extends ProposalFactRevision {
  modelName: string;
  assessmentStatus: ProposalEditAssessment["status"];
}
export interface ProposalFactHistoryView {
  activityId: string;
  items: ProposalFactHistoryItem[];
  nextCursor: string | null;
}

export type ProposalEditFailure = "AI_UNAVAILABLE" | "EXPIRED" | "CONFLICT";

/** Public projection. Owners are checked at the raw repository boundary, then removed. */
export interface ProposalEditAssessment {
  id: string;
  activityId: string;
  status: "pending" | "confirmed" | "edited" | "rejected" | "superseded";
  proposal: AssessmentProposal;
  modelName: string;
  promptVersion: string;
  rulesVersion: string;
  confidence: number;
  createdAt: string;
  confirmedAt: string | null;
}

export interface ProposalEditCompletion {
  revisionId: string;
  previousRevisionId: string | null;
  createdAt: string;
  assessment: ProposalEditAssessment;
}

interface ProposalEditRequestBase {
  requestId: string;
  activityId: string;
  baseAssessmentId: string;
  facts: ProposalFacts;
  createdAt: string;
  expiresAt: string;
}

export type ProposalEditRequest = ProposalEditRequestBase & (
  | { status: "in_progress"; failure: null; completion: null }
  | { status: "completed"; failure: null; completion: ProposalEditCompletion }
  | { status: "failed"; failure: "AI_UNAVAILABLE"; completion: null }
  | { status: "expired"; failure: "EXPIRED"; completion: null }
  | { status: "conflict"; failure: "CONFLICT"; completion: null }
);

/** Internal only: never serialize dispatch to a browser. */
export interface ProposalEditBegin { dispatch: boolean; request: ProposalEditRequest }
export interface ProposalEditResult { replayed: boolean; request: ProposalEditRequest }

export interface ProposalEditModelResult {
  proposal: AssessmentProposal;
  modelName: string;
  promptVersion: typeof PROPOSAL_FACT_PROMPT_VERSION;
}

/** Only the authenticated repository implements these trusted operations. */
export interface ProposalEditRequestPort {
  begin(assessmentId: string, input: ProposalEditInput): Promise<ProposalEditBegin>;
  readRequest(assessmentId: string, requestId: string): Promise<ProposalEditRequest>;
  complete(assessmentId: string, input: ProposalEditInput, result: ProposalEditModelResult): Promise<ProposalEditRequest>;
  fail(assessmentId: string, input: ProposalEditInput): Promise<ProposalEditRequest>;
}

export type ProposalEditErrorCode =
  | "INVALID_PROPOSAL_EDIT_INPUT"
  | "INVALID_PROPOSAL_EDIT_RECEIPT"
  | "PROPOSAL_EDIT_AUTH_REQUIRED"
  | "PROPOSAL_EDIT_NOT_FOUND"
  | "PROPOSAL_EDIT_CONFLICT"
  | "PROPOSAL_EDIT_PAYLOAD_TOO_LARGE"
  | "PROPOSAL_EDIT_UNSUPPORTED_MEDIA_TYPE"
  | "PROPOSAL_EDIT_CROSS_ORIGIN"
  | "PROPOSAL_EDIT_UNAVAILABLE"
  | "PROPOSAL_EDIT_AI_UNAVAILABLE";

/** Fixed codes only: do not put private facts, DB messages or upstream errors here. */
export class ProposalEditError extends Error {
  constructor(readonly code: ProposalEditErrorCode) {
    super(code);
    this.name = "ProposalEditError";
  }
}
