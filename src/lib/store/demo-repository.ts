import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { RULES_VERSION } from "@/lib/growth-engine/xp";
import { levelFromXp } from "@/lib/growth-engine/levels";
import type {
  Activity,
  Assessment,
  Db,
  MasteryVerification,
  NewActivityInput,
  NewAssessmentInput,
  PlayerState,
  SettlementToApply,
  SkillEdge,
  SkillState,
  XpTransaction,
} from "./types";
import type { Repository, SettlementResult } from "./repository";

const DEFAULT_DB_PATH = path.join(process.cwd(), ".data", "demo.json");

function emptyDb(): Db {
  return {
    version: 2,
    activities: [],
    assessments: [],
    transactions: [],
    skills: {},
    skillEdges: [],
    masteryVerifications: [],
    player: {
      totalXp: 0,
      playerLevel: 1,
      energy: 70,
      focus: 70,
      momentum: 30,
    },
  };
}

function defaultSkill(name: string): SkillState {
  return {
    name,
    xp: 0,
    level: 1,
    masteryLevel: 1,
    masteryConfidence: 0.5,
    lastUsedAt: null,
  };
}

function dbPath(): string {
  return process.env.DEMO_DB_PATH ?? DEFAULT_DB_PATH;
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as NodeJS.ErrnoException).code === "ENOENT";
}

/**
 * Demo JSON store.
 *
 * Async port so the interface matches the future remote Supabase store — the
 * sync file IO stays inside (still runs in one microtask, so each read/write
 * and each applySettlement is atomic within a single Node process).
 */
export class DemoRepository implements Repository {
  readDb(): Db {
    const file = dbPath();

    let raw: string;
    try {
      raw = fs.readFileSync(/* turbopackIgnore: true */ file, "utf8");
    } catch (err) {
      // File missing → fresh world. Anything else (permission, IO) → let it crash loudly.
      if (isEnoent(err)) return emptyDb();
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.backupCorrupt(file, raw);
      throw new Error(`Demo store corrupted (backup kept, DB NOT overwritten): ${file}`);
    }
    if (!isValidDbShape(parsed)) {
      this.backupCorrupt(file, raw);
      throw new Error(`Demo store has an invalid shape (backup kept, DB NOT overwritten): ${file}`);
    }
    const p = parsed as Db;
    return {
      ...emptyDb(),
      ...p,
      player: { ...emptyDb().player, ...p.player },
      masteryVerifications: p.masteryVerifications ?? [],
    };
  }

  private writeDb(db: Db): void {
    const file = dbPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(/* turbopackIgnore: true */ tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, file);
  }

  private backupCorrupt(file: string, raw: string): void {
    try {
      const backup = `${file}.corrupt-${Date.now()}`;
      fs.writeFileSync(/* turbopackIgnore: true */ backup, raw, "utf8");
    } catch {
      // best-effort backup; never throw from a corruption path we already report
    }
  }

  // ---- reads ----

  async getActivity(id: string): Promise<Activity | null> {
    return this.readDb().activities.find((a) => a.id === id) ?? null;
  }

  async listActivities(): Promise<Activity[]> {
    return this.readDb().activities;
  }

  async getAssessment(id: string): Promise<Assessment | null> {
    return this.readDb().assessments.find((a) => a.id === id) ?? null;
  }

  async listPendingAssessments(): Promise<Assessment[]> {
    return this.readDb().assessments.filter((a) => a.status === "pending");
  }

  async listTransactions(): Promise<XpTransaction[]> {
    return this.readDb().transactions;
  }

  async getSkill(name: string): Promise<SkillState | null> {
    return this.readDb().skills[name] ?? null;
  }

  async listSkills(): Promise<SkillState[]> {
    return Object.values(this.readDb().skills);
  }

  async listSkillEdges(): Promise<SkillEdge[]> {
    return this.readDb().skillEdges;
  }

  async getPlayer(): Promise<PlayerState> {
    return this.readDb().player;
  }

  async listMasteryVerifications(): Promise<MasteryVerification[]> {
    return this.readDb().masteryVerifications;
  }

  // ---- writes ----

  async addActivity(input: NewActivityInput): Promise<Activity> {
    const db = this.readDb();
    const now = new Date().toISOString();
    const activity: Activity = {
      id: crypto.randomUUID(),
      rawInput: input.rawInput.trim(),
      title: input.rawInput.trim().slice(0, 80) || "未命名 Activity",
      activityType: null,
      status: "pending_assessment",
      totalMinutes: input.totalMinutes ?? null,
      effectiveMinutes: input.effectiveMinutes ?? null,
      createdAt: now,
    };
    db.activities.unshift(activity);
    this.writeDb(db);
    return activity;
  }

  async addAssessment(input: NewAssessmentInput): Promise<Assessment> {
    const db = this.readDb();
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
    this.writeDb(db);
    return assessment;
  }

  /**
   * Single atomic settlement write.
   *
   * Delta semantics (Milestone 2.6): totals are updated as `current += delta`
   * and derived levels are recomputed HERE from the updated stored value — so
   * concurrent settlements converge on the true final state instead of
   * overwriting each other with stale absolute values.
   */
  async applySettlement(settlement: SettlementToApply): Promise<SettlementResult> {
    const db = this.readDb();
    const assessment = db.assessments.find((a) => a.id === settlement.assessmentId);
    if (!assessment) return { ok: false, reason: "not_found" };
    if (assessment.status !== "pending") return { ok: false, reason: "already_confirmed" };

    const activity = db.activities.find((a) => a.id === settlement.transaction.activityId);
    if (!activity) return { ok: false, reason: "activity_not_found" };

    const now = settlement.transaction.createdAt;

    // 1) ledger (append-only)
    db.transactions.unshift(settlement.transaction);

    // 2) player total (delta) + derived provisional XP level
    db.player.totalXp += settlement.player.xpDelta;
    db.player.playerLevel = levelFromXp(db.player.totalXp).level;

    // 3) primary skill (delta) + derived skill level + mastery action
    const skill = db.skills[settlement.primarySkill.name] ?? defaultSkill(settlement.primarySkill.name);
    skill.xp += settlement.primarySkill.xpDelta;
    skill.level = levelFromXp(skill.xp).level;
    skill.lastUsedAt = now;
    const masteryAction = settlement.primarySkill.masteryAction;
    if (masteryAction.action === "upgrade") {
      skill.masteryLevel = masteryAction.proposedLevel;
      skill.masteryConfidence = masteryAction.confidence;
    }
    // `request_verification` leaves mastery untouched; the pending record below
    // is the source of truth until it is verified.
    db.skills[skill.name] = skill;

    // 4) related skills exist for the Skill Tree
    for (const name of settlement.relatedSkillNames) {
      if (!db.skills[name]) db.skills[name] = defaultSkill(name);
    }
    // 5) edges (deduped)
    for (const edge of settlement.newEdges) {
      const exists = db.skillEdges.some(
        (e) => e.source === edge.source && e.target === edge.target && e.relation === edge.relation,
      );
      if (!exists) db.skillEdges.push(edge);
    }

    // 6) pending mastery verification (if the upgrade required one)
    if (settlement.masteryVerification) {
      db.masteryVerifications.unshift(settlement.masteryVerification);
    }

    // 7) mark assessment + activity settled
    assessment.status = "confirmed";
    assessment.confirmedAt = now;
    activity.status = "confirmed";

    this.writeDb(db);
    return { ok: true };
  }

  async reset(): Promise<void> {
    this.writeDb(emptyDb());
  }
}

function isValidDbShape(input: unknown): input is Db {
  if (typeof input !== "object" || input === null) return false;
  const p = input as Partial<Db>;
  return (
    Array.isArray(p.activities) &&
    Array.isArray(p.assessments) &&
    Array.isArray(p.transactions) &&
    typeof p.skills === "object" &&
    p.skills !== null &&
    Array.isArray(p.skillEdges) &&
    typeof p.player === "object" &&
    p.player !== null
  );
}
