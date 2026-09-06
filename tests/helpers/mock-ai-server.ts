import http from "node:http";
import type { AddressInfo } from "node:net";
import { mockAssessment } from "@/lib/ai/assess";

export interface MockAiServerHandle {
  server: http.Server;
  url: string;
  close: () => Promise<void>;
}

/**
 * Starts a lightweight, in-process, deterministic OpenAI-compatible HTTP test server.
 *
 * This server implements the /v1/chat/completions endpoint using the project's
 * deterministic mockAssessment pure function. It enables real HTTP integration tests
 * (e.g. stage5d-skills-http, e2e-http-browser) to test the live Next.js HTTP pipeline
 * without external network access, while allowing production code to remain strictly
 * fail-closed (ai_not_configured) when no AI credentials exist.
 */
export async function startDeterministicMockAiServer(): Promise<MockAiServerHandle> {
  const prevBaseUrl = process.env.AI_BASE_URL;
  const prevApiKey = process.env.AI_API_KEY;
  const prevModel = process.env.AI_MODEL;

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? "";

    if (url.includes("/chat/completions") && req.method === "POST") {
      let bodyStr = "";
      req.on("data", (chunk) => {
        bodyStr += chunk;
      });
      req.on("end", () => {
        try {
          const body = JSON.parse(bodyStr);
          const messages = body.messages ?? [];
          const userMsg = messages.find((m: { role: string }) => m.role === "user");
          const userText = typeof userMsg?.content === "string" ? userMsg.content : "";

          // Extract rawInput and recentSimilarCount from prompt
          const rawMatch = userText.match(/Activity 原文：\s*([\s\S]*?)\s*上下文：/);
          const rawInput = rawMatch ? rawMatch[1].trim() : userText.slice(0, 500);
          const countMatch = userText.match(/- recent_similar_count:\s*(\d+)/);
          const recentSimilarCount = countMatch ? parseInt(countMatch[1], 10) : 0;

          const proposal = mockAssessment({
            rawInput: rawInput || "测试活动",
            recentSimilarCount,
          });

          const completionResponse = {
            id: `chatcmpl-mock-${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: "deterministic-test-llm",
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: JSON.stringify(proposal),
                },
                finish_reason: "stop",
              },
            ],
          };

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(completionResponse));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    if (url.includes("/models")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ object: "list", data: [{ id: "deterministic-test-llm", object: "model" }] }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const port = (server.address() as AddressInfo).port;
  const serverUrl = `http://127.0.0.1:${port}/v1`;

  process.env.AI_BASE_URL = serverUrl;
  process.env.AI_API_KEY = "mock-test-key";
  process.env.AI_MODEL = "deterministic-test-llm";

  return {
    server,
    url: serverUrl,
    close: async () => {
      if (prevBaseUrl !== undefined) {
        process.env.AI_BASE_URL = prevBaseUrl;
      } else {
        delete process.env.AI_BASE_URL;
      }
      if (prevApiKey !== undefined) {
        process.env.AI_API_KEY = prevApiKey;
      } else {
        delete process.env.AI_API_KEY;
      }
      if (prevModel !== undefined) {
        process.env.AI_MODEL = prevModel;
      } else {
        delete process.env.AI_MODEL;
      }
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
