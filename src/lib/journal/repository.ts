import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  JournalCreateInput,
  JournalEntry,
  JournalEntryType,
  JournalListFilters,
  JournalUpdateInput,
} from "./types";

type DbError = { message: string; code?: string | null; details?: string | null; hint?: string | null };
type JsonRecord = Record<string, unknown>;

export class JournalRepositoryError extends Error {
  readonly code: string | null;
  readonly details: string | null;
  readonly hint: string | null;

  constructor(error: DbError) {
    super(error.message);
    this.name = "JournalRepositoryError";
    this.code = error.code ?? null;
    this.details = error.details ?? null;
    this.hint = error.hint ?? null;
  }
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new JournalRepositoryError({ message: "INVALID_JOURNAL_PAYLOAD", code: "22023" });
  }
  return value as JsonRecord;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function asNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : asString(value);
}

function asNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function mapEntry(row: unknown): JournalEntry {
  const data = asRecord(row);
  return {
    id: asString(data.id),
    userId: asString(data.user_id),
    entryType: asString(data.entry_type) as JournalEntryType,
    title: asString(data.title),
    contentMarkdown: asString(data.content_markdown),
    energy: asNullableNumber(data.energy),
    focus: asNullableNumber(data.focus),
    stress: asNullableNumber(data.stress),
    resistance: asNullableNumber(data.resistance),
    recovery: asNullableNumber(data.recovery),
    moodValence: asNullableNumber(data.mood_valence),
    selfConfidence: asNullableNumber(data.self_confidence),
    seasonId: asNullableString(data.season_id),
    questId: asNullableString(data.quest_id),
    activityId: asNullableString(data.activity_id),
    isArchived: Boolean(data.is_archived),
    loggedAt: asString(data.logged_at),
    createdAt: asString(data.created_at),
    updatedAt: asString(data.updated_at),
  };
}

function throwIfError(error: DbError | null, fallback: string): void {
  if (!error) return;
  throw new JournalRepositoryError({ ...error, message: error.message || fallback });
}

function validateRequiredContext(entryType: JournalEntryType, questId: string | null, seasonId: string | null): void {
  if (entryType === "QUEST_REFLECTION" && !questId) {
    throw new JournalRepositoryError({ message: "MISSING_QUEST_CONTEXT", code: "22023" });
  }
  if (entryType === "SEASON_REFLECTION" && !seasonId) {
    throw new JournalRepositoryError({ message: "MISSING_SEASON_CONTEXT", code: "22023" });
  }
  if (entryType === "FAILURE_POSTMORTEM" && !questId && !seasonId) {
    throw new JournalRepositoryError({ message: "MISSING_FAILURE_CONTEXT", code: "22023" });
  }
}

export class JournalRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async listEntries(filters: JournalListFilters = {}): Promise<JournalEntry[]> {
    let query = this.db.from("journal_entries").select("*").order("logged_at", { ascending: false });
    if (filters.entryType) query = query.eq("entry_type", filters.entryType);
    if (filters.seasonId) query = query.eq("season_id", filters.seasonId);
    if (filters.questId) query = query.eq("quest_id", filters.questId);
    if (filters.isArchived !== undefined) query = query.eq("is_archived", filters.isArchived);
    const { data, error } = await query;
    throwIfError(error, "Failed to list journal entries");
    return (data ?? []).map(mapEntry);
  }

  async getEntry(id: string): Promise<JournalEntry | null> {
    const { data, error } = await this.db.from("journal_entries").select("*").eq("id", id).maybeSingle();
    throwIfError(error, "Failed to load journal entry");
    return data ? mapEntry(data) : null;
  }

  async createEntry(input: JournalCreateInput): Promise<JournalEntry> {
    validateRequiredContext(input.entryType, input.questId ?? null, input.seasonId ?? null);
    const payload: JsonRecord = {
      user_id: this.userId,
      entry_type: input.entryType,
      title: input.title,
      content_markdown: input.contentMarkdown,
      energy: input.energy ?? null,
      focus: input.focus ?? null,
      stress: input.stress ?? null,
      resistance: input.resistance ?? null,
      recovery: input.recovery ?? null,
      mood_valence: input.moodValence ?? null,
      self_confidence: input.selfConfidence ?? null,
      season_id: input.seasonId ?? null,
      quest_id: input.questId ?? null,
      activity_id: input.activityId ?? null,
    };
    if (input.id) payload.id = input.id;
    if (input.loggedAt) payload.logged_at = input.loggedAt;

    const { data, error } = await this.db.from("journal_entries").insert(payload).select("*").single();
    throwIfError(error, "Failed to create journal entry");
    return mapEntry(data);
  }

  async updateEntry(id: string, input: JournalUpdateInput): Promise<JournalEntry> {
    if (Object.keys(input).length === 0) {
      throw new JournalRepositoryError({ message: "NO_FIELDS_TO_UPDATE", code: "22023" });
    }

    if (input.entryType !== undefined || input.questId !== undefined || input.seasonId !== undefined) {
      const current = await this.getEntry(id);
      if (!current) {
        throw new JournalRepositoryError({ message: "JOURNAL_NOT_FOUND", code: "P0002" });
      }
      const resultingEntryType = input.entryType ?? current.entryType;
      const relevantContextChanged =
        input.entryType !== undefined ||
        (resultingEntryType === "QUEST_REFLECTION" && input.questId !== undefined) ||
        (resultingEntryType === "SEASON_REFLECTION" && input.seasonId !== undefined) ||
        (resultingEntryType === "FAILURE_POSTMORTEM" &&
          (input.questId !== undefined || input.seasonId !== undefined));

      if (relevantContextChanged) {
        validateRequiredContext(
          resultingEntryType,
          input.questId !== undefined ? input.questId : current.questId,
          input.seasonId !== undefined ? input.seasonId : current.seasonId,
        );
      }
    }

    const payload: JsonRecord = {};
    if (input.entryType !== undefined) payload.entry_type = input.entryType;
    if (input.title !== undefined) payload.title = input.title;
    if (input.contentMarkdown !== undefined) payload.content_markdown = input.contentMarkdown;
    if (input.energy !== undefined) payload.energy = input.energy;
    if (input.focus !== undefined) payload.focus = input.focus;
    if (input.stress !== undefined) payload.stress = input.stress;
    if (input.resistance !== undefined) payload.resistance = input.resistance;
    if (input.recovery !== undefined) payload.recovery = input.recovery;
    if (input.moodValence !== undefined) payload.mood_valence = input.moodValence;
    if (input.selfConfidence !== undefined) payload.self_confidence = input.selfConfidence;
    if (input.seasonId !== undefined) payload.season_id = input.seasonId;
    if (input.questId !== undefined) payload.quest_id = input.questId;
    if (input.activityId !== undefined) payload.activity_id = input.activityId;
    if (input.isArchived !== undefined) payload.is_archived = input.isArchived;
    if (input.loggedAt !== undefined) payload.logged_at = input.loggedAt;

    const { data, error } = await this.db
      .from("journal_entries")
      .update(payload)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    throwIfError(error, "Failed to update journal entry");
    if (!data) {
      throw new JournalRepositoryError({ message: "JOURNAL_NOT_FOUND", code: "P0002" });
    }
    return mapEntry(data);
  }
}
