// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const fetchMock = vi.fn();
beforeEach(() => {
  router.push.mockReset();
  router.refresh.mockReset();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_DEMO_ACCOUNT", "true");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function fill() {
  fireEvent.change(screen.getByLabelText("电子邮箱"), { target: { value: "player@example.com" } });
  fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password123" } });
}
test("production never renders demo even with opt-in; development requires opt-in", () => {
  const view = render(<LoginPage />);
  expect(screen.queryByText(/一键体验/)).toBeNull();
  vi.stubEnv("NODE_ENV", "development");
  view.rerender(<LoginPage />);
  expect(screen.getByText(/一键体验/)).toBeTruthy();
  vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_DEMO_ACCOUNT", "false");
  view.rerender(<LoginPage />);
  expect(screen.queryByText(/一键体验/)).toBeNull();
});
test("pending request locks mode switching and duplicate submission, preserves reduced motion", async () => {
  fetchMock.mockReturnValue(new Promise(() => undefined));
  const { container } = render(<LoginPage />);
  fill();
  await act(async () => { fireEvent.submit(container.querySelector("form")!); });
  await act(async () => { fireEvent.submit(container.querySelector("form")!); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(screen.getByText("注册新玩家").hasAttribute("disabled")).toBe(true);
  expect(screen.getByLabelText("正在登录").querySelector("svg")?.getAttribute("class")).toContain("motion-reduce:animate-none");
});
test("signup without a session announces confirmation without navigation", async () => {
  fetchMock.mockResolvedValue(Response.json({ success: true, hasSession: false }));
  const { container } = render(<LoginPage />);
  fireEvent.click(screen.getByText("注册新玩家")); fill();
  expect(screen.getByLabelText("密码").getAttribute("autocomplete")).toBe("new-password");
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("邮箱确认"));
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).isSignUp).toBe(true);
  expect(screen.getByLabelText("密码").getAttribute("autocomplete")).toBe("current-password");
  expect(router.push).not.toHaveBeenCalled();
});
test.each([false, true])("session-backed auth navigates and refreshes (%s signup)", async (isSignUp) => {
  fetchMock.mockResolvedValue(Response.json({ success: true, hasSession: true }));
  const { container } = render(<LoginPage />);
  if (isSignUp) fireEvent.click(screen.getByText("注册新玩家"));
  fill(); fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(router.push).toHaveBeenCalledExactlyOnceWith("/dashboard"));
  expect(router.refresh).toHaveBeenCalledTimes(1);
});
test("opted-in demo requires a session before navigating", async () => {
  vi.stubEnv("NODE_ENV", "development");
  fetchMock.mockResolvedValueOnce(Response.json({ success: true, hasSession: false }))
    .mockResolvedValueOnce(Response.json({ success: true, hasSession: true }));
  render(<LoginPage />);
  fireEvent.click(screen.getByText(/一键体验/));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(router.push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText(/一键体验/));
  await waitFor(() => expect(router.push).toHaveBeenCalledExactlyOnceWith("/dashboard"));
  expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/demo-login");
});
test.each([{ success: true, unconfigured: true }, { success: true, hasSession: false }, { error: "邮箱或密码不正确" }])("failed or false-success login shows error and unlocks form %#", async (body) => {
  fetchMock.mockResolvedValue(Response.json(body));
  const { container } = render(<LoginPage />); fill();
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(screen.queryByLabelText("正在登录")).toBeNull();
  expect(router.push).not.toHaveBeenCalled();
});
