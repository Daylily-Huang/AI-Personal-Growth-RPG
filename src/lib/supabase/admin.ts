// SERVER-ONLY module: reads SUPABASE_SECRET_KEY — never import from a client
// component and never re-export the key. Code review gate: keep it server-only.
import { createClient } from "@supabase/supabase-js";
import { getProjectConfig, getSecretKey } from "./env";
import type { Database } from "./database.types";

/**
 * ✅ DO NOT USE IN NORMAL BUSINESS ROUTES.
 *
 * Service-role admin client. Service-role keys BYPASS RLS — one leaked copy
 * reads every user's growth records. Reserved for trusted server-side paths
 * only, e.g.:
 *   - corrective writes / reconciliation (correction pipeline, future)
 *   - administrative data deletion
 *   - server-to-server automation (never triggered by browser input)
 *
 * If a handler needs the CURRENT user's data, use `getSupabaseServerClient()`
 * (RLS-scoped) instead. If it needs a specific user's rows server-side, obtain
 * that user's JWT and use a user-scoped client — not this one.
 */
export function getSupabaseAdminClient() {
  const { url } = getProjectConfig();
  const secretKey = getSecretKey();
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not configured (server-only env). " +
        "Refusing to build an admin client without it.",
    );
  }
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
