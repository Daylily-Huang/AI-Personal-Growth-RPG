/**
 * Supabase env access (Milestone 3 — connection config).
 *
 * Key model (Round6, user-approved naming — the old ANON_KEY / SERVICE_ROLE_KEY
 * names are retired):
 *   NEXT_PUBLIC_SUPABASE_URL              — project URL (safe to ship)
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  — publishable/anon key (safe to ship)
 *   SUPABASE_SECRET_KEY                   — service-role (SECRET: server-only,
 *                                           NEVER NEXT_PUBLIC_, never to browser)
 *
 * Settings are read lazily on each call so tests can stub them via
 * vi.stubEnv without import-order surprises.
 */

export interface SupabaseProjectConfig {
  url: string;
  publishableKey: string;
}

/** URL + publishable key — the only config the browser / user-scoped clients need. */
export function getProjectConfig(): SupabaseProjectConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url) {
    throw new Error(
      `Supabase env missing: NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local (see .env.example).`,
    );
  }
  if (!publishableKey) {
    throw new Error(
      `Supabase env missing: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add it to .env.local (see .env.example).`,
    );
  }

  return {
    url,
    publishableKey,
  };
}

/** Service-role secret. Returns "" when not configured; callers decide policy. */
export function getSecretKey(): string {
  return process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
}

/** True when the publishable client config is present (browser/user-scoped). */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
}
