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
  NewQuestInput,
  PlayerState,
  Quest,
  QuestStatus,
  SettlementToApply,
  SkillEdge,
  SkillState,
  UpdateQuestInput,
  XpTransaction,
} from "./types";
import type { Repository, SettlementResult } from "./repository";
import { ActivityAlreadySettledError } from "./errors";

const DEFAULT_DB_PATH = path.join(process.cwd(), ".data", "demo.json");
/** Same 30-day window as the service — kept here so the coupon is atomic. */
const SIMILARITY_WINDOW_DAYS = 30;

function emptyDb(): Db {
  return {
    version: 4,
    activities: [],
    assessments: [],
    transactions: [],
    skills: {},
    skillEdges: [],
    masteryVerifications: [],
    quests: [],
    player: {
      totalXp: 0,
      playerLevel: 1,
      energy: 70,
      focus: 70,
      momentum: 30,
    },
  };
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

/**
 * Case + whitespace insensitive key for skill matching: " Statistics " and
 * "statistics" and "Regression   Analysis" all match their skill.
 */
function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function dbPath(): string {
  return process.env.DEMO_DB_PATH ?? DEFAULT_DB_PATH;
}

function isEnoent(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as NodeJS.ErrnoException).code === "ENOENT";
}

/** Match a skill by normalized name or alias inside an id→skill map. */
function findSkillByLabel(skills: Record<string, SkillState>, label: string): SkillState | undefined {
  const key = normalizeLabel(label);
  for (const skill of Object.values(skills)) {
    if (normalizeLabel(skill.name) === key) return skill;
    if (skill.aliases.some((a) => normalizeLabel(a) === key)) return skill;
  }
  return undefined;
}

/**
 * Deterministic RFC-4122 v5-style UUID for MIGRATING legacy demo data only.
 * Runtime skill creation always uses `crypto.randomUUID()` — ids are never
 * derived from display names in the live path (Round6).
 */
function deterministicSkillId(name: string): string {
  const hash = crypto.createHash("sha1").update(`dsh-growth:v4:${normalizeLabel(name)}`).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
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

  // ---- quests ----

  async getQuest(id: string): Promise<Quest | null> {
    return (this.readDb().quests ?? []).find((q) => q.id === id) ?? null;
  }

  async listQuests(filter?: { status?: QuestStatus; isMain?: boolean; parentQuestId?: string | null }): Promise<Quest[]> {
    let list = this.readDb().quests ?? [];
    if (filter?.status) {
      list = list.filter((q) => q.status === filter.status);
    }
    if (typeof filter?.isMain === "boolean") {
      list = list.filter((q) => q.isMainQuest === filter.isMain);
    }
    if (filter?.parentQuestId !== undefined) {
      list = list.filter((q) => q.parentQuestId === filter.parentQuestId);
    }
    return list;
  }

  // ---- writes ----

  async addQuest(input: NewQuestInput): Promise<Quest> {
    const db = this.readDb();
    const now = new Date().toISOString();
    const quest: Quest = {
      id: crypto.randomUUID(),
      parentQuestId: input.parentQuestId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      questType: input.questType,
      questSize: input.questSize ?? "standard",
      status: input.status ?? "available",
      difficulty: input.difficulty ?? 0.5,
      goalAlignment: input.goalAlignment ?? 0.5,
      progress: input.progress ?? 0,
      deadline: input.deadline ?? null,
      isMainQuest: Boolean(input.isMainQuest),
      isBoss: Boolean(input.isBoss),
      completedAt: input.status === "completed" ? now : null,
      createdAt: now,
      updatedAt: now,
    };
    db.quests = db.quests ?? [];
    db.quests.push(quest);
    if (quest.parentQuestId) {
      this.rollUpParentProgress(db, quest.parentQuestId, now);
    }
    this.writeDb(db);
    return quest;
  }

  async updateQuest(id: string, updates: UpdateQuestInput): Promise<Quest> {
    const db = this.readDb();
    db.quests = db.quests ?? [];
    const index = db.quests.findIndex((q) => q.id === id);
    if (index === -1) {
      throw new Error(`Quest not found: ${id}`);
    }
    const current = db.quests[index]!;

    // Anti-cycle check: parent cannot be self or descendant
    if (updates.parentQuestId !== undefined && updates.parentQuestId !== null) {
      if (updates.parentQuestId === id) {
        throw new Error("Self-parenting is forbidden: quest cannot be its own parent");
      }
      // Check if `id` is an ancestor of `updates.parentQuestId`
      let checkParentId: string | null = updates.parentQuestId;
      const visited = new Set<string>();
      while (checkParentId && !visited.has(checkParentId)) {
        visited.add(checkParentId);
        if (checkParentId === id) {
          throw new Error("Cycle detected: cannot set parent_quest_id to a descendant quest");
        }
        const p = db.quests.find((q) => q.id === checkParentId);
        checkParentId = p?.parentQuestId ?? null;
      }
    }

    const hasChildren = db.quests.some((q) => q.parentQuestId === id);
    const now = new Date().toISOString();
    const updatedStatus = updates.status ?? current.status;

    // Derived progress guard: if node has children, its progress is derived from children
    let derivedProgress = updates.progress !== undefined ? updates.progress : current.progress;
    let finalStatus = updatedStatus;
    if (hasChildren) {
      const children = db.quests.filter((q) => q.parentQuestId === id && q.status !== "archived");
      if (children.length > 0) {
        derivedProgress = Math.round(children.reduce((s, c) => s + c.progress, 0) / children.length);
        const allCompleted = children.every((c) => c.status === "completed") && derivedProgress === 100;
        if (allCompleted) {
          finalStatus = "completed";
        } else if (derivedProgress < 100) {
          finalStatus = current.status === "completed" ? "active" : updatedStatus === "completed" ? (current.status === "available" ? "available" : "active") : updatedStatus;
        }
      }
    }

    const oldParentId = current.parentQuestId;
    const newParentId = updates.parentQuestId !== undefined ? updates.parentQuestId : current.parentQuestId;

    const updated: Quest = {
      ...current,
      parentQuestId: newParentId,
      title: updates.title !== undefined ? updates.title.trim() : current.title,
      description: updates.description !== undefined ? updates.description?.trim() ?? null : current.description,
      questType: updates.questType ?? current.questType,
      questSize: updates.questSize ?? current.questSize,
      status: finalStatus,
      difficulty: updates.difficulty !== undefined ? Math.max(0, Math.min(1, updates.difficulty)) : current.difficulty,
      goalAlignment: updates.goalAlignment !== undefined ? Math.max(0, Math.min(1, updates.goalAlignment)) : current.goalAlignment,
      progress: Math.max(0, Math.min(100, derivedProgress)),
      deadline: updates.deadline !== undefined ? updates.deadline : current.deadline,
      isMainQuest: updates.isMainQuest !== undefined ? Boolean(updates.isMainQuest) : current.isMainQuest,
      isBoss: updates.isBoss !== undefined ? Boolean(updates.isBoss) : current.isBoss,
      completedAt: finalStatus === "completed" ? (current.completedAt ?? now) : null,
      updatedAt: now,
    };
    db.quests[index] = updated;

    // Trigger parent roll-up on both old and new parent (Round26 P1-3)
    if (oldParentId && oldParentId !== newParentId) {
      this.rollUpParentProgress(db, oldParentId, now);
    }
    if (newParentId) {
      this.rollUpParentProgress(db, newParentId, now);
    }

    this.writeDb(db);
    return updated;
  }

  private rollUpParentProgress(db: Db, parentId: string | null, now: string): void {
    const visited = new Set<string>();
    let currentId: string | null = parentId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const parent = db.quests.find((q) => q.id === currentId);
      if (!parent) break;

      const children = db.quests.filter((q) => q.parentQuestId === currentId && q.status !== "archived");
      if (children.length > 0) {
        const totalProgress = children.reduce((sum, c) => sum + c.progress, 0);
        parent.progress = Math.round(totalProgress / children.length);
        const allCompleted = children.every((c) => c.status === "completed") && parent.progress === 100;
        if (allCompleted) {
          parent.status = "completed";
          parent.completedAt = parent.completedAt ?? now;
        } else if (parent.progress > 0 && parent.status === "available") {
          parent.status = "active";
        } else if (parent.status === "completed" && parent.progress < 100) {
          parent.status = "active";
          parent.completedAt = null;
        }
        parent.updatedAt = now;
      }
      currentId = parent.parentQuestId;
    }
  }

  async deleteQuest(id: string): Promise<void> {
    const db = this.readDb();
    const existing = db.quests.find((q) => q.id === id);
    const parentId = existing?.parentQuestId ?? null;

    // Set parentQuestId = null on all children (ON DELETE SET NULL)
    for (const child of db.quests) {
      if (child.parentQuestId === id) {
        child.parentQuestId = null;
      }
    }

    db.quests = (db.quests ?? []).filter((q) => q.id !== id);
    const now = new Date().toISOString();
    if (parentId) {
      this.rollUpParentProgress(db, parentId, now);
    }
    this.writeDb(db);
  }

  async addActivity(input: NewActivityInput): Promise<Activity> {
    const db = this.readDb();
    const now = new Date().toISOString();
    const boundQuest = input.questId ? db.quests.find((q) => q.id === input.questId) : null;
    const activity: Activity = {
      id: crypto.randomUUID(),
      questId: input.questId ?? null,
      questSizeSnapshot: boundQuest?.questSize ?? null,
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

    // Round6 (option B): a confirmed Activity carries a permanent original
    // settlement — no re-assessment until a correction pipeline exists, so no
    // forever-pending zombie revisions can be minted.
    if (activity.status === "confirmed") {
      throw new ActivityAlreadySettledError(activity.id);
    }

    const assessment: Assessment = {
      id: crypto.randomUUID(),
      activityId: input.activityId,
      status: "pending",
      proposal: input.proposal,
      modelName: input.modelName,
      promptVersion: input.promptVersion,
      // Round7: inherit the Activity's frozen rules_version (not the engine's
      // current one) so an old activity is never assessed under future rules.
      rulesVersion: activity.rulesVersion,
      confidence: input.proposal.confidence,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
    };

    db.assessments.unshift(assessment);
    activity.status = "assessed"; // confirmed activities throw above, so always pending→assessed
    this.writeDb(db);
    return assessment;
  }

  /** READ-ONLY stable-id lookup; never creates or writes anything. */
  async lookupSkillId(label: string): Promise<string | null> {
    const db = this.readDb();
    return findSkillByLabel(db.skills, label)?.id ?? null;
  }

  /**
   * Single atomic settlement write.
   *
   * Preflight (Round6): the ONLY place skills are resolved/created. All Skill
   * ids are random UUIDs (never derived from the name). Returns the authoritative
   * persisted transaction + mastery verification.
   *
   * Integrity guards:
   *   1. one `xpType=activity` settlement per Activity → `already_settled`;
   *   2. repetition snapshot derived from the committed view THIS atomic write;
   *      stale snapshot → `repetition_conflict` (+ fresh count);
   *   3. one pending MasteryVerification per skill (returns the persisted one);
   *   4. confirming one assessment supersedes sibling pending revisions.
   */
  async applySettlement(settlement: SettlementToApply): Promise<SettlementResult> {
    const db = this.readDb();
    const assessment = db.assessments.find((a) => a.id === settlement.assessmentId);
    if (!assessment) return { ok: false, reason: "not_found" };
    if (assessment.status !== "pending") return { ok: false, reason: "already_confirmed" };

    const activity = db.activities.find((a) => a.id === settlement.transaction.activityId);
    if (!activity) return { ok: false, reason: "activity_not_found" };

    // Guard 1: one original activity settlement per Activity.
    const alreadySettled = db.transactions.some(
      (t) => t.activityId === activity.id && t.xpType === "activity",
    );
    if (alreadySettled) return { ok: false, reason: "already_settled" };

    const now = settlement.transaction.createdAt;

    // Resolve-or-create the primary skill INSIDE the atomic unit (UUID identity).
    const primary = this.resolveOrCreateSkill(db, settlement.primarySkill.name);
    const skillId = primary.id;

    // Guard 2: authoritative repetition snapshot by stable skillId.
    const authoritativeCount = countRecentSimilar(db.transactions, {
      skillId,
      activityType: settlement.transaction.activityType,
      refTime: now,
      windowDays: SIMILARITY_WINDOW_DAYS,
    });
    if (authoritativeCount !== settlement.transaction.repetitionCount) {
      return { ok: false, reason: "repetition_conflict", actualRepetitionCount: authoritativeCount };
    }

    // 1) ledger (append-only) with the authoritative skill id.
    const storedTransaction: XpTransaction = {
      ...settlement.transaction,
      skillId,
      xpType: settlement.transaction.xpType ?? "activity",
    };
    db.transactions.unshift(storedTransaction);

    // 2) player total (delta) + derived provisional XP level.
    db.player.totalXp += settlement.player.xpDelta;
    db.player.playerLevel = levelFromXp(db.player.totalXp).level;

    // 3) primary skill (delta) + derived skill level + mastery action.
    primary.xp += settlement.primarySkill.xpDelta;
    primary.level = levelFromXp(primary.xp).level;
    primary.lastUsedAt = now;
    const masteryAction = settlement.primarySkill.masteryAction;
    if (masteryAction.action === "upgrade") {
      primary.masteryLevel = masteryAction.proposedLevel;
      primary.masteryConfidence = masteryAction.confidence;
    }

    // 4) secondary skills + related edges (by stable id), deduped.
    for (const label of settlement.relatedSkillLabels) {
      const related = this.resolveOrCreateSkill(db, label);
      this.addEdge(db, { sourceId: skillId, targetId: related.id, relation: "related" });
    }

    // 5) authoritative pending MasteryVerification (create or return existing).
    let verification: MasteryVerification | undefined;
    if (settlement.masteryVerification) {
      const existing = db.masteryVerifications.find(
        (v) => v.status === "pending" && v.skillId === skillId,
      );
      if (existing) {
        verification = existing;
      } else {
        const created: MasteryVerification = {
          ...settlement.masteryVerification,
          skillId,
        };
        db.masteryVerifications.unshift(created);
        verification = created;
      }
    }

    // 6) supersede sibling pending revisions of the same Activity (no zombies).
    for (const other of db.assessments) {
      if (
        other.activityId === activity.id &&
        other.id !== assessment.id &&
        other.status === "pending"
      ) {
        other.status = "superseded";
      }
    }

    // 7) mark assessment + activity settled.
    assessment.status = "confirmed";
    assessment.confirmedAt = now;
    activity.status = "confirmed";

    // 8) Milestone 4.2: Advance linked Quest progress (using shared deterministic delta)
    if (activity.questId) {
      const boundQuest = db.quests.find((q) => q.id === activity.questId);
      if (boundQuest && boundQuest.status !== "archived" && boundQuest.status !== "failed") {
        const progressAdvance = settlement.questProgressDelta ?? (
          activity.effectiveMinutes
            ? Math.min(100, Math.max(5, Math.round(activity.effectiveMinutes / 2)))
            : 20
        );
        boundQuest.progress = Math.min(100, boundQuest.progress + progressAdvance);
        if (boundQuest.progress >= 100) {
          boundQuest.status = "completed";
          boundQuest.completedAt = now;
        } else if (boundQuest.status === "available") {
          boundQuest.status = "active";
        }
        boundQuest.updatedAt = now;
        this.rollUpParentProgress(db, boundQuest.parentQuestId, now);
      }
    }

    this.writeDb(db);
    return {
      ok: true,
      skillId,
      transaction: storedTransaction,
      masteryVerification: verification ?? null,
    };
  }

  private resolveOrCreateSkill(db: Db, label: string): SkillState {
    const existing = findSkillByLabel(db.skills, label);
    if (existing) return existing;
    const id = crypto.randomUUID();
    const skill = defaultSkill(id, label.trim() || "unnamed");
    db.skills[id] = skill;
    return skill;
  }

  private addEdge(db: Db, edge: SkillEdge): void {
    const exists = db.skillEdges.some(
      (e) => e.sourceId === edge.sourceId && e.targetId === edge.targetId && e.relation === edge.relation,
    );
    if (!exists && edge.sourceId !== edge.targetId) db.skillEdges.push(edge);
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

/**
 * Tolerate pre-v4 demo files: re-key every skill to a stable UUID (deterministic
 * during migration only), and remap transactions / verifications / edges that
 * referenced skills by old name or slug.
 */
function normalizeDb(parsed: Db): Db {
  const out = emptyDb();
  out.player = { ...out.player, ...parsed.player };
  out.activities = (parsed.activities ?? []).map((a) => ({
    ...a,
    rulesVersion: a.rulesVersion ?? RULES_VERSION,
  }));
  out.assessments = parsed.assessments ?? [];
  out.quests = parsed.quests ?? [];

  // --- rebuild skills with stable UUIDs keyed by normalized label ---
  const legacySkills = (parsed.skills ?? {}) as Record<string, Omit<SkillState, "id"> & { id?: string }>;
  const idByLabel = new Map<string, string>();
  const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  for (const [key, s] of Object.entries(legacySkills)) {
    const name = s.name ?? key;
    const labels = Array.from(new Set([name, ...(s.aliases ?? []), key]));
    const storedId = s.id ?? undefined;

    let id: string;
    if (storedId && isUuid(storedId)) {
      // Already a stable random UUID (post-Preflight writes) → preserve it.
      id = storedId;
    } else {
      // Legacy (name-keyed / v2 slug ids) → reuse an existing mapping by any
      // label if present, else deterministic v5 (migration seed only).
      id = labels.map((l) => idByLabel.get(normalizeLabel(l))).find(Boolean) as string | undefined
        ?? deterministicSkillId(name);
    }

    // Bind every label of this skill to the single stable id (idempotent merge).
    for (const label of labels) {
      idByLabel.set(normalizeLabel(label), id);
    }

    const existing = out.skills[id];
    if (existing) {
      for (const label of labels) {
        if (!existing.aliases.includes(label) && existing.name !== label) existing.aliases.push(label);
      }
    } else {
      out.skills[id] = {
        id,
        name,
        aliases: Array.from(new Set([...(s.aliases ?? []), ...(name !== key && key ? [key] : [])])),
        xp: s.xp ?? 0,
        level: s.level ?? 1,
        masteryLevel: s.masteryLevel ?? 1,
        masteryConfidence: s.masteryConfidence ?? 0.5,
        lastUsedAt: s.lastUsedAt ?? null,
      };
    }
  }

  const resolveId = (oldId: string | undefined, displayName: string | undefined): string => {
    if (oldId) {
      const h = idByLabel.get(normalizeLabel(oldId)) ?? idByLabel.get(oldId);
      if (h) return h;
    }
    if (displayName) {
      const h = idByLabel.get(normalizeLabel(displayName));
      if (h) return h;
    }
    // Unknown reference (e.g. old slug id): deterministically re-seed a stub.
    const id = deterministicSkillId(displayName ?? oldId ?? "unlinked-skill");
    if (!out.skills[id]) out.skills[id] = defaultSkill(id, displayName ?? "Unlinked");
    idByLabel.set(normalizeLabel(displayName ?? id), id);
    return id;
  };

  out.transactions = (parsed.transactions ?? []).map((t) => {
    const skillId = resolveId(t.skillId, t.skillName);
    return {
      ...t,
      skillId,
      skillName: out.skills[skillId]?.name ?? t.skillName,
      xpType: t.xpType ?? "activity",
      rulesVersion: t.rulesVersion ?? RULES_VERSION,
    };
  });

  out.masteryVerifications = (parsed.masteryVerifications ?? []).map((v) => {
    const skillId = resolveId(v.skillId, v.skillName);
    return {
      ...v,
      skillId,
      skillName: out.skills[skillId]?.name ?? v.skillName,
    };
  });

  type LegacyEdge = SkillEdge & { source?: string; target?: string };
  for (const raw of (parsed.skillEdges ?? []) as LegacyEdge[]) {
    const sourceId = resolveId(raw.sourceId, raw.source);
    const targetId = resolveId(raw.targetId, raw.target);
    if (sourceId !== targetId) {
      const exists = out.skillEdges.some(
        (e) => e.sourceId === sourceId && e.targetId === targetId && e.relation === raw.relation,
      );
      if (!exists) out.skillEdges.push({ sourceId, targetId, relation: raw.relation });
    }
  }

  return out;
}
