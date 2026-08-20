import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getProjectConfig, isSupabaseConfigured } from "./env";
import type { Database } from "./database.types";

const PROTECTED_PREFIXES = ["/dashboard", "/skills"];
const AUTH_PREFIXES = ["/login"];

/**
 * Creates a redirect response that preserves all session cookies and cache headers
 * emitted during token refresh.
 */
export function createRedirectWithSession(
  redirectUrl: URL,
  sourceResponse: NextResponse,
): NextResponse {
  const redirectResponse = NextResponse.redirect(redirectUrl);
  // Propagate all refreshed session cookies
  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
  });
  // Selectively propagate cache-busting headers from @supabase/ssr (avoid internal Next headers)
  for (const headerName of ["cache-control", "pragma", "expires"]) {
    const headerValue = sourceResponse.headers.get(headerName);
    if (headerValue) {
      redirectResponse.headers.set(headerName, headerValue);
    }
  }
  return redirectResponse;
}

/**
 * Updates the user's auth session via cookie inspection and token refresh.
 * Also handles route protection when Supabase is configured:
 * - Redirects unauthenticated users from protected pages (/dashboard, /skills) to /login
 * - Redirects authenticated users from /login to /dashboard
 */
export async function updateSession(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { url, publishableKey } = getProjectConfig();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers?: Record<string, string>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        if (headers) {
          Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
        }
      },
    },
  });

  // getUser guarantees the token is validated against the Supabase Auth server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtectedPage = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
  const isAuthPage = AUTH_PREFIXES.some((prefix) => path.startsWith(prefix));

  if (isProtectedPage && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return createRedirectWithSession(redirectUrl, response);
  }

  if (isAuthPage && user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return createRedirectWithSession(redirectUrl, response);
  }

  return response;
}
