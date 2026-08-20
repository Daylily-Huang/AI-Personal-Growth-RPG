import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { GET as getDashboard } from "@/app/api/dashboard/route";
import { GET as getSkills } from "@/app/api/skills/route";
import { POST as postActivity } from "@/app/api/activities/route";
import { POST as postAssess } from "@/app/api/activities/[id]/assess/route";
import { POST as postConfirm } from "@/app/api/assessments/[id]/confirm/route";
import { POST as postLogout } from "@/app/api/auth/logout/route";
import { createRedirectWithSession, updateSession } from "@/lib/supabase/middleware";

describe("Stage 3.1 — HTTP API Route Auth & Middleware Flow", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "test-publishable-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY || "test-secret-key");

    (getSupabaseServerClient as unknown as Mock).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("1. Unauthenticated GET /api/dashboard returns 401 AuthRequiredError", async () => {
    const res = await getDashboard();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("authenticated Supabase session is required");
  });

  test("2. Unauthenticated GET /api/skills returns 401 AuthRequiredError", async () => {
    const res = await getSkills();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("authenticated Supabase session is required");
  });

  test("3. Unauthenticated POST /api/activities returns 401 AuthRequiredError", async () => {
    const req = new Request("http://localhost:3000/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawInput: "Learning Rust" }),
    });
    const res = await postActivity(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("authenticated Supabase session is required");
  });

  test("4. Unauthenticated POST /api/activities/[id]/assess returns 401 AuthRequiredError", async () => {
    const req = new Request("http://localhost:3000/api/activities/test-id/assess", {
      method: "POST",
    });
    const res = await postAssess(req, { params: Promise.resolve({ id: "test-id" }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("authenticated Supabase session is required");
  });

  test("5. Unauthenticated POST /api/assessments/[id]/confirm returns 401 AuthRequiredError", async () => {
    const req = new Request("http://localhost:3000/api/assessments/test-id/confirm", {
      method: "POST",
    });
    const res = await postConfirm(req, { params: Promise.resolve({ id: "test-id" }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("authenticated Supabase session is required");
  });

  test("6. POST /api/auth/logout clears session and returns 200", async () => {
    const res = await postLogout();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("7. Middleware createRedirectWithSession preserves refreshed cookies and Cache-Control headers", () => {
    const sourceResponse = NextResponse.next();
    sourceResponse.cookies.set("sb-access-token", "refreshed-token-xyz", {
      path: "/",
      httpOnly: true,
      secure: true,
    });
    sourceResponse.headers.set("Cache-Control", "no-cache, private, no-store, must-revalidate");
    sourceResponse.headers.set("Pragma", "no-cache");

    const targetUrl = new URL("http://localhost:3000/login");
    const redirectRes = createRedirectWithSession(targetUrl, sourceResponse);

    expect(redirectRes.status).toBe(307);
    expect(redirectRes.headers.get("Location")).toBe("http://localhost:3000/login");
    expect(redirectRes.cookies.get("sb-access-token")?.value).toBe("refreshed-token-xyz");
    expect(redirectRes.headers.get("Cache-Control")).toBe("no-cache, private, no-store, must-revalidate");
    expect(redirectRes.headers.get("Pragma")).toBe("no-cache");
  });

  test("8. Middleware updateSession redirects unauthenticated /dashboard to /login", async () => {
    const req = new NextRequest("http://localhost:3000/dashboard");
    const res = await updateSession(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://localhost:3000/login");
  });

  test("9. Middleware updateSession redirects unauthenticated /skills to /login", async () => {
    const req = new NextRequest("http://localhost:3000/skills");
    const res = await updateSession(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://localhost:3000/login");
  });
});
