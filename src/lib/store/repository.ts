import type {
  Activity,
  Assessment,
  MasteryVerification,
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
 * SEMANTICS (Milestone 2.6):
 * - ALL methods are async, because the Supabase implementation is remote
 *   (`await supabase.from(...)`). An async port is set from day one.
 * - The port NEVER contains business rules — it only reads/persists data.
 * - `applySettlement` is the single atomic settlement mutation. It receives a
 *   DELTA-based `SettlementToApply` and must apply it inside an atomic unit:
 *     Demo:    one synchronous read → apply deltas (current += delta) → write
 *     Supabase: one DB transaction / RPC; adds to current stored rows
 *   The store (not the service) is responsible for keeping running totals and
 *   derived levels consistent under concurrency — see docs/06 for the design.
 */
export interface Repository {
  // ---- reads ----
  getActivity(id: string): Promise<Activity | null>;
  listActivities(): Promise<Activity[]>;
  getAssessment(id: string): Promise<Assessment | null>;
  listPendingAssessments(): Promise<Assessment[]>;
  listTransactions(): Promise<XpTransaction[]>;
  getSkill(name: string): Promise<SkillState | null>;
  listSkills(): Promise<SkillState[]>;
  listSkillEdges(): Promise<SkillEdge[]>;
  getPlayer(): Promise<PlayerState>;
  listMasteryVerifications(): Promise<MasteryVerification[]>;

  // ---- writes ----
  addActivity(input: NewActivityInput): Promise<Activity>;
  addAssessment(input: NewAssessmentInput): Promise<Assessment>;
  /** Atomically persist the result of a confirmed settlement (delta-based). */
  applySettlement(settlement: SettlementToApply): Promise<SettlementResult>;
  /** Wipe the store (demo/testing only). */
  reset(): Promise<void>;
}
