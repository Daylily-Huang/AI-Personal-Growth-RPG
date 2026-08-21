import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { GET as getQuests, POST as postQuest } from "@/app/api/quests/route";
import { GET as getSingleQuest, PATCH as patchQuest, DELETE as deleteQuest } from "@/app/api/quests/[id]/route";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

import { getSupabaseServerClient } from "@/lib/supabase/server";

describe("Stage 4 — Quest API Routes", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");

    // Default: unauthenticated
    (getSupabaseServerClient as unknown as Mock).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("1. Unauthenticated GET /api/quests returns 401", async () => {
    const req = new Request("http://localhost:3000/api/quests");
    const res = await getQuests(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("authenticated Supabase session is required");
  });

  test("2. Unauthenticated POST /api/quests returns 401", async () => {
    const req = new Request("http://localhost:3000/api/quests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", questType: "learning" }),
    });
    const res = await postQuest(req);
    expect(res.status).toBe(401);
  });

  test("3. Authenticated POST with invalid payload returns 400", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-123" } }, error: null }),
      },
    };
    (getSupabaseServerClient as unknown as Mock).mockResolvedValue(mockClient);

    // Missing title
    const req1 = new Request("http://localhost:3000/api/quests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questType: "learning" }),
    });
    const res1 = await postQuest(req1);
    expect(res1.status).toBe(400);

    // Invalid questType
    const req2 = new Request("http://localhost:3000/api/quests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Valid Title", questType: "invalid_type" }),
    });
    const res2 = await postQuest(req2);
    expect(res2.status).toBe(400);
  });

  test("4. Unauthenticated single quest routes return 401", async () => {
    const params = Promise.resolve({ id: "non-existent-id" });

    const getReq = new Request("http://localhost:3000/api/quests/123");
    const getRes = await getSingleQuest(getReq, { params });
    expect(getRes.status).toBe(401);

    const patchReq = new Request("http://localhost:3000/api/quests/123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ progress: 50 }),
    });
    const patchRes = await patchQuest(patchReq, { params });
    expect(patchRes.status).toBe(401);

    const delReq = new Request("http://localhost:3000/api/quests/123", {
      method: "DELETE",
    });
    const delRes = await deleteQuest(delReq, { params });
    expect(delRes.status).toBe(401);
  });

  test("5. Self-parenting PATCH /api/quests/[id] returns 400", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-123" } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "quest-123",
                  user_id: "test-user-123",
                  title: "Quest 123",
                  quest_type: "learning",
                  status: "active",
                  difficulty: 0.5,
                  goal_alignment: 0.5,
                  progress: 0,
                  is_main_quest: false,
                  is_boss: false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    (getSupabaseServerClient as unknown as Mock).mockResolvedValue(mockClient);

    const params = Promise.resolve({ id: "quest-123" });
    const patchReq = new Request("http://localhost:3000/api/quests/quest-123", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentQuestId: "quest-123" }),
    });

    const patchRes = await patchQuest(patchReq, { params });
    expect(patchRes.status).toBe(400);
    const body = await patchRes.json();
    expect(body.error).toContain("Self-parenting is forbidden");
  });

  test("6. P2-1: Authenticated PATCH with invalid types/ranges returns 400 Bad Request", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-123" } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "quest-123",
                  user_id: "test-user-123",
                  title: "Quest 123",
                  quest_type: "learning",
                  status: "active",
                  difficulty: 0.5,
                  goal_alignment: 0.5,
                  progress: 0,
                  is_main_quest: false,
                  is_boss: false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };
    (getSupabaseServerClient as unknown as Mock).mockResolvedValue(mockClient);
    const params = Promise.resolve({ id: "quest-123" });

    // Invalid difficulty (> 1)
    const res1 = await patchQuest(
      new Request("http://localhost:3000/api/quests/quest-123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: 1.5 }),
      }),
      { params },
    );
    expect(res1.status).toBe(400);
    expect((await res1.json()).error).toContain("difficulty must be a number between 0 and 1");

    // Invalid progress (> 100)
    const res2 = await patchQuest(
      new Request("http://localhost:3000/api/quests/quest-123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: 150 }),
      }),
      { params },
    );
    expect(res2.status).toBe(400);
    expect((await res2.json()).error).toContain("progress must be a number between 0 and 100");

    // Invalid questType
    const res3 = await patchQuest(
      new Request("http://localhost:3000/api/quests/quest-123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questType: "invalid_type" }),
      }),
      { params },
    );
    expect(res3.status).toBe(400);
    expect((await res3.json()).error).toContain("questType must be one of");

    // Invalid status
    const res4 = await patchQuest(
      new Request("http://localhost:3000/api/quests/quest-123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "invalid_status" }),
      }),
      { params },
    );
    expect(res4.status).toBe(400);
    expect((await res4.json()).error).toContain("status must be one of");
  });
});
