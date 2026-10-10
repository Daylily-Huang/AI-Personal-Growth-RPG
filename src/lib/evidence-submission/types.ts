export const EVIDENCE_BODY_BYTES = 16_384;
export const EVIDENCE_TEXT_BYTES = 8_192;
export const SUBMISSION_PAGE_SIZE = 25;
export const SKILL_PAGE_SIZE = 50;
export const SUBMISSION_RESPONSE_BYTES = 1_310_720;
export const SKILL_RESPONSE_BYTES = 81_920;
export const SKILL_NAME_CODEPOINTS = 200;

export type EvidenceView = "submissions" | "skills";
export type EvidenceSubmissionInput = { requestId: string; skillId: string | null; description: string };
export type SubmittedEvidence = {
  id: string;
  activityId: string;
  skillId: string | null;
  evidenceLevel: 0;
  evidenceType: "user_submission";
  description: string;
  verified: false;
  createdAt: string;
};
export type EvidenceSubmission = {
  requestId: string;
  activityId: string;
  requestedSkillId: string | null;
  evidence: SubmittedEvidence;
};
export type EvidenceSubmissionResult = { replayed: boolean; submission: EvidenceSubmission };
export type EvidenceSkillOption = { id: string; name: string; status: "active"; nameTruncated: boolean };
export type EvidencePage<T> = { items: T[]; nextCursor: string | null };
export type EvidenceSubmissionPage = EvidencePage<EvidenceSubmission> & { view: "submissions" };
export type EvidenceSkillsPage = EvidencePage<EvidenceSkillOption> & { view: "skills" };
export type EvidenceList = EvidenceSubmissionPage | EvidenceSkillsPage;
export type EvidenceQuery = { view: EvidenceView; after: string | null };

/** Only fixed, explicitly mapped codes may be exposed by the HTTP boundary. */
export class EvidenceSubmissionError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "EvidenceSubmissionError";
  }
}
