import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { RULES_VERSION } from "@/lib/growth-engine/xp";
import { levelFromXp } from "@/lib/growth-engine/levels";
import { countRecentSimilar } from "./similarity";
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
/** Same 30-day window as the service — kept here so the coupon is atomic. */
const SIMILARITY_WINDOW_DAYS = 30;

function emptyDb(): Db {
  return {
    version: 3,
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

/** Deterministic stable skill id derived from a display name (MVP identity). */
function slugSkillId(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `skill-${slug || "unnamed"}`;
}

function defaultSkill(id: string, name: string): SkillState {
  return {
    id,
    name,
    aliases: [],
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

/** Match a skill by exact name or alias inside a normalized id→skill map. */
function findSkillByLabel(skills: Record<string, SkillState>, label: string): SkillState | undefined {
  const raw = label.trim();
  for (const skill of Object.values(skills)) {
    if (skill.name === raw) return skill;
    if (skill.aliases.includes(raw)) return skill;
  }
  return undefined;
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
    return normalizeDb(parsed as Db);
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

  async getSkill(label: string): Promise<SkillState | null> {
    const db = this.readDb();
    return findSkillByLabel(db.skills, label) ?? null;
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
      // Milestone 2.7: freeze the rule set at creation time (audit of history).
      rulesVersion: RULES_VERSION,
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
    // A confirmed Activity keeps its confirmed status; revisions are allowed,
    // but the once-settled ledger entry stays frozen (guarded in applySettlement).
    if (activity.status !== "confirmed") {
      activity.status = "assessed";
    }
    this.writeDb(db);
    return assessment;
  }

  /** Resolve-or-create a stable skill id for a display label. */
  async resolveSkillId(label: string): Promise<string> {
    const db = this.readDb();
    const existing = findSkillByLabel(db.skills, label);
    if (existing) return existing.id;

    const name = label.trim();
    const id = slugSkillId(name);
    db.skills[id] = defaultSkill(id, name);
    this.writeDb(db);
    return id;
  }

  /**
   * Single atomic settlement write.
   *
   * Delta semantics (Milestone 2.6) + integrity guards (Milestone 2.7):
   *   1. an Activity may have only ONE `xpType=activity` settlement → otherwise `already_settled`;
   *   2. the repetition snapshot is derived from the committed view INSIDE this
   *      atomic write; if the service's snapshot is stale → `repetition_conflict`;
   *   3. at most one `pending` MasteryVerification per skill.
   */
  async applySettlement(settlement: SettlementToApply): Promise<SettlementResult> {
    const db = this.readDb();
    const assessment = db.assessments.find((a) => a.id === settlement.assessmentId);
    if (!assessment) return { ok: false, reason: "not_found" };
    if (assessment.status !== "pending") return { ok: false, reason: "already_confirmed" };

    const activity = db.activities.find((a) => a.id === settlement.transaction.activityId);
    if (!activity) return { ok: false, reason: "activity_not_found" };

    // Guard 1: one original activity settlement per Activity (re-assess → revision,
    // but re-confirming must never mint a second XP entry).
    const alreadySettled = db.transactions.some(
      (t) => t.activityId === activity.id && t.xpType === "activity",
    );
    if (alreadySettled) return { ok: false, reason: "already_settled", };

    // Guard 2: repetition snapshot must be derived from the committed view.
    const authoritativeCount = countRecentSimilar(db.transactions, {
      skillName: settlement.transaction.skillName,
      activityType: settlement.transaction.activityType,
      refTime: settlement.transaction.createdAt,
      windowDays: SIMILARITY_WINDOW_DAYS,
    });
    if (authoritativeCount !== settlement.transaction.repetitionCount) {
      return { ok: false, reason: "repetition_conflict", actualRepetitionCount: authoritativeCount };
    }

    const now = settlement.transaction.createdAt;

    // Resolve-or-create the primary skill under its stable id.
    const primary = db.skills[settlement.primarySkill.id] ?? defaultSkill(settlement.primarySkill.id, settlement.primarySkill.name);
    if (primary.name !== settlement.primarySkill.name && !primary.aliases.includes(settlement.primarySkill.name)) {
      primary.aliases.push(settlement.primarySkill.name);
    }
    db.skills[primary.id] = primary;

    // 1) ledger (append-only)
    db.transactions.unshift({
      ...settlement.transaction,
      skillId: settlement.transaction.skillId || primary.id,
      xpType: settlement.transaction.xpType ?? "activity",
    });

    // 2) player total (delta) + derived provisional XP level
    db.player.totalXp += settlement.player.xpDelta;
    db.player.playerLevel = levelFromXp(db.player.totalXp).level;

    // 3) primary skill (delta) + derived skill level + mastery action
    primary.xp += settlement.primarySkill.xpDelta;
    primary.level = levelFromXp(primary.xp).level;
    primary.lastUsedAt = now;
    const masteryAction = settlement.primarySkill.masteryAction;
    if (masteryAction.action === "upgrade") {
      primary.masteryLevel = masteryAction.proposedLevel;
      primary.masteryConfidence = masteryAction.confidence;
    }
    // request_verification leaves mastery untouched; the pending record below
    // is the source of truth until verified.

    // 4) related skills exist (stable ids), 5) edges (deduped)
    for (const name of settlement.relatedSkillNames) {
      const existing = findSkillByLabel(db.skills, name);
      if (!existing) {
        const id = slugSkillId(name);
        db.skills[id] = defaultSkill(id, name.trim());
      }
    }
    for (const edge of settlement.newEdges) {
      const exists = db.skillEdges.some(
        (e) => e.source === edge.source && e.target === edge.target && e.relation === edge.relation,
      );
      if (!exists) db.skillEdges.push(edge);
    }

    // 6) pending mastery verification — at most one per skill
    if (settlement.masteryVerification) {
      const hasPending = db.masteryVerifications.some(
        (v) => v.status === "pending" && v.skillId === primary.id,
      );
      if (!hasPending) {
        db.masteryVerifications.unshift({
          ...settlement.masteryVerification,
          skillId: primary.id,
        });
      }
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

/** Tolerate pre-v3 demo files: key skills by stable id, backfill skillId/xpType/rulesVersion. */
function normalizeDb(parsed: Db): Db {
  const out = emptyDb();
  out.player = { ...out.player, ...parsed.player };
  out.activities = (parsed.activities ?? []).map((a) => ({
    ...a,
    rulesVersion: a.rulesVersion ?? RULES_VERSION,
  }));
  out.assessments = parsed.assessments ?? [];
  out.masteryVerifications = (parsed.masteryVerifications ?? []).map((v) => ({
    ...v,
    skillId: v.skillId ?? slugSkillId(v.skillName),
  }));
  out.skillEdges = parsed.skillEdges ?? [];

  // Legacy skills were keyed by display name; re-key by stable id and keep the
  // old name as an alias so nothing dangles.
  const legacySkills: Record<string, SkillState> = parsed.skills ?? {};
  const seenNames = new Set<string>();
  for (const [key, s] of Object.entries(legacySkills)) {
    const id = s.id ?? slugSkillId(s.name ?? key);
    const name = s.name ?? key;
    const aliases = [...(s.aliases ?? [])];
    if (name !== key && !aliases.includes(key)) aliases.push(key);
    if (!seenNames.has(name)) {
      out.skills[id] = { ...s, id, name, aliases };
      seenNames.add(name);
    }
  }

  out.transactions = (parsed.transactions ?? []).map((t) => ({
    ...t,
    skillId: t.skillId ?? slugSkillId(t.skillName),
    xpType: t.xpType ?? "activity",
    rulesVersion: t.rulesVersion ?? RULES_VERSION,
  }));

  return out;
}
