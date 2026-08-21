/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("node:child_process");
const fs = require("node:fs");

function parseSupabaseStatusOutput(raw) {
  const vars = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) {
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[match[1]] = val;
    }
  }
  return vars;
}

function exportSupabaseEnv() {
  const raw = execSync("supabase status -o env", { encoding: "utf8" });
  const vars = parseSupabaseStatusOutput(raw);

  const apiUrl = vars.API_URL;
  const pubKey = vars.PUBLISHABLE_KEY || vars.ANON_KEY;
  const secretKey = vars.SECRET_KEY || vars.SERVICE_ROLE_KEY;
  const dbUrl = vars.DB_URL;

  if (!apiUrl || !pubKey || !secretKey || !dbUrl) {
    console.error("Failed to parse local Supabase credentials from status output. Parsed variables:", vars);
    process.exit(1);
  }

  const envFile = process.env.GITHUB_ENV;
  if (envFile) {
    const lines = [
      `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}`,
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${pubKey}`,
      `SUPABASE_SECRET_KEY=${secretKey}`,
      `XP_RPG_TEST_DB_URL=${dbUrl}`,
    ];
    fs.appendFileSync(envFile, lines.join("\n") + "\n");
    console.log("Successfully exported Supabase credentials to GITHUB_ENV.");
  } else {
    console.log("Supabase credentials parsed successfully:", {
      apiUrl,
      pubKeyPrefix: pubKey.slice(0, 10) + "...",
      secretKeyPrefix: secretKey.slice(0, 10) + "...",
      dbUrl,
    });
  }
}

if (require.main === module) {
  exportSupabaseEnv();
}

module.exports = { parseSupabaseStatusOutput, exportSupabaseEnv };
