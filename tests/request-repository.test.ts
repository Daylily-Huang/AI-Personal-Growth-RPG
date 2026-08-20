import { describe, expect, test, vi, afterEach } from "vitest";
import type { Mock } from "vitest";

// Round14 P1-2 — getRequestRepository must be FAIL-CLOSED, not fail-open.
// When Supabase is configured, an unauthenticated request or an auth-infra
// failure must surface as an error (route -> 401 / 5xx), never silently
// downgrade to the Demo repository (which would fork the source of truth for
// authoritative permanent growth state).

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

import { getRequestRepository, AuthRequiredError } from "@/lib/store/request-repository";
import { DemoRepository } from "@/lib/store/demo-repository";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function mockServerClient(getUserResult: unknown) {
  (getSupabaseServerClient as unknown as Mock).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue(getUserResult) },
  });
}

describe("getRequestRepository authority mode (Round14 P1-2)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    (getSupabaseServerClient as unknown as Mock).mockReset();
  });

  test("Supabase not configured -> Demo mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const repo = await getRequestRepository();
    expect(repo).toBeInstanceOf(DemoRepository);
  });

  test("Supabase configured + no session -> throws AuthRequiredError (fail-closed, never Demo)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-anon-key");
    mockServerClient({ data: { user: null }, error: null });
    await expect(getRequestRepository()).rejects.toBeInstanceOf(AuthRequiredError);
  });

  test("Supabase configured + auth infra failure -> throws (fail-closed, never Demo)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-anon-key");
    (getSupabaseServerClient as unknown as Mock).mockRejectedValue(
      new Error("auth infra down"),
    );
    await expect(getRequestRepository()).rejects.toThrow();
  });
});
