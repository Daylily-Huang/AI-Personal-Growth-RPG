// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LocalLibraryPage from "@/app/local-library/page";
const state = vi.hoisted(() => ({ memory: vi.fn(), scan: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/local-library/files", () => ({ directoryMemory: state.memory, scanDirectory: state.scan, readSource: state.read }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a> }));
const owner = "11111111-1111-4111-8111-111111111111", draftId = "22222222-2222-4222-8222-222222222222", itemId = "33333333-3333-4333-8333-333333333333";
const source = { path: "notes/a.md", content: "对比两种方法", sha256: "a".repeat(64) };
const draft = { id: draftId, model: "synthetic-model", expiresAt: "2099-01-01T00:00:00Z", items: [{ id: itemId, title: "对比方法", activityText: "比较方法并写下区别", evidenceText: "笔记材料，待核实", quote: "对比两种方法", uncertainty: "独立性未知", source }] };
const fetcher = vi.fn();
function response(body: unknown, status = 200) { return Promise.resolve({ ok: status < 400, status, json: async () => body }); }
beforeEach(() => {
  sessionStorage.clear(); state.memory.mockReset().mockResolvedValue(null); state.scan.mockReset().mockResolvedValue({ files: [{ path: source.path, size: 20, modifiedAt: 1 }], skipped: 0, limited: false }); state.read.mockReset().mockResolvedValue(source);
  const directory = { name: "notes", queryPermission: vi.fn(async () => "granted"), requestPermission: vi.fn(async () => "granted") };
  Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: vi.fn(async () => directory) });
  fetcher.mockReset().mockImplementation((url: string) => url.endsWith("analyze") ? response({ draft }) : url.endsWith("confirm") ? response({ activityId: "activity-1", evidenceId: "evidence-1", replayed: false }) : response({ userId: owner, aiConfigured: true }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function connect() { render(<LocalLibraryPage />); await waitFor(() => expect((screen.getByRole("button", { name: "选择文件夹" }) as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(screen.getByRole("button", { name: "选择文件夹" })); await screen.findByText(source.path); }
async function analyze() { await connect(); fireEvent.click(screen.getAllByRole("checkbox")[0]); fireEvent.click(screen.getAllByRole("checkbox")[1]); fireEvent.click(screen.getByRole("button", { name: "交给AI整理建议" })); await screen.findByRole("button", { name: "确认记录活动与证据" }); }
describe("local library interaction", () => {
  it("connects and scans without submitting content to AI or creating activities", async () => { await connect(); expect(state.read).not.toHaveBeenCalled(); expect(fetcher.mock.calls.every(c => c[0] === "/api/local-library")).toBe(true); });
  it("requires selection and explicit consent before AI; editing does not record until confirm", async () => {
    await connect(); const ai = screen.getByRole("button", { name: "交给AI整理建议" }) as HTMLButtonElement; expect(ai.disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("checkbox")[0]); expect(ai.disabled).toBe(true); fireEvent.click(screen.getAllByRole("checkbox")[1]); fireEvent.click(ai);
    const record = await screen.findByRole("button", { name: "确认记录活动与证据" });
    expect(fetcher.mock.calls.filter(c => c[0].endsWith("confirm"))).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("活动记录"), { target: { value: "用户修订后的真实活动" } }); fireEvent.click(record);
    await screen.findByRole("link", { name: "查看已记录活动" });
    const body = JSON.parse(fetcher.mock.calls.find(c => c[0].endsWith("confirm"))![1].body);
    expect(body.activityText).toBe("用户修订后的真实活动"); expect(body.xp).toBeUndefined(); expect(body.verified).toBeUndefined();
  });
  it("rejects a suggestion without creating records", async () => { await analyze(); fireEvent.click(screen.getByRole("button", { name: "拒绝此建议" })); expect(screen.queryByRole("button", { name: "确认记录活动与证据" })).toBeNull(); expect(fetcher.mock.calls.some(c => c[0].endsWith("confirm"))).toBe(false); });
  it("retains the same confirmation request after a partial failure", async () => {
    await analyze(); fetcher.mockImplementation((url: string) => url.endsWith("confirm") ? response({ error: "活动已保存，证据暂未保存", activityId: "activity-1" }, 503) : response({ userId: owner, aiConfigured: true }));
    fireEvent.click(screen.getByRole("button", { name: "确认记录活动与证据" })); await screen.findByRole("alert");
    const first = fetcher.mock.calls.find(c => c[0].endsWith("confirm"))![1].body;
    fetcher.mockImplementation((url: string) => url.endsWith("confirm") ? response({ activityId: "activity-1", evidenceId: "evidence-1", replayed: true }) : response({ userId: owner, aiConfigured: true }));
    fireEvent.click(screen.getByRole("button", { name: "查询结果 / 安全重试" })); await waitFor(() => expect(screen.queryByText("等待确认保存结果")).toBeNull());
    expect(fetcher.mock.calls.filter(c => c[0].endsWith("confirm"))[1][1].body).toBe(first);
  });
  it("disconnects and removes remembered handles without touching files", async () => { await connect(); fireEvent.click(screen.getByRole("button", { name: "断开连接" })); await waitFor(() => expect(screen.queryByText(source.path)).toBeNull()); expect(state.memory).toHaveBeenCalledWith(owner, "delete"); expect(state.read).not.toHaveBeenCalled(); });
  it("snapshots a fallback FileList before the cleared input and asynchronous auth check", async () => {
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: undefined });
    render(<LocalLibraryPage />); await waitFor(() => expect((screen.getByRole("button", { name: "选择文件夹" }) as HTMLButtonElement).disabled).toBe(false));
    const file = new File(["synthetic note"], "a.md"); Object.defineProperty(file, "webkitRelativePath", { value: source.path });
    const liveList = [file]; fireEvent.change(screen.getByLabelText("选择资料文件夹"), { target: { files: liveList } }); liveList.splice(0);
    await screen.findByText(source.path); expect(state.read).not.toHaveBeenCalled();
  });
  it("lists PPTX and DOCX above 128KB in the fallback without reading or sending files", async () => {
    Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: undefined });
    render(<LocalLibraryPage />); await waitFor(() => expect((screen.getByRole("button", { name: "选择文件夹" }) as HTMLButtonElement).disabled).toBe(false));
    const files = ["report.pptx", "notes.docx"].map(name => { const file = new File([new Uint8Array(200000)], name); Object.defineProperty(file, "webkitRelativePath", { value: `notes/${name}` }); return file; });
    fireEvent.change(screen.getByLabelText("选择资料文件夹"), { target: { files } });
    await screen.findByText("notes/report.pptx"); expect(screen.getByText("notes/notes.docx")).toBeTruthy(); expect(state.read).not.toHaveBeenCalled(); expect(fetcher.mock.calls.every(c => c[0] === "/api/local-library")).toBe(true);
  });
  it("identifies a failed Office file and sends nothing when extraction fails", async () => {
    state.scan.mockResolvedValue({ files: [{ path: "notes/report.pptx", size: 200000, modifiedAt: 1 }], skipped: 0, limited: false });
    state.read.mockRejectedValue(Error("文档已加密，请另存后重试"));
    render(<LocalLibraryPage />); await waitFor(() => expect((screen.getByRole("button", { name: "选择文件夹" }) as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(screen.getByRole("button", { name: "选择文件夹" })); await screen.findByText("notes/report.pptx");
    fireEvent.click(screen.getAllByRole("checkbox")[0]); fireEvent.click(screen.getAllByRole("checkbox")[1]); fireEvent.click(screen.getByRole("button", { name: "交给AI整理建议" }));
    expect((await screen.findByRole("alert")).textContent).toContain("notes/report.pptx：文档已加密"); expect(fetcher.mock.calls.some(c => c[0].endsWith("analyze") || c[0].endsWith("confirm"))).toBe(false);
  });
  it("unlocks editing when validation rejects the request before creating an activity", async () => {
    await analyze(); fetcher.mockImplementation((url: string) => url.endsWith("confirm") ? response({ error: "证据过长" }, 400) : response({ userId: owner, aiConfigured: true }));
    fireEvent.click(screen.getByRole("button", { name: "确认记录活动与证据" })); await screen.findByRole("alert");
    expect(screen.queryByText("等待确认保存结果")).toBeNull();
    expect((screen.getByLabelText("证据材料（待核实）") as HTMLTextAreaElement).disabled).toBe(false);
  });
});
