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

export type SettlementConflictReason =
  | "already_confirmed" // this assessment is no longer pending
  | "already_settled" // this Activity already produced its original activity XP
  | "not_found" // assessment missing
  | "activity_not_found"
  // The repetition snapshot the service read went stale; the store derived a
  // different authoritative count inside its atomic write. Caller must retry.
  | "repetition_conflict";

export interface SettlementResult {
  ok: boolean;
  reason?: SettlementConflictReason | string;
  /** Present when reason === "repetition_conflict": the fresh authoritative count. */
  actualRepetitionCount?: number;
  /** Authoritative primary skill id used by this settlement. */
  skillId?: string;
  /** Authoritative persisted transaction (with skillId filled). */
  transaction?: XpTransaction;
  /** Authoritative mastery verification: newly created OR existing pending, else null. */
  masteryVerification?: MasteryVerification | null;
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
 *
 * ATOMIC SETTLEMENT GUARANTEES (Milestone 2.7, the store MUST enforce):
 *   1. Activity idempotency — an Activity can carry only ONE `xpType=activity`
 *      ledger entry. Second settlement for the same Activity → `already_settled`.
 *   2. Repetition snapshot — the similar-count that decides the penalty is
 *      derived from a CONSISTENT committed view inside the atomic write. If it
 *      differs from the service's snapshot → `repetition_conflict` + fresh
 *      `actualRepetitionCount`, and the caller retries.
 *   3. At most one `pending` MasteryVerification per skill.
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
  /**
   * READ-ONLY lookup of a stable skill id by label (normalized name/alias match).
   * Returns null when unknown. MUST NOT create or write anything — skill creation
   * happens only inside `applySettlement`'s atomic unit.
   */
  lookupSkillId(label: string): Promise<string | null>;
  /**
   * Atomically persist the result of a confirmed settlement (delta-based).
   * Resolves-or-creates the primary/secondary skills with stable UUID ids
   * INSIDE this atomic unit and returns authoritative `skillId`/`transaction`/
   * `masteryVerification`.
   */
  applySettlement(settlement: SettlementToApply): Promise<SettlementResult>;
  /** Wipe the store (demo/testing only). */
  reset(): Promise<void>;
}
