import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import { getProjectConfig } from "./env";
import type { Database } from "./database.types";

/**
 * Browser Supabase client (user session, publishable key only).
 * Safe for client components — never touches secret key.
 * Singleton per page load.
 */
let browserClient: SupabaseClient<Database> | null = null;

export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (browserClient) return browserClient;
  const { url, publishableKey } = getProjectConfig();
  browserClient = createBrowserClient<Database>(url, publishableKey);
  return browserClient;
}
