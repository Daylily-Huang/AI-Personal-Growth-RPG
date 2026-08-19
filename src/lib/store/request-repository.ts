import { getSupabaseServerClient } from "@/lib/supabase/server";
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
