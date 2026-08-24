#!/usr/bin/env node
/**
 * CI wrapper for `supabase start` (Gate 5D: zero credential leaks).
 *
 * On success: prints a fixed line only — the command's stdout carries the
 * local stack's publishable/secret keys, storage keys and JWT secret, which
 * must never land in the GitHub Actions log.
 *
 * On failure: prints a SANITIZED tail (keys/secret values redacted) so CI
 * failures stay debuggable without leaking credentials.
 *
 * `supabase status -o env` + scripts/export-supabase-ci-env.cjs remain the
 * only sanctioned path for consuming these values (writes to GITHUB_ENV).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require("node:child_process");
const { sanitizeSupabaseLog } = require("./lib/sanitize-supabase-log.cjs");

const result = spawnSync("supabase", ["start"], { encoding: "utf8" });
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

if (result.status === 0) {
  console.log("supabase start: OK (raw output suppressed — local stack credentials are not printed)");
  process.exit(0);
}

console.error(`supabase start FAILED (exit=${result.status}). Sanitized diagnostics (tail):`);
const tail = output.split("\n").slice(-80).join("\n");
console.error(sanitizeSupabaseLog(tail));
if (result.error) console.error(`spawn error: ${result.error.message}`);
process.exit(result.status ?? 1);
