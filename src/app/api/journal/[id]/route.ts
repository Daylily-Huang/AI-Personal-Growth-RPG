import { NextResponse } from "next/server";
import { journalErrorResponse, parseUpdate, readJsonObject, requireUuid } from "@/lib/journal/http";
import { getJournalRepository } from "@/lib/journal/request";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const repo = await getJournalRepository();
    const { id: rawId } = await context.params;
    const id = requireUuid(rawId, "journalId");
    const entry = await repo.getEntry(id);
    if (!entry) return NextResponse.json({ error: "Journal entry not found", code: "JOURNAL_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ entry }, { status: 200 });
  } catch (error) {
    return journalErrorResponse(error, "Failed to load journal entry");
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const repo = await getJournalRepository();
    const { id: rawId } = await context.params;
    const id = requireUuid(rawId, "journalId");
    const entry = await repo.updateEntry(id, parseUpdate(await readJsonObject(request)));
    return NextResponse.json({ entry }, { status: 200 });
  } catch (error) {
    return journalErrorResponse(error, "Failed to update journal entry");
  }
}
