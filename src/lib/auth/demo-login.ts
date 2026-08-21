import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const DEMO_USER_EMAIL = "demo_player@growth-rpg.dev";
export const DEMO_USER_PASSWORD = "Password123!";

export interface DemoLoginResult {
  sessionCreated: boolean;
  userCreated: boolean;
}

/**
 * Checks whether an authentication error indicates missing user or invalid credentials.
 * Only credentials-level errors qualify for bootstrapping a demo user on fresh DB instances.
 */
export function isInvalidCredentialsError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; status?: number };
  if (e.code === "invalid_credentials") return true;
  if (typeof e.message === "string" && e.message.toLowerCase().includes("invalid login credentials")) {
    return true;
  }
  return false;
}

/**
 * Performs quick demo login with strict error discrimination.
 *
 * Flow:
 * 1. Attempts signInWithPassword with demo credentials.
 * 2. If signIn succeeds, returns immediately.
 * 3. If signIn fails with invalid_credentials (user does not exist on fresh instance):
 *    Attempts signUp to bootstrap demo user:
 *    - If signUp immediately yields a session, returns without duplicate signIn.
 *    - If signUp succeeds without a session (or user was already created concurrently), retries signIn.
 * 4. If signIn fails with any other error (network failure, 429 rate limit, 500 server error):
 *    Rethrows immediately without attempting signUp.
 */
export async function performQuickDemoLogin(
  client: SupabaseClient<Database>,
  options?: { email?: string; password?: string },
): Promise<DemoLoginResult> {
  const email = options?.email ?? DEMO_USER_EMAIL;
  const password = options?.password ?? DEMO_USER_PASSWORD;

  const { error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (!signInErr) {
    return { sessionCreated: true, userCreated: false };
  }

  // Only invalid_credentials qualifies for bootstrap signup fallback.
  // Network failures, 429 rate limits, 500 server errors, etc. must not trigger signup.
  if (!isInvalidCredentialsError(signInErr)) {
    throw signInErr;
  }

  // Bootstrap demo user on fresh database instance
  const { data: signUpData, error: signUpErr } = await client.auth.signUp({
    email,
    password,
  });

  if (
    signUpErr &&
    !signUpErr.message?.includes("already registered") &&
    (signUpErr as { code?: string }).code !== "user_already_exists"
  ) {
    throw signUpErr;
  }

  if (signUpData?.session) {
    return { sessionCreated: true, userCreated: true };
  }

  // If signUp succeeded without an active session (e.g. email confirmation required or duplicate), retry signIn
  const { error: retrySignInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (retrySignInErr) {
    throw retrySignInErr;
  }

  return { sessionCreated: true, userCreated: !signUpErr };
}
