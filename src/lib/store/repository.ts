import type {
  Activity,
  Assessment,
  EvidenceRecord,
  MasteryVerification,
  NewActivityInput,
  NewAssessmentInput,
  NewQuestInput,
  NewSkillEdgeInput,
  PlayerState,
  Quest,
  QuestStatus,
  SettlementToApply,
  SkillEdge,
  SkillState,
  UpdateQuestInput,
  UpdateSkillMetadataInput,
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
 * SEMANTICS (Milestone 2.6 & Stage 5A):
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
 * ATOMIC SETTLEMENT GUARANTEES (Stage 5A, the store MUST enforce):
 *   1. Activity idempotency — an Activity can carry only ONE `xpType=activity`
 *      ledger entry. Second settlement for the same Activity → `already_settled`.
 *   2. Stable-ID resolution — accepts `SkillResolutionInput` union (`existing` vs `create`).
 *      When `existing` is passed, the store never re-resolves identity from name.
 *   3. Authoritative Evidence persistence — writes `evidence_records` atomically.
 *   4. MasteryAction 3-state protocol — preserves `none` / `upgrade` / `request_verification`.
 *   5. Repetition snapshot — derived from consistent committed view inside atomic write.
 *   6. At most one `pending` MasteryVerification per skill.
 */
export interface Repository {
  // ---- reads ----
  getActivity(id: string): Promise<Activity | null>;
  listActivities(): Promise<Activity[]>;
  getAssessment(id: string): Promise<Assessment | null>;
  listPendingAssessments(): Promise<Assessment[]>;
  listTransactions(): Promise<XpTransaction[]>;
  getSkill(name: string): Promise<SkillState | null>;
  getSkillById(id: string): Promise<SkillState | null>;
  listSkills(): Promise<SkillState[]>;
  listSkillEdges(): Promise<SkillEdge[]>;
  listEvidenceRecords(skillId?: string): Promise<EvidenceRecord[]>;
  getPlayer(): Promise<PlayerState>;
  listMasteryVerifications(): Promise<MasteryVerification[]>;

  // ---- skills & edges (Stage 5A) ----
  addEdge(input: NewSkillEdgeInput): Promise<SkillEdge>;
  deleteEdge(id: string): Promise<void>;
  updateSkillMetadata(id: string, updates: UpdateSkillMetadataInput): Promise<SkillState>;

  // ---- quests ----
  getQuest(id: string): Promise<Quest | null>;
  listQuests(filter?: { status?: QuestStatus; isMain?: boolean; parentQuestId?: string | null }): Promise<Quest[]>;

  // ---- writes ----
  addActivity(input: NewActivityInput): Promise<Activity>;
  addAssessment(input: NewAssessmentInput): Promise<Assessment>;
  addQuest(input: NewQuestInput): Promise<Quest>;
  updateQuest(id: string, updates: UpdateQuestInput): Promise<Quest>;
  deleteQuest(id: string): Promise<void>;

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
