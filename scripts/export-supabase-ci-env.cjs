/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("node:child_process");
const fs = require("node:fs");

function stripAnsi(str) {
  return str.replace(/[\u001b\x1b]\[[0-9;]*[a-zA-Z]/g, "");
}

function parseSupabaseStatusOutput(raw) {
  const clean = stripAnsi(raw || "");
  const vars = {};
  for (const line of clean.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      vars[key] = val;
    }
  }
  return vars;
}

function readStatusRaw() {
  // Check if piped from stdin
  try {
    const stdinContent = fs.readFileSync(0, "utf-8");
    if (stdinContent && stdinContent.trim().length > 0) {
      return stdinContent;
    }
  } catch {
    // stdin not available or not piped, proceed to exec
  }

  return execSync("supabase status -o env", {
    encoding: "utf8",
    env: process.env,
    stdio: ["pipe", "pipe", "inherit"],
  });
}

function exportSupabaseEnv() {
  const raw = readStatusRaw();
  const vars = parseSupabaseStatusOutput(raw);

  let apiUrl = vars.API_URL;
  if (!apiUrl && vars.REST_URL) {
    try {
      const parsed = new URL(vars.REST_URL);
      apiUrl = parsed.origin;
    } catch {
      // ignore
    }
  }

  const pubKey = vars.PUBLISHABLE_KEY || vars.ANON_KEY;
  const secretKey = vars.SECRET_KEY || vars.SERVICE_ROLE_KEY;
  const dbUrl = vars.DB_URL;

  if (!apiUrl || !pubKey || !secretKey || !dbUrl) {
    console.error("Failed to parse local Supabase credentials from status output.");
    console.error("Raw output received:\n" + raw);
    console.error("Parsed variables:", vars);
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

module.exports = { stripAnsi, parseSupabaseStatusOutput, exportSupabaseEnv };
