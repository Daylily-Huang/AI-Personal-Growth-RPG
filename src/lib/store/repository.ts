import type {
  Activity,
  Assessment,
  NewActivityInput,
  NewAssessmentInput,
  PlayerState,
  SettlementToApply,
  SkillEdge,
  SkillState,
  XpTransaction,
} from "./types";

export interface SettlementResult {
  ok: boolean;
  reason?: "already_confirmed" | "not_found" | string;
}

/**
 * Storage port (Repository pattern).
 *
 * A Repository is intentionally free of *business logic*: it only reads and
 * persists domain data. Business rules live in the domain/settlement service,
 * which depends on this interface — so there is exactly ONE copy of the rules,
 * shared by the demo JSON store today and the Supabase store later.
 *
 * `applySettlement` is the single mutation point for the XP ledger. The
 * implementation is responsible for making it atomic:
 *   - Demo  store: single synchronous read + write (one process, effectively serial)
 *   - Supabase:   PostgreSQL transaction + UNIQUE(assessment_id)
 */
export interface Repository {
  // ---- reads ----
  getActivity(id: string): Activity | null;
  listActivities(): Activity[];
  getAssessment(id: string): Assessment | null;
  listPendingAssessments(): Assessment[];
  listTransactions(): XpTransaction[];
  getSkill(name: string): SkillState | null;
  listSkills(): SkillState[];
  listSkillEdges(): SkillEdge[];
  getPlayer(): PlayerState;

  // ---- writes ----
  addActivity(input: NewActivityInput): Activity;
  addAssessment(input: NewAssessmentInput): Assessment;
  /** Atomically persist the full result of a confirmed settlement. */
  applySettlement(settlement: SettlementToApply): SettlementResult;
  /** Wipe the store (demo/testing only). */
  reset(): void;
}
