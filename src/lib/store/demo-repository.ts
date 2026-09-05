import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { RULES_VERSION } from "@/lib/growth-engine/xp";
import { levelFromXp } from "@/lib/growth-engine/levels";
import { assembleSkillDetail } from "@/lib/skills/derived-state";
import { countRecentSimilar } from "./similarity";
import type {
  Activity,
  Assessment,
  Db,
  Domain,
  EvidenceRecord,
  MasteryEvent,
  MasteryVerification,
  NewActivityInput,
  NewAssessmentInput,
  NewQuestInput,
  NewSkillEdgeInput,
  PlayerState,
  Quest,
  QuestStatus,
  SettlementToApply,
  SkillDetailResponse,
  SkillEdge,
  SkillState,
  UpdateQuestInput,
  UpdateSkillMetadataInput,
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
    domains: [
      {
        id: "d1111111-1111-4000-a000-000000000001",
        name: "Computer Science",
        slug: "computer-science",
        parentId: null,
        sortOrder: 0,
      },
      {
        id: "d2222222-2222-4000-a000-000000000002",
        name: "Mathematics",
        slug: "mathematics",
        parentId: null,
        sortOrder: 1,
      },
    ],
    activities: [],
    assessments: [],
    transactions: [],
    skills: {},
    skillEdges: [],
    evidenceRecords: [],
    masteryEvents: [],
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

function defaultSkill(id: string, name: string, createdAt = "1970-01-01T00:00:00.000Z"): SkillState {
  return {
    id,
    name,
    aliases: [],
    description: null,
    domainId: null,
    status: "active",
    xp: 0,
    level: 1,
    masteryLevel: 1,
    masteryConfidence: 0.5,
    lastUsedAt: null,
    createdAt,
    updatedAt: createdAt,
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

  writeDb(db: Db): void {
    const file = dbPath();
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

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

  async countRecentSimilarTransactions(params: {
    skillId: string;
    activityType: string;
    windowDays: number;
  }): Promise<number> {
    const transactions = await this.listTransactions();
    return countRecentSimilar(transactions, params);
  }

  async getSkill(label: string): Promise<SkillState | null> {
    const db = this.readDb();
    return findSkillByLabel(db.skills, label) ?? null;
  }

  async getSkillById(id: string): Promise<SkillState | null> {
    const db = this.readDb();
    return db.skills[id] ?? null;
  }

  async listDomains(): Promise<Domain[]> {
    return this.readDb().domains ?? [];
  }

  async listMasteryEvents(skillId?: string): Promise<MasteryEvent[]> {
    const list = this.readDb().masteryEvents ?? [];
    if (skillId) {
      return list.filter((me) => me.skillId === skillId);
    }
    return list;
  }

  async getSkillDetails(id: string): Promise<SkillDetailResponse | null> {
    const db = this.readDb();
    const skill = db.skills[id];
    if (!skill) return null;

    const domainName = skill.domainId
      ? (db.domains ?? []).find((d) => d.id === skill.domainId)?.name ?? null
      : null;

    const activityTitlesMap = new Map<string, string>();
    for (const act of db.activities ?? []) {
      activityTitlesMap.set(act.id, act.title);
    }

    return assembleSkillDetail({
      skill,
      domainName,
      allSkills: Object.values(db.skills),
      allEdges: db.skillEdges ?? [],
      evidenceRecords: db.evidenceRecords ?? [],
      masteryEvents: db.masteryEvents ?? [],
      transactions: db.transactions ?? [],
      activityTitlesMap,
    });
  }

  async listSkills(): Promise<SkillState[]> {
    return Object.values(this.readDb().skills);
  }

  async listSkillEdges(): Promise<SkillEdge[]> {
    return this.readDb().skillEdges;
  }

  async listEvidenceRecords(skillId?: string): Promise<EvidenceRecord[]> {
    const records = this.readDb().evidenceRecords ?? [];
    if (skillId) {
      return records.filter((r) => r.skillId === skillId);
    }
    return records;
  }

  async getPlayer(): Promise<PlayerState> {
    return this.readDb().player;
  }

  async listMasteryVerifications(): Promise<MasteryVerification[]> {
    return this.readDb().masteryVerifications;
  }

  // ---- skills & edges (Stage 5A) ----

  async addEdge(input: NewSkillEdgeInput): Promise<SkillEdge> {
    const db = this.readDb();
    const sourceId = input.sourceSkillId;
    const targetId = input.targetSkillId;
    const relation = input.relationType;

    // 1. Anti-self edge
    if (sourceId === targetId) {
      throw new Error("Self-edges are forbidden: sourceSkillId cannot equal targetSkillId");
    }

    // 2. Both nodes exist
    if (!db.skills[sourceId] || !db.skills[targetId]) {
      throw new Error("Referenced skill not found");
    }

    // 3. Unique relation
    const duplicate = db.skillEdges.some(
      (e) => e.sourceId === sourceId && e.targetId === targetId && e.relation === relation,
    );
    if (duplicate) {
      throw new Error("Duplicate edge: relationship already exists");
    }

    // 4. Single-parent contains invariant (Partial Unique Index)
    if (relation === "contains") {
      const existingParent = db.skillEdges.some((e) => e.targetId === targetId && e.relation === "contains");
      if (existingParent) {
        throw new Error("Single-parent violation: Target skill already has a contains parent");
      }
    }

    // 5. Anti-cycle DAG check for prerequisite and contains
    if (relation === "prerequisite" || relation === "contains") {
      const visited = new Set<string>();
      const queue = [targetId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr === sourceId) {
          throw new Error(`Cycle detected: Cannot create ${relation} edge that introduces a directed cycle`);
        }
        if (!visited.has(curr)) {
          visited.add(curr);
          const nextTargets = db.skillEdges
            .filter((e) => e.sourceId === curr && e.relation === relation)
            .map((e) => e.targetId);
          queue.push(...nextTargets);
        }
      }
    }

    const edge: SkillEdge = {
      id: crypto.randomUUID(),
      sourceId,
      targetId,
      relation,
      createdAt: new Date().toISOString(),
    };

    db.skillEdges.push(edge);
    this.writeDb(db);
    return edge;
  }

  async deleteEdge(id: string): Promise<boolean> {
    const db = this.readDb();
    const idx = db.skillEdges.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    db.skillEdges.splice(idx, 1);
    this.writeDb(db);
    return true;
  }

  async updateSkillMetadata(id: string, updates: UpdateSkillMetadataInput): Promise<SkillState> {
    const db = this.readDb();
    const skill = db.skills[id];
    if (!skill) {
      throw new Error("Skill not found or access denied");
    }

    const oldName = skill.name;
    const newAliases = updates.aliases ? Array.from(new Set(updates.aliases)) : [...skill.aliases];

    if (updates.name && updates.name.trim() !== "" && updates.name.trim() !== oldName) {
      if (!newAliases.includes(oldName)) {
        newAliases.push(oldName);
      }
      const newNorm = normalizeLabel(updates.name);
      const conflict = Object.values(db.skills).find(
        (s) => s.id !== id && normalizeLabel(s.name) === newNorm,
      );
      if (conflict) {
        throw new Error(`A skill with normalized name "${newNorm}" already exists for this user`);
      }
      skill.name = updates.name.trim();
    }

    skill.aliases = newAliases;
    if (updates.description !== undefined) skill.description = updates.description;
    if (updates.domainId !== undefined) {
      if (updates.domainId !== null) {
        const domainExists = (db.domains ?? []).some((d) => d.id === updates.domainId);
        if (!domainExists) {
          throw new Error("Referenced domain does not exist or access denied");
        }
      }
      skill.domainId = updates.domainId;
    }
    if (updates.status !== undefined) skill.status = updates.status;

    this.writeDb(db);
    return skill;
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

  async addQuest(input: NewQuestInput): Promise<Quest> {
    const db = this.readDb();
    const now = new Date().toISOString();
    const isMainQuest = Boolean(input.isMainQuest);
    const initialStatus = input.status ?? "available";

    if (isMainQuest && !["completed", "failed", "archived"].includes(initialStatus)) {
      const hasActiveMain = (db.quests ?? []).some((q) => q.isMainQuest && !["completed", "failed", "archived"].includes(q.status));
      if (hasActiveMain) {
        throw new Error("UNIQUE_ACTIVE_MAIN_QUEST: User already has an active main quest");
      }
    }

    const quest: Quest = {
      id: crypto.randomUUID(),
      parentQuestId: input.parentQuestId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      questType: input.questType,
      questSize: input.questSize ?? "standard",
      status: initialStatus,
      difficulty: input.difficulty ?? 0.5,
      goalAlignment: input.goalAlignment ?? 0.5,
      progress: input.progress ?? 0,
      deadline: input.deadline ?? null,
      isMainQuest,
      isBoss: Boolean(input.isBoss),
      completedAt: initialStatus === "completed" ? now : null,
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

    const isMainQuest = updates.isMainQuest !== undefined ? Boolean(updates.isMainQuest) : current.isMainQuest;
    const updatedStatus = updates.status ?? current.status;

    if (isMainQuest && !["completed", "failed", "archived"].includes(updatedStatus)) {
      const hasActiveMain = db.quests.some((q) => q.id !== id && q.isMainQuest && !["completed", "failed", "archived"].includes(q.status));
      if (hasActiveMain) {
        throw new Error("UNIQUE_ACTIVE_MAIN_QUEST: User already has an active main quest");
      }
    }

    // Anti-cycle check: parent cannot be self or descendant
    if (updates.parentQuestId !== undefined && updates.parentQuestId !== null) {
      if (updates.parentQuestId === id) {
        throw new Error("Self-parenting is forbidden: quest cannot be its own parent");
      }
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

    let derivedProgress = updates.progress !== undefined ? updates.progress : current.progress;
    let finalStatus = updatedStatus;
    if (hasChildren) {
      const children = db.quests.filter((q) => q.parentQuestId === id && q.status !== "archived");
      if (children.length > 0) {
        derivedProgress = Math.round(children.reduce((s, c) => s + c.progress, 0) / children.length);
        const allCompleted = children.every((c) => c.status === "completed") && derivedProgress === 100;
        
        if (current.status === "failed" || current.status === "archived") {
           finalStatus = current.status;
        } else if (allCompleted) {
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
      isMainQuest,
      isBoss: updates.isBoss !== undefined ? Boolean(updates.isBoss) : current.isBoss,
      completedAt: finalStatus === "completed" ? (current.completedAt ?? now) : null,
      updatedAt: now,
    };
    db.quests[index] = updated;

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
        
        if (parent.status !== "failed" && parent.status !== "archived") {
          if (allCompleted) {
            parent.status = "completed";
            parent.completedAt = parent.completedAt ?? now;
          } else if (parent.progress > 0 && parent.status === "available") {
            parent.status = "active";
          } else if (parent.status === "completed" && parent.progress < 100) {
            parent.status = "active";
            parent.completedAt = null;
          }
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
      questIdSnapshot: boundQuest?.id ?? null,
      questTitleSnapshot: boundQuest?.title ?? null,
      rawInput: input.rawInput.trim(),
      title: input.rawInput.trim().slice(0, 80) || "未命名 Activity",
      activityType: null,
      status: "pending_assessment",
      totalMinutes: input.totalMinutes ?? null,
      effectiveMinutes: input.effectiveMinutes ?? null,
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
      rulesVersion: activity.rulesVersion ?? RULES_VERSION,
      confidence: input.proposal.confidence,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
    };
    db.assessments.unshift(assessment);
    this.writeDb(db);
    return assessment;
  }

  async lookupSkillId(label: string): Promise<string | null> {
    const db = this.readDb();
    return findSkillByLabel(db.skills, label)?.id ?? null;
  }

  async applySettlement(settlement: SettlementToApply): Promise<SettlementResult> {
    const db = this.readDb();

    // Guard 1a: assessment must exist and still be pending.
    const assessment = db.assessments.find((a) => a.id === settlement.assessmentId);
    if (!assessment) return { ok: false, reason: "not_found" };
    if (assessment.status !== "pending") return { ok: false, reason: "already_confirmed" };

    // Guard 1b: activity must exist and not yet be confirmed.
    const activity = db.activities.find((a) => a.id === assessment.activityId);
    if (!activity) return { ok: false, reason: "activity_not_found" };
    if (activity.status === "confirmed") return { ok: false, reason: "already_settled" };

    // Guard 1c: activity must not have an existing activity-settlement transaction.
    const alreadySettled = db.transactions.some(
      (t) => t.activityId === activity.id && (t.xpType ?? "activity") === "activity",
    );
    if (alreadySettled) return { ok: false, reason: "already_settled" };

    const now = new Date().toISOString();

    // Stage 5A Skill Resolution Authority (Strict Discriminated Union - NO BYPASS)
    let primary: SkillState;
    const skillRes = settlement.primarySkill.skill;
    if (!skillRes || (skillRes.resolution !== "existing" && skillRes.resolution !== "create")) {
      return { ok: false, reason: "missing_or_invalid_skill_resolution" };
    }

    if (skillRes.resolution === "existing") {
      const existing = db.skills[skillRes.skillId];
      if (!existing) {
        return { ok: false, reason: "skill_not_found_or_not_owned" };
      }
      primary = existing;
    } else {
      if (!skillRes.proposedName || skillRes.proposedName.trim() === "") {
        return { ok: false, reason: "empty_proposed_skill_name" };
      }
      primary = this.resolveOrCreateSkill(db, skillRes.proposedName, now);
    }
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

    // Validate and resolve secondary skills if present
    if (settlement.relatedSkillResolutions) {
      for (const res of settlement.relatedSkillResolutions) {
        if (res.resolution === "create") {
          if (!res.proposedName || res.proposedName.trim() === "") {
            return { ok: false, reason: "empty_related_skill_proposed_name" };
          }
          this.resolveOrCreateSkill(db, res.proposedName, now);
        } else if (res.resolution === "existing") {
          if (!db.skills[res.skillId]) {
            return { ok: false, reason: "related_skill_not_found_or_not_owned" };
          }
        } else {
          return { ok: false, reason: "invalid_related_skill_resolution" };
        }
      }
    }

    // 1) ledger (append-only) with the authoritative skill id.
    const storedTransaction: XpTransaction = {
      ...settlement.transaction,
      skillId,
      xpType: settlement.transaction.xpType ?? "activity",
    };
    db.transactions.unshift(storedTransaction);

    // 2) Authoritative Evidence Record persistence (Stage 5A)
    const evidenceRecord: EvidenceRecord = {
      id: settlement.evidence?.id ?? crypto.randomUUID(),
      userId: "u-demo",
      activityId: activity.id,
      skillId,
      evidenceLevel: settlement.evidence?.level ?? settlement.masteryVerification?.evidenceLevel ?? 0,
      evidenceType: settlement.evidence?.type ?? activity.activityType ?? "activity_output",
      description: settlement.evidence?.explanation ?? settlement.transaction.reason ?? "",
      verified: settlement.primarySkill.masteryAction.action !== "request_verification",
      createdAt: now,
    };
    db.evidenceRecords = db.evidenceRecords ?? [];
    db.evidenceRecords.unshift(evidenceRecord);

    // 3) player total (delta) + derived provisional XP level.
    db.player.totalXp += settlement.player.xpDelta;
    db.player.playerLevel = levelFromXp(db.player.totalXp).level;

    // 4) primary skill (delta) + derived skill level + mastery action.
    primary.xp += settlement.primarySkill.xpDelta;
    primary.level = levelFromXp(primary.xp).level;
    primary.lastUsedAt = now;
    const masteryAction = settlement.primarySkill.masteryAction;
    if (masteryAction.action === "upgrade") {
      const fromLevel = primary.masteryLevel;
      primary.masteryLevel = masteryAction.proposedLevel;
      primary.masteryConfidence = masteryAction.confidence;

      db.masteryEvents = db.masteryEvents ?? [];
      db.masteryEvents.unshift({
        id: crypto.randomUUID(),
        userId: "u-demo",
        skillId,
        activityId: activity.id,
        evidenceId: evidenceRecord.id,
        fromLevel,
        toLevel: masteryAction.proposedLevel,
        confidence: masteryAction.confidence,
        eventType: "upgrade",
        reason: "settle_activity",
        createdAt: now,
      });
    }

    // 6) authoritative pending MasteryVerification (create or return existing).
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

    // 7) supersede sibling pending revisions of the same Activity.
    for (const other of db.assessments) {
      if (
        other.activityId === activity.id &&
        other.id !== assessment.id &&
        other.status === "pending"
      ) {
        other.status = "superseded";
      }
    }

    // 8) mark assessment + activity settled.
    assessment.status = "confirmed";
    assessment.confirmedAt = now;
    activity.status = "confirmed";

    // 9) Advance linked Quest progress
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

  private resolveOrCreateSkill(db: Db, label: string, now = "1970-01-01T00:00:00.000Z"): SkillState {
    const existing = findSkillByLabel(db.skills, label);
    if (existing) return existing;
    const id = crypto.randomUUID();
    const skill = defaultSkill(id, label.trim() || "unnamed", now);
    db.skills[id] = skill;
    return skill;
  }

  private addEdgeInternal(db: Db, edge: Omit<SkillEdge, "id">): void {
    const exists = db.skillEdges.some(
      (e) => e.sourceId === edge.sourceId && e.targetId === edge.targetId && e.relation === edge.relation,
    );
    if (!exists && edge.sourceId !== edge.targetId) {
      db.skillEdges.push({
        id: crypto.randomUUID(),
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        relation: edge.relation,
        createdAt: new Date().toISOString(),
      });
    }
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
  out.evidenceRecords = parsed.evidenceRecords ?? [];
  out.masteryEvents = parsed.masteryEvents ?? [];
  out.domains = parsed.domains ?? emptyDb().domains;

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
      id = storedId;
    } else {
      id = labels.map((l) => idByLabel.get(normalizeLabel(l))).find(Boolean) as string | undefined
        ?? deterministicSkillId(name);
    }

    for (const label of labels) {
      idByLabel.set(normalizeLabel(label), id);
    }

    const isUuidKey = isUuid(key);
    const extraAlias = (name !== key && key && !isUuidKey) ? [key] : [];

    const existing = out.skills[id];
    if (existing) {
      for (const label of labels) {
        if (!isUuid(label) && !existing.aliases.includes(label) && existing.name !== label) {
          existing.aliases.push(label);
        }
      }
    } else {
      out.skills[id] = {
        id,
        name,
        aliases: Array.from(new Set([...(s.aliases ?? []), ...extraAlias])),
        description: s.description ?? null,
        domainId: s.domainId ?? null,
        status: s.status ?? "active",
        xp: s.xp ?? 0,
        level: s.level ?? 1,
        masteryLevel: s.masteryLevel ?? 1,
        masteryConfidence: s.masteryConfidence ?? 0.5,
        lastUsedAt: s.lastUsedAt ?? null,
        createdAt: s.createdAt ?? "1970-01-01T00:00:00.000Z",
        updatedAt: s.updatedAt ?? s.createdAt ?? "1970-01-01T00:00:00.000Z",
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
      if (!exists) {
        const relationType = (raw.relation === "prerequisite" || raw.relation === "contains" || raw.relation === "supports")
          ? raw.relation
          : "supports";
        out.skillEdges.push({
          id: raw.id ?? crypto.randomUUID(),
          sourceId,
          targetId,
          relation: relationType,
          createdAt: raw.createdAt ?? new Date().toISOString(),
        });
      }
    }
  }

  return out;
}
