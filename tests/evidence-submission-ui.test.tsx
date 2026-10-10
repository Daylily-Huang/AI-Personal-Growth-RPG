// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EvidenceSubmissionPanel } from "@/components/activities/EvidenceSubmissionPanel";
import { EvidenceSubmissionError, type EvidenceSubmissionInput } from "@/lib/evidence-submission/types";
const mocks = vi.hoisted(() => ({ load: vi.fn(), submit: vi.fn() }));
vi.mock("@/lib/evidence-submission/client", async original => ({ ...await original<typeof import("@/lib/evidence-submission/client")>(), loadEvidence: mocks.load, submitEvidence: mocks.submit }));
const id = (n: number) => `10000000-0000-0000-0000-${n.toString(16).padStart(12, "0")}`;
const activity = id(1), requestId = id(2), skill = id(3);
function stored(input: EvidenceSubmissionInput) { return { replayed: false, submission: { requestId: input.requestId, activityId: activity, requestedSkillId: input.skillId,
  evidence: { id: id(4), activityId: activity, skillId: input.skillId, evidenceLevel: 0, evidenceType: "user_submission", verified: false, description: input.description, createdAt: "2026-10-11T00:00:00Z" } } }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  mocks.load.mockReset().mockImplementation(async (_activity, query) => query.view === "skills" ? { view: "skills", items: [{ id: skill, name: "技能目录", status: "active", nameTruncated: false }], nextCursor: null } : { view: "submissions", items: [], nextCursor: null });
  mocks.submit.mockReset().mockImplementation(async (_activity, input) => stored(input));
  vi.spyOn(crypto, "randomUUID").mockReturnValue(requestId);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function open() { fireEvent.click(screen.getByRole("button", { name: "展开补证面板" })); await waitFor(() => expect(screen.queryByText("正在读取材料与技能选项…")).toBeNull()); }
function prepare(description = "  literal <script> https://example.invalid\n材料  ") {
  fireEvent.change(screen.getByLabelText("文字材料（可含纯文本链接）"), { target: { value: description } });
  fireEvent.click(screen.getByRole("button", { name: "检查并准备提交" }));
}
describe("manual E0 panel without implicit reads/writes", () => {
  it("closed panel has no new GET and explicitly scopes the original read-only caption", () => {
    render(<EvidenceSubmissionPanel activityId={activity} />); expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.submit).not.toHaveBeenCalled();
    expect(screen.getByText(/上方原文区只读/)).toBeDefined(); expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("explicit open reads only first bounded pages, defaults to null Skill", async () => {
    render(<EvidenceSubmissionPanel activityId={activity} />); await open();
    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(mocks.load).toHaveBeenCalledWith(activity, { view: "submissions", after: null }, expect.any(AbortSignal));
    expect(mocks.load).toHaveBeenCalledWith(activity, { view: "skills", after: null }, expect.any(AbortSignal));
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(""); expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("confirmation precedes mutation; literal text, no link execution; fixed bytes", async () => {
    const { container } = render(<EvidenceSubmissionPanel activityId={activity} />); await open(); prepare();
    expect(mocks.submit).not.toHaveBeenCalled(); expect(screen.getByRole("region", { name: "确认补证" })).toBeDefined();
    expect(container.querySelector("script,a")).toBeNull(); expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "确认保存材料" }));
    await screen.findByText("材料已保存，待核实。XP、Mastery 和奖励未改变。");
    expect(mocks.submit).toHaveBeenCalledExactlyOnceWith(activity, { requestId, skillId: null, description: "literal <script> https://example.invalid\n材料" }, expect.any(AbortSignal));
    expect(screen.getByTestId("submitted-evidence-text").textContent).toBe("literal <script> https://example.invalid\n材料");
    expect(container.querySelector("script,a")).toBeNull();
  });
  it("cancel confirmation does not submit, chosen own Skill is explicit", async () => {
    render(<EvidenceSubmissionPanel activityId={activity} />); await open();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: skill } }); prepare("有技能材料");
    fireEvent.click(screen.getByRole("button", { name: "取消提交，继续编辑" })); expect(mocks.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "检查并准备提交" })); fireEvent.click(screen.getByRole("button", { name: "确认保存材料" }));
    await screen.findByText("材料已保存，待核实。XP、Mastery 和奖励未改变。");
    expect(mocks.submit.mock.calls[0][1]).toMatchObject({ skillId: skill });
  });
  it.each(["", "　\u000b", "\ud800", "界".repeat(2731)])("invalid input does not allocate a write %#", async description => {
    render(<EvidenceSubmissionPanel activityId={activity} />); await open(); prepare(description);
    expect(screen.getByText("请输入非空、有效的文字材料，最多 8192 UTF8 bytes")).toBeDefined(); expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("network-unknown retry retains exact key/body and disallows old key + edited body", async () => {
    mocks.submit.mockRejectedValueOnce(Error("private network secret"));
    render(<EvidenceSubmissionPanel activityId={activity} />); await open(); prepare("exact retry"); fireEvent.click(screen.getByRole("button", { name: "确认保存材料" }));
    const retry = await screen.findByRole("button", { name: "用相同编号重试" });
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true); expect(screen.queryByText(/private network/)).toBeNull();
    fireEvent.click(retry); await screen.findByText("材料已保存，待核实。XP、Mastery 和奖励未改变。");
    expect(mocks.submit).toHaveBeenCalledTimes(2); expect(mocks.submit.mock.calls[0][1]).toEqual(mocks.submit.mock.calls[1][1]);
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1);
  });
  it("pending repeated activation does not create another call", async () => {
    const wait = deferred<ReturnType<typeof stored>>(); mocks.submit.mockReturnValue(wait.promise);
    render(<EvidenceSubmissionPanel activityId={activity} />); await open(); prepare("once"); fireEvent.click(screen.getByRole("button", { name: "确认保存材料" }));
    fireEvent.click(screen.getByRole("button", { name: "正在保存…" })); expect(mocks.submit).toHaveBeenCalledTimes(1);
    await act(async () => wait.resolve(stored(mocks.submit.mock.calls[0][1])));
  });
  it("save success survives refresh failure; retry reading never writes", async () => {
    render(<EvidenceSubmissionPanel activityId={activity} />); await open();
    mocks.load.mockRejectedValueOnce(Error("private-read-error")).mockRejectedValueOnce(Error("private-read-error"));
    prepare("retained complete text"); fireEvent.click(screen.getByRole("button", { name: "确认保存材料" }));
    await screen.findByText(/材料保存成功，但重新读取失败/); expect(screen.getByTestId("submitted-evidence-text").textContent).toBe("retained complete text");
    fireEvent.click(screen.getByRole("button", { name: "重新读取材料与技能" })); await waitFor(() => expect(screen.queryByText(/材料保存成功，但重新读取失败/)).toBeNull());
    expect(mocks.submit).toHaveBeenCalledTimes(1);
  });
  it("new explicit draft creates new key, resets Skill and keeps successful history", async () => {
    render(<EvidenceSubmissionPanel activityId={activity} />); await open(); prepare("first"); fireEvent.click(screen.getByRole("button", { name: "确认保存材料" }));
    await screen.findByText("材料已保存，待核实。XP、Mastery 和奖励未改变。");
    vi.mocked(crypto.randomUUID).mockReturnValue(id(99)); fireEvent.click(screen.getByRole("button", { name: "新建另一份材料" })); prepare("second"); fireEvent.click(screen.getByRole("button", { name: "确认保存材料" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2)); expect(mocks.submit.mock.calls[1][1].requestId).toBe(id(99));
    expect(mocks.submit.mock.calls[0][1].description).toBe("first");
  });
  it("close aborts pending reads; late response cannot reopen or reveal facts", async () => {
    const wait = deferred<unknown>(); mocks.load.mockReturnValue(wait.promise);
    render(<EvidenceSubmissionPanel activityId={activity} />); fireEvent.click(screen.getByRole("button", { name: "展开补证面板" }));
    const signals = mocks.load.mock.calls.map(call => call[2] as AbortSignal); fireEvent.click(screen.getByRole("button", { name: "关闭补证面板" }));
    expect(signals.every(signal => signal.aborted)).toBe(true);
    await act(async () => wait.resolve({ view: "skills", items: [{ id: skill, name: "old private" }], nextCursor: null }));
    expect(screen.queryByText("old private")).toBeNull(); expect(screen.queryByRole("textbox")).toBeNull();
  });
  it("Activity change unmounts private form/clients and starts closed with zero new reads", async () => {
    const { rerender } = render(<EvidenceSubmissionPanel activityId={activity} />); await open(); prepare("previous private");
    rerender(<EvidenceSubmissionPanel activityId={id(88)} />); expect(screen.queryByText("previous private")).toBeNull(); expect(screen.queryByRole("textbox")).toBeNull();
    // Completed reads are no longer active clients; abort is required for pending reads.
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });
  it("Activity change aborts every pending read and ignores the old response", async () => {
    const wait = deferred<unknown>(); mocks.load.mockReturnValue(wait.promise);
    const { rerender } = render(<EvidenceSubmissionPanel activityId={activity} />);
    fireEvent.click(screen.getByRole("button", { name: "展开补证面板" }));
    const signals = mocks.load.mock.calls.map(call => call[2] as AbortSignal);
    rerender(<EvidenceSubmissionPanel activityId={id(88)} />);
    expect(signals.every(signal => signal.aborted)).toBe(true);
    await act(async () => wait.resolve({ view: "submissions", items: [stored({ requestId, skillId: null, description: "old private fact" }).submission], nextCursor: null }));
    expect(screen.queryByText("old private fact")).toBeNull(); expect(mocks.load).toHaveBeenCalledTimes(2);
  });
  it("closing an uncertain POST keeps the original retry ticket on reopen", async () => {
    const wait = deferred<ReturnType<typeof stored>>(); mocks.submit.mockReturnValueOnce(wait.promise);
    render(<EvidenceSubmissionPanel activityId={activity} />); await open(); prepare("same after close"); fireEvent.click(screen.getByRole("button", { name: "确认保存材料" }));
    const signal = mocks.submit.mock.calls[0][2] as AbortSignal; fireEvent.click(screen.getByRole("button", { name: "关闭补证面板" })); expect(signal.aborted).toBe(true);
    await open(); fireEvent.click(screen.getByRole("button", { name: "用相同编号重试" })); await screen.findByText("材料已保存，待核实。XP、Mastery 和奖励未改变。");
    expect(mocks.submit.mock.calls[1][1]).toEqual(mocks.submit.mock.calls[0][1]);
    await act(async () => wait.resolve(stored(mocks.submit.mock.calls[0][1])));
  });
  it("uncertain off-page Skill remains explicitly labelled, never silently displayed as null", async () => {
    mocks.submit.mockRejectedValueOnce(Error("unknown"));
    render(<EvidenceSubmissionPanel activityId={activity} />); await open();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: skill } }); prepare("retain original Skill");
    fireEvent.click(screen.getByRole("button", { name: "确认保存材料" })); await screen.findByRole("button", { name: "用相同编号重试" });
    fireEvent.click(screen.getByRole("button", { name: "关闭补证面板" }));
    mocks.load.mockImplementation(async (_activity, query) => ({ view: query.view, items: [], nextCursor: null }));
    await open(); expect(screen.getByRole("option", { name: "上次选择的技能（不在当前页；重试仍保留原关联）" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "用相同编号重试" })); await screen.findByText("材料已保存，待核实。XP、Mastery 和奖励未改变。");
    expect(mocks.submit.mock.calls[1][1].skillId).toBe(skill);
  });
  it("only explicit next-page action fetches further Skills and preserves notices", async () => {
    mocks.load.mockImplementation(async (_activity, query) => query.view === "skills" ? { view: "skills", items: [{ id: query.after ? id(55) : skill, name: query.after ? "后页" : "截断标签", status: "active", nameTruncated: !query.after }], nextCursor: query.after ? null : skill } : { view: "submissions", items: [], nextCursor: null });
    render(<EvidenceSubmissionPanel activityId={activity} />); await open(); expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("option", { name: "截断标签…（标签已截断）" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "加载下一页技能" })); await screen.findByRole("option", { name: "后页" });
    expect(mocks.load).toHaveBeenCalledTimes(3); expect(mocks.load.mock.calls[2][1]).toEqual({ view: "skills", after: skill });
  });
  it("expired auth is recoverable safe Chinese, no forced business action", async () => {
    mocks.submit.mockRejectedValue(new EvidenceSubmissionError("EVIDENCE_HTTP_FAILURE", "401"));
    render(<EvidenceSubmissionPanel activityId={activity} />); await open(); prepare(); fireEvent.click(screen.getByRole("button", { name: "确认保存材料" }));
    await screen.findByText("登录已过期，请重新登录后重试"); expect(mocks.submit).toHaveBeenCalledTimes(1);
  });
  it("byte counter uses UTF8 not UTF16 and controls carry44px token semantics", async () => {
    const { container } = render(<EvidenceSubmissionPanel activityId={activity} />); await open(); fireEvent.change(screen.getByRole("textbox"), { target: { value: "😀界" } });
    expect(screen.getByText(/7 \/ 8192 UTF8 bytes/)).toBeDefined();
    for (const element of container.querySelectorAll("button,select,textarea")) expect(element.className).toContain("--touch-target-min");
    expect(container.querySelector("textarea")?.getAttribute("aria-describedby")).toBeTruthy();
  });
});
