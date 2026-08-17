/**
 * Supabase client factory — Milestone 3 Stage 1 (architecture only).
 *
 * The app still runs on DemoRepository; these factories exist so Stage 2
 * (SupabaseRepository + settlement RPC) has a single, reviewed wiring point.
 * M3 Stage1 scope: Schema Bootstrap + Auth + RLS + client architecture only.
 */
export { getProjectConfig, getSecretKey } from "./env";
export type { SupabaseProjectConfig } from "./env";
export { getSupabaseBrowserClient } from "./browser";
export { getSupabaseServerClient } from "./server";
export { getSupabaseAdminClient } from "./admin";
