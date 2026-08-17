import { createBrowserClient } from "@supabase/ssr";
import { getProjectConfig } from "./env";

/**
 * Browser Supabase client (user session, publishable key only).
 * Safe for client components — never touches secret key.
 * Singleton per page load.
 */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const { url, publishableKey } = getProjectConfig();
  browserClient = createBrowserClient(url, publishableKey);
  return browserClient;
}
