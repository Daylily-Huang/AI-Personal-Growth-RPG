/**
 * Redaction rules for local Supabase stack output (Gate 5D P1-1).
 * Shared by scripts/run-supabase-start-ci.cjs and its regression test.
 */

const REDACTIONS = [
  // Supabase publishable/secret keys (sb_publishable_..., sb_secret_...)
  [/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, "[REDACTED_SB_KEY]"],
  // JWTs (anon / service_role keys and any other eyJ tokens)
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, "[REDACTED_JWT]"],
  // URL userinfo (DB URL postgres passwords etc.) — scheme is not secret, keep it
  [/((?:https?|postgresql|postgres)):\/\/[^:@/\s]+:[^@/\s]+@/g, "$1://[REDACTED]@"],
  // labeled secrets: `anon key: <v>`, `service_role key: <v>`, `JWT secret: <v>`,
  // `Storage Secret Key: <v>`, `password: <v>` ...
  [/((?:[A-Za-z0-9_ -]*\b(?:key|secret|password)\b[A-Za-z0-9_ -]*?):\s*)(\S+)/gi, "$1[REDACTED]"],
];

function sanitizeSupabaseLog(text) {
  let out = text;
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out;
}

module.exports = { sanitizeSupabaseLog };
