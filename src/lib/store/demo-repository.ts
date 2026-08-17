import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { RULES_VERSION } from "@/lib/growth-engine/xp";
import type {
  Activity,
  Assessment,
  Db,
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

/** Demo JSON store (in-process, synchronous, single-writer). */
export class DemoRepository implements Repository {
  readDb(): Db {
    try {
      const raw = fs.readFileSync(/* turbopackIgnore: true */ dbPath(), "utf8");
      const parsed = JSON.parse(raw) as Db;
      return { ...emptyDb(), ...parsed, player: { ...emptyDb().player, ...parsed.player } };
    } catch {
      return emptyDb();
    }
  }

  private writeDb(db: Db): void {
    const file = dbPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(/* turbopackIgnore: true */ tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, file);
  }

  // ---- reads ----

  getActivity(id: string): Activity | null {
    return this.readDb().activities.find((a) => a.id === id) ?? null;
  }

  listActivities(): Activity[] {
    return this.readDb().activities;
  }

  getAssessment(id: string): Assessment | null {
    return this.readDb().assessments.find((a) => a.id === id) ?? null;
  }

  listPendingAssessments(): Assessment[] {
    return this.readDb().assessments.filter((a) => a.status === "pending");
  }

  listTransactions(): XpTransaction[] {
    return this.readDb().transactions;
  }

  getSkill(name: string): SkillState | null {
    return this.readDb().skills[name] ?? null;
  }

  listSkills(): SkillState[] {
    return Object.values(this.readDb().skills);
  }

  listSkillEdges(): SkillEdge[] {
    return this.readDb().skillEdges;
  }

  getPlayer(): PlayerState {
    return this.readDb().player;
  }

  // ---- writes ----

  addActivity(input: NewActivityInput): Activity {
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

  addAssessment(input: NewAssessmentInput): Assessment {
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

  applySettlement(settlement: SettlementToApply): SettlementResult {
    const db = this.readDb();
    const assessment = db.assessments.find((a) => a.id === settlement.assessmentId);
    if (!assessment) return { ok: false, reason: "not_found" };
    if (assessment.status !== "pending") return { ok: false, reason: "already_confirmed" };

    const activity = db.activities.find((a) => a.id === settlement.transaction.activityId);
    if (!activity) return { ok: false, reason: "activity_not_found" };

    // Apply the whole settlement within one synchronous read+write (atomic in
    // a single Node process; Supabase will implement this as a transaction).
    db.transactions.unshift(settlement.transaction);
    db.skills[settlement.primarySkill.name] = settlement.primarySkill;

    for (const related of settlement.relatedSkills) {
      if (!db.skills[related.name]) {
        db.skills[related.name] = related;
      }
    }
    for (const edge of settlement.newEdges) {
      const exists = db.skillEdges.some(
        (e) => e.source === edge.source && e.target === edge.target && e.relation === edge.relation,
      );
      if (!exists) db.skillEdges.push(edge);
    }

    db.player = settlement.player;
    assessment.status = "confirmed";
    assessment.confirmedAt = new Date().toISOString();
    activity.status = "confirmed";

    this.writeDb(db);
    return { ok: true };
  }

  reset(): void {
    this.writeDb(emptyDb());
  }
}
