// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SkillCreateForm from "@/app/skills/components/SkillCreateForm";
import SkillsPage from "@/app/skills/page";
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/skills/components/SkillGraphCanvas", () => ({ default: () => null }));
vi.mock("@/components/layout/InspectorDrawer", () => ({ InspectorDrawer: () => null }));
const create = vi.fn(), cancel = vi.fn(), unauthorized = vi.fn();
const name = "Molecular Ecology";
const skill = { id: "3ae5b910-56ef-4dfb-a196-0d0d89b8f1d2", name, aliases: [], description: null, domainId: null,
  xp: 0, level: 1, masteryLevel: 0, masteryConfidence: 0, status: "active", lastUsedAt: null,
  createdAt: "2026-10-08T00:00:00Z", updatedAt: "2026-10-08T00:00:00Z" };
const fetchMock = vi.fn();
beforeEach(() => { vi.clearAllMocks(); fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function form() { return render(<SkillCreateForm onCreated={create} onCancel={cancel} onUnauthorized={unauthorized} />); }
function submit(value = name) {
  fireEvent.change(screen.getByLabelText("技能名称"), { target: { value } });
  fireEvent.submit(screen.getByRole("form", { name: "新建零XP技能" }));
}
test("accessible name and zero explanation, sends only name and accepts exact receipt", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ skill }), { status: 201 })); form(); submit(` ${name} `);
  await waitFor(() => expect(create).toHaveBeenCalledExactlyOnceWith(skill));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name });
  expect(screen.getByText(/建档不代表能力提升/)).toBeDefined();
});
test.each(["", " ", "a".repeat(201)])("invalid name %s makes no request", value => {
  form(); submit(value); expect(screen.getByRole("alert").textContent).toContain("1–200"); expect(fetchMock).not.toHaveBeenCalled();
});
test.each([400, 409, 500])("HTTP%s preserves input and reports no success", async status => {
  fetchMock.mockResolvedValue(new Response("{}", { status })); form(); submit();
  await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
  expect((screen.getByLabelText("技能名称") as HTMLInputElement).value).toBe(name); expect(create).not.toHaveBeenCalled();
});
test("401 requests login without false success", async () => {
  fetchMock.mockResolvedValue(new Response("{}", { status: 401 })); form(); submit();
  await waitFor(() => expect(unauthorized).toHaveBeenCalledOnce()); expect(create).not.toHaveBeenCalled();
});
test.each([{ name: "Foreign" }, { xp: 5 }, { masteryLevel: 1 }, { masteryConfidence: 0.5 }, { id: undefined }, { domainId: undefined }])("malformed/wrong-target receipt %j fails", async delta => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ skill: { ...skill, ...delta } }), { status: 201 })); form(); submit();
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("先刷新")); expect(create).not.toHaveBeenCalled();
});
test("network uncertainty no auto retry; input remains", async () => {
  fetchMock.mockRejectedValue(Error("offline")); form(); submit();
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("不会自动重复提交")); expect(fetchMock).toHaveBeenCalledOnce();
});
test("double submit guarded, unmount ignores late success", async () => {
  let resolve!: (r: Response) => void;
  fetchMock.mockReturnValue(new Promise<Response>(r => { resolve = r; }));
  const view = form(); submit(); submit(); expect(fetchMock).toHaveBeenCalledOnce();
  expect((screen.getByLabelText("技能名称") as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "取消" })); expect(cancel).toHaveBeenCalledOnce();
  view.unmount(); resolve(new Response(JSON.stringify({ skill }), { status: 201 }));
  await Promise.resolve(); await Promise.resolve(); expect(create).not.toHaveBeenCalled();
});
test("page creation succeeds even when subsequent graph refresh fails; no false recreation", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ domains: [], nodes: [], edges: [] }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ skill }), { status: 201 })).mockRejectedValueOnce(Error("reload offline"));
  render(<SkillsPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: "新建技能" })).toBeDefined());
  fireEvent.click(screen.getByRole("button", { name: "新建技能" })); submit();
  await waitFor(() => expect(screen.getByText("加载失败")).toBeDefined());
  expect(screen.getByRole("status").textContent).toContain(`已建立 ${name}`);
  expect(screen.getByRole("status").textContent).toContain("无需再次建档");
  expect(screen.queryByRole("form", { name: "新建零XP技能" })).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
