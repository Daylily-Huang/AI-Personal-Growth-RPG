import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  configured: vi.fn(), client: vi.fn(), signIn: vi.fn(), signUp: vi.fn(),
  demo: vi.fn(), getUser: vi.fn(), refreshClient: vi.fn(), refresh: vi.fn(),
}));
vi.mock("@/lib/supabase/env", () => ({
  isSupabaseConfigured: mocks.configured,
  getProjectConfig: () => ({ url: "http://local-auth.invalid", publishableKey: "public-test-key" }),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.refreshClient }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocks.client }));
vi.mock("@/lib/auth/demo-login", () => ({ performQuickDemoLogin: mocks.demo }));
import { POST as login } from "@/app/api/auth/login/route";
import { POST as demo } from "@/app/api/auth/demo-login/route";
import { MAX_LOGIN_BODY_BYTES } from "@/lib/auth/login-http";
import { proxy } from "@/proxy";

const valid = { email: "player@example.com", password: " pass word ", isSignUp: false };
function request(body: unknown = valid, headers: Record<string, string> = {}, raw = false) {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json", ...headers },
    body: raw ? String(body) : JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_DEMO_ACCOUNT", "true");
  mocks.configured.mockReturnValue(true);
  mocks.client.mockResolvedValue({ auth: { signInWithPassword: mocks.signIn, signUp: mocks.signUp, getUser: mocks.getUser } });
  mocks.signIn.mockResolvedValue({ data: { user: { id: "user-a" }, session: { access_token: "secret-token" } }, error: null });
  mocks.signUp.mockResolvedValue({ data: { user: { id: "user-a" }, session: null }, error: null });
  mocks.demo.mockResolvedValue({ sessionCreated: true, userCreated: false });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "demo-user" } }, error: null });
  mocks.refreshClient.mockImplementation((_url: string, _key: string, options: {
    cookies: { setAll(cookies: { name: string; value: string }[]): void };
  }) => ({ auth: { getUser: async () => {
    mocks.refresh();
    options.cookies.setAll([{ name: "sb-expired-session", value: "refreshed" }]);
    return { data: { user: null }, error: null };
  } } }));
});
afterEach(() => vi.unstubAllEnvs());

describe("same-origin login and opt-in development demo routes", () => {
  test("proxy + rejected auth routes never instantiate a refreshing client, even with expired cookies", async () => {
    for (const [path, post] of [["login", login], ["demo-login", demo]] as const) {
      for (const suffix of ["", "/"]) {
        const req = new NextRequest(`http://localhost:3000/api/auth/${path}${suffix}`, {
          method: "POST", headers: { Origin: "https://attacker.invalid", "Content-Type": "application/json", Cookie: "sb-expired-session=expired" },
          body: JSON.stringify(valid),
        });
        const pre = await proxy(req);
        expect(pre.headers.get("set-cookie")).toBeNull();
        expect((await post(req)).status).toBe(403);
      }
    }
    for (const body of ["{", JSON.stringify({ ...valid, isSignUp: "false" })]) {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json", Cookie: "sb-expired-session=expired" }, body,
      });
      expect((await proxy(req)).headers.get("set-cookie")).toBeNull();
      expect((await login(req)).status).toBe(400);
    }
    expect(mocks.refreshClient).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  test("bypass is narrow: protected pages and similarly prefixed paths still validate and refresh", async () => {
    for (const path of ["/dashboard", "/skills", "/api/auth/login-extra"]) {
      const res = await proxy(new NextRequest(`http://localhost:3000${path}`));
      expect(res.headers.get("set-cookie")).toContain("sb-expired-session=refreshed");
      if (path !== "/api/auth/login-extra") expect(res.status).toBe(307);
    }
    expect(mocks.refresh).toHaveBeenCalledTimes(3);
  });
  test.each([login, demo])("unconfigured is unavailable, never fake success", async (post) => {
    mocks.configured.mockReturnValue(false);
    const res = await post(request());
    expect(res.status).toBe(503);
    expect(await res.json()).not.toHaveProperty("success");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
  test.each(["production", "development"])("demo enforces %s environment and opt-in server-side", async (env) => {
    vi.stubEnv("NODE_ENV", env);
    vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_DEMO_ACCOUNT", env === "production" ? "true" : "false");
    expect((await demo(request())).status).toBe(404);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.demo).not.toHaveBeenCalled();
  });
  test.each([login, demo])("rejects cross-site, missing/opaque origin and forged forwarding headers", async (post) => {
    const attempts: Record<string, string>[] = [
      { Origin: "https://attacker.invalid" }, { Origin: "" }, { Origin: "null" },
      { Origin: "http://localhost:3000", "Sec-Fetch-Site": "cross-site" },
      { Origin: "https://attacker.invalid", "X-Forwarded-Host": "attacker.invalid", "X-Forwarded-Proto": "https" },
    ];
    for (const headers of attempts) {
      const res = await post(request(valid, headers));
      expect(res.status).toBe(403);
      expect(res.headers.get("cache-control")).toContain("no-store");
    }
    expect(mocks.client).not.toHaveBeenCalled();
  });
  test.each([login, demo])("rejects simple form media types before auth calls", async (post) => {
    for (const type of ["text/plain", "application/x-www-form-urlencoded", "multipart/form-data", ""]) {
      expect((await post(request(valid, { "Content-Type": type }))).status).toBe(415);
    }
    expect(mocks.client).not.toHaveBeenCalled();
  });
  test.each([null, [], "text", {}, { ...valid, email: {} }, { ...valid, password: 7 },
    { ...valid, email: "not-email" }, { ...valid, password: "" },
    { ...valid, isSignUp: "false" }, { ...valid, role: "admin" }])("rejects invalid body %#", async (body) => {
    expect((await login(request(body))).status).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  test("rejects malformed and oversized streamed JSON without trusting Content-Length", async () => {
    expect((await login(request("{", {}, true))).status).toBe(400);
    expect((await login(request("x".repeat(MAX_LOGIN_BODY_BYTES + 1), { "Content-Length": "1" }, true))).status).toBe(413);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  test.each([login, demo])("rejects reserved own JSON keys before creating an auth client", async (post) => {
    for (const reserved of ['"__proto__"', '"\\u005f_proto__"', '"constructor"', '"prototype"']) {
      const fields = post === login ? '"email":"player@example.com","password":"valid-password",' : '';
      const res = await post(request(`{${fields}${reserved}:{"x":1}}`, {}, true));
      expect(res.status).toBe(400);
      expect(res.headers.get("set-cookie")).toBeNull();
    }
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.demo).not.toHaveBeenCalled();
  });
  test.each([null, [], "text", { email: "player@example.com" }])("demo rejects unexpected arguments %# before auth", async (body) => {
    expect((await demo(request(body))).status).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.demo).not.toHaveBeenCalled();
  });
  test("demo rejects malformed, whitespace-only and oversized bodies before auth", async () => {
    for (const body of ["{", " "]) expect((await demo(request(body, {}, true))).status).toBe(400);
    expect((await demo(request("x".repeat(MAX_LOGIN_BODY_BYTES + 1), { "Content-Length": "1" }, true))).status).toBe(413);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.demo).not.toHaveBeenCalled();
  });
  test.each(["", "{}"]) ("demo accepts the argument-free command body %j", async (body) => {
    const res = await demo(request(body, {}, true));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, hasSession: true });
  });
  test("demo accepts an absent body but ordinary login still requires JSON", async () => {
    const make = () => new Request("http://localhost:3000/api/auth/demo-login", {
      method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
    });
    expect((await demo(make())).status).toBe(200);
    expect((await login(make())).status).toBe(400);
  });
  test("valid login preserves password bytes, trims email, and never exposes tokens", async () => {
    const res = await login(request({ email: " player@example.com ", password: valid.password }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, hasSession: true });
    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith({ email: valid.email, password: valid.password });
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
  test.each([null, { access_token: "signup-secret" }])("signup distinguishes email confirmation from session %#", async (session) => {
    mocks.signUp.mockResolvedValue({ data: { user: { id: "user-a" }, session }, error: null });
    const res = await login(request({ ...valid, isSignUp: true }));
    expect(await res.json()).toEqual({ success: true, hasSession: Boolean(session) });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  test("normal and demo login cannot claim success without a usable session", async () => {
    mocks.signIn.mockResolvedValue({ data: { session: null }, error: null });
    expect((await login(request())).status).toBe(502);
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await demo(request({}))).status).toBe(502);
  });
  test.each([null, {}])("empty provider user is not a successful signup or login %#", async (user) => {
    mocks.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
    expect((await login(request({ ...valid, isSignUp: true }))).status).toBe(502);
    mocks.signIn.mockResolvedValue({ data: { user, session: { access_token: "token-without-user" } }, error: null });
    expect((await login(request())).status).toBe(502);
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    expect((await demo(request({}))).status).toBe(502);
  });
  test("opted-in demo validates the resulting user and excludes account metadata", async () => {
    const res = await demo(request({}));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, hasSession: true });
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });
  test.each([
    ["invalid_credentials", 401], ["email_not_confirmed", 403],
    ["over_request_rate_limit", 429], ["over_email_send_rate_limit", 429],
    ["weak_password", 400], ["unexpected_failure", 502],
  ])("redacts provider errors (%s) with appropriate status", async (code, status) => {
    const raw = { code, message: "PRIVATE-provider-token-password", status: 500 };
    mocks.signIn.mockResolvedValue({ data: { session: null }, error: raw });
    mocks.demo.mockRejectedValue(raw);
    for (const post of [login, demo]) {
      const res = await post(request(post === demo ? {} : valid));
      expect(res.status).toBe(status);
      expect(await res.text()).not.toContain("PRIVATE");
      expect(res.headers.get("cache-control")).toContain("no-store");
    }
  });
});
