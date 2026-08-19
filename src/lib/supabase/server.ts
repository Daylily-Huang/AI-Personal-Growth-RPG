// SERVER-ONLY module: imports `next/headers`, never import from a client component.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getProjectConfig } from "./env";
import type { Database } from "./database.types";

/**
 * User-scoped server Supabase client authenticated by the request session
 * cookie (publishable key + cookies). RLS then restricts rows to auth.uid().
 *
 * Next 16: `cookies()` is async → this factory is async; make a fresh client
 * per request (never cache across requests).
 *
 * NOTE: session refresh writes cookies via setAll. If we are inside a Server
 * Component where the response is already committed, setAll can throw — the
 * middleware must own refresh (stage 2 wire-up) and merge the `headers` the
 * client passes (bear `Cache-Control: private, no-store` so one user's session
 * is never served to another via CDN).
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getProjectConfig();
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet, headers: Record<string, string>) => {
        void headers; // @supabase/ssr passes cache-busting headers; merge in middleware (stage 2)
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component context → can't write cookies here; middleware refresh covers it.
        }
      },
    },
  });
}
