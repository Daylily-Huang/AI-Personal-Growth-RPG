import { beforeEach, describe, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ configured: true, auth: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => mocks.configured }));
vi.mock("@/lib/store/request-repository", () => ({ getAuthenticatedRepository: mocks.auth,
  AuthRequiredError: class AuthRequiredError extends Error {} }));
import { AuthRequiredError } from "@/lib/store/request-repository";
import * as route from "@/app/api/activities/[id]/route";
const id = "aaaaaaaa-1234-4000-8000-000000000001";
const rawInput = "  原文\r\n\n🙂 <script>alert('literal')</script>\t末尾  ";
const activity = { id, rawInput, title: "合成活动", status: "pending_assessment", rulesVersion: "v-test", createdAt: "2026-10-10T00:00:00Z" };
function get(key = id, query = "") { return route.GET(new Request("http://localhost/api/activities/" + key + query), { params: Promise.resolve({ id: key }) }); }
async function safe(status: number, response: Response) {
  expect(response.status).toBe(status); expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie"); return response.json();
}
beforeEach(() => { vi.clearAllMocks(); mocks.configured = true; mocks.auth.mockResolvedValue({ getActivity: mocks.read }); mocks.read.mockResolvedValue(activity); });
describe("private Activity detail GET", () => {
  test("exports only GET, not a mutation or reusable secret client", () => { expect(Object.keys(route)).toEqual(["GET"]); });
  test("returns complete original receipt without trimming, HTML transformation or domain mutation", async () => {
    const body = await safe(200, await get()); expect(body).toEqual({ activity }); expect(body.activity.rawInput).toBe(rawInput);
    expect(mocks.auth).toHaveBeenCalledTimes(1); expect(mocks.read).toHaveBeenCalledExactlyOnceWith(id);
  });
  test("missing public config is503 and never opens a demo/auth repository", async () => {
    mocks.configured = false; expect(await safe(503, await get())).toEqual({ error: "Activity connection is not configured" }); expect(mocks.auth).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });
  test.each([id, "invalid", "constructor", "__proto__"])("unauthenticated %s is401 before ID validation", async key => {
    mocks.auth.mockRejectedValue(new AuthRequiredError()); expect(await safe(401, await get(key))).toEqual({ error: "Authentication required" }); expect(mocks.read).not.toHaveBeenCalled();
  });
  test.each(["invalid", "constructor", "__proto__", "", "a/b", id + " "])("authenticated invalid ID %s is400 without record read", async key => {
    expect(await safe(400, await get(key))).toEqual({ error: "Invalid activity ID" }); expect(mocks.auth).toHaveBeenCalledTimes(1); expect(mocks.read).not.toHaveBeenCalled();
  });
  test("existing UUID grammar also permits uppercase without a new version restriction", async () => {
    await safe(200, await get(id.toUpperCase())); expect(mocks.read).toHaveBeenCalledWith(id.toUpperCase());
  });
  test.each(["foreign", "nonexistent"])("%s owner-scoped null is the same private404", async () => {
    mocks.read.mockResolvedValue(null); expect(await safe(404, await get())).toEqual({ error: "Activity not found" });
  });
  test("query owner/user flags cannot choose a repository owner or record identity", async () => {
    await safe(200, await get(id, "?user_id=foreign&owner=foreign&service_role=true")); expect(mocks.auth).toHaveBeenCalledWith(); expect(mocks.read).toHaveBeenCalledExactlyOnceWith(id);
  });
  test.each(["constructor", "toString", "__proto__", "secret-sql-error", "token-and-private-data"])("safe generic500 for hostile error %s", async message => {
    mocks.read.mockRejectedValue(new Error(message)); expect(await safe(500, await get())).toEqual({ error: "Unable to load activity" });
  });
  test("auth infrastructure failure is500, never a demo receipt or raw auth error", async () => {
    mocks.auth.mockRejectedValue(new Error("private-auth-infrastructure")); expect(await safe(500, await get())).toEqual({ error: "Unable to load activity" }); expect(mocks.read).not.toHaveBeenCalled();
  });
  test("params rejection is safe500 and request repository is never shared", async () => {
    const rejected = Promise.reject(Error("private-params")); void rejected.catch(() => {});
    await safe(500, await route.GET(new Request("http://localhost"), { params: rejected }));
    await get(); expect(mocks.auth).toHaveBeenCalledTimes(2);
  });
});
