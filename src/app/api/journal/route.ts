import { NextResponse } from "next/server";
import {
  journalErrorResponse,
  optionalInteger,
  optionalUuid,
  readJsonObject,
  requireEntryType,
  requireString,
  requireUuid,
} from "@/lib/journal/http";
import { getJournalRepository } from "@/lib/journal/request";
import type { JournalListFilters } from "@/lib/journal/types";

export async function GET(request: Request) {
  try {
    const repo = await getJournalRepository();
    const url = new URL(request.url);
    const filters: JournalListFilters = {};
    const entryType = url.searchParams.get("entryType");
    const seasonId = url.searchParams.get("seasonId");
    const questId = url.searchParams.get("questId");
    const archived = url.searchParams.get("archived");
    if (entryType !== null) filters.entryType = requireEntryType(entryType);
    if (seasonId !== null) filters.seasonId = requireUuid(seasonId, "seasonId");
    if (questId !== null) filters.questId = requireUuid(questId, "questId");
    if (archived !== null) {
      if (archived !== "true" && archived !== "false") throw new Error("INVALID_ARCHIVED_FILTER");
      filters.isArchived = archived === "true";
    }
    const entries = await repo.listEntries(filters);
    return NextResponse.json({ entries, count: entries.length }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_ARCHIVED_FILTER") {
      return NextResponse.json({ error: "archived must be true or false", code: "INVALID_INPUT" }, { status: 400 });
    }
    return journalErrorResponse(error, "Failed to list journal entries");
  }
}

export async function POST(request: Request) {
  try {
    const repo = await getJournalRepository();
    const body = await readJsonObject(request);
    const entry = await repo.createEntry({
      id: body.id === undefined ? undefined : requireUuid(body.id, "id"),
      entryType: requireEntryType(body.entryType),
      title: requireString(body.title, "title"),
      contentMarkdown: requireString(body.contentMarkdown, "contentMarkdown"),
      energy: optionalInteger(body.energy, "energy", 1, 5),
      focus: optionalInteger(body.focus, "focus", 1, 5),
      stress: optionalInteger(body.stress, "stress", 1, 5),
      resistance: optionalInteger(body.resistance, "resistance", 1, 5),
      recovery: optionalInteger(body.recovery, "recovery", 1, 5),
      moodValence: optionalInteger(body.moodValence, "moodValence", -2, 2),
      selfConfidence: optionalInteger(body.selfConfidence, "selfConfidence", 1, 5),
      seasonId: optionalUuid(body.seasonId, "seasonId"),
      questId: optionalUuid(body.questId, "questId"),
      activityId: optionalUuid(body.activityId, "activityId"),
      loggedAt: body.loggedAt === undefined ? undefined : requireString(body.loggedAt, "loggedAt"),
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    return journalErrorResponse(error, "Failed to create journal entry");
  }
}
