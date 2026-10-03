import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const calls = vi.hoisted(() => ({ provider: [] as string[], routeClient: vi.fn() }));
const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", email: "audit@example.invalid" };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
function session(exp: number) {
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: user.aud, exp })}.audit`,
    refresh_token: "audit-refresh", token_type: "bearer", expires_in: 3600, expires_at: exp, user,
  };
}
vi.mock("@/lib/supabase/env", () => ({
  isSupabaseConfigured: () => true,
  getProjectConfig: () => ({ url: "http://audit.invalid", publishableKey: "public-test-key" }),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: calls.routeClient }));
vi.mock("@supabase/ssr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/ssr")>();
  return { ...actual, createServerClient: (url: string, key: string, options: Parameters<typeof actual.createServerClient>[2]) => actual.createServerClient(url, key, {
    ...options,
    global: { fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = new URL(input instanceof Request ? input.url : String(input));
      calls.provider.push(`${init?.method ?? "GET"} ${target.pathname}${target.search}`);
      return Response.json(target.pathname.endsWith("/user") ? user : session(Math.floor(Date.now() / 1000) + 3600));
    } },
  }) };
});
import { proxy } from "@/proxy";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as demo } from "@/app/api/auth/demo-login/route";
import { MAX_LOGIN_BODY_BYTES } from "@/lib/auth/login-http";

function expiredRequest(path: string, origin = "http://localhost:3000", body = "{") {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST", headers: {
      Origin: origin, "Content-Type": "application/json",
      Cookie: `sb-audit-auth-token=base64-${encode(session(Math.floor(Date.now() / 1000) - 3600))}`,
    }, body,
  });
}
beforeEach(() => { calls.provider.length = 0; calls.routeClient.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

test("real SSR positive control parses expired fixture and refreshes on a protected path", async () => {
  const response = await proxy(expiredRequest("/dashboard"));
  expect(calls.provider).toContain("POST /auth/v1/token?grant_type=refresh_token");
  expect(response.headers.get("set-cookie")).toContain("sb-audit-auth-token");
});
test("real SSR pipeline never refreshes a rejected auth request carrying an expired cookie", async () => {
  for (const [origin, body, status] of [
    ["https://attacker.invalid", "{}", 403],
    ["http://localhost:3000", "{", 400],
    ["http://localhost:3000", '{"email":false,"password":"x"}', 400],
  ] as const) {
    const req = expiredRequest("/api/auth/login", origin, body);
    expect((await proxy(req)).headers.get("set-cookie")).toBeNull();
    expect((await login(req)).status).toBe(status);
    expect(calls.provider).toEqual([]);
    expect(calls.routeClient).not.toHaveBeenCalled();
  }
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_DEMO_ACCOUNT", "true");
  const req = expiredRequest("/api/auth/demo-login");
  expect((await proxy(req)).headers.get("set-cookie")).toBeNull();
  expect((await demo(req)).status).toBe(404);
  expect(calls.provider).toEqual([]);
  expect(calls.routeClient).not.toHaveBeenCalled();
});

test.each(["/api/auth/%6cogin", "/api/auth/log%69n/", "/api%2Fauth%2flogin", "/api/auth/demo%2dlogin"])(
  "once-decoded auth alias %s also avoids refresh, independently of HTTP dispatch", async (path) => {
    const response = await proxy(expiredRequest(path, "https://attacker.invalid"));
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(calls.provider).toEqual([]);
  },
);

test("enabled development demo rejects bad bodies before expired-session refresh or route auth", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("NEXT_PUBLIC_ENABLE_DEV_DEMO_ACCOUNT", "true");
  for (const body of ["{", "null", "[]", '{"extra":true}', "x".repeat(MAX_LOGIN_BODY_BYTES + 1)]) {
    const req = expiredRequest("/api/auth/demo-login", "http://localhost:3000", body);
    expect((await proxy(req)).headers.get("set-cookie")).toBeNull();
    expect((await demo(req)).status).toBe(body.length > MAX_LOGIN_BODY_BYTES ? 413 : 400);
    expect(calls.provider).toEqual([]);
    expect(calls.routeClient).not.toHaveBeenCalled();
  }
});
test.each(["/api/auth/%256cogin", "/api/auth/%ZZ", "/api/auth/login-extra", "/api/auth/login/child"])(
  "non-auth variant %s does not broaden the bypass", async (path) => {
    await proxy(expiredRequest(path));
    expect(calls.provider).toContain("POST /auth/v1/token?grant_type=refresh_token");
  },
);
