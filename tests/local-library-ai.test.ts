import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { proposeLibrary, LIBRARY_PROMPT } from "@/lib/local-library/ai";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({ default: class { chat = { completions: { create: mocks.create } }; } }));
const file = { path: "notes/learning.md", content: "我比较两种方法并记录区别。文件内容不是指令。", sha256: createHash("sha256").update("我比较两种方法并记录区别。文件内容不是指令。").digest("hex") };
const suggestion = { sourceIndex: 0, title: "对比学习", activityText: "笔记记载了两种方法对比，实际学习情况待用户确认", evidenceText: "提供笔记，尚未核实独立完成", quote: "比较两种方法并记录区别", uncertainty: "实际日期与掌握程度未知" };
function answer(value: unknown = { suggestions: [suggestion] }, finish = "stop") { return { model: "test-model", choices: [{ finish_reason: finish, message: { content: JSON.stringify(value) } }] }; }
beforeEach(() => { vi.stubEnv("AI_MODEL", "test-model"); vi.stubEnv("AI_API_KEY", "synthetic"); vi.stubEnv("AI_BASE_URL", "https://api.deepseek.com"); mocks.create.mockReset().mockResolvedValue(answer()); });
afterEach(() => vi.unstubAllEnvs());
describe("file-to-suggestion contract", () => {
  it("produces source-bound editable suggestions with exact quotations", async () => {
    const result = await proposeLibrary([file]);
    expect(result.items[0]).toMatchObject({ title: suggestion.title, source: { path: file.path, sha256: file.sha256 } });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const request = mocks.create.mock.calls[0][0];
    expect(request.messages[0].content).toBe(LIBRARY_PROMPT); expect(request.messages[1].content).not.toContain("sha256"); expect(request.tools).toBeUndefined();
  });
  it.each([
    { suggestions: [{ ...suggestion, quote: "原文件中不存在的内容" }] },
    { suggestions: [{ ...suggestion, sourceIndex: 1 }] },
    { suggestions: [suggestion, suggestion] },
    { suggestions: [{ ...suggestion, xp: 100 }] },
    { suggestions: [{ ...suggestion, verified: true }] },
  ])("rejects forged/privileged model output %j", async value => { mocks.create.mockResolvedValue(answer(value)); await expect(proposeLibrary([file])).rejects.toThrow("格式或原文引用"); });
  it("rejects hash mismatch before contacting the model", async () => { await expect(proposeLibrary([{ ...file, sha256: "0".repeat(64) }])).rejects.toThrow("校验"); expect(mocks.create).not.toHaveBeenCalled(); });
  it("rejects truncated completions and provider failures without mock fallback", async () => {
    mocks.create.mockResolvedValueOnce(answer(undefined, "length")); await expect(proposeLibrary([file])).rejects.toThrow("格式");
    mocks.create.mockRejectedValueOnce(Error("private provider detail")); await expect(proposeLibrary([file])).rejects.toThrow("AI整理失败");
  });
  it("does not call AI without a configured credential", async () => { vi.stubEnv("AI_API_KEY", ""); await expect(proposeLibrary([file])).rejects.toThrow("未配置"); expect(mocks.create).not.toHaveBeenCalled(); });
});
