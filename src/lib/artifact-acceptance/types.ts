export const ARTIFACT_MANUAL_POLICY = "artifact-manual-v1" as const;
export const ARTIFACT_MANUAL_CREDITS = 100 as const;
export const ARTIFACT_ACCEPTANCE_BODY_BYTES = 16384;

export class ArtifactAcceptanceError extends Error {
  constructor(code: string, public readonly sqlState?: string) { super(code); this.name = "ArtifactAcceptanceError"; }
}
export interface AcceptArtifactInput { requestKey: string; expectedUpdatedAt: string; acceptanceNote: string; }
export interface RevokeArtifactInput { requestKey: string; reason: string; }
export interface AcceptanceArtifact {
  id: string; userId: string; title: string; version: string | null;
  lifecycleStatus: "draft" | "active" | "archived" | "superseded";
  isArchived: boolean; updatedAt: string;
}
export interface ArtifactAcceptance {
  id: string; userId: string; artifactId: string;
  recognitionClass: "USER_CONFIRMED_ARTIFACT"; status: "ACTIVE" | "REVOKED";
  acceptedTitle: string; acceptedVersion: string | null; acceptedUpdatedAt: string;
  acceptanceNote: string; acceptedAt: string; earnTransactionId: string;
  policyVersion: typeof ARTIFACT_MANUAL_POLICY;
  revokedAt: string | null; revocationReason: string | null; correctionTransactionId: string | null;
}
export interface ArtifactCredit {
  id: string; userId: string; accountId: string; eventKind: "EARN" | "CORRECTION";
  amount: number; sourceType: "ARTIFACT"; sourceId: string;
  policyVersion: typeof ARTIFACT_MANUAL_POLICY; correctionForId: string | null; createdAt: string;
}
export interface ArtifactAcceptanceView {
  artifact: AcceptanceArtifact; acceptance: ArtifactAcceptance | null;
  earn: ArtifactCredit | null; correction: ArtifactCredit | null;
}
export interface ArtifactAcceptanceReceipt {
  acceptance: ArtifactAcceptance; earn: ArtifactCredit; correction: ArtifactCredit | null; replayed: boolean;
}
export interface ArtifactAcceptancePending {
  operation: "accept" | "revoke";
  input: AcceptArtifactInput | RevokeArtifactInput;
  unknown: boolean;
}
/** Page-session storage only: component remounts must not manufacture a new request. */
export interface ArtifactAcceptanceSession {
  pending: ArtifactAcceptancePending | null;
  receipt: ArtifactAcceptanceReceipt | null;
  owner: string | null;
}
export interface ArtifactAcceptanceMemory {
  getSnapshot: () => ArtifactAcceptanceSession;
  subscribe: (listener: () => void) => () => void;
  update: (snapshot: ArtifactAcceptanceSession) => void;
}
