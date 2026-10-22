// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LocalLibraryPage from "@/app/local-library/page";
import type { Directory } from "@/lib/local-library/files";
const state = vi.hoisted(() => ({ memory: vi.fn(), scan: vi.fn(), read: vi.fn(), prepare: vi.fn(), imageSource: vi.fn() }));
vi.mock("@/lib/local-library/files", () => ({ scanDirectory: state.scan, readSource: state.read }));
vi.mock("@/lib/local-library/folders", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/local-library/folders")>(), folderMemory: state.memory }));
vi.mock("@/lib/local-library/image", () => ({ prepareImage: state.prepare, imageSource: state.imageSource }));
vi.mock("next/link", () => ({ default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
const owner = "11111111-1111-4111-8111-111111111111", fetcher = vi.fn(), choose = vi.fn();
const response = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: async () => body });
function directory(name: string, tag: number) {
  return { kind: "directory", name, tag, values: async function* () { /* fixture */ }, queryPermission: vi.fn(async () => "granted"), requestPermission: vi.fn(async () => "granted"), isSameEntry: vi.fn(async (other: { tag: number }) => other.tag === tag) } as unknown as Directory & { tag: number };
}
let a: ReturnType<typeof directory>, b: ReturnType<typeof directory>;
beforeEach(() => {
  sessionStorage.clear(); a = directory("notes", 11); b = directory("work", 22);
  state.memory.mockReset().mockResolvedValue([]); state.scan.mockReset().mockImplementation(async (handle: { name: string; tag: number }) => ({ files: [{ path: `${handle.name}/a.md`, size: handle.tag, modifiedAt: 1, read: vi.fn() }], skipped: 0, limited: false }));
  state.read.mockReset().mockImplementation(async (file: { path: string; size: number }) => ({ path: file.path, content: file.size === 11 ? "Alpha source" : "Beta source", sha256: (file.size === 11 ? "a" : "b").repeat(64) }));
  state.prepare.mockReset().mockResolvedValue({ originalSha256: "c".repeat(64), rasterSha256: "d".repeat(64), base64: "YWJj", preview: "data:image/png;base64,YWJj", width: 100, height: 80 });
  state.imageSource.mockReset().mockImplementation(async (file: { path: string }, text: { text: string }) => ({ path: file.path, content: text.text, sha256: "a".repeat(64) }));
  choose.mockReset().mockResolvedValueOnce(a).mockResolvedValue(b);
  Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: choose });
  fetcher.mockReset().mockImplementation((url: string) => url.endsWith("/analyze") ? response({ draft: { id: crypto.randomUUID(), model: "synthetic", expiresAt: "2099-01-01", items: [] } }) : url.endsWith("/ocr") ? response({ text: "Local image text", engine: "Windows OCR", language: "zh-Hans", rasterSha256: "d".repeat(64) }) : response({ userId: owner, aiConfigured: true }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function start() { render(<LocalLibraryPage />); await waitFor(() => expect((screen.getByRole("button", { name: "选择文件夹" }) as HTMLButtonElement).disabled).toBe(false)); }
async function add(first = false) { fireEvent.click(screen.getByRole("button", { name: first ? "选择文件夹" : "添加文件夹" })); await waitFor(() => expect((screen.getByRole("button", { name: "添加文件夹" }) as HTMLButtonElement).disabled).toBe(false)); }
async function both() { await start(); await add(true); await add(); }
const consent = () => screen.getByRole("checkbox", { name: /允许将以上所选文本/ });
const fileCheckboxes = () => screen.getAllByRole("checkbox").filter(input => input !== consent());
describe("multiple local folder interaction", () => {
  it("adds two directories without replacing or reading the first, scanning does not send files", async () => {
    await both(); expect(screen.getByText("notes/a.md")).toBeTruthy(); expect(screen.getByText("work/a.md")).toBeTruthy(); expect(screen.getByText("已连接 2 个文件夹")).toBeTruthy(); expect(state.read).not.toHaveBeenCalled(); expect(fetcher.mock.calls.every(c => c[0] === "/api/local-library")).toBe(true);
  });
  it("selects and transmits only consented files across roots with independent source identities", async () => {
    b = directory("notes", 22); choose.mockReset().mockResolvedValueOnce(a).mockResolvedValue(b); await both();
    const checks = fileCheckboxes(); expect(checks).toHaveLength(2); checks.forEach(input => fireEvent.click(input));
    expect((screen.getByRole("button", { name: "交给AI整理建议" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(consent()); fireEvent.click(screen.getByRole("button", { name: "交给AI整理建议" }));
    await waitFor(() => expect(fetcher.mock.calls.some(c => c[0].endsWith("/analyze"))).toBe(true));
    const body = JSON.parse(fetcher.mock.calls.find(c => c[0].endsWith("/analyze"))![1].body);
    expect(body.files).toHaveLength(2); expect(new Set(body.files.map((f: { path: string }) => f.path)).size).toBe(2); expect(body.files.map((f: { content: string }) => f.content)).toEqual(["Alpha source", "Beta source"]); expect(body.files.every((f: { path: string }) => /^[a-f0-9-]{36}\/notes\/a\.md$/.test(f.path))).toBe(true); expect(fetcher.mock.calls.some(c => c[0].endsWith("/confirm"))).toBe(false);
  });
  it("deduplicates the same native directory and reuses its remembered identity", async () => {
    choose.mockReset().mockResolvedValue(a); await start(); await add(true); const first = state.memory.mock.calls.find(c => c[1] === "put")![2][0].id; await add();
    expect(screen.getByText("已连接 1 个文件夹")).toBeTruthy(); expect(screen.getAllByText("notes/a.md")).toHaveLength(1); expect(state.memory.mock.calls.filter(c => c[1] === "put").at(-1)![2][0].id).toBe(first);
  });
  it("canceling the picker leaves existing files and selection intact", async () => {
    await start(); await add(true); fireEvent.click(fileCheckboxes()[0]); choose.mockRejectedValueOnce(new DOMException("cancel", "AbortError")); await add(); expect(screen.getByText("notes/a.md")).toBeTruthy(); expect((fileCheckboxes()[0] as HTMLInputElement).checked).toBe(true); expect(screen.queryByRole("alert")).toBeNull();
  });
  it("disconnects one directory, keeps the other selection and revokes consent", async () => {
    await both(); fileCheckboxes().forEach(input => fireEvent.click(input)); fireEvent.click(consent()); fireEvent.click(screen.getByRole("button", { name: "断开 notes" }));
    await waitFor(() => expect(screen.queryByText("notes/a.md")).toBeNull()); expect(screen.getByText("work/a.md")).toBeTruthy(); expect((fileCheckboxes()[0] as HTMLInputElement).checked).toBe(true); expect((consent() as HTMLInputElement).checked).toBe(false);
    expect(state.memory.mock.calls.filter(c => c[1] === "put").at(-1)![2]).toHaveLength(1);
  });
  it("one permission denial removes only that folder's stale data", async () => {
    await both(); fileCheckboxes().forEach(input => fireEvent.click(input)); vi.mocked(a.requestPermission).mockResolvedValueOnce("denied"); fireEvent.click(screen.getByRole("button", { name: "刷新 notes" }));
    await screen.findByRole("alert"); expect(screen.queryByText("notes/a.md")).toBeNull(); expect(screen.getByText("work/a.md")).toBeTruthy(); expect((fileCheckboxes()[0] as HTMLInputElement).checked).toBe(true); expect(screen.getByText("已连接 2 个文件夹")).toBeTruthy();
  });
  it("refreshes readable directories even when another folder's permission was revoked", async () => {
    await both(); vi.mocked(a.requestPermission).mockResolvedValueOnce("denied"); fireEvent.click(screen.getByRole("button", { name: "刷新所有文件夹" })); await screen.findByRole("alert"); expect(screen.getByText(/已刷新 1 个文件夹/)).toBeTruthy(); expect(screen.getByText("work/a.md")).toBeTruthy();
  });
  it("restores multiple handles without scans or prompts until refresh is clicked", async () => {
    state.memory.mockResolvedValue([{ id: crypto.randomUUID(), handle: a }, { id: crypto.randomUUID(), handle: b }]); render(<LocalLibraryPage />); await waitFor(() => expect((screen.getByRole("button", { name: "添加文件夹" }) as HTMLButtonElement).disabled).toBe(false)); expect(state.scan).not.toHaveBeenCalled(); expect(a.requestPermission).not.toHaveBeenCalled(); expect(b.requestPermission).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "刷新所有文件夹" })); await screen.findByText("work/a.md"); expect(screen.getByText("notes/a.md")).toBeTruthy();
  });
  it("supports filtering without dropping hidden selections", async () => {
    await both(); fireEvent.click(fileCheckboxes()[0]); const select = screen.getByLabelText("按文件夹查看") as HTMLSelectElement; fireEvent.change(select, { target: { value: Array.from(select.options).find(v => v.text === "work")!.value } }); expect(screen.queryByText("notes/a.md")).toBeNull(); expect(screen.getByText("work/a.md")).toBeTruthy(); expect(screen.getByText("跨文件夹合计 1 / 8")).toBeTruthy();
  });
  it("enforces eight selected files across every folder rather than per-folder", async () => {
    state.scan.mockImplementation(async (handle: { name: string; tag: number }) => ({ files: Array.from({ length: 6 }, (_, i) => ({ path: `${handle.name}/${i}.md`, size: handle.tag, modifiedAt: 1 })), skipped: 0, limited: false })); await both(); const checks = fileCheckboxes() as HTMLInputElement[]; checks.slice(0, 8).forEach(input => fireEvent.click(input)); expect(checks.slice(8).every(input => input.disabled)).toBe(true); expect(screen.getByText("跨文件夹合计 8 / 8")).toBeTruthy();
  });
  it("changing account clears old folders and prevents reading or submitting a new selection", async () => {
    await start(); await add(true); fetcher.mockImplementation(() => response({ userId: "another-owner", aiConfigured: true })); fireEvent.click(screen.getByRole("button", { name: "添加文件夹" })); expect((await screen.findByRole("alert")).textContent).toContain("登录账号已改变"); expect(screen.queryByText("notes/a.md")).toBeNull(); expect(screen.queryByText("work/a.md")).toBeNull(); expect(state.scan).toHaveBeenCalledTimes(1); expect(state.read).not.toHaveBeenCalled();
  });
  it("blocks sending text if the account changes while file contents are being read", async () => {
    await start(); await add(true); fireEvent.click(fileCheckboxes()[0]); fireEvent.click(consent());
    state.read.mockImplementationOnce(async () => { fetcher.mockImplementation(() => response({ userId: "another-owner", aiConfigured: true })); return { path: "notes/a.md", content: "Old account text", sha256: "a".repeat(64) }; });
    fireEvent.click(screen.getByRole("button", { name: "交给AI整理建议" })); await screen.findByRole("alert"); expect(fetcher.mock.calls.some(c => c[0].endsWith("/analyze"))).toBe(false); expect(screen.queryByText("notes/a.md")).toBeNull();
  });
  it("remembering a second folder can fail without removing either live connection", async () => {
    await start(); await add(true); state.memory.mockRejectedValueOnce(Error("storage unavailable")); await add(); expect(screen.getByText("notes/a.md")).toBeTruthy(); expect(screen.getByText("work/a.md")).toBeTruthy(); expect(screen.getByText(/未能记住本次连接变更/)).toBeTruthy();
  });
  it("retains a pending confirmation when all folder connections are disconnected", async () => {
    sessionStorage.setItem(`growth-library-pending:${owner}`, JSON.stringify({ draftId: crypto.randomUUID(), itemId: crypto.randomUUID(), requestId: crypto.randomUUID(), activityText: "Pending synthetic action", evidenceText: "Pending evidence" })); await both(); fireEvent.click(screen.getByRole("button", { name: "全部断开" })); await screen.findByRole("button", { name: "选择文件夹" }); expect(screen.getByText("等待确认保存结果")).toBeTruthy(); expect(screen.getByRole("button", { name: "查询结果 / 安全重试" })).toBeTruthy(); expect(sessionStorage.getItem(`growth-library-pending:${owner}`)).not.toBeNull();
  });
  it("snapshots successive fallback directories and retains both after FileLists are cleared", async () => {
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: undefined }); await start();
    for (const name of ["notes", "work"]) { const file = new File(["synthetic"], "a.md"); Object.defineProperty(file, "webkitRelativePath", { value: `${name}/a.md` }); const list = [file]; fireEvent.change(screen.getByLabelText("选择资料文件夹"), { target: { files: list } }); list.splice(0); await screen.findByText(`${name}/a.md`); }
    expect(screen.getByText("已连接 2 个文件夹")).toBeTruthy(); expect(state.read).not.toHaveBeenCalled();
  });
  it("maintains separate OCR previews and text for equal image paths in separate folders", async () => {
    b = directory("notes", 22); choose.mockReset().mockResolvedValueOnce(a).mockResolvedValue(b); state.scan.mockImplementation(async (handle: { tag: number }) => ({ files: [{ path: "notes/photo.png", size: handle.tag, modifiedAt: 1 }], skipped: 0, limited: false })); await both(); fileCheckboxes().forEach(input => fireEvent.click(input)); fireEvent.click(screen.getByRole("button", { name: "本机识别所选图片" }));
    await waitFor(() => expect(screen.getAllByRole("textbox")).toHaveLength(2)); const texts = screen.getAllByRole("textbox"); fireEvent.change(texts[0], { target: { value: "First image revised" } }); expect((texts[1] as HTMLTextAreaElement).value).toBe("Local image text"); expect(screen.getAllByRole("img")).toHaveLength(2); expect(fetcher.mock.calls.some(c => c[0].endsWith("/analyze"))).toBe(false);
  });
});