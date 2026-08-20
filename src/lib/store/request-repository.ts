import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { DemoRepository } from "./demo-repository";
import { SupabaseRepository } from "./supabase-repository";
import type { Repository } from "./repository";

export class AuthRequiredError extends Error {
  readonly code = "auth_required";
  constructor() {
    super("An authenticated Supabase session is required");
  }
}

/** Request-scoped factory; never caches a client or user across requests. */
export async function getAuthenticatedRepository(): Promise<Repository> {
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AuthRequiredError();
  return new SupabaseRepository(client, data.user.id);
}

/**
 * Request-scoped repository for the Activity creation + AI assessment paths.
 *
 * Fail-closed authority model (Round14 P1-2):
 *   - Supabase NOT configured  -> Demo mode (local site works without an auth UI).
 *   - Supabase configured       -> Supabase mode. The request MUST resolve through
 *     the authenticated repository. A missing session throws AuthRequiredError
 *     (route maps it to 401); an auth-infra failure throws and the route maps it
 *     to 5xx. We deliberately do NOT catch-and-fall-back to Demo: silently
 *     writing authoritative permanent growth state into demo.json would create a
 *     second source of truth.
 *
 * This wires the real "Activity → AI → trusted Assessment RPC" path without a
 * big-bang switch of every read path. Reads (dashboard, skills, ledger) still
 * resolve through the Demo repository until full auth + Stage2-B lands.
 */
export async function getRequestRepository(): Promise<Repository> {
  if (!isSupabaseConfigured()) return new DemoRepository();
  // Supabase is configured: require a real authenticated Supabase session.
  // Throws AuthRequiredError (unauthenticated) or a transport error (infra
  // failure) — both must surface to the caller, never downgrade to Demo.
  return getAuthenticatedRepository();
}
