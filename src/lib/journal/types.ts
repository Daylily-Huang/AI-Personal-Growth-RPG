export const JOURNAL_ENTRY_TYPES = [
  "FREE_REFLECTION",
  "QUEST_REFLECTION",
  "DAILY_SUMMARY",
  "WEEKLY_REFLECTION",
  "SEASON_REFLECTION",
  "STATE_LOG",
  "DECISION_NOTE",
  "FAILURE_POSTMORTEM",
  "INSIGHT",
] as const;

export type JournalEntryType = (typeof JOURNAL_ENTRY_TYPES)[number];

export interface JournalEntry {
  id: string;
  userId: string;
  entryType: JournalEntryType;
  title: string;
  contentMarkdown: string;
  energy: number | null;
  focus: number | null;
  stress: number | null;
  resistance: number | null;
  recovery: number | null;
  moodValence: number | null;
  selfConfidence: number | null;
  seasonId: string | null;
  questId: string | null;
  activityId: string | null;
  isArchived: boolean;
  loggedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalCreateInput {
  id?: string;
  entryType: JournalEntryType;
  title: string;
  contentMarkdown: string;
  energy?: number | null;
  focus?: number | null;
  stress?: number | null;
  resistance?: number | null;
  recovery?: number | null;
  moodValence?: number | null;
  selfConfidence?: number | null;
  seasonId?: string | null;
  questId?: string | null;
  activityId?: string | null;
  loggedAt?: string;
}

export interface JournalUpdateInput {
  entryType?: JournalEntryType;
  title?: string;
  contentMarkdown?: string;
  energy?: number | null;
  focus?: number | null;
  stress?: number | null;
  resistance?: number | null;
  recovery?: number | null;
  moodValence?: number | null;
  selfConfidence?: number | null;
  seasonId?: string | null;
  questId?: string | null;
  activityId?: string | null;
  isArchived?: boolean;
  loggedAt?: string;
}

export interface JournalListFilters {
  entryType?: JournalEntryType;
  seasonId?: string;
  questId?: string;
  isArchived?: boolean;
}
