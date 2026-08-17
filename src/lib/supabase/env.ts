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

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Supabase env missing: ${name}. Add it to .env.local (see .env.example). ` +
        `If you only need the code path without a live project, provide the value explicitly.`,
    );
  }
  return value.trim();
}

/** URL + publishable key — the only config the browser / user-scoped clients need. */
export function getProjectConfig(): SupabaseProjectConfig {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    publishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  };
}

/** Service-role secret. Returns "" when not configured; callers decide policy. */
export function getSecretKey(): string {
  return process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
}
