import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getProjectConfig, isSupabaseConfigured } from "./env";
import type { Database } from "./database.types";

/**
 * Updates the user's auth session via cookie inspection and token refresh.
 * Also handles route protection when Supabase is configured:
 * - Redirects unauthenticated users from protected pages to /login
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
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // getUser guarantees the token is validated against the Supabase Auth server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login");
  const isApiRoute = path.startsWith("/api");
  const isStatic = path.startsWith("/_next") || path.startsWith("/favicon.ico");

  if (!isApiRoute && !isStatic) {
    if (!user && !isAuthPage) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      return NextResponse.redirect(redirectUrl);
    }
    if (user && isAuthPage) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}
