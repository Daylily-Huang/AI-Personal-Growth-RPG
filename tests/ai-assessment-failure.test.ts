import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assessActivity } from "@/lib/ai/assess";
import { DemoRepository } from "@/lib/store/demo-repository";

describe("P1-02: AI assessment failure isolation and error handling", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  test("1. when AI service request throws, throws AIAssessmentError(ai_request_failed) and does not mock", async () => {
    process.env.AI_API_KEY = "test-key";
    process.env.AI_BASE_URL = "https://test.ai.local/v1";

    vi.doMock("openai", () => {
      return {
        default: class MockOpenAI {
          chat = {
            completions: {
              create: vi.fn().mockRejectedValue(new Error("Connection timeout to upstream AI provider")),
            },
          };
        },
      };
    });

    const { assessActivity: testAssess, AIAssessmentError: DynamicAIAssessmentError } = await import("@/lib/ai/assess");

    try {
      await testAssess({
        rawInput: "完成了核心架构演进",
        recentSimilarCount: 0,
      });
      expect.fail("Should have thrown AIAssessmentError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(DynamicAIAssessmentError);
      const assessmentErr = err as { name: string; code: string; retryable: boolean };
      expect(assessmentErr.name).toBe("AIAssessmentError");
      expect(assessmentErr.code).toBe("ai_request_failed");
      expect(assessmentErr.retryable).toBe(true);
    }
  });

  test("2. when AI returns empty content, throws AIAssessmentError(ai_empty_content)", async () => {
    process.env.AI_API_KEY = "test-key";
    process.env.AI_BASE_URL = "https://test.ai.local/v1";

    vi.doMock("openai", () => {
      return {
        default: class MockOpenAI {
          chat = {
            completions: {
              create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: "   " } }],
              }),
            },
          };
        },
      };
    });

    const { assessActivity: testAssess, AIAssessmentError: DynamicAIAssessmentError } = await import("@/lib/ai/assess");

    try {
      await testAssess({
        rawInput: "完成了核心架构演进",
        recentSimilarCount: 0,
      });
      expect.fail("Should have thrown AIAssessmentError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(DynamicAIAssessmentError);
      const assessmentErr = err as { name: string; code: string };
      expect(assessmentErr.name).toBe("AIAssessmentError");
      expect(assessmentErr.code).toBe("ai_empty_content");
    }
  });

  test("3. when AI returns invalid schema, throws AIAssessmentError(ai_invalid_schema)", async () => {
    process.env.AI_API_KEY = "test-key";
    process.env.AI_BASE_URL = "https://test.ai.local/v1";

    vi.doMock("openai", () => {
      return {
        default: class MockOpenAI {
          chat = {
            completions: {
              create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: JSON.stringify({ broken_schema: true }) } }],
              }),
            },
          };
        },
      };
    });

    const { assessActivity: testAssess, AIAssessmentError: DynamicAIAssessmentError } = await import("@/lib/ai/assess");

    try {
      await testAssess({
        rawInput: "完成了核心架构演进",
        recentSimilarCount: 0,
      });
      expect.fail("Should have thrown AIAssessmentError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(DynamicAIAssessmentError);
      const assessmentErr = err as { name: string; code: string };
      expect(assessmentErr.name).toBe("AIAssessmentError");
      expect(assessmentErr.code).toBe("ai_invalid_schema");
    }
  });

  test("4. when explicit demo fallback is allowed, falls back to demo mock with truthful modelName 'local-deterministic-mock'", async () => {
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.OPENAI_BASE_URL;

    const result = await assessActivity(
      {
        rawInput: "本地离线自学了高等数学",
        recentSimilarCount: 0,
      },
      { allowDemoFallback: true }
    );

    expect(result.proposal).toBeDefined();
    expect(result.modelName).toBe("local-deterministic-mock");
  });

  test("5. P1-B: when AI credentials are unconfigured and allowDemoFallback is false (e.g. production/Supabase mode), throws ai_not_configured", async () => {
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.OPENAI_BASE_URL;

    const { assessActivity: testAssess, AIAssessmentError: DynamicAIAssessmentError } = await import("@/lib/ai/assess");

    try {
      await testAssess(
        {
          rawInput: "真实生产模式未配置模型",
          recentSimilarCount: 0,
        },
        { allowDemoFallback: false }
      );
      expect.fail("Should have thrown AIAssessmentError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(DynamicAIAssessmentError);
      const assessmentErr = err as { code: string };
      expect(assessmentErr.code).toBe("ai_not_configured");
    }
  });

  test("6. assess route returns 502 with retryable=true on AI failure and preserves pending_assessment", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "assess-route-test-"));
    process.env.DEMO_DB_PATH = path.join(tempDir, "demo.json");
    process.env.AI_API_KEY = "test-key";
    process.env.AI_BASE_URL = "https://test.ai.local/v1";

    vi.doMock("openai", () => {
      return {
        default: class MockOpenAI {
          chat = {
            completions: {
              create: vi.fn().mockRejectedValue(new Error("AI Gateway Unavailable")),
            },
          };
        },
      };
    });

    const repo = new DemoRepository();
    await repo.reset();
    const activity = await repo.addActivity({ rawInput: "待评估活动" });
    expect(activity.status).toBe("pending_assessment");

    vi.doMock("@/lib/store/request-repository", () => ({
      getRequestRepository: () => repo,
      AuthRequiredError: class extends Error {},
    }));

    const { POST } = await import("@/app/api/activities/[id]/assess/route");

    const req = new Request(`http://localhost:3000/api/activities/${activity.id}/assess`, {
      method: "POST",
    });
    const res = await POST(req, { params: Promise.resolve({ id: activity.id }) });

    expect(res.status).toBe(502);
    const body = (await res.json()) as { retryable?: boolean; code?: string };
    expect(body.retryable).toBe(true);
    expect(body.code).toBe("ai_request_failed");

    // CRITICAL: verify that activity was NOT settled, remains pending_assessment, and no assessments were created
    const refreshedActivity = await repo.getActivity(activity.id);
    expect(refreshedActivity?.status).toBe("pending_assessment");

    const pendingAssessments = await repo.listPendingAssessments();
    expect(pendingAssessments).toHaveLength(0);

    fs.rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DEMO_DB_PATH;
  });
});
