import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getProjectConfig, getSecretKey } from "@/lib/supabase/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * M3 Stage1 — client factory env behavior (offline, no network).
 * These only verify config resolution + the secret-isolation contract; real
 * auth/session behavior is exercised by the integration suite (stage 2/CI).
 */
describe("Supabase client architecture — env config", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://khnpsbsiwmuohakujqgy.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
  });
  afterEach(() => vi.unstubAllEnvs());

  test("getProjectConfig resolves url + publishable key", () => {
    const cfg = getProjectConfig();
    expect(cfg.url).toBe("https://khnpsbsiwmuohakujqgy.supabase.co");
    expect(cfg.publishableKey).toBe("sb_publishable_test");
  });

  test("getProjectConfig throws a helpful error when url is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(() => getProjectConfig()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  test("getSecretKey returns '' when unset (never throws)", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(getSecretKey()).toBe("");
  });

  test("admin client refuses to build without the secret key", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(() => getSupabaseAdminClient()).toThrow(/SUPABASE_SECRET_KEY/);
  });

  test("admin client builds once the secret key is present", () => {
    // Construction performs no network call — only when the client is used.
    const client = getSupabaseAdminClient();
    expect(client).toBeTruthy();
    expect(typeof client.auth.getSession).toBe("function");
  });
});
