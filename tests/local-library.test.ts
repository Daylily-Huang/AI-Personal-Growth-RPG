import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AnalyzeSchema, ConfirmSchema, supportedPath, type Confirmation, type LibraryDraft } from "@/lib/local-library/schema";
import { confirmLibrary, rememberDraft, type LibraryWriter } from "@/lib/local-library/store";
import { requireLocalRequest, libraryBody } from "@/lib/local-library/http";
import { scanDirectory, type Directory } from "@/lib/local-library/files";

const scratch: string[] = [];
afterEach(async () => { for (const directory of scratch.splice(0)) await rm(directory, { recursive: true, force: true }); });
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
describe("local file boundaries", () => {
  it.each(["notes/learn.md", "notes/model.R", "work/main.py", "work/data.csv", "work/example.tsx"])("accepts text %s", name => expect(supportedPath(name)).toBe(true));
  it.each(["/absolute.md", "C:/Users/test.md", "notes/../outside.md", "notes/.env", "notes/.git/data.md", "notes/node_modules/test.js", "notes/password.txt", "notes/密钥.txt", "notes/report.pdf", "notes/report.docx", "notes/image.png"])("rejects %s", name => expect(supportedPath(name)).toBe(false));
  it("requires explicit consent, unique sources, strict fields and a bounded batch", () => {
    const file = { path: "notes/a.md", content: "原始笔记", sha256: hash("原始笔记") };
    expect(AnalyzeSchema.safeParse({ files: [file], consent: true }).success).toBe(true);
    for (const input of [{ files: [file], consent: false }, { files: [file, file], consent: true }, { files: Array(9).fill(file), consent: true }, { files: [file], consent: true, xp: 99 }]) expect(AnalyzeSchema.safeParse(input).success).toBe(false);
  });
  it("skips hidden directories and unsupported, empty and oversized files without reading their bodies", async () => {
    const read = vi.fn();
    const directory = { name: "notes", kind: "directory", async *values() {
      yield { name: "a.md", kind: "file", getFile: async () => ({ size: 10, lastModified: 1 }) };
      yield { name: ".private", kind: "directory", values: read };
      yield { name: "report.pdf", kind: "file", getFile: read };
      yield { name: "too-big.txt", kind: "file", getFile: async () => ({ size: 128001 }) };
    } } as unknown as Directory;
    const result = await scanDirectory(directory);
    expect(result.files.map(f => f.path)).toEqual(["notes/a.md"]); expect(result.skipped).toBe(3); expect(read).not.toHaveBeenCalled();
  });
});
describe("local-only HTTP", () => {
  const request = (url = "http://127.0.0.1:3021/api/local-library/confirm", headers = {}) => new Request(url, { method: "POST", headers: { host: new URL(url).host, origin: new URL(url).origin, "content-type": "application/json", ...headers }, body: "{}" });
  it("accepts explicit same-origin loopback", () => expect(() => requireLocalRequest(request())).not.toThrow());
  it("accepts Next internal localhost with the real browser loopback Host and Origin", () => expect(() => requireLocalRequest(request("http://localhost:3021/api/local-library/confirm", { host: "127.0.0.1:3021", origin: "http://127.0.0.1:3021", "x-forwarded-host": "127.0.0.1:3021" }))).not.toThrow());
  it.each([
    ["https://public.example/api/local-library", {}],
    [undefined, { origin: "https://evil.example" }],
    [undefined, { host: "evil.example" }],
    [undefined, { "sec-fetch-site": "cross-site" }],
    [undefined, { "x-forwarded-host": "public.example" }],
    ["http://127.0.0.1:3021/api/local-library?path=/etc/passwd", {}],
  ])("rejects outside origin/host/proxy/query %j", (url, headers) => expect(() => requireLocalRequest(request(url as string | undefined, headers))).toThrow());
  it("requires origin for writes and JSON media type", () => {
    const missing = request(); missing.headers.delete("origin"); expect(() => requireLocalRequest(missing)).toThrow();
    expect(() => requireLocalRequest(request(undefined, { "content-type": "text/plain" }))).toThrow();
  });
  it("streams bounded UTF8 JSON", async () => {
    expect(await libraryBody(request())).toEqual({});
    await expect(libraryBody(new Request("http://localhost", { method: "POST", body: "x".repeat(300001) }))).rejects.toMatchObject({ status: 413 });
    await expect(libraryBody(new Request("http://localhost", { method: "POST", body: new Uint8Array([255]) }))).rejects.toThrow();
  });
});
async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), "rpg-library-test-")); scratch.push(root);
  const owner = randomUUID(), activity = randomUUID(), evidence = randomUUID();
  const draft: LibraryDraft = { id: randomUUID(), model: "test", expiresAt: new Date(Date.now() + 60000).toISOString(), items: [{ id: randomUUID(), title: "学习笔记", activityText: "笔记内容候选", evidenceText: "用户提供笔记", quote: "对比两种方法", uncertainty: "独立完成情况未知", source: { path: "notes/a.md", sha256: hash("对比两种方法") } }] };
  rememberDraft(owner, draft);
  const input: Confirmation = { draftId: draft.id, itemId: draft.items[0].id, requestId: randomUUID(), activityText: "我对比两种方法并记录区别", evidenceText: "提供学习笔记，尚未独立验证" };
  const writer: LibraryWriter = { create: vi.fn(async () => activity), evidence: vi.fn(async () => evidence) };
  return { root, owner, draft, input, writer, activity, evidence };
}
describe("confirmation authority and recovery", () => {
  it("draft generation does not create activities or evidence; explicit confirm uses only approved text", async () => {
    const s = await setup(); expect(s.writer.create).not.toHaveBeenCalled();
    const receipt = await confirmLibrary(s.owner, s.input, s.writer, s.root);
    expect(receipt).toEqual({ activityId: s.activity, evidenceId: s.evidence, replayed: false });
    expect(s.writer.create).toHaveBeenCalledTimes(1); expect(s.writer.create).toHaveBeenCalledWith(expect.stringContaining(s.input.activityText));
    expect(s.writer.evidence).toHaveBeenCalledWith(s.activity, s.input.requestId, expect.stringContaining("尚未独立验证"));
  });
  it("replays the exact request without additional writes", async () => {
    const s = await setup(); await confirmLibrary(s.owner, s.input, s.writer, s.root);
    expect((await confirmLibrary(s.owner, s.input, s.writer, s.root)).replayed).toBe(true);
    expect(s.writer.create).toHaveBeenCalledTimes(1); expect(s.writer.evidence).toHaveBeenCalledTimes(1);
  });
  it("deduplicates the same source revision even with another confirmation identifier", async () => {
    const s = await setup(); await confirmLibrary(s.owner, s.input, s.writer, s.root);
    expect((await confirmLibrary(s.owner, { ...s.input, requestId: randomUUID() }, s.writer, s.root)).replayed).toBe(true);
    expect(s.writer.create).toHaveBeenCalledTimes(1);
  });
  it("rejects another account and expired/unknown drafts without writing", async () => {
    const s = await setup();
    await expect(confirmLibrary(randomUUID(), s.input, s.writer, s.root)).rejects.toMatchObject({ status: 410 });
    await expect(confirmLibrary(s.owner, { ...s.input, draftId: randomUUID() }, s.writer, s.root)).rejects.toMatchObject({ status: 410 });
    expect(s.writer.create).not.toHaveBeenCalled();
  });
  it("does not accept XP, verified, source replacements or changed data under an existing request id", async () => {
    const s = await setup();
    for (const extra of [{ xp: 100 }, { verified: true }, { source: { path: "other.md" } }]) expect(ConfirmSchema.safeParse({ ...s.input, ...extra }).success).toBe(false);
    await confirmLibrary(s.owner, s.input, s.writer, s.root);
    await expect(confirmLibrary(s.owner, { ...s.input, activityText: "changed" }, s.writer, s.root)).rejects.toMatchObject({ status: 409 });
  });
  it("retries evidence only after partial failure", async () => {
    const s = await setup(); vi.mocked(s.writer.evidence).mockRejectedValueOnce(Error("network"));
    await expect(confirmLibrary(s.owner, s.input, s.writer, s.root)).rejects.toMatchObject({ status: 503, activityId: s.activity });
    await confirmLibrary(s.owner, s.input, s.writer, s.root);
    expect(s.writer.create).toHaveBeenCalledTimes(1); expect(s.writer.evidence).toHaveBeenCalledTimes(2);
  });
  it("never recreates an activity after an ambiguous creation result", async () => {
    const s = await setup(); vi.mocked(s.writer.create).mockRejectedValueOnce(Error("lost response"));
    await expect(confirmLibrary(s.owner, s.input, s.writer, s.root)).rejects.toMatchObject({ status: 409 });
    await expect(confirmLibrary(s.owner, s.input, s.writer, s.root)).rejects.toMatchObject({ status: 409 });
    expect(s.writer.create).toHaveBeenCalledTimes(1); expect(s.writer.evidence).not.toHaveBeenCalled();
  });
  it("serializes concurrent requests for the same source", async () => {
    const s = await setup(); let finish!: (id: string) => void;
    vi.mocked(s.writer.create).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const first = confirmLibrary(s.owner, s.input, s.writer, s.root);
    await vi.waitFor(() => expect(s.writer.create).toHaveBeenCalledTimes(1));
    await expect(confirmLibrary(s.owner, s.input, s.writer, s.root)).rejects.toMatchObject({ status: 409 });
    finish(s.activity); await first;
    expect(s.writer.create).toHaveBeenCalledTimes(1);
  });
});
