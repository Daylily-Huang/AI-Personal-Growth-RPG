import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));

import { GET as listProposals } from "@/app/api/strategies/proposals/route";
import { GET as listSources } from "@/app/api/strategies/sources/route";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const userId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const observedAt = "2026-09-29T12:34:56.123456+00:00";
const tables: string[] = [];
const filters: Array<[string, unknown]> = [];
let rows: Record<string, unknown>[] = [];
let authenticated = true;

function fakeClient() {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((name: string, value: unknown) => { filters.push([name, value]); return query; }),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => ({ data: rows, error: null })),
  };
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: authenticated ? { id: userId } : null }, error: null })) },
    from: vi.fn((table: string) => { tables.push(table); return query; }),
  };
}

describe("Phase 8D Round 4 authenticated read-only discovery", () => {
  beforeEach(() => {
    tables.length = 0; filters.length = 0; rows = []; authenticated = true;
    vi.mocked(getSupabaseServerClient).mockResolvedValue(fakeClient() as never);
  });

  test("unauthenticated proposal/source reads fail before touching tables", async () => {
    authenticated = false;
    expect((await listProposals()).status).toBe(401);
    expect((await listSources(new Request("http://localhost/api/strategies/sources?sourceClass=ACTIVITY"))).status).toBe(401);
    expect(tables).toEqual([]);
  });

  test("proposals project pending Strategy types under authenticated tenant filter", async () => {
    rows = [{ id: sourceId, proposal_type: "STRATEGY_HYPOTHESIS", status: "PROPOSED",
      payload: { title: "可检验假设" }, source_refs: [], created_at: observedAt, expires_at: observedAt }];
    const result = await listProposals();
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ proposals: [{ id: sourceId, payload: { title: "可检验假设" } }] });
    expect(tables).toEqual(["outer_loop_proposals"]);
    expect(filters).toContainEqual(["user_id", userId]);
    expect(filters).toContainEqual(["status", "PROPOSED"]);
  });

  test.each([
    ["SEASON_REVIEW", "season_reviews"], ["ACTIVITY", "activities"],
    ["QUEST_OUTCOME", "quests"], ["ARTIFACT", "artifacts"],
    ["CORE_EVIDENCE_REFERENCE", "evidence_records"],
    ["JOURNAL_CONTEXT", "journal_entries"], ["MANUAL_OBSERVATION", "journal_entries"],
  ])("%s resolves only its canonical tenant-owned %s source", async (sourceClass, table) => {
    rows = [{ id: sourceId, title: "原始来源", created_at: observedAt, completed_at: null }];
    const result = await listSources(new Request(`http://localhost/api/strategies/sources?sourceClass=${sourceClass}&id=${sourceId}`));
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ sources: [{ id: sourceId, observedAt }] });
    expect(tables).toEqual([table]);
    expect(filters).toContainEqual(["user_id", userId]);
    expect(filters).toContainEqual(["id", sourceId]);
  });

  test("quest outcome uses completed_at and preserves microseconds", async () => {
    rows = [{ id: sourceId, title: "任务", created_at: "2026-09-01T00:00:00Z", completed_at: observedAt }];
    const result = await listSources(new Request("http://localhost/api/strategies/sources?sourceClass=QUEST_OUTCOME"));
    expect(await result.json()).toMatchObject({ sources: [{ observedAt }] });
  });

  test("exact Activity lookup returns full raw input for proposal review; recent list does not", async () => {
    rows = [{ id: sourceId, title: "活动", created_at: observedAt, raw_input: "原始活动事实全文" }];
    const exact = await listSources(new Request(`http://localhost/api/strategies/sources?sourceClass=ACTIVITY&id=${sourceId}`));
    expect(await exact.json()).toMatchObject({ sources: [{ details: "原始活动事实全文" }] });
    const recent = await listSources(new Request("http://localhost/api/strategies/sources?sourceClass=ACTIVITY"));
    expect(await recent.json()).toMatchObject({ sources: [{ details: null }] });
  });

  test("invalid source class and ID fail without table access", async () => {
    expect((await listSources(new Request("http://localhost/api/strategies/sources?sourceClass=UNKNOWN"))).status).toBe(400);
    expect((await listSources(new Request("http://localhost/api/strategies/sources?sourceClass=ACTIVITY&id=nope"))).status).toBe(400);
    expect(tables).toEqual([]);
  });
});
