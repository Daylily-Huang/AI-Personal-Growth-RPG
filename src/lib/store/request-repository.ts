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
 * Request-scoped repository for the Activity creation + AI assessment paths
 * (Round13 P1-3). Uses the authenticated Supabase repository when Supabase is
 * configured AND the request carries a session; otherwise falls back to the
 * Demo repository so the local site keeps working without an auth UI.
 *
 * This wires the real "Activity → AI → trusted Assessment RPC" path without a
 * big-bang switch of every read path. Reads (dashboard, skills, ledger) still
 * resolve through the Demo repository until full auth + Stage2-B lands.
 */
export async function getRequestRepository(): Promise<Repository> {
  if (!isSupabaseConfigured()) return new DemoRepository();
  try {
    const client = await getSupabaseServerClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return new DemoRepository();
    return new SupabaseRepository(client, data.user.id);
  } catch {
    return new DemoRepository();
  }
}
