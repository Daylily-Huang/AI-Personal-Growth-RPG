import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/outer-loop/request", () => ({
  getPhase8BRepository: vi.fn(),
}));

vi.mock("@/lib/outer-loop/service", () => ({
  getPhase8BService: vi.fn(),
}));

import { GET as listSeasons, POST as createSeason } from "@/app/api/seasons/route";
import {
  DELETE as deleteSeason,
  GET as getSeason,
} from "@/app/api/seasons/[id]/route";
import { POST as planSeason } from "@/app/api/seasons/[id]/plan/route";
import { POST as concludeSeason } from "@/app/api/seasons/[id]/conclude/route";
import { POST as linkSeasonQuest } from "@/app/api/seasons/[id]/quests/route";
import { POST as finalizeSeasonReview } from "@/app/api/seasons/[id]/reviews/route";
import { POST as reviewProposal } from "@/app/api/outer-loop/proposals/[id]/review/route";
import { getPhase8BRepository } from "@/lib/outer-loop/request";
import { getPhase8BService } from "@/lib/outer-loop/service";
import { Phase8BRepositoryError } from "@/lib/outer-loop/repository";
import { AuthRequiredError } from "@/lib/store/request-repository";

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function seasonContext(id: string) {
  return {
    season: {
      id,
      userId: randomUUID(),
      name: "Research sprint",
      description: null,
      themeColor: null,
      iconKey: null,
      status: "DRAFT" as const,
      plannedStartDate: null,
      targetDurationDays: null,
      successCriteria: null,
      startedAt: null,
      endedAt: null,
      abandonmentReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    links: [],
    reviews: [],
    activities: [],
  };
}

describe("Phase 8B Round 3 — HTTP adapters", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("GET /api/seasons maps missing auth to 401", async () => {
    vi.mocked(getPhase8BService).mockRejectedValue(new AuthRequiredError());

    const response = await listSeasons();
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("POST /api/seasons authenticates before malformed JSON parsing", async () => {
    vi.mocked(getPhase8BRepository).mockRejectedValue(new AuthRequiredError());
    const request = new Request("http://localhost/api/seasons", {
      method: "POST",
      body: "{ invalid",
    });

    const response = await createSeason(request);
    expect(response.status).toBe(401);
  });

  test("POST /api/seasons creates DRAFT metadata only", async () => {
    const id = randomUUID();
    const draft = seasonContext(id).season;
    const createDraft = vi.fn().mockResolvedValue(draft);
    vi.mocked(getPhase8BRepository).mockResolvedValue({ createDraft } as never);

    const response = await createSeason(jsonRequest("http://localhost/api/seasons", "POST", {
      name: "  Research sprint  ",
      description: "  Finish methods  ",
    }));

    expect(response.status).toBe(201);
    expect(createDraft).toHaveBeenCalledWith({
      name: "Research sprint",
      description: "Finish methods",
      themeColor: undefined,
      iconKey: undefined,
    });
  });

  test("GET /api/seasons/:id returns derived Season context", async () => {
    const id = randomUUID();
    const contextValue = seasonContext(id);
    const getSeasonContext = vi.fn().mockResolvedValue(contextValue);
    vi.mocked(getPhase8BService).mockResolvedValue({ getSeasonContext } as never);

    const response = await getSeason(new Request(`http://localhost/api/seasons/${id}`), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(200);
    expect(getSeasonContext).toHaveBeenCalledWith(id);
    await expect(response.json()).resolves.toMatchObject({ season: { id } });
  });

  test("O022 product DELETE fails closed when DB rejects a previously ACTIVE Season", async () => {
    const id = randomUUID();
    const deleteUnactivated = vi.fn().mockRejectedValue(
      new Phase8BRepositoryError({
        message: "A Season that reached ACTIVE cannot be hard-deleted",
        code: "42501",
      }),
    );
    vi.mocked(getPhase8BRepository).mockResolvedValue({ deleteUnactivated } as never);

    const response = await deleteSeason(new Request(`http://localhost/api/seasons/${id}`, { method: "DELETE" }), {
      params: Promise.resolve({ id }),
    });

    expect(response.status).toBe(403);
    expect(deleteUnactivated).toHaveBeenCalledWith(id);
  });

  test("plan route rejects duration outside 14..84 before RPC invocation", async () => {
    const id = randomUUID();
    const plan = vi.fn();
    vi.mocked(getPhase8BRepository).mockResolvedValue({ planSeason: plan } as never);

    const response = await planSeason(jsonRequest(`http://localhost/api/seasons/${id}/plan`, "POST", {
      plannedStartDate: "2026-10-01",
      targetDurationDays: 7,
      successCriteria: [],
      requestIdempotencyKey: "plan-1",
    }), { params: Promise.resolve({ id }) });

    expect(response.status).toBe(400);
    expect(plan).not.toHaveBeenCalled();
  });

  test("conclude route normalizes a COMPLETED final review and delegates atomically", async () => {
    const id = randomUUID();
    const commitKey = randomUUID();
    const conclude = vi.fn().mockResolvedValue({ season: seasonContext(id).season, review: { id: randomUUID() } });
    vi.mocked(getPhase8BRepository).mockResolvedValue({ concludeSeason: conclude } as never);

    const response = await concludeSeason(jsonRequest(`http://localhost/api/seasons/${id}/conclude`, "POST", {
      targetStatus: "COMPLETED",
      finalReview: {
        periodStart: "2026-09-01T00:00:00Z",
        periodEnd: "2026-09-28T00:00:00Z",
        objectiveSummary: { activities: 12 },
        qualitativeReflection: "Useful cycle",
        criteriaEvaluation: [],
      },
      finalReviewCommitKey: commitKey,
      requestIdempotencyKey: "conclude-1",
    }), { params: Promise.resolve({ id }) });

    expect(response.status).toBe(200);
    expect(conclude).toHaveBeenCalledWith(id, expect.objectContaining({
      targetStatus: "COMPLETED",
      finalReviewCommitKey: commitKey,
      requestIdempotencyKey: "conclude-1",
    }));
  });

  test("season quest route maps cross-tenant authority rejection to 403", async () => {
    const seasonId = randomUUID();
    const questId = randomUUID();
    const linkQuest = vi.fn().mockRejectedValue(
      new Phase8BRepositoryError({ message: "TENANT_MISMATCH", code: "42501" }),
    );
    vi.mocked(getPhase8BRepository).mockResolvedValue({ linkQuest } as never);

    const response = await linkSeasonQuest(jsonRequest(`http://localhost/api/seasons/${seasonId}/quests`, "POST", {
      questId,
      role: "FOCUS",
    }), { params: Promise.resolve({ id: seasonId }) });

    expect(response.status).toBe(403);
  });

  test("periodic review route rejects FINAL because FINAL belongs to season conclusion", async () => {
    const seasonId = randomUUID();
    const finalizeReview = vi.fn();
    vi.mocked(getPhase8BRepository).mockResolvedValue({ finalizeReview } as never);

    const response = await finalizeSeasonReview(jsonRequest(`http://localhost/api/seasons/${seasonId}/reviews`, "POST", {
      reviewType: "FINAL",
      periodStart: "2026-09-01T00:00:00Z",
      periodEnd: "2026-09-07T00:00:00Z",
      qualitativeReflection: "x",
      commitKey: randomUUID(),
    }), { params: Promise.resolve({ id: seasonId }) });

    expect(response.status).toBe(400);
    expect(finalizeReview).not.toHaveBeenCalled();
  });

  test("proposal review route preserves proposal-only authority and delegates user decision", async () => {
    const proposalId = randomUUID();
    const review = vi.fn().mockResolvedValue({ proposal: { id: proposalId, status: "EDITED" } });
    vi.mocked(getPhase8BRepository).mockResolvedValue({ reviewProposal: review } as never);

    const response = await reviewProposal(jsonRequest(`http://localhost/api/outer-loop/proposals/${proposalId}/review`, "POST", {
      decision: "EDITED",
      editedPayload: { name: "Edited season" },
      reviewRequestIdempotencyKey: "proposal-review-1",
    }), { params: Promise.resolve({ id: proposalId }) });

    expect(response.status).toBe(200);
    expect(review).toHaveBeenCalledWith(
      proposalId,
      "EDITED",
      "proposal-review-1",
      { name: "Edited season" },
      null,
    );
  });
});
