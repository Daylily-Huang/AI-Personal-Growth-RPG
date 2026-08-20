import http from "node:http";
import next from "next";
import { describe, expect, test, beforeAll, afterAll } from "vitest";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

const DATABASE_URL = process.env.XP_RPG_TEST_DB_URL;
const TEST_PORT = 3095;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "test-publishable-key";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
process.env.SUPABASE_SECRET_KEY = SUPABASE_SERVICE_ROLE_KEY;

function createCookieJar() {
  const store = new Map<string, string>();
  const client = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return Array.from(store.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          if (!value) store.delete(name);
          else store.set(name, value);
        });
      },
    },
  });

  return {
    store,
    client,
    getCookieHeader() {
      return Array.from(store.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    },
    mergeFromResponse(res: Response) {
      const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      setCookies.forEach((cookieStr) => {
        const [part] = cookieStr.split(";");
        const [name, ...val] = part.split("=");
        if (name) {
          const v = val.join("=");
          if (cookieStr.includes("Max-Age=0") || !v) {
            store.delete(name.trim());
          } else {
            store.set(name.trim(), v.trim());
          }
        }
      });
    },
  };
}

describe.skipIf(!DATABASE_URL)("Stage 3.1 — Full Real HTTP / Browser Auth E2E (Live Next.js Server)", () => {
  let app: ReturnType<typeof next>;
  let server: http.Server;
  const userAEmail = `e2e_player_a_${Date.now()}@growth.rpg`;
  const userBEmail = `e2e_player_b_${Date.now()}@growth.rpg`;
  const testPassword = "Password123!Safe";

  beforeAll(async () => {
    app = next({
      dev: false,
      hostname: "127.0.0.1",
      port: TEST_PORT,
      dir: process.cwd(),
    });
    await app.prepare();

    const handle = app.getRequestHandler();
    server = http.createServer((req, res) => handle(req, res));
    await new Promise<void>((resolve) => server.listen(TEST_PORT, "127.0.0.1", () => resolve()));
  }, 30000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (app) {
      await app.close();
    }
  });

  test("1. Unauthenticated HTTP access to /dashboard is intercepted by proxy with 307 -> /login", async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, { redirect: "manual" });
    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toContain("/login");
  });

  test("2. Unauthenticated HTTP access to /api/dashboard returns 401 AuthRequiredError", async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("authenticated Supabase session is required");
  });

  test("3. Real Player A signs up, authenticates, and completes full Activity -> Assess -> Settle journey over HTTP", async () => {
    const jarA = createCookieJar();

    // Sign up User A via Supabase Auth
    const { data: authData, error: authErr } = await jarA.client.auth.signUp({
      email: userAEmail,
      password: testPassword,
    });
    expect(authErr).toBeNull();
    if (!authData?.session) {
      const { error: signErr } = await jarA.client.auth.signInWithPassword({
        email: userAEmail,
        password: testPassword,
      });
      expect(signErr).toBeNull();
    }

    const cookieHeader = jarA.getCookieHeader();
    expect(cookieHeader).toBeTruthy();

    // 1. Initial Dashboard Read over HTTP
    const dashRes1 = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: cookieHeader },
    });
    expect(dashRes1.status).toBe(200);
    const { dashboard: dash1 } = await dashRes1.json();
    expect(dash1.player.totalXp).toBe(0);
    expect(dash1.player.playerLevel).toBe(1);
    expect(dash1.activities.length).toBe(0);

    // 2. Create Activity over HTTP
    const createActRes = await fetch(`${BASE_URL}/api/activities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        rawInput: "Mastered PostgreSQL RLS and Security Definer RPCs",
        totalMinutes: 60,
        effectiveMinutes: 50,
      }),
    });
    expect(createActRes.status).toBe(201);
    const actBody = await createActRes.json();
    expect(actBody.activity.id).toBeDefined();
    expect(actBody.activity.status).toBe("pending_assessment");
    const activityId = actBody.activity.id;

    // 3. Request AI Assessment over HTTP
    const assessRes = await fetch(`${BASE_URL}/api/activities/${activityId}/assess`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
    });
    expect(assessRes.status).toBe(200);
    const assessBody = await assessRes.json();
    expect(assessBody.assessment.id).toBeDefined();
    const assessmentId = assessBody.assessment.id;

    // 4. Confirm and Settle Assessment over HTTP
    const confirmRes = await fetch(`${BASE_URL}/api/assessments/${assessmentId}/confirm`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
    });
    expect(confirmRes.status).toBe(200);
    const confirmBody = await confirmRes.json();
    expect(confirmBody.transaction).toBeDefined();
    expect(confirmBody.transaction.amount).toBeGreaterThan(0);

    // 5. Re-query Dashboard over HTTP -> verify real DB state update
    const dashRes2 = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: cookieHeader },
    });
    expect(dashRes2.status).toBe(200);
    const { dashboard: dash2 } = await dashRes2.json();
    expect(dash2.player.totalXp).toBeGreaterThan(0);
    expect(dash2.activities.length).toBe(1);
    expect(dash2.recentGrowth.length).toBe(1);
    expect(dash2.skills.length).toBeGreaterThan(0);

    // 6. User A accesses /dashboard page over HTTP with session cookie -> 200 OK (no redirect)
    const pageRes = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: cookieHeader },
      redirect: "manual",
    });
    expect(pageRes.status).toBe(200);
  });

  test("4. Player B context is completely isolated over HTTP", async () => {
    const jarB = createCookieJar();

    // Sign up User B
    const { data: authDataB, error: authErrB } = await jarB.client.auth.signUp({
      email: userBEmail,
      password: testPassword,
    });
    expect(authErrB).toBeNull();
    if (!authDataB?.session) {
      const { error: signErrB } = await jarB.client.auth.signInWithPassword({
        email: userBEmail,
        password: testPassword,
      });
      expect(signErrB).toBeNull();
    }

    const cookieHeaderB = jarB.getCookieHeader();

    // Query User B's dashboard over HTTP
    const dashResB = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: cookieHeaderB },
    });
    expect(dashResB.status).toBe(200);
    const { dashboard: dashB } = await dashResB.json();
    // Verify User B cannot see User A's data
    expect(dashB.player.totalXp).toBe(0);
    expect(dashB.activities.length).toBe(0);
    expect(dashB.recentGrowth.length).toBe(0);
  });

  test("5. Logout over HTTP clears session and returns 401 on subsequent protected API requests", async () => {
    const jarA = createCookieJar();
    await jarA.client.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword,
    });

    let cookieHeader = jarA.getCookieHeader();

    // Call Logout over HTTP
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
    });
    expect(logoutRes.status).toBe(200);

    // Merge deleted cookies from response
    jarA.mergeFromResponse(logoutRes);
    cookieHeader = jarA.getCookieHeader();

    // Access /api/dashboard after logout -> 401
    const dashAfterLogout = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: cookieHeader },
    });
    expect(dashAfterLogout.status).toBe(401);
  });

  test("6. Session token refresh maintains valid authenticated HTTP access to protected routes", async () => {
    const jarA = createCookieJar();
    const { error: signInErr } = await jarA.client.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword,
    });
    expect(signInErr).toBeNull();

    // Trigger genuine Supabase Auth session refresh
    const { data: refreshData, error: refreshErr } = await jarA.client.auth.refreshSession();
    expect(refreshErr).toBeNull();
    expect(refreshData.session).toBeDefined();

    const refreshedCookieHeader = jarA.getCookieHeader();
    expect(refreshedCookieHeader).toBeTruthy();

    // Query protected API using refreshed session cookies over HTTP
    const dashRes = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { Cookie: refreshedCookieHeader },
    });
    expect(dashRes.status).toBe(200);
    const { dashboard } = await dashRes.json();
    expect(dashboard.player.totalXp).toBeGreaterThan(0);
  });
});
