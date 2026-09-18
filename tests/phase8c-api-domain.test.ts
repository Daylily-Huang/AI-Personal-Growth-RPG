import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/journal/request", () => ({ getJournalRepository: vi.fn() }));

import { GET as listJournal, POST as createJournal } from "@/app/api/journal/route";
import * as journalItemRoute from "@/app/api/journal/[id]/route";
import { getJournalRepository } from "@/lib/journal/request";
import { JournalRepository, JournalRepositoryError } from "@/lib/journal/repository";
import type { JournalEntry } from "@/lib/journal/types";
import { AuthRequiredError } from "@/lib/store/request-repository";

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function journalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  const now = new Date().toISOString();
  return {
    id: randomUUID(), userId: randomUUID(), entryType: "FREE_REFLECTION", title: "Reflection",
    contentMarkdown: "Body", energy: null, focus: null, stress: null, resistance: null,
    recovery: null, moodValence: null, selfConfidence: null, seasonId: null, questId: null,
    activityId: null, isArchived: false, loggedAt: now, createdAt: now, updatedAt: now, ...overrides,
  };
}

function rowFor(entry: JournalEntry) {
  return {
    id: entry.id, user_id: entry.userId, entry_type: entry.entryType, title: entry.title,
    content_markdown: entry.contentMarkdown, energy: entry.energy, focus: entry.focus,
    stress: entry.stress, resistance: entry.resistance, recovery: entry.recovery,
    mood_valence: entry.moodValence, self_confidence: entry.selfConfidence,
    season_id: entry.seasonId, quest_id: entry.questId, activity_id: entry.activityId,
    is_archived: entry.isArchived, logged_at: entry.loggedAt, created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

function updateClient(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { client: { from } as never, update };
}

describe("Phase 8C Round 2 — Journal API/domain contract", () => {
  beforeEach(() => vi.resetAllMocks());

  test("POST authenticates before malformed JSON parsing", async () => {
    vi.mocked(getJournalRepository).mockRejectedValue(new AuthRequiredError());
    const response = await createJournal(new Request("http://localhost/api/journal", { method: "POST", body: "{ invalid" }));
    expect(response.status).toBe(401);
  });

  test("POST derives tenant from session repository and preserves client UUID", async () => {
    const id = randomUUID();
    const questId = randomUUID();
    const createEntry = vi.fn().mockResolvedValue(journalEntry({ id, entryType: "QUEST_REFLECTION", questId }));
    vi.mocked(getJournalRepository).mockResolvedValue({ createEntry } as never);
    const response = await createJournal(jsonRequest("http://localhost/api/journal", "POST", {
      id, userId: randomUUID(), entryType: "QUEST_REFLECTION", title: "Quest reflection",
      contentMarkdown: "Learned something", questId, energy: 3,
    }));
    expect(response.status).toBe(201);
    expect(createEntry).toHaveBeenCalledWith(expect.objectContaining({ id, questId, energy: 3 }));
    expect(createEntry.mock.calls[0]?.[0]).not.toHaveProperty("userId");
  });

  test.each([
    ["QUEST_REFLECTION", "MISSING_QUEST_CONTEXT"],
    ["SEASON_REFLECTION", "MISSING_SEASON_CONTEXT"],
    ["FAILURE_POSTMORTEM", "MISSING_FAILURE_CONTEXT"],
  ] as const)("create rejects %s without required authoring context", async (entryType, code) => {
    const from = vi.fn();
    const repo = new JournalRepository({ from } as never, randomUUID());
    await expect(repo.createEntry({ entryType, title: "x", contentMarkdown: "y" })).rejects.toMatchObject({ message: code, code: "22023" });
    expect(from).not.toHaveBeenCalled();
  });

  test("explicit required-context removal fails closed", async () => {
    const repo = new JournalRepository({ from: vi.fn() } as never, randomUUID());
    const current = journalEntry({ entryType: "QUEST_REFLECTION", questId: randomUUID() });
    vi.spyOn(repo, "getEntry").mockResolvedValue(current);
    await expect(repo.updateEntry(current.id, { questId: null })).rejects.toMatchObject({ message: "MISSING_QUEST_CONTEXT" });
  });

  test("ordinary content/archive edit remains valid after parent SET NULL history", async () => {
    const historical = journalEntry({ entryType: "QUEST_REFLECTION", questId: null, contentMarkdown: "edited", isArchived: true });
    const db = updateClient(rowFor(historical));
    const repo = new JournalRepository(db.client, historical.userId);
    const getEntry = vi.spyOn(repo, "getEntry");
    const result = await repo.updateEntry(historical.id, { contentMarkdown: "edited", isArchived: true });
    expect(result.questId).toBeNull();
    expect(result.isArchived).toBe(true);
    expect(getEntry).not.toHaveBeenCalled();
    expect(db.update).toHaveBeenCalledWith({ content_markdown: "edited", is_archived: true });
  });

  test("historical row does not revalidate missing required context for an unrelated contextual-FK edit", async () => {
    const seasonId = randomUUID();
    const historical = journalEntry({ entryType: "QUEST_REFLECTION", questId: null, seasonId });
    const db = updateClient(rowFor(historical));
    const repo = new JournalRepository(db.client, historical.userId);
    vi.spyOn(repo, "getEntry").mockResolvedValue(journalEntry({
      id: historical.id,
      userId: historical.userId,
      entryType: "QUEST_REFLECTION",
      questId: null,
      seasonId: null,
    }));

    await expect(repo.updateEntry(historical.id, { seasonId })).resolves.toMatchObject({ seasonId, questId: null });
    expect(db.update).toHaveBeenCalledWith({ season_id: seasonId });
  });

  test("O018 cross-tenant contextual authority rejection maps to 403", async () => {
    vi.mocked(getJournalRepository).mockResolvedValue({
      createEntry: vi.fn().mockRejectedValue(new JournalRepositoryError({ message: "Journal/Quest tenant mismatch", code: "23514" })),
    } as never);
    const response = await createJournal(jsonRequest("http://localhost/api/journal", "POST", {
      entryType: "QUEST_REFLECTION", title: "x", contentMarkdown: "y", questId: randomUUID(),
    }));
    expect(response.status).toBe(403);
  });

  test("duplicate client UUID maps deterministically to 409", async () => {
    vi.mocked(getJournalRepository).mockResolvedValue({
      createEntry: vi.fn().mockRejectedValue(new JournalRepositoryError({ message: "duplicate key", code: "23505" })),
    } as never);
    const response = await createJournal(jsonRequest("http://localhost/api/journal", "POST", {
      id: randomUUID(), entryType: "FREE_REFLECTION", title: "x", contentMarkdown: "y",
    }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "JOURNAL_ID_CONFLICT" });
  });

  test("invalid loggedAt database input maps to 400 instead of an internal error", async () => {
    vi.mocked(getJournalRepository).mockResolvedValue({
      createEntry: vi.fn().mockRejectedValue(new JournalRepositoryError({ message: "invalid input syntax for type timestamp with time zone", code: "22007" })),
    } as never);
    const response = await createJournal(jsonRequest("http://localhost/api/journal", "POST", {
      entryType: "FREE_REFLECTION", title: "x", contentMarkdown: "y", loggedAt: "not-a-timestamp",
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_INPUT" });
  });

  test("list validates archive filter before repository query", async () => {
    const listEntries = vi.fn();
    vi.mocked(getJournalRepository).mockResolvedValue({ listEntries } as never);
    const response = await listJournal(new Request("http://localhost/api/journal?archived=maybe"));
    expect(response.status).toBe(400);
    expect(listEntries).not.toHaveBeenCalled();
  });

  test("normal deletion contract has no hard-delete route", () => {
    expect("DELETE" in journalItemRoute).toBe(false);
  });

  test("Journal surface adds no JOURNAL_INSIGHT or RPC authority", async () => {
    const files = [
      join(process.cwd(), "src/lib/journal/repository.ts"),
      join(process.cwd(), "src/lib/journal/request.ts"),
      join(process.cwd(), "src/app/api/journal/route.ts"),
      join(process.cwd(), "src/app/api/journal/[id]/route.ts"),
    ];
    const source = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
    expect(source).not.toContain("JOURNAL_INSIGHT");
    expect(source).not.toMatch(/\.rpc\s*\(/);
  });
});
