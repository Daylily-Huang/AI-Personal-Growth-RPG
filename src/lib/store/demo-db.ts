import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { calculateXp, RULES_VERSION, type XpInput } from "@/lib/growth-engine/xp";
import { levelFromXp } from "@/lib/growth-engine/levels";
import { checkMasteryProposal } from "@/lib/growth-engine/mastery";
import type { AssessmentProposal } from "@/lib/ai/schemas";

export interface Activity {
  id: string;
  rawInput: string;
  title: string;
  activityType: string | null;
  status: "pending_assessment" | "assessed" | "confirmed";
  totalMinutes: number | null;
  effectiveMinutes: number | null;
  createdAt: string;
}

export interface Assessment {
  id: string;
  activityId: string;
  status: "pending" | "confirmed" | "edited" | "rejected";
  proposal: AssessmentProposal;
  modelName: string;
  promptVersion: string;
  rulesVersion: string;
  confidence: number;
  createdAt: string;
  confirmedAt: string | null;
}

export interface XpTransaction {
  id: string;
  activityId: string;
  assessmentId: string;
  skillName: string;
  amount: number;
  baseAmount: number;
  modifierJson: Record<string, unknown>;
  reason: string;
  rulesVersion: string;
  createdAt: string;
}

export interface SkillState {
  name: string;
  xp: number;
  level: number;
  masteryLevel: number;
  masteryConfidence: number;
  lastUsedAt: string | null;
}

export interface SkillEdge {
  source: string;
  target: string;
  relation: string;
}

export interface PlayerState {
  totalXp: number;
  playerLevel: number;
  energy: number;
  focus: number;
  momentum: number;
}

export interface Db {
  version: 1;
  activities: Activity[];
  assessments: Assessment[];
  transactions: XpTransaction[];
  skills: Record<string, SkillState>;
  skillEdges: SkillEdge[];
  player: PlayerState;
}

const DEFAULT_DB_PATH = path.join(process.cwd(), ".data", "demo.json");

function emptyDb(): Db {
  return {
    version: 1,
    activities: [],
    assessments: [],
    transactions: [],
    skills: {},
    skillEdges: [],
    player: {
      totalXp: 0,
      playerLevel: 1,
      energy: 70,
      focus: 70,
      momentum: 30,
    },
  };
}

function dbPath(): string {
  return process.env.DEMO_DB_PATH ?? DEFAULT_DB_PATH;
}

export function readDb(): Db {
  try {
    const raw = fs.readFileSync(/* turbopackIgnore: true */ dbPath(), "utf8");
    const parsed = JSON.parse(raw) as Db;
    return { ...emptyDb(), ...parsed, player: { ...emptyDb().player, ...parsed.player } };
  } catch {
    return emptyDb();
  }
}

function writeDb(db: Db): void {
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(/* turbopackIgnore: true */ tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

export function createActivity(input: {
  rawInput: string;
  totalMinutes?: number | null;
  effectiveMinutes?: number | null;
}): Activity {
  const db = readDb();
  const now = new Date().toISOString();
  const title = input.rawInput.trim().slice(0, 80) || "未命名 Activity";
  const activity: Activity = {
    id: crypto.randomUUID(),
    rawInput: input.rawInput.trim(),
    title,
    activityType: null,
    status: "pending_assessment",
    totalMinutes: input.totalMinutes ?? null,
    effectiveMinutes: input.effectiveMinutes ?? null,
    createdAt: now,
  };
  db.activities.unshift(activity);
  writeDb(db);
  return activity;
}

export function getActivity(id: string): Activity | null {
  return readDb().activities.find((a) => a.id === id) ?? null;
}

export function listActivities(): Activity[] {
  return readDb().activities;
}

export function createAssessment(input: {
  activityId: string;
  proposal: AssessmentProposal;
  modelName: string;
  promptVersion: string;
}): Assessment {
  const db = readDb();
  const activity = db.activities.find((a) => a.id === input.activityId);
  if (!activity) throw new Error("Activity not found");

  const assessment: Assessment = {
    id: crypto.randomUUID(),
    activityId: input.activityId,
    status: "pending",
    proposal: input.proposal,
    modelName: input.modelName,
    promptVersion: input.promptVersion,
    rulesVersion: RULES_VERSION,
    confidence: input.proposal.confidence,
    createdAt: new Date().toISOString(),
    confirmedAt: null,
  };

  db.assessments.unshift(assessment);
  activity.status = "assessed";
  writeDb(db);
  return assessment;
}

export function listPendingAssessments(): Assessment[] {
  return readDb().assessments.filter((a) => a.status === "pending");
}

export function getAssessment(id: string): Assessment | null {
  return readDb().assessments.find((a) => a.id === id) ?? null;
}

export interface ConfirmResult {
  ok: boolean;
  reason?: string;
  transaction?: XpTransaction;
  assessment?: Assessment;
}

/**
 * Confirm an assessment and atomically write the XP ledger.
 *
 * Idempotent: a second confirm for the same assessment is a no-op.
 * XP is recomputed server-side from the proposal's semantic fields — the LLM
 * never writes the ledger directly.
 */
export function confirmAssessment(assessmentId: string): ConfirmResult {
  const db = readDb();
  const assessment = db.assessments.find((a) => a.id === assessmentId);
  if (!assessment) return { ok: false, reason: "not_found" };
  if (assessment.status !== "pending") {
    return { ok: false, reason: "already_confirmed", assessment };
  }

  const activity = db.activities.find((a) => a.id === assessment.activityId);
  if (!activity) return { ok: false, reason: "activity_not_found" };

  const recentSimilarCount = db.transactions.length; // simple proxy for repetition
  const xpInput: XpInput = {
    baseValue: assessment.proposal.xp_semantics.base_value,
    difficulty: assessment.proposal.xp_semantics.difficulty,
    masteryGain: assessment.proposal.xp_semantics.mastery_gain,
    evidence: assessment.proposal.evidence.level,
    novelty: assessment.proposal.xp_semantics.novelty,
    goalAlignment: assessment.proposal.xp_semantics.goal_alignment,
    repetitionCount: recentSimilarCount,
    effectiveMinutes: activity.effectiveMinutes ?? undefined,
  };
  const xpResult = calculateXp(xpInput);

  const skillName = assessment.proposal.affected_skills[0]?.name ?? "General Growth";
  const skill = db.skills[skillName] ?? {
    name: skillName,
    xp: 0,
    level: 1,
    masteryLevel: 1,
    masteryConfidence: 0.5,
    lastUsedAt: null,
  };

  const transaction: XpTransaction = {
    id: crypto.randomUUID(),
    activityId: activity.id,
    assessmentId: assessment.id,
    skillName,
    amount: xpResult.finalXp,
    baseAmount: assessment.proposal.xp_semantics.base_value,
    modifierJson: xpResult.modifiers as unknown as Record<string, unknown>,
    reason: activity.rawInput,
    rulesVersion: xpResult.rulesVersion,
    createdAt: new Date().toISOString(),
  };

  skill.xp += xpResult.finalXp;
  skill.level = levelFromXp(skill.xp).level;
  skill.lastUsedAt = new Date().toISOString();

  const masteryChange = assessment.proposal.mastery_changes[0];
  if (masteryChange) {
    const check = checkMasteryProposal(
      skill.masteryLevel,
      masteryChange.proposed_level,
      assessment.proposal.evidence.level,
    );
    if (check.allowed && masteryChange.proposed_level > skill.masteryLevel) {
      skill.masteryLevel = masteryChange.proposed_level;
      skill.masteryConfidence = masteryChange.confidence;
    }
  }

  db.skills[skillName] = skill;

  // Link related skills so the Skill Tree can show a meaningful graph.
  for (const related of assessment.proposal.affected_skills.slice(1)) {
    if (!db.skills[related.name]) {
      db.skills[related.name] = {
        name: related.name,
        xp: 0,
        level: 1,
        masteryLevel: 1,
        masteryConfidence: 0.5,
        lastUsedAt: null,
      };
    }
    const edge: SkillEdge = { source: skillName, target: related.name, relation: "related" };
    const exists = db.skillEdges.some(
      (e) => e.source === edge.source && e.target === edge.target && e.relation === edge.relation,
    );
    if (!exists) db.skillEdges.push(edge);
  }

  db.transactions.unshift(transaction);
  db.player.totalXp += xpResult.finalXp;
  db.player.playerLevel = levelFromXp(db.player.totalXp).level;
  assessment.status = "confirmed";
  assessment.confirmedAt = new Date().toISOString();
  activity.status = "confirmed";

  writeDb(db);
  return { ok: true, transaction, assessment };
}

export interface DashboardSnapshot {
  player: PlayerState;
  levelProgress: {
    xpIntoLevel: number;
    xpNeededForNext: number;
    progress: number;
  };
  recentGrowth: XpTransaction[];
  pendingAssessments: Assessment[];
  activities: Activity[];
  skills: SkillState[];
}

export function getDashboard(): DashboardSnapshot {
  const db = readDb();
  const level = levelFromXp(db.player.totalXp);
  return {
    player: db.player,
    levelProgress: {
      xpIntoLevel: level.xpIntoLevel,
      xpNeededForNext: level.xpNeededForNext,
      progress: level.progress,
    },
    recentGrowth: db.transactions.slice(0, 10),
    pendingAssessments: db.assessments.filter((a) => a.status === "pending"),
    activities: db.activities.slice(0, 20),
    skills: Object.values(db.skills).sort((a, b) => b.xp - a.xp),
  };
}

export function getRecentSimilarCount(): number {
  return readDb().transactions.length;
}

export function listSkillEdges(): SkillEdge[] {
  return readDb().skillEdges;
}

export function resetDemoDb(): void {
  writeDb(emptyDb());
}
